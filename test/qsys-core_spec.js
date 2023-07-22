var should = require("should");
var helper = require("node-red-node-test-helper");
var qsysCore = require("../lib/qsys-core.js");
var qsysControlSet = require("../lib/qsys-ControlSet.js");

helper.init(require.resolve('node-red'));

describe('qsys-core node', function () {

    beforeEach((done) => {
        helper.startServer(done);
    });

    afterEach((done) => {
        helper.unload();
        helper.stopServer(done);
    });
});