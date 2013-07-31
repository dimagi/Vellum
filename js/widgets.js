if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

formdesigner.widgets = (function () {
    var that = {};

    that.unchangeableQuestionTypes = [
        "item", "group", "repeat", "fieldlist", "datanode", "trigger", "unknown", "androidintent"
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
            var displayName = this.getDisplayName();
            if (displayName) {
                return $("<label />")
                    .text(displayName)
                    .attr("for", this.getID());
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
                // attempt to sanitize nodeID and select item values
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
                $control, $label;

            $label = this.getLabel();
            $label.addClass('control-label');
            uiElem.append($label);

            var $controls = $('<div class="controls" />');
            $controls.append(this.getControl());
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

        // a few little hacks to support auto-update of select items
        widget.getRootId = function () {
            if (this.isSelectItem) {
                return this.parentMug.getDefaultItextRoot() + "-";
            }
            return "";
        };

        widget.getNodeId = function () {
            if (!this.isSelectItem) {
                return this.mug.getDefaultItextRoot();
            } else {
                var val = this.mug.mug.properties.controlElement.properties.defaultValue;
                return val ? val : "null";
            }
        };

        widget.autoGenerateId = function (nodeId) {
            return this.getRootId() + nodeId + "-" + widget.propName.replace("ItextID", "");
        };

        widget.setUIValue = function (val) {
            this.getControl().val(val);
        };

        widget.updateAutoId = function () {
            widget.setUIValue(widget.autoGenerateId(widget.getNodeId()));
        };

        widget.getItextItem = function () {
            return this.itextItem;
        };

        widget.setValue = function (value) {
            this.itextItem = value;
            this.setUIValue(value.id);
        };

        widget.getValue = function() {
            return this.getControl().val();
        };

        // auto checkbox
        var autoBoxId = widget.getID() + "-auto-itext";
        var autoBox = $("<input />").attr("type", "checkbox").attr("id", autoBoxId);
        var autoBoxLabel = $("<label />").text("auto?").attr("for", autoBoxId).addClass('checkbox');

        autoBox.change(function () {
            if ($(this).prop('checked')) {
                widget.updateAutoId();
                widget.updateValue();
            }
        });

        widget.setAutoMode = function (autoMode) {
            autoBox.prop("checked", autoMode);
        };

        widget.getAutoMode = function () {
            return autoBox.prop('checked');
        };

        // support auto mode to keep ids in sync
        if (widget.currentValue.id === widget.autoGenerateId(widget.getNodeId())) {
            widget.setAutoMode(true);
        }

        widget.getUIElement = function () {
            // gets the whole widget (label + control)
            var uiElem = $("<div />").addClass("widget control-group"),
                $controls = $('<div class="controls" />'),
                $label;

            $label = this.getLabel();
            $label.addClass('control-label');
            uiElem.append($label);

            var $input = this.getControl();
            $input.removeClass('input-block-level');
            $input.addClass('input-large');
            $controls.append($input);


            var autoDiv = $("<span />").addClass("auto-itext help-inline");
            autoBoxLabel.prepend(autoBox);
            autoDiv.append(autoBoxLabel);
            $controls.append(autoDiv);
            uiElem.append($controls);

            return uiElem;
        };


        widget.save = function () {
            // override save to call out to rename itext
            var oldItext = this.mug.getPropertyValue(this.path);
            var val = this.getValue();
            if (oldItext.id !== val) {
                oldItext.id = val;
                formdesigner.controller.setMugPropertyValue(this.mug.mug,
	                                                        this.groupName,
	                                                        this.propName,
	                                                        oldItext,
	                                                        this.mug);
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
        var xPathButton = $('<button />').addClass("xpath-edit-button").text("Edit").button().addClass('btn');
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
                $controls = $('<div class="controls" />'),
                $label;
            $label = this.getLabel();
            $label.addClass('control-label');
            uiElem.append($label);
            $controls.append(this.getControl());
            $controls.append(xPathButton);
            uiElem.append($controls);
            return uiElem;
        };

        return widget;
    };

    that.baseItextWidget = function (mugType, language, itemFunc, slug, form, change) {
        var widget = that.baseWidget(mugType),
            onChange = change || function () {};

        widget.language = language;
        widget.form = form;
        widget.slug = slug;

        widget.getTextItem = function () {
            return itemFunc(this.mug);
        };

        widget.getID = function () {
            return "itext-" + this.language + "-" + this.slug + "-" + this.form;
        };

        widget.getType = function () {
            if (this.form === "default") {
                return "Display Text";
            }
            return this.form;
        };
        
        var input = $("<input />").attr("id", widget.getID()).attr("type", "text").addClass('input-block-level')
            .keyup(function () {
                widget.updateValue();
                onChange();
            });

        widget.setValue = function (value) {
            input.val(value);
        };

        widget.getValue = function() {
            return input.val();
        };

        widget.fireChangeEvents = function () {
            item = this.getTextItem();
            if (item) {
	            // fire the property changed event(s)
	            formdesigner.controller.fire({
	               type: "question-itext-changed",
	               language: this.language,
	               item: item,
	               form: this.form,
	               value: this.getValue(),
	            });
	            formdesigner.controller.form.fire({
	               type: "form-property-changed"
	            });
	        }
        };
        widget.save = function () {
            // override save to reference the itext, rather than
            // a property of the mug
            item = this.getTextItem();
            if (item) {
	            item.getForm(this.form).setValue(this.language, this.getValue());
	            this.fireChangeEvents();
	        }
        };

        // this is special
        widget.deleteValue = function () {
            item = this.getTextItem();
            if (item) {
                item.removeForm(this.form);
            }
        };

        widget.getControl = function () {
            return input;
        };

        return widget;
    };

    that.iTextWidget = function(mugType, language, itemFunc, slug, form, block, change) {
        var widget = that.baseItextWidget(mugType, language, itemFunc, slug, form, change);

        widget.getDisplayName = function () {
            return widget.getType();
        };

        return widget;
    };

    that.iTextRemovableWidget = function(mugType, language, itemFunc, slug, form, block, change) {
        var widget = that.iTextWidget(mugType, language, itemFunc, slug, form, change);

        widget.getUIElement = function () {
            // gets the whole widget (label + control)
            var uiElem = $("<div />").addClass("widget control-group").attr("data-form", form),
                $controls = $('<div class="controls controls-row" />'),
                $label, $input, $deleteButton;

            $label = this.getLabel();
            $label.addClass('control-label');
            uiElem.append($label);

            $input = this.getControl();
            $input.addClass('span10');
            $input.removeClass('input-block-level');
            $controls.append($input);

            $controls.append($('<div class="span2" />').append(widget.getDeleteButton()));

            uiElem.append($controls);

            return uiElem;
        };

        widget.getDeleteButton = function () {
            var $deleteButton = $($('#fd-template-button-remove').html());
            $deleteButton.click(function () {
                widget.deleteValue();
                // this is a bit ridiculous but finds the right things to remove
                $("#fd-question-edit-content .itext-language-section")
                    .children('div[data-form="' + form + '"]')
                    .each(function () {
                        $(this).remove();
                });
                block.formList.splice(block.formList.indexOf(form), 1);
                $('#' + formdesigner.util.getAddNewItextItemId(form)).removeClass('disabled');
                widget.fireChangeEvents();
            });
            return $deleteButton;
        };

        widget.getDisplayName = function () {
            return widget.getType();
        };

        return widget;
    };

    that.iTextMediaWidget = function (mugType, language, itemFunc, slug, form, block, change) {
        var widget = that.iTextRemovableWidget(mugType, language, itemFunc, slug, form, block, change);

        widget.mediaRef = formdesigner.multimedia.multimediaReference(form);

        var $input = widget.getControl(),
            $uiElem = $("<div />");

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
                })
            }
            return $preview;
        };

        widget.getUploadButtonUI = function () {
            var currentPath = widget.getValue(),
                $uploadBtn;
            $uploadBtn = $(_.template($('#fd-template-multmedia-upload-trigger').text(), {
                multimediaExists: currentPath in formdesigner.multimedia.objectMap,
                uploaderId: formdesigner.multimedia.SLUG_TO_CONTROL[form].uploaderSlug,
                mediaType: form
            }));
            $uploadBtn.click(function () {
                widget.mediaRef.updateController();
            });
            return $uploadBtn;
        };

        widget.updateReference = function () {
            var currentPath = widget.getValue();
            $uiElem.attr('data-hqmediapath', currentPath);
            widget.mediaRef.updateRef(currentPath);
        };



        widget.getPreviewContainerId = function () {
            return  'fd-mm-preview-container-' + form;
        };

        widget.getUIElement = function () {
            $uiElem = $("<div />").addClass("widget control-group").attr("data-form", form);
            var $controls = $('<div class="controls control-row" />'),
                $previewContainer = $('<div />').addClass('fd-mm-preview-container span2'),
                $uploadContainer = $('<div />').addClass('fd-mm-upload-container span8'),
                $label;

            $label = widget.getLabel();
            $label.addClass('control-label');
            $uiElem.append($label);

            widget.updateReference();

            $previewContainer.attr('id', widget.getPreviewContainerId());
            $previewContainer.html(widget.getPreviewUI());
            $previewContainer.find('.existing-media').tooltip();

            $controls.append($previewContainer);

            if (formdesigner.multimedia.isUploadEnabled) {
                $uploadContainer.html($('#fd-template-multimedia-block').html());
                $uploadContainer.find('.fd-mm-upload-trigger').append(widget.getUploadButtonUI());
                $uploadContainer.find('.fd-mm-path-input').append($input);
                $uploadContainer.find('.fd-mm-path-show').click(function () {
                    var $showBtn = $(this);
                    $showBtn.addClass('hide');
                    $showBtn.parent().find('.fd-mm-path').removeClass('hide');
                });
                $uploadContainer.find('.fd-mm-path-hide').click(function () {
                    var $hideBtn = $(this);
                    $hideBtn.parent().addClass('hide');
                    $hideBtn.parent().parent().find('.fd-mm-path-show').removeClass('hide');
                });
            } else {
                $uploadContainer.append($input);
            }

            $controls.append($uploadContainer);

            $controls.append($('<div class="span2" />').append(widget.getDeleteButton()));

            $uiElem.append($controls);

            $uiElem.on('mediaUploadComplete', widget.handleUploadComplete);

            return $uiElem;
        };

        widget.getDisplayName = function () {
            return "Multimedia: " + widget.getType();
        };

        widget.updateMultimediaBlockUI = function () {
            var $previewContainer = $uiElem.find('.fd-mm-preview-container');
            $previewContainer.html(widget.getPreviewUI());
            $previewContainer.find('.existing-media').tooltip();

            var $uploadContainer = $uiElem.find('.fd-mm-upload-container');
            $uploadContainer.find('.fd-mm-upload-trigger').empty();
            $uploadContainer.find('.fd-mm-upload-trigger').append(widget.getUploadButtonUI());

            widget.updateReference();
        };

        $input.bind("change keyup", widget.updateMultimediaBlockUI);

        widget.handleUploadComplete = function (event, data) {
            if (data.ref && data.ref.path) {
                formdesigner.multimedia.objectMap[data.ref.path] = data.ref;
            }
            widget.updateMultimediaBlockUI();
        };



        return widget;
    };

    that.iTextInlineWidget = function (mugType, language, itemFunc, slug, form, displayName, change) {
        var widget = that.baseItextWidget(mugType, language, itemFunc, slug, form, change);

        widget.getDisplayName = function () {
            var formSpecifier = (this.form === "default") ? "" : " - " + this.form;
            return displayName + formSpecifier + " (" + language + ")";
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

    that.questionTypeSelectorWidget = function (mugType) {
        var widget = that.baseWidget(mugType);
        widget.definition = {};
        widget.currentValue = mugType.typeSlug;
        widget.propName = "Question Type";

        widget.getID = function () {
            return "question-type";
        };

        var input = formdesigner.ui.getQuestionTypeSelector();
        // small hack: don't show data nodes or select items for now
        for (var i = 0; i < that.unchangeableQuestionTypes.length; i++) {
            input.find("#" + that.unchangeableQuestionTypes[i]).remove();
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

        input.change(function () {
            try {
                formdesigner.controller.changeQuestionType(mugType, widget.getValue());
            } catch (err) {
                alert("Sorry, you can't do that because: " + err);
                input.val(mugType.typeSlug);
            }
        });

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
            case "itext":
                if (definition.displayMode === "inline") {
                    return that.iTextFieldBlockInline(mugType, definition);
                } else {
                    // default to "full"
                    return that.iTextFieldBlock(mugType, definition);
                }
            case "questionType":
                return that.questionTypeSelectorWidget(mugType);
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

    that.baseSection = function (mugType, options) {
        // functional inheritance
        var section = {};
        section.mugType = mugType;
        section.slug = options.slug || "anon";
        section.displayName = options.displayName;
        section.elements = options.elements;

        section.getHeader = function () {
            return $('<h2 />').text(this.displayName);
        };

        section.getId = function () {
            return "fd-question-edit-" + this.slug;
        };
        return section;
    };

    that.genericSection = function (mugType, options) {
        var section = that.baseSection(mugType, options);

        section.getWidgets = function () {

            var inner = this;
            var toWidget = function (elementdefinition) {
                return that.widgetFromMugAndDefinition(inner.mugType, elementdefinition);
            };
            return this.elements.map(toWidget);
        };

        section.getSectionDisplay = function () {
            // returns the actual display for the section

            var header = this.getHeader();
            var sec = $("<fieldset />").attr("id", this.getId()).addClass("question-section");
            this.getWidgets().map(function (elemWidget) {
                elemWidget.setValue(elemWidget.currentValue);
                elemWidget.getUIElement().appendTo(sec);
            });
            return header.add(sec);
        };
        return section;
    };

    that.accordionSection = function (mugType, options) {
        var section = that.baseSection(mugType, options);

        section.getHeader = function () {
            return $('<h3><a href="#">' + this.displayName + '</a></h3>');
        };

        section.getWidgets = function () {
            // TODO: don't copy paste this -- break into subsections?
            var inner = this;
            var toWidget = function (elementdef) {
                return that.widgetFromMugAndDefinition(inner.mugType, elementdef);
            };
            return this.elements.map(toWidget);
        };

        section.getSectionDisplay = function () {
            // returns the actual display for the section
            var sec = $("<fieldset />").attr("id", this.getId()).addClass("question-section");
            this.getHeader().appendTo(sec);
            var inner = $('<div />').appendTo(sec);
            this.getWidgets().map(function (elemWidget) {
                elemWidget.setValue(elemWidget.currentValue);
                elemWidget.getUIElement().appendTo(inner);
            });
            sec.accordion({
                autoHeight: false,
                collapsible: true,
                active: options.active !== undefined ? options.active : false
            });

            return sec;
        };
        return section;
    };

    that.baseITextFieldBlock = function (mugType, options) {
        var block = {};

        block.mugType = mugType;
        block.textIdFunc = options.textIdFunc;
        block.slug = options.slug;

        block.getTextId = function () {
            return this.textIdFunc(this.mugType);
        };

        block.showAddFormButton = options.showAddFormButton;
        block.formList = block.getTextId().getFormNames();
        block.displayName = options.displayName || "";

        block.langs = formdesigner.model.Itext.getLanguages();

        // hack, so they adhere to the same api
        block.setValue = function (val) {
            // noop
        };

        block.getValue = function () {
            // noop
        };

        block.widgets = [];
        
        // this is a bit of a hack 
        block.elementPrefix = {
            constraint: "#bindElement-constraintMsgItextID",
            hint: "#controlElement-hintItextID",
            text: "#controlElement-labelItextID"
        }[block.slug];

        block.checkAutoIDIfNeeded = function() {
            var $idInput = $(block.elementPrefix),
                currentId = $.trim($idInput.val()),
                $autoIdCheckbox = $(block.elementPrefix + "-auto-itext"),
                anyWidgetHasValue = false,
                widgets = block.widgets;

            for (var widget, i = 0; widget = widgets[i]; i++) {
                if (widget.getValue()) {
                    anyWidgetHasValue = true;
                    break;
                }
            }

            if (anyWidgetHasValue && !currentId) {
                $autoIdCheckbox.prop('checked', true).change();
            } else if (!anyWidgetHasValue && currentId) {
                $autoIdCheckbox.prop('checked', false).change();
                $idInput.val('').change();
            }
        };

        return block;
    };

    that.iTextFieldBlock = function (mugType, options) {
        var block = that.baseITextFieldBlock(mugType, options);

        block.defaultContentTypes = ['long', 'short'];
        block.contentTypeIcons = _.extend({}, formdesigner.multimedia.ICONS);

        // needed for closure
        var textIdFunc = block.textIdFunc,
            slug = block.slug,
            $container = $('<div />'),
            multimediaTypes = _.clone(formdesigner.multimedia.SUPPORTED_MEDIA_TYPES);

        var addItextType = function (form, value) {
            if (block.formList.indexOf(form) != -1) {
                return;
            }
            block.formList.push(form);

            $('#' + formdesigner.util.getAddNewItextItemId(form)).addClass('disabled');

            $container.parent().find(".itext-language-section").each(function () {

                var lang, itextWidget, uiElem, itextForm;

                lang = $(this).data("language");

                itextWidget = (multimediaTypes.indexOf(form) >= 0) ?
                                that.iTextMediaWidget(mugType, lang, textIdFunc, slug, form, block, block.checkAutoIDIfNeeded) :
                                that.iTextRemovableWidget(mugType, lang, textIdFunc, slug, form, block, block.checkAutoIDIfNeeded);
                block.widgets.push(itextWidget);

                itextWidget.setValue(value);

                uiElem = itextWidget.getUIElement();
                uiElem.appendTo($(this));

                itextForm = itextWidget.getTextItem().getOrCreateForm(form);
                if (value) {
                    itextForm.setValue(lang, value);
                }
                itextWidget.fireChangeEvents();
            });
        };

        block.getDefaultValue = function (formType) {
            if (multimediaTypes.indexOf(formType) >= 0) {
                // default formats
                // image: jr://file/commcare/image/form_id/question_id.png
                // audio: jr://file/commcare/audio/form_id/question_id.mp3
                var extension = formdesigner.multimedia.DEFAULT_EXTENSIONS[formType];
                return "jr://file/commcare/" + formType + "/" +
                       formdesigner.controller.form.formID + "/" +
                       mugType.getDefaultItextRoot() + "." + extension;
            }
            return null;
        };

        block.getFilteredFormList = function () {
            return block.formList;
        };

        block.getUIElement = function () {
            var itextItem = block.getTextId(),
                formList = block.getFilteredFormList();

            if (formList) {
                for (var i = 0; i < this.langs.length; i++) {
                    var language = block.langs[i];

                    var subSec = $("<div />").addClass("itext-language-section well well-vellum").data("language", language);
                    $container.append(subSec);

                    // sub heading for language
                    $("<h3 />").text(language).appendTo(subSec);

                    // loop through items, add to UI
                    for (var j = 0; j < formList.length; j++) {
                        var formType = formList[j], itextWidget;

                        if (formType === 'default') {
                            itextWidget = that.iTextWidget(mugType, language, block.textIdFunc, block.slug, formType, block, block.checkAutoIDIfNeeded);
                        } else if (multimediaTypes.indexOf(formType) >= 0) {
                            itextWidget = that.iTextMediaWidget(mugType, language, block.textIdFunc, block.slug, formType, block, block.checkAutoIDIfNeeded);
                        } else {
                            itextWidget = that.iTextRemovableWidget(mugType, language, block.textIdFunc, block.slug, formType, block, block.checkAutoIDIfNeeded);
                        }
                        block.widgets.push(itextWidget);

                        itextWidget.setValue(itextItem.getValue(formType, language));
                        var uiElem = itextWidget.getUIElement();
                        uiElem.appendTo(subSec);
                    }
                }
            }

            if (this.showAddFormButton) {
                $container.append(block.getAddItextGroup("Add Multimedia", multimediaTypes));
                var $otherGroup = block.getAddItextGroup("Add Other", block.defaultContentTypes);

                var $customButton = $("<div />").text("custom...").button().addClass('btn');
	            $customButton.click(function () {
	                var dialog = $("#fd-dialog-confirm");
	                dialog.dialog("destroy");
	                dialog.empty();
	                $("<label />").attr("for", "new-itext-id").text("Content type: ").appendTo(dialog);
	                var input = $("<input />").addClass("fd-property-input").attr("id", "new-itext-id").appendTo(dialog);
	                dialog.dialog({
	                    title: "New Content Item Type",
	                    buttons: {
	                        "Add": function () {
	                            addItextType(input.val());
	                            $(this).dialog("close");
	                        },
	                        "Cancel": function () {
	                            $(this).dialog("close");
	                        }
	                    }
	               });
	            });

                $otherGroup.find('.btn-group').append($customButton);

                $container.append($otherGroup);
	        }

	        return $container;
        };

        block.getAddItextGroup = function (addText, contentTypes) {
            var $addItextBtn = $("<div />").addClass("itext-wrapper control-group"),
                $controls = $('<div class="controls" />');
            $("<label />").text(addText).addClass("control-label").appendTo($addItextBtn);

            var $btnGroup = block.getContentTypeButtons(contentTypes);
            $controls.append($btnGroup);
            $addItextBtn.append($controls);

            return $addItextBtn;
        };

        block.getContentTypeButtons = function (contentTypes) {
            var formList = block.getFilteredFormList();

            var $buttonGroup = $("<div />").addClass("btn-group itext-options");
            for (var i = 0; i < contentTypes.length; i++) {
                var contentType = contentTypes[i],
                    $btn = $('<div />');
                $btn.text(contentType)
                    .button()
                    .attr('id', formdesigner.util.getAddNewItextItemId(contentType))
                    .data('formtype', contentType)
                    .addClass('btn itext-option').click(
                    function () {
                        var form = $(this).data('formtype');
		                    addItextType(form, block.getDefaultValue(form));
                    }).appendTo($buttonGroup);

                var iconClass = block.contentTypeIcons[contentType];
                if (iconClass) {
                    $btn.prepend($('<i />').addClass(iconClass).after(" "));
                }

                if (formList.indexOf(contentType) != -1) {
                    $btn.addClass('disabled');
                }
            }
            return $buttonGroup;
        };

        return block;
    };

    that.iTextFieldBlockInline = function (mugType, options) {
        // an inline way of displaying itext blocks.
        // doesn't support adding fields
        // show's each langauge in the label

        var block = that.baseITextFieldBlock(mugType, options);
        var main = $("");

        var itextItem = block.getTextId();

        block.getUIElement = function () {
            for (var i = 0; i < this.langs.length; i++) {
                for (var j = 0; j < this.formList.length; j++) {
                    var itextWidget = that.iTextInlineWidget(mugType, this.langs[i], this.textIdFunc,
                                                             this.slug, this.formList[j], this.displayName, block.checkAutoIDIfNeeded);
                    block.widgets.push(itextWidget);
                    itextWidget.setValue(itextItem.getValue(this.formList[j], this.langs[i]));
                    main = main.add(itextWidget.getUIElement());
                }
            }

            return main;
        };

        return block;
    };

    /**
     * Hard coded function to map mugs to the types of things
     * that they display
     */
    that.getSectionListForMug = function (mugType) {

        sections = [];
        sections.push(that.getMainSection(mugType));
        if (mugType.hasControlElement()) {
            sections.push(that.getContentSection(mugType));
        }
        if (mugType.hasBindElement()) {
            sections.push(that.getLogicSection(mugType));
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

        if (that.unchangeableQuestionTypes.indexOf(mugType.typeSlug) === -1) {
            elements.splice(1, 0, {widgetType: "questionType", path: "system/questionType"});
        }
        if (formdesigner.util.isReadOnly(mugType)) {
            elements.push({widgetType: "readonlyControl", path: "system/readonlyControl"});
        }

        if (mugType.typeSlug == 'androidintent') {
            elements.push({widgetType: "androidIntentAppId", path: "system/androidIntentAppId"});
            elements.push({widgetType: "androidIntentExtra", path: "system/androidIntentExtra"});
            elements.push({widgetType: "androidIntentResponse", path: "system/androidIntentResponse"});
        }

        var deleteButton = $('<button class="btn btn-danger" id="fd-remove-button" tabindex="-1">'
            + '<i class="icon icon-white icon-trash"></i> Delete</button>'
        ).click(formdesigner.controller.removeCurrentQuestion);

        var duplicate = $('<button type="button" class="btn" tabindex="-1">'
            + '<i class="icon icon-copy"></i> Copy</button>'
        ).click(function () {
            formdesigner.controller.duplicateCurrentQuestion({itext: 'copy'});
        });
        
        var buttonGroups = [
            [duplicate],
            [deleteButton]
        ];

        var toolbar = $('<div class="btn-toolbar"></div>');

        for (var i = 0; i < buttonGroups.length; i++) {
            var buttons = buttonGroups[i],
                buttonGroup = $('<div class="btn-group"></div>');

            if (buttons[1] && $.isArray(buttons[1])) {
                var menuOptions = buttons[1];
                buttons[0].appendTo(buttonGroup);
                var dropdown = $('<ul class="dropdown-menu"></ul>');

                for (var j = 0; j < menuOptions.length; j++) {
                    menuOptions[j].appendTo(dropdown); 
                }
                dropdown.appendTo(buttonGroup);
            
            } else {
                for (var j = 0; j < buttons.length; j++) {
                    buttons[j].appendTo(buttonGroup);
                }
            }
            buttonGroup.appendTo(toolbar);
        }

        elements.push({
            widgetType: "html",
            lstring: "Question Actions",
            id: 'question-actions',
            html: toolbar
        });

        return that.genericSection(mugType, {
            slug: "main",
            displayName: "Main Properties",
            elements: elements
        });
    };

    that.getContentSection = function (mugType) {
        var showAddFormButton = (mugType.typeSlug !== 'group' && 
                                 mugType.typeSlug !== 'repeat' &&
                                 mugType.typeSlug !== 'fieldlist');
            
        elements = [{
                widgetType: "itext",
                slug: "text",
                displayMode: "full",
                textIdFunc: function (mt) { return mt.getItext() },
                showAddFormButton: showAddFormButton
            }
        ];

        return that.genericSection(mugType, {
            displayName: "Content",
            slug: "content",
            elements: elements
        });
    };

    that.getLogicSection = function (mugType) {
        var properties;

        if (mugType.typeSlug === 'datanode') {
            properties = [
                "bindElement/calculateAttr",
                "bindElement/relevantAttr",
            ];
        } else if (mugType.typeSlug === 'group' || 
                   mugType.typeSlug === 'repeat' ||
                   mugType.typeSlug === 'fieldlist')
        {
            properties = [
                "bindElement/requiredAttr",
                "bindElement/relevantAttr",
            ];
        } else {
            properties = [
                "bindElement/requiredAttr",
                "bindElement/relevantAttr",
                "bindElement/constraintAttr",
            ];

            // only show calculate condition for non-data nodes if it already
            // exists.  It's a highly discouraged use-case because the user will
            // think they can edit an input when they really can't, but we
            // shouldn't break existing forms doing this.
            if (mugType.mug.properties.bindElement.properties.calculateAttr) {
                properties.push("bindElement/calculateAttr");
            }
        }

        var elementPaths = filterByMugProperties(properties, mugType);

        var elements = elementPaths.map(wrapAsGeneric);
        if (elementPaths.indexOf("bindElement/constraintAttr") !== -1) {
            // only add the itext if the constraint was relevant
	        elements.push({ widgetType: "itext",
	                        displayMode: "inline",
	                        slug: "constraint",
	                        displayName: "Validation Error Message",
	                        textIdFunc: function (mt) { return mt.getConstraintMsgItext() },
	                        showAddFormButton: false});
        }

        if (mugType.typeSlug == 'repeat') {
            elements.push(wrapAsGeneric("controlElement/repeat_count"));
            elements.push(wrapAsGeneric("controlElement/no_add_remove"));
        }

        return that.accordionSection(mugType, {
                            slug: "logic",
                            displayName: "Logic Properties",
                            elements: elements,
                            active: 0});
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

        // only show non-itext constaint message input if it has a value
        if (mugType.hasBindElement() && mugType.mug.properties.bindElement.properties.constraintMsgAttr) {
            properties.push("bindElement/constraintMsgAttr");
        }

        var elementPaths = filterByMugProperties(properties, mugType),
            elements = elementPaths.map(wrapAsGeneric);

        if (elementPaths.indexOf("controlElement/hintItextID") !== -1) {
	        elements.push({ 
                widgetType: "itext",
                displayMode: "inline",
                slug: "hint",
                displayName: "Hint Message",
                textIdFunc: function (mt) { return mt.getHintItext() },
                showAddFormButton: false
            });
        }
        return that.accordionSection(mugType, {
                            slug: "advanced",
                            type: "accordion",
                            displayName: "Advanced Properties",
                            elements: elements});
    };

    return that;
}());

