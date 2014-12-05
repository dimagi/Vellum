require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/modeliteration/case-list-iteration.xml',
    'tests/modeliteration'
], function (
    chai,
    $,
    _,
    util,
    CASE_LIST_REPEAT_XML
) {
    var assert = chai.assert,
        call = util.call,
        plugins = util.options.options.plugins || [],
        pluginsWithModelIteration = _.union(plugins, ["modeliteration"]);

    describe("The model repeat plugin", function () {
        before(function (done) {
            util.init({
                plugins: pluginsWithModelIteration,
                javaRosa: { langs: ['en'] },
                core: {
                    onReady: function () {
                        assert(this.isPluginEnabled("modeliteration"),
                               "modeliteration plugin should be enabled");
                        done();
                    }
                }
            });
        });

        it("should load a case list repeat", function () {
            util.loadXML(CASE_LIST_REPEAT_XML);
            var repeat = util.getMug("child");
            assert.deepEqual(repeat.p.iterationParams, {
                ids: "join(' ', instance('casedb')/mother/child/@case_id)",
                count: "count-selected(/data/child/@ids)",
                current_index: "count(/data/child/item)",
                index: "int(/data/child/@current_index)",
                id: "selected-at(/data/child/@ids,../@index)"
            });
            util.assertXmlEqual(call("createXML"), CASE_LIST_REPEAT_XML);
        });
    });
});
