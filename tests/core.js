/*jshint multistr: true */
require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/core/test1.xml',
    'text!static/core/group-rename.xml',
    'text!static/core/invalid-questions.xml',
    'text!static/core/increment-item.xml',
    'text!static/core/hidden-value-in-repeat.xml',
    'text!static/core/hidden-among-questions.xml',
    'text!static/core/insert-questions.xml'
], function (
    chai,
    $,
    _,
    util,
    TEST_XML_1,
    GROUP_RENAME_XML,
    INVALID_QUESTIONS_XML,
    INCREMENT_ITEM_XML,
    HIDDEN_VALUE_IN_REPEAT_XML,
    HIDDEN_AMONG_QUESTIONS_XML,
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

        it("should load hidden values interspersed with other questions", function (done) {
            util.init({core: {form: HIDDEN_AMONG_QUESTIONS_XML, onReady: function () {
                util.assertJSTreeState(
                    "hidden1",
                    "select1",
                    "  item1",
                    "  item2",
                    "hidden2",
                    "select2",
                    "  item1",
                    "  item2",
                    "hidden3",
                    "group",
                    "  hidden4",
                    "  text3",
                    "  hidden5",
                    "  text4",
                    "  hidden6",
                    "hidden7",
                    "text5",
                    "hidden8"
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

        it("should add hidden value among other questions", function (done) {
            util.init({core: {form: INSERT_QUESTIONS_XML, onReady: function () {
                util.addQuestion.bind({prevId: "text1"})("DataBindOnly", "hiddenA");
                util.addQuestion.bind({prevId: "text3"})("DataBindOnly", "hiddenB");
                util.assertJSTreeState(
                    "text1",
                    "hiddenA",
                    "text2",
                    "group",
                    "  text3",
                    "  hiddenB",
                    "  text4",
                    "  hidden2",
                    "text5",
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

        it("should add question after hidden value", function (done) {
            util.init({core: {form: INSERT_QUESTIONS_XML, onReady: function () {
                util.addQuestion.bind({prevId: "hidden1"})("Text", "textA");
                util.addQuestion.bind({prevId: "hidden2"})("Text", "textB");
                util.assertJSTreeState(
                    "text1",
                    "text2",
                    "group",
                    "  text3",
                    "  text4",
                    "  hidden2",
                    "  textB",
                    "text5",
                    "hidden1",
                    "textA"
                );
                done();
            }}});
        });

        it("should add question after sole hidden value", function (done) {
            util.init({core: {onReady: function () {
                util.addQuestion("DataBindOnly", "hidden");
                util.addQuestion.bind({prevId: "hidden"})("Text", "text");
                util.assertJSTreeState(
                    "hidden",
                    "text"
                );
                done();
            }}});
        });

        describe("drag+drop should", function () {
            var mugs;
            before(function (done) {
                util.init({core: {form: INSERT_QUESTIONS_XML, onReady: function () {
                    util.addQuestion.bind({prevId: "text2"})("Repeat", "repeat");
                    mugs = {
                        text1: call("getMugByPath", "/data/text1"),
                        text2: call("getMugByPath", "/data/text2"),
                        repeat: call("getMugByPath", "/data/repeat"),
                        group: call("getMugByPath", "/data/group"),
                        text3: call("getMugByPath", "/data/group/text3"),
                        text4: call("getMugByPath", "/data/group/text4"),
                        hidden2: call("getMugByPath", "/data/group/hidden2"),
                        text5: call("getMugByPath", "/data/text5"),
                        hidden1: call("getMugByPath", "/data/hidden1")
                    };
                    done();
                }}});
            });

            var check_move_data = [
                    ["text1", "before", "text1", true],
                    ["text1", "inside", "text1", true],
                    ["text1", "after", "text1", true],
                    ["text1", "into", "text1", true], // should be same as 'inside'

                    ["text1", "before", "text2", true],
                    ["text1", "inside", "text2", true],
                    ["text1", "after", "text2", true],

                    ["text1", "before", "repeat", true],
                    ["text1", "inside", "repeat", true],
                    ["text1", "after", "repeat", true],

                    ["text1", "first", "group", true],
                    ["text1", "before", "group", true],
                    ["text1", "inside", "group", true],
                    ["text1", "after", "group", true],
                    ["text1", "last", "group", true], // should be same as 'inside'
                    ["text1", "into", "group", true], // should be same as 'inside'

                    ["text1", "before", "text3", true],
                    ["text1", "inside", "text3", true],
                    ["text1", "after", "text3", true],

                    ["text1", "before", "text4", true],
                    ["text1", "inside", "text4", true],
                    ["text1", "after", "text4", true],

                    ["text1", "before", "hidden2", true],
                    ["text1", "inside", "hidden2", true],
                    ["text1", "after", "hidden2", true],
                    ["text1", "into", "hidden2", true], // should be same as 'inside'

                    ["text1", "before", "text5", true],
                    ["text1", "inside", "text5", true],
                    ["text1", "after", "text5", true],

                    ["text1", "before", "hidden1", true],
                    ["text1", "inside", "hidden1", true],
                    ["text1", "after", "hidden1", true],


                    ["hidden1", "before", "text1", true],
                    ["hidden1", "inside", "text1", true],
                    ["hidden1", "after", "text1", true],
                    ["hidden1", "into", "text1", true], // should be same as 'inside'

                    ["hidden1", "before", "text2", true],
                    ["hidden1", "inside", "text2", true],
                    ["hidden1", "after", "text2", true],

                    ["hidden1", "first", "repeat", true],
                    ["hidden1", "before", "repeat", true],
                    ["hidden1", "inside", "repeat", true],
                    ["hidden1", "after", "repeat", true],
                    ["hidden1", "into", "repeat", true], // should be same as 'inside'
                    ["hidden1", "last", "repeat", true], // should be same as 'inside'

                    ["hidden1", "first", "group", true],
                    ["hidden1", "before", "group", true],
                    ["hidden1", "inside", "group", true],
                    ["hidden1", "after", "group", true],
                    ["hidden1", "into", "group", true], // should be same as 'inside'
                    ["hidden1", "last", "group", true], // should be same as 'inside'

                    ["hidden1", "before", "text3", true],
                    ["hidden1", "inside", "text3", true],
                    ["hidden1", "after", "text3", true],

                    ["hidden1", "before", "text4", true],
                    ["hidden1", "inside", "text4", true],
                    ["hidden1", "after", "text4", true],

                    ["hidden1", "before", "hidden2", true],
                    ["hidden1", "inside", "hidden2", true],
                    ["hidden1", "after", "hidden2", true],

                    ["hidden1", "before", "text5", true],
                    ["hidden1", "inside", "text5", true],
                    ["hidden1", "after", "text5", true],

                    ["hidden1", "before", "hidden1", true],
                    ["hidden1", "inside", "hidden1", true],
                    ["hidden1", "after", "hidden1", true],


                    ["hidden2", "before", "text1", true],
                    ["hidden2", "inside", "text1", true],
                    ["hidden2", "after", "text1", true],

                    ["hidden2", "before", "text2", true],
                    ["hidden2", "inside", "text2", true],
                    ["hidden2", "after", "text2", true],

                    ["hidden2", "before", "repeat", true],
                    ["hidden2", "inside", "repeat", true],
                    ["hidden2", "after", "repeat", true],

                    ["hidden2", "before", "group", true],
                    ["hidden2", "inside", "group", true],
                    ["hidden2", "after", "group", true],

                    ["hidden2", "before", "text3", true],
                    ["hidden2", "inside", "text3", true],
                    ["hidden2", "after", "text3", true],

                    ["hidden2", "before", "text4", true],
                    ["hidden2", "inside", "text4", true],
                    ["hidden2", "after", "text4", true],

                    ["hidden2", "before", "hidden2", true],
                    ["hidden2", "inside", "hidden2", true],
                    ["hidden2", "after", "hidden2", true],

                    ["hidden2", "before", "text5", true],
                    ["hidden2", "inside", "text5", true],
                    ["hidden2", "after", "text5", true],

                    ["hidden2", "before", "hidden1", true],
                    ["hidden2", "inside", "hidden1", true],
                    ["hidden2", "after", "hidden1", true]
                ];

            _(check_move_data).each(function (test) {
                var should = test[3],
                    prefix = should ? "allow move " : "prevent move ",
                    qsrc = test[0],
                    qdst = test[2],
                    position = test[1];
                it(prefix + qsrc + " " + position + " " + qdst, function () {
                    var src = mugs[qsrc],
                        dst = mugs[qdst],
                        result = call("checkMove",
                                        src.ufid, src.__className,
                                        dst.ufid, dst.__className,
                                        position);
                    assert((should ? result : !result),
                           ["move", qsrc, position, qdst, "->", result].join(" "));
                });
            });


            var relative_position_data = [
                    [null, "first", null, "first"],
                    [null, "last", null, "last"],

                    ["group", "first", "group", "first"],
                    ["group", "last", "group", "last"],
                    ["group", "before", "group", "before"],
                    ["group", "after", "group", "after"],

                    ["text1", "before", "text1", "before"],
                    ["text1", "after", "text1", "after"],

                    [null, 0, null, "first"],
                    [null, 1, "text1", "after"],
                    [null, 2, "text2", "after"],
                    [null, 3, "repeat", "after"],
                    [null, 4, "group", "after"],
                    [null, 5, "text5", "after"],
                    [null, 6, "hidden1", "after"],
                    [null, 7, null, "last"],
                    [null, 8, null, "last"],

                    ["repeat", 0, "repeat", "first"],
                    ["repeat", 1, "repeat", "last"],
                    ["repeat", 2, "repeat", "last"],

                    ["group", 0, "group", "first"],
                    ["group", 1, "text3", "after"],
                    ["group", 2, "text4", "after"],
                    ["group", 3, "hidden2", "after"],
                    ["group", 4, "group", "last"],
                    ["group", 5, "group", "last"]
                ];

            _(relative_position_data).each(function (test) {
                var refMug = test[0],
                    refPos = test[1],
                    relMug = test[2],
                    relPos = test[3],
                    msg = "produce relative position " +
                          refMug + "[" + refPos + "] => " +
                          relPos + " " + relMug;
                it(msg, function () {
                    var src = refMug ? mugs[refMug] : null,
                        dst = relMug ? mugs[relMug] : null,
                        res = call("getRelativePosition", src, refPos),
                        posStr = String(res.position),
                        mugStr = res.mug ? res.mug.p.nodeID : String(res.mug);
                    assert(res.position === relPos && res.mug === dst,
                           [refPos, refMug, "->", posStr, mugStr].join(" "));
                });
            });

        });

    });
});
