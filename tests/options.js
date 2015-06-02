define(["underscore"], function (_) {
    var dataSources = [
        {
            id: "commcaresession",
            uri: "jr://instance/session",
            path: "/session/data",
            name: 'Session',
            structure: {
                "case_id": {
                    reference: {
                        source: "casedb",
                        subset: "child",
                        key: "@case_id",
                    },
                },
            },
        }, {
            id: "casedb",
            uri: "jr://instance/casedb",
            path: "/cases/case",
            name: 'Cases',
            structure: {
                name: {},
            },
            subsets: [{
                id: "mother",
                key: "@case_type",
                structure: {
                    edd: {},
                }
            }, {
                id: "child",
                key: "@case_type",
                structure: {
                    dob: {},
                },
                related: {
                    parent: "mother",
                },
            }]
        }, {
            id: "some-fixture",
            uri: "jr://fixture/item-list:some-fixture",
            path: "/some-fixture_list/some-fixture",
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
            dataSourcesEndpoint: function (callback) { callback(dataSources); },
            saveType: "patch",
            saveUrl: function (data) {}
        },
        javaRosa: {
            langs: ['en', 'hin'],
            displayLanguage: 'en'
        },
        itemset: {
            dataSourcesFilter: function (sources) {
                return _.filter(sources, function (source) {
                    return !source.uri || /^jr:\/\/fixture\//.test(source.uri);
                });
            }
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
            'databrowser',
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
        options: OPTIONS
    };
});
