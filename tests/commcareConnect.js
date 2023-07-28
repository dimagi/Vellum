define([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/commcareConnect',
    'text!static/commcareConnect/learn_module.xml',
], function (
    util,
    chai,
    $,
    _,
    commcareConnect,
    LEARN_MODULE_XML,
) {
    var assert = chai.assert,
        call = util.call;

    describe("The CommCareConnect module", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: function () { done(); }},
            });
        });

        it("should load and save a learn module", function () {
            util.loadXML(LEARN_MODULE_XML);
            var module = util.getMug("module_1");
            console.log(module.p);
            assert.equal(module.__className, "ConnectLearnModule");
            assert.equal(module.p.name, "'module 1'");
            assert.equal(module.p.description, "'Module 1 is fun\nLearning is fun'");
            assert.equal(module.p.time_estimate, "2");
            util.assertXmlEqual(call("createXML"), LEARN_MODULE_XML);
        });
    });
});
