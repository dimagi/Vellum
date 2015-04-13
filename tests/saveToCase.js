define([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/saveToCase',
    'text!static/saveToCase/create_property.xml',
    'text!static/saveToCase/close_property.xml',
    'text!static/saveToCase/update_property.xml',
], function (
    util,
    chai,
    $,
    _,
    saveToCase,
    CREATE_PROPERTY_XML,
    CLOSE_PROPERTY_XML,
    UPDATE_PROPERTY_XML
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
            var create = util.getMug("save_to_case"),
                props = create.p.create_property;
            assert.equal(props.case_type.calculate, "caseType");
            assert.equal(props.case_name.calculate, "/data/name");
            assert.equal(create.p.use_create, true);
            assert.equal(props.owner_id.calculate, '/data/meta/userID');
            assert.equal(create.p.date_modified, '/data/meta/timeEnd');
            assert.equal(create.p.user_id, "/data/meta/userID");
            util.assertXmlEqual(call("createXML"), CREATE_PROPERTY_XML);
        });

        it("should load and save a close property", function () {
            util.loadXML(CLOSE_PROPERTY_XML);
            var create = util.getMug("save_to_case");
            assert.equal(create.p.use_close, true);
            assert.equal(create.p.close_condition, "1=1");
            util.assertXmlEqual(call("createXML"), CLOSE_PROPERTY_XML);
        });

        it("should load and save a update property", function () {
            util.loadXML(UPDATE_PROPERTY_XML);
            var update = util.getMug("save_to_case");
            assert.equal(update.p.use_update, true);
            assert(_.isEqual(update.p.update_property, {
                name: {
                    relevant: "/data/name != ''",
                    calculate: "/data/name"
                }
            }));
            util.assertXmlEqual(call("createXML"), UPDATE_PROPERTY_XML);
        });
    });
});
