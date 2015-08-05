define([
    'vellum/mugs',
    'vellum/widgets',
    'vellum/util',
    'underscore',
    'jquery',
    'tpl!vellum/templates/intent_templates',
    'vellum/core'
], function (
    mugs,
    widgets,
    util,
    _,
    $,
    intent_templates
) {
    "use strict";
    var DEFAULT_XMLNS = "http://opendatakit.org/xforms",
        INTENT_SPECIFIC_SPECS = [
            "androidIntentAppId",
            "docTemplate",
            "androidIntentExtra",
            "androidIntentResponse",
            "unknownAttributes",
            "intentXmlns",
        ],
        refreshCurrentMug;

    function makeODKXIntentTag (nodeID, appID) {
        return {
            androidIntentAppId: appID || "",
            intentXmlns: DEFAULT_XMLNS,
            androidIntentExtra: {},
            androidIntentResponse: {},
            unknownAttributes: {},
            nodeID: nodeID
        };
    }

    function intentAppIdWidget(mug, options) {
        var widget = widgets.text(mug, options),
            input = widget.input,
            opts = options.vellum.opts().intents,
            tempMenu = $(intent_templates({templates: opts && opts.templates || []})),
            templates = _.object(_.map(opts && opts.templates, function (temp) {
                return [temp.id, temp];
            })),
            control = $('<div class="control-row row" />')
                .append($('<div class="span8" />').append(input))
                .append($('<div class="span4" />').append(tempMenu));

        tempMenu.find('.dropdown-menu a').click(function (e) {
            e.preventDefault();
            var id = $(this).data("id");
            input.val(id).change();
            if (id && templates.hasOwnProperty(id)) {
                var container = input.parents(".fd-props-content").first();
                _.each({
                    extra: "[name=property-androidIntentExtra]",
                    response: "[name=property-androidIntentResponse]",
                }, function (name, key) {
                    var value = templates[id].hasOwnProperty(key) ? templates[id][key] : {},
                        target = container.find(name),
                        kvwidget = widgets.util.getWidget(target, options.vellum);
                    kvwidget.setValue(value);
                    kvwidget.handleChange();
                });
            }
        });

        widget.getControl = function () {
            return control;
        };

        return widget;
    }

    var parseInnerTags = function (tagObj, innerTag) {
        var store = {};
        _.each(tagObj.find(innerTag), function (inner) {
            var $innerTag = $(inner),
                key = $innerTag.attr('key'),
                value;
            value = $innerTag.attr('ref');
            if (store.hasOwnProperty(key)) {
                if (_.isArray(store[key])) {
                    store[key].push(value);
                } else {
                    store[key] = [store[key], value];
                }
            } else {
                store[key] = value;
            }
        });
        return store;
    };

    var writeInnerTagXML = function(xmlWriter, innerTag, store) {
        if (store) {
            _.each(store, function (ref, key) {
                if (key) {
                    _.each(_.isArray(ref) ? ref : [ref], function (ref) {
                        xmlWriter.writeStartElement(innerTag);
                        xmlWriter.writeAttributeString("key", key);
                        xmlWriter.writeAttributeString("ref", ref);
                        xmlWriter.writeEndElement();
                    });
                }
            });
        }
    };

    function writeXML(xmlWriter, properties) {
        xmlWriter.writeStartElement('odkx:intent');
        xmlWriter.writeAttributeString("xmlns:odkx", properties.intentXmlns);
        xmlWriter.writeAttributeString("id", properties.nodeID);
        xmlWriter.writeAttributeString("class", properties.androidIntentAppId);
        _.each(properties.unknownAttributes, function (value, name) {
            xmlWriter.writeAttributeString(name, value);
        });
        writeInnerTagXML(xmlWriter, 'extra', properties.androidIntentExtra);
        if (properties.docTemplate) {
            writeInnerTagXML(xmlWriter, 'extra', {
                'cc:print_template_reference': "'" + properties.docTemplate + "'"
            });
        }
        writeInnerTagXML(xmlWriter, 'response', properties.androidIntentResponse);
        xmlWriter.writeEndElement('odkx:intent');
    }

    function parseIntentTags(tags) {
        var intentTags = {};

        _.each(tags, function (tagXML) {
            var $tag, tagId, newTag;
            $tag = $(tagXML);

            tagId = $tag.attr('id');
            newTag = makeODKXIntentTag(tagId, $tag.attr('class'));

            newTag.xmlns = $tag.attr('xmlns:odkx') || newTag.intentXmlns;
            newTag.androidIntentExtra = parseInnerTags($tag, 'extra');
            newTag.androidIntentResponse = parseInnerTags($tag, 'response');

            _.chain(tagXML.attributes)
             .filter(function(attr) {
                 return !_.contains(['id', 'class', 'xmlns:odk'], attr.nodeName);
             })
             .each(function(attr) {
                 newTag.unknownAttributes[attr.nodeName] = attr.nodeValue;
             });

            intentTags[tagId] = newTag;
        });

        return intentTags;
    }

    function syncMugWithIntent (tags, mug) {
        // called when initializing a mug from a parsed form
        if (mug.__className === "AndroidIntent" ||
            mug.__className === "PrintIntent") {
            var nodeID = mug.p.nodeID,
                tag = tags.hasOwnProperty(nodeID) ? tags[nodeID] : makeODKXIntentTag(nodeID);

            _.each(INTENT_SPECIFIC_SPECS, function (key) {
                if (!mug.p[key]) {
                    mug.p[key] = tag[key];
                }
            });

            delete tags[tag.nodeID];
        }

        if (mug.p.androidIntentAppId === "org.commcare.dalvik.action.PRINT") {
            mug.form.changeMugType(mug, 'PrintIntent');
        }

        if (mug.__className === "PrintIntent") {
            if (mug.p.androidIntentExtra['cc:print_template_reference']) {
                mug.p.docTemplate = mug.p.androidIntentExtra['cc:print_template_reference'].replace(/^'|'$/g, '');
                delete mug.p.androidIntentExtra['cc:print_template_reference'];
            } else {
                mug.p.docTemplate = "jr://file/commcare/text/" + mug.p.nodeID+ ".html";
            }
        }
    }

    function writeIntentXML (unmappedIntentTags, xmlWriter, tree) {
        // make sure any leftover intent tags are still kept
        _.each(unmappedIntentTags, function (tag) {
            writeXML(xmlWriter, tag);
        });

        tree.treeMap(function(node) {
            var mug = node.getValue();
            if (mug && mug.options.dataType === 'intent') {
                writeXML(xmlWriter, mug.p);
            }
        });
    }

    function serializeAttrs(value, key, mug, data) {
        data[key] = _.clone(mug.p[key]);
        if (data[key][""] === "") {
            delete data[key][""];
        }
    }

    function parseFields (html) {
        var field_regex = /{{\s*([^}\s]+)\s*}}/gm,
            match = field_regex.exec(html),
            fields = {};

        while (match) {
            _.each(match.splice(1), function(field) {
                fields[field] = field;
            });
            match = field_regex.exec(html);
        }

        return fields;
    }

    var AndroidIntent = util.extend(mugs.defaultOptions, {
        typeName: 'Android App Callout',
        dataType: 'intent',
        tagName: 'input',
        icon: 'icon-vellum-android-intent',
        isODKOnly: true,
        isTypeChangeable: false,
        init: function (mug, form) {
            mug.p.intentXmlns = mug.p.intentXmlns || DEFAULT_XMLNS;
        },
        spec: {
            androidIntentAppId: {
                lstring: 'Intent ID',
                visibility: 'visible',
                widget: intentAppIdWidget,
                placeholder: 'Insert Android Application ID',
                deserialize: function (data, key, mug) {
                    if (data.intent) {
                        // support old format for now
                        mug.p.androidIntentAppId = data.intent.path || "";
                        _.each([
                            ["intentXmlns", "xmlns"],
                            ["androidIntentExtra", "extra"],
                            ["androidIntentResponse", "response"],
                            ["unknownAttributes", "unknownAttributes"],
                        ], function (keys) {
                            var attr = keys[0], key = keys[1];
                            if (!_.isEmpty(data.intent[key])) {
                                mug.p[attr] = data.intent[key];
                            }
                        });
                    } else {
                        mug.p[key] = data[key];
                    }
                }
            },
            androidIntentExtra: {
                lstring: 'Extra',
                visibility: 'visible',
                widget: widgets.baseKeyValue,
                serialize: serializeAttrs,
            },
            androidIntentResponse: {
                lstring: 'Response',
                visibility: 'visible',
                widget: widgets.baseKeyValue,
                serialize: serializeAttrs,
            },
            unknownAttributes: {
                visibility: 'hidden',
                presence: 'optional',
                serialize: serializeAttrs,
            },
            intentXmlns: {
                visibility: 'hidden',
                presence: 'optional',
                lstring: "Special Intent XMLNS attribute",
            }
        },
        // todo: move to spec system
        getAppearanceAttribute: function (mug) {
            return 'intent:' + mug.p.nodeID;
        }
    });

    var PrintIntent = util.extend(AndroidIntent, {
        typeName: 'Print',
        icon: 'icon-print',
        init: function (mug, form) {
            AndroidIntent.init(mug, form);
            mug.p.androidIntentAppId = "org.commcare.dalvik.action.PRINT";
        },
        spec: {
            docTemplate: {
                lstring: 'Document Template',
                visibility: 'visible',
                widget: widgets.media,
            },
            androidIntentAppId: { visibility: 'hidden' },
            androidIntentResponse: { visibility: 'hidden' },
        }
    });

    $.vellum.plugin("intents", {}, {
        init: function() {
            refreshCurrentMug = this.refreshCurrentMug.bind(this);
        },
        loadXML: function (xml) {
            this.data.intents.unmappedIntentTags = parseIntentTags(
                $(xml).find('h\\:head, head').children("odkx\\:intent, intent")
            );
            this.__callOld();
        },
        contributeToHeadXML: function (xmlWriter, form) {
            this.__callOld();
            writeIntentXML(this.data.intents.unmappedIntentTags, xmlWriter, form.tree);
        },
        handleNewMug: function (mug) {
            var ret = this.__callOld();
            syncMugWithIntent(this.data.intents.unmappedIntentTags, mug);
            return ret;
        },
        handleMugParseFinish: function (mug) {
            this.__callOld();
            syncMugWithIntent(this.data.intents.unmappedIntentTags, mug);
        },
        getMugTypes: function () {
            var types = this.__callOld();
            types.normal.AndroidIntent = AndroidIntent;
            types.normal.PrintIntent = PrintIntent;
            return types;
        },
        getAdvancedQuestions: function () {
            var ret = this.__callOld();
            ret.push("AndroidIntent");
            if (this.opts().features.printing) {
                ret.push("PrintIntent");
            }
            return ret;
        },
        getMainProperties: function () {
            return this.__callOld().concat(INTENT_SPECIFIC_SPECS);
        }
    });

    return {
        test: {
            parseFields: parseFields,
        }
    };
});
