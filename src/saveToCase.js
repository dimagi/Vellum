import $ from "jquery";
import _ from "underscore";
import mugs from "vellum/mugs";
import Tree from "vellum/tree";
import util from "vellum/util";
import atwho from "vellum/atwho";
import widgets from "vellum/widgets";
import widget_update_case from "vellum/templates/widget_update_case.html";
import widget_index_case from "vellum/templates/widget_index_case.html";
import widget_save_to_case from "vellum/templates/widget_save_to_case.html";
import "vellum/core";


function validateXPath(mug, value) {
    if (value) {
        try {
            mug.form.xpath.parse(value);
        } catch (err) {
            return gettext("Invalid XPath expression.");
        }
    }
    return 'pass';
}

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

function usesCases(mug) {
    return createsCase(mug) || closesCase(mug) || updatesCase(mug) ||
        indexesCase(mug);
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
    };

var CASE_TYPE_REGEX = /^[\w-]+$/;

function caseTypeDropdownWidget(mug, opts) {
    var existingCaseTypes = opts.vellum.data.saveToCase?.existingCaseTypes || [];
    // Keep parsed Case Type values visible in the dropdown even when they are
    // not present in configured case type options.
    if (mug.p.case_type && !_.contains(existingCaseTypes, mug.p.case_type)) {
        existingCaseTypes.push(mug.p.case_type);
    }
    opts.defaultOptions = existingCaseTypes.map(function (ct) {
        return { text: ct, value: ct };
    });
    opts.noCustom = true;
    var widget = widgets.dropdown(mug, opts);

    var super_updateValue = widget.updateValue;
    widget.updateValue = function () {
        var val = widget.getValue();
        if (val && /\s/.test(val)) {
            widget.setValue(val.replace(/\s/g, '_'));
        }
        super_updateValue();
        mug.validate('caseTypeXPath');
    };

    function initSelect2() {
        var value = widget.input.val();
        // When Create is turned off, remove custom case types that
        // aren't in the data dictionary — they were only valid for creation.
        if (!createsCase(mug) && value && !_.contains(existingCaseTypes, value)) {
            widget.input.find('option[value="' + value + '"]').remove();
            widget.input.val('');
            value = '';
            mug.p.case_type = '';
        }
        if (widget.input.data('select2')) {
            widget.input.select2('destroy');
        }
        widget.input.select2({
            tags: createsCase(mug),
            allowClear: true,
            placeholder: createsCase(mug) ? gettext('Select a case type or create a new one') : gettext('Select a case type'),
            createTag: function (params) {
                var term = params.term.replace(/\s/g, '_');
                return { id: term, text: term };
            },
        });
        widget.input.val(value).trigger('change.select2');
    }

    widget.postRender = function () {
        initSelect2();
        var $dropdownRow = widget.input.closest('.widget'),
            $toggleLink = addModeToggle($dropdownRow, gettext('Select case type with XPath'), function () {
                switchToXpathMode(mug, widget, $dropdownRow);
            });
        if (!createsCase(mug)) {
            $toggleLink.hide();
        }
        if (mug.p.caseTypeXPath && !mug.p.case_type) {
            $dropdownRow.hide();
        }
        mug.on('property-changed', function (e) {
            if (e.property === 'useCreate') {
                initSelect2();
                $toggleLink.toggle(createsCase(mug));
                if (!createsCase(mug) && mug.p.caseTypeXPath) {
                    switchToDropdownMode(mug, null, $dropdownRow.next('.widget'));
                }
            }
        }, null, 'teardown-mug-properties');
        widget.input.on('remove', function () {
            if (widget.input.data('select2')) {
                widget.input.select2('destroy');
            }
        });
    };
    return widget;
}

function caseTypeXpathWidget(mug, opts) {
    opts.widget = widgets.xPath;
    var widget = widgets.xPath(mug, opts);

    var super_updateValue = widget.updateValue;
    widget.updateValue = function () {
        var val = $.trim(widget.getValue());
        mug.p.caseTypeXPath = val || null;
        super_updateValue();
        // Re-validate the dropdown since its validation depends on caseTypeXPath
        mug.validate('case_type');
    };

    widget.postRender = function () {
        var $xpathRow = widget.input.closest('.widget');
        addModeToggle($xpathRow, gettext('Select case type from a list'), function () {
            switchToDropdownMode(mug, widget, $xpathRow);
        });
        if (!createsCase(mug) || !mug.p.caseTypeXPath || mug.p.case_type) {
            $xpathRow.hide();
        }
    };
    return widget;
}

