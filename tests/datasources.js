/*jshint multistr: true */
require([
    'tests/options',
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/datasources',
    'vellum/itemset',
    'vellum/form'
], function (
    options,
    util,
    chai,
    $,
    _,
    datasources,
    itemset,
    form
) {
    var assert = chai.assert,
        clickQuestion = util.clickQuestion,
        plugins = _.union(util.options.options.plugins || [], ["itemset"]),
        FIXTURE_DATA = [{
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
        }];

    describe("The data source widget", function () {
        function beforeFn(done) {
            util.init({
                plugins: plugins,
                javaRosa: {langs: ['en']},
                core: {
                    dataSourcesEndpoint: function (callback) { callback(FIXTURE_DATA); },
                    onReady: done
                }
            });
        }
        before(beforeFn);

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

        describe("", function() {
            before(function(done) {
                util.init({
                    plugins: plugins,
                    javaRosa: {langs: ['en']},
                    core: {
                        dataSourcesEndpoint: function (callback) { callback([]); },
                        onReady: done
                    }
                });
            });

            it("should not crash when no fixtures are passed", function () {
                util.loadXML("");
                util.addQuestion("SelectDynamic", "select1");
                clickQuestion('select1/itemset');
                assert(true);
            });
        });

        describe("async options loader", function() {
            var callback;
            before(function (done) {
                util.init({
                    plugins: plugins,
                    javaRosa: {langs: ['en']},
                    core: {
                        dataSourcesEndpoint: function (cb) { callback = cb; },
                        onReady: done
                    }
                });
            });
            beforeEach(function () {
                datasources.reset();
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
                clickQuestion('select/itemset');
                callback([{
                    id: "bar",
                    uri: "jr://fixture/foo",
                    path: "root",
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
                    '{"id":"bar","src":"jr://fixture/foo","query":"instance(\'bar\')root"}');
                assert.equal(data.find("option:selected").text(), "outer");
                assert.equal($('[name=value_ref]').val(), '@id');
                assert.equal($('[name=label_ref]').val(), 'name');
            });

            it("should select correct option when not empty and finished loading", function() {
                util.loadXML("");
                util.paste([
                    ["id", "type", "itemsetData"],
                    ["select", "SelectDynamic",
                     '[{"instance":{"id":"bar",' +
                     '"src":"jr://fixture/foo","query":"instance(\'bar\')root/inner"},' +
                     '"nodeset":"instance(\'bar\')root/inner","labelRef":"name","valueRef":"@id"}]'],
                ]);
                clickQuestion('select/itemset');
                callback([{
                    id: "bar",
                    uri: "jr://fixture/foo",
                    path: "root",
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
                    '{"id":"bar","src":"jr://fixture/foo","query":"instance(\'bar\')root/inner"}');
                assert.equal(data.find("option:selected").text(), "outer - inner");
            });
        });
    });

    describe("The data tree", function () {
        var dataTree;
        before(function (done) {
            util.init({
                plugins: plugins,
                javaRosa: {langs: ['en']},
                core: {
                    dataSourcesEndpoint: function (callback) { callback(FIXTURE_DATA); },
                    onReady: function () {
                        var _this = this;
                        datasources.getDataSources(function () {
                            datasources.loadExternalData();
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
                uri = FIXTURE_DATA[0].uri;
            assert.equal(getInstanceId(mug.form, uri), null);
            assert.equal(calc.length, 1);
            node.data.handleDrop(calc);
            assert.equal(mug.p.calculateAttr,
                "instance('some-fixture')/some-fixture_list/some-fixture");
            assert.equal(getInstanceId(mug.form, uri), "some-fixture");
        });

        // TODO should remove instance when expression ref is removed
    });
});
