/*jshint multistr: true */
define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'vellum/parser',
    'text!static/parser/accent-char-in-path.xml',
    'text!static/parser/other_item.xml',
    'text!static/parser/label-without-itext.xml',
    'text!static/parser/missing-bind.xml',
    'text!static/parser/test-xml-1.xml',
    'text!static/parser/test-xml-2.xml',
    'text!static/parser/override.xml',
    'text!static/parser/overridden.xml',
    'text!static/parser/first-time-hashtag.xml',
    'text!static/parser/repeat-with-count-as-question-only-form.xml',
    'text!static/writer/repeat-with-count-as-question.xml',
    'text!static/parser/required.xml',
], function (
    chai,
    $,
    _,
    util,
    parser,
    ACCENT_CHAR_IN_PATH_XML,
    OTHER_ITEM_XML,
    LABEL_WITHOUT_ITEXT_XML,
    MISSING_BIND_XML,
    TEST_XML_1,
    TEST_XML_2,
    OVERRIDE_XML,
    OVERRIDDEN_XML,
    FIRST_TIME_HASHTAG_XML,
    REPEAT_WITH_COUNT_AS_QUESTION_ONLY_FORM_XML,
    REPEAT_WITH_COUNT_AS_QUESTION_XML,
    REQUIRED_XML
) {
    var assert = chai.assert,
        call = util.call,
        plugins = util.options.options.plugins || [],
        pluginsWithItemset = _.union(plugins, ["itemset"]),
        pluginsWithoutItemset = _(plugins).without("itemset");

    describe("The parser", function () {
        it("can detect when the itemset plugin is enabled", function (done) {
            util.init({
                plugins: pluginsWithItemset,
                core: {
                    onReady: function () {
                        assert(this.isPluginEnabled("itemset"),
                               "itemset plugin should be enabled");
                        done();
                    }
                },
            });
        });

        it("can detect when the itemset plugin is disabled", function (done) {
            util.init({
                plugins: pluginsWithoutItemset,
                core: {
                    onReady: function () {
                        assert(!this.isPluginEnabled("itemset"),
                               "itemset plugin should be disabled");
                        done();
                    }
                },
            });
        });

        it("should gracefully handle itemset when the itemset plugin is disabled", function (done) {
            util.init({
                plugins: pluginsWithoutItemset,
                core: {
                    form: TEST_XML_1,
                    onReady: function () {
                        var mug = call("getMugByPath", "/data/state");
                        assert.equal(mug.__className, "Select");
                        var xml = call("createXML"),
                            doc = $($.parseXML(xml));
                        assert.equal(doc.find("instance[id=states]").length, 1, xml);
                        assert.equal(doc.find('itemset').attr('nodeset'),
                                     "instance('states')/state_list/state");
                        done();
                    }
                },
            });
        });

        it("should not drop newlines in calculate conditions", function () {
            util.loadXML(TEST_XML_2);
            var mug = call("getMugByPath", "/data/question1");
            assert.equal(mug.p.calculateAttr, 'concat("Line 1", "\nLine 2")');
        });

        var ignoreWarnings = /Form (JRM namespace|does not have a (Name|(UI)?Version))/;

        it("should load select item without itext", function () {
            util.loadXML(OTHER_ITEM_XML, null, ignoreWarnings);
            var mug = call("getMugByPath", "/ClassroomObservationV3/Q0003"),
                // HACK how to reference items in select?
                item = mug._node_control.children[1].value;
            assert.equal(item.p.nodeID, 'other');
        });

        it("should un-escape HTML entities in select item", function () {
            util.loadXML("");
            util.addQuestion("Select", "select");
            var choice = util.addQuestion("Choice", "choice");
            choice.p.nodeID = 'a&b<c';
            var xml = util.call("createXML");
            assert.include(util.call("createXML"), 'a&amp;b&lt;c');
            util.loadXML(xml);
            var select = util.getMug("select");
            choice = select.form.getChildren(select)[0];
            assert.equal(choice.p.nodeID, "a&b<c");
        });

        it("should load mugs with relative paths and label without itext", function () {
            util.loadXML(LABEL_WITHOUT_ITEXT_XML, null, ignoreWarnings);
            var grp = call("getMugByPath", "/data/group"),
                mug = call("getMugByPath", "/data/group/a"),
                txt = call("getMugByPath", "/data/text");
            assert.equal(grp.p.labelItext.defaultValue(), 'The group');
            assert.equal(mug.p.labelItext.defaultValue(), 'The label');
            assert.equal(txt.p.labelItext.defaultValue(), 'The text');

            // should not raise an error
            util.assertXmlNotEqual(call("createXML"), LABEL_WITHOUT_ITEXT_XML);
        });

        it("should load question without bind element", function () {
            util.loadXML(MISSING_BIND_XML);
        });

        it("should load question with accent char in path", function () {
            util.loadXML(ACCENT_CHAR_IN_PATH_XML);
            var mug = call("getMugByPath", "#form/tèxt");
            assert.match(util.getMessages(mug), /tèxt is not a legal Question ID/);
        });

        it("should set undefined for data value", function () {
            util.loadXML(MISSING_BIND_XML);
            util.clickQuestion("text");
            assert(!$('[name=property-dataValue]').length);
        });

        it("should set required correctly", function() {
            util.loadXML(REQUIRED_XML);

            var q1 = util.getMug("question1");
            assert(q1.p.required = "true()");
            assert(q1.p.requiredCondition = "true()");
            assert(q1.messages.get("requiredAttr").length === 0);
            assert(q1.messages.get("requiredCondition").length === 0);

            var q2 = util.getMug("question2");
            assert(q2.p.required = "#form/question1 = 'hi'");
            assert(q2.p.requiredCondition = "true()");
            assert(q2.messages.get("requiredAttr").length === 0);
            assert(q2.messages.get("requiredCondition").length === 0);

            var q3 = util.getMug("question3");
            assert(q3.p.required = "false()");
            assert(q3.p.requiredCondition = "#form/question2 = 'hello'");
            assert(q3.messages.get("requiredAttr").length === 1);
            assert(q3.messages.get("requiredCondition").length === 1);
        });

        describe("override", function() {
            before(function(done) {
                util.init({
                    plugins: plugins,
                    javaRosa: {langs: ['en']},
                    core: {
                        onReady: done
                    }
                });
            });

            var properties = {
                'relevantAttr': 'question2',
                'constraintAttr': 'question2',
                'calculateAttr': 'question3',
            };

            _.each(properties, function(question, prop) {
                it("should override " + prop + " in question " + question, function() {
                    util.loadXML(OVERRIDE_XML);
                    var mug = util.getMug(question);
                    assert.strictEqual(mug.p[prop], "#form/question1");
                });
            });

            it("should override correctly", function() {
                util.loadXML(OVERRIDE_XML);
                util.assertXmlEqual(util.call('createXML'), OVERRIDDEN_XML);
            });

            it("should generate hashtags correctly on first load", function() {
                util.loadXML(FIRST_TIME_HASHTAG_XML);
                util.assertXmlEqual(util.call('createXML'), OVERRIDDEN_XML);
            });

            describe("with two languages", function () {
                before(function(done) {
                    util.init({
                        plugins: plugins,
                        javaRosa: {langs: ['en', 'hin']},
                        core: {
                            onReady: done
                        }
                    });
                });
                it("should load jr__count as jr:count", function() {
                    util.loadXML(REPEAT_WITH_COUNT_AS_QUESTION_ONLY_FORM_XML);
                    util.assertXmlEqual(util.call('createXML'), REPEAT_WITH_COUNT_AS_QUESTION_XML);
                });
            });
        });
    });
});