function addModeToggle($row, text, onClick) {
    var $link = $('<a href="#" class="fd-mode-toggle-link" />')
        .text(text)
        .on('click', function (e) {
            e.preventDefault();
            onClick();
        });
    $row.find('.controls .messages').before($link);
    return $link;
}

function switchToXpathMode(mug, dropdownWidget, $dropdownRow) {
    // Save current dropdown value for later restoration
    mug.p._savedCaseType = mug.p.case_type;
    mug.p.case_type = '';
    dropdownWidget.setValue('');

    // Restore previously saved xpath value if any
    var $xpathRow = $dropdownRow.next('.widget'),
        xpathWidget = $xpathRow.data('vellum_widget');
    if (mug.p._savedCaseTypeXPath && xpathWidget) {
        mug.p.caseTypeXPath = mug.p._savedCaseTypeXPath;
        xpathWidget.setValue(mug.p._savedCaseTypeXPath);
        mug.p._savedCaseTypeXPath = null;
    }

    $dropdownRow.hide();
    $xpathRow.show();
    mug.validate('case_type');
    mug.validate('caseTypeXPath');
}

function switchToDropdownMode(mug, xpathWidget, $xpathRow) {
    // Save current xpath value for later restoration
    mug.p._savedCaseTypeXPath = mug.p.caseTypeXPath;
    mug.p.caseTypeXPath = null;
    if (xpathWidget) {
        xpathWidget.setValue('');
    }

    // Restore previously saved dropdown value if any
    if (mug.p._savedCaseType) {
        mug.p.case_type = mug.p._savedCaseType;
        mug.p._savedCaseType = null;
    }

    var $dropdownRow = $xpathRow.prev('.widget'),
        dropdownWidget = $dropdownRow.data('vellum_widget');
    if (dropdownWidget) {
        dropdownWidget.setValue(mug.p.case_type);
        dropdownWidget.handleChange();
    }

    $xpathRow.hide();
    $dropdownRow.show();
    mug.validate('case_type');
    mug.validate('caseTypeXPath');
}

