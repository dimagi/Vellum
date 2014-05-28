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

var isLocal = (
    //false &&    // uncomment this line to always use built files
    //true ||     // uncomment this line to always use non-built files
    window.location.href.indexOf('localhost') !== -1
);

require.config({
    baseUrl: '../',
    packages: [
        {
            name: 'jquery.vellum',
            location: '../src',
            main: 'main'
        },
        {
            name: 'vellum-matrix',
            location: 'tests',
            main: 'matrix'
        }
    ]
});

require([
    'jquery.vellum/require-config'
], function () {

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
