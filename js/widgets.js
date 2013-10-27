// HTML escaping from https://github.com/janl/mustache.js/blob/master/mustache.js
var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
};
var reverseEntityMap = {};
_(entityMap).each(function (repl, c) {
    reverseEntityMap[repl] = c;
});
function escapeHtml(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
      return entityMap[s];
    });
}
function unescapeHtml(string) {
    return String(string).replace(/&(?:amp|lt|gt|quot|#39|#X2F);/g, function (s) {
        return reverseEntityMap[s];
    });
}
function valueToEditableContent(value) {
    if (!value) {
        // empty contenteditable on firefox has issues with drag and drop insertion
        // technique
        return jQuery.browser.mozilla ? "<br>" : "";
    }
    // since <p> without a closing tag is valid HTML and contenteditable
    // supports this, we can keep this pretty simple.
    // hack hack hack
    return "<p>" + escapeHtml(value).replace(/\n/g, "<p>");
}
function editableContentToValue(html) {
    // due to some browser idiosyncracies in contenteditable we do some
    // handling of different cases where <br>, <p>[</p>], and
    // <div>[</div>] may get inserted.  A little hacky but whatever.
    // We can't use content.text() because it doesn't preserve newlines
    // in any way.
    // get rid of non-breaking spaces that sometimes show up
    html = html.replace(/&nbsp;/g, " ");
    // strip <span> we use to insert dragged references
    html = html.replace(/<\/?span[^>]*>/g, "");
    // discard closing tags
    html = html.replace(/<\/(div|p)>/g, "");
    // discard beginning tag
    html = html.replace(/^<[^>]+?>/, "");
    // discard ending tag
    html = html.replace(/<\/[^>]+?>$/, "");
    // replace tags indicating newlines
    html = html.replace(/<(div|p|br\/?)[^>]*>/g, "\n").trim();
    // disallow multiple consecutive newlines - we get a bunch of
    // different combinations of different tags that trying to
    // specifically replace multiple newline-type tags in a row didn't
    // solve
    html = html.replace(/(\n\s*){1,}/g, "\n");
    // not HTML any more, eh? 
    return unescapeHtml(html);
}

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

    that.baseWidget = function(mug) {
        // set properties shared by all widgets
        var widget = {};
        // this shared method provides fake inheritance, assuming
        // it is called in a constructor on the object being constructed
        widget.mug = mug;

        widget.getDisplayName = function () {
            // use the display text, or the property name if none found
            return widget.definition.lstring ? widget.definition.lstring : widget.propName;
        };

        widget.getLabel = function () {
            var displayName = widget.getDisplayName();
            if (displayName) {
                return $("<label />")
                    .html(displayName)
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
        var widget = that.baseWidget(mug),
            path = options.path;
        widget.path = path;
        widget.definition = mug.getPropertyDefinition(path);
        widget.currentValue = mug.getPropertyValue(path);
        widget.groupName = that.getGroupName(widget.path);
        widget.propName = that.getPropertyName(widget.path);

        widget.getID = function () {
            return widget.path.split("/").join("-");
        };

        widget.save = function () {
            formdesigner.controller.setMugPropertyValue(widget.mug,
	                                                    widget.groupName,
                                                        widget.propName,
                                                        widget.getValue(),
                                                        widget.mug);
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

    that.droppableMultilineTextWidget = function (mug, options) {
        var widget = that.textWidget(mug, options);

        var content = $("<div contenteditable='true' />")
            .attr("id", widget.getID())
            .addClass('input-block-level')
            .css({
                '-moz-appearance': 'textfield',
                '-webkit-appearance': 'textfield',
            })
            .on('blur keyup paste copy cut mouseup', function () {
                widget.updateValue();
            });

        widget.getControl = function () {
            return content;
        };


        widget.setValue = function (value) {
            content.html(valueToEditableContent(value)).change();
        };

        widget.getValue = function () {
            return editableContentToValue(content.html());
        };

        widget.getControl().addClass('jstree-drop')
            .attr('data-placeholder', 'Hint: drag a question here.')
            .change(widget.updateValue);

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
        var widget = that.droppableMultilineTextWidget(mug, options);
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
                value:     widget.getValue()
            });
        });

        widget.getUIElement = function () {
            // gets the whole widget (label + control)
            var uiElem = $("<div />").addClass("widget control-group"),
                $controls = $('<div />').addClass('controls'),
                $label;
            $label = widget.getLabel();
            $label.addClass('control-label');
            uiElem.append($label)
                .append(xPathButton);
            $controls.append(widget.getControl())
                .css('margin-right', '60px');
            uiElem.append($controls);
            return uiElem;
        };
       
        var _save = widget.save;
        widget.save = function () {
            formdesigner.pluginManager.call("processXPathExpression",
                widget.getValue(), widget.mug, widget.definition);
            _save();
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
            var control = $("<p />").text(widget.currentValue);
            return control;
        };

        return widget;
    };

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
                $fieldsetContent,
                isEmpty = true;
            $fieldsetContent = $sec.find('.fd-fieldset-content');
            section.properties.map(function (prop) {
                var elemWidget = prop.widgetClass(section.mug, prop.options);
                elemWidget.setValue(elemWidget.currentValue);
                var uiElement = elemWidget.getUIElement();
                if (uiElement) {
                    $fieldsetContent.append(uiElement);
                    isEmpty = false;
                }
            });
            if (isEmpty) {
                return false;
            } else {
                return $sec;
            }
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
        var sections = [
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
                    link: "https://confluence.dimagi.com/display/commcarepublic/Form+Designer"
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
                    link: "https://confluence.dimagi.com/display/commcarepublic/Form+Designer"
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
                    link: "https://confluence.dimagi.com/display/commcarepublic/Form+Designer"
                }
            }
        ];

        var pluginSections = _.filter(
            _.flatten(formdesigner.pluginManager.call('getSections', mug)),
            _.identity);

        Array.prototype.splice.apply(sections, [2, 0].concat(pluginSections));
        return sections;
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

