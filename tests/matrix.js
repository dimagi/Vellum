define([
    'test_tpl!tests/templates/matrix',
    'test_tpl!tests/templates/harness',
    'underscore',
    'jquery',
    'jquery.vellum'
], function (
    matrix,
    harness,
    _,
    $
) {
    // Yes, this is shitty jQuery callbacks code.
    
    // Container is passed so we have something that things can be immediately
    // loaded into the DOM if necessary.
    function makeMatrix ($container, optionalPlugins, vellumOptions) {
        var entries = [{
            title: '',
            plugins: []
        }];

        // permute
        _.each(optionalPlugins, function (pname) {
            var withPlugin = _.map(entries, function (entry) {
                return {
                    title: entry.title + ' +' + pname,
                    plugins: entry.plugins.concat([pname])
                };
            });
            var withoutPlugin = _.map(entries, function (entry) {
                return {
                    title: entry.title + ' -' + pname,
                    plugins: entry.plugins
                };
            });
            entries = entries.concat(withPlugin).concat(withoutPlugin);
        });

        entries = entries.slice(1);

        var $matrix = $(matrix({
            entries: entries
        }));
        $container.append($matrix);

        _.each(entries, function (entry, i) {
            var $harnessContainer = $matrix.find('#harness_container_' + i);
            makeHarness($harnessContainer, i, $.extend(true, {}, vellumOptions, {
                plugins: entry.plugins
            }));
        });

        // Abstraction barrier break here, but ensure that there is only
        // ever one #mocha div in the DOM -- the current one -- since mocha
        // expects it to be unique.  Could explore having a single test
        // suite containing the entire test matrix instead.
        $('.harness-toggle').click(function () {
            var $this = $(this),
                $parent = $this.parent(),
                $harnessContent = $($this.attr('href'));
            if ($parent.hasClass('active')) {
                return;
            }
            
            if (!$harnessContent.find('.fd-container').hasClass('formdesigner')) {
                $harnessContent.find('.load-saved').click();
            }

            $('#mocha').remove();
            $harnessContent.append($('<div id="mocha"></div>'));
        });

        $('.harness-toggle')[0].click();
    }

    function makeHarness ($appendToContainer, harnessId, vellumOptions) {
        var $harness = $(harness({
                id: harnessId
            })),
            lastSavedForm = null;
        $appendToContainer.append($harness);

        vellumOptions.core.saveUrl = function (data) {
            lastSavedForm = data.xform;
        };

        $harness.find('.run-tests').click(function () {
            $harness.find('#mocha').empty();
            $(this).addClass('disabled').attr('disabled', true);
            if (window.mochaPhantomJS) {
                mochaPhantomJS.run();
            } else {
                mocha.run();
            }
        });

        $harness.find('.load-saved').click(function () {
            vellumOptions.core.form = lastSavedForm;
            $harness.find('.fd-container').empty().vellum(vellumOptions);
            // trigger vellum resizing
            setTimeout(function () {
                $(document).scroll();
            }, 500);
        });
        return $harness;
    }

    return {
        makeMatrix: makeMatrix
    };
});
