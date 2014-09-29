define([
    'tpl!vellum/templates/widget_control_keyvalue',
    'underscore',
    'jquery'
], function (
    widget_control_keyvalue,
    _,
    $
) {
    var base = function(mug, options) {
        // set properties shared by all widgets
        var widget = {};
        // this shared method provides fake inheritance, assuming
        // it is called in a constructor on the object being constructed
        // ^^ what?
        widget.options = options;
        widget.mug = mug;
        widget.id = options.id;

        widget.isDisabled = function () {
            // requires widget.path to be set.  This only happens in
            // normal.  Need to change widgets that inherit directly from
            // base to use the path/property system.
            if (!widget.path) {
                return false;
            }

            return mug.form.vellum.isPropertyLocked(mug.getAbsolutePath(), 
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
        var path = options.path,
            inputID = 'property-' + path,
            disabled = options.disabled || false,
            widget = base(mug, options);

        widget.path = path;
        widget.definition = mug.p.getDefinition(path);
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
            // Why is this here?  Is it because the browser XML parser converts
            // escape codes to their values?  If so, this should be done where
            // it's called at parse time, not in the UI.
            if (value) {
                value = value.replace(
                    new RegExp(String.fromCharCode(10), 'g'), '&#10;');
            }
            input.val(value);
        };

        widget.getValue = function() {
            return input.val();
        };

        input.bind("change keyup", function () {
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

        var super_getValue = widget.getValue;
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
                    value: mug.p[options.path],
                    xpathType: widget.definition.xpathType,
                    done: function (val) {
                        if (val !== false) {
                            mug.p[widget.path] = val;
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
        xPath: xPath,
        baseKeyValue: baseKeyValue,
        readOnlyControl: readOnlyControl,
        util: {
            getUIElementWithEditButton: getUIElementWithEditButton,
            getUIElement: getUIElement
        }
    };
});

