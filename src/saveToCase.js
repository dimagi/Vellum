define([
    'vellum/form',
    'jquery',
    'underscore',
    'vellum/mugs',
    'vellum/parser',
    'vellum/tree',
    'vellum/util',
    'vellum/widgets',
    'vellum/core'
], function (
    form_,
    $,
    _,
    mugs,
    parser,
    Tree,
    util,
    widgets
){

    var CASE_XMLNS = "http://commcarehq.org/case/transaction/v2",
        saveToCaseMugOptions = {
            typeName: 'Save to Case',
            isTypeChangeable: false,
            isDataOnly: true,
            supportsDataNodeRole: true,
            icon: 'icon-italic',
            init: function (mug, form) {},
            spec: {
                xmlnsAttr: { presence: "optional" },
                relevantAttr: { presence: "optional" },
                caseProperty: {
                    lstring: 'Case Property',
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.text,
                },
                action: {
                    lstring: 'Action',
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.text,
                },
                source: {
                    lstring: 'Source',
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.droppableText,
                }
            },
            getExtraDataAttributes: function (mug) {
                return {
                    "vellum:role": "SaveToCase"
                };
            },
            dataChildFilter: function (children, mug) {
                var prop = new Tree.Node(children, {
                        getNodeID: function () { return mug.p.caseProperty; },
                        p: {rawDataAttributes: null},
                        options: { }
                    }),
                    action = [new Tree.Node([prop], {
                        getNodeID: function () { return mug.p.action; },
                        p: {rawDataAttributes: null},
                        options: { }
                    })];
                return [new Tree.Node(action, {
                    getNodeID: function () { return "c:case"; },
                    p: {rawDataAttributes: null},
                    options: { 
                        getExtraDataAttributes: function (mug) {
                            return {
                                "xmlns:c": CASE_XMLNS,
                                case_id: '',
                                date_modified: '',
                                user_id: '',
                            };
                        }
                    }
                })];

            },
            getBindList: function (mug) {
                return [{
                    nodeset: mug.absolutePath + "/case/" + mug.p.action + "/" + mug.p.caseProperty,
                    relevant: mug.p.relevantAttr,
                    calculate: mug.p.source,
                }];
            },
            parseDataNode: function (mug, $node) {
                var case_ = $node.children(),
                    action = case_.children(),
                    property = action.children();
                mug.p.caseProperty = property.prop('tagName');
                mug.p.action = action.prop('tagName');
                return $([]);
            }
        },
        sectionData = {
            SaveToCase: [
                {
                    slug: "main",
                    displayName: "Basic",
                    properties: [
                        "nodeID",
                        "action",
                        "caseProperty",
                        "source",
                        "relevantAttr",
                    ],
                }
            ]
        };

    $.vellum.plugin("saveToCase", {}, {
        getAdvancedQuestions: function () {
            return this.__callOld().concat(["SaveToCase"]);
        },
        getMugTypes: function () {
            var types = this.__callOld();
            types.normal.SaveToCase = util.extend(
                mugs.defaultOptions, saveToCaseMugOptions);
            return types;
        },
        getSections: function (mug) {
            if (sectionData.hasOwnProperty(mug.__className)) {
                return _.map(sectionData[mug.__className], function (section) {
                    return _.clone(section);
                });
            }
            return this.__callOld();
        },
        parseBindElement: function (form, el, path) {
            var mug = form.getMugByPath(path);
            if (!mug) {
                var basePath = path.replace(/\/case\/[\w_]*\/[\w_]*$/, "");
                if (path !== basePath) {
                    mug = form.getMugByPath(basePath);
                    if (mug.__className === "SaveToCase") {
                        mug.p.relevantAttr = el.attr("relevant");
                        mug.p.source = el.attr("calculate");
                        return;
                    }
                }
            }
            this.__callOld();
        }
    });
});
