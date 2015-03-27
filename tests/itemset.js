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
    'text!static/itemset/inner-filters.xml'
], function (
    options,
    util,
    chai,
    $,
    _,
    itemset,
    form,
    TEST_XML_1,
    INNER_FILTERS_XML
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
                core: {onReady: done}
            });
        }
        before(beforeFn);

        it("adds a new instance node to the form when necessary", function () {
            util.loadXML(TEST_XML_1);
            var itemset = util.getMug("question1/itemset");
            itemset.p.itemsetData = {
                instance: {id: "somefixture", src: "jr://somefixture"},
                nodeset: "instance('somefixture')/some/items",
            };
            itemset.p.itemsetValue = 'value';
            itemset.p.itemsetLabel = 'label';

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
            };
            itemset.p.itemsetValue = 'value';
            itemset.p.itemsetLabel = 'label';

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
            before(beforeFn);
            it("preserves inner filters if you never change the data source", function () {
                util.loadXML(INNER_FILTERS_XML);
                clickQuestion("question2/itemset");
                $("[name='property-itemsetLabel']").val("dummy").change();

                util.assertXmlEqual(
                    INNER_FILTERS_XML.replace('case_name', 'dummy'),
                    call('createXML')
                );
            });
            
            it("hides the copy button for itemsets", function () {
                util.loadXML(TEST_XML_1);
                clickQuestion("question1/itemset");
                var $but = $("button:contains(Copy)");
                assert($but.length === 0);
            });

            it("allows copying a select with an itemset", function () {
                util.loadXML(TEST_XML_1);
                clickQuestion("question1");
                var $but = $("button:contains(Copy)");
                $but.click();

                assert.equal(4, (call('createXML').match(/itemset/g) || []).length);
            });
        });
    });
});
