/*jshint multistr: true */
require([
    'tests/options',
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/databrowser',
    'vellum/datasources',
], function (
    options,
    util,
    chai,
    $,
    _,
    databrowser,
    datasources
) {
    var assert = chai.assert,
        plugins = _.union(util.options.options.plugins || [], ["databrowser"]),
        CASE_DATA = [{
            id: "commcaresession",
            uri: "jr://instance/session",
            path: "/session/data",
            name: 'Session',
            structure: {
                "case_id": {
                    reference: {
                        source: "casedb",
                        subset: "child",
                        key: "@case_id",
                    },
                },
            },
        }, {
            id: "casedb",
            uri: "jr://instance/casedb",
            path: "/cases/case",
            name: 'Cases',
            structure: {
                name: {},
            },
            subsets: [{
                id: "mother",
                key: "@case_type",
                structure: {
                    edd: {},
                },
                related: {
                    "first-child": "child",
                }
            }, {
                id: "child",
                key: "@case_type",
                structure: {
                    dob: {},
                },
                related: {
                    parent: "mother",
                },
            }],
        }];

    describe("The data browser", function () {
        var dataTree;
        before(function (done) {
            util.init({
                plugins: plugins,
                javaRosa: {langs: ['en']},
                core: {
                    dataSourcesEndpoint: function (callback) { callback(CASE_DATA); },
                    onReady: function () {
                        var _this = this;
                        datasources.getDataSources(function () {
                            databrowser.initDataBrowser(_this);
                            dataTree = _this.$f.find(".fd-external-sources-tree").jstree(true);
                            done();
                        });
                    }
                }
            });
        });

        function getInstanceId(form, src) {
            var meta = _.find(form.instanceMetadata, function (meta) {
                return meta.attributes.src === src;
            });
            return meta ? meta.attributes.id : null;
        }

        it("should add ref on drag/drop", function() {
            util.loadXML("");
            var mug = util.addQuestion("DataBindOnly", "mug"),
                calc = $("[name=property-calculateAttr]"),
                sessionUri = CASE_DATA[0].uri,
                casedbUri = CASE_DATA[1].uri,
                where = "@case_id=instance('commcaresession')/session/data/case_id";
            assert.equal(getInstanceId(mug.form, sessionUri), null);
            assert.equal(getInstanceId(mug.form, casedbUri), null);
            assert.equal(calc.length, 1);
            util.findNode(dataTree, "dob").data.handleDrop(calc);
            assert.equal(mug.p.calculateAttr,
                         "instance('casedb')/cases/case[" + where + "]/dob");
            assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
            assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
        });

        it("should add parent ref on drag/drop", function() {
            util.loadXML("");
            var mug = util.addQuestion("DataBindOnly", "mug"),
                calc = $("[name=property-calculateAttr]"),
                sessionUri = CASE_DATA[0].uri,
                casedbUri = CASE_DATA[1].uri,
                whereSession = "@case_id=instance('commcaresession')/session/data/case_id",
                whereParent = "@case_id=instance('casedb')/cases/case[" +
                              whereSession + "]/index/parent";
            assert.equal(getInstanceId(mug.form, sessionUri), null);
            assert.equal(getInstanceId(mug.form, casedbUri), null);
            assert.equal(calc.length, 1);
            util.findNode(dataTree, "edd").data.handleDrop(calc);
            assert.equal(mug.p.calculateAttr,
                         "instance('casedb')/cases/case[" + whereParent + "]/edd");
            assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
            assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
        });

        it("should add recursive ref on drag/drop", function() {
            util.loadXML("");
            var mug = util.addQuestion("DataBindOnly", "mug"),
                calc = $("[name=property-calculateAttr]"),
                sessionUri = CASE_DATA[0].uri,
                casedbUri = CASE_DATA[1].uri,
                whereSession = "@case_id=instance('commcaresession')/session/data/case_id",
                whereParent = "@case_id=instance('casedb')/cases/case[" +
                              whereSession + "]/index/parent",
                whereChild = "@case_id=instance('casedb')/cases/case[" +
                             whereParent + "]/index/first-child";
            assert.equal(getInstanceId(mug.form, sessionUri), null);
            assert.equal(getInstanceId(mug.form, casedbUri), null);
            assert.equal(calc.length, 1);
            var node = util.findNode(dataTree, "first-child (child)");
            dataTree.open_node(node);
            util.findNode(dataTree, "dob", node).data.handleDrop(calc);
            assert.equal(mug.p.calculateAttr,
                         "instance('casedb')/cases/case[" + whereChild + "]/dob");
            assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
            assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
        });

        // TODO should remove instances when expression ref is removed
    });
});
