define([
    'jquery',
    'XMLWriter',
    'vellum/util'
], function (
    $,
    XMLWriter,
    util
) {
    var createXForm = function (form) {
        var xmlWriter = new XMLWriter( 'UTF-8', '1.0' );
        // todo
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

        form.vellum.contributeToModelXML(xmlWriter);
        
        xmlWriter.writeEndElement(); //CLOSE MODEL

        form.intentManager.writeIntentXML(xmlWriter, form.dataTree);

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
        var uuid, uiVersion, version, formName, jrm;
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
            var defaultVal, extraXMLNS, keyAttr,
                mug = node.getValue();

            xmlWriter.writeStartElement(node.getID());
            
            if (node.isRootNode) {
                createModelHeader(form, xmlWriter);
            } else {
                // Write any custom attributes first
                for (var k in mug.dataElement._rawAttributes) {
                    if (mug.dataElement._rawAttributes.hasOwnProperty(k)) {
                        xmlWriter.writeAttributeString(k, mug.dataElement._rawAttributes[k]);
                    }
                }
                
                if (mug.dataElement.dataValue){
                    defaultVal = mug.dataElement.dataValue;
                    xmlWriter.writeString(defaultVal);
                }
                if (mug.dataElement.keyAttr){
                    keyAttr = mug.dataElement.keyAttr;
                    xmlWriter.writeAttributeString("key", keyAttr);
                }
                if (mug.dataElement.xmlnsAttr){
                    extraXMLNS = mug.dataElement.xmlnsAttr;
                    xmlWriter.writeAttributeString("xmlns", extraXMLNS);
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
            var constraintMsg, bEl = mug.bindElement;
            if (bEl.constraintMsgItextID && !bEl.constraintMsgItextID.isEmpty()) {
                constraintMsg = "jr:itext('" + bEl.constraintMsgItextID.id + "')";
            } else {
                constraintMsg = bEl.constraintMsgAttr;
            }

            return {
                nodeset: form.getAbsolutePath(mug),
                type: bEl.dataType,
                constraint: bEl.constraintAttr,
                "jr:constraintMsg": constraintMsg,
                relevant: bEl.relevantAttr,
                required: util.createXPathBoolFromJS(bEl.requiredAttr),
                calculate: bEl.calculateAttr,
                "jr:preload": bEl.preload,
                "jr:preloadParams": bEl.preloadParams
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
                    _(mug.bindElement._rawAttributes).each(function (v, k) {
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
                xmlWriter.writeXML($('<div>').append(mug.controlElementRaw).clone().html());
                return;
            }
            var cProps = mug.controlElement,
                label, hasItext, isItextOptional;

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
                
                if (tagName === 'item' && cProps.defaultValue) {
                    //do a value tag for an item Mug
                    xmlWriter.writeStartElement('value');
                    xmlWriter.writeString(cProps.defaultValue);
                    xmlWriter.writeEndElement();
                }

                if (tagName === 'itemset') {
                    var data = cProps.itemsetData;
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
                for (var k in cProps._rawAttributes) {
                    if (cProps._rawAttributes.hasOwnProperty(k)) {
                        xmlWriter.writeAttributeString(k, cProps._rawAttributes[k]);
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
                    var r_count = cProps.repeat_count,
                        r_noaddrem = cProps.no_add_remove;

                    //make r_noaddrem an XPath bool
                    r_noaddrem = util.createXPathBoolFromJS(r_noaddrem);

                    if (r_count) {
                        xmlWriter.writeAttributeString("jr:count",r_count);
                    }

                    if (r_noaddrem) {
                        xmlWriter.writeAttributeString("jr:noAddRemove", r_noaddrem);
                    }
                } else if (isODKMedia) {
                    var mediaType = cProps.mediaType;
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
                    if(cProps.hintLabel || (cProps.hintItextID && cProps.hintItextID.id)) {
                        xmlWriter.writeStartElement('hint');
                        if(cProps.hintLabel){
                            xmlWriter.writeString(cProps.hintLabel);
                        }
                        if(cProps.hintItextID.id){
                            var ref = "jr:itext('" + cProps.hintItextID.id + "')";
                            xmlWriter.writeAttributeString('ref',ref);
                        }
                        xmlWriter.writeEndElement();
                    }
                }
            }

            //create the label object (for createOpenControlTag())
            if (cProps.label) {
                label = {};
                label.defText = cProps.label;
            }
            if (cProps.labelItextID) {
                if (!label) {
                    label = {};
                }
                
                label.ref = "jr:itext('" + cProps.labelItextID.id + "')";
                // iID is optional so by extension Itext is optional.
                isItextOptional = mug.controlElement.__spec.labelItextID.presence === 'optional';
                if (cProps.labelItextID.isEmpty() && isItextOptional) {
                    label.ref = '';
                }
            }

            createOpenControlTag(cProps.tagName, label);
        }

        function afterFunc(node) {
            if (node.isRootNode) {
                return;
            }
            var mug = node.getValue();
            if (mug.__className === "ReadOnly") {
                return;
            }
            
            var tagName = mug.controlElement.tagName;
            //finish off
            xmlWriter.writeEndElement(); //close control tag.
            if(tagName === 'repeat'){
                xmlWriter.writeEndElement(); //special case where we have to close the repeat as well as the group tag.
            }
        }

        form.controlTree.treeMap(mapFunc, afterFunc);
    };

    return {
        createXForm: createXForm
    };
});
