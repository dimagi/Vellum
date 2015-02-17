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

    describe("The Dynamic Itemset functionality", function () {
        function beforeFn(done) {
            util.init({
                plugins: plugins,
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        }

        describe("The itemset parsing and serializing", function () {
            beforeEach(beforeFn);
            it("preserves XML with itemsets in <select>s", function (done) {
                assert(TEST_XML_1.indexOf('select1') !== -1);
                call('loadXFormOrError', TEST_XML_1, function () {
                    util.assertXmlEqual(call('createXML'), TEST_XML_1);
                    done();
                });
            });

            it("preserves XML with itemsets in <select1>s", function (done) {
                var newXml = TEST_XML_1.replace(/select1/g, 'select');
                call('loadXFormOrError', newXml, function () {
                    util.assertXmlEqual(call('createXML'), newXml);
                    done();
                });
            });
        });

        describe("The itemset UI", function () {
            beforeEach(beforeFn);
            it("adds a new instance node to the form when necessary", function (done) {
                call('loadXFormOrError', TEST_XML_1, function () {
                    clickQuestion("question1/itemset");
                    $("[name='data_source']").val("somefixture");
                    $("[name='value_ref'], [name='label_ref'], [name='filter_condition']")
                        .val("dummy").change();

                    var xml = call('createXML');
                    assert(xml.indexOf(
                            '<instance src="jr://fixture/some-fixture" id="somefixture" />'
                        ) !== -1 ||
                        xml.indexOf(
                            '<instance id="somefixture" src="jr://fixture/some-fixture" />'
                        ));
                    done();
                });
            });

            it("preserves inner filters if you never change the data source", function (done) {
                call('loadXFormOrError', INNER_FILTERS_XML, function () {
                    clickQuestion("question2/itemset");
                    $("[name='label_ref']").val("dummy").change();

                    util.assertXmlEqual(INNER_FILTERS_XML.replace('case_name', 'dummy'),
                       call('createXML'));
                    done();
                });
            });
            
            it("hides the copy button for itemsets", function (done) {
                call('loadXFormOrError', TEST_XML_1, function () {
                    clickQuestion("question1/itemset");
                    var $but = $("button:contains(Copy)");
                    assert($but.length === 0);
                    done();
                });
            });

            it("allows copying a select with an itemset", function (done) {
                call('loadXFormOrError', TEST_XML_1, function () {
                    clickQuestion("question1");
                    var $but = $("button:contains(Copy)");
                    $but.click();

                    assert.equal(4, (call('createXML').match(/itemset/g) || []).length);
                    done();
                });
            });
        });

    });
});
