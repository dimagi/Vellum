import collapse_toggle from "vellum/templates/collapse_toggle.html";
import ui_element from "vellum/templates/ui_element.html";
import widget_chips_template from "vellum/templates/widget_chips.html";
import widget_control_keyvalue from "vellum/templates/widget_control_keyvalue.html";
import widget_control_message from "vellum/templates/widget_control_message.html";
import widget_repeater_card from "vellum/templates/widget_repeater_card.html";
import nested_xpath_field from "vellum/templates/nested_xpath_field.html";
import nested_dropdown_field from "vellum/templates/nested_dropdown_field.html";
import _ from "underscore";
import $ from "jquery";
import atwho from "vellum/atwho";
import util from "vellum/util";
import richTextUtils from "vellum/richText";
import nestedXPathField from "vellum/nestedXPathField";
import analytics from "vellum/hqAnalytics";

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

        return mug.form.vellum.isPropertyLocked(mug, widget.path);
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

    widget.postRender = function () {
        // placeholder to be overriden by widgets that inherit from base
        // intended to allow post render configuration, such as
        // enabling select2 functionality
    };

    widget.handleChange = function () {
        widget.updateValue();
        mug.showChangedMsg = true;
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
        value = encodeValueForInputElement(mug, value, widget.hasLogicReferences);
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
        return decodeValueFromInputElement(mug, input.val(), !!widget.hasLogicReferences);
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
        super_updateValue = widget.updateValue,
        super_handleChange = widget.handleChange;

    function updatePlaceholder() {
        // If the user doesn't provide an ID, we're going to
        // auto-generate it (eventually). Show the user what it will be.
        var proposedId = mug.form.vellum.nodeIDFromLabel(mug);
        widget.input.attr("placeholder", proposedId);
    }

    widget.updateValue = function () {
        var val = widget.getValue();

        if (val.indexOf(' ') !== -1) {
            // attempt to sanitize nodeID and choice values
            // TODO, still may allow some bad values
            widget.setValue(val.replace(/\s/g, '_'));
        }

        if (val === "") {
            updatePlaceholder();
        }

        super_updateValue();
    };

    widget._setURLHash = _.debounce(function(mug) {
        mug.form.vellum._setURLHash(mug);
    }, 500);

    widget.handleChange = function () {
        super_handleChange();
        widget._setURLHash(mug);
        if (!mug.p.nodeID) {
            // HACK drop errors; nodeID will be set automatically on save
            mug.dropMessage("nodeID", "mug-nodeID-error");
        }
    };

    mug.on("property-changed", function (e) {
        if (e.property === "conflictedNodeId" && !widget.saving) {
            widget.setValue(widget.mugValue(mug));
        }
    }, null, "teardown-mug-properties");

    mug.form.on('question-label-text-change', function (e) {
        if (!mug.p.nodeID) {
            updatePlaceholder();
        }
    }, null, null, widget);

    mug.on("teardown-mug-properties", function () {
        mug.form.unbind(widget);
    }, null, "teardown-mug-properties");

    return widget;
};

var droppableText = function (mug, options) {
    const placeholder = options.placeholder ? options.placeholder : gettext('Drag question here');

    const widget = richInput(mug, options);
    widget.input.addClass('jstree-drop')
        .attr('placeholder', placeholder)
        .change(function () {
            widget.handleChange();
        });

    widget.hasLogicReferences = true;

    return widget;
};
droppableText.trackLogicReferences = true;

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
            );
        control.addClass('jstree-drop');
        return getUIElementWithEditButton(elem, function () {
            openXPathEditor(mug, options, {
                getValue: super_getValue,
                setValue: super_setValue,
                onDone: widget.handleChange,
                xpathType: widget.definition.xpathType,
                onLoadExtra: function ($ui) { setWidget($ui, widget); },
            });
            analytics.fbUsage('Logic', options.lstring);
        }, !!widget.isDisabled());
    };

    enableAutocompleteOnInput(widget.input, mug, options);

    widget.hasLogicReferences = true;

    return widget;
};
xPath.trackLogicReferences = true;

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

