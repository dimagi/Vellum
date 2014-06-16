// todo: make this a proper plugin

define([
    'vellum/mugs',
    'vellum/widgets',
    'underscore',
    'jquery'
], function (
    mugs,
    widgets,
    _,
    $
) {
    "use strict";
    function makeODKXIntentTag (form, nodeID, path) {
        return new ODKXIntentTag(form, {
            path: path || "",
            xmlns: "http://opendatakit.org/xforms",
            extra: {},
            response: {},
            initialNodeID: nodeID
        });
    }
    function ODKXIntentTag(form, data) {
        mugs.BoundPropertyMap.call(this, form, data);
    }
    ODKXIntentTag.prototype = Object.create(mugs.BoundPropertyMap.prototype);
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
        writeInnerTagXML(xmlWriter, 'extra', this.getAttr('extra'));
        writeInnerTagXML(xmlWriter, 'response', this.getAttr('response'));
        xmlWriter.writeEndElement('odkx:intent');
    };

    var IntentManager = function (form) {
        var that = {};
        that.unmappedIntentTags = {};

        that.parseIntentTagsFromHead = function (tags) {
            _.each(tags, function (tagXML) {
                var $tag, tagId, newTag, xmlns;
                $tag = $(tagXML);

                tagId = $tag.attr('id');
                newTag = makeODKXIntentTag(form, tagId, $tag.attr('class'));

                xmlns = $tag.attr('xmlns:odkx');
                newTag.setAttr('xmlns', xmlns || newTag.getAttr('xmlns'));
                newTag.setAttr('extra', parseInnerTags($tag, 'extra'));
                newTag.setAttr('response', parseInnerTags($tag, 'response'));
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
                var nodeID = mug.dataElement.nodeID,
                    tag = that.getParsedIntentTagWithID(nodeID);
                if (!tag) {
                    var path = (mug.intentTag) ? mug.intentTag.getAttr('path') : null;
                    tag = makeODKXIntentTag(form, nodeID, path);
                }
                mug.intentTag = tag;
                delete that.unmappedIntentTags[tag.getAttr('initialNodeID')];
            }
        };

        that.writeIntentXML = function (xmlWriter, dataTree) {
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
                    if (mug.bindElement && mug.bindElement.dataType === 'intent') {
                        return mug;
                    } else {
                        return null;
                    }
                };
            intents = dataTree.treeMap(getIntentMugs);
            if (intents.length > 0) {
                xmlWriter.writeComment('Intents inserted by Vellum:');
                intents.map(function (intentMug) {
                    intentMug.intentTag.writeXML(xmlWriter, intentMug.dataElement.nodeID);
                });
            }
        };
        return that;
    };
    
    widgets.androidIntentAppId = function (mug, options) {
        options.id = "intent-app-id";
        var widget = widgets.base(mug, options);

        widget.definition = {};
        widget.currentValue = (mug.intentTag) ? mug.intentTag.getAttr('path') : "";
        widget.propName = "Intent ID";
        
        var input = $("<input />")
            .attr("name", widget.id)
            .attr("type", "text")
            .attr('placeholder', 'Insert Android Application ID');

        widget.getControl = function () {
            if (widget.isDisabled()) {
                input.prop('disabled', true);
            }
            return input;
        };

        widget.setValue = function (value) {
            input.val(value);
        };

        widget.getValue = function() {
            return input.val();
        };

        widget.updateValue = function () {
            widget.mug.intentTag.setAttr('path', widget.getValue());
        };

        input.bind("change keyup", widget.updateValue);
        return widget;
    };

    widgets.androidIntentExtra = function (mug, options) {
        options.id = "intent-extra";
        var widget = widgets.baseKeyValue(mug, options);
        widget.currentValue = (mug.intentTag) ? mug.intentTag.getAttr('extra') : {};
        widget.propName = "Extra";

        widget.save = function () {
            if (widget.mug.intentTag) {
                widget.mug.intentTag.setAttr('extra', widget.getValidValues());
            }
        };

        return widget;
    };

    widgets.androidIntentResponse = function (mug, options) {
        options.id = "intent-response";
        var widget = widgets.baseKeyValue(mug, options);
        widget.currentValue = (mug.intentTag) ? mug.intentTag.getAttr('response') : {};
        widget.propName = "Response";

        widget.save = function () {
            if (widget.mug.intentTag) {
                widget.mug.intentTag.setAttr('response', widget.getValidValues());
            }
        };

        return widget;
    };


    return {
        IntentManager: IntentManager
    };
});
