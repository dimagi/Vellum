define([
    'vellum/form',
    'jquery',
    'underscore',
    'vellum/mugs',
    'vellum/parser',
    'vellum/tree',
    'vellum/util',
    'vellum/widgets',
    'tpl!vellum/templates/widget_update_case',
    'tpl!vellum/templates/widget_index_case',
    'tpl!vellum/templates/widget_save_to_case',
    'vellum/core'
], function (
    form_,
    $,
    _,
    mugs,
    parser,
    Tree,
    util,
    widgets,
    widget_update_case,
    widget_index_case,
    widget_save_to_case
){
    function createsCase(mug) {
        return mug ? mug.p.use_create : false;
    }

    function closesCase(mug) {
        return mug ? mug.p.use_close : false;
    }

    function updatesCase(mug) {
        return mug ? mug.p.use_update : false;
    }

    function indexesCase(mug) {
        return mug ? mug.p.use_index : false;
    }

    function addSetValue(mug) {
        var path = mug.absolutePath;

        if (createsCase(mug)) {
            mug.form.addSetValue('xforms-ready', path + "/case/@case_id", mug.p.case_id);
        }
    }

    var propertyWidget = function (mug, options) {
            var widget = widgets.normal(mug, options),
                id = options.id,
                internal_template = options.template;

            widget.input = $('<div class="control-row" />').attr('name', id);

            widget.getControl = function () {
                return widget.input;
            };

            widget.refreshControl = function (value) {
                value = value ? value : widget.getValue();
                widget.input.html(widget_save_to_case({
                    internal_template: internal_template,
                    props: value
                }));
                widget.input.find('input').bind('change keyup', function () {
                    widget.handleChange();
                });
                widget.input.find('.fd-add-property').click(widget.addProperty);
                widget.input.find('.fd-remove-property').click(widget.removeProperty);
            };

            widget.setValue = function (value) {
                value = _.isUndefined(value) ? {} : value;
                widget.refreshControl(value);
            };

            widget.updateValue = function () {
                var currentValues = widget.getValue();
                if (!("" in currentValues)) {
                    widget.input.find('.btn').removeClass('hide');
                    widget.input.find('.fd-remove-property').removeClass('hide');
                }
                widget.save();
            };

            widget.removeProperty = function(e) {
                $(this).parent().parent().parent().remove();
                widget.refreshControl();
                widget.save();
                e.preventDefault();
            };

            widget.addProperty = function(e) {
                widget.refreshControl();
                e.preventDefault();
            };

            return widget;
        },
        saveCasePropWidget = function (mug, options) {
            options.template = widget_update_case;
            var widget = propertyWidget(mug, options);

            widget.getValue = function () {
                var currentValues = {};
                _.each(widget.input.find('.fd-update-property'), function (kvPair) {
                    var $pair = $(kvPair);
                    currentValues[$pair.find('.fd-update-property-name').val()] = {
                        calculate: $pair.find('.fd-update-property-source').val(),
                        relevant: $pair.find('.fd-update-property-relevant').val(),
                    };
                });
                return currentValues;
            };

            return widget;
        },
        indexCaseWidget = function (mug, options) {
            options.template = widget_index_case;
            var widget = propertyWidget(mug, options);

            widget.getValue = function () {
                var currentValues = {};
                _.each(widget.input.find('.fd-index-property'), function (kvPair) {
                    var $pair = $(kvPair);
                    currentValues[$pair.find('.fd-index-property-name').val()] = {
                        calculate: $pair.find('.fd-index-property-source').val(),
                        case_type: $pair.find('.fd-index-property-case-type').val(),
                        relationship: $pair.find('.fd-index-property-relationship').val(),
                    };
                });
                return currentValues;
            };

            return widget;
        };

    var CASE_XMLNS = "http://commcarehq.org/case/transaction/v2",
        VALID_PROP_REGEX = /^[a-z_]+$/i,
        saveToCaseMugOptions = {
            typeName: 'Save to Case',
            isTypeChangeable: false,
            isDataOnly: true,
            supportsDataNodeRole: true,
            icon: 'icon-save',
            init: function (mug, form) {},
            spec: {
                xmlnsAttr: { presence: "optional" },
                "date_modified": {
                    lstring: "Date modified",
                    visibility: 'visible',
                    presence: 'required',
                    widget: widgets.xPath,
                },
                "user_id": {
                    lstring: "User ID",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath
                },
                "case_id": {
                    lstring: "Case ID",
                    visibility: 'visible',
                    presence: 'required',
                    widget: widgets.xPath,
                },
                "use_create": {
                    lstring: "Create Case",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.checkbox
                },
                "create_property": {
                    lstring: "Properties To Create",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: saveCasePropWidget,
                    validationFunc: function (mug) {
                        if (mug.p.use_create) {
                            var props = _.without(_.keys(mug.p.create_property), ""),
                                required = ["case_type", "case_name"],
                                optional = ["owner_id"],
                                legal = _.union(required, optional),
                                illegalProps = _.difference(props, legal),
                                requiredProps = _.intersection(props, required),
                                invalidProps = _.filter(props, function(p) {
                                    return !VALID_PROP_REGEX.test(p);
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
                    lstring: "Properties To Update",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: saveCasePropWidget,
                    validationFunc: function (mug) {
                        if (mug.p.use_update) {
                            var props = _.without(_.keys(mug.p.update_property), ""),
                                invalidProps = _.filter(props, function(p) {
                                    return !VALID_PROP_REGEX.test(p);
                                });

                            if (invalidProps.length > 0) {
                                return invalidProps.join(", ") + 
                                    " are invalid properties";
                            }
                        }
                        return 'pass';
                    }
                },
                "use_index": {
                    lstring: "Use Index",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.checkbox
                },
                "index_property": {
                    lstring: "Index Properties",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: indexCaseWidget,
                    validationFunc: function (mug) {
                        if (mug.p.use_index) {
                            var props = _.without(_.keys(mug.p.index_property), ""),
                                invalidProps = _.filter(props, function(p) {
                                    return !VALID_PROP_REGEX.test(p);
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
                addSetValue(mug);
                return {
                    "vellum:role": "SaveToCase"
                };
            },
            dataChildFilter: function (children, mug) {
                function simpleNode(name, children, dataAttributes) {
                    children = children ? children : [];
                    var node = new Tree.Node(children, {
                        getNodeID: function () { return name; },
                        p: {
                            rawDataAttributes: null
                        },
                        options: { 
                            getExtraDataAttributes: function (mug) {
                                return dataAttributes;
                            }
                        }
                    });
                    return node;
                }

                function makeColumns(properties, dataKeys) {
                    return _.chain(properties).map(function(v, k) {
                        if (k) {
                            return simpleNode(k, [], _.pick(v, dataKeys));
                        }
                    }).compact().value();
                }

                var actions = [];
                if (createsCase(mug)) {
                    actions.push(simpleNode('create', makeColumns(mug.p.create_property)));
                }

                if (updatesCase(mug)) {
                    actions.push(simpleNode('update', makeColumns(mug.p.update_property)));
                }

                if (closesCase(mug)) {
                    actions.push(simpleNode('close'));
                }

                if (indexesCase(mug)) {
                    actions.push(simpleNode('index', 
                                            makeColumns(mug.p.index_property, 
                                                        ['case_type', 'relationship'])));
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
                function generateBinds(action, properties) {
                    return _.chain(properties).omit("").map(function(v, k) {
                        return {
                            nodeset: mug.absolutePath + "/case/" + action + "/" + k,
                            calculate: v.calculate,
                            relevant: v.relevant
                        };
                    }).value();
                }

                if (createsCase(mug)) {
                    ret = ret.concat(generateBinds('create', mug.p.create_property));
                }
                if (updatesCase(mug)) {
                    ret = ret.concat(generateBinds('update', mug.p.update_property));
                }
                if (closesCase(mug)) {
                    ret.push({
                        nodeset: mug.absolutePath + "/case/close",
                        relevant: mug.p.close_condition
                    });
                }
                if (indexesCase(mug)) {
                    ret = ret.concat(generateBinds('index', mug.p.index_property));
                }

                if (createsCase(mug) || updatesCase(mug) || closesCase(mug) || indexesCase(mug)) {
                    ret.push({
                        nodeset: mug.absolutePath + "/case/@date_modified",
                        calculate: mug.p.date_modified,
                        type: "xsd:dateTime"
                    });
                    ret.push({
                        nodeset: mug.absolutePath + "/case/@user_id",
                        calculate: mug.p.user_id
                    });

                    if (!createsCase(mug)) {
                        ret.push({
                            nodeset: mug.absolutePath + "/case/@case_id",
                            calculate: mug.p.case_id
                        });
                    }
                }
                return ret;
            },
            parseDataNode: function (mug, $node) {
                var case_ = $node.children(),
                    create = case_.find('create'),
                    close = case_.find('close'),
                    update = case_.find('update'),
                    index = case_.find('index');
                if (create && create.length !== 0) {
                    mug.p.use_create = true;
                }
                if (update && update.length !== 0) {
                    mug.p.use_update = true;
                }
                if (close && close.length !== 0) {
                    mug.p.use_close = true;
                }
                if (index && index.length !== 0) {
                    mug.p.use_index = true;
                    mug.p.index_property = {};
                    _.each(index.children(), function(child) {
                        var prop = $(child);
                        mug.p.index_property[prop.prop('tagName')] = {
                            case_type: prop.attr('case_type'),
                            relationship: prop.attr('relationship')
                        };
                    });
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
                        "date_modified",
                        "user_id",
                        "case_id",
                    ],
                },
                {
                    slug: "create",
                    displayName: "Create",
                    properties: [
                        "use_create",
                        "create_property",
                    ],
                    isCollapsed: function (mug) {
                        return !createsCase(mug);
                    },
                },
                {
                    slug: "update",
                    displayName: "Update",
                    properties: [
                        "use_update",
                        "update_property",
                    ],
                    isCollapsed: function (mug) {
                        return !updatesCase(mug);
                    },
                },
                {
                    slug: "close",
                    displayName: "Close",
                    properties: [
                        "use_close",
                        "close_condition",
                    ],
                    isCollapsed: function (mug) {
                        return !closesCase(mug);
                    },
                },
                {
                    slug: "index",
                    displayName: "Index",
                    properties: [
                        "use_index",
                        "index_property",
                    ],
                    isCollapsed: function (mug) {
                        return !indexesCase(mug);
                    },
                },
            ]
        };

    $.vellum.plugin("saveToCase", {}, {
        getAdvancedQuestions: function () {
            return this.__callOld().concat(["SaveToCase"]);
        },
        handleMugParseFinish: function (mug) {
            this.__callOld();
            // cases that are created use a setvalue for case_id
            if (!createsCase(mug)) {
                return;
            }
            var values = _.object(_.map(mug.form.getSetValues(), function (value) {
                    return [value.ref, value];
                })),
                caseIdRegex = new RegExp(mug.p.nodeID + "/case/@case_id$");

            _.each(values, function(value) {
                if (caseIdRegex.test(value.ref)) {
                    mug.p.case_id = value.value;
                }
            });
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
                    var tmpSection = _.clone(section);
                    if (_.isFunction(tmpSection.isCollapsed)) {
                        tmpSection.isCollapsed = tmpSection.isCollapsed(mug);
                    }
                    return tmpSection;
                });
            }
            return this.__callOld();
        },
        parseBindElement: function (form, el, path) {
            var mug = form.getMugByPath(path);
            if (!mug) {
                var casePathRegex = /\/case\/(?:(create|update|index)\/(\w+)|(close|@date_modified|@user_id|@case_id))$/,
                    matchRet = path.match(casePathRegex);
                if (matchRet.length > 0) {
                    var basePath = path.replace(casePathRegex, "");
                    mug = form.getMugByPath(basePath);
                    if (mug && mug.__className === "SaveToCase") {
                        if (matchRet[2]) {
                            var prop = matchRet[2],
                                pKey = {
                                    create: "create_property",
                                    update: "update_property",
                                    index: "index_property",
                                }[matchRet[1]];

                            if (!mug.p[pKey]) {
                                mug.p[pKey] = {};
                            }
                            if (!mug.p[pKey][prop]) {
                                mug.p[pKey][prop] = {};
                            }
                            mug.p[pKey][prop].calculate =  el.attr("calculate");
                            if (el.attr('relevant')) {
                                mug.p[pKey][prop].relevant =  el.attr("relevant");
                            }
                            return;
                        } else {
                            var attr = {
                                close: {
                                    mugProp: 'close_condition',
                                    elAttr: 'relevant'
                                },
                                '@date_modified': {
                                    mugProp: 'date_modified',
                                    elAttr: 'calculate'
                                },
                                '@user_id': {
                                    mugProp: 'user_id',
                                    elAttr: 'calculate'
                                },
                                '@case_id': {
                                    mugProp: 'case_id',
                                    elAttr: 'calculate'
                                },
                            }[matchRet[3]];

                            mug.p[attr.mugProp] = el.attr(attr.elAttr);
                            return;
                        }
                        form.parseWarnings.push(
                            "An error occurred when parsing bind node [" +
                            path + "]. Please fix this.");
                        return;
                    }
                }
            }
            this.__callOld();
        }
    });
});