var slugToProp = {
        create: "useCreate",
        update: "useUpdate",
        close: "useClose",
        index: "useIndex",
    },
    CASE_XMLNS = "http://commcarehq.org/case/transaction/v2",
    VALID_PROP_REGEX = /^[a-z0-9_-]+$/i,
    saveToCaseMugOptions = {
        typeName: 'Advanced Case Actions',
        isTypeChangeable: false,
        isDataOnly: true,
        supportsDataNodeRole: true,
        icon: 'fa-solid fa-diagram-project',
        init: function (mug, form) {
            mug.p.date_modified = mug.p.date_modified || '/data/meta/timeEnd';
            mug.p.user_id = mug.p.user_id || "instance('commcaresession')/session/context/userid";
        },
        spec: {
            xmlnsAttr: { presence: "optional" },
            "date_modified": {
                lstring: gettext("Date Modified"),
                visibility: 'visible',
                presence: 'required',
                widget: widgets.xPath,
                serialize: mugs.serializeXPath,
                deserialize: mugs.deserializeXPath,
            },
            "user_id": {
                lstring: gettext("User ID"),
                visibility: 'visible',
                presence: 'optional',
                widget: widgets.xPath,
                serialize: mugs.serializeXPath,
                deserialize: mugs.deserializeXPath,
            },
            "case_type": {
                lstring: gettext("Case Type"),
                visibility: 'visible',
                presence: 'optional',
                widget: caseTypeDropdownWidget,
                validationFunc: function (mug) {
                    if (mug.p.caseTypeXPath) {
                        return 'pass';
                    }
                    var val = mug.p.case_type;
                    if (!val && createsCase(mug)) {
                        return gettext("Case Type is required");
                    }
                    if (val && !CASE_TYPE_REGEX.test(val)) {
                        return gettext("Case types can only include the characters a-z, 0-9, '-' and '_'");
                    }
                    if (val === 'commcare-user') {
                        if (createsCase(mug) || closesCase(mug) || indexesCase(mug)) {
                            return gettext("'commcare-user' cases can only be updated, not created, closed, or linked");
                        }
                    }
                    if (val === 'user-owner-mapping-case') {
                        return gettext("This is a reserved case type. Please choose another name.");
                    }
                    return 'pass';
                },
            },
            "caseTypeXPath": {
                lstring: gettext("Case Type"),
                visibility: 'visible',
                presence: 'optional',
                widget: caseTypeXpathWidget,
                serialize: mugs.serializeXPath,
                deserialize: mugs.deserializeXPath,
                validationFunc: function (mug) {
                    if (mug.p.case_type || !createsCase(mug)) {
                        return 'pass';
                    }
                    var val = mug.p.caseTypeXPath;
                    if (!val) {
                        return gettext("Case Type is required");
                    }
                    if (CASE_TYPE_REGEX.test(val)) {
                        return gettext("This looks like a literal value. Use the dropdown instead, or wrap it in quotes like '" + val + "'.");
                    }
                    return 'pass';
                },
            },
            "openCaseCondition": {
                lstring: gettext("Open Case Condition"),
                visibility: 'visible',
                presence: 'optional',
                widget: widgets.xPath,
                serialize: mugs.serializeXPath,
                deserialize: mugs.deserializeXPath,
                validationFunc: function (mug) {
                    return validateXPath(mug, mug.p.openCaseCondition);
                },
            },
            "caseName": {
                lstring: gettext("Case Name"),
                visibility: 'visible',
                presence: 'optional',
                widget: widgets.xPath,
                serialize: mugs.serializeXPath,
                deserialize: mugs.deserializeXPath,
                validationFunc: function (mug) {
                    if (mug.p.useCreate && !mug.p.caseName) {
                        return gettext("Case Name is required");
                    }
                    return 'pass';
                },
            },
            "ownerId": {
                lstring: gettext("Owner ID"),
                visibility: 'visible',
                presence: 'optional',
                widget: widgets.xPath,
                serialize: mugs.serializeXPath,
                deserialize: mugs.deserializeXPath,
            },
            "ownerIdCondition": {
                lstring: gettext("Owner ID Condition"),
                visibility: 'visible',
                presence: 'optional',
                widget: widgets.xPath,
                serialize: mugs.serializeXPath,
                deserialize: mugs.deserializeXPath,
                validationFunc: function (mug) {
                    return validateXPath(mug, mug.p.ownerIdCondition);
                },
            },
            "case_id": {
                lstring: gettext("Case ID"),
                visibility: 'visible',
                presence: 'required',
                widget: widgets.xPath,
                serialize: mugs.serializeXPath,
                deserialize: mugs.deserializeXPath,
                validationFunc: function (mug) {
                    var value = mug.p.case_id;
                    if (!value) {
                        return gettext("Case ID is required");
                    }
                    var hasPathOrFunctionCall = /\/|[a-z]+\(.+\)/.test(value);
                    var isUuid = value === 'uuid()';
                    if (/uuid\([^)]+\)/.test(value)) {
                        return gettext("uuid() should not have arguments");
                    }
                    if (!hasPathOrFunctionCall && !isUuid) {
                        return gettext("Case ID must be an XPath expression");
                    }
                    if (!createsCase(mug) && isUuid) {
                        return gettext("Case ID cannot be uuid() without a Create action. It must reference an existing case.");
                    }
                    return 'pass';
                },
            },
            caseActions: {
                lstring: gettext("Case Actions"),
                visibility: 'visible',
                presence: 'optional',
                validationFunc: function (mug) {
                    if (!usesCases(mug)) {
                        return gettext("You must select at least one case action");
                    }
                    return 'pass';
                },
                widget: widgets.chips,
                chips: [
                    { slug: "create", label: gettext("Create") },
                    { slug: "update", label: gettext("Update") },
                    { slug: "close",  label: gettext("Close") },
                    { slug: "index",  label: gettext("Index") },
                ],
                exclusive: ["create", "update"],
                getState: function (slug, mug) {
                    return mug.p[slugToProp[slug]];
                },
                onSelect: function (slug, mug) {
                    mug.p[slugToProp[slug]] = true;
                    mug.form.vellum.collapseSection(slug, false);
                },
                onDeselect: function (slug, mug) {
                    mug.p[slugToProp[slug]] = false;
                    mug.form.vellum.collapseSection(slug, true);
                },
            },
            useCreate: {
                visibility: 'hidden',
                presence: 'optional',
                validationFunc: function (mug) {
                    // case_id validation depends on useCreate
                    mug.validate('case_id');
                    return 'pass';
                },
            },
            createProperty: {
                lstring: gettext("Case Properties To Create"),
                visibility: 'visible',
                presence: 'optional',
                widget: saveCasePropWidget,
                validationFunc: function (mug) {
                    if (mug.p.useCreate) {
                        var props = _.without(_.keys(mug.p.createProperty), ""),
                            reserved = ["case_type", "case_name", "owner_id"],
                            reservedUsed = _.intersection(props, reserved),
                            invalidProps = _.filter(props, function(p) {
                                return !VALID_PROP_REGEX.test(p);
                            });

                        if (reservedUsed.length > 0) {
                            return util.format(
                                gettext("{props} cannot be added here. Use the dedicated fields above."),
                                {props: reservedUsed.join(", ")}
                            );
                        } else if (invalidProps.length > 0) {
                            return util.format(
                                gettext("{props} are invalid properties"),
                                {props: invalidProps.join(", ")}
                            );
                        }

                    }
                    return 'pass';
                }
            },
            useClose: {
                visibility: 'hidden',
                presence: 'optional',
            },
            closeCondition: {
                lstring: gettext("Close Condition"),
                visibility: 'visible',
                presence: 'optional',
                widget: widgets.xPath,
                serialize: mugs.serializeXPath,
                deserialize: mugs.deserializeXPath,
            },
            useUpdate: {
                visibility: 'hidden',
                presence: 'optional',
            },
            updateProperty: {
                lstring: gettext("Case Properties To Update"),
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
                            return util.format(
                                gettext("{props} are invalid properties"),
                                {props: invalidProps.join(", ")}
                            );
                        }
                    }
                    return 'pass';
                }
            },
            useIndex: {
                visibility: 'hidden',
                presence: 'optional',
            },
            indexProperty: {
                lstring: gettext("Index Properties"),
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
                            return util.format(
                                gettext("{props} are invalid properties"),
                                {props: invalidProps.join(", ")}
                            );
                        } else if (invalidRelationships.length > 0) {
                            return gettext("Relationship must be child or extension");
                        }
                    }
                    return 'pass';
                }
            },
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
                var createProps = {};
                var addCreateProp = function (key, value) {
                    if (value) {
                        createProps[key] = {};
                    }
                };
                addCreateProp('case_type', mug.p.case_type || mug.p.caseTypeXPath);
                addCreateProp('case_name', mug.p.caseName);
                addCreateProp('owner_id', mug.p.ownerId);
                actions.push(simpleNode('create', makeColumns(createProps)));
            }

            // <update> from extra create properties or standalone update action
            var updateProps = {};
            if (createsCase(mug) && mug.p.createProperty) {
                _.extend(updateProps, _.omit(mug.p.createProperty, ""));
            }
            if (updatesCase(mug) && mug.p.updateProperty) {
                _.extend(updateProps, _.omit(mug.p.updateProperty, ""));
            }
            if (!_.isEmpty(updateProps)) {
                actions.push(simpleNode('update', makeColumns(updateProps)));
            }

            if (closesCase(mug)) {
                actions.push(simpleNode('close'));
            }

            if (indexesCase(mug)) {
                actions.push(simpleNode('index', 
                                        makeColumns(mug.p.indexProperty, 
                                                    ['case_type', 'relationship'])));
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
                if (mug.p.openCaseCondition) {
                    ret.push({
                        nodeset: mug.absolutePath + "/case",
                        relevant: mug.p.openCaseCondition
                    });
                }
                // Emit /case/create/case_type bind.
                // Use the original xpath reference if available,
                // otherwise wrap the literal in single quotes.
                if (mug.p.case_type || mug.p.caseTypeXPath) {
                    ret.push({
                        nodeset: mug.absolutePath + "/case/create/case_type",
                        calculate: mug.p.caseTypeXPath || "'" + mug.p.case_type + "'"
                    });
                }
                if (mug.p.caseName) {
                    ret.push({
                        nodeset: mug.absolutePath + "/case/create/case_name",
                        calculate: mug.p.caseName
                    });
                }
                if (mug.p.ownerId) {
                    var ownerBind = {
                        nodeset: mug.absolutePath + "/case/create/owner_id",
                        calculate: mug.p.ownerId
                    };
                    if (mug.p.ownerIdCondition) {
                        ownerBind.relevant = mug.p.ownerIdCondition;
                    }
                    ret.push(ownerBind);
                }
                ret = ret.concat(generateBinds('update', mug.p.createProperty));
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
            var case_type = $node.xmlAttr('vellum:case_type'),
                case_ = $node.children(),
                create = case_.find('create'),
                close = case_.find('close'),
                update = case_.find('update'),
                index = case_.find('index');
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
                        case_type: prop.xmlAttr('case_type'),
                        relationship: prop.xmlAttr('relationship')
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
            // case_type, case_name and owner_id are now a dedicated field rather than a createProperty entry,
            // but we still include it in the properties list to keep the data
            // structure sent to HQ consistent with what it was before.
            if (mug.p.useCreate && (mug.p.case_type || mug.p.caseTypeXPath)) {
                propertyNames.push("case_type");
            }
            if (mug.p.useCreate && mug.p.caseName) {
                propertyNames.push("case_name");
            }
            if (mug.p.useCreate && mug.p.ownerId) {
                propertyNames.push("owner_id");
            }
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
                displayName: gettext("Basic"),
                properties: [
                    "nodeID",
                    "case_type",
                    "caseTypeXPath",
                    "case_id",
                    "caseActions",
                ],
            },
            {
                slug: "advanced",
                displayName: gettext("Advanced"),
                properties: [
                    "date_modified",
                    "user_id",
                ],
                isCollapsed: true,
            },
            {
                slug: "create",
                displayName: gettext("Create"),
                properties: [
                    "openCaseCondition",
                    "caseName",
                    "ownerId",
                    "ownerIdCondition",
                    "createProperty",
                ],
                isCollapsed: function (mug) {
                    return !createsCase(mug);
                },
            },
            {
                slug: "update",
                displayName: gettext("Update"),
                properties: [
                    "updateProperty",
                ],
                isCollapsed: function (mug) {
                    return !updatesCase(mug);
                },
            },
            {
                slug: "close",
                displayName: gettext("Close"),
                properties: [
                    "closeCondition",
                ],
                isCollapsed: function (mug) {
                    return !closesCase(mug);
                },
            },
            {
                slug: "index",
                displayName: gettext("Index"),
                properties: [
                    "indexProperty",
                ],
                isCollapsed: function (mug) {
                    return !indexesCase(mug);
                },
            },
        ]
    };

