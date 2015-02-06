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
        
        createDataBlock(form, xmlWriter);
        xmlWriter.writeEndElement(); //CLOSE MAIN INSTANCE
        
        // other instances
        for (var i = 1; i < form.instanceMetadata.length; i++) {
            _writeInstance(xmlWriter, form.instanceMetadata[i], true);
        }
        
        createBindList(form, xmlWriter);
        
        _.each(form.getSetValues(), function (setValue) {
            xmlWriter.writeStartElement('setvalue');
            xmlWriter.writeAttributeString('event', setValue.event);
            xmlWriter.writeAttributeString('ref', setValue.ref);
            xmlWriter.writeAttributeString('value', setValue.value);
            xmlWriter.writeEndElement();
        });

        form.vellum.contributeToModelXML(xmlWriter);
        
        xmlWriter.writeEndElement(); //CLOSE MODEL

        form.vellum.contributeToHeadXML(xmlWriter, form);

        xmlWriter.writeEndElement(); //CLOSE HEAD

        xmlWriter.writeStartElement('h:body');
        createControlBlock(form, xmlWriter);
        xmlWriter.writeEndElement(); //CLOSE BODY
        xmlWriter.writeEndElement(); //CLOSE HTML
        xmlWriter.writeEndDocument(); //CLOSE DOCUMENT

        var ret = xmlWriter.flush();

        return ret;
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
    
    var _writeInstance = function (writer, instanceMetadata, manualChildren) {
        writer.writeStartElement('instance');
        _writeInstanceAttributes(writer, instanceMetadata);
        if (manualChildren && instanceMetadata.children) {
            // seriously, this is what you have to do
            // HT: http://stackoverflow.com/questions/652763/jquery-object-to-string
            writer.writeXML($('<div>').append(instanceMetadata.children).clone().html());
        }
        writer.writeEndElement(); 
    };

    var createDataBlock = function (form, xmlWriter) {
        form.tree.walk(function (mug, nodeID, processChildren) {
            if (mug && mug.options.isControlOnly) { return; }
            xmlWriter.writeStartElement(nodeID);
            if (!mug) {
                // tree root
                createModelHeader(form, xmlWriter);
            } else {
                var rawDataAttributes = mug.p.rawDataAttributes;
                // Write any custom attributes first
                for (var k in rawDataAttributes) {
                    if (rawDataAttributes.hasOwnProperty(k)) {
                        xmlWriter.writeAttributeString(k, rawDataAttributes[k]);
                    }
                }

                var dataValue = mug.p.dataValue,
                    keyAttr = mug.p.keyAttr,
                    xmlnsAttr = mug.p.xmlnsAttr;
                
                if (dataValue){
                    xmlWriter.writeString(dataValue);
                }
                if (keyAttr){
                    xmlWriter.writeAttributeString("key", keyAttr);
                }
                if (xmlnsAttr){
                    xmlWriter.writeAttributeString("xmlns", xmlnsAttr);
                }
                if (mug.options.getExtraDataAttributes) {
                    var attributes = mug.options.getExtraDataAttributes(mug);
                    for (k in attributes) {
                        if (attributes.hasOwnProperty(k)) {
                            xmlWriter.writeAttributeString(k, attributes[k]);
                        }
                    }
                }
            }
            processChildren(mug && mug.options.dataChildFilter);
            xmlWriter.writeEndElement();
        });
    };

    var createBindList = function (form, xmlWriter) {
        form.tree.walk(function (mug, nodeID, processChildren) {
            if(mug && !mug.options.isControlOnly) {
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

            xmlWriter.writeStartElement(mug.p.tagName.toLowerCase());
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
        var labelItextID = mug.p.labelItextID,
            labelRef;
        if (labelItextID) {
            labelRef = "jr:itext('" + labelItextID.id + "')";
            // iID is optional so by extension Itext is optional.
            if (labelItextID.isEmpty() &&
                    mug.spec.labelItextID.presence === 'optional') {
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
            hintItextID = mug.p.hintItextID;
        if(hintLabel || (hintItextID && hintItextID.id)) {
            xmlWriter.writeStartElement('hint');
            if(hintLabel){
                xmlWriter.writeString(hintLabel);
            }
            if(hintItextID.id){
                var ref = "jr:itext('" + hintItextID.id + "')";
                xmlWriter.writeAttributeString('ref',ref);
            }
            xmlWriter.writeEndElement();
        }
    }

    function createHelp(xmlWriter, mug) {
        var helpItextID = mug.p.helpItextID;
        if(helpItextID && helpItextID.id) {
            xmlWriter.writeStartElement('help');
            if(helpItextID.id){
                var helpRef = "jr:itext('" + helpItextID.id + "')";
                xmlWriter.writeAttributeString('ref',helpRef);
            }
            xmlWriter.writeEndElement();
        }
    }

    return {
        createXForm: createXForm
    };
});
