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
        util.BoundPropertyMap.call(this, form, data);
    }
    ODKXIntentTag.prototype = Object.create(util.BoundPropertyMap.prototype);
    ODKXIntentTag.prototype.clone = function () {
        return new ODKXIntentTag(this._form, this._data);
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
    ODKXIntentTag.prototype.writeXML = function (xmlWriter, currentNodeID) {
        xmlWriter.writeStartElement('odkx:intent');
        xmlWriter.writeAttributeString("xmlns:odkx", this.getAttr('xmlns'));
        xmlWriter.writeAttributeString("id", currentNodeID || this.getAttr('initialNodeID'));
        xmlWriter.writeAttributeString("class", this.getAttr('path'));
        _.each(this.getAttr('unknownAttributes'), function (value, name) {
            xmlWriter.writeAttributeString(name, value);
        });
        writeInnerTagXML(xmlWriter, 'extra', this.getAttr('extra'));
        writeInnerTagXML(xmlWriter, 'response', this.getAttr('response'));
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
                    intentMug.intentTag.writeXML(
                        xmlWriter, intentMug.p.nodeID);
                });
            }
        };
        return that;
    };

    function androidIntentAppId(mug, options) {
        var widget = widgets.text(mug, options),
            input = widget.input;

        input.attr('placeholder', 'Insert Android Application ID');
        widget.currentValue = (mug.intentTag) ? mug.intentTag.getAttr('path') : "";

        widget.updateValue = function () {
            widget.mug.intentTag.setAttr('path', widget.getValue());
        };

        return widget;
    }

    function androidIntentExtra(mug, options) {
        options.id = "intent-extra";
        var widget = widgets.baseKeyValue(mug, options);
        widget.currentValue = (mug.intentTag) ? mug.intentTag.getAttr('extra') : {};
        widget.definition = mug.p.getDefinition('androidIntentExtra');

        widget.save = function () {
            if (widget.mug.intentTag) {
                widget.mug.intentTag.setAttr('extra', widget.getValidValues());
            }
        };

        return widget;
    }

    function androidIntentResponse(mug, options) {
        options.id = "intent-response";
        var widget = widgets.baseKeyValue(mug, options);
        widget.currentValue = (mug.intentTag) ? mug.intentTag.getAttr('response') : {};
        widget.definition = mug.p.getDefinition('androidIntentResponse');

        widget.save = function () {
            if (widget.mug.intentTag) {
                widget.mug.intentTag.setAttr('response', widget.getValidValues());
            }
        };

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
        },
        spec: {
            androidIntentAppId: {
                lstring: 'Intent ID',
                visibility: 'visible',
                widget: androidIntentAppId,
                serialize: function (value, key, mug, data) {
                    function dropBlank(item) {
                        item = _.clone(item);
                        if (item[""] === "") {
                            delete item[""];
                        }
                        return item;
                    }
                    var keys = {
                            "path": _.identity,
                            "xmlns": function (v) { return v !== DEFAULT_XMLNS ? v : null; },
                            "extra": dropBlank,
                            "response": dropBlank,
                            "unknownAttributes": _.identity,
                        },
                        tag = mug.intentTag,
                        values = {};
                    if (tag) {
                        _.each(keys, function (valueOf, attr) {
                            var val = valueOf(tag.getAttr(attr));
                            if (!_.isEmpty(val)) {
                                values[attr] = val;
                            }
                        });
                        if (!_.isEmpty(values)) {
                            data.intent = values;
                        }
                    }
                },
                deserialize: function (data, key, mug) {
                    var tag = makeODKXIntentTag(mug.form, mug.p.nodeID, null);
                    if (data.intent) {
                        _.each([
                            "path",
                            "xmlns",
                            "extra",
                            "response",
                            "unknownAttributes"
                        ], function (attr) {
                            if (!_.isEmpty(data.intent[attr])) {
                                tag.setAttr(attr, data.intent[attr]);
                            }
                        });
                    }
                    mug.intentTag = tag;
                }
            },
            androidIntentExtra: {
                lstring: 'Extra',
                visibility: 'visible',
                widget: androidIntentExtra
            },
            androidIntentResponse: {
                lstring: 'Response',
                visibility: 'visible',
                widget: androidIntentResponse
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
                "androidIntentResponse"
            ]);
        }
    });
});
