define([
    'jquery',
    'vellum/widgets',
    'vellum/util',
    'underscore',
], function (
    jquery,
    widgets,
    util,
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

    function MugElement (options) {
        this.__spec = options.spec;
        this.__mug = options.mug;
        this.__name = options.name;

        var copyFrom = options.copyFromElement;
        if (copyFrom) {
            this.setAttrs(copyFrom);
            // todo: make this part of the property system
            this._rawAttributes = copyFrom._rawAttributes;
        }
    }
    MugElement.prototype = {
        setAttr: function (attr, val, overrideImmutable) {
            // todo: replace all direct setting of element properties with this

            var spec = this.__spec[attr];

            // only set attr if spec allows this attr, except if mug is a
            // DataBindOnly (which all mugs are before the control block has been
            // parsed). Todo: this DataBindOnly exception is suspect.
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
    };

    // a wrapper for object properties that triggers the form change event when
    // sub-properties are changed
    function BoundPropertyMap(form, data) {
        this._form = form;
        this._data = data || {};
    }
    BoundPropertyMap.prototype = {
        clone: function () {
            return new BoundPropertyMap(this._form, this._data);
        },
        setAttr: function (name, val) {
            this._data[name] = val;
            this._form.fire({
                type: 'change'
            });
        },
        getAttr: function (name, default_) {
            if (name in this._data) {
                return this._data[name];
            } else {
                return default_;
            }
        }
    };
        
    var validateElementName = function (value, displayName) {
        if (!util.isValidElementName(value)) {
            return value + " is not a legal " + displayName + ". Must start with a letter and contain only letters, numbers, and '-' or '_' characters.";
        }
        return "pass";            
    };

    var baseDataSpecs = {
        nodeID: {
            editable: 'w',
            visibility: 'visible',
            presence: 'required',
            lstring: 'Question ID',
            validationFunc: function (mug) {
                var qId = mug.dataElement.nodeID;
                var res = validateElementName(qId, "Question ID");
                if (res !== "pass") {
                    return res;
                }
                return "pass";
            }
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
            lstring: "Default Label",
            // todo: fix itext plugin abstraction barrier break here
            validationFunc: function (mug) {
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
            }
        },
        hintLabel: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            lstring: "Hint Label"
        },
    };

    function copyAndProcessSpec(spec, mugOptions) {
        spec = $.extend(true, {}, spec);
        _.each(spec, function (elementSpec, name) {
            if (elementSpec) {
                _.each(elementSpec, function (propertySpec, name) {
                    if (_.isFunction(propertySpec) && name !== 'validationFunc' && 
                        name !== 'widget') 
                    {
                        var val = propertySpec(mugOptions);
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
    }

    /**
     * A question, containing data, bind, and control elements.
     */
    function Mug (options, form, baseSpec, copyFrom) {
        var _this = this;

        this.form = form;
        this.baseSpec = baseSpec;
        this.setOptions(options, copyFrom);

        this.ufid = util.get_guid();
        util.eventuality(this);
    }
    Mug.prototype = {
        // question-type specific properties, gets merged into when you change
        // the question type
        defaultOptions: {
            // whether you can change to or from this question's type in the UI
            isTypeChangeable: true,
            limitTypeChangeTo: false,
            // controls whether delete button shows up - you can still delete a
            // mug's ancestor even if it's not removeable
            isRemoveable: true,
            isCopyable: true,
            isODKOnly: false,
            maxChildren: -1,
            icon: null,
            afterInsert: function (form, mug) {},
            getAppearanceAttribute: function (mug) {
                return (mug.controlElement && mug.controlElement.appearance) ? 
                    mug.controlElement.appearance : null;
            },
            getIcon: function (mug) {
                return mug.options.icon;
            },
            processSpec: function (spec) {
                return spec;
            },
            init: function (mug, form, baseSpec) {}
        },
        // set or change question type
        setOptions: function (options, copyFrom) {
            var _this = this,
                copyFromMug = copyFrom || this;

            this.options = $.extend(true, {}, this.defaultOptions, options);

            // todo: it would be good to encapsulate the testing whether
            // elements and properties in a spec are functions parameterized on
            // mug, and executing them, in a single function, rather than below
            // and in the MugElement constructor
            this.__spec = this.options.processSpec(
                copyAndProcessSpec(this.baseSpec, this.options));

            _(this.__spec).each(function (spec, name) {
                _this[name] = spec ? new MugElement({
                    spec: spec,
                    mug: _this,
                    // copy properties from existing element
                    copyFromElement: copyFromMug[name],
                    name: name
                }) : null;
            });

            this.options.init(this, this.form, this.baseSpec);
            this.__className = this.options.__className;
        },
        getAppearanceAttribute: function () {
            return this.options.getAppearanceAttribute(this);
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
            return this.options.getIcon(this);
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
            var prev = this[element][property];

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

            if(this.dataElement) {
                nodeID = this.dataElement.nodeID;
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
    };

    var defaultOptions = Mug.prototype.defaultOptions;

    // The use of inheritance here is a convenient way to be DRY about shared
    // properties of mugs.  getXXSpec() methods could simply be replaced with
    // generating the spec at the time of class definition by explicitly
    // extending the spec of the super class.  These classes should absolutely
    // not be used to implement any sort of inheritance-based interface.
    var DataBindOnly = util.extend(defaultOptions, {
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
    
    var ReadOnly = util.extend(defaultOptions, {
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

    var Text = util.extend(defaultOptions, {
        typeName: "Text",
        icon: "icon-vellum-text",
        init: function (mug, form, baseSpec) {
            mug.controlElement.tagName = "input";
            mug.bindElement.dataType = "xsd:string";
        }
    });

    var PhoneNumber = util.extend(Text, {
        typeName: 'Phone Number or Numeric ID',
        icon: 'icon-signal',
        init: function (mug, form, baseSpec) {
            Text.init(mug, form, baseSpec);
            mug.controlElement.appearance = "numeric";
        }
    });

    var Secret = util.extend(defaultOptions, {
        typeName: 'Password',
        icon: 'icon-key',
        init: function (mug, form, baseSpec) {
            mug.controlElement.tagName = "secret";
            mug.bindElement.dataType = "xsd:string";
        }
    });

    var Int = util.extend(defaultOptions, {
        typeName: 'Integer',
        icon: 'icon-vellum-numeric',
        init: function (mug, form, baseSpec) {
            mug.controlElement.tagName = "input";
            mug.bindElement.dataType = "xsd:int";
        }
    });

    var Audio = util.extend(defaultOptions, {
        typeName: 'Audio Capture',
        icon: 'icon-vellum-audio-capture',
        isODKOnly: true,
        init: function (mug, form, baseSpec) {
            mug.controlElement.tagName = "upload";
            mug.controlElement.mediaType = "audio/*"; /* */
            mug.bindElement.dataType = "binary";
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

    var Image = util.extend(Audio, {
        typeName: 'Image Capture',
        icon: 'icon-camera',
        isODKOnly: true,
        init: function (mug, form, baseSpec) {
            Audio.init(mug, form, baseSpec);
            mug.controlElement.tagName = "upload";
            mug.controlElement.mediaType = "image/*"; /* */
            mug.bindElement.dataType = "binary";
        }
    });

    var Video = util.extend(Audio, {
        typeName: 'Video Capture',
        icon: 'icon-facetime-video',
        isODKOnly: true,
        init: function (mug, form, baseSpec) {
            Audio.init(mug, form, baseSpec);
            mug.controlElement.tagName = "upload";
            mug.controlElement.mediaType = "video/*"; /* */
            mug.bindElement.dataType = "binary";
        }
    });

    var Geopoint = util.extend(defaultOptions, {
        typeName: 'GPS',
        icon: 'icon-map-marker',
        isODKOnly: true,
        init: function (mug, form, baseSpec) {
            mug.controlElement.tagName = "input";
            mug.bindElement.dataType = "geopoint";
        }
    });

    var AndroidIntent = util.extend(defaultOptions, {
        typeName: 'Android App Callout',
        icon: 'icon-vellum-android-intent',
        isODKOnly: true,
        isTypeChangeable: false,
        intentTag: null,
        init: function (mug, form, baseSpec) {
            mug.controlElement.tagName = "input";
            mug.bindElement.dataType = "intent";
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
        getAppearanceAttribute: function (mug) {
            return 'intent:' + mug.dataElement.nodeID;
        }
    });

    var Barcode = util.extend(defaultOptions, {
        typeName: 'Barcode Scan',
        icon: 'icon-barcode',
        isODKOnly: true,
        init: function (mug, form, baseSpec) {
            mug.controlElement.tagName = "input";
            mug.bindElement.dataType = "barcode";
        }
    });

    var Date = util.extend(defaultOptions, {
        typeName: 'Date',
        icon: 'icon-calendar',
        init: function (mug, form, baseSpec) {
            mug.controlElement.tagName = "input";
            mug.bindElement.dataType = "xsd:date";
        }
    });

    var DateTime = util.extend(defaultOptions, {
        typeName: 'Date and Time',
        icon: 'icon-vellum-datetime',
        init: function (mug, form, baseSpec) {
            mug.controlElement.tagName = "input";
            mug.bindElement.dataType = "xsd:dateTime";
        }
    });

    var Time = util.extend(defaultOptions, {
        typeName: 'Time',
        icon: 'icon-time',
        init: function (mug, form, baseSpec) {
            mug.controlElement.tagName = "input";
            mug.bindElement.dataType = "xsd:time";
        }
    });

    var Long = util.extend(Int, {
        typeName: 'Long',
        icon: 'icon-vellum-long',
        init: function (mug, form, baseSpec) {
            Int.init(mug, form, baseSpec);
            mug.bindElement.dataType = "xsd:long";
        }
    });

    var Double = util.extend(Int, {
        typeName: 'Decimal',
        icon: 'icon-vellum-decimal',
        init: function (mug, form, baseSpec) {
            Int.init(mug, form, baseSpec);
            mug.bindElement.dataType = "xsd:double";
        }
    });

    var Item = util.extend(defaultOptions, {
        typeName: 'Choice',
        icon: 'icon-circle-blank',
        isTypeChangeable: false,
        getIcon: function (mug) {
            if (mug.parentMug.__className === "Select") {
                return 'icon-circle-blank';
            } else {
                return 'icon-check-empty';
            }
        },
        init: function (mug, form, baseSpec) {
            mug.controlElement.tagName = "item";
            mug.controlElement.defaultValue = mug.form.generate_item_label();
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
                validationFunc: function (mug) {
                    if (/\s/.test(mug.controlElement.defaultValue)) {
                        return "Whitespace in values is not allowed.";
                    }
                    return "pass";
                }
            };
            c.hintLabel.presence = 'notallowed';
            c.hintItextID.presence = 'notallowed';
            return spec;
        }
    });

    var Trigger = util.extend(defaultOptions, {
        typeName: 'Label',
        icon: 'icon-tag',
        init: function (mug, form, baseSpec) {
            mug.controlElement.tagName = "trigger";
            mug.controlElement.showOKCheckbox = false;
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
        getAppearanceAttribute: function (mug) {
            return mug.controlElement.showOKCheckbox ? null : 'minimal';
        }
    });

    var BaseSelect = util.extend(defaultOptions, {
        validChildTypes: ["Item"],
        afterInsert: function (form, mug) {
            var item = "Item";
            form.createQuestion(mug, 'into', item, true);
            form.createQuestion(mug, 'into', item, true);
        },
        init: function (mug, form, baseSpec) {}
    });

    var MSelect = util.extend(BaseSelect, {
        typeName: 'Multiple Answer',
        icon: 'icon-vellum-multi-select',
        init: function (mug, form, baseSpec) {
            BaseSelect.init(mug, form, baseSpec);
            mug.controlElement.tagName = "select";
        },
        processSpec: function (spec) {
            spec.bindElement.dataType.visibility = "hidden";
            return spec;
        },
        defaultOperator: "selected"
    });

    var Select = util.extend(MSelect, {
        typeName: 'Single Answer',
        icon: 'icon-vellum-single-select',
        init: function (mug, form, baseSpec) {
            MSelect.init(mug, form, baseSpec);
            mug.controlElement.tagName = "select1";
        },
        defaultOperator: null
    });

    var Group = util.extend(defaultOptions, {
        typeName: 'Group',
        icon: 'icon-folder-open',
        isSpecialGroup: true,
        isTypeChangeable: false,
        init: function (mug, form, baseSpec) {
            mug.controlElement.tagName = "group";
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
    var FieldList = util.extend(Group, {
        typeName: 'Question List',
        icon: 'icon-reorder',
        isSpecialGroup: true,
        isTypeChangeable: false,
        init: function (mug, form, baseSpec) {
            Group.init(mug, form, baseSpec);
            mug.setAppearanceAttribute('field-list');
        },
    });

    var Repeat = util.extend(Group, {
        typeName: 'Repeat Group',
        icon: 'icon-retweet',
        isSpecialGroup: true,
        isTypeChangeable: false,
        init: function (mug, form, baseSpec) {
            Group.init(mug, form, baseSpec);
            mug.controlElement.tagName = "repeat";
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
            type.validChildTypes = [];
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
            if (!Mug.validChildTypes) {
                Mug.validChildTypes = validChildTypes;
            }
        });

        _.each(this.allTypes, function (Mug, name) {
            Mug.__className = name;

            // set on this for easy access
            _this[name] = Mug;
        });
    }
    MugTypesManager.prototype = {
        make: function (typeName, form, copyFrom) {
            var mugType = this.allTypes[typeName];
            return new Mug(mugType, form, this.spec, copyFrom);
        },
        changeType: function (mug, typeName) {
            var form = mug.form,
                children = form.getChildren(mug);

            if (children.length && (typeName.indexOf("Select") === -1 || 
                                    typeName.indexOf("Dynamic") !== -1)) 
            {
                throw "you can't change a Multiple/Single Choice question to a non-Choice " +
                      "question if it has Choices. Please remove all Choices " +
                      "and try again.";
            }
        
            mug.setOptions(this.allTypes[typeName]);

            if (typeName.indexOf("Select") !== -1) {
                _.each(children, function (childMug) {
                    form.fire({
                        type: 'parent-question-type-change',
                        childMug: childMug
                    });
                });
            }

            form.fire({
                type: 'question-type-change',
                qType: typeName,
                mug: mug
            });
            form.fireChange(mug);
        }
    };

    return {
        Mug: Mug,
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
                "Text": Text,
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