function promoteStashedCreateBindRelevants(mug) {
    var caseTypeRelevant = mug.p._caseTypeRelevant,
        caseNameRelevant = mug.p._caseNameRelevant,
        ownerIdRelevant = mug.p._ownerIdRelevant;
    delete mug.p._caseTypeRelevant;
    delete mug.p._caseNameRelevant;
    delete mug.p._ownerIdRelevant;

    var caseTypeAndNameRelevants = _.compact(
        _.uniq([caseTypeRelevant, caseNameRelevant])
    );
    if (caseTypeAndNameRelevants.length && !mug.p.openCaseCondition) {
        mug.p.openCaseCondition = caseTypeAndNameRelevants.join(" and ");
    }

    if (ownerIdRelevant) {
        var redundantWithCaseTypeOrName = _.contains(
            caseTypeAndNameRelevants,
            ownerIdRelevant
        );
        var redundantWithOpenCase = ownerIdRelevant === mug.p.openCaseCondition;
        if (!redundantWithCaseTypeOrName && !redundantWithOpenCase) {
            mug.p.ownerIdCondition = ownerIdRelevant;
        }
    }
}

function mergeUpdatePropertiesIntoCreateAfterParse(mug) {
    if (!updatesCase(mug)) {
        return;
    }
    if (!mug.p.createProperty) {
        mug.p.createProperty = {};
    }
    _.extend(mug.p.createProperty, mug.p.updateProperty);
    mug.p.updateProperty = {};
    mug.p.useUpdate = false;
}

