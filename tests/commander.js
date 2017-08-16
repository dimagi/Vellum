define([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/commander',
], function (
    util,
    chai,
    $,
    _,
    commander
) {
    var assert = chai.assert;

    describe("The commander plugin", function() {
        var vellum;
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: function() {
                    vellum = this;
                    done();
                }},
            });
        });

        _.each([
            {cmd: "text", type: "Text"},
            {cmd: "choice"},
        ], function (args) {
            it("should add a " + args.type + " question with '" + args.cmd + "'", function () {
                util.loadXML();
                var result = commander.doCommand(args.cmd, vellum);
                if (args.hasOwnProperty("type")) {
                    assert.isOk(result, "question not added");
                    $("[name=property-nodeID]").val("new").change();
                    vellum.ensureCurrentMugIsSaved();
                    util.assertJSTreeState("new");
                    var mug = util.getMug("new");
                    assert.equal(mug.__className, args.type);
                } else {
                    assert.isNotOk(result, "question added unexpectedly");
                    assert.isNotOk(util.getMug("new"),
                        "'new' question should not exist");
                }
            });
        });

        _.each(["text", "choice"], function (name) {
            it("should have '" + name + "' in it's question map", function () {
                assert.hasAnyKeys(commander.getQuestionMap(vellum), [name]);
            });
        });

        it("should not have 'itemset' in it's question map", function () {
            assert.doesNotHaveAnyKeys(commander.getQuestionMap(vellum), ["itemset"]);
        });
    });
});
