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

    function closesCase(mug) {
        return mug ? mug.p.use_close : false;
    }

    function updatesCase(mug) {
        return mug ? mug.p.use_update : false;
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
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.checkbox
                },
                "create_property": {
                    lstring: "Update",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.saveCaseProp,
                    validationFunc: function (mug) {
                        if (mug.p.use_create) {
                            var props = _.without(_.keys(mug.p.create_property), ""),
                                required = ["case_type", "case_name"],
                                optional = ["owner_id"],
                                legal = _.union(required, optional),
                                illegalProps = _.difference(props, legal),
                                requiredProps = _.intersection(props, required),
                                invalidProps = _.filter(props, function(p) {
                                    return !/[a-z_]*/.test(p);
                                });

                            if (requiredProps.length !== required.length) {
                                return "You must include " + 
                                    required.join(", ") + 
                                    " columns to create a case";
                            } else if (illegalProps.length > 0) {
                                return "You can only use the following properties: " +
                                    legal.join(', ');
                            } else if (invalidProps.length > 0) {
                                return invalidProps.join(", ") + 
                                    " are invalid properties";
                            }

                        }
                        return 'pass';
                    }
                },
                "use_close": {
                    lstring: "Close Case",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.checkbox
                },
                "close_condition": {
                    lstring: "Close Condition",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath
                },
                "use_update": {
                    lstring: "Update Case",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.checkbox
                },
                "update_property": {
                    lstring: "Update",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.saveCaseProp,
                    validationFunc: function (mug) {
                        if (mug.p.use_update) {
                            var props = _.without(_.keys(mug.p.update_property), ""),
                                invalidProps = _.filter(props, function(p) {
                                    return !/[a-z_]*/.test(p);
                                });

                            if (invalidProps.length > 0) {
                                return invalidProps.join(", ") + 
                                    " are invalid properties";
                            }
                        }
                        return 'pass';
                    }
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

                var actions = [], columns;
                if (createsCase(mug)) {
                    columns = _.filter(_.map(mug.p.create_property, function(v, k) {
                        if (k) {
                            return simpleNode(k);
                        }
                    }), function(v) { return v; });
                    actions.push(simpleNode('create', columns));
                }

                if (updatesCase(mug)) {
                    columns = _.filter(_.map(mug.p.update_property, function(v, k) {
                        if (k) {
                            return simpleNode(k);
                        }
                    }), function(v) { return v; });
                    actions.push(simpleNode('update', columns));
                }

                if (closesCase(mug)) {
                    actions.push(simpleNode('close'));
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
                var ret = [],
                    b;
                if (createsCase(mug)) {
                    b = _.map(mug.p.create_property, function(v, k) {
                        if (k) {
                            return {
                                nodeset: mug.absolutePath + "/case/create/" + k,
                                calculate: v.calculate,
                                relevant: v.relevant
                            };
                        }
                    });
                    ret = ret.concat(_.filter(b, function(v) {
                        return v;
                    }));
                }
                if (updatesCase(mug)) {
                    b = _.map(mug.p.update_property, function(v, k) {
                        if (k) {
                            return {
                                nodeset: mug.absolutePath + "/case/update/" + k,
                                calculate: v.calculate,
                                relevant: v.relevant
                            };
                        }
                    });
                    ret = ret.concat(_.filter(b, function(v) {
                        return v;
                    }));
                }
                if (closesCase(mug)) {
                    ret.push({
                        nodeset: mug.absolutePath + "/case/close",
                        relevant: mug.p.close_condition
                    });
                }
                return ret;
            },
            parseDataNode: function (mug, $node) {
                var case_ = $node.children(),
                    create = case_.find('create'),
                    close = case_.find('close'),
                    update = case_.find('update');
                if (create && create.length !== 0) {
                    mug.p.use_create = true;
                }
                if (update && update.length !== 0) {
                    mug.p.use_update = true;
                }
                if (close && close.length !== 0) {
                    mug.p.use_close = true;
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
                        "create_property",
                    ],
                },
                {
                    slug: "update",
                    displayName: "Update",
                    properties: [
                        "use_update",
                        "update_property",
                    ],
                },
                {
                    slug: "close",
                    displayName: "Close",
                    properties: [
                        "use_close",
                        "close_condition",
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
                        if (/\/case\/create\/[\w_]*$/.test(path)) {
                            var createAttr = _.last(path.split(/\/case\/create\//));
                            if (createAttr) {
                                if (!mug.p.create_property) {
                                    mug.p.create_property = {};
                                }
                                mug.p.create_property[createAttr] = {
                                    calculate: el.attr("calculate"),
                                    relevant: el.attr("relevant")
                                };
                            }
                            return;
                        }
                        if (/\/case\/update\/[\w_]*$/.test(path)) {
                            var updateAttr = _.last(path.split(/\/case\/update\//));
                            if (updateAttr) {
                                if (!mug.p.update_property) {
                                    mug.p.update_property = {};
                                }
                                mug.p.update_property[updateAttr] = {
                                    calculate: el.attr("calculate"),
                                    relevant: el.attr("relevant")
                                };
                            }
                        }
                        return;
                    }
                }
                var closePath = path.replace(/\/case\/close$/, "");
                if (path !== closePath) {
                    mug = form.getMugByPath(closePath);
                    if (mug.__className === "SaveToCase") {
                        var closeAttr = /\/case\/close$/.test(path);
                        if (closeAttr && mug.p.use_close) {
                            mug.p.close_condition = el.attr('relevant');
                        }
                        return;
                    }
                }
            }
            this.__callOld();
        }
    });
});
