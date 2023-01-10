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

        this.socket.on('close', () => {
            if (logConnection) {
                this.log('socket closed');
            }
        });

        this.socket.on('connect', (data) => {
            if (logConnection) {
                this.log('socket connected');
            }
        });

        this.socket.on('data', () => { });

        this.socket.on('drain', () => { });

        this.socket.on('end', () => {
            if (logConnection) {
                this.log('socket end');
            }
        });

        this.socket.on('error', (err) => {
            if (logConnection) {
                this.log(err.toString());
            }
        });

        this.socket.on('lookup', () => { });

        this.socket.on('ready', () => {
            if (logConnection) {
                this.log('socket ready');
            }
        });

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