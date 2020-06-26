define([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'text!static/mugs/blank-choice.xml',
], function (
    util,
    chai,
    $,
    _,
    BLANK_CHOICE_XML
) {
    var assert = chai.assert;

    describe("Mugs", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: function () { done(); }},
                features: {rich_text: false},
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

        it("at the top level should not be named meta", function() {
            var data = [
                    ["id", "type"],
                    ["meta", "Group"],
                    ["meta/meta", "Text"],
                    ["group", "Group"],
                    ["group/meta", "Group"],
                ];
            util.loadXML("");
            util.paste(data);
            _.each(data.slice(1), function (row) {
                var mug = util.getMug(row[0]),
                    messages = mug.messages.get("nodeID");
                if (/\bmeta$/.test(mug.p.nodeID)) {
                    assert.deepEqual(messages, ["'meta' is not a valid Question ID."]);
                } else {
                    assert.deepEqual(messages, []);
                }
            });
        });

        it("should have a function to tell if referenced by other mugs", function () {
            var data = [
                    ["id", "type", "relevantAttr"],
                    ["red", "Text", ""],
                    ["blue", "Text", "#form/red = '1'"],
                ];
            util.loadXML("");
            util.paste(data);
            var red = util.getMug("red"),
                blue = util.getMug("blue");
            assert.isNotOk(blue.isReferencedByOtherMugs(), "blue should not be referenced");
            assert.isOk(red.isReferencedByOtherMugs(), "red should be referenced");
            assert.isNotOk(red.isReferencedByOtherMugs([blue]),
                "red with except=[blue] should not be referenced");
        });

        it("should not default choice label to node ID", function () {
            util.loadXML(BLANK_CHOICE_XML);
            var blank = util.getMug("select/blank");
            assert.equal(blank.p.labelItext.get(), "", "blank label itext");
        });
    });
});
