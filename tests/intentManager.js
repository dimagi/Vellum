define([
    'tests/utils',
    'chai',
    'underscore',
    'jquery',
    'text!static/intentManager/intent-with-unknown-attrs.xml'
], function (
    util,
    chai,
    _,
    $,
    INTENT_WITH_UNKNOWN_ATTRS_XML
) {
    describe("The intent manager plugin", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done},
                features: {'experimental_ui': false},
            });
        });

        it("should preserve unknown attributes of intent tag", function () {
            util.loadXML(INTENT_WITH_UNKNOWN_ATTRS_XML);
            util.assertXmlEqual(util.call("createXML"), INTENT_WITH_UNKNOWN_ATTRS_XML);
        });
    });
});
