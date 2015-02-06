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

    describe("The model iteration plugin", function () {
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
            var repeat = util.getMug("child/item");
            assert.deepEqual(repeat.p.dataSource, {
                instance: {id: "casedb", src: "jr://instance/casedb"},
                idsQuery: "instance('casedb')/mother/child/@case_id"
            });
            util.assertXmlEqual(call("createXML"), CASE_LIST_REPEAT_XML);
        });

        it("should load a case list repeat with questions", function () {
            util.loadXML(CASE_LIST_REPEAT_WITH_QUESTIONS_XML);
            util.assertJSTreeState(
                "[group]",
                "  [phone]",
                "  [hidden]"
            );
            var repeat = util.getMug("group/item"),
                phone = util.getMug("group/item/phone"),
                hidden = util.getMug("group/item/hidden");
            assert.deepEqual(repeat.p.dataSource, {
                instance: {id: "casedb", src: "jr://instance/casedb"},
                idsQuery: "instance('casedb')/mother/child/@case_id"
            });
            assert.equal(phone.__className, "PhoneNumber");
            assert.equal(hidden.p.calculateAttr, "/data/group/item/phone = '12345'");
            util.assertXmlEqual(call("createXML"), CASE_LIST_REPEAT_WITH_QUESTIONS_XML);
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
            var repeat = util.getMug("product/item");
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
            var repeat = util.getMug("product/item");
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
                "[product]",
                "  [text]"
            );
        });

        it("should change a fixture repeat to a case list repeat", function () {
            util.loadXML(FIXTURE_REPEAT_XML);
            var repeat = util.getMug("product/item");
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
            var repeat = util.getMug("product/item");
            repeat.p.dataSource = {};
            repeat.p.repeat_count = "";
            xml = call("createXML");
            assert($(xml).find("instance[id=products]").length === 1,
                   "products instance not found in XML\n\n" + xml);
        });

        it("should not write duplicate <setvalue> nodes after rename", function () {
            // add question, save, rename, save, should not have two sets of <setvalue>s
            util.loadXML("");
            var repeat = util.addQuestion("Repeat", "product");
            repeat.p.dataSource = {
                instance: {id: "casedb", src: "jr://instance/casedb"},
                idsQuery: "instance('casedb')/mother/child/@case_id"
            };
            var xml = call("createXML"),
                firstCount = $(xml).find("setvalue").length;
            repeat.p.nodeID = "group";
            xml = call("createXML");
            assert.equal($(xml).find("setvalue").length, firstCount,
                         "wrong number of <setvalue> nodes\n\n" + xml);
        });

        it("should update expressions on set data source", function () {
            util.loadXML("");
            var repeat = util.addQuestion("Repeat", "product"),
                blue = util.addQuestion("Text", "blue"),
                text = util.addQuestion("Text", "text"),
                getPath = blue.form.getAbsolutePath.bind(blue.form);
            assert.equal(getPath(blue), "/data/product/blue");
            assert.equal(getPath(text), "/data/product/text");
            text.p.calculateAttr = getPath(blue);
            blue.p.labelItextID.setDefaultValue(
                '<output value="' + getPath(text) + '"/>');
            repeat.p.dataSource = {
                instance: {id: "casedb", src: "jr://instance/casedb"},
                idsQuery: "instance('casedb')/mother/child/@case_id"
            };
            var xml = $(call("createXML"));
            assert.equal(getPath(blue), "/data/product/item/blue");
            assert.equal(getPath(text), "/data/product/item/text");
            var textBind = xml.find("bind[nodeset='" + getPath(text) + "']");
            assert.equal(
                textBind.attr("calculate"),
                "/data/product/item/blue",
                textBind.attr("nodeset") + " calculate expression mismatch");
            assert.equal(xml.find("output:first").attr("value"),
                         "/data/product/item/text",
                         "output value mismatch");
            var errors = _.flatten(_.map([blue, text], function (mug) {
                    return call("getErrors", mug);
                }));
            assert(!errors.length, errors.join("\n"));
        });

        it("should update expressions on clear data source", function () {
            util.loadXML("");
            var repeat = util.addQuestion("Repeat", "product");
            repeat.p.dataSource = {
                instance: {id: "casedb", src: "jr://instance/casedb"},
                idsQuery: "instance('casedb')/mother/child/@case_id"
            };
            var blue = util.addQuestion("Text", "blue"),
                text = util.addQuestion("Text", "text"),
                getPath = blue.form.getAbsolutePath.bind(blue.form);
            text.p.calculateAttr = getPath(blue);
            blue.p.labelItextID.setDefaultValue(
                '<output value="' + getPath(text) + '"/>');
            assert.equal(getPath(blue), "/data/product/item/blue");
            assert.equal(getPath(text), "/data/product/item/text");

            repeat.p.dataSource = {};
            assert.equal(getPath(blue), "/data/product/blue");
            assert.equal(getPath(text), "/data/product/text");
            var xml = $(call("createXML")),
                textBind = xml.find("bind[nodeset='" + getPath(text) + "']");
            assert.equal(
                textBind.attr("calculate"),
                "/data/product/blue",
                textBind.attr("nodeset") + " calculate expression mismatch");
            assert.equal(xml.find("output:first").attr("value"),
                         "/data/product/text",
                         "output value mismatch");
            var errors = _.flatten(_.map([blue, text], function (mug) {
                    return call("getErrors", mug);
                }));
            assert(!errors.length, errors.join("\n"));
        });

        it("should show repeat count for regular repeat", function () {
            util.loadXML(REGULAR_REPEAT_XML);
            util.clickQuestion("product");
            // not ideal: references UI
            assert.equal($("[name=property-repeat_count]").length, 1,
                         "repeat count should be visible for regular repeat");
        });

        it("should hide repeat count for model repeat", function () {
            util.loadXML(FIXTURE_REPEAT_XML);
            util.clickQuestion("product/item");
            // not ideal: references UI
            assert.equal($("[name=property-repeat_count]").length, 0,
                         "repeat count should not be visible for model repeat");
        });
    });
});
