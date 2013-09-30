if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

formdesigner.widgets = (function () {
    var that = {};

    that.reservedItextContentTypes = [
        'default', 'short', 'long', 'audio', 'video', 'image'
    ];

    that.getGroupName = function (path) {
        return path.split("/")[0];
    };

    that.getPropertyName = function (path) {
        return path.split("/")[1];
    };

    that.baseWidget = function(mug) {
        // set properties shared by all widgets
        var widget = {};
        // this shared method provides fake inheritance, assuming
        // it is called in a constructor on the object being constructed
        widget.mug = mug;

        widget.getDisplayName = function () {
            // use the display text, or the property name if none found
            return this.definition.lstring ? this.definition.lstring : this.propName;
        };

        widget.getLabel = function () {
            var displayName = widget.getDisplayName();
            if (displayName) {
                return $("<label />")
                    .text(displayName)
                    .attr("for", widget.getID());
            } else {
                return null;
            }
        };

        widget.getControl = function () {
            throw ("must be overridden");
        };

        widget.getID = function () {
            throw ("must be overridden");
        };

        widget.setValue = function (val) {
            // noop
        };

        widget.getValue = function () {
            // noop
        };

        widget.updateValue = function () {
            // When a widget's value changes, do whatever work you need to in 
            // the model/UI to make sure we are in a consistent state.
            
            var isID = (['nodeID', 'defaultValue'].indexOf(widget.propName) !== -1),
                val = widget.getValue();

            if (isID && val.indexOf(' ') !== -1) { 
                // attempt to sanitize nodeID and choice values
                // TODO, still may allow some bad values
                widget.setValue(val.replace(/\s/g, '_'));
            }
            
            //short circuit the mug property changing process for when the
            //nodeID is changed to empty-string (i.e. when the user backspaces
            //the whole value).  This allows us to keep a reference to everything
            //and rename smoothly to the new value the user will ultimately enter.
            if (isID && val === "") {
                return;
            }
            
            widget.save();
        };

        widget.save = function () {
            throw 'Not Implemented';
        };

        widget.getUIElement = function () {
            // gets the whole widget (label + control)
            var uiElem = $("<div />").addClass("widget control-group"),
                $controls, $label;

            $label = widget.getLabel();
            $label.addClass('control-label');
            uiElem.append($label);

            $controls = $('<div class="controls" />');
            $controls.append(widget.getControl());
            uiElem.append($controls);

            return uiElem;
        };

        return widget;
    };

    that.normalWidget = function(mug, options) {
        // for "normal" = non-itext widgets.
        var widget = that.baseWidget(mug),
            path = options.path;
        widget.path = path;
        widget.definition = mug.getPropertyDefinition(path);
        widget.currentValue = mug.getPropertyValue(path);
        widget.groupName = that.getGroupName(widget.path);
        widget.propName = that.getPropertyName(widget.path);

        widget.getID = function () {
            return this.path.split("/").join("-");
        };

        widget.save = function () {
            formdesigner.controller.setMugPropertyValue(this.mug,
	                                                    this.groupName,
                                                        this.propName,
                                                        this.getValue(),
                                                        this.mug);
        };
        return widget;
    };

    that.textWidget = function (mug, options) {
        // a text widget
        var widget = that.normalWidget(mug, options);

	    var input = $("<input />").attr("id", widget.getID()).attr("type", "text").addClass('input-block-level');

	    widget.getControl = function () {
            return input;
        };

        widget.setValue = function (value) {
            input.val(value);
        };

        widget.getValue = function() {
            return input.val();
        };

        input.bind("change keyup", widget.updateValue);
        return widget;
    };

    that.droppableTextWidget = function (mug, options) {
        var widget = that.textWidget(mug, options);

        widget.getControl().addClass('jstree-drop')
            .attr('placeholder', 'Hint: drag a question here.')
            .change(widget.updateValue);

        return widget;
    };

    that.iTextIDWidget = function (mug, options) {
        // a special text widget that holds itext ids
        var widget = that.textWidget(mug, options);

        widget.isSelectItem = (mug.__className === "Item");
        widget.parentMug = widget.isSelectItem ? formdesigner.controller.form.controlTree.getParentMug(widget.mug) : null;
        widget.langs = formdesigner.model.Itext.getLanguages();

        var $input = widget.getControl();

        // a few little hacks to support auto-update of choices
        widget.getRootId = function () {
            if (widget.isSelectItem) {
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
            if (value) {
                widget.setUIValue(value.id);
            }
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
                widget.setValue('');
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

    that.checkboxWidget = function (mug, options) {

        var widget = that.normalWidget(mug, options);

        var input = $("<input />").attr("id", widget.getID());
        input.attr("type", "checkbox");

        widget.getControl = function () {
	        return input;
        };

        widget.setValue = function (value) {
            input.prop("checked", value);
        };

        widget.getValue = function() {
            return input.prop("checked");
        };

        input.change(widget.updateValue);
        return widget;
    };

    that.xPathWidget = function (mug, options) {
        var widget = that.textWidget(mug, options);
        var xPathButton = $('<button />')
            .addClass("xpath-edit-button pull-right")
            .text("Edit")
            .stopLink()
            .addClass('btn')
            .attr('type', 'button');
        xPathButton.data("group", widget.groupName).data("prop", widget.propName).data("inputControlID", widget.getID());
        xPathButton.click(function () {
            formdesigner.controller.displayXPathEditor({
                group:     $(this).data("group"),
                property:  $(this).data("prop"),
                xpathType: widget.definition.xpathType,
                value:     $("#" + $(this).data("inputControlID")).val()
            });
        });

        widget.getUIElement = function () {
            // gets the whole widget (label + control)
            var uiElem = $("<div />").addClass("widget control-group"),
                $controls = $('<div />').addClass('controls'),
                $label;
            $label = this.getLabel();
            $label.addClass('control-label');
            uiElem.append($label)
                .append(xPathButton);
            $controls.append(this.getControl())
                .css('margin-right', '60px');
            uiElem.append($controls);
            return uiElem;
        };

        return widget;
    };

    that.baseItextBlock = function (mug, options) {
        var block = {};

        block.mug = mug;
        block.itextType = options.itextType;
        block.languages = formdesigner.model.Itext.getLanguages();
        block.defaultLang = formdesigner.model.Itext.getDefaultLanguage();
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

    that.itextLabelBlock = function (mug, options) {
        var block = that.baseItextBlock(mug, options);

        block.getItextWidget = function () {
            return that.itextLabelWidget;
        };

        return block;
    };

    that.itextConfigurableBlock = function (mug, options) {
        var block = that.baseItextBlock(mug, options);

        block.isCustomAllowed = options.isCustomAllowed;
        block.activeForms = block.getItextItem().getFormNames();
        block.displayName = options.displayName;
        block.formToIcon = options.formToIcon || {};

        block.getItextWidget = function () {
            return that.itextFormWidget;
        };

        block.getForms = function () {
            var customForms = _.difference(block.activeForms, that.reservedItextContentTypes),
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
                        || that.reservedItextContentTypes.indexOf(currentValue) != -1
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

    that.itextMediaBlock = function (mug, options) {
        var block = that.itextConfigurableBlock(mug, options);

        block.getForms = function () {
            return _.intersection(block.activeForms, block.forms);
        };

        block.getItextWidget = function () {
            return that.itextMediaWidget;
        };

        return block;
    };

    that.itextLabelWidget = function (mug, language, form, options) {
        var widget = that.baseWidget(mug);

        widget.displayName = options.displayName;
        widget.itextType = options.itextType;
        widget.form = form || "default";

        widget.language = language;
        widget.languageName = formdesigner.langCodeToName[widget.language] || widget.language;
        widget.showOneLanguage = formdesigner.model.Itext.getLanguages().length < 2;
        widget.defaultLang = formdesigner.model.Itext.getDefaultLanguage();
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

    that.itextFormWidget = function (mug, language, form, options) {
        var widget = that.itextLabelWidget(mug, language, form, options);

        widget.getDisplayName = function () {
            return form + widget.getLangDesc();
        };

        var _getID = widget.getID;
        widget.getID = function () {
            return _getID() + "-" + form;
        };

        return widget;
    };

    that.itextMediaWidget = function (mug, language, form, options) {
        var widget = that.itextFormWidget(mug, language, form, options);
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

    that.selectWidget = function (mug, options) {
        // a select widget
        var widget = that.normalWidget(mug, options);

        var input = $("<select />").attr("id", widget.getID()).addClass("chzn-select");
        input.append($('<option value="blank" />'));
        for (var i in widget.definition.values) {
            if (widget.definition.values.hasOwnProperty(i)) {
                var strVal = formdesigner.util.fromCamelToRegularCase(widget.definition.values[i].replace('xsd:','')),
                    isSelected = '';

                var option = $("<option />").val(widget.definition.values[i]).text(strVal).appendTo(input);
                if (widget.currentValue === widget.definition.values[i]) {
                    // TODO: is this necessary?
                    option.attr("selected", "selected");
                }
            }
        }

        widget.getControl = function () {
            return input;
        };

        widget.setValue = function (value) {
            input.val(value);
        };

        widget.getValue = function() {
            return input.val();
        };

        input.change(widget.updateValue);

        return widget;
    };

    that.androidIntentAppIdWidget = function (mug) {
        var widget = that.baseWidget(mug);
        widget.definition = {};
        widget.currentValue = (mug.intentTag) ? mug.intentTag.path: "";
        widget.propName = "Intent ID";

        widget.getID = function () {
            return "intent-app-id";
        };

        var input = $("<input />").attr("id", widget.getID()).attr("type", "text").attr('placeholder', 'Insert Android Application ID');

        widget.getControl = function () {
            return input;
        };

        widget.setValue = function (value) {
            input.val(value);
        };

        widget.getValue = function() {
            return input.val();
        };

        widget.updateValue = function () {
            formdesigner.controller.setFormChanged();
            widget.mug.intentTag.path = widget.getValue();
        };

        input.bind("change keyup", widget.updateValue);

        return widget;

    };

    that.baseKeyValueWidget = function (mug) {
        var widget = that.baseWidget(mug);
        widget.definition = {};

        // todo make a style for this when vellum gets a facelift
        widget.kvInput = $('<div class="control-row" />');

        widget.getControl = function () {
            return widget.kvInput;
        };

        widget.setValue = function (value) {
            var kvTemplate = $('#fd-template-widget-control-keyvalue');
            widget.kvInput.html(_.template(kvTemplate.text(), {
                pairs: value
            }));
            widget.kvInput.find('input').bind('change keyup', widget.updateValue);
            widget.kvInput.find('.fd-kv-add-pair').click(function (e) {
                widget.refreshControl();
                e.preventDefault();
            });
            widget.kvInput.find('.fd-kv-remove-pair').click(function (e) {
                $(this).parent().parent().remove();
                widget.refreshControl();
                widget.save();
                e.preventDefault();
            });
        };

        widget.getValue = function () {
            var currentValues = {};
            _.each(widget.kvInput.find('.fd-kv-pair'), function (kvPair) {
                var $pair = $(kvPair);
                currentValues[$pair.find('.fd-kv-key').val()] = $pair.find('.fd-kv-val').val();
            });
            return currentValues;
        };

        widget.getValidValues = function () {
            var values = _.clone(widget.getValue());
            if (values[""]) {
                delete values[""];
            }
            return values;
        };

        widget.updateValue = function () {
            var currentValues = widget.getValue();
            if (!("" in currentValues)) {
                widget.kvInput.find('.btn').removeClass('hide');
                widget.kvInput.find('.fd-kv-remove-pair').removeClass('hide');
            }
            widget.save();
        };

        widget.refreshControl = function () {
            widget.setValue(widget.getValue());
        };

        return widget;
    };

    that.androidIntentExtraWidget = function (mug) {
        var widget = that.baseKeyValueWidget(mug);
        widget.currentValue = (mug.intentTag) ? mug.intentTag.extra : {};
        widget.propName = "Extra";

        widget.getID = function () {
            return "intent-extra";
        };

        widget.save = function () {
            if (widget.mug.intentTag) {
                widget.mug.intentTag.extra = widget.getValidValues();
                formdesigner.controller.setFormChanged();
            }
        };

        return widget;
    };

    that.androidIntentResponseWidget = function (mug) {
        var widget = that.baseKeyValueWidget(mug);
        widget.currentValue = (mug.intentTag) ? mug.intentTag.response : {};
        widget.propName = "Response";

        widget.getID = function () {
            return "intent-response";
        };

        widget.save = function () {
            if (widget.mug.intentTag) {
                widget.mug.intentTag.response = widget.getValidValues();
                formdesigner.controller.setFormChanged();
            }
        };

        return widget;
    };
    
    that.readOnlyControlWidget = function (mug) {
        var widget = that.baseWidget(mug);
        widget.definition = {};
        widget.currentValue = $('<div>').append(mug.controlElementRaw).clone().html();
        widget.propName = "Raw XML: ";

        widget.getID = function () {
            return "readonly-control";
        };

        widget.getControl = function () {
            var control = $("<p />").text(this.currentValue);
            return control;
        };

        return widget;

    };
    
    that.questionSection = function (mug, options) {
        var section = {};
        section.mug = mug;
        section.slug = options.slug || "anon";
        section.displayName = options.displayName;
        section.widgets = options.widgets;
        section.isCollapsed = !!(options.isCollapsed);
        section.help = options.help || {};

        section.getId = function () {
            return "fd-question-edit-" + this.slug;
        };

        section.getBaseTemplate = function () {
            return formdesigner.ui.getTemplateObject('#fd-template-question-fieldset', {
                fieldsetId: section.getId(),
                fieldsetTitle: section.displayName,
                isCollapsed: section.isCollapsed,
                help: section.help
            });
        };

        section.getSectionDisplay = function () {
            var $sec = section.getBaseTemplate(),
                $fieldsetContent;
            $fieldsetContent = $sec.find('.fd-fieldset-content');
            section.widgets.map(function (widgetDefinition) {
                var widgetClass = widgetDefinition.widgetType;

                if (!widgetClass) {
                    var propertyDefinition = section.mug.getPropertyDefinition(
                            widgetDefinition.path);

                    if (!propertyDefinition) {
                        return;
                    }
                    widgetClass = propertyDefinition.uiType || that.textWidget;
                }
                var elemWidget = widgetClass(section.mug, widgetDefinition);

                elemWidget.setValue(elemWidget.currentValue);
                $fieldsetContent.append(elemWidget.getUIElement());
            });
            return $sec;
        };

        return section;
    };

    that.getToolbarForMug = function (mug) {
        var $baseToolbar = formdesigner.ui.getTemplateObject('#fd-template-question-toolbar', {});
        $baseToolbar.find('#fd-button-remove').click(formdesigner.controller.removeCurrentQuestion);
        $baseToolbar.find('#fd-button-copy').click(function () {
            formdesigner.controller.duplicateCurrentQuestion({itext: 'copy'});
        });
        if (mug.isTypeChangeable) {
            $baseToolbar.find('.btn-toolbar.pull-left').prepend(this.getQuestionTypeChanger(mug));
        }
        return $baseToolbar;
    };

    that.getQuestionTypeChanger = function (mug) {
        var getQuestionList = function (mug) {
            var questions = formdesigner.ui.QUESTIONS_IN_TOOLBAR;
            var ret = [];
            for (var i = 0; i < questions.length; i++) {
                var q = mugs[questions[i]];
                if (q.prototype.isTypeChangeable && mug.prototype !== q.prototype) {
                    ret.push({
                        slug: questions[i],
                        name: q.prototype.typeName,
                        icon: q.prototype.icon
                    });
                }
            }
            return ret;
        };
        
        var $questionTypeChanger = formdesigner.ui.getTemplateObject('#fd-template-question-type-changer', {
            currentQuestionIcon: mug.getIcon(),
            questions: getQuestionList(mug)
        });
        $questionTypeChanger.find('.change-question').click(function (e) {
            try {
                formdesigner.controller.changeQuestionType(mug, $(this).data('qtype'));
            } catch (err) {
                alert("Sorry, you can't do that because: " + err);
                input.val(mug.__className);
            }
            e.preventDefault();
        });
        $questionTypeChanger.attr('id', 'fd-question-changer');
        return $questionTypeChanger;
    };

    that.getSectionListForMug = function (mug) {
        /**
         * Hard coded function to map mugs to the types of things
         * that they display
         *
         */
        var sections = [];
        sections.push(that.getMainSection(mug));
        if (mug.bindElement) {
            sections.push(that.getLogicSection(mug));
        }
        if (mug.controlElement && !mug.isSpecialGroup) {
            sections.push(that.getMediaSection(mug));
        }
        if (!(mug.__className === "ReadOnly")) {
            sections.push(that.getAdvancedSection(mug));
        }            
        return sections;
    };

    that.getMainSection = function (mug) {
        var widgets = [{
            path: "dataElement/nodeID"
        }];

        if (mug.__className === "Item") {
            widgets.push({
                path: "controlElement/defaultValue",
            });
        }

        if (!(mug.__className === "DataBindOnly")) {
            widgets.push({
                widgetType: that.itextLabelBlock,
                itextType: "label",
                getItextByMug: function (mug) {
                    return mug.controlElement.labelItextID;
                },
                displayName: "Label"
            });
        }

        if (mug.__className === "ReadOnly") {
            widgets.push({
                widgetType: that.readOnlyControlWidget,
                path: "system/readonlyControl"
            });
        }

        if (mug.__className === "AndroidIntent") {
            widgets.push({
                widgetType: that.androidIntentAppIdWidget,
                path: "system/androidIntentAppId"
            });
            widgets.push({
                widgetType: that.androidIntentExtraWidget,
                path: "system/androidIntentExtra"
            });
            widgets.push({
                widgetType: that.androidIntentResponseWidget,
                path: "system/androidIntentResponse"
            });
        }

        return that.questionSection(mug, {
            slug: "main",
            displayName: "Basic",
            widgets: widgets,
            help: formdesigner.util.HELP_TEXT_FOR_SECTION.main
        });
    };

    that.getMediaSection = function (mug) {
            
        var widgets = [
            {
                widgetType: that.itextMediaBlock,
                displayName: "Add Multimedia",
                itextType: "label",
                getItextByMug: function (mug) {
                    return mug.controlElement.labelItextID;
                },
                forms: formdesigner.multimedia.SUPPORTED_MEDIA_TYPES,
                formToIcon: formdesigner.multimedia.ICONS
            }
        ];

        return that.questionSection(mug, {
            displayName: "Media",
            slug: "content",
            widgets: widgets,
            isCollapsed: false,
            help: formdesigner.util.HELP_TEXT_FOR_SECTION.content
        });
    };

    that.getLogicSection = function (mug) {
        var widgets;

        if (mug.__className === "DataBindOnly") {
            widgets = [
                {
                    path: "bindElement/calculateAttr",
                },
                {
                    path: "bindElement/relevantAttr"
                }
            ];
        } else if (mug.isSpecialGroup) {
            widgets = [
                {
                    path: "bindElement/requiredAttr",
                },
                {
                    path: "bindElement/relevantAttr"
                }
            ];
        } else {
            widgets = [
                {
                    path: "bindElement/requiredAttr",
                },
                {
                    path: "bindElement/relevantAttr",
                }
            ];
            
            // only show calculate condition for non-data nodes if it already
            // exists.  It's a highly discouraged use-case because the user will
            // think they can edit an input when they really can't, but we
            // shouldn't break existing forms doing this.
            if (mug.bindElement.calculateAttr &&
                mug.__className !== "DataBindOnly") 
            {
                widgets.push({
                    path: "bindElement/calculateAttr"
                });
            }

            widgets = widgets.concat([
                {
                    path: "bindElement/constraintAttr"
                },
                {
                    widgetType: that.itextLabelBlock,
                    itextType: "constraintMsg",
                    getItextByMug: function (mug) {
                        return mug.controlElement.constraintMsgItextID;
                    },
                    displayName: "Validation Message"
                }
            ]);
        }

        if (mug.__className === "Repeat") {
            widgets.push({
                path: "controlElement/repeat_count"
            });
            widgets.push({
                path: "controlElement/no_add_remove"
            });
        }

        return that.questionSection(mug, {
            slug: "logic",
            displayName: "Logic",
            widgets: widgets,
            help: formdesigner.util.HELP_TEXT_FOR_SECTION.logic
        });
    };

    that.getAdvancedSection = function (mug) {
        var widgets = [
            {
                path: "dataElement/dataValue"
            },
            {
                path: "dataElement/keyAttr",
            },
            {
                path: "dataElement/xmlnsAttr",
            },
            {
                path: "bindElement/preload",
            },
            {
                path: "bindElement/preloadParams",
            },
            {
                path: "controlElement/label",
            },
            {
                path: "controlElement/hintLabel",
            },
            {
                path: "controlElement/labelItextID",
            },
        ];

        // This is a bit of a hack. Since constraintMsgItextID is an attribute
        // of the bind element and the parsing of bind elements doesn't know
        // what type an element is, it's difficult to do this properly with
        // controlElement.constraintMsgItextID.presence = "notallowed" in the group
        // mug definition.
        if (!mug.isSpecialGroup) {
            widgets.push({
                path: "bindElement/constraintMsgItextID",
            });
        }

        widgets.push({
            path: "controlElement/hintItextID",
        });

        // only show non-itext constraint message input if it has a value
        if (mug.bindElement && mug.bindElement.constraintMsgAttr) {
            widgets.push({
                path: "bindElement/constraintMsgAttr",
            });
        }

        // todo: add back check in new architecture
        //if (elementPaths.indexOf("controlElement/hintItextID") !== -1) {
	        widgets.push({
                widgetType: that.itextLabelBlock,
                itextType: "hint",
                getItextByMug: function (mug) {
                    return mug.controlElement.hintItextID;
                },
                displayName: "Hint Message"
	        });
        //}
        
        if (mug.controlElement && !mug.isSpecialGroup) {
            widgets.push({
                widgetType: that.itextConfigurableBlock,
                displayName: "Add Other Content",
                itextType: "label",
                getItextByMug: function (mug) {
                    return mug.controlElement.labelItextID;
                },
                forms: ['long', 'short'],
                isCustomAllowed: true
            });
        }

        return that.questionSection(mug, {
            slug: "advanced",
            type: "accordion",
            displayName: "Advanced",
            widgets: widgets,
            isCollapsed: true,
            help: formdesigner.util.HELP_TEXT_FOR_SECTION.advanced
        });
    };

    return that;
}());

