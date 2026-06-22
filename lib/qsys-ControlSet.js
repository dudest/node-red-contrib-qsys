module.exports = function (RED) {
    'use strict';

    function QsysControlSet(config) {
        RED.nodes.createNode(this, config);
        let lastMsg = null;
        let topic = null;
        let controlId = config.controlId;
        let controlType = parseInt(config.controlType);
        let changeGroup = parseInt(config.changeGroup);

        if (config.topic) {
            topic = config.topic;
        }

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

        this.server.on('ready', () => {
            this.server.sendToCore({
                "jsonrpc": "2.0",
                "id": 1234,
                "method": "ChangeGroup.AddControl",
                "params": {
                    "Id": this.server.changeGroup[changeGroup].params.Id,
                    "Controls": [controlId]
                }
            });

            this.server.autoPoll(changeGroup);
        });

        this.server.on('rx', (data) => {
            if ('Name' in data && data.Name === controlId) {
                let msg = lastMsg || {
                    'id': 1234,
                    'topic': '',
                    'payload': ''
                }
                msg.topic = topic || msg.topic || controlId;
                
                switch(controlType) {
                    case 0:
                        msg.payload = data.Value;
                        break;
                    case 1:
                        msg.payload = data.Position;
                        break;
                    case 2:
                        msg.payload = data.String;
                        break;
                }
                
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

        this.on('close', (removed, done) => {
            if (removed) {
                this.server.sendToCore({
                    "jsonrpc": "2.0",
                    "id": 1234,
                    "method": "ChangeGroup.Remove",
                    "params": {
                        "Id": this.server.changeGroup[changeGroup].params.Id, 
                        "Controls": [controlId]
                    }
                });
            }
            done();
        });
    }
    RED.nodes.registerType('qsys-ControlSet', QsysControlSet);
}