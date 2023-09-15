/**
 * CommCare Connect plugin for Vellum
 *
 * This plugin adds two new mug types:
 * - Learn Module
 * - Assessment Score
 */
define([
    'jquery',
    'underscore',
    'vellum/mugs',
    'vellum/tree',
    'vellum/util',
    'vellum/widgets',
    'vellum/core'
], function (
    $,
    _,
    mugs,
    Tree,
    util,
    widgets
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
            /**
             * If true, the mug will write its values to the data node instead of
             * using bind elements.
             */
            writeValuesToDataNode: false,
            getExtraDataAttributes: mug => ({
                // allows the parser to know which mug to associate with this node
                "vellum:role": mug.__className,
            }),
            parseDataNode: () => {
                // Extract values from the data node
                // Return an empty list of child nodes since children are handled
                // by this plugin directly.
                return $([]);
            },
            dataChildFilter: (children, mug) => {
                // called during write
                // return a list nodes to add to the forms data node
                let writeData = mug.options.writeValuesToDataNode;
                children = mugConfigs[mug.__className].childNodes.map(childName => {
                    let p = {rawDataAttributes: null};
                    if (writeData) {
                        p.dataValue = mug.p[childName];
                    }
                    return new Tree.Node([], {
                        getNodeID: () => childName,
                        p: p,
                        options: {
                            getExtraDataAttributes: () => {}
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
                    icon: 'fa fa-graduation-cap',
                    writeValuesToDataNode: true,
                    init: mug => {
                        mug.p.name = "";
                        mug.p.description = "";
                        mug.p.time_estimate = "";
                    },
                    parseDataNode: (mug, node) => {
                        let children = node.children(),
                            mugConfig = mugConfigs[mug.__className];
                        if (children.length === 1) {
                            let child = children[0];
                            if (child.nodeName === mugConfig.rootName && child.getAttribute("xmlns") === CCC_XMLNS) {
                                $(child).children().each((i, el) => {
                                    mug.p[el.nodeName] = $(el).text();
                                });
                            }
                        }
                        return $([]);
                    },
                    getBindList: () => [],
                    spec: util.extend(baseSpec, {
                        nodeID: {
                            lstring: gettext('Module ID'),
                        },
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
                            widget: widgets.richTextarea,
                        },
                        time_estimate: {
                            lstring: gettext("Time Estimate"),
                            visibility: 'visible',
                            presence: 'required',
                            widget: widgets.text,
                            validationFunc: mug => {
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
            },
            ConnectAssessment: {
                rootName: "assessment",
                childNodes: [
                    "user_score",
                ],
                mugOptions: util.extend(baseMugOptions, {
                    typeName: 'Assessment Score',
                    icon: 'fa fa-leanpub',
                    init: mug => {
                        mug.p.user_score = "";
                    },
                    getBindList: mug => {
                        // return list of bind elements to add to the form
                        let mugConfig = mugConfigs[mug.__className];
                        return mugConfig.childNodes.map(childName => {
                            return {
                                nodeset: `${mug.absolutePath}/${mugConfig.rootName}/${childName}`,
                                calculate: mug.p[childName],
                            };
                        });
                    },
                    spec: util.extend(baseSpec, {
                        nodeID: {
                            lstring: gettext('Assessment ID'),
                        },
                        user_score: {
                            lstring: gettext("User Score"),
                            visibility: 'visible',
                            presence: 'required',
                            widget: widgets.xPath,
                            serialize: mugs.serializeXPath,
                            deserialize: mugs.deserializeXPath,
                            help: gettext('XPath expression for the users assessment score.'),
                        },
                    })
                }),
                sections: [_.extend({}, baseSection, {
                    properties: [
                        "nodeID",
                        "user_score",
                    ],
                })],
            },
            ConnectDeliverUnit: {
                rootName: "deliver",
                childNodes: [
                    "name",
                ],
                mugOptions: util.extend(baseMugOptions, {
                    typeName: 'Deliver Unit',
                    icon: 'fa fa-briefcase',
                    init: mug => {
                        mug.p.name = "";
                    },
                    getBindList: mug => {
                        // return list of bind elements to add to the form
                        let mugConfig = mugConfigs[mug.__className];
                        return mugConfig.childNodes.map(childName => {
                            return {
                                nodeset: `${mug.absolutePath}/${mugConfig.rootName}/${childName}`,
                                calculate: mug.p[childName],
                            };
                        });
                    },
                    spec: util.extend(baseSpec, {
                        nodeID: {
                            lstring: gettext('Delivery Unit ID'),
                        },
                        name: {
                            lstring: gettext("Name"),
                            visibility: 'visible',
                            presence: 'required',
                            widget: widgets.text,
                        },
                    })
                }),
                sections: [_.extend({}, baseSection, {
                    properties: [
                        "nodeID",
                        "name",
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
            if (Object.hasOwn(mugConfigs, mug.__className)) {
                return _.map(mugConfigs[mug.__className].sections, section => _.clone(section));
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
                            mug.p[attr] = el.xmlAttr("calculate");
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
});
