/*
 * formdesigner.javarosa.js
 *
 * A Vellum plugin to support JavaRosa extensions to the XForm spec,
 * particularly IText.
 *
 * Also adds specs for the JavaRosa preload attributes.
 */

RESERVED_ITEXT_CONTENT_TYPES = [
    'default', 'short', 'long', 'audio', 'video', 'image'
];
// ITEXT MODELS
function ItextItem(options) {
    this.forms = options.forms || [];
    this.id = options.id || "";
}

ItextItem.prototype = {
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
        return formdesigner.util.reduceToOne(this.forms, function (form) {
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
            var newForm = new ItextForm({name: name});
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
    getValue: function(form, language) {
        if (this.hasForm(form)) {
            return this.getForm(form).getValue(language);
        }
    },
    defaultValue: function() {
        return this.getValue("default", formdesigner.pluginManager.javaRosa.Itext.getDefaultLanguage())
    },
    setDefaultValue: function(val) {
        this.getOrCreateForm("default").setValue(formdesigner.pluginManager.javaRosa.Itext.getDefaultLanguage(), val)
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

var ItextForm = function (options) {
    var form = {};
    
    form.data = options.data || {};
    form.name = options.name || "default";
    
    form.getValue = function (lang) {
        return this.data[lang];
    };
    
    form.setValue = function (lang, value) {
        this.data[lang] = value;
    };
    
    form.getValueOrDefault = function (lang) {
        // check the actual language first
        if (this.data[lang]) {
            return this.data[lang];
        }
        var defLang = formdesigner.pluginManager.javaRosa.Itext.getDefaultLanguage();
        // check the default, if necesssary
        if (lang !== defLang && this.data[defLang]) {
            return this.data[defLang];
        }
        // check arbitrarily for something
        for (var i in this.data) {
            if (this.data.hasOwnProperty(i)) {
                return this.data[i];
            }
        }
        // there wasn't anything
        return "";
    };
    
    form.isEmpty = function () {
        for (var lang in this.data) {
            if (this.data.hasOwnProperty(lang) && this.data[lang]) {
                return false;
            }
        }
        return true;
    };
    
    return form; 
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
var ItextModel = function() {
    var itext = {}; 
    
    itext.languages = [];
    
    itext.getLanguages = function () {
        return this.languages;
    };
    
    itext.hasLanguage = function (lang) {
        return this.languages.indexOf(lang) !== -1;
    };
    
    itext.addLanguage = function (lang) {
        if (!this.hasLanguage(lang)) {
            this.languages.push(lang);
        } 
    };
    
    itext.removeLanguage = function (lang) {
        if(this.hasLanguage(lang)) {
            this.languages.splice(this.languages.indexOf(lang), 1);
        }
        // if we removed the default, reset it
        if (this.getDefaultLanguage() === lang) {
            this.setDefaultLanguage(this.languages.length > 0 ? this.languages[0] : "");
        }
    };
    
    itext.setDefaultLanguage = function (lang) {
        this.defaultLanguage = lang;
    };

    itext.getDefaultLanguage = function () {
        if (this.defaultLanguage) {
            return this.defaultLanguage;
        } else {
            // dynamically generate default arbitrarily
            return this.languages.length > 0 ? this.languages[0] : "";
        }
    };
    
    itext.items = [];
    
    itext.getItems = function () {
        return this.items;
    };
    
    itext.getNonEmptyItems = function () {
        return _(this.items).filter(function (item) {
            return !item.isEmpty();
        });
    };
    
    itext.getNonEmptyItemIds = function () {
        return this.getNonEmptyItems().map(function (item) {
            return item.id;
        });
    };
    
    itext.deduplicateIds = function () {
        var nonEmpty = this.getNonEmptyItems();
        var found = [];
        var counter, item, origId;
        for (var i = 0; i < nonEmpty.length; i++) {
            item = nonEmpty[i];
            origId = item.id;
            counter = 2;
            while (found.indexOf(item.id) !== -1) {
                item.id = origId + counter;
                counter = counter + 1;
            }
            found.push(item.id);
        }
    };
    
    itext.hasItem = function (item) {
        return this.items.indexOf(item) !== -1;
    };

    /**
     * Add an itext item to the global Itext object.
     * Item is an ItextItem object.
     * Does nothing if the item was already in the itext object.
     */
    itext.addItem = function (item) {
        if (!this.hasItem(item)) {
            this.items.push(item);
        } 
    };
    
    /*
     * Create a new blank item and add it to the list.
     */
    itext.createItem = function (id) {
        var item = new ItextItem({
            id: id,
            forms: [new ItextForm({
                        name: "default",
                    })]
        });
        this.addItem(item);
        return item;
    };
    
    /**
     * Get the Itext Item by ID.
     */
    itext.getItem = function (iID) {
        // this is O[n] when it could be O[1] with some other
        // data structure. That would require keeping the ids
        // in sync in multiple places though.
        // This could be worked around via careful event handling,
        // but is not implemented until we see slowness.
        try {
            return formdesigner.util.reduceToOne(this.items, function (item) {
                return item.id === iID;
            }, "itext id = " + iID);
        } catch (e) {
            throw "NoItextItemFound";
        }
    };
    
    itext.getOrCreateItem = function (id) {
        try {
            return this.getItem(id);
        } catch (err) {
            return this.createItem(id); 
        }
    };
    
    itext.removeItem = function (item) {
        var index = this.items.indexOf(item);
        if (index !== -1) {
            this.items.splice(index, 1);
        } 
    };
    
    /**
     * Generates a flat list of all unique Itext IDs currently in the
     * Itext object.
     */
    itext.getAllItemIDs = function () {
        return this.items.map(function (item) {
            return item.id;
        });
    };

    /**
     * Goes through the Itext data and verifies that
     * a) a default language is set to something that exists
     * b) That every iID that exists in the DB has a translation in the default language (causes commcare to fail if not the case)
     *
     * if a) fails, will throw an exception
     * if b) fails, will return a dict of all offending iIDs that need a translation in order to pass validation with
     * the KEYs being ItextIDs and the values being descriptive error messages.
     *
     * if everything passes will return true
     */
    itext.validateItext = function () {
        // TODO: fill this back in
        
        var dLang = this.getDefaultLanguage();

        if(!dLang){
            throw 'No Default Language set! Aborting validation. You should set one!';
        }

        if(!this.hasLanguage(dLang)){
            throw 'Default language is set to a language that does not exist in the Itext DB!';
        }

        return true
    };
    
    itext.clear = function () {
        delete this.languages;
        delete this.items;
        this.languages = [];
        this.items = [];
        
    };
    

    /**
     * Blows away all data stored in the Itext object
     * and resets it to pristine condition (i.e. as if the FD was freshly launched)
     */
    itext.resetItext = function (langs) {
        this.clear();
        if (langs && langs.length > 0) {
            for (var i = 0; i < langs.length; i++) {
                this.addLanguage(langs[i]);
            }
        }
    };

    /**
     * Takes in a list of Itext Items and resets this object to only
     * include those items. 
     *
     * PERMANENTLY DELETES ALL OTHER ITEXT ITEMS FROM THE MODEL
     *
     * For generating a list of useful IDs see:
     * formdesigner.controller.getAllNonEmptyItextItemsFromMugs()
     *
     * @param validIDList
     */
    
    var resetItextList = function (validIDList) {
        this.items = [];
        for (var i = 0; i < validIDList.length; i++) {
            this.items.push(validIDList[i]);
        }
    };
    itext.resetItextList = resetItextList;

    /**
     * Remove all Itext associated with the given mug
     * @param mug
     */
    itext.removeMugItext = function (mug) {
        // NOTE: this is not currently used. We clear itext
        // at form-generation time. This is because shared 
        // itext makes removal problematic.
        var labelItext, hintItext, constraintItext;
        var mug = mug;
        if (mug){
            if (mug.controlElement) {
                //attempt to remove Itext
                labelItext = mug.controlElement.labelItextID;
                hintItext = mug.controlElement.hintItextID;
                if (labelItext) {
                    this.removeItem(labelItext);
                }
                if (hintItext) {
                    this.removeItem(hintItext);
                }
            } 
            if (mug.bindElement) {
                constraintItext = mug.bindElement.constraintMsgItextID;
                if (constraintItext) {
                    this.removeItem(constraintItext);
                }
            }
        }
    };

    itext.updateForNewMug = function(mug) {
        // for new mugs, generate a label
        return this.updateForMug(mug, mug.getDefaultLabelValue());
    };
    
    itext.updateForExistingMug = function(mug) {
        // for existing, just use what's there
        return this.updateForMug(mug, mug.getLabelValue());
    };
    
    itext.updateForMug = function (mug, defaultLabelValue) {
        // set default itext id/values
        if (mug.controlElement) {
            // set label if not there
            if (!mug.controlElement.labelItextID) {
                mug.controlElement.labelItextID = mug.getDefaultLabelItext(defaultLabelValue);
                this.addItem(mug.controlElement.labelItextID);
            }
            // set hint if legal and not there
            if (mug.controlElement.__spec.hintItextID.presence !== "notallowed" &&
                !mug.controlElement.hintItextID) {
                mug.controlElement.hintItextID = this.createItem("");
            }
        }
        if (mug.bindElement) {
            // set constraint msg if legal and not there
            if (mug.bindElement.__spec.constraintMsgItextID.presence !== "notallowed" &&
                !mug.bindElement.constraintMsgItextID) {
                mug.bindElement.constraintMsgItextID = this.createItem("");
            }
        }
    };

    return itext;
};

// ITEXT WIDGETS

var iTextIDWidget = function (mug, options) {
    // a special text widget that holds itext ids
    var widget = formdesigner.widgets.textWidget(mug, options);

    widget.isSelectItem = (mug.__className === "Item");
    widget.parentMug = widget.isSelectItem ? widget.mug.parentMug : null;
    widget.langs = formdesigner.pluginManager.javaRosa.Itext.getLanguages();

    var $input = widget.getControl();

    // a few little hacks to support auto-update of choices
    widget.getRootId = function () {
        if (widget.isSelectItem && widget.parentMug != ' ') {
            return widget.parentMug.getDefaultItextRoot() + "-";
        }
        return "";
    };

    widget.getNodeId = function () {
        if (!widget.isSelectItem) {
            return widget.mug.getDefaultItextRoot();
        } else {
            var val = widget.mug.controlElement.defaultValue;
            return val ? val : "null";
        }
    };

    widget.getItextType = function () {
        return widget.propName.replace("ItextID", "");
    };

    widget.autoGenerateId = function (nodeId) {
        return widget.getRootId() + nodeId + "-" + widget.getItextType();
    };

    widget.setUIValue = function (val) {
        $input.val(val);
    };

    widget.updateAutoId = function () {
        widget.setUIValue(widget.autoGenerateId(widget.getNodeId()));
    };

    widget.setValue = function (value) {
        widget.setUIValue(value.id);
    };

    widget.getValue = function() {
        return $input.val();
    };

    // auto checkbox
    var autoBoxId = widget.getID() + "-auto-itext";
    var $autoBox = $("<input />").attr("type", "checkbox").attr("id", autoBoxId);

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
    if (widget.currentValue && widget.currentValue.id === widget.autoGenerateId(widget.getNodeId())) {
        widget.setAutoMode(true);
    }

    var _getUIElement = widget.getUIElement;
    widget.getUIElement = function () {
        var $uiElem = _getUIElement(),
            $autoBoxContainer = $('<div />').addClass('pull-right fd-itextID-checkbox-container'),
            $autoBoxLabel = $("<label />").text("auto?").attr("for", autoBoxId).addClass('checkbox');

        $autoBoxLabel.prepend($autoBox);
        $autoBoxContainer.append($autoBoxLabel);

        $uiElem.find('.controls')
            .addClass('fd-itextID-controls')
            .before($autoBoxContainer);

        return $uiElem;
    };


    widget.save = function () {
        // override save to call out to rename itext
        var oldItext = widget.mug.getPropertyValue(this.path);
        var val = widget.getValue();
        if (oldItext.id !== val) {
            oldItext.id = val;
            formdesigner.controller.setMugPropertyValue(
                widget.mug,
                widget.groupName,
                widget.propName,
                oldItext,
                widget.mug
            );
        }
    };

    widget.mug.on('property-changed', function (e) {
        // keep the ids in sync if we're in auto mode
        if (widget.getAutoMode() &&
            (e.property === "nodeID" ||
             widget.isSelectItem && e.property === "defaultValue")) 
        {
            var newVal = widget.autoGenerateId(e.val);
            if (newVal !== widget.getValue()) {
                widget.setUIValue(newVal);
                widget.updateValue();
            }
        }
    });

    widget.getControl().keyup(function () {
        // turn off auto-mode if the id is ever manually overridden
        var newVal = $(this).val();
        if (newVal !== widget.autoGenerateId(widget.getNodeId())) {
            widget.setAutoMode(false);
        }
    });

    widget.handleItextLabelChange = function (e) {
        // Makes sure that there is an autoID present if itext of the same type
        // exists for any form in any language.

        var currentVal = widget.getValue(),
            isItextPresent = false,
            itextItem = e.itextItem;

        if (itextItem) {
            var currentForms = itextItem.getForms();
            isItextPresent = (function () {
                for (var form, f = 0; form = currentForms[f]; f++) {
                    for (var lang, l = 0; lang = widget.langs[l]; l++) {
                        if (form.getValue(lang)) {
                            return true;
                        }
                    }
                }
                return false;
            })();
        }
        
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
    });

    return widget;
};

var baseItextBlock = function (mug, options) {
    var Itext = formdesigner.pluginManager.javaRosa.Itext;
    var block = {};

    block.mug = mug;
    block.itextType = options.itextType;
    block.languages = Itext.getLanguages();
    block.defaultLang = Itext.getDefaultLanguage();
    block.getItextByMug = options.getItextByMug;
    block.forms = options.forms || ["default"];

    block.getItextItem = function () {
        return block.getItextByMug(block.mug);
    };

    block.setValue = function (val) {
        // none
    };

    block.getValue = function (val) {
        // none
    };

    block.getID = function () {
        return "itext-block-" + block.itextType;
    };

    block.getItextWidget = function () {
        throw ("getItextWidget should be overridden");
    };

    var $blockUI = $("<div />")
        .attr('id', block.getID())
        .addClass('itext-block-container');
    block.getContainerElement = function () {
        return $blockUI;
    };

    block.getFormGroupID = function (form) {
        return 'itext-block-' + block.itextType + '-group-' + form;
    };

    block.getFormGroupContainer = function (form) {
        return $("<div />")
            .attr('id', block.getFormGroupID(form))
            .addClass('itext-lang-group');
    };

    block.getForms = function () {
        return block.forms;
    };

    block.getUIElement = function () {
        var itextWidgetFn = block.getItextWidget();

        _.each(block.getForms(), function (form) {
            var $formGroup = block.getFormGroupContainer(form);
            _.each(block.languages, function (lang) {
                var itextWidget = itextWidgetFn(block.mug, lang, form, options);
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

    block.getItextWidget = function () {
        return itextLabelWidget;
    };

    return block;
};

var itextConfigurableBlock = function (mug, options) {
    var block = baseItextBlock(mug, options);

    block.isCustomAllowed = options.isCustomAllowed;
    block.activeForms = block.getItextItem().getFormNames();
    block.displayName = options.displayName;
    block.formToIcon = options.formToIcon || {};

    block.getItextWidget = function () {
        return itextFormWidget;
    };

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

    block.getAddFormButtonID = function (form) {
        return 'itext-block-' + block.itextType + '-add-form-' + form;
    };

    block.getAddFormButtons = function () {
        var $buttonGroup = $("<div />").addClass("btn-group itext-options");
        _.each(block.forms, function (form) {
            var $btn = $('<div />');
            $btn.text(form)
                .attr('id', block.getAddFormButtonID(form))
                .addClass('btn itext-option').click(function () {
                    block.getAddItextFn(form)();
                });

            var iconClass = block.formToIcon[form];
            if (iconClass) {
                $btn.prepend($('<i />').addClass(iconClass).after(" "));
            }

            if (block.activeForms.indexOf(form) != -1) {
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
            newItextBtnId = 'fd-new-itext-button',
            newItextInputId = 'fd-new-itext-input';

        $customButton.click(function () {
            var $modal, $newItemForm, $newItemInput;

            $modal = formdesigner.ui.generateNewModal("New Content Type", [
                {
                    id: newItextBtnId,
                    title: "Add",
                    cssClasses: "disabled",
                    attributes: {
                        disabled: "disabled"
                    }
                }
            ]);

            $newItemForm = formdesigner.ui.getTemplateObject("#fd-template-control-group", {
                controlId: newItextInputId,
                label: "Content Type"
            });

            $newItemInput = $("<input />").attr("type", "text").attr("id", newItextInputId);
            $newItemInput.keyup(function () {
                var currentValue = $(this).val(),
                    $addButton = $('#' + newItextBtnId);
                if (!currentValue
                    || RESERVED_ITEXT_CONTENT_TYPES.indexOf(currentValue) != -1
                    || block.activeForms.indexOf(currentValue) != -1) {
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
            $('#' + newItextBtnId).click(function () {
                var newItemType = $newItemInput.val();
                if (newItemType) {
                    block.getAddItextFn($newItemInput.val())();
                    $modal.modal('hide');
                }
            });
            $modal.modal('show');
            $modal.on('shown', function () {
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
        var $deleteButton = $($('#fd-template-button-remove').html());
        $deleteButton.addClass('pull-right')
            .click(function () {
                var $formGroup = $('#' + block.getFormGroupID(form));
                block.deleteItextForm(form);
                block.mug.fire({
                    type: 'question-itext-deleted',
                    form: form
                });
                $formGroup.remove();
                $(this).remove();
                $('#' + block.getAddFormButtonID(form)).removeClass('disabled');
            });
        return $deleteButton;
    };

    block.getAddItextFn = function (form) {
        var itextWidgetFn = block.getItextWidget();

        return function () {
            if (block.activeForms.indexOf(form) != -1) {
                return;
            }
            block.activeForms.push(form);

            $('#' + block.getAddFormButtonID(form)).addClass('disabled');
            var $groupContainer = block.getFormGroupContainer(form);
            _.each(block.languages, function (lang) {
                var itextWidget = itextWidgetFn(block.mug, lang, form, options);
                itextWidget.init(true);
                $groupContainer.append(itextWidget.getUIElement());
            });
            $blockUI.find('.new-itext-control-group').after($groupContainer);
            $groupContainer.before(block.getDeleteFormButton(form));
        };
    };

    var $blockUI = $('<div />'),
        _getParentUIElement = block.getUIElement;
    block.getUIElement = function () {
        $blockUI = _getParentUIElement();

        var $addFormControls = formdesigner.ui.getTemplateObject('#fd-template-control-group', {
            label: block.displayName,
            controlId: null
        });
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

    block.getItextWidget = function () {
        return itextMediaWidget;
    };

    return block;
};

var itextLabelWidget = function (mug, language, form, options) {
    var Itext = formdesigner.pluginManager.javaRosa.Itext;
    var widget = formdesigner.widgets.baseWidget(mug);

    widget.displayName = options.displayName;
    widget.itextType = options.itextType;
    widget.form = form || "default";

    widget.language = language;
    widget.languageName = formdesigner.langCodeToName[widget.language] || widget.language;
    widget.showOneLanguage = Itext.getLanguages().length < 2;
    widget.defaultLang = Itext.getDefaultLanguage();
    widget.isDefaultLang = widget.language === widget.defaultLang;
    widget.isSyncedWithDefaultLang = false;

    widget.getItextItem = function () {
        // Make sure the real itextItem is being updated at all times, not a stale one.
        return options.getItextByMug(widget.mug);
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

    widget.getIDByLang = function (lang) {
        return "itext-" + lang + "-" + widget.itextType;
    };

    widget.getID = function () {
        return widget.getIDByLang(widget.language);
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
            var itextItem = widget.getItextItem(),
                currentLangValue,
                defaultLangValue;

            if (!itextItem) {
                widget.setValue("");
                return;
            }

            defaultLangValue = itextItem.getValue(widget.form, widget.defaultLang);
            currentLangValue = itextItem.getValue(widget.form, widget.language);
            if (!widget.isDefaultLang) {
                widget.setPlaceholder(defaultLangValue);
            }

            if (!widget.isDefaultLang
                && (defaultLangValue === currentLangValue) || !currentLangValue) {
                widget.setValue("");
            } else {
                widget.setValue(currentLangValue);
            }
        }
    };

    var _updateValue = widget.updateValue;
    widget.updateValue = function () {
        _updateValue();
        if (!widget.getValue() && !widget.isDefaultLang) {
            var defaultLangValue = widget.getItextItem().getValue(widget.form, widget.defaultLang);
            widget.setItextFormValue(defaultLangValue);
        }
    };

    widget.destroy = function (e) {
        if (e.form === widget.form) {
            widget.fireChangeEvents();
        }
    };

    var $input = $("<input />")
        .attr("id", widget.getID())
        .attr("type", "text")
        .addClass('input-block-level itext-widget-input')
        .on('change keyup', widget.updateValue);

    widget.mug.on('question-itext-deleted', widget.destroy);

    widget.getControl = function () {
        return $input;
    };

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

    if (!widget.isDefaultLang) {
        widget.mug.on('defaultLanguage-itext-changed', function (e) {
            if (e.form == widget.form && e.itextType == widget.itextType) {
                var itextItem = widget.getItextItem(),
                    defaultLangValue,
                    currentLangValue;
                defaultLangValue = itextItem.getValue(widget.form, widget.defaultLang);
                currentLangValue = itextItem.getValue(widget.form, widget.language);
                widget.setPlaceholder(e.value);
                if ((currentLangValue === e.prevValue && !widget.getValue())
                    || !currentLangValue) {
                    // Make sure all the defaults keep in sync.
                    widget.setItextFormValue(e.value);
                }
            }
        });
    }

    widget.fireChangeEvents = function () {
        var itextItem = widget.getItextItem();
        if (itextItem) {
            // fire the property changed event(s)
            formdesigner.controller.fire({
               type: "question-itext-changed",
               language: widget.language,
               item: itextItem,
               form: widget.form,
               value: itextItem.getValue(widget.form, widget.language)
            });
            formdesigner.controller.form.fire({
               type: "form-property-changed"
            });
            widget.mug.fire({
               type: 'update-question-itextid',
               itextType: widget.itextType,
               itextItem: itextItem
            });
        }
    };

    widget.save = function () {
        widget.setItextFormValue(widget.getValue());
    };

    widget.setItextFormValue = function (value) {
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

            var itextForm = itextItem.getForm(widget.form);
            itextForm.setValue(widget.language, value);
            widget.fireChangeEvents();
        }
    };

    return widget;

};

var itextFormWidget = function (mug, language, form, options) {
    var widget = itextLabelWidget(mug, language, form, options);

    widget.getDisplayName = function () {
        return form + widget.getLangDesc();
    };

    var _getID = widget.getID;
    widget.getID = function () {
        return _getID() + "-" + form;
    };

    return widget;
};

var itextMediaWidget = function (mug, language, form, options) {
    var widget = itextFormWidget(mug, language, form, options);
    widget.mediaRef = formdesigner.multimedia.multimediaReference(form);

    var $input = widget.getControl();

    widget.getDefaultValue = function () {
        if (formdesigner.multimedia.SUPPORTED_MEDIA_TYPES.indexOf(form) != -1) {
            // default formats
            // image: jr://file/commcare/image/form_id/question_id.png
            // audio: jr://file/commcare/audio/form_id/question_id.mp3
            var extension = formdesigner.multimedia.DEFAULT_EXTENSIONS[form];
            return "jr://file/commcare/" + form + "/" +
                   formdesigner.controller.form.formID + "/" +
                   widget.mug.getDefaultItextRoot() + "." + extension;
        }
        return null;
    };

    widget.getPreviewUI = function () {
        var currentPath = widget.getValue(),
            $preview;
        if (!currentPath && !widget.isDefaultLang) {
            currentPath = widget.getItextItem().getValue(widget.form, widget.defaultLang);
        }
        if (currentPath in formdesigner.multimedia.objectMap) {
            var linkedObject = formdesigner.multimedia.objectMap[currentPath];
            $preview = _.template($(formdesigner.multimedia.PREVIEW_TEMPLATES[form]).text(), {
                url: linkedObject.url
            });
        } else {
            $preview = _.template($('#fd-template-multimedia-nomedia').text(), {
                iconClass: formdesigner.multimedia.ICONS[form]
            });
        }
        return $preview;
    };

    widget.getUploadButtonUI = function () {
        var currentPath = widget.getValue(),
            $uploadBtn;
        $uploadBtn = formdesigner.ui.getTemplateObject('#fd-template-multimedia-upload-trigger', {
            multimediaExists: currentPath in formdesigner.multimedia.objectMap,
            uploaderId: formdesigner.multimedia.SLUG_TO_CONTROL[form].uploaderSlug,
            mediaType: form
        });
        $uploadBtn.click(function () {
            widget.mediaRef.updateController();
        });
        return $uploadBtn;
    };

    widget.getPreviewID = function () {
        return  widget.getID() + '-preview-block';
    };

    widget.getUploadID = function () {
        return widget.getID() + '-upload-block';
    };

    var $uiElem = $('<div />'),
        _getParentUIElement = widget.getUIElement;
    widget.getUIElement = function () {
        $uiElem = _getParentUIElement();
        var $controlBlock = $uiElem.find('.controls'),
            $previewContainer = $('<div />')
                .attr('id', widget.getPreviewID())
                .addClass('fd-mm-preview-container'),
            $uploadContainer = $('<div />')
                .attr('id', widget.getUploadID())
                .addClass('fd-mm-upload-container');
        $controlBlock.empty()
            .addClass('control-row').attr('data-form', form);

        widget.updateReference();

        $previewContainer.attr('id', widget.getPreviewID())
            .html(widget.getPreviewUI());
        $controlBlock.append($previewContainer);

        if (formdesigner.multimedia.isUploadEnabled) {
            $uploadContainer.html($('#fd-template-multimedia-block').html());

            $uploadContainer.find('.fd-mm-upload-trigger')
                .append(widget.getUploadButtonUI());
            $uploadContainer.find('.fd-mm-path-input')
                .append($input);

            $uploadContainer.find('.fd-mm-path-show').click(function (e) {
                var $showBtn = $(this);
                $showBtn.addClass('hide');
                $('#' + widget.getUploadID()).find('.fd-mm-path').removeClass('hide');
                e.preventDefault();
            });

            $uploadContainer.find('.fd-mm-path-hide').click(function (e) {
                var $hideBtn = $(this);
                $hideBtn.parent().addClass('hide');
                $('#' + widget.getUploadID()).find('.fd-mm-path-show').removeClass('hide');
                e.preventDefault();
            });
        } else {
            $uploadContainer.append($input);
        }

        $controlBlock.append($uploadContainer);

        $uiElem.on('mediaUploadComplete', widget.handleUploadComplete);
        // reapply bindings because we removed the input from the UI
        $input.bind("change keyup", widget.updateValue);
        $input.bind("change keyup", widget.updateMultimediaBlockUI);

        return $uiElem;
    };

    widget.updateReference = function () {
        var currentPath = widget.getValue();
        $uiElem.attr('data-hqmediapath', currentPath);
        widget.mediaRef.updateRef(currentPath);
    };

    widget.updateMultimediaBlockUI = function () {
        $('#' + widget.getPreviewID()).html(widget.getPreviewUI())
            .find('.existing-media').tooltip();

        $uiElem.find('.fd-mm-upload-trigger')
            .empty()
            .append(widget.getUploadButtonUI());

        widget.updateReference();
    };

    widget.handleUploadComplete = function (event, data) {
        if (data.ref && data.ref.path) {
            formdesigner.multimedia.objectMap[data.ref.path] = data.ref;
        }
        widget.updateMultimediaBlockUI();
    };

    return widget;
};

var parseXLSItext = function (str, Itext) {
    var rows = str.split('\n'),
        i, j, k, cells, lang,iID, form, val;

    // TODO: should this be configurable?
    var exportCols = ["default", "audio", "image" , "video"];
    var languages = Itext.getLanguages();

    for (i = 1; i < rows.length; i++) {
        cells = rows[i].split('\t');
        iID = cells[0];

        for(j = 0; j < exportCols.length; j++) {
            var form = exportCols[j];
            for(k = 0; k < languages.length; k++) {
                if(cells[1 + j * languages.length + k]) {
                    lang = languages[k];
                    val = cells[1 + j * languages.length + k];

                    Itext.getOrCreateItem(iID).getOrCreateForm(form).setValue(lang, val);
                }
            }
        }
    }
    formdesigner.controller.fire({type: "global-itext-changed"});

    // todo: make this more generic as part of the plugin interface
    var currentMug = formdesigner.controller.getCurrentlySelectedMug();
    if (currentMug) {
        formdesigner.ui.displayMugProperties(currentMug);
    }
};

var generateItextXLS = function (Itext) {
    formdesigner.pluginManager.call('preSerialize');
    
    function getItemFormValues(item, languages, form) {

        var ret = [];

        for(var i = 0; i < languages.length; i++) {
            var language = languages[i];
            var value = item.hasForm(form) ? item.getForm(form).getValueOrDefault(language) : "";

            ret.push(value);
        }
        return ret.join("\t");
    }

    function makeRow (languages, item, forms) {

        var questions = getItemFormValues(item, languages, forms[0]);
        var audios = getItemFormValues(item, languages, forms[1]);
        var images = getItemFormValues(item, languages, forms[2]);
        var videos = getItemFormValues(item, languages, forms[3]);

        var row = [item.id, questions, audios, images, videos]
        return row.join("\t");
    }

    function makeHeadings(languages, exportCols) {
        var header_row = ["label"]
        for(i = 0; i < exportCols.length; i++) {
            for(j=0; j < languages.length; j++) {
                header_row.push(exportCols[i] + '-' + languages[j]);
            }
        }
        return header_row.join("\t");
    }

    var ret = [];
    // TODO: should this be configurable?
    var exportCols = ["default", "audio", "image" , "video"];
    var languages = Itext.getLanguages();

    var allItems = Itext.getNonEmptyItems();
    var language, item, i, j;
    if (languages.length > 0) {
        ret.push(makeHeadings(languages, exportCols))
        for(i = 0; i < allItems.length; i++) {
            item = allItems[i];
            ret.push(makeRow(languages, item, exportCols));
        }
    }
    return ret.join("\n");
};

var showItextDialog = function (Itext) {
    var $modal,
        $updateForm,
        $textarea;

    $modal = formdesigner.ui.generateNewModal("Edit Bulk Translations", [
        {
            id: 'fd-update-translations-button',
            title: "Update Translations",
            cssClasses: "btn-primary"
        }
    ]);
    $updateForm = formdesigner.ui.getTemplateObject('#fd-template-form-edit-source', {
        description: "Copy these translations into a spreadsheet program " + 
        "like Excel. You can edit them there and then paste them back " +
        "here when you're done. These will update the translations used in " +
        "your form. Press 'Update Translations' to save changes, or 'Close' " +
        "to cancel."
    });
    $modal.find('.modal-body').html($updateForm);

    // display current values
    $textarea = $updateForm.find('textarea');
    $textarea.val(generateItextXLS(Itext));

    $modal.find('#fd-update-translations-button').click(function () {
        parseXLSItext($textarea.val(), Itext);
        formdesigner.controller.form.fire('form-property-changed');
        $modal.modal('hide');
    });

    $modal.modal('show');
};

if (typeof formdesigner === "undefined") {
    var formdesigner = {};
}
formdesigner.plugins = formdesigner.plugins || {};

formdesigner.plugins.javaRosa = function (options) {
    this.options = options;

    this.Itext = ItextModel();
    var Itext = this.Itext;

    // parse Itext Block and populate itext model
    this.beforeParse = function (xml) {
        var head = xml.find('h\\:head, head'),
            itextBlock = head.find('itext');
    
        function eachLang() {
            var el = $(this), defaultExternalLang;
            var lang = el.attr('lang');
            
            function eachText() {
                var textEl = $ (this);
                var id = textEl.attr('id');
                var item = Itext.getOrCreateItem(id);
                
                function eachValue() {
                    var valEl = $(this);
                    var curForm = valEl.attr('form');
                    if(!curForm) {
                        curForm = "default";
                    }
                    item.getOrCreateForm(curForm).setValue(lang, formdesigner.util.getXLabelValue(valEl));
                }
                textEl.children().each(eachValue);
            }

            Itext.addLanguage(lang);
            if (el.attr('default') !== undefined) {
                Itext.setDefaultLanguage(lang);
            }

            //loop through children
            el.children().each(eachText);
        }
        
        Itext.clear();
        if (formdesigner.opts.langs && formdesigner.opts.langs.length > 0) {
            // override the languages with whatever is passed in
            for (var i = 0; i < formdesigner.opts.langs.length; i++) {
                Itext.addLanguage(formdesigner.opts.langs[i]);
            }
            Itext.setDefaultLanguage(formdesigner.opts.langs[0]);
        }
        $(itextBlock).children().each(eachLang);
        if (Itext.getLanguages().length === 0) {
            // there likely wasn't itext in the form or config. At least
            // set a default language
            Itext.addLanguage("en");
            Itext.setDefaultLanguage("en");
        }
        if (!formdesigner.currentItextDisplayLanguage) {
            formdesigner.currentItextDisplayLanguage = Itext.getDefaultLanguage();
        }
    };
    
    this.contributeToModelXML = function (xmlWriter) {
        var lang, id, langData, val, formData, 
            form, i, allLangKeys, question;

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

        var languages = Itext.getLanguages();
        var allItems = Itext.getNonEmptyItems();
        var item, forms, form;
        if (languages.length > 0) {
            xmlWriter.writeStartElement("itext");
            for (var i = 0; i < languages.length; i++) {
                lang = languages[i];
                xmlWriter.writeStartElement("translation");
                xmlWriter.writeAttributeStringSafe("lang", lang);
                if (Itext.getDefaultLanguage() === lang) {
                    xmlWriter.writeAttributeStringSafe("default", '');
                }
                for (var j = 0; j < allItems.length; j++) {
                    item = allItems[j];
                    xmlWriter.writeStartElement("text");
                    xmlWriter.writeAttributeStringSafe("id", item.id);
                    forms = item.getForms();
                    for (var k = 0; k < forms.length; k++) {
                        form = forms[k];
                        val = form.getValueOrDefault(lang);
                        xmlWriter.writeStartElement("value");
                        if(form.name !== "default") {
                            xmlWriter.writeAttributeStringSafe('form', form.name);
                        }
                        xmlWriter.writeString(val);
                        xmlWriter.writeEndElement();
                    }
                    xmlWriter.writeEndElement();
                }
                xmlWriter.writeEndElement();
            }
            xmlWriter.writeEndElement();
        }
    
    };

    this.onMugUpdateOrCreate = function (mug) {
    
    };

    this.preSerialize = function () {
        Itext.deduplicateIds();

        // remove crufty itext that isn't linked to anything in the form
        var validIds = formdesigner.controller.getAllNonEmptyItextItemsFromMugs();
        Itext.resetItextList(validIds);
    };

    // return an extended version of mugClass with any methods that are
    // necessary for all mugs in order for this plugin to work
    this.contributeToMugClass = function (mugClass) {
    
    };
    
    var validateItextItem = function (itextItem, name) {
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
    };
    
    this.contributeToDataElementSpec = function (spec, mug) {
        spec.keyAttr = {
            editable: 'w',
            visibility: 'advanced',
            presence: 'optional',
            lstring: 'JR:Preload key value'
        };
        return spec;
    };

    this.contributeToBindElementSpec = function (spec, mug) {
        spec.preload = {
            editable: 'w',
            visibility: 'advanced',
            presence: 'optional',
            lstring: "JR Preload"
        };
        spec.preloadParams = {
            editable: 'w',
            visibility: 'advanced',
            presence: 'optional',
            lstring: "JR Preload Param"
        };

        // hide non-itext constraint message unless it's present
        spec.constraintMsgAttr.visibility = "visible_if_present";
        spec.constraintMsgItextID = {
            editable: 'w',
            visibility: 'advanced',
            presence: 'optional',
            lstring: "Validation Error Message ID",
            uiType: iTextIDWidget,
            validationFunc: function (mug) {
                var bindElement = mug.bindElement;
                var constraintItext = bindElement.constraintMsgItextID;
                if (constraintItext && constraintItext.id) {
                    if (!formdesigner.util.isValidAttributeValue(constraintItext.id)) {
                        return constraintItext.id + " is not a valid ID";
                    }
                }
                if (constraintItext && constraintItext.id && !bindElement.constraintAttr) {
                    return "Can't have a Validation Message ID without a Validation Condition";
                }
                return validateItextItem(constraintItext, "Validation Error Message");
            }
        };

        if (mug.isSpecialGroup) {
            spec.constraintMsgItextID.presence = "notallowed";
        }
        return spec;
    };

    this.contributeToControlElementSpec = function (spec, mug) {
        // hide non-itext messages unless present
        spec.label.visibility = "visible_if_present";
        spec.hintLabel.visibility = "visible_if_present";
        // virtual property used to define a widget
        spec.labelItext = {
            editable: 'w',
            visibility: 'controlElement/labelItextID',
            presence: 'optional',
            uiType: itextLabelBlock,
            widgetOptions: {
                itextType: "label",
                getItextByMug: function (mug) {
                    return mug.controlElement.labelItextID;
                },
                displayName: "Label"
            },
            lstring: "Label"
        };
        spec.labelItextID = {
            editable: 'w',
            visibility: 'advanced',
            presence: 'optional',
            lstring: "Question Itext ID",
            uiType: iTextIDWidget,
            validationFunc : spec.label.validationFunc,
            widgetOptions: {
                displayName: "Add Other Content",
                itextType: "label",
                getItextByMug: function (mug) {
                    return mug.controlElement.labelItextID;
                },
                forms: ['long', 'short'],
                isCustomAllowed: true
            }
        };
        // virtual property used to get a widget
        spec.hintItext = {
            editable: 'w',
            visibility: 'controlElement/hintItextID',
            uiType: itextLabelBlock,
            widgetOptions: {
                itextType: "hint",
                getItextByMug: function (mug) {
                    return mug.controlElement.hintItextID;
                },
                displayName: "Hint Message"
            }
        };
        spec.hintItextID = {
            editable: 'w',
            visibility: 'advanced',
            presence: 'optional',
            lstring: "Hint Itext ID",
            uiType: iTextIDWidget,
            validationFunc: function (mug) {
                var hintItext, itextVal, controlElement;
                controlElement = mug.controlElement;
                hintItext = controlElement.hintItextID;
                if (hintItext && hintItext.id) {
                    if (!formdesigner.util.isValidAttributeValue(hintItext.id)) {
                        return hintItext.id + " is not a valid ID";
                    }
                }
                if (mug.controlElement.__spec.hintItextID.presence === 'required' &&
                    !hintItext.id) {
                    return 'Hint ID is required but not present in this question!';
                }
                
                return validateItextItem(hintItext, "Hint");
            },
            widgetOptions: {
                itextType: "hint",
                getItextByMug: function (mug) {
                    return mug.controlElement.hintItextID;
                },
                displayName: "Hint Message"
            }
        };
        // virtual property used to define a widget
        spec.constraintMsgItext = {
            editable: 'w',
            visibility: 'bindElement/constraintMsgItextID',
            presence: 'optional',
            uiType: itextLabelBlock,
            widgetOptions: {
                itextType: "constraintMsg",
                getItextByMug: function (mug) {
                    return mug.bindElement.constraintMsgItextID;
                },
                displayName: "Validation Message"
            },
            lstring: 'Validation Message',
        };
        // virtual property used to get a widget
        spec.otherItext = {
            editable: 'w',
            visibility: 'controlElement/labelItextID',
            presence: 'optional',
            lstring: "Add Other Content",
            uiType: itextConfigurableBlock,
            widgetOptions: {
                displayName: "Add Other Content",
                itextType: "label",
                getItextByMug: function (mug) {
                    return mug.controlElement.labelItextID;
                },
                forms: ['long', 'short'],
                isCustomAllowed: true
            }
        };
        // virtual property used to get a widget
        spec.mediaItext = {
            editable: 'w',
            visibility: 'controlElement/labelItextID',
            presence: 'optional',
            lstring: 'Add Multimedia',
            uiType: itextMediaBlock,
            widgetOptions: {
                displayName: "Add Multimedia",
                itextType: "label",
                getItextByMug: function (mug) {
                    return mug.controlElement.labelItextID;
                },
                forms: formdesigner.multimedia.SUPPORTED_MEDIA_TYPES,
                formToIcon: formdesigner.multimedia.ICONS
            }
        };

        if (mug.isSpecialGroup) {
            spec.hintItextID.presence = "notallowed";
            delete spec.otherItext;
            delete spec.mediaItext;
        }
        return spec;
    };

    this.contributeToMainProperties = function (properties) {
        properties.splice(
            1 + properties.indexOf('controlElement/label'), 0,
            'controlElement/labelItext'
        );
        return properties;
    };

    this.contributeToLogicProperties = function (properties) {
        properties.splice(
            1 + properties.indexOf('bindElement/constraintAttr'), 0,
            'controlElement/constraintMsgItext'
        );
        return properties;
    };

    this.contributeToAdvancedProperties = function (properties) {
        properties.splice(
            1 + properties.indexOf('dataElement/xmlnsAttr'), 0,
            'dataElement/keyAttr',
            'bindElement/preload',
            'bindElement/preloadParams'
        );

        properties = properties.concat([
            'controlElement/labelItextID',
            'bindElement/constraintMsgItextID',
            'controlElement/hintItextID',
            'controlElement/hintItext',
            'controlElement/otherItext'
        ]);

        return properties;
    };


    this.getAccordions = function () {
    
    };

    this.getAboveTreeWidgets = function () {
    
    };

    this.getToolsMenuItems = function () {
        return [
            {
                name: "Edit Bulk Translations",
                action: function () {
                    showItextDialog(Itext);
                }
            }
        ];
    };

    this.getFormErrors = function () {
        var itextValidation = Itext.validateItext();
        if (itextValidation !== true) {
            return itextValidation;
        }
    };

    this.reset = function () {
    
    };
};
