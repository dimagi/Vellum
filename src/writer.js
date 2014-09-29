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
        var xmlWriter = new XMLWriter( 'UTF-8', '1.0' );
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
        function mapFunc (node) {
            var mug = node.getValue();

            xmlWriter.writeStartElement(node.getID());
            
            if (node.isRootNode) {
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
                if (mug.__className === "Repeat"){
                    xmlWriter.writeAttributeString("jr:template","");
                }
            }
        }

        function afterFunc (node) {
            xmlWriter.writeEndElement();
        }

        form.dataTree.treeMap(mapFunc, afterFunc);
    };

    var createBindList = function (form, xmlWriter) {
        var bList = form.getBindList(),
            mug, i, attrs, j;

        function populateVariables (mug){
            var constraintMsgItextID = mug.p.constraintMsgItextID,
                constraintMsg;
            if (constraintMsgItextID && !constraintMsgItextID.isEmpty()) {
                constraintMsg = "jr:itext('" + constraintMsgItextID.id + "')";
            } else {
                constraintMsg = mug.p.constraintMsgAttr;
            }

            return {
                nodeset: form.getAbsolutePath(mug),
                type: mug.p.dataType,
                constraint: mug.p.constraintAttr,
                "jr:constraintMsg": constraintMsg,
                relevant: mug.p.relevantAttr,
                required: util.createXPathBoolFromJS(mug.p.requiredAttr),
                calculate: mug.p.calculateAttr,
                "jr:preload": mug.p.preload,
                "jr:preloadParams": mug.p.preloadParams
            };
        }

        for (i in bList) {
            if(bList.hasOwnProperty(i)){
                mug = bList[i];
                attrs = populateVariables(mug);
                if(attrs.nodeset){
                    xmlWriter.writeStartElement('bind');
                    for (j in attrs) {
                        if (attrs.hasOwnProperty(j) && attrs[j]) {
                            xmlWriter.writeAttributeString(j, attrs[j]);
                        }
                    }
                    _(mug.p.rawBindAttributes).each(function (v, k) {
                        if (!attrs.hasOwnProperty(k)) {
                            xmlWriter.writeAttributeString(k, v);
                        } 
                    });
                    xmlWriter.writeEndElement();
                }
            }
        }
    };


    var createControlBlock = function (form, xmlWriter) {
        function mapFunc(node) {
            if(node.isRootNode) { //skip
                return;
            }

            var mug = node.getValue();
                
            if (mug.__className === "ReadOnly") {
                xmlWriter.writeXML($('<div>').append(mug.p.rawControlXML).clone().html());
                return;
            }
            var label, isItextOptional;

            function createOpenControlTag(tagName, elLabel) {
                tagName = tagName.toLowerCase();
                var isGroupOrRepeat = (tagName === 'group' || tagName === 'repeat'),
                    isODKMedia = (tagName === 'upload');

                /**
                 * Creates the label tag inside of a control Element in the xform
                 */
                function createLabel() {
                    if (elLabel.ref || elLabel.defText) {
                        xmlWriter.writeStartElement('label');
                        if (elLabel.ref) {
                            xmlWriter.writeAttributeString('ref',elLabel.ref);
                        }
                        if (elLabel.defText) {
                            xmlWriter.writeString(elLabel.defText);
                        }
                        xmlWriter.writeEndElement(); //close Label tag;
                    }
                }

                // Special logic block to make sure the label ends up in the right place
                if (isGroupOrRepeat) {
                    xmlWriter.writeStartElement('group');
                    createLabel();
                    if (tagName === 'repeat') {
                        xmlWriter.writeStartElement('repeat');
                    }
                } else {
                    xmlWriter.writeStartElement(tagName);
                }
                if (tagName !== 'group' && tagName !== 'repeat' &&
                    tagName !== 'itemset')
                {
                    createLabel();
                }
               
                var defaultValue = mug.p.defaultValue;
                if (tagName === 'item' && defaultValue) {
                    //do a value tag for an item Mug
                    xmlWriter.writeStartElement('value');
                    xmlWriter.writeString(defaultValue);
                    xmlWriter.writeEndElement();
                }

                if (tagName === 'itemset') {
                    var data = mug.p.itemsetData;
                    xmlWriter.writeAttributeString(
                        'nodeset', data.getAttr('nodeset', ''));
                    xmlWriter.writeStartElement('label');
                    xmlWriter.writeAttributeString(
                        'ref', data.getAttr('labelRef', ''));
                    xmlWriter.writeEndElement();
                    xmlWriter.writeStartElement('value');
                    xmlWriter.writeAttributeString(
                        'ref', data.getAttr('valueRef', ''));
                    xmlWriter.writeEndElement();
                }
                
                // Write any custom attributes first
                // HACK skip legacy attributes that should not be preserved
                var skip = (tagName === "repeat") ?
                    function (k) { return k.toLowerCase() === "jr:noaddremove"; } :
                    function (k) { return false; };
                var rawControlAttributes = mug.p.rawControlAttributes;
                for (var k in rawControlAttributes) {
                    if (rawControlAttributes.hasOwnProperty(k) && !skip(k)) {
                        xmlWriter.writeAttributeString(k, rawControlAttributes[k]);
                    }
                }
                
                // Set the nodeset/ref attribute correctly
                if (tagName !== 'item' && tagName !== 'itemset') {
                    var attr, absPath;
                    if (tagName === 'repeat') {
                        attr = 'nodeset';
                    } else {
                        attr = 'ref';
                    }
                    absPath = form.getAbsolutePath(mug);
                    xmlWriter.writeAttributeString(attr, absPath);
                }
                
                // Set other relevant attributes

                if (tagName === 'repeat') {
                    var r_count = mug.p.repeat_count;
                    if (r_count) {
                        xmlWriter.writeAttributeString("jr:count", String(r_count));
                        xmlWriter.writeAttributeString("jr:noAddRemove", "true()");
                    }
                } else if (isODKMedia) {
                    var mediaType = mug.p.mediaType;
                    if (mediaType) {
                        xmlWriter.writeAttributeString("mediatype", mediaType);
                    }
                }

                var appearanceAttr = mug.getAppearanceAttribute();
                if (appearanceAttr) {
                    xmlWriter.writeAttributeString("appearance", appearanceAttr);
                }
                
                // Do hint label
                if( tagName !== 'item' && tagName !== 'repeat'){
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
            }

            //create the label object (for createOpenControlTag())
            if (mug.p.label) {
                label = {};
                label.defText = mug.p.label;
            }
            var labelItextID = mug.p.labelItextID;
            if (labelItextID) {
                if (!label) {
                    label = {};
                }
                
                label.ref = "jr:itext('" + labelItextID.id + "')";
                // iID is optional so by extension Itext is optional.
                isItextOptional = mug.spec.labelItextID.presence === 'optional';
                if (labelItextID.isEmpty() && isItextOptional) {
                    label.ref = '';
                }
            }

            createOpenControlTag(mug.p.tagName, label);
        }

        function afterFunc(node) {
            if (node.isRootNode) {
                return;
            }
            var mug = node.getValue();
            if (mug.__className === "ReadOnly") {
                return;
            }
            
            //finish off
            xmlWriter.writeEndElement(); //close control tag.
            if(mug.p.tagName === 'repeat'){
                xmlWriter.writeEndElement(); //special case where we have to close the repeat as well as the group tag.
            }
        }

        form.controlTree.treeMap(mapFunc, afterFunc);
    };

    return {
        createXForm: createXForm
    };
});
