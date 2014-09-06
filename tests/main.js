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

if (search.indexOf('built') !== -1) {
    useBuilt = true;
} else if (search.indexOf('async') !== -1) {
    useBuilt = false;
} else {
    useBuilt = !window.mochaPhantomJS &&
               window.location.href.indexOf('localhost') === -1;
}
if (useBuilt) {
    baseUrl = '_build/src';
    testBase = "../../";
} else {
    baseUrl = 'src';
    testBase = "../";
}
console.log("loading Vellum from " + baseUrl);

// comment these to use built versions
define("jquery", [testBase + 'bower_components/jquery/jquery'], function () { return window.jQuery; });
define("jquery-ui", ["jquery", testBase + 'lib/jquery-ui/jquery-ui-1.8.14.custom.min'], function () {});
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
        'tests/core',
        'tests/logic',
        'tests/parser',
        'tests/questionTypes',
        'tests/exporter',
        'tests/javaRosa',
        'tests/formdesigner.ignoreButRetain',
        'tests/formdesigner.lock',
        'tests/itemset'
    ], function (
        options
    ) {
        var lastSavedForm = null;

        function runTests() {
            if (window.mochaPhantomJS) {
                mochaPhantomJS.run();
            } else {
                mocha.run();
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

        $('#load-saved').click(function () {
            $('#vellum').empty().vellum($.extend(true, {}, options.options, {
                core: {
                    saveUrl: function (data) {
                        lastSavedForm = data.xform;
                    },
                    form: lastSavedForm
                }
            }));

            // trigger vellum resizing
            setTimeout(function () {
                $(document).scroll();
            }, 500);
        }).click();

    });
});

})(); // end local scope
