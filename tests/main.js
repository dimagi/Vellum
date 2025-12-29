/* global mocha */
import 'mocha/mocha.js';
import 'jquery.vellum';
import $ from 'jquery';
import options from 'tests/options';

mocha.setup({
    ui: 'bdd',
    timeout: '10000',
});

if (window.navigator.userAgent.indexOf('HeadlessChrome') < 0) {
    mocha.reporter('html');
}

(function () { // begin local scope

// Load jquery.vellum before loading tests because some tests depend on
// jquery.vellum components and would try to load them at the wrong path.
// This is only important when using the built version.
// The test modules are loaded dynamically after mocha is set up so that
// 'describe' and other mocha globals are available when the tests execute.

// Dynamically import all test modules (they register tests on global mocha instance as side-effect)
Promise.all([
    // tests for profiling load times
    // (disabled by default because they take a long time)
    //import('tests/profiling'),

    import('tests/base'),
    import('tests/core'),
    import('tests/form'),
    import('tests/logic'),
    import('tests/mugs'),
    import('tests/parser'),
    import('tests/questionTypes'),
    import('tests/exporter'),
    import('tests/expressionEditor'),
    import('tests/widgets'),
    import('tests/writer'),
    import('tests/commander'),
    import('tests/commtrack'),
    import('tests/copy-paste'),
    import('tests/javaRosa'),
    import('tests/modeliteration'),
    import('tests/intentManager'),
    import('tests/diffDataParent'),
    import('tests/formdesigner.ignoreButRetain'),
    import('tests/formdesigner.lock'),
    import('tests/itemset'),
    import('tests/advancedItemsets'),
    import('tests/jquery-extensions'),
    import('tests/tsv'),
    import('tests/xml'),
    import('tests/saveToCase'),
    import('tests/urlHash'),
    import('tests/markdown'),
    import('tests/datasources'),
    import('tests/databrowser'),
    import('tests/setvalue'),
    import('tests/richText'),
    import('tests/questionProperties'),
    import('tests/atwho'),
    import('tests/escapedHashtags'),
    import('tests/bulkActions'),
    import('tests/undomanager'),
    import('tests/undo'),
    import('tests/commcareConnect'),

    // tests for profiling load times
    // (disabled by default because they take a long time)
    // import('tests/profiling'),
]).then(function() {
    // All tests are now loaded and registered with mocha

    var session = window.sessionStorage;

    function runTests() {
        function showTestResults() {
            $("#resultsTab").click();
            return false;
        }
        $(".sidebar #mocha-stats").remove();
        mocha.run();
        // move progress indicator into sidebar
        $("#mocha-stats").css({
            "margin-top": "3em",
            position: "relative",
            left: 0,
            top: 0
        }).appendTo(".sidebar");
        $("#mocha-stats li").css({display: "block"});
        $("#mocha-stats li.progress").css({height: "40px"});
        $("#mocha-stats li.passes a").click(showTestResults);
        $("#mocha-stats li.failures a").click(showTestResults);
    }
    $('#run-tests').click(runTests);

    function load(form, ready) {
        $('#vellum').empty().vellum($.extend(true, {}, options.options, {
            core: {
                onReady: ready,
                saveUrl: function (data) {
                    session.setItem("vellum.tests.main.lastSavedForm", data.xform);
                },
                patchUrl: function (data) {
                    // fake conflict to retry with saveUrl
                    return {status: 'conflict'};
                },
                form: form
            }
        }));

        // trigger vellum resizing
        setTimeout(function () {
            $(document).scroll();
        }, 500);
    }

    $('#load-saved').click(function () {
        load(session.getItem("vellum.tests.main.lastSavedForm") || "");
    });

    if (navigator.userAgent.indexOf('HeadlessChrome') >= 0) {
        load("", function () { mocha.run(); });
    } else if (/[?&]load=saved(&|#|$)/.test(window.location.href)) {
        // Use Chrome dev tools to preset form XML
        // (Application > Storage > Session Storage > http://localhost...
        //  > vellum.tests.main.lastSavedForm value)
        // and then add ?load=saved to query string and reload.
        load(session.getItem("vellum.tests.main.lastSavedForm") || "");
    } else {
        load(""); // load empty form on initial page load
    }

    $('#file').on('change', function (evt) {
        var file = evt.target.files[0],
            reader = new FileReader();

        reader.onload = function(e) {
            load(e.target.result);
            // clear file input so the same file can be selected later
            // http://stackoverflow.com/a/1043969/10840
            var input = $('#file');
            input.replaceWith(input.clone(true));
        };

        reader.readAsText(file);
    });
});

})(); // end local scope