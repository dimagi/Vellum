define([
    'tpl!vellum/templates/widget_control_keyvalue',
    'tpl!vellum/templates/widget_control_message',
    'underscore',
    'jquery',
    'vellum/util'
], function (
    widget_control_keyvalue,
    widget_control_message,
    _,
    $,
    util
) {
    var base = function(mug, options) {
        // set properties shared by all widgets
        var widget = {};
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

            return mug.form.vellum.isPropertyLocked(mug.absolutePath,
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
                // changed. util.BoundPropertyMap is a possible
                // alternative, but has its own set of complexities
                // (binding event handlers to mug property values).
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

        return widget;
    };

    var normal = function(mug, options) {
        var path = options.widgetValuePath || options.path,
            inputID = 'property-' + path,
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

        widget.input = $("<input />")
            .attr("name", inputID)
            .prop('disabled', disabled);

        widget.getControl = function () {
            return widget.input; 
        };

        widget.getMessagesContainer = function () {
            return widget.getControl()
                    .closest(".widget.control-group")
                    .find(".messages:last");
        };

        widget.getMessages = function (mug, path) {
            return getMessages(mug, path);
        };

        widget.refreshMessages = function () {
            widget.getMessagesContainer()
                .empty()
                .append(widget.getMessages(mug, path));
        };

        mug.on("messages-changed",
               function () { widget.refreshMessages(); }, null, "teardown-mug-properties");

        widget.save = function () {
            widget.mugValue(mug, widget.getValue());
        };

        return widget;
    };

    var text = function (mug, options) {
        var widget = normal(mug, options),
            input = widget.input;
        input.attr("type", "text").addClass('input-block-level');

        widget.setValue = function (value) {
            if (value) {
                // <input> converts newlines to spaces; this preserves them
                value = value.replace(/\n/g, '&#10;');
            }

            var position = util.getCaretPosition(input[0]);
            var oldvalue = input.val();
            input.val(value);

            // If this input has focus and value hasn't changed much,
            // keep the cursor in the same position
            if (input.is(":focus") && oldvalue.length === value.length) {
                util.setCaretPosition(input[0], position, position);
            }
        };

        widget.getValue = function() {
            return input.val().replace(/&#10;/g, '\n');
        };

        input.bind("change input", function () {
            widget.handleChange();
        });
        return widget;
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
            if (e.property === "conflictedNodeId") {
                widget.setValue(widget.mugValue(mug));
            }
        }, null, "teardown-mug-properties");

        return widget;
    };

    var droppableText = function (mug, options) {
        var widget = text(mug, options);
        widget.input.addClass('jstree-drop')
            .attr('placeholder', 'Hint: drag a question here.')
            .change(function () {
                widget.handleChange();
            });

        return widget;
    };
    droppableText.hasLogicReferences = true;

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
        var widget = text(mug, options),
            super_getValue = widget.getValue,
            super_setValue = widget.setValue;
        widget.getValue = function() {
            var val = super_getValue();
            if ($.trim(val) === "") {
                return "";
            }
            return val;
        };

        widget.getUIElement = function () {
            var elem = getUIElement(
                widget.getControl(),
                widget.getDisplayName(),
                !!widget.isDisabled(),
                widget.getHelp()
            );
            return getUIElementWithEditButton(elem, function () {
                widget.options.displayXPathEditor({
                    value: super_getValue(),
                    xpathType: widget.definition.xpathType,
                    done: function (val) {
                        if (val !== false) {
                            super_setValue(val);
                            widget.handleChange();
                        }
                    }
                });
                if (typeof window.ga !== "undefined") {
                    window.ga('send', 'event', 'Form Builder', 'Logic', options.lstring);
                }
            }, !!widget.isDisabled());
        };

        return widget;
    };
    xPath.hasLogicReferences = true;

    var baseKeyValue = function (mug, options) {
        var widget = base(mug, options),
            id = options.id;
        widget.definition = {};

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
                pairs: value
            }));
            widget.kvInput.find('input').bind('change keyup', function () {
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
   
    var getUIElementWithEditButton = function($uiElem, editFn) {
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

        $uiElem.css('position', 'relative');
        $uiElem.find('.controls').not('.messages')
            .addClass('fd-edit-controls')
            .css('margin-right', '60px')
            .after(button);
        return $uiElem;
    };
    
    var getUIElement = function($input, labelText, isDisabled, help) {
        var uiElem = $("<div />").addClass("widget control-group"),
            $controls = $('<div class="controls" />'),
            $messages = $('<div class="controls messages" />'),
            $label = $("<label />").text(labelText);
        $label.addClass('control-label');
        if (help) {
            var $help = $("<a />").attr({
                "href": (help.url || "#"),
                "class": "fd-help",
                "target": "_blank",
                "data-title": labelText,
                "data-content": help.text
            });
            if (!help.url) {
                $help.click(function (e) { e.preventDefault(); });
            }
            $label.append($help);
        }
        uiElem.append($label);

        $input.prop('disabled', !!isDisabled);
        $controls.append($input);
        uiElem.append($controls);
        uiElem.append($messages);
        return uiElem;
    };

    function getMessages(mug, path) {
        var $messages = $();
        mug.messages.each(path, function (msg) {
            var html = $(widget_control_message({
                    msg: msg,
                    html: /\n/.test(msg.message) ?
                            util.markdownlite(msg.message) : ""
                }));
            html.find("button.close").click(function () {
                mug.dropMessage(path, msg.key);
            });
            $messages = $messages.add(html);
        });
        return $messages;
    }

    return {
        base: base,
        normal: normal,
        text: text,
        identifier: identifier,
        droppableText: droppableText,
        checkbox: checkbox,
        xPath: xPath,
        baseKeyValue: baseKeyValue,
        readOnlyControl: readOnlyControl,
        getMessages: getMessages,
        util: {
            getUIElementWithEditButton: getUIElementWithEditButton,
            getUIElement: getUIElement
        }
    };
});

