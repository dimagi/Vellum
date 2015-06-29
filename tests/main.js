/* global console, mocha, mochaPhantomJS */
mocha.setup('bdd');
mocha.reporter('html');

// PhantomJS doesn't support bind yet
Function.prototype.bind = Function.prototype.bind || function (thisp) {
  var fn = this;
  return function () {
    return fn.apply(thisp, arguments);
  };
};

(function () { // begin local scope

var useBuilt, baseUrl, testBase, search = window.location.search;

// use built version if query string contains "built" parameter
useBuilt = !!search.match(/[?&]?built(=[^&]*)?(&|$)/);

if (useBuilt) {
    baseUrl = '_build/src';
    testBase = "../../";
} else {
    baseUrl = 'src';
    testBase = "../";
}
console.log("loading Vellum from " + baseUrl);

// comment these to use built versions
define("jquery", [testBase + 'bower_components/jquery/dist/jquery'], function () { return window.jQuery; });
define("jquery.bootstrap", ["jquery", testBase + 'lib/bootstrap'], function () {});

require.config({
    baseUrl: baseUrl,
    paths: {
        "jquery.vellum": "main",
        "tests": testBase + "tests"
    }
});

// load jquery.vellum before loading tests because some tests depend on
// jquery.vellum components and would try to load them at the wrong path
// (this is only important when using the built version)
require(['jquery', 'jquery.vellum'], function ($) {
    // define our own paths for test dependencies that are also dependencies of
    // vellum that get excluded from the built version of vellum, to ensure that
    // the built version is tested correctly
    require.config({
        // handle potential slow free heroku dynos
        waitSeconds: 60,
        paths: {
            'static': testBase + 'tests/static',
            'chai': testBase + 'bower_components/chai/chai',
            'equivalent-xml': testBase + 'bower_components/equivalent-xml-js/src/equivalent-xml'
        },
        shim: {
            'equivalent-xml': {
                deps: ['underscore'],
                exports: 'EquivalentXml'
            }
        }
    });

    if (useBuilt) {
        require.config({
            paths: {
                'text': '../bower_components/requirejs-text',
                // for some reason this is necessary in firefox only for built
                // version test page.  It shouldn't be
                'tpl': '../bower_components/requirejs-tpl',
                // https://github.com/guybedford/require-css/issues/133 
                //'css': 'error',
                'less': 'error',
                'json': 'error'
            }
        });
        $('head').append('<link rel="stylesheet" type="text/css" href="_build/style.css">');
    }

    require([
        'tests/options',

        // tests for profiling load times
        // (disabled by default because they take a long time)
        //'tests/profiling',

        // register tests on global mocha instance as side-effect
        'tests/base',
        'tests/core',
        'tests/form',
        'tests/logic',
        'tests/mugs',
        'tests/parser',
        'tests/questionTypes',
        'tests/exporter',
        'tests/widgets',
        'tests/writer',
        'tests/commtrack',
        'tests/copy-paste',
        'tests/javaRosa',
        'tests/modeliteration',
        'tests/intentManager',
        'tests/diffDataParent',
        'tests/formdesigner.ignoreButRetain',
        'tests/formdesigner.lock',
        'tests/itemset',
        'tests/advancedItemsets',
        'tests/tsv',
        'tests/xml',
        'tests/saveToCase',
        'tests/markdown',
        'tests/datasources',
        'tests/databrowser',
        'tests/saveToCase',
        'tests/setvalue',
    ], function (
        options
    ) {
        var session = window.sessionStorage;

        function runTests() {
            function showTestResults() {
                $(".sidebar .nav #resultsTab a").click();
                return false;
            }
            if (window.mochaPhantomJS) {
                mochaPhantomJS.run();
            } else {
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
        }
        $('#run-tests').click(runTests);

        // ensure the normal first test instance is fully loaded before
        // destroying it for tests
        setTimeout(function () {
            if (window.mochaPhantomJS) {
                runTests();
            }
        }, 1000);

        function load(form) {
            $('#vellum').empty().vellum($.extend(true, {}, options.options, {
                core: {
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
        load(""); // load empty form on initial page load

        function handleFileSelect(evt) {
            var file = evt.target.files[0],
                reader = new FileReader();

            // Closure to capture the file information.
            reader.onload = (function(theFile) {
                return function(e) {
                    load(e.target.result);
                };
            })(file);

            reader.readAsText(file);
        }
        document.getElementById('file').addEventListener('change', handleFileSelect, false);
    });
});

})(); // end local scope
