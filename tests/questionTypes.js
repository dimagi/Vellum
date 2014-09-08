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
                    keyAttr: 'jr preload key value',
                    dataValue: 'default data value',
                    constraintAttr: '/data/question20 = 2',
                    relevantAttr: '/data/question20',
                    requiredAttr: true,
                    preload: "jr preload",
                    preloadParams: "jr preload param"
                },
                inputs: {
                    calculateAttr: 0
                    //showOKCheckbox: 0
                }
            }, {
                type: 'Trigger',
                nodeId: 'question2',
                attrs: {showOKCheckbox: false},
                inputs: {
                    // TODO add more input counts for each question type
                    calculateAttr: 0,
                    constraintAttr: 1,
                    requiredAttr: 1,
                    relevantAttr: 1
                }
            }, {
                type: 'Trigger',
                nodeId: 'question30',
                attrs: {showOKCheckbox: true}
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
                type: 'Group',
                nodeId: 'question21'
            }, { // get out of the repeat
                type: 'Repeat',
                nodeId: 'question31',
                attrs: {
                    requiredAttr: true,
                    no_add_remove: true, 
                    repeat_count: 2
                }
            }, { // insert before first data node
                type: 'DataBindOnly',
                nodeId: 'question20',
                inputs: {
                    calculateAttr: 1,
                    constraintAttr: 0,
                    requiredAttr: 0,
                }
            }, { // insert before first data node
                type: 'Repeat',
                nodeId: 'question22',
                attrs: {
                    no_add_remove: false
                }
            }, {
                type: 'FieldList',
                nodeId: 'question23'
            }, {
                type: 'Image',
                nodeId: 'question24'
            }, {
                type: 'Audio',
                nodeId: 'question25'
            }, {
                type: 'Video',
                nodeId: 'question26'
            }, {
                type: 'Geopoint',
                nodeId: 'question27'
            }, {
                type: 'Secret',
                nodeId: 'question28'
            }, {
                type: 'AndroidIntent',
                nodeId: 'question7'
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
                            clickQuestion(nodeId);
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
                            var obj = {prevId: (i > 0 ? questionTypes[i - 1].nodeId : null)};
                            addQuestion.call(obj, q.type, q.nodeId, q.attrs);
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
                            .val('question1 hint en').change();
                        $("[name='itext-hin-hint']")
                            .val('question1 hin hint').change();
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

                        clickQuestion("question3", "item1");
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

                        clickQuestion("question7");
                        $("[name='intent-app-id']").val("app_id").change();
                        $("[name='intent-extra'] .fd-kv-key").val('key1').change();
                        $("[name='intent-extra'] .fd-kv-val").val('value1').change();
                        $("[name='intent-response'] .fd-kv-key").val('key2').change();
                        $("[name='intent-response'] .fd-kv-val").val('value2').change();
                        util.assertXmlEqual(
                            call('createXML'),
                            TEST_XML
                                .replace('foo="bar"', '')
                                .replace('spam="eggs"', '')
                                .replace('foo="baz"', '')
                                .replace(/<unrecognized>[\s\S]+<\/unrecognized>/, '')
                                .replace('non-itext label', '')
                                .replace('non-itext hint', '')
                                .replace(/<instance[^>]+?casedb[^>]+?><\/instance>/, '')
                                .replace(/<setvalue[^>]+?>/, ''),
                            {normalize_xmlns: true}
                        );
                        
                        // should have updated question tree
                        clickQuestion("question1 en label");

                        
                        done();
                    }
                }
            });
        });

        describe("can change", function() {
            var changes = [
                ["Text", "Trigger"],
                ["Trigger", "Select"],
                ["Image", "Select"],
                ["Audio", "Select"],
                ["Video", "Select"]
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

            _.each(changes, function (change) {
                var from = change[0], to = change[1];
                it(from + " to " + to, function () {
                    var nodeId = (from + "_to_" + to).toLowerCase();
                    addQuestion(from, nodeId);
                    var mug = call("getMugByPath", "/data/" + nodeId);
                    assert.equal(mug.p.nodeID, nodeId, "got wrong mug before changing type");
                    assert.equal(mug.__className, from, "wrong mug type");
                    call("changeMugType", mug, to);
                    mug = call("getMugByPath", "/data/" + nodeId);
                    assert.equal(mug.__className, to);
                });
            });
        });

        it("question type change survives save + load", function (done) {
            function test() {
                addQuestion("Text", "question");
                var mug = call("getMugByPath", "/data/question");

                call("changeMugType", mug, "Trigger");

                util.saveAndReload(function () {
                    // verify type change
                    mug = call("getMugByPath", "/data/question");
                    assert.equal(mug.__className, "Trigger");
                    done();
                });
            }
            util.init({core: {onReady: test}});
        });
    });
});
