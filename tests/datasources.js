/*jshint multistr: true */
require([
    'tests/options',
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/itemset',
    'vellum/form'
], function (
    options,
    util,
    chai,
    $,
    _,
    itemset,
    form
) {
    var assert = chai.assert,
        clickQuestion = util.clickQuestion,
        plugins = _.union(util.options.options.plugins || [], ["itemset"]),
        FIXTURE_DATA = [{
            sourceUri: "jr://fixture/item-list:some-fixture",
            defaultId: "some-fixture",
            initialQuery: "instance('some-fixture')/some-fixture_list/some-fixture",
            name: 'some-fixture-name',
            structure: {
                "inner-attribute": {
                    structure: {
                        "extra-inner-attribute": {}
                    }
                },
                "@id": {no_option: true},
                name: {no_option: true}
            }
        }];

    describe("The data source widget", function () {
        function beforeFn(done) {
            util.init({
                plugins: plugins,
                javaRosa: {langs: ['en']},
                core: {
                    dataSources: [{
                        key: "fixture",
                        name: "Lookup Table",
                        endpoint: function () { return FIXTURE_DATA; }
                    }],
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
                        dataSources: [{
                            key: 'fixture',
                            endpoint: function () { return []; }
                        }],
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
    });
});
