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
    function makeODKXIntentTag (form, nodeID, path) {
        return new ODKXIntentTag(form, {
            path: path || "",
            xmlns: DEFAULT_XMLNS,
            extra: {},
            response: {},
            unknownAttributes: {},
            initialNodeID: nodeID
        });
    }
    function ODKXIntentTag(form, data) {
        this._form = form;
        this._data = data || {};
    }
    ODKXIntentTag.prototype = {
        setAttr: function (name, val) {
            this._data[name] = val;
            if (this._form) {
                this._form.fire({
                    type: 'change'
                });
            }
        },
        getAttr: function (name, default_) {
            if (name in this._data) {
                return this._data[name];
            } else {
                return default_;
            }
        }
    };
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
    ODKXIntentTag.prototype.writeXML = function (xmlWriter, mug) {
        xmlWriter.writeStartElement('odkx:intent');
        xmlWriter.writeAttributeString("xmlns:odkx", mug ? mug.p.intentXmlns : this.getAttr('xmlns'));
        xmlWriter.writeAttributeString("id", mug ? mug.p.nodeID : this.getAttr('initialNodeID'));
        xmlWriter.writeAttributeString("class", mug ? mug.p.androidIntentAppId : this.getAttr('path'));
        var unknown = mug ? mug.p.unknownAttrs : this.getAttr('unknownAttributes');
        _.each(unknown, function (value, name) {
            xmlWriter.writeAttributeString(name, value);
        });
        writeInnerTagXML(xmlWriter, 'extra', mug ? mug.p.androidIntentExtra : this.getAttr('extra'));
        writeInnerTagXML(xmlWriter, 'response', mug ? mug.p.androidIntentResponse : this.getAttr('response'));
        xmlWriter.writeEndElement('odkx:intent');
    };

    var intentManager = function () {
        var that = {};
        that.unmappedIntentTags = {};

        that.parseIntentTagsFromHead = function (tags) {
            _.each(tags, function (tagXML) {
                var $tag, tagId, newTag, xmlns;
                $tag = $(tagXML);

                tagId = $tag.attr('id');
                newTag = makeODKXIntentTag(null, tagId, $tag.attr('class'));

                xmlns = $tag.attr('xmlns:odkx');
                newTag.setAttr('xmlns', xmlns || newTag.getAttr('xmlns'));
                newTag.setAttr('extra', parseInnerTags($tag, 'extra'));
                newTag.setAttr('response', parseInnerTags($tag, 'response'));
                var unknowns = newTag.getAttr('unknownAttributes');
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
                if (tag.getAttr('initialNodeID') === nodeID) {
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
                    var path = (mug.intentTag) ? mug.intentTag.getAttr('path') : null;
                    tag = makeODKXIntentTag(mug.form, nodeID, path);
                }
                mug.intentTag = tag;
                mug.intentTag._form = mug.form;
                mug.p.androidIntentAppId = tag.getAttr('path');
                mug.p.androidIntentExtra = tag.getAttr('extra');
                mug.p.androidIntentResponse = tag.getAttr('response');
                mug.p.unknownAttrs = tag.getAttr('unknownAttributes');
                mug.p.intentXmlns = tag.getAttr('xmlns');
                delete that.unmappedIntentTags[tag.getAttr('initialNodeID')];
            }
        };

        that.writeIntentXML = function (xmlWriter, tree) {
            // make sure any leftover intent tags are still kept
            _.each(that.unmappedIntentTags, function (tag) {
               tag.writeXML(xmlWriter, null);
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
                    intentMug.intentTag.writeXML(xmlWriter, intentMug);
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
