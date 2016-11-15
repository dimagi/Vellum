define([
    'tests/utils',
    'chai',
    'underscore',
    'jquery',
    'vellum/intentManager',
    'vellum/widgets',
    'text!static/intentManager/intent-with-unknown-attrs.xml',
    'text!static/intentManager/intent-with-no-mug.xml',
    'text!static/intentManager/printing-intent.xml',
    'text!static/intentManager/custom-intent.xml'
], function (
    util,
    chai,
    _,
    $,
    intentManager,
    widgets,
    INTENT_WITH_UNKNOWN_ATTRS_XML,
    INTENT_WITH_NO_MUG_XML,
    PRINTING_INTENT_XML,
    CUSTOM_INTENT_XML
) {
    var assert = chai.assert,
        call = util.call,
        templates =  [
            {
                icon: "fa fa-map-marker",
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
                icon: "fa fa-barcode",
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
            {
                icon: "icon-vellum-android-intent",
                name: "Fingerprint Scanner",
                id: "com.simprints.id.REGISTER",
                mime: "text/plain",
            },
        ];

    describe("The intent manager plugin", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done},
                features: {
                    custom_intents: true,
                    templated_intents: true,
                },
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

        it("should assign new document template path on upload", function () {
            util.loadXML("");
            var mug = util.addQuestion("PrintIntent", "print"),
                media = util.getMediaUploader($(".fd-mm-upload-trigger")),
                pathPattern = /jr:\/\/file\/commcare\/text\/print-\w+\.html/;
            media.upload("temp.html");
            var temp = mug.p.docTemplate;
            assert.match(temp, pathPattern);
            media.upload("file.html");
            assert.match(mug.p.docTemplate, pathPattern);
            assert.notEqual(mug.p.docTemplate, temp, "new upload should create a new path");
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
            var vellum, mug;
            before(function(done) {
                util.init({
                    intents: {templates: templates},
                    features: {
                        custom_intents: false,
                    },
                    core: {onReady: function () {
                        vellum = this;
                        mug = util.addQuestion("AndroidIntent", "intent");
                        util.clickQuestion("intent");
                        done();
                    }}
                });
            });

            it("should select the first template by default", function () {
                assert.equal($("[name=property-androidIntentAppId]").val(), "com.richard.lu.areamapper");
            });

            it("should not show validation error on question add", function() {
                assert.strictEqual(mug.spec.androidIntentAppId.validationFunc(mug), 'pass');
            });

            it("should write the mime/type if supplied", function() {
                $("[name=property-androidIntentAppId]").val("com.simprints.id.REGISTER").change();
                var xml = util.call("createXML"),
                    $xml = $($.parseXML(xml)),
                    type = $xml.find('h\\:head, head').children("odkx\\:intent, intent").attr('type');
                assert.strictEqual(type, 'text/plain');
            });

            _.each(templates, function (temp) {
                it("should have " + temp.name + " template", function () {
                    $("[name=property-androidIntentAppId]").val(temp.id).change();
                    assert.strictEqual(mug.p.androidIntentAppId, temp.id);
                });
            });
        });

        describe("custom intents", function() {
            var vellum, mug, customIndex;
            before(function(done) {
                util.init({
                    intents: {templates: templates},
                    features: {
                        templated_intents: true,
                        custom_intents: true,
                    },
                    core: {
                        onReady: function () {
                        vellum = this;
                        mug = util.addQuestion("AndroidIntent", "intent");
                        util.clickQuestion("intent");
                        customIndex = templates.length;
                        done();
                    }}
                });
            });

            it("should always have one custom option", function() {
                var customOption = $('[name=property-androidIntentAppId] option:contains("Custom")');
                assert.lengthOf(customOption, 1, "incorrect number of custom options");
            });

            it("should change text to not readonly when custom is selected", function() {
                $('[name=property-androidIntentAppId]').prop('selectedIndex', 0).change();
                assert($("[name=property-androidIntentAppId-text]").attr('readonly'));
                $('[name=property-androidIntentAppId]').prop('selectedIndex', customIndex).change();
                assert(!$("[name=property-androidIntentAppId-text]").attr('readonly'));
            });

            it("should change text to readonly when custom is not selected", function() {
                $('[name=property-androidIntentAppId]').prop('selectedIndex', customIndex).change();
                assert(!$("[name=property-androidIntentAppId-text]").attr('readonly'));
                $('[name=property-androidIntentAppId]').prop('selectedIndex', 0).change();
                assert($("[name=property-androidIntentAppId-text]").attr('readonly'));
            });

            it("should update the custom option when text is changed", function() {
                $('[name=property-androidIntentAppId]').prop('selectedIndex', customIndex).change();
                $('[name=property-androidIntentAppId-text]').val("fake.intent").change();
                var customOption = $('[name=property-androidIntentAppId]')
                    .find('option')
                    .filter(function () { return $(this).text() === "Custom"; }).val();
                assert.strictEqual("fake.intent", customOption);
            });

            _.each(templates, function (temp) {
                it("should change text box for " + temp.name + " template", function () {
                    $("[name=property-androidIntentAppId]").val(temp.id).change();
                    assert.strictEqual(mug.p.androidIntentAppId, temp.id);
                    assert.strictEqual($("[name=property-androidIntentAppId-text]").val(),
                                       temp.id);
                    assert($("[name=property-androidIntentAppId-text]").attr('readonly'));
                });
            });

            describe("on load", function() {
                before(function() {
                    util.loadXML(CUSTOM_INTENT_XML);
                });

                it("should display the correct intent", function() {
                    util.clickQuestion("not_breath_count");
                    assert.strictEqual($('[name=property-androidIntentAppId-text]').val(),
                                       "android.intent.action.VIEW");
                });
            });
        });

        describe("no intents", function() {
            before(function(done) {
                util.init({
                    intents: {templates: templates},
                    features: {
                        custom_intents: false,
                        templated_intents: false,
                    },
                    core: { onReady: done }
                });
            });

            it("shows error on form load", function() {
                util.loadXML(CUSTOM_INTENT_XML);
                var mug = util.getMug('not_breath_count');
                assert.notStrictEqual(mug.spec.androidIntentAppId.validationFunc(mug), 'pass');
            });
        });
    });
});
