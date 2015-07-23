define([
    'tests/utils',
    'chai',
    'underscore',
    'jquery',
    'text!static/intentManager/intent-with-unknown-attrs.xml',
    'text!static/intentManager/intent-with-no-mug.xml',
    'text!static/intentManager/printing-intent.xml'
], function (
    util,
    chai,
    _,
    $,
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
    });
});
