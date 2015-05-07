/*jshint multistr: true */
require([
    'tests/options',
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/form',
    'text!static/markdown/markdown-test.xml',
    'text!static/markdown/simple-markdown.xml'
], function (
    options,
    util,
    chai,
    $,
    _,
    form,
    MARKDOWN_TEST_XML,
    SIMPLE_MARKDOWN_XML
) {

    // see note about controlling time in formdesigner.lock.js
    var assert = chai.assert,
        call = util.call,
        clickQuestion = util.clickQuestion;

    describe("The markdown widget", function () {
        function beforeFn(done) {
            util.init({
                javaRosa: {langs: ['en', 'hin']},
                core: {onReady: done}
            });
        }
        before(beforeFn);

        it("should parse form that has markdown", function() {
            util.loadXML(MARKDOWN_TEST_XML);
            var mug = util.getMug('/data/markdown_question');
            assert(mug.p.labelItext.hasMarkdown);
        });

        it("should write markdown if a form has markdown", function() {
            util.loadXML("");
            var mug = util.addQuestion("Text", 'markdown_question');
            $('[name=itext-en-label]').val("**some markdown**").change();
            util.assertXmlEqual(call('createXML'), SIMPLE_MARKDOWN_XML, {normalize_xmlns: true});
        });

        it("should display markdown that includes markdown", function () {
            util.loadXML(MARKDOWN_TEST_XML);
        });
        it("should be able to disable markdown", function () {});
        it("should not display markdown that user has specified no markdown", function () {}); // also write
        it("should not display markdown when it contains no markdown characters", function () {}); // also write
        it("should detect markdown as user enters text", function () {});
        it("renders bold correctly", function () {});
        it("renders italics correctly", function () {});
        it("renders unordered list correctly", function () {});
        it("renders ordered list correctly", function () {});
        it("", function () {});
        it("", function () {});
        it("", function () {});
        //     util.loadXML(TEST_XML_1);
        //     var itemset = util.getMug("question1/itemset");
        //     itemset.p.itemsetData = {
        //         instance: {id: "somefixture", src: "jr://somefixture"},
        //         nodeset: "instance('somefixture')/some/items",
        //         labelRef: "label",
        //         valueRef: "value",
        //     };
        //
        //     var xml = call('createXML'),
        //         $xml = $(xml);
        //     assert($xml.find("instance[id=somefixture]").length,
        //            "somefixture instance not found:\n" + xml);
        // });
        //
        // it("renames instance on add itemset with matching instance", function () {
        //     util.loadXML(TEST_XML_1);
        //     util.addQuestion("SelectDynamic", "select2");
        //     var itemset = util.getMug("select2/itemset");
        //     itemset.p.itemsetData = {
        //         instance: {id: "cases", src: "jr://instance/casedb"},
        //         nodeset: "instance('cases')/cases/case[@case_id > 2]",
        //         labelRef: "label",
        //         valueRef: "value",
        //     };
        //
        //     var data = itemset.p.itemsetData;
        //     assert.equal(data.instance.id, "casedb");
        //     assert.equal(data.instance.src, "jr://instance/casedb");
        //     assert.equal(data.nodeset, "instance('casedb')/cases/case[@case_id > 2]");
        //     var xml = call('createXML'),
        //         $xml = $(xml);
        //     assert($xml.find("instance[id=casedb]").length,
        //            "casedb instance not found:\n" + xml);
        //     assert($xml.find("instance[id=cases]").length === 0,
        //            "cases instance should have been renamed/merged:\n" + xml);
        // });
        //
        // describe("parsing and serializing", function () {
        //     before(beforeFn);
        //     it("preserves XML with itemsets in <select>s", function () {
        //         assert(TEST_XML_1.indexOf('select1') !== -1);
        //         util.loadXML(TEST_XML_1);
        //         util.assertXmlEqual(call('createXML'), TEST_XML_1);
        //     });
        //
        //     it("preserves XML with itemsets in <select1>s", function () {
        //         var newXml = TEST_XML_1.replace(/select1/g, 'select');
        //         util.loadXML(newXml);
        //         util.assertXmlEqual(call('createXML'), newXml);
        //     });
        // });
        //
        // describe("UI", function () {
        //     before(beforeFn);
        //     it("preserves inner filters if you never change the data source", function () {
        //         util.loadXML(INNER_FILTERS_XML);
        //         clickQuestion("question2/itemset");
        //         $("[name='label_ref']").val("dummy").change();
        //
        //         util.assertXmlEqual(
        //             INNER_FILTERS_XML.replace('case_name', 'dummy'),
        //             call('createXML')
        //         );
        //     });
        //     
        //     it("hides the copy button for itemsets", function () {
        //         util.loadXML(TEST_XML_1);
        //         clickQuestion("question1/itemset");
        //         var $but = $("button:contains(Copy)");
        //         assert($but.length === 0);
        //     });
        //
        //     it("allows copying a select with an itemset", function () {
        //         util.loadXML(TEST_XML_1);
        //         clickQuestion("question1");
        //         var $but = $("button:contains(Copy)");
        //         $but.click();
        //
        //         assert.equal(4, (call('createXML').match(/itemset/g) || []).length);
        //     });
        //
        //     it("shows validation error on navigate away from blank External Data", function () {
        //         util.loadXML();
        //         util.addQuestion("SelectDynamic", "select2");
        //         var itemset = util.getMug("select2/itemset");
        //         clickQuestion("select2/itemset");
        //         assert(util.isTreeNodeValid(itemset), "itemset should be valid");
        //         clickQuestion("select2");
        //         assert(!util.isTreeNodeValid(itemset), "itemset should not be valid");
        //     });
        // });
    });
});
