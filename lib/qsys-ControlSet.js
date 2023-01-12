module.exports = function (RED) {
    "use strict";

    function QsysTrigger(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        let lastMsg;
        let topic = null;

        if (config.topic) {
            topic = config.topic;
        }

        // Retrieve the config node
        this.server = RED.nodes.getNode(config.server);
    }
    RED.nodes.registerType("qsys-trigger", QsysTrigger);
}