var net = require('net');

module.exports = function (RED) {
    "use strict";

    function QsysCoreNode(n) {
        RED.nodes.createNode(this, n);

        let host = n.host;
        let port = n.port;
        let node = this;

        this.socket = net.connect(port, host);

        this.socket.on('data', function (data) {
          
        });
    }
    RED.nodes.registerType("qsys-core", QsysCoreNode);
}