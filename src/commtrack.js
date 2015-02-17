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
    var nextId = 0,
        setvalueData = {
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
                    help: {
                        title: "Basic",
                        text: "<p>The <strong>Question ID</strong> is an internal identifier for a question. " +
                            "It does not appear on the phone. It is the name of the question in data exports.</p>" +
                            "<p>Click through for more info.</p>",
                        link: "https://help.commcarehq.org/display/commcarepublic/Transactions",
                    },
                    properties: [
                        "nodeID",
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
                    help: {
                        title: "Basic",
                        text: "<p>The <strong>Question ID</strong> is an internal identifier for a question. " +
                            "It does not appear on the phone. It is the name of the question in data exports.</p>" +
                            "<p>Click through for more info.</p>",
                        link: "https://help.commcarehq.org/display/commcarepublic/Transactions",
                    },
                    properties: [
                        "nodeID",
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
            isTypeChangeable: false,
            supportsDataNodeRole: true,
            parseDataNode: function (mug, $node) {
                mug.p.nodeID = mug.p.rawDataAttributes.type || "tx-" + nextId++;
                delete mug.p.rawDataAttributes.type;
                mug.p.sectionId = mug.p.rawDataAttributes["section-id"];
                delete mug.p.rawDataAttributes["section-id"];
                return $([]);
            },
            getPathName: function (mug, name) {
                return mug.options.getTagName() + "[@type='" + name + "']";
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
            getTagName: function () { return "balance"; },
            getExtraDataAttributes: function (mug) {
                // HACK must happen before <setvalue> and "other" <instance> elements are written
                prepareForWrite(mug);
                var attrs = mug.p.rawDataAttributes || {};
                return {
                    xmlns: "http://commcarehq.org/ledger/v1",
                    type: mug.p.nodeID,
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
                    visibility: 'visible',
                    presence: 'optional',
                    widget: setValueWidget,
                    xpathType: "generic",
                    help: 'XPath expression for the case ID associated with this balance.',
                },
                sectionId: {
                    lstring: 'Balance ID',
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.text,
                    help: 'The name of the balance you are tracking. ' + 
                         'This is an internal identifier which does not appear on the phone.',
                },
                entryId: {
                    lstring: 'Product',
                    visibility: 'visible',
                    presence: 'optional',
                    widget: setValueWidget,
                    xpathType: "generic",
                    help: 'A reference to a product ID, e.g., "/data/products/current_product"',
                },
                quantity: {
                    lstring: 'Quantity',
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: "generic",
                    help: 'A reference to an integer question in this form.',
                },
                requiredAttr: { presence: "notallowed" },
                constraintAttr: { presence : "notallowed" },
                calculateAttr: { presence: "notallowed" }
            }
        },
        transferMugValidation = function (mug) {
            if (mug.p.dest.value || mug.p.src.value) {
                return 'pass';
            }
            return 'Transfer must have at least one of source case and destination case.';
        },
        transferMugOptions = {
            typeName: 'Transfer',
            getTagName: function () { return "transfer"; },
            getExtraDataAttributes: function (mug) {
                // HACK must happen before <setvalue> and "other" <instance> elements are written
                prepareForWrite(mug);
                var attrs = mug.p.rawDataAttributes || {};
                return {
                    xmlns: "http://commcarehq.org/ledger/v1",
                    type: mug.p.nodeID,
                    src: attrs.src || "",
                    dest: attrs.dest || "",
                    date: attrs.date || "",
                    "section-id": mug.p.sectionId,
                    "vellum:role": "Transfer"
                };
            },
            icon: 'icon-exchange',
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
                    visibility: 'visible',
                    presence: 'optional',
                    widget: setValueWidget,
                    xpathType: "generic",
                    help: 'XPath expression for the case ID issuing the transaction. Leave blank if unknown or not applicable.',
                    validationFunc: transferMugValidation,
                },
                dest: {
                    lstring: 'Destination Case',
                    visibility: 'visible',
                    presence: 'optional',
                    widget: setValueWidget,
                    xpathType: "generic",
                    help: 'XPath expression for the case ID receiving the transaction. Leave blank if unknown or not applicable.',
                    validationFunc: transferMugValidation,
                },
                sectionId: {
                    lstring: 'Balance ID',
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.text,
                    help: 'The name of the balance you are tracking. ' + 
                         'This is an internal identifier which does not appear on the phone.',
                },
                entryId: {
                    lstring: 'Product',
                    visibility: 'visible',
                    presence: 'optional',
                    widget: setValueWidget,
                    xpathType: "generic",
                    help: 'A reference to a product ID, e.g., "/data/products/current_product"',
                },
                quantity: {
                    lstring: 'Quantity',
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: "generic",
                    help: 'A reference to an integer question in this form.',
                },
                requiredAttr: { presence: "notallowed" },
                constraintAttr: { presence : "notallowed" },
                calculateAttr: { presence: "notallowed" }
            }
        };

    $.vellum.plugin("commtrack", {}, {
        getAdvancedQuestions: function () {
            if (!this.opts().features.transaction_question_types) {
                return [];
            }
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
