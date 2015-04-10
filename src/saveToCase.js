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

    function createsCase(mug) {
        return mug ? mug.p.use_create : false;
    }

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
                "use_create": {
                    lstring: "Create Case",
                    visibility: 'visibile',
                    presence: 'optional',
                    widget: widgets.checkbox
                },
                "case_type": {
                    lstring: "Case Type",
                    visibility: 'visibile',
                    presence: 'optional',
                    widget: widgets.text
                },
                "case_name": {
                    lstring: "Case Name",
                    visibility: 'visibile',
                    presence: 'optional',
                    widget: widgets.text
                },
                "owner_id": {
                    lstring: "Owner ID",
                    visibility: 'visibile',
                    presence: 'optional',
                    widget: widgets.checkbox
                }
            },
            getExtraDataAttributes: function (mug) {
                return {
                    "vellum:role": "SaveToCase"
                };
            },
            dataChildFilter: function (children, mug) {
                function simpleNode(name, children, dataValue) {
                    children = children ? children : [];
                    var node = new Tree.Node(children, {
                        getNodeID: function () { return name; },
                        p: {rawDataAttributes: null},
                        options: { }
                    });
                    if (dataValue) {
                        node.value.p.dataValue = dataValue;
                    }
                    return node;
                }

                var actions = [];
                if (createsCase(mug)) {
                    var columns = [
                        simpleNode('case_type', [], mug.p.case_type), 
                        simpleNode('case_name')
                    ];
                    if (mug.p.owner_id) {
                        columns.push(simpleNode('owner_id'));
                    }
                    actions.push(simpleNode('create', columns));
                }

                return [new Tree.Node(actions, {
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
                var ret = [];
                if (createsCase(mug)) {
                    ret.push({
                        nodeset: mug.absolutePath + "/case/create/case_name",
                        calculate: mug.p.case_name
                    });
                    if (mug.p.owner_id) {
                        ret.push({
                            nodeset: mug.absolutePath + "/case/create/owner_id",
                            calculate: '/data/meta/userID'
                        });
                    }
                }
                return ret;
            },
            parseDataNode: function (mug, $node) {
                var case_ = $node.children(),
                    action = case_.children(),
                    properties = action.children(),
                    create = case_.find('create');
                if (create) {
                    mug.p.use_create = true;
                    mug.p.case_type = $.trim(create.find('case_type').text());
                    if (create.find('owner_id')) {
                        mug.p.owner_id = true;
                    }
                }
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
                },
                {
                    slug: "create",
                    displayName: "Create",
                    properties: [
                        "use_create",
                        "case_type",
                        "case_name",
                        "owner_id"
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
                        var attribute = _.last(path.split(/\/case\/create\//));
                        if (attribute === "owner_id") {
                            return;
                        }
                        mug.p[attribute] = el.attr("calculate");
                        return;
                    }
                }
            }
            this.__callOld();
        }
    });
});
