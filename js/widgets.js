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

    that.baseWidget = function(mugType) {
        // set properties shared by all widgets
        var widget = {};
        // this shared method provides fake inheritance, assuming
        // it is called in a constructor on the object being constructed
        widget.mug = mugType;

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

    /**
     * @param html  raw HTML or jQuery object
     */
    that.htmlWidget = function (mugType, options) {
        var id = options.id,
            html = options.html,
            widget = that.baseWidget(mugType);

        if (typeof html === 'string') {
            html = $(html);
        }
        
        widget.definition = options;

        widget.getID = function () { 
            return id; 
        };

        widget.getControl = function () {
            return html;
        };

        return widget;
    };

    that.normalWidget = function(mugType, path) {
        // for "normal" = non-itext widgets.
        var widget = that.baseWidget(mugType);
        widget.path = path;
        widget.definition = mugType.getPropertyDefinition(path);
        widget.currentValue = mugType.getPropertyValue(path);
        widget.groupName = that.getGroupName(widget.path);
        widget.propName = that.getPropertyName(widget.path);

        widget.getID = function () {
            return this.path.split("/").join("-");
        };

        widget.save = function () {
            formdesigner.controller.setMugPropertyValue(this.mug.mug,
	                                                    this.groupName,
                                                        this.propName,
                                                        this.getValue(),
                                                        this.mug);
        };
        return widget;
    };

    that.textWidget = function (mugType, path) {
        // a text widget
        var widget = that.normalWidget(mugType, path);

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

    that.droppableTextWidget = function (mugType, path) {
        var widget = that.textWidget(mugType, path);

        widget.getControl().addClass('jstree-drop')
            .attr('placeholder', 'Hint: drag a question here.')
            .change(widget.updateValue);

        return widget;
    };

    that.iTextIDWidget = function (mugType, path) {
        // a special text widget that holds itext ids
        var widget = that.textWidget(mugType, path);

        widget.isSelectItem = formdesigner.util.isSelectItem(widget.mug);
        widget.parentMug = widget.isSelectItem ? formdesigner.controller.form.controlTree.getParentMugType(widget.mug) : null;
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
                var val = widget.mug.mug.properties.controlElement.properties.defaultValue;
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
        if (widget.currentValue.id === widget.autoGenerateId(widget.getNodeId())) {
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
                    widget.mug.mug,
                    widget.groupName,
                    widget.propName,
                    oldItext,
                    widget.mug
                );
            }
        };

        widget.mug.mug.on('property-changed', function (e) {
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
                // _.each doesn't have a way to break out of it
                itextCheck:
                for (var form, f = 0; form = currentForms[f]; f++) {
                    for (var lang, l = 0; lang = widget.langs[l]; l++) {
                        if (form.getValue(lang)) {
                            isItextPresent = true;
                            break itextCheck;
                        }
                    }
                }
            }

            if (isItextPresent && !currentVal) {
                widget.setAutoMode(true);
                widget.updateAutoId();
                widget.updateValue();
            } else if (!isItextPresent && currentVal) {
                widget.setAutoMode(false);
                widget.setValue('');
            }
        };

        formdesigner.controller.on('update-question-itextid', function (e) {
            if (e.itextType === widget.getItextType()) {
                widget.handleItextLabelChange(e);
            }
        });

        return widget;
    };

    that.checkboxWidget = function (mugType, path) {

        var widget = that.normalWidget(mugType, path);

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

    that.xPathWidget = function (mugType, path) {
        var widget = that.textWidget(mugType, path);
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

    that.baseItextBlock = function (mugType, options) {
        var block = {};

        block.mugType = mugType;
        block.itextType = options.itextType;
        block.languages = formdesigner.model.Itext.getLanguages();
        block.defaultLang = formdesigner.model.Itext.getDefaultLanguage();
        block.getItextByMugType = options.getItextByMugType;
        block.forms = options.forms || ["default"];

        block.getItextItem = function () {
            return block.getItextByMugType(mugType);
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
            var itextWidgetFn = block.getItextWidget(),
                itextItem = block.getItextItem();

            _.each(block.getForms(), function (form) {
                var $formGroup = block.getFormGroupContainer(form);
                _.each(block.languages, function (lang) {
                    var itextWidget = itextWidgetFn(mugType, lang, form, options),
                        currentVal = itextItem.getValue(form, lang);
                    if (lang !== block.defaultLang) {
                        var defaultVal = itextItem.defaultValue();
                        itextWidget.setPlaceholder(defaultVal);
                        if (defaultVal === currentVal) {
                            currentVal = "";
                        }
                    }
                    itextWidget.setValue(currentVal);
                    $formGroup.append(itextWidget.getUIElement());
                });
                $blockUI.append($formGroup);
            });
            return $blockUI;
        };

        return block;
    };

    that.itextLabelBlock = function (mugType, options) {
        var block = that.baseItextBlock(mugType, options);

        block.getItextWidget = function () {
            return that.itextLabelWidget;
        };

        return block;
    };

    that.itextConfigurableBlock = function (mugType, options) {
        var block = that.baseItextBlock(mugType, options);

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
                    $formGroup.find('.itext-widget-input')
                        .trigger('question-itext-form-deleted');
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
                    var itextWidget = itextWidgetFn(mugType, lang, form, options),
                        itextForm, defaultValue;

                    defaultValue = itextWidget.getDefaultValue();
                    itextWidget.setValue(defaultValue);

                    $groupContainer.append(itextWidget.getUIElement());

                    itextForm = itextWidget.getItextItem().getOrCreateForm(form);
                    if (defaultValue) {
                        itextForm.setValue(lang, defaultValue);
                    }

                    itextWidget.fireChangeEvents();
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

    that.itextMediaBlock = function (mugType, options) {
        var block = that.itextConfigurableBlock(mugType, options);

        block.getForms = function () {
            return _.intersection(block.activeForms, block.forms);
        };

        block.getItextWidget = function () {
            return that.itextMediaWidget;
        };

        return block;
    };

    that.itextLabelWidget = function (mugType, language, form, options) {
        var widget = that.baseWidget(mugType);

        widget.displayName = options.displayName;
        widget.itextType = options.itextType;
        widget.form = form || "default";

        widget.language = language;
        widget.languageName = formdesigner.langCodeToName[widget.language] || widget.language;
        widget.showOneLanguage = formdesigner.model.Itext.getLanguages().length < 2;
        widget.defaultLang = formdesigner.model.Itext.getDefaultLanguage();

        widget.getItextItem = function () {
            // Make sure the real itextItem is being updated at all times, not a stale one.
            return options.getItextByMugType(mugType);
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

        var $input = $("<input />")
            .attr("id", widget.getID())
            .attr("type", "text")
            .addClass('input-block-level itext-widget-input');

        $input.keyup(widget.updateValue);
        $input.bind('question-itext-form-deleted', widget.fireChangeEvents);

        widget.getControl = function () {
            return $input;
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

        formdesigner.controller.on('question-itext-changed', function () {
            if (widget.language !== widget.defaultLang) {
                widget.setPlaceholder(widget.getItextItem().getValue(widget.form, widget.defaultLang));
            }
        });

        widget.fireChangeEvents = function () {
            var itextItem = widget.getItextItem();
            if (itextItem) {
	            // fire the property changed event(s)
	            formdesigner.controller.fire({
	               type: "question-itext-changed",
	               language: widget.language,
	               item: itextItem,
	               form: widget.form,
	               value: widget.getValue()
	            });
	            formdesigner.controller.form.fire({
	               type: "form-property-changed"
	            });
                formdesigner.controller.fire({
                   type: "update-question-itextid",
                   itextType: widget.itextType,
                   itextItem: itextItem
                });
	        }
        };

        widget.save = function () {
            var itextItem = widget.getItextItem();
            if (itextItem) {
                var itextForm = itextItem.getForm(widget.form);
	            itextForm.setValue(widget.language, widget.getValue());
	            widget.fireChangeEvents();
	        }
        };

        return widget;

    };

    that.itextFormWidget = function (mugType, language, form, options) {
        var widget = that.itextLabelWidget(mugType, language, form, options);

        widget.getDisplayName = function () {
            return form + widget.getLangDesc();
        };

        var _getID = widget.getID;
        widget.getID = function () {
            return _getID() + "-" + form;
        };

        return widget;
    };

    that.itextMediaWidget = function (mugType, language, form, options) {
        var widget = that.itextFormWidget(mugType, language, form, options);
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
                       mugType.getDefaultItextRoot() + "." + extension;
            }
            return null;
        };

        widget.getPreviewUI = function () {
            var currentPath = widget.getValue(),
                $preview;
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
            $input.keyup(widget.updateValue);
            $input.bind('question-itext-form-deleted', widget.fireChangeEvents);
            $input.bind("change keyup", widget.updateMultimediaBlockUI)

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

    that.selectWidget = function (mugType, path) {
        // a select widget
        var widget = that.normalWidget(mugType, path);

        var input = $("<select />").attr("id", widget.getID()).addClass("chzn-select");
        input.append($('<option value="blank" />'));
        for (var i in widget.definition.values) {
            if (widget.definition.values.hasOwnProperty(i)) {
                var strVal = formdesigner.util.fromCamelToRegularCase(widget.definition.values[i].replace('xsd:','')),
                    isSelected = '';

                option = $("<option />").val(widget.definition.values[i]).text(strVal).appendTo(input);
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

    that.androidIntentAppIdWidget = function (mugType) {
        var widget = that.baseWidget(mugType);
        widget.definition = {};
        widget.currentValue = (mugType.intentTag) ? mugType.intentTag.path: "";
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
            mugType.intentTag.path = widget.getValue();
        };

        input.bind("change keyup", widget.updateValue);

        return widget;

    };

    that.baseKeyValueWidget = function (mugType) {
        var widget = that.baseWidget(mugType);
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
            })
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

    that.androidIntentExtraWidget = function (mugType) {
        var widget = that.baseKeyValueWidget(mugType);
        widget.currentValue = (mugType.intentTag) ? mugType.intentTag.extra : {};
        widget.propName = "Extra";

        widget.getID = function () {
            return "intent-extra";
        };

        widget.save = function () {
            if (mugType.intentTag) {
                mugType.intentTag.extra = widget.getValidValues();
                formdesigner.controller.setFormChanged();
            }
        };

        return widget;
    };

    that.androidIntentResponseWidget = function (mugType) {
        var widget = that.baseKeyValueWidget(mugType);
        widget.currentValue = (mugType.intentTag) ? mugType.intentTag.response : {};
        widget.propName = "Response";

        widget.getID = function () {
            return "intent-response";
        };

        widget.save = function () {
            if (mugType.intentTag) {
                mugType.intentTag.response = widget.getValidValues();
                formdesigner.controller.setFormChanged();
            }
        };

        return widget;
    };
    
    that.readOnlyControlWidget = function (mugType) {
        var widget = that.baseWidget(mugType);
        widget.definition = {};
        widget.currentValue = $('<div>').append(mugType.mug.controlElementRaw).clone().html();
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
    
    that.widgetTypeFromPropertyDefinition = function (propertyDef) {
        switch (propertyDef.uiType) {
            case "select":
                return that.selectWidget;
            case "checkbox":
                return that.checkboxWidget;
            case "xpath":
                return that.xPathWidget;
            case "itext-id":
                return that.iTextIDWidget;
            case "droppable-text":
                return that.droppableTextWidget;
            default:
                return that.textWidget;
        }
    };

    that.widgetFromMugAndDefinition = function (mugType, definition) {
        // there is probably one layer of indirection too many here
        switch (definition.widgetType) {
            case "itextLabel":
                return that.itextLabelBlock(mugType, definition);
            case "itextConfig":
                return that.itextConfigurableBlock(mugType, definition);
            case "itextMedia":
                return that.itextMediaBlock(mugType, definition);
            case "androidIntentAppId":
                return that.androidIntentAppIdWidget(mugType);
            case "androidIntentExtra":
                return that.androidIntentExtraWidget(mugType);
            case "androidIntentResponse":
                return that.androidIntentResponseWidget(mugType);
            case "readonlyControl":
                return that.readOnlyControlWidget(mugType);
            case "html":
                return that.htmlWidget(mugType, definition);
            case "generic":
            default:
                var cls = that.widgetTypeFromPropertyDefinition(mugType.getPropertyDefinition(definition.path));
                return cls(mugType, definition.path);
        }
    };

    that.questionSection = function (mugType, options) {
        // functional inheritance
        var section = {};
        section.mugType = mugType;
        section.slug = options.slug || "anon";
        section.displayName = options.displayName;
        section.elements = options.elements;
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

        section.getWidgets = function () {
            var toWidget = function (elementdefinition) {
                return that.widgetFromMugAndDefinition(section.mugType, elementdefinition);
            };
            return section.elements.map(toWidget);
        };

        section.getSectionDisplay = function () {
            var $sec = section.getBaseTemplate(),
                $fieldsetContent;
            $fieldsetContent = $sec.find('.fd-fieldset-content');
            section.getWidgets().map(function (elemWidget) {
                elemWidget.setValue(elemWidget.currentValue);
                $fieldsetContent.append(elemWidget.getUIElement());
            });
            return $sec;
        };

        return section;
    };

    /**
     * Hard coded function to map mugs to the types of things
     * that they display
     *
     */

    that.getToolbarForMug = function (mugType) {
        var $baseToolbar = formdesigner.ui.getTemplateObject('#fd-template-question-toolbar', {});
        $baseToolbar.find('#fd-button-remove').click(formdesigner.controller.removeCurrentQuestion);
        $baseToolbar.find('#fd-button-copy').click(function () {
            formdesigner.controller.duplicateCurrentQuestion({itext: 'copy'});
        });
        if (formdesigner.util.UNCHANGEABLE_QUESTIONS.indexOf(mugType.typeSlug) === -1) {
            $baseToolbar.find('.btn-toolbar.pull-left').prepend(this.getQuestionTypeChanger(mugType));
        }
        return $baseToolbar;
    };

    that.getQuestionTypeChanger = function (mugType) {
        var $questionTypeChanger = formdesigner.ui.getTemplateObject('#fd-template-question-type-changer', {
            currentQuestionIcon: formdesigner.util.QUESTION_TYPE_TO_ICONS[mugType.typeSlug],
            questions: formdesigner.util.getQuestionList(mugType.typeSlug)
        });
        $questionTypeChanger.find('.change-question').click(function (e) {
            try {
                formdesigner.controller.changeQuestionType(mugType, $(this).data('qtype'));
            } catch (err) {
                alert("Sorry, you can't do that because: " + err);
                input.val(mugType.typeSlug);
            }
            e.preventDefault();
        });
        $questionTypeChanger.attr('id', 'fd-question-changer');
        return $questionTypeChanger;
    };

    that.getSectionListForMug = function (mugType) {
        sections = [];
        sections.push(that.getMainSection(mugType));
        if (mugType.hasBindElement()) {
            sections.push(that.getLogicSection(mugType));
        }
        if (mugType.hasControlElement() && !mugType.isSpecialGroup()) {
            sections.push(that.getMediaSection(mugType));
        }
        if (!formdesigner.util.isReadOnly(mugType)) {
            sections.push(that.getAdvancedSection(mugType));
        }            
        return sections;
    };

    var wrapAsGeneric = function (elemPath) {
        // utility method for ease of editing paths
        return {widgetType: "generic", path: elemPath };
    };

    var filterByMugProperties = function (list, mugType) {
        var ret = [];
        var path, propertyDef;

        for (var i = 0; i < list.length; i++) {
            path = list[i];
            try {
                propertyDef = mugType.getPropertyDefinition(path);
                if (propertyDef.presence !== "notallowed") {
                    ret.push(path);
                }
            } catch (err) {
                // assume we couldn't get the property definition
                // therefore we should ignore it.
            }
        }
        return ret;
    };

    that.getMainSection = function (mugType) {
        var elements = ["dataElement/nodeID"];

        if (formdesigner.util.isSelectItem(mugType)) {
            elements.push("controlElement/defaultValue");
        }

        elements = filterByMugProperties(elements, mugType).map(wrapAsGeneric);

        if (mugType.typeSlug !== 'datanode') {
            elements.push({
                widgetType: "itextLabel",
                itextType: "label",
                getItextByMugType: function (mugType) {
                    return mugType.getItext();
                },
                displayName: "Label"
            });
        }

        if (formdesigner.util.isReadOnly(mugType)) {
            elements.push({widgetType: "readonlyControl", path: "system/readonlyControl"});
        }

        if (mugType.typeSlug == 'androidintent') {
            elements.push({widgetType: "androidIntentAppId", path: "system/androidIntentAppId"});
            elements.push({widgetType: "androidIntentExtra", path: "system/androidIntentExtra"});
            elements.push({widgetType: "androidIntentResponse", path: "system/androidIntentResponse"});
        }

        elements.push();

        return that.questionSection(mugType, {
            slug: "main",
            displayName: "Basic",
            elements: elements,
            help: formdesigner.util.HELP_TEXT_FOR_SECTION.main
        });
    };

    that.getMediaSection = function (mugType) {
            
        var elements = [
            {
                widgetType: "itextMedia",
                displayName: "Add Multimedia",
                itextType: "label",
                getItextByMugType: function (mugType) {
                    return mugType.getItext();
                },
                forms: formdesigner.multimedia.SUPPORTED_MEDIA_TYPES,
                formToIcon: formdesigner.multimedia.ICONS
            }
        ];

        return that.questionSection(mugType, {
            displayName: "Media",
            slug: "content",
            elements: elements,
            isCollapsed: false,
            help: formdesigner.util.HELP_TEXT_FOR_SECTION.content
        });
    };

    that.getLogicSection = function (mugType) {
        var properties;

        if (mugType.typeSlug === 'datanode') {
            properties = [
                "bindElement/calculateAttr",
                "bindElement/relevantAttr"
            ];
        } else if (mugType.isSpecialGroup()) {
            properties = [
                "bindElement/requiredAttr",
                "bindElement/relevantAttr"
            ];
        } else {
            properties = [
                "bindElement/requiredAttr",
                "bindElement/relevantAttr",
                "bindElement/constraintAttr"
            ];
        }

        var elementPaths = filterByMugProperties(properties, mugType);

        var elements = elementPaths.map(wrapAsGeneric);
        if (elementPaths.indexOf("bindElement/constraintAttr") !== -1) {
            // only add the itext if the constraint was relevant
	        elements.push({
                widgetType: "itextLabel",
                itextType: "constraintMsg",
                getItextByMugType: function (mugType) {
                    return mugType.getConstraintMsgItext();
                },
                displayName: "Validation Message"
	        });


            // only show calculate condition for non-data nodes if it already
            // exists.  It's a highly discouraged use-case because the user will
            // think they can edit an input when they really can't, but we
            // shouldn't break existing forms doing this.
            if (mugType.mug.properties.bindElement.properties.calculateAttr &&
                mugType.typeSlug !== 'datanode') {
                properties.push("bindElement/calculateAttr");
            }
        }

        if (mugType.typeSlug == 'repeat') {
            elements.push(wrapAsGeneric("controlElement/repeat_count"));
            elements.push(wrapAsGeneric("controlElement/no_add_remove"));
        }

        return that.questionSection(mugType, {
            slug: "logic",
            displayName: "Logic",
            elements: elements,
            help: formdesigner.util.HELP_TEXT_FOR_SECTION.logic
        });
    };

    that.getAdvancedSection = function (mugType) {
        var properties = [
            "dataElement/dataValue",
            "dataElement/keyAttr",
            "dataElement/xmlnsAttr",
            "bindElement/preload",
            "bindElement/preloadParams",
            "controlElement/label",
            "controlElement/hintLabel",
            "controlElement/labelItextID"
        ];

        // This is a bit of a hack. Since constraintMsgItextID is an attribute
        // of the bind element and the parsing of bind elements doesn't know
        // what type an element is, it's difficult to do this properly with
        // controlElement.constraintMsgItextID.presence = "notallowed" in the group
        // mugtype definition.
        if (!(mugType.typeSlug === 'group' || mugType.typeSlug === 'repeat' || mugType.typeSlug === 'fieldlist')) {
            properties.push("bindElement/constraintMsgItextID");
        }

        properties.push("controlElement/hintItextID");

        // only show non-itext constraint message input if it has a value
        if (mugType.hasBindElement() && mugType.mug.properties.bindElement.properties.constraintMsgAttr) {
            properties.push("bindElement/constraintMsgAttr");
        }

        var elementPaths = filterByMugProperties(properties, mugType),
            elements = elementPaths.map(wrapAsGeneric);

        if (elementPaths.indexOf("controlElement/hintItextID") !== -1) {
	        elements.push({
                widgetType: "itextLabel",
                itextType: "hint",
                getItextByMugType: function (mugType) {
                    return mugType.getHintItext();
                },
                displayName: "Hint Message"
	        });
        }
        
        if (mugType.hasControlElement() && !mugType.isSpecialGroup()) {
            elements.push({
                widgetType: "itextConfig",
                displayName: "Add Other Content",
                itextType: "label",
                getItextByMugType: function (mugType) {
                    return mugType.getItext();
                },
                forms: ['long', 'short'],
                isCustomAllowed: true
            });
        }

        return that.questionSection(mugType, {
            slug: "advanced",
            type: "accordion",
            displayName: "Advanced",
            elements: elements,
            isCollapsed: true,
            help: formdesigner.util.HELP_TEXT_FOR_SECTION.advanced
        });
    };

    return that;
}());

