import util from "tests/utils";
import chai from "chai";
import LEARN_MODULE_XML from "static/commcareConnect/learn_module.xml";
import ASSESSMENT_XML from "static/commcareConnect/assessment.xml";
import TASK_XML from "static/commcareConnect/task_module.xml";
import DELIVER_XML from "static/commcareConnect/deliver.xml";
import DELIVER_WORK_AREA_XML from "static/commcareConnect/deliver_with_work_area.xml";
import WORK_AREA_UPDATE_XML from "static/commcareConnect/work_area_update.xml";

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
            assert.equal(module.p.relevantAttr, "x = 2");
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

        it("should load and save work_area_id", function () {
            util.loadXML(DELIVER_WORK_AREA_XML);
            var module = util.getMug("unit_one");
            assert.equal(module.__className, "ConnectDeliverUnit");
            assert.equal(module.p.work_area_id, "instance('commcaresession')/session/data/work_area_id");
            util.assertXmlEqual(call("createXML"), DELIVER_WORK_AREA_XML);
        });

        it("should allow work_area_id to be optional", function () {
            var mug = util.addQuestion("ConnectDeliverUnit", "unit");
            assert.equal(mug.spec.work_area_id.presence, "optional");
            assert.equal(mug.p.work_area_id, "");
        });
    });

    describe("task module", function () {
        it("should load and save", function () {
            util.loadXML(TASK_XML);
            var task = util.getMug("task_1");
            assert.equal(task.__className, "ConnectTask");
            assert.equal(task.p.name, "task 1");
            assert.equal(task.p.description, "Task 1 is fun\nLearning is still fun");
            assert.equal(task.p.relevantAttr, "x = 3");
            util.assertXmlEqual(call("createXML"), TASK_XML);
        });
    });

    describe("work area update", function () {
        it("should load and save", function () {
            util.loadXML(WORK_AREA_UPDATE_XML);
            var update = util.getMug("update_1");
            assert.equal(update.__className, "ConnectWorkAreaUpdate");
            assert.equal(update.p.work_area_id, "instance('commcaresession')/session/data/work_area_id");
            assert.equal(update.p.status, "/data/status_choice");
            assert.equal(update.p.reason, "/data/reason_text");
            assert.equal(update.p.additional_details, "/data/details");
            assert.equal(update.p.photo_evidence, "/data/photo");
            assert.equal(update.p.relevantAttr, "x = 4");
            util.assertXmlEqual(call("createXML"), WORK_AREA_UPDATE_XML);
        });

        it("should make additional_details optional", function () {
            var mug = util.addQuestion("ConnectWorkAreaUpdate", "update");
            assert.equal(mug.spec.additional_details.presence, "optional");
            assert.equal(mug.p.additional_details, "");
        });
    });
});
