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
    var setvalueData = [
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
        transferMugOptions = {
            typeName: 'Transfer',
            isDataOnly: true,
            supportsDataNodeRole: true,
            parseDataNode: function (mug, $node) {
                mug.p.sectionId = mug.p.rawDataAttributes["section-id"];
                delete mug.p.rawDataAttributes["section-id"];
                return $([]); // is this right?
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
            getBindList: function (mug) {
                mug.form.controlTree.walk(function (mug, nodeID, processChildren) {
                    processChildren();
                });
                return [{
                    nodeset: mug.form.getAbsolutePath(mug) + "/entry/@quantity",
                    calculate: mug.p.quantity
                }];
            },
            init: function (mug, form) {
                mug.p.sectionId = "";
                mug.p.quantity = "";
                mug.p.entryId = {value: ""};
                mug.p.src = {value: ""};
                mug.p.dest = {value: ""};
                mug.p.date = {value: "today()"};
            },
            spec: {
                xmlnsAttr: { presence: "optional" },
                sectionId: {
                    lstring: 'Section ID',
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: widgets.text
                },
                quantity: {
                    lstring: 'Quantity',
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: "generic"
                },
                requiredAttr: { presence: "notallowed" },
                constraintAttr: { presence : "notallowed" },
                calculateAttr: { visibility: "notallowed" }
            }
        };

    $.vellum.plugin("commtrack", {}, {
        getAdvancedQuestions: function () {
            return this.__callOld().concat([
                "Transfer"
            ]);
        },
        getMugTypes: function () {
            var types = this.__callOld();
            types.normal.Transfer = util.extend(mugs.defaultOptions, transferMugOptions);
            return types;
        },
        parseBindElement: function (form, el, path) {
            var mug = form.getMugByPath(path);
            if (!mug) {
                var basePath = path.replace(/\/entry\/@quantity$/, "");
                if (path !== basePath) {
                    mug = form.getMugByPath(basePath);
                    if (isTransfer(mug)) {
                        mug.p.quantity = el.attr("calculate");
                        return;
                    }
                }
            }
            this.__callOld();
        },
        handleMugParseFinish: function (mug) {
            this.__callOld();
            if (!isTransfer(mug)) {
                return;
            }
            var path = mug.form.getAbsolutePath(mug);
            mug.p.setvalues = {};
            var values = _.object(_.map(mug.form.getSetValues(), function (value) {
                    return [value.ref, value];
                }));
            _.each(setvalueData, function (data) {
                mug.p[data.attr] = values[path + "/" + data.path] || {
                    value: ""
                };
            });
        },
        getSections: function (mug) {
            if (!isTransfer(mug)) {
                return this.__callOld();
            }
            return [
                {
                    slug: "main",
                    displayName: "Basic",
                    properties: [
                        "sectionId",
                        "quantity",
                        "entryId",
                        "src",
                        "dest"
                    ],
                }
            ];
        }
    });

    function isTransfer(mug) {
        return mug && mug.__className === "Transfer";
    }

    function isInRepeat(mug) {
        if (mug.__className === "Repeat") { // HACK hard-coded class name
            return true;
        }
        return mug.parentMug && isInRepeat(mug.parentMug);
    }

    function prepareForWrite(mug) {
        var path = mug.form.getAbsolutePath(mug),
            event = isInRepeat(mug) ? "jr-insert" : "xforms-ready";

        // update <setvalue> refs
        _.each(setvalueData, function (data) {
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
});
