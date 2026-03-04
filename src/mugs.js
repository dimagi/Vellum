/**
 * A mug is a question, containing data, bind, and control elements.
 *
 * Main Properties
 *  nodeID
 *  label
 *  readOnlyControl
 *  imageSize: Images only. Options to reduce image size before sending form.
 *
 * Data Source Properties
 *
 * Media Properties
 *  mediaItext: Multimedia (image, audio, video, inline video) attached to the question.
 *
 * Logic Properties
 *  calculateAttr: Hidden questions only. The calculation that generates the question's value.
 *  requiredAttr: Boolean. Whether or not user must enter a value for the question.
 *  relevantAttr: Boolean expression that determines whether or not to display a question to the end user.
 *  constraintAttr: Boolean expression that, if false, will prevent the user from proceeding past the question.
 *  repeat_count: Repeat groups only. An integer expression that determines the number of groups to generate.
 *
 * Advanced Properties
 *  dataSource
 *  dataValue: Deprecated.
 *  defaultValue: An expression that will be assigned to a question before/until a user changes the value.
 *  xmlnsAttr
 *  label
 *  hintLabel
 *  constraintMsgAttr: Message to display if question fails validation (constraintAttr evaluates to false).
 *  dataParent
 *  appearance
 *  comment: User-entered comment to help other users understand the purpose or implementation of the question.
 */
import $ from "jquery";
import _ from "underscore";
import util from "vellum/util";
import baseSpecs from "./mugs/mugBaseSpecs";
import defaultOptions from "./mugs/defaultOptions";
import MugMessages from "./mugs/mugMessages";
import MugProperties from "./mugs/mugProperties";
import {deserializeXPath, serializeXPath, updateInstances} from "./mugs/xpath";
import {baseMugTypes} from "./mugs/types/index";

