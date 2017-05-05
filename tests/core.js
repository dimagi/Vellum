/*jshint multistr: true */
define([
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
        before(function (done) {
            util.init({
                core: {onReady: function () { done(); }},
                features: {rich_text: false},
            });
        });

        it("should display non-widget message", function () {
            util.loadXML("");
            var text = util.addQuestion("Text", "text"),
                msg = "Test non-widget message.";
            text.addMessage(null, {
                key: "testing-1-2-3",
                level: "error",
                message: msg
            });
            var div = $(".fd-content-right").find(".messages");
            chai.expect(util.getMessages(text)).to.include(msg);
            chai.expect(div.text()).to.include(msg);
        });

        it("should load form with save button in 'saved' state", function (done) {
            util.init({
                core: {
                    form: TEST_XML_1,
                    onReady: function () {
                        assert.equal(this.data.core.saveButton.state, "saved");
                        done();
                    }
                },
                features: {rich_text: false},
            });
        });

        it("should allow mug rename with itemset in form when the itemset plugin is disabled", function (done) {
            util.init({
                plugins: pluginsWithoutItemset,
                features: {rich_text: false},
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

        it("should update child references on group rename", function () {
            util.loadXML(GROUP_RENAME_XML);
            var group = call("getMugByPath", "/data/group"),
                q1 = call("getMugByPath", "/data/group/question1"),
                q2 = call("getMugByPath", "/data/question2");
            group.p.nodeID = "g8";
            assert.equal(q1.form.getAbsolutePath(q1), "/data/g8/question1");
            assert.strictEqual(q2.p.relevantAttr,
                "#form/g8/question1 = 'valley girl' and #form/g8/question2 = 'dude'");
        });

        it("should update question properties header on select mug with Question ID as display name", function() {
            util.loadXML("");
            util.paste([
                ["id", "type"],
                ["/q1", "Text"],
                ["/q2", "Text"],
            ]);
            $(".fd-question-tree-display").val('_ids').change();
            var header = $(".fd-question-properties .fd-head h2");

            util.clickQuestion("q1");
            assert.equal(header.text(), "q1");
            util.clickQuestion("q2");
            assert.equal(header.text(), "q2");
        });

        it("should show warning icons on invalid questions", function () {
            util.loadXML(INVALID_QUESTIONS_XML);
            var q0 = call("getMugByPath", "/data/q0"),
                q1 = call("getMugByPath", "/data/q1"),
                h1 = call("getMugByPath", "/data/h1");
            assert(util.isTreeNodeValid(q0), "q0 is invalid: sanity check failed");
            assert(!util.isTreeNodeValid(q1), "q1 should not be valid");
            assert(!util.isTreeNodeValid(h1), "h1 should not be valid");
        });

        it("should increment item value on insert new select item as child of select", function () {
            util.loadXML(INCREMENT_ITEM_XML);
            util.clickQuestion("question1");
            var item = util.addQuestion("Choice");
            assert.equal(item.p.nodeID, "choice3");
        });

        it("should increment item value on insert new select item after sibling item", function () {
            util.loadXML(INCREMENT_ITEM_XML);
            util.clickQuestion("question1/choice1");
            var item = util.addQuestion("Choice");
            assert.equal(item.p.nodeID, "choice3");
        });

        it("should add hidden value in repeat group", function () {
            util.loadXML("");
            util.addQuestion("Repeat", "repeat");
            util.addQuestion.bind({prevId: "repeat"})("Text", "text");
            util.addQuestion.bind({prevId: "repeat"})("DataBindOnly", "hidden");
            util.assertXmlEqual(
                        call('createXML'),
                        HIDDEN_VALUE_IN_REPEAT_XML,
                        {normalize_xmlns: true});
        });

        it("should add question outside of collapsed group (ref group)", function () {
            util.loadXML("");
            var group = util.addQuestion("Group", "group");
            util.addQuestion("Text", "text1");
            util.collapseGroup(group);
            util.addQuestion.bind({prevId: "group"})("Text", "text2");
            util.expandGroup(group);
            util.assertJSTreeState(
                "group",
                "  text1",
                "text2"
            );
        });

        it("should add question outside of collapsed group (ref inner question)", function () {
            util.loadXML("");
            var group = util.addQuestion("Group", "group"),
                text1 = util.addQuestion("Text", "text1"),
                selected;
            util.clickQuestion("group/text1");
            selected = call("getCurrentlySelectedMug");
            assert.equal(selected, text1,
                "wrong selected mug: " + (selected && selected.p.nodeID));
            util.collapseGroup(group);
            util.addQuestion("Text", "text2");
            util.expandGroup(group);
            util.assertJSTreeState(
                "group",
                "  text1",
                "text2"
            );
        });

        it("should not be able to add choice to collapsed select", function () {
            util.loadXML("");
            var group = util.addQuestion("Select", "select");
            util.addQuestion("Choice", "choice1");
            util.collapseGroup(group);
            chai.expect(function() {
                util.addQuestion.bind({prevId: "select"})("Choice", "choice2");
            }).to.throw(Error);
        });

        it("should add text outside of collapsed select", function () {
            util.loadXML("");
            var group = util.addQuestion("Select", "select");
            util.addQuestion("Choice", "choice1");
            util.addQuestion("Choice", "choice2");
            util.collapseGroup(group);
            util.addQuestion.bind({prevId: "select"})("Text", "text1");
            util.expandGroup(group);
            util.assertJSTreeState(
                "select",
                "  choice1",
                "  choice2",
                "text1"
            );
        });

        it("should not change mugs on collapse", function () {
            util.loadXML("");
            var group1 = util.addQuestion("Group", "group"),
                text, selected;
            util.addQuestion("Group", "group");
            text = util.addQuestion("Text", "text");
            util.clickQuestion("group/group/text");
            selected = call("getCurrentlySelectedMug");
            assert.equal(selected, text,
                "wrong selected mug: " + (selected && selected.p.nodeID));

            util.collapseGroup(group1);

            selected = call("getCurrentlySelectedMug");
            assert.equal(selected, text,
                "wrong selected mug: " + (selected && selected.p.nodeID));
        });

        it("should not select group if external question is selected on collapse group", function () {
            util.loadXML("");
            var text1 = util.addQuestion("Text", "text1"),
                group = util.addQuestion("Group", "group"),
                selected;
            util.clickQuestion("text1");
            selected = call("getCurrentlySelectedMug");
            assert.equal(selected, text1,
                "wrong selected mug: " + (selected && selected.p.nodeID));

            util.collapseGroup(group);

            selected = call("getCurrentlySelectedMug");
            assert.equal(selected, text1,
                "wrong selected mug: " + (selected && selected.p.nodeID));
        });

        it("should load hidden value in repeat group", function () {
            util.loadXML(HIDDEN_VALUE_IN_REPEAT_XML);
            util.assertJSTreeState(
                "repeat",
                "  text",
                "  hidden"
            );
        });

        it("should load hidden values interspersed with other questions", function () {
            util.loadXML(HIDDEN_AMONG_QUESTIONS_XML);
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
        });

        it("should add hidden value at end of group", function () {
            util.loadXML(INSERT_QUESTIONS_XML);
            util.addQuestion.bind({prevId: "hidden1"})("DataBindOnly", "hiddenA");
            util.addQuestion.bind({prevId: "group/hidden2"})("DataBindOnly", "hiddenB");
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
        });

        it("should add hidden value among other questions", function () {
            util.loadXML(INSERT_QUESTIONS_XML);
            util.addQuestion.bind({prevId: "text1"})("DataBindOnly", "hiddenA");
            util.addQuestion.bind({prevId: "group/text3"})("DataBindOnly", "hiddenB");
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
        });

        it("should add question after selected question", function () {
            util.loadXML(INSERT_QUESTIONS_XML);
            util.addQuestion.bind({prevId: "text1"})("Text", "textA");
            util.addQuestion.bind({prevId: "group/text3"})("Text", "textB");
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
        });

        it("should add question after hidden value", function () {
            util.loadXML(INSERT_QUESTIONS_XML);
            util.addQuestion.bind({prevId: "hidden1"})("Text", "textA");
            util.addQuestion.bind({prevId: "group/hidden2"})("Text", "textB");
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
        });

        it("should add question after sole hidden value", function (done) {
            util.init({
                core: {
                    onReady: function () {
                        util.addQuestion("DataBindOnly", "hidden");
                        util.addQuestion.bind({prevId: "hidden"})("Text", "text");
                        util.assertJSTreeState(
                            "hidden",
                            "text"
                        );
                        done();
                    }
                },
                features: {rich_text: false},
            });
        });

        it("should display welcome message whenever there are no questions", function () {
            util.loadXML("");
            util.addQuestion("Text", "text1");
            util.addQuestion("Text", "text2");

            util.deleteQuestion("/data/text1");
            assert(!$(".fd-default-panel").is(":visible"));
            assert($(".fd-question-changer").is(":visible"));
            util.deleteQuestion("/data/text2");
            assert($(".fd-default-panel").is(":visible"));
        });

        it("should use single quotes on drag/drop choice", function() {
            util.loadXML("");
            util.addQuestion("Select", "select");
            util.addQuestion("Choice", "choice1");
            var mug = util.addQuestion("DataBindOnly", "mug"),
                calc = $("[name=property-calculateAttr]"),
                tree = $(".fd-question-tree").jstree(true);
            assert.equal(calc.length, 1);
            util.findNode(tree, "choice1").data.handleDrop(calc);
            assert.equal(mug.p.calculateAttr, "'choice1'");
        });

        it("should drop /data/ reference when rich_text is false", function() {
            util.loadXML("");
            util.addQuestion("Text", "text");
            util.addQuestion("DataBindOnly", "mug");
            var calc = $("[name=property-calculateAttr]"),
                tree = $(".fd-question-tree").jstree(true);
            assert.equal(calc.length, 1);
            util.findNode(tree, "text").data.handleDrop(calc);
            assert.equal(calc.val(), "/data/text");
        });

        it("should notify activity url on form change", function(done) {
            var vellum, activityUrlCalled = false;
            // defaults: do not notify, 5 minute timeout
            assert.equal(util.options.options.core.activityUrl, null);
            assert.equal(util.options.options.core.activityTimeout, 5 * 60 * 1000);

            util.init({
                core: {
                    activityTimeout: -1,  // immediate timeout
                    activityUrl: function () {
                        activityUrlCalled = true;
                    },
                    onReady: function () {
                        // first change initializes timeout
                        var start = Date.now(), later;
                        vellum = this;
                        vellum.onFormChange();
                        assert.isAtLeast(this.data.core.activityTimestamp, start);

                        // second change notifies on activity (if timed out)
                        later = Date.now();
                        vellum.onFormChange();
                        assert(activityUrlCalled);
                        assert.isAtLeast(vellum.data.core.activityTimestamp, later);

                        assert.isNotNull(vellum.opts().core.activityUrl);
                        // reset to prevent calls in other tests
                        vellum.opts().core.activityUrl = null;

                        done();
                    }
                }
            });
        });

        describe("with rich text disabled", function() {
            var vellum;
            before(function (done) {
                util.init({
                    core: {onReady: function () {
                        vellum = this;
                        done();
                    }},
                    features: {rich_text: false},
                });
            });

            it("should display /data/ in the question tree", function () {
                util.addQuestion('Text', 'text1');
                var mug = util.addQuestion('Text', 'text2');
                assert.strictEqual(vellum.getMugDisplayName(mug), 'text2');
                $('[name=itext-en-label]').val('text2 <output value="#form/text2" />').change();
                assert.strictEqual(vellum.getMugDisplayName(mug), 'text2 &lt;output value="/data/text2" /&gt;');
            });

            it("should not double-escape > & < chars in the question tree", function () {
                util.paste([
                    ["id", "type", "labelItext:en-default"],
                    ["/html-label", "Text", "<h1>a > & < b</h1>"],
                ]);
                var mug = util.getMug("html-label");
                assert.equal(vellum.getMugDisplayName(mug),
                    '&lt;h1&gt;a &gt; &amp; &lt; b&lt;/h1&gt;');
                assert.equal(mug.p.labelItext.get(), "<h1>a > & < b</h1>");
            });
        });

        describe("with rich text enabled", function() {
            var vellum;
            before(function (done) {
                util.init({
                    core: {onReady: function () {
                        vellum = this;
                        done();
                    }},
                    features: {rich_text: true},
                });
            });

            it("should not double-escape > & < chars in the question tree", function () {
                util.paste([
                    ["id", "type", "labelItext:en-default"],
                    ["/html-label", "Text", "<h1>a > & < b</h1>"],
                ]);
                var mug = util.getMug("html-label");
                assert.equal(vellum.getMugDisplayName(mug),
                    '&lt;h1&gt;a &gt; &amp; &lt; b&lt;/h1&gt;');
                assert.equal(mug.p.labelItext.get(), "<h1>a > & < b</h1>");
            });
        });

        describe("should", function () {
            var form, dup;
            before(function () {
                form = util.loadXML("");
                util.addQuestion("Text", "question1");
                dup = util.addQuestion("Text", "question2");
            });

            it("show validation error on add question with duplicate path", function () {
                dup.p.nodeID = "question1";
                assert(form.vellum.ensureCurrentMugIsSaved(), "mug is not saved");
                assert(!util.isTreeNodeValid(dup), "mug should not be valid");
            });

            it("reset question ID on dismiss duplicate path error", function () {
                dup.p.nodeID = "question1";
                var msg = dup.messages.get("nodeID", "mug-conflictedNodeId-warning");
                assert(msg, "unexpected: validation error is missing");
                dup.dropMessage("nodeID", "mug-conflictedNodeId-warning");
                assert(util.isTreeNodeValid(dup), util.getMessages(dup));
                assert.match(dup.p.nodeID, /^copy-\d+-of-question1$/);
                assert(!dup.p.conflictedNodeId,
                    "conflictedNodeId should not be set; got " + dup.p.conflictedNodeId);
            });
        });

        describe("type changer", function () {
            function test(srcType, dstType, allowed) {
                var show = allowed ? "show " : "not show ";
                it("should " + show + dstType + " in menu for " + srcType, function () {
                    // HACK this depends on UI HTML
                    var mug = map[srcType],
                        changer = form.vellum.getQuestionTypeChanger(mug),
                        anchor = changer.find("[data-qtype=" + dstType + "]");
                    assert(anchor.length === (allowed ? 1 : 0),
                           anchor.parent().html() ||
                           (dstType + " not found in menu"));
                });
            }
            var form, map = {};
            before(function () {
                form = util.loadXML("");
                map.Text = util.addQuestion("Text");
                map.Select = util.addQuestion("Select");
                util.addQuestion("Choice");
                map.SelectDynamic = util.addQuestion("SelectDynamic");
                map.Transfer = util.addQuestion("Transfer");
                map.Dispense = util.addQuestion("Dispense");
                map.Receive = util.addQuestion("Receive");
            });

            test("Text", "Trigger", true);
            test("Text", "Choice");
            test("Text", "Group");
            test("Text", "DataBindOnly");
            test("Text", "Select", true);
            test("Text", "MSelect", true);
            test("Text", "SelectDynamic");
            test("Text", "MSelectDynamic");
            test("Text", "Transfer");

            test("Select", "MSelect", true);
            test("Select", "Text");
            test("Select", "SelectDynamic");
            test("Select", "MSelectDynamic");

            test("SelectDynamic", "MSelectDynamic", true);
            test("SelectDynamic", "Select");
            test("SelectDynamic", "MSelect");

            test("Transfer", "Text");
            test("Transfer", "Dispense", true);
            test("Transfer", "Receive", true);
            test("Dispense", "Transfer", true);
            test("Dispense", "Receive", true);
            test("Receive", "Transfer", true);
            test("Receive", "Dispense", true);
        });

        describe("drag+drop should", function () {
            var mugs;
            before(function () {
                util.loadXML(INSERT_QUESTIONS_XML);
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
