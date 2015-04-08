define([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/saveToCase',
    'text!static/saveToCase/update_property.xml',
], function (
    util,
    chai,
    $,
    _,
    saveToCase,
    UPDATE_PROPERTY_XML
) {
    var assert = chai.assert;

    describe("The SaveToCase module", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        });

        it("should load an update property", function () {
            util.loadXML(UPDATE_PROPERTY_XML);
            var trans = util.getMug("save_to_case");
            assert.equal(trans.p.caseProperty, "name");
            assert.equal(trans.p.action, "update");
            assert.equal(trans.p.source, "/data/name");
        });
    });
});