function Mug(options, form, baseSpec, attrs) {
    var properties = null;
    util.eventuality(this);

    if (attrs) {
        properties = _.object(_.map(attrs, function (val, key) {
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
        var _this = this,
            currentAttrs = properties || (this.p && this.p.getAttrs()) || {},
            oldMugType = this.__className;

        // These could both be calculated once for each type instead of
        // each instance.
        this.logicReferenceAttrs = [];
        this.options = util.extend(defaultOptions, options);
        this.__className = this.options.__className;
        this.showChangedMsg = true;
        this.spec = copyAndProcessSpec(this._baseSpec, this.options.spec, this.options);

        // Reset any properties that are part of the question type
        // definition.
        _.each(this.spec, function (spec, name) {
            if (spec.deleteOnCopy && (
                spec.deleteOnCopy === true ||
                spec.deleteOnCopy(currentAttrs, oldMugType)
            )) {
                delete currentAttrs[name];
            }
            var allowed = _this.getPresence(name) !== 'notallowed';
            if (allowed && spec.widget && spec.widget.trackLogicReferences) {
                _this.logicReferenceAttrs.push(name);
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
        var mug = this;

        util.checkForFormSubmissions(mug.form);

        return this._withMessages(function () {
            var changed = false;
            mug.form.updateLogicReferences(mug, attr);
            if (attr) {
                changed = mug._validate(attr);
            } else {
                _.each(mug.spec, function (spec, attr) {
                    changed = mug._validate(attr) || changed;
                });
            }
            return changed;
        });
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
            presence = mug.getPresence(attr),
            label = spec.lstring || attr,
            message = "";

        // TODO use data.hasOwnProperty(attr) rather than !value?
        if (!value && presence === 'required') {
            // can the user always fix this error?
            message = gettext('{question} is required.');
        } else if (value && presence === 'notallowed') {
            // can the user always fix this error?
            message = gettext('{question} is not allowed.');
        } else if (spec.validationFunc) {
            try {
                message = spec.validationFunc(mug);
            } catch (err) {
                // this should never happen
                message = gettext("{question} validation failed") +
                    "\n" + util.formatExc(err);
            }
            if (message === "pass") {
                message = "";
            }
        }
        if (message && message.hasOwnProperty("markdown")) {
            message.markdown = this._replaceQuestionText(message.markdown, label);
        } else {
            message = this._replaceQuestionText(message, label);
        }

        return this.messages.update(attr, {
            key: "mug-" + attr + "-error",
            level: this.ERROR,
            message: message
        });
    },
    _replaceQuestionText: function (messageText, label) {
        return util.format(messageText || "", {question: label});
    },
    // message levels
    ERROR: "error",
    WARNING: "warning",
    INFO: "info",
    /**
     * Add a message for a property. Returns true if mug changed.
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
        var messages = this.messages;
        return this._withMessages(function () {
            return messages.update(attr, msg);
        });
    },
    dropMessage: function (attr, key) {
        var spec = this.spec[attr];
        var changed = this.addMessage(attr, {key: key});
        if (spec && spec.dropMessage) {
            spec.dropMessage(this, attr, key);
        }
        return changed;
    },
    /**
     * Add many messages for many properties at once
     *
     * @param messages - An object mapping property names to lists
     *          of message objects.
     */
    addMessages: function (messages) {
        var mug = this;
        this._withMessages(function () {
            return _.reduce(messages, function (m1, list, attr) {
                return _.reduce(list, function (m2, msg) {
                    return mug.messages.update(attr, msg) || m2;
                }, false) || m1;
            }, false);
        });
    },
    _withMessages: function (func) {
        var unset = _.isUndefined(this._messagesChanged),
            changed = false;
        if (unset) {
            this._messagesChanged = false;
        }
        try {
            changed = func() || this._messagesChanged;
            if (changed) {
                if (unset) {
                    this.fire({type: "messages-changed", mug: this});
                } else {
                    this._messagesChanged = true;
                }
            }
        } finally {
            if (unset) {
                delete this._messagesChanged;
            }
        }
        return changed;
    },
    /**
     * Get a list of error and warning message strings
     */
    getErrors: function () {
        var errors = [];
        this.messages.each(function(msg) {
            if (msg.level !== "info") {
                errors.push(msg.message);
            }
        });
        return _.uniq(errors);
    },
    hasErrors: function () {
        return this.getErrors().length !== 0;
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
     * Gets the actual label, either from the control element or an empty
     * string if not found.
     */
    getLabelValue: function () {
        return this.p.label || "";
    },
    /**
     * deprecated
     */
    getNodeID: function () {
        return this.p.nodeID;
    },
    /**
     * Get property presence (does this mug have the given property)
     *
     * Valid spec presence values are:
     *  - 'required'
     *  - 'optional'
     *  - 'notallowed'
     *  - a function returning one of the above values.
     */
    getPresence: function (property) {
        var spec = this.spec[property];
        if (_.isUndefined(spec)) {
            throw new Error("unknown property: $1.spec.$2"
                .replace("$1", this.__className)
                .replace("$2", property));
        }
        if (_.isFunction(spec.presence)) {
            return spec.presence(this);
        }
        return spec.presence;
    },
    /**
     * Is the given property displayed with the mug's properties?
     *
     * Valid spec visibility values are:
     *  - 'visible'
     *  - 'visible_if_present'
     *  - 'hidden'
     *  - a function returning true (visible) or false (hidden)
     *  - the name of another property, which means the given property
     *    has the same visibility as the named property
     *
     * Properties with 'notallowed' presence are always hidden.
     */
    isVisible: function (property) {
        if (this.getPresence(property) === "notallowed") {
            // Suspect: prior to refactor, 'notallowed' presence translated
            // to hidden only if the property value was undefined,
            // meaning 'notallowed' was the same as 'visible_if_present'.
            // This comment can be removed when we find that nothing broke.
            return false;
        }
        var spec = this.spec[property],
            vis = spec.visibility;
        if (vis === "visible") {
            return true;
        }
        if (vis === "visible_if_present") {
            return !_.isUndefined(this.p[property]);
        }
        if (vis === "hidden") {
            return false;
        }
        if (_.isFunction(vis)) {
            return vis(this, spec);
        }
        if (this.spec.hasOwnProperty(vis)) {
            // Suspect: prior to refactor, dependent visibility did not
            // apply if the property had a value (i.e., was not undefined).
            // This comment can be removed when we find that nothing broke.
            return this.isVisible(vis);
        }
        throw new Error("unknown visibility: $1.spec.$2 = $3"
            .replace("$1", this.__className)
            .replace("$2", property)
            .replace("$3", String(vis)));
    },
    getDisplayName: function (lang, escape) {
        if (escape === undefined) { escape = true; }
        var itextItem = this.p.labelItext,
            Itext = this.form.vellum.data.javaRosa.Itext,
            defaultLang = Itext.getDefaultLanguage(),
            disp,
            defaultDisp,
            nodeID = this.p.conflictedNodeId || this.p.nodeID;

        if (this.__className === "ReadOnly") {
            return gettext("Unknown (read-only) question type");
        }
        if (this.__className === "Itemset") {
            return gettext("Lookup Table Data");
        }

        if (!itextItem || lang === '_ids') {
            return nodeID;
        }
        lang = lang || defaultLang;

        if(!lang) {
            return gettext('No Translation Data');
        }

        defaultDisp = itextItem.get("default", defaultLang);
        disp = itextItem.get("default", lang) || defaultDisp;

        if (disp && disp !== nodeID) {
            if (lang !== defaultLang && disp === defaultDisp) {
                disp += " [" + defaultLang + "]";
            }
            return escape ? $('<div>').text(disp).html() : disp;
        }

        return nodeID;
    },
    serialize: function () {
        var mug = this,
            data = {type: mug.__className};
        _.each(mug.spec, function (spec, key) {
            if (mug.getPresence(key) === "notallowed") {
                return;
            }
            var value = mug.p[key];
            if (spec.serialize) {
                value = spec.serialize(value, key, mug, data);
                if (!_.isUndefined(value)) {
                    data[key] = value;
                }
            } else if (value && !(_.isEmpty(value) &&
                                  (_.isObject(value) || _.isArray(value))
                      )) {
                data[key] = value;
            }
        });
        return data;
    },
    /**
     * Deserialize mug property data
     *
     * @param data - An object containing mug property data.
     * @param context - Paste context.
     */
    deserialize: function (data, context) {
        var mug = this;
        _.each(mug.spec, function (spec, key) {
            if (mug.getPresence(key) !== 'notallowed') {
                if (spec.deserialize) {
                    var value = spec.deserialize(data, key, mug, context);
                    if (!_.isUndefined(value)) {
                        mug.p[key] = value;
                    }
                } else if (data.hasOwnProperty(key)) {
                    mug.p[key] = data[key];
                }
            }
        });
    },
    teardownProperties: function () {
        this.fire({type: "teardown-mug-properties", mug: this});
    },
    isInRepeat: function() {
        if (this.__className === "Repeat") { // HACK hard-coded class name
            return true;
        }
        return this.parentMug && this.parentMug.isInRepeat();
    },
    /**
     * Check if mug is referenced by other mugs
     *
     * @param except - Array of mugs to exclude when looking for references.
     * @returns Boolean
     */
    isReferencedByOtherMugs: function (except) {
        return this.form.isReferencedByOtherMugs(this, except);
    },
};

Object.defineProperty(Mug.prototype, "absolutePath", {
    get: function () {
        return this.form.getAbsolutePath(this);
    }
});

Object.defineProperty(Mug.prototype, "absolutePathNoRoot", {
    get: function () {
        return this.form.getAbsolutePath(this, true);
    }
});

Object.defineProperty(Mug.prototype, "hashtagPath", {
    get: function () {
        // commtrack isn't hashtaggable (ex. /data/trans[type=trans1])
        if (this.options.isHashtaggable && this.absolutePathNoRoot) {
            return '#form' + this.absolutePathNoRoot;
        }
        return this.absolutePath;
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

Object.defineProperty(Mug.prototype, "previousSibling", {
    get: function () {
        return this.form.tree.getPreviousSibling(this);
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

function MugTypesManager(baseSpec, mugTypes, opts) {
    var _this = this,
        // Nestable Field List not supported in CommCare before v2.16
        group_in_field_list = opts.features.group_in_field_list;
    baseMugTypes.normal.Image.resize_enabled = opts.features.image_resize;

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
        var attrs = copyFrom ? copyFrom.p.getAttrs() : null;
        return new Mug(mugType, form, this.baseSpec, attrs);
    },
    changeType: function (mug, typeName) {
        var form = mug.form,
            children = form.getChildren(mug);

        var message = this.allTypes[mug.__className].typeChangeError(mug, typeName);
        if (message) {
            throw new Error(message);
        }
        this.allTypes[mug.__className].changeTypeTransform(mug);

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

export default {
    defaultOptions: defaultOptions,
    baseMugTypes: baseMugTypes,
    MugTypesManager: MugTypesManager,
    MugMessages: MugMessages,
    WARNING: Mug.WARNING,
    ERROR: Mug.ERROR,
    baseSpecs: baseSpecs,
    deserializeXPath: deserializeXPath,
    serializeXPath: serializeXPath,
    updateInstances: updateInstances,
};
