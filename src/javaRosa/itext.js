define([
    'underscore',
    'jquery',
    'vellum/javaRosa/util',
    'vellum/util',
    'vellum/xml',
    'vellum/core'
], function (
    _,
    $,
    jrUtil,
    util,
    xml
) {
    var _nextItextItemKey = 1;
    var ItextItem = function(options) {
        this.forms = options.forms || [];
        this.id = options.id || "";
        this.autoId = _.isUndefined(options.autoId) ? true : options.autoId;
        this.hasMarkdown = _.isUndefined(options.hasMarkdown) ? false : options.hasMarkdown;
        this.itextModel = options.itextModel;
        this.key = String(_nextItextItemKey++);
        this.refCount = 1;
    };
    ItextItem.prototype = {
        clone: function () {
            var item = new ItextItem({
                forms: _.map(this.forms, function (f) { return f.clone(); }),
                id: this.id,
                autoId: this.autoId,
                itextModel: this.itextModel,
                hasMarkdown: this.hasMarkdown
            });
            return item;
        },
        getForms: function () {
            return this.forms;
        },
        getFormNames: function () {
            return this.forms.map(function (form) {
                return form.name;
            });
        },
        hasForm: function (name) {
            return this.getFormNames().indexOf(name) !== -1;
        },
        getForm: function (name) {
            return util.reduceToOne(this.forms, function (form) {
                return form.name === name;
            }, "form name = " + name);
        },
        getOrCreateForm: function (name) {
            try {
                return this.getForm(name);
            } catch (err) {
                return this.addForm(name);
            }
        },
        addForm: function (name) {
            if (!this.hasForm(name)) {
                var newForm = new ItextForm({
                    name: name,
                    itextModel: this.itextModel
                });
                this.forms.push(newForm);
                return newForm;
            }
        },
        removeForm: function (name) {
            var names = this.getFormNames();
            var index = names.indexOf(name);
            if (index !== -1) {
                this.forms.splice(index, 1);
            }
        },
        cloneForm: function (cloneFrom, cloneTo) {
            var newForm = this.getOrCreateForm(cloneFrom).clone();
            newForm.name = cloneTo;
            this.forms.push(newForm);
        },
        get: function(form, language) {
            if (_.isUndefined(form) || form === null) {
                form = "default";
            }
            if (_.isUndefined(language) || language === null) {
                language = this.itextModel.getDefaultLanguage();
            }
            if (this.hasForm(form)) {
                return this.getForm(form).getValue(language);
            }
        },
        /**
         * Set the value of this item
         *
         * @param value - The value to set.
         * @param form - The form for which a value should be set.
         *        Defaults to `"default"` if not specified.
         * @param language - The language to set. If not specified, the
         *        default language will be unconditionally set to the
         *        given value. Additionally, any other language whose
         *        value is empty or matches the previous value of the
         *        default language will be set to the new value.
         */
        set: function(value, form, language) {
            if (_.isUndefined(form) || form === null) {
                form = "default";
            }
            var itextForm = this.getOrCreateForm(form);
            if (_.isUndefined(language) || language === null) {
                language = this.itextModel.getDefaultLanguage();
                var oldDefault = itextForm.getValue(language);
                itextForm.setValue(language, value);
                // also set each language that does not have a value
                // or whose value matches the old default value
                _.each(this.itextModel.languages, function (lang) {
                    var old = itextForm.getValue(lang);
                    if (!old || old === oldDefault) {
                        itextForm.setValue(lang, value);
                    }
                });
            } else {
                itextForm.setValue(language, value);
            }
        },
        defaultValue: function() {
            return this.get();
        },
        isEmpty: function () {
            if (this.forms) {
                return _.every(this.forms, function (form) {
                    return form.isEmpty();
                });
            }
            return true;
        },
        hasHumanReadableItext: function() {
            var self = this;
            return _.some(['default', 'long', 'short'].concat(jrUtil.SUPPORTED_MEDIA_TYPES), function(form) {
                return self.hasForm(form) && _.every(self.itextModel.languages, function(lang) {
                    return self.get(form, lang);
                });
            });
        },
        forEachLogicExpression: function (fn) {
            var forms = this.getForms(),
                ret = _.map(forms, function(form) {
                    return _.map(form.getOutputRefExpressions(), function (exprs, lang) {
                        return _.map(exprs, function (expr) {
                            return fn(expr);
                        });
                    });
                });
            return _.flatten(ret);
        },
    };

    var ItextForm  = function (options) {
        this.itextModel = options.itextModel;
        this.data = options.data || {};
        this.name = options.name || "default";
        this.outputExpressions = null;
    };
    ItextForm.prototype = {
        clone: function () {
            return new ItextForm({
                itextModel: this.itextModel,
                data: _.clone(this.data),
                name: this.name
            });
        },
        getValue: function (lang) {
            return this.data[lang];
        },
        setValue: function (lang, value) {
            this.data[lang] = xml.humanize(value);
            this.outputExpressions = null;
        },
        getValueOrDefault: function (lang) {
            // check the actual language first
            if (this.data[lang]) {
                return this.data[lang];
            }
            var defLang = this.itextModel.getDefaultLanguage();
            // check the default, if necesssary
            if (lang !== defLang && this.data[defLang]) {
                return this.data[defLang];
            }
            // check arbitrarily for something
            for (var i in this.data) {
                if (this.data.hasOwnProperty(i) && this.data[i]) {
                    return this.data[i];
                }
            }
            // there wasn't anything
            return "";
        },
        isEmpty: function () {
            for (var lang in this.data) {
                if (this.data.hasOwnProperty(lang) && this.data[lang]) {
                    return false;
                }
            }
            return true;
        },
        getOutputRefExpressions: function () {
            if (this.outputExpressions === null) {
                this.updateOutputRefExpressions();
            }
            return this.outputExpressions;
        },
        updateOutputRefExpressions: function () {
            var allRefs = {},
                langRefs,
                outputs;
            for (var lang in this.data) {
                if (this.data.hasOwnProperty(lang) && this.data[lang]) {
                    outputs = $('<div>').append(this.data[lang]).find('output');
                    langRefs = [];
                    _.each(outputs, function (output) {
                        output = $(output);
                        var value = output.attr('vellum:value') || output.attr('value'),
                            ref = output.attr('vellum:ref') || output.attr('ref');
                        if (value) {
                            langRefs.push(value);
                        } else if (ref) {
                            langRefs.push(ref);
                        }
                    });
                    allRefs[lang] = langRefs;
                }
            }
            this.outputExpressions = allRefs;
        }
    };

    /**
     * The itext holder object. Access all Itext through this gate.
     *
     * Expected forms of itext:
     * - default (i.e. no special form)
     * - long
     * - short
     * - image
     * - audio
     * - hint
     *
     */
    var ItextModel = function () {
        util.eventuality(this);
        
        this.languages = [];
    };
    ItextModel.prototype = {
        getLanguages: function () {
            return this.languages;
        },
        hasLanguage: function (lang) {
            return this.languages.indexOf(lang) !== -1;
        },
        addLanguage: function (lang) {
            if (!this.hasLanguage(lang)) {
                this.languages.push(lang);
            } 
        },
        removeLanguage: function (lang) {
            if(this.hasLanguage(lang)) {
                this.languages.splice(this.languages.indexOf(lang), 1);
            }
            // if we removed the default, reset it
            if (this.getDefaultLanguage() === lang) {
                this.setDefaultLanguage(this.languages.length > 0 ? this.languages[0] : "");
            }
        },
        setDefaultLanguage: function (lang) {
            this.defaultLanguage = lang;
        },
        getDefaultLanguage: function () {
            if (this.defaultLanguage) {
                return this.defaultLanguage;
            } else {
                return this.languages.length > 0 ? this.languages[0] : "";
            }
        },
        /*
         * Create a new blank item
         */
        createItem: function (id, autoId, hasMarkdown) {
            return new ItextItem({
                id: id,
                autoId: autoId,
                itextModel: this,
                forms: [new ItextForm({
                    name: "default",
                    itextModel: this
                })],
                hasMarkdown: hasMarkdown
            });
        },
        updateForNewMug: function(mug) {
            // for new mugs, generate a label
            return this.updateForMug(mug, mug.getDefaultLabelValue());
        },
        updateForExistingMug: function(mug) {
            // for existing, just use what's there
            return this.updateForMug(mug, mug.getLabelValue());
        },
        updateForMug: function (mug, defaultLabelValue) {
            // set default itext id/values
            if (!mug.options.isDataOnly) {
                if (!mug.p.labelItext && mug.getPresence("labelItext") !== "notallowed") {
                    var item = mug.p.labelItext = this.createItem();
                    item.set(defaultLabelValue);
                }
                if (!mug.p.hintItext && mug.getPresence("hintItext") !== "notallowed") {
                    mug.p.hintItext = this.createItem();
                }
                if (!mug.p.helpItext && mug.getPresence("helpItext") !== "notallowed") {
                    mug.p.helpItext = this.createItem();
                }
            }
            if (!mug.options.isControlOnly) {
                // set constraint msg if legal and not there
                if (mug.getPresence("constraintMsgItext") !== "notallowed" &&
                    !mug.p.constraintMsgItext) {
                    mug.p.constraintMsgItext = this.createItem();
                }
            }
        }
    };

    return {
        form: ItextForm,
        item: ItextItem,
        model: ItextModel,
    };
});
