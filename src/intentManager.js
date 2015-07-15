define([
    'vellum/mugs',
    'vellum/widgets',
    'vellum/util',
    'underscore',
    'jquery',
    'vellum/core'
], function (
    mugs,
    widgets,
    util,
    _,
    $
) {
    "use strict";
    var DEFAULT_XMLNS = "http://opendatakit.org/xforms",
        unmappedIntentTags = {},
        INTENT_SPECIFIC_SPECS = [
            "androidIntentAppId",
            "androidIntentExtra",
            "androidIntentResponse",
            "unknownAttrs",
            "intentXmlns",
        ];

    function makeODKXIntentTag (nodeID, appID) {
        return {
            androidIntentAppId: appID || "",
            intentXmlns: DEFAULT_XMLNS,
            androidIntentExtra: {},
            androidIntentResponse: {},
            unknownAttrs: {},
            nodeID: nodeID
        };
    }

    var parseInnerTags = function (tagObj, innerTag) {
        var store = {};
        _.each(tagObj.find(innerTag), function (inner) {
            var $innerTag = $(inner);
            store[$innerTag.attr('key')] = $innerTag.attr('ref');
        });
        return store;
    };

    var writeInnerTagXML = function(xmlWriter, innerTag, store) {
        if (store) {
            _.each(store, function (ref, key) {
                if (key) {
                    xmlWriter.writeStartElement(innerTag);
                    xmlWriter.writeAttributeString("key", key);
                    xmlWriter.writeAttributeString("ref", ref);
                    xmlWriter.writeEndElement();
                }
            });
        }
    };

    function writeXML(xmlWriter, properties) {
        xmlWriter.writeStartElement('odkx:intent');
        xmlWriter.writeAttributeString("xmlns:odkx", properties.intentXmlns);
        xmlWriter.writeAttributeString("id", properties.nodeID);
        xmlWriter.writeAttributeString("class", properties.androidIntentAppId);
        _.each(properties.unknownAttrs, function (value, name) {
            xmlWriter.writeAttributeString(name, value);
        });
        writeInnerTagXML(xmlWriter, 'extra', properties.androidIntentExtra);
        writeInnerTagXML(xmlWriter, 'response', properties.androidIntentResponse);
        xmlWriter.writeEndElement('odkx:intent');
    }

    function parseIntentTagsFromHead(tags) {
        unmappedIntentTags = {};
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
                 newTag.unknownAttrs[attr.nodeName] = attr.nodeValue;
             });

            unmappedIntentTags[tagId] = newTag;
        });
    }

    function syncMugWithIntent (mug) {
        // called when initializing a mug from a parsed form
        if (mug.__className === "AndroidIntent") {
            var nodeID = mug.p.nodeID,
                tag = _.findWhere(unmappedIntentTags, {nodeID: nodeID});

            if (!tag) {
                tag = makeODKXIntentTag(nodeID, null);
            }

            _.each(INTENT_SPECIFIC_SPECS, function (key) {
                mug.p[key] = tag[key];
            });

            delete unmappedIntentTags[tag.nodeID];
        }
    }

    function writeIntentXML (xmlWriter, tree) {
        // make sure any leftover intent tags are still kept
        _.each(unmappedIntentTags, function (tag) {
            writeXML(xmlWriter, tag);
        });

        function getIntentMugs(node) {
            var mug = node.getValue();
            if (!mug || node.isRootNode) {
                return null;
            }
            if (mug.options.dataType === 'intent') {
                writeXML(xmlWriter, mug.p);
            } else {
                return null;
            }
        }

        tree.treeMap(getIntentMugs);
    }

    function androidIntentAppId(mug, options) {
        var widget = widgets.text(mug, options),
            input = widget.input;
        input.attr('placeholder', 'Insert Android Application ID');
        return widget;
    }

    function serializeAttrs(value, key, mug, data) {
        data[key] = _.omit(mug.p[key], "");
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
                widget: androidIntentAppId,
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
            unknownAttrs: {
                lstring: 'Unknown',
                visibility: 'hidden',
                presence: 'optional',
                widget: widgets.baseKeyValue,
                serialize: serializeAttrs,
            },
            intentXmlns: {
                visibility: 'hidden',
                presence: 'optional',
                lstring: "Special Intent XMLNS attribute"
            }
        },
        // todo: move to spec system
        getAppearanceAttribute: function (mug) {
            return 'intent:' + mug.p.nodeID;
        }
    });

    $.vellum.plugin("intents", {}, {
        loadXML: function (xml) {
            parseIntentTagsFromHead($(xml).find('h\\:head, head')
                                    .children("odkx\\:intent, intent"));
            this.__callOld();
        },
        contributeToHeadXML: function (xmlWriter, form) {
            this.__callOld();
            writeIntentXML(xmlWriter, form.tree);
        },
        handleNewMug: function (mug) {
            var ret = this.__callOld();
            syncMugWithIntent(mug);
            return ret;
        },
        handleMugParseFinish: function (mug) {
            this.__callOld();
            syncMugWithIntent(mug);
        },
        getMugTypes: function () {
            var types = this.__callOld();
            types.normal.AndroidIntent = AndroidIntent;
            return types;
        },
        getMainProperties: function () {
            return this.__callOld().concat(INTENT_SPECIFIC_SPECS);
        }
    });
});
