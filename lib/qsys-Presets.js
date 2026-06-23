module.exports = function (RED) {
    'use strict';

    function QsysPresets(config) {
        RED.nodes.createNode(this, config);
        let controlId = config.controlId;
        let ramp = 0;

        // Retrieve the config node
        this.server = RED.nodes.getNode(config.server);

        // Guard: the core config node may be missing, disabled, or may have
        // failed to construct, in which case getNode() returns null. Bail out
        // cleanly instead of throwing "Cannot read properties of null".
        if (!this.server) {
            this.status({ fill: 'red', shape: 'ring', text: 'no core configured' });
            this.error('Q-Sys Core configuration node is missing or disabled');
            return;
        }

        /*****************************************************************************
         * Server Event handlers - listen to connection state changes
         *
         * Keep named references so the listeners can be detached on close. The
         * core config node outlives child nodes across partial deploys, so
         * inline listeners would accumulate on it and leak.
         *****************************************************************************/

        const onConnected = () => {
            this.status({ fill: 'green', shape: 'dot', text: 'connected' });
        };

        const onConnecting = () => {
            this.status({ fill: 'yellow', shape: 'ring', text: 'connecting...' });
        };

        const onError = () => {
            this.status({ fill: 'red', shape: 'ring', text: 'error' });
        };

        const onDisconnected = () => {
            this.status({ fill: 'red', shape: 'dot', text: 'disconnected' });
        };

        const onReady = () => {};

        const onRx = (data) => {};

        this.server.on('connected', onConnected);
        this.server.on('connecting', onConnecting);
        this.server.on('error', onError);
        this.server.on('disconnected', onDisconnected);
        this.server.on('ready', onReady);
        this.server.on('rx', onRx);

        /*****************************************************************************
         * Node Event handlers
         *****************************************************************************/
        
        this.on('input', (msg) => {
            if (msg.topic === 'Ramp') {
                ramp = parseFloat(msg.payload);
            }
            else { 
                this.server.sendToCore({
                    "jsonrpc": "2.0",
                    "method": "Snapshot.Load",
                    "params": {
                        "Name": controlId,
                        "Bank": msg.payload,
                        "Ramp": ramp
                    },
                    "id": 1234
                });
            }
        });

        this.on('close', (removed, done) => {
            // Detach our listeners from the (long-lived) core node to avoid
            // leaking them across deploys.
            this.server.removeListener('connected', onConnected);
            this.server.removeListener('connecting', onConnecting);
            this.server.removeListener('error', onError);
            this.server.removeListener('disconnected', onDisconnected);
            this.server.removeListener('ready', onReady);
            this.server.removeListener('rx', onRx);
            done();
        });
    }
    RED.nodes.registerType('qsys-Presets', QsysPresets);
}