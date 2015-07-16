require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/all_question_types.xml'
], function (
    chai,
    $,
    _,
    util,
    TEST_XML
) {
    var call = util.call,
        clickQuestion = util.clickQuestion,
        addQuestion = util.addQuestion,
        assert = chai.assert,
        questionTypes = [
            //{
            //    clickBeforeAdd: "questionX", // optional click this node before adding question
            //    path: parent path (must end with /)
            //    type: "QuestionType", // required
            //    nodeId: "questionN", // required
            //    attrs: { // optional
            //        // Any key here implies the same key inputs with a value of 1
            //        "attrName": value
            //    },
            //    inputs { // optional: add tests to check input counts
            //        "inputName": inputCount
            //    }
            //}
            {
                type: 'Text',
                nodeId: 'question1',
                attrs: {
                    dataValue: 'default data value',
                    constraintAttr: '/data/question20 = 2',
                    relevantAttr: '/data/question20',
                    requiredAttr: true,
                },
                inputs: {
                    calculateAttr: 0
                }
            }, {
                type: 'Trigger',
                nodeId: 'question2',
                inputs: {
                    // TODO add more input counts for each question type
                    calculateAttr: 0,
                    constraintAttr: 1,
                    requiredAttr: 0,
                    relevantAttr: 1
                }
            }, {
                type: 'Trigger',
                nodeId: 'question30',
                attrs: {
                    appearance: ''
                },
            }, {
                type: 'Select',
                nodeId: 'question3',
                inputs: {
                    // TODO add more input counts for each question type
                    calculateAttr: 0,
                    constraintAttr: 1,
                    requiredAttr: 1,
                    relevantAttr: 1
                }
            }, {
                type: 'MSelect',
                nodeId: 'question6'
            }, {
                type: 'Int',
                nodeId: 'question13'
            }, {
                type: 'PhoneNumber',
                nodeId: 'question14'
            }, {
                type: 'Double',
                nodeId: 'question15'
            }, {
                type: 'Long',
                nodeId: 'question16'
            }, {
                type: 'Date',
                nodeId: 'question17'
            }, {
                type: 'Time',
                nodeId: 'question18'
            }, {
                type: 'DateTime',
                nodeId: 'question19'
            }, {
                type: 'DataBindOnly',
                nodeId: 'question20',
                inputs: {
                    calculateAttr: 1,
                    constraintAttr: 0,
                    requiredAttr: 0,
                }
            }, {
                type: 'DataBindOnly',
                nodeId: 'question32',
                attrs: {
                    calculateAttr: '1 + 2'
                },
                inputs: {
                    calculateAttr: 1,
                    constraintAttr: 0,
                    requiredAttr: 0,
                    relevantAttr: 1
                }
            }, {
                clickBeforeAdd: "question19", // insert after question20
                type: 'Repeat',
                nodeId: 'question22'
            }, {
                type: 'FieldList',
                path: 'question22/',
                nodeId: 'question23'
            }, {
                type: 'Group',
                path: 'question22/question23/',
                nodeId: 'question40'
            }, {
                clickBeforeAdd: "question22/question23",
                type: 'Repeat',
                path: 'question22/question23/',
                nodeId: 'question41'
            },{
                clickBeforeAdd: "question22/question23",
                type: 'Image',
                path: 'question22/question23/',
                nodeId: 'question24'
            }, {
                type: 'Audio',
                path: 'question22/question23/',
                nodeId: 'question25'
            }, {
                type: 'Video',
                path: 'question22/question23/',
                nodeId: 'question26'
            }, {
                type: 'Geopoint',
                path: 'question22/question23/',
                nodeId: 'question27'
            }, {
                type: 'Secret',
                path: 'question22/question23/',
                nodeId: 'question28'
            }, {
                type: 'Signature',
                path: 'question22/question23/',
                nodeId: 'question29'
            }, {
                type: 'AndroidIntent',
                path: 'question22/question23/',
                nodeId: 'question7'
            }, {
                clickBeforeAdd: "question19", // insert before question22
                type: 'Group',
                nodeId: 'question21'
            }, {
                type: 'Repeat',
                path: 'question21/',
                nodeId: 'question31',
                attrs: {
                    repeat_count: 2
                }
            }
        ];

    describe("Vellum", function () {
        describe("on load XML", function () {
            before(function (done) {
                util.init({
                    core: {
                        form: TEST_XML,
                        onReady: function () {
                            done();
                        }
                    }
                });
            });

            it("preserves all question types and attributes", function () {
                util.assertXmlEqual(util.call('createXML'), TEST_XML);
            });


            _.each(questionTypes, function(q, index) {
                var nodeId = q.nodeId;
                describe("with " + q.type + "[" + nodeId + "]", function () {
                    before(function (done) {
                        if (index > 0) {
                            clickQuestion((q.path || "") + nodeId);
                        }
                        done();
                    });

                    it("should be selected when clicked", function() {
                        assert.equal(call("getCurrentlySelectedMug").p.nodeID, nodeId);
                    });

                    _.each(q.attrs || {}, function (val, name) {
                        it("should show 1 input for " + name, function() {
                            util.assertInputCount(name, 1, nodeId);
                        });
                    });

                    _.each(q.inputs || {}, function (num, name) {
                        if (q.attrs && q.attrs.hasOwnProperty(name)) {
                            assert.equal(num, 1,
                                "test configuration conflict for " + name);
                        } else {
                            it("should show " + num + " inputs for " + name, function() {
                                util.assertInputCount(name, num, nodeId);
                            });
                        }
                    });
                });
            });
        });

        it("adds all question types and attributes", function (done) {
            // This test takes way too long and needs to be broken up into
            // smaller subtests. LONG timeout is to prevent timeout on travis.
            this.timeout(10000);
            // this also tests
            // - that clicking add question buttons when other questions are
            //   selected adds questions correctly
            // - that a data node is added at the end, and adding a question
            //   when a data node is selected adds to the end of the non-data
            //   nodes
            // - adding standard and other itext
            // - changing itext label and updating question tree
            // - adding itext for multiple languages
            // - automatically creating Itext IDs for constraint and hint
            //   messages
            // - automatic adding of choices when you add a select
            // - automatic generation of media paths for regular questions and choices
            util.init({
                core: {
                    form: null,
                    onReady: function () {
                        _.each(questionTypes, function (q, i) {
                            var prev = (i > 0 ? questionTypes[i - 1] : {}),
                                prevId = q.clickBeforeAdd ||
                                    (prev.nodeId ? (prev.path || "") + prev.nodeId : null);
                            addQuestion.call({prevId: prevId}, q.type, q.nodeId, q.attrs);
                        });

                        function addAllForms() {
                            $(".btn:contains(image)").click();
                            $(".btn:contains(audio)").click();
                            $(".btn:contains(video)").click();
                            $(".btn:contains(long)").click();
                            $(".btn:contains(short)").click();
                            $(".btn:contains(custom)").click();
                            $(".fd-modal-generic-container").find("input")
                                .val("custom");
                            $(".fd-modal-generic-container").find(".btn:contains(Add)").click();
                        }

                        clickQuestion("question1");
                        addAllForms();
                        $("[name='itext-en-label']")
                            .val('question1 en label').change();
                        $("[name='itext-hin-label']")
                            .val('question1 hin label').change();
                        $("[name='itext-en-constraintMsg']")
                            .val('question1 en validation').change();
                        $("[name='itext-hin-constraintMsg']")
                            .val('question1 hin validation').change();
                        $("[name='itext-en-hint']")
                            .val('question1 en hint').change();
                        $("[name='itext-hin-hint']")
                            .val('question1 hin hint').change();
                        $("[name='itext-en-help']")
                            .val('question1 en help').change();
                        $("[name='itext-hin-help']")
                            .val('question1 hin help').change();
                        $("[name='itext-en-label-long']")
                            .val("question1 en long").change();
                        $("[name='itext-hin-label-long']")
                            .val("question1 hin long").change();
                        $("[name='itext-en-label-short']")
                            .val("question1 en short").change();
                        $("[name='itext-hin-label-short']")
                            .val("question1 hin short").change();
                        $("[name='itext-en-label-custom']")
                            .val("question1 en custom").change();
                        $("[name='itext-hin-label-custom']")
                            .val("question1 hin custom").change();

                        clickQuestion("question3/item1");
                        addAllForms();
                        $("[name='itext-en-label-long']")
                            .val("item1 long en").change();
                        $("[name='itext-hin-label-long']")
                            .val("item1 long hin").change();
                        $("[name='itext-en-label-short']")
                            .val("item1 short en").change();
                        $("[name='itext-hin-label-short']")
                            .val("item1 short hin").change();
                        $("[name='itext-en-label-custom']")
                            .val("item1 custom en").change();
                        $("[name='itext-hin-label-custom']")
                            .val("item1 custom hin").change();

                        clickQuestion("question22/question23/question7");
                        $("[name='property-androidIntentAppId']").val("app_id").change();
                        $("[name='property-androidIntentExtra'] .fd-kv-key").val('key1').change();
                        $("[name='property-androidIntentExtra'] .fd-kv-val").val('value1').change();
                        $("[name='property-androidIntentResponse'] .fd-kv-key").val('key2').change();
                        $("[name='property-androidIntentResponse'] .fd-kv-val").val('value2').change();
                        util.assertXmlEqual(
                            call('createXML'),
                            TEST_XML
                                .replace(' foo="bar"', '')
                                .replace(' spam="eggs"', '')
                                .replace(' foo="baz"', '')
                                .replace(/<unrecognized>[\s\S]+<\/unrecognized>/, '')
                                .replace('non-itext label', '')
                                .replace('non-itext hint', '')
                                .replace(/<instance[^>]+?casedb[^>]+?><\/instance>/, '')
                                .replace(/<setvalue[^>]+?>/, ''),
                            {normalize_xmlns: true}
                        );
                        
                        // should have updated question tree
                        clickQuestion("question1");

                        done();
                    }
                }
            });
        });

        describe("can", function() {
            var changes = [
                    ["Text", "Trigger"],
                    ["Trigger", "Select"],
                    ["Image", "Select"],
                    ["Audio", "Select"],
                    ["Video", "Select"],
                    ["Image", "Audio"],
                    ["PhoneNumber", "Text"],
                    ["Select", "Text"],
                    ["MSelect", "Text"],
                    ["Select", "MSelect"],
                    ["MSelect", "Select"],
                    ["Select + Choices", "MSelect"],
                    ["MSelect + Choices", "Select"]
                ],
                no_change = [
                    //["Text", "Group"],
                    //["Text", "Repeat"],
                    //["Text", "FieldList"],
                    ["MSelect + Choices", "Text"],
                    ["Select + Choices", "Text"]
                    //["Group", "Text"],
                    //["Repeat", "Text"],
                    //["FieldList", "Text"]
                ];

            before(function (done) {
                util.init({
                    core: {
                        onReady: function () {
                            done();
                        }
                    }
                });
            });

            function setup(from, to) {
                var choices = from.indexOf(" + Choices") > -1;
                from = (choices ? from.replace(" + Choices", "") : from);
                var nodeId = (from + (choices ? "_Choices" : "") + "_to_" + to),
                    mug = addQuestion(from, nodeId);
                if (!choices && from.indexOf("Select") > -1) {
                    util.deleteQuestion(nodeId + "/item1");
                    util.deleteQuestion(nodeId + "/item2");
                }
                assert.equal(mug.p.nodeID, nodeId, "got wrong mug before changing type");
                assert.equal(mug.__className, from, "wrong mug type");
                return mug;
            }

            _.each(changes, function (change) {
                var from = change[0],
                    to = change[1];
                it("change " + from + " to " + to, function () {
                    var mug = setup(from, to);
                    call("changeMugType", mug, to);
                    mug = util.getMug(mug.p.nodeID);
                    assert.equal(mug.__className, to);

                    call("loadXML", call("createXML"));
                    mug = util.getMug(mug.p.nodeID);
                    assert.equal(mug.__className, to);
                });
            });

            _.each(no_change, function (change) {
                var from = change[0],
                    to = change[1];
                it("not change " + from + " to " + to, function () {
                    var mug = setup(from, to),
                        ok = true;
                    try {
                        call("changeMugType", mug, to);
                        ok = false;
                    } catch (error) {
                        assert(String(error).indexOf("Cannot change") > 0, String(error));
                    }
                    assert(ok, "Error not raised when changing " + from + " to " + to);
                    mug = util.getMug(mug.p.nodeID);
                    assert.equal(mug.__className, from.replace(" + Choices", ""));
                });
            });
        });

        it("question type change survives save + load", function () {
            util.loadXML("");
            addQuestion("Text", "question");
            var mug = call("getMugByPath", "/data/question");

            call("changeMugType", mug, "Trigger");

            util.saveAndReload(function () {
                // verify type change
                mug = call("getMugByPath", "/data/question");
                assert.equal(mug.__className, "Trigger");
            });
        });

        it("should allow user to view longs but not add them", function() {
            util.loadXML("");

            // able to programatically add long
            util.addQuestion("Long", "long");
            util.addQuestion("Int", "int");
            util.assertJSTreeState(
                "long",
                "int"
            );

            // can't change another question to a long
            var $changer = $(".fd-question-changer");
            $changer.children("a").click();
            assert.equal($changer.find("[data-qtype='Text']").length, 1);
            assert.equal($changer.find("[data-qtype='Long']").length, 0);

            // can't add new long with toolbar
            var $toolbar = $(".fd-container-question-type-group");
            assert.equal($toolbar.find("[data-qtype='Text']:not(.btn)").length, 1); // dropdown item, not button
            assert.equal($toolbar.find("[data-qtype='Long']").length, 0);
        });

        it("prevents changing selects with children to non-selects", function() {
            util.loadXML("");
            util.addQuestion("Select", "question1");
            var changerSelector = ".fd-question-changer";

            $(changerSelector + " > a").click();
            var $options = $(changerSelector + " .change-question");
            assert.equal($options.length, 1);
            assert.equal($options.length, $options.filter("[data-qtype*='Select']").length);

            util.deleteQuestion("question1/item1");
            util.deleteQuestion("question1/item2");
            util.clickQuestion("question1");
            assert.ok($(changerSelector + " .change-question:not([data-qtype*='Select'])").length > 0);
        });

        it("should show error on delete validation condition but not message", function() {
            util.loadXML("");
            var text = util.addQuestion("Text", "text");
            text.p.constraintAttr = "a = b";
            text.p.constraintMsgItext.set("A != B");
            text.p.constraintAttr = "";
            assert(!util.isTreeNodeValid(text), "question should not be valid");
        });
    });
});
