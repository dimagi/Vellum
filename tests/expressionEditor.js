define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'vellum/expressionEditor',
], function (
    chai,
    $,
    _,
    util,
    expressionEditor,
) {
    var assert = chai.assert;

    describe("The expression editor", function () {
        var form;
        before(function (done) {
            util.init({
                javaRosa: { langs: ['en'] },
                core: { onReady: function () {
                    form = this.data.core.form;
                    done();
                }},
            });
        });

        it("should trigger change event on join type changed", function () {
            util.loadXML("");
            var div = $("<div>"),
                text = util.addQuestion("Text", "text"),
                opts = makeOptions(text, '#form/text = "1" and #form/text = "yes"');
            expressionEditor.showXPathEditor(div, opts);
            var join = div.find(".top-level-join-select");
            join.val("or").change();
            assert.equal(opts.changed, true, "expected changed flag to be set");
        });

        describe("xpath validator", function () {
            it("should not validate '#invalid/xpath ' prefix", function () {
                var expr = "#invalid/xpath if(`#form/text`",
                    result = expressionEditor.validateXPath(form, expr);
                assert.isNotOk(result[0], JSON.stringify(result));
                assert.include(result[1].message, "if(#form/text");
                assert.notInclude(result[1].message, "#invalid/xpath");
            });
        });
    });

    function makeOptions(mug, value) {
        var opts = {
            mug: mug,
            xpathType: "bool",
            value: value,
            changed: false,
            change: function () { opts.changed = true; },
        };
        return opts;
    }

});
