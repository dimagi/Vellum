define([
    'jquery',
    'underscore',
    'XMLWriter',
    'vellum/util'
], function (
    $,
    _,
    XMLWriter,
    util
) {
    var createXForm = function (form) {
        var xmlWriter = new XMLWriter('UTF-8', '1.0');
        form.vellum.beforeSerialize();

        xmlWriter.writeStartDocument();
        //Generate header boilerplate up to instance level
        xmlWriter.writeStartElement('h:html');
        write_html_tag_boilerplate(xmlWriter);
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

        form.vellum.contributeToModelXML(xmlWriter);
        
        xmlWriter.writeEndElement(); //CLOSE MODEL

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
        if(!jrm) {
            jrm = "http://dev.commcarehq.org/jr/xforms";
        }

        uuid = form.formUuid; //gets set at parse time/by UI
        if(!uuid) {
            uuid = "http://openrosa.org/formdesigner/" + util.generate_xmlns_uuid();
        }

        xmlWriter.writeAttributeString("xmlns:jrm",jrm);
        xmlWriter.writeAttributeString("xmlns", uuid);
        xmlWriter.writeAttributeString("uiVersion", form.formUIVersion || "1");
        xmlWriter.writeAttributeString("version", form.formVersion || "1");
        xmlWriter.writeAttributeString("name", form.formName || "New Form");
    };

    function write_html_tag_boilerplate (xmlWriter) {
        xmlWriter.writeAttributeString( "xmlns:h", "http://www.w3.org/1999/xhtml" );
        xmlWriter.writeAttributeString( "xmlns:orx", "http://openrosa.org/jr/xforms" );
        xmlWriter.writeAttributeString( "xmlns", "http://www.w3.org/2002/xforms" );
        xmlWriter.writeAttributeString( "xmlns:xsd", "http://www.w3.org/2001/XMLSchema" );
        xmlWriter.writeAttributeString( "xmlns:jr", "http://openrosa.org/javarosa" );
        xmlWriter.writeAttributeString( "xmlns:vellum", "http://commcarehq.org/xforms/vellum" );
    }

    var _writeInstanceAttributes = function (writer, instanceMetadata) {
        for (var attrId in instanceMetadata.attributes) {
            if (instanceMetadata.attributes.hasOwnProperty(attrId)) {
                writer.writeAttributeString(attrId, instanceMetadata.attributes[attrId]);
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
                
                if (dataValue){
                    xmlWriter.writeString(dataValue);
                }
                if (mug.options.writeDataNodeXML) {
                    mug.options.writeDataNodeXML(xmlWriter, mug);
                }
                if (xmlnsAttr){
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
            if(mug && mug.options.getBindList) {
                _.each(mug.options.getBindList(mug), function (attrs) {
                    xmlWriter.writeStartElement('bind');
                    _.each(attrs, function (value, key) {
                        if (value) {
                            xmlWriter.writeAttributeString(key, value);
                        }
                    });
                    xmlWriter.writeEndElement();
                });
            }
            processChildren();
        });
    };

    var createSetValues = function (dataTree, form, xmlWriter) {
        function writeSetValue(setValue) {
            xmlWriter.writeStartElement('setvalue');
            xmlWriter.writeAttributeString('event', setValue.event);
            xmlWriter.writeAttributeString('ref', setValue.ref);
            xmlWriter.writeAttributeString('value', setValue.value);
            xmlWriter.writeEndElement();
        }

        _.each(form.getSetValues(), writeSetValue);

        dataTree.walk(function (mug, nodeID, processChildren) {
            if(mug && mug.options.getSetValues) {
                _.each(mug.options.getSetValues(mug), writeSetValue);
            }
            processChildren();
        });
    };

    var createControlBlock = function (form, xmlWriter) {
        form.tree.walk(function (mug, nodeID, processChildren) {
            if(!mug) {
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
                var absPath = form.getAbsolutePath(mug);
                xmlWriter.writeAttributeString(opts.writeControlRefAttr, absPath);
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
        if (labelItext) {
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

    return {
        createXForm: createXForm
    };
});
