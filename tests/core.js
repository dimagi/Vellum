require([
    'chai',
    'jquery',
    'tests/utils'
], function (
    chai,
    $,
    util
) {
    var assert = chai.assert,
        call = util.call;

    describe("Vellum core", function () {
        it("should not allow adding questions with matching paths", function (done) {
            util.init({
                core: {
                    onReady: function () {
                        var mug = util.addQuestion("Text", "question1"),
                            dup = util.addQuestion("Text", "question2");
                        dup.p.nodeID = "question1";

                        // TODO fix tight coupling of this functionality with UI
                        // HACK prevent modal alert in UI
                        this.data.core.isAlertVisible = true;

                        assert(!this.ensureCurrentMugIsSaved(),
                               "save should fail with duplicate question ID");

                        this.data.core.isAlertVisible = false;
                        done();
                    }
                }
            });
        });
    });
});
