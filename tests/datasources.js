/*jshint multistr: true */
require([
    'tests/options',
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/itemset',
    'vellum/form'
], function (
    options,
    util,
    chai,
    $,
    _,
    itemset,
    form
) {

    // see note about controlling time in formdesigner.lock.js
    var assert = chai.assert,
        clickQuestion = util.clickQuestion,
        plugins = _.union(util.options.options.plugins || [], ["itemset"]),
        NUM_FIXTURE_OPTIONS = 3, // Will need to change as tests/options is updated
        NUM_OPTIONS = NUM_FIXTURE_OPTIONS; 

    describe("The data source widget", function () {
        function beforeFn(done) {
            util.init({
                plugins: plugins,
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        }
        before(beforeFn);

        it("displays nested structures", function() {
            util.loadXML("");
            util.addQuestion("SelectDynamic", "select1");
            clickQuestion('select1/itemset');
            assert.equal($('[name=property-itemsetData] option').size(), NUM_OPTIONS + 1);
        });

        it("does not show options with no_option specified", function() {
            util.loadXML("");
            util.addQuestion("SelectDynamic", "select1");
            clickQuestion('select1/itemset');
            assert.equal($('[name=property-itemsetData] option').size(), NUM_OPTIONS + 1);
        });

        it("removes the nothing selected option", function() {
            util.loadXML("");
            util.addQuestion("SelectDynamic", "select1");
            clickQuestion('select1/itemset');
            var select = $('[name=property-itemsetData]'),
                firstOption = select.find('option').first().val();
            assert.equal($('[name=property-itemsetData] option').size(), NUM_OPTIONS + 1);
            select.val(firstOption).change();
            clickQuestion('select1/itemset');
            assert.equal($('[name=property-itemsetData] option').size(), NUM_OPTIONS);
        });

        it("displays pretty names specified with name attribute", function() {
            util.loadXML("");
            util.addQuestion("SelectDynamic", "select1");
            clickQuestion('select1/itemset');
            assert.equal($('[name=property-itemsetData] option').first().text(), 'some-fixture-name');
        });
    });
});
