/*
 * Android app callout module
 *
 * Can be either templated or custom.
 *
 * Templated means that there is only a dropdown, options are defined by
 * the options passed in to the vellum instance
 *
 * Custom intents has the same dropdown, but also has an input used to define
 * an app id
 */
define([
    'vellum/mugs',
    'vellum/widgets',
    'vellum/util',
    'vellum/xml',
    'underscore',
    'jquery',
    'vellum/core',
], function (
    mugs,
    widgets,
    util,
    xml,
    _,
    $,
) {
    
    var DEFAULT_XMLNS = "http://opendatakit.org/xforms",
        INTENT_SPECIFIC_SPECS = [
            "androidIntentAppId",
            "docTemplate",
            "androidIntentExtra",
            "androidIntentResponse",
            "unknownAttributes",
            "intentXmlns",
        ],
        intentTemplates;

    function makeODKXIntentTag(nodeID, appID) {
        return {
            androidIntentAppId: appID || "",
            intentXmlns: DEFAULT_XMLNS,
            androidIntentExtra: {},
            androidIntentResponse: {},
            unknownAttributes: {},
            nodeID: nodeID,
        };
    }

    function intentAppIdWidget(mug, options) {
        options.defaultOptions = intentTemplates;

        var features = options.vellum.opts().features,
            widget;

        if (noIntents(features) || onlyTemplatedIntents(features)) {
            widget = widgets.dropdown(mug, options);
        } else {
            widget = widgets.dropdownWithInput(mug, options);
        }

        return widget;
    }

    function printTemplateWidget(mug, options) {
        var widget = widgets.abstractMediaWidget(mug, options);
        widget.getBaseMediaPath = function () {
            return "jr://file/commcare/text/" + mug.p.nodeID;
        };
        return widget;
    }

    var parseInnerTags = function (tagObj, innerTag) {
        var store = {};
        _.each(tagObj.find(innerTag), function (inner) {
            var $innerTag = $(inner),
                key = $innerTag.xmlAttr('key'),
                value;
            value = $innerTag.xmlAttr('ref');
            if (Object.prototype.hasOwnProperty.call(store, key)) {
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

    var writeInnerTagXML = function (xmlWriter, innerTag, store, mug) {
        if (store) {
            _.each(store, function (ref, key) {
                if (key) {
                    _.each(_.isArray(ref) ? ref : [ref], function (ref) {
                        xmlWriter.writeStartElement(innerTag);
                        xmlWriter.writeAttributeString("key", key);
                        if (mug) {
                            util.writeHashtags(xmlWriter, "ref", ref, mug);
                        } else {
                            xmlWriter.writeAttributeString("ref", ref);
                        }
                        xmlWriter.writeEndElement();
                    });
                }
            });
        }
    };

    function writeXML(xmlWriter, properties, mug) {
        var intentTemplate = findIntentTemplate(properties.androidIntentAppId);
        xmlWriter.writeStartElement('odkx:intent');
        xmlWriter.writeAttributeString("xmlns:odkx", properties.intentXmlns);
        xmlWriter.writeAttributeString("id", properties.nodeID);
        xmlWriter.writeAttributeString("class", properties.androidIntentAppId);
        if (intentTemplate && intentTemplate.type) {
            xmlWriter.writeAttributeString("type", intentTemplate.type);
        }
        _.each(properties.unknownAttributes, function (value, name) {
            xmlWriter.writeAttributeString(name, value);
        });
        writeInnerTagXML(xmlWriter, 'extra', properties.androidIntentExtra, mug);
        if (properties.docTemplate) {
            writeInnerTagXML(xmlWriter, 'extra', {
                'cc:print_template_reference': "'" + properties.docTemplate + "'",
            });
        }
        writeInnerTagXML(xmlWriter, 'response', properties.androidIntentResponse, mug);
        xmlWriter.writeEndElement('odkx:intent');
    }

    function parseIntentTags(tags) {
        var intentTags = {};

        _.each(tags, function (tagXML) {
            var $tag, tagId, newTag;
            $tag = $(tagXML);

            tagId = $tag.xmlAttr('id');
            newTag = makeODKXIntentTag(tagId, $tag.xmlAttr('class'));

            newTag.xmlns = $tag.xmlAttr('xmlns:odkx') || newTag.intentXmlns;
            newTag.androidIntentExtra = parseInnerTags($tag, 'extra');
            newTag.androidIntentResponse = parseInnerTags($tag, 'response');

            _.chain(tagXML.attributes)
                .filter(function (attr) {
                    return !_.contains(['id', 'class', 'xmlns:odk'], attr.nodeName);
                })
                .each(function (attr) {
                    newTag.unknownAttributes[attr.nodeName] = attr.nodeValue;
                });

            intentTags[tagId] = newTag;
        });

        return intentTags;
    }

    function syncMugWithIntent(tags, mug) {
        // called when initializing a new mug or when parsing a form
        if (mug.__className === "AndroidIntent" ||
            mug.__className === "PrintIntent") {
            var nodeID = mug.p.nodeID,
                tag = Object.prototype.hasOwnProperty.call(tags, nodeID) ? tags[nodeID] : makeODKXIntentTag(nodeID);

            _.each(INTENT_SPECIFIC_SPECS, function (key) {
                if (!mug.p[key]) {
                    mug.p[key] = tag[key];
                }
            });

            delete tags[tag.nodeID];
        }

        if (mug.p.androidIntentAppId === "org.commcare.dalvik.action.PRINT") {
            mug.form.changeMugType(mug, 'PrintIntent');
        } else if (!mug.p.androidIntentAppId) {
            mug.p.androidIntentAppId = intentTemplates[0].value;
        }

        if (mug.__className === "PrintIntent") {
            if (mug.p.androidIntentExtra['cc:print_template_reference']) {
                mug.p.docTemplate = mug.p.androidIntentExtra['cc:print_template_reference'].replace(/^'|'$/g, '');
                delete mug.p.androidIntentExtra['cc:print_template_reference'];
            }
        }
    }

    function writeIntentXML(unmappedIntentTags, xmlWriter, tree) {
        // make sure any leftover intent tags are still kept
        _.each(unmappedIntentTags, function (tag) {
            writeXML(xmlWriter, tag);
        });

        tree.treeMap(function (node) {
            var mug = node.getValue();
            if (mug && mug.options.dataType === 'intent') {
                writeXML(xmlWriter, mug.p, mug);
            }
        });
    }

    function serializeAttrs(value, key, mug, data) {
        data[key] = _.clone(mug.p[key]);
        if (data[key][""] === "") {
            delete data[key][""];
        }
    }

    var AndroidIntent = util.extend(mugs.defaultOptions, {
        typeName: gettext('Android App Callout'),
        dataType: 'intent',
        tagName: 'input',
        icon: 'fcc fcc-fd-android-intent',
        isTypeChangeable: false,
        init: function (mug) {
            mug.p.intentXmlns = mug.p.intentXmlns || DEFAULT_XMLNS;
        },
        spec: {
            androidIntentAppId: {
                lstring: gettext('External App'),
                visibility: 'visible',
                widget: intentAppIdWidget,
                noCustom: true,
                placeholder: gettext('Insert Android Application ID'),
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
                            var attr = keys[0], 
                                key = keys[1];
                            if (!_.isEmpty(data.intent[key])) {
                                mug.p[attr] = data.intent[key];
                            }
                        });
                    } else {
                        mug.p[key] = data[key];
                    }
                },
                validationFunc: function (mug) {
                    function valueNotInIntentTemplates(val) {
                        return _.chain(intentTemplates)
                            .map(function (template) { return template.value; })
                            .find(function (appId) { return appId === val; })
                            .isUndefined()
                            .value();
                    }
                    var opts = mug.form.vellum.opts(),
                        features = opts.features,
                        link = opts.core.externalLinks.changeSubscription,
                        changesub = gettext("change your subscription");
                    link = link ? "[" + changesub + "](" + link + ")" : changesub;
                    if (noIntents(features)) {
                        return util.format(gettext(
                            "You no longer have access to built in or external integration in your application.\n\n" +
                            "Built in integrations are available on the Pro plan and higher. " +
                            "External integrations are available on the Advanced plan and higher. " +
                            "Before you can make a new version of your application, " +
                            "you must {link} or delete this question."), {link: link});
                    } else if (onlyTemplatedIntents(features) &&
                               valueNotInIntentTemplates(mug.p.androidIntentAppId)) {
                        return util.format(gettext(
                            "Your subscription only has access to built-in integration.\n\n" +
                            "External integrations are available on the Advanced plan and higher. " +
                            "Before you can make a new version of your application, " +
                            "you must {link} or delete this question."), {link: link});
                    }

                    // Validate that IDs are unique across app callouts
                    var intents = _.filter(mug.form.getMugList(), function (m) {
                        return m.p.androidIntentAppId;
                    });
                    if (intents.length > 1) {
                        var idCounts = _.countBy(intents, function (i) {
                            return i.p.nodeID;
                        });
                        _.each(intents, function (i) {
                            var changed = false;
                            if (idCounts[i.p.nodeID] > 1) {
                                changed = i.messages.update("nodeID", {
                                    key: "intent-nodeID-duplicate",
                                    level: i.ERROR,
                                    message: gettext("Android app callouts of the same type must have different question ids."),
                                });
                            } else {
                                changed = i.dropMessage("nodeID", "intent-nodeID-duplicate");
                            }
                            if (changed) {
                                i.fire({type: "messages-changed", mug: i});
                            }
                        });
                    }

                    return 'pass';
                },
            },
            androidIntentExtra: {
                lstring: gettext('Extra'),
                visibility: 'visible',
                widget: widgets.baseKeyValue,
                serialize: serializeAttrs,
            },
            androidIntentResponse: {
                lstring: gettext('Response'),
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
                lstring: gettext("Special Intent XMLNS attribute"),
            },
        },
        getAppearanceAttribute: function (mug) {
            return 'intent:' + mug.p.nodeID;
        },
    });

    var PrintIntent = util.extend(AndroidIntent, {
        typeName: gettext('Print'),
        icon: 'fa fa-print',
        init: function (mug, form) {
            AndroidIntent.init(mug, form);
            mug.p.androidIntentAppId = "org.commcare.dalvik.action.PRINT";
        },
        spec: {
            docTemplate: {
                lstring: gettext('Document Template'),
                visibility: 'visible',
                widget: printTemplateWidget,
            },
            androidIntentAppId: { visibility: 'hidden' },
        },
    });

    function noIntents(features) {
        return !features.custom_intents && !features.templated_intents;
    }

    function onlyTemplatedIntents(features) {
        return features.templated_intents && !features.custom_intents;
    }

    function intents(features) {
        return !noIntents(features);
    }

    function findIntentTemplate(intentId) {
        return _.find(intentTemplates, function (intent) {
            return intent.value === intentId;
        });
    }

    $.vellum.plugin("intents", {}, {
        init: function () {
            var opts = this.opts().intents;
            intentTemplates = _.map(opts && opts.templates, function (temp) {
                return {value: temp.id, text: temp.name, type: temp.mime};
            });
        },
        loadXML: function (xmlString) {
            this.data.intents.unmappedIntentTags = parseIntentTags(
                xml.parseXML(xmlString)
                    .find('h\\:head, head')
                    .children("odkx\\:intent, intent"),
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
            if (intents(this.opts().features)) {
                ret.push("AndroidIntent");
                if (this.opts().features.printing) {
                    ret.push("PrintIntent");
                }
            }
            return ret;
        },
        getMainProperties: function () {
            var ret = this.__callOld().concat(INTENT_SPECIFIC_SPECS);
            if (onlyTemplatedIntents(this.opts().features)) {
                ret = _.without(ret, "androidIntentExtra", "androidIntentResponse");
            }
            return ret;
        },
    });
});
