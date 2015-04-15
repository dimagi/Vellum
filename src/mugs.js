define([
    'jquery',
    'underscore',
    'vellum/tree',
    'vellum/javaRosa', // TODO move all Itext stuff to javaRosa and remove this
    'vellum/widgets',
    'vellum/util'
], function (
    $,
    _,
    Tree,
    jr,
    widgets,
    util,
    undefined
) {
    /**
     * A question, containing data, bind, and control elements.
     */
    function Mug(options, form, baseSpec, copyFromMug) {
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

        this.ufid = util.get_guid();
        this.form = form;
        this.messages = new MugMessages();
        this._baseSpec = baseSpec;
        this.setOptionsAndProperties(options, properties);
    }
    Mug.prototype = {
        // set or change question type
        setOptionsAndProperties: function (options, properties) {
            var currentAttrs = properties || (this.p && this.p.getAttrs()) || {};

            // These could both be calculated once for each type instead of
            // each instance.
            this.options = util.extend(defaultOptions, options);
            this.__className = this.options.__className;
            this.spec = copyAndProcessSpec(this._baseSpec, this.options.spec, this.options);

            // Reset any properties that are part of the question type
            // definition.
            _.each(this.spec, function (spec, name) {
                if (spec.deleteOnCopy) {
                    delete currentAttrs[name];
                }
            });

            this.p = new MugProperties({
                spec: this.spec,
                mug: this,
            });
            this.options.init(this, this.form);
            this.p.setAttrs(currentAttrs);
            this.p.shouldChange = this.form.shouldMugPropertyChange.bind(this.form);
        },
        getAppearanceAttribute: function () {
            return this.options.getAppearanceAttribute(this);
        },
        getIcon: function () {
            return this.options.getIcon(this);
        },
        /**
         * Validate mug
         *
         * This method may fire a "messages-changed" event.
         *
         * @param attr - The property to validate. All properties will
         *      be validated if this argument is omitted.
         * @returns - True if validation messages changed else false.
         */
        validate: function (attr) {
            var mug = this,
                changed;
            this.form.updateLogicReferences(this, attr);
            if (attr) {
                changed = this._validate(attr);
            } else {
                _.each(_.keys(this.p.__data), function (attr) {
                    changed = changed || mug._validate(attr);
                });
            }
            if (changed) {
                this.fire({type: "messages-changed", mug: this});
            }
            return changed;
        },
        _validate: function (attr) {
            var mug = this,
                spec = mug.spec[attr];
            if (!spec) {
                // should throw error?
                window.console.log("unexpected property: " + attr);
                return false;
            }
            var value = mug.p[attr],
                label = spec.lstring || attr,
                message = "";

            // TODO use data.hasOwnProperty(attr) rather than !value?
            if (!value && spec.presence === 'required') {
                // can the user always fix this error?
                message = label + ' is required.';
            } else if (value && spec.presence === 'notallowed') {
                // can the user always fix this error?
                message = label + ' is not allowed.';
            } else if (spec.validationFunc) {
                try {
                    message = spec.validationFunc(mug);
                } catch (err) {
                    // this should never happen
                    message = label + " validation failed\n" + util.formatExc(err);
                }
                if (message === "pass") {
                    message = "";
                }
            }

            return this.messages.update(attr, {
                key: "mug-" + attr + "-error",
                level: "error",
                message: message
            });
        },
        /**
         * Add a message for a property
         *
         * Adding a message object with the same key as an existing
         * message will replace the existing message.
         * See `MugMessages.update` for more about message objects.
         *
         * This method may fire a "messages-changed" event.
         *
         * @param attr - The property to which the message pertains.
         * @param msg - The message object. If omitted, all messages
         *          for the given property will be removed.
         */
        addMessage: function (attr, msg) {
            if (this.messages.update(attr, msg)) {
                this.fire({type: "messages-changed", mug: this});
            }
        },
        dropMessage: function (attr, key) {
            this.addMessage(attr, {key: key});
        },
        /**
         * Add many messages for many properties at once
         *
         * @param messages - An object mapping property names to lists
         *          of message objects.
         */
        addMessages: function (messages) {
            var mug = this,
                changed = _.reduce(messages, function (m1, list, attr) {
                    return _.reduce(list, function (m2, msg) {
                        return mug.messages.update(attr, msg) || m2;
                    }, false) || m1;
                }, false);
            if (changed) {
                this.fire({type: "messages-changed", mug: this});
            }
        },
        /**
         * Get a list of error message strings
         *
         * Currently there are only two message levels: "warning" and
         * "error", and this function returns both. If a lower level
         * message type such as "info" is added we may want to change
         * this to drop "info" messages.
         */
        getErrors: function () {
            return this.messages.get();
        },
        /**
         * Get a list of form serialization warnings
         *
         * All warnings returned by this function should also be reported
         * by the normal mug validation process. Serialization warnings
         * can be ignored or fixed automatically, but the user may
         * prefer to fix them manually.
         *
         * @returns - A list of warning objects, each having a `message`
         * attribute describing the warning. This list can be passed to
         * `fixSerializationWarnings` to automatically fix the warnings.
         */
        getSerializationWarnings: function () {
            var warnings = [];
            this.messages.each(function (msg) {
                if (msg.fixSerializationWarning) {
                    warnings.push(msg);
                }
            });
            return warnings;
        },
        /**
         * Automatically fix serialization warnings
         *
         * No warnings should be reported by `getSerializationWarnings`
         * after calling this function with the list of warnings
         * returned by `getSerializationWarnings`.
         *
         * @param warnings - The list of warnings returned by
         *                 `getSerializationWarnings`.
         */
        fixSerializationWarnings: function (warnings) {
            var mug = this;
            _.each(warnings, function (warning) {
                warning.fixSerializationWarning(mug);
            });
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
        getNodeID: function () {
            return this.p.nodeID || this.p.defaultValue;
        },
        getDisplayName: function (lang) {
            var itextItem = this.p.labelItext,
                Itext = this.form.vellum.data.javaRosa.Itext,
                defaultLang = Itext.getDefaultLanguage(),
                disp,
                defaultDisp,
                nodeID = this.getNodeID();

            if (this.__className === "ReadOnly") {
                return "Unknown (read-only) question type";
            }
            if (this.__className === "Itemset") {
                return "External Data";
            }

            if (!itextItem || lang === '_ids') {
                return nodeID;
            }
            lang = lang || defaultLang;

            if(!lang) {
                return 'No Translation Data';
            }

            defaultDisp = itextItem.get("default", defaultLang);
            disp = itextItem.get("default", lang) || defaultDisp;

            if (disp && disp !== nodeID) {
                if (lang !== defaultLang && disp === defaultDisp) {
                    disp += " [" + defaultLang + "]";
                }
                return $('<div>').text(disp).html();
            }

            return nodeID;
        },
        teardownProperties: function () {
            this.fire({type: "teardown-mug-properties", mug: this});
        }
    };

    Object.defineProperty(Mug.prototype, "absolutePath", {
        get: function () {
            return this.form.getAbsolutePath(this);
        }
    });

    Object.defineProperty(Mug.prototype, "parentMug", {
        get: function () {
            var node = this.form.tree.getNodeFromMug(this);
            if (node && node.parent) {
                return node.parent.value;
            } else {
                return null;
            }
        }
    });

    function copyAndProcessSpec(baseSpec, mugSpec, mugOptions) {
        var control = baseSpec.control,
            databind = baseSpec.databind;

        if (mugOptions.isDataOnly) {
            control = {};
        } else if (mugOptions.isControlOnly) {
            databind = {};
        }

        var spec = $.extend(true, {}, databind, control, mugSpec);

        _.each(spec, function (propertySpec, name) {
            if (_.isFunction(propertySpec)) {
                propertySpec = propertySpec(mugOptions);
            }
            if (!propertySpec) {
                delete spec[name];
                return;
            }
            spec[name] = propertySpec;
        });

        return spec;
    }

    function MugMessages() {
        this.messages = {};
    }
    MugMessages.prototype = {
        /**
         * Update messages for property
         *
         * @param attr - The attribute to which the message applies.
         *      This may be a falsey value (typically `null`) for
         *      messages that are not associated with a property.
         * @param msg - A message object.
         *
         *      {
         *          key: <message type key>,
         *          level: <"warning", or "error">,
         *          message: <message string>
         *      }
         *
         * @returns - true if changed else false
         */
        update: function (attr, msg) {
            attr = attr || "";
            if (arguments.length === 1) {
                if (this.messages.hasOwnProperty(attr)) {
                    delete this.messages[attr];
                    return true;
                }
                return false;
            }
            if (!this.messages.hasOwnProperty(attr) && !msg.message) {
                return false;
            }
            if (!msg.key) {
                // should never happen
                throw new Error("missing key: " + JSON.stringify(msg));
            }
            var messages = this.messages[attr] || [],
                removed = false;
            for (var i = messages.length - 1; i >= 0; i--) {
                var obj = messages[i];
                if (obj.key === msg.key) {
                    if (obj.level === msg.level && obj.message === msg.message) {
                        // added messages already exist (no change)
                        return false;
                    }
                    messages.splice(i, 1);
                    removed = true;
                    break;
                }
            }
            if (msg.message) {
                messages.push(msg);
            } else if (!removed) {
                return false;
            }
            if (messages.length) {
                this.messages[attr] = messages;
            } else {
                delete this.messages[attr];
            }
            return true;
        },
        get: function (attr) {
            if (arguments.length) {
                return _.flatten(_.pluck(this.messages[attr || ""], "message"));
            }
            return _.flatten(_.map(this.messages, function (messages) {
                return _.pluck(messages, "message");
            }), _.identity);
        },
        /**
         * Execute a function for each message
         *
         * @param attr - Optional property limiting the messages visited.
         *          The callback signature is `callback(msg)` if
         *          this argument is provided, and otherwise
         *          `callback(msg, property)`. In all cases the first
         *          argument `msg` is a message object.
         * @param callback - A function to be called for each message object.
         */
        each: function () {
            var attr, callback;
            if (arguments.length > 1) {
                attr = arguments[0] || "";
                callback = arguments[1];
                _.each(this.messages[attr], callback);
            } else {
                callback = arguments[0];
                _.each(this.messages, function (messages, attr) {
                    _.each(messages, function (msg) {
                        callback(msg, attr);
                    });
                });
            }
        },
        toString: function () {
            var messages = [],
                last = null;
            this.each(function (msg, attr) {
                if (attr !== last) {
                    messages.push(attr + ":");
                    last = attr;
                }
                messages.push("  - " + msg.message); // + " [" + msg.key + "]");
            });
            return messages.join("\n");
        }
    };

    function MugProperties (options) {
        this.__data = {};
        this.__spec = options.spec;
        this.__mug = options.mug;
        this.shouldChange = function () { return function () {}; };
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
        has: function (attr) {
            return this.__data.hasOwnProperty(attr);
        },
        set: function (attr, val) {
            // set or clear property without triggering events, unlike _set
            if (arguments.length > 1) {
                this.__data[attr] = val;
            } else {
                delete this.__data[attr];
            }
        },
        _get: function (attr) {
            return this.__data[attr];
        },
        _set: function (attr, val) {
            var spec = this.__spec[attr],
                prev = this.__data[attr],
                mug = this.__mug;

            if (!spec || val === prev ||
                // only set attr if spec allows this attr, except if mug is a
                // DataBindOnly (which all mugs are before the control block has
                // been parsed).
                (spec.presence === 'notallowed' &&
                 mug.__className !== 'DataBindOnly'))
            {
                return;
            }

            var callback = this.shouldChange(mug, attr, val, prev);
            if (callback) {
                if (spec.setter) {
                    spec.setter(mug, attr, val);
                } else {
                    this.__data[attr] = val;
                }
                callback();
            }
        },
        setAttrs: function (attrs) {
            var _this = this;
            _(attrs).each(function (val, attr) {
                _this[attr] = val;
            });
        }
    };

    function validateElementName(value, displayName) {
        if (!util.isValidElementName(value)) {
            return value + " is not a legal " + displayName + ". Must start with a letter and contain only letters, numbers, and '-' or '_' characters.";
        }
        return "pass";
    }

    function resolveConflictedNodeId(mug) {
        // clear warning; mug already has copy-N-of-... ID
        mug.p.conflictedNodeId = null;
    }

    var baseSpecs = {
        databind: {
            // DATA ELEMENT
            nodeID: {
                visibility: 'visible',
                presence: 'required',
                lstring: 'Question ID',
                setter: function (mug, attr, value) {
                    mug.form.moveMug(mug, "rename", value);
                },
                mugValue: function (mug, value) {
                    if (arguments.length === 1) {
                        if (mug.p.has("conflictedNodeId")) {
                            return mug.p.conflictedNodeId;
                        }
                        return mug.p.nodeID;
                    }
                    mug.p.nodeID = value;
                },
                widget: widgets.identifier,
                validationFunc: function (mug) {
                    return validateElementName(mug.p.nodeID, "Question ID");
                }
            },
            conflictedNodeId: {
                visibility: 'hidden',
                presence: 'optional',
                setter: function (mug, attr, value) {
                    var message = null;
                    if (value) {
                        mug.p.set(attr, value);
                        message = mug.getDisplayName() + " has the same " +
                            "Question ID as another question in the same " +
                            "group. Please choose a unique Question ID.";
                    } else {
                        mug.p.set(attr);
                    }
                    mug.addMessage("nodeID", {
                        key: "mug-conflictedNodeId-warning",
                        level: "warning",
                        message: message,
                        fixSerializationWarning: resolveConflictedNodeId
                    });
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
                        constraintMsgItext = mug.p.constraintMsgItext,
                        hasConstraintMsg = (mug.p.constraintMsgAttr || 
                                            (constraintMsgItext &&
                                             !constraintMsgItext.isEmpty()));
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
            appearance: {
                deleteOnCopy: true,
                visibility: 'optional',
                presence: 'optional',
                lstring: 'Appearance Attribute'
            },
            label: {
                visibility: 'visible',
                presence: 'optional',
                lstring: "Default Label",
                validationFunc: function (mug) {
                    if (!mug.p.label && mug.spec.label.presence === 'required') {
                        return 'Default Label is required';
                    }
                    return 'pass';
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
            },
            dataParent: {
                lstring: 'Data Parent',
                visibility: function(mug) {
                    function recFunc(mug) {
                        if (!mug) {
                            return true;
                        } else if (!mug.options.possibleDataParent) {
                            return false;
                        }
                        return recFunc(mug.parentMug);
                    }

                    return recFunc(mug.parentMug);
                },
                presence: 'optional',
                setter: function (mug, attr, value) {
                    var oldPath = mug.absolutePath;
                    mug.p.set(attr, value);
                    mug.form._updateMugPath(mug, oldPath);
                },
                widget: widgets.droppableText,
                validationFunc: function(mug) {
                    var dataParent = mug.p.dataParent,
                        form = mug.form,
                        dataParentMug;

                    if (dataParent) {
                        dataParentMug = form.getMugByPath(dataParent);

                        if(!dataParentMug &&
                           form.getBasePath().slice(0, -1) !== dataParent) {
                            return "Must be valid path";
                        } else if (dataParentMug && !dataParentMug.options.possibleDataParent) {
                            return dataParentMug.absolutePath + " is not a valid data parent";
                        } else if (!mug.spec.dataParent.visibility(mug)) {
                            return "Children of repeat groups cannot have a different data parent";
                        }
                    }

                    return "pass";
                }
            },
        }
    };

    // question-type specific properties, gets reset when you change the
    // question type
    var defaultOptions = {
        typeName: "Base",
        tagName: "input",
        isDataOnly: false,
        isControlOnly: false,
        // whether you can change to or from this question's type in the UI
        isTypeChangeable: true,
        /**
         * Determine if this mug can have its type changed to typeName
         *
         * Note: this method will also be called to verify that the reverse
         * type change is possible, in which case `mug`'s type will be the
         * same as `typeName`. This works for all current question types, but
         * could conceivably be wrong for some type that does not yet exist.
         *
         * @param mug - The mug object.
         * @param typeName - The name of the new type for mug (e.g., 'MSelect').
         * @returns - Empty string if the mug can change to type, otherwise error message.
         */
        typeChangeError: function (mug, typeName) {
            return '';
        },
        // controls whether delete button shows up - you can still delete a
        // mug's ancestor even if it's not removeable
        isRemoveable: true,
        isCopyable: true,
        isODKOnly: false,
        canOutputValue: true,
        maxChildren: -1,
        icon: null,
        // whether it can be created during data node parsing
        // due to presence of vellum:role="TypeName" attribute
        supportsDataNodeRole: false,
        /**
         * Parser integration: get children from data node
         *
         * Additionally, this may perform extra mug initialization. It is
         * called before the mug is inserted into the data tree/mug hierarchy.
         *
         * @param mug - The mug object.
         * @param node - This mug's data node, a jQuery object.
         * @returns - A jquery collection of child nodes.
         */
        parseDataNode: function (mug, $node) {
            return $node.children();
        },
        controlNodeChildren: null,

        /**
         * Get data node path name
         *
         * @param mug - The mug.
         * @param name - The default path name.
         * @returns - the name used in data node paths. It should
         *      uniquely identify the data node among its siblings.
         */
        getPathName: null,
        /**
         * Get data node tag name
         *
         * @param mug - The mug.
         * @param name - The default tag name.
         * @returns - the tag name used by the writer.
         */
        getTagName: null,

        // XForm writer integration:
        //  `childFilter(treeNodes, parentMug) -> treeNodes`
        // The writer passes these filter functions to `processChildren` of
        // `Tree.walk`. See `Tree.walk` documentation for more details.
        dataChildFilter: null,
        controlChildFilter: null,

        // data node writer options
        getExtraDataAttributes: null, // function (mug) { return {...}; }

        /**
         * Returns a list of objects containing bind element attributes
         */
        getBindList: function (mug) {
            var constraintMsgItext = mug.p.constraintMsgItext,
                constraintMsg;
            if (constraintMsgItext && !constraintMsgItext.isEmpty()) {
                constraintMsg = "jr:itext('" + constraintMsgItext.id + "')";
            } else {
                constraintMsg = mug.p.constraintMsgAttr;
            }
            var attrs = {
                nodeset: mug.form.getAbsolutePath(mug),
                type: mug.options.dataType,
                constraint: mug.p.constraintAttr,
                "jr:constraintMsg": constraintMsg,
                relevant: mug.p.relevantAttr,
                required: util.createXPathBoolFromJS(mug.p.requiredAttr),
                calculate: mug.p.calculateAttr,
                "jr:preload": mug.p.preload,
                "jr:preloadParams": mug.p.preloadParams
            };
            _.each(mug.p.rawBindAttributes, function (value, key) {
                if (!attrs.hasOwnProperty(key) || _.isUndefined(attrs[key])) {
                    attrs[key] = value;
                }
            });
            return attrs.nodeset ? [attrs] : [];
        },

        // control node writer options
        writeControlLabel: true,
        writeControlHint: true,
        writeControlHelp: true,
        writeControlRefAttr: 'ref',
        // a function with signature `(xmlWriter, mug)` to write custom XML
        writeCustomXML: null,
        writesOnlyCustomXML: false,

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

    var DataBindOnly = util.extend(defaultOptions, {
        isDataOnly: true,
        typeName: 'Hidden Value',
        icon: 'fcc fcc-fd-variable',
        isTypeChangeable: false,
        spec: {
            xmlnsAttr: { presence: "optional" },
            requiredAttr: { presence: "notallowed" },
            constraintAttr: { presence : "notallowed" },
            calculateAttr: { visibility: "visible" }
        }
    });

    var ReadOnly = util.extend(defaultOptions, {
        writesOnlyCustomXML: true,
        writeCustomXML: function (xmlWriter, mug) {
            return xmlWriter.writeXML($('<div>').append(mug.p.rawControlXML).clone().html());
        },
        spec: {
            readOnlyControl: {
                widget: widgets.readOnlyControl
            }
        }
    });

    var Text = util.extend(defaultOptions, {
        typeName: "Text",
        dataType: "xsd:string",
        icon: "fcc fcc-fd-text",
        init: function (mug, form) {
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
        dataType: 'xsd:string',
        tagName: 'secret',
        icon: 'icon-key',
        canOutputValue: false,
        init: function (mug, form) {
        }
    });

    var Int = util.extend(defaultOptions, {
        typeName: 'Integer',
        dataType: 'xsd:int',
        icon: 'fcc fcc-fd-numeric',
        init: function (mug, form) {
        }
    });

    var Audio = util.extend(defaultOptions, {
        typeName: 'Audio Capture',
        dataType: 'binary',
        tagName: 'upload',
        icon: 'fcc fcc-fd-audio-capture',
        isODKOnly: true,
        canOutputValue: false,
        writeCustomXML: function (xmlWriter, mug) {
            var mediaType = mug.p.mediaType;
            if (mediaType) {
                xmlWriter.writeAttributeString("mediatype", mediaType);
            }
        },
        init: function (mug, form) {
            mug.p.mediaType = "audio/*"; /* */
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
        canOutputValue: false,
        init: function (mug, form) {
            Audio.init(mug, form);
            mug.p.mediaType = "image/*"; /* */
        }
    });

    var Video = util.extend(Audio, {
        typeName: 'Video Capture',
        icon: 'icon-facetime-video',
        isODKOnly: true,
        canOutputValue: false,
        init: function (mug, form) {
            Audio.init(mug, form);
            mug.p.mediaType = "video/*"; /* */
        }
    });

    var Signature = util.extend(Image, {
        typeName: 'Signature Capture',
        icon: 'fcc fcc-fd-signature',
        init: function (mug, form) {
            Image.init(mug, form);
            mug.p.appearance = "signature";
        }
    });

    var Geopoint = util.extend(defaultOptions, {
        typeName: 'GPS',
        dataType: 'geopoint',
        icon: 'icon-map-marker',
        isODKOnly: true,
        init: function (mug, form) {
        }
    });

    var Barcode = util.extend(defaultOptions, {
        typeName: 'Barcode Scan',
        dataType: 'barcode',
        icon: 'icon-barcode',
        isODKOnly: true,
        init: function (mug, form) {
        }
    });

    var Date = util.extend(defaultOptions, {
        typeName: 'Date',
        dataType: 'xsd:date',
        icon: 'icon-calendar',
        init: function (mug, form) {
        }
    });

    var DateTime = util.extend(defaultOptions, {
        typeName: 'Date and Time',
        dataType: 'xsd:dateTime',
        icon: 'fcc fcc-fd-datetime',
        init: function (mug, form) {
        }
    });

    var Time = util.extend(defaultOptions, {
        typeName: 'Time',
        dataType: 'xsd:time',
        icon: 'icon-time',
        init: function (mug, form) {
        }
    });

    // Deprecated. Users may not add new longs to forms, 
    // but must be able to view forms already containing longs.
    var Long = util.extend(Int, {
        typeName: 'Long',
        dataType: 'xsd:long',
        icon: 'fcc fcc-fd-long',
        init: function (mug, form) {
        }
    });

    var Double = util.extend(Int, {
        typeName: 'Decimal',
        dataType: 'xsd:double',
        icon: 'fcc fcc-fd-decimal',
        init: function (mug, form) {
        }
    });

    var Item = util.extend(defaultOptions, {
        isControlOnly: true,
        typeName: 'Choice',
        tagName: 'item',
        icon: 'fcc fcc-fd-single-circle',
        isTypeChangeable: false,
        canOutputValue: false,
        getIcon: function (mug) {
            if (mug.parentMug.__className === "Select") {
                return 'fcc fcc-fd-single-circle';
            } else {
                return 'fcc fcc-fd-multi-box';
            }
        },
        writeControlHint: false,
        writeControlHelp: false,
        writeControlRefAttr: null,
        writeCustomXML: function (xmlWriter, mug) {
            var defaultValue = mug.p.defaultValue;
            if (defaultValue) {
                xmlWriter.writeStartElement('value');
                xmlWriter.writeString(defaultValue);
                xmlWriter.writeEndElement();
            }
        },
        init: function (mug, form) {
        },
        spec: {
            hintLabel: { presence: 'notallowed' },
            hintItext: { presence: 'notallowed' },
            helpItext: { presence: 'notallowed' },
            defaultValue: {
                lstring: 'Choice Value',
                visibility: 'visible',
                presence: 'required',
                widget: widgets.identifier,
                validationFunc: function (mug) {
                    if (/\s/.test(mug.p.defaultValue)) {
                        return "Whitespace in values is not allowed.";
                    }
                    if (mug.parentMug) {
                        var num = 0;
                        _.each(mug.form.getChildren(mug.parentMug), function(ele, index) {
                            if (ele.p.defaultValue === mug.p.defaultValue) {
                                num++;
                            }
                        });
                        if (num > 1) {
                            // TODO make this a warning instead of an error
                            return "This choice value has been used in the same question";
                        }
                    }
                    return "pass";
                }
            }
        }
    });

    var Trigger = util.extend(defaultOptions, {
        typeName: 'Label',
        tagName: 'trigger',
        icon: 'icon-tag',
        init: function (mug, form) {
            mug.p.appearance = "minimal";
        },
        spec: {
            dataValue: { presence: 'optional' }
        }
    });

    var BaseSelect = util.extend(defaultOptions, {
        validChildTypes: ["Item"],
        controlNodeChildren: function ($node) {
            return $node.children().not('label, value, hint, help');
        },
        typeChangeError: function (mug, typeName) {
            if (mug.form.getChildren(mug).length > 0 && !typeName.match(/^M?Select$/)) {
                return "Cannot change a Multiple/Single Choice " +
                      "question to a non-Choice question if it has Choices. " +
                      "Please remove all Choices and try again.";
            }
            return '';
        },
        afterInsert: function (form, mug) {
            var item = "Item";
            form.createQuestion(mug, 'into', item, true);
            form.createQuestion(mug, 'into', item, true);
        },
    });

    var MSelect = util.extend(BaseSelect, {
        typeName: 'Multiple Answer',
        tagName: 'select',
        icon: 'fcc fcc-fd-multi-select',
        init: function (mug, form) {
        },
        spec: {
        },
        defaultOperator: "selected"
    });

    var Select = util.extend(MSelect, {
        typeName: 'Single Answer',
        tagName: 'select1',
        icon: 'fcc fcc-fd-single-select',
        init: function (mug, form) {
        },
        defaultOperator: null
    });

    var Group = util.extend(defaultOptions, {
        typeName: 'Group',
        tagName: 'group',
        icon: 'icon-folder-open',
        isSpecialGroup: true,
        isNestableGroup: true,
        isTypeChangeable: false,
        possibleDataParent: true,
        canOutputValue: false,
        controlNodeChildren: function ($node) {
            return $node.children().not('label, value, hint, help');
        },
        init: function (mug, form) {
        },
        spec: {
            hintLabel: { presence: "notallowed" },
            calculateAttr: { presence: "notallowed" },
            constraintAttr: { presence: "notallowed" },
            constraintMsgAttr: { presence: "notallowed" },
            dataValue: { presence: "notallowed" },
            requiredAttr: { presence: "notallowed" },
        }
    });
    
    // This is just a group, but appearance = 'field-list' displays it as a list
    // of grouped questions.  It's a separate question type because it can't
    // nest other group types and it has a very different end-user functionality
    var FieldList = util.extend(Group, {
        typeName: 'Question List',
        icon: 'icon-reorder',
        init: function (mug, form) {
            Group.init(mug, form);
            mug.p.appearance = 'field-list';
        },
    });

    var Repeat = util.extend(Group, {
        typeName: 'Repeat Group',
        icon: 'icon-retweet',
        possibleDataParent: false,
        controlNodeChildren: function ($node) {
            return $node.children('repeat').children();
        },
        getExtraDataAttributes: function (mug) {
            return {"jr:template": ""};
        },
        controlChildFilter: function (children, mug) {
            var absPath = mug.form.getAbsolutePath(mug),
                r_count = mug.p.repeat_count,
                attrs = _.object(_.filter(_.map(mug.p.rawRepeatAttributes, function (val, key) {
                    return key.toLowerCase() !== "jr:noaddremove" ? [key, val] : null;
                }), _.identity));
            return [new Tree.Node(children, {
                getNodeID: function () {},
                getAppearanceAttribute: function () {},
                p: {
                    rawControlAttributes: attrs
                },
                options: {
                    tagName: 'repeat',
                    writeControlLabel: false,
                    writeControlHint: false,
                    writeControlHelp: false,
                    writeControlRefAttr: null,
                    writeCustomXML: function (xmlWriter, mug) {
                        if (r_count) {
                            xmlWriter.writeAttributeString("jr:count", String(r_count));
                            xmlWriter.writeAttributeString("jr:noAddRemove", "true()");
                        }
                        xmlWriter.writeAttributeString("nodeset", absPath);
                    },
                }
            })];
        },
        writeControlRefAttr: null,
        init: function (mug, form) {
            mug.p.repeat_count = null;
        },
        spec: {
            repeat_count: {
                lstring: 'Repeat Count',
                visibility: 'visible_if_present',
                presence: 'optional',
                widget: widgets.droppableText
            },
            rawRepeatAttributes: {
                presence: 'optional',
                lstring: "Extra Repeat Attributes"
            }
        }
    });
   
    function MugTypesManager(baseSpec, mugTypes, opts) {
        var _this = this,
            // Nestable Field List not supported in CommCare before v2.16
            group_in_field_list = opts.features.group_in_field_list;

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
                  [allTypeNames].concat(_.keys(this.auxiliaryTypes)));

        if (!group_in_field_list) {
            this.normalTypes.FieldList.validChildTypes = _.without.apply(_,
                [innerChildTypeNames].concat(_.without(_.map(this.allTypes,
                    function (type, name) {
                        return type.isNestableGroup ? name : null;
                    }
                ), null))
            );
        }

        _.each(this.auxiliaryTypes, function (type) {
            type.validChildTypes = [];
        });

        _.each(this.normalTypes, function (Mug, name) {
            if (Mug.validChildTypes) {
                return; // do nothing if validChildTypes is already set
            }
            var validChildTypes;
            if (Mug.isNestableGroup) {
                validChildTypes = innerChildTypeNames;
            } else {
                validChildTypes = [];
            }
            Mug.validChildTypes = validChildTypes;
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
            return new Mug(mugType, form, this.baseSpec, copyFrom);
        },
        changeType: function (mug, typeName) {
            var form = mug.form,
                children = form.getChildren(mug);

            var message = this.allTypes[mug.__className].typeChangeError(mug, typeName);
            if (message) {
                throw new Error(message);
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

            mug.validate();
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
                "Signature": Signature,
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
