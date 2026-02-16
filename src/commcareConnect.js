/**
 * CommCare Connect plugin for Vellum
 *
 * This plugin adds two new mug types:
 * - Learn Module
 * - Assessment Score
 * - Delivery Unit
 */
import $ from "jquery";
import _ from "underscore";
import mugs from "vellum/mugs";
import Tree from "vellum/tree";
import util from "vellum/util";
import widgets from "vellum/widgets";
import "vellum/core";

let CCC_XMLNS = 'http://commcareconnect.com/data/v1/learn';
let baseSection = {
    slug: "main",
    displayName: gettext("Basic"),
    properties: [
        "nodeID",
    ],
};
let logicSection = {
    slug: "logic",
    displayName: gettext("Logic"),
    help: {
        title: gettext("Logic"),
        text: gettext("Use logic to control when questions are asked and what answers are valid. " +
            "You can add logic to display a question based on a previous answer, to make " +
            "the question required or ensure the answer is in a valid range."),
        link: "https://confluence.dimagi.com/display/commcarepublic/Common+Logic+and+Calculations"
    },
    properties: [
        'relevantAttr',
    ]
};
let baseSpec = {
    xmlnsAttr: {
        presence: "optional",
        serialize: () => {},
        deserialize: () => {}
    },
    requiredAttr: {presence: "notallowed"},
    constraintAttr: {presence: "notallowed"},
    calculateAttr: {presence: "notallowed"}
};
let baseMugOptions = {
    isTypeChangeable: false,
    isDataOnly: true,
    supportsDataNodeRole: true,
    getExtraDataAttributes: mug => ({
        // allows the parser to know which mug to associate with this node
        "vellum:role": mug.__className,
    }),
    getBindList: mug => {
        // return list of bind elements to add to the form
        let mugConfig = mugConfigs[mug.__className];
        let binds = [{
            nodeset: mug.hashtagPath,
            relevant: mug.p.relevantAttr,
        }];
        return binds.concat(mugConfig.childNodes.filter(child => !child.writeToData).map(child => {
            return {
                nodeset: `${mug.absolutePath}/${mugConfig.rootName}/${child.id}`,
                calculate: mug.p[child.id],
            };
        }));
    },
    parseDataNode: (mug, node) => {
        let children = node.children();
        let mugConfig = mugConfigs[mug.__className];
        if (children.length === 1) {
            let child = children[0];
            if (child.nodeName === mugConfig.rootName && child.getAttribute("xmlns") === CCC_XMLNS) {
                $(child).children().each((i, el) => {
                    let childConfig = mugConfig.childNodes.find(child => child.id === el.nodeName);
                    if (childConfig && childConfig.writeToData) {
                        mug.p[el.nodeName] = $(el).text();
                    }
                });
            }
        }
        return $([]);
    },
    dataChildFilter: (children, mug) => {
        // called during write
        // return a list nodes to add to the forms data node
        children = mugConfigs[mug.__className].childNodes.map(child => {
            let p = {rawDataAttributes: null};
            if (child.writeToData) {
                p.dataValue = mug.p[child.id];
            }
            return new Tree.Node([], {
                getNodeID: () => child.id,
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
};
let mugConfigs = {
    ConnectLearnModule: {
        rootName: "module",
        childNodes: [
            {id: "name", writeToData: true},
            {id: "description", writeToData: true},
            {id: "time_estimate", writeToData: true},
        ],
        mugOptions: util.extend(baseMugOptions, {
            typeName: 'Learn Module',
            icon: 'fa fa-graduation-cap',
            init: mug => {
                mug.p.name = "";
                mug.p.description = "";
                mug.p.time_estimate = "";
            },
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
                relevantAttr: {
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: "bool",
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    lstring: gettext('Display Condition'),
                }
            })
        }),
        sections: [
            _.extend({}, baseSection, {
                properties: [
                    "nodeID",
                    "name",
                    "description",
                    "time_estimate",
                ],
            }),
            _.clone(logicSection),
        ],
    },
    ConnectTask: {
        rootName: "task",
        childNodes: [
            {id: "name", writeToData: true},
            {id: "description", writeToData: true},
        ],
        mugOptions: util.extend(baseMugOptions, {
            typeName: 'Task',
            icon: 'fa fa-tasks',
            init: mug => {
                mug.p.name = "";
                mug.p.description = "";
            },
            spec: util.extend(baseSpec, {
                nodeID: {
                    lstring: gettext('Task ID'),
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
                relevantAttr: {
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: "bool",
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    lstring: gettext('Display Condition'),
                }
            })
        }),
        sections: [
            _.extend({}, baseSection, {
                properties: [
                    "nodeID",
                    "name",
                    "description",
                ],
            }),
            _.clone(logicSection),
        ],
    },
    ConnectAssessment: {
        rootName: "assessment",
        childNodes: [
            {id: "user_score"},
        ],
        mugOptions: util.extend(baseMugOptions, {
            typeName: 'Assessment Score',
            icon: 'fa-brands fa-leanpub',
            init: mug => {
                mug.p.user_score = "";
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
                relevantAttr: {
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: "bool",
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    lstring: gettext('Display Condition')
                }
            })
        }),
        sections: [
            _.extend({}, baseSection, {
                properties: [
                    "nodeID",
                    "user_score",
                ],
            }),
            _.clone(logicSection),
        ],
    },
    ConnectDeliverUnit: {
        rootName: "deliver",
        childNodes: [
            {id: "name", writeToData: true},
            {id: "entity_id"},
            {id: "entity_name"},
        ],
        mugOptions: util.extend(baseMugOptions, {
            typeName: 'Deliver Unit',
            icon: 'fa fa-briefcase',
            init: mug => {
                mug.p.name = "";
                mug.p.entity_id = "";
                mug.p.entity_name = "";
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
                entity_id: {
                    lstring: gettext("Entity ID"),
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    help: gettext('XPath expression for the entity ID associated with this Delivery Unit e.g. the case ID.'),
                },
                entity_name: {
                    lstring: gettext("Entity Name"),
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    help: gettext('XPath expression for the name of the entity associated with this Delivery Unit.'),
                },
                relevantAttr: {
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: "bool",
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    lstring: gettext('Display Condition')
                }
            })
        }),
        sections: [
            _.extend({}, baseSection, {
                properties: [
                    "nodeID",
                    "name",
                    "entity_id",
                    "entity_name",
                ],
            }),
            _.clone(logicSection),
        ],
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
            // check each mugConfig to see if this path matches
            let matched = Object.entries(mugConfigs).some(([mugName, mugConfig]) => {
                // construct regex to match any of the child nodes
                let children = mugConfig.childNodes.map(child => child.id).join('|');
                let regex = new RegExp(`/${mugConfig.rootName}/(${children})`);
                let matchRet = path.match(regex);
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
        } else {
            if (Object.hasOwn(mugConfigs, mug.__className)) {
                mug.p.relevantAttr = el.xmlAttr("relevant");
                return;
            }
        }
        this.__callOld();
    },
});
