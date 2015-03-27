define([
    'tpl!vellum/templates/widget_control_keyvalue',
    'underscore',
    'jquery',
    'vellum/util'
], function (
    widget_control_keyvalue,
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

        widget.handleChange = function () {
            widget.updateValue();
            options.afterChange();
            widget.fire("change");
        };

        widget.updateValue = function () {
            // When a widget's value changes, do whatever work you need to in 
            // the model/UI to make sure we are in a consistent state.
            
            var isID = (['nodeID', 'defaultValue'].indexOf(widget.path) !== -1),
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
                                !!widget.isDisabled(), widget.getHelp());
        };

        return widget;
    };

    var normal = function(mug, options) {
        var path = options.widgetValuePath || options.path,
            inputID = 'property-' + path,
            disabled = options.disabled || false,
            widget = base(mug, options);

        widget.path = path;
        widget.definition = mug.p.getDefinition(options.path);
        widget.currentValue = mug.p[path];
        widget.id = inputID;

        widget.input = $("<input />")
            .attr("name", inputID)
            .prop('disabled', disabled);

        widget.getControl = function () {
            return widget.input; 
        };

        widget.save = function () {
            this.mug.p[this.path] = this.getValue();
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

    var droppableText = function (mug, options) {
        var widget = text(mug, options);
        widget.input.addClass('jstree-drop')
            .attr('placeholder', 'Hint: drag a question here.')
            .change(function () {
                widget.handleChange();
            });

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
        var widget = text(mug, options);

        var super_getValue = widget.getValue,
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

    var dropdown = function (mug, options) {
        var widget = normal(mug, options);
        widget.input = $("<select />")
            .attr("name", "property-" + widget.id);

        var input = widget.input;

        widget.setValue = function (value) {
            input.val(value);
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
            this.input.append(option);
        };

        widget.addOptions = function (options) {
            var _this = this;
            _.forEach(options, function(option) {
                _this.addOption(option.value, option.text);
            });
        };

        widget.getOptions = function () {
            return _.map(widget.input.find('option'), function(option) {
                return {
                    value: option.value,
                    text: option.text
                };
            });
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

    var textOrDropDown = function (mug, options, dropDownOptions, val) {
        var widget, useDropDown = false;

        if (val) { 
            useDropDown = _.some(dropDownOptions, function(option){
                return _.isEqual(option, val);
            });
        } else {
            useDropDown = true;
            dropDownOptions = [{
                value: '',
                text: 'No lookup table selected',
            }].concat(dropDownOptions);
        }

        if (useDropDown) {
            widget = dropdown(mug, options);
            widget.addOptions(dropDownOptions);
            widget.isDropdown = true;
            widget.setValue(val);
        } else {
            widget = text(mug, options);
        }

        return widget;
    };
    
    var getUIElementWithEditButton = function($uiElem, editFn, isDisabled) {
        var input = $uiElem.find('input');
        if (_.isUndefined(isDisabled)) {
            isDisabled = input ? input.prop('disabled') : false;
        }

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
    };
    
    var getUIElement = function($input, labelText, isDisabled, help) {
        var uiElem = $("<div />").addClass("widget control-group"),
            $controls = $('<div class="controls" />'),
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
        return uiElem;
    };


    return {
        base: base,
        normal: normal,
        text: text,
        droppableText: droppableText,
        checkbox: checkbox,
        dropdown: dropdown,
        xPath: xPath,
        textOrDropDown: textOrDropDown,
        baseKeyValue: baseKeyValue,
        readOnlyControl: readOnlyControl,
        util: {
            getUIElementWithEditButton: getUIElementWithEditButton,
            getUIElement: getUIElement
        }
    };
});

