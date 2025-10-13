define(["underscore"], function (_) {
    var dataSources = [
        {
            id: "commcaresession",
            uri: "jr://instance/session",
            path: "/session",
            name: 'Session',
            structure: {
                data: {
                    merge: true,
                    structure: {
                        "case_id": {
                            reference: {
                                hashtag: "#case",
                                source: "casedb",
                                subset: "case",
                                subset_key: "@case_type",
                                key: "@case_id",
                            },
                        },
                    },
                },
                context: {
                    merge: true,
                    structure: {
                        "userid": {
                            reference: {
                                hashtag: "#user",
                                source: "casedb",
                                subset: "commcare-user",
                                subset_key: "@case_type",
                                subset_filter: true,
                                key: "hq_user_id",
                            },
                        },
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
                id: "grandparent",
                name: "grandparent (household)",
                key: "@case_type",
                structure: {
                    address: {},
                }
            }, {
                id: "parent",
                name: "parent (mother)",
                key: "@case_type",
                structure: {
                    edd: {},
                },
                related: {
                    parent: {
                        hashtag: "#case/grandparent",
                        subset: "grandparent",
                        subset_key: "@case_type",
                        key: "@case_id",
                    }
                }
            }, {
                id: "commcare-user",
                name: "user",
                key: "@case_type",
                structure: {
                    role: {},
                    username: {},
                }
            }, {
                id: "case",
                name: "case (child)",
                key: "@case_type",
                structure: {
                    dob: {description: "Date of Birth"},
                    long: {description: "Property with a_very_long_word_in_the_description_that_exceeds_43_chars"},
                    f_0762: {},
                    f_1065: {},
                    f_1089: {},
                    f_2685: {},
                    f_2841: {},
                    f_3017: {},
                    f_3280: {},
                    f_3291: {},
                    f_3605: {},
                    f_4021: {},
                    f_4793: {},
                    f_5683: {},
                    f_6103: {},
                    f_6542: {},
                    f_6819: {},
                    f_6912: {},
                    f_7346: {},
                    f_7541: {},
                    f_8612: {},
                    f_8967: {},
                    f_8970: {},
                    f_9147: {},
                    f_9814: {},
                },
                related: {
                    parent: {
                        hashtag: "#case/parent",
                        subset: "parent",
                        subset_key: "@case_type",
                        key: "@case_id",
                    }
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
        }, {
            id: "some-other-fixture",
            uri: "jr://fixture/item-list:some-other-fixture",
            path: "/some-other-fixture_list/some-other-fixture",
            name: 'some-other-fixture-name',
            structure: {
                "other-inner-attribute": {
                    no_option: true
                },
                "@id-other": {
                    no_option: true
                },
                "name-other": {
                    no_option: true
                }
            }
        },
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
                "meta/timeEnd",
                "meta/location",
            ],
            dataSourcesEndpoint: function (callback) { callback(dataSources); },
            invalidCaseProperties: ['name'],
            saveType: "patch",
            saveUrl: function (data) {},
            activityUrl: null,               // may be function or URL string
            activityTimeout: 5 * 60 * 1000,  // 5 minutes in milliseconds
            externalLinks: {
                changeSubscription: "#",
            },
        },
        javaRosa: {
            langs: ['en', 'hin'],
            displayLanguage: 'en'
        },
        intents: {
            templates: [
                {
                    icon: "fa-solid fa-location-dot",
                    name: "Area Mapper",
                    id: "com.richard.lu.areamapper",
                    extra: {ext: "value"},
                    response: {
                        r1: "x",
                        r2: "y",
                        r3: "z",
                        r4: "",
                    },
                },
                {
                    icon: "fa fa-barcode",
                    name: "Barcode Scanner",
                    id: "com.google.zxing.client.android.SCAN",
                    extra: {},
                    response: {},
                },
                {
                    icon: "icon-vellum-android-intent",
                    name: "Breath Counter",
                    id: "org.commcare.respiratory.BREATHCOUNT",
                },
                {
                    icon: "icon-vellum-android-intent",
                    name: "Fingerprint Scanner",
                    id: "com.simprints.id.REGISTER",
                    mime: "text/plain",
                },
            ],
        },
        caseManagement: {
            properties: ['one', 'two', 'three'],
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
            objectMap: {}
        },
        plugins: [
            'databrowser',
            'itemset',
            'modeliteration',
            'commtrack',
            'saveToCase',
            'commcareConnect',
            'atwho',
        ],
        features: {
            // 'remove_popvers': false, // disabled for most tests
            'full_save_on_missing_conflict_xform': true,
            'lookup_tables': true,
            'group_in_field_list': true,
            'rich_text': true,
            'advanced_itemsets': true,
            'sorted_itemsets': true,
            'printing': true,
            'templated_intents': true,
            'custom_intents': true,
            'image_resize': true,
            'markdown_in_groups': true,
            'allow_data_reference_in_setvalue': true,
            'allow_bulk_form_actions': true,
        }
    };

    return {
        options: OPTIONS,
        dataSources: dataSources,
    };
});
