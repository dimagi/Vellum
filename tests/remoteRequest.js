define([
    'tests/utils',
    'chai',
    'underscore',
    'jquery',
    'text!static/remoteRequest/remoteRequest.xml',
], function (
    util,
    chai,
    _,
    $,
    REMOTE_REQUEST_XML
) {
    var assert = chai.assert;

    describe("The remote request plugin", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done},
                features: {remote_requests: true},
            });
        });

        it("should load form with remote request", function () {
            util.loadXML(REMOTE_REQUEST_XML);
            var mug = util.getMug("req");
            assert.equal(mug.p.url, "http://test.com/");
            assert.equal(mug.p.parameters, "#form/params");
            util.assertXmlEqual(util.call("createXML"), REMOTE_REQUEST_XML);
        });

        it("should should convert hashtag expressions to /data/ paths", function () {
            util.loadXML(REMOTE_REQUEST_XML);
            util.getMug("params").p.nodeID = "query";
            util.getMug("req").p.parameters = "#form/query";
            var xml = REMOTE_REQUEST_XML.replace(/params/g, "query");
            util.assertXmlEqual(util.call("createXML"), xml);
        });
    });
});
