import util from "tests/utils";
import chai from "chai";
import $ from "jquery";
import _ from "underscore";
import CREATE_PROPERTY_XML from "static/saveToCase/create_property.xml";
import CLOSE_PROPERTY_XML from "static/saveToCase/close_property.xml";
import UPDATE_PROPERTY_XML from "static/saveToCase/update_property.xml";
import INDEX_PROPERTY_XML from "static/saveToCase/index_property.xml";
import CASE_TYPE_PROPERTY_XML from "static/saveToCase/case_type_property.xml";
import CREATE_2_PROPERTY_XML from "static/saveToCase/create_2_property.xml";
import LEGACY_CASE_TYPE_BIND_XML from "static/saveToCase/legacy_case_type_bind.xml";
import XPATH_CASE_TYPE_XML from "static/saveToCase/xpath_case_type.xml";
import LOGIC_TEST_XML from "static/saveToCase/logic_test.xml";
import TWO_SAME_NAME_XML from "static/saveToCase/two-same-name.xml";

var assert = chai.assert,
    call = util.call;

describe("The SaveToCase module", function() {
    before(function (done) {
        util.init({
            javaRosa: {langs: ['en']},
            core: {onReady: function () { done(); }},
        });
    });

    it("should load and save a create property", function () {
        util.loadXML(CREATE_PROPERTY_XML);
        var create = util.getMug("save_to_case"),
            props = create.p.createProperty;
        assert.equal(create.p.case_type, "caseType");
        assert.equal(props.case_name.calculate, "/data/name");
        assert.equal(create.p.useCreate, true);
        assert.equal(props.owner_id.calculate, '/data/meta/userID');
        assert.equal(create.p.date_modified, '/data/meta/timeEnd');
        assert.equal(create.p.user_id, "/data/meta/userID");
        util.assertXmlEqual(call("createXML"), CREATE_PROPERTY_XML);
    });

    it("should load and save a close property", function () {
        util.loadXML(CLOSE_PROPERTY_XML);
        var close = util.getMug("save_to_case");
        assert.equal(close.p.useClose, true);
        assert.equal(close.p.closeCondition, "1=1");
        assert.equal(close.p.date_modified, '/data/meta/timeEnd');
        assert.equal(close.p.user_id, "/data/meta/userID");
        assert.equal(close.p.case_id, "/data/meta/caseID");
        util.assertXmlEqual(call("createXML"), CLOSE_PROPERTY_XML);
    });

    it("should load and save a update property", function () {
        util.loadXML(UPDATE_PROPERTY_XML);
        var update = util.getMug("save_to_case");
        assert.equal(update.p.useUpdate, true);
        assert(_.isEqual(update.p.updateProperty, {
            name: {
                relevant: "/data/name != ''",
                calculate: "/data/name"
            },
            "dash-dash": {
                calculate: "'-'",
            },
        }));
        assert.equal(update.p.date_modified, '/data/meta/timeEnd');
        assert.equal(update.p.user_id, "/data/meta/userID");
        assert.equal(update.p.case_id, "/data/meta/caseID");
        util.assertXmlEqual(call("createXML"), UPDATE_PROPERTY_XML);
    });

    it("should load and save a index property", function () {
        util.loadXML(INDEX_PROPERTY_XML);
        var index = util.getMug("save_to_case");
        assert.equal(index.p.useIndex, true);
        assert(_.isEqual(index.p.indexProperty, {
            extension: {
                calculate: "/data/meta/caseID",
                case_type: "extension_case",
                relationship: "extension",
            }
        }));
        util.clickQuestion('save_to_case');
        assert.strictEqual(index.spec.indexProperty.validationFunc(index), "pass");
        assert.equal(index.p.date_modified, '/data/meta/timeEnd');
        assert.equal(index.p.user_id, "/data/meta/userID");
        assert.equal(index.p.case_id, "/data/meta/caseID");
        util.assertXmlEqual(call("createXML"), INDEX_PROPERTY_XML);
    });

    it("should load and save the case type property", function () {
        util.loadXML(CASE_TYPE_PROPERTY_XML);
        var create = util.getMug("save_to_case");
        assert.isOk(create, "save_to_case mug should exist");
        util.assertXmlEqual(call("createXML"), CASE_TYPE_PROPERTY_XML);
    });

    it("should only allow custom case types for create actions", function () {
        util.loadXML("");
        util.addQuestion("SaveToCase", "stc_update", {
            case_id: 'a-real-exisitng-case-id',
            case_type: 'household',
            useUpdate: true,
            updateProperty: {
                'name': { 'calculate': '/data/name' },
            }
        });
        util.addQuestion("SaveToCase", "stc_create", {
            case_id: 'uuid()',
            case_type: 'household',
            useCreate: true,
            createProperty: {
                'case_name': { 'calculate': '/data/name' },
            }
        });

        util.clickQuestion("stc_update");
        assert.strictEqual($("[name=property-case_type]").data('select2').options.options.tags, false);

        util.clickQuestion("stc_create");
        assert.strictEqual($("[name=property-case_type]").data('select2').options.options.tags, true);
    });

    it("should support two questions with same name", function () {
        util.loadXML(TWO_SAME_NAME_XML);
        var one = util.getMug("one/save"),
            two = util.getMug("two/save");
        assert.equal(one.p.case_id, 'uuid()', 'one');
        assert.equal(two.p.case_id, 'uuid()', 'two');
    });

    it("should load 2 create setvalues", function () {
        util.loadXML(CREATE_2_PROPERTY_XML);
        var create1 = util.getMug("create1"),
            create2 = util.getMug("create2");
        assert.equal(create1.p.case_id, "1");
        assert.equal(create2.p.case_id, "1");
        util.assertXmlEqual(call("createXML"), CREATE_2_PROPERTY_XML);
    });

    it("should load and save a index property", function () {
        util.loadXML(INDEX_PROPERTY_XML);
        util.clickQuestion("save_to_case");
        $('#fd-question-edit-update').find('.fd-add-property').click();
        util.assertXmlEqual(call("createXML"), INDEX_PROPERTY_XML);
    });

    it("should have @case_id in bind for create when in repeat", function() {
        util.loadXML("");
        util.addQuestion("Repeat", 'repeat');
        var mug = util.addQuestion("SaveToCase", 'case', {
            case_id: 'uuid()',
            user_id: 'uuid()',
            useCreate: true,
            case_type: 'type',
            createProperty: {
                'case_name': 'name'
            }
        });
        assert.deepInclude(mug.options.getBindList(mug), {
            nodeset: mug.absolutePath + "/case/@case_id",
            calculate: 'uuid()'
        });
    });

    it("should remove case_id setvalue when removing create property", function () {
        util.loadXML(CREATE_PROPERTY_XML);
        util.deleteQuestion('/data/save_to_case');
        var deletedXML = call("createXML");
        assert.equal($(deletedXML).find('setvalue').length, 0);
    });

    it("should remove case_id setvalue when removing newly created mug", function () {
        util.loadXML("");
        assert.equal($(call("createXML")).find('setvalue').length, 0);
        var mug = util.addQuestion("SaveToCase", 'case', {
            case_id: 'uuid()',
            user_id: 'uuid()',
            useCreate: true,
        });
        mug.p.case_type = 'type';
        mug.p.createProperty = {
            'case_name': {
                'calculate': 'name',
            },
        };
        assert.equal($(call("createXML")).find('setvalue').length, 1);
        util.deleteQuestion('/data/case');
        assert.equal($(call("createXML")).find('setvalue').length, 0);
    });

    it("should only allow extension and child as relationship", function () {
        util.loadXML("");
        var mug = util.addQuestion("SaveToCase", "mug");
        mug.p.useIndex = true;
        mug.p.indexProperty = {
            "casename": {
                calculate: "/data/question1",
                case_type: "type",
                relationship: "notchildorextension",
            }
        };
        assert.strictEqual(mug.spec.indexProperty.validationFunc(mug), "Relationship must be child or extension");
    });

    it("should only not error on empty extension ref", function () {
        util.loadXML("");
        var mug = util.addQuestion("SaveToCase", "mug");
        mug.p.useIndex = true;
        mug.p.indexProperty = {
            "casename": {
                calculate: "/data/question1",
                case_type: "type",
                relationship: "child",
            },
            "": {
                calculate: "",
                case_type: "",
                relationship: "",
            },

        };
        assert.strictEqual(mug.spec.indexProperty.validationFunc(mug), "pass");
    });

    describe("create/case_type backward compatibility", function () {
        it("should generate create/case_type node and bind from top-section case_type", function () {
            util.loadXML("");
            util.addQuestion("SaveToCase", "stc", {
                case_id: 'uuid()',
                useCreate: true,
                case_type: 'household',
                createProperty: {
                    'case_name': { 'calculate': 'name' },
                }
            });
            var xml = call("createXML"),
                $xml = $(xml);
            assert.equal($xml.find('stc').xmlAttr('vellum:case_type'), 'household');
            assert.equal($xml.find('create case_type').length, 1);
            assert.equal(
                $xml.find('bind[nodeset="/data/stc/case/create/case_type"]').attr('calculate'),
                "'household'"
            );
        });

        it("should not generate create/case_type node when case_type is empty", function () {
            util.loadXML("");
            util.addQuestion("SaveToCase", "stc", {
                case_id: 'uuid()',
                useCreate: true,
                createProperty: {
                    'case_name': { 'calculate': 'name' },
                }
            });
            var xml = call("createXML"),
                $xml = $(xml);
            assert.equal($xml.find('create case_type').length, 0);
            assert.equal(
                $xml.find('bind[nodeset="/data/stc/case/create/case_type"]').length,
                0
            );
        });

        it("should not generate create/case_type for non-create actions", function () {
            util.loadXML("");
            util.addQuestion("SaveToCase", "stc", {
                case_id: 'a-real-exisitng-case-id',
                case_type: 'household',
                useUpdate: true,
                updateProperty: {
                    'name': { 'calculate': '/data/name' },
                }
            });
            var xml = call("createXML"),
                $xml = $(xml);
            assert.equal($xml.find('stc').xmlAttr('vellum:case_type'), 'household');
            assert.equal($xml.find('create').length, 0);
            assert.equal(
                $xml.find('bind[nodeset="/data/stc/case/create/case_type"]').length,
                0
            );
        });

        it("should use non-empty create/case_type bind when vellum:case_type is empty", function () {
            util.loadXML(LEGACY_CASE_TYPE_BIND_XML);
            var mug = util.getMug("question1");
            assert.equal(mug.p.case_type, 'legacy_case_type_input');
        });

        it("should show parsed create/case_type bind value in the Case Type widget", function () {
            util.loadXML(LEGACY_CASE_TYPE_BIND_XML);
            util.clickQuestion("question1");
            assert.equal($("[name=property-case_type]").val(), "legacy_case_type_input");
        });

        it("should prefer create/case_type bind when it differs from vellum:case_type", function () {
            util.loadXML(LEGACY_CASE_TYPE_BIND_XML.replace('vellum:case_type=""', 'vellum:case_type="top_section_case_type"'));
            var mug = util.getMug("question1");
            assert.equal(mug.p.case_type, 'legacy_case_type_input');
        });

        it("should resolve xpath case_type reference to a literal", function () {
            util.loadXML(XPATH_CASE_TYPE_XML);
            var mug = util.getMug("question1");
            assert.equal(mug.p.case_type, "household");
            assert.equal(mug.p._caseTypeCalc, "/data/case_type_val");
            assert.equal(
                mug.p.createProperty.case_type,
                undefined
            );
        });

        it("should preserve xpath reference in generated bind", function () {
            util.loadXML(XPATH_CASE_TYPE_XML);
            var xml = call("createXML"),
                $xml = $(xml);
            assert.equal(
                $xml.find('bind[nodeset="/data/question1/case/create/case_type"]').attr('calculate'),
                '/data/case_type_val'
            );
        });

        it("should drop bare words without quotes as invalid xpath", function () {
            util.loadXML(XPATH_CASE_TYPE_XML.replace(
                "calculate=\"/data/case_type_val\"",
                "calculate=\"worker_role\""
            ));
            var mug = util.getMug("question1");
            assert.notOk(mug.p.case_type);
            assert.notOk(mug.p._caseTypeCalc);
        });

        it("should parse double-quoted case_type literal", function () {
            util.loadXML(
                LEGACY_CASE_TYPE_BIND_XML
                    .replace(
                        "calculate=\"'legacy_case_type_input'\"",
                        'calculate="&quot;legacy_case_type_input&quot;"'
                    )
            );
            var mug = util.getMug("question1");
            assert.equal(mug.p.case_type, 'legacy_case_type_input');
        });

        it("should not let empty create/case_type bind override vellum:case_type", function () {
            util.loadXML(
                LEGACY_CASE_TYPE_BIND_XML
                    .replace('vellum:case_type=""', 'vellum:case_type="top_section_case_type"')
                    .replace(
                        'calculate="\'legacy_case_type_input\'"',
                        'calculate=""'
                    )
            );
            var mug = util.getMug("question1");
            assert.equal(mug.p.case_type, 'top_section_case_type');
        });
    });
    describe("case_id validation", function () {
        var mug;
        beforeEach(function () {
            util.loadXML("");
            mug = util.addQuestion("SaveToCase", "mug");
        });

        it("should accept absolute path references", function () {
            mug.p.case_id = "/data/some_question";
            assert.strictEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });

        it("should accept current() relative paths", function () {
            mug.p.case_id = "current()/../../../patient_case_id";
            assert.strictEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });

        it("should accept instance() references", function () {
            mug.p.case_id = "instance('commcaresession')/session/data/case_id_new_person_0";
            assert.strictEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });

        it("should accept coalesce with uuid()", function () {
            mug.p.case_id = "coalesce(/data/existing_case_id, uuid())";
            assert.strictEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });

        it("should accept if() expressions", function () {
            mug.p.case_id = "if(/data/has_case = 'yes', /data/case_id, uuid())";
            assert.strictEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });

        it("should accept casedb lookup", function () {
            mug.p.case_id = "instance('casedb')/casedb/case[@case_type = 'patient']/@case_id";
            assert.strictEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });

        it("should reject plain text numbers", function () {
            mug.p.case_id = "1";
            assert.notEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });

        it("should reject plain text strings", function () {
            mug.p.case_id = "bob jones";
            assert.notEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });

        it("should reject plain text with dashes", function () {
            mug.p.case_id = "some-case-id";
            assert.notEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });

        it("should reject plain text with quotes", function () {
            mug.p.case_id = "''";
            assert.notEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });

        it("should reject function calls without arguments", function () {
            mug.p.case_id = "foo()";
            assert.notEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });

        it("should reject uuid with arguments", function () {
            mug.p.case_id = "uuid(36)";
            assert.notEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });

        it("should reject empty value", function () {
            mug.p.case_id = "";
            assert.notEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });

        it("should reject uuid() without create action", function () {
            mug.p.useCreate = false;
            mug.p.useUpdate = true;
            mug.p.case_id = "uuid()";
            assert.strictEqual(mug.spec.case_id.validationFunc(mug),
                "Case ID cannot be uuid() without a Create action. It must reference an existing case.");
        });

        it("should accept uuid() with create action", function () {
            mug.p.useCreate = true;
            mug.p.case_id = "uuid()";
            assert.strictEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });

        it("should accept path reference without create action", function () {
            mug.p.useCreate = false;
            mug.p.useUpdate = true;
            mug.p.case_id = "/data/meta/caseID";
            assert.strictEqual(mug.spec.case_id.validationFunc(mug), "pass");
        });
    });

    it("should provide case references to the logic manager", function () {
        var form = util.loadXML(LOGIC_TEST_XML),
            manager = form._logicManager;
        assert.deepEqual(manager.caseReferences(), {
            load: {},
            save: {
                "/data/group/save_to_case_in_group": {
                    "case_type": "child",
                    "close": false,
                    "create": false,
                    "properties": [
                        "p1",
                        "p3"
                    ]
                },
                "/data/save_to_case_create": {
                    "case_type": "mother",
                    "close": false,
                    "create": true,
                    "properties": [
                        "case_name",
                        "p1",
                        "p2",
                        "case_type",
                    ]
                },
                "/data/save_to_case_close": {
                    "case_type": "close_case",
                    "close": true,
                    "create": false,
                    "properties": []
                }
            }
        });
    });
});
