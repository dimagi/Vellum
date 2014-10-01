define([
    'tests/utils',
    'chai',
    'jquery',
    'text!static/form/question-referencing-other.xml'
], function (
    util,
    chai,
    $,
    QUESTION_REFERENCING_OTHER_XML
) {
    var assert = chai.assert,
        call = util.call;

    describe("The form component", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        });

        it("should show warnings for broken references on delete mug", function (done) {
            call('loadXFormOrError', QUESTION_REFERENCING_OTHER_XML, function () {
                var blue = call("getMugByPath", "/data/blue"),
                    green = call("getMugByPath", "/data/green"),
                    black = call("getMugByPath", "/data/black");
                assert(util.isTreeNodeValid(green), "sanity check failed: green is invalid");
                assert(util.isTreeNodeValid(black), "sanity check failed: black is invalid");
                util.clickQuestion("blue");
                blue.form.removeMugFromForm(blue);
                assert(util.isTreeNodeValid(green), "green should be valid");
                assert(!util.isTreeNodeValid(black), "black should not be valid");
                done();
            });
        });

    });
});
