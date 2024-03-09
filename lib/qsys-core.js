var net = require('net');

module.exports = function (RED) {
    'use strict';

    function QsysCoreNode(n) {
        RED.nodes.createNode(this, n);
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

        this.changeGroup = [{ 'autoPoll': false, 'params': { 'Id': 'group 1', 'Rate': parseFloat(n.pollTime1) } },
        { 'autoPoll': false, 'params': { 'Id': 'group 2', 'Rate': parseFloat(n.pollTime2) } },
        { 'autoPoll': false, 'params': { 'Id': 'group 3', 'Rate': parseFloat(n.pollTime3) } },
        { 'autoPoll': false, 'params': { 'Id': 'group 4', 'Rate': parseFloat(n.pollTime4) } }];
        
        this.socket = net.connect(port, host);
        this.socket.setMaxListeners(0);
        this.setMaxListeners(0);

        /*****************************************************************************
         * Helper Functions
         *****************************************************************************/

        const encapsulate = (obj) => {
            return Buffer.concat([Buffer.from(JSON.stringify(obj)), Buffer.from([0x0])])
        };

        /*****************************************************************************
         * Node Functions
         *****************************************************************************/

        this.sendToCore = (obj) => {
            if (logCommunications) {
                this.log('tx: ' + JSON.stringify(obj));
            }

            if (this.socket !== null) {
                this.socket.write(encapsulate(obj));
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

        /*****************************************************************************
         * Socket Event handlers
         *****************************************************************************/
        
        // close
        this.socket.on('close', () => {
            if (logConnection) {
                this.log('socket closed');
            }
            
            if (noOp != null) {
                clearInterval(noOp);
                noOp = null;
            }

            this.socket.destroy();
            this.socket = null;
        });
        
        // connect
        this.socket.on('connect', (data) => {
            if (logConnection) {
                this.log('socket connected');
            }
        });
        
        // data
        this.socket.on('data', (data) => {
            if (logCommunications) {
                this.log('rx: ' + data.toString());
            }

            let rx = [];

            for (let i = 0; i < data.length; i++) {
                if (data[i] == 0x0 && data.length != 0) {
                    let obj = JSON.parse((Buffer.from(rx)).toString());
                    if ('method' in obj) {
                        switch (obj.method) {
                            case 'EngineStatus':
                                if (obj.params.State === 'Active') {
                                    this.emit('ready');
                                }
                                else if (isRedundant && obj.params.State === 'Standby') {
                                    this.socket.destroy()
                                    this.socket = net.connect(port, host);
                                }
                                
                                break;
                            case 'ChangeGroup.Poll':
                                let changes = obj.params.Changes;
                                if (changes.length !== 0) {
                                    for (let i = 0; i < changes.length; i++) {
                                        this.emit('rx', changes[i]);
                                    }
                                }
                                break;
                            default:
                                break;
                        }
                    }
                    rx = [];
                }
                else {
                    rx.push(data[i]);
                }
            }
        });

        // drain
        this.socket.on('drain', () => { });

        // end
        this.socket.on('end', () => {
            if (logConnection) {
                this.log('socket end');
            }
        });

        // error
        this.socket.on('error', (err) => {
            if (logConnection) {
                this.error(err.toString());
            }
            if (isRedundant) {
                this.socket.destroy();
                this.socket = net.connect(port, redundantHost);
            }
        });

        // lookup
        this.socket.on('lookup', () => { });

        // ready
        this.socket.on('ready', () => {
            if (logConnection) {
                this.log('socket ready');
            }

            if (authentication) {
                this.socket.write(encapsulate({
                    'jsonrpc': '2.0',
                    'method': 'Logon',
                    'params': {
                        'User': username,
                        'Password': password
                    }
                }));
            }

            noOp = setInterval(() => {
                this.socket.write(encapsulate({
                    'jsonrpc': '2.0',
                    'method': 'NoOp',
                    'params': {}
                }));
            }, 30000);
        });

        // timeout
        this.socket.on('timeout', () => {
            if (logConnection) {
                this.log('socket timeout');
            }
        });

        /***************************************************************************
         * Node Event Listeners
         ***************************************************************************/
        this.on('close', (removed, done) => {
            if (removed) {
                this.socket.destroy();
            }
            else {
                this.socket.end();
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
}