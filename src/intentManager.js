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
    var DEFAULT_XMLNS = "http://opendatakit.org/xforms";
    function makeODKXIntentTag (nodeID, path) {
        return {
            androidIntentAppId: path || "",
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

    var intentManager = function () {
        var that = {};
        that.unmappedIntentTags = {};

        that.parseIntentTagsFromHead = function (tags) {
            _.each(tags, function (tagXML) {
                var $tag, tagId, newTag, xmlns;
                $tag = $(tagXML);

                tagId = $tag.attr('id');
                newTag = makeODKXIntentTag(tagId, $tag.attr('class'));

                xmlns = $tag.attr('xmlns:odkx');
                newTag.xmlns = xmlns || newTag.intentXmlns;
                newTag.androidIntentExtra = parseInnerTags($tag, 'extra');
                newTag.androidIntentResponse = parseInnerTags($tag, 'response');
                var unknowns = newTag.unknownAttrs;
                _.each(tagXML.attributes, function (attr) {
                    if (attr.nodeName !== 'id' &&
                        attr.nodeName !== 'class' &&
                        attr.nodeName !== 'xmlns:odkx')
                    {
                        unknowns[attr.nodeName] = attr.nodeValue;
                    }
                });
                that.unmappedIntentTags[tagId] = newTag;
            });
        };

        that.getParsedIntentTagWithID = function (nodeID) {
            var intentTag = null;
            _.each(that.unmappedIntentTags, function (tag) {
                if (tag.nodeID === nodeID) {
                    intentTag = tag;
                }
            });
            return intentTag;
        };

        that.syncMugWithIntent = function (mug) {
            // called when initializing a mug from a parsed form
            if (mug.__className === "AndroidIntent") {
                var nodeID = mug.p.nodeID,
                    tag = that.getParsedIntentTagWithID(nodeID);
                if (!tag) {
                    var path = (mug.intentTag) ? mug.intentTag.androidIntentAppId : null;
                    tag = makeODKXIntentTag(nodeID, path);
                }
                mug.intentTag = tag;
                mug.p.androidIntentAppId = tag.androidIntentAppId;
                mug.p.androidIntentExtra = tag.androidIntentExtra;
                mug.p.androidIntentResponse = tag.androidIntentResponse;
                mug.p.unknownAttrs = tag.unknownAttrs;
                mug.p.intentXmlns = tag.intentXmlns;
                delete that.unmappedIntentTags[tag.nodeID];
            }
        };

        that.writeIntentXML = function (xmlWriter, tree) {
            // make sure any leftover intent tags are still kept
            _.each(that.unmappedIntentTags, function (tag) {
               writeXML(xmlWriter, tag);
            });

            var intents,
                getIntentMugs = function(node) {
                    var mug = node.getValue();
                    if (!mug || node.isRootNode) {
                        return null;
                    }
                    if (mug.options.dataType === 'intent') {
                        return mug;
                    } else {
                        return null;
                    }
                };
            intents = tree.treeMap(getIntentMugs);
            if (intents.length > 0) {
                intents.map(function (intentMug) {
                    writeXML(xmlWriter, intentMug.p);
                });
            }
        };
        return that;
    };

    function androidIntentAppId(mug, options) {
        var widget = widgets.text(mug, options),
            input = widget.input;
        input.attr('placeholder', 'Insert Android Application ID');
        return widget;
    }

    var AndroidIntent = util.extend(mugs.defaultOptions, {
        typeName: 'Android App Callout',
        dataType: 'intent',
        tagName: 'input',
        icon: 'icon-vellum-android-intent',
        isODKOnly: true,
        isTypeChangeable: false,
        intentTag: null,
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
                serialize: function (value, key, mug, data) {
                    data.androidIntentExtra = _.omit(mug.p.androidIntentExtra, "");
                }
            },
            androidIntentResponse: {
                lstring: 'Response',
                visibility: 'visible',
                widget: widgets.baseKeyValue,
                serialize: function (value, key, mug, data) {
                    data.androidIntentResponse = _.omit(mug.p.androidIntentResponse, "");
                }
            },
            unknownAttrs: {
                lstring: 'Unknown',
                visibility: 'hidden',
                presence: 'optional',
                widget: widgets.baseKeyValue,
                serialize: function (value, key, mug, data) {
                    data.unknownAttrs = _.omit(mug.p.unknownAttrs, "");
                }
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
            var manager = intentManager(null);
            this.data.intents.manager = manager;
            this.data.intents.manager.parseIntentTagsFromHead(
                $(xml).find('h\\:head, head')
                    .children("odkx\\:intent, intent"));

            this.__callOld();
        },
        contributeToHeadXML: function (xmlWriter, form) {
            this.__callOld();
            this.data.intents.manager.writeIntentXML(xmlWriter, form.tree);
        },
        handleNewMug: function (mug) {
            var ret = this.__callOld();
            this.data.intents.manager.syncMugWithIntent(mug);
            return ret;
        },
        handleMugParseFinish: function (mug) {
            this.__callOld();
            this.data.intents.manager.syncMugWithIntent(mug);
        },
        getMugTypes: function () {
            var types = this.__callOld();
            types.normal.AndroidIntent = AndroidIntent;
            return types;
        },
        getMainProperties: function () {
            return this.__callOld().concat([
                "androidIntentAppId",
                "androidIntentExtra",
                "androidIntentResponse",
                "unknownAttrs",
                "intentXmlns",
            ]);
        }
    });
});
