define([
    'underscore',
    'jquery',
    'text!vellum/templates/button_remove.html',
    'tpl!vellum/templates/control_group',
    'vellum/widgets',
    'vellum/util',
    'vellum/javaRosa/itextWidget',
    'vellum/core'
], function (
    _,
    $,
    button_remove,
    control_group,
    widgets,
    util,
    itextWidget
) {
    var RESERVED_ITEXT_CONTENT_TYPES = _.union(
            util.SUPPORTED_MEDIA_TYPES, ['default', 'short', 'long']
        ),
        NO_MARKDOWN_MUGS = ['Choice', 'Group', 'FieldList', 'Repeat'];

    var baseItextBlock = function (mug, options) {
        var Itext = mug.form.vellum.data.javaRosa.Itext,
            block = {};
        util.eventuality(block);

        block.mug = mug;
        block.itextType = options.itextType;
        block.languages = Itext.getLanguages();
        block.defaultLang = Itext.getDefaultLanguage();
        block.forms = options.forms || ["default"];

        block.getItextItem = function () {
            return options.getItextByMug(block.mug);
        };

        block.setValue = function (val) {
            // none
        };

        block.getValue = function (val) {
            // none
        };

        var $messages = $("<div />").addClass("controls").addClass("messages"),
            $blockUI = $("<div />")
            .addClass('itext-block-container')
            .addClass("itext-block-" + block.itextType);

        block.getFormGroupClass = function (form) {
            return 'itext-block-' + block.itextType + '-group-' + form;
        };

        block.getFormGroupContainer = function (form) {
            return $("<div />")
                .addClass(block.getFormGroupClass(form))
                .addClass('itext-lang-group');
        };

        block.getForms = function () {
            return block.forms;
        };

        block.refreshMessages = function () {
            if (options.messagesPath) {
                var messages = widgets.util.getMessages(mug, options.messagesPath);
                $messages.empty().append(messages);
            }
        };

        mug.on("messages-changed",
               function () { block.refreshMessages(); }, null, "teardown-mug-properties");

        block.getUIElement = function () {
            _.each(block.getForms(), function (form) {
                var $formGroup = block.getFormGroupContainer(form);
                var langs_to_show = block.languages
                if(options.vellum.data.core.showOnlyCurrentLang) {
                    langs_to_show = _.uniq([
                    options.vellum.data.javaRosa.Itext.defaultLanguage,
                    options.vellum.data.core.currentItextDisplayLanguage])
                }
                _.each(langs_to_show, function(lang){
                    var itextWidget = block.itextWidget(block.mug, lang, form,
                                                        _.extend(options, {parent: $blockUI}));
                    itextWidget.init();
                    itextWidget.on("change", function () {
                        block.fire("change");
                    });
                    var $ui = itextWidget.getUIElement();
                    widgets.util.setWidget($ui, itextWidget);
                    $formGroup.append($ui);
                });
                $blockUI.append($formGroup);
            });
            $blockUI.append($messages);
            return $blockUI;
        };

        return block;
    };

    var itextLabelBlock = function (mug, options) {
        var block = baseItextBlock(mug, options);
        if ((!options.vellum.opts().features.markdown_in_groups &&
             _.contains(NO_MARKDOWN_MUGS, mug.__className)) || mug.form.noMarkdown) {
            block.itextWidget = itextWidget.label;
        } else {
            block.itextWidget = itextWidget.markdown;
        }
        return block;
    };

    var itextConfigurableBlock = function (mug, options) {
        var block = baseItextBlock(mug, options);

        block.isCustomAllowed = options.isCustomAllowed;
        block.activeForms = block.getItextItem().getFormNames();
        block.displayName = options.displayName;
        block.formToIcon = options.formToIcon || {};

        block.itextWidget = itextWidget.form;

        block.getForms = function () {
            var customForms = _.difference(block.activeForms, RESERVED_ITEXT_CONTENT_TYPES),
                relevantForms = _.intersection(block.activeForms, block.forms);
            return _.union(customForms, relevantForms);
        };

        var _getFormGroupContainer = block.getFormGroupContainer;
        block.getFormGroupContainer = function (form) {
            var $formGroup = _getFormGroupContainer(form);
            $formGroup.addClass("itext-lang-group-config")
                .addClass("well")
                .data('formtype', form);
            return $formGroup;
        };

        block.getAddFormButtonClass = function (form) {
            return 'itext-block-' + block.itextType + '-add-form-' + form;
        };

        block.getAddFormButtons = function () {
            var $buttonGroup = $("<div />").addClass("btn-group itext-options");
            _.each(block.forms, function (form) {
                var $btn = $('<div />');
                $btn.text(' ' + form)
                    .addClass(block.getAddFormButtonClass(form))
                    .addClass('btn btn-default itext-option').click(function () {
                        block.addItext(form);
                    });

                var iconClass = block.formToIcon[form];
                if (iconClass) {
                    $btn.prepend($('<i />').addClass(iconClass).after(" "));
                }

                if (block.activeForms.indexOf(form) !== -1) {
                    $btn.addClass('disabled');
                }
                $buttonGroup.append($btn);
            });

            if (block.isCustomAllowed) {
                $buttonGroup.append(block.getAddCustomItextButton());
            }
            return $buttonGroup;
        };

        block.getAddCustomItextButton = function () {
            var $customButton = $("<button />")
                    .text(gettext("custom..."))
                    .addClass('btn btn-default')
                    .attr('type', 'button'),
                newItextBtnClass = 'fd-new-itext-button';

            $customButton.click(function () {
                var $modal, $newItemForm, $newItemInput;
                $modal = mug.form.vellum.generateNewModal(gettext("New Content Type"), [
                    {
                        title: gettext("Add"),
                        cssClasses: newItextBtnClass + " disabled ",
                        attributes: {
                            disabled: "disabled"
                        }
                    }
                ]);

                $newItemForm = $(control_group({
                    label: gettext("Content Type")
                }));

                $newItemInput = $("<input />").attr("type", "text").addClass("form-control");
                $newItemInput.keyup(function () {
                    var currentValue = $(this).val(),
                        $addButton = mug.form.vellum.$f.find('.' + newItextBtnClass);
                    if (!currentValue || 
                        RESERVED_ITEXT_CONTENT_TYPES.indexOf(currentValue) !== -1 || 
                        block.activeForms.indexOf(currentValue) !== -1) 
                    {
                        $addButton
                            .addClass('disabled')
                            .removeClass('btn-primary')
                            .prop('disabled', true);
                    } else {
                        $addButton
                            .removeClass('disabled')
                            .addClass('btn-primary')
                            .prop('disabled', false);
                    }
                });

                $newItemForm.find('.controls').append($newItemInput);
                $modal
                    .find('.modal-body')
                    .append($newItemForm);
                mug.form.vellum.$f.find('.' + newItextBtnClass).click(function () {
                    var newItemType = $newItemInput.val();
                    if (newItemType) {
                        block.addItext($newItemInput.val());
                        $modal.modal('hide');
                    }
                });
                $modal.modal('show');
                $modal.one('shown.bs.modal', function () {
                    $newItemInput.focus();
                });
            });

            return $customButton;
        };

        block.deleteItextForm = function (form) {
            var itextItem = block.getItextItem();
            if (itextItem) {
                itextItem.removeForm(form);
            }
            block.activeForms = _.without(block.activeForms, form);
            block.fire("change");
        };

        block.getDeleteFormButton = function (form) {
            var $deleteButton = $(button_remove);
            $deleteButton.addClass('pull-right')
                .addClass("delete-" + block.getFormGroupClass(form))
                .click(function () {
                    var $formGroup = $('.' + block.getFormGroupClass(form));
                    block.deleteItextForm(form);
                    $formGroup.remove();
                    $(this).remove();
                    $('.' + block.getAddFormButtonClass(form))
                        .removeClass('disabled');
                });
            return $deleteButton;
        };

        block.addItext = function (form) {
            if (block.activeForms.indexOf(form) !== -1) {
                return;
            }
            block.activeForms.push(form);
            block.fire("change");

            $('.' + block.getAddFormButtonClass(form)).addClass('disabled');
            var $groupContainer = block.getFormGroupContainer(form);
            _.each(block.languages, function (lang) {
                var itextWidget = block.itextWidget(block.mug, lang, form, options);
                itextWidget.init(true);
                itextWidget.on("change", function () {
                    block.fire("change");
                });
                var $ui = itextWidget.getUIElement();
                widgets.util.setWidget($ui, itextWidget);
                $groupContainer.append($ui);
            });
            $blockUI.find('.new-itext-form-group').after($groupContainer);
            $groupContainer.find(".col-sm-9").removeClass("col-sm-9").addClass("col-sm-8");
            $groupContainer.before(block.getDeleteFormButton(form));
        };

        var $blockUI = $('<div />'),
            _getParentUIElement = block.getUIElement;
        block.getUIElement = function () {
            $blockUI = _getParentUIElement();

            var $addFormControls = $(control_group({
                label: block.displayName,
            }));
            $addFormControls.addClass('new-itext-form-group')
                .find('.controls')
                .append(block.getAddFormButtons());
            $blockUI.prepend($addFormControls);

            var $formGroup = $blockUI.find('.itext-lang-group');
            $formGroup.each(function () {
                $(this).find(".col-sm-9").removeClass("col-sm-9").addClass("col-sm-8");
                $(this).before(block.getDeleteFormButton($(this).data('formtype')));
            });

            return $blockUI;
        };

        return block;
    };

    var itextMediaBlock = function (mug, options) {
        var block = itextConfigurableBlock(mug, options),
            pathPrefix = options.pathPrefix;

        if(!_.isString(options.pathPrefix)) {
            pathPrefix = '/' + options.itextType;
        }

        block.getForms = function () {
            return _.intersection(block.activeForms, block.forms);
        };

        block.itextWidget = itextWidget.media(pathPrefix + mug.form.getBasePath());

        return block;
    };

    return {
        configurable: itextConfigurableBlock,
        label: itextLabelBlock,
        media: itextMediaBlock,
    };
});
