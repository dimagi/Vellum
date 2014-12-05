define([
    'vellum/form',
    'jquery',
    'underscore',
    'vellum/mugs',
    'vellum/parser',
    'vellum/tree',
    'vellum/util',
    'vellum/core'
], function (
    form_,
    $,
    _,
    mugs,
    parser,
    Tree,
    util
) {
    var Repeat = mugs.baseMugTypes.normal.Repeat,
        modelRepeatMugOptions = {
            typeName: 'Model Repeat',
            supportsDataNodeRole: true,
            dataNodeChildren: function ($node) {
                return $node.children("item").children();
            },
            dataChildFilter: function (children, mug) {
                return [new Tree.Node(children, {
                    getNodeID: function () { return "item"; },
                    p: {rawDataAttributes: {}},
                    options: {
                        getExtraDataAttributes: function (mug) {
                            return {id: "", index: "", "jr:template": ""};
                        }
                    }
                })];
            },
            controlChildFilter: function (children, mug) {
                var absPath = mug.form.getAbsolutePath(mug),
                    r_count = mug.p.repeat_count;
                children = Repeat.controlChildFilter(children, mug);
                children[0].getValue().options.writeCustomXML = function (xmlWriter, mug) {
                    if (r_count) {
                        xmlWriter.writeAttributeString("jr:count", String(r_count));
                        xmlWriter.writeAttributeString("jr:noAddRemove", "true()");
                    }
                    xmlWriter.writeAttributeString("nodeset", absPath + "/item");
                };
                return children;
            },
            getExtraDataAttributes: function (mug) {
                return {
                    ids: "",
                    count: "",
                    current_index: "",
                    "vellum:role": "ModelRepeat"
                };
            },
            afterInsert: function (form, mug) {
                // TODO create hidden values for case properties, etc.
                //form.createQuestion(mug, 'into', "Hidden", true);
//            },
//            init: function (mug, form) {
//                Repeat.init(mug, form);
//                mug.p.repeat_count = "@count";
    //        },
    //        spec: {
    //            repeat_count: {
    //                lstring: 'Repeat Count',
    //                visibility: 'visible_if_present',
    //                presence: 'optional',
    //                widget: widgets.droppableText
    //            }
            }
        };

    $.vellum.plugin("modeliteration", {}, {
        getMugTypes: function () {
            var types = this.__callOld(),
                Repeat = types.normal.Repeat;
            types.normal.ModelRepeat = util.extend(Repeat, modelRepeatMugOptions);
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
                        if (mug && mug.__className === "ModelRepeat") {
                            adapt = function (ignore, form) {
                                //mug.p.sourceParams = ... TODO
                                mug.p.repeat_count = repeat.popAttr('jr:count') || null;
                                mug.p.rawRepeatAttributes = parser.getAttributes(repeat);
                                return mug;
                            };
                            adapt.type = 'ModelRepeat';
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
            if (mug.__className === "ModelRepeat") {
                var setvalues = mug.form.getSetValues(),
                    path = mug.form.getAbsolutePath(mug),
                    setvalueMap = {},
                    iterationParams = {},
                    i, value, key;
                setvalueMap["xforms-ready " + path + "/@ids"] = "ids";
                setvalueMap["xforms-ready " + path + "/@count"] = "count";
                setvalueMap["jr-insert " + path + "/@current_index"] = "current_index";
                setvalueMap["jr-insert " + path + "/item/@index"] = "index";
                setvalueMap["jr-insert " + path + "/item/@id"] = "id";
                for (i = 0; i < setvalues.length; i++) {
                    value = setvalues[i];
                    key = value.event + " " + value.ref;
                    if (setvalueMap.hasOwnProperty(key)) {
                        iterationParams[setvalueMap[key]] = value.value;
                    }
                }
                mug.p.iterationParams = iterationParams;
            }
        },
        // test function to be used before commcare data plugin is available
        getDataSources: function (type) {
            var value;
            if (type === "case") {
                value = [];
            } else {
                value = this.__callOld();
            }
            return value;
        }
    });
});
