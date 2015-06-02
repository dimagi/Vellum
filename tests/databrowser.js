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
            id: "casedb",
            uri: "jr://instance/casedb",
            path: "/cases/case",
            name: 'Cases',
            structure: {
                "@case_id": {},
                "@case_type": {},
                case_name: {},
            },
            subsets: [{
                name: "Mother",
                filter: "[@case_type='mother']",
                structure: {
                    edd: {},
                    children: {
                        structure: {
                            child_id: {}
                        }
                    }
                }
            }, {
                name: "Child",
                filter: "[@case_type='child']",
                structure: {
                    "@mother_id": {},
                    dob: {},
                }
            }]
        }];

    describe("The data tree", function () {
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
                            dataTree = _this.$f.find(".fd-external-data-tree").jstree(true);
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

        it("should add ref with instance on drag/drop", function() {
            util.loadXML("");
            var mug = util.addQuestion("DataBindOnly", "mug"),
                node = dataTree.get_node(dataTree.get_node("#").children[0]),
                calc = $("[name=property-calculateAttr]"),
                uri = CASE_DATA[0].uri;
            assert.equal(getInstanceId(mug.form, uri), null);
            assert.equal(calc.length, 1);
            node.data.handleDrop(calc);
            assert.equal(mug.p.calculateAttr, "instance('casedb')/cases/case");
            assert.equal(getInstanceId(mug.form, uri), "casedb");
        });

        // TODO should remove instance when expression ref is removed
    });
});
