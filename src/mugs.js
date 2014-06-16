define([
    'vellum/widgets',
    'vellum/util',
    'classy',
    'underscore',
], function (
    widgets,
    util,
    Class,
    underscore
) {
    var validateRule = function (ruleKey, ruleValue, testingObj, blockName, mug) {
        var presence = ruleValue.presence,
            retBlock = {
                result: 'pass'
            };

        if (presence === 'required' && !testingObj) {
            retBlock.result = 'fail';
            retBlock.resultMessage = '"' + ruleKey + '" value is required in:' + blockName + ', but is NOT present!';
        } else if (presence === 'notallowed' && testingObj) {
            retBlock.result = 'fail';
            retBlock.resultMessage = '"' + ruleKey + '" IS NOT ALLOWED IN THIS OBJECT in:' + blockName;
        }

        if (retBlock.result !== "fail" && ruleValue.validationFunc) {
            var funcRetVal = ruleValue.validationFunc(mug);
            if (funcRetVal !== 'pass') {
                retBlock.result = 'fail';
                retBlock.resultMessage = funcRetVal;
            }
        }

        return retBlock;
    };

    var MugElement = Class.$extend({
        __init__: function (options) {
            this.__spec = options.spec;
            this.__mug = options.mug;
            this.__name = options.name;
        },
        setAttr: function (attr, val, overrideImmutable) {
            // todo: replace all direct setting of element properties with this

            var spec = this.__spec[attr];

            // only set attr if spec allows this attr, except if mug is a
            // DataBindOnly (which all mugs are before the control block has been
            // parsed) 
            if (!(attr.indexOf('_') !== 0 && spec && 
                  (overrideImmutable || !spec.immutable) && 
                      (spec.presence !== 'notallowed' || 
                       this.__mug.__className === 'DataBindOnly')))
            {
                return;
            }

            // avoid potential duplicate references (e.g., itext items)
            // todo: callers should probably handle this instead
            if (val && typeof val === "object") {
                if ($.isPlainObject(val)) {
                    val = $.extend(true, {}, val);
                } else {
                    // All non-plain objects must provide a clone method,
                    // otherwise there could be circular references.  It can
                    // simply return the same object if it's safe.
                    val = val.clone();
                }
            }
            this[attr] = val;
            this.__mug.form.fire({
                type: 'change',
                mug: this.__mug
            });
        },
        setAttrs: function (attrs, overrideImmutable) {
            var _this = this;
            _(attrs).each(function (val, attr) {
                _this.setAttr(attr, val, overrideImmutable);
            });
        },
        getErrors: function () {
            var _this = this,
                errors = [];

            // get only properties that have been manually set on the instance
            _(Object.getOwnPropertyNames(this)).each(function (key) {
                // allow "_propertyName" convention for system properties and $
                // classy properties
                if (key.indexOf('_') === 0 || key.indexOf('$') === 0) {
                    return;
                }

                var rule = _this.__spec[key];

                // internal check that should never fail / get displayed to the user
                if (!rule && _this[key]) {
                    errors.push(
                        "{element} has property '" + key + 
                        "' but no rule is present for that property.");
                    return;
                } else if (rule) {
                    var result = validateRule(key, rule, _this[key], _this.__name, _this.__mug);
                    if (result.result === 'fail') {
                        errors.push(result.resultMessage);
                    }
                }
            });
            return errors;
        }
    });

    // a wrapper for object properties that triggers the form change event when
    // sub-properties are changed
    function BoundPropertyMap(form, data) {
        this._form = form;
        this._data = data || {};
    }
    BoundPropertyMap.prototype.clone = function () {
        return new BoundPropertyMap(this._form, this._data);
    };
    BoundPropertyMap.prototype.setAttr = function (name, val) {
        this._data[name] = val;
        this._form.fire({
            type: 'change'
        });
    };
    BoundPropertyMap.prototype.getAttr = function (name, default_) {
        if (name in this._data) {
            return this._data[name];
        } else {
            return default_;
        }
    };
        
    var validateElementName = function (value, displayName) {
        if (!util.isValidElementName(value)) {
            return value + " is not a legal " + displayName + ". Must start with a letter and contain only letters, numbers, and '-' or '_' characters.";
        }
        return "pass";            
    };

    var validationFuncs = {
        //should be used to figure out the logic for label, defaultLabel, labelItext, etc properties
        nodeID: function (mug) {
            var qId = mug.dataElement.nodeID;
            var res = validateElementName(qId, "Question ID");
            if (res !== "pass") {
                return res;
            }
            return "pass";
        }, 
        // todo: fix itext plugin abstraction barrier break here
        label: function (mug) {
            var controlBlock, hasLabel, hasLabelItextID, missing, hasItext;
            controlBlock = mug.controlElement;
            hasLabel = Boolean(controlBlock.label);
            var itextBlock = controlBlock ? mug.controlElement.labelItextID : null;
            hasLabelItextID = itextBlock && (typeof itextBlock.id !== "undefined");

            if (hasLabelItextID && !util.isValidAttributeValue(itextBlock.id)) {
                return itextBlock.id + " is not a valid Itext ID";
            }
            hasItext = itextBlock && itextBlock.hasHumanReadableItext();
            
            if (hasLabel) {
                return 'pass';
            } else if (!hasLabel && !hasItext && (mug.controlElement.__spec.label.presence === 'optional' || 
                       mug.controlElement.__spec.labelItextID.presence === 'optional')) {
                //make allowance for questions that have label/labelItextID set to 'optional'
                return 'pass';
            } else if (hasLabelItextID && hasItext) {
                return 'pass';
            } else if (hasLabelItextID && !hasItext) {
                missing = 'a display label';
            } else if (!hasLabel && !hasLabelItextID) {
                missing = 'a display label ID';
            } else if (!hasLabel) {
                missing = 'a display label';
            } else if (!hasLabelItextID) {
                missing = 'a display label ID';
            }
            return 'Question is missing ' + missing + ' value!';
        },
        defaultValue: function (mug) {
            if (/\s/.test(mug.controlElement.defaultValue)) {
                return "Whitespace in values is not allowed.";
            } 
            return "pass";
        }
    };

    var baseDataSpecs = {
        nodeID: {
            editable: 'w',
            visibility: 'visible',
            presence: 'required',
            lstring: 'Question ID',
            validationFunc : validationFuncs.nodeID
        },
        dataValue: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            lstring: 'Default Data Value'
        },
        xmlnsAttr: {
            editable: 'w',
            visibility: 'visible',
            presence: 'notallowed',
            lstring: "Special Hidden Value XMLNS attribute"
        }
    };

    var baseBindSpecs = {
        nodeID: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            lstring: 'Bind Node ID'
        },
        // part of the Mug type definition, so it's immutable
        dataType: {
            editable: 'w',
            immutable: true,
            visibility: 'hidden',
            presence: 'optional',
            lstring: 'Data Type'
        },
        relevantAttr: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            widget: widgets.xPath,
            xpathType: "bool",
            lstring: 'Display Condition'
        },
        calculateAttr: {
            editable: 'w',
            // only show calculate condition for non-data nodes if it already
            // exists.  It's a highly discouraged use-case because the user will
            // think they can edit an input when they really can't, but we
            // shouldn't break existing forms doing this.
            visibility: 'visible_if_present',
            presence: 'optional',
            widget: widgets.xPath,
            xpathType: "generic",
            lstring: 'Calculate Condition'
        },
        constraintAttr: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            widget: widgets.xPath,
            xpathType: "bool",
            lstring: 'Validation Condition'
        },
        // non-itext constraint message
        constraintMsgAttr: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            validationFunc : function (mug) {
                var bindBlock = mug.bindElement;
                var hasConstraint = (typeof bindBlock.constraintAttr !== 'undefined');
                var hasConstraintMsg = (bindBlock.constraintMsgAttr || 
                                        (bindBlock.constraintMsgItextID && bindBlock.constraintMsgItextID.id));
                if (hasConstraintMsg && !hasConstraint) {
                    return 'ERROR: You cannot have a Validation Error Message with no Validation Condition!';
                } else {
                    return 'pass';
                }
            },
            lstring: 'Validation Error Message'
        },
        requiredAttr: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            lstring: "Is this Question Required?",
            widget: widgets.checkbox
        },
        nodeset: {
            editable: 'r',
            visibility: 'hidden',
            presence: 'optional' //if not present one will be generated... hopefully.
        }
    };

    var baseControlSpecs = {
        // part of the Mug type definition, so it's immutable
        tagName: {
            editable: 'r',
            immutable: true,
            visibility: 'hidden',
            presence: 'required'
        },
        appearance: {
            editable: 'r',
            visibility: 'hidden',
            presence: 'optional',
            lstring: 'Appearance Attribute'
        },
        label: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            validationFunc : validationFuncs.label,
            lstring: "Default Label"
        },
        hintLabel: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            lstring: "Hint Label"
        },
    };

    var copyAndProcessSpec = function (spec, mug) {
        spec = $.extend(true, {}, spec);
        _.each(spec, function (elementSpec, name) {
            if (elementSpec) {
                _.each(elementSpec, function (propertySpec, name) {
                    if (_.isFunction(propertySpec) && name !== 'validationFunc' && 
                        name !== 'widget') 
                    {
                        var val = propertySpec(mug);
                        if (val) {
                            elementSpec[name] = val;
                        } else {
                            delete elementSpec[name];
                        }
                    }
                });
            }
        });
        return spec;
    };
    /**
     * A mug is the standard object within a form and represents the combined
     * Data, Bind and Control elements.
     */
    var BaseMug = Class.$extend({
        // whether you can change to or from this question's type in the UI
        isTypeChangeable: true,
        limitTypeChangeTo: false,
        // controls whether delete button shows up - you can still delete a
        // mug's ancestor even if it's not removeable
        isRemoveable: true,
        isCopyable: true,
        isODKOnly: false,
        maxChildren: -1,
        // todo: actually don't couple type definitions and state using
        // inheritance 
        afterInsert: function (form, mug) {},
        __init__: function (form, baseSpec) {
            var _this = this;
            // todo: it would be good to encapsulate the testing whether
            // elements and properties in a spec are functions parameterized on
            // mug, and executing them, in a single function, rather than below
            // and in the MugElement constructor
            this.__spec = this.processSpec(copyAndProcessSpec(baseSpec, this));
            this.form = form;

            _(this.__spec).each(function (spec, name) {
                _this[name] = (!spec) ? null : new MugElement({
                    spec: spec,
                    mug: _this,
                    name: name
                });
            });

            // set question id if it isn't set
            if (this.dataElement && this.bindElement && 
                (!this.dataElement.nodeID || !this.bindElement.nodeID))
            {
                var nodeID = (this.dataElement.nodeID || this.bindElement.nodeID || 
                              form.generate_question_id());
                this.dataElement.nodeID = this.bindElement.nodeID = nodeID;
            }

            this.ufid = util.get_guid();
            util.eventuality(this);
        },
        copyAttrs: function (sourceMug, overrideImmutable) {
            // Copying _rawAttributes here is a hack.  It should be part of the
            // property definition system.
            if (this.dataElement && sourceMug.dataElement) {
                this.dataElement.setAttrs(sourceMug.dataElement, overrideImmutable);
                this.dataElement._rawAttributes = sourceMug.dataElement._rawAttributes;
            }
            if (this.bindElement && sourceMug.bindElement) {
                this.bindElement.setAttrs(sourceMug.bindElement, overrideImmutable);
                this.bindElement._rawAttributes = sourceMug.bindElement._rawAttributes;
            }
            if (this.controlElement && sourceMug.controlElement) {
                this.controlElement.setAttrs(sourceMug.controlElement, overrideImmutable);
                this.controlElement._rawAttributes = sourceMug.controlElement._rawAttributes;
            }
        },
        processSpec: function (spec) {
            return spec;
        },
        getBindElementID: function () {
            if (this.bindElement) {
                return this.bindElement.nodeID;
            } else {
                return null;
            }
        },
        getDataElementID: function () {
            if (this.dataElement) {
                return this.dataElement.nodeID;
            } else {
                return null;
            }
        },
        getAppearanceAttribute: function () {
            return (this.controlElement && this.controlElement.appearance) ? (this.controlElement.appearance) : null;
        },
        setAppearanceAttribute: function (attrVal) {
            this.controlElement.appearance = attrVal;
        },
        // get a property definition by a /-delimited string or list index
        // Returns null if this mug doesn't have a definition for that property.
        getPropertyDefinition: function (index) {
            if (!(index instanceof Array)) {
                index = index.split("/");
            } 
            // this will raise a reference error if you give it a bad value
            var ret = this.__spec[index[0]];
            for (var i = 1; i < index.length; i++) {
                if (!ret) {
                    return null;
                }
                ret = ret[index[i]];
            }
            return ret;
        },
        // get a property value by a /-delimited string or list index
        // Returns null if this mug doesn't have the element on which the
        // property is defined.
        getPropertyValue: function (index) {
            // get a propery value by a string or list index
            // assumes strings are split by the "/" character
            if (!(index instanceof Array)) {
                index = index.split("/");
            } 
            // this will raise a reference error if you give it a bad value
            var ret = this[index[0]];
            for (var i = 1; i < index.length; i++) {
                if (!ret) {
                    return null;
                }
                ret = ret[index[i]];
            }
            return ret;
        },
        getIcon: function () {
            return this.icon;
        },
        getErrors: function () {
            var _this = this,
                errors = [];

            _(this.__spec).each(function (spec, name) {
                if (spec) {
                    var messages = _(_this[name].getErrors())
                        .map(function (message) {
                            return message.replace("{element}", name);
                        });
                    errors = errors.concat(messages);
                }
            });

            return errors;
        },
        isValid: function () {
            return !this.getErrors().length;
        },
        getDefaultItextRoot: function () {
            if (this.__className === "Item") {
                return this.parentMug.getDefaultItextRoot() + "-" + this.controlElement.defaultValue;
            } else {
                return this.form.getAbsolutePath(this, true).slice(1);
            }
        },
        
        getDefaultLabelItextId: function () {
            // Default Itext ID
            return this.getDefaultItextRoot() + "-label";
        },
        
        /*
         * Gets a default label, auto-generating if necessary
         */
        getDefaultLabelValue: function () {
            if (this.controlElement && this.controlElement.label) {
                return this.controlElement.label;
            } 
            else if (this.dataElement) {
                return this.dataElement.nodeID;
            } else if (this.bindElement) {
                return this.bindElement.nodeID;
            } else if (this.__className === "Item") {
                return this.controlElement.defaultValue;
            } else {
                // fall back to generating an ID
                // todo: return null, handle in caller
                return this.form.generate_item_label();
            } 
        },
        
        /*
         * Gets the actual label, either from the control element or an empty
         * string if not found.
         */
        getLabelValue: function () {
            if (this.controlElement.label) {
                return this.controlElement.label;
            } else {
                return "";
            } 
        },
        
        getDefaultLabelItext: function (defaultValue) {
            var formData = {},
                Itext = this.form.vellum.data.javaRosa.Itext,
                defaultLang = Itext.getDefaultLanguage();
            formData[defaultLang] = defaultValue;
            // todo: plugin abstraction barrier
            return new this.form.vellum.data.javaRosa.ItextItem({
                id: this.getDefaultLabelItextId(),
                forms: [new this.form.vellum.data.javaRosa.ItextForm({
                            name: "default",
                            data: formData,
                            itextModel: Itext
                        })],
                itextModel: Itext
            });
        },
        
        // Add some useful functions for dealing with itext.
        setItextID: function (val) {
            if (this.controlElement) {
                this.controlElement.labelItextID.id = val;
            }
        },
        
        getItext: function () {
            if (this.controlElement) {
                return this.controlElement.labelItextID;
            } 
        },
        // legacy (or maybe this is actually useful as a generic thing)
        setPropertyValue: function (element, property, val) {
            var prev = this[element][property],
                _this = this;

            if (prev === val) {
                return;
            }

            // short-circuit the property changing, the UI will alert the user
            // if they try to switch questions without first entering a valid
            // value
            if (property === "nodeID") {
                if (this.form.getMugChildByNodeID(this.parentMug, val)) {
                    this.form.vellum.setUnsavedDuplicateNodeId(val);
                    return;
                } else {
                    this.form.vellum.setUnsavedDuplicateNodeId(false);
                }
            }

            this[element][property] = val;
            this.form.handleMugPropertyChange(this, {
                property: property,
                element: element,
                val: val,
                previous: prev,
                mugUfid: this.ufid
            });

            // legacy, enables auto itext ID behavior, don't add additional
            // dependencies on this code.  Some sort of data binding would be
            // better. 
            this.fire({
                type: 'property-changed',
                property: property,
                element: element,
                val: val,
                previous: prev,
                mugUfid: this.ufid
            });


        },
        getNodeID: function () {
            var nodeID;

            // todo: there is no reason to have two nodeID properties.  remove
            // bindElement's
            if(this.bindElement) {
                nodeID = this.bindElement.nodeID;
            }
            if(!nodeID){
                if(this.dataElement) {
                    nodeID = this.dataElement.nodeID;
                }
            }
            return nodeID || this.controlElement.defaultValue;
        },
        getAbsolutePath: function () {
            return this.form.getAbsolutePath(this);
        },
        getDisplayName: function (lang) {
            var itextItem, cEl, disp, Itext;
            if (this.__className === "ReadOnly") {
                return "Unknown (read-only) question type";
            }
            if (this.__className === "Itemset") {
                return "External Data";
            }

            cEl = this.controlElement;
            Itext = this.form.vellum.data.javaRosa.Itext;

            if(cEl) {
                itextItem = cEl.labelItextID;
            }

            if (!itextItem) {
                return this.getNodeID();
            }
            lang = this.form.vellum.data.core.currentItextDisplayLanguage || Itext.getDefaultLanguage();

            if(!lang) {
                return 'No Translation Data';
            }

            disp = itextItem.getValue("default", lang);
            if (disp) {
                return disp;
            }

            return this.getNodeID();
        },
        // todo: move these into javarosa
        getItextAutoID: function (propertyPath) {
            var isSelectItem = (this.__className === "Item"),
                rootId = isSelectItem && this.parentMug ?
                    this.parentMug.getDefaultItextRoot() + "-" :
                    "",
                nodeId = isSelectItem ?
                    this.controlElement.defaultValue || "null" :
                    this.getDefaultItextRoot(),
                itextType = propertyPath.replace("ItextID", "");
       
            return rootId + nodeId + "-" + itextType;
        },
        setItextId: function (propertyPath, id, unlink) {
            var itext = this.getPropertyValue(propertyPath),
                pieces = propertyPath.split('/');

            if (id !== itext.id) {
                if (unlink) {
                    itext = $.extend(true, {}, itext);
                    this.form.vellum.data.javaRosa.Itext.addItem(itext);
                }

                itext.id = id;
                // Is this necessary, since itext is a reference?
                // It probably triggers handlers.
                this.setPropertyValue(
                    pieces[0], 
                    pieces[1],
                    itext,
                    this
                );
            }
        },
        unlinkItext: function () {
            var _this = this;
            _.each([
                "controlElement/labelItextID",
                "bindElement/constraintMsgItextID",
                "controlElement/hintItextID"
            ], function (path) {
                var val = _this.getPropertyValue(path);
                // items don't have a bindElement
                if (val && val.id) {
                    var id = _this.getItextAutoID(path.split('/')[1]);
                    _this.setItextId(path, id, true);
                }
            });
        }
    });

    // The use of inheritance here is a convenient way to be DRY about shared
    // properties of mugs.  getXXSpec() methods could simply be replaced with
    // generating the spec at the time of class definition by explicitly
    // extending the spec of the super class.  These classes should absolutely
    // not be used to implement any sort of inheritance-based interface.
    var DataBindOnly = BaseMug.$extend({
        typeName: 'Hidden Value',
        icon: 'icon-vellum-variable',
        isTypeChangeable: false,
        processSpec: function (spec) {
            spec.dataElement.xmlnsAttr.presence = "optional";
            spec.controlElement = null;
            var b = spec.bindElement;
            b.requiredAttr.presence = "notallowed";
            b.constraintAttr.presence = "notallowed";
            b.calculateAttr.visibility = "visible";
            return spec;
        }
    });
    
    var ReadOnly = BaseMug.$extend({
        processSpec: function () {
            spec.dataElement = null;
            spec.bindElement = null;
            spec.controlElement = {
                // virtual property used to get a widget
                readonlyControl: {
                    widget: widgets.readOnlyControl
                }
            };
            return spec;
        }
    });

    var TextQuestion = BaseMug.$extend({
        typeName: "Text",
        icon: "icon-vellum-text",
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "xsd:string";
        }
    });

    var PhoneNumber = TextQuestion.$extend({
        typeName: 'Phone Number or Numeric ID',
        icon: 'icon-signal',
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.appearance = "numeric";
        }
    });

    var Secret = BaseMug.$extend({
        typeName: 'Password',
        icon: 'icon-key',
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "secret";
            this.bindElement.dataType = "xsd:string";
        }
    });

    var Int = BaseMug.$extend({
        typeName: 'Integer',
        icon: 'icon-vellum-numeric',
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "xsd:int";
        }
    });

    var Audio = BaseMug.$extend({
        typeName: 'Audio Capture',
        icon: 'icon-vellum-audio-capture',
        isODKOnly: true,
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "upload";
            this.controlElement.mediaType = "audio/*"; /* */
            this.bindElement.dataType = "binary";
        },
        processSpec: function (spec) {
            spec.controlElement.mediaType = {
                lstring: 'Media Type',
                visibility: 'visible',
                editable: 'w',
                presence: 'required'
            };
            return spec;
        }
    });

    var Image = Audio.$extend({
        typeName: 'Image Capture',
        icon: 'icon-camera',
        isODKOnly: true,
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "upload";
            this.controlElement.mediaType = "image/*"; /* */
            this.bindElement.dataType = "binary";
        }
    });

    var Video = Audio.$extend({
        typeName: 'Video Capture',
        icon: 'icon-facetime-video',
        isODKOnly: true,
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "upload";
            this.controlElement.mediaType = "video/*"; /* */
            this.bindElement.dataType = "binary";
        }
    });

    var Geopoint = BaseMug.$extend({
        typeName: 'GPS',
        icon: 'icon-map-marker',
        isODKOnly: true,
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "geopoint";
        }
    });

    var AndroidIntent = BaseMug.$extend({
        typeName: 'Android App Callout',
        icon: 'icon-vellum-android-intent',
        isODKOnly: true,
        isTypeChangeable: false,
        intentTag: null,
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "intent";
        },
        processSpec: function (spec) {
            spec.controlElement = $.extend(spec.controlElement, {
                androidIntentAppId: {
                    visibility: 'visible',
                    widget: widgets.androidIntentAppId
                },
                androidIntentExtra: {
                    visibility: 'visible',
                    widget: widgets.androidIntentExtra
                },
                androidIntentResponse: {
                    visibility: 'visible',
                    widget: widgets.androidIntentResponse
                }
            });
            return spec;
        },
        // todo: move to spec system
        getAppearanceAttribute: function () {
            return 'intent:' + this.dataElement.nodeID;
        }
    });

    var Barcode = BaseMug.$extend({
        typeName: 'Barcode Scan',
        icon: 'icon-barcode',
        isODKOnly: true,
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "barcode";
        }
    });

    var Date = BaseMug.$extend({
        typeName: 'Date',
        icon: 'icon-calendar',
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "xsd:date";
        }
    });

    var DateTime = BaseMug.$extend({
        typeName: 'Date and Time',
        icon: 'icon-vellum-datetime',
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "xsd:dateTime";
        }
    });

    var Time = BaseMug.$extend({
        typeName: 'Time',
        icon: 'icon-time',
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "xsd:time";
        }
    });

    var Long = Int.$extend({
        typeName: 'Long',
        icon: 'icon-vellum-long',
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.bindElement.dataType = "xsd:long";
        }
    });

    var Double = Int.$extend({
        typeName: 'Decimal',
        icon: 'icon-vellum-decimal',
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.bindElement.dataType = "xsd:double";
        }
    });

    var Item = BaseMug.$extend({
        typeName: 'Choice',
        icon: 'icon-circle-blank',
        isTypeChangeable: false,
        getIcon: function () {
            if (this.parentMug.__className === "Select") {
                return 'icon-circle-blank';
            } else {
                return 'icon-check-empty';
            }
        },
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "item";
            this.controlElement.defaultValue = this.form.generate_item_label();
        },
        processSpec: function (spec) {
            var c = spec.controlElement;
            delete spec.dataElement;
            delete spec.bindElement;
            c.defaultValue = {
                lstring: 'Choice Value',
                visibility: 'visible',
                editable: 'w',
                presence: 'required',
                validationFunc: validationFuncs.defaultValue
            };
            c.hintLabel.presence = 'notallowed';
            c.hintItextID.presence = 'notallowed';
            return spec;
        }
    });

    var Trigger = BaseMug.$extend({
        typeName: 'Label',
        icon: 'icon-tag',
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "trigger";
            this.controlElement.showOKCheckbox = false;
        },
        processSpec: function (spec) {
            spec.bindElement.dataType.presence = 'notallowed';
            spec.dataElement.dataValue.presence = 'optional';

            spec.controlElement.showOKCheckbox = {
                lstring: 'Add confirmation checkbox',
                help: 'Add a confirmation message and checkbox below the label. Available on Android only.',
                editable: 'w',
                visibility: 'visible',
                presence: 'optional',
                widget: widgets.checkbox
            };

            return spec;
        },
        getAppearanceAttribute: function () {
            return this.controlElement.showOKCheckbox ? null : 'minimal';
        }
    });

    var BaseSelect = BaseMug.$extend({
        validChildTypes: ["Item"],
        afterInsert: function (form, mug) {
            var item = Item.prototype.__className;
            form.createQuestion(mug, 'into', item, true);
            form.createQuestion(mug, 'into', item, true);
        }
    });

    var MSelect = BaseSelect.$extend({
        typeName: 'Multiple Answer',
        icon: 'icon-vellum-multi-select',
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "select";
        },
        processSpec: function (spec) {
            spec.bindElement.dataType.visibility = "hidden";
            return spec;
        },
        defaultOperator: "selected"
    });

    var Select = MSelect.$extend({
        typeName: 'Single Answer',
        icon: 'icon-vellum-single-select',
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "select1";
        },
        defaultOperator: null
    });

    var Group = BaseMug.$extend({
        typeName: 'Group',
        icon: 'icon-folder-open',
        isSpecialGroup: true,
        isTypeChangeable: false,
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "group";
        },
        processSpec: function (spec) {
            spec.controlElement.hintLabel.presence = "notallowed";
            spec.bindElement.dataType.presence = "notallowed";
            spec.bindElement.calculateAttr.presence = "notallowed";
            spec.bindElement.constraintAttr.presence = "notallowed";
            spec.dataElement.dataValue.presence = "notallowed";
            return spec;
        }
    });
    
    // This is just a group, but appearance = 'field-list' displays it as a list
    // of grouped questions.  It's a separate question type because it can't
    // nest other group types and it has a very different end-user functionality
    var FieldList = Group.$extend({
        typeName: 'Question List',
        icon: 'icon-reorder',
        isSpecialGroup: true,
        isTypeChangeable: false,
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "group";
            this.setAppearanceAttribute('field-list');
        },
    });

    var Repeat = Group.$extend({
        typeName: 'Repeat Group',
        icon: 'icon-retweet',
        isSpecialGroup: true,
        isTypeChangeable: false,
        __init__: function (form, baseSpec) {
            this.$super(form, baseSpec);
            this.controlElement.tagName = "repeat";
        },
        processSpec: function (spec) {
            spec.controlElement = $.extend(spec.controlElement, {}, {
                repeat_count: {
                    lstring: 'Repeat Count',
                    visibility: 'visible',
                    editable: 'w',
                    presence: 'optional',
                    widget: widgets.droppableText
                },
                no_add_remove: {
                    lstring: 'Disallow Repeat Add and Remove?',
                    visibility: 'visible',
                    editable: 'w',
                    presence: 'optional',
                    widget: widgets.checkbox
                }
            });
            return spec;
        }
    });
   

    function MugTypesManager(baseSpec, mugTypes) {
        var _this = this;
        this.spec = baseSpec;
        this.auxiliaryTypes = mugTypes.auxiliary || {};
        this.normalTypes = mugTypes.normal || {};

        this.allTypes = $.extend({}, this.auxiliaryTypes, this.normalTypes);

        var allTypeNames = _.keys(this.allTypes),
            innerChildTypeNames = _.without.apply(_, 
                  [allTypeNames, 'DataBindOnly'].concat(
                      _.keys(this.auxiliaryTypes))),
            nonGroupTypeNames = _.without(innerChildTypeNames,
                'Group', 'Repeat', 'FieldList');

        _.each(this.auxiliaryTypes, function (type) {
            type.prototype.validChildTypes = [];
        });

        _.each(this.normalTypes, function (Mug, name) {
            // had issues with trying to do instanceof involving Mug, so using name
            var validChildTypes;
            if (name === "Group" || name === "Repeat") {
                validChildTypes = innerChildTypeNames;
            } else if (name === "FieldList") {
                validChildTypes = nonGroupTypeNames;
            } else {
                validChildTypes = [];
            }

            // TODO: figure out how to get isinstance working
            if (!Mug.prototype.validChildTypes) {
                Mug.prototype.validChildTypes = validChildTypes;
            }
        });

        _.each(this.allTypes, function (Mug, name) {
            Mug.prototype.__className = name;

            // set on this for easy access
            _this[name] = Mug;
        });
    }
    MugTypesManager.prototype = {
        make: function () {
            var args = Array.prototype.slice.call(arguments),
                MugType = this.allTypes[args[0]],
                mugArgs = args.slice(1).concat([this.spec]);
            return applyToConstructor(MugType, mugArgs);
        }
    };

    function applyToConstructor(ctor, args) {
        var new_obj = Object.create(ctor.prototype);
        var ctor_ret = ctor.apply(new_obj, args);

        // Some constructors return a value; make sure to use it!
        return ctor_ret !== undefined ? ctor_ret: new_obj;
    }

    return {
        BaseMug: BaseMug,
        baseMugTypes: {
            normal: {
                "AndroidIntent": AndroidIntent,
                "Audio": Audio,
                "Barcode": Barcode,
                "DataBindOnly": DataBindOnly,
                "Date": Date,
                "DateTime": DateTime,
                "Double": Double,
                "FieldList": FieldList,
                "Geopoint": Geopoint,
                "Group": Group,
                "Image": Image,
                "Int": Int,
                "Long": Long,
                "MSelect": MSelect,
                "PhoneNumber": PhoneNumber,
                "ReadOnly": ReadOnly,
                "Repeat": Repeat,
                "Secret": Secret,
                "Select": Select,
                "Text": TextQuestion,
                "Time": Time,
                "Trigger": Trigger,
                "Video": Video
            },
            auxiliary: {
                "Item": Item
            }
        },
        MugTypesManager: MugTypesManager,
        baseDataSpecs: baseDataSpecs,
        baseBindSpecs: baseBindSpecs,
        baseControlSpecs: baseControlSpecs,
        BoundPropertyMap: BoundPropertyMap
    };
});
