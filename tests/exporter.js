/*jshint multistr: true */
require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/all_question_types.xml',
    'text!static/all_question_types.tsv'
], function (
    chai,
    $,
    _,
    util,
    ALL_QUESTIONS_XML,
    ALL_QUESTIONS_TSV
) {
    var assert = chai.assert,
        call = util.call,
        plugins = util.options.options.plugins || [],
        pluginsWithItemset = _.union(plugins, ["itemset"]),
        pluginsWithoutItemset = _(plugins).without("itemset");

    describe("The exporter", function () {
        beforeEach(function (done) {
            util.init({
                core: {
                    onReady: function () {
                        done();
                    }
                }
            });
        });

        it("should include question type in TSV", function () {
            call("loadXML", ALL_QUESTIONS_XML);
            assert.equal(call("getData").core.form.getExportTSV(), ALL_QUESTIONS_TSV);
        });
    });
});