var chips = function (mug, options) {
    var widget = base(mug, options);
    widget.definition = mug.p.getDefinition(options.path);
    widget.path = options.path;

    widget.getMessagesContainer = function () {
        return widget.getControl().closest(".widget").find(".messages:last");
    };

    widget.refreshMessages = function () {
        var messages = getMessages(mug, widget.path);
        var $container = widget.getMessagesContainer();
        $container.empty();
        if (messages.length) {
            $container.append(messages);
            $container.removeClass("hide");
        } else {
            $container.addClass("hide");
        }
    };

    mug.on("messages-changed", widget.refreshMessages, null, "teardown-mug-properties");
    var chipDefs = options.chips || [],
        exclusiveChips = options.exclusive || [],
        onSelect = options.onSelect || function () {},
        onDeselect = options.onDeselect || function () {},
        getState = options.getState || function () { return false; };

    var $el;

    var exclusiveSet = new Set(exclusiveChips);

    function render() {
        var data = _.map(chipDefs, function (def) {
            var isActive = getState(def.slug, mug),
                isDisabled = !isActive && exclusiveSet.has(def.slug) &&
                    exclusiveChips.some(function (s) {
                        return s !== def.slug && getState(s, mug);
                    });
            return { slug: def.slug, label: def.label,
                     active: isActive, disabled: isDisabled };
        });
        var $rendered = $(widget_chips_template({ chips: data }));

        $rendered.find('.fd-chip').on('click', function (e) {
            e.preventDefault();
            var $btn = $(this),
                slug = $btn.data('slug');
            if ($btn.hasClass('disabled')) return;

            var isActive = $btn.hasClass('btn-primary');
            if (isActive) {
                onDeselect(slug, mug);
            } else {
                if (exclusiveSet.has(slug)) {
                    exclusiveChips.forEach(function (s) {
                        if (s !== slug && getState(s, mug)) {
                            onDeselect(s, mug);
                        }
                    });
                }
                onSelect(slug, mug);
            }
            render();
            widget.handleChange();
        });

        if ($el) {
            $el.replaceWith($rendered);
        }
        $el = $rendered;
    }

    render();

    widget.getControl = function () { return $el; };
    widget.setValue = function () { render(); };
    widget.getValue = function () { return null; };
    widget.save = function () { /* noop - callbacks handle state */ };

    // Sync external state (e.g. section collapse) with chip state on init,
    // since external state may be stale (e.g. from localStorage).
    widget.postRender = function () {
        _.each(chipDefs, function (def) {
            if (getState(def.slug, mug)) {
                onSelect(def.slug, mug);
            } else {
                onDeselect(def.slug, mug);
            }
        });
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
        var customOption = widget.dropdown
            .find('option')
            .filter(function () { return $(this).text() === gettext("Custom"); });
        if (options.useValueAsCustomName) {
            widget.addOption(value, value);
        } else if (customOption.length === 0) {
            widget.addOption(value, gettext("Custom"));
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
        widget.text.attr('readonly', selectedOption.text() !== gettext("Custom"));
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

    if (isDisabled) {
        // Disable anything that can be disabled
        $input.find("*").addBack().prop('disabled', true);
        $input.filter('[contenteditable]').attr({
            'contenteditable': false,
            'disabled': true,
        });
    }

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
        const messageKey = mug.messages.getMessageText(msg.message);
        if (seen.hasOwnProperty(messageKey)) { return; }
        seen[messageKey] = true;
        let htmlMessage = "";
        if (msg.message.hasOwnProperty("markdown")) {
            htmlMessage = util.markdown(msg.message.markdown);
        } else if (/n/.test(msg.message)) {
            // html swallows newlines by default, so treat these messages as HTML to embed newline objects
            htmlMessage = util.markdown(msg.message);
        }

        const context = {msg: msg, html: htmlMessage};
        const html = $(widget_control_message(context));

        html.find("button.close").click(function () {
            mug.dropMessage(path, msg.key);
            if (msg.key === "mug-nodeID-changed-warning") {
                mug.showChangedMsg = false;
            }
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

function addCollapseToggle(slug, options) {
    var $section = $(".fd-question-fieldset[data-slug='" + slug + "']"),
        collapseId = 'fd-collapse-' + slug,
        $content = $section.find('.fd-fieldset-content');
    $section.find('legend').hide();
    $section.removeClass('hide');
    $content.attr('id', collapseId).addClass('collapse');
    $section.before(collapse_toggle($.extend({collapseId: collapseId}, options)));

    if (options.mug) {
        var expandIfMessages = function () {
            if ($content.find('.messages').children().length) {
                $content.collapse('show');
            }
        };
        options.mug.on("messages-changed", expandIfMessages, null, "teardown-mug-properties");
        expandIfMessages();
    }
}

function setWidget($el, widget) {
    $el.data("vellum_widget", widget);
    return $el;
}

function encodeValueForInputElement(mug, value, normalize) {
    if (value) {
        // <input> converts newlines to spaces; this preserves them
        value = value.replace(/\n/g, '&#10;');
    }
    if (value && normalize) {
        return mug.form.normalizeXPath(value);
    }
    return value;
}

// Reverse of encodeValueForInputElement
function decodeValueFromInputElement(mug, value, normalize) {
    var ret = value.replace(/&#10;/g, '\n');

    if (ret && normalize) {
        // TODO should not be using hashtags when rich text is off
        return mug.form.normalizeHashtag(ret);
    } else {
        return ret;
    }
}

function enableAutocompleteOnInput($input, mug, options) {
    atwho.autocomplete($input, mug, {
        property: options.path,
        useRichText: mug.form.richText,
    });
}

// -------------------------------------------------------------------------
// Repeater card widget — a compound-list property (as opposed to a scalar
// one). Renders a list of cards (one per record); each record has N fields
// declared by `cardConfig.fields`. Usage in a mug spec:
//
//     someListProp: {
//         lstring: gettext("Things"),
//         widget: widgets.repeaterCard,
//         cardConfig: {
//             rootClass: "fd-thing",
//             cardHeaderText: gettext("Thing"),
//             addLabel: gettext("Add thing"),
//             errorSummary: gettext("One or more things above have errors."),
//             requiresAtLeastOne: false,
//             emptyStateMessage: null,
//             fields: [
//                 {label: gettext("Name"), fieldClass: "fd-thing-name",
//                  isIdentifier: true, required: true},
//                 {label: gettext("Value"), fieldClass: "fd-thing-value",
//                  valueKey: "value", widget: "xpath"},
//                 ...
//             ],
//         },
//         ...
//     }
//
// -------------------------------------------------------------------------

function readFieldValue($el) {
    if (!$el.length) { return ""; }
    var wrapper = $el.data("editorWrapper");
    if (wrapper) { return wrapper.getValue(); }
    return $el.val();
}

function emptyRepeaterItem(cardConfig) {
    return _.reduce(cardConfig.fields, function (o, f) {
        if (f.valueKey) { o[f.valueKey] = ""; }
        return o;
    }, {});
}

var repeaterCard = function (mug, options) {
    var widget = normal(mug, options),
        id = options.id || 'property-' + options.path,
        cardConfig = options.cardConfig;
    options.richText = false;

    widget.input = $('<div class="control-row" />').attr('name', id);
    widget.hasLogicReferences = true;

    widget.getControl = function () {
        return widget.input;
    };

    // Read values straight from the DOM using `cardConfig.fields` — no
    // per-mug `getValue` override needed. Each card's key is the
    // `isIdentifier` field's value; each card's body is
    // {valueKey: fieldValue, ...}.
    widget.getValue = function () {
        var currentValues = {};
        widget.input.find('.' + cardConfig.rootClass).each(function () {
            var $card = $(this), key = null, entry = {};
            _.each(cardConfig.fields, function (f) {
                var val = readFieldValue($card.find('.' + f.fieldClass));
                if (f.isIdentifier) { key = val; }
                else if (f.valueKey) { entry[f.valueKey] = val; }
            });
            if (key !== null) { currentValues[key] = entry; }
        });
        return currentValues;
    };

    // Empty value → render no cards (just the Add button). Clicking Add
    // seeds a blank `""` entry via `addProperty`; widgets requiring at
    // least one card surface a reminder via their `validationFunc`.
    widget.refreshControl = function (value) {
        value = value ? value : widget.getValue();
        renderCards(value);
        wirePlainInputHandlers();
        wireXPathFields();
        widget.input.find('.fd-add-property').click(widget.addProperty);
        widget.input.find('.fd-remove-property').click(widget.removeProperty);

        function renderCards(val) {
            var resolvedCardConfig = _.extend({}, cardConfig, {
                fields: _.map(cardConfig.fields, function (f) {
                    if (_.isFunction(f.options)) {
                        return _.extend({}, f, {options: f.options(mug, options)});
                    }
                    return f;
                }),
            });
            widget.input.html(widget_repeater_card({
                props: val,
                cardConfig: resolvedCardConfig,
                useRichText: !!mug.form.richText,
                nested_xpath_field: nested_xpath_field,
                nested_dropdown_field: nested_dropdown_field,
            }));
        }

        function wirePlainInputHandlers() {
            widget.input.find('input, select').not('.fd-xpath-input')
                .on('change keyup', function () {
                    widget.handleChange();
                });
            widget.input.find('input[type="text"]').not('.fd-xpath-input')
                .addClass('jstree-drop')
                .each(function () { atwho.autocomplete($(this), mug); });
        }

        function wireXPathFields() {
            widget.input.find('.fd-xpath-input').each(function () {
                var $el = $(this),
                    $group = $el.closest('.fd-nested-xpath-field');
                nestedXPathField(mug, {
                    $el: $el,
                    $editButton: $group.find('.fd-xpath-edit'),
                    initialValue: $el.attr('data-initial-value') || '',
                    path: options.path,
                    displayXPathEditor: options.displayXPathEditor,
                }).on('change', function () {
                    widget.handleChange();
                });
            });
        }
    };

    widget.setValue = function (value) {
        value = _.isUndefined(value) ? {} : value;
        widget.refreshControl(value);
    };

    widget.updateValue = function () {
        widget.save();
    };

    widget.removeProperty = function (e) {
        e.preventDefault();
        $(this).closest('.fd-repeater-card').remove();
        widget.handleChange();
    };

    widget.addProperty = function (e) {
        e.preventDefault();
        var currentValues = widget.getValue();
        // If there's already a blank card, focus it instead of adding another.
        if (!("" in currentValues)) {
            currentValues[""] = emptyRepeaterItem(cardConfig);
            widget.refreshControl(currentValues);
            widget.handleChange();
        }
        widget.input.find('.fd-repeater-card').last()
            .find('input').first().focus();
    };

    return widget;
};
repeaterCard.trackLogicReferences = true;

/**
 * Open the expression-editor modal with the standard arg bundle. Shared
 * between `widgets.xPath` and the nested `nestedXPathField` so both stay in sync
 * on what the modal receives.
 *
 * @param {Mug} mug - Mug that owns the field being edited.
 * @param {Object} options - Widget options. Must include
 *     `displayXPathEditor` (the modal launcher). May include
 *     `leftPlaceholder`, `rightPlaceholder`, `autocompleteChoices`, and
 *     `lstring` (all forwarded to the modal).
 * @param {Object} context - Per-call glue supplied by the caller:
 *   @param {Function} context.getValue - Returns the current value to seed
 *       the modal with.
 *   @param {Function} context.setValue - Called with the user's committed
 *       value when the modal is dismissed with a save.
 *   @param {Function} context.onDone - Called after `setValue` so the
 *       caller can react (e.g. fire a change event, re-validate).
 *   @param {string} [context.xpathType] - Passed through to the modal to
 *       tell it which xpath grammar to expect.
 *   @param {Function} [context.onLoadExtra] - Optional hook invoked with
 *       the modal's jQuery root when it loads, for caller-specific setup
 *       (e.g. attaching the widget to the modal via `setWidget`).
 */
function openXPathEditor(mug, options, context) {
    var autocompleteChoices;
    if (options.autocompleteChoices) {
        autocompleteChoices = function () { return options.autocompleteChoices(mug); };
    }
    options.displayXPathEditor({
        leftPlaceholder: options.leftPlaceholder,
        rightPlaceholder: options.rightPlaceholder,
        leftAutocompleteChoices: autocompleteChoices,
        value: context.getValue(),
        xpathType: context.xpathType,
        onLoad: function ($ui) {
            if (context.onLoadExtra) { context.onLoadExtra($ui); }
            $ui.find(".property-name").text(options.lstring || "Expression");
        },
        done: function (val) {
            if (val !== false) {
                context.setValue(val);
                context.onDone();
            }
        },
        mug: mug,
    });
}

export default {
    base: base,
    normal: normal,
    text: text,
    multilineText: multilineText,
    richTextarea: richTextarea,
    identifier: identifier,
    droppableText: droppableText,
    checkbox: checkbox,
    chips: chips,
    dropdown: dropdown,
    dropdownWithInput: dropdownWithInput,
    xPath: xPath,
    repeaterCard: repeaterCard,
    baseKeyValue: baseKeyValue,
    readOnlyControl: readOnlyControl,
    abstractMediaWidget: abstractMediaWidget,
    util: {
        getWidget: getWidget,
        setWidget: setWidget,
        getMessages: getMessages,
        getUIElementWithEditButton: getUIElementWithEditButton,
        getUIElement: getUIElement,
        addCollapseToggle: addCollapseToggle,
        encodeValueForInputElement: encodeValueForInputElement,
        decodeValueFromInputElement: decodeValueFromInputElement,
        enableAutocompleteOnInput: enableAutocompleteOnInput,
        openXPathEditor: openXPathEditor
    }
};
