define([
    'jquery',
    'underscore',
    'vellum/dataSourceWidgets',
    'vellum/mugs',
    'vellum/parser',
    'vellum/tree',
    'vellum/util',
    'vellum/core',
], function (
    $,
    _,
    datasourceWidgets,
    mugs,
    parser,
    Tree,
    util,
) {
    var oldRepeat = mugs.baseMugTypes.normal.Repeat,
        // the order of the items in this list is important:
        // <setvalue> elements are evaluated in document order
        setvalueData = [
            {
                key: "ids",
                event: "xforms-ready",
                path: "",
                query: "join(' ', {})",
            }, {
                key: "count",
                event: "xforms-ready",
                path: "",
                query: "count-selected({}/@ids)",
            }, {
                key: "index",
                event: "jr-insert",
                path: "/item",
                query: "int({}/@current_index)",
            }, {
                key: "id",
                event: "jr-insert",
                path: "/item",
                query: "selected-at({}/@ids, ../@index)",
            },
        ],
        joinIdsRegexp = /^ *join\(['"] ['"], *(.*)\) *$/i,
        modelRepeatMugOptions = {
            //typeName: 'Model Repeat',
            supportsDataNodeRole: true,
            isRepeat: true,
            getPathName: function (mug, name) {
                if (mug.p.dataSource.idsQuery) {
                    name += "/item";
                }
                return name;
            },
            parseDataNode: function (mug, $node) {
                // temporary dataSource overwritten by handleMugParseFinish
                mug.p.dataSource = {idsQuery: "value for getPathName"};
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
                        },
                    },
                })];
            },
            controlChildFilter: function (children, mug) {
                var nodeset = mug.hashtagPath,
                    r_count = mug.p.repeat_count;
                children = oldRepeat.controlChildFilter(children, mug);
                children[0].getValue().options.writeCustomXML = function (xmlWriter, mug) {
                    if (r_count) {
                        util.writeHashtags(xmlWriter, 'jr:count', String(r_count), mug);
                        xmlWriter.writeAttributeString("jr:noAddRemove", "true()");
                    }
                    util.writeHashtags(xmlWriter, 'nodeset', nodeset, mug);
                };
                return children;
            },
            getExtraDataAttributes: function (mug) {
                if (!mug.p.dataSource.idsQuery) {
                    return oldRepeat.getExtraDataAttributes(mug);
                }
                return {
                    ids: "",
                    count: "",
                    current_index: "",
                    "vellum:role": "Repeat",
                };
            },
            getBindList: function (mug) {
                var path = mug.absolutePath,
                    binds = oldRepeat.getBindList(mug);
                if (mug.p.dataSource.idsQuery) {
                    binds.splice(0, 0, {
                        nodeset: path.replace(/\/item$/, "/@current_index"),
                        calculate: "count(" + path + ")",
                    });
                }
                return binds;
            },
            init: function (mug, form) {
                oldRepeat.init(mug, form);
                mug.p.repeat_count = "";
                mug.p.setvalues = {};
                mug.p.originalPath = null;
                mug.p.dataSource = {};
                mug.p.dataSourceChanged = false;
                mug.options.customRepeatButtonText = form.vellum.opts().features.use_custom_repeat_button_text;
            },
            spec: {
                nodeID: {
                    deserialize: function (data, key, mug, context) {
                        var deserialize = mugs.baseSpecs.databind.nodeID.deserialize;
                        if (data.dataSource) {
                            var id = data.id.slice(0, data.id.lastIndexOf("/")) || data.id,
                                copy = _.extend({}, data, {id: id});
                            return deserialize(copy, key, mug, context);
                        }
                        return deserialize(data, key, mug, context);
                    },
                },
                repeat_count: _.extend({}, oldRepeat.spec.repeat_count, {
                    visibility: function (mug) {
                        return !mug.p.dataSource.idsQuery;
                    },
                }),
                dataSource: {
                    lstring: gettext('Data Source'),
                    visibility: 'visible_if_present',
                    presence: 'optional',
                    widget: idsQueryDataSourceWidget,
                    validationFunc: function (mug) {
                        if (mug.p.dataSource.idsQuery) {
                            mug.form.updateLogicReferences(
                                mug, "dataSource", mug.p.dataSource.idsQuery);
                        }
                    },
                    serialize: function (value, key, mug, data) {
                        if (value && value.idsQuery) {
                            return {idsQuery:
                                mugs.serializeXPath(value.idsQuery, key, mug, data)};
                        }
                    },
                    deserialize: function (data, key, mug, context) {
                        var value = data[key] || {};
                        mugs.updateInstances(data, mug);
                        if (value && value.instance &&
                                     value.instance.id && value.instance.src) {
                            // legacy serialization format
                            var instances = {};
                            instances[value.instance.id] = value.instance.src;
                            mug.form.updateKnownInstances(instances);
                        }
                        var src = {},
                            fakeMug = {form: mug.form, p: src};
                        src.idsQuery = mugs.deserializeXPath(value, "idsQuery", fakeMug, context);
                        return src;
                    },
                },
            },
            ignoreReferenceWarning: function (mug) {
                return isModelRepeat(mug);
            },
            getSetValues: function (mug) {
                var path = mug.absolutePath,
                    query = mug.p.dataSource.idsQuery,
                    ret = [];

                if (query) {
                    path = path.replace(/\/item$/, "");
                    mug.p.repeat_count = path + "/@count";

                    // add/update <setvalue> elements
                    var isNested = mug.parentMug && mug.parentMug.isInRepeat(),
                        setvalues = mug.p.setvalues;
                    _.each(setvalueData, function (data) {
                        var event = isNested ? "jr-insert" : data.event,
                            value = setvalues[data.key];
                        if (!value) {
                            value = {};
                        }
                        value.ref = path + data.path + "/@" + data.key;
                        value.value = data.query.replace("{}", data.key === "ids" ? query : path);
                        if (!value.event) {
                            value.event = event;
                        }
                        ret.push({
                            event: event,
                            ref: value.ref,
                            value: value.value,
                        });
                    });
                }
                return ret;
            },
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
        parseBindElement: function (form, el, path) {
            var mug = form.getMugByPath(path);
            if (!mug) {
                var repeatPath = path.replace(/\/@current_index$/, "/item");
                if (path !== repeatPath) {
                    mug = form.getMugByPath(repeatPath);
                    if (isModelRepeat(mug)) {
                        // ignore this bind (it will be created automatically on write)
                        return;
                    }
                }
            }
            this.__callOld();
        },
        handleMugParseFinish: function (mug) {
            this.__callOld();
            if (mug.__className !== "Repeat") {
                return;
            }
            var path = mug.absolutePath,
                container = null;
            if (mug.p.dataSource.idsQuery) {
                container = path.replace(/\/item$/, "");
            }
            mug.p.originalPath = path;
            mug.p.dataSource = {};
            mug.p.dataSourceChanged = false;
            mug.p.setvalues = {};
            if (container === null) {
                return;
            }
            var isNested = mug.parentMug && mug.parentMug.isInRepeat(),
                values = _.object(_.map(mug.form.getSetValues(), function (value) {
                    return [value.event + " " + value.ref, value];
                }));
            _.each(setvalueData, function (data) {
                var event = isNested ? "jr-insert" : data.event,
                    value = values[event + " " + container + data.path + "/@" + data.key];
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
                mug.p.dataSource.instance = mug.form.parseInstance(
                    mug.p.dataSource.idsQuery, mug, "dataSource");
            } else {
                // keep paths consistent for malformed model repeat with
                // missing IDs query. this XPath returns the empty set
                mug.p.dataSource.idsQuery = "''";
            }
            mug.p.rawDataAttributes = _.omit(
                mug.p.rawDataAttributes, ["ids", "count", "current_index"]);
            dropSetValues(mug);
        },
        loadXML: function () {
            this.__callOld();
            this.data.core.form.on("mug-property-change", function (event) {
                var mug = event.mug;
                if (mug.__className === "Repeat" && event.property === "dataSource") {
                    mug.p.dataSourceChanged = true;
                    updateDataSource(mug, event.val, event.previous);
                }
            });
        },
    });

    function isModelRepeat(mug) {
        return mug && mug.__className === "Repeat" && mug.p.dataSource.idsQuery;
    }

    function idsQueryDataSourceWidget(mug, options) {
        var widget = datasourceWidgets.advancedDataSourceWidget(
                mug, options, gettext("Model Iteration ID Query")),
            super_getValue = widget.getValue,
            super_setValue = widget.setValue;

        // Make the input in the main properties view read-only to force use of
        // the data source editor so mug properties will be reloaded on save
        // -> show/hide repeat_count depending on idsQuery value.
        widget.input.attr({"readonly": "readonly"});

        widget.getValue = function () {
            var val = super_getValue();
            return {
                instance: ($.trim(val.src) ? {id: val.id, src: val.src} : null),
                idsQuery: val.query,
            };
        };

        widget.setValue = function (val) {
            val = val || {};
            super_setValue({
                id: (val.instance ? val.instance.id : ""),
                src: (val.instance ? val.instance.src : ""),
                query: val.idsQuery || "",
            });
        };

        return widget;
    }

    function updateDataSource(mug, value, previous) {
        if (previous && previous.instance && previous.instance.src) {
            mug.form.dropInstanceReference(
                previous.instance.src, mug, "dataSource.instance");
        }
        if (value && value.instance && value.instance.src) {
            var instanceId = mug.form.addInstanceIfNotExists(
                value.instance, mug, "dataSource.instance");
            if (instanceId !== value.instance.id) {
                // is it too magical to replace the instance id in the query?
                // there might be edge cases where a user is entering a
                // custom instance and query and does not want this to
                // happen
                value.instance.id = instanceId;
                value.idsQuery = mug.form.updateInstanceQuery(value.idsQuery, instanceId);
            }
        }
        if (Boolean(value && value.idsQuery) !== Boolean(previous && previous.idsQuery)) {
            var nodeID = mug.p.nodeID,
                hashPath = mug.hashtagPath,
                oldParent = mug.parentMug,
                oldHash;
            if (value && value.idsQuery) {
                oldHash = hashPath.replace(/\/item$/, "");
            } else {
                oldHash = hashPath + "/item";
                if (/\/@count$/.test(mug.p.repeat_count)) {
                    mug.p.repeat_count = "";
                }
            }
            mug.form.vellum.handleMugRename(
                mug.form, mug, nodeID, nodeID, hashPath, oldHash, oldParent);
        }
    }

    function dropSetValues(mug) {
        // remove <setvalue> elements
        if (mug.p.setvalues) {
            var setvaluesToRemove = _.groupBy(mug.p.setvalues, "_id");
            mug.form.dropSetValues(function (value) {
                return setvaluesToRemove.hasOwnProperty(value._id);
            });
        }
    }
});
