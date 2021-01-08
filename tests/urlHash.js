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
            util.loadXML(GROUP_RENAME_XML, null, null, true);
            var mug = call("getCurrentlySelectedMug");
            assert.equal(mug.absolutePath, "/data/group/question2");
        });

        it("should select first mug if hash isn't in form", function() {
            window.location.hash = '#form/group/not_in_form';
            util.loadXML(GROUP_RENAME_XML, null, null, true);
            var mug = call("getCurrentlySelectedMug");
            assert.equal(mug.absolutePath, "/data/group");
        });

        it("should change the hash when you add a question", function() {
            util.loadXML("");
            util.addQuestion("Text", "initial");
            util.clickQuestion("initial");
            assert.equal(window.location.hash, "#form/initial");
        });

        it("should change the hash when you delete a question", function() {
            util.loadXML("");
            
            util.addQuestion("Text", "first");
            util.clickQuestion("first");

            util.addQuestion("Text", "second");
            util.clickQuestion("second");
            
            assert.equal(window.location.hash, "#form/second");
            
            util.deleteQuestion("/data/second");
            
            assert.equal(window.location.hash, "#form/first");
        });

        it("should call setURLHash only once when multiple questions are loaded", function(done){
            
            var count = 0;
            util.loadXML("");
            
            var q1 = util.addQuestion("Text", "first");
            util.clickQuestion("first");
            
            var q2 = util.addQuestion("Text", "second");
            util.clickQuestion("second");
            var prevFn = q1.form.vellum._setURLHash;
            q1.form.vellum._setURLHash = function(){
                count++;
            }
            util.saveAndReload(function(){
                assert.equal(count, 1);
                done();
            })
            after(function(){
                q1.form.vellum._setURLHash = prevFn;
            })
        });
    });
});
