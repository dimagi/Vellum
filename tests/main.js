/* global console, mocha, navigator, URLSearchParams */
import mocha from "mocha/mocha";
mocha.setup({
    ui: 'bdd',
    timeout: '10000',
});

if (navigator.userAgent.indexOf('HeadlessChrome') < 0) {
    mocha.reporter('html');
}

(function () { // begin local scope

var urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('useBuilt')) {
    window.useBuilt = true;
}

var useBuilt = window.useBuilt, baseUrl, testBase;

if (useBuilt) {
    baseUrl = '_build/src';
    testBase = "../../";
} else {
    baseUrl = 'src';
    testBase = "../";
}
console.log("loading Vellum from " + baseUrl);

// load jquery.vellum before loading tests because some tests depend on
// jquery.vellum components and would try to load them at the wrong path
// (this is only important when using the built version)
require(['jquery.vellum'], function () {
    // define our own paths for test dependencies that are also dependencies of
    // vellum that get excluded from the built version of vellum, to ensure that
    // the built version is tested correctly

    if (useBuilt) {
        // TODO: remove?
        /*requirejs.config({
            paths: {
                'text': '../node_modules/requirejs-text',
                // https://github.com/guybedford/require-css/issues/133 
                //'css': 'error',
                'less': 'error',
                'json': 'error'
            }
        });*/
    }

    require([
        'jquery',
        'tests/options',

        // tests for profiling load times
        // (disabled by default because they take a long time)
        //'tests/profiling',

        // TODO: uncomment these
        // register tests on global mocha instance as side-effect
        //'tests/base',
        //'tests/core',
        //'tests/form',
        //'tests/logic',
        //'tests/mugs',
        //'tests/parser',
        //'tests/questionTypes',
        //'tests/exporter',
        //'tests/expressionEditor',
        //'tests/widgets',
        //'tests/writer',
        //'tests/commander',
        //'tests/commtrack',
        //'tests/copy-paste',
        //'tests/javaRosa',
        //'tests/modeliteration',
        //'tests/intentManager',
        //'tests/diffDataParent',
        //'tests/formdesigner.ignoreButRetain',
        //'tests/formdesigner.lock',
        //'tests/itemset',
        //'tests/advancedItemsets',
        //'tests/jquery-extensions',
        'tests/tsv',
        'tests/xml',
        //'tests/saveToCase',
        //'tests/urlHash',
        //'tests/markdown',
        //'tests/datasources',
        //'tests/databrowser',
        //'tests/setvalue',
        //'tests/richText',
        //'tests/questionProperties',
        //'tests/atwho',
        //'tests/escapedHashtags',
        //'tests/bulkActions',
        //'tests/undomanager',
        //'tests/commcareConnect',
    ], function ($, options) {
        var session = window.sessionStorage;

        if (useBuilt) {
            $('head').append('<link rel="stylesheet" type="text/css" href="_build/style.css">');
        }

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
});

})(); // end local scope
