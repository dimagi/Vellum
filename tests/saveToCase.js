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
        var create = util.getMug("save_to_case");
        assert.equal(create.p.case_type, "caseType");
        assert.equal(create.p.caseName, "/data/name");
        assert.equal(create.p.useCreate, true);
        assert.equal(create.p.ownerId, '/data/meta/userID');
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
        util.addQuestion("SaveToCase", "stc_update", {useUpdate: true});
        util.addQuestion("SaveToCase", "stc_create", {useCreate: true});

        util.clickQuestion("stc_update");
        assert.strictEqual($("[name=property-case_type]").data('select2').options.options.tags, false);

        util.clickQuestion("stc_create");
        assert.strictEqual($("[name=property-case_type]").data('select2').options.options.tags, true);
    });

    it("should not deselect Create when selecting Close or Index", function () {
        util.loadXML("");
        util.addQuestion("SaveToCase", "stc", {
            case_id: 'uuid()',
            case_type: 'my_custom_type',
            useCreate: true,
            createProperty: {
                'case_name': { 'calculate': '/data/name' },
            }
        });
        util.clickQuestion("stc");
        var mug = util.getMug("stc");

        // Verify initial state
        assert.equal(mug.p.useCreate, true);
        assert.equal(mug.p.case_type, 'my_custom_type');

        // Click Close chip
        $(".fd-chip[data-slug='close']").trigger('click');
        assert.equal(mug.p.useCreate, true, "Create should still be active after clicking Close");
        assert.equal(mug.p.useClose, true, "Close should be active");
        assert.equal(mug.p.case_type, 'my_custom_type', "case_type should be preserved after clicking Close");

        // Click Index chip
        $(".fd-chip[data-slug='index']").trigger('click');
        assert.equal(mug.p.useCreate, true, "Create should still be active after clicking Index");
        assert.equal(mug.p.useIndex, true, "Index should be active");
        assert.equal(mug.p.case_type, 'my_custom_type', "case_type should be preserved after clicking Index");
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
        assert.notEqual(mug.spec.indexProperty.validationFunc(mug), "pass");
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

        it("should show dropdown when create/case_type bind is a literal", function () {
            util.loadXML(LEGACY_CASE_TYPE_BIND_XML);
            var mug = util.getMug("question1");
            assert.equal(mug.p.case_type, 'legacy_case_type_input');
            assert.notOk(mug.p.caseTypeXPath);
            util.clickQuestion("question1");
            var $dropdown = $("[name=property-case_type]");
            assert.equal($dropdown.val(), "legacy_case_type_input");
            assert.ok($dropdown.closest(".widget").is(":visible"), "dropdown row is visible");
            assert.notOk(
                $("[name=property-caseTypeXPath]").closest(".widget").is(":visible"),
                "xpath case type row is hidden when literal is used"
            );
        });

        it("should prefer create/case_type bind over vellum:case_type for literals", function () {
            util.loadXML(LEGACY_CASE_TYPE_BIND_XML.replace('vellum:case_type=""', 'vellum:case_type="top_section_case_type"'));
            var mug = util.getMug("question1");
            assert.equal(mug.p.case_type, 'legacy_case_type_input');
        });

        it("should show xpath field when create/case_type bind is an xpath", function () {
            util.loadXML(XPATH_CASE_TYPE_XML);
            var mug = util.getMug("question1");
            assert.notOk(mug.p.case_type);
            assert.equal(mug.p.caseTypeXPath, "/data/case_type_val");
            util.clickQuestion("question1");
            var $xpath = $("[name=property-caseTypeXPath]");
            assert.ok($xpath.closest(".widget").is(":visible"), "xpath row is visible");
            assert.notOk(
                $("[name=property-case_type]").closest(".widget").is(":visible"),
                "dropdown row is hidden when xpath is used"
            );
            var xpathWidget = util.getWidget("property-caseTypeXPath");
            assert.equal(
                xpathWidget.getValue(),
                mug.form.normalizeHashtag(mug.p.caseTypeXPath),
                "xpath field should show create/case_type bind value"
            );
        });

        it("should show xpath field for bare words so user can fix them", function () {
            util.loadXML(XPATH_CASE_TYPE_XML.replace(
                "calculate=\"/data/case_type_val\"",
                "calculate=\"worker_role\""
            ));
            var mug = util.getMug("question1");
            assert.notOk(mug.p.case_type);
            assert.equal(mug.p.caseTypeXPath, "worker_role");
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

        it("should preserve values when switching between dropdown and xpath modes", function () {
            util.loadXML("");
            util.addQuestion("SaveToCase", "question1", {
                case_id: 'uuid()',
                useCreate: true,
                case_type: 'household',
            });
            util.clickQuestion("question1");
            var $dropdownRow = $("[name=property-case_type]").closest(".widget"),
                $xpathRow = $("[name=property-caseTypeXPath]").closest(".widget"),
                mug = util.getMug("question1");

            // Start in dropdown mode
            assert.equal(mug.p.case_type, 'household');
            assert.ok($dropdownRow.is(":visible"), "dropdown visible");
            assert.notOk($xpathRow.is(":visible"), "xpath hidden");

            // Click "Use an xpath expression" to switch to xpath mode
            $dropdownRow.find('.controls > a').trigger('click');
            assert.notOk(mug.p.case_type, "case_type cleared");
            assert.notOk($dropdownRow.is(":visible"), "dropdown hidden");
            assert.ok($xpathRow.is(":visible"), "xpath visible");

            // Enter a value in xpath field
            var xpathWidget = $xpathRow.data('vellum_widget');
            xpathWidget.setValue('/data/dynamic_type');
            xpathWidget.handleChange();
            assert.equal(mug.p.caseTypeXPath, '/data/dynamic_type');

            // Click "Select case type from a list" to switch back to dropdown and verify dropdown is restored
            $xpathRow.find('.controls > a').trigger('click');
            assert.equal(mug.p.case_type, 'household', "dropdown value restored");
            assert.notOk(mug.p.caseTypeXPath, "xpath cleared");
            assert.ok($dropdownRow.is(":visible"), "dropdown visible again");
            assert.notOk($xpathRow.is(":visible"), "xpath hidden again");

            // Click "Use an xpath expression" again to verify xpath is restored
            $dropdownRow.find('.controls > a').trigger('click');
            assert.equal(mug.p.caseTypeXPath, '/data/dynamic_type', "xpath value restored");
            assert.notOk(mug.p.case_type, "case_type cleared again");
        });

        it("should switch to dropdown when Create is deselected while in xpath mode", function () {
            util.loadXML(XPATH_CASE_TYPE_XML);
            util.clickQuestion("question1");
            var $dropdownRow = $("[name=property-case_type]").closest(".widget"),
                $xpathRow = $("[name=property-caseTypeXPath]").closest(".widget"),
                mug = util.getMug("question1");

            // Starts in xpath mode
            assert.ok(mug.p.caseTypeXPath);
            assert.ok($xpathRow.is(":visible"), "xpath visible");
            assert.notOk($dropdownRow.is(":visible"), "dropdown hidden");

            // Deselect Create
            mug.p.useCreate = false;
            assert.notOk(mug.p.caseTypeXPath, "xpath cleared");
            assert.ok($dropdownRow.is(":visible"), "dropdown visible after deselecting Create");
            assert.notOk($xpathRow.is(":visible"), "xpath hidden after deselecting Create");
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

        it("should clear uuid() warning when useCreate is set after case_id", function () {
            mug.p.case_id = "uuid()";
            assert.deepEqual(mug.messages.get("case_id"),
                ["Case ID cannot be uuid() without a Create action. It must reference an existing case."]);
            mug.p.useCreate = true;
            assert.deepEqual(mug.messages.get("case_id"), []);
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
                        "p1",
                        "p2",
                        "case_type",
                        "case_name",
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

    describe("dedicated create fields", function () {
        it("should validate caseName is required for create", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug");
            mug.p.useCreate = true;
            assert.notEqual(mug.spec.caseName.validationFunc(mug), "pass");
            mug.p.caseName = "/data/name";
            assert.strictEqual(mug.spec.caseName.validationFunc(mug), "pass");
        });

        it("should reject reserved properties in createProperty", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug");
            mug.p.useCreate = true;
            mug.p.caseName = "/data/name";
            mug.p.createProperty = {
                case_name: { calculate: "/data/name" },
            };
            assert.notEqual(mug.spec.createProperty.validationFunc(mug), "pass");
        });

        it("should emit extra create properties under <update>", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "stc", {
                case_id: 'uuid()',
                useCreate: true,
                case_type: 'household',
                caseName: '/data/name',
            });
            mug.p.createProperty = {
                'favorite_color': { calculate: "'blue'" },
            };
            var xml = call("createXML"),
                $xml = $(xml);
            assert.equal($xml.find('create case_name').length, 1);
            assert.equal($xml.find('update favorite_color').length, 1);
            assert.equal($xml.find('create favorite_color').length, 0);
        });

        it("should merge update into createProperty on parse when both create property and update property exist", function () {
            util.loadXML(LOGIC_TEST_XML);
            var mug = util.getMug("save_to_case_create");
            assert.equal(mug.p.caseName, "'name'");
            assert.equal(mug.p.useCreate, true);
            assert.equal(mug.p.useUpdate, false);
            assert.deepEqual(_.without(_.keys(mug.p.createProperty), ""), ["p1", "p2"]);
        });

        it("createXML writes /case and owner_id relevants when both conditions match", function () {
            util.loadXML("");
            util.addQuestion("SaveToCase", "stc", {
                case_id: 'uuid()',
                useCreate: true,
                case_type: 'household',
                caseName: '/data/name',
                ownerId: '/data/loc',
                ownerIdCondition: "/data/set_owner = 'yes'",
                openCaseCondition: "/data/set_owner = 'yes'",
            });
            var xml = call("createXML"),
                $xml = $(xml);
            assert.equal(
                $xml.find('bind[nodeset="/data/stc/case"]').attr('relevant'),
                "/data/set_owner = 'yes'"
            );
            assert.equal(
                $xml.find('bind[nodeset="/data/stc/case/create/owner_id"]').attr('relevant'),
                "/data/set_owner = 'yes'"
            );
        });
    });

    describe("create section backward compatibility", function () {
        function withRelevants(caseTypeRel, caseNameRel, ownerIdRel) {
            var xml = CREATE_PROPERTY_XML;
            if (caseTypeRel) {
                xml = xml.replace(
                    'nodeset="/data/save_to_case/case/create/case_type"',
                    'nodeset="/data/save_to_case/case/create/case_type" relevant="' + caseTypeRel + '"'
                );
            }
            if (caseNameRel) {
                xml = xml.replace(
                    'nodeset="/data/save_to_case/case/create/case_name"',
                    'nodeset="/data/save_to_case/case/create/case_name" relevant="' + caseNameRel + '"'
                );
            }
            if (ownerIdRel) {
                xml = xml.replace(
                    'nodeset="/data/save_to_case/case/create/owner_id"',
                    'nodeset="/data/save_to_case/case/create/owner_id" relevant="' + ownerIdRel + '"'
                );
            }
            return xml;
        }

        it("should have no openCaseCondition when no per-property relevant exists", function () {
            util.loadXML(CREATE_PROPERTY_XML);
            var mug = util.getMug("save_to_case");
            assert.notOk(mug.p.openCaseCondition);
            assert.notOk(mug.p.ownerIdCondition);
        });

        it("should promote all-same relevant to openCaseCondition and ownerIdCondition", function () {
            var cond = "/data/name != ''";
            util.loadXML(withRelevants(cond, cond, cond));
            var mug = util.getMug("save_to_case");
            assert.equal(mug.p.openCaseCondition, cond);
            assert.equal(mug.p.ownerIdCondition, cond);
        });

        it("should keep owner_id-only relevant as ownerIdCondition", function () {
            util.loadXML(withRelevants(null, null, "/data/name != ''"));
            var mug = util.getMug("save_to_case");
            assert.notOk(mug.p.openCaseCondition);
            assert.equal(mug.p.ownerIdCondition, "/data/name != ''");
        });

        it("should promote case_name-only relevant to openCaseCondition", function () {
            util.loadXML(withRelevants(null, "/data/name != ''", null));
            var mug = util.getMug("save_to_case");
            assert.equal(mug.p.openCaseCondition, "/data/name != ''");
            assert.notOk(mug.p.ownerIdCondition);
        });

        it("should combine different case_name and case_type relevants with 'and'", function () {
            util.loadXML(withRelevants("1 = 1", "/data/name != ''", null));
            var mug = util.getMug("save_to_case");
            assert.include(mug.p.openCaseCondition, "1 = 1");
            assert.include(mug.p.openCaseCondition, "/data/name != ''");
            assert.include(mug.p.openCaseCondition, " and ");
        });

        it("should promote case_type relevant and keep different owner_id as ownerIdCondition", function () {
            util.loadXML(withRelevants("1 = 1", null, "/data/name != ''"));
            var mug = util.getMug("save_to_case");
            assert.equal(mug.p.openCaseCondition, "1 = 1");
            assert.equal(mug.p.ownerIdCondition, "/data/name != ''");
        });

        it("should promote shared case_name+owner_id relevant to both conditions", function () {
            var cond = "/data/name != ''";
            util.loadXML(withRelevants(null, cond, cond));
            var mug = util.getMug("save_to_case");
            assert.equal(mug.p.openCaseCondition, cond);
            assert.equal(mug.p.ownerIdCondition, cond);
        });

        it("should output case-level relevant instead of per-property relevant after loading legacy form", function () {
            var cond = "/data/name != ''";
            util.loadXML(withRelevants(cond, cond, cond));
            var xml = call("createXML"),
                $xml = $(xml);
            assert.equal(
                $xml.find('bind[nodeset="/data/save_to_case/case"]').attr('relevant'),
                cond
            );
            assert.notOk(
                $xml.find('bind[nodeset="/data/save_to_case/case/create/case_type"]').attr('relevant')
            );
            assert.notOk(
                $xml.find('bind[nodeset="/data/save_to_case/case/create/case_name"]').attr('relevant')
            );
            assert.equal(
                $xml.find('bind[nodeset="/data/save_to_case/case/create/owner_id"]').attr('relevant'),
                cond
            );
        });
    });

    describe("card list with a blank identifier", function () {
        it("should walk xpaths in cards whose identifier is blank", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug");
            mug.p.useUpdate = true;
            mug.p.updateProperty = {
                "name": { calculate: "/data/foo", relevant: "" },
                "": { calculate: "/data/bar", relevant: "" },
            };
            var visited = [];
            mug.spec.updateProperty.mapLogicExpressions(mug, function (expr) {
                visited.push(expr);
                return [];
            });
            visited.sort();
            assert.deepEqual(visited, ["/data/bar", "/data/foo"]);
        });

        it("should rewrite xpaths in cards whose identifier is blank", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug");
            mug.p.useUpdate = true;
            mug.p.updateProperty = {
                "name": { calculate: "/data/foo" },
                "": { calculate: "/data/foo", relevant: "" },
            };
            mug.spec.updateProperty.updateLogicExpressions(mug, function (expr) {
                return expr === "/data/foo" ? "/data/bar" : expr;
            });
            assert.equal(mug.p.updateProperty.name.calculate, "/data/bar");
            assert.equal(mug.p.updateProperty[""].calculate, "/data/bar");
        });

        it("should omit cards whose identifier is blank from saved XML", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug", {
                case_id: "/data/meta/caseID",
                useUpdate: true,
            });
            mug.p.updateProperty = {
                "name": { calculate: "/data/name" },
                "": { calculate: "/data/name", relevant: "" },
            };
            var $xml = $(call("createXML"));
            var $updateChildren = $xml.find('update').children();
            assert.equal($updateChildren.length, 1, "expected exactly one card after Save");
            assert.equal($updateChildren.first().prop('tagName').toLowerCase(), 'name');
        });

        it("should walk identifier-blank card xpaths across create/update/index", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug");
            mug.p.useCreate = true;
            mug.p.useUpdate = true;
            mug.p.useIndex = true;
            mug.p.createProperty = { "": { calculate: "/data/a" } };
            mug.p.updateProperty = { "": { calculate: "/data/b" } };
            mug.p.indexProperty = { "": { calculate: "/data/c" } };

            function collect(spec, prop) {
                var visited = [];
                spec[prop].mapLogicExpressions(mug, function (expr) {
                    visited.push(expr);
                    return [];
                });
                return visited;
            }
            assert.deepEqual(collect(mug.spec, "createProperty"), ["/data/a"]);
            assert.deepEqual(collect(mug.spec, "updateProperty"), ["/data/b"]);
            assert.deepEqual(collect(mug.spec, "indexProperty"), ["/data/c"]);
        });
    });

    describe("card list DOM interactions", function () {

        it("should render one card per updateProperty entry", function () {
            util.loadXML(UPDATE_PROPERTY_XML);
            util.clickQuestion("save_to_case");
            var $cards = $(".fd-update-property.fd-card");
            assert.equal($cards.length, 2, "two rows → two cards");
            var names = $cards.find(".fd-update-property-name")
                .map(function () { return $(this).val(); }).get().sort();
            assert.deepEqual(names, ["dash-dash", "name"]);
        });

        it("should add a blank card when the Add button is clicked", function () {
            util.loadXML("");
            util.addQuestion("SaveToCase", "mug", {
                case_id: "/data/meta/caseID",
                useUpdate: true,
            });
            util.clickQuestion("mug");
            var $list = $(".fd-update-property").filter(".fd-card");
            assert.equal($list.length, 0, "expected no cards before Add is clicked");

            // Click the Add button inside the Update section.
            var $updateSection = $("[name='property-updateProperty']");
            $updateSection.find(".fd-add-property").trigger("click");

            $list = $(".fd-update-property").filter(".fd-card");
            assert.equal($list.length, 1, "expected exactly one card after Add");
            assert.equal(
                $list.find(".fd-update-property-name").val(), "",
                "new card identifier field should be empty"
            );
        });

        it("should remove a card when its Remove button is clicked", function () {
            util.loadXML(UPDATE_PROPERTY_XML);
            var mug = util.getMug("save_to_case");
            util.clickQuestion("save_to_case");
            var $cards = $(".fd-update-property.fd-card");
            assert.equal($cards.length, 2, "expected exactly two cards before Remove");

            // Remove the "name" card.
            $cards.filter(function () {
                return $(this).find(".fd-update-property-name").val() === "name";
            }).find(".fd-remove-property").trigger("click");

            $cards = $(".fd-update-property.fd-card");
            assert.equal($cards.length, 1, "expected exactly one card after Remove");
            assert.notProperty(mug.p.updateProperty, "name",
                "expected mug.p.updateProperty to no longer include the removed card");
            assert.property(mug.p.updateProperty, "dash-dash",
                "expected mug.p.updateProperty to still include the other card");
        });

        it("should propagate typed values into mug.p on change", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug", {
                case_id: "/data/meta/caseID",
                useUpdate: true,
            });
            util.clickQuestion("mug");
            $("[name='property-updateProperty']").find(".fd-add-property").trigger("click");

            var $card = $(".fd-update-property.fd-card").first();
            $card.find(".fd-update-property-name").val("age").trigger("change");

            assert.property(
                mug.p.updateProperty,
                "age",
                "expected mug.p.updateProperty to include typed value"
            );
        });
    });

    describe("inline validators", function () {
        // Suite defaults to rich_text (tests/options.js); nested card XPath uses
        // richText.editor — cardList listens on native `input` (see editor.on).
        function commitNestedXPathExpression($field, text) {
            $field.data("editorWrapper").setValue(text);
            $field[0].dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        }

        it("should flag empty required field as Required after touched", function () {
            util.loadXML("");
            util.addQuestion("SaveToCase", "mug", {
                case_id: "/data/meta/caseID",
                useUpdate: true,
            });
            util.clickQuestion("mug");
            $("[name='property-updateProperty']").find(".fd-add-property").trigger("click");

            var $card = $(".fd-update-property.fd-card").first();
            var $name = $card.find(".fd-update-property-name");
            assert.notOk(
                $name.closest(".form-group").hasClass("has-error"),
                "empty required field should not show .has-error if untouched"
            );

            $name.trigger("change");
            assert.ok(
                $name.closest(".form-group").hasClass("has-error"),
                "empty required field should show .has-error once touched"
            );
            assert.match(
                $name.closest(".form-group").find(".fd-field-error").text(),
                /Required/i
            );
        });

        it("should flag invalid XPath syntax", function () {
            util.loadXML("");
            util.addQuestion("SaveToCase", "mug", {
                case_id: "/data/meta/caseID",
                useUpdate: true,
            });
            util.clickQuestion("mug");
            $("[name='property-updateProperty']").find(".fd-add-property").trigger("click");

            var $card = $(".fd-update-property.fd-card").first();
            var $calculate = $card.find(".fd-update-property-calculate");
            commitNestedXPathExpression($calculate, "this is not valid xpath!!!");
            assert.ok(
                $calculate.closest(".form-group").hasClass("has-error"),
                "invalid xpath syntax should produce .has-error"
            );
            assert.match(
                $calculate.closest(".form-group").find(".fd-field-error").text(),
                /Invalid XPath/i
            );
        });

        it("should surface inline error on saved bad data on first render", function () {
            util.loadXML("");
            util.addQuestion("SaveToCase", "mug", {
                case_id: "/data/meta/caseID",
                useUpdate: true,
                updateProperty: {
                    "name": { calculate: "" },
                },
            });
            util.clickQuestion("mug");
            var $card = $(".fd-update-property.fd-card").first();
            var $calculate = $card.find(".fd-update-property-calculate");
            assert.ok(
                $calculate.closest(".form-group").hasClass("has-error"),
                "saved card should show .has-error on first render"
            );
        });

        it("should flag invalid property-name chars in Update", function () {
            util.loadXML("");
            util.addQuestion("SaveToCase", "mug", {
                case_id: "/data/meta/caseID",
                useUpdate: true,
            });
            util.clickQuestion("mug");
            $("[name='property-updateProperty']").find(".fd-add-property").trigger("click");

            var $card = $(".fd-update-property.fd-card").first();
            var $nameInput = $card.find(".fd-update-property-name");
            $nameInput.val("bad name!").trigger("change");

            assert.ok(
                $nameInput.closest(".form-group").hasClass("has-error"),
                "expected .has-error on name field for invalid property name characters"
            );
        });

        it("should flag reserved names (case_type) in Create", function () {
            util.loadXML("");
            util.addQuestion("SaveToCase", "mug", {
                case_id: "uuid()",
                useCreate: true,
                case_type: "patient",
                caseName: "/data/name",
            });
            util.clickQuestion("mug");
            $("[name='property-createProperty']").find(".fd-add-property").trigger("click");

            var $card = $("[name='property-createProperty']")
                .find(".fd-update-property.fd-card").first();
            var $nameInput = $card.find(".fd-update-property-name");
            $nameInput.val("case_type").trigger("change");

            assert.ok(
                $nameInput.closest(".form-group").hasClass("has-error"),
                "expected .has-error on name field for reserved property name"
            );
        });

        it("should pass valid property names without error", function () {
            util.loadXML("");
            util.addQuestion("SaveToCase", "mug", {
                case_id: "/data/meta/caseID",
                useUpdate: true,
            });
            util.clickQuestion("mug");
            $("[name='property-updateProperty']").find(".fd-add-property").trigger("click");

            var $card = $(".fd-update-property.fd-card").first();
            var $nameInput = $card.find(".fd-update-property-name");
            $nameInput.val("valid_name-123").trigger("change");

            assert.notOk(
                $nameInput.closest(".form-group").hasClass("has-error"),
                "expected no .has-error on name field for valid property name"
            );
        });

        it("should leave untouched siblings quiet during typing, then surface them on save-popover hover", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug", {
                case_id: "uuid()",
                useCreate: true,
                case_type: "p",
                caseName: "/data/name",
                useIndex: true,
            });
            util.clickQuestion("mug");
            $("[name='property-indexProperty']").find(".fd-add-property").trigger("click");

            var $card = $(".fd-index-property.fd-card").first();
            var key = "mug-indexProperty-error";
            function indexErrorMessage() {
                var found = null;
                mug.messages.each("indexProperty", function (m) {
                    if (m.key === key) { found = m.message; }
                });
                return found;
            }

            // Type only the identifier.
            $card.find(".fd-index-property-name").val("parent").trigger("change");
            assert.notOk(
                $card.find(".fd-index-property-relationship").closest(".form-group")
                    .hasClass("has-error"),
                "expected no .has-error on relationship field for untouched required field"
            );
            assert.isNull(indexErrorMessage());

            // Trigger the save-popover show event
            mug.form.vellum.data.core.saveButton.ui.trigger("show.bs.popover");
            assert.ok(
                $card.find(".fd-index-property-relationship").closest(".form-group")
                    .hasClass("has-error"),
                "expected .has-error on relationship field for force-touched required field"
            );
            assert.isNotNull(indexErrorMessage());
        });

    });

    describe("inline validation propogation to mug.messages", function () {

        function updateErrorMessage(mug) {
            var key = "mug-updateProperty-error";
            var found = null;
            mug.messages.each("updateProperty", function (m) {
                if (m.key === key) { found = m.message; }
            });
            return found;
        }

        it("should populate mug.messages when an inline error is set", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug", {
                case_id: "/data/meta/caseID",
                useUpdate: true,
            });
            util.clickQuestion("mug");
            $("[name='property-updateProperty']").find(".fd-add-property").trigger("click");

            var $card = $(".fd-update-property.fd-card").first();
            var $name = $card.find(".fd-update-property-name");
            assert.notOk($name.closest(".form-group").hasClass("has-error"), "name field should not have inline .has-error initially");
            assert.isNull(updateErrorMessage(mug), "There should be no mug.messageserror initially");


            $name.val("invalid name!").trigger("change");
            var msg = updateErrorMessage(mug);
            assert.ok($name.closest(".form-group").hasClass("has-error"), "Invalid name should trigger inline error");
            assert.isNotNull(msg, "Inline error should be populate mug.messages");
            assert.match(msg, /have errors/i);
        });

        it("should drop mug.messages entry when the inline error is fixed", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug", {
                case_id: "/data/meta/caseID",
                useUpdate: true,
            });
            util.clickQuestion("mug");
            $("[name='property-updateProperty']").find(".fd-add-property").trigger("click");

            var $card = $(".fd-update-property.fd-card").first();
            var $name = $card.find(".fd-update-property-name");

            $name.val("invalid name!").trigger("change");
            assert.ok($name.closest(".form-group").hasClass("has-error"), "Invalid name should trigger inline error");
            assert.isNotNull(updateErrorMessage(mug), "Inline error should be populate mug.messages");

            $name.val("valid_name").trigger("change");
            assert.notOk($name.closest(".form-group").hasClass("has-error"), "Valid name should clear inline error");
            assert.isNull(updateErrorMessage(mug), "Clear inline error should also clear error from mug.messages");
        });
    });

    describe("validationFunc empty-state and list-level checks", function () {

        it("createProperty passes when empty (requiresAtLeastOne=false)", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug", {
                case_id: "uuid()",
                useCreate: true,
                case_type: "patient",
                caseName: "/data/name",
            });
            mug.p.createProperty = {};
            assert.strictEqual(mug.spec.createProperty.validationFunc(mug), "pass");
        });

        it("updateProperty fails with emptyStateMessage when empty", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug", {
                case_id: "/data/meta/caseID",
                useUpdate: true,
            });
            mug.p.updateProperty = {};
            var msg = mug.spec.updateProperty.validationFunc(mug);
            assert.notEqual(msg, "pass");
            assert.match(msg, /at least one property/i);
        });

        it("indexProperty fails with emptyStateMessage when empty", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug", {
                case_id: "/data/meta/caseID",
                useIndex: true,
            });
            mug.p.indexProperty = {};
            var msg = mug.spec.indexProperty.validationFunc(mug);
            assert.notEqual(msg, "pass");
            assert.match(msg, /at least one relationship/i);
        });

        it("updateProperty passes with one entry", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug", {
                case_id: "/data/meta/caseID",
                useUpdate: true,
            });
            mug.p.updateProperty = {
                "name": { calculate: "/data/name" },
            };
            assert.strictEqual(mug.spec.updateProperty.validationFunc(mug), "pass");
        });

        it("should catch per-field errors in untouched cards (isFormValid)", function () {
            util.loadXML("");
            var mug = util.addQuestion("SaveToCase", "mug", {
                case_id: "/data/meta/caseID",
                useIndex: true,
            });
            mug.p.indexProperty = {
                "parent": {
                    calculate: "this is not valid xpath!!!",
                    case_type: "type",
                    relationship: "neither_child_nor_extension",
                },
            };
            assert.notEqual(mug.spec.indexProperty.validationFunc(mug), "pass",);
            assert.notOk(mug.form.isFormValid());

            mug.p.indexProperty = {
                "parent": {
                    calculate: "/data/meta/caseID",
                    case_type: "type",
                    relationship: "child",
                },
            };
            assert.strictEqual(
                mug.spec.indexProperty.validationFunc(mug), "pass"
            );
        });
    });
});
