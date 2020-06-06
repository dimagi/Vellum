define([
    'tests/options',
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/datasources',
    'vellum/itemset',
    'vellum/form',
    'vellum/xml',
    'text!static/itemset/test1.xml',
    'text!static/itemset/test1-with-constraint.xml',
    'text!static/itemset/test1-with-appearance.xml',
    'text!static/itemset/inner-filters.xml',
    'text!static/itemset/itemset-sort.xml',
    'text!static/itemset/dropdown-fixture.xml',
    'text!static/itemset/data-itemset.xml',
    'text!static/itemset/filter-with-case-property.xml',
    'text!static/itemset/itemset-with-question-ref.xml',
], function (
    options,
    util,
    chai,
    $,
    _,
    datasources,
    itemset,
    form,
    xml,
    TEST_XML_1,
    TEST_XML_1_WITH_CONSTRAINT,
    TEST_XML_1_WITH_APPEARANCE,
    INNER_FILTERS_XML,
    ITEMSET_SORT_XML,
    DROPDOWN_FIXTURE_XML,
    DATA_ITEMSET_XML,
    FILTER_WITH_CASE_PROPERTY,
    ITEMSET_WITH_QUESTION_REF_XML
) {
    var assert = chai.assert,
        call = util.call,
        clickQuestion = util.clickQuestion,
        parseXML = xml.parseXML,
        plugins = _.union(util.options.options.plugins || [], ["itemset"]);

    describe("The Dynamic Itemset plugin", function () {
        function beforeFn(done) {
            util.init({
                plugins: plugins,
                javaRosa: {langs: ['en']},
                core: {onReady: function () {
                    vellum = this;
                    done();
                }},
                features: {
                    lookup_tables: true,
                    advanced_itemsets: false,
                },
            });
        }
        var vellum;
        before(beforeFn);
        beforeEach(function () { vellum.datasources.reset(); });

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
                $xml = $(parseXML(xml));
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
                $xml = $(parseXML(xml));
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
                $xml = $(parseXML(xml));
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

        it("should populate itemset nodeset and refs on add single select", function () {
            util.loadXML("");
            util.addQuestion("SelectDynamic", "select");
            var xml = call('createXML'),
                $xml = $(parseXML(xml)),
                itemset = $xml.find("itemset");
            assert.equal(itemset.attr("nodeset"),
                "instance('some-fixture')/some-fixture_list/some-fixture");
            assert(itemset.find("label").attr("ref"), "name");
            assert(itemset.find("value").attr("ref"), "@id");
        });

        it("should add sort element when sort field has a value", function () {
            util.loadXML("");
            util.addQuestion("SelectDynamic", "select");
            clickQuestion("select/itemset");
            var mug = util.getMug("select/itemset");
            $("[name=property-sortRef]").val("@id").change();
            assert.equal(mug.p.sortRef, "@id");
            var xml = call('createXML'),
                $xml = $(parseXML(xml)),
                itemset = $xml.find("itemset");
            assert.equal(itemset.find("sort").attr("ref"), "@id");
        });

        it("should load dynamic select with sort element", function () {
            util.loadXML(ITEMSET_SORT_XML);
            var mug = util.getMug("select/itemset");
            assert.equal(mug.p.sortRef, "inner-attribute");
            clickQuestion("select/itemset");
            assert.equal($("[name=property-sortRef]").val(), "inner-attribute");
            util.assertXmlEqual(call('createXML'), ITEMSET_SORT_XML, {normalize_xmlns: true});
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

        it("should save the hashtag format correctly", function() {
            util.loadXML("");
            util.addQuestion("Text", 'state');
            util.addQuestion("SelectDynamic", 'district');
            util.clickQuestion('district/itemset');
            var itemset = util.getMug("district/itemset");
            itemset.p.itemsetData = {
                instance: itemset.p.itemsetData.instance,
                nodeset:  itemset.p.itemsetData.nodeset + '[name = /data/state]',
                labelRef: "name",
                valueRef: "@id",
            };

            util.assertXmlEqual(call('createXML'), ITEMSET_WITH_QUESTION_REF_XML, {normalize_xmlns: true});
        });

        it("should include filter usage in logic manager", function () {
            var form = util.loadXML(ITEMSET_WITH_QUESTION_REF_XML);
            assert.deepEqual(form.findUsages(),
                {
                    "#form/state": {
                        "#form/district": "Filter"
                    }
                }
            );
        });

        it("should update sortRef on paste dynamic select with sorted itemset", function () {
            var data = [
                ["id", "type", "labelItext:en-default", "instances", "itemsetData"],
                ["/select", "SelectDynamic", "select",
                 '{"foo":{"src":"jr://foo"}}',
                 '[{"instance":{"id":"foo","src":"jr://foo"},' +
                   '"nodeset":"instance(\'foo\')/foo/items","labelRef":"@name","valueRef":"@id","sortRef":"name"}]'],
            ];
            util.loadXML("");
            util.paste(data);
            assert.equal(util.getMug("select/itemset").p.sortRef, "name");
        });

        describe("without access to lookup tables", function() {
            before(function (done) {
                util.init({
                    plugins: plugins,
                    javaRosa: {langs: ['en']},
                    core: {onReady: done},
                    features: {
                        lookup_tables: false,
                        advanced_itemsets: false,
                        rich_text: false
                    },
                });
            });

            it("should display an error on an itemset", function() {
                util.loadXML(TEST_XML_1);
                var mug = util.getMug('question1/itemset');
                assert.notStrictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
            });
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

            it("preserves XML with a constraint", function() {
                util.loadXML(TEST_XML_1_WITH_CONSTRAINT);
                util.assertXmlEqual(call('createXML'), TEST_XML_1_WITH_CONSTRAINT);
            });

            it("preserves XML with an appearance", function() {
                util.loadXML(TEST_XML_1_WITH_APPEARANCE);
                util.assertXmlEqual(call('createXML'), TEST_XML_1_WITH_APPEARANCE);
            });
        });

        describe("UI", function () {
            it("preserves inner filters if you never change the data source", function () {
                util.loadXML(INNER_FILTERS_XML);
                clickQuestion("question2/itemset");
                $("[name=property-labelRef]").val("dummy").change();

                util.assertXmlEqual(
                    INNER_FILTERS_XML.replace('case_name', 'dummy'),
                    call('createXML')
                );
            });

            it("correctly parses filter with reference to case property", function () {
                util.loadXML(FILTER_WITH_CASE_PROPERTY);
                var mug = util.getMug("lookup/itemset");
                assert.equal(mug.p.filter, "name = #case/dob");
            });

            it("uses a dropdown when the nodeset is known", function() {
                util.loadXML(DROPDOWN_FIXTURE_XML);
                clickQuestion("question2/itemset");

                assert($('[name=property-itemsetData]').is('select'));
            });

            describe("with a /data/ fixture", function() {
                it("doesn't warn on no src", function() {
                    util.loadXML(DATA_ITEMSET_XML);
                    var mug = util.getMug('/data/itemset/itemset');
                    assert.strictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
                });
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
                    $('[name=property-valueRef]').val('blah').change();
                    assert.notStrictEqual(mug.spec.valueRef.validationFunc(mug), 'pass');
                });

                it("should not warn on values with a filter attached", function() {
                    util.loadXML(DROPDOWN_FIXTURE_XML);
                    var mug = util.getMug('/data/question2/itemset');
                    assert.strictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
                    clickQuestion("question2/itemset");
                    var value = $('[name=property-valueRef]');
                    value.val(value.val() + "[filter]").change();
                    assert.strictEqual(mug.spec.valueRef.validationFunc(mug), 'pass');
                });

                it("should not warn on labels with a filter attached", function() {
                    util.loadXML(DROPDOWN_FIXTURE_XML);
                    var mug = util.getMug('/data/question2/itemset');
                    assert.strictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
                    clickQuestion("question2/itemset");
                    var label = $('[name=property-labelRef]');
                    label.val(label.val() + "[filter]").change();
                    assert.strictEqual(mug.spec.labelRef.validationFunc(mug), 'pass');
                });

                it("should not warn on inner filters", function() {
                    util.loadXML(DROPDOWN_FIXTURE_XML);
                    var mug = util.getMug('/data/question2/itemset');
                    assert.strictEqual(mug.spec.itemsetData.validationFunc(mug), 'pass');
                    clickQuestion("question2/itemset");
                    $('[name=property-labelRef]').val("inner-attribute[filter1]/extra-inner-attribute[filter2]").change();
                    assert.strictEqual(mug.spec.labelRef.validationFunc(mug), 'pass');
                });
            });
        });
    });

    describe("The Dynamic Itemset plugin with no fixtures", function () {
        var DATA_SOURCES = [{id: "ignored", uri: "jr://not-a-fixture"}],
            vellum;
        before(function (done) {
            util.init({
                plugins: plugins,
                javaRosa: {langs: ['en']},
                core: {
                    dataSourcesEndpoint: function (callback) { callback(DATA_SOURCES); },
                    onReady: function () {
                        vellum = this;
                        done();
                    },
                },
                features: {lookup_tables: true},
            });
        });
        beforeEach(function () { vellum.datasources.reset(); });

        it("should be able to configure Lookup Table Data", function() {
            util.addQuestion("SelectDynamic", "select");
            util.clickQuestion("select/itemset");  // should not throw exception
            assert.equal($("[name=property-itemsetData]").length, 1);
        });
    });
});
