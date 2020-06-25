define([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/saveToCase',
    'text!static/saveToCase/create_property.xml',
    'text!static/saveToCase/close_property.xml',
    'text!static/saveToCase/update_property.xml',
    'text!static/saveToCase/index_property.xml',
    'text!static/saveToCase/attachment_property.xml',
    'text!static/saveToCase/case_type_property.xml',
    'text!static/saveToCase/create_2_property.xml',
    'text!static/saveToCase/logic_test.xml',
    'text!static/saveToCase/two-same-name.xml',
], function (
    util,
    chai,
    $,
    _,
    saveToCase,
    CREATE_PROPERTY_XML,
    CLOSE_PROPERTY_XML,
    UPDATE_PROPERTY_XML,
    INDEX_PROPERTY_XML,
    ATTACHMENT_PROPERTY_XML,
    CASE_TYPE_PROPERTY_XML,
    CREATE_2_PROPERTY_XML,
    LOGIC_TEST_XML,
    TWO_SAME_NAME_XML
) {
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
            assert.equal(props.case_type.calculate, "caseType");
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

        it("should load and save a attachment property", function () {
            util.loadXML(ATTACHMENT_PROPERTY_XML);
            var attach = util.getMug("save_to_case");
            assert.equal(attach.p.useAttachment, true);
            assert(_.isEqual(attach.p.attachmentProperty, {
                attach: {
                    calculate: "/data/question1",
                    from: "local",
                    name: "name",
                }
            }));
            assert.equal(attach.p.date_modified, '/data/meta/timeEnd');
            assert.equal(attach.p.user_id, "/data/meta/userID");
            assert.equal(attach.p.case_id, "/data/meta/caseID");
            util.assertXmlEqual(call("createXML"), ATTACHMENT_PROPERTY_XML);
        });

        it("should load and save the case type property", function () {
            util.loadXML(CASE_TYPE_PROPERTY_XML);
            var create = util.getMug("save_to_case");
            assert.isOk(create, "save_to_case mug should exist");
            util.assertXmlEqual(call("createXML"), CASE_TYPE_PROPERTY_XML);
        });

        it("should support two questions with same name", function () {
            util.loadXML(TWO_SAME_NAME_XML);
            var one = util.getMug("one/save"),
                two = util.getMug("two/save");
            assert.equal(one.p.case_id, 'uuid()', 'one');
            assert.equal(two.p.case_id, 'uuid()', 'two');
        });

        describe("should not allow", function () {
            var mug, spec;
            before(function (done) {
                util.init({
                    javaRosa: {langs: ['en']},
                    core: {
                        onReady: function() {
                            mug = util.addQuestion("SaveToCase", "mug");
                            spec = mug.spec.attachmentProperty;
                            done();
                        }
                    },
                });
            });

            _.each({
                "inline attachments with no name": {
                    inline_prop: {
                        calculate: "/data/question1",
                        from: "inline",
                    }
                },
                "invalid from strings": {
                    from_strings: {
                        calculate: "/data/question1",
                        from: "blah"
                    }
                },
            }, function(v, k) {
                it("should validate " + k, function() {
                    mug.p.useAttachment = true;
                    mug.p.attachmentProperty = v;
                    assert.notEqual(spec.validationFunc(mug), "pass");
                });
            });
        });

        describe("should allow", function() {
            var mug, spec;
            before(function (done) {
                util.init({
                    javaRosa: {langs: ['en']},
                    core: {
                        onReady: function() {
                            mug = util.addQuestion("SaveToCase", "mug");
                            spec = mug.spec.attachmentProperty;
                            done();
                        }
                    },
                });
            });

            _.each({
                "inline attachments": {
                    inline_prop: {
                        calculate: "/data/question1",
                        from: "inline",
                        name: "test",
                    }
                },
                "from strings": {
                    from_strings: {
                        calculate: "/data/question1",
                        from: "local"
                    }
                },
                "hyphenated properties": {
                    "hyphen-props": {
                        calculate: "/data/question1",
                        from: "local"
                    }
                }
            }, function(v, k) {
                it("should validate " + k, function() {
                    mug.p.useAttachment = true;
                    mug.p.attachmentProperty = v;
                    assert.equal(spec.validationFunc(mug), "pass");
                });
            });
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
                createProperty: {
                    'case_type': 'type',
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
            mug.p.createProperty = {
                'case_type': {
                    'calculate': 'type'
                },
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
                            "case_type",
                            "p1",
                            "p2"
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
});
