require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/modeliteration/case-list-iteration.xml',
    'text!static/modeliteration/fixture-iteration.xml',
    'tests/modeliteration'
], function (
    chai,
    $,
    _,
    util,
    CASE_LIST_REPEAT_XML,
    FIXTURE_REPEAT_XML
) {
    var assert = chai.assert,
        call = util.call,
        plugins = util.options.options.plugins || [],
        pluginsWithModelIteration = _.union(plugins, ["modeliteration"]);

    describe("The model repeat plugin", function () {
        before(function (done) {
            util.init({
                plugins: pluginsWithModelIteration,
                javaRosa: { langs: ['en'] },
                core: {
                    onReady: function () {
                        assert(this.isPluginEnabled("modeliteration"),
                               "modeliteration plugin should be enabled");
                        done();
                    }
                }
            });
        });

        it("should load a case list repeat", function () {
            util.loadXML(CASE_LIST_REPEAT_XML);
            var repeat = util.getMug("child");
            assert.deepEqual(repeat.p.dataSource, {
                instance: {id: "casedb", src: "jr://instance/casedb"},
                idsQuery: "instance('casedb')/mother/child/@case_id"
            });
            util.assertXmlEqual(call("createXML"), CASE_LIST_REPEAT_XML);
        });

        it("should create a case list repeat", function () {
            util.loadXML("");
            var repeat = util.addQuestion("ModelRepeat", "child");
            repeat.p.dataSource = {
                instance: {id: "casedb", src: "jr://instance/casedb"},
                idsQuery: "instance('casedb')/mother/child/@case_id"
            };
            util.assertXmlEqual(call("createXML"), CASE_LIST_REPEAT_XML,
                                {normalize_xmlns: true});
        });

        it("should load a fixture repeat", function () {
            util.loadXML(FIXTURE_REPEAT_XML);
            var repeat = util.getMug("product");
            assert.deepEqual(repeat.p.dataSource, {
                instance: {id: "products", src: "jr://fixture/commtrack:products"},
                idsQuery: "instance('products')/products/product/@id"
            });
            util.assertXmlEqual(call("createXML"), FIXTURE_REPEAT_XML);
        });

        it("should create a fixture repeat", function () {
            util.loadXML("");
            var repeat = util.addQuestion("ModelRepeat", "product");
            repeat.p.dataSource = {
                instance: {id: "products", src: "jr://fixture/commtrack:products"},
                idsQuery: "instance('products')/products/product/@id"
            };
            util.assertXmlEqual(call("createXML"), FIXTURE_REPEAT_XML,
                                {normalize_xmlns: true});
        });
    });
});
