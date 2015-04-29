/*
 * A Vellum plugin to support JavaRosa extensions to the XForm spec,
 * particularly IText.
 *
 * Also adds specs for the JavaRosa preload attributes.
 */
define([
    'underscore',
    'jquery',
    'xpath',
    'xpathmodels',
    'tpl!vellum/templates/edit_source',
    'tpl!vellum/templates/language_selector',
    'tpl!vellum/templates/control_group',
    'text!vellum/templates/button_remove.html',
    'vellum/widgets',
    'vellum/util',
    'vellum/tsv',
    'vellum/xml',
    'vellum/core'
], function (
    _,
    $,
    xpath,
    xpathmodels,
    edit_source,
    language_selector,
    control_group,
    button_remove,
    widgets,
    util,
    tsv,
    xml
) {
    var SUPPORTED_MEDIA_TYPES = ['image', 'audio', 'video'],
        DEFAULT_EXTENSIONS = {
            image: 'png',
            audio: 'mp3',
            video: '3gp'
        },
        RESERVED_ITEXT_CONTENT_TYPES = [
            'default', 'short', 'long', 'audio', 'video', 'image'
        ],
        _nextItextItemKey = 1,
        HELP_MARKDOWN;

    function ItextItem(options) {
        this.forms = options.forms || [];
        this.id = options.id || "";
        this.autoId = _.isUndefined(options.autoId) ? true : options.autoId;
        this.itextModel = options.itextModel;
        this.key = String(_nextItextItemKey++);
    }
    ItextItem.prototype = {
        clone: function () {
            var item = new ItextItem({
                forms: _.map(this.forms, function (f) { return f.clone(); }),
                id: this.id,
                autoId: this.autoId,
                itextModel: this.itextModel
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
            return Boolean(this.hasForm('default') || 
                           this.hasForm('long')    || 
                           this.hasForm('short'));
        }
    };

    function ItextForm (options) {
        this.itextModel = options.itextModel;
        this.data = options.data || {};
        this.name = options.name || "default";
        this.outputExpressions = null;
    }
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
            this.data[lang] = value;
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
                outputRe,
                match;
            for (var lang in this.data) {
                if (this.data.hasOwnProperty(lang) && this.data[lang]) {
                    outputRe = /(?:<output (?:value|ref)=")(.*?)(?:"\s*(?:\/|><\/output)>)/gim;
                    langRefs = [];
                    match = outputRe.exec(this.data[lang]);
                    while (match !== null) {
                        langRefs.push(match[1]);
                        match = outputRe.exec(this.data[lang]);
                    }
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
    function ItextModel () {
        util.eventuality(this);
        
        this.languages = [];
    }
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
        createItem: function (id, autoId) {
            return new ItextItem({
                id: id,
                autoId: autoId,
                itextModel: this,
                forms: [new ItextForm({
                    name: "default",
                    itextModel: this
                })]
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
            function getPresence(itext) {
                if (_.isFunction(itext.presence)) {
                    return itext.presence(mug.options);
                }
                return itext.presence;
            }

            function missingMarkdownForm(forms) {
                return _.filter(forms, function(form) {
                    return form.name === 'markdown';
                }).length === 0;
            }

            // set default itext id/values
            if (!mug.options.isDataOnly) {
                if (!mug.p.labelItext && getPresence(mug.spec.labelItext) !== "notallowed") {
                    var item = mug.p.labelItext = this.createItem();
                    item.set(defaultLabelValue);
                }
                if (!mug.p.hintItext && getPresence(mug.spec.hintItext) !== "notallowed") {
                    mug.p.hintItext = this.createItem();
                }
                if (!mug.p.helpItext && getPresence(mug.spec.helpItext) !== "notallowed") {
                    var help = mug.p.helpItext = this.createItem();
                    if (HELP_MARKDOWN) {
                        help.cloneForm('default', 'markdown');
                    }
                } else if (HELP_MARKDOWN && mug.p.helpItext &&
                           missingMarkdownForm(mug.p.helpItext.forms)) {
                    mug.p.helpItext.cloneForm('default', 'markdown');
                }
            }
            if (!mug.options.isControlOnly) {
                // set constraint msg if legal and not there
                if (mug.spec.constraintMsgItext.presence !== "notallowed" &&
                    !mug.p.constraintMsgItext) {
                    mug.p.constraintMsgItext = this.createItem();
                }
            }
        }
    };

    var ITEXT_PROPERTIES = [
            'labelItext',
            'hintItext',
            'helpItext',
            'constraintMsgItext'
        ];

    /**
     * Call visitor function for each Itext item in the form
     */
    function forEachItextItem(form, visit) {
        var seen = {};

        form.tree.walk(function (mug, nodeID, processChildren) {
            if(mug) { // skip root node
                _.each(ITEXT_PROPERTIES, function (property) {
                    var item = mug.p[property];
                    if (item && !item.key) {
                        // this should never happen
                        window.console.log(
                            "ignoring ItextItem without a key: " + item.id);
                        return;
                    } else if (item && !seen.hasOwnProperty(item.key)) {
                        seen[item.key] = true;
                        visit(item, mug, property);
                    }
                });
            }
            processChildren();
        });
    }

    /**
     * Walks the tree and grabs Itext items from mugs
     *
     * This updates the ID of each returned Itext item according to it's
     * autoId property. IDs of items with autoId turned off will not be
     * modified unless the ID is blank or it conflicts with another item.
     * NOTE because this mutates itext IDs it could cause subtle side
     * effects if anything depends on Itext IDs not changing at random
     * times such as save, copy, paste, export translations, etc.
     *
     * @param form - the vellum instance's Form object.
     * @param empty - if true, return empty items as well. Otherwise omit them.
     * @returns - a list of Itext items.
     */
    function getItextItemsFromMugs(form, empty) {
        var ret = [],
            byId = {},
            props = _.object(_.map(ITEXT_PROPERTIES, function (thing) {
                return [thing, thing.replace("Itext", "")];
            }));

        forEachItextItem(form, function (item, mug, property) {
            var itemIsEmpty = item.isEmpty();
            if (!itemIsEmpty || empty) {
                var id = item.autoId || !item.id ?
                         getDefaultItextId(mug, props[property]) : item.id,
                    origId = id,
                    count = 2;
                if (itemIsEmpty && byId.hasOwnProperty(id)) {
                    // ignore empty item with duplicate ID
                    return;
                }
                while (byId.hasOwnProperty(id)) {
                    id = origId + count;
                }
                item.id = id;
                byId[id] = item;
                ret.push(item);
            }
        });
        return ret; 
    }

    var iTextIDWidget = function (mug, options) {
        var widget = widgets.text(mug, options),
            $input = widget.input,
            currentValue = null,
            isSelectItem = mug.__className === "Item";

        function autoGenerateId() {
            return getDefaultItextId(mug, widget.path);
        }

        function updateAutoId() {
            _setValue(autoGenerateId());
            setAutoMode(true);
        }

        var _setValue = widget.setValue;

        widget.setValue = function (value) {
            currentValue = value;
            if (value.autoId) {
                updateAutoId();
            } else {
                _setValue(value.id);
                setAutoMode(false);
            }
        };

        widget.getValue = function() {
            currentValue.id = $input.val();
            currentValue.autoId = getAutoMode();
            return currentValue;
        };

        // auto checkbox
        var $autoBox = $("<input />").attr("type", "checkbox");

        $autoBox.change(function () {
            if ($(this).prop('checked')) {
                updateAutoId();
                widget.handleChange();
            }
        });

        function setAutoMode(autoMode) {
            $autoBox.prop("checked", autoMode);
        }

        function getAutoMode() {
            return $autoBox.prop('checked');
        }

        var _getUIElement = widget.getUIElement;
        widget.getUIElement = function () {
            var $uiElem = _getUIElement(),
                $autoBoxContainer = $('<div />').addClass('fd-itextID-checkbox-container'),
                $autoBoxLabel = $("<label />").text("auto?").addClass('checkbox');

            $autoBoxLabel.prepend($autoBox);
            $autoBoxContainer.append($autoBoxLabel);
            $uiElem.css('position', 'relative');

            $uiElem.find('.controls')
                .addClass('fd-itextID-controls')
                .after($autoBoxContainer);

            return $uiElem;
        };

        widget.input.keyup(function () {
            // turn off auto-mode if the id is ever manually overridden
            var newVal = $(this).val();
            if (newVal !== autoGenerateId()) {
                setAutoMode(false);
            }
        });

        mug.on("property-changed", function (e) {
            if (getAutoMode() && (
                    e.property === "nodeID" ||
                    (isSelectItem && e.property === "defaultValue"))) {
                $input.val(autoGenerateId());
            }
        }, null, widget);

        mug.on("teardown-mug-properties", function (e) {
            e.mug.unbind(widget);
        }, null, widget);

        return widget;
    };

    var baseItextBlock = function (mug, options) {
        var Itext = mug.form.vellum.data.javaRosa.Itext,
            block = {};
        util.eventuality(block);

        block.mug = mug;
        block.itextType = options.itextType;
        block.languages = Itext.getLanguages();
        block.defaultLang = Itext.getDefaultLanguage();
        block.forms = options.forms || ["default"];

        block.getItextItem = function () {
            return options.getItextByMug(block.mug);
        };

        block.setValue = function (val) {
            // none
        };

        block.getValue = function (val) {
            // none
        };

        var $blockUI = $("<div />")
            .addClass('itext-block-container')
            .addClass("itext-block-" + block.itextType);

        block.getFormGroupClass = function (form) {
            return 'itext-block-' + block.itextType + '-group-' + form;
        };

        block.getFormGroupContainer = function (form) {
            return $("<div />")
                .addClass(block.getFormGroupClass(form))
                .addClass('itext-lang-group');
        };

        block.getForms = function () {
            return block.forms;
        };

        block.getUIElement = function () {
            _.each(block.getForms(), function (form) {
                var $formGroup = block.getFormGroupContainer(form);
                _.each(block.languages, function (lang) {
                    var itextWidget = block.itextWidget(block.mug, lang, form, options);
                    itextWidget.init();
                    itextWidget.on("change", function () {
                        block.fire("change");
                    });
                    $formGroup.append(itextWidget.getUIElement());
                });
                $blockUI.append($formGroup);
            });
            return $blockUI;
        };

        return block;
    };

    var itextLabelBlock = function (mug, options) {
        var block = baseItextBlock(mug, options);
        block.itextWidget = itextLabelWidget;
        return block;
    };

    var itextConfigurableBlock = function (mug, options) {
        var block = baseItextBlock(mug, options);

        block.isCustomAllowed = options.isCustomAllowed;
        block.activeForms = block.getItextItem().getFormNames();
        block.displayName = options.displayName;
        block.formToIcon = options.formToIcon || {};

        block.itextWidget = itextFormWidget;

        block.getForms = function () {
            var customForms = _.difference(block.activeForms, RESERVED_ITEXT_CONTENT_TYPES),
                relevantForms = _.intersection(block.activeForms, block.forms);
            return _.union(customForms, relevantForms);
        };

        var _getFormGroupContainer = block.getFormGroupContainer;
        block.getFormGroupContainer = function (form) {
            var $formGroup = _getFormGroupContainer(form);
            $formGroup.addClass("itext-lang-group-config")
                .data('formtype', form);
            return $formGroup;
        };

        block.getAddFormButtonClass = function (form) {
            return 'itext-block-' + block.itextType + '-add-form-' + form;
        };

        block.getAddFormButtons = function () {
            var $buttonGroup = $("<div />").addClass("btn-group itext-options");
            _.each(block.forms, function (form) {
                var $btn = $('<div />');
                $btn.text(' ' + form)
                    .addClass(block.getAddFormButtonClass(form))
                    .addClass('btn itext-option').click(function () {
                        block.addItext(form);
                    });

                var iconClass = block.formToIcon[form];
                if (iconClass) {
                    $btn.prepend($('<i />').addClass(iconClass).after(" "));
                }

                if (block.activeForms.indexOf(form) !== -1) {
                    $btn.addClass('disabled');
                }
                $buttonGroup.append($btn);
            });

            if (block.isCustomAllowed) {
                $buttonGroup.append(block.getAddCustomItextButton());
            }
            return $buttonGroup;
        };

        block.getAddCustomItextButton = function () {
            var $customButton = $("<button />")
                    .text("custom...")
                    .addClass('btn')
                    .attr('type', 'button'),
                newItextBtnClass = 'fd-new-itext-button';

            $customButton.click(function () {
                var $modal, $newItemForm, $newItemInput;
                $modal = mug.form.vellum.generateNewModal("New Content Type", [
                    {
                        title: "Add",
                        cssClasses: newItextBtnClass + " disabled ",
                        attributes: {
                            disabled: "disabled"
                        }
                    }
                ]);

                $newItemForm = $(control_group({
                    label: "Content Type"
                }));

                $newItemInput = $("<input />").attr("type", "text");
                $newItemInput.keyup(function () {
                    var currentValue = $(this).val(),
                        $addButton = mug.form.vellum.$f.find('.' + newItextBtnClass);
                    if (!currentValue || 
                        RESERVED_ITEXT_CONTENT_TYPES.indexOf(currentValue) !== -1 || 
                        block.activeForms.indexOf(currentValue) !== -1) 
                    {
                        $addButton
                            .addClass('disabled')
                            .removeClass('btn-primary')
                            .attr('disabled', 'disabled');
                    } else {
                        $addButton
                            .removeClass('disabled')
                            .addClass('btn-primary')
                            .removeAttr('disabled');
                    }
                });

                $newItemForm.find('.controls').append($newItemInput);
                $modal
                    .find('.modal-body')
                    .append($newItemForm);
                mug.form.vellum.$f.find('.' + newItextBtnClass).click(function () {
                    var newItemType = $newItemInput.val();
                    if (newItemType) {
                        block.addItext($newItemInput.val());
                        $modal.modal('hide');
                    }
                });
                $modal.modal('show');
                $modal.one('shown', function () {
                    $newItemInput.focus();
                });
            });

            return $customButton;
        };

        block.deleteItextForm = function (form) {
            var itextItem = block.getItextItem();
            if (itextItem) {
                itextItem.removeForm(form);
            }
            block.activeForms = _.without(block.activeForms, form);
            block.fire("change");
        };

        block.getDeleteFormButton = function (form) {
            var $deleteButton = $(button_remove);
            $deleteButton.addClass('pull-right')
                .click(function () {
                    var $formGroup = $('.' + block.getFormGroupClass(form));
                    block.deleteItextForm(form);
                    block.mug.fire({
                        type: 'question-itext-deleted',
                        form: form
                    });
                    $formGroup.remove();
                    $(this).remove();
                    $('.' + block.getAddFormButtonClass(form))
                        .removeClass('disabled');
                });
            return $deleteButton;
        };

        block.addItext = function (form) {
            if (block.activeForms.indexOf(form) !== -1) {
                return;
            }
            block.activeForms.push(form);
            block.fire("change");

            $('.' + block.getAddFormButtonClass(form)).addClass('disabled');
            var $groupContainer = block.getFormGroupContainer(form);
            _.each(block.languages, function (lang) {
                var itextWidget = block.itextWidget(block.mug, lang, form, options);
                itextWidget.init(true);
                itextWidget.on("change", function () {
                    block.fire("change");
                });
                $groupContainer.append(itextWidget.getUIElement());
            });
            $blockUI.find('.new-itext-control-group').after($groupContainer);
            $groupContainer.before(block.getDeleteFormButton(form));
        };

        var $blockUI = $('<div />'),
            _getParentUIElement = block.getUIElement;
        block.getUIElement = function () {
            $blockUI = _getParentUIElement();

            var $addFormControls = $(control_group({
                label: block.displayName,
            }));
            $addFormControls.addClass('new-itext-control-group').find('.controls').append(block.getAddFormButtons());
            $blockUI.prepend($addFormControls);

            var $formGroup = $blockUI.find('.itext-lang-group');
            $formGroup.each(function () {
               $(this).before(block.getDeleteFormButton($(this).data('formtype')));
            });

            return $blockUI;
        };

        return block;
    };

    var itextMediaBlock = function (mug, options) {
        var block = itextConfigurableBlock(mug, options);

        block.getForms = function () {
            return _.intersection(block.activeForms, block.forms);
        };

        // this used to be the form ID instead of 'data'.  Since
        // only hand-made forms will ever end up with a different
        // ID (the ability to set it in the UI has been broken for
        // a while), it seemed ok to make it just 'data'
        block.itextWidget = itextMediaWidget(mug.form.getBasePath());

        return block;
    };

    var itextMediaHelpBlock = function (mug, options) {
        var block = itextConfigurableBlock(mug, options);

        block.getForms = function () {
            return _.intersection(block.activeForms, block.forms);
        };

        block.itextWidget = itextMediaWidget('/help' + mug.form.getBasePath());

        return block;
    };

    var itextLabelWidget = function (mug, language, form, options) {
        var vellum = mug.form.vellum,
            Itext = vellum.data.javaRosa.Itext,
            // todo: id->class
            id = "itext-" + language + "-" + options.itextType;
        if (options.idSuffix) {
            id = id + options.idSuffix;
        }
        options.id = id;

        var widget = widgets.base(mug, options);
        var $input = $("<textarea></textarea>")
            .attr("name", widget.id)
            .attr("rows", "2")
            .addClass('input-block-level itext-widget-input')
            .on('change input', function (e) { widget.handleChange(); })
            .focus(function() { this.select(); })
            .keyup(function (e) {
                // workaround for webkit: http://stackoverflow.com/a/12114908
                if (e.which === 9) {
                    this.select();
                }
            });

        if (options.path === 'labelItext') {
            $input.addClass('jstree-drop');
            $input.keydown(function (e) {
                // deletion of entire output ref in one go
                if (e && e.which === 8 || e.which === 46) {
                    var control = widget.getControl()[0],
                        pos = util.getCaretPosition(control),
                        val = widget.getValue(),
                        outputBegin = '<output',
                        outputEnd = '/>',
                        start,
                        end,
                        match;
                    if (e.which === 8) {
                        match = val.substr(pos - 2, 2);
                        if (match === outputEnd) {
                            start = val.lastIndexOf(outputBegin, pos);
                            end = pos;
                        }
                    } else if (e.which === 46) {
                        match = val.substr(pos, outputBegin.length);
                        if (match === outputBegin) {
                            end = val.indexOf(outputEnd, pos);
                            end = end === -1 ? end : end + 2;
                            start = pos;
                        }
                    }
                    if (start || end && start !== -1 && end !== -1) {
                        var noRef = val.slice(0, start) + val.slice(end, val.length);
                        widget.setValue(noRef);
                        util.setCaretPosition(control, start);
                        e.preventDefault();
                    }
                }
            });
        }

        widget.displayName = options.displayName;
        widget.itextType = options.itextType;
        widget.form = form || "default";

        widget.language = language;
        widget.languageName = util.langCodeToName[widget.language] || widget.language;
        widget.showOneLanguage = Itext.getLanguages().length < 2;
        widget.defaultLang = Itext.getDefaultLanguage();
        widget.isDefaultLang = widget.language === widget.defaultLang;
        widget.isSyncedWithDefaultLang = false;
        widget.hasNodeIdPlaceholder = options.path === 'labelItext';

        widget.getControl = function () {
            return $input;
        };

        widget.getItextItem = function () {
            // Make sure the real itextItem is being updated at all times, not a stale one.
            return options.getItextByMug(widget.mug);
        };

        widget.getItextValue = function (lang) {
            var itextItem = widget.getItextItem();
            if (!lang) {
                lang = widget.language;
            }
            return itextItem && itextItem.get(widget.form, lang);
        };

        widget.setItextValue = function (value) {
            var itextItem = widget.getItextItem();
            if (itextItem) {
                if (widget.isDefaultLang) {
                    widget.mug.fire({
                        type: 'defaultLanguage-itext-changed',
                        form: widget.form,
                        prevValue: itextItem.get(widget.form, widget.language),
                        value: value,
                        itextType: widget.itextType
                    });
                }
                itextItem.getForm(widget.form).setValue(widget.language, value);
                widget.fireChangeEvents();
            }
        };

        widget.getLangDesc = function () {
            if (widget.showOneLanguage) {
                return "";
            }
            return " (" + widget.languageName + ")";
        };

        widget.getDisplayName = function () {
            return widget.displayName + widget.getLangDesc();
        };

        widget.init = function (loadDefaults) {
            // Note, there are TWO defaults here.
            // There is the default value when this widget is initialized.
            // There is the value of the default language.
            if (loadDefaults) {
                var defaultValue = widget.getDefaultValue();
                widget.getItextItem().getOrCreateForm(widget.form);
                widget.setValue(defaultValue);
                widget.handleChange();
            } else {
                var itextItem = widget.getItextItem();

                if (!itextItem) {
                    widget.setValue("");
                    return;
                }

                var value = widget.getItextValue(),
                    placeholder = widget.hasNodeIdPlaceholder ? widget.mug.p.nodeID : "";
                if (!widget.isDefaultLang) {
                    placeholder = widget.getItextValue(widget.defaultLang) || placeholder;
                }
                widget.setPlaceholder(placeholder);
                widget.setValue(value && value !== placeholder ? value : "");
            }
        };

        var _updateValue = widget.updateValue;
        widget.updateValue = function () {
            _updateValue();
            if (!widget.getValue() && !widget.isDefaultLang) {
                widget.setItextValue(widget.getItextValue(widget.defaultLang));
            }
        };

        widget.destroy = function (e) {
            if (e.form === widget.form) {
                widget.fireChangeEvents();
            }
        };

        widget.mug.on('question-itext-deleted', widget.destroy, null, widget);

        widget.toggleDefaultLangSync = function (val) {
            widget.isSyncedWithDefaultLang = !val && !widget.isDefaultLang;
        };

        widget.setValue = function (val) {
            $input.val(val);
        };

        widget.setPlaceholder = function (val) {
            $input.attr("placeholder", val);
        };

        widget.getValue = function () {
            return $input.val();
        };

        widget.getPlaceholder = function () {
            return $input.attr('placeholder');
        };

        widget.getDefaultValue = function () {
            return null;
        };

        if (widget.hasNodeIdPlaceholder && widget.isDefaultLang) {
            widget.mug.on('property-changed', function (e) {
                if (e.property === "nodeID") {
                    widget.setPlaceholder(e.val);
                    if (widget.getItextValue() === e.previous || !widget.getValue()) {
                        widget.setItextValue(e.val);
                        widget.setValue("");
                    }
                }
            }, null, widget);
        }

        if (!widget.isDefaultLang) {
            widget.mug.on('defaultLanguage-itext-changed', function (e) {
                if (e.form === widget.form && e.itextType === widget.itextType) {
                    var placeholder = e.value;
                    if (!placeholder && widget.hasNodeIdPlaceholder) {
                        placeholder = widget.mug.p.nodeID;
                    }
                    widget.setPlaceholder(placeholder);
                    if (widget.getItextValue() === e.prevValue || !widget.getValue()) {
                        // Make sure all the defaults keep in sync.
                        widget.setItextValue(placeholder);
                        widget.setValue("");
                    }
                }
            }, null, widget);
        }

        widget.fireChangeEvents = function () {
            var itextItem = widget.getItextItem();
            if (!itextItem) {
                return;
            }
            // todo: move this out of the widget
            // this is one of three things that are relatively similar,
            // including refreshVisibleData()
            // Update any display values that are affected
            // NOTE: This currently walks the whole tree since you may
            // be sharing itext IDs. Generally it would be far more
            // efficient to just do it based off the currently changing
            // node. Left as a TODO if we have performance problems with
            // this operation, but the current behavior is more correct.
            var allMugs = mug.form.getMugList();
            if (vellum.data.core.currentItextDisplayLanguage === widget.language) {
                allMugs.map(function (mug) {
                    var treeName = itextItem.get(widget.form, widget.language) || 
                            mug.form.vellum.getMugDisplayName(mug),
                        it = mug.p.labelItext;
                    if (it && it.id === itextItem.id && widget.form === "default") {
                        mug.form.fire({
                            type: 'question-label-text-change',
                            mug: mug,
                            text: treeName
                        });
                    }
                });
            }
        };

        widget.save = function () {
            widget.setItextValue(widget.getValue());
        };

        widget.mug.on("teardown-mug-properties", function (e) {
            e.mug.unbind(widget);
        }, null, widget);

        return widget;

    };

    var itextFormWidget = function (mug, language, form, options) {
        options = options || {};
        options.idSuffix = "-" + form;
        var widget = itextLabelWidget(mug, language, form, options);

        widget.getDisplayName = function () {
            return form + widget.getLangDesc();
        };
        return widget;
    };

    var ICONS = {
        image: 'icon-picture',
        audio: 'icon-volume-up',
        video: 'icon-facetime-video'
    };

    var itextMediaWidget = function (url_type) {
        return function (mug, language, form, options) {
            var widget = itextFormWidget(mug, language, form, options);

            widget.getDefaultValue = function () {
                if (SUPPORTED_MEDIA_TYPES.indexOf(form) !== -1) {
                    // default formats
                    // image: jr://file/commcare/image/form_id/question_id.png
                    // audio: jr://file/commcare/audio/form_id/question_id.mp3
                    var extension = DEFAULT_EXTENSIONS[form];
                    return "jr://file/commcare/" + form + url_type +
                           getDefaultItextRoot(widget.mug) + "." + extension;
                }
                return null;
            };

            widget.mug.form.vellum.initWidget(widget);

            return widget;
        };
    };
    
    var parseXLSItext = function (form, str, Itext) {
        var forms = ["default", "audio", "image" , "video"],
            languages = Itext.getLanguages(),
            nextRow = tsv.makeRowParser(str),
            header = nextRow(),
            i, cells, head, item;

        if (header) {
            header = _.map(header, function (val) {
                var formlang = val.split("-");
                if (forms.indexOf(formlang[0]) === -1 ||
                        languages.indexOf(formlang[1]) === -1) {
                    return null;
                }
                return {form: formlang[0], lang: formlang[1]};
            });
        }

        var items = getItextItemsFromMugs(form, true);
        items = _.object(_.map(items, function (item) { return [item.id, item]; }));
        cells = nextRow();
        while (cells) {
            // what's the point of creating items here?
            item = items[cells[0]];
            if (!item) {
                // TODO alert user that row was skipped
                continue;
            }
            for (i = 1; i < cells.length; i++) {
                head = header[i];
                if (head) {
                    if (item.hasForm(head.form)) {
                        item.getForm(head.form).setValue(head.lang, cells[i]);
                    } else if ($.trim(cells[i])) {
                        item.getOrCreateForm(head.form).setValue(head.lang, cells[i]);
                    }
                }
            }
            cells = nextRow();
        }
        Itext.fire("change");
    };

    var generateItextXLS = function (form, Itext) {
        function rowify(firstVal, languages, forms, func) {
            var row = [firstVal];
            _.each(forms, function (form) {
                _.each(languages, function (language) {
                    row.push(func(language, form));
                });
            });
            return row;
        }

        function makeRow(item, languages, forms) {
            return rowify(item.id, languages, forms, function (language, form) {
                return item.hasForm(form) ? item.get(form, language) : "";
            });
        }

        function makeHeadings(languages, forms) {
            return rowify("label", languages, forms, function (language, form) {
                return form + '-' + language;
            });
        }

        // TODO: should this be configurable?
        var forms = ["default", "audio", "image" , "video"],
            languages = Itext.getLanguages(),
            rows = [];

        if (languages.length > 0) {
            var items = getItextItemsFromMugs(form);
            rows.push(makeHeadings(languages, forms));
            _.each(items, function (item) {
                rows.push(makeRow(item, languages, forms));
            });
        }
        return tsv.tabDelimit(rows);
    };

    function warnOnNonOutputableValue(form, mug, path) {
        if (!mug.options.canOutputValue) {
            var typeName = mug.options.typeName;
            form.updateError({
                level: "form-warning",
                message: typeName + " nodes can not be used in an output value. " +
                    "Please remove the output value for '" + path +
                    "' or your form will have errors."
            }, {updateUI: true});
        }
    }

    function getOutputRef(path, dateFormat) {
        if (dateFormat) {
            return '<output value="format-date(date(' + path + '), \'' + dateFormat + '\')"/>';
        } else {
            return '<output value="' + path + '" />';
        }
    }

    function getDefaultItextRoot(mug) {
        if (mug.__className === "Item") {
            var regex = new RegExp(util.invalidAttributeRegex.source, 'g');
            return getDefaultItextRoot(mug.parentMug) + "-" +
                mug.getNodeID().replace(regex, '_');
        } else {
            var path = mug.form.getAbsolutePath(mug, true);
            if (!path) {
                if (mug.parentMug) {
                    path = mug.form.getAbsolutePath(mug.parentMug, true) +
                            "/" + mug.getNodeID();
                } else {
                    // fall back to nodeID if mug path still not found
                    // this can happen with malformed XForms
                    path = "/" + mug.getNodeID();
                }
            }
            return path.slice(1);
        }
    }

    function getDefaultItextId(mug, property) {
        return getDefaultItextRoot(mug) + "-" + property;
    }

    $.vellum.plugin("javaRosa", {
        langs: ['en'],
        displayLanguage: 'en'
    }, {
        init: function () {
            // todo: plugin abstraction barrier
            this.data.javaRosa.ItextItem = ItextItem;
            this.data.javaRosa.ItextForm = ItextForm;
            this.data.javaRosa.ICONS = ICONS;
            HELP_MARKDOWN = this.opts().features.help_markdown;
        },
        insertOutputRef: function (mug, target, path, dateFormat) {
            var output = getOutputRef(path, dateFormat),
                form = this.data.core.form;
            util.insertTextAtCursor(target, output, true);
            this.warnOnCircularReference('label', form, mug, path, 'output value');
            warnOnNonOutputableValue(form, mug, path);
        },
        handleDropFinish: function (target, sourceUid, mug) {
            var inItext = target &&
                target.attr('name') &&
                target.attr('name').lastIndexOf('itext-', 0) === 0,
                _this = this;

            if (inItext) {
                var path = this.mugToXPathReference(mug),
                    mugType = mug.options.typeName;
                if (mugType === 'Date') {
                    var formatOptions = {
                        "": "No Formatting",
                        "%d/%n/%y": "DD/MM/YY e.g. 04/01/14",
                        "%a, %b %e, %Y": "DDD, MMM DD, YYYY e.g. Sun, Jan 1, 2014"
                    };
                    var menuHtml = '<ul class="dropdown-menu" role="menu" aria-labelledby="dropdownMenu">' +
                        '<li><strong>Date Format Options</strong></li>';
                    _(formatOptions).each(function(label, format) {
                        menuHtml += '<li><a tabindex="-1" href="#" data-format="' + format + '">' + label + '</a></li>';
                    });
                    menuHtml += '</ul>';

                    var menu = $(menuHtml);
                    $('body').append(menu);
                    menu.find('li a').click(function () {
                        _this.insertOutputRef(mug, target, path, $(this).data('format'));
                        menu.remove();
                    });
                    var e = window.event;
                    menu.css({'top': e.clientY, 'left': e.clientX}).show();
                } else {
                    _this.insertOutputRef(mug, target, path);
                }
            } else {
                _this.__callOld();
            }
        },
        handleNewMug: function (mug) {
            var ret = this.__callOld();
            this.data.javaRosa.Itext.updateForNewMug(mug);
            return ret;
        },
        _makeLanguageSelectorDropdown: function () {
            var _this = this,
                langList,
                langs = this.data.javaRosa.Itext.getLanguages(),
                fullLangs,
                $langSelector;

            fullLangs = _.map(langs, function (lang) {
                return {
                    code: lang,
                    name: util.langCodeToName[lang] || lang
                };
            });
            fullLangs[fullLangs.length] = {
                code: '_ids',
                name: 'Question ID'
            };

            if (fullLangs.length < 2) {
                return;
            }

            $langSelector = $(language_selector({
                languages: fullLangs
            }));

            langList = $langSelector.find('select');
            langList.change(function () {
                _this._changeTreeDisplayLanguage($(this).val());
            });

            langList.val(this.data.core.currentItextDisplayLanguage);

            this.$f.find('.fd-question-tree-lang').html($langSelector);
        },
        _changeTreeDisplayLanguage: function (lang) {
            var _this = this,
                form = this.data.core.form;
           
            // todo: getMugDisplayName should not rely on this state, it should be
            // passed
            this.data.core.currentItextDisplayLanguage = lang;

            // this shares most of the same functionality as refreshVisibleData().
            // todo: refactor into one method
            this.data.core.$tree.find('li').each(function (i, el) {
                var $el = $(el),
                    mug = form.getMugByUFID($el.prop('id'));

                try {
                    if (_this.data.core.currentItextDisplayLanguage === "_ids") {
                        _this.jstree('rename_node', $el, mug.getNodeID());
                    }
                    else {
                        if (mug.p.labelItext) {
                            var text = _this.getMugDisplayName(mug);
                            _this.jstree('rename_node', $el, text ||
                                    _this.opts().core.noTextString);
                        }
                    }
                } catch (e) {
                    /* This happens immediately after question duplication when
                     * we try to rename the duplicated node in the UI tree. The
                     * form XML is correct and the inputs change the appropriate
                     * strings in the XML and in the UI tree, so we're just
                     * going to ignore the fact that this internal data
                     * structure isn't initialized with the default language's
                     * itext value for this field yet, and simply not rename the
                     * UI node, which will produce the same behavior. */
                    // todo: re-examine this comment since there's been a lot of
                    // refactoring
                    if (e !== "NoItextItemFound") {
                        throw e;
                    }
                }
            });
        },
        // parse Itext Block and populate itext model
        loadXML: function (xmlString) {
            var _this = this,
                langs = this.opts().javaRosa.langs,
                Itext, itextMap;

            this.data.javaRosa.Itext = Itext = new ItextModel();
            this.data.javaRosa.itextMap = itextMap = {};

            function eachLang() {
                var el = $(this);
                var lang = el.attr('lang');
                
                function eachText() {
                    var textEl = $(this);
                    var id = textEl.attr('id');
                    var item = itextMap[id];
                    if (!item || !itextMap.hasOwnProperty(id)) {
                        item = Itext.createItem(id);
                        itextMap[id] = item;
                    }

                    function eachValue() {
                        var valEl = $(this);
                        var curForm = valEl.attr('form');
                        if(!curForm) {
                            curForm = "default";
                        }
                        item.getOrCreateForm(curForm)
                            .setValue(lang, xml.humanize(valEl));
                    }
                    textEl.children().each(eachValue);
                }

                if (langs && langs.indexOf(lang) === -1) {
                    // todo: plugins!
                    _this.data.core.parseWarnings.push(
                        "You have languages in your form that are not specified " +
                        "in the \"Languages\" page of the application builder. " +
                        "The following language will be deleted on save " +
                        "unless you add it to the \"Languages\" page: " +
                        lang + "."
                    );
                    return;
                }
                Itext.addLanguage(lang);
                if (el.attr('default') !== undefined) {
                    Itext.setDefaultLanguage(lang);
                }

                //loop through children
                el.children().each(eachText);
            }

            
            if (langs && langs.length > 0) {
                // override the languages with whatever is passed in
                for (var i = 0; i < langs.length; i++) {
                    Itext.addLanguage(langs[i]);
                }
                Itext.setDefaultLanguage(langs[0]);
            }

            var xmlDoc;
            if (xmlString) {
                xmlDoc = $.parseXML(xmlString);
                var head = $(xmlDoc).find('h\\:head, head'),
                    itextBlock = head.find('itext');
            
                $(itextBlock).children().each(eachLang);
            }

            this.data.core.currentItextDisplayLanguage = 
                this.opts().javaRosa.displayLanguage ||
                Itext.getDefaultLanguage();
            
            this._makeLanguageSelectorDropdown();

            this.__callOld();

            delete this.data.javaRosa.itextMap;
            Itext.on('change', function () { _this.onFormChange(); });
        },
        populateControlMug: function(mug, controlElement) {
            this.__callOld();

            var Itext = this.data.javaRosa.Itext,
                itextMap = this.data.javaRosa.itextMap;

            function getITextID(value) {
                try {
                    var parsed = xpath.parse(value);
                    if (parsed instanceof xpathmodels.XPathFuncExpr &&
                        parsed.id === "jr:itext")
                    {
                        return parsed.args[0].value;
                    }
                } catch (err) {
                    // this seems like a real error since the reference should presumably
                    // have been valid xpath, but don't deal with it here
                }
                return "";
            }

            function getItextItem(id, property) {
                var auto = !id || id === getDefaultItextId(mug, property);
                if (id) {
                    var item = itextMap[id];
                    if (item && itextMap.hasOwnProperty(id)) {
                        if (!auto) {
                            item.autoId = false;
                        }
                        return item;
                    }
                }
                return Itext.createItem(id, auto);
            }

            function parseItextRef($el, property) {
                var ref = $el.attr('ref');
                return getItextItem(ref ? getITextID(ref) : "", property);
            }

            var labelEl = controlElement.children('label'),
                hintEl = controlElement.children('hint'),
                helpEl = controlElement.children('help');
            if (labelEl.length && mug.spec.label.presence !== 'notallowed') {
                var labelItext = parseItextRef(labelEl, "label");
                if (labelItext.isEmpty()) {
                    //if no default Itext has been set, set it with the default label
                    var labelVal = xml.humanize(labelEl);
                    labelItext.set(labelVal || mug.getDefaultLabelValue());
                }
                mug.p.labelItext = labelItext;
            }
            if (hintEl.length && mug.spec.hintLabel.presence !== 'notallowed') {
                mug.p.hintItext = parseItextRef(hintEl, "hint");
            }
            if (helpEl.length && mug.spec.label.presence !== 'notallowed') {
                mug.p.helpItext = parseItextRef(helpEl, "help");
            }
            if (mug.p.constraintMsgAttr) {
                var id = getITextID(mug.p.constraintMsgAttr);
                if (id) {
                    mug.p.constraintMsgItext = getItextItem(id, "constraintMsg");
                    mug.p.constraintMsgAttr = null;
                }
            }
        },
        handleMugParseFinish: function (mug) {
            this.__callOld();
            this.data.javaRosa.Itext.updateForExistingMug(mug);
        },
        handleMugRename: function (form, mug, newID, oldID, newPath, oldPath) {
            this.__callOld();

            function getOutputRef(expression, returnRegex) {
                if (returnRegex) {
                    expression = RegExp.escape(expression);
                    return '<output\\s*(ref|value)="' + expression + '"\\s*(\/|><\/output)>';
                } else {
                    return '<output value="' + expression + '" />';
                }
            }

            var oldPathRe,
                outputRe,
                newRef,
                change;

            oldPath = oldPath ? RegExp.escape(oldPath) : oldPath;
            if (mug.options.isSpecialGroup) {
                oldPathRe = new RegExp(oldPath + '/', 'mg');
                newPath = newPath + '/';
            } else {
                oldPathRe = new RegExp(oldPath + '(?![\\w/-])', 'mg');
            }

            forEachItextItem(form, function (item, mug) {
                change = false;
                _(item.forms).each(function (itForm) {
                    _(itForm.getOutputRefExpressions()).each(function (refs, lang) {
                        _(refs).each(function (ref){
                            if (ref.match(oldPathRe)) {
                                newRef = ref.replace(oldPathRe, newPath);
                                outputRe = new RegExp(getOutputRef(ref, true), 'mg');
                                itForm.setValue(
                                    lang,
                                    itForm.getValue(lang)
                                          .replace(outputRe, getOutputRef(newRef)));
                                change = true;
                            }
                        });
                    });
                });
                if (change) {
                    form.fire({
                        type: 'question-label-text-change',
                        mug: mug, // TODO fire for other mugs referencing item
                        text: item.get()
                    });
                }
            });
        },
        duplicateMugProperties: function (mug) {
            this.__callOld();
            _.each(ITEXT_PROPERTIES, function (path) {
                var itext = mug.p[path];
                if (itext && itext.autoId) {
                    mug.p[path] = itext.clone();
                }
            });
        },
        contributeToModelXML: function (xmlWriter) {
            // here are the rules that govern itext
            // 0. iText items which aren't referenced by any questions are 
            // cleared from the form.
            // 1. iText nodes for which values in _all_ languages are empty/blank 
            // will be removed entirely from the form.
            // 2. iText nodes that have a single value in _one_ language 
            // but not others, will automatically have that value copied 
            // into the remaining languages. TBD: there should be a UI to 
            // disable this feature
            // 3. iText nodes that have multiple values in multiple languages 
            // will be properly set as such.
            // 4. duplicate itext ids will be automatically updated to create
            // non-duplicates

            var Itext = this.data.javaRosa.Itext,
                items = this.data.javaRosa.itextItemsFromBeforeSerialize,
                languages = Itext.getLanguages(),
                item, forms, form, lang, val;
            if (languages.length > 0) {
                xmlWriter.writeStartElement("itext");
                for (var i = 0; i < languages.length; i++) {
                    lang = languages[i];
                    xmlWriter.writeStartElement("translation");
                    xmlWriter.writeAttributeString("lang", lang);
                    if (Itext.getDefaultLanguage() === lang) {
                        xmlWriter.writeAttributeString("default", '');
                    }
                    for (var j = 0; j < items.length; j++) {
                        item = items[j];
                        xmlWriter.writeStartElement("text");
                        xmlWriter.writeAttributeString("id", item.id);
                        forms = item.getForms();
                        for (var k = 0; k < forms.length; k++) {
                            form = forms[k];
                            val = form.getValueOrDefault(lang);
                            xmlWriter.writeStartElement("value");
                            if(form.name !== "default") {
                                xmlWriter.writeAttributeString('form', form.name);
                            }
                            xmlWriter.writeXML(xml.normalize(val));
                            xmlWriter.writeEndElement();
                        }
                        xmlWriter.writeEndElement();
                    }
                    xmlWriter.writeEndElement();
                }
                xmlWriter.writeEndElement();
            }
        },
        beforeSerialize: function () {
            this.__callOld();
            // update and dedup all non-empty Itext items IDs
            this.data.javaRosa.itextItemsFromBeforeSerialize =
                getItextItemsFromMugs(this.data.core.form);
        },
        afterSerialize: function () {
            this.__callOld();
            delete this.data.javaRosa.itextItemsFromBeforeSerialize;
        },
        getMugTypes: function () {
            var types = this.__callOld(),
                normal = types.normal;

            normal.Group.spec = util.extend(normal.Group.spec, {
                constraintMsgItext: {
                    presence: 'notallowed'
                }
            });

            return types;
        },
        getMugSpec: function () {
            var spec = this.__callOld(),
                databind = spec.databind,
                control = spec.control;

            function itextValidator(property, name) {
                return function (mug) {
                    var itext = mug.p[property],
                        hasItext = itext && itext.hasHumanReadableItext();
                    if (!hasItext && mug.spec[property].presence === 'required') {
                        return name + ' is required';
                    }
                    if (itext && !itext.autoId && !itext.isEmpty()) {
                        // Itext ID validation
                        if (!itext.id) {
                            return name + " Itext ID is required";
                        } else if (!util.isValidAttributeValue(itext.id)) {
                            return itext.id + " is not a valid ID";
                        }
                    }
                    return "pass";
                };
            }

            // DATA ELEMENT
            databind.keyAttr = {
                visibility: 'visible',
                presence: 'optional',
                lstring: 'JR:Preload key value'
            };

            // BIND ELEMENT
            databind.preload = {
                visibility: 'visible',
                presence: 'optional',
                lstring: "JR Preload"
            };
            databind.preloadParams = {
                visibility: 'visible',
                presence: 'optional',
                lstring: "JR Preload Param"
            };

            // hide non-itext constraint message unless it's present
            databind.constraintMsgAttr.visibility = "visible_if_present";
            databind.constraintMsgItext = {
                visibility: 'visible',
                presence: function (mugOptions) {
                    return mugOptions.isSpecialGroup ? 'notallowed' : 'optional';
                },
                lstring: 'Validation Message',
                widget: function (mug, options) {
                    return itextLabelBlock(mug, $.extend(options, {
                        itextType: "constraintMsg",
                        getItextByMug: function (mug) {
                            return mug.p.constraintMsgItext;
                        },
                        displayName: "Validation Message"
                    }));
                },
                validationFunc: function (mug) {
                    var itext = mug.p.constraintMsgItext;
                    if (!mug.p.constraintAttr && itext && itext.id && !itext.autoId) {
                        return "Can't have a Validation Message Itext ID without a Validation Condition";
                    }
                    return itextValidator("constraintMsgItext", "Validation Message")(mug);
                },
            };
            // virtual property used to define a widget
            databind.constraintMsgItextID = {
                visibility: 'constraintMsgItext',
                presence: 'optional',
                lstring: "Validation Message Itext ID",
                widget: iTextIDWidget,
                widgetValuePath: "constraintMsgItext"
            };

            // CONTROL ELEMENT
            
            // hide non-itext messages unless present
            control.label.visibility = "visible_if_present";
            control.hintLabel.visibility = "visible_if_present";

            control.labelItext = {
                visibility: 'visible',
                presence: 'optional',
                lstring: "Label",
                widget: function (mug, options) {
                    return itextLabelBlock(mug, $.extend(options, {
                        itextType: "label",
                        getItextByMug: function (mug) {
                            return mug.p.labelItext;
                        },
                        displayName: "Label"
                    }));
                },
                validationFunc: itextValidator("labelItext", "Label"),
            };
            // virtual property used to define a widget
            control.labelItextID = {
                visibility: 'labelItext',
                presence: 'optional',
                lstring: "Label Itext ID",
                widget: iTextIDWidget,
                widgetValuePath: "labelItext"
            };

            control.hintItext = {
                visibility: 'visible',
                presence: function (mugOptions) {
                    return mugOptions.isSpecialGroup ? 'notallowed' : 'optional';
                },
                lstring: "Hint Message",
                widget: function (mug, options) {
                    return itextLabelBlock(mug, $.extend(options, {
                        itextType: "hint",
                        getItextByMug: function (mug) {
                            return mug.p.hintItext;
                        },
                        displayName: "Hint Message"
                    }));
                },
                validationFunc: itextValidator("hintItext", "Hint Message"),
            };
            // virtual property used to get a widget
            control.hintItextID = {
                visibility: 'hintItext',
                lstring: "Hint Itext ID",
                widget: iTextIDWidget,
                widgetValuePath: "hintItext"
            };

            control.helpItext = {
                visibility: 'visible',
                presence: function (mugOptions) {
                    return mugOptions.isSpecialGroup ? 'notallowed' : 'optional';
                },
                lstring: "Help Message",
                widget: function (mug, options) {
                    var block = itextLabelBlock(mug, $.extend(options, {
                            itextType: "help",
                            getItextByMug: function (mug) {
                                return mug.p.helpItext;
                            },
                            displayName: "Help Message"
                        })).on('change', function() {
                            if (!HELP_MARKDOWN) {
                                return;
                            }
                            var mug = this.mug,
                                helpItext = mug.p.helpItext,
                                helpItextForm = helpItext.forms[0],
                                markdownForms = _.find(helpItext.forms, function(itext) {
                                    return itext.name === 'markdown';
                                });
                            if (markdownForms) {
                                markdownForms.data = _.clone(helpItextForm.data);
                            }
                        });

                    return block;
                },
                validationFunc: itextValidator("helpItext", "Help Message")
            };
            // virtual property used to get a widget
            control.helpItextID = {
                visibility: 'helpItext',
                lstring: "Help Itext ID",
                widget: iTextIDWidget,
                widgetValuePath: "helpItext"
            };

            // virtual property used to get a widget
            control.otherItext = function (mugOptions) {
                return mugOptions.isSpecialGroup ? undefined : {
                    visibility: 'labelItext',
                    presence: 'optional',
                    lstring: "Add Other Content",
                    widget: function (mug, options) {
                        return itextConfigurableBlock(mug, $.extend(options, {
                            displayName: "Add Other Content",
                            itextType: "label",
                            getItextByMug: function (mug) {
                                return mug.p.labelItext;
                            },
                            forms: ['long', 'short'],
                            isCustomAllowed: true
                        }));
                    }
                };
            };
            // virtual property used to get a widget
            control.mediaItext = function (mugOptions) {
                return mugOptions.isSpecialGroup ? undefined : {
                    visibility: 'labelItext',
                    presence: 'optional',
                    lstring: 'Add Multimedia',
                    widget: function (mug, options) {
                        return itextMediaBlock(mug, $.extend(options, {
                            displayName: "Add Multimedia",
                            itextType: "label",
                            getItextByMug: function (mug) {
                                return mug.p.labelItext;
                            },
                            forms: SUPPORTED_MEDIA_TYPES,
                            formToIcon: ICONS
                        }));
                    }
                };
            };
            // virtual property used to get a widget
            control.helpMediaIText = function (mugOptions) {
                return mugOptions.isSpecialGroup ? undefined : {
                    visibility: 'helpItext',
                    presence: 'optional',
                    lstring: 'Add Help Media',
                    widget: function (mug, options) {
                        return itextMediaHelpBlock(mug, $.extend(options, {
                            displayName: "Add Help Media",
                            itextType: "help",
                            getItextByMug: function (mug) {
                                return mug.p.helpItext;
                            },
                            forms: SUPPORTED_MEDIA_TYPES,
                            formToIcon: ICONS
                        }));
                    }
                };
            };
            return spec;
        },
        getMainProperties: function () {
            var ret = this.__callOld();
            ret.splice(1 + ret.indexOf('label'), 0, 'labelItext');
            return ret;
        },
        getLogicProperties: function () {
            var ret = this.__callOld();
            ret.splice(
                1 + ret.indexOf('constraintAttr'), 0, 'constraintMsgItext');
            return ret;
        },
        getAdvancedProperties: function () {
            var ret = this.__callOld();
            ret.splice(
                1 + ret.indexOf('xmlnsAttr'), 0,
                'keyAttr',
                'preload',
                'preloadParams'
            );

            ret = ret.concat([
                'labelItextID',
                'constraintMsgItextID',
                'hintItextID',
                'hintItext',
                'helpItextID',
                'helpItext',
                'helpMediaIText',
            ]);

            ret = ret.concat(['otherItext']);

            return ret;
        },
        getToolsMenuItems: function () {
            var _this = this;
            return this.__callOld().concat([
                {
                    name: "Edit Bulk Translations",
                    action: function (done) {
                        _this.showItextDialog(done);
                    }
                }
            ]);
        },
        showItextDialog: function (done) {
            var vellum = this,
                $modal, $updateForm, $textarea,
                Itext = vellum.data.javaRosa.Itext,
                form = vellum.data.core.form;

            $modal = vellum.generateNewModal("Edit Bulk Translations", [
                {
                    title: "Update Translations",
                    cssClasses: "btn-primary",
                    action: function () {
                        parseXLSItext(form, $textarea.val(), Itext);
                        $modal.modal('hide');
                        done();
                    }
                }
            ]);
            $updateForm = $(edit_source({
                description: "Copy these translations into a spreadsheet program " + 
                "like Excel. You can edit them there and then paste them back " +
                "here when you're done. These will update the translations used in " +
                "your form. Press 'Update Translations' to save changes, or 'Close' " +
                "to cancel."
            }));
            $modal.find('.modal-body').html($updateForm);

            // display current values
            $textarea = $updateForm.find('textarea');
            $textarea.val(generateItextXLS(form, Itext));

            $modal.modal('show');
            $modal.one('shown', function () { $textarea.focus(); });
        }
    });

    return {
        parseXLSItext: parseXLSItext,
        generateItextXLS: generateItextXLS
    };
});
