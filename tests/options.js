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
                            // should handle quotes
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
            externalInstances: INSTANCES,
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
        plugins: ['itemset', 'modeliteration'],
        features: {
            'add_help_text': true,
            'group_in_field_list': true
        },
        modelIteration: {
            modelTypes: ['case', 'fixture'],
            modelIterationUrl: function(type) {
                if (type === 'case') {
                    return ['case1', 'case2'];
                } else if (type === 'fixture') {
                    return ['fixture1', 'fixture2'];
                }
            }
        }
    };

    return {
        options: OPTIONS,
        instances: INSTANCES
    };
});
