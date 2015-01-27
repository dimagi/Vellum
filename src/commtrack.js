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
) {
    var setvalueData = {
            Balance: [
                {
                    attr: "entryId",
                    path: "entry/@id"
                }, {
                    attr: "entityId",
                    path: "@entity-id"
                }, {
                    attr: "date",
                    path: "@date"
                }
            ],
            Transfer: [
                {
                    attr: "entryId",
                    path: "entry/@id"
                }, {
                    attr: "src",
                    path: "@src"
                }, {
                    attr: "dest",
                    path: "@dest"
                }, {
                    attr: "date",
                    path: "@date"
                }
            ],
        },
        sectionData = {
            Balance: [
                {
                    slug: "main",
                    displayName: "Basic",
                    properties: [
                        "entityId",
                        "sectionId",
                        "entryId",
                        "quantity"
                    ],
                }
            ],
            Transfer: [
                {
                    slug: "main",
                    displayName: "Basic",
                    properties: [
                        "src",
                        "dest",
                        "sectionId",
                        "entryId",
                        "quantity"
                    ],
                }
            ]
        },
        baseTransactionOptions = {
            isDataOnly: true,
            supportsDataNodeRole: true,
            parseDataNode: function (mug, $node) {
                mug.p.sectionId = mug.p.rawDataAttributes["section-id"];
                delete mug.p.rawDataAttributes["section-id"];
                return $([]);
            },
            dataChildFilter: function (children, mug) {
                return [new Tree.Node(children, {
                    getNodeID: function () { return "entry"; },
                    p: {rawDataAttributes: null},
                    options: {
                        getExtraDataAttributes: function (mug) {
                            return {id: "", quantity: ""};
                        }
                    }
                })];
            },
            getBindList: function (mug) {
                return [{
                    nodeset: mug.absolutePath + "/entry/@quantity",
                    calculate: mug.p.quantity
                }];
            }
        },
        balanceMugOptions = {
            typeName: 'Balance',
            getExtraDataAttributes: function (mug) {
                // HACK must happen before <setvalue> and "other" <instance> elements are written
                prepareForWrite(mug);
                var attrs = mug.p.rawDataAttributes || {};
                return {
                    xmlns: "http://commcarehq.org/ledger/v1",
                    "entity-id": attrs.src || "",
                    "section-id": mug.p.sectionId,
                    date: attrs.date || "",
                    "vellum:role": "Balance"
                };
            },
            init: function (mug, form) {
                mug.p.entityId = {value: ""};
                mug.p.sectionId = "";
                mug.p.entryId = {value: ""};
                mug.p.quantity = "";
                mug.p.date = {value: "today()"};
            },
            spec: {
                xmlnsAttr: { presence: "optional" },
                entityId: {
                    lstring: 'Case',
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: setValueWidget,
                    xpathType: "generic"
                },
                sectionId: {
                    lstring: 'Balance ID',
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: widgets.text
                },
                entryId: {
                    lstring: 'Product',
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: setValueWidget,
                    xpathType: "generic"
                },
                quantity: {
                    lstring: 'Quantity',
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: "generic"
                },
                date: {
                    lstring: 'Date',
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: setValueWidget,
                    xpathType: "generic"
                },
                requiredAttr: { presence: "notallowed" },
                constraintAttr: { presence : "notallowed" },
                calculateAttr: { visibility: "notallowed" }
            }
        },
        transferMugOptions = {
            typeName: 'Transfer',
            getExtraDataAttributes: function (mug) {
                // HACK must happen before <setvalue> and "other" <instance> elements are written
                prepareForWrite(mug);
                var attrs = mug.p.rawDataAttributes || {};
                return {
                    xmlns: "http://commcarehq.org/ledger/v1",
                    src: attrs.src || "",
                    dest: attrs.dest || "",
                    date: attrs.date || "",
                    "section-id": mug.p.sectionId,
                    "vellum:role": "Transfer"
                };
            },
            init: function (mug, form) {
                mug.p.src = {value: ""};
                mug.p.dest = {value: ""};
                mug.p.sectionId = "";
                mug.p.entryId = {value: ""};
                mug.p.quantity = "";
                mug.p.date = {value: "today()"};
            },
            spec: {
                xmlnsAttr: { presence: "optional" },
                src: {
                    lstring: 'Source Case',
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: setValueWidget,
                    xpathType: "generic"
                },
                dest: {
                    lstring: 'Destination Case',
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: setValueWidget,
                    xpathType: "generic"
                },
                sectionId: {
                    lstring: 'Balance ID',
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: widgets.text
                },
                entryId: {
                    lstring: 'Product',
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: setValueWidget,
                    xpathType: "generic"
                },
                quantity: {
                    lstring: 'Quantity',
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: "generic"
                },
                date: {
                    lstring: 'Date',
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: setValueWidget,
                    xpathType: "generic"
                },
                requiredAttr: { presence: "notallowed" },
                constraintAttr: { presence : "notallowed" },
                calculateAttr: { visibility: "notallowed" }
            }
        };

    $.vellum.plugin("commtrack", {}, {
        getAdvancedQuestions: function () {
            return this.__callOld().concat(["Balance", "Transfer"]);
        },
        getMugTypes: function () {
            var types = this.__callOld();
            types.normal.Balance = util.extend(
                mugs.defaultOptions, baseTransactionOptions, balanceMugOptions);
            types.normal.Transfer = util.extend(
                mugs.defaultOptions, baseTransactionOptions, transferMugOptions);
            return types;
        },
        parseBindElement: function (form, el, path) {
            var mug = form.getMugByPath(path);
            if (!mug) {
                var basePath = path.replace(/\/entry\/@quantity$/, "");
                if (path !== basePath) {
                    mug = form.getMugByPath(basePath);
                    if (isTransaction(mug)) {
                        mug.p.quantity = el.attr("calculate");
                        return;
                    }
                }
            }
            this.__callOld();
        },
        handleMugParseFinish: function (mug) {
            this.__callOld();
            if (!isTransaction(mug)) {
                return;
            }
            var path = mug.absolutePath;
            mug.p.setvalues = {};
            var values = _.object(_.map(mug.form.getSetValues(), function (value) {
                    return [value.ref, value];
                }));
            _.each(setvalueData[mug.__className], function (data) {
                mug.p[data.attr] = values[path + "/" + data.path] || {
                    value: ""
                };
            });
        },
        getSections: function (mug) {
            if (sectionData.hasOwnProperty(mug.__className)) {
                return _.map(sectionData[mug.__className], function (section) {
                    return _.clone(section);
                });
            }
            return this.__callOld();
        }
    });

    function isTransaction(mug) {
        return mug && (mug.__className === "Balance" || mug.__className === "Transfer");
    }

    function isInRepeat(mug) {
        if (mug.__className === "Repeat") { // HACK hard-coded class name
            return true;
        }
        return mug.parentMug && isInRepeat(mug.parentMug);
    }

    function prepareForWrite(mug) {
        var path = mug.absolutePath,
            event = isInRepeat(mug) ? "jr-insert" : "xforms-ready";

        // update <setvalue> refs
        _.each(setvalueData[mug.__className], function (data) {
            var value = mug.p[data.attr];
            if (!value.ref) {
                mug.p[data.attr] = mug.form.addSetValue(
                    event,
                    path + "/" + data.path,
                    value.value
                );
            } else {
                value.ref = path + "/" + data.path;
                value.event = event;
            }
        });
    }

    function setValueWidget(mug, options) {
        var widget = widgets.xPath(mug, options),
            _getValue = widget.getValue,
            _setValue = widget.setValue,
            _value = null;

        widget.setValue = function (value) {
            _value = value;
            _setValue(value.value);
        };

        widget.getValue = function () {
            var val = _value || {};
            val.value = _getValue();
            return val;
        };

        return widget;
    }
});
