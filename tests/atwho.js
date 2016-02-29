define([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'text!static/atwho/test1.xml',
], function (
    util,
    chai,
    $,
    _,
    TEST1_XML
) {
    var assert = chai.assert;

    function getFuseData(string) {
        var form = util.call('getData').core.form,
            fuseRes = form.fuse.search(string);
        return fuseRes.length ? fuseRes[0] : null;
    }

    describe("atwho", function() {
        beforeEach(function(done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: { form: TEST1_XML, onReady: done },
                features: {rich_text: false},
                plugins: ['atwho','modeliteration'],
            });
        });

        function getDisplayedAtwhoViews() {
            return $('.atwho-view').filter(function() {
                return $(this).css('display') === 'block';
            });
        }

        function displayAtwho(callback) {
            var mug = util.clickQuestion('one')[0];
            var input = $('[name=property-relevantAttr]');
            input.val('/data/').keyup();
            assert.strictEqual(getDisplayedAtwhoViews().length, 1);
            try {
                callback(mug);
            } catch (err) {
                throw err;
            } finally {
                mug.fire('teardown-mug-properties');
            }
            assert(!getDisplayedAtwhoViews().length);
        }

        function assertNumAtwhoChoices(num) {
            assert.strictEqual(getDisplayedAtwhoViews().find('li').length, num);
        }

        it("should truncate the display label", function() {
            var mug = getFuseData('one');
            assert.strictEqual(mug.displayLabel, "One");
            mug = getFuseData('long');
            assert.strictEqual(mug.displayLabel, "This is going to be a rea&hellip;");
        });

        it("should not show mugs without absolutePath", function() {
            displayAtwho(function(mug) {
                assert(!getDisplayedAtwhoViews().find('li:contains("choice1")').length);
            });
        });

        // only valid for small sets of questions
        it("should have each mug", function () {
            displayAtwho(function(mug) {
                assertNumAtwhoChoices(3);
            });
        });

        it("should destroy the atwho container on mug removal", function() {
            displayAtwho(function(mug) {
                mug.fire('teardown-mug-properties');
                assert(!getDisplayedAtwhoViews().length);
            });
        });

        it("should not show itself in the results", function () {
            displayAtwho(function(mug) {
                assertNumAtwhoChoices(3);
            });
        });
    });
});
