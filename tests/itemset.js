require([
    'tests/options',
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/datasources',
    'vellum/itemset',
    'vellum/form',
    'text!static/itemset/test1.xml',
    'text!static/itemset/inner-filters.xml',
    'text!static/itemset/dropdown-fixture.xml'
], function (
    options,
    util,
    chai,
    $,
    _,
    datasources,
    itemset,
    form,
    TEST_XML_1,
    INNER_FILTERS_XML,
    DROPDOWN_FIXTURE_XML
) {
    var assert = chai.assert,
        call = util.call,
        clickQuestion = util.clickQuestion,
        plugins = _.union(util.options.options.plugins || [], ["itemset"]);

    describe("The Dynamic Itemset plugin", function () {
        function beforeFn(done) {
            util.init({
                plugins: plugins,
                javaRosa: {langs: ['en']},
                core: {onReady: done},
                features: {advanced_itemsets: false},
            });
        }
        before(beforeFn);
        beforeEach(datasources.reset);

        it("adds a new instance to the form", function () {
            util.loadXML(TEST_XML_1);
            var itemset = util.getMug("question1/itemset");
            itemset.p.itemsetData = {
                instance: {id: "somefixture", src: "jr://somefixture"},
                nodeset: "instance('somefixture')/some/items",
                labelRef: "label",
                valueRef: "value",
            };

            var xml = call('createXML'),
                $xml = $(xml);
            assert($xml.find("instance[id=somefixture]").length,
                   "somefixture instance not found:\n" + xml);
        });

        it("changes instance when nodeset changes", function () {
            var form = util.loadXML(TEST_XML_1),
                itemset = util.getMug("question1/itemset");
            form.updateKnownInstances({"foo": "jr://foo"});
            itemset.p.itemsetData = {
                nodeset: "instance('foo')/some/items",
                labelRef: "label",
                valueRef: "value",
            };

            var xml = call('createXML'),
                $xml = $(xml);
            assert($xml.find("instance[id=foo]").length,
                   "foo instance not found:\n" + xml);
            assert.equal($xml.find("instance[id=casedb]").length, 0,
                   "somefixture instance not found:\n" + xml);
        });

        it("renames instance on add itemset with matching instance", function () {
            util.loadXML(TEST_XML_1);
            util.addQuestion("SelectDynamic", "select2");
            var itemset = util.getMug("select2/itemset");
            itemset.p.itemsetData = {
                instance: {id: "cases", src: "jr://instance/casedb"},
                nodeset: "instance('cases')/cases/case[@case_id > 2]",
                labelRef: "label",
                valueRef: "value",
            };

            var data = itemset.p.itemsetData;
            assert.equal(data.instance.id, "casedb");
            assert.equal(data.instance.src, "jr://instance/casedb");
            assert.equal(data.nodeset, "instance('casedb')/cases/case[@case_id > 2]");
            var xml = call('createXML'),
                $xml = $(xml);
            assert($xml.find("instance[id=casedb]").length,
                   "casedb instance not found:\n" + xml);
            assert($xml.find("instance[id=cases]").length === 0,
                   "cases instance should have been renamed/merged:\n" + xml);
        });

        it("should select first lookup table for new itemset", function () {
            util.loadXML("");
            util.addQuestion("SelectDynamic", "select");
            // HACK must click on the itemset node to start async load, which
            // eventually sets the default value if everything goes well.
            util.clickQuestion("select/itemset");
            var mug = util.getMug('select/itemset');
            mug.validate();
            assert.equal(util.getMessages(mug), "");
        });

        it("should load dynamic select without errors", function () {
            util.loadXML(TEST_XML_1);
            var mug = util.getMug('question1/itemset');
            mug.validate();
            assert.equal(util.getMessages(mug), "");
        });

        it("should not trigger change on click itemset", function () {
            util.loadXML(TEST_XML_1);
            util.saveButtonEnabled(false);
            clickQuestion('question1/itemset');
            assert(!util.saveButtonEnabled(), "save button should not be enabled");
        });

        describe("parsing and serializing", function () {
            before(beforeFn);
            it("preserves XML with itemsets in <select>s", function () {
                assert(TEST_XML_1.indexOf('select1') !== -1);
                util.loadXML(TEST_XML_1);
                util.assertXmlEqual(call('createXML'), TEST_XML_1);
            });

            it("preserves XML with itemsets in <select1>s", function () {
                var newXml = TEST_XML_1.replace(/select1/g, 'select');
                util.loadXML(newXml);
                util.assertXmlEqual(call('createXML'), newXml);
            });
        });

        describe("UI", function () {
            it("preserves inner filters if you never change the data source", function () {
                util.loadXML(INNER_FILTERS_XML);
                clickQuestion("question2/itemset");
                $("[name='label_ref']").val("dummy").change();

                util.assertXmlEqual(
                    INNER_FILTERS_XML.replace('case_name', 'dummy'),
                    call('createXML')
                );
            });

            it("uses a dropdown when the nodeset is known", function() {
                util.loadXML(DROPDOWN_FIXTURE_XML);
                clickQuestion("question2/itemset");

                assert($('[name=property-itemsetData]').is('select'));
            });

            describe("with a custom fixture", function() {
                it("should not warn on unrecognized values and labels", function() {
                    util.loadXML(DROPDOWN_FIXTURE_XML);
                    var mug = util.getMug('/data/question2/itemset');
                    assert.strictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
                    mug.p.itemsetData.instance.src = "blah";
                    assert.strictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
                });
            });

            describe("with recognized fixture", function() {
                it("should warn on unrecognized values and labels", function() {
                    util.loadXML(DROPDOWN_FIXTURE_XML);
                    var mug = util.getMug('/data/question2/itemset');
                    assert.strictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
                    clickQuestion("question2/itemset");
                    $('[name=value_ref]').val('blah').change();
                    assert.notStrictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
                });

                it("should not warn on values with a filter attached", function() {
                    util.loadXML(DROPDOWN_FIXTURE_XML);
                    var mug = util.getMug('/data/question2/itemset');
                    assert.strictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
                    clickQuestion("question2/itemset");
                    var value = $('[name=value_ref]');
                    value.val(value.val() + "[filter]").change();
                    assert.strictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
                });

                it("should not warn on labels with a filter attached", function() {
                    util.loadXML(DROPDOWN_FIXTURE_XML);
                    var mug = util.getMug('/data/question2/itemset');
                    assert.strictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
                    clickQuestion("question2/itemset");
                    var label = $('[name=label_ref]');
                    label.val(label.val() + "[filter]").change();
                    assert.strictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
                });

                it("should not warn on inner filters", function() {
                    util.loadXML(DROPDOWN_FIXTURE_XML);
                    var mug = util.getMug('/data/question2/itemset');
                    assert.strictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
                    clickQuestion("question2/itemset");
                    $('[name=label_ref]').val("inner-attribute[filter1]/extra-inner-attribute[filter2]").change();
                    assert.strictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
                });
            });
        });
    });
});
