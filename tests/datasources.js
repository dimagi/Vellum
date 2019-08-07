/*jshint multistr: true */
define([
    'tests/options',
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/itemset',
    'text!static/datasources/case-property.xml',
    'text!static/datasources/null-hashtags.xml',
    'text!static/datasources/unknown-case-property.xml',
], function (
    options,
    util,
    chai,
    $,
    _,
    itemset,
    CASE_PROPERTY_XML,
    NULL_HASHTAGS_XML,
    UNKNOWN_CASE_PROPERTY_XML
) {
    var assert = chai.assert,
        clickQuestion = util.clickQuestion,
        plugins = _.union(util.options.options.plugins || [], ["itemset"]),
        DATA_SOURCES = [{
            id: "some-fixture",
            uri: "jr://fixture/item-list:some-fixture",
            path: "/some-fixture_list/some-fixture",
            name: 'some-fixture-name',
            structure: {
                "inner-attribute": {
                    structure: {
                        "extra-inner-attribute": {
                            structure: {
                                "@id": {},
                                name: {}
                            }
                        }
                    }
                },
                "@id": {},
                name: {}
            }
        }, {
            id: "commcaresession",
            uri: "jr://instance/session",
            path: "/session",
            name: 'Session',
            structure: {
                data: {
                    merge: true,
                    structure: {
                        "case_id": {
                            reference: {
                                hashtag: "#case",
                                source: "casedb",
                                subset: "case",
                                subset_key: "@case_type",
                                key: "@case_id",
                            },
                        },
                    },
                },
                context: {
                    merge: true,
                    structure: {
                        "userid": {
                            reference: {
                                hashtag: "#user",
                                source: "casedb",
                                subset: "commcare-user",
                                subset_key: "@case_type",
                                subset_filter: true,
                                key: "hq_user_id",
                            },
                        },
                    },
                },
            },
        }, {
            id: "casedb",
            uri: "jr://instance/casedb",
            path: "/cases/case",
            name: 'Cases',
            subsets: [{
                id: "case",
                name: "child",
                key: "@case_type",
                structure: {
                    dob: {},
                    parent: {},
                },
                related: {
                    parent: {
                        hashtag: "#case/parent",
                        subset: "parent",
                        subset_key: "@case_type",
                        key: "@case_id",
                    }
                },
            }, {
                id: "parent",
                name: "mother",
                key: "@case_type",
                structure: {
                    edd: {},
                },
                related: {
                    parent: {
                        hashtag: "#case/grandparent",
                        subset: "grandparent",
                        subset_key: "@case_type",
                        key: "@case_id",
                    },
                }
            }, {
                id: "grandparent",
                name: "household",
                key: "@case_type",
                structure: {
                    address: {},
                }
            }, {
                id: "commcare-user",
                name: "user",
                key: "@case_type",
                structure: {
                    role: {},
                }
            }]
        }];

    describe("The data sources loader", function () {
        var vellum;
        before(function (done) {
            util.init({
                plugins: plugins,
                javaRosa: {langs: ['en']},
                core: {
                    dataSourcesEndpoint: function (callback) { callback(DATA_SOURCES); },
                    onReady: function () {
                        vellum = this;
                        done();
                    },
                },
                features: {rich_text: false},
            });
        });

        it("displays nested structures", function() {
            util.loadXML("");
            util.addQuestion("SelectDynamic", "select1");
            clickQuestion('select1/itemset');
            var opts = $('[name=property-itemsetData] option'),
                text = function (opt) { return opt.text; };
            assert.equal(_.map(opts, text).join("\n"), [
                "some-fixture-name",
                "some-fixture-name - inner-attribute",
                "some-fixture-name - inner-attribute - extra-inner-attribute",
            ].join("\n"));
        });

        describe("data nodes", function () {
            var nodes;
            before(function () {
                function transform(nodes) {
                    return _.object(_.map(nodes, function (node) {
                        if (!node.recursive) {
                            node.nodes = transform(node.getNodes());
                        }
                        return [node.name, node];
                    }));
                }
                nodes = transform(vellum.datasources.getDataNodes());
            });

            it("should merge structures when merge flag is set", function() {
                assert.deepEqual(_.keys(nodes), ["child", "user"]);
                assert.equal(nodes.child.xpath,
                    "instance('commcaresession')/session/data/case_id");
                assert.equal(nodes.user.xpath,
                    "instance('commcaresession')/session/context/userid");
            });

            it("should use reference.hashtag", function() {
                assert.equal(nodes.user.nodes.role.hashtag, "#user/role");
            });

            it("should construct #case hashtag with reference.subset", function() {
                assert.equal(nodes.child.nodes.dob.hashtag, "#case/dob");
            });

            it("should construct #case/parent hashtag with related subset", function() {
                assert.equal(nodes.child.nodes.mother.nodes.edd.hashtag, "#case/parent/edd");
            });

            it("should construct #case/grandparent hashtag with related subset", function() {
                var house = nodes.child.nodes.mother.nodes.household.nodes;
                assert.equal(house.address.hashtag, "#case/grandparent/address");
            });

            it("should use index path for related parent node", function() {
                assert.strictEqual(nodes.child.nodes.mother.hashtag, null);
                assert.equal(nodes.child.nodes.mother.xpath,
                    "instance('casedb')/cases/case[@case_id = " +
                    "instance('commcaresession')/session/data/case_id]/index/parent");
            });

            it("should support property with same name as related index", function() {
                assert.equal(nodes.child.nodes.parent.hashtag, "#case/parent");
                assert.equal(nodes.child.nodes.parent.xpath,
                    "instance('casedb')/cases/case[@case_id = " +
                    "instance('commcaresession')/session/data/case_id]/parent");
            });
        });

        describe("", function() {
            before(function(done) {
                util.init({
                    plugins: plugins,
                    javaRosa: {langs: ['en']},
                    core: {
                        dataSourcesEndpoint: function (callback) { callback([]); },
                        onReady: done
                    },
                    features: {rich_text: false},
                });
            });

            it("should not crash when no fixtures are passed", function () {
                util.loadXML("");
                util.addQuestion("SelectDynamic", "select1");
                clickQuestion('select1/itemset');
            });
        });

        describe("async options loader", function() {
            var vellum, callback;
            before(function (done) {
                util.init({
                    plugins: plugins,
                    javaRosa: {langs: ['en']},
                    core: {
                        dataSourcesEndpoint: function (cb) { callback = cb; },
                        onReady: function () {
                            vellum = this;
                            done();
                        },
                    },
                    features: {rich_text: false},
                });
            });
            beforeEach(function () {
                vellum.datasources.reset();
                callback = null;
            });

            it("should indicate loading status for empty itemset", function() {
                util.loadXML("");
                util.addQuestion("SelectDynamic", "select");
                clickQuestion('select/itemset');
                var options = $('[name=property-itemsetData] option');
                assert.equal(options.first().text(), 'Loading...');
                assert.equal(options.length, 1, $("<div />").append(options).html());
            });

            it("should replace loading indicator with async loaded options", function() {
                util.loadXML("");
                util.addQuestion("SelectDynamic", "select");
                clickQuestion('select/itemset');
                callback([]);
                var options = $('[name=property-itemsetData] option');
                assert.equal(options.first().text(), "Not Found");
                assert.equal(options.length, 1, $("<div />").append(options).html());
            });

            it("should show custom option when loading itemset with value", function() {
                util.loadXML("");
                util.paste([
                    ["id", "type", "itemsetData"],
                    ["select", "SelectDynamic",
                     '[{"instance":null,"nodeset":"/items","labelRef":"@name","valueRef":"@id"}]'],
                ]);
                clickQuestion('select/itemset');
                var options = $('[name=property-itemsetData] option'),
                    custom = $(options[1]);
                assert.equal(options.first().text(), "Loading...");
                assert.equal(custom.text(), "Lookup table was not found in the project");
                assert.equal(custom.parent().val(), '{"id":"","src":"","query":"/items"}');
                assert.equal(options.length, 2, $("<div />").append(options).html());
            });

            it("should select first option when empty and finished loading", function() {
                util.loadXML("");
                util.addQuestion("SelectDynamic", "select");
                callback([{
                    id: "bar",
                    uri: "jr://fixture/foo",
                    path: "/root",
                    name: "outer",
                    structure: {
                        "@id": {},
                        "name": {},
                        "inner": {
                            structure: {
                                "@id": {},
                                "name": {},
                            },
                        },
                    },
                }]);
                clickQuestion('select/itemset');
                var data = $('[name=property-itemsetData]');
                assert.equal(data.val(),
                    '{"id":"bar","src":"jr://fixture/foo","query":"instance(\'bar\')/root"}');
                assert.equal(data.find("option:selected").text(), "outer");
                assert.equal($('[name=property-valueRef]').val(), '@id');
                assert.equal($('[name=property-labelRef]').val(), 'name');
            });

            it("should select correct option when not empty and finished loading", function() {
                util.loadXML("");
                util.paste([
                    ["id", "type", "itemsetData"],
                    ["select", "SelectDynamic",
                     '[{"instance":{"id":"bar",' +
                     '"src":"jr://fixture/foo","query":"instance(\'bar\')/root/inner"},' +
                     '"nodeset":"instance(\'bar\')/root/inner","labelRef":"name","valueRef":"@id"}]'],
                ]);
                clickQuestion('select/itemset');
                callback([{
                    id: "bar",
                    uri: "jr://fixture/foo",
                    path: "/root",
                    name: "outer",
                    structure: {
                        "@id": {},
                        "name": {},
                        "inner": {
                            structure: {
                                "@id": {},
                                "name": {},
                            },
                        },
                    },
                }]);
                var data = $('[name=property-itemsetData]');
                assert.equal(data.val(),
                    '{"id":"bar","src":"jr://fixture/foo","query":"instance(\'bar\')/root/inner"}');
                assert.equal(data.find("option:selected").text(), "outer - inner");
            });

            it("should not cause null xpath", function () {
                // bug only appeared on load XML with vellum:attr="value" attributes
                util.loadXML(CASE_PROPERTY_XML);
                callback(options.dataSources);
                util.assertXmlEqual(util.call("createXML"),
                    CASE_PROPERTY_XML
                        .replace(/ vellum:\w+=".*?"/g, "")
                        .replace(/<vellum:hashtag.*>/g, ""));
            });
        });

        describe("when still loading", function() {
            var vellum, callback;
            before(function (done) {
                util.init({
                    plugins: plugins,
                    javaRosa: {langs: ['en']},
                    core: {
                        dataSourcesEndpoint: function (cb) { callback = cb; },
                        onReady: function () {
                            vellum = this;
                            done();
                        },
                    },
                });
            });
            beforeEach(function () {
                vellum.datasources.reset();
                callback = null;
            });

            it("should not lose output value xpath on save", function () {
                var hashtrans = /<vellum:hashtagTransforms.*>/,
                    form = util.loadXML(NULL_HASHTAGS_XML.replace(hashtrans, ""));
                assert(!vellum.datasources.isReady(), 'data sources should not be ready');
                util.assertXmlEqual(util.call("createXML"), NULL_HASHTAGS_XML);
                assert(form.shouldInferHashtags, "form.shouldInferHashtags");
            });

            it("should not infer hashtags when <vellum:hashtagTransforms> is present", function () {
                var form = util.loadXML(NULL_HASHTAGS_XML);
                assert(!vellum.datasources.isReady(), 'data sources should not be ready');
                util.assertXmlEqual(util.call("createXML"), NULL_HASHTAGS_XML);
                assert(!form.shouldInferHashtags, "form.shouldInferHashtags should be false");
            });

            it("should show error on load sources with previously-known case property", function () {
                var form = util.loadXML(UNKNOWN_CASE_PROPERTY_XML),
                    hid = util.getMug('hid'),
                    txt = util.getMug('text');
                assert(!vellum.datasources.isReady(), 'data sources should not be ready');
                assert(util.isTreeNodeValid(hid), util.getMessages(hid));
                assert(util.isTreeNodeValid(txt), util.getMessages(txt));
                assert(!form.shouldInferHashtags, "form.shouldInferHashtags");
                callback(DATA_SOURCES);
                assert(!util.isTreeNodeValid(hid), '/data/hid should not be valid');
                assert(!util.isTreeNodeValid(txt), '/data/text should not be valid');
            });
        });
    });
});
