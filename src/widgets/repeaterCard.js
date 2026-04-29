import _ from "underscore";
import $ from "jquery";
import atwho from "vellum/atwho";
import nestedXPathField from "vellum/nestedXPathField";
import {normal} from "vellum/widgets/base";
import widget_repeater_card from "vellum/templates/widget_repeater_card.html";
import nested_xpath_field from "vellum/templates/nested_xpath_field.html";
import nested_dropdown_field from "vellum/templates/nested_dropdown_field.html";

// -------------------------------------------------------------------------
// Repeater card widget — a compound-list property (as opposed to a scalar
// one). Renders a list of cards (one per record); each record has N fields
// declared by `cardConfig.fieldSpecs`.

// cardConfig:
//   - fields: array of field specs (one row per field inside each card).
//   - rootClass: class added to each `.fd-repeater-card`.
//   - cardHeaderText: title shown in each card header.
//   - addLabel: label for the "add row" action.
//   - errorSummary (optional)
//   - requiresAtLeastOne (optional)
//   - emptyStateMessage (optional)
//
// cardConfig.fieldSpecs:
//   - label
//   - fieldClass: control CSS class (also used by widgets.js selectors)
//   - isIdentifier: when true, value comes from `cardIdentifier`
//   - valueKey: when set, value comes from `cardData[valueKey]`
//   - widget: "input" (default) | "xpath" | "dropdown"
//   - required (optional): default to false
//   - placeholder (optional)
//   - dropdownOptions (optional): dropdown options (array or resolver)
//   - extraValidator (optional)
// -------------------------------------------------------------------------

function readFieldValue($el) {
    if (!$el.length) { return ""; }
    var wrapper = $el.data("editorWrapper");
    if (wrapper) { return wrapper.getValue(); }
    return $el.val();
}

function validateField($field, mug, cardConfig) {
    var $fieldRow = $field.closest('.form-group'),
        $err = $fieldRow.find('.fd-field-error'),
        required = $field.attr('data-required') === 'true',
        widgetType = $field.attr('data-widget'),
        val = readFieldValue($field),
        touched = !!$field.data('touched'),
        error = null;

    if (required && !val && touched) {
        error = gettext("Required");
    } else if (widgetType === "xpath" && val) {
        try {
            mug.form.xpath.parse(val);
        } catch (e) {
            error = gettext("Invalid XPath expression");
        }
    }

    if (!error && cardConfig) {
        var fieldSpec = _.find(cardConfig.fieldSpecs, function (fieldSpec) {
            return $field.hasClass(fieldSpec.fieldClass);
        });
        if (fieldSpec && fieldSpec.extraValidator) {
            error = fieldSpec.extraValidator(val);
        }
    }

    if (error) {
        $fieldRow.addClass('has-error');
        $err.text(error).removeClass('hide');
    } else {
        $fieldRow.removeClass('has-error');
        $err.text('').addClass('hide');
    }
}

function emptyRepeaterItem(cardConfig) {
    return _.reduce(cardConfig.fieldSpecs, function (o, f) {
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

    widget.getValue = function () {
        var cardsValue = {};
        widget.input.find('.' + cardConfig.rootClass).each(function () {
            var $card = $(this),
                cardIdentifier = null,
                cardData = {};
            _.each(cardConfig.fieldSpecs, function (field) {
                var fieldValue = readFieldValue($card.find('.' + field.fieldClass));
                if (field.isIdentifier) { cardIdentifier = fieldValue; }
                else if (field.valueKey) { cardData[field.valueKey] = fieldValue; }
            });
            if (cardIdentifier !== null) {
                cardsValue[cardIdentifier] = cardData;
            }
        });
        return cardsValue;
    };

    // Refresh inline field validation when logic.js updates references on
    // external events (rename, delete). Without this the widget-level
    // summary fires but the inline "Unknown question: X" text goes stale.
    mug.on("messages-changed", function () {
        widget.input.find('.fd-repeater-card').each(function () {
            if (widget.validateCard) { widget.validateCard($(this)); }
        });
    }, null, "teardown-mug-properties");

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
        seedTouchedStateForSavedCards();
        widget.input.find('.fd-repeater-card').each(function () {
            widget.validateCard($(this));
        });

        function renderCards(val) {
            var resolvedCardConfig = _.extend({}, cardConfig, {
                fieldSpecs: _.map(cardConfig.fieldSpecs, function (fieldSpec) {
                    if (_.isFunction(fieldSpec.dropdownOptions)) {
                        return _.extend(
                            {},
                            fieldSpec,
                            {dropdownOptions: fieldSpec.dropdownOptions(mug, options)}
                        );
                    }
                    return fieldSpec;
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
                    $(this).data('touched', true);
                    widget.handleChange();
                    widget.validateCard($(this).closest('.fd-repeater-card'));
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
                    $el.data('touched', true);
                    widget.handleChange();
                    widget.validateCard($el.closest('.fd-repeater-card'));
                });
            });
        }

        // Cards loaded from saved data (key != "") are treated as "already
        // seen" — all their fields start touched so existing broken data
        // surfaces immediately.
        function seedTouchedStateForSavedCards() {
            widget.input.find('.fd-repeater-card').each(function () {
                var $card = $(this),
                    $name = $card.find('[data-is-identifier="true"]').first(),
                    cardHasName = !!readFieldValue($name);
                if (cardHasName) {
                    $card.find('[data-widget]').each(function () {
                        $(this).data('touched', true);
                    });
                }
            });
        }
    };

    widget.validateCard = function ($card) {
        $card.find('[data-widget]').each(function () {
            validateField($(this), mug, cardConfig);
        });
        widget.syncMugMessages();
        widget.refreshMessages();
    };

    widget.syncMugMessages = function () {
        var key = 'mug-' + options.path + '-error';
        if (widget.input.find('.has-error').length > 0) {
            mug.addMessage(options.path, {
                key: key,
                level: mug.ERROR,
                message: cardConfig.errorSummary,
            });
        } else {
            mug.dropMessage(options.path, key);
        }
    };

    var $saveButton = options.vellum.data.core.saveButton.ui,
        eventNamespace = '.fd-repeater-' + widget.id;
    $saveButton.on('show.bs.popover' + eventNamespace, function () {
        widget.input.find('[data-widget]').each(function () {
            $(this).data('touched', true);
        });
        widget.input.find('.fd-repeater-card').each(function () {
            widget.validateCard($(this));
        });
    });
    mug.on('teardown-mug-properties', function () {
        $saveButton.off(eventNamespace);
    }, null, 'teardown-mug-properties');

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
        widget.syncMugMessages();
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

export default repeaterCard;
