define([
    'vellum/form',
    'jquery',
    'underscore',
    'vellum/datasources',
    'vellum/mugs',
    'vellum/parser',
    'vellum/tree',
    'vellum/util',
    'vellum/core'
], function (
    form_,
    $,
    _,
    datasources,
    mugs,
    parser,
    Tree,
    util
) {
    var oldRepeat = mugs.baseMugTypes.normal.Repeat,
        // the order of the items in this list is important:
        // <setvalue> elements are evaluated in document order
        setvalueData = [
            {
                key: "ids",
                event: "xforms-ready",
                path: "",
                query: "join(' ', {})"
            }, {
                key: "count",
                event: "xforms-ready",
                path: "",
                query: "count-selected({}/@ids)"
            }, {
                key: "current_index",
                event: "jr-insert",
                path: "",
                query: "count({}/item)"
            }, {
                key: "index",
                event: "jr-insert",
                path: "/item",
                query: "int({}/@current_index)"
            }, {
                key: "id",
                event: "jr-insert",
                path: "/item",
                query: "selected-at({}/@ids,../@index)"
            }
        ],
        instanceRegexp = /^instance\(['"]([^'"]+)['"]\)/i,
        joinIdsRegexp = /^ *join\(['"] ['"], *(.*)\) *$/i,
        modelRepeatMugOptions = {
            //typeName: 'Model Repeat',
            supportsDataNodeRole: true,
            adjustPath: function (mug, path) {
                if (mug.p.dataSource.idsQuery) {
                    path += "/item";
                }
                return path;
            },
            dataNodeChildren: function ($node) {
                return $node.children("item").children();
            },
            dataChildFilter: function (children, mug) {
                if (!mug.p.dataSource.idsQuery) {
                    return children;
                }
                return [new Tree.Node(children, {
                    getNodeID: function () { return "item"; },
                    p: {rawDataAttributes: null},
                    options: {
                        getExtraDataAttributes: function (mug) {
                            return {id: "", index: "", "jr:template": ""};
                        }
                    }
                })];
            },
            controlChildFilter: function (children, mug) {
                var nodeset = mug.form.getAbsolutePath(mug),
                    r_count = mug.p.repeat_count;
                children = oldRepeat.controlChildFilter(children, mug);
                children[0].getValue().options.writeCustomXML = function (xmlWriter, mug) {
                    if (r_count) {
                        xmlWriter.writeAttributeString("jr:count", String(r_count));
                        xmlWriter.writeAttributeString("jr:noAddRemove", "true()");
                    }
                    xmlWriter.writeAttributeString("nodeset", nodeset);
                };
                return children;
            },
            getExtraDataAttributes: function (mug) {
                // HACK must happen before <setvalue> and "other" <instance> elements are written
                prepareForWrite(mug);
                if (!mug.p.dataSource.idsQuery) {
                    return oldRepeat.getExtraDataAttributes(mug);
                }
                return {
                    ids: "",
                    count: "",
                    current_index: "",
                    "vellum:role": "Repeat"
                };
            },
            init: function (mug, form) {
                oldRepeat.init(mug, form);
                mug.p.repeat_count = "";
                mug.p.setvalues = {};
                mug.p.originalPath = null;
                mug.p.dataSource = {};
                mug.p.dataSourceChanged = false;
                form.on("mug-property-change", function (event) {
                    if (event.property === "dataSource") {
                        event.mug.p.dataSourceChanged = true;
                        if (event.previous) {
                            updateDataSourceInstanceRefs(
                                event.mug, event.val, event.previous);
                        }
                    }
                });
            },
            spec: {
                //repeat_count: {visibility: "hidden"},
                dataSource: {
                    lstring: 'Data Source',
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: datasources.dataSourceWidget
                }
            }
        };

    $.vellum.plugin("modeliteration", {}, {
        getMugTypes: function () {
            var types = this.__callOld();
            types.normal.Repeat = util.extend(oldRepeat, modelRepeatMugOptions);
            return types;
        },
        updateControlNodeAdaptorMap: function (map) {
            this.__callOld();
            var getGroupAdaptor = map.group;
            map.group = function ($element, appearance, form, parentMug) {
                var adapt = getGroupAdaptor($element, appearance, form, parentMug);
                if (adapt.repeat) {
                    var repeat = adapt.repeat,
                        path = adapt.path,
                        mug;
                    if (/\/item$/.test(path)) {
                        mug = form.getMugByPath(path.substring(0, path.length - 5));
                        if (mug && mug.__className === "Repeat") {
                            adapt = function (ignore, form) {
                                mug.p.nodeset = path;
                                mug.p.repeat_count = repeat.popAttr('jr:count') || null;
                                mug.p.rawRepeatAttributes = parser.getAttributes(repeat);
                                return mug;
                            };
                            adapt.type = 'Repeat';
                            adapt.path = path;
                            adapt.repeat = repeat;
                            adapt.ignoreDataNode = true;
                        }
                    }
                }
                return adapt;
            };
        },
        handleMugParseFinish: function (mug) {
            this.__callOld();
            if (mug.__className !== "Repeat") {
                return;
            }
            var path = mug.form.getAbsolutePath(mug);
            mug.p.dataSource = {};
            mug.p.dataSourceChanged = false;
            mug.p.setvalues = {};
            var values = _.object(_.map(mug.form.getSetValues(), function (value) {
                    return [value.event + " " + value.ref, value];
                }));
            _.each(setvalueData, function (data) {
                var value = values[data.event + " " + path + data.path + "/@" + data.key];
                if (value) {
                    mug.p.setvalues[data.key] = value;
                    if (data.key === "ids") {
                        // get dataSource.idsQuery
                        value = value.value;
                        var match = value && value.match(joinIdsRegexp);
                        if (match) {
                            mug.p.dataSource.idsQuery = match[1];
                        } else {
                            mug.p.dataSource.idsQuery = value;
                        }
                    }
                }
            });
            if (mug.p.dataSource.idsQuery) {
                var match = mug.p.dataSource.idsQuery.match(instanceRegexp);
                if (match) {
                    var instanceId = match[1],
                        ref = mug.ufid + ".dataSource.instance",
                        meta = mug.form.referenceInstance(instanceId, ref);
                    if (meta) {
                        mug.p.dataSource.instance = _.clone(meta.attributes);
                    }
                }
                mug.p.rawDataAttributes = _.omit(
                    mug.p.rawDataAttributes, ["ids", "count", "current_index"]);
            }
            mug.p.originalPath = mug.form.getAbsolutePath(mug);
        }
    });

    function updateDataSourceInstanceRefs(mug, value, previous) {
        var value_src = value && value.instance && value.instance.src,
            prev_src = previous && previous.instance && previous.instance.src;
        if (value_src !== prev_src) {
            var ref = mug.ufid + ".dataSource.instance";
            if (prev_src) {
                mug.form.dropInstanceReference(prev_src, ref);
            }
            if (value_src) {
                var instanceId = mug.form.addInstanceIfNotExists(value.instance, ref);
                if (instanceId !== value.instance.id) {
                    // is it too magical to replace the instance id in the query?
                    // there might be edge cases where a user is entering a
                    // custom instance and query and does not want this to
                    // happen
                    value.idsQuery = value.idsQuery.replace(
                        instanceRegexp, "instance('" + instanceId + "')");
                    mug.p.dataSource = value; // fire change handler
                }
            }
        }
    }

    function prepareForWrite(mug) {
        var path = mug.form.getAbsolutePath(mug);
        if (!mug.p.dataSourceChanged && mug.p.originalPath === path) {
            return;
        }

        var query = mug.p.dataSource.idsQuery;

        if (query) {
            path = path.replace(/\/item$/, "");
            mug.p.repeat_count = path + "/@count";

            // add/update <setvalue> elements
            var setvalues = mug.p.setvalues,
                setvaluesById = _.groupBy(mug.form.getSetValues(), "_id");
            _.each(setvalueData, function (data) {
                var value = setvalues[data.key],
                    setvalue = null;
                if (value) {
                    setvalue = setvaluesById[value._id] || {};
                } else {
                    value = {};
                }
                value.ref = path + data.path + "/@" + data.key;
                value.value = data.query.replace("{}", data.key === "ids" ? query : path);
                if (!value.event) {
                    setvalues[data.key] = mug.form.addSetValue(
                        data.event, value.ref, value.value);
                }
            });
        } else {
            // remove <setvalue> elements
            if (mug.p.setvalues) {
                var setvaluesToRemove = _.groupBy(mug.p.setvalues, "_id");
                mug.form.dropSetValues(function (value) {
                    return setvaluesToRemove.hasOwnProperty(value._id);
                });
            }
        }
    }
});
