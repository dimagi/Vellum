define([
    './form',
    './mugs',
    './util',
    'jquery'
], function (
    form_,
    mugs,
    util,
    $
) {
    var mugTypes = mugs.mugTypes;
    function parseXForm(xmlString, formOpts, vellum) {
        var Form = form_.Form,
            InstanceMetadata = form_.InstanceMetadata,
            form = new Form(formOpts, vellum);
        form.parseErrors = [];
        form.parseWarnings = [];

        if (!xmlString) {
            return form;
        }

        var xmlDoc = $.parseXML(xmlString),
            xml = $(xmlDoc),
            head = xml.find('h\\:head, head'),
            title = head.children('h\\:title, title'),
            binds = head.find('bind'),
            instances = _getInstances(xml),
            data = $(instances[0]).children(),
            intentTags = [
                "odkx\\:intent, intent"
            ];


        intentTags.map(function (tag) {
            var foundTags = head.children(tag);
            form.intentManager.parseIntentTagsFromHead(foundTags);
        });

        if($(xml).find('parsererror').length > 0) {
            throw 'PARSE ERROR!:' + $(xml).find('parsererror').find('div').html();
        }
        
        if(title.length > 0) {
            form.formName = $(title).text();
        }
        
        // set all instance metadatas
        form.instanceMetadata = instances.map(function (instance) {
            return InstanceMetadata(
                util.getAttributes(instance),
                $(instance).children()
            ); 
        });
        
        // TODO! adapt
        if(data.length === 0) {
            form.parseErrors.push(
                'No Data block was found in the form.  Please check that your form is valid!');
        }
        
        parseDataTree(form, data[0]);
        parseBindList(form, binds);

        var controls = xml.find('h\\:body, body').children();
        parseControlTree(form, controls);

        // wire the event handlers for all the mugs in the tree
        var allMugs = form.getMugList(true);

        var i;
        // update parse error and warn information in the model/UI
        if (form.parseErrors) {
            for (i = 0; i < form.parseErrors.length; i++) {
                form.updateError({
                    level: "error",
                    message: form.parseErrors[i]
                });
            }
        }

        if (form.parseWarnings) {
            for (i = 0; i < form.parseWarnings.length; i++) {
                form.updateError({
                    level: "parse-warning",
                    message: form.parseWarnings[i]
                });
            }
        }
        
        // populate the LogicManager with initial path data
        allMugs.map(function (mug) {
            form.updateAllLogicReferences(mug);
        });

        return form;
    }
        

    // DATA PARSING FUNCTIONS
    function parseDataTree (form, dataEl) {
        function parseDataElement (el) {
            var nodeID, nodeVal, mug, parentMug, extraXMLNS, keyAttr,mType,parentNodeName,rootNodeName,dataTree;
            
            nodeID = el.nodeName;
            mug = new mugTypes.DataBindOnly(form);
            parentNodeName = $(el).parent()[0].nodeName;
            rootNodeName = $(dataEl)[0].nodeName;
            dataTree = form.dataTree;

            if($(el).children().length === 0) {
                nodeVal = $(el).text();
            }else {
                nodeVal = null;
            }

            extraXMLNS = $(el).attr('xmlns');
            keyAttr = $(el).attr('key');

            mug.dataElement.nodeID = nodeID;
            mug.dataElement.dataValue = nodeVal;
            mug.bindElement.nodeID = nodeID;

            if(extraXMLNS && (extraXMLNS !== form.formUuid)) {
                mug.dataElement.xmlnsAttr = extraXMLNS;
            }
            if(keyAttr) {
                mug.dataElement.keyAttr = keyAttr;
            }
            // add arbitrary attributes
            mug.dataElement._rawAttributes = util.getAttributes(el);
            
            if ( parentNodeName === rootNodeName ) {
                parentMug = null;
            }else {
                parentMug = form.getMugsByNodeID(parentNodeName)[0];
            }

            dataTree.insertMug(mug,'into',parentMug);
        }
        var root = $(dataEl), recFunc;

        recFunc = function () {
                parseDataElement(this);
                $(this).children().each(recFunc);

        };

        if(root.children().length === 0) {
            that.parseErrors.push(
                'Data block has no children elements! Please make sure your form is a valid JavaRosa XForm!'
            );
        }
        root.children().each(recFunc);
        //try to grab the JavaRosa XForm Attributes in the root data element...
        form.formUuid = root.attr("xmlns");
        form.formJRM = root.attr("xmlns:jrm");
        form.formUIVersion = root.attr("uiVersion");
        form.formVersion = root.attr("version");
        form.formName = root.attr("name");
        form.setFormID($(root)[0].tagName);
        
        if (!form.formUuid) {
            that.parseWarnings.push('Form does not have a unique xform XMLNS (in data block). Will be added automatically');
        }
        if (!form.formJRM) {
            that.parseWarnings.push('Form JRM namespace attribute was not found in data block. One will be added automatically');
        }
        if (!form.formUIVersion) {
            that.parseWarnings.push('Form does not have a UIVersion attribute, one will be generated automatically');
        }
        if (!form.formVersion) {
            that.parseWarnings.push('Form does not have a Version attribute (in the data block), one will be added automatically');
        }
        if (!form.formName) {
            that.parseWarnings.push('Form does not have a Name! The default form name will be used');
        }

    }
            
    /**
     * Get and itext reference from a value. Returns nothing if it can't
     * parse it as a valid itext reference.
     */
    var getITextReference = function (value) {
        try {
            var parsed = xpath.parse(value);
            if (parsed instanceof xpathmodels.XPathFuncExpr && parsed.id === "jr:itext") {
                return parsed.args[0].value;
            } 
        } catch (err) {
            // this seems like a real error since the reference should presumably
            // have been valid xpath, but don't deal with it here
        }
        return false;
    };
    
    function getLabelRef($lEl) {
        var ref = $lEl.attr('ref');
        return ref ? getITextReference(ref) : null;
    }

    var lookForNamespaced = function (element, reference) {
        // due to the fact that FF and Webkit store namespaced
        // values slightly differently, we have to look in 
        // a couple different places.
        return element.popAttr("jr:" + reference) || element.popAttr("jr\\:" + reference);
    };

    // CONTROL PARSING FUNCTIONS
    function parseLabel(form, lEl, mug) {
        var Itext = form.vellum.data.javaRosa.Itext;
        var $lEl = $(lEl),
            labelVal = util.getXLabelValue($lEl),
            labelRef = getLabelRef($lEl),
            cProps = mug.controlElement;
        var labelItext;
        cProps.label = labelVal;
        
        var newLabelItext = function (mug) {
            var item = new form.vellum.data.javaRosa.ItextItem({
                id: mug.getDefaultLabelItextId()
            });
            Itext.addItem(item);
            return item;
        };
        
        if (labelRef){
            labelItext = Itext.getOrCreateItem(labelRef);
        } else {
            // if there was a ref attribute but it wasn't formatted like an
            // itext reference, it's likely an error, though not sure what
            // we should do here for now just populate with the default
            labelItext = newLabelItext(mug);
        }
       
        cProps.labelItextID = labelItext;
        if (cProps.labelItextID.isEmpty()) {
            //if no default Itext has been set, set it with the default label
            if (labelVal) {
                cProps.labelItextID.setDefaultValue(labelVal);
            } else {
                // or some sensible deafult
                cProps.labelItextID.setDefaultValue(mug.getDefaultLabelValue());
            }
        }
    }

    function parseHint (form, hEl, mug) {
        var Itext = form.vellum.data.javaRosa.Itext;
        var $hEl = $(hEl),
            hintVal = util.getXLabelValue($hEl),
            hintRef = getLabelRef($hEl),
            cProps = mug.controlElement;

        if (hintRef) {
            cProps.hintItextID = Itext.getOrCreateItem(hintRef);
        } else {
            // couldn't parse the hint as itext.
            // just create an empty placeholder for it
            cProps.hintItextID = Itext.createItem(""); 
        }
        cProps.hintLabel = hintVal;
    }

    function parseDefaultValue (dEl, mug) {
        var dVal = util.getXLabelValue($(dEl)),
                cProps = mug.controlElement;
        if(dVal){
            cProps.defaultValue = dVal;
        }
    }

    function parseRepeatVals (r_count, r_noaddremove, mug) {
        if (r_count) {
            mug.controlElement.repeat_count = r_count;
        }

        if(r_noaddremove) {
            mug.controlElement.no_add_remove = r_noaddremove;
        }
    }

    function mugTypeFromInput (dataType, appearance) {
        if (!dataType) { 
            return mugTypes.Text; 
        }
        if(dataType === 'long') {
            return mugTypes.Long;
        }else if(dataType === 'int') {
            return mugTypes.Int;
        }else if(dataType === 'double') {
            return mugTypes.Double;
        }else if(dataType === 'geopoint') {
            return mugTypes.Geopoint;
        }else if(dataType === 'barcode') {
            return mugTypes.Barcode;
        }else if(dataType === 'intent') {
            return mugTypes.AndroidIntent;
        }else if(dataType === 'string') {
            if (appearance === "numeric") {
                return mugTypes.PhoneNumber;
            } else {
                return mugTypes.Text;
            }
        }else if(dataType === 'date') {
            return mugTypes.Date;
        }else if(dataType === 'datetime') {
            return mugTypes.DateTime;
        }else if(dataType === 'time') {
            return mugTypes.Time;
        }else {
            return mugTypes.Text;
        }
    }

    function mugTypeFromGroup (cEl) {
        if ($(cEl).attr('appearance') === 'field-list') {
            return mugTypes.FieldList;
        } else if ($(cEl).children('repeat').length > 0) {
            return mugTypes.Repeat;
        } else {
            return mugTypes.Group;
        }
    }

    function mugTypeFromUpload (mediaType, nodePath) {
        // todo: fix broken oldMug closure reference
        if(!mediaType) {
            throw 'Unable to parse binary question type. ' +
                'The question has no MediaType attribute assigned to it!';
        }
        if (mediaType === 'video/*') {
            /* fix buggy eclipse syntax highlighter (because of above string) */ 
            return mugTypes.Video;
        } else if (mediaType === 'image/*') {
            /* fix buggy eclipse syntax highlighter (because of above string) */ 
            return mugTypes.Image;
        } else if (mediaType === 'audio/*') {
            /* fix buggy eclipse syntax highlighter (because of above string) */ 
            return mugTypes.Audio;
        } else {
            throw 'Unrecognized upload question type for Element: ' + nodePath + '!';
        }
    }

    /**
     * Determines what Mug this element should be
     * and creates it.  Also modifies any existing mug that is associated
     * with this element to fit the new type.
     * @param nodePath
     * @param controlEl
     */
    function classifyAndCreateMug (form, nodePath, cEl) {
        var oldMug = form.getMugByPath(nodePath), //check the data node to see if there's a related Mug already present
            mug, tagName, bindEl, dataEl, dataType, appearance, MugClass, mediaType;

        tagName = $(cEl)[0].nodeName;
        if (oldMug) {
            bindEl = oldMug.bindElement;
            if (bindEl) {
                dataType = bindEl.dataType;
                appearance = cEl.attr('appearance');
                mediaType = cEl.attr('mediatype') ? cEl.attr('mediatype') : null;
                if (dataType) {
                    dataType = dataType.replace('xsd:',''); //strip out extraneous namespace
                    dataType = dataType.toLowerCase();
                }
                if(mediaType) {
                    mediaType = mediaType.toLowerCase();
                }
            }
        }

        //broadly categorize
        tagName = tagName.toLowerCase();
        var hasItemset = $(cEl).children('itemset').length;
        if(tagName === 'select') {
            MugClass = hasItemset ? mugTypes.MSelectDynamic : mugTypes.MSelect;
        }else if (tagName === 'select1') {
            MugClass = hasItemset ? mugTypes.SelectDynamic : mugTypes.Select;
        }else if (tagName === 'trigger') {
            MugClass = mugTypes.Trigger;
        }else if (tagName === 'input') {
            if (cEl.attr('readonly') === 'true()') {
                MugClass = mugTypes.Trigger;
                cEl.removeAttr('readonly');
                //delete bindEl.dataType;
            } else {
                MugClass = mugTypeFromInput(dataType, appearance);
            }
        }else if (tagName === 'item') {
            MugClass = mugTypes.Item;
        }else if (tagName === 'itemset') {
            MugClass = mugTypes.Itemset;
        }else if (tagName === 'group') {
            MugClass = mugTypeFromGroup(cEl);
            if (MugClass === mugTypes.Repeat) {
                tagName = 'repeat';
            }
        }else if (tagName === 'secret') {
            MugClass = mugTypes.Secret;
        }else if (tagName === 'upload') {
            MugClass = mugTypeFromUpload(mediaType, nodePath);
        } else {
            // unknown question type
            MugClass = mugTypes.ReadOnly;
        }
        
        // create new mug and copy old data to newly generated mug
        mug = new MugClass(form);
        if(oldMug) {
            mug.copyAttrs(oldMug);
            mug.ufid = oldMug.ufid;

            //replace in dataTree
            form.replaceMug(oldMug, mug, 'data');
        }

        if (appearance) {
            mug.setAppearanceAttribute(appearance);
        }

        return mug;
    }
                
    function populateMug (form, mug, cEl) {
        if (mug.__className === "ReadOnly") {
            mug.controlElementRaw = cEl;
            return;
        }
        
        var $cEl = $(cEl),
            labelEl, hintEl, repeat_count, repeat_noaddremove;
        

        var tag = mug.controlElement.tagName;
        if(tag === 'repeat'){
            labelEl = $($cEl.parent().children('label'));
            hintEl = $cEl.parent().children('hint');
            repeat_count = $cEl.popAttr('jr:count');
            repeat_noaddremove = util.parseBoolAttributeValue(
                $cEl.popAttr('jr:noAddRemove'));

        } else {
            labelEl = $cEl.children('label');
            hintEl = $cEl.children('hint');
        }

        if (labelEl.length > 0 && mug.__className !== 'Itemset') {
            parseLabel(form, labelEl, mug);
        }
        if (hintEl.length > 0) {
            parseHint (form, hintEl, mug);
        }
        if (tag === 'item') {
            parseDefaultValue($cEl.children('value'),mug);
        }

        if (tag === 'repeat') {
            parseRepeatVals(repeat_count, repeat_noaddremove, mug);
        }

        if (tag === 'itemset') {
            // todo: convert to bound property map
            mug.controlElement.setAttr('itemsetData', new mugs.BoundPropertyMap(form, {
                nodeset: $cEl.attr('nodeset'),
                labelRef: $cEl.children('label').attr('ref'),
                valueRef: $cEl.children('value').attr('ref')
            }));
        }

        if (mug.__className === "Trigger") {
            mug.controlElement.setAttr(
                'showOKCheckbox', $cEl.attr('appearance') !== 'minimal');
        
        }

        form.intentManager.syncMugWithIntent(mug);
        
        // add any arbitrary attributes that were directly on the control
        mug.controlElement._rawAttributes = util.getAttributes(cEl);
    }
                
    //figures out if this control DOM element is a repeat
    function isRepeatTest(groupEl) {
        if($(groupEl)[0].tagName !== 'group') {
            return false;
        }
        return $(groupEl).children('repeat').length === 1;
    }

    var mugFromControlEl = function (form, el) {
        var path = util.getPathFromControlElement(el),
            nodeId;

        if (path) {
            return form.getMugByPath(path);
        } else {
            nodeId = $(el).attr('bind');

            if (nodeId) {
                try {
                    return form.getSingularMugByNodeId(nodeId);
                } catch (err) {
                    // may be fine if this was a parent lookup, 
                    // or will fail hard later if this creates an illegal move
                    return null;
                }
            }
        }
        return null;
    };

    function parseControlTree (form, controlsTree) {
        var Itext = form.vellum.data.javaRosa.Itext;

        function eachFunc(){
            var el = $ ( this ), oldEl,
                path,
                mug,
                parentNode,
                parentMug,
                tagName,
                couldHaveChildren = ['repeat', 'group', 'fieldlist', 'select', 'select1'],
                children,
                bind,
                isRepeat;

            isRepeat = isRepeatTest(el);
            //do the repeat switch thing
            if(isRepeat) {
                oldEl = el;
                el = $(el.children('repeat')[0]);
            }

            parentNode = oldEl ? oldEl.parent() : el.parent();
            if($(parentNode)[0].nodeName === 'h:body') {
                parentNode = null;
            }
            
            if (parentNode) {
                parentMug = mugFromControlEl(form, parentNode);
            }
           
            path = util.getPathFromControlElement(el);
            if (!path) {
                var existingMug = mugFromControlEl(form, el);
                if (existingMug) {
                    path = form.getAbsolutePath(existingMug);
                }
            }
           
            if (oldEl) {
                mug = classifyAndCreateMug(form, path, oldEl);
            } else {
                mug = classifyAndCreateMug(form, path, el);
            }
            populateMug(form, mug, el);
            form.controlTree.insertMug(mug, 'into', parentMug);

            if (mug.__className !== "ReadOnly") {
                tagName = mug.controlElement.tagName.toLowerCase();
                if(couldHaveChildren.indexOf(tagName) !== -1) {
                    children = $(el).children().not('label').not('value').not('hint');
                    children.each(eachFunc); //recurse down the tree
                }
                // update any remaining itext
                Itext.updateForExistingMug(mug);
            }
        }
        controlsTree.each(eachFunc);
    }

    // BIND PARSING FUNCTIONS

    /**
     * Takes in a path and converts it to an absolute path (if it isn't one already)
     * @param path - a relative or absolute nodeset path
     * @param rootNodeName - the name of the model root (used to create the absolute path)
     * @return absolute nodeset path.
     */
    function processPath (path, rootNodeName) {
        var newPath;
        var parsed = xpath.parse(path);
        if (!(parsed instanceof xpathmodels.XPathPathExpr)) {
            return null;
        }

        if (parsed.initial_context == xpathmodels.XPathInitialContextEnum.RELATIVE) {
            parsed.steps.splice(0, 0, xpathmodels.XPathStep({axis: "child", test: rootNodeName}));
            parsed.initial_context = xpathmodels.XPathInitialContextEnum.ROOT;
        }
        newPath = parsed.toXPath();
        return newPath;
    }

    function parseBindList (form, bindList) {
        var Itext = form.vellum.data.javaRosa.Itext;

        bindList.each(function () {
            var el = $(this),
                attrs = {},
                mug = new mugTypes.DataBindOnly(form),
                path = el.popAttr('nodeset'),
                id = el.popAttr('id'),
                nodeID, bindElement, oldMug;
            if (!path) {
               path = el.popAttr('ref');
            }
            nodeID = util.getNodeIDFromPath(path);
            if(id) {
                attrs.nodeID = id;
                attrs.nodeset = path;
            } else {
                attrs.nodeID = nodeID;
            }

            attrs.dataType = el.popAttr('type');
            if(attrs.dataType && attrs.dataType.toLowerCase() === 'xsd:integer') {  //normalize this dataType ('int' and 'integer' are both valid).
                attrs.dataType = 'xsd:int';
            }
            attrs.appearance = el.popAttr('appearance');
            attrs.relevantAttr = el.popAttr('relevant');
            attrs.calculateAttr = el.popAttr('calculate');
            attrs.constraintAttr = el.popAttr('constraint');

            var constraintMsg = lookForNamespaced(el, "constraintMsg"),
                constraintItext = getITextReference(constraintMsg);

            if (constraintItext) {
                attrs.constraintMsgItextID = Itext.getOrCreateItem(constraintItext);
            } else {
                attrs.constraintMsgItextID = Itext.createItem("");
                attrs.constraintMsgAttr = constraintMsg;    
            }
                            
            attrs.requiredAttr = util.parseBoolAttributeValue(
                el.popAttr('required'));

            
            attrs.preload = lookForNamespaced(el, "preload");
            attrs.preloadParams = lookForNamespaced(el, "preloadParams");
           
            path = processPath(path, form.dataTree.getRootNode().getID());
            form.vellum.parseBindElement(el, path);

            oldMug = form.getMugByPath(path);
            if(!oldMug && attrs.nodeset) {
                oldMug = form.getMugsByNodeID(
                    util.getNodeIDFromPath(attrs.nodeset))[0];
            }
            if(!oldMug){
                that.parseWarnings.push("Bind Node [" + path + "] found but has no associated Data node. This bind node will be discarded!");
//                    throw 'Parse error! Could not find Data Mug associated with this bind!'; //can't have a bind without an associated dataElement.
                return;
            }
            mug.ufid = oldMug.ufid;
            mug.copyAttrs(oldMug);
            mug.bindElement.setAttrs(attrs, true);
            mug.bindElement._rawAttributes = util.getAttributes(el);

            // clear relevant itext for bind
            // this is ugly, and should be moved somewhere else
            if (oldMug.bindElement) {
                Itext.removeItem(oldMug.bindElement.constraintMsgItextID);
            }
            form.replaceMug(oldMug, mug, 'data');
        });
    }

    var _getInstances = function (xml) {
        // return all the instances in the form.
        // if there's more than one, guarantee that the first item returned
        // is the main instance.
        var instances = xml.find("instance");
        var foundMain = false;
        var ret = [];
        for (var i = 0; i < instances.length; i++) {
            // the main should be the one without an ID
            if (!$(instances[i]).attr("id")) {
                if (foundMain) {
                    throw "multiple unnamed instance elements found in the form! this is not allowed. please add id's to all but 1 instance.";
                }
                ret.splice(0, 0, instances[i]);
                foundMain = true;
            } else {
                ret.push(instances[i]);
            }
        }
        return ret;
    };

    // todo: pluginify
    //that.parseBindElement = function (el, path) {
    
    //};

    return {
        parseXForm: parseXForm
    };
});
