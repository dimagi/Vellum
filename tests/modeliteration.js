define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'static/modeliteration/case-list-iteration.xml',
    'static/modeliteration/case-list-iteration-with-questions.xml',
    'static/modeliteration/case-list-iteration-with-questions-and-hidden-value.xml',
    'static/modeliteration/fixture-iteration.xml',
    'static/modeliteration/regular-repeat.xml',
    'tests/modeliteration'
], function (
    chai,
    $,
    _,
    util,
    CASE_LIST_REPEAT_XML,
    CASE_LIST_REPEAT_WITH_QUESTIONS_XML,
    CASE_LIST_REPEAT_WITH_QUESTIONS_AND_HIDDEN_XML,
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
                "group",
                "  phone",
                "  hidden"
            );
            var repeat = util.getMug("group/item"),
                phone = util.getMug("group/item/phone"),
                hidden = util.getMug("group/item/hidden");
            assert.deepEqual(repeat.p.dataSource, {
                instance: {id: "casedb", src: "jr://instance/casedb"},
                idsQuery: "instance('casedb')/mother/child/@case_id"
            });
            assert.equal(phone.__className, "PhoneNumber");
            assert.equal(hidden.p.calculateAttr, "#form/group/item/phone = '12345'");
            util.assertXmlEqual(call("createXML"), CASE_LIST_REPEAT_WITH_QUESTIONS_XML);
        });


        it("should write setvalues in order of question tree", function () {
            util.loadXML(CASE_LIST_REPEAT_WITH_QUESTIONS_AND_HIDDEN_XML);
            util.assertJSTreeState(
                "hidden",
                "group",
                "  phone",
                "  hidden"
            );
            util.assertXmlEqual(call("createXML"), CASE_LIST_REPEAT_WITH_QUESTIONS_AND_HIDDEN_XML);
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
                "product",
                "  text"
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
            var normal = '<bind vellum:nodeset="#form/product/item" nodeset="/data/product/item" />',
                ignore = '<bind vellum:nodeset="#form/product/item" nodeset="/data/product/item" wierd="true()" vellum:ignore="retain" />',
                xml = FIXTURE_REPEAT_XML.replace(normal, normal + ignore);
            assert(xml.indexOf(ignore) > 0, ignore + " not found in XML:\n\n" + xml);
            util.loadXML(xml);
            var repeat = util.getMug("product/item");
            repeat.p.dataSource = {};
            repeat.p.repeat_count = "";
            xml = call("createXML");
            assert(util.parseXML(xml).find("instance[id=products]").length === 1,
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
                firstCount = util.parseXML(xml).find("setvalue").length;
            repeat.p.nodeID = "group";
            xml = call("createXML");
            assert.equal(util.parseXML(xml).find("setvalue").length, firstCount,
                         "wrong number of <setvalue> nodes\n\n" + xml);
        });

        it("should drop setvalue nodes on delete model repeat", function () {
            // add question, save, rename, save, should not have two sets of <setvalue>s
            util.loadXML(FIXTURE_REPEAT_XML);
            util.deleteQuestion("product/item");
            var xml = call("createXML");
            assert.equal(util.parseXML(xml).find("setvalue").length, 0,
                         "wrong number of <setvalue> nodes\n\n" + xml);
        });

        it("should update expressions on set data source", function () {
            util.loadXML("");
            var repeat = util.addQuestion("Repeat", "product"),
                blue = util.addQuestion("Text", "blue"),
                text = util.addQuestion("Text", "text"),
                getPath = blue.form.getAbsolutePath.bind(blue.form);
            assert.equal(blue.hashtagPath, "#form/product/blue");
            assert.equal(text.hashtagPath, "#form/product/text");
            text.p.calculateAttr = blue.hashtagPath;
            blue.p.labelItext.set('<output value="' + text.hashtagPath + '"/>');
            blue.validate("labelItext");
            repeat.p.dataSource = {
                instance: {id: "casedb", src: "jr://instance/casedb"},
                idsQuery: "instance('casedb')/mother/child/@case_id"
            };
            var xml = util.parseXML(call("createXML"));
            assert.equal(blue.hashtagPath, "#form/product/item/blue");
            assert.equal(text.hashtagPath, "#form/product/item/text");
            var textBind = xml.find("bind[nodeset='" + getPath(text) + "']");
            assert.equal(
                textBind.attr("calculate"),
                "/data/product/item/blue",
                textBind.attr("nodeset") + " calculate expression mismatch");
            assert.equal(xml.find("output:first").attr("value"),
                         "/data/product/item/text",
                         "output value mismatch");
            var errors = _.flatten(_.map([blue, text], function (mug) {
                    return mug.getErrors();
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
                text = util.addQuestion("Text", "text");
            text.p.calculateAttr = blue.hashtagPath;
            blue.p.labelItext.set('<output value="' + text.hashtagPath + '"/>');
            blue.validate("labelItext");
            assert.equal(blue.hashtagPath, "#form/product/item/blue");
            assert.equal(text.hashtagPath, "#form/product/item/text");

            repeat.p.dataSource = {};
            assert.equal(blue.hashtagPath, "#form/product/blue");
            assert.equal(text.hashtagPath, "#form/product/text");
            var xml = util.parseXML(call("createXML")),
                textBind = xml.find("bind[nodeset='" + text.absolutePath + "']");
            assert.equal(
                textBind.attr("calculate"),
                "/data/product/blue",
                textBind.attr("nodeset") + " calculate expression mismatch");
            assert.equal(xml.find("output:first").attr("value"),
                         "/data/product/text",
                         "output value mismatch");
            var errors = _.flatten(_.map([blue, text], function (mug) {
                    return mug.getErrors();
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

        it("should change instance name when editing its sole reference", function () {
            util.loadXML(FIXTURE_REPEAT_XML);
            var repeat = util.getMug("product/item");
            assert.equal(repeat.p.dataSource.instance.id, "products");
            repeat.p.dataSource = {
                instance: {id: "new-name", src: "jr://fixture/commtrack:products"},
                idsQuery: "instance('new-name')/products/product/@id"
            };
            // name should be updated to match existing instance
            assert.deepEqual(repeat.p.dataSource, {
                instance: {id: "new-name", src: "jr://fixture/commtrack:products"},
                idsQuery: "instance('new-name')/products/product/@id"
            });
        });

        it("should change instance when idsQuery changes", function () {
            var form = util.loadXML(FIXTURE_REPEAT_XML),
                repeat = util.getMug("product/item");
            form.updateKnownInstances({"foo": "jr://foo"});
            repeat.p.dataSource = {
                idsQuery: "instance('foo')/products/product/@id"
            };
            var xml = call('createXML'),
                $xml = util.parseXML(xml);
            assert($xml.find("instance[id=foo]").length,
                   "foo instance not found:\n" + xml);
            assert.equal($xml.find("instance[id=products]").length, 0,
                   "somefixture instance not found:\n" + xml);
        });

        it("should sync instance name with existing instance", function () {
            util.loadXML(FIXTURE_REPEAT_XML);
            var repeat = util.getMug("product/item"),
                repeat2 = util.addQuestion("Repeat", "product2");
            repeat2.p.dataSource = {
                instance: {id: "products", src: "jr://fixture/commtrack:products"},
                idsQuery: "instance('products')/products/product/@id"
            };
            assert.equal(repeat.p.dataSource.instance.id, "products");
            assert.equal(repeat2.p.dataSource.instance.id, "products");
            repeat.p.dataSource = {
                instance: {id: "new-name", src: "jr://fixture/commtrack:products"},
                idsQuery: "instance('new-name')/products/product/@id"
            };
            // name should be reverted to match existing instance
            // TODO Maybe all references to the instance should be updated
            // when it is renamed for any question? (more user-friendly, but
            // hard to implement). Currently it is very hard to rename an
            // instance (without editing XML directly) if there are multiple
            // questions in the form referencing the instance.
            assert.deepEqual(repeat.p.dataSource, {
                instance: {id: "products", src: "jr://fixture/commtrack:products"},
                idsQuery: "instance('products')/products/product/@id"
            });
        });

        it("should use jr-insert event for nested model iteration setvalues", function () {
            util.loadXML(FIXTURE_REPEAT_XML);
            var nested = util.addQuestion.bind({prevId: "product/item"})("Repeat", "nested");
            nested.p.dataSource = {
                instance: {id: "products", src: "jr://fixture/commtrack:products"},
                idsQuery: "instance('products')/products/product/@id"
            };
            var xml = call('createXML'),
                $xml = util.parseXML(xml),
                ref = "setvalue[ref='/data/product/";
            assert.equal($xml.find(ref + "@ids']").attr("event"), "xforms-ready",
                   "wrong setvalue event for outer repeat: " + xml);
            assert.equal($xml.find(ref + "item/nested/@ids']").attr("event"), "jr-insert",
                   "wrong setvalue event for nested repeat: " + xml);
        });
    });
});
