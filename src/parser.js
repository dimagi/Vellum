define([
    'vellum/form',
    'vellum/util',
    'vellum/xml',
    'jquery',
    'underscore',
    'xpath',
    'xpathmodels'
], function (
    form_,
    util,
    xml,
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
            data = $(instances[0]).children(),
            setValues = head.find('> model > setvalue');

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
        form.updateKnownInstances();
        
        // TODO! adapt
        if(data.length === 0) {
            form.parseErrors.push(
                'No Data block was found in the form.  Please check that your form is valid!');
        }
       
        parseDataTree(form, data[0]);
        parseBindList(form, binds);

        parseSetValues(form, setValues);

        var controls = xml.find('h\\:body, body').children();
        parseControlTree(form, controls);

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

        form.isLoadingXForm = false;
        return form;
    }

    // DATA PARSING FUNCTIONS
    function parseDataTree (form, dataEl) {
        var root = $(dataEl),
            tree = form.tree,
            recFunc;

        recFunc = function (parentMug) {
            var mug = form.vellum.parseDataElement(form, this, parentMug),
                children = mug.options.parseDataNode(mug, $(this), parentMug);
            tree.insertMug(mug, 'into', parentMug);
            // HACK fix abstraction broken by direct tree insert
            form._fixMugState(mug);
            children.each(function () {
                recFunc.call(this, mug);
            });
        };

        if(root.children().length === 0) {
            form.parseErrors.push(
                'Data block has no children elements! Please make sure your form is a valid JavaRosa XForm!'
            );
        }
        if (root[0]) {
            form.setFormID(root[0].tagName);
        } else {
            form.setFormID(DEFAULT_FORM_ID);
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

    function parseDataElement(form, el, parentMug, role) {
        var $el = $(el),
            nodeID = el.nodeName, 
            nodeVal = $el.children().length ? null : $el.text(),
            extraXMLNS = $el.popAttr('xmlns') || null;
        role = role || $el.attr('vellum:role');

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
        // add arbitrary attributes
        mug.p.rawDataAttributes = getAttributes(el);
        return mug;
    }

    function parseSetValues(form, setValues) {
        var rootNodeName = form.tree.getRootNode().getID();

        setValues.each(function () {
            var $el = $(this);
            form.vellum.parseSetValue(
                form, $el, processPath($el.attr('ref'), rootNodeName));
        });
    }

    function parseSetValue(form, el, path) {
        var mug = form.getMugByPath(path),
            event = el.attr('event'),
            ref = el.attr('ref'),
            value = el.attr('value');

        // HACK: hardcoding these as that's what setValue will support for now
        if (!mug || (event !== 'xforms-ready' && event !== 'jr-insert')) {
            form.addSetValue(event, ref, value);
        } else {
            mug.p.defaultValue = value;
        }
    }

    var lookForNamespaced = function (element, reference) {
        // due to the fact that FF and Webkit store namespaced
        // values slightly differently, we have to look in 
        // a couple different places.
        return element.popAttr("jr:" + reference) || 
               element.popAttr("jr\\:" + reference) || null;
    };

    function parseControlElement(form, $cEl, parentMug) {
        var tagName = $cEl[0].nodeName.toLowerCase(),
            appearance = $cEl.popAttr('appearance'),
            adapt, mug = null;

        var getAdaptor = form.vellum.getControlNodeAdaptorFactory(tagName);
        if (getAdaptor) {
            adapt = getAdaptor($cEl, appearance, form, parentMug);
        }
        if (!adapt) {
            // unknown question type
            adapt = makeReadOnlyAdaptor($cEl, appearance, form, parentMug);
        }

        if (!adapt.ignoreDataNode) {
            var path = adapt.path;
            if (!path) {
                path = getPathFromControlElement($cEl, form, parentMug);
            }
            mug = form.getMugByPath(path);
        }
        mug = adapt(mug, form);
        var node = form.tree.getNodeFromMug(mug);
        if (!node) {
            // insert control-only mug into the tree
            mug.options.isControlOnly = true; // TODO should not be mutating mug.options, check if this is necessary
            node = form.tree.insertMug(mug, 'into', parentMug);
            // HACK fix abstraction broken by direct tree insert
            form.mugMap[mug.ufid] = mug;
        } else if (node.parent.value !== parentMug) {
            mug.p.dataParent = node.parent.getAbsolutePath();
            node = form.tree.insertMug(mug, 'into', parentMug);
        }
        if (appearance) {
            mug.p.appearance = appearance;
        }

        if (!adapt.skipPopulate) {
            form.vellum.populateControlMug(mug, $cEl);

            // add any arbitrary attributes that were directly on the control
            mug.p.rawControlAttributes = getAttributes($cEl);
        }
        return node;
    }

    function populateControlMug(mug, $cEl) {
        var labelEl = $cEl.children('label'),
            hintEl = $cEl.children('hint');
        if (labelEl.length && mug.getPresence("label") !== 'notallowed') {
            var labelVal = xml.humanize(labelEl);
            if (labelVal) {
                mug.p.label = labelVal;
            }
        }
        if (hintEl.length && mug.getPresence("hintLabel") !== 'notallowed') {
            mug.p.hintLabel = xml.humanize(hintEl);
        }
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

    function makeReadOnlyAdaptor($cEl, appearance, form, parentMug) {
        var adapt = function (mug, form) {
            mug = makeMugAdaptor('ReadOnly')(mug, form);
            if ($cEl.length === 1 && $cEl[0].poppedAttributes) {
                // restore attributes removed during parsing
                _.each($cEl[0].poppedAttributes, function (val, key) {
                    $cEl.attr(key, val);
                });
            }
            mug.p.rawControlXML = $cEl;
            return mug;
        };
        adapt.skipPopulate = true;
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
                    mug.p.appearance = appearance;
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
                    var dataType = mug && mug.p.rawBindAttributes && mug.p.rawBindAttributes.type;
                    if (dataType) {
                        dataType = dataType.replace('xsd:',''); //strip out extraneous namespace
                        dataType = dataType.toLowerCase();
                        if (inputAdaptors.hasOwnProperty(dataType)) {
                            delete mug.p.rawBindAttributes.type;
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
                    var value = xml.humanize($cEl.children('value'));
                    if (value) {
                        mug.p.nodeID = value;
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
                            mug.p.rawRepeatAttributes = getAttributes(repeat);
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
                
    /**
     * Figures out what the xpath is of a control element
     * by looking at the ref or nodeset attributes.
     * @param el - a jquery-wrapped xforms control element.
     * @return - a string of the ref/nodeset value
     */
    function getPathFromControlElement(el, form, parentMug, noPop) {
        if(!el){
            return null;
        }
        var path = noPop ? el.attr('ref') : el.popAttr('ref'),
            nodeId, pathToTry;
        if(!path){
            path = noPop ? el.attr('nodeset') : el.popAttr('nodeset');
        }
        if (!path) {
            // attempt to support sloppy hand-written forms
            nodeId = noPop ? el.attr('bind') : el.popAttr('bind');
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
                var parentPath = parentMug.absolutePath;
                if (parentPath) {
                    path = parentPath + "/" + path;
                }
            } else {
                path = form.getBasePath() + path;
            }
        }
        return path;
    }

    function parseControlTree(form, controlsTree) {
        function controlGenerator(controlNodes, parentMug) {
            var i = 0, count = controlNodes.length;
            return function () {
                if (i >= count) {
                    return null;
                }
                var $cEl = $(controlNodes[i++]),
                    node = parseControlElement(form, $cEl, parentMug),
                    mug = node.value;
                if (mug.options.controlNodeChildren) {
                    merge(node, mug.options.controlNodeChildren($cEl));
                }
                return node;
            };
        }
        function makeGenerator(items) {
            var i = 0, count = items.length;
            return function () {
                return i < count ? items[i++] : null;
            };
        }
        function getID(node) {
            return node.value.ufid;
        }
        function merge(node, controlsTree) {
            // getID(child) must have a unique and stable return value
            // for each child for the duration of this function call
            var nextChild0 = makeGenerator(node.children),
                nextChild1 = controlGenerator(controlsTree, node.value),
                child0 = nextChild0(),
                child1 = nextChild1(),
                controls = [],
                seen = {},
                fixOrder = false;

            while (child1) {
                if (child0) {
                    if (child0 === child1) {
                        controls.push(child1);
                        child1 = nextChild1();
                    }
                    seen[getID(child0)] = null;
                    child0 = nextChild0();
                } else {
                    fixOrder = fixOrder || seen.hasOwnProperty(getID(child1));
                    controls.push(child1);
                    child1 = nextChild1();
                }
            }
            if (fixOrder) {
                node.children = _.union(controls, node.children);
            }
        }
        merge(form.tree.getRootNode(), controlsTree);
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
        } else {
            return path;
        }
        newPath = parsed.toXPath();
        return newPath;
    }

    function parseBindList (form, bindList) {
        var rootNodeName = form.tree.getRootNode().getID();

        bindList.each(function () {
            var el = $(this),
                path = el.popAttr('nodeset') || el.popAttr('ref');

            form.vellum.parseBindElement(
                form, el, processPath(path, rootNodeName));
        });
    }

    function parseBindElement (form, el, path) {
        var mug = form.getMugByPath(path);

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
            constraintMsgAttr: lookForNamespaced(el, "constraintMsg"),
            requiredAttr: parseBoolAttributeValue(el.popAttr('required')),
        };

        var raw = attrs.rawBindAttributes = getAttributes(el);

        // normalize type ('int' and 'integer' are both valid).
        if(raw.type && raw.type.toLowerCase() === 'xsd:integer') { 
            raw.type = 'xsd:int';
        }
      
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
        parseSetValue: parseSetValue,
        populateControlMug: populateControlMug,
        getAttributes: getAttributes,
        getPathFromControlElement: getPathFromControlElement,
        makeControlOnlyMugAdaptor: makeControlOnlyMugAdaptor,
        makeMugAdaptor: makeMugAdaptor
    };
});
