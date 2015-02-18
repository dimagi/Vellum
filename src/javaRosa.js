/*
 * A Vellum plugin to support JavaRosa extensions to the XForm spec,
 * particularly IText.
 *
 * Also adds specs for the JavaRosa preload attributes.
 */
define([
    'underscore',
    'jquery',
    'tpl!vellum/templates/edit_source',
    'tpl!vellum/templates/language_selector',
    'tpl!vellum/templates/control_group',
    'text!vellum/templates/button_remove.html',
    'vellum/widgets',
    'vellum/util',
    'vellum/tsv',
    'vellum/core'
], function (
    _,
    $,
    edit_source,
    language_selector,
    control_group,
    button_remove,
    widgets,
    util,
    tsv
) {
    var SUPPORTED_MEDIA_TYPES = ['image', 'audio', 'video'],
        DEFAULT_EXTENSIONS = {
            image: 'png',
            audio: 'mp3',
            video: '3gp'
        };
    var RESERVED_ITEXT_CONTENT_TYPES = [
        'default', 'short', 'long', 'audio', 'video', 'image'
    ];

    function ItextItem(options) {
        this.forms = options.forms || [];
        this.id = options.id || "";
        this.itextModel = options.itextModel;
    }
    ItextItem.prototype = {
        clone: function () {
            var item = new ItextItem({
                forms: _.map(this.forms, function (f) { return f.clone(); }),
                id: this.id,
                itextModel: this.itextModel
            });
            this.itextModel.addItem(item);
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
                this.itextModel.fire({
                    type: 'change'
                });
                return newForm;
            }
        },
        removeForm: function (name) {
            var names = this.getFormNames();
            var index = names.indexOf(name);
            if (index !== -1) {
                this.forms.splice(index, 1);
                this.itextModel.fire({
                    type: 'change'
                });
            }
        },
        get: function(lang, form) {
            // convenience API
            return this.getValue(_.isUndefined(form) ? "default" : form, lang);
        },
        getValue: function(form, language) {
            // DEPRECATED use `get("lang")` or `get("lang", "form")`
            if (this.hasForm(form)) {
                return this.getForm(form).getValue(language);
            }
        },
        defaultValue: function() {
            return this.getValue("default", 
                this.itextModel.getDefaultLanguage());
        },
        setDefaultValue: function(val) {
            this.getOrCreateForm("default").setValue(
                this.itextModel.getDefaultLanguage(), val);
        },
        isEmpty: function () {
            if (this.forms) {
                var nonEmptyItems = _(this.forms).filter(function (form) {
                    return !form.isEmpty();
                });
                return nonEmptyItems.length === 0;
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
            if (this.data[lang] !== value) {
                this.itextModel.fire({
                    type: 'change'
                });
            }
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
        this.items = [];
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
                this.fire({
                    type: 'change'
                });
            } 
        },
        removeLanguage: function (lang) {
            if(this.hasLanguage(lang)) {
                this.languages.splice(this.languages.indexOf(lang), 1);
                this.fire({
                    type: 'change'
                });
            }
            // if we removed the default, reset it
            if (this.getDefaultLanguage() === lang) {
                this.setDefaultLanguage(this.languages.length > 0 ? this.languages[0] : "");
            }
        },
        setDefaultLanguage: function (lang) {
            if (lang !== this.defaultLanguage) {
                this.fire({
                    type: 'change'
                });
            }
            this.defaultLanguage = lang;
        },
        getDefaultLanguage: function () {
            if (this.defaultLanguage) {
                return this.defaultLanguage;
            } else {
                return this.languages.length > 0 ? this.languages[0] : "";
            }
        },
        getItems: function () {
            return this.items;
        },
        getNonEmptyItems: function () {
            return _(this.items).filter(function (item) {
                return !item.isEmpty();
            });
        },
        getNonEmptyItemIds: function () {
            return this.getNonEmptyItems().map(function (item) {
                return item.id;
            });
        },
        deduplicateIds: function () {
            var nonEmpty = this.getNonEmptyItems();
            var found = [];
            var counter, item, origId,
                changed = false;
            for (var i = 0; i < nonEmpty.length; i++) {
                item = nonEmpty[i];
                origId = item.id;
                counter = 2;
                while (found.indexOf(item.id) !== -1) {
                    item.id = origId + counter;
                    counter = counter + 1;
                    changed = true;
                }
                found.push(item.id);
            }
            if (changed) {
                this.fire({
                    type: 'change'
                });
            }
        },
        hasItem: function (item) {
            return this.items.indexOf(item) !== -1;
        },
        /**
         * Add an itext item to the global Itext object.
         * Item is an ItextItem object.
         * Does nothing if the item was already in the itext object.
         */
        addItem: function (item) {
            if (!this.hasItem(item)) {
                this.items.push(item);
                this.fire({
                    type: 'change'
                });
            } 
        },
        /*
         * Create a new blank item and add it to the list.
         */
        createItem: function (id) {
            var item = new ItextItem({
                id: id,
                itextModel: this,
                forms: [new ItextForm({
                    name: "default",
                    itextModel: this
                })]
            });
            this.addItem(item);
            return item;
        },
        /**
         * Get the Itext Item by ID.
         */
        getItem: function (iID) {
            // this is O[n] when it could be O[1] with some other
            // data structure. That would require keeping the ids
            // in sync in multiple places though.
            // This could be worked around via careful event handling,
            // but is not implemented until we see slowness.
            try {
                return util.reduceToOne(this.items, function (item) {
                    return item.id === iID;
                }, "itext id = " + iID);
            } catch (e) {
                throw "NoItextItemFound";
            }
        },
        getOrCreateItem: function (id) {
            try {
                return this.getItem(id);
            } catch (err) {
                return this.createItem(id); 
            }
        },
        removeItem: function (item) {
            var index = this.items.indexOf(item);
            if (index !== -1) {
                this.items.splice(index, 1);
                this.fire({
                    type: 'change'
                });
            } 
        },
        /**
         * Generates a flat list of all unique Itext IDs currently in the
         * Itext object.
         */
        getAllItemIDs: function () {
            return this.items.map(function (item) {
                return item.id;
            });
        },
        /**
         * Remove all Itext associated with the given mug
         * @param mug
         */
        removeMugItext: function (mug) {
            // NOTE: this is not currently used. We clear itext
            // at form-generation time. This is because shared 
            // itext makes removal problematic.
            var labelItext, hintItext, constraintItext;
            if (mug){
                labelItext = mug.p.labelItextID;
                hintItext = mug.p.hintItextID;
                if (labelItext) {
                    this.removeItem(labelItext);
                }
                if (hintItext) {
                    this.removeItem(hintItext);
                }
                constraintItext = mug.p.constraintMsgItextID;
                if (constraintItext) {
                    this.removeItem(constraintItext);
                }
            }
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
                // set label if not there
                if (!mug.p.labelItextID && 
                    mug.spec.labelItextID.presence !== "notallowed")
                {
                    var labelItextID = this.getDefaultLabelItext(mug, defaultLabelValue);
                    mug.p.labelItextID = labelItextID;
                }
                // set hint if legal and not there
                if (mug.spec.hintItextID.presence !== "notallowed" &&
                    !mug.p.hintItextID) {
                    mug.p.hintItextID = this.createItem("");
                }
                if (mug.spec.helpItextID.presence !== "notallowed" &&
                    !mug.p.helpItextID) {
                    mug.p.helpItextID = this.createItem("");
                }
            }
            if (!mug.options.isControlOnly) {
                // set constraint msg if legal and not there
                if (mug.spec.constraintMsgItextID.presence !== "notallowed" &&
                    !mug.p.constraintMsgItextID) {
                    mug.p.constraintMsgItextID = this.createItem("");
                }
            }
        },
        getDefaultLabelItext: function (mug, defaultValue) {
            var item,
                formData = {},
                defaultLang = this.getDefaultLanguage();
            formData[defaultLang] = defaultValue;
            item = new ItextItem({
                id: mug.getDefaultLabelItextId(),
                forms: [new ItextForm({
                            name: "default",
                            data: formData,
                            itextModel: this
                        })],
                itextModel: this
            });
            this.addItem(item);
            return item;
        }
    };

    /**
     * Walks through internal tree and grabs
     * the Itext id's from any Mugs that are found.  Returns
     * a flat list of iIDs.  This list is primarily used
     * for trimming out crufty itext.
     */
    var getAllNonEmptyItextItemsFromMugs = function (form) {
        // get all the itext references in the forms
        var ret = [];
        var appendItemsIfPresent = function (node) {
            if (node.isRootNode) {
                return;
            }

            var mt = node.getValue();
            if(!mt) {
                throw 'Node in tree without value?!?!';
            }
        
            var thingsToGet = [
                'labelItextID',
                'hintItextID', 
                'helpItextID',
                'constraintMsgItextID'
            ]; 
        
            var val;            
            for (var i = 0; i < thingsToGet.length; i++) {
                try {
                    val = mt.p[thingsToGet[i]];
                    if (val && !val.isEmpty() && ret.indexOf(val) === -1) {
                       // it was there and not present so add it to the list
                       ret.push(val);
                    } 
                } catch (err) {
                    // probably just wasn't in the mug
                }
            }    
        };
        
        form.tree.treeMap(appendItemsIfPresent);
        return ret; 

    };

    var iTextIDWidget = function (mug, options) {
        var widget = widgets.text(mug, options),
            $input = widget.input;

        widget.isSelectItem = (mug.__className === "Item");
        widget.parentMug = widget.isSelectItem ? widget.mug.parentMug : null;
        widget.langs = widget.mug.form.vellum.data.javaRosa.Itext.getLanguages();

        // a few little hacks to support auto-update of choices
        widget.getItextType = function () {
            return widget.path.replace("ItextID", "");
        };

        widget.autoGenerateId = function () {
            return mug.getItextAutoID(widget.path);
        };

        widget.updateAutoId = function () {
            widget.setValue({id: widget.autoGenerateId()});
        };

        var _setValue = widget.setValue;

        widget.setValue = function (value) {
            _setValue(value.id);
        };

        widget.getValue = function() {
            return $input.val();
        };

        // auto checkbox
        var $autoBox = $("<input />").attr("type", "checkbox");

        $autoBox.change(function () {
            if ($(this).prop('checked')) {
                widget.updateAutoId();
                widget.updateValue();
            }
        });

        widget.setAutoMode = function (autoMode) {
            $autoBox.prop("checked", autoMode);
        };

        widget.getAutoMode = function () {
            return $autoBox.prop('checked');
        };

        // support auto mode to keep ids in sync
        if (widget.currentValue && widget.currentValue.id === widget.autoGenerateId()) {
            widget.setAutoMode(true);
        }

        var _getUIElement = widget.getUIElement;
        widget.getUIElement = function () {
            var $uiElem = _getUIElement(),
                $autoBoxContainer = $('<div />').addClass('pull-right fd-itextID-checkbox-container'),
                $autoBoxLabel = $("<label />").text("auto?").addClass('checkbox');

            $autoBoxLabel.prepend($autoBox);
            $autoBoxContainer.append($autoBoxLabel);

            $uiElem.find('.controls')
                .addClass('fd-itextID-controls')
                .before($autoBoxContainer);

            return $uiElem;
        };

        widget.save = function () {
            // override save to call out to rename itext
            widget.mug.setItextId(widget.path, widget.getValue());
        };

        widget.mug.on('property-changed', function (e) {
            // keep the ids in sync if we're in auto mode
            if (widget.getAutoMode() &&
                (e.property === "nodeID" ||
                 widget.isSelectItem && e.property === "defaultValue")) 
            {
                var newVal = widget.autoGenerateId();
                if (newVal !== widget.getValue()) {
                    widget.setValue({id: newVal});
                    widget.updateValue();
                }
            }
        }, null, widget);

        widget.input.keyup(function () {
            // turn off auto-mode if the id is ever manually overridden
            var newVal = $(this).val();
            if (newVal !== widget.autoGenerateId()) {
                widget.setAutoMode(false);
            }
        });

        widget.handleItextLabelChange = function (e) {
            // Makes sure that there is an autoID present if itext of the same type
            // exists for any form in any language.

            var currentVal = widget.getValue(),
                itextItem = e.itextItem,
                isItextPresent;
            isItextPresent = itextItem && (function () {
                var currentForms = itextItem.getForms();
                for (var i = 0; i < currentForms.length; i++) {
                    for (var j = 0; j < widget.langs.length; j++) {
                        if (currentForms[i].getValue(widget.langs[j])) {
                            return true;
                        }
                    }
                }
                return false;
            })();

            if (isItextPresent && !currentVal) {
                widget.setAutoMode(true);
                widget.updateAutoId();
                widget.updateValue();
            } else if (!isItextPresent && currentVal) {
                widget.setAutoMode(false);
                widget.setValue({id: ''});
                widget.updateValue();
            }

        };

        widget.mug.on('update-question-itextid', function (e) {
            if (e.itextType === widget.getItextType()) {
                widget.handleItextLabelChange(e);
            }
        }, null, widget);

        widget.mug.on("teardown-mug-properties", function (e) {
            e.mug.unbind(widget);
        }, null, widget);

        return widget;
    };

    var baseItextBlock = function (mug, options) {
        var Itext = mug.form.vellum.data.javaRosa.Itext,
            block = {};

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

            $('.' + block.getAddFormButtonClass(form)).addClass('disabled');
            var $groupContainer = block.getFormGroupContainer(form);
            _.each(block.languages, function (lang) {
                var itextWidget = block.itextWidget(block.mug, lang, form, options);
                itextWidget.init(true);
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
            .focus(function() {
                this.select();
            })
            .on('change keyup', function (e) {
                widget.updateValue();
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
            return itextItem && itextItem.getValue(widget.form, lang);
        };

        widget.setItextValue = function (value) {
            var itextItem = widget.getItextItem();
            if (itextItem) {
                if (widget.isDefaultLang) {
                    widget.mug.fire({
                        type: 'defaultLanguage-itext-changed',
                        form: widget.form,
                        prevValue: itextItem.getValue(widget.form, widget.language),
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
                widget.updateValue();
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

        $input.attr("type", "text")
            .addClass('input-block-level itext-widget-input')
            .on('change keyup', widget.updateValue);

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
                    var treeName = itextItem.getValue(widget.form, widget.language) || 
                            mug.form.vellum.getMugDisplayName(mug),
                        it = mug.p.labelItextID;
                    if (it && it.id === itextItem.id && widget.form === "default") {
                        mug.form.fire({
                            type: 'question-label-text-change',
                            mug: mug,
                            text: treeName
                        });
                    }
                });
            }
            widget.mug.fire({
               type: 'update-question-itextid',
               itextType: widget.itextType,
               itextItem: itextItem
            });
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
                           widget.mug.getDefaultItextRoot() + "." + extension;
                }
                return null;
            };

            widget.mug.form.vellum.initWidget(widget);

            return widget;
        };
    };
    
    var parseXLSItext = function (str, Itext) {
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

        cells = nextRow();
        while (cells) {
            item = Itext.getOrCreateItem(cells[0]);
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
    };

    var generateItextXLS = function (vellum, Itext) {
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
                return item.hasForm(form) ? item.get(language, form) : "";
            });
        }

        function makeHeadings(languages, forms) {
            return rowify("label", languages, forms, function (language, form) {
                return form + '-' + language;
            });
        }

        // todo: fix abstraction barrier
        vellum.beforeSerialize();

        // TODO: should this be configurable?
        var forms = ["default", "audio", "image" , "video"],
            languages = Itext.getLanguages(),
            allItems = Itext.getNonEmptyItems(),
            rows = [];
        if (languages.length > 0) {
            rows.push(makeHeadings(languages, forms));
            for(var i = 0; i < allItems.length; i++) {
                rows.push(makeRow(allItems[i], languages, forms));
            }
        }
        return tsv.tabDelimit(rows);
    };

    function validateItextItem(itextItem, name) {
        if (itextItem) {
            var val = itextItem.defaultValue();
            if (itextItem.id && !val) {
                return "Question has " + name + " ID but no " + name + " label!";
            }
            if (val && !itextItem.id) {
                return "Question has " + name + " label but no " + name + " ID!";
            }
        }
        return "pass";
    }

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

    $.vellum.plugin("javaRosa", {
        langs: ['en'],
        displayLanguage: 'en'
    }, {
        init: function () {
            // todo: plugin abstraction barrier
            this.data.javaRosa.ItextItem = ItextItem;
            this.data.javaRosa.ItextForm = ItextForm;
            this.data.javaRosa.ICONS = ICONS;

            // exposed for testing
            this.data.javaRosa.parseXLSItext = parseXLSItext;
            this.data.javaRosa.generateItextXLS = generateItextXLS;
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
                        var labelItextID = mug.p.labelItextID;
                        if (labelItextID) {
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
                Itext;

            this.data.javaRosa.Itext = Itext = new ItextModel();

            function eachLang() {
                var el = $(this);
                var lang = el.attr('lang');
                
                function eachText() {
                    var textEl = $(this);
                    var id = textEl.attr('id');
                    var item = Itext.getOrCreateItem(id);
                    
                    function eachValue() {
                        var valEl = $(this);
                        var curForm = valEl.attr('form');
                        if(!curForm) {
                            curForm = "default";
                        }
                        item.getOrCreateForm(curForm)
                            .setValue(lang, util.getXLabelValue(valEl));
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
                var xml = $(xmlDoc),
                    head = xml.find('h\\:head, head'),
                    itextBlock = head.find('itext');
            
                $(itextBlock).children().each(eachLang);
            }

            this.data.core.currentItextDisplayLanguage = 
                this.opts().javaRosa.displayLanguage ||
                Itext.getDefaultLanguage();
            
            this._makeLanguageSelectorDropdown();

            this.__callOld();
            
            Itext.on('change', function () {
                _this.data.core.saveButton.fire('change');
            });
        },
        handleMugParseFinish: function (mug) {
            this.__callOld();
            this.data.javaRosa.Itext.updateForExistingMug(mug);
        },
        getMugByLabelItextID: function (itextID) {
            var node = this.data.core.form.tree.rootNode.getSingleMatchingNode(function (value) {
                return value && value.getItext() && value.getItext().id === itextID;
            });

            return node ? node.getValue() : null;
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

            var _this = this,
                itext = this.data.javaRosa.Itext,
                oldPathRe,
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

            _(itext.getItems()).each(function (item) {
                change = false;
                _(item.forms).each(function (itForm) {
                    _(itForm.getOutputRefExpressions()).each(function (refs, lang) {
                        _(refs).each(function (ref){
                            if (ref.match(oldPathRe)) {
                                newRef = ref.replace(oldPathRe, newPath);
                                outputRe = new RegExp(getOutputRef(ref, true), 'mg');
                                itForm.setValue(lang, itForm.data[lang].replace(outputRe, getOutputRef(newRef)));
                                change = true;
                            }
                        });
                    });
                });
                if (change) {
                    form.fire({
                        type: 'question-label-text-change',
                        mug: _this.getMugByLabelItextID(item.id),
                        text: item.getValue('default', itext.getDefaultLanguage())
                    });
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
                languages = Itext.getLanguages(),
                allItems = Itext.getNonEmptyItems(),
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
                    for (var j = 0; j < allItems.length; j++) {
                        item = allItems[j];
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
                            // HACK replace &nbsp; with space because it is not a valid XML entity
                            xmlWriter.writeXML(
                                $('<div>').append(val).clone().html().replace(/&nbsp;/g, " "));
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

            // remove crufty itext that isn't linked to anything in the form
            this.data.javaRosa.Itext.items = getAllNonEmptyItextItemsFromMugs(
                this.data.core.form);

            this.data.javaRosa.Itext.deduplicateIds();
        },
        getMugTypes: function () {
            var types = this.__callOld(),
                normal = types.normal;

            normal.Group.spec = util.extend(normal.Group.spec, {
                constraintMsgItextID: {
                    presence: 'notallowed'
                }
            });

            return types;
        },
        getMugSpec: function () {
            var spec = this.__callOld(),
                databind = spec.databind,
                control = spec.control;

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
            databind.constraintMsgItextID = {
                visibility: 'visible',
                presence: function (mugOptions) {
                    return mugOptions.isSpecialGroup ? 'notallowed' : 'optional';
                },
                lstring: "Validation Error Message ID",
                widget: iTextIDWidget,
                validationFunc: function (mug) {
                    var constraintItext = mug.p.constraintMsgItextID;
                    if (constraintItext && constraintItext.id) {
                        if (!util.isValidAttributeValue(constraintItext.id)) {
                            return constraintItext.id + " is not a valid ID";
                        }
                    }
                    if (constraintItext && constraintItext.id && !mug.p.constraintAttr) {
                        return "Can't have a Validation Message ID without a Validation Condition";
                    }
                    return validateItextItem(constraintItext, "Validation Error Message");
                }
            };
            // virtual property used to define a widget
            databind.constraintMsgItext = {
                visibility: 'constraintMsgItextID',
                presence: 'optional',
                widget: function (mug, options) {
                    return itextLabelBlock(mug, $.extend(options, {
                        itextType: "constraintMsg",
                        getItextByMug: function (mug) {
                            return mug.p.constraintMsgItextID;
                        },
                        displayName: "Validation Message"
                    }));
                },
                lstring: 'Validation Message'
            };

            // CONTROL ELEMENT
            
            // hide non-itext messages unless present
            control.label.visibility = "visible_if_present";
            control.hintLabel.visibility = "visible_if_present";
            // virtual property used to define a widget
            control.labelItext = {
                visibility: 'labelItextID',
                presence: 'optional',
                widget: function (mug, options) {
                    return itextLabelBlock(mug, $.extend(options, {
                        itextType: "label",
                        getItextByMug: function (mug) {
                            return mug.p.labelItextID;
                        },
                        displayName: "Label"
                    }));
                },
                lstring: "Label"
            };

            control.labelItextID = {
                visibility: 'visible',
                presence: 'optional',
                lstring: "Question Itext ID",
                widget: function (mug, options) {
                    return iTextIDWidget(mug, $.extend(options, {
                        displayName: "Add Other Content",
                        itextType: "label",
                        getItextByMug: function (mug) {
                            return mug.p.labelItextID;
                        },
                        forms: ['long', 'short'],
                        isCustomAllowed: true
                    }));
                },
                validationFunc: spec.control.label.validationFunc
            };
            // virtual property used to get a widget
            control.hintItext = {
                visibility: 'hintItextID',
                widget: function (mug, options) {
                    return itextLabelBlock(mug, $.extend(options, {
                        itextType: "hint",
                        getItextByMug: function (mug) {
                            return mug.p.hintItextID;
                        },
                        displayName: "Hint Message"
                    }));
                }
            };
            control.hintItextID = {
                visibility: 'visible',
                presence: function (mugOptions) {
                    return mugOptions.isSpecialGroup ? 'notallowed' : 'optional';
                },
                lstring: "Hint Itext ID",
                widget: function (mug, options) {
                    return iTextIDWidget(mug, $.extend(options, {
                        itextType: "hint",
                        getItextByMug: function (mug) {
                            return mug.p.hintItextID;
                        },
                        displayName: "Hint Message"
                    }));
                },
                validationFunc: function (mug) {
                    var hintItext;
                    hintItext = mug.p.hintItextID;
                    if (hintItext && hintItext.id) {
                        if (!util.isValidAttributeValue(hintItext.id)) {
                            return hintItext.id + " is not a valid ID";
                        }
                    }
                    if (mug.spec.hintItextID.presence === 'required' &&
                        !hintItext.id) {
                        return 'Hint ID is required but not present in this question!';
                    }
                    
                    return validateItextItem(hintItext, "Hint");
                }
            };
            control.helpItext = {
                visibility: 'helpItextID',
                widget: function (mug, options) {
                    return itextLabelBlock(mug, $.extend(options, {
                        itextType: "help",
                        getItextByMug: function (mug) {
                            return mug.p.helpItextID;
                        },
                        displayName: "Help Message"
                    }));
                }
            };
            control.helpItextID = {
                visibility: 'visible',
                presence: function (mugOptions) {
                    return mugOptions.isSpecialGroup ? 'notallowed' : 'optional';
                },
                lstring: "Help Itext ID",
                widget: function (mug, options) {
                    return iTextIDWidget(mug, $.extend(options, {
                        itextType: "help",
                        getItextByMug: function (mug) {
                            return mug.p.helpItextID;
                        },
                        displayName: "Help Message"
                    }));
                },
                validationFunc: function (mug) {
                    var helpItext;
                    helpItext = mug.p.helpItextID;
                    if (helpItext && helpItext.id) {
                        if (!util.isValidAttributeValue(helpItext.id)) {
                            return helpItext.id + " is not a valid ID";
                        }
                    }
                    if (mug.spec.helpItextID.presence === 'required' &&
                        !helpItext.id) {
                        return 'Help ID is required but not present in this question!';
                    }
                    
                    return validateItextItem(helpItext, "Help");
                }
            };

            // virtual property used to get a widget
            control.otherItext = function (mugOptions) {
                return mugOptions.isSpecialGroup ? undefined : {
                    visibility: 'labelItextID',
                    presence: 'optional',
                    lstring: "Add Other Content",
                    widget: function (mug, options) {
                        return itextConfigurableBlock(mug, $.extend(options, {
                            displayName: "Add Other Content",
                            itextType: "label",
                            getItextByMug: function (mug) {
                                return mug.p.labelItextID;
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
                    visibility: 'labelItextID',
                    presence: 'optional',
                    lstring: 'Add Multimedia',
                    widget: function (mug, options) {
                        return itextMediaBlock(mug, $.extend(options, {
                            displayName: "Add Multimedia",
                            itextType: "label",
                            getItextByMug: function (mug) {
                                return mug.p.labelItextID;
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
                    visibility: 'helpItextID',
                    presence: 'optional',
                    lstring: 'Add Help Media',
                    widget: function (mug, options) {
                        return itextMediaHelpBlock(mug, $.extend(options, {
                            displayName: "Add Help Media",
                            itextType: "help",
                            getItextByMug: function (mug) {
                                return mug.p.helpItextID;
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
            ]);

            if (this.opts().features.add_help_text) {
                ret = ret.concat([
                    'helpItextID',
                    'helpItext',
                    'helpMediaIText',
                ]);
            }

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
            var $modal, $updateForm, $textarea,
                Itext = this.data.javaRosa.Itext;

            $modal = this.generateNewModal("Edit Bulk Translations", [
                {
                    title: "Update Translations",
                    cssClasses: "btn-primary",
                    action: function () {
                        parseXLSItext($textarea.val(), Itext);
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
            $textarea.val(generateItextXLS(this, Itext));

            $modal.modal('show');
            $modal.one('shown', function () { $textarea.focus(); });
        }
    });
});
