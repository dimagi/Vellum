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

            it("doesn't preserve inner filters if you change the data source", function (done) {
                call('loadXFormOrError', INNER_FILTERS_XML, function () {

                    clickQuestion("question2/itemset");
                    var origSource = $("[name='data_source']").val(),
                        valueRef = $("[name='value_ref']").val(),
                        labelRef = $("[name='label_ref']").val(),
                        filter = $("[name='filter_condition']").val();
                    $("[name='data_source']").val("casedb").change()
                        .val(origSource).change();
                    $("[name='value_ref']").val(valueRef).change();
                    $("[name='label_ref']").val(labelRef).change();
                    $("[name='filter_condition']").val(filter).change();

                    util.assertXmlNotEqual(INNER_FILTERS_XML, call('createXML'));
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

        var TEST_INSTANCES = _.indexBy(
                _.map(options.instances, form.processInstance),
                'defaultId'),
            getSourceData = itemset.getSourceData;

        describe("The nodeset parsing", function () {
            it("recognizes a plain instance", function () {
                assert.deepEqual(
                    getSourceData("instance('casedb')/casedb/case", 
                        TEST_INSTANCES), 
                    {
                        instanceId: 'casedb',
                        levels: [{
                            subsetId: false,
                            condition: false
                        }]
                    }
                );
            });

            it("recognizes a filter", function () {
                assert.deepEqual(
                    getSourceData(
                        "instance('casedb')/casedb/case[foo='bar' and 1=1]",
                        TEST_INSTANCES),
                    {
                        instanceId: 'casedb',
                        levels: [{
                            subsetId: false,
                            condition: "foo='bar' and 1=1"
                        }]
                    }
                );
            });

            it("recognizes a subset", function () {
                assert.deepEqual(
                    getSourceData(
                        "instance('casedb')/casedb/case[@case_type='mother']", 
                        TEST_INSTANCES),
                    {
                        instanceId: 'casedb',
                        levels: [{
                            subsetId: 1,
                            condition: false
                        }]
                    });
            });

            it("recognizes a subset then a filter, normalizing spaces and quotes", function () {
                assert.deepEqual(
                    getSourceData(
                        "instance('casedb')/casedb/case[ @case_type = 'mother' ][ foo  = 'bar' and 1 = 1]",
                        TEST_INSTANCES),
                    {
                        instanceId: 'casedb',
                        levels: [{
                            subsetId: 1,
                            condition: "foo='bar' and 1=1"
                        }]
                    });
            });
            
            it("recognizes a filter then a subset", function () {
                assert.deepEqual(
                    getSourceData(
                        "instance('casedb')/casedb/case[foo='bar' and 1=1][@case_type='mother']",
                        TEST_INSTANCES),
                    {
                        instanceId: 'casedb',
                        levels: [{
                            subsetId: 1,
                            condition: "foo='bar' and 1=1"
                        }]
                    });
            });

            it("recognizes subsets and multiple filters on multiple levels", function () {
                assert.deepEqual(
                    getSourceData(
                        "instance('somefixture')/somefixture/" +
                        "foo[some_prop=1][@foo_type='woo']/" + 
                        "bar[@bar_type='eggs'][other_prop=9][asdf=2]", TEST_INSTANCES),
                    {
                        instanceId: 'somefixture',
                        levels: [
                            {
                                subsetId: 1,
                                condition: "some_prop=1"
                            },
                            {
                                subsetId: 1,
                                condition: "(other_prop=9) and (asdf=2)"
                            }
                        ]
                    });
            });

            it("recognizes an instance ref with only some of the levels", function () {
                assert.deepEqual(
                    getSourceData(
                        "instance('somefixture')/somefixture/foo", TEST_INSTANCES),
                    {
                        instanceId: 'somefixture',
                        levels: [
                            {
                                subsetId: false,
                                condition: false
                            }
                        ]
                    });
            });
        });
    });
});
