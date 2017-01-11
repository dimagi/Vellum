define([
    'tpl!vellum/templates/ui_element',
    'tpl!vellum/templates/widget_control_keyvalue',
    'tpl!vellum/templates/widget_control_message',
    'underscore',
    'jquery',
    'vellum/atwho',
    'vellum/util',
    'vellum/richText',
    'vellum/analytics',
], function (
    ui_element,
    widget_control_keyvalue,
    widget_control_message,
    _,
    $,
    atwho,
    util,
    richTextUtils,
    analytics
) {
    var base = function(mug, options) {
        // set properties shared by all widgets
        var widget = {};
        options.richText = true;
        widget.options = options;
        widget.mug = mug;
        widget.id = options.id;
        util.eventuality(widget);

        widget.isDisabled = function () {
            // requires widget.path to be set.  This only happens in
            // normal.  Need to change widgets that inherit directly from
            // base to use the path/property system.
            if (!widget.path) {
                return false;
            }

            if (_.isFunction(mug.spec[widget.path].enabled)) {
                return !mug.spec[widget.path].enabled(mug);
            }

            return mug.form.vellum.isPropertyLocked(mug.hashtagPath,
                                                    widget.path);
        };

        widget.getDisplayName = function () {
            // use the display text, or the property name if none found
            return this.definition.lstring ? this.definition.lstring : this.path;
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

        widget.getHelp = function () {
            if (this.definition && this.definition.help) {
                return {
                    text: this.definition.help,
                    url: this.definition.helpURL
                };
            }
            return null;
        };

        widget.refreshMessages = function () {
            // placeholder to be overridden by widgets that inherit from base
        };

        widget.handleChange = function () {
            widget.updateValue();
            // TODO make all widgets that inherit from base set path
            if (widget.path) {
                // Widget change events, in addition to mug property
                // setters, trigger mug validation because some mug
                // property values have sub-properties that do not
                // trigger mug property change events when they are
                // changed. 
                mug.validate(widget.path);
            }
            widget.fire("change");
        };

        widget.updateValue = function () {
            // When a widget's value changes, do whatever work you need to in 
            // the model/UI to make sure we are in a consistent state.
            widget.save();
        };

        widget.save = function () {
            throw 'Not Implemented';
        };

        widget.getUIElement = function () {
            return getUIElement(widget.getControl(), widget.getDisplayName(),
                                !!widget.isDisabled(), widget.getHelp());
        };

        widget.addInstanceRef = function (attrs, property) {
            if (!property) {
                property = widget.path;
                if (!property) {
                    throw new Error("widget has no path: " + widget);
                }
            }
            return mug.form.addInstanceIfNotExists(attrs, mug, property);
        };

        return widget;
    };

    var normal = function(mug, options) {
        var path = options.widgetValuePath || options.path,
            inputID = options.id || 'property-' + path,
            disabled = options.disabled || false,
            widget = base(mug, options);

        widget.mugValue = options.mugValue || function (mug, value) {
            if (arguments.length === 1) {
                return mug.p[path];
            }
            mug.p[path] = value;
        };

        widget.path = path;
        widget.definition = mug.p.getDefinition(options.path);
        widget.currentValue = widget.mugValue(mug);
        widget.id = inputID;
        widget.saving = false;

        widget.input = $("<input />")
            .attr("name", inputID)
            .attr("id", inputID)
            .attr("placeholder", options.widgetPlaceholder)
            .prop('disabled', disabled);

        widget.getControl = function () {
            return widget.input; 
        };

        widget.getMessagesContainer = function () {
            return widget.getControl()
                    .closest(".widget")
                    .find(".messages:last");
        };

        widget.getMessages = function (mug, path) {
            return getMessages(mug, path);
        };

        widget.refreshMessages = function () {
            var messages = widget.getMessages(mug, path);
            var $container = widget.getMessagesContainer();
            $container.empty();
            if (messages.length) {
                $container.append(messages);
                $container.removeClass("hide");
            } else {
                $container.addClass("hide");
            }
        };

        mug.on("messages-changed",
               function () { widget.refreshMessages(); }, null, "teardown-mug-properties");

        widget.save = function () {
            widget.saving = true;
            try {
                widget.mugValue(mug, widget.getValue());
            } finally {
                widget.saving = false;
            }
        };

        return widget;
    };

    var text = function (mug, options) {
        var widget = normal(mug, options),
            input = widget.input;
        input.attr("type", "text").addClass('form-control');

        if (options.placeholder) {
            input.attr('placeholder', options.placeholder);
        }

        if (util.isRightToLeftLanguage(options.language)) {
            input.attr('dir', 'rtl');
        }

        widget.setValue = function (value) {
            if (value) {
                // <input> converts newlines to spaces; this preserves them
                value = value.replace(/\n/g, '&#10;');
            }

            var position = util.getCaretPosition(input[0]);
            var oldvalue = input.val();
            if (value && widget.hasLogicReferences) {
                input.val(mug.form.normalizeXPath(value));
            } else {
                input.val(value);
            }

            // If this input has focus and value hasn't changed much,
            // keep the cursor in the same position
            if (input.is(":focus") && oldvalue.length === value.length) {
                util.setCaretPosition(input[0], position, position);
            }
        };

        widget.getValue = function() {
            var ret = input.val().replace(/&#10;/g, '\n');

            if (ret && widget.hasLogicReferences) {
                // TODO should not be using hashtags when rich text is off
                return mug.form.normalizeHashtag(ret);
            } else {
                return ret;
            }
        };

        input.on("change input", function () {
            widget.handleChange();
        });
        return widget;
    };

    var multilineText = function (mug, options) {
        var widget = normal(mug, options);

        widget.input = $("<textarea></textarea>")
            .attr("name", widget.id)
            .attr("id", widget.id)
            .attr("placeholder", options.widgetPlaceholder)
            .attr("rows", "2")
            .addClass('form-control')
            .on('change input', function (e) { widget.handleChange(); })
            .keyup(function (e) {
                // workaround for webkit: http://stackoverflow.com/a/12114908
                if (e.which === 9) {
                    this.select();
                }
            });

        if (util.isRightToLeftLanguage(options.language)) {
            widget.input.attr('dir', 'rtl');
        }

        widget.getControl = function () { 
            return widget.input;
        };

        widget.setValue = function (val) {
            widget.input.val(val);
        };

        widget.getValue = function () {
            return widget.input.val();
        };

        return widget;
    };

    var richText = function(mug, options) {
        var widget = normal(mug, options);

        widget.input = $("<div />")
            .attr("contenteditable", true)
            .attr("name", widget.id)
            .addClass('form-control jstree-drop')
            .addClass(options.singleLine ? 'fd-input' : 'fd-textarea');

        var opts = {
                isExpression: options.widget === xPath || options.widget === droppableText,
                disableNativeSpellChecker: options.disableNativeSpellChecker,
                rtl: util.isRightToLeftLanguage(options.language),
                placeholder: options.widgetPlaceholder,
            },
            editor = richTextUtils.editor(widget.input, mug.form, opts);

        mug.on('teardown-mug-properties', editor.destroy, null, "teardown-mug-properties");
        editor.on('change', function () { widget.handleChange(); });

        widget.input.on('inserted.atwho', function(atwhoEvent, $li, browserEvent) {
            // gets rid of atwho wrapper
            // tod: find out why this is needed and move elsewhere
            $(this).find('.atwho-inserted').children().unwrap();
        });

        widget.getControl = function () {
            return widget.input;
        };

        widget.setValue = editor.setValue;
        widget.getValue = editor.getValue;

        return widget;
    };

    var richInput = function(mug, options) {
        if (mug.form.richText) {
            options.singleLine = true;
            return richText(mug, options);
        } else {
            return text(mug, options);
        }
    };

    var richTextarea = function(mug, options) {
        if (mug.form.richText) {
            options.singleLine = false;
            return richText(mug, options);
        } else {
            return multilineText(mug, options);
        }
    };

    var identifier = function (mug, options) {
        var widget = text(mug, options),
            super_updateValue = widget.updateValue;

        widget.updateValue = function () {
            var val = widget.getValue();

            if (val.indexOf(' ') !== -1) {
                // attempt to sanitize nodeID and choice values
                // TODO, still may allow some bad values
                widget.setValue(val.replace(/\s/g, '_'));
            }

            //short circuit the mug property changing process for when the
            //nodeID is changed to empty-string (i.e. when the user backspaces
            //the whole value).  This allows us to keep a reference to everything
            //and rename smoothly to the new value the user will ultimately enter.
            if (val === "") {
                return;
            }

            super_updateValue();
        };

        mug.on("property-changed", function (e) {
            if (e.property === "conflictedNodeId" && !widget.saving) {
                widget.setValue(widget.mugValue(mug));
            }
        }, null, "teardown-mug-properties");

        return widget;
    };

    var droppableText = function (mug, options) {
        var widget = richInput(mug, options);
        widget.input.addClass('jstree-drop')
            .attr('placeholder', 'Drag question here')
            .change(function () {
                widget.handleChange();
            });

        widget.hasLogicReferences = true;

        return widget;
    };

    var checkbox = function (mug, options) {
        var widget = normal(mug, options),
            input = widget.input;
        input.attr("type", "checkbox");

        widget.setValue = function (value) {
            input.prop("checked", value);
        };

        widget.getValue = function() {
            return input.prop("checked");
        };

        input.change(function () {
            widget.handleChange();
        });
        return widget;
    };

    var xPath = function (mug, options) {
        options.disableNativeSpellChecker = true;
        var widget = richInput(mug, options),
            super_getValue = widget.getValue,
            super_setValue = widget.setValue;

        widget.getValue = function() {
            return $.trim(super_getValue());
        };

        widget.getUIElement = function () {
            var control = widget.getControl(),
                elem = getUIElement(
                    control,
                    widget.getDisplayName(),
                    !!widget.isDisabled(),
                    widget.getHelp()
                ),
                autocompleteChoices;
            control.addClass('jstree-drop');
            if (options.autocompleteChoices) {
                autocompleteChoices = function () {
                    return options.autocompleteChoices(mug);
                };
            }
            return getUIElementWithEditButton(elem, function () {
                widget.options.displayXPathEditor({
                    leftPlaceholder: options.leftPlaceholder,
                    rightPlaceholder: options.rightPlaceholder,
                    leftAutocompleteChoices: autocompleteChoices,
                    value: super_getValue(),
                    xpathType: widget.definition.xpathType,
                    onLoad: function ($ui) {
                        setWidget($ui, widget);
                        $ui.find(".property-name").text(options.lstring || "Expression");
                    },
                    done: function (val) {
                        if (val !== false) {
                            super_setValue(val);
                            widget.handleChange();
                        }
                    },
                    mug: mug,
                });
                analytics.fbUsage('Logic', options.lstring);
            }, !!widget.isDisabled());
        };

        atwho.autocomplete(widget.input, mug, {
            property: options.path,
            useRichText: mug.form.richText,
        });

        widget.hasLogicReferences = true;

        return widget;
    };

    var baseKeyValue = function (mug, options) {
        // todo: make this inherit from normal
        var widget = base(mug, options),
            path = options.widgetValuePath || options.path,
            id = options.id || 'property-' + path;
        widget.definition = mug.p.getDefinition(options.path);
        options.richText = false;

        widget.mugValue = options.mugValue || function (mug, value) {
            if (arguments.length === 1) {
                return mug.p[path];
            }
            mug.p[path] = value;
        };

        widget.currentValue = widget.mugValue(mug);

        // todo make a style for this when vellum gets a facelift
        widget.kvInput = $('<div class="control-row" />').attr('name', id);

        widget.getControl = function () {
            if (widget.isDisabled()) {
                // todo
            }
            return widget.kvInput;
        };

        widget.setValue = function (value) {
            widget.kvInput.html(widget_control_keyvalue({
                pairs: _.clone(value)
            }));
            widget.kvInput.find('input').on('change keyup', function () {
                widget.handleChange();
            });
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

        function getValues() {
            var currentValues = {};
            _.each(widget.kvInput.find('.fd-kv-pair'), function (kvPair) {
                var $pair = $(kvPair),
                    key = $pair.find('.fd-kv-key').val(),
                    value = $pair.find('.fd-kv-val').val();
                if (currentValues.hasOwnProperty(key)) {
                    if (_.isArray(currentValues[key])) {
                        currentValues[key].push(value);
                    } else {
                        currentValues[key] = [currentValues[key], value];
                    }
                } else {
                    currentValues[key] = value;
                }
            });
            return currentValues;
        }

        widget.getValue = function() {
            return _.omit(getValues(), "");
        };

        widget.updateValue = function () {
            if (!getValues().hasOwnProperty("")) {
                widget.kvInput.find('.btn').removeClass('hide');
                widget.kvInput.find('.fd-kv-remove-pair').removeClass('hide');
            }
            widget.save();
        };

        widget.refreshControl = function () {
            widget.setValue(widget.getValue());
        };

        widget.save = function () {
            widget.saving = true;
            try {
                widget.mugValue(mug, widget.getValue());
            } finally {
                widget.saving = false;
            }
        };

        return widget;
    };

    var dropdown = function (mug, options) {
        var widget = normal(mug, options);
        widget.dropdown = widget.input = $("<select />")
            .attr("name", widget.id)
            .addClass('form-control');

        var input = widget.input;

        widget.setValue = function (value) {
            var val = widget.equivalentOption(value);
            if (val) {
                input.val(val.value);
            } else if (options.noCustom) {
                input.prop('selectedIndex', -1);
            } else {
                widget.addCustomIfNeeded(value);
                input.val(value);
            }
        };

        widget.getValue = function () {
            return input.val();
        };

        widget.updateValue = function () {
            widget.save();
        };

        input.change(function () {
            widget.handleChange();
        });

        widget.addOption = function (value, text) {
            var option = $('<option />')
                .attr('value', value)
                .text(text);
            this.dropdown.append(option);
        };

        widget.addOptions = function (options) {
            var _this = this;
            _.forEach(options, function(option) {
                _this.addOption(option.value, option.text);
            });
        };

        widget.clearOptions = function () {
            this.dropdown.empty();
        };

        widget.getOptions = function () {
            return _.map(widget.dropdown.find('option'), function(option) {
                return {
                    value: option.value,
                    text: option.text
                };
            });
        };

        widget.equivalentOption = function (val) {
            function parseValue (val) {
                try {
                    return JSON.parse(val);
                } catch(err) {
                    return  val;
                }
            }

            val = parseValue(val);
            return _.find(widget.getOptions(), function (option) {
                return _.isEqual(parseValue(option.value), val);
            });
        };

        widget.addCustomIfNeeded = function (value) {
            var customOption = $('[name=property-androidIntentAppId]')
                .find('option')
                .filter(function () { return $(this).text() === "Custom"; });
            if (customOption.length === 0) {
                widget.addOption(value, "Custom");
            } else {
                customOption.val(value);
            }
        };

        if (options.defaultOptions) {
            widget.addOptions(options.defaultOptions);
        }

        return widget;
    };

    var dropdownWithInput = function (mug, options) {
        var widget = dropdown(mug, options),
            super_handleChange = widget.handleChange;
        widget.input = widget.text = $('<input />')
            .addClass('form-control')
            .attr({
                type: 'text',
                name: widget.id + '-text',
            });

        var control = $('<div class="control-row row">')
                .append($("<div class='col-sm-4'>").append(widget.dropdown))
                .append($("<div class='col-sm-8'>").append(widget.text));

        widget.setValue = function (value) {
            var val = widget.equivalentOption(value);
            widget.addCustomIfNeeded(value);
            if (val) {
                widget.dropdown.val(val.value);
                widget.text.attr('readonly', true);
                widget.text.val(val.value);
            }  else {
                widget.dropdown.val(value);
                widget.text.attr('readonly', false);
                widget.text.val(value);
            }
        };

        widget.getValue = function () {
            return widget.text.val();
        };

        widget.getControl = function () {
            return control;
        };

        widget.dropdown.change(function () {
            var selectedOption = widget.dropdown.find(':selected');
            widget.text.attr('readonly', selectedOption.text() !== "Custom");
            widget.text.val(selectedOption.val());
            super_handleChange();
        });

        widget.text.change(function () {
            var selectedOption = widget.dropdown.find(':selected');
            widget.text.attr('readonly', false);
            selectedOption.val(widget.text.val());
            super_handleChange();
        });

        return widget;
    };

    var readOnlyControl = function (mug, options) {
        options.id = "readonly-control";
        var widget = base(mug, options);
        widget.definition = {};
        widget.currentValue = $('<div>').append(mug.p.rawControlXML).clone().html();

        widget.getControl = function () {
            var control = $("<p />").text(this.currentValue);
            return control;
        };

        return widget;
    };

    var abstractMediaWidget = function (mug, options) {
        var widget = normal(mug, options);
        widget.form = "text";

        widget.getValue = function() {
            return widget.input.val();
        };

        widget.setValue = function(val) {
            return widget.input.val(val);
        };

        /**
         * Get media path without file type extension
         *
         * Example: jr://file/commcare/text/name
         *
         * This is an abstract method; it must be overridden.
         */
        widget.getBaseMediaPath = function () {
            throw new Error("abstract method not implemented: " +
                            "widget.getBaseMediaPath()");
        };

        widget.mug.form.vellum.initMediaUploaderWidget(widget);
        return widget;
    };

    var getUIElementWithEditButton = function($uiElem, editFn, isDisabled) {
        var input = $uiElem.find('input');
        if (_.isUndefined(isDisabled)) {
            isDisabled = input ? input.prop('disabled') : false;
        }

        var button = $('<button />')
            .addClass("fd-edit-button")
            .html("<i class='fa fa-edit'></i>")
            .stopLink()
            .addClass('btn btn-default btn-block')
            .attr('type', 'button')
            .prop('disabled', isDisabled)
            .click(editFn),
            buttonContainer = $("<div />")
            .addClass("col-sm-1")
            .append(button);

        $uiElem.css('position', 'relative');
        $uiElem.find('.controls')
            .removeClass("col-sm-9").addClass("col-sm-8")
            .after(buttonContainer);
        return $uiElem;
    };
    
    var getUIElement = function($input, labelText, isDisabled, help) {
        var $uiElem = $(ui_element({
            labelText: labelText,
            help: help,
        }));
        $input.prop('disabled', !!isDisabled);
        $uiElem.find(".controls").prepend($input);

        if (help && !help.url) {
            $uiElem.find(".fd-help a").click(function (e) { e.preventDefault(); });
        }

        return $uiElem;
    };

    function getMessages(mug, path) {
        var $messages = $(),
            seen = {};
        mug.messages.each(path, function (msg) {
            if (seen.hasOwnProperty(msg.message)) { return; }
            seen[msg.message] = true;
            var html = $(widget_control_message({
                    msg: msg,
                    html: /\n/.test(msg.message) ?
                            util.markdown(msg.message) : ""
                }));
            html.find("button.close").click(function () {
                mug.dropMessage(path, msg.key);
            });
            $messages = $messages.add(html);
        });
        return $messages;
    }

    function getWidget(input, vellum) {
        var obj = input,
            widget;
        while (obj && obj.length) {
            widget = obj.data("vellum_widget");
            if (widget && (!vellum || vellum === obj.vellum("get"))) {
                return widget;
            }
            obj = obj.parent();
        }
        return null;
    }

    function setWidget($el, widget) {
        $el.data("vellum_widget", widget);
        return $el;
    }

    return {
        base: base,
        normal: normal,
        text: text,
        multilineText: multilineText,
        richTextarea: richTextarea,
        identifier: identifier,
        droppableText: droppableText,
        checkbox: checkbox,
        dropdown: dropdown,
        dropdownWithInput: dropdownWithInput,
        xPath: xPath,
        baseKeyValue: baseKeyValue,
        readOnlyControl: readOnlyControl,
        abstractMediaWidget: abstractMediaWidget,
        util: {
            getWidget: getWidget,
            setWidget: setWidget,
            getMessages: getMessages,
            getUIElementWithEditButton: getUIElementWithEditButton,
            getUIElement: getUIElement
        }
    };
});
