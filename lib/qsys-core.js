var net = require('net');

module.exports = function (RED) {
    "use strict";

    function QsysCoreNode(n) {
        RED.nodes.createNode(this, n);
        var username = this.credentials.username;
        var password = this.credentials.password;
        let host = n.host;
        let port = n.port;
        let node = this;
        /*
        this.socket = net.connect(port, host);

        this.socket.on('data', function (data) {
          
        });
        */
    }
    RED.nodes.registerType("qsys-core", QsysCoreNode, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" }
        }
    });
}