/*jshint multistr: true */
require([
    'tests/options',
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
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
    itemset,
    form,
    TEST_XML_1,
    INNER_FILTERS_XML,
    DROPDOWN_FIXTURE_XML
) {

    // see note about controlling time in formdesigner.lock.js
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

        it("adds a new instance node to the form when necessary", function () {
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
            });
        });
    });
});
