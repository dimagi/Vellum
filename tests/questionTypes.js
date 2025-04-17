define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/all_question_types.xml',
    'text!static/questionTypes/image-capture.xml',
    'text!static/javaRosa/select1-help.xml',
    'text!static/questionTypes/select1-help-with-type.xml',
], function (
    chai,
    $,
    _,
    util,
    TEST_XML,
    IMAGE_CAPTURE_XML,
    SELECT1_HELP_XML,
    SELECT1_HELP_WITH_TYPE_XML
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
                type: 'Document',
                path: 'question22/question23/',
                nodeId: 'question33'
            }, {
                type: 'AndroidIntent',
                path: 'question22/question23/',
                nodeId: 'question7'
            }, {
                type: 'MicroImage',
                path: 'question22/question23/',
                nodeId: 'question35',
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
                    },
                    features: { case_micro_image: true,
                                use_custom_repeat_button_text: true,
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
                features: {
                    templated_intents: true,
                    custom_intents: true,
                    use_custom_repeat_button_text: true,
                },
                core: {
                    form: null,
                    onReady: function () {
                        this.data.core.form.richText = false;
                        _.each(questionTypes, function (q, i) {
                            var prev = (i > 0 ? questionTypes[i - 1] : {}),
                                prevId = q.clickBeforeAdd ||
                                    (prev.nodeId ? (prev.path || "") + prev.nodeId : null);
                            addQuestion.call({prevId: prevId}, q.type, q.nodeId, q.attrs);
                        });

                        function addAllForms() {
                            _.each(['image', 'audio', 'video', 'video-inline'], function (i) {
                                $(".btn.itext-block-label-add-form-" + i).click();
                                $(".btn.itext-block-constraintMsg-add-form-" + i).click();
                                $(".btn.itext-block-help-add-form-" + i).click();
                            });
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
                        $("[name='property-comment']")
                            .val("question 1 comment\n* with __markdown__").change();

                        clickQuestion("question2");
                        $("[name='property-comment']")
                            .val("question 2 comment").change();

                        clickQuestion("question3");
                        addQuestion("Choice", "choice1");
                        addQuestion("Choice", "choice2");
                        clickQuestion("question3/choice1");
                        addAllForms();
                        $("[name='itext-en-label-long']")
                            .val("choice1 long en").change();
                        $("[name='itext-hin-label-long']")
                            .val("choice1 long hin").change();
                        $("[name='itext-en-label-short']")
                            .val("choice1 short en").change();
                        $("[name='itext-hin-label-short']")
                            .val("choice1 short hin").change();
                        $("[name='itext-en-label-custom']")
                            .val("choice1 custom en").change();
                        $("[name='itext-hin-label-custom']")
                            .val("choice1 custom hin").change();

                        clickQuestion("question22");
                        $("[name='itext-en-addEmptyCaption']")
                            .val("add new").change();
                        $("[name='itext-en-addCaption']")
                            .val("add another").change();

                        clickQuestion("question22/question23/question7");
                        $("[name='property-androidIntentAppId']").val("").change();
                        $("[name='property-androidIntentAppId-text']").val("app_id").change();
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
                    /*["Text", "Trigger"],
                    ["Trigger", "Select"],
                    ["Image", "Select"],
                    ["Audio", "Select"],
                    ["Video", "Select"],
                    ["Image", "Audio"],
                    ["PhoneNumber", "Text"],*/
                    ["Select", "Text"],
                    ["MSelect", "Text"],
                    ["Select", "SelectDynamic"],
                    ["Select", "MSelectDynamic"],
                    ["MSelect", "SelectDynamic"],
                    ["MSelect", "MSelectDynamic"],
                    ["SelectDynamic", "MSelectDynamic"],
                    ["MSelectDynamic", "SelectDynamic"],
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
                    ["Select + Choices", "Text"],
                    ["Select + Choices", "SelectDynamic"],
                    ["Select + Choices", "MSelectDynamic"],
                    ["MSelect + Choices", "SelectDynamic"],
                    ["MSelect + Choices", "MSelectDynamic"],
                    //["Group", "Text"],
                    //["Repeat", "Text"],
                    //["FieldList", "Text"]
                ],
                questionWithoutDefaultAppearance = [
                    "Text", "Select", "MSelect", "Audio", "Video", "Image", "Document",
                ],
                questionWithDefaultAppearance = {
                    Trigger: "minimal",
                    PhoneNumber: "numeric",
                    Signature: "signature",
                },
                remove_appearance = [
                    ["Trigger", questionWithoutDefaultAppearance],
                    ["PhoneNumber", questionWithoutDefaultAppearance],
                    ["Signature", questionWithoutDefaultAppearance],
                ],
                change_appearance = [
                    ["Trigger", _.omit(questionWithDefaultAppearance, "Trigger")],
                    ["PhoneNumber", _.omit(questionWithDefaultAppearance, "PhoneNumber")],
                    ["Signature", _.omit(questionWithDefaultAppearance, "Signature")],
                ];

            before(function (done) {
                util.init({
                    features: {rich_text: false },
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
                if (from.indexOf("Select") > -1 && from.indexOf("Dynamic") === -1) {
                    if (choices) {
                        util.addQuestion("Choice", "choice1");
                        util.addQuestion("Choice", "choice2");
                        util.clickQuestion(nodeId);
                    }
                }
                assert.equal(mug.p.nodeID, nodeId, "got wrong mug before changing type");
                assert.equal(mug.__className, from, "wrong mug type");
                return mug;
            }

            function tearDown(from, to) {
                var choices = from.indexOf(" + Choices") > -1;
                from = (choices ? from.replace(" + Choices", "") : from);
                var nodeId = (from + (choices ? "_Choices" : "") + "_to_" + to);
                util.deleteQuestion(nodeId);
            }

            _.each(changes, function (change) {
                var from = change[0],
                    to = change[1];
                it("change " + from + " to " + to, function () {
                    var mug = setup(from, to);
                    call("changeMugType", mug, to);
                    mug = util.getMug(mug.p.nodeID);
                    assert.equal(mug.__className, to);

                    util.loadXML(call("createXML"));
                    mug = util.getMug(mug.p.nodeID);
                    assert.equal(mug.__className, to);
                    tearDown(from, to);
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
                    tearDown(from, to);
                });
            });

            _.each(remove_appearance, function (change) {
                var from = change[0];
                _.each(change[1], function(to) {
                    it("should remove appearance attribute when changing " + from + " to " + to, function () {
                        var mug = setup(from, to);
                        call("changeMugType", mug, to);
                        mug = util.getMug(mug.p.nodeID);
                        assert.equal(mug.__className, to);
                        assert.equal(mug.p.appearance, undefined);

                        call("loadXML", call("createXML"));
                        mug = util.getMug(mug.p.nodeID);
                        assert.equal(mug.__className, to);
                        tearDown(from, to);
                    });
                });
            });

            _.each(change_appearance, function (change) {
                var from = change[0];
                _.each(change[1], function(newAppearance, to) {
                    it("should change appearance attribute when changing " + from + " to " + to, function () {
                        var mug = setup(from, to);
                        call("changeMugType", mug, to);
                        mug = util.getMug(mug.p.nodeID);
                        assert.equal(mug.__className, to);
                        assert.equal(mug.p.appearance, newAppearance);

                        call("loadXML", call("createXML"));
                        mug = util.getMug(mug.p.nodeID);
                        assert.equal(mug.__className, to);
                        tearDown(from, to);
                    });
                });
            });

            it("should change back and forth between dynamic types without side effects", function () {
                var from = 'MSelectDynamic',
                    to = 'SelectDynamic',
                    mug = setup(from, to);
                var original = call('createXML');
                call("changeMugType", mug, to);
                var afterChange = call('createXML');
                call("changeMugType", mug, from);
                util.assertXmlEqual(call('createXML'), original, { normalize_xmlns: true });
                call("changeMugType", mug, to);
                util.assertXmlEqual(call('createXML'), afterChange, { normalize_xmlns: true });
                tearDown(from, to);
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

        it("changing type from required Text to Label removes required attribute", function () {
            util.loadXML("");
            addQuestion("Text", "question", {requiredAttr: "true()"});
            var mug = util.getMug("question");

            call("changeMugType", mug, "Trigger");

            assert.equal(mug.p.requiredAttr, undefined);
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

            // can't add new long via UI
            var $dropdown = $(".fd-add-question-dropdown");
            assert.equal($dropdown.find("[data-qtype='Text']").length, 1);
            assert.equal($dropdown.find("[data-qtype='Long']").length, 0);
        });

        it("prevents changing selects with children to non-selects", function() {
            util.loadXML("");
            util.addQuestion("Select", "question1");
            util.addQuestion("Choice", "choice1");
            util.addQuestion("Choice", "choice2");
            util.clickQuestion("question1");
            var changerSelector = ".fd-question-changer";

            $(changerSelector + " > a").click();
            var $options = $(changerSelector + " .change-question");
            assert.equal($options.length, 1);
            assert.equal($options.length, $options.filter("[data-qtype*='Select']").length);

            util.deleteQuestion("question1/choice1");
            util.deleteQuestion("question1/choice2");
            util.clickQuestion("question1");
            assert.ok($(changerSelector + " .change-question:not([data-qtype*='Select'])").length > 0);
        });

        it("adds and removes the add choice action when type changes", function() {
            util.loadXML("");
            util.addQuestion("Text", "question1");
            var changerSelector = ".fd-question-changer";

            $(changerSelector + " > a").click();
            var $options = $(changerSelector + " .change-question");
            $options.filter("[data-qtype='Select']").click();

            assert.strictEqual($(".add_choice").length, 1);

            util.addQuestion("Text", "question2");
            $(".add_choice").click();
            $(".add_choice").click();

            var choice = call("getCurrentlySelectedMug");
            assert(!choice.messages.get().length, "New mug should have no errors");
            assert(!choice.p.nodeID, "New mug shouldn't have an id");
            assert(!choice.p.labelItext.get(), "New mug shouldn't have a label");

            util.assertJSTreeState(
                "question1",
                "  choice1",
                "  ",
                "question2"
            );

            choice.form.vellum.ensureCurrentMugIsSaved();  // force choice2 id to generate
            util.deleteQuestion("question1/choice1");
            util.deleteQuestion("question1/choice2");

            clickQuestion("question1");
            $(changerSelector + " > a").click();
            $options = $(changerSelector + " .change-question");
            $options.filter("[data-qtype='Text']").click();
            assert.strictEqual($(".add_choice").length, 0);
        });

        it("gives select questions an add choice action", function() {
            util.loadXML("");
            var mug = util.addQuestion("Select", "question1");

            assert.strictEqual($(".add_choice").length, 1);
            $(".add_choice").click();
            mug.form.vellum.ensureCurrentMugIsSaved();  // force id to generate
            clickQuestion("question1/choice1");

            util.assertJSTreeState(
                "question1",
                "  choice1"
            );
        });

        it("gives select questions in loaded XML an add choice action", function () {
            util.loadXML(SELECT1_HELP_WITH_TYPE_XML);
            assert.strictEqual($(".add_choice").length, 1);
        });

        it("should show error on delete validation condition but not message", function() {
            util.loadXML("");
            var text = util.addQuestion("Text", "text");
            text.p.constraintAttr = "a = b";
            text.p.constraintMsgItext.set("A != B");
            text.p.constraintAttr = "";
            assert(!util.isTreeNodeValid(text), "question should not be valid");
        });

        it("should require a repeat_count when inside of a question list", function () {
            util.loadXML("");
            util.addQuestion("FieldList", "fieldlist");
            var repeat = util.addQuestion("Repeat", "repeat");
            assert.notStrictEqual(repeat.spec.repeat_count.validationFunc(repeat), "pass",
                                  "question should not be valid");
        });

        it("should require a repeat_count when inside of a group in a question list", function () {
            util.loadXML("");
            util.addQuestion("FieldList", "fieldlist");
            util.addQuestion("Group", "group");
            var repeat = util.addQuestion("Repeat", "repeat");
            assert.notStrictEqual(repeat.spec.repeat_count.validationFunc(repeat), "pass",
                                  "question should not be valid");
        });

        it("should not require a repeat_count when inside of a group", function () {
            util.loadXML("");
            util.addQuestion("Group", "group");
            var repeat = util.addQuestion("Repeat", "repeat");
            assert.strictEqual(repeat.spec.repeat_count.validationFunc(repeat), "pass",
                                  "question should be valid");
        });
    });

    describe("Image Questions", function() {
        it("should default to small image size", function() {
            util.loadXML("");
            var image = util.addQuestion("Image", 'image');
            assert.strictEqual(image.p.imageSize, 250);
        });

        it("should select original size if there is no option", function() {
            util.loadXML(IMAGE_CAPTURE_XML);
            var image = call("getMugByPath", "/data/image");
            assert.strictEqual(image.p.imageSize, '');
        });
    });

    describe("Select questions", function () {
        before(function (done) {
            util.init({
                core: {
                    onReady: function () { done(); },
                },
            });
        });

        it("should not write the type", function () {
            util.loadXML(SELECT1_HELP_WITH_TYPE_XML);
            util.assertXmlEqual(util.call('createXML'), SELECT1_HELP_XML);
        });
    });

    describe("Micro-Image question", function () {
        it("should have correct options set", function () {
            util.loadXML("");
            var microImage = util.addQuestion("MicroImage", "microimage");
            assert.strictEqual(microImage.options.mediaType, 'image/*');
            assert.strictEqual(microImage.options.tagName, 'input');
            assert.strictEqual(microImage.p.appearance, 'micro-image');
        });
    });
});
