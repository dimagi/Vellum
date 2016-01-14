require([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/richText',
    'vellum/atwho',
    'vellum/util',
    'tpl!vellum/templates/atwho_display'
], function (
    util,
    chai,
    $,
    _,
    richText,
    atwho,
    real_util,
    ATWHO_DISPLAY
) {
    var assert = chai.assert,
        mugs = [
            {
                ufid: 0,
                absolutePath: '/data/one',
                hashtagPath: '#form/one',
                options: {
                    icon: 'fcc fcc-text',
                },
                p: {
                    nodeID: 'one',
                },
                displayName: 'One',
            },
            {
                ufid: 1,
                absolutePath: '/data/long',
                hashtagPath: '#form/long',
                options: {
                    icon: 'fcc fcc-text',
                },
                p: {
                    nodeID: 'long',
                },
                displayName: 'This is going to be a really long display name that should be truncated',
            },
            {
                ufid: 2,
                absolutePath: undefined,
                hashtagPath: undefined,
                options: {
                    icon: 'fcc fcc-choice',
                },
                p: {
                    nodeID: 'choice',
                },
                displayName: 'Not going to show up',
            },
            {
                ufid: 3,
                absolutePath: '/data/modeliteration/item',
                hashtagPath: '#form/modeliteration/item',
                options: {
                    icon: 'fcc fcc-choice',
                },
                p: {
                    nodeID: 'item',
                },
                displayName: undefined,
            },
        ],
        form = {
            vellum: {
                getMugDisplayName: function (mug) {
                    return mug.displayName;
                },
                data: {
                    atwho: {}
                },
            },
            formUuid: 'test',
            getMugList: function () { return mugs; },
        };
    _.each(mugs, function(mug) {
        mug.form = form;
        mug.on = function () {};
        // for tests in editor
        mug.icon = mug.options.icon;
        mug.name = mug.hashtagPath;
        mug.displayLabel = real_util.truncate(form.vellum.getMugDisplayName(mug));
        real_util.eventuality(mug);
    });

    describe("atwho", function() {
        var atwhoData;
        before(function() {
            atwhoData = atwho.cachedMugData(0)(form);
        });

        it("should truncate the display label", function() {
            var mug = _.findWhere(atwhoData, {id: 0});
            assert.strictEqual(mug.displayLabel, "One");
            mug = _.findWhere(atwhoData, {id: 1});
            assert.strictEqual(mug.displayLabel, "This is going to be a rea&hellip;");
        });

        it("should not show mugs without absolutePath", function() {
            assert(!_.findWhere(atwhoData, {id: 2}));
        });

        it("should not show mugs that don't display in the question tree", function() {
            assert(!_.findWhere(atwhoData, {id: 3}));
        });

        describe("in an editor", function() {
            var el = $("<div id='input'><input /></div>"),
                mug = mugs[0],
                input, atwhoview;

            function getDisplayedAtwhoViews() {
                return $('.atwho-view').filter(function() {
                    return $(this).css('display') === 'block';
                });
            }
            before(function () {
                $('.atwho-container').remove();
                $("body").append(el);
                input = el.children().first();
                atwho._questionAutocomplete(input, mug);
                input.val('/data/');
                input.keyup();
                atwhoview = getDisplayedAtwhoViews();
                assert.strictEqual(atwhoview.length, 1);
            });
            after(function() {
                input.atwho('destroy');
                input.remove();
            });

            it("should pop up", function () {
                assert.strictEqual(atwhoview.length, 1);
            });

            it("should have each mug", function () {
                assert.strictEqual(atwhoview.length, 1);
                var listItems = atwhoview.find('li');

                _.each(listItems, function(item, index) {
                    assert.strictEqual(listItems[index].innerHTML,
                                       $(ATWHO_DISPLAY(mugs[index]))[0].innerHTML);
                });
            });

            it("should destroy the atwho container on mug removal", function() {
                assert.strictEqual(atwhoview.length, 1);
                mug.fire('teardown-mug-properties');
                assert(!getDisplayedAtwhoViews().length);
            });
        });
    });
});
