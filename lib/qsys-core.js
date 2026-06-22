var net = require('net');

const CONFIG = {
    KEEP_ALIVE_INTERVAL: 10000,      // 10 seconds
    SOCKET_TIMEOUT: 30000,           // 30 seconds
    NOOP_INTERVAL: 15000,            // 15 seconds (must be < SOCKET_TIMEOUT to prevent timeouts)
    RECONNECT_BASE_DELAY: 1000,      // 1 second
    RECONNECT_MAX_DELAY: 60000,      // 60 seconds (1 minute) max backoff
    RECONNECT_MAX_RETRIES: 6         // 6 retries = 2^6 = 64 seconds, capped at 60s
};

const ConnectionState = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    ERROR: 'error'
};

module.exports = function (RED) {
    'use strict';

    function QsysCoreNode(n) {
        RED.nodes.createNode(this, n);
        // Many child nodes (one per DSP component) attach connection/rx
        // listeners to this config node. Lift the default 10-listener cap so
        // large flows don't emit MaxListenersExceededWarning (which would also
        // mask genuine listener leaks).
        this.setMaxListeners(0);
        let host = n.host;
        let port = n.port;
        let isRedundant = n.isRedundant === 'true';
        let redundantHost = n.redundantHost;
        let authentication = n.authentication === 'true';
        let username = this.credentials.username;
        let password = this.credentials.password;
        let logConnection = n.logConnection === 'true';
        let logCommunications = n.logCommunications === 'true';
        let noOp = null;
        let reconnectAttempts = 0;
        let reconnectTimer = null;
        let isReconnecting = false;
        let hasReachedMaxDelay = false;
        let connectionState = ConnectionState.DISCONNECTED;
        let messageBuffer = Buffer.alloc(0);

        this.changeGroup = [
            { 'autoPoll': false, 'params': { 'Id': 'group 1', 'Rate': parseFloat(n.pollTime1) } },
            { 'autoPoll': false, 'params': { 'Id': 'group 2', 'Rate': parseFloat(n.pollTime2) } },
            { 'autoPoll': false, 'params': { 'Id': 'group 3', 'Rate': parseFloat(n.pollTime3) } },
            { 'autoPoll': false, 'params': { 'Id': 'group 4', 'Rate': parseFloat(n.pollTime4) } }
        ];

        const logWithTimestamp = (message, isError = false) => {
            const timestamp = new Date().toISOString();
            const formattedMessage = `[${timestamp}] ${message}`;
            if (isError) {
                this.error(formattedMessage);
            } else {
                this.log(formattedMessage); // Use log instead of trace so messages are visible
            }
        };

        const initializeSocket = (socket, host, port) => {
            socket.setKeepAlive(true, CONFIG.KEEP_ALIVE_INTERVAL);
            socket.setTimeout(CONFIG.SOCKET_TIMEOUT);
            socket.setMaxListeners(0);
            updateNodeStatus(ConnectionState.CONNECTING, 'initializing...');

            socket.on('timeout', () => {
                logWithTimestamp('Socket timeout detected, destroying socket', true);
                socket.destroy(); // Destroy the socket on timeout
            });

            socket.on('error', (err) => {
                logWithTimestamp(`Socket error: ${err.toString()}`, true);
                updateNodeStatus(ConnectionState.ERROR, err.message);
                if (isRedundant) {
                    reconnectToRedundantHost();
                } else {
                    reconnect();
                }
            });

            socket.on('end', () => {
                logWithTimestamp('socket end');
                updateNodeStatus(ConnectionState.DISCONNECTED, 'connection ended');
            });

            socket.on('close', () => {
                if (logConnection) {
                    logWithTimestamp('socket closed');
                }
                if (noOp != null) {
                    clearInterval(noOp);
                    noOp = null;
                }
                reconnect();
            });

            socket.on('ready', () => {
                if (logConnection) {
                    logWithTimestamp('socket ready');
                }
                
                // Update node status to connected
                updateNodeStatus(ConnectionState.CONNECTED);

                if (authentication) {
                    try {
                        if (!username || !password) {
                            throw new Error('Authentication credentials not provided');
                        }
                        const message = encapsulate(createJsonRpcMessage('Logon', {
                            'User': username,
                            'Password': password
                        }));
                        if (message) {
                            socket.write(message);
                        } else {
                            throw new Error('Failed to create authentication message');
                        }
                    } catch (err) {
                        logWithTimestamp(`Authentication error: ${err.message}`, true);
                        socket.destroy();
                        return;
                    }
                }

                // Clear any existing NoOp interval before starting a new one
                if (noOp != null) {
                    clearInterval(noOp);
                    noOp = null;
                }
                
                noOp = setInterval(() => {
                    socket.write(encapsulate(createJsonRpcMessage('NoOp', {})));
                }, CONFIG.NOOP_INTERVAL);
            });

            socket.on('connect', () => {
                if (logConnection) {
                    logWithTimestamp('Socket connected');
                }
                reconnectAttempts = 0;
            });

            socket.on('data', (data) => {
                if (logCommunications) {
                    logWithTimestamp('rx: ' + data.toString(), false);
                }

                let rx = [];
                try {
                    for (let i = 0; i < data.length; i++) {
                        if (data[i] == 0x0 && data.length != 0) {
                            let obj = JSON.parse((Buffer.from(rx)).toString());
                            if ('method' in obj) {
                                switch (obj.method) {
                                    case 'EngineStatus':
                                        if (obj.params.State === 'Active') {
                                            this.emit('ready');
                                        } else if (isRedundant && obj.params.State === 'Standby') {
                                            reconnectToRedundantHost();
                                        }
                                        break;
                                    case 'ChangeGroup.Poll':
                                        let changes = obj.params.Changes;
                                        if (changes.length !== 0) {
                                            for (let change of changes) {
                                                this.emit('rx', change);
                                            }
                                        }
                                        break;
                                    default:
                                        break;
                                }
                            }
                            rx = [];
                        } else {
                            rx.push(data[i]);
                        }
                    }
                } catch (err) {
                    logWithTimestamp(`Error processing data: ${err.message}`, true);
                }
            });

            return socket;
        };

        const cleanup = () => {
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            if (noOp != null) {
                clearInterval(noOp);
                noOp = null;
            }
            messageBuffer = Buffer.alloc(0);
            isReconnecting = false;
        };

        const reconnect = () => {
            if (isReconnecting) {
                return; // Prevent multiple concurrent reconnection attempts
            }

            isReconnecting = true;
            updateNodeStatus(ConnectionState.CONNECTING, `Attempt ${reconnectAttempts + 1}`);
            const retryExponent = Math.min(reconnectAttempts, CONFIG.RECONNECT_MAX_RETRIES);
            const calculatedDelay = CONFIG.RECONNECT_BASE_DELAY * Math.pow(2, retryExponent);
            const delay = Math.min(calculatedDelay, CONFIG.RECONNECT_MAX_DELAY); // Cap at 60 seconds
            
            // Only log if we haven't reached max delay or just reached it
            if (!hasReachedMaxDelay) {
                if (reconnectAttempts >= CONFIG.RECONNECT_MAX_RETRIES) {
                    logWithTimestamp(`Reconnection backoff reached maximum delay (${CONFIG.RECONNECT_MAX_DELAY/1000} seconds). Further reconnection attempts will continue silently.`);
                    hasReachedMaxDelay = true;
                } else {
                    logWithTimestamp(`Scheduling reconnect attempt ${reconnectAttempts + 1} in ${delay}ms`);
                }
            }
            
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
            }

            reconnectTimer = setTimeout(() => {
                if (!hasReachedMaxDelay) {
                    logWithTimestamp(`Attempting to reconnect (attempt ${reconnectAttempts + 1})...`, false);
                }
                
                let newSocket;
                try {
                    newSocket = net.connect(port, host);
                } catch (err) {
                    logWithTimestamp(`Failed to create socket connection: ${err.message}`, true);
                    isReconnecting = false;
                    reconnect();
                    return;
                }
                newSocket.once('connect', () => {
                    logWithTimestamp('Reconnection successful');
                    reconnectAttempts = 0;
                    isReconnecting = false;
                    hasReachedMaxDelay = false; // Reset on successful connection
                    this.socket = initializeSocket(newSocket, host, port);
                });

                newSocket.once('error', (err) => {
                    if (!hasReachedMaxDelay) {
                        logWithTimestamp(`Reconnection attempt failed: ${err.message}`);
                    }
                    reconnectAttempts++;
                    isReconnecting = false;
                    newSocket.destroy();
                    reconnect(); // Schedule next attempt
                });
            }, delay);
        };

        const reconnectToRedundantHost = () => {
            logWithTimestamp('Switching to redundant host...');
            updateNodeStatus(ConnectionState.CONNECTING, 'Switching to redundant host');
            cleanup();
            if (this.socket) {
                this.socket.destroy();
            }
            reconnectAttempts = 0; // Reset attempts when switching to redundant
            hasReachedMaxDelay = false; // Reset delay cap when switching to redundant
            this.socket = initializeSocket(net.connect(port, redundantHost), redundantHost, port);
        };

        const createJsonRpcMessage = (method, params = {}, id = null) => ({
            jsonrpc: '2.0',
            method,
            params,
            ...(id !== null && { id })
        });

        const encapsulate = (obj) => {
            try {
                return Buffer.concat([Buffer.from(JSON.stringify(obj)), Buffer.from([0x0])]);
            } catch (err) {
                logWithTimestamp(`Failed to encode message: ${err.message}`, true);
                return null;
            }
        };

        const updateNodeStatus = (state, message = '') => {
            if (logConnection && state !== connectionState) {
                logWithTimestamp(`Connection state changed from ${connectionState} to ${state}${message ? ': ' + message : ''}`);
            }
            connectionState = state;
            
            // Emit state change events for child nodes
            this.emit('state', state);
            
            switch (state) {
                case ConnectionState.CONNECTED:
                    this.status({fill: 'green', shape: 'dot', text: 'connected'});
                    this.emit('connected');
                    break;
                case ConnectionState.CONNECTING:
                    this.status({fill: 'yellow', shape: 'ring', text: message || 'connecting...'});
                    this.emit('connecting');
                    break;
                case ConnectionState.ERROR:
                    this.status({fill: 'red', shape: 'ring', text: message || 'error'});
                    this.emit('error', message);
                    break;
                case ConnectionState.DISCONNECTED:
                    this.status({fill: 'red', shape: 'dot', text: 'disconnected'});
                    this.emit('disconnected');
                    break;
            }
        };

        this.sendToCore = (obj) => {
            try {
                if (logCommunications) {
                    logWithTimestamp('tx: ' + JSON.stringify(obj));
                }

                if (this.socket !== null) {
                    const message = encapsulate(obj);
                    if (message) {
                        this.socket.write(message);
                    } else {
                        throw new Error('Failed to encapsulate message');
                    }
                } else {
                    throw new Error('Socket not connected');
                }
            } catch (err) {
                logWithTimestamp(`Failed to send message: ${err.message}`, true);
            }
        };

        this.autoPoll = (index) => {
            if (!this.changeGroup[index].autoPoll) {
                this.changeGroup[index].autoPoll = true;
                this.sendToCore({
                    "jsonrpc": "2.0",
                    "id": 1234,
                    "method": "ChangeGroup.AutoPoll",
                    "params": this.changeGroup[index].params
                });
            }
        };

        // Establish the initial connection. Guard against a synchronous throw
        // (e.g. an invalid/NaN port) so the config node always finishes
        // constructing; otherwise getNode() returns null in every child node.
        try {
            this.socket = initializeSocket(net.connect(port, host), host, port);
        } catch (err) {
            this.socket = null;
            logWithTimestamp(`Failed to establish initial connection: ${err.message}`, true);
            updateNodeStatus(ConnectionState.ERROR, err.message);
            reconnect();
        }

        this.on('close', (removed, done) => {
            if (this.socket) {
                this.socket.removeAllListeners(); // Remove all listeners
                cleanup();
                if (removed) {
                    this.socket.destroy();
                } else {
                    this.socket.end();
                }
            }
            done();
        });
    }

    RED.nodes.registerType('qsys-core', QsysCoreNode, {
        credentials: {
            username: { type: 'text' },
            password: { type: 'password' }
        }
    });
};