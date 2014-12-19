require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/modeliteration/case-list-iteration.xml',
    'text!static/modeliteration/case-list-iteration-with-questions.xml',
    'text!static/modeliteration/fixture-iteration.xml',
    'text!static/modeliteration/regular-repeat.xml',
    'tests/modeliteration'
], function (
    chai,
    $,
    _,
    util,
    CASE_LIST_REPEAT_XML,
    CASE_LIST_REPEAT_WITH_QUESTIONS_XML,
    FIXTURE_REPEAT_XML,
    REGULAR_REPEAT_XML
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
            var repeat = util.addQuestion("Repeat", "child");
            repeat.p.dataSource = {
                instance: {id: "casedb", src: "jr://instance/casedb"},
                idsQuery: "instance('casedb')/mother/child/@case_id"
            };
            util.assertXmlEqual(call("createXML"), CASE_LIST_REPEAT_XML,
                                {normalize_xmlns: true});
        });

        it("should create a case list repeat with questions", function () {
            util.loadXML("");
            var group = util.addQuestion("Repeat", "group");
            group.p.dataSource = {
                instance: {id: "casedb", src: "jr://instance/casedb"},
                idsQuery: "instance('casedb')/mother/child/@case_id"
            };
            util.addQuestion("PhoneNumber", "phone");
            var hidden = util.addQuestion("DataBindOnly", "hidden");
            hidden.p.calculateAttr = "/data/group/item/phone = '12345'";
            util.assertXmlEqual(call("createXML"), CASE_LIST_REPEAT_WITH_QUESTIONS_XML,
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
            var repeat = util.addQuestion("Repeat", "product");
            repeat.p.dataSource = {
                instance: {id: "products", src: "jr://fixture/commtrack:products"},
                idsQuery: "instance('products')/products/product/@id"
            };
            util.assertXmlEqual(call("createXML"), FIXTURE_REPEAT_XML,
                                {normalize_xmlns: true});
        });

        it("should convert fixture repeat to regular repeat when data source is removed", function () {
            util.loadXML(FIXTURE_REPEAT_XML);
            var repeat = util.getMug("product");
            repeat.p.dataSource = {};
            repeat.p.repeat_count = "";
            util.assertXmlEqual(call("createXML"), REGULAR_REPEAT_XML);
        });

        it("should create a fixture repeat containing a text input", function () {
            util.loadXML("");
            var repeat = util.addQuestion("Repeat", "product");
            repeat.p.dataSource = {
                instance: {id: "products", src: "jr://fixture/commtrack:products"},
                idsQuery: "instance('products')/products/product/@id"
            };
            util.addQuestion("Text", "text");
            util.assertJSTreeState(
                "product",
                "  text"
            );
        });

        it("should change a fixture repeat to a case list repeat", function () {
            util.loadXML(FIXTURE_REPEAT_XML);
            var repeat = util.getMug("product");
            repeat.p.dataSource = {
                instance: {id: "casedb", src: "jr://instance/casedb"},
                idsQuery: "instance('casedb')/mother/child/@case_id"
            };
            util.assertXmlEqual(call("createXML").replace(/product/g, "child"),
                                CASE_LIST_REPEAT_XML);
        });

        it("should not remove instance when ignore/retain is active", function () {
            var normal = '<bind nodeset="/data/product/item" />',
                ignore = '<bind nodeset="/data/product/item" wierd="true()" vellum:ignore="retain" />',
                xml = FIXTURE_REPEAT_XML.replace(normal, normal + ignore);
            assert(xml.indexOf(ignore) > 0, ignore + " not found in XML:\n\n" + xml);
            util.loadXML(xml);
            var repeat = util.getMug("product");
            repeat.p.dataSource = {};
            repeat.p.repeat_count = "";
            xml = call("createXML");
            assert($(xml).find("instance[id=products]").length === 1,
                   "products instance not found in XML\n\n" + xml);
        });
    });
});
