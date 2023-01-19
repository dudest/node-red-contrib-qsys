module.exports = function (RED) {
    'use strict';

    function QsysPresets(config) {
        RED.nodes.createNode(this, config);
        let controlId = config.controlId;
        let ramp = 0;

        // Retrieve the config node
        this.server = RED.nodes.getNode(config.server);

        /*****************************************************************************
         * Socket Event handlers
         *****************************************************************************/

        this.server.socket.on('ready', () => {
            this.status({ fill: 'green', shape: 'dot', text: 'connected' });
        });

        this.server.socket.on('error', (err) => {
            this.status({ fill: 'red', shape: 'ring', text: 'error' });
        });

        this.server.socket.on('timeout', () => {
            this.status({ fill: 'red', shape: 'dot', text: 'error' });
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