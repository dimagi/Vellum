define([
    'jquery',
    'underscore',
    'XMLWriter',
    'vellum/util',
], function (
    $,
    _,
    XMLWriter,
    util,
) {
    var createXForm = function (form) {
        var xmlWriter = new XMLWriter('UTF-8', '1.0');
        form.vellum.beforeSerialize();

        xmlWriter.writeStartDocument();
        //Generate header boilerplate up to instance level
        xmlWriter.writeStartElement('h:html');
        write_html_tag_boilerplate(xmlWriter, form);
        xmlWriter.writeStartElement('h:head');
        xmlWriter.writeStartElement('h:title');
        xmlWriter.writeString(form.formName);
        xmlWriter.writeEndElement();       //CLOSE TITLE

        xmlWriter.writeStartElement('model');
        xmlWriter.writeStartElement('instance');
        _writeInstanceAttributes(xmlWriter, form.instanceMetadata[0]);

        var dataTree = form.dataTree();
        createDataBlock(form, dataTree, xmlWriter);
        xmlWriter.writeEndElement(); //CLOSE MAIN INSTANCE
        
        // other instances
        for (var i = 1; i < form.instanceMetadata.length; i++) {
            _writeInstance(xmlWriter, form.instanceMetadata[i]);
        }
        
        createBindList(dataTree, xmlWriter);
        
        createSetValues(dataTree, form, xmlWriter);

        form.vellum.contributeToModelXML(xmlWriter, form);
        
        xmlWriter.writeEndElement(); //CLOSE MODEL

        var hashtags = form.knownExternalReferences();
        if (form.richText && !_.isEmpty(hashtags)) {
            xmlWriter.writeStartElement('vellum:hashtags');
            xmlWriter.writeString(JSON.stringify(hashtags));
            xmlWriter.writeEndElement();
        }
        var transforms = form.knownHashtagTransforms();
        if (form.richText && !_.isEmpty(hashtags)) {
            xmlWriter.writeStartElement('vellum:hashtagTransforms');
            xmlWriter.writeString(JSON.stringify(transforms));
            xmlWriter.writeEndElement();
        }

        form.vellum.contributeToHeadXML(xmlWriter, form);

        xmlWriter.writeEndElement(); //CLOSE HEAD

        xmlWriter.writeStartElement('h:body');
        createControlBlock(form, xmlWriter);
        xmlWriter.writeEndElement(); //CLOSE BODY
        xmlWriter.writeEndElement(); //CLOSE HTML
        xmlWriter.writeEndDocument(); //CLOSE DOCUMENT
        form.vellum.afterSerialize();

        return xmlWriter.flush();
    };

    var createModelHeader = function (form, xmlWriter) {
        var uuid, jrm;
        //assume we're currently pointed at the opening date block tag
        //e.g. <model><instance><data> <--- we're at <data> now.

        jrm = form.formJRM;
        if (!jrm) {
            jrm = "http://dev.commcarehq.org/jr/xforms";
        }

        uuid = form.formUuid;
        if (!uuid) {
            uuid = "http://openrosa.org/formdesigner/" + util.generate_xmlns_uuid();
        }

        xmlWriter.writeAttributeString("xmlns:jrm",jrm);
        xmlWriter.writeAttributeString("xmlns", uuid);
        xmlWriter.writeAttributeString("uiVersion", form.formUIVersion || "1");
        xmlWriter.writeAttributeString("version", form.formVersion || "1");
        xmlWriter.writeAttributeString("name", form.formName || gettext("New Form"));
    };

    function write_html_tag_boilerplate(xmlWriter, form) {
        xmlWriter.writeAttributeString("xmlns:h", "http://www.w3.org/1999/xhtml");
        xmlWriter.writeAttributeString("xmlns:orx", "http://openrosa.org/jr/xforms");
        xmlWriter.writeAttributeString("xmlns", "http://www.w3.org/2002/xforms");
        xmlWriter.writeAttributeString("xmlns:xsd", "http://www.w3.org/2001/XMLSchema");
        xmlWriter.writeAttributeString("xmlns:jr", "http://openrosa.org/javarosa");
        xmlWriter.writeAttributeString("xmlns:vellum", "http://commcarehq.org/xforms/vellum");
        var ignore = [];
        if (form.mayDisableRichText && !form.richText) {
            ignore.push('richText');
        }
        if (form.noMarkdown) {
            ignore.push('markdown');
        }
        if (ignore.length) {
            xmlWriter.writeAttributeString("vellum:ignore", ignore.join(" "));
        }
    }

    var _writeInstanceAttributes = function (writer, instanceMetadata) {
        var attrs = instanceMetadata.attributes;
        for (var attrId in attrs) {
            if (attrs.hasOwnProperty(attrId) && attrs[attrId]) {
                writer.writeAttributeString(attrId, attrs[attrId]);
            }
        }
    };

    var _writeInstance = function (writer, instanceMetadata) {
        if (!instanceMetadata.internal) {
            writer.writeStartElement('instance');
            _writeInstanceAttributes(writer, instanceMetadata);
            if (instanceMetadata.children.length) {
                // seriously, this is what you have to do
                // HT: http://stackoverflow.com/questions/652763/jquery-object-to-string
                writer.writeXML($('<div>').append(instanceMetadata.children).clone().html());
            }
            writer.writeEndElement();
        }
    };

    var createDataBlock = function (form, dataTree, xmlWriter) {
        dataTree.walk(function (mug, nodeID, processChildren) {
            if (mug && mug.options.getTagName) {
                nodeID = mug.options.getTagName(mug, nodeID);
                if (nodeID === null) {
                    return;
                }
            }
            xmlWriter.writeStartElement(nodeID);
            if (!mug) {
                // tree root
                createModelHeader(form, xmlWriter);
            } else {
                var rawDataAttributes = mug.p.rawDataAttributes,
                    extra = null;
                if (mug.options.getExtraDataAttributes) {
                    // call this early so it can munge raw attributes
                    extra = mug.options.getExtraDataAttributes(mug);
                }
                // Write any custom attributes first
                for (var k in rawDataAttributes) {
                    if (rawDataAttributes.hasOwnProperty(k)) {
                        xmlWriter.writeAttributeString(k, rawDataAttributes[k]);
                    }
                }

                var dataValue = mug.p.dataValue,
                    xmlnsAttr = mug.p.xmlnsAttr;
                
                if (dataValue) {
                    xmlWriter.writeString(dataValue);
                }
                if (mug.options.writeDataNodeXML) {
                    mug.options.writeDataNodeXML(xmlWriter, mug);
                }
                if (mug.p.comment) {
                    xmlWriter.writeAttributeString('vellum:comment', mug.p.comment);
                }
                if (xmlnsAttr) {
                    xmlWriter.writeAttributeString("xmlns", xmlnsAttr);
                }
                if (extra) {
                    for (k in extra) {
                        if (extra.hasOwnProperty(k)) {
                            xmlWriter.writeAttributeString(k, extra[k]);
                        }
                    }
                }
            }
            processChildren(mug && mug.options.dataChildFilter);
            xmlWriter.writeEndElement();
        });
    };

    var createBindList = function (dataTree, xmlWriter) {
        dataTree.walk(function (mug, nodeID, processChildren) {
            if (mug && mug.options.getBindList) {
                _.each(mug.options.getBindList(mug), function (attrs) {
                    xmlWriter.writeStartElement('bind');
                    _.each(attrs, function (value, key) {
                        if (value) {
                            util.writeHashtags(xmlWriter, key, value, mug);
                        }
                    });
                    xmlWriter.writeEndElement();
                });
            }
            processChildren();
        });
    };

    var createSetValues = function (dataTree, form, xmlWriter) {
        function writeSetValue(setValue, mug) {
            xmlWriter.writeStartElement('setvalue');
            xmlWriter.writeAttributeString('event', setValue.event);
            util.writeHashtags(xmlWriter, 'ref', setValue.ref, mug);
            util.writeHashtags(xmlWriter, 'value', setValue.value, mug);
            xmlWriter.writeEndElement();
        }

        _.each(form.getSetValues(), function (sv) { writeSetValue(sv, {form: form}); });

        dataTree.walk(function (mug, nodeID, processChildren) {
            if (mug && mug.options.getSetValues) {
                _.each(mug.options.getSetValues(mug), function (setValue) {
                    writeSetValue(setValue, mug);
                });
            }
            processChildren();
        });
    };

    var createControlBlock = function (form, xmlWriter) {
        form.tree.walk(function (mug, nodeID, processChildren) {
            if (!mug) {
                // root node
                processChildren();
                return;
            }

            var opts = mug.options;
            if (opts.isDataOnly) {
                return;
            }
            if (opts.writesOnlyCustomXML) {
                opts.writeCustomXML(xmlWriter, mug);
                return;
            }

            xmlWriter.writeStartElement(mug.options.tagName.toLowerCase());
            if (opts.writeControlLabel) {
                createLabel(xmlWriter, mug);
            }
            if (opts.writeControlHint) {
                createHint(xmlWriter, mug);
            }
            if (opts.writeControlHelp) {
                createHelp(xmlWriter, mug);
            }
            if (opts.writeControlAlert) {
                createAlert(xmlWriter, mug);
            }
            if (opts.writeRepeatItexts) {
                createRepeatButtonItexts(xmlWriter, mug);
            }
            // Write custom attributes first
            var attributes = mug.p.rawControlAttributes;
            for (var k in attributes) {
                if (attributes.hasOwnProperty(k)) {
                    xmlWriter.writeAttributeString(k, attributes[k]);
                }
            }
            if (opts.writeCustomXML) {
                opts.writeCustomXML(xmlWriter, mug);
            }
            if (opts.writeControlRefAttr) {
                var hashtag = mug.hashtagPath;
                util.writeHashtags(xmlWriter, opts.writeControlRefAttr, hashtag, mug);
            }
            var appearanceAttr = mug.getAppearanceAttribute();
            if (appearanceAttr) {
                xmlWriter.writeAttributeString("appearance", appearanceAttr);
            }

            processChildren(opts.controlChildFilter);

            xmlWriter.writeEndElement();
        });
    };

    /**
     * Creates the label tag inside of a control Element in the xform
     */
    function createLabel(xmlWriter, mug) {
        var labelItext = mug.p.labelItext,
            labelRef;
        if (labelItext && labelItext.id) {
            labelRef = "jr:itext('" + labelItext.id + "')";
            // iID is optional so by extension Itext is optional.
            if (labelItext.isEmpty() &&
                    mug.getPresence("labelItext") === 'optional') {
                labelRef = '';
            }
        }
        if (labelRef || mug.p.label) {
            xmlWriter.writeStartElement('label');
            if (labelRef) {
                xmlWriter.writeAttributeString('ref', labelRef);
            }
            if (mug.p.label) {
                xmlWriter.writeString(mug.p.label);
            }
            xmlWriter.writeEndElement(); // close label
        }
    }

    function createHint(xmlWriter, mug) {
        var hintLabel = mug.p.hintLabel,
            hintItext = mug.p.hintItext;
        if (hintLabel || (hintItext && !hintItext.isEmpty())) {
            xmlWriter.writeStartElement('hint');
            if (hintLabel) {
                xmlWriter.writeString(hintLabel);
            }
            if (hintItext && !hintItext.isEmpty()) {
                var ref = "jr:itext('" + hintItext.id + "')";
                xmlWriter.writeAttributeString('ref', ref);
            }
            xmlWriter.writeEndElement();
        }
    }

    function createHelp(xmlWriter, mug) {
        var helpItext = mug.p.helpItext;
        if (helpItext && !helpItext.isEmpty()) {
            xmlWriter.writeStartElement('help');
            var helpRef = "jr:itext('" + helpItext.id + "')";
            xmlWriter.writeAttributeString('ref', helpRef);
            xmlWriter.writeEndElement();
        }
    }

    function createAlert(xmlWriter, mug) {
        var alertItext = mug.p.constraintMsgItext;
        if (alertItext && !alertItext.isEmpty()) {
            xmlWriter.writeStartElement('alert');
            var alertRef = "jr:itext('" + alertItext.id + "')";
            xmlWriter.writeAttributeString('ref', alertRef);
            xmlWriter.writeEndElement();
        }
    }

    function createRepeatButtonItexts(xmlWriter, mug) {
        var addEmptyCaptionItext = mug.p.addEmptyCaptionItext;
        if (addEmptyCaptionItext && !addEmptyCaptionItext.isEmpty()) {
            xmlWriter.writeStartElement('jr:addEmptyCaption');
            var addEmptyCaptionRef = "jr:itext('" + addEmptyCaptionItext.id + "')";
            xmlWriter.writeAttributeString('ref', addEmptyCaptionRef);
            xmlWriter.writeEndElement();
        }
        var addCaptionItext = mug.p.addCaptionItext;
        if (addCaptionItext && !addCaptionItext.isEmpty()) {
            xmlWriter.writeStartElement('jr:addCaption');
            var addCaptionRef = "jr:itext('" + addCaptionItext.id + "')";
            xmlWriter.writeAttributeString('ref', addCaptionRef);
            xmlWriter.writeEndElement();
        }
    }


    return {
        createXForm: createXForm,
    };
});
