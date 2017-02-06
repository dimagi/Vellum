define([
    'jquery',
    'underscore',
    'vellum/mugs',
    'vellum/tree',
    'vellum/util',
    'vellum/atwho',
    'vellum/widgets',
    'tpl!vellum/templates/widget_update_case',
    'tpl!vellum/templates/widget_index_case',
    'tpl!vellum/templates/widget_attachment_case',
    'tpl!vellum/templates/widget_save_to_case',
    'vellum/core'
], function (
    $,
    _,
    mugs,
    Tree,
    util,
    atwho,
    widgets,
    widget_update_case,
    widget_index_case,
    widget_attach_case,
    widget_save_to_case
){
    function createsCase(mug) {
        return mug ? mug.p.useCreate : false;
    }

    function closesCase(mug) {
        return mug ? mug.p.useClose : false;
    }

    function updatesCase(mug) {
        return mug ? mug.p.useUpdate : false;
    }

    function indexesCase(mug) {
        return mug ? mug.p.useIndex : false;
    }

    function attachmentCase(mug) {
        return mug ? mug.p.useAttachment : false;
    }

    function usesCases(mug) {
        return createsCase(mug) || closesCase(mug) || updatesCase(mug) ||
            indexesCase(mug) || attachmentCase(mug);
    }

    var propertyWidget = function (mug, options) {
            var widget = widgets.normal(mug, options),
                id = options.id,
                internal_template = options.template;
            options.richText = false;

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
                widget.input.find('input').on('change keyup', function () {
                    widget.handleChange();
                });
                widget.input.find('.fd-add-property').click(widget.addProperty);
                widget.input.find('.fd-remove-property').click(widget.removeProperty);
                widget.input.find('input').addClass('jstree-drop');
                widget.input.find('input').each(function() {
                    atwho.autocomplete($(this), mug);
                });
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
        },
        attachmentCaseWidget = function (mug, options) {
            options.template = widget_attach_case;
            var widget = propertyWidget(mug, options);

            widget.getValue = function () {
                var currentValues = {};
                _.each(widget.input.find('.fd-attachment-property'), function (kvPair) {
                    var $pair = $(kvPair);
                    currentValues[$pair.find('.fd-attachment-property-name').val()] = {
                        calculate: $pair.find('.fd-attachment-property-source').val(),
                        from: $pair.find('.fd-attachment-property-from').val(),
                        name: $pair.find('.fd-attachment-name').val(),
                    };
                });
                return currentValues;
            };

            return widget;
        };

    var CASE_XMLNS = "http://commcarehq.org/case/transaction/v2",
        VALID_PROP_REGEX = /^[a-z0-9_-]+$/i,
        saveToCaseMugOptions = {
            typeName: 'Save to Case',
            isTypeChangeable: false,
            isDataOnly: true,
            supportsDataNodeRole: true,
            icon: 'fa fa-save',
            init: function (mug, form) {
                mug.p.date_modified = mug.p.date_modified || '/data/meta/timeEnd';
            },
            spec: {
                xmlnsAttr: { presence: "optional" },
                "date_modified": {
                    lstring: "Date Modified",
                    visibility: 'visible',
                    presence: 'required',
                    widget: widgets.xPath,
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                },
                "user_id": {
                    lstring: "User ID",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                },
                "case_type": {
                    lstring: "Case Type",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.text,
                },
                "case_id": {
                    lstring: "Case ID",
                    visibility: 'visible',
                    presence: 'required',
                    widget: widgets.xPath,
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                },
                useCreate: {
                    lstring: "Create Case",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.checkbox
                },
                createProperty: {
                    lstring: "Properties To Create",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: saveCasePropWidget,
                    validationFunc: function (mug) {
                        if (mug.p.useCreate) {
                            var props = _.without(_.keys(mug.p.createProperty), ""),
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
                useClose: {
                    lstring: "Close Case",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.checkbox
                },
                closeCondition: {
                    lstring: "Close Condition",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                },
                useUpdate: {
                    lstring: "Update Case",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.checkbox
                },
                updateProperty: {
                    lstring: "Properties To Update",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: saveCasePropWidget,
                    validationFunc: function (mug) {
                        if (mug.p.useUpdate) {
                            var props = _.without(_.keys(mug.p.updateProperty), ""),
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
                useIndex: {
                    lstring: "Use Index",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.checkbox
                },
                indexProperty: {
                    lstring: "Index Properties",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: indexCaseWidget,
                    validationFunc: function (mug) {
                        if (mug.p.useIndex) {
                            var props = _.without(_.keys(mug.p.indexProperty), ""),
                                invalidProps = _.filter(props, function(p) {
                                    return !VALID_PROP_REGEX.test(p);
                                }),
                                relationships = _.without(_.map(mug.p.indexProperty, function (v, k) {
                                    return v.relationship;
                                }), ""),
                                invalidRelationships = _.filter(relationships, function (r) {
                                    return !_.contains(['child', 'extension'], r);
                                });

                            if (invalidProps.length > 0) {
                                return invalidProps.join(", ") + 
                                    " are invalid properties";
                            } else if (invalidRelationships.length > 0) {
                                return "Relationship must be child or extension";
                            }
                        }
                        return 'pass';
                    }
                },
                useAttachment: {
                    lstring: "Use Attachments",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.checkbox
                },
                attachmentProperty: {
                    lstring: "Attachment Properties",
                    visibility: 'visible',
                    presence: 'optional',
                    widget: attachmentCaseWidget,
                    validationFunc: function (mug) {
                        if (!mug.p.useAttachment) {
                            return "pass";
                        }

                        var props = _.without(_.keys(mug.p.attachmentProperty), ""),
                            invalidProps = _.filter(props, function(p) {
                                return !VALID_PROP_REGEX.test(p);
                            }),
                            invalidFroms = _.filter(props, function(p) {
                                return !_.contains(['local', 'remote', 'inline'],
                                                   mug.p.attachmentProperty[p].from);
                            }),
                            invalidInlines = _.filter(props, function(p) {
                                var prop = mug.p.attachmentProperty[p],
                                    from = prop.from,
                                    name = prop.name;
                                return from === 'inline' && !name;
                            });

                        if (invalidProps.length > 0) {
                            return invalidProps.join(", ") + 
                                " are invalid properties";
                        }

                        if (invalidFroms.length > 0) {
                            return "The from attribute must be one of: " + 
                                "local, remote, or inline";
                        }
                        
                        if (invalidInlines.length > 0) {
                            return "Inlined attachments must have an " +
                                "attachment name";
                        }

                        return "pass";
                    }
                }
            },
            getExtraDataAttributes: function (mug) {
                return {
                    "vellum:role": "SaveToCase",
                    "vellum:case_type": mug.p.case_type || "",
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
                    actions.push(simpleNode('create', makeColumns(mug.p.createProperty)));
                }

                if (updatesCase(mug)) {
                    actions.push(simpleNode('update', makeColumns(mug.p.updateProperty)));
                }

                if (closesCase(mug)) {
                    actions.push(simpleNode('close'));
                }

                if (indexesCase(mug)) {
                    actions.push(simpleNode('index', 
                                            makeColumns(mug.p.indexProperty, 
                                                        ['case_type', 'relationship'])));
                }

                if (attachmentCase(mug)) {
                    actions.push(simpleNode('attachment', 
                                            makeColumns(mug.p.attachmentProperty, 
                                                        ['from', 'name'])));
                }

                return [new Tree.Node(actions, {
                    getNodeID: function () { return "case"; },
                    p: {rawDataAttributes: null},
                    options: { 
                        getExtraDataAttributes: function (mug) {
                            return {
                                "xmlns": CASE_XMLNS,
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
                    if (mug.isInRepeat()) {
                        ret = ret.concat({
                            nodeset: mug.absolutePath + "/case/@case_id",
                            calculate: mug.p.case_id
                        });
                    }
                    ret = ret.concat(generateBinds('create', mug.p.createProperty));
                }
                if (updatesCase(mug)) {
                    ret = ret.concat(generateBinds('update', mug.p.updateProperty));
                }
                if (closesCase(mug)) {
                    ret.push({
                        nodeset: mug.absolutePath + "/case/close",
                        relevant: mug.p.closeCondition
                    });
                }
                if (indexesCase(mug)) {
                    ret = ret.concat(generateBinds('index', mug.p.indexProperty));
                }
                if (attachmentCase(mug)) {
                    ret = ret.concat(
                        _.chain(mug.p.attachmentProperty)
                         .omit("")
                         .map(function(v, k) {
                             return {
                                 nodeset: mug.absolutePath + "/case/attachment/" + k + "/@src",
                                 calculate: v.calculate
                             };
                         }).value()
                    );
                }

                if (usesCases(mug)) {
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
                var case_type = $node.attr('vellum:case_type'),
                    case_ = $node.children(),
                    create = case_.find('create'),
                    close = case_.find('close'),
                    update = case_.find('update'),
                    index = case_.find('index'),
                    attach = case_.find('attachment');
                if (case_type) {
                    mug.p.case_type = case_type;
                }
                if (create && create.length !== 0) {
                    mug.p.useCreate = true;
                }
                if (update && update.length !== 0) {
                    mug.p.useUpdate = true;
                }
                if (close && close.length !== 0) {
                    mug.p.useClose = true;
                }
                if (index && index.length !== 0) {
                    mug.p.useIndex = true;
                    mug.p.indexProperty = {};
                    _.each(index.children(), function(child) {
                        var prop = $(child);
                        mug.p.indexProperty[prop.prop('tagName')] = {
                            case_type: prop.attr('case_type'),
                            relationship: prop.attr('relationship')
                        };
                    });
                }
                if (attach && attach.length !== 0) {
                    mug.p.useAttachment = true;
                    if (!mug.p.attachmentProperty) {
                        mug.p.attachmentProperty = {};
                    }
                    _.each(attach.children(), function(child) {
                        var prop = $(child);
                        mug.p.attachmentProperty[prop.prop('tagName')] = {
                            from: prop.attr('from'),
                            name: prop.attr('name')
                        };
                    });
                }
                return $([]);
            },
            getSetValues: function(mug) {
                if (createsCase(mug) && !mug.isInRepeat()) {
                    return [{
                        event: 'xforms-ready',
                        ref: mug.absolutePath + '/case/@case_id',
                        value: mug.p.case_id,
                    }];
                }
                return [];
            },
            getCaseSaveData: function (mug) {
                var propertyNames = _.union(
                    _.keys(mug.p.createProperty || {}),
                    _.keys(mug.p.updateProperty || {})
                );
                return {
                    case_type: mug.p.case_type || '',
                    properties: _.filter(propertyNames, _.identity), // filter out empty properties
                    create: mug.p.useCreate || false,
                    close: mug.p.useClose || false,
                };
            },
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
                        "case_type",
                        "case_id",
                    ],
                },
                {
                    slug: "create",
                    displayName: "Create",
                    properties: [
                        "useCreate",
                        "createProperty",
                    ],
                    isCollapsed: function (mug) {
                        return !createsCase(mug);
                    },
                },
                {
                    slug: "update",
                    displayName: "Update",
                    properties: [
                        "useUpdate",
                        "updateProperty",
                    ],
                    isCollapsed: function (mug) {
                        return !updatesCase(mug);
                    },
                },
                {
                    slug: "close",
                    displayName: "Close",
                    properties: [
                        "useClose",
                        "closeCondition",
                    ],
                    isCollapsed: function (mug) {
                        return !closesCase(mug);
                    },
                },
                {
                    slug: "index",
                    displayName: "Index",
                    properties: [
                        "useIndex",
                        "indexProperty",
                    ],
                    isCollapsed: function (mug) {
                        return !indexesCase(mug);
                    },
                },
                {
                    slug: "attachment",
                    displayName: "Attachments",
                    properties: [
                        "useAttachment",
                        "attachmentProperty",
                    ],
                    isCollapsed: function (mug) {
                        return !attachmentCase(mug);
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
                    mug.form.dropSetValues(function(inner) {
                        return value.ref === inner.ref;
                    });
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
                var casePathRegex = /\/case\/(?:(create|update|index)\/([\w-]+)|(close|@date_modified|@user_id|@case_id))$/,
                    matchRet = path.match(casePathRegex),
                    basePath;
                if (matchRet && matchRet.length > 0) {
                    basePath = path.replace(casePathRegex, "");
                    mug = form.getMugByPath(basePath);
                    if (mug && mug.__className === "SaveToCase") {
                        if (matchRet[2]) {
                            var prop = matchRet[2],
                                pKey = {
                                    create: "createProperty",
                                    update: "updateProperty",
                                    index: "indexProperty",
                                    attachment: "attachmentProperty",
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
                                    mugProp: 'closeCondition',
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
                
                var attachmentRegex = /\/case\/attachment\/(\w+)\/@src$/,
                    attachRet = path.match(attachmentRegex);
                if (attachRet) {
                    basePath = path.replace(attachmentRegex, "");
                    mug = form.getMugByPath(basePath);
                    if (mug && mug.__className === "SaveToCase") {
                        var attachProperties = mug.p.attachmentProperty,
                            nodeName = attachRet[1];
                        if (!attachProperties[nodeName]) {
                            attachProperties[nodeName] = {};
                        }
                        mug.p.attachmentProperty[nodeName].calculate = el.attr('calculate');
                        return;
                    }
                }
            }
            this.__callOld();
        }
    });
});
