define([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/commcareConnect',
    'text!static/commcareConnect/learn_module.xml',
    'text!static/commcareConnect/assessment.xml',
    'text!static/commcareConnect/deliver.xml',
], function (
    util,
    chai,
    $,
    _,
    commcareConnect,
    LEARN_MODULE_XML,
    ASSESSMENT_XML,
    DELIVER_XML
) {
    var assert = chai.assert,
        call = util.call;

    describe("The CommCareConnect", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: function () { done(); }},
            });
        });

        describe("learn module", function () {
             it("should load and save", function () {
                util.loadXML(LEARN_MODULE_XML);
                var module = util.getMug("module_1");
                assert.equal(module.__className, "ConnectLearnModule");
                assert.equal(module.p.name, "module 1");
                assert.equal(module.p.description, "Module 1 is fun\nLearning is fun");
                assert.equal(module.p.time_estimate, "2");
                util.assertXmlEqual(call("createXML"), LEARN_MODULE_XML);
            });

            it("requires time_estimate to be an integer", function () {
                var mug = util.addQuestion("ConnectLearnModule", "mug");
                mug.p.time_estimate = "foo";
                assert.equal(mug.spec.time_estimate.validationFunc(mug), "Must be an integer");
            });
        });

        describe("assessment module", function () {
            it("should load and save", function () {
                util.loadXML(ASSESSMENT_XML);
                var module = util.getMug("test_assessment");
                assert.equal(module.__className, "ConnectAssessment");
                assert.equal(module.p.user_score, "/data/score");
                assert.equal(module.p.relevantAttr, "x = 1");
                util.assertXmlEqual(call("createXML"), ASSESSMENT_XML);
            });
        });

        describe("deliver unit", function () {
            it("should load and save", function () {
                util.loadXML(DELIVER_XML);
                var module = util.getMug("unit_one");
                assert.equal(module.__className, "ConnectDeliverUnit");
                assert.equal(module.p.name, "unit 1");
                assert.equal(module.p.entity_id, "instance('commcaresession')/session/data/value");
                assert.equal(module.p.entity_name, "/data/name");
                assert.equal(module.p.relevantAttr, "x = 1");
                util.assertXmlEqual(call("createXML"), DELIVER_XML);
            });
        });
    });
});
