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

        describe("with multiple response pairs with matching keys", function () {
            var mug, xml, $xml;
            before(function () {
                util.loadXML("");
                mug = util.addQuestion("AndroidIntent", "intent");
                mug.p.androidIntentResponse = {name: ["/data/node1", "/data/node2"]};
                xml = util.call("createXML");
                $xml = $(xml);
            });

            it("should show all pairs in UI", function () {
                util.clickQuestion("intent");
                assert.equal($(".fd-kv-key[value=name]").length, 2);
                assert.deepEqual(
                    $(".fd-kv-key[value=name]").map(function (i, el) {
                        return $(el).parent().parent().find(".fd-kv-val").val();
                    }).toArray(),
                    ["/data/node1", "/data/node2"]
                );
            });

            it("should write multiple response nodes in XML", function () {
                var responses = $xml.find("response[key=name]");
                assert.equal(responses.length, 2, xml);
                assert.deepEqual(
                    responses.map(function (i, node) {
                        return $(node).attr("ref");
                    }).toArray(),
                    ["/data/node1", "/data/node2"], xml
                );
            });

            it("should load generated XML", function () {
                util.loadXML(xml);
                assert.deepEqual(
                    util.getMug("intent").p.androidIntentResponse,
                    {name: ["/data/node1", "/data/node2"]}
                );
            });
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
                        icon: "icon-map-marker",
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
                        icon: "icon-barcode",
                        name: "Barcode Scanner",
                        id: "com.google.zxing.client.android.SCAN",
                        extra: {},
                        response: {},
                    },
                    {
                        icon: "icon-vellum-android-intent",
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

            it("should not select a template by default", function () {
                assert.equal($("[name=property-androidIntentAppId]").val(), "");
            });

            _.each(templates, function (temp) {
                it("should have " + temp.name + " template", function () {
                    $("a[data-id='" + temp.id + "']").click();
                    assert.equal($("[name=property-androidIntentAppId]").val(), temp.id);
                    var extra = widgets.util.getWidget(
                            $("[name=property-androidIntentExtra]"), vellum),
                        response = widgets.util.getWidget(
                            $("[name=property-androidIntentResponse]"), vellum);
                    assert.deepEqual(extra.getValue(), temp.extra || {});
                    assert.deepEqual(response.getValue(), temp.response || {});
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
