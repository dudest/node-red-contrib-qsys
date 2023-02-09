var should = require("should");
var helper = require("node-red-node-test-helper");
var qsysCore = require("../lib/qsys-core.js");

helper.init(require.resolve('node-red'));

describe('qsys-core node', function () {

    beforeEach((done) => {
        helper.startServer(done);
    });

    afterEach((done) => {
        helper.unload();
        helper.stopServer(done);
    });

    it('should be loaded', (done) => {
        var flow = [{ id: "n1", type: "qsys-core", host: "127.0.0.1" }];
        helper.load(qsysCore, flow, () => {
            var n1 = helper.getNode("n1");
            try {
                n1.should.have.property('host', '127.0.0.1');
                done();
            } catch (err) {
                done(err);
            }
        });
    });
});