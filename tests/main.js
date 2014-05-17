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

require.config({
    packages: [
        {
            name: 'jquery.vellum',
            location: '..',
            main: 'main'
            //main: '../dist/main-built'
        },
        {
            name: 'vellum-matrix',
            location: 'tests',
            main: 'matrix'
        }
    ],
    paths: {
        'jquery': '../bower_components/jquery/jquery',
        
        'text': '../bower_components/requirejs-text/text',
        'tpl': '../bower_components/requirejs-tpl/tpl',
        'underscore': '../bower_components/underscore/underscore'
    },
    shim: {
        'underscore': {
            exports: '_'
        }
    }
});

require([
    './matrix',
    'jquery'
], function (
    matrix,
    $
) {
    matrix.makeMatrix($('#matrix'), ['itemset'], {
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
