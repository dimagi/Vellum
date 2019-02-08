requirejs([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/core/group-rename.xml'
], function (
    chai,
    $,
    _,
    util,
    GROUP_RENAME_XML
) {
    var assert = chai.assert,
        call = util.call;

    describe("URL Hash", function() {
        it("should select a mug that is in the form", function() {
            window.location.hash = '#form/group/question2';
            util.loadXML(GROUP_RENAME_XML);
            var mug = call("getCurrentlySelectedMug");
            assert.equal(mug.absolutePath, "/data/group/question2");
        });

        it("should select first mug if hash isn't in form", function() {
            window.location.hash = '#form/group/not_in_form';
            util.loadXML(GROUP_RENAME_XML);
            var mug = call("getCurrentlySelectedMug");
            assert.equal(mug.absolutePath, "/data/group");
        });

        it("should change the hash when you add a question", function() {
            util.loadXML("");
            util.addQuestion("Text", "text");
            assert.equal(window.location.hash, '#form/text');
        });

        it("should change the hash when you delete a question", function() {
            util.loadXML("");
            util.addQuestion("Text", "text");
            util.addQuestion("Text", "text2");
            assert.equal(window.location.hash, '#form/text2');
            util.deleteQuestion("/data/text2");
            assert.equal(window.location.hash, '#form/text');
        });
    });
});
