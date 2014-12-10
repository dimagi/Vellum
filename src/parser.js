define([
    'vellum/form',
    'vellum/util',
    'jquery',
    'underscore',
    'xpath',
    'xpathmodels'
], function (
    form_,
    util,
    $,
    _,
    xpath,
    xpathmodels
) {
    var DEFAULT_FORM_ID = 'data';

    function init (instance) {
        var data = instance.data.core;
        data.controlNodeAdaptorMap = buildControlNodeAdaptorMap();
        instance.updateControlNodeAdaptorMap(data.controlNodeAdaptorMap);
    }

    $.fn.popAttr = function (name) {
        var removed = false,
            val = this.attr(name);
        try {
            this.removeAttr(name);
            removed = true;
        } catch (e) {
            // catch InvalidCharacterError due to \: in attribute name
        }
        if (removed && !_.isUndefined(val)) {
            if (!this[0].poppedAttributes) {
                this[0].poppedAttributes = {};
            }
            this[0].poppedAttributes[name] = val;
        }
        return val;
    };

    function getAttributes (element) {
        var attributes = $(element)[0].attributes,
            attrMap = {};

        for (var i = 0; i < attributes.length; i++) {
            attrMap[attributes[i].nodeName] = attributes[i].nodeValue;
        }
        return attrMap;
    }

    function parseXForm(xmlString, formOpts, vellum, warnings) {
        var Form = form_.Form,
            InstanceMetadata = form_.InstanceMetadata,
            form = new Form(formOpts, vellum, formOpts.mugTypes);
        form.parseErrors = [];
        form.parseWarnings = warnings;
        form.isLoadingXForm = true; // disable mug nodeId change logic

        if (!xmlString) {
            form.isLoadingXForm = false;
            return form;
        }

        var xmlDoc = $.parseXML(xmlString),
            xml = $(xmlDoc),
            head = xml.find('h\\:head, head'),
            title = head.children('h\\:title, title'),
            binds = head.find('bind'),
            instances = _getInstances(xml),
            data = $(instances[0]).children();

        xml.find('setvalue').each(function () {
            var $this = $(this);
            form.addSetValue(
                $this.attr('event'), $this.attr('ref'), $this.attr('value'));
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
                getAttributes(instance),
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
        var allMugs = form.getMugList();

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

        form.isLoadingXForm = false;
        return form;
    }

    // DATA PARSING FUNCTIONS
    function parseDataTree (form, dataEl) {
        var root = $(dataEl), recFunc;

        recFunc = function (parentMug) {
            var mug = form.vellum.parseDataElement(form, this, parentMug);
            if (mug) {
                form.dataTree.insertMug(mug, 'into', parentMug);
            }
            mug.options.dataNodeChildren($(this)).each(function () {
                recFunc.call(this, mug);
            });
        };

        if(root.children().length === 0) {
            form.parseErrors.push(
                'Data block has no children elements! Please make sure your form is a valid JavaRosa XForm!'
            );
        }
        root.children().each(function () {
            recFunc.call(this, null);
        });
        //try to grab the JavaRosa XForm Attributes in the root data element...
        form.formUuid = root.attr("xmlns");
        form.formJRM = root.attr("xmlns:jrm");
        form.formUIVersion = root.attr("uiVersion");
        form.formVersion = root.attr("version");
        form.formName = root.attr("name");

        if (root[0]) {
            form.setFormID(root[0].tagName);
        } else {
            form.setFormID(DEFAULT_FORM_ID);
        }
        
        if (!form.formUuid) {
            form.parseWarnings.push('Form does not have a unique xform XMLNS (in data block). Will be added automatically');
        }
        if (!form.formJRM) {
            form.parseWarnings.push('Form JRM namespace attribute was not found in data block. One will be added automatically');
        }
        if (!form.formUIVersion) {
            form.parseWarnings.push('Form does not have a UIVersion attribute, one will be generated automatically');
        }
        if (!form.formVersion) {
            form.parseWarnings.push('Form does not have a Version attribute (in the data block), one will be added automatically');
        }
        if (!form.formName) {
            form.parseWarnings.push('Form does not have a Name! The default form name will be used');
        }
    }

    function parseDataElement(form, el, parentMug) {
        var $el = $(el),
            nodeID = el.nodeName, 
            nodeVal = $el.children().length ? null : $el.text(),
            extraXMLNS = $el.popAttr('xmlns') || null,
            keyAttr = $el.popAttr('key') || null,
            role = $el.attr('vellum:role');

        if (role && form.mugTypes.allTypes.hasOwnProperty(role) &&
            form.mugTypes.allTypes[role].supportsDataNodeRole) {
            $el.popAttr('vellum:role');
        } else {
            role = 'DataBindOnly';
        }

        var mug = form.mugTypes.make(role, form);
        mug.p.nodeID = nodeID;
        mug.p.dataValue = nodeVal;

        if (extraXMLNS && (extraXMLNS !== form.formUuid)) {
            mug.p.xmlnsAttr = extraXMLNS;
        }
        if (keyAttr) {
            mug.p.keyAttr = keyAttr;
        }
        // add arbitrary attributes
        mug.p.rawDataAttributes = getAttributes(el);
        return mug;
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
        return element.popAttr("jr:" + reference) || 
            element.popAttr("jr\\:" + reference) || null;
    };

    // CONTROL PARSING FUNCTIONS
    function parseLabel(form, lEl, mug) {
        var Itext = form.vellum.data.javaRosa.Itext,
            $lEl = $(lEl),
            labelVal = util.getXLabelValue($lEl),
            labelRef = getLabelRef($lEl),
            labelItext;
        if (labelVal) {
            mug.p.label = labelVal;
        }
        
        function newLabelItext(mug) {
            return form.vellum.data.javaRosa.Itext.createItem(
                mug.getDefaultLabelItextId());
        }
        
        if (labelRef){
            labelItext = Itext.getOrCreateItem(labelRef);
        } else {
            // if there was a ref attribute but it wasn't formatted like an
            // itext reference, it's likely an error, though not sure what
            // we should do here for now just populate with the default
            labelItext = newLabelItext(mug);
        }
       
        if (labelItext.isEmpty()) {
            //if no default Itext has been set, set it with the default label
            if (labelVal) {
                labelItext.setDefaultValue(labelVal);
            } else {
                // or some sensible deafult
                labelItext.setDefaultValue(mug.getDefaultLabelValue());
            }
        }
        mug.p.labelItextID = labelItext;
    }

    function parseHint (form, hEl, mug) {
        var Itext = form.vellum.data.javaRosa.Itext;
        var $hEl = $(hEl),
            hintVal = util.getXLabelValue($hEl),
            hintRef = getLabelRef($hEl);

        if (hintRef) {
            mug.p.hintItextID = Itext.getOrCreateItem(hintRef);
        } else {
            // couldn't parse the hint as itext.
            // just create an empty placeholder for it
            mug.p.hintItextID = Itext.createItem(""); 
        }
        mug.p.hintLabel = hintVal;
    }

    function parseControlElement(form, $cEl, parentMug) {
        var tagName = $cEl[0].nodeName.toLowerCase(),
            appearance = $cEl.popAttr('appearance'),
            adapt, mug = null;

        var getAdaptor = form.vellum.data.core.controlNodeAdaptorMap[tagName];
        if (getAdaptor) {
            adapt = getAdaptor($cEl, appearance, form, parentMug);
        }
        if (!adapt) {
            // unknown question type
            adapt = makeMugAdaptor('ReadOnly');
        }

        if (!adapt.ignoreDataNode) {
            var path = adapt.path;
            if (!path) {
                path = getPathFromControlElement($cEl, form, parentMug);
            }
            mug = form.getMugByPath(path);
        }
        mug = adapt(mug, form);
        mug.parentMug = parentMug;
        if (appearance) {
            mug.p.appearance = appearance;
        }
        populateMug(form, mug, $cEl);

        return mug;
    }

    /**
     * Make mug adaptor to convert from data-bind-only mug to control mug
     *
     * @param type - The final (adapted) mug type.
     * @returns - An adaptor function that returns the adapted mug. The adaptor
     *  function accepts two arguments `(mug, form)`: `mug` is a data-bind-only
     *  mug or null, and `form` is the form object. Additionally, the adaptor
     *  function has the following attributes:
     *
     *      - type : the `type` parameter passed to `makeMugAdaptor`.
     */
    function makeMugAdaptor(type) {
        var adapt = function (mug, form) {
            if (mug) {
                form.changeMugType(mug, type);
            } else {
                // unexpected; can happen with bad XForm (missing data node)
                // TODO parse warning
                mug = form.mugTypes.make(type, form);
            }
            return mug;
        };
        adapt.type = type;
        return adapt;
    }

    /**
     * A mug adaptor factory for mugs with no corresponding data node (Item)
     *
     * The mug passed to `adapt` is ignored (assumed to be undefined). An
     * attribute is set on the returned adaptor (`ignoreDataNode = true`)
     * to make the parser skip the data node lookup.
     */
    function makeControlOnlyMugAdaptor(type) {
        var adapt = function (mug, form) {
            return form.mugTypes.make(type, form);
        };
        adapt.type = type;
        adapt.ignoreDataNode = true;
        return adapt;
    }

    function buildControlNodeAdaptorMap() {
        var inputAdaptors = {
                'string': makeMugAdaptor('Text'),
                'long': makeMugAdaptor('Long'),
                'int': makeMugAdaptor('Int'),
                'double': makeMugAdaptor('Double'),
                'date': makeMugAdaptor('Date'),
                'datetime': makeMugAdaptor('DateTime'),
                'time': makeMugAdaptor('Time'),
                'geopoint': makeMugAdaptor('Geopoint'),
                'barcode': makeMugAdaptor('Barcode'),
                'intent': makeMugAdaptor('AndroidIntent')
            },
            // pre-make adaptors for these because they are used frequently
            adaptSelect = makeMugAdaptor('Select'),
            adaptItem = makeControlOnlyMugAdaptor('Item'),
            _adaptTrigger = makeMugAdaptor('Trigger'),
            triggerAdaptor = function (appearance) {
                return function (mug, form) {
                    mug = _adaptTrigger(mug, form);
                    mug.p.showOKCheckbox = (appearance !== 'minimal');
                    return mug;
                };
            };
        return {
            secret: function () { return makeMugAdaptor('Secret'); },
            select: function () { return makeMugAdaptor('MSelect'); },
            select1: function () { return adaptSelect; },
            trigger: function ($cEl, appearance) { return triggerAdaptor(appearance); },
            input: function ($cEl, appearance) {
                if ($cEl.popAttr('readonly') === 'true()') {
                    // WARNING produces different XML than consumed (input -> trigger)
                    return triggerAdaptor(appearance);
                }
                return function(mug, form) {
                    var dataType = mug && mug.p.dataType;
                    if (dataType) {
                        dataType = dataType.replace('xsd:',''); //strip out extraneous namespace
                        dataType = dataType.toLowerCase();
                        if (inputAdaptors.hasOwnProperty(dataType)) {
                            if (dataType === 'string' && appearance === 'numeric') {
                                return makeMugAdaptor('PhoneNumber')(mug, form);
                            }
                            return inputAdaptors[dataType](mug, form);
                        }
                    }
                    return inputAdaptors.string(mug, form);
                };
            },
            item: function ($cEl) {
                var adapt = function (mug, form) {
                    mug = adaptItem(mug, form);
                    var value = util.getXLabelValue($cEl.children('value'));
                    if (value) {
                        mug.p.defaultValue = value;
                    }
                    return mug;
                };
                adapt.type = adaptItem.type;
                adapt.ignoreDataNode = true;
                return adapt;
            },
            group: function ($cEl, appearance, form, parentMug) {
                var type;
                if (appearance === 'field-list') {
                    type = 'FieldList';
                } else {
                    var repeat = $cEl.children('repeat');
                    if (repeat.length === 1) {
                        var adapt = function (mug, form) {
                            mug = makeMugAdaptor('Repeat')(mug, form);
                            mug.p.repeat_count = repeat.popAttr('jr:count') || null;
                            return mug;
                        };
                        adapt.repeat = repeat;
                        adapt.path = getPathFromControlElement(repeat, form, parentMug);
                        adapt.type = 'Repeat';
                        return adapt;
                    } else {
                        type = 'Group';
                    }
                }
                return makeMugAdaptor(type);
            },
            upload: function ($cEl, appearance, form, parentMug) {
                var mediaType = $cEl.popAttr('mediatype');
                if(!mediaType) {
                    // Why throw?! This will kill form parsing.
                    // TODO create a parser warning instead?
                    throw 'Unable to parse binary question type. ' +
                        'The question has no MediaType attribute assigned to it!';
                }
                var type;
                mediaType = mediaType.toLowerCase();
                if (mediaType === 'video/*') { /* fix eclipse syntax highlighter */
                    type = 'Video';
                } else if (mediaType === 'image/*') { /* fix eclipse syntax highlighter */
                    if (appearance === 'signature') {
                        type = 'Signature';
                    } else {
                        type = 'Image';
                    }
                } else if (mediaType === 'audio/*') { /* fix eclipse syntax highlighter */
                    type = 'Audio';
                } else {
                    // Why throw?! This will kill form parsing.
                    // TODO create a parser warning instead?
                    throw 'Unrecognized upload question type for Element: ' +
                          getPathFromControlElement($cEl, form, parentMug);
                }
                return makeMugAdaptor(type);
            }
        };
    }

    function parseBoolAttributeValue (attrString, undefined) {
        if (!attrString) {
            return undefined;
        }
        var str = attrString.toLowerCase().replace(/\s/g, '');
        if (str === 'true()') {
            return true;
        } else if (str === 'false()') {
            return false;
        } else {
            return undefined;
        }
    }
                
    function populateMug(form, mug, $cEl) {
        if (mug.__className === "ReadOnly") {
            if ($cEl.length === 1 && $cEl[0].poppedAttributes) {
                // restore attributes removed during parsing
                _.each($cEl[0].poppedAttributes, function (val, key) {
                    $cEl.attr(key, val);
                });
            }
            mug.p.rawControlXML = $cEl;
            return;
        }

        var labelEl = $cEl.children('label'),
            hintEl = $cEl.children('hint');

        if (labelEl.length > 0 && mug.spec.label.presence !== 'notallowed') {
            parseLabel(form, labelEl, mug);
        }
        if (hintEl.length > 0) {
            parseHint(form, hintEl, mug);
        }

        // add any arbitrary attributes that were directly on the control
        mug.p.rawControlAttributes = getAttributes($cEl);
    }

    /**
     * Figures out what the xpath is of a control element
     * by looking at the ref or nodeset attributes.
     * @param el - a jquery-wrapped xforms control element.
     * @return - a string of the ref/nodeset value
     */
    function getPathFromControlElement(el, form, parentMug) {
        if(!el){
            return null;
        }
        var path = el.popAttr('ref'),
            nodeId, pathToTry;
        if(!path){
            path = el.popAttr('nodeset');
        }
        if (!path) {
            // attempt to support sloppy hand-written forms
            nodeId = el.popAttr('bind');
            if (nodeId) {
                pathToTry = processPath(nodeId);
                if (!form.getMugByPath(pathToTry)) {
                    form.parseWarnings.push("Ambiguous bind: " + nodeId);
                } else {
                    path = pathToTry;
                }
            }
        }
        path = path || nodeId || null;
        if (path && path[0] !== "/") {
            // make path absolute
            if (parentMug) {
                var parentPath = parentMug.getAbsolutePath();
                if (parentPath) {
                    path = parentPath + "/" + path;
                }
            } else {
                path = form.getBasePath() + path;
            }
        }
        return path;
    }

    function parseControlTree (form, controlsTree) {
        function eachFunc(cEl, parentMug) {
            var $cEl = $(cEl),
                mug = parseControlElement(form, $cEl, parentMug);

            form.controlTree.insertMug(mug, 'into', parentMug);

            if (mug.__className === "ReadOnly") {
                return;
            }
            if (mug.options.controlNodeChildren) {
                mug.options.controlNodeChildren($cEl).each(function () {
                    eachFunc(this, mug);
                });
            }
            form.vellum.handleMugParseFinish(mug);
        }
        controlsTree.each(function () {
            eachFunc(this, null);
        });
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

        if (parsed.initial_context === xpathmodels.XPathInitialContextEnum.RELATIVE) {
            parsed.steps.splice(0, 0, xpathmodels.XPathStep({axis: "child", test: rootNodeName}));
            parsed.initial_context = xpathmodels.XPathInitialContextEnum.ROOT;
        }
        newPath = parsed.toXPath();
        return newPath;
    }

    function parseBindList (form, bindList) {
        var rootNodeName = form.dataTree.getRootNode().getID();

        bindList.each(function () {
            var el = $(this),
                path = el.popAttr('nodeset') || el.popAttr('ref');

            form.vellum.parseBindElement(
                form, el, processPath(path, rootNodeName));
        });
    }

    function parseBindElement (form, el, mugPath) {
        var mug = form.getMugByPath(mugPath),
            path = el.popAttr('nodeset') || el.popAttr('ref'),
            Itext = form.vellum.data.javaRosa.Itext;
        
        if(!mug){
            form.parseWarnings.push(
                "Bind Node [" + path + "] found but has no associated " +
                "Data node. This bind node will be discarded!");
            return;
        }

        var attrs = {
            relevantAttr: el.popAttr('relevant'),
            calculateAttr: el.popAttr('calculate'),
            constraintAttr: el.popAttr('constraint'),
            dataType: el.popAttr('type'),
            requiredAttr: parseBoolAttributeValue(el.popAttr('required')),
            preload: lookForNamespaced(el, "preload"),
            preloadParams: lookForNamespaced(el, "preloadParams")
        };

        // normalize this dataType ('int' and 'integer' are both valid).
        if(attrs.dataType && attrs.dataType.toLowerCase() === 'xsd:integer') { 
            attrs.dataType = 'xsd:int';
        }

        var constraintMsg = lookForNamespaced(el, "constraintMsg"),
            constraintItext = getITextReference(constraintMsg);

        if (constraintItext) {
            attrs.constraintMsgItextID = Itext.getOrCreateItem(constraintItext);
        } else {
            attrs.constraintMsgItextID = Itext.createItem("");
            attrs.constraintMsgAttr = constraintMsg;    
        }

        attrs.rawBindAttributes = getAttributes(el);
      
        mug.p.setAttrs(attrs);
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

    return {
        init: init,
        parseXForm: parseXForm,
        parseDataElement: parseDataElement,
        parseBindElement: parseBindElement,
        getPathFromControlElement: getPathFromControlElement,
        makeControlOnlyMugAdaptor: makeControlOnlyMugAdaptor,
        makeMugAdaptor: makeMugAdaptor
    };
});
