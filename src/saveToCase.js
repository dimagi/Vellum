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
    var SaveToCaseWidget = function (mug, options) {
        var basePath = options.path;
        var propertyOptions = util.extend(options, {
                path: basePath + ".property",
            }),
            actionOptions = util.extend(options, {
                path: basePath + ".action",
            }),
            sourceOptions = util.extend(options, {
                path: basePath + ".source",
            }),
            relevantAttrOptions = util.extend(options, {
                path: basePath + ".relevantAttr",
            });
        var widget = widgets.normal(mug, options),
            property = widgets.text(mug, propertyOptions),
            action = widgets.dropdown(mug, actionOptions),
            source = widgets.droppableText(mug, sourceOptions),
            relevantAttr = widgets.xPath(mug, relevantAttrOptions),
            path = options.widgetValuePath || options.path,
            currentValue = mug.p[path];

        widget.currentValue = currentValue;

        action.addOptions([
            {
                value: "index",
                text: "index"
            },
            {
                value: "create",
                text: "create"
            },
            {
                value: "update",
                text: "update"
            },
            {
                value: "close",
                text: "close"
            },
            {
                value: "attachment",
                text: "attachment"
            },
        ]);

        property.handleChange = widget.handleChange;
        action.handleChange = widget.handleChange;
        source.handleChange = widget.handleChange;
        relevantAttr.handleChange = widget.handleChange;

        widget.save = function () {
            this.mug.p[this.path] = this.getValue();
            property.save();
            action.save();
            source.save();
            relevantAttr.save();
        };

        widget.getUIElement = function() {
            return $('<div>').append(action.getUIElement())
                .append(property.getUIElement())
                .append(source.getUIElement())
                .append(relevantAttr.getUIElement())
                .css("border-radius", "10px")
                .css("background-color", "lightgrey")
                .css("padding", "10px");
        };

        widget.getValue = function() {
            return {
                property: property.getValue(),
                action: action.getValue(),
                source: source.getValue(),
                relevantAttr: relevantAttr.getValue(),
            };
        };
        
        widget.setValue = function(val) {
            currentValue = val;
            if (val) {
                property.setValue(val.property);
                action.setValue(val.action);
                source.setValue(val.source);
                relevantAttr.setValue(val.relevantAttr);
            }
        };
        
        return widget;
    };

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
                caseProperties: {
                    lstring: "invisible",
                    visibility: 'visibile',
                    presence: 'optional',
                    widget: SaveToCaseWidget
                },
                "caseProperties.relevantAttr": { 
                    lstring: "Conditional",
                    presence: "optional" 
                },
                "caseProperties.property": {
                    lstring: 'Case Property',
                    visibility: 'visible',
                    presence: 'optional',
                },
                "caseProperties.action": {
                    lstring: 'Action',
                    visibility: 'visible',
                    presence: 'optional',
                },
                "caseProperties.source": {
                    lstring: 'Source',
                    visibility: 'visible',
                    presence: 'optional',
                }
            },
            getExtraDataAttributes: function (mug) {
                return {
                    "vellum:role": "SaveToCase"
                };
            },
            dataChildFilter: function (children, mug) {
                var prop = new Tree.Node(children, {
                        getNodeID: function () { return mug.p.caseProperties.property; },
                        p: {rawDataAttributes: null},
                        options: { }
                    }),
                    action = [new Tree.Node([prop], {
                        getNodeID: function () { return mug.p.caseProperties.action; },
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
                    nodeset: mug.absolutePath + "/case/" + mug.p.caseProperties.action + "/" + mug.p.caseProperties.property,
                    relevant: mug.p.caseProperties.relevantAttr,
                    calculate: mug.p.caseProperties.source,
                }];
            },
            parseDataNode: function (mug, $node) {
                var case_ = $node.children(),
                    action = case_.children(),
                    property = action.children(),
                    caseProperties = mug.p.caseProperties = {};
                caseProperties.property = property.prop('tagName');
                caseProperties.action = action.prop('tagName');
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
                        "caseProperties",
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
                        mug.p.caseProperties.relevantAttr = el.attr("relevant");
                        mug.p.caseProperties.source = el.attr("calculate");
                        return;
                    }
                }
            }
            this.__callOld();
        }
    });
});
