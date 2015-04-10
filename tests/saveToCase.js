define([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/saveToCase',
    'text!static/saveToCase/create_property.xml',
    'text!static/saveToCase/close_property.xml',
], function (
    util,
    chai,
    $,
    _,
    saveToCase,
    CREATE_PROPERTY_XML,
    CLOSE_PROPERTY_XML
) {
    var assert = chai.assert,
        call = util.call;

    describe("The SaveToCase module", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        });

        it("should load and save a create property", function () {
            util.loadXML(CREATE_PROPERTY_XML);
            var create = util.getMug("save_to_case");
            assert.equal(create.p.case_type, "caseType");
            assert.equal(create.p.case_name, "/data/name");
            assert.equal(create.p.use_create, true);
            assert.equal(create.p.owner_id, true);
            util.assertXmlEqual(call("createXML"), CREATE_PROPERTY_XML);
        });

        it("should load and save a close property", function () {
            util.loadXML(CLOSE_PROPERTY_XML);
            var create = util.getMug("save_to_case");
            assert.equal(create.p.use_close, true);
            assert.equal(create.p.close_condition, "1=1");
            util.assertXmlEqual(call("createXML"), CLOSE_PROPERTY_XML);
        });
    });
});
