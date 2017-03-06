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
    expressionEditor
) {
    var assert = chai.assert;

    describe("The expression editor xpath validator", function () {
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

        it("should not validate '#invalid/xpath ' prefix", function () {
            var expr = "#invalid/xpath if(`#form/text`",
                result = expressionEditor.validateXPath(form, expr);
            assert.isNotOk(result[0], JSON.stringify(result));
            assert.include(result[1].message, "if(#form/text");
            assert.notInclude(result[1].message, "#invalid/xpath");
        });
    });
});
