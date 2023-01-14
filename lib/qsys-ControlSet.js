module.exports = function (RED) {
    'use strict';

    function QsysTrigger(config) {
        RED.nodes.createNode(this, config);
        let lastMsg = null;
        let topic = null;
        let controlId = config.controlId;
        let changeGroup = parseInt(config.changeGroup);

        if (config.topic) {
            topic = config.topic;
        }

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

        this.server.on('ready', () => {
            this.server.autoPoll(changeGroup, controlId);
        });

        this.server.on('rx', (data) => {
            if ('Name' in data && data.Name === controlId) {
                let msg = lastMsg || {
                    'id': Date.now(),
                    'topic': topic || '',
                    'payload': ''
                }
                msg.payload = data.Value;
                this.send(msg);
            }
        });

        /*****************************************************************************
         * Node Event handlers
         *****************************************************************************/
        
        this.on('input', (msg) => {
            lastMsg = msg;
            this.server.sendToCore({
                'jsonrpc': '2.0',
                'id': 1234,
                'method': 'Control.Set',
                'params': {
                    'Name': controlId,
                    'Value': msg.payload
                }
            });
        });
    }
    RED.nodes.registerType('qsys-trigger', QsysTrigger);
}