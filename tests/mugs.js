define([
    'tests/utils',
    'chai',
    'jquery',
], function (
    util,
    chai,
    $
) {
    var assert = chai.assert;

    describe("Mugs et al", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        });

        it("should coalesce change events inside _withMessages", function() {
            util.loadXML("");
            var mug = util.addQuestion("Text"),
                id = 1,
                changes = 0,
                changed;
            mug.on("messages-changed", function () {
                changes += 1;
            });
            function msg() {
                mug.addMessage(null, {
                    key: "test-message",
                    level: mug.ERROR,
                    message: "testing " + id++,
                });
            }

            assert.equal(changes, 0);
            changed = mug._withMessages(function () {
                msg();
                msg();
                assert.equal(changes, 0);
            });
            assert(changed, "not changed!");
            assert.equal(changes, 1);

            msg();
            msg();
            assert.equal(changes, 3);
        });
    });
});
