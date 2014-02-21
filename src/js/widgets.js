if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

formdesigner.widgets = (function () {
    var that = {};


    that.getGroupName = function (path) {
        return path.split("/")[0];
    };

    that.getPropertyName = function (path) {
        return path.split("/")[1];
    };

    that.baseWidget = function(mug, id) {
        // set properties shared by all widgets
        var widget = {};
        // this shared method provides fake inheritance, assuming
        // it is called in a constructor on the object being constructed
        widget.mug = mug;
        widget.id = id;

        widget.isDisabled = function () {
            // requires widget.path to be set.  This only happens in
            // normalWidget.  Need to change widgets that inherit directly from
            // baseWidget to use the path/property system.
            if (!widget.path) {
                return false;
            }
            var mugPath = formdesigner.controller.form.dataTree.getAbsolutePath(
                    widget.mug);

            return _.any(formdesigner.pluginManager.call('isPropertyLocked', 
                                mugPath, widget.path));
        };

        widget.getDisplayName = function () {
            // use the display text, or the property name if none found
            return this.definition.lstring ? this.definition.lstring : this.propName;
        };

        widget.getControl = function () {
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
            return getUIElement(widget.getControl(), widget.getDisplayName(),
                                !!widget.isDisabled());
        };

        return widget;
    };

    that.normalWidget = function(mug, options) {
        var path = options.path,
            inputID = path.split("/").join("-"),
            disabled = options.disabled || false,
            widget = that.baseWidget(mug, inputID);

        widget.path = path;
        widget.definition = mug.getPropertyDefinition(path);
        widget.currentValue = mug.getPropertyValue(path);
        widget.groupName = that.getGroupName(widget.path);
        widget.propName = that.getPropertyName(widget.path);

        widget.input = $("<input />")
            .attr("id", inputID)
            .prop('disabled', disabled);

        widget.getControl = function () {
            return widget.input; 
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
        var widget = that.normalWidget(mug, options),
            input = widget.input;
	    input.attr("type", "text").addClass('input-block-level');

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
        widget.input.addClass('jstree-drop')
            .attr('placeholder', 'Hint: drag a question here.')
            .change(widget.updateValue);

        return widget;
    };

    that.checkboxWidget = function (mug, options) {
        var widget = that.normalWidget(mug, options),
            input = widget.input;
        input.attr("type", "checkbox");

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

        widget.getUIElement = function () {
            var elem = getUIElement(
                widget.getControl(), widget.getDisplayName(), !!widget.isDisabled());
            return getUIElementWithEditButton(elem, function () {
                formdesigner.controller.displayXPathEditor({
                    value: mug.getPropertyValue(options.path),
                    xpathType: widget.definition.xpathType,
                    done: function (val) {
                        if (val !== false) {
                            formdesigner.controller.setMugPropertyValue(
                                mug, widget.groupName, widget.propName, val);
                        }
                    }
                });
            }, !!widget.isDisabled());
        };

        return widget;
    };

    that.androidIntentAppIdWidget = function (mug) {
        var widget = that.baseWidget(mug, "intent-app-id");

        widget.definition = {};
        widget.currentValue = (mug.intentTag) ? mug.intentTag.path: "";
        widget.propName = "Intent ID";
        
        var input = $("<input />").attr("id", widget.id).attr("type", "text").attr('placeholder', 'Insert Android Application ID');

        widget.getControl = function () {
            if (widget.isDisabled()) {
                input.prop('disabled', true);
            }
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

    that.baseKeyValueWidget = function (mug, id) {
        var widget = that.baseWidget(mug, id);
        widget.definition = {};

        // todo make a style for this when vellum gets a facelift
        widget.kvInput = $('<div class="control-row" />').attr('id', id);

        widget.getControl = function () {
            if (widget.isDisabled()) {
                // todo
            }
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
        var widget = that.baseKeyValueWidget(mug, "intent-extra");
        widget.currentValue = (mug.intentTag) ? mug.intentTag.extra : {};
        widget.propName = "Extra";

        widget.save = function () {
            if (widget.mug.intentTag) {
                widget.mug.intentTag.extra = widget.getValidValues();
                formdesigner.controller.setFormChanged();
            }
        };

        return widget;
    };

    that.androidIntentResponseWidget = function (mug) {
        var widget = that.baseKeyValueWidget(mug, "intent-response");
        widget.currentValue = (mug.intentTag) ? mug.intentTag.response : {};
        widget.propName = "Response";

        widget.save = function () {
            if (widget.mug.intentTag) {
                widget.mug.intentTag.response = widget.getValidValues();
                formdesigner.controller.setFormChanged();
            }
        };

        return widget;
    };
    
    that.readOnlyControlWidget = function (mug) {
        var widget = that.baseWidget(mug, "readonly-control");
        widget.definition = {};
        widget.currentValue = $('<div>').append(mug.controlElementRaw).clone().html();
        widget.propName = "Raw XML: ";

        widget.getControl = function () {
            var control = $("<p />").text(this.currentValue);
            return control;
        };

        return widget;
    };
    
    function getUIElementWithEditButton($uiElem, editFn) {
        var input = $uiElem.find('input'),
            isDisabled = input ? input.prop('disabled') : false;

        var button = $('<button />')
            .addClass("fd-edit-button pull-right")
            .text("Edit")
            .stopLink()
            .addClass('btn')
            .attr('type', 'button')
            .prop('disabled', isDisabled)
            .click(editFn);

        $uiElem.find('label').after(button);
        $uiElem.find('.controls').css('margin-right', '60px');
        return $uiElem;
    }
    
    function getUIElement($input, labelText) {
        var uiElem = $("<div />").addClass("widget control-group"),
            $controls = $('<div class="controls" />'),
            $label = getLabel(labelText, $input.attr('id'));
        $label.addClass('control-label');
        uiElem.append($label);

        $controls.append($input);
        uiElem.append($controls);
        return uiElem;
    }

    function getLabel(text, forId) {
        var $label = $("<label />")
            .text(text);
        if (forId) {
            $label.attr("for", forId);
        }
        return $label;
    }


    that.questionSection = function (mug, options) {
        var section = {};
        section.mug = mug;
        section.slug = options.slug || "anon";
        section.displayName = options.displayName;
        section.properties = options.properties;
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
            section.properties.map(function (prop) {
                var elemWidget = prop.widgetClass(section.mug, prop.options);
                elemWidget.setValue(elemWidget.currentValue);
                $fieldsetContent.append(elemWidget.getUIElement());
            });
            return $sec;
        };

        return section;
    };

    that.getToolbarForMug = function (mug) {
        var $baseToolbar = formdesigner.ui.getTemplateObject('#fd-template-question-toolbar', {
            isDeleteable: _.all(formdesigner.pluginManager.call('isMugRemoveable', 
                    formdesigner.controller.form.dataTree.getAbsolutePath(mug))) 
        });
        $baseToolbar.find('#fd-button-remove').click(formdesigner.controller.removeCurrentQuestion);
        $baseToolbar.find('#fd-button-copy').click(function () {
            formdesigner.controller.duplicateCurrentQuestion({itext: 'copy'});
        });
        $baseToolbar.find('.btn-toolbar.pull-left').prepend(this.getQuestionTypeChanger(mug));
        return $baseToolbar;
    };

    that.getQuestionTypeChanger = function (mug) {
        var getQuestionList = function (mug) {
            var questions = formdesigner.ui.QUESTIONS_IN_TOOLBAR;
            var ret = [];
            for (var i = 0; i < questions.length; i++) {
                var q = mugs[questions[i]];
                if (q.prototype.isTypeChangeable && mug.$class.prototype !== q.prototype) {
                    ret.push({
                        slug: questions[i],
                        name: q.prototype.typeName,
                        icon: q.prototype.icon
                    });
                }
            }
            return ret;
        };
        var changeable = formdesigner.pluginManager.call('isMugTypeChangeable', 
                    formdesigner.controller.form.dataTree.getAbsolutePath(mug));

        var $questionTypeChanger = formdesigner.ui.getTemplateObject('#fd-template-question-type-changer', {
            canChangeType: _.all(changeable) && mug.isTypeChangeable,
            currentQuestionIcon: mug.getIcon(),
            currentTypeName: mug.typeName,
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
        return [
            {
                slug: "main",
                displayName: "Basic",
                properties: that.getMainProperties(mug),
                help: {
                    title: "Basic",
                    text: "<p>The <strong>Question ID</strong> is a unique identifier for a question. " +
                        "It does not appear on the phone. It is the name of the question in data exports.</p>" +
                        "<p>The <strong>Label</strong> is text that appears in the application. " +
                        "This text will not appear in data exports.</p> " +
                        "<p>Click through for more info.</p>",
                    link: "https://confluence.dimagi.com/display/commcarepublic/Form+Builder"
                }
            },
            {
                slug: "logic",
                displayName: "Logic",
                properties: that.getLogicProperties(mug),
                help: {
                    title: "Logic",
                    text: "Use logic to control when questions are asked and what answers are valid. " +
                        "You can add logic to display a question based on a previous answer, to make " +
                        "the question required or ensure the answer is in a valid range.",
                    link: "https://confluence.dimagi.com/display/commcarepublic/Common+Logic+and+Calculations"
                }
            },
            {
                displayName: "Media",
                slug: "content",
                properties: that.getMediaProperties(mug),
                isCollapsed: false,
                help: {
                    title: "Media",
                    text: "This will allow you to add images, audio or video media to a question, or other custom content.",
                    link: "https://confluence.dimagi.com/display/commcarepublic/Multimedia+in+CommCare"
                }
            },
            {
                slug: "advanced",
                type: "accordion",
                displayName: "Advanced",
                properties: that.getAdvancedProperties(mug),
                isCollapsed: true,
                help: {
                    title: "Advanced",
                    text: "These are advanced settings and are not needed for most applications.  " +
                        "Please only change these if you have a specific need!",
                    link: "https://confluence.dimagi.com/display/commcarepublic/Application+Building"
                }
            }
        ];
    };

    that.getMainProperties = function (mug) {
        return formdesigner.pluginManager.call('contributeToMainProperties', [
            "dataElement/nodeID",
            "controlElement/defaultValue",
            "controlElement/label",
            "controlElement/readOnlyControl",
            "controlElement/androidIntentAppId",
            "controlElement/androidIntentExtra",
            "controlElement/androidIntentResponse"
        ]);
    };

    that.getMediaProperties = function (mug) {
        return [
            "controlElement/mediaItext"
        ];
    };

    that.getLogicProperties = function (mug) {
        return formdesigner.pluginManager.call('contributeToLogicProperties', [
            "bindElement/calculateAttr",
            "bindElement/requiredAttr",
            "bindElement/relevantAttr",
            "bindElement/constraintAttr",
            "controlElement/repeat_count",
            "controlElement/no_add_remove"
        ]);
    };

    that.getAdvancedProperties = function (mug) {
        return formdesigner.pluginManager.call('contributeToAdvancedProperties', [
            "dataElement/dataValue",
            "dataElement/xmlnsAttr",
            "controlElement/label",
            "controlElement/hintLabel",
            "bindElement/constraintMsgAttr",
        ]);
    };

    return that;
}());

