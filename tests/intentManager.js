define([
    'tests/utils',
    'chai',
    'underscore',
    'jquery',
    'vellum/intentManager',
    'vellum/widgets',
    'text!static/intentManager/intent-with-unknown-attrs.xml',
    'text!static/intentManager/intent-with-no-mug.xml',
    'text!static/intentManager/printing-intent.xml'
], function (
    util,
    chai,
    _,
    $,
    intentManager,
    widgets,
    INTENT_WITH_UNKNOWN_ATTRS_XML,
    INTENT_WITH_NO_MUG_XML,
    PRINTING_INTENT_XML
) {
    var assert = chai.assert,
        call = util.call;

    describe("The intent manager plugin", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        });

        it("should preserve unknown attributes of intent tag", function () {
            util.loadXML(INTENT_WITH_UNKNOWN_ATTRS_XML);
            util.assertXmlEqual(util.call("createXML"), INTENT_WITH_UNKNOWN_ATTRS_XML);
        });

        it("should preserve intent tags with no mug", function () {
            util.loadXML(INTENT_WITH_NO_MUG_XML);
            util.assertXmlEqual(util.call("createXML"), INTENT_WITH_NO_MUG_XML);
        });

        describe("printing mug", function() {
            before(function() {
                util.loadXML(PRINTING_INTENT_XML);
            });

            it("should parse as a printing question", function() {
                assert.strictEqual(util.getMug('/data/print_data').__className, 'PrintIntent');
            });

            it("should write the same as parse", function() {
                util.assertXmlEqual(call('createXML'), PRINTING_INTENT_XML);
            });

            it("should correctly parse filename", function() {
                assert.strictEqual(util.getMug('/data/print_data').p.docTemplate,
                                   'jr://file/commcare/doc/data/print_data.doc');
            });
        });

        describe("template selector", function() {
            var vellum,
                mug,
                templates =  [
                    {
                        name: "Area Mapper",
                        id: "com.richard.lu.areamapper",
                        extra: {ext: "value"},
                        response: {
                            r1: "x",
                            r2: "y",
                            r3: "z",
                            r4: "",
                        },
                    },
                    {
                        name: "Barcode Scanner",
                        id: "com.google.zxing.client.android.SCAN",
                        extra: {},
                        response: {},
                    },
                    {
                        name: "Breath Counter",
                        id: "org.commcare.respiratory.BREATHCOUNT",
                    },
                ];
            before(function(done) {
                util.init({
                    intents: {templates: templates},
                    core: {onReady: function () {
                        vellum = this;
                        mug = util.addQuestion("AndroidIntent", "intent");
                        util.clickQuestion("intent");
                        done();
                    }}
                });
            });

            it("should select empty template by default", function () {
                assert.equal($("[name=property-androidIntentAppId]").val(), "");
                assert.equal($("[name=property-androidIntentAppId-template]").val(), "");
            });

            _.each(templates, function (temp) {
                it("should have " + temp.name + " template", function () {
                    $("[name=property-androidIntentAppId-template]").val(temp.id).change();
                    assert.equal($("[name=property-androidIntentAppId]").val(), temp.id);
                    if (temp.extra) {
                        var extra = widgets.util.getWidget(
                                $("[name=property-androidIntentExtra]"), vellum);
                        assert.deepEqual(extra.getValue(), temp.extra);
                    }
                    if (temp.response) {
                        var response = widgets.util.getWidget(
                                $("[name=property-androidIntentResponse]"), vellum);
                        assert.deepEqual(response.getValue(), temp.response);
                    }
                });
            });
        });

        describe("field parsing", function() {
            var tests = [
                ['{{ } }}', {}],
                ['{{field1}}', { field1: 'field1' }],
                ['{{ field1 }}', { field1: 'field1' }],
                ['field1 }}', {}],
                ['{{ field1', {}],
                ['field1', {}],
                ['{{ field1 }} {{ field2 }}', {
                    field1: 'field1',
                    field2: 'field2',
                }],
                ['{{ field1 }}\n{{ field2 }}', {
                    field1: 'field1',
                    field2: 'field2',
                }],
                ['{{ field1 }}\n{{ field2 }} {{ field3 }}', {
                    field1: 'field1',
                    field2: 'field2',
                    field3: 'field3',
                }],
            ];

            _.each(tests, function(testcase) {
                it(testcase[0] + " should be parsed as " + JSON.stringify(testcase[1]), function() {
                    assert.deepEqual(intentManager.test.parseFields(testcase[0]), testcase[1]);
                });
            });
        });
    });
});
