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
         *****************************************************************************/

        this.server.on('connected', () => {
            this.status({ fill: 'green', shape: 'dot', text: 'connected' });
        });

        this.server.on('connecting', () => {
            this.status({ fill: 'yellow', shape: 'ring', text: 'connecting...' });
        });

        this.server.on('error', () => {
            this.status({ fill: 'red', shape: 'ring', text: 'error' });
        });

        this.server.on('disconnected', () => {
            this.status({ fill: 'red', shape: 'dot', text: 'disconnected' });
        });

        /*****************************************************************************
         * Server Event handlers
         *****************************************************************************/

        this.server.on('ready', () => {});

        this.server.on('rx', (data) => {});

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
            if (removed) {
                // Do nothing
            }
            done();
        });
    }
    RED.nodes.registerType('qsys-Presets', QsysPresets);
}