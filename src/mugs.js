define([
    'jquery',
    'vellum/widgets',
    'vellum/util',
    'underscore',
], function (
    jquery,
    widgets,
    util,
    _,
    undefined
) {
    function validateRule(ruleKey, ruleValue, testingObj, mug) {
        var presence = ruleValue.presence,
            retBlock = {
                result: 'pass'
            };

        if (presence === 'required' && !testingObj) {
            retBlock.result = 'fail';
            retBlock.resultMessage = '"' + ruleKey + '" value is required but is NOT present!';
        } else if (presence === 'notallowed' && testingObj) {
            retBlock.result = 'fail';
            retBlock.resultMessage = '"' + ruleKey + '" IS NOT ALLOWED';
        }

        if (retBlock.result !== "fail" && ruleValue.validationFunc) {
            var funcRetVal = ruleValue.validationFunc(mug);
            if (funcRetVal !== 'pass') {
                retBlock.result = 'fail';
                retBlock.resultMessage = funcRetVal;
            }
        }

        return retBlock;
    }

    function MugProperties (options) {
        this.__data = {};
        this.__spec = options.spec;
        this.__mug = options.mug;
        this.shouldChange = options.shouldChange || function () { return function () {}; };
    }
    MugProperties.setBaseSpec = function (baseSpec) {
        _.each(baseSpec, function (spec, name) {
            Object.defineProperty(MugProperties.prototype, name, {
                get: function () {
                    return this._get(name);
                },
                set: function (value) {
                    this._set(name, value);
                },
                // Allow properties to be redefined.  This should not be
                // necessary, but if we don't do this then if vellum.init() is
                // called a second time (i.e., when reloading Vellum on the test
                // page), we get an error.  This is an easy and harmless
                // alternative, but properties should never need to be redefined
                // otherwise.
                configurable: true
            });
        });
    };
    MugProperties.prototype = {
        getDefinition: function (name) {
            return this.__spec[name];
        },
        getAttrs: function () {
            return _.clone(this.__data);
        },
        _get: function (attr) {
            return this.__data[attr];
        },
        _set: function (attr, val) {
            var spec = this.__spec[attr],
                prev = this.__data[attr];

            if (!spec || val === prev ||
                // only set attr if spec allows this attr, except if mug is a
                // DataBindOnly (which all mugs are before the control block has
                // been parsed).
                (spec.presence === 'notallowed' &&
                 this.__mug.__className !== 'DataBindOnly'))
            {
                return;
            }

            // Should never happen.  Can probably remove once type-defining
            // attributes are specified abstractly.
            if (spec.immutable && !_.isUndefined(prev)) {
                throw new Error(
                    "Tried to set immutable property with existing value.");
            }

            var callback = this.shouldChange(this.__mug, attr, val, prev);
            if (callback) {
                this.__data[attr] = val;
                callback();
            }
        },
        setAttrs: function (attrs) {
            var _this = this;
            _(attrs).each(function (val, attr) {
                _this[attr] = val;
            });
        },
        getErrors: function () {
            var _this = this,
                errors = [];

            _.each(this.__data, function (value, key) {
                var rule = _this.__spec[key];

                if (!rule && value) {
                    // this should never happen.  Probably safe to remove.
                    errors.push(
                        "Property '" + key + "' found " + 
                        "but no rule is present for that property.");
                    return;
                } else if (rule) {
                    var result = validateRule(key, rule, value, _this.__mug);
                    if (result.result === 'fail') {
                        errors.push(result.resultMessage);
                    }
                }
            });
            return errors;
        }
    };

    var validateElementName = function (value, displayName) {
        if (!util.isValidElementName(value)) {
            return value + " is not a legal " + displayName + ". Must start with a letter and contain only letters, numbers, and '-' or '_' characters.";
        }
        return "pass";            
    };

    var baseSpecs = {
        databind: {
            // DATA ELEMENT
            nodeID: {
                visibility: 'visible',
                presence: 'required',
                lstring: 'Question ID',
                validationFunc: function (mug) {
                    var qId = mug.p.nodeID;
                    var res = validateElementName(qId, "Question ID");
                    if (res !== "pass") {
                        return res;
                    }
                    return "pass";
                }
            },
            dataValue: {
                visibility: 'visible',
                presence: 'optional',
                lstring: 'Default Data Value'
            },
            xmlnsAttr: {
                visibility: 'visible',
                presence: 'notallowed',
                lstring: "Special Hidden Value XMLNS attribute"
            },
            rawDataAttributes: {
                presence: 'optional',
                lstring: 'Extra Data Attributes'
            },

            // BIND ELEMENT
            dataType: {
                immutable: true,
                visibility: 'hidden',
                presence: 'optional',
                lstring: 'Data Type'
            },
            relevantAttr: {
                visibility: 'visible',
                presence: 'optional',
                widget: widgets.xPath,
                xpathType: "bool",
                lstring: 'Display Condition'
            },
            calculateAttr: {
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
                visibility: 'visible',
                presence: 'optional',
                widget: widgets.xPath,
                xpathType: "bool",
                lstring: 'Validation Condition'
            },
            // non-itext constraint message
            constraintMsgAttr: {
                visibility: 'visible',
                presence: 'optional',
                validationFunc : function (mug) {
                    var hasConstraint = mug.p.constraintAttr,
                        constraintMsgItextID = mug.p.constraintMsgItextID,
                        hasConstraintMsg = (mug.p.constraintMsgAttr || 
                                            (constraintMsgItextID && constraintMsgItextID.id));
                    if (hasConstraintMsg && !hasConstraint) {
                        return 'ERROR: You cannot have a Validation Error Message with no Validation Condition!';
                    } else {
                        return 'pass';
                    }
                },
                lstring: 'Validation Error Message'
            },
            requiredAttr: {
                visibility: 'visible',
                presence: 'optional',
                lstring: "Is this Question Required?",
                widget: widgets.checkbox
            },
            nodeset: {
                visibility: 'hidden',
                presence: 'optional' //if not present one will be generated... hopefully.
            },
            // could use a key-value widget for this in the future
            rawBindAttributes: {
                presence: 'optional',
                lstring: 'Extra Bind Attributes'
            }
        },

        control: {
            tagName: {
                immutable: true,
                visibility: 'hidden',
                presence: 'required'
            },
            appearance: {
                visibility: 'hidden',
                presence: 'optional',
                lstring: 'Appearance Attribute'
            },
            label: {
                visibility: 'visible',
                presence: 'optional',
                lstring: "Default Label",
                // todo: fix itext plugin abstraction barrier break here
                validationFunc: function (mug) {
                    var hasLabel, hasLabelItextID, missing, hasItext;
                    hasLabel = mug.p.label;
                    var itextBlock = mug.p.labelItextID;
                    hasLabelItextID = itextBlock && (typeof itextBlock.id !== "undefined");

                    if (hasLabelItextID && !util.isValidAttributeValue(itextBlock.id)) {
                        return itextBlock.id + " is not a valid Itext ID";
                    }
                    hasItext = itextBlock && itextBlock.hasHumanReadableItext();
                    
                    if (hasLabel) {
                        return 'pass';
                    } else if (!hasLabel && !hasItext && (mug.spec.label.presence === 'optional' || 
                               mug.spec.labelItextID.presence === 'optional')) {
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
                visibility: 'visible',
                presence: 'optional',
                lstring: "Hint Label"
            },
            rawControlAttributes: {
                presence: 'optional',
                lstring: "Extra Control Attributes"
            },
            rawControlXML: {
                presence: 'optional',
                lstring: 'Raw XML'
            }
        }
    };

    function copyAndProcessSpec(baseSpec, mugSpec, mugOptions) {
        baseSpec = $.extend(true, {}, baseSpec);

        if (mugOptions.isDataOnly) {
            baseSpec.control = {};
        } else if (mugOptions.isControlOnly) {
            baseSpec.databind = {};
        }

        spec = $.extend(true, {}, baseSpec.databind, baseSpec.control, mugSpec);

        _.each(spec, function (propertySpec, name) {
            if (_.isFunction(propertySpec)) {
                propertySpec = propertySpec(mugOptions);
            }
            if (!propertySpec) {
                delete spec[name];
                return;
            }
            spec[name] = propertySpec;

            _.each(propertySpec, function (value, key) {
                if (_.isFunction(value) && key !== 'validationFunc' && 
                    key !== 'widget') 
                {
                    propertySpec[key] = value(mugOptions);
                }
            });
        });

        
        return spec;
    }

    // question-type specific properties, gets reset when you change the
    // question type
    var defaultOptions = {
        typeName: "Base",
        isDataOnly: false,
        isControlOnly: false,
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
            return mug.p.appearance;
        },
        getIcon: function (mug) {
            return mug.options.icon;
        },
        init: function (mug, form) {},
        spec: {}
    };

    /**
     * A question, containing data, bind, and control elements.
     */
    function Mug (options, form, baseSpec, copyFromMug) {
        var properties = null;
        util.eventuality(this);

        if (copyFromMug) {
            properties = _.object(_.map(copyFromMug.p.getAttrs(), function (val, key) {
                if (val && typeof val === "object") {
                    // avoid potential duplicate references (e.g., itext items)
                    if ($.isPlainObject(val)) {
                        val = _.clone(val);
                    } else {
                        // All non-plain objects must provide a clone method,
                        // otherwise there could be circular references.  It can
                        // simply return the same object if it's safe.
                        // This is not really fleshed out.
                        val = val.clone();
                    }
                }
                return [key, val];
            }));
        }

        this.form = form;
        this._baseSpec = baseSpec;
        this.setOptionsAndProperties(options, properties);
    }
    Mug.prototype = {
        // set or change question type
        setOptionsAndProperties: function (options, properties) {
            var _this = this,
                spec = util.extend(this._baseSpec),
                currentAttrs = properties || (this.p && this.p.getAttrs()) || {};

            // These could both be calculated once for each type instead of
            // each instance.
            this.options = util.extend(defaultOptions, options);
            this.__className = this.options.__className;
            this.spec = copyAndProcessSpec(spec, this.options.spec, this.options);

            // Reset any properties that are part of the question type
            // definition.
            _.each(this.spec, function (spec, name) {
                if (spec.immutable) {
                    delete currentAttrs[name];
                }
            });

            this.p = new MugProperties({
                spec: this.spec,
                mug: this,
                shouldChange: _this.form.shouldMugPropertyChange.bind(_this.form),
            });
            this.options.init(this, this.form);
            this.p.setAttrs(currentAttrs);
        },
        getAppearanceAttribute: function () {
            return this.options.getAppearanceAttribute(this);
        },
        setAppearanceAttribute: function (attrVal) {
            this.p.appearance = attrVal;
        },
        getIcon: function () {
            return this.options.getIcon(this);
        },
        getErrors: function () {
            return this.p.getErrors();
        },
        isValid: function () {
            return !this.getErrors().length;
        },
        getDefaultItextRoot: function () {
            if (this.__className === "Item") {
                return this.parentMug.getDefaultItextRoot() + "-" + this.p.defaultValue;
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
            var label = this.p.label,
                nodeID = this.p.nodeID;
            if (label) {
                return label;
            } else if (nodeID) {
                return nodeID;
            } else if (this.__className === "Item") {
                return this.p.defaultValue;
            }
        },
        
        /*
         * Gets the actual label, either from the control element or an empty
         * string if not found.
         */
        getLabelValue: function () {
            var label = this.p.label;
            if (label) {
                return label;
            } else {
                return "";
            } 
        },
        
        // Add some useful functions for dealing with itext.
        setItextID: function (val) {
            var labelItextID = this.p.labelItextID;
            if (labelItextID) {
                labelItextID.id = val;
            }
        },
        
        getItext: function () {
            return this.p.labelItextID;
        },
        getNodeID: function () {
            return this.p.nodeID || this.p.defaultValue;
        },
        getAbsolutePath: function () {
            return this.form.getAbsolutePath(this);
        },
        getDisplayName: function (lang) {
            var itextItem = this.p.labelItextID, 
                Itext = this.form.vellum.data.javaRosa.Itext,
                defaultLang = Itext.getDefaultLanguage(),
                disp;

            if (this.__className === "ReadOnly") {
                return "Unknown (read-only) question type";
            }
            if (this.__className === "Itemset") {
                return "External Data";
            }

            if (!itextItem) {
                return this.getNodeID();
            }
            lang = lang || defaultLang;

            if(!lang) {
                return 'No Translation Data';
            }

            disp = itextItem.getValue("default", lang);
            if (disp) {
                return disp;
            } else {
                disp = itextItem.getValue("default", defaultLang);
            }
            if (disp) {
                return disp;
            }

            return '[' + this.getNodeID() + ']';
        },
        // todo: move these into javarosa
        getItextAutoID: function (propertyPath) {
            var isSelectItem = (this.__className === "Item"),
                rootId = isSelectItem && this.parentMug ?
                    this.parentMug.getDefaultItextRoot() + "-" :
                    "",
                nodeId = isSelectItem ?
                    this.p.defaultValue || "null" :
                    this.getDefaultItextRoot(),
                itextType = propertyPath.replace("ItextID", "");
       
            return rootId + nodeId + "-" + itextType;
        },
        setItextId: function (propertyPath, id, unlink) {
            var itext = this.p[propertyPath];

            if (id !== itext.id) {
                if (unlink) {
                    itext = itext.clone();
                    this.form.vellum.data.javaRosa.Itext.addItem(itext);
                }

                itext.id = id;
                // Is this necessary, since itext is a reference?
                // It probably triggers handlers.
                this.p[propertyPath] = itext;
            }
        },
        unlinkItext: function () {
            var _this = this;
            _.each([
                "labelItextID",
                "constraintMsgItextID",
                "hintItextID"
            ], function (path) {
                var val = _this.p[path];
                // items don't have a constraintMsgItextID
                if (val && val.id) {
                    var id = _this.getItextAutoID(path);
                    _this.setItextId(path, id, true);
                }
            });
        }
    };

    var DataBindOnly = util.extend(defaultOptions, {
        isDataOnly: true,
        typeName: 'Hidden Value',
        icon: 'icon-vellum-variable',
        isTypeChangeable: false,
        spec: {
            xmlnsAttr: { presence: "optional" },
            requiredAttr: { presence: "notallowed" },
            constraintAttr: { presence : "notallowed" },
            calculateAttr: { visibility: "visible" }
        }
    });

    var ControlOnly = util.extend(defaultOptions, {
        typeName: '(Internal)'
    });
    
    var ReadOnly = util.extend(defaultOptions, {
        spec: {
            readOnlyControl: {
                widget: widgets.readOnlyControl
            }
        }
    });

    var Text = util.extend(defaultOptions, {
        typeName: "Text",
        icon: "icon-vellum-text",
        init: function (mug, form) {
            mug.p.tagName = "input";
            mug.p.dataType = "xsd:string";
        }
    });

    var PhoneNumber = util.extend(Text, {
        typeName: 'Phone Number or Numeric ID',
        icon: 'icon-signal',
        init: function (mug, form) {
            Text.init(mug, form);
            mug.p.appearance = "numeric";
        }
    });

    var Secret = util.extend(defaultOptions, {
        typeName: 'Password',
        icon: 'icon-key',
        init: function (mug, form) {
            mug.p.tagName = "secret";
            mug.p.dataType = "xsd:string";
        }
    });

    var Int = util.extend(defaultOptions, {
        typeName: 'Integer',
        icon: 'icon-vellum-numeric',
        init: function (mug, form) {
            mug.p.tagName = "input";
            mug.p.dataType = "xsd:int";
        }
    });

    var Audio = util.extend(defaultOptions, {
        typeName: 'Audio Capture',
        icon: 'icon-vellum-audio-capture',
        isODKOnly: true,
        init: function (mug, form) {
            mug.p.tagName = "upload";
            mug.p.mediaType = "audio/*"; /* */
            mug.p.dataType = "binary";
        },
        spec: {
            mediaType: {
                lstring: 'Media Type',
                visibility: 'visible',
                presence: 'required'
            }
        }
    });

    var Image = util.extend(Audio, {
        typeName: 'Image Capture',
        icon: 'icon-camera',
        isODKOnly: true,
        init: function (mug, form) {
            Audio.init(mug, form);
            mug.p.mediaType = "image/*"; /* */
        }
    });

    var Video = util.extend(Audio, {
        typeName: 'Video Capture',
        icon: 'icon-facetime-video',
        isODKOnly: true,
        init: function (mug, form) {
            Audio.init(mug, form);
            mug.p.mediaType = "video/*"; /* */
        }
    });

    var Geopoint = util.extend(defaultOptions, {
        typeName: 'GPS',
        icon: 'icon-map-marker',
        isODKOnly: true,
        init: function (mug, form) {
            mug.p.tagName = "input";
            mug.p.dataType = "geopoint";
        }
    });

    var Barcode = util.extend(defaultOptions, {
        typeName: 'Barcode Scan',
        icon: 'icon-barcode',
        isODKOnly: true,
        init: function (mug, form) {
            mug.p.tagName = "input";
            mug.p.dataType = "barcode";
        }
    });

    var Date = util.extend(defaultOptions, {
        typeName: 'Date',
        icon: 'icon-calendar',
        init: function (mug, form) {
            mug.p.tagName = "input";
            mug.p.dataType = "xsd:date";
        }
    });

    var DateTime = util.extend(defaultOptions, {
        typeName: 'Date and Time',
        icon: 'icon-vellum-datetime',
        init: function (mug, form) {
            mug.p.tagName = "input";
            mug.p.dataType = "xsd:dateTime";
        }
    });

    var Time = util.extend(defaultOptions, {
        typeName: 'Time',
        icon: 'icon-time',
        init: function (mug, form) {
            mug.p.tagName = "input";
            mug.p.dataType = "xsd:time";
        }
    });

    var Long = util.extend(Int, {
        typeName: 'Long',
        icon: 'icon-vellum-long',
        init: function (mug, form) {
            mug.p.tagName = "input";
            mug.p.dataType = "xsd:long";
        }
    });

    var Double = util.extend(Int, {
        typeName: 'Decimal',
        icon: 'icon-vellum-decimal',
        init: function (mug, form) {
            mug.p.tagName = "input";
            mug.p.dataType = "xsd:double";
        }
    });

    var Item = util.extend(defaultOptions, {
        isControlOnly: true,
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
        init: function (mug, form) {
            mug.p.tagName = "item";
        },
        spec: {
            hintLabel: { presence: 'notallowed' },
            hintItextID: { presence: 'notallowed' },
            defaultValue: {
                lstring: 'Choice Value',
                visibility: 'visible',
                presence: 'required',
                validationFunc: function (mug) {
                    if (/\s/.test(mug.p.defaultValue)) {
                        return "Whitespace in values is not allowed.";
                    }
                    return "pass";
                }
            }
        }
    });

    var Trigger = util.extend(defaultOptions, {
        typeName: 'Label',
        icon: 'icon-tag',
        init: function (mug, form) {
            mug.p.tagName = "trigger";
            mug.p.showOKCheckbox = false;
        },
        spec: {
            dataType: { presence: 'notallowed' },
            dataValue: { presence: 'optional' },
            showOKCheckbox: {
                lstring: 'Add confirmation checkbox',
                help: 'Add a confirmation message and checkbox below the label. Available on Android only.',
                visibility: 'visible',
                presence: 'optional',
                widget: widgets.checkbox
            }
        },
        getAppearanceAttribute: function (mug) {
            return mug.p.showOKCheckbox ? null : 'minimal';
        }
    });

    var BaseSelect = util.extend(defaultOptions, {
        validChildTypes: ["Item"],
        afterInsert: function (form, mug) {
            var item = "Item";
            form.createQuestion(mug, 'into', item, true);
            form.createQuestion(mug, 'into', item, true);
        },
    });

    var MSelect = util.extend(BaseSelect, {
        typeName: 'Multiple Answer',
        icon: 'icon-vellum-multi-select',
        init: function (mug, form) {
            mug.p.tagName = "select";
        },
        spec: {
            dataType: { visibility: "hidden" }
        },
        defaultOperator: "selected"
    });

    var Select = util.extend(MSelect, {
        typeName: 'Single Answer',
        icon: 'icon-vellum-single-select',
        init: function (mug, form) {
            mug.p.tagName = "select1";
        },
        defaultOperator: null
    });

    var Group = util.extend(defaultOptions, {
        typeName: 'Group',
        icon: 'icon-folder-open',
        isSpecialGroup: true,
        isTypeChangeable: false,
        init: function (mug, form) {
            mug.p.tagName = "group";
        },
        spec: {
            hintLabel: { presence: "notallowed" },
            dataType: { presence: "notallowed" },
            calculateAttr: { presence: "notallowed" },
            constraintAttr: { presence: "notallowed" },
            constraintMsgAttr: { presence: "notallowed" },
            dataValue: { presence: "notallowed" }
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
        init: function (mug, form) {
            Group.init(mug, form);
            mug.setAppearanceAttribute('field-list');
        },
    });

    var Repeat = util.extend(Group, {
        typeName: 'Repeat Group',
        icon: 'icon-retweet',
        isSpecialGroup: true,
        isTypeChangeable: false,
        init: function (mug, form) {
            mug.p.tagName = "repeat";
            mug.p.repeat_count = null;
            mug.p.no_add_remove = false;
        },
        spec: {
            repeat_count: {
                lstring: 'Repeat Count',
                visibility: 'visible_if_present',
                presence: 'optional',
                widget: widgets.droppableText
            },
            no_add_remove: {
                lstring: 'Disallow Repeat Add and Remove?',
                visibility: 'visible_if_present',
                presence: 'optional',
                widget: widgets.checkbox
            }
        }
    });
   
    function MugTypesManager(baseSpec, mugTypes) {
        var _this = this;

        this.auxiliaryTypes = mugTypes.auxiliary;
        this.normalTypes = mugTypes.normal;
        this.baseSpec = baseSpec;

        MugProperties.setBaseSpec(
            util.extend.apply(null, 
                [baseSpec.databind, baseSpec.control].concat(_.filter(
                    _.pluck(
                        util.extend(this.normalTypes, this.auxiliaryTypes),
                        'spec'),
                    _.identity))));

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
            var validChildTypes;
            if (name === "Group" || name === "Repeat") {
                validChildTypes = innerChildTypeNames;
            } else if (name === "FieldList") {
                validChildTypes = nonGroupTypeNames;
            } else {
                validChildTypes = [];
            }

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
            var mugType = this.allTypes[typeName],
                mug = new Mug(mugType, form, this.baseSpec, copyFrom);
            mug.ufid = util.get_guid();
            return mug;
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
      
            mug.setOptionsAndProperties(this.allTypes[typeName]);

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
        defaultOptions: defaultOptions,
        baseMugTypes: {
            normal: {
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
        baseSpecs: baseSpecs
    };
});
