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
        let changeGroup = [{ 'Id': 'group 1', 'Rate': n.pollTime1 },
            { 'Id': 'group 2', 'Rate': n.pollTime2 },
            { 'Id': 'group 3', 'Rate': n.pollTime3 },
            { 'Id': 'group 4', 'Rate': n.pollTime4 }];
        let logConnection = n.logConnection === 'true';
        let logCommunications = n.logCommunications === 'true';
        let noOp = null;

        const encapsulate = (obj) => {
            return Buffer.concat([Buffer.from(JSON.stringify(obj)), Buffer.from([0x0])])
        };

        this.socket = net.connect(port, host);
        
        this.sendToCore = (obj) => {
            if (logCommunications) {
                this.log('tx: ' + JSON.stringify(obj));
            }
            this.socket.write(encapsulate(obj));
        };

        /*****************************************************************************
         * Socket Event handlers
         *****************************************************************************/
        
        // close
        this.socket.on('close', () => {
            if (logConnection) {
                this.log('socket closed');
            }
            
            if (!noOp) {
                clearInterval(noOp);
                noOp = null;
            }

            this.socket.destroy();
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
            try {
                let rx = JSON.parse((data.subarray(0, data.length - 1)).toString());
            }
            catch (err) {
                this.log(err.toString);
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
                this.log(err.toString());
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
            }, 1000);
        });

        // timeout
        this.socket.on('timeout', () => {
            if (logConnection) {
                this.log('socket timeout');
            }
        });

    }
    RED.nodes.registerType('qsys-core', QsysCoreNode, {
        credentials: {
            username: { type: 'text' },
            password: { type: 'password' }
        }
    });
}