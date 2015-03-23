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
        }
    ];

    var fixtures = [
        {
            name: "Some Fixture",
            sourceUri: "jr://fixture/item-list:some-fixture",
            columns: [
                'column1',
                'column2',
                'column3'
            ]
        },
        {
            name: "Some Other Fixture",
            sourceUri: "jr://fixture/item-list:some-other-fixture",
            columns: [
                'othercolumn1',
                'othercolumn2',
                'othercolumn3'
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
            dataSources: [
                {
                    key: "case",
                    name: "Cases",
                    endpoint: function () { return [INSTANCES[0]]; }
                }, {
                    key: "fixture",
                    name: "Fixtures",
                    endpoint: function () { return fixtures; }
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
        plugins: ['itemset', 'modeliteration', 'commtrack', 'datasources'],
        features: {
            'group_in_field_list': true
        }
    };

    return {
        options: OPTIONS,
        instances: INSTANCES
    };
});
