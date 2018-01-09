define([
    'jquery',
    'underscore',
    'vellum/mugs',
    'vellum/tree',
    'vellum/util',
    'vellum/widgets',
    'vellum/core'
], function (
    $,
    _,
    mugs,
    Tree,
    util,
    widgets
) {
    var LEDGER_XMLNS = "http://commcarehq.org/ledger/v1",
        LEDGER_INSTANCE_ID = "ledger",
        LEDGER_INSTANCE_URI = "jr://instance/ledgerdb",
        nextId = 0,
        transferValues = [
            {
                attr: "entryId",
                path: "entry/@id"
            }, {
                attr: "quantity",
                path: "entry/@quantity"
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
        bindData = {
            Balance: [
                {
                    attr: "entryId",
                    path: "entry/@id"
                }, {
                    attr: "quantity",
                    path: "entry/@quantity"
                }, {
                    attr: "entityId",
                    path: "@entity-id"
                }, {
                    attr: "date",
                    path: "@date"
                }
            ],
            Transfer: transferValues,
            Dispense: transferValues,
            Receive: transferValues,
        },
        // {<question type>: {<path suffix>: <attr>, ...}, ...}
        bindAttributes = _.mapObject(bindData, function (items) {
            return _.object(_.map(items, function (item) {
                return [item.path, item.attr];
            }));
        }),
        basicSection = {
            slug: "main",
            displayName: gettext("Basic"),
            properties: [
                "nodeID",
                "src",
                "dest",
                "sectionId",
                "entryId",
                "quantity",
                "date",
            ],
            help: {
                title: gettext("Basic"),
                text: "<p>" + util.format(
                    gettext("The {questionid} is an internal identifier for " +
                            "a question. It does not appear on the phone. It " +
                            "is the name of the question in data exports."),
                    {questionid: "<strong>" + gettext("Question ID") + "</strong>"}
                ) + "</p>",
                link: "https://help.commcarehq.org/display/commcarepublic/Transactions",
            },
        },
        logicSection = {
            slug: "logic",
            displayName: gettext("Logic"),
            help: {
                title: gettext("Logic"),
                text: gettext("Use logic to control when questions are asked and what answers are valid. " +
                    "You can add logic to display a question based on a previous answer, to make " +
                    "the question required or ensure the answer is in a valid range."),
                link: "https://confluence.dimagi.com/display/commcarepublic/Common+Logic+and+Calculations"
            },
            properties: [
                'relevantAttr',
            ]
        },
        sectionData = {
            Balance: [
                _.extend({}, basicSection, {
                    properties: [
                        "nodeID",
                        "entityId",
                        "sectionId",
                        "entryId",
                        "quantity"
                    ],
                }),
                logicSection
            ],
            Transfer: [basicSection, logicSection],
            Dispense: [basicSection, logicSection],
            Receive: [basicSection, logicSection],
        },
        baseTransactionOptions = util.extend(mugs.defaultOptions, {
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
                var binds = [{
                    nodeset: mug.hashtagPath,
                    relevant: mug.p.relevantAttr,
                }];
                _.each(bindData[mug.__className], function (item) {
                    var value = mug.p[item.attr];
                    if (value) {
                        binds.push({
                            nodeset: mug.hashtagPath + "/" + item.path,
                            calculate: value,
                        });
                    }
                });
                return binds;
            },
            isHashtaggable: false,
            spec: {
                date: {
                    lstring: gettext('Date'),
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: 'generic',
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    help: gettext('The date and time of the action, e.g., now() or today()'),
                },
                sectionId: {
                    lstring: gettext('Balance ID'),
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.text,
                    help: gettext('The name of the balance you are tracking. ' +
                         'This is an internal identifier which does not appear on the phone.'),
                },
                entryId: {
                    lstring: gettext('Product'),
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: "generic",
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    help: gettext('A reference to a product ID, e.g., "/data/products/current_product"'),
                },
                quantity: {
                    lstring: gettext('Quantity'),
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: "generic",
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    help: gettext('A reference to an integer question in this form.'),
                },
                relevantAttr: {
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: "bool",
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    lstring: gettext('Display Condition')
                },
            },
        }),
        balanceMugOptions = util.extend(baseTransactionOptions, {
            typeName: 'Balance',
            getTagName: function () { return "balance"; },
            getExtraDataAttributes: function (mug) {
                var attrs = mug.p.rawDataAttributes || {};
                return {
                    xmlns: LEDGER_XMLNS,
                    type: mug.p.nodeID,
                    "entity-id": attrs["entity-id"] || "",
                    "section-id": mug.p.sectionId,
                    date: attrs.date || ""
                };
            },
            icon: 'fcc fcc-fd-hash',
            init: function (mug, form) {
                mug.p.entityId = "";
                mug.p.sectionId = "";
                mug.p.entryId = "";
                mug.p.quantity = "";
                mug.p.date = "now()";
                addLedgerDBInstance(mug, form);
            },
            spec: {
                xmlnsAttr: {
                    presence: "optional",
                    serialize: function () {},
                    deserialize: function () {}
                },
                nodeID: {
                    serialize: serializeNodeId
                },
                entityId: {
                    lstring: gettext('Case'),
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: "generic",
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    help: gettext('XPath expression for the case ID associated with this balance.'),
                },
                requiredAttr: { presence: "notallowed" },
                constraintAttr: { presence : "notallowed" },
                calculateAttr: { presence: "notallowed" }
            }
        }),
        transferMugValidation = function (mug) {
            var error = {key: "commtrack-transfer-src-dest-error", level: mug.ERROR};
            if (!mug.p.dest || !mug.p.src) {
                error.message = gettext('Transfer must have both Source Case and ' +
                                'Destination Case defined.');
            }
            mug.addMessages({src: [error], dest: [error]});
            return 'pass';
        },
        transferMugOptions = util.extend(baseTransactionOptions, {
            typeName: 'Transfer',
            getTagName: function () { return "transfer"; },
            isTypeChangeable: true,
            typeChangeError: function (mug, typeName) {
                if (typeName !== "Balance" && mug.__className !== "Balance" &&
                        isTransaction(mug) &&
                        isTransaction({__className: typeName})) {
                    return "";
                }
                return gettext("Cannot change $1 to $2")
                        .replace("$1", mug.__className)
                        .replace("$2", typeName);
            },
            getExtraDataAttributes: function (mug) {
                var raw = mug.p.rawDataAttributes || {},
                    attrs = {
                        xmlns: LEDGER_XMLNS,
                        type: mug.p.nodeID,
                        date: raw.date || "",
                        "section-id": mug.p.sectionId,
                    };
                if (mug.p.src && $.trim(mug.p.src)) {
                    attrs.src = raw.src || "";
                } else {
                    delete raw.src;
                }
                if (mug.p.dest && $.trim(mug.p.dest)) {
                    attrs.dest = raw.dest || "";
                } else {
                    delete raw.dest;
                }
                return attrs;
            },
            icon: 'fa fa-exchange',
            init: function (mug, form) {
                mug.p.src = "";
                mug.p.dest = "";
                mug.p.sectionId = "";
                mug.p.entryId = "";
                mug.p.quantity = "";
                mug.p.date = "now()";
                addLedgerDBInstance(mug, form);
            },
            spec: {
                nodeID: {
                    serialize: serializeNodeId
                },
                xmlnsAttr: {
                    presence: "optional",
                    serialize: function () {},
                    deserialize: function () {}
                },
                src: {
                    lstring: gettext('Source Case'),
                    visibility: 'visible',
                    presence: 'required',
                    widget: widgets.xPath,
                    xpathType: "generic",
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    help: gettext('XPath expression for the case ID issuing the transaction.'),
                    validationFunc: transferMugValidation,
                },
                dest: {
                    lstring: gettext('Destination Case'),
                    visibility: 'visible',
                    presence: 'required',
                    widget: widgets.xPath,
                    xpathType: "generic",
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    help: gettext('XPath expression for the case ID receiving the transaction.'),
                    validationFunc: transferMugValidation,
                },
                requiredAttr: { presence: "notallowed" },
                constraintAttr: { presence : "notallowed" },
                calculateAttr: { presence: "notallowed" }
            }
        }),
        dispenseMugOptions = util.extend(transferMugOptions, {
            typeName: 'Dispense',
            icon: 'fa fa-sign-out',
            spec: {
                src: {
                    validationFunc: function (mug) {
                        if (mug.p.src) {
                            return 'pass';
                        }
                        return gettext('Dispense must have a Source Case.');
                    },
                },
                dest: { presence: "notallowed" },
            }
        }),
        receiveMugOptions = util.extend(transferMugOptions, {
            typeName: 'Receive',
            icon: 'fa fa-sign-in',
            spec: {
                src: { presence: "notallowed" },
                dest: {
                    validationFunc: function (mug) {
                        if (mug.p.dest) {
                            return 'pass';
                        }
                        return gettext('Receive must have a Destination Case.');
                    },
                },
            }
        }),
        bindPaths = _.chain(bindData)
            .map(function (items) {
                return _.map(items, function(attrs) {
                    return RegExp.escape(attrs.path);
                });
            }).flatten().uniq().value(),
        bindPathSuffixRegex = new RegExp("/(" + bindPaths.join('|') + ")$");

    $.vellum.plugin("commtrack", {}, {
        getAdvancedQuestions: function () {
            return this.__callOld().concat([
                "Balance",
                "Transfer",
                "Dispense",
                "Receive"
            ]);
        },
        getMugTypes: function () {
            var types = this.__callOld();
            types.normal.Balance = balanceMugOptions;
            types.normal.Transfer = transferMugOptions;
            types.normal.Dispense = dispenseMugOptions;
            types.normal.Receive = receiveMugOptions;
            return types;
        },
        parseDataElement: function (form, el, parentMug, role) {
            var tag = el.nodeName;
            if (!role && (tag === "transfer" || tag === "balance") &&
                    $(el).attr("xmlns") === LEDGER_XMLNS) {
                if (tag === "transfer") {
                    var $el = $(el);
                    if (_.isUndefined($el.attr("src"))) {
                        role = "Receive";
                    } else if (_.isUndefined($el.attr("dest"))) {
                        role = "Dispense";
                    } else {
                        role = "Transfer";
                    }
                } else {
                    role = "Balance";
                }
                return this.__callOld(form, el, parentMug, role);
            }
            return this.__callOld();
        },
        parseBindElement: function (form, el, path) {
            var mug = form.getMugByPath(path);
            if (!mug) {
                var basePath = path.replace(bindPathSuffixRegex, "");
                if (path !== basePath) {
                    mug = form.getMugByPath(basePath);
                    if (isTransaction(mug)) {
                        var suffix = path.match(bindPathSuffixRegex)[1],
                            attr = bindAttributes[mug.__className][suffix];
                        mug.p[attr] = el.attr("calculate");
                        return;
                    }
                }
            } else if (isTransaction(mug)) {
                mug.p.relevantAttr = el.attr("relevant");
                return;
            }
            this.__callOld();
        },
        parseSetValue: function (form, el, path) {
            var mug = form.getMugByPath(path);
            if (!mug) {
                var basePath = path.replace(bindPathSuffixRegex, "");
                if (path !== basePath) {
                    mug = form.getMugByPath(basePath);
                    if (isTransaction(mug)) {
                        var suffix = path.match(bindPathSuffixRegex)[1],
                            attr = bindAttributes[mug.__className][suffix];
                        mug.p[attr] = el.attr("value");
                        return;
                    }
                }
            }
            this.__callOld();
        },
        getSections: function (mug) {
            if (sectionData.hasOwnProperty(mug.__className)) {
                return _.map(sectionData[mug.__className], function (section) {
                    return _.clone(section);
                });
            }
            return this.__callOld();
        },
    });

    function isTransaction(mug) {
        return mug && bindData.hasOwnProperty(mug.__className);
    }

    function addLedgerDBInstance(mug, form) {
        var data = {id: LEDGER_INSTANCE_ID, src: LEDGER_INSTANCE_URI};
        form.addInstanceIfNotExists(data, mug, "");
    }


    function serializeNodeId(value, key, mug, data) {
        var parent = mug.parentMug,
            path = parent ?
                mug.absolutePathNoRoot + "/" : "/";
        data.id = path + mug.p.nodeID;
    }
});
