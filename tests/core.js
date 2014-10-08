/*jshint multistr: true */
require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/core/group-rename.xml',
    'text!static/core/invalid-questions.xml',
    'text!static/core/increment-item.xml',
    'text!static/core/hidden-value-in-repeat.xml',
    'text!static/core/insert-questions.xml'
], function (
    chai,
    $,
    _,
    util,
    GROUP_RENAME_XML,
    INVALID_QUESTIONS_XML,
    INCREMENT_ITEM_XML,
    HIDDEN_VALUE_IN_REPEAT_XML,
    INSERT_QUESTIONS_XML
) {
    var assert = chai.assert,
        call = util.call,
        pluginsWithoutItemset = _(util.options.options.plugins || []).without("itemset");

    describe("Vellum core", function () {
        it("should not allow adding questions with matching paths", function (done) {
            util.init({
                core: {
                    onReady: function () {
                        var dup;
                        util.addQuestion("Text", "question1");
                        dup = util.addQuestion("Text", "question2");
                        dup.p.nodeID = "question1";

                        // TODO fix tight coupling of this functionality with UI
                        // HACK prevent modal alert in UI
                        this.data.core.isAlertVisible = true;

                        assert(!this.ensureCurrentMugIsSaved(),
                               "save should fail with duplicate question ID");

                        this.data.core.isAlertVisible = false;
                        done();
                    }
                }
            });
        });

        it("should allow mug rename with itemset in form when the itemset plugin is disabled", function (done) {
            util.init({
                plugins: pluginsWithoutItemset,
                core: {
                    form: TEST_XML_1,
                    onReady: function () {
                        var mug = call("getMugByPath", "/data/state"),
                            itemset = mug.form.getChildren(mug)[0];
                        assert.equal(mug.form.getAbsolutePath(itemset, true), null);
                        mug.p.nodeID = "stat"; // this change triggers the bug
                        done();
                    }
                }
            });
        });

        it("should update child references on group rename", function (done) {
            util.init({core: { form: GROUP_RENAME_XML, onReady: function () {
                var group = call("getMugByPath", "/data/group"),
                    q1 = call("getMugByPath", "/data/group/question1"),
                    q2 = call("getMugByPath", "/data/question2");
                group.p.nodeID = "g8";
                assert.equal(q1.form.getAbsolutePath(q1), "/data/g8/question1");
                assert.equal(q2.p.relevantAttr,
                    "/data/g8/question1 = 'valley girl' and /data/g8/question2 = 'dude'");
                done();
            }}});
        });

        it("should show warning icons on invalid questions", function (done) {
            util.init({core: { form: INVALID_QUESTIONS_XML, onReady: function () {
                var q0 = call("getMugByPath", "/data/q0"),
                    q1 = call("getMugByPath", "/data/q1"),
                    h1 = call("getMugByPath", "/data/h1");
                assert(util.isTreeNodeValid(q0), "q0 is invalid: sanity check failed");
                assert(!util.isTreeNodeValid(q1), "q1 should not be valid");
                assert(!util.isTreeNodeValid(h1), "h1 should not be valid");
                done();
            }}});
        });

        it("should increment item value on insert new select item as child of select", function (done) {
            util.init({core: { form: INCREMENT_ITEM_XML, onReady: function () {
                util.clickQuestion("question1");
                var item = util.addQuestion("Item");
                assert.equal(item.p.defaultValue, "item3");
                done();
            }}});
        });

        it("should increment item value on insert new select item after sibling item", function (done) {
            util.init({core: { form: INCREMENT_ITEM_XML, onReady: function () {
                util.clickQuestion("item1");
                var item = util.addQuestion("Item");
                assert.equal(item.p.defaultValue, "item3");
                done();
            }}});
        });

        it("should add hidden value in repeat group", function (done) {
            util.init({core: {onReady: function () {
                util.addQuestion("Repeat", "repeat");
                util.addQuestion.bind({prevId: "repeat"})("Text", "text");
                util.addQuestion.bind({prevId: "repeat"})("DataBindOnly", "hidden");
                util.assertXmlEqual(
                            call('createXML'),
                            HIDDEN_VALUE_IN_REPEAT_XML,
                            {normalize_xmlns: true});
                done();
            }}});
        });

        it("should load hidden value in repeat group", function (done) {
            util.init({core: {form: HIDDEN_VALUE_IN_REPEAT_XML, onReady: function () {
                util.assertJSTreeState(
                    "repeat",
                    "  text",
                    "  hidden"
                );
                done();
            }}});
        });

        it("should add hidden value at end of group", function (done) {
            util.init({core: {form: INSERT_QUESTIONS_XML, onReady: function () {
                util.addQuestion.bind({prevId: "hidden1"})("DataBindOnly", "hiddenA");
                util.addQuestion.bind({prevId: "hidden2"})("DataBindOnly", "hiddenB");
                util.assertJSTreeState(
                    "text1",
                    "text2",
                    "group",
                    "  text3",
                    "  text4",
                    "  hidden2",
                    "  hiddenB",
                    "text5",
                    "hidden1",
                    "hiddenA"
                );
                done();
            }}});
        });

        it("should add hidden value near end of group", function (done) {
            util.init({core: {form: INSERT_QUESTIONS_XML, onReady: function () {
                util.addQuestion.bind({prevId: "text1"})("DataBindOnly", "hiddenA");
                util.addQuestion.bind({prevId: "text3"})("DataBindOnly", "hiddenB");
                util.assertJSTreeState(
                    "text1",
                    "text2",
                    "group",
                    "  text3",
                    "  text4",
                    "  hiddenB",
                    "  hidden2",
                    "text5",
                    "hiddenA",
                    "hidden1"
                );
                done();
            }}});
        });

        it("should add question after selected question", function (done) {
            util.init({core: {form: INSERT_QUESTIONS_XML, onReady: function () {
                util.addQuestion.bind({prevId: "text1"})("Text", "textA");
                util.addQuestion.bind({prevId: "text3"})("Text", "textB");
                util.assertJSTreeState(
                    "text1",
                    "textA",
                    "text2",
                    "group",
                    "  text3",
                    "  textB",
                    "  text4",
                    "  hidden2",
                    "text5",
                    "hidden1"
                );
                done();
            }}});
        });

        it("should add question before hidden value", function (done) {
            util.init({core: {form: INSERT_QUESTIONS_XML, onReady: function () {
                util.addQuestion.bind({prevId: "hidden1"})("Text", "textA");
                util.addQuestion.bind({prevId: "hidden2"})("Text", "textB");
                util.assertJSTreeState(
                    "text1",
                    "text2",
                    "group",
                    "  text3",
                    "  text4",
                    "  textB",
                    "  hidden2",
                    "text5",
                    "textA",
                    "hidden1"
                );
                done();
            }}});
        });

        it("should add question before sole hidden value", function (done) {
            util.init({core: {onReady: function () {
                util.addQuestion("DataBindOnly", "hidden");
                util.addQuestion.bind({prevId: "hidden"})("Text", "text");
                util.assertJSTreeState(
                    "text",
                    "hidden"
                );
                done();
            }}});
        });

        //it("should load hidden value at end of group", function (done) { assert(false); });

    });

    var TEST_XML_1 = '' +
    '<?xml version="1.0" encoding="UTF-8" ?>\
    <h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:orx="http://openrosa.org/jr/xforms" xmlns="http://www.w3.org/2002/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:jr="http://openrosa.org/javarosa" xmlns:vellum="http://commcarehq.org/xforms/vellum">\
        <h:head>\
            <h:title>Vellum testing</h:title>\
            <model>\
                <instance>\
                    <data xmlns:jrm="http://dev.commcarehq.org/jr/xforms"\
                          xmlns="http://openrosa.org/formdesigner/FFD00941-A932-471A-AEC8-87F6EFEF767F"\
                          uiVersion="1" version="1" name="Vellum testing">\
                        <state />\
                    </data>\
                </instance>\
                <instance id="states" src="jr://fixture/item-list:state"></instance>\
                <bind nodeset="/data/state" />\
                <itext>\
                    <translation lang="en" default="">\
                        <text id="state-label">\
                            <value>State</value>\
                        </text>\
                    </translation>\
                </itext>\
            </model>\
        </h:head>\
        <h:body>\
            <select1 ref="/data/state">\
                <label ref="jr:itext(\'state-label\')" />\
                <itemset nodeset="instance(\'states\')/state_list/state">\
                  <label ref="name"></label>\
                  <value ref="id"></value>\
                </itemset>\
            </select1>\
        </h:body>\
    </h:html>';
});
