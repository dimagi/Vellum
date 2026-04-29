/*
 * Nested XPath field — a lightweight cousin of `widgets.xPath` that mounts
 * onto a pre-existing DOM element (typically a contenteditable div inside a
 * card list).
 */
import $ from "jquery";
import richText from "vellum/richText";
import widgets from "vellum/widgets";

function nestedXPathField(mug, options) {
    options = options || {};
    options.disableNativeSpellChecker = true;
    var $el = options.$el,
        useRichText = !!mug.form.richText,
        super_getValue,
        super_setValue,
        fireChange,
        field = {hasLogicReferences: true};

    if (useRichText) {
        var editor = richText.editor($el, mug.form, {
            isExpression: true,
            disableNativeSpellChecker: options.disableNativeSpellChecker,
        });
        // Mirror widgets.richText: destroy the editor when the mug tears
        // down so orphaned editor instances don't accumulate across
        // cardList re-renders.
        mug.on('teardown-mug-properties', editor.destroy, null, 'teardown-mug-properties');
        super_getValue = editor.getValue;
        super_setValue = editor.setValue;
        field.on = function (event, fn) { editor.on(event, fn); return field; };
        // richText.setValue sets innerHTML directly, which does not fire an
        // `input` event. Dispatch one so `on('change')` subscribers see modal
        // commits the same way they see user typing.
        fireChange = function () {
            $el[0].dispatchEvent(new Event('input', {bubbles: true, cancelable: true}));
        };
    } else {
        // Normalization (newline encoding + normalizeXPath/normalizeHashtag)
        // is shared with `widgets.text`; see widgets.util.encodeValueForInputElement
        // and decodeValueFromInputElement.
        super_getValue = function () {
            return widgets.util.decodeValueFromInputElement(mug, $el.val(), true);
        };
        super_setValue = function (v) {
            $el.val(widgets.util.encodeValueForInputElement(mug, v, true));
        };
        field.on = function (event, fn) {
            $el.on(event === 'change' ? 'change keyup' : event, fn);
            return field;
        };
        fireChange = function () { $el.trigger('change'); };
    }

    field.getValue = function () { return $.trim(super_getValue()); };
    field.setValue = function (value) {
        super_setValue(value === null || value === undefined ? '' : value);
    };

    $el.addClass('jstree-drop');
    widgets.util.enableAutocompleteOnInput($el, mug, options);

    if (options.initialValue) {
        field.setValue(options.initialValue);
    }

    if (options.$editButton && options.$editButton.length && options.displayXPathEditor) {
        options.$editButton.click(function (e) {
            e.preventDefault();
            widgets.util.openXPathEditor(mug, options, {
                getValue: super_getValue,
                done: function (val) {
                    super_setValue(val);
                    fireChange();
                },
                xpathType: options.xpathType,
            });
        });
    }

    return field;
}
nestedXPathField.trackLogicReferences = true;

export default nestedXPathField;