$.vellum.plugin("saveToCase", {}, {
    init: function () {
        var opts = this.opts().saveToCase || {};
        this.data.saveToCase = {
            existingCaseTypes: opts.existingCaseTypes || [],
        };
    },
    getAdvancedQuestions: function () {
        return this.__callOld().concat(["SaveToCase"]);
    },
    handleMugParseFinish: function (mug) {
        this.__callOld();
        // cases that are created use a setvalue for case_id
        if (!createsCase(mug)) {
            return;
        }
        var ref = mug.absolutePath + "/case/@case_id",
            value = _.find(mug.form.getSetValues(), function (value) {
                return value.ref === ref;
            });
        if (value) {
            mug.p.case_id = value.value;
            mug.form.dropSetValues(function(inner) {
                return value === inner;
            });
        }
        promoteStashedCreateBindRelevants(mug);
        mergeUpdatePropertiesIntoCreateAfterParse(mug);
    },
    getMugToolbar: function (mug, multiselect) {
        var $toolbar = this.__callOld();
        if (!multiselect && mug.__className === "SaveToCase") {
            $toolbar.find('.fd-section-changer').remove();
        }
        return $toolbar;
    },
    getMugTypes: function () {
        var types = this.__callOld();
        types.normal.SaveToCase = util.extend(
            mugs.defaultOptions, saveToCaseMugOptions);
        return types;
    },
    displayMugProperties: function (mug) {
        this.__callOld();
        if (mug.__className !== "SaveToCase") {
            return;
        }
        widgets.util.addCollapseToggle('advanced', {
            showText: gettext("View Advanced"),
            hideText: gettext("Hide Advanced"),
            mug: mug,
        });
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
            var CASE_NODE_BIND_PATTERN = /\/case$/;
            if (CASE_NODE_BIND_PATTERN.test(path)) {
                var caseBasePath = path.replace(CASE_NODE_BIND_PATTERN, "");
                mug = form.getMugByPath(caseBasePath);
                if (mug && mug.__className === "SaveToCase") {
                    if (el.xmlAttr('relevant')) {
                        mug.p.openCaseCondition = el.xmlAttr("relevant");
                    }
                    return;
                }
                mug = null;
            }
            var casePathRegex = /\/case\/(?:(create|update|index)\/([\w-]+)|(close|@date_modified|@user_id|@case_id))$/,
                matchRet = path.match(casePathRegex),
                basePath;
            if (matchRet && matchRet.length > 0) {
                basePath = path.replace(casePathRegex, "");
                mug = form.getMugByPath(basePath);
                if (mug && mug.__className === "SaveToCase") {
                    if (matchRet[2]) {
                        var prop = matchRet[2],
                            action = matchRet[1];

                        if (action === "create" && prop === "case_type") {
                            var caseTypeBindValue = el.xmlAttr("calculate") || '',
                                stripped = caseTypeBindValue.replace(/^(['"])(.*)\1$/, '$2');
                            if (stripped && stripped === caseTypeBindValue) {
                                // No quotes stripped — xpath expression;
                                // show in xpath field, override vellum:case_type
                                mug.p.caseTypeXPath = caseTypeBindValue;
                                mug.p.case_type = '';
                            } else if (stripped) {
                                // Route create/case_type to the Case Type dropdown.
                                mug.p.case_type = stripped;
                            }
                            mug.p._caseTypeRelevant = el.xmlAttr('relevant');
                            return;
                        }

                        if (action === "create" && prop === "case_name") {
                            mug.p.caseName = el.xmlAttr("calculate");
                            mug.p._caseNameRelevant = el.xmlAttr('relevant');
                            return;
                        }

                        if (action === "create" && prop === "owner_id") {
                            mug.p.ownerId = el.xmlAttr("calculate");
                            mug.p._ownerIdRelevant = el.xmlAttr('relevant');
                            return;
                        }

                        var pKey = {
                                create: "createProperty",
                                update: "updateProperty",
                                index: "indexProperty",
                            }[action];

                        if (!mug.p[pKey]) {
                            mug.p[pKey] = {};
                        }
                        if (!mug.p[pKey][prop]) {
                            mug.p[pKey][prop] = {};
                        }
                        mug.p[pKey][prop].calculate =  el.xmlAttr("calculate");
                        if (el.xmlAttr('relevant')) {
                            mug.p[pKey][prop].relevant =  el.xmlAttr("relevant");
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

                        mug.p[attr.mugProp] = el.xmlAttr(attr.elAttr);
                        return;
                    }
                    form.parseWarnings.push(util.format(
                        gettext("An error occurred when parsing bind " + 
                                "node [{path}]. Please fix this."),
                        {path: path}
                    ));
                    return;
                }
            }
            
        }
        this.__callOld();
    }
});
