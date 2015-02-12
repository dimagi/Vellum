define([
    'tests/utils',
    'chai',
    'jquery',
    'vellum/form'
], function (
    util,
    chai,
    $,
    form_
) {
    var assert = chai.assert;

    describe("IText widgets", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        });

        it("should have a placeholder for help text", function () {
            util.loadXML("");
            util.addQuestion("Text", "text");
            var enLabel = $("[name='itext-en-help']");
            assert.equal(enLabel.val(), "");
            assert.equal(enLabel.attr("placeholder"), "Android only");
        });
    });
});
