mocha.setup('bdd');
mocha.reporter('html');


var TEST_INSTANCE_CONFIG = [
    {
        name: "All Cases",
        sourceUri: "jr://instance/casedb",
        defaultId: "casedb",
        rootNodeName: "casedb",
        levels: [
            {
                nodeName: "case",
                properties: [
                    {
                        id: 'case_name'
                    },
                    {
                        id: '@case_id'
                    }
                ],
                subsets: [
                    {
                        name: "mother Cases",
                        selector: "@case_type='mother'",
                        properties: [
                            {
                                id: 'edd' 
                            }
                        ]
                    },
                    {
                        name: "child Cases",
                        selector: "@case_type = 'child'",
                        properties: [
                            {
                                id: 'dob'
                            }
                        ]
                    }
                ]
            }
        ],
    },
    {
        name: "Some Fixture",
        sourceUri: "jr://fixture/some-fixture",
        defaultId: "somefixture",
        rootNodeName: "foos",
        levels: [
            {
                nodeName: "foo",
                subsets: [
                    {
                        name: "woos",
                        selector: "@foo_type=\"woo\""
                    }
                ]
            },
            {
                nodeName: "bar",
                subsets: [
                    {
                        name: "eggs",
                        selector: "@bar_type='eggs'"
                    }
                ]
            }
        ]
    }
];

var useBuilt = window.location.href.indexOf('localhost') === -1,
    search = window.location.search;

if (search.indexOf('built') !== -1) {
    useBuilt = true;
} else if (search.indexOf('async') !== -1) {
    useBuilt = false;
}

require.config({
    baseUrl: '../',
    packages: [
        {
            name: 'jquery.vellum',
            location: useBuilt ? '../_build/src' : '../src',
            main: 'main'
        },
        {
            name: 'vellum-matrix',
            location: 'tests',
            main: 'matrix'
        }
    ],
    config: {
        'jquery.vellum/require-config': {
            env: useBuilt ? 'production' : 'development'
        }
    }
});

require([
    'jquery.vellum/require-config',
], function () {
    // define our own paths for test dependencies that are also dependencies of
    // vellum that get excluded from the built version of vellum, to ensure that
    // the built version is tested correctly
    require.config({
        // handle potential slow free heroku dynos
        waitSeconds: 60,
        map: {
            '*': {
                'test_tpl': '../bower_components/requirejs-tpl/tpl'
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
    }

    require([
        'vellum-matrix',
        'jquery',
    ], function (
        matrix,
        $
    ) {
        matrix.makeMatrix($("#matrix_container"), ['itemset'], {
            core: {
                formName: "Untitled Form",
                allowedDataNodeReferences: [
                    "meta/deviceID",
                    "meta/instanceID",
                    "meta/username",
                    "meta/userID",
                    "meta/timeStart",
                    "meta/timeEnd"
                ],
                externalInstances: TEST_INSTANCE_CONFIG,
            },
            javaRosa: {
                langs: ['en', 'hin'],
                displayLanguage: 'en'
            },
            uploader: {
                uploadUrls: {
                    image: 'foo',
                    audio: 'foo',
                    video: 'foo'
                },
                objectMap: {}  // todo
            }
        });
    });
});
