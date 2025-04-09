define([
    'tests/options',
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/itemset',
    'vellum/form',
    'static/itemset/test1.xml',
    'static/itemset/inner-filters.xml'
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

    var assert = chai.assert,
        call = util.call,
        clickQuestion = util.clickQuestion,
        plugins = _.union(util.options.options.plugins || [], ["itemset"]);

    describe("The Advanced Itemset plugin", function () {
        function beforeFn(done) {
            util.init({
                plugins: plugins,
                javaRosa: {langs: ['en']},
                core: {onReady: function () { done(); }},
                features: {
                    advanced_itemsets: true,
                }
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
                $xml = util.parseXML(xml);
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
                $xml = util.parseXML(xml);
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
                $("[name=property-labelRef]").val("dummy").change();

                util.assertXmlEqual(
                    INNER_FILTERS_XML.replace('case_name', 'dummy'),
                    call('createXML')
                );
            });

            it("includes filter when in advanced mode", function() {
                util.loadXML(TEST_XML_1);
                clickQuestion("question1/itemset");
                var mug = util.getMug("question1/itemset");
                mug.p.filter = "'blah' = /data/question2";
                $("button:contains(...)").click();
                assert($('[name=query]').val().indexOf(mug.p.filter) > 1);
            });

            it("changes filter when in advanced mode", function() {
                util.loadXML(TEST_XML_1);
                clickQuestion("question1/itemset");

                var mug = util.getMug("question1/itemset");
                mug.p.filter = "'blah' = /data/question2";
                $("button:contains(...)").click();

                var query = $('[name=query]').val();
                $('[name=query]').val(query.replace(/question2/, "no_question")).change();
                $('.fd-data-source-save-button').click();

                assert.strictEqual(mug.p.filter,
                                   "'blah' = /data/no_question");
            });
        });
    });
});
