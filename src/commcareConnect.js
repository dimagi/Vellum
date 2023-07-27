define([
    'jquery',
    'underscore',
    'vellum/mugs',
    'vellum/tree',
    'vellum/util',
    'vellum/atwho',
    'vellum/widgets',
    'vellum/core'
], function (
    $,
    _,
    mugs,
    Tree,
    util,
    atwho,
    widgets,
) {
    let CCC_XMLNS = 'http://commcareconnect.com/data/v1/learn',
        baseSection = {
            slug: "main",
            displayName: gettext("Basic"),
            properties: [
                "nodeID",
            ],
        },
        baseSpec = {
            xmlnsAttr: {
                presence: "optional",
                serialize: () => {},
                deserialize: () => {}
            },
            requiredAttr: {presence: "notallowed"},
            constraintAttr: {presence: "notallowed"},
            calculateAttr: {presence: "notallowed"}
        },
        baseMugOptions = {
            isTypeChangeable: false,
            isDataOnly: true,
            supportsDataNodeRole: true,
            icon: 'fa fa-compress',
            getExtraDataAttributes: function (mug) {
                return {
                    // allows the parser to know which mug to associate with this node
                    "vellum:role": mug.__className,
                };
            },
            parseDataNode: () => {
                // Extract values from the data node
                // Return an empty list of child nodes since children are handled
                // by this plugin directly.
                return $([])
            },
            dataChildFilter: (children, mug) => {
                // called during write
                // return a list nodes to add to the forms data node
                children = mugConfigs[mug.__className].childNodes.map((childName) => {
                    return new Tree.Node([], {
                        getNodeID: function () {
                            return childName;
                        },
                        p: {rawDataAttributes: null},
                        options: {
                            getExtraDataAttributes: () => {
                            }
                        }
                    });
                });
                return [new Tree.Node(children, {
                    getNodeID: () => mugConfigs[mug.__className].rootName,
                    p: {rawDataAttributes: null},
                    options: {
                        getExtraDataAttributes: () => ({
                            "xmlns": CCC_XMLNS,
                            "id": mug.p.nodeID,
                        })
                    }
                })];
            },
            getBindList: (mug) => {
                // return list of bind elements to add to the form
                let mugConfig = mugConfigs[mug.__className];
                return mugConfig.childNodes.map((childName) => {
                    return {
                        nodeset: `${mug.absolutePath}/${mugConfig.rootName}/${childName}`,
                        calculate: wrapString(mug.p[childName]),
                    }
                });
            },
        },
        mugConfigs = {
            ConnectLearnModule: {
                rootName: "module",
                childNodes: [
                    "name",
                    "description",
                    "time_estimate",
                ],
                mugOptions: util.extend(baseMugOptions, {
                    typeName: 'Learn Module',
                    init: (mug, form) => {
                        mug.p.name = "";
                        mug.p.description = "";
                        mug.p.time_estimate = "";
                    },
                    spec: util.extend(baseSpec, {
                        name: {
                            lstring: gettext("Name"),
                            visibility: 'visible',
                            presence: 'required',
                            widget: widgets.text,
                        },
                        description: {
                            lstring: gettext("Description"),
                            visibility: 'visible',
                            presence: 'required',
                            widget: widgets.text,
                        },
                        time_estimate: {
                            lstring: gettext("Time Estimate"),
                            visibility: 'visible',
                            presence: 'required',
                            widget: widgets.text,
                            validationFunc: (mug) => {
                                let val = mug.p.time_estimate;
                                return val && val.match(/^\d+$/) ? "pass" : gettext("Must be an integer");
                            },
                            help: gettext('Estimated time to complete the module in hours.'),
                        },
                    })
                }),
                sections: [_.extend({}, baseSection, {
                    properties: [
                        "nodeID",
                        "name",
                        "description",
                        "time_estimate",
                    ],
                })],
            }
        };


    $.vellum.plugin("commcareConnect", {}, {
        getAdvancedQuestions: function () {
            return this.__callOld().concat(Object.keys(mugConfigs));
        },
        getMugTypes: function () {
            let types = this.__callOld();
            Object.entries(mugConfigs).forEach(([mugType, config]) => {
                types.normal[mugType] = util.extend(mugs.defaultOptions, config.mugOptions);
            });
            return types;
        },
        getSections: function (mug) {
            if (mugConfigs.hasOwnProperty(mug.__className)) {
                return _.map(mugConfigs[mug.__className].sections, function (section) {
                    return _.clone(section);
                });
            }
            return this.__callOld();
        },
        parseBindElement: function (form, el, path) {
            let mug = form.getMugByPath(path);
            if (!mug) {
                let matched = Object.entries(mugConfigs).some(([mugName, mugConfig]) => {
                    let children = mugConfig.childNodes.join('|'),
                        regex = new RegExp(`/${mugConfig.rootName}/(${children})`),
                        matchRet = path.match(regex);
                    if (matchRet && matchRet.length > 0) {
                        let attr = matchRet[1];
                        mug = form.getMugByPath(path.replace(regex, ""));
                        if (mug && mug.__className === mugName) {
                            mug.p[attr] = unwrapString(el.xmlAttr("calculate"));
                            return true;
                        }
                    }
                });
                if (matched) {
                    return;
                }
            }
            this.__callOld();
        },
    });

    function wrapString(val) {
        return `'${val}'`;
    }

    function unwrapString(val) {
        return val.replace(/^'(.*)'$/, '$1');
    }
});
