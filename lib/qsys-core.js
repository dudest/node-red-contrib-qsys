var net = require('net');

module.exports = function (RED) {
    "use strict";

    function QsysCoreNode(n) {
        RED.nodes.createNode(this, n);
        let host = n.host;
        let port = n.port;
        let isRedundant = n.isRedundant === 'true';
        let redundantHost = n.redundantHost;
        let authentication = n.authentication === 'true';
        let username = this.credentials.username;
        let password = this.credentials.password;
        let pollTime1 = n.pollTime1;
        let pollTime2 = n.pollTime2;
        let pollTime3 = n.pollTime3;
        let pollTime4 = n.pollTime4;
        let logConnection = n.logConnection === 'true';
        let logCommunications = n.logCommunications === 'true';

        this.socket = net.connect(port, host);

        /*****************************************************************************
         * Socket Event handlers
         *****************************************************************************/
        
        // close
        this.socket.on('close', () => {
            if (logConnection) {
                this.log('socket closed');
            }
        });
        
        // connect
        this.socket.on('connect', (data) => {
            if (logConnection) {
                this.log('socket connected');
            }
        });
        
        // data
        this.socket.on('data', () => { });

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
        });

        // timeout
        this.socket.on('timeout', () => {
            if (logConnection) {
                this.log('socket timeout');
            }
        });

    }
    RED.nodes.registerType("qsys-core", QsysCoreNode, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" }
        }
    });
}