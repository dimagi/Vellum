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
    widget_update_case
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

    function addSetValue(mug) {
        var path = mug.absolutePath;

        if (createsCase(mug)) {
            mug.form.addSetValue('xforms-ready', path + "/case/@case_id", mug.p.case_id);
        }
    }

    var saveCasePropWidget = function (mug, options) {
        var widget = widgets.normal(mug, options),
            id = options.id;
        widget.definition = {};

        // todo make a style for this when vellum gets a facelift
        widget.kvInput = $('<div class="control-row" />').attr('name', id);

        widget.getControl = function () {
            if (widget.isDisabled()) {
                // todo
            }
            return widget.kvInput;
        };

        widget.setValue = function (value) {
            value = _.isUndefined(value) ? {} : value;
            widget.kvInput.html(widget_update_case({
                props: value
            }));
            widget.kvInput.find('input').bind('change keyup', function () {
                widget.handleChange();
            });
            widget.kvInput.find('.fd-add-update-property').click(function (e) {
                widget.refreshControl();
                e.preventDefault();
            });
            widget.kvInput.find('.fd-remove-update-property').click(function (e) {
                $(this).parent().parent().parent().remove();
                widget.refreshControl();
                widget.save();
                e.preventDefault();
            });
        };

        widget.getValue = function () {
            var currentValues = {};
            _.each(widget.kvInput.find('.fd-update-property'), function (kvPair) {
                var $pair = $(kvPair);
                currentValues[$pair.find('.fd-update-property-name').val()] = {
                    calculate: $pair.find('.fd-update-property-source').val(),
                    relevant: $pair.find('.fd-update-property-relevant').val(),
                };
            });
            return currentValues;
        };

        widget.save = function () {
            this.mug.p[this.path] = this.getValue();
        };

        widget.getValidValues = function () {
            var values = _.clone(widget.getValue());
            if (values[""]) {
                delete values[""];
            }
            return values;
        };

        widget.updateValue = function () {
            var currentValues = widget.getValue();
            if (!("" in currentValues)) {
                widget.kvInput.find('.btn').removeClass('hide');
                widget.kvInput.find('.fd-remove-update-property').removeClass('hide');
            }
            widget.save();
        };

        widget.refreshControl = function () {
            widget.setValue(widget.getValue());
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
                "date_modified": {
                    lstring: "Date modified",
                    visibility: 'visible',
                    presence: 'required',
                    widget: widgets.xPath,
                    validationFunc: function (mug) {
                        if (mug.p.date_modified === "") {
                            return "Date Modified is required";
                        }
                        return 'pass';
                    }
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
                    presence: 'optional',
                    widget: widgets.xPath,
                    validationFunc: function (mug) {
                        if (mug.p.case_id === "") {
                            return "Case ID is required";
                        }
                        return 'pass';
                    }
                },
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
                    widget: saveCasePropWidget,
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
                addSetValue(mug);
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

                if (createsCase(mug) || updatesCase(mug) || closesCase(mug)) {
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
                }
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
                }));

            _.each(values, function(value) {
                if (/case\/@case_id$/.test(value.ref)) {
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

                var datePath = path.replace(/\/case\/@date_modified$/, "");
                if (path !== datePath) {
                    mug = form.getMugByPath(datePath);
                    if (mug.__className === "SaveToCase") {
                        mug.p.date_modified = el.attr('calculate');
                        return;
                    }
                }
                var userPath = path.replace(/\/case\/@user_id/, "");
                if (path !== userPath) {
                    mug = form.getMugByPath(userPath);
                    if (mug.__className === "SaveToCase") {
                        mug.p.user_id = el.attr('calculate');
                        return;
                    }
                }
                var caseIdPath = path.replace(/\/case\/@case_id/, "");
                if (path !== caseIdPath) {
                    mug = form.getMugByPath(caseIdPath);
                    if (mug.__className === "SaveToCase") {
                        mug.p.case_id = el.attr('calculate');
                        return;
                    }
                }
            }
            this.__callOld();
        }
    });
});
