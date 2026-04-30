import _ from "underscore";
import $ from "jquery";
import util from "vellum/util";
import ui_element from "vellum/templates/ui_element.html";
import widget_control_message from "vellum/templates/widget_control_message.html";

export var base = function(mug, options) {
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

export var normal = function(mug, options) {
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

export var getUIElement = function($input, labelText, isDisabled, help) {
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

export function getMessages(mug, path) {
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
