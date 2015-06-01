define(function () {
    var INSTANCES = [
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
            sourceUri: "jr://fixture/item-list:some-fixture",
            defaultId: "some-fixture",
            initialQuery: "instance('some-fixture')/some-fixture_list/some-fixture",
            name: 'some-fixture-name',
            structure: {
                "inner-attribute": {
                    structure: {
                        "extra-inner-attribute": {}
                    }
                },
                "@id": {
                    no_option: true
                },
                name: {
                    no_option: true
                }
            }
        }
    ];
    
    var OPTIONS = {
        core: {
            loadDelay: 0,
            formName: "Untitled Form",
            allowedDataNodeReferences: [
                "meta/deviceID",
                "meta/instanceID",
                "meta/username",
                "meta/userID",
                "meta/timeStart",
                "meta/timeEnd"
            ],
            dataSources: [
                {
                    key: "case",
                    name: "Cases",
                    endpoint: function (callback) { callback([INSTANCES[0]]); }
                }, {
                    key: "fixture",
                    name: "Lookup Tables",
                    endpoint: function (callback) { callback(INSTANCES.slice(1)); }
                }
            ],
            saveType: "patch",
            saveUrl: function (data) {}
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
        },
        plugins: [
            'itemset',
            'modeliteration',
            'commtrack',
            'saveToCase',
        ],
        features: {
            'group_in_field_list': true,
            'help_markdown': true,
            'advanced_itemsets': true,
            'experimental_ui': true,
        }
    };

    return {
        options: OPTIONS,
        instances: INSTANCES
    };
});
