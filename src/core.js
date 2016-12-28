// the UI/ViewModel

define([
    'require',
    'save-button',
    'underscore',
    'jquery',
    'tpl!vellum/templates/main',
    'tpl!vellum/templates/question_type_group',
    'tpl!vellum/templates/edit_source',
    'tpl!vellum/templates/confirm_overwrite',
    'tpl!vellum/templates/control_group_stdInput',
    'tpl!vellum/templates/form_errors_template',
    'tpl!vellum/templates/question_fieldset',
    'tpl!vellum/templates/question_type_changer',
    'tpl!vellum/templates/question_toolbar',
    'tpl!vellum/templates/alert_global',
    'tpl!vellum/templates/modal_content',
    'tpl!vellum/templates/modal_button',
    'tpl!vellum/templates/find_usages',
    'tpl!vellum/templates/find_usages_search',
    'vellum/mugs',
    'vellum/widgets',
    'vellum/richText',
    'vellum/parser',
    'vellum/datasources',
    'vellum/util',
    'vellum/javaRosa/util',
    'vellum/analytics',
    'vellum/atwho',
    'vellum/debugutil',
    'vellum/base',
    'vellum/jstree-plugins',
    'less!vellum/less-style/main',
    'jquery.jstree',
    'jstree-actions',
    'jquery.bootstrap',
    'caretjs',
    'atjs'
], function (
    require,
    SaveButton,
    _,
    $,
    main_template,
    question_type_group,
    edit_source,
    confirm_overwrite,
    control_group_stdInput,
    form_errors_template,
    question_fieldset,
    question_type_changer,
    question_toolbar,
    alert_global,
    modal_content,
    modal_button,
    find_usages,
    find_usages_search,
    mugs,
    widgets,
    richText,
    parser,
    datasources,
    util,
    jrUtil,
    analytics,
    atwho,
    debug
) {
    
    // Load these modules in the background after all runtime dependencies have
    // been resolved, since they're not needed initially.
    setTimeout(function () {
        require([
            'codemirror',
            'codemirror/mode/xml/xml',
            'diff-match-patch',
            'CryptoJS',
            'vellum/expressionEditor',
        ], function () {});
    }, 0);

    var isMac = /Mac/.test(navigator.platform);

    var DEBUG_MODE = false;

    var MESSAGE_TYPES = {
        "error": {
            cssClass: "alert-danger",
            title: "Error",
            icon: "fa fa-exclamation-circle",
        },
        "parse-warning": {
            cssClass: "",
            title: "Warning",
            icon: "fa fa-warning",
        },
        "form-warning": {
            cssClass: "",
            title: "Form Warning",
            icon: "fa fa-info-circle",
        }
    };


    var getQuestionTypeGroupClass = function (slug) {
        return "fd-question-group-" + slug;
    };
    
    var convertButtonSpec = function (buttonSpec) {
        return {
            slug: buttonSpec[0],
            title: buttonSpec[1],
            icon: buttonSpec.length > 2 ? buttonSpec[2] : null
        };
    };
        
    var QuestionTypeGroup = function (groupData, vellum) {
        var defaultQuestion = convertButtonSpec(groupData.group),
            groupClass = getQuestionTypeGroupClass(defaultQuestion.slug);

        var $questionGroup = $(question_type_group({
            groupClass: groupClass,
            showDropdown: groupData.questions.length > 1,
            textOnly: groupData.textOnly,
            relatedQuestions: _.map(groupData.related || [], convertButtonSpec),
            defaultQuestion: defaultQuestion,
            questions: _.map(groupData.questions, convertButtonSpec)
        }));

        $questionGroup.find('.fd-question-type').click(function (event) {
            if (!$(this).hasClass('disabled')) {
                vellum.addQuestion($(this).data('qtype'));
            }
            event.preventDefault();
        });
        $questionGroup.find('.btn.fd-question-type > span').tooltip({
            title: function () {
                var qLabel = $(this).data('qlabel'),
                    $qType = $(this).parent();

                if($qType.hasClass('disabled')) {
                    qLabel = qLabel + " (add " + defaultQuestion.title + " first)";
                } else {
                    qLabel = "Add " + qLabel;
                }
                return qLabel;
            },
            placement: 'bottom'
        });
        return $questionGroup;
    };

    var fn = {};

    fn.init = function () {
        this.data.core.mugTypes = new mugs.MugTypesManager(
            this.getMugSpec(), this.getMugTypes(), this.opts());

        var _this = this,
            bindBeforeUnload = this.opts().core.bindBeforeUnload;
        this.data.core.saveButton = SaveButton.init({
            save: function(event) {
                var forceFullSave = event && event.altKey;
                if (forceFullSave &&
                    !window.confirm("Holding the ALT key while clicking save " +
                            "invokes an inefficient save procedure. Do " +
                            "this only if a normal save fails.")) {
                    return; // abort
                }
                _this.ensureCurrentMugIsSaved(function () {
                    analytics.workflow("Clicked Save in the form builder");
                    _this.validateAndSaveXForm(forceFullSave);
                });
            },
            unsavedMessage: 'Are you sure you want to exit? All unsaved changes will be lost!',
            csrftoken: _this.opts().csrftoken
        });

        bindBeforeUnload(this.data.core.saveButton.beforeunload);
        this.data.core.currentErrors = [];

        this.data.core.lastSavedXForm = this.opts().core.form;

        var ctrl = "Ctrl+",
            alt = "Alt+";
        if (isMac) {
            ctrl = "\u2318";
            alt = "\u2325";
        }
        this.$f.addClass('formdesigner');
        this.$f.empty().append(main_template({ctrl: ctrl, alt: alt}));
        $(document).on("keydown", function (e) {
            var ctrlKey = (isMac && e.metaKey) || (!isMac && e.ctrlKey),
                metaKey = (isMac && e.ctrlKey) || (!isMac && e.metaKey),
                key = (ctrlKey ? "Ctrl+" : "") +
                      (e.altKey ? "Alt+" : "") + 
                      (e.shiftKey ? "Shift+" : "") +
                      (metaKey ? "Meta+" : "") + e.keyCode;
            (hotkeys[key] || _.identity).call(_this, e);
        });

        $(document).on('click', '.jstree-hover', function(e) {
            e.preventDefault();
            _this.jstree("hover_node", $(this).data("ufid"));
            var $node = $(".jstree-hovered");
            if ($node.length) {
                var $scrollable = $node.closest(".fd-scrollable");
                $scrollable.scrollTop($node.position().top - $scrollable.position().top);
            }
            analytics.fbUsage("Clicked link to show in tree");
            analytics.workflow("Clicked on easy reference popover's link to show in tree");
        });

        $(document).on('mouseover', '.jstree-node', function(e) {
            $(e.currentTarget).find(".action_remove").addClass("hide")
            $(e.target).closest(".jstree-node").find(".action_remove").removeClass("hide");
        });
        $(document).on('mouseout', '.jstree-node', function(e) {
            $(e.currentTarget).find(".action_remove").addClass("hide")
        });

        this._init_toolbar();
        this._createJSTree();
        this.datasources = datasources.init(
            this.opts().core.dataSourcesEndpoint,
            this.opts().core.invalidCaseProperties
        );
    };

    fn.postInit = function () {
        var _this = this;
        function onReady () {
            // Allow onReady to access vellum instance (mostly for tests)
            _this.opts().core.onReady.apply(_this);
        }
        this._init_extra_tools();
        parser.init(this);
        this.loadXFormOrError(this.opts().core.form, function () {
            setTimeout(onReady, 0);
        });
    };

    var hotkeys = {
        "Ctrl+Alt+187" /* = */: function () {
            this.data.core.$tree.jstree("open_all");
        },
        "Ctrl+Alt+189" /* - */: function () {
            this.data.core.$tree.jstree("close_all");
        },
    };

    fn.getMugTypes = function () {
        return mugs.baseMugTypes;
    };
        
    fn._init_toolbar = function () {
        var _this = this,
            $questionGroupContainer = this.$f.find(
                '.fd-container-question-type-group');

        this.data.core.QUESTIONS_IN_TOOLBAR = [];
        this.data.core.QUESTION_TYPE_TO_GROUP = {};

        _.each(this._getQuestionGroups(), function (groupData) {
            var groupSlug = groupData.group[0];

            var getQuestionData = function (questionType) {
                var mugType = _this.data.core.mugTypes[questionType],
                    questionData = [
                        questionType, 
                        mugType.typeName, 
                        mugType.icon
                    ];

                _this.data.core.QUESTIONS_IN_TOOLBAR.push(questionType);
                _this.data.core.QUESTION_TYPE_TO_GROUP[questionType] = groupSlug;
                return questionData;
            };

            groupData.questions = _.map(groupData.questions, getQuestionData);
            if (groupData.related && groupData.related.length) {
                groupData.related = _.map(groupData.related, getQuestionData);
            }

            groupData.group[2] = groupData.group[2] || 
                _this.data.core.mugTypes[groupData.group[0]].icon;
            $questionGroupContainer.append(
                new QuestionTypeGroup(groupData, _this));
        });

        var $saveButtonContainer = this.$f.find('.fd-save-button');
        this.data.core.saveButton.ui.appendTo($saveButtonContainer);
    };

    fn._getQuestionGroups = function () {
        return [
            {
                group: ["Text", 'Text'],  // key in mugTypes, <title>
                questions: [
                    "Text",
                    "Trigger"
                ]
            },
            {
                group: ["Select", 'Multiple Choice'],
                related: [
                    "Choice"
                ],
                questions: this.getSelectQuestions()
            },
            {
                group: ["Int", 'Number'],
                questions: [
                    "Int",
                    "PhoneNumber",
                    "Double",
                ]
            },
            {
                group: ["Date", 'Date'],
                questions: [
                    "Date",
                    "Time",
                    "DateTime"
                ]
            },
            {
                group: ["DataBindOnly", 'Hidden Value'],
                questions: [
                    "DataBindOnly"
                ]
            },
            {
                group: ["Group", 'Groups'],
                questions: [
                    "Group",
                    "Repeat",
                    "FieldList"
                ]
            },
            {
                group: ["Image", 'Multimedia Capture'],
                questions: [
                    "Image",
                    "Audio",
                    "Video",
                    "Signature"
                ]
            },
            {
                group: ["Geopoint", 'Advanced', ''],
                textOnly: true,
                questions: this.getAdvancedQuestions()
            }
        ];
    };

    fn.getSelectQuestions = function () {
        return [
            "Select",
            "MSelect"
        ];
    };

    fn.getAdvancedQuestions = function () {
        return [
            "Geopoint",
            "Barcode",
            "Secret",
        ];
    };

    fn._init_extra_tools = function () {
        var _this = this,
            menuItems = this.getToolsMenuItems();

        var $toolsMenu = this.$f.find('.fd-tools-menu');
        $toolsMenu.empty();
        _(menuItems).each(function (menuItem) {
            var $a = $("<a tabindex='-1' href='#'><i class='" + menuItem.icon + "'></i> " + menuItem.name + "</a>").click(
                function (e) {
                    e.preventDefault();
                    _this.ensureCurrentMugIsSaved(function () {
                        analytics.fbUsage("Tools", menuItem.name);
                        menuItem.action(function () {
                            _this.refreshVisibleData();
                        });
                    });
                }
            );
            $("<li></li>").append($a).appendTo($toolsMenu);
        });

        this.$f.find('.fd-expand-all').click(function() {
            _this.data.core.$tree.jstree("open_all");
        });

        this.$f.find('.fd-collapse-all').click(function() {
            _this.data.core.$tree.jstree("close_all");
        });

        this.$f.find('.fd-button-copy').click(function () {
            analytics.usage("Copy Paste", "Copy Button");
            analytics.workflow("Clicked Copy Button in form builder");
            _this.ensureCurrentMugIsSaved(function () {
                _this.displayMultipleSelectionView();
                var selected = _this.jstree("get_selected");
                if (selected.length) {
                    $("#" + selected[0] + " a").focus();
                }
            });
        });

        // Section toggling events: within section changer and when clicking on section header
        this.$f.on('click', '.fd-section-changer a', function(e) {
            var slug = $(e.target).data("slug");
            $(".fd-question-fieldset[data-slug='" + slug + "'] .collapse-toggle").click();
        });
        this.$f.on('show.bs.collapse hide.bs.collapse', function(e) {
            var $target = $(e.target),
                slug = $target.closest("[data-slug]").data("slug"),
                shouldCollapse = $target.hasClass('in');
            $(".fd-section-changer [data-slug='" + slug + "']").toggleClass("selected");
            localStorage.setItem('collapse-' + slug, shouldCollapse ? "1" : "");
        });
    };

    fn.getToolsMenuItems = function () {
        var _this = this;
        return [
            {
                name: "Enter Full Screen",
                icon: "fa fa-expand",
                action: function (done) {
                    var $fullScreenMenuItem = $(_.find(_this.$f.find('.fd-tools-menu a'), function(a) {
                        return a.text.match(/full screen/i);
                    }));
                    var html = $fullScreenMenuItem.html();
                    analytics.fbUsage("Full Screen Mode", _this.opts().core.formid);
                    if (_this.data.windowManager.fullscreen) {
                        _this.data.windowManager.fullscreen = false;
                        $fullScreenMenuItem.html(html.replace(/Exit/, "Enter"));
                    } else {
                        _this.data.windowManager.fullscreen = true;
                        $fullScreenMenuItem.html(html.replace(/Enter/, "Exit"));
                    }
                    $fullScreenMenuItem.find("i").toggleClass("fa-compress").toggleClass("fa-expand");
                    _this.adjustToWindow();
                }
            },
            {
                name: "Export Form Contents",
                icon: "fa fa-file-excel-o",
                action: function (done) {
                    _this.showExportModal(done);
                }
            },
            {
                name: "Edit Source XML",
                icon: "fa fa-edit",
                action: function (done) {
                    _this.showSourceXMLModal(done);
                }
            },
            {
                name: "Form Properties",
                icon: "fa fa-list-alt",
                action: function (done) {
                    _this.showFormPropertiesModal(done);
                }
            },
            {
                name: "Find Usages",
                icon: "fa fa-search",
                action: function (done) {
                    _this.findUsages(done);
                }
            },
        ];
    };

    // should switch to use jstree languages plugin
    fn.refreshVisibleData = function () {
        // update any display values that are affected
        var _this = this;
        this.data.core.form.getMugList().map(function (mug) {
            _this.refreshMugName(mug);
        });

        this.refreshCurrentMug();
    };

    fn.refreshCurrentMug = function () {
        var curMug = this.getCurrentlySelectedMug();
        if (curMug) {
            this.displayMugProperties(curMug);
        }
    };

    fn.getMugDisplayName = function (mug) {
        var lang = this.data.core.currentItextDisplayLanguage ||
                   this.data.javaRosa.Itext.getDefaultLanguage(),
            val = mug.getDisplayName(lang, false);
        if (val && mug._core_cachedDisplayNameKey === val) {
            // avoid calling richText.bubbleOutputs ~5 times per display mug.
            // bubbleOutputs with many bubbles is slow
            return mug._core_cachedDisplayNameValue;
        }
        mug._core_cachedDisplayNameKey = val;
        if (mug.form.richText) {
            val = richText.bubbleOutputs(val, this.data.core.form, true);
        } else {
            val = jrUtil.outputToXPath(val, mug.form.xpath, true);
        }
        mug._core_cachedDisplayNameValue = val;
        return val;
    };

    fn.showSourceXMLModal = function (done) {
        var _this = this;

        function validateMug(mug) {
            mug.validate();
            return !mug.getErrors().length;
        }
        // todo: should this also show up for saving? Did it at some point in
        // the past?
        if (!_this.data.core.form.isFormValid(validateMug)) {
            var $modal = _this.generateNewModal("Error", [
                {
                    title: 'Continue',
                    cssClasses: "btn-default",
                    action: function() {
                        _this.closeModal(function() {
                            _this.showSourceInModal(done);
                        });
                    }
                },
                {
                    title: 'Abort',
                    cssClasses: "btn-primary",
                    action: function() {
                        _this.closeModal();
                    }
                }
            ], false, "fa fa-warning");
            var content = "There are validation errors in the form.  Do you want to continue anyway?";
            content += "<br><br>WARNING: The form will not be valid and likely not perform correctly on your device!";
            $modal.find(".modal-body").html(content);
            $modal.modal('show');
        } else {
            _this.showSourceInModal(done);
        }
    };

    fn._resizeFullScreenModal = function($modal) {
        var modalHeaderHeight, modalFooterHeight, modalHeight, modalBodyHeight;
        modalHeaderHeight = $modal.find('.modal-header').outerHeight(false);
        modalFooterHeight = $modal.find('.modal-footer').outerHeight(false);
        modalHeight = $(window).height() - 40;
        modalBodyHeight = modalHeight - (modalFooterHeight - modalHeaderHeight) - 126;
        $modal.find(".modal-body").css('height', modalBodyHeight + 'px');
    };

    fn.showSourceInModal = function (done) {
        var _this = this,
            $modal, $updateForm, $textarea, codeMirror;

        $modal = this.generateNewModal("Edit Form's Source XML", [
            {
                title: "Update Source",
                cssClasses: "btn-primary",
                action: function () {
                    codeMirror.save();
                    _this.loadXFormOrError($textarea.val(), function () {
                        $modal.modal('hide');
                        done();
                    }, true);
                }
            }
        ]);
        $updateForm = $(edit_source({
            description: "This is the raw XML. You can edit or paste into this box to make changes " +
                         "to your form. Press 'Update Source' to save changes, or 'Close' to cancel."
        }));

        $modal.addClass('fd-full-screen-modal')
            .find('.modal-body')
            .removeClass('form-horizontal').removeClass('form')
            .html($updateForm);
        this._resizeFullScreenModal($modal);

        $textarea = $updateForm.find('textarea');

        // populate text
        if(!this.data.core.formLoadingFailed){
            $textarea.val(this.createXML());
        } else {
            $textarea.val(this.data.core.failedLoadXML);
        }

        codeMirror = require('codemirror').fromTextArea($textarea.get(0), {
            mode: 'xml',
            lineNumbers: true,
            viewportMargin: Infinity,
        });

        $modal.modal('show');
        $modal.one('shown.bs.modal', function () {
            var $body = $modal.find(".modal-body"),
                bodyHeight = $body.height(),
                pHeight = $body.find("p").outerHeight(true);
            codeMirror.setSize('100%', bodyHeight - pHeight);
            codeMirror.refresh();
            codeMirror.focus();
        });
    };

    fn.showExportModal = function(done) {
        var $modal,
            $exportForm;

        $modal = this.generateNewModal("Export Form Contents", []);
        $exportForm = $(edit_source({
            description: "Copy and paste this content into a spreadsheet program like Excel " +
                         "to easily share your form with others."
        }));
        $modal.find('.modal-body').html($exportForm);

        // display current values
        var $text = $exportForm.find('textarea');
        $text.val(this.data.core.form.getExportTSV());
        $modal.modal('show');
        $modal.one('shown.bs.modal', function () { $text.focus(); });
    };

    fn.showOverwriteWarning = function(send, formText, serverForm) {
        var $modal, $overwriteForm, _this = this;

        $modal = _this.generateNewModal("Lost Work Warning", [
            {
                title: "Overwrite their work",
                cssClasses: "btn-primary",
                defaultButton: true,
                action: function () {
                    $('#form-differences').hide();
                    send(formText, 'full');
                    _this.closeModal();
                }
            },
            {
                title: "Show XML Differences",
                cssClasses: "btn-info",
                action: function () {
                    $('#form-differences').show();

                    $modal.addClass('fd-full-screen-modal')
                        .removeClass('form-horizontal')
                        .find('.modal-body')
                        .html($overwriteForm);
                    _this._resizeFullScreenModal($modal);

                    $modal.find('.btn-info').prop('disabled', true);
                }
            }
        ], "Cancel", "fa fa-warning");

        var diff = util.xmlDiff(formText, serverForm);

        $overwriteForm = $(confirm_overwrite({
            description: "Looks like someone else has edited this form " +
                         "since you loaded the page. Are you sure you want " +
                         "to overwrite their work?",
            xmldiff: util.escape(diff),
        }));
        $modal.find('.modal-body').html($overwriteForm);

        $('#form-differences').hide();
        $modal.modal('show');
    };

    fn.showFormPropertiesModal = function () {
        // moved over just for display purposes, apparently the original
        // wasn't working perfectly, so this is a todo
        var _this = this,
            $modal = this.generateNewModal("Edit Form Properties", []),
            $modalBody = $modal.find('.modal-body'),
            formProperties = [
                {
                    label: "Form Name",
                    slug: "formName"
                },
                {
                    label: "Disable Text Formatting",
                    slug: "noMarkdown",
                    type: "checkbox",
                    value: function(jq, val) {
                        return val ? jq.prop('checked', val) : jq.prop('checked');
                    }
                }
            ];

        if (this.opts().features.rich_text) {
            formProperties.push({
                label: "Use Easy References",
                slug: "richText",
                type: "checkbox",
                value: function(jq, val) {
                    return val ? jq.prop('checked', val) : jq.prop('checked');
                }
            });
        }

        _.each(formProperties, function (prop) {
            var $propertyInput = $(control_group_stdInput({
                label: prop.label,
                type: prop.type || 'text',
            }));
            $modalBody.append($propertyInput);
            $propertyInput.find('input')
                .val(_this.data.core.form[prop.slug])
                .on('change', function () {
                    var $this = $(this),
                        currentVal = $this.val();
                    if (prop.value) {
                        currentVal = prop.value($this);
                    }
                    _this.data.core.form.setAttr(prop.slug, currentVal);
                    _this.refreshVisibleData();
                });
            if (prop.value) {
                prop.value($propertyInput.find('input'), _this.data.core.form[prop.slug]);
            }
        });

        $modal.modal('show');
        $modal.one('shown.bs.modal', function () {
            $modalBody.find("input:first").focus().select();
        });
    };

    fn.findUsages = function () {
        var _this = this,
            $modal = this.generateNewModal("Use of each question", []),
            $modalBody = $modal.find('.modal-body'),
            form = _this.data.core.form,
            tableData = form.findUsages();

        $modal.addClass('fd-full-screen-modal');
        $modalBody.append($(find_usages_search()));
        $modalBody.append($(find_usages({tableData: tableData})));

        this._resizeFullScreenModal($modal);
        $modal.modal('show');

        $modalBody.find('.link-to-question').click(function() {
            var goToMug = $(this).text();
            $modal.modal('hide');
            _this.setCurrentMug(form.getMugByPath(goToMug));
            return false;
        });

        $modalBody.find('#findUsagesSearch').on('keypress inserted.atwho', _.debounce(function () {
            var searchKey = $.trim(this.value),
                filteredData = {};
            if (!searchKey) {
                filteredData = tableData;
            } else {
                _.each(tableData, function (refsToUsedMug, usedMugPath) {
                    if (usedMugPath.includes(searchKey)) {
                        filteredData[usedMugPath] = refsToUsedMug;
                        return;
                    }
                    _.each(refsToUsedMug, function (propName, usedInMugPath) {
                        if (usedInMugPath.includes(searchKey)) {
                            if (!filteredData[usedMugPath]) {
                                filteredData[usedMugPath] = {};
                            }
                            filteredData[usedMugPath][usedInMugPath] = propName;
                        }
                    });
                });
            }
            $modalBody.find('table').remove();
            $modalBody.append($(find_usages({tableData: filteredData})));
        }, 250));

        atwho.autocomplete($('#findUsagesSearch'), _this.getCurrentlySelectedMug(),{
            useRichText: true,
        });
    };

    fn.closeModal = function (done, immediate) {
        var _this = this,
            $modal = _this.$f.find('.fd-modal-generic-container .modal');
        if (done) {
            $modal.one('hidden.bs.modal', function() {
                done.apply(_this);
            });
        }
        if (immediate) {
            // skip animation
            $modal.removeClass('fade');
        }
        $modal.modal('hide');
    };
    
    fn.generateNewModal = function (title, buttons, closeButtonTitle, headerIcon) {
        if (typeof closeButtonTitle === "undefined") {
            closeButtonTitle = "Close";
        }
        buttons.reverse();
        buttons = _.map(buttons, function (button) {
            button.cssClasses = button.cssClasses || "";
            return button;
        });

        var _this = this,
            $modalContainer = _this.$f.find('.fd-modal-generic-container');

        // Close any existing modal - multiple modals is a bad state
        _this.closeModal(undefined, true);

        var $modal = $(modal_content({
                title: title,
                closeButtonTitle: closeButtonTitle,
                headerIcon: headerIcon,
            }));
        $modal.one("shown.bs.modal", function () {
            $modal.find(".btn-default:last").focus();
        });

        _.each(buttons, function (button) {
            button.defaultButton = button.defaultButton || false;
            button.action = button.action || function () {
                _this.closeModal();
            };
            $modal.find('.modal-footer').prepend(
                $(modal_button(button)).click(button.action));
        });
        $modalContainer.html($modal);
        return $modal;
    };

    var showPageSpinner = function() {
        var spinner = $("<div><div><div></div></div></div>");
        spinner.addClass("fd-form-saving");
        $('body').append(spinner);
    };

    var hidePageSpinner = function() {
        $(".fd-form-saving").remove();
    };

    fn.handleDropFinish = function(target, path, mug) {
        var _this = this,
            ops = target.closest(".xpath-expression-row").find(".op-select");

        if (target) {
            // the .change fires the validation controls
            if (widgets.util.getWidget(target, this).options.richText && _this.data.core.form.richText) {
                richText.editor(target).insertExpression(path);
            } else {
                target.val(target.val() + path).change();
            }

            var targetType,
                category = util.getReferenceName(path);
            switch (target[0].id) {
                case 'property-relevantAttr':
                    targetType = "Display";
                    break;
                case 'property-constraintAttr':
                    targetType = "Validation";
                    break;
                case 'property-calculateAttr':
                    targetType = "Calculation";
                    break;
                default:
                    targetType = "Expression Editor";
                    break;
            }
            analytics.usage(category, "Drag and Drop", targetType);
        }

        if (mug && ops && mug.options.defaultOperator) {
            ops.val(mug.options.defaultOperator);
        }
    };

    var typeData;
    // todo: jstree-related methods could be extracted out as a jstree wrapper
    // separate from the rest of the UI code.
    fn._createJSTree = function () {
        typeData = {
            "#": {
                valid_children: this.data.core.mugTypes.Group.validChildTypes
            },
            "default": {
                icon: 'fa fa-question-circle',
                max_children: 0,
                valid_children: []
            }
        };
        _(this.data.core.mugTypes.allTypes).each(function (type, typeName) {
            typeData[typeName] = {
                icon: type.icon,
                max_children: type.maxChildren,
                valid_children: type.validChildTypes
            };
        });

        var $tree, _this = this;
        this.data.core.$tree = $tree = this.$f.find('.fd-question-tree');
        $tree.jstree({
            "core": {
                data: [],
                worker: false,
                multiple: true,
                strings: {
                    'New node': this.opts().core.noTextString
                },
                check_callback: function(operation, node, parent, position, more) {
                    // operation can be 'create_node', 'rename_node', 'delete_node',
                    // 'move_node' or 'copy_node'. In case of 'rename_node'
                    // position is filled with the new node name
                    if (operation === "move_node") {
                        return _this.checkMove(node.id, node.type,
                                               parent.id, parent.type, position);
                    }
                    return true;  //allow all other operations
                }
            },
            "dnd" : {
                copy: false,
                inside_pos: "last"
            },
            "types": typeData,
            conditionalevents: {
                should_activate: function () {
                    return _this.ensureCurrentMugIsSaved();
                },
                redraw_node: function (obj) {
                    var args = Array.prototype.slice.call(arguments),
                        node = this.parent.redraw_node.apply(this.inst, args);
                    obj = this.inst.get_node(obj);
                    // decorate node with error indicator if present
                    if (node && obj.data && obj.data.errors) {
                        $(node).find('a > i').first().after(obj.data.errors);
                    }
                    return node;
                }
            },
            "plugins" : [ "themes", "types", "dnd", "conditionalevents", "actions" ]
            // We enable the "themes" plugin, but bundle the default theme CSS
            // (with base64-embedded images) in our CSS build.  The themes
            // plugin needs to stay enabled because it adds CSS selectors to
            // themeable items, which it would be hard to adapt the existing
            // selectors to if they didn't exist.
        }).on("select_node.jstree deselect_node.jstree", function (e, data) {
            var selected = _this.jstree('get_selected');
            if (!selected.length) {
                _this.hideQuestionProperties();
            } else if (selected.length < 2) {
                var mug = _this.data.core.form.getMugByUFID(selected[0]);
                _this.displayMugProperties(mug);
                _this.activateQuestionTypeGroup(mug);
            } else {
                _this.displayMultipleSelectionView();
            }
        }).on("open_node.jstree", function (e, data) {
            if (window.event && window.event.altKey) {
                _this.jstree("open_all", data.node);
            }
            var mug = _this.data.core.form.getMugByUFID(data.node.id);
            _this.activateQuestionTypeGroup(mug);
            _this.data.core.form.getDescendants(mug).map(function(descendant) {
                _this.refreshMugName(descendant);
            });
        }).on("close_node.jstree", function (e, data) {
            if (window.event && window.event.altKey) {
                _this.jstree("close_all", data.node);
            }
        }).on("move_node.jstree", function (e, data) {
            var form = _this.data.core.form,
                mug = form.getMugByUFID(data.node.id),
                refMug = data.parent !== "#" ? form.getMugByUFID(data.parent) : null,
                rel = _this.getRelativePosition(refMug, data.position);
            form.moveMug(mug, rel.position, rel.mug);
            data.node.icon = mug.getIcon();
            _this.refreshCurrentMug();
        }).on("deselect_all.jstree deselect_node.jstree", function (e, data) {
            _this.resetQuestionTypeGroups();
        }).on('model.jstree', function (e, data) {
            // Dynamically update node icons. This is unnecessary for
            // most nodes, but some (items in select questions) have a
            // different icon depending on their parent type.
            _(data.nodes).each(function (id) {
                var node = _this.jstree("get_node", id);
                if (node.data.mug) {
                    node.icon = node.data.mug.getIcon();
                }
            });
        });
        $tree.jstree(true).add_action("all", {
            "id": "action_remove",
            "class": "fa fa-trash-o action_remove",
            "after": true,
            "selector": "a",
            "event": "click",
            "callback": function (node_id, node, action_id, action_el) {
                _this.data.core.form.removeMugsFromForm([node.data.mug]);
            }
        });
    };

    /**
     * Setup handlers for drag/drop outside of tree
     *
     * NOTE this is done once when Vellum is loaded. These handlers must work
     * for multiple Vellum instances on the same page.
     */
    $(document).on("dnd_move.vakata.jstree", function (e, data) {
        var source = $(data.data.obj),
            target = $(data.event.target),
            inst = $.jstree.reference(target);
        if (!inst && target.vellum("get") === source.vellum("get")) {
            // only when not dragging inside the tree
            if (target.closest('.jstree-drop').length) {
                data.helper.find('.jstree-icon').removeClass('jstree-er').addClass('jstree-ok');
            } else {
                data.helper.find('.jstree-icon').removeClass('jstree-ok').addClass('jstree-er');
            }
        }
    }).on("dnd_stop.vakata.jstree", function (e, data) {
        var vellum = $(data.data.obj).vellum("get"),
            target = $(data.event.target),
            inst = $.jstree.reference(target);

        if (!inst && (target.closest('.jstree-drop').length) && vellum === target.vellum("get")) {
            if (data.data.origin) {
                var node = data.data.origin.get_node(data.data.nodes[0]);
                if (node.data && node.data.handleDrop) {
                    node.data.handleDrop(target.closest('.jstree-drop'));
                }
            }
        }
    });

    /**
     * Get relative position like "before", "after", "first", or "last"
     *
     * @param mug - The parent mug among whose children to position; null for
     *              root.
     * @param position - An integer or string position. If this is not a number
     *                   then the given mug and position are returned.
     * @returns An object `{mug: mug, position: string}`. The returned mug may
     *          differ from the original "parent" mug.
     */
    fn.getRelativePosition = function (mug, position) {
        if (!_.isNumber(position)) {
            return {mug: mug, position: position};
        }
        if (position === 0) {
            return {mug: mug, position: "first"};
        }
        var node = this.jstree("get_node", mug ? mug.ufid : "#");
        if (position > node.children.length) {
            return {mug: mug, position: "last"};
        }
        var child = this.jstree("get_node", node.children[position - 1]);
        return {mug: child.data.mug, position: "after"};
    };

    fn.checkMove = function (srcId, srcType, dstId, dstType, position) {
        var form = this.data.core.form,
            targetMug = form.getMugByUFID(dstId),
            sourceMug = form.getMugByUFID(srcId);
        if (!sourceMug) {
            return false;
        }
        if (position === 'inside') { position = 'into'; } // normalize for Vellum

        var locked = !this.isMugPathMoveable(sourceMug.hashtagPath);
        if (locked) {
            if (position === 'into' || position === 'last' || position === 'first') {
                return sourceMug.parentMug === targetMug;
            } else {
                return sourceMug.parentMug === targetMug.parentMug;
            }
        }

        return true;
    };

    fn.onFormChange = function (mug) {
        this.data.core.saveButton.fire("change");
        this.notifyUserActivity();
    };

    fn.notifyUserActivity = function() {
        var now = Date.now(),
            // default timeout: 5 minutes in ms
            activityTimeout = this.opts().core.activityTimeout || 5 * 60 * 1000,
            activityUrl = this.opts().core.activityUrl;
        if (activityUrl) {
            if (!this.data.core.activityTimestamp) {
                this.data.core.activityTimestamp = now;
            } else if (now - this.data.core.activityTimestamp >= activityTimeout) {
                this.data.core.activityTimestamp = now;
                if (_.isFunction(activityUrl)) {
                    activityUrl();
                } else {
                    $.get(activityUrl);
                }
            }
        }
    };

    fn.jstree = function () {
        var tree = this.data.core.$tree;
        return tree.jstree.apply(tree, arguments);
    };

    /**
     * Get currently selected mug or mugs
     *
     * This depends on the UI. Avoid using it unless there is no way to
     * get the mug from other context.
     *
     * @param multiple - If false (default) get the first selected mug;
     *      null if there is no selection. Otherwise get a (possibly
     *      empty) list of selected mugs.
     * @param treeOrder - If false (default) return mugs in the order they
     *      were selected. Otherwise return them in the order they appear
     *      in the tree. Ignored if `multiple` is false.
     * @returns - A list of mugs, single mug, or null, depending on
     *      parameters and the UI state.
     */
    fn.getCurrentlySelectedMug = function (multiple, treeOrder) {
        var selected = this.jstree('get_selected'),
            form = this.data.core.form;
        if (multiple) {
            if (treeOrder && selected.length > 1) {
                var ids = _.object(_.map(selected, function (id) {
                        return [id, true];
                    })),
                    count = selected.length,
                    mugs = [];
                form.tree.walk(function (mug, nodeID, processChildren) {
                    if (mug && ids.hasOwnProperty(mug.ufid)) {
                        mugs.push(mug);
                    }
                    if (mugs.length !== count) {
                        processChildren();
                    }
                });
                return mugs;
            }
            return _.map(selected, form.getMugByUFID.bind(form));
        }
        return selected.length ? form.getMugByUFID(selected[0]) : null;
    };

    fn.getCurrentMugInput = function (propPath) {
        // HACK tightly coupled to widgets
        // unfortunately the widget id is not easily accessible from here
        return this.$f.find("[name=property-" + propPath + "]");
    };

    fn.mugToXPathReference = function (mug) {
        // for choices, return the quoted value.
        // for everything else return the path
        if (mug.__className === "Choice") {
            return "'" + mug.p.nodeID + "'";
        } else {
            // for the currently selected mug, return a "."
            return (mug.ufid === this.getCurrentlySelectedMug().ufid) ? 
                "." : (mug.form.richText ? mug.hashtagPath : mug.absolutePath);
        }
        // Instead of depending on the UI state (currently selected mug), it
        // would probably be better to have this be handled by the widget using
        // its bound mug.
    };

    fn.activateQuestionTypeGroup = function (mug) {
        var className = mug.__className;
        this.resetQuestionTypeGroups();

        var groupSlug = this.data.core.QUESTION_TYPE_TO_GROUP[className];
        if (groupSlug && 
            className !== 'MSelectDynamic' && 
            className !== 'SelectDynamic' && 
            !this.jstree("is_closed", mug.ufid)) {
            this.$f
                .find('.' + getQuestionTypeGroupClass(groupSlug))
                .find('.fd-question-type-related').removeClass('disabled');
        }
    };

    fn.resetQuestionTypeGroups = function () {
        this.$f.find('.fd-container-question-type-group .fd-question-type-related')
            .addClass('disabled');
    };

    // Attempt to guard against doing actions when there are unsaved or invalid
    // pending changes.
    fn.ensureCurrentMugIsSaved = function (callback) {
        if (this.data.core.hasXPathEditorChanged) {
            this.alert(
                "Unsaved Changes in Editor",
                "You have UNSAVED changes in the Expression Editor. " +
                "Please save changes before continuing.");
            return false;
        } else {
            (callback || function () {})();
            return true;
        }
    };

    fn.loadXFormOrError = function (formString, done, updateSaveButton) {
        done = done || function () {};
        var _this = this;

        showPageSpinner();
        //wait for the spinner to come up.
        window.setTimeout(function () {
            //universal flag for indicating that there's something wrong enough
            //with the form that vellum can't deal.
            _this.data.core.formLoadingFailed = false;
            try {
                // a place for plugins to put parse warnings
                _this.data.core.parseWarnings = [];
                _this.loadXML(formString, {});
                delete _this.data.core.parseWarnings;
                _this.data.core.form.fire('form-load-finished');

                if (formString) {
                    //re-enable all buttons and inputs in case they were disabled before.
                    _this.showQuestionProperties();
                    if (updateSaveButton) {
                        _this.data.core.saveButton.fire('change');
                    }
                } else {
                    _this.$f.find('.fd-content-right .fd-column').addClass('hide');
                    _this.$f.find('.fd-default-panel').removeClass('hide');
                }
                $(".fd-tree .fd-head h2").text(_this.data.core.form.formName);
                hidePageSpinner();
            } catch (e) {
                window.console.log(util.formatExc(e));
                // hack: don't display the whole invalid XML block if it
                // was a parse error
                var msg = e.toString();
                if (msg.indexOf("Invalid XML") === 0) {
                    msg = "Parsing Error. Please check that your form is valid XML.";
                }

                _this.hideQuestionProperties();

                var $modal = _this.generateNewModal("Error", [], "OK", "fa fa-warning");
                $modal.find(".modal-body").text(msg);
                $modal.modal('show');

                _this.data.core.formLoadingFailed = true;
                _this.data.core.failedLoadXML = formString;

                hidePageSpinner();
                throw e;
            }
            done();
        }, this.opts().core.loadDelay);
    };

    fn.loadXML = function (formXML, options) {
        var form, _this = this;
        _this.data.core.$tree.children().children().each(function (i, el) {
            _this.jstree("delete_node", el);
        });
        options = _.extend({
            mugTypes: this.data.core.mugTypes,
            allowedDataNodeReferences: this.opts().core.allowedDataNodeReferences, 
            enableInstanceRefCounting: true
        }, options);
        if (this.data.core.form) {
            this.data.core.form.disconnectDataSources();
        }
        this.data.core.form = form = parser.parseXForm(
            formXML, options, this, _this.data.core.parseWarnings);
        if (formXML) {
            _this._resetMessages(_this.data.core.form.errors);
            _this._populateTree();
        }

        form.on('question-type-change', function (e) {
            _this.jstree("set_type", e.mug.ufid, e.qType);

            if (e.mug === _this.getCurrentlySelectedMug()) {
                _this.refreshCurrentMug();
                _this.activateQuestionTypeGroup(e.mug);
            }
        }).on('parent-question-type-change', function (e) {
            _this.jstree("set_icon", e.childMug.ufid, e.childMug.getIcon());
        }).on('question-remove', function (e) {
            if (e.mug) {
                e.mug.unbind(_this.data.core);
                if (e.mug === _this._propertiesMug) {
                    // prevent e.mug.validate() on deleted mug
                    _this._propertiesMug.teardownProperties();
                    _this._propertiesMug = null;
                }
            }
            var currentMug = _this.getCurrentlySelectedMug();
            if (e.mug && e.mug.parentMug && e.mug.parentMug === currentMug) {
                _this.displayMugProperties(currentMug);
            }
            if (!e.isInternal) {
                var prev = _this.jstree("get_prev_dom", e.mug.ufid);
                _this.jstree("delete_node", e.mug.ufid);
                if (prev) {
                    _this.jstree("select_node", prev);
                } else {
                    _this.selectSomethingOrHideProperties();
                }
            }
            // HACK: need to explicitly remove the control node so that
            // getNodeFromMug doesn't return a node that no longer exists
            e.mug._node_control = undefined;

            $('.fd-undo').click(function () {
                _this.ensureCurrentMugIsSaved(form.undo.bind(form));
            });
            $('.fd-undo-container').on('click', '.close', function() {
                form.undomanager.resetUndo();
            });
        }).on('question-create', function (e) {
            _this.handleNewMug(e.mug, e.refMug, e.position);
            var currentMug = _this.getCurrentlySelectedMug();
            if (e.mug && e.mug.parentMug && e.mug.parentMug === currentMug) {
                _this.displayMugProperties(currentMug);
            }
            if (!e.isInternal) {
                _this.setCurrentMug(e.mug);
            }
        }).on('change', function (e) {
            _this.onFormChange(e.mug);
        }).on('question-label-text-change', function (e) {
            _this.refreshMugName(e.mug);
            _this.toggleConstraintItext(e.mug);
        }).on('change-display-language', function (e) {
            var mug = _this.getCurrentlySelectedMug();
            if (mug) {
                _this.refreshMugName(mug);
            }
        }).on('mug-property-change', function (e) {
            _this.refreshMugName(e.mug);
            _this.toggleConstraintItext(e.mug);
        });
    };

    fn.refreshMugName = function (mug) {
        var name = this.getMugDisplayName(mug);
        if (name !== this.jstree("get_text", mug.ufid)) {
            this.jstree('rename_node', mug.ufid, name);
        }
        var currentMug = this.getCurrentlySelectedMug();
        if (currentMug && mug.ufid === currentMug.ufid) {
            this.$f.find(".fd-question-properties .fd-head h2").html(name);
        }
    };

    fn.toggleConstraintItext = function (mug) {
        // todo: don't handle this one-off in the UI layer
        var current = this.getCurrentlySelectedMug();
        if (current && current.ufid !== mug.ufid) {
	         return;
        }
        var state = (mug.p.constraintMsgItext &&
                     (!mug.p.constraintMsgItext.isEmpty() ||
                      mug.p.constraintAttr)),
            $constraintItext = $('.itext-block-constraintMsg');
        
        if (state) {
            $constraintItext.removeClass('hide');
        } else {
            $constraintItext.addClass('hide');
        }
    };

    fn._populateTree = function () {
        // NOTE: this performs the final step in the mug parsing process.
        // It should only be called once after a new XForm is loaded.
        var _this = this,
            form = this.data.core.form;

        form.walkMugs(function (mug) {
            _this.handleMugParseFinish(mug);
            var inTree = _this.createQuestion(mug, mug.parentMug, 'into');
            if (inTree) {
                var changed = mug.validate();
                if (!changed && mug.getErrors().length) {
                    _this.setTreeValidationIcon(mug);
                }
            }
        });
        this.selectSomethingOrHideProperties(true);
    };

    fn.selectSomethingOrHideProperties = function (forceDeselect) {
        if (forceDeselect) {
            this.jstree('deselect_all');
        }
        // ensure something is selected if possible
        if (!this.jstree('get_selected').length) {
            // if there's any nodes in the tree, just select the first
            var all_nodes = this.data.core.$tree.find("li");
            if (all_nodes.length > 0) {
                this.jstree('select_node', all_nodes[0]);
                return true;
            } else {
                // otherwise clear the Question Edit UI pane
                this.jstree('deselect_all');
                this.hideQuestionProperties();
                this.$f.find('.fd-content-right .fd-column').addClass('hide');
                this.$f.find('.fd-default-panel').removeClass('hide');
                return false;
            }
        }

        return true;
    };
        
    fn.addQuestion = function (qType) {
        var _this = this,
            mug;
        this.ensureCurrentMugIsSaved(function () {
            var foo = _this.getInsertTargetAndPosition(
                _this.getCurrentlySelectedMug(), qType);
            if (!foo) {
                throw new Error("cannot add " + qType + " at the current position");
            }
            analytics.workflow("Added question in form builder");
            mug = _this.data.core.form.createQuestion(foo.mug, foo.position, qType);
            var $firstInput = _this.$f.find(".fd-question-properties input:text:visible:first");
            if ($firstInput.length) {
                $firstInput.focus().select();
            }
        });
        // the returned value will be `undefined` if ensureCurrentMugIsSaved
        // had to defer for user feedback
        return mug;
    };

    fn.adjustToWindow = function() {
        this.data.windowManager.adjustToWindow();
    };

    /**
     * Find insertion position for new mug of type `qType`.
     *
     * Try insert into `refMug`, then after `refMug`, then after each of
     * `refMug`'s ancestors.
     *
     * @param refMug - Mug relative to which to insert.
     * @param qType - Type of question being inserted.
     * @param after - (optional) Try insert after instead of into `refMug`.
     * @returns - `{mug: <refMug>, position: <position>}` or, if there is
     *      no valid insert position for the given question type, `null`.
     *      Valid positions: before, after, first, last, into (same as last).
     *      In practice position will be one of `"last"` or `"after"`.
     */
    fn.getInsertTargetAndPosition = function (refMug, qType, after) {
        var parent, childTypes, position = after ? 'after' : 'last';
        while (refMug) {
            if (position === 'after') {
                parent = refMug.parentMug;
                if (!parent) {
                    if (!this.isInsertAllowed(qType, position, refMug)) {
                        return null;
                    }
                    break;
                }
            } else {
                parent = refMug;
            }
            if (this.jstree("is_closed", parent.ufid)) {
                refMug = parent;
                position = 'after';
                continue;
            }
            childTypes = typeData[parent.__className].valid_children;
            if (childTypes.indexOf(qType) !== -1) {
                break;
            } else if (position !== 'after') {
                position = 'after';
            } else {
                refMug = refMug.parentMug;
            }
        }
        if (!refMug && !this.isInsertAllowed(qType, position, refMug)) {
            return null;
        }
        return {mug: refMug, position: position};
    };

    /**
     * Check if a question of the given `type` can be inserted at `position`
     * relative to `refMug`
     *
     * WARNING the bare minimum has been implemented to support
     * getInsertTargetAndPosition(). Needs to be fleshed out for other uses.
     *
     * Valid positions: before, after, first, last, into (same as last)
     */
    fn.isInsertAllowed = function (type, position, refMug) {
        var parentType = "#"; // root type
        if (refMug) {
            if (position === "after" || position === "before") {
                if (refMug.parent) {
                    throw new Error("validation of insert " + position + " " +
                                    refMug.__className + " not implemented");
                    //parentType = refMug.parent.__className;
                }
            //} else if (position === "into" || position === "first" || position === "last") {
            } else {
                throw new Error("validation of insert " + position + " " +
                                refMug.__className + " not implemented");
            }
        } else if (position !== "into" && position !== "first" && position !== "last") {
            throw new Error("validation of insert " + position +
                            " root node not implemented");
            //return false;
        }
        return typeData[parentType].valid_children.indexOf(type) !== -1;
    };

    fn.handleNewMug = function (mug, refMug, position) {
        this.createQuestion(mug, refMug, position);
    };

    /**
     * Create a question in the tree GUI
     *
     * @returns The tree node that was created or `false` if it was not created.
     */
    fn.createQuestion = function (mug, refMug, position) {
        var _this = this;
        mug.on("messages-changed", function (event) {
            _this.setTreeValidationIcon(event.mug);
        }, null, null, this.data.core);
        return this.jstree("create_node",
            refMug ? "#" + refMug.ufid : "#",
            {
                text: this.getMugDisplayName(mug),
                type: mug.__className,
                data: {
                    mug: mug,
                    handleDrop: function (target) {
                        var path = _this.mugToXPathReference(mug);
                        _this.handleDropFinish(target, path, mug);
                    }
                },
                li_attr: {
                    id: mug.ufid,
                    rel: mug.__className
                },
                state: { opened: true }
            },
            // NOTE 'into' is not a supported position in JSTree
            (position === 'into' ? 'last' : position)
        );
    };

    fn.handleMugParseFinish = function (mug) {
    };

    fn.getMugByPath = function (path) {
        return this.data.core.form.getMugByPath(path);
    };

    fn.setCurrentMug = function (mug) {
        this.jstree("deselect_all", true).jstree('select_node', mug.ufid);
    };

    fn.displayMugProperties = function (mug) {
        var $props = this.$f.find('.fd-question-properties');
        this.$f.find('.fd-default-panel').addClass('hide');

        this.showContentRight();
        $props.addClass("hide");

        this._setPropertiesMug(mug);
        var $content = this.$f.find(".fd-props-content").empty(),
            sections = this.getSections(mug),
            $messages = $("<div class='messages' />");

        this.$f.find('.fd-props-toolbar').html(this.getMugToolbar(mug));
        for (var i = 0; i < sections.length; i++) {
            var section = sections[i];

            section.mug = mug;
            section.properties = _(section.properties)
                .map(function (property) {
                    return getWidgetClassAndOptions(property, mug);
                })
                .filter(_.identity);

            if (section.properties.length) {
                this.getSectionDisplay(mug, section).appendTo($content);
            }
        }

        // Setup area for messages not associated with a property/widget.
        if ($content.children().length) {
            $messages.insertAfter($content.children().first());
        } else {
            $messages.appendTo($content);
        }
        function refreshMessages() {
            $messages.empty().append(widgets.util.getMessages(mug, null));
        }
        mug.on("messages-changed", refreshMessages, null, "teardown-mug-properties");
        refreshMessages();

        this.$f.find('.fd-content-right .fd-column').addClass("hide");
        $props.removeClass("hide");
        this.adjustToWindow();
        this.$f.find('.fd-help a').fdHelp();

        this.refreshMugName(mug);
        this.toggleConstraintItext(mug);
    };

    fn._setPropertiesMug = function (mug) {
        if (this._propertiesMug) {
            this._propertiesMug.teardownProperties();
            try {
                this._propertiesMug.validate();
            } catch (err) {
                // ignore error
            }
        }
        this._propertiesMug = mug;
    };

    fn.displayMultipleSelectionView = function () {
        var mugs = this.getCurrentlySelectedMug(true);
        this.showContentRight();
        this.hideQuestionProperties();
        this._setPropertiesMug(null);
        this.$f.find('.fd-props-toolbar').html(this.getMugToolbar(mugs, true));
        this.$f.find(".fd-props-content").empty();
        this.showQuestionProperties();
    };

    fn.showContentRight = function () {
        this.$f.find('.fd-content-right').show();
    };

    fn.hideContentRight = function () {
        this.$f.find('.fd-content-right').hide();
    };

    fn.showQuestionProperties = function () {
        this.$f.find('.fd-content-right .fd-column').addClass("hide");
        this.$f.find('.fd-question-properties').removeClass("hide");
    };

    fn.hideQuestionProperties = function () {
        this.$f.find('.fd-question-properties').addClass("hide");
    };

    /**
     * Display an editor in the question properties area
     *
     * @param options - Object with editor options:
     *  {
     *      headerText: "text to display in header",
     *      loadEditor: function($div, options),    // load editor into $div
     *      change: function(value),                // editor changed callback
     *      done: function(value)                   // editor done callback
     *  }
     */
    fn.displaySecondaryEditor = function(options) {
        // All mention of "xpath" in this function is from when this function
        // displayed the xpath editor. It has been adapted to show any editor.
        var _this = this,
            $editor = this.$f.find('.fd-xpath-editor');

        $editor.find('.fd-head h2').text(options.headerText);
        options.DEBUG_MODE = DEBUG_MODE;
        this.hideQuestionProperties();

        var done = options.done;
        options.done = function (val) {
            done(val);
            if (_this.data.core.hasXPathEditorChanged) {
                _this.data.core.hasXPathEditorChanged = false;
                $editor.addClass("hide");
                _this.refreshCurrentMug();
            } else {
                $editor.addClass("hide");
                _this.showQuestionProperties();
            }
        };
        var change = options.change;
        options.change = function (val) {
            _this.data.core.hasXPathEditorChanged = true;
            if (change) {
                change(val);
            }
        };
        _this.$f.find('.fd-content-right .fd-column').addClass('hide');
        $editor.removeClass("hide");
        options.loadEditor(_this.$f.find('.fd-xpath-editor-content'), options);
    };

    fn.displayXPathEditor = function(options) {
        options.headerText = "Expression Editor";
        options.loadEditor = function($div, options) {
            require(['vellum/expressionEditor'], function (expressionEditor) {
                expressionEditor.showXPathEditor($div, options);
            });
        };
        this.displaySecondaryEditor(options);
    };

    fn.alert = function (title, message, buttons) {
        buttons = buttons || [];
        if (this.data.core.isAlertVisible) {
            return;
        }

        var _this = this;
        this.data.core.isAlertVisible = true;
        if (!buttons.length) {
            buttons.push({title: "OK", defaultButton: true});
        }

        var $modal = this.generateNewModal(title, buttons, false, "fa fa-warning");

        // store a reference to $modal on this so modal button actions can
        // reference it in order to hide it at the right point in time.  This is
        // a bit of a hack but any alternative is probably a lot more
        // complicated.
        this.data.core.$modal = $modal;

        $modal.removeClass('fade');
        if (message instanceof $) {
            $modal.find('.modal-body').append(message);
        } else {
            $modal.find('.modal-body').append($('<p />').text(message));
        }
        $modal
            .modal('show')
            .on('hide.bs.modal', function () {
                _this.data.core.isAlertVisible = false;
            });
    };

    fn.setTreeValidationIcon = function (mug) {
        var node = mug.ufid && this.jstree("get_node", mug.ufid);
        if (node) {
            var errors = mug.getErrors();
            if (errors.length) {
                var msg = errors.join("\n").replace(/"/g, "'");
                node.data.errors = '<i class="fd-tree-valid-alert-icon ' +
                    'fa fa-warning" title="' + msg + '"></i>';
            } else {
                node.data.errors = null;
            }
            this.jstree("redraw_node", node);
        }
    };

    fn._resetMessages = function (errors) {
        var error, messages_div = this.$f.find('.fd-messages');
        messages_div.empty();

        function asArray(value) {
            // TODO: I don't like this array business, should be refactored away
            // to the callers.
            if (typeof value === "string" || !(value instanceof Array)) {
                // value is a string or not-an-array (so try turn it into a string)
                value = ['' + value];
            }
            return value;
        }

        if (errors.length > 0) {
            // Show message(s) from the last error only because multiple errors
            // fill up the screen and thus impede usability.  TODO ideally the
            // other errors would be accessible in some way.  Maybe hidden by
            // default with a clickable indicator to show them?

            error = errors[errors.length - 1];
            messages_div
                .html(alert_global({
                    messageType: MESSAGE_TYPES[error.level],
                    messages: asArray(error.message)
                }))
                .find('.alert').removeClass('hide').addClass('in');
        }
    };

    fn.sectionIsCollapsed = function(section) {
        var collapseKey = "collapse-" + section.slug;
        return localStorage.hasOwnProperty(collapseKey) ?
            localStorage.getItem(collapseKey) :
            section.isCollapsed;
    };

    fn.getSectionDisplay = function (mug, options) {
        var _this = this,
            isCollapsed = _this.sectionIsCollapsed(options),
            $sec = $(question_fieldset({
                fieldsetClass: "fd-question-edit-" + options.slug || "anon",
                fieldsetTitle: options.displayName,
                fieldsetSlug: options.slug,
                isCollapsed: !!isCollapsed,
                help: options.help
            })),
            $fieldsetContent = $sec.find('.fd-fieldset-content');
        options.properties.map(function (prop) {
            var elemWidget = prop.widget(mug, $.extend(prop.options, {
                vellum: _this,
                displayXPathEditor: function (options) {
                    _this.data.core.currentlyEditedProperty = prop.options.path;
                    _this.displayXPathEditor(options);
                }
            }));
            elemWidget.setValue(elemWidget.currentValue);
            elemWidget.on("change", function () {
                _this.onFormChange(mug);
            });
            var $ui = elemWidget.getUIElement();
            widgets.util.setWidget($ui, elemWidget);
            $fieldsetContent.append($ui);
            elemWidget.refreshMessages();
        });
        return $sec;
    };

    fn.getMugToolbar = function (mug, multiselect) {
        var _this = this,
            form = this.data.core.form,
            mugs = multiselect ? mug : [mug],
            $baseToolbar = $(question_toolbar({
                comment: multiselect ? '' : mug.p.comment,
                isDeleteable: mugs && mugs.length && _.every(mugs, function (mug) {
                    return _this.isMugRemoveable(mug, mug.hashtagPath);
                }),
                isCopyable: !multiselect && mug.options.isCopyable,
                sections: multiselect ? [] : _.map(_.filter(_.rest(_this.getSections(mug)), function(s) {
                    return _.find(_.map(s.properties, function(property) {
                        return getWidgetClassAndOptions(property, mug);
                    }), _.identity);
                }), function(s) {
                    return _.extend({
                        show: !_this.sectionIsCollapsed(s),
                    }, s);
                }),
            }));
        $baseToolbar.find('.fd-button-remove').click(function () {
            var mugs = _this.getCurrentlySelectedMug(true, true);
            form.removeMugsFromForm(mugs);
            _this.refreshCurrentMug();
        });
        if (!multiselect) {
            $baseToolbar.find('.btn-toolbar.pull-left')
                .prepend(this.getQuestionTypeChanger(mug));
        }
        return $baseToolbar;
    };

    fn.getQuestionTypeChanger = function (mug) {
        var _this = this;
        var getQuestionList = function (mug) {
            var currentTypeName = mug.__className,
                currentType = _this.data.core.mugTypes[currentTypeName],
                questions = _this.data.core.QUESTIONS_IN_TOOLBAR,
                ret = [];

            for (var i = 0; i < questions.length; i++) {
                var typeName = questions[i],
                    q = _this.data.core.mugTypes[typeName];
                if (currentTypeName !== typeName &&
                        !currentType.typeChangeError(mug, typeName) &&
                        // Check the reverse change as well.
                        q.isTypeChangeable &&
                        !q.typeChangeError(mug, currentTypeName)) {
                    ret.push({
                        slug: questions[i],
                        name: q.typeName,
                        icon: q.icon
                    });
                }
            }
            return ret;
        };
        var changeable = this.isMugTypeChangeable(mug, mug.hashtagPath);

        var $questionTypeChanger = $(question_type_changer({
            currentQuestionIcon: mug.getIcon(),
            currentTypeName: mug.options.typeName,
            questions: changeable ? getQuestionList(mug) : []
        }));
        $questionTypeChanger.find('.change-question').click(function (e) {
            try {
                _this.changeMugType(mug, $(this).data('qtype'));
            } catch (err) {
                window.alert("Sorry, " + err);
            }
            e.preventDefault();
        });
        $questionTypeChanger.addClass('fd-question-changer');
        return $questionTypeChanger;
    };

    fn.changeMugType = function (mug, type) {
        this.data.core.form.changeMugType(mug, type);
    };

    fn.createXML = function () {
        return this.data.core.form.createXML();
    };

    fn.canSerializeXForm = function (forAction, retry) {
        var _this = this,
            form = this.data.core.form,
            displayLanguage = this.data.core.currentItextDisplayLanguage,
            warnings = form.getSerializationWarnings();
        if (warnings.length) {
            var message = $(form_errors_template({
                    errors: warnings,
                    displayLanguage: displayLanguage
                }));
            forAction = forAction ? " and " + forAction : "";
            this.alert("There are errors in the form", message, [
                {
                    title: "Fix Manually",
                    action: function () {
                        _this.data.core.$modal.modal('hide');
                    }
                }, {
                    title: "Fix Automatically" + forAction,
                    cssClasses: 'btn-primary',
                    defaultButton: true,
                    action: function () {
                        form.fixSerializationWarnings(warnings);
                        _this.data.core.$modal.modal('hide');
                        retry();
                        _this.refreshVisibleData();
                    }
                }
            ]);
            return false;
        }
        return true;
    };

    fn.validateAndSaveXForm = function (forceFullSave) {
        function retry() {
            _this.validateAndSaveXForm(forceFullSave);
        }
        var _this = this;
        if (!this.canSerializeXForm("Save", retry)) {
            return; // validate/create XML failed
        }
        var formText = this.createXML();
        try {
            // ensure that form is valid XML; throws an error if not
            $.parseXML(formText);
        } catch (err) {
            // something went wrong parsing, but maybe the user wants to save anyway
            // let's ask them with a scary message encouraging them not to.
            var theScaryWarning = "It looks like your form is not valid XML. This can " +
                "often happen if you use a reserved character in one of your questions. " +
                "Characters to look out for are <, >, and &. You can still save, but " +
                "you CANNOT LOAD THIS FORM again until you fix the XML by hand. " +
                "What would you like to do?";
            var $modal = _this.generateNewModal("Form Validation Error", [
                {
                    title: 'Fix the problem (recommended)',
                    cssClasses: "btn-primary",
                    action: function() {
                        _this.closeModal();
                    },
                },
                {
                    title: 'Save anyway',
                    cssClasses: "btn-default",
                    action: function() {
                        _this.closeModal();
                        _this.send(formText, forceFullSave ? 'full' : null);
                    },
                },
            ], false, "fa fa-warning");
            $modal.find(".modal-body").html(theScaryWarning);
            $modal.modal('show');
            return;
        }

        this.send(formText, forceFullSave ? 'full' : null);
    };
        
    fn.send = function (formText, saveType) {
        var CryptoJS = require('CryptoJS'),
            _this = this,
            opts = this.opts().core,
            patch, data;
        saveType = saveType || opts.saveType;

        var url = saveType === 'patch' ?  opts.patchUrl : opts.saveUrl;

        showPageSpinner();

        if (saveType === 'patch') {
            var diff_match_patch = require('diff-match-patch'),
                dmp = new diff_match_patch();
            patch = dmp.patch_toText(
                dmp.patch_make(this.data.core.lastSavedXForm, formText)
            );
            // abort if diff too long and send full instead
            if (patch.length > formText.length && opts.saveUrl) {
                saveType = 'full';
                url = opts.saveUrl;
            }
        }

        if (saveType === 'patch') {
            data = {
                patch: patch,
                sha1: CryptoJS.SHA1(this.data.core.lastSavedXForm).toString()
            };
        } else {
            data = {xform: formText};
        }

        data.case_references = JSON.stringify(this.data.core.form._logicManager.caseReferences());

        this.data.core.saveButton.ajax({
            type: "POST",
            url: url,
            data: data,
            dataType: 'json',
            error: function() {
                hidePageSpinner();
            },
            success: function (data) {
                if (saveType === 'patch') {
                    if (data.status === 'conflict') {
                        if (_.isUndefined(data.xform)) {
                            // unconditionally overwrite if no xform to compare
                            _this.send(formText, 'full');
                        } else {
                            hidePageSpinner();
                            _this.showOverwriteWarning(_this.send.bind(_this),
                                                       formText, data.xform);
                        }
                        return;
                    } else if (CryptoJS.SHA1(formText).toString() !== data.sha1) {
                        debug.error("sha1's didn't match");
                        _this.send(formText, 'full');
                    }
                }
                hidePageSpinner();
                _this.opts().core.onFormSave(data);
                _this.data.core.lastSavedXForm = formText;
            }
        });
    };

    fn.getSections = function (mug) {
        return [
            {
                slug: "main",
                displayName: "Basic",
                properties: this.getMainProperties(),
                help: {
                    title: "Basic",
                    text: "<p>The <strong>Label</strong> is text that appears in the application. " +
                        "This text will not appear in data exports.</p> ",
                    link: "https://confluence.dimagi.com/display/commcarepublic/Form+Builder"
                }
            },
            {
                slug: "data_source",
                displayName: "Data Source",
                properties: this.getDataSourceProperties(),
                isCollapsed: true,
                help: {
                    title: "Data Source",
                    text: "You can configure an external data source like a " +
                        "case list or lookup table to use as the choices for " +
                        "a multiple choice question."
                }
            },
            {
                slug: "logic",
                displayName: "Logic",
                properties: this.getLogicProperties(),
                isCollapsed: true,
                help: {
                    title: "Logic",
                    text: "Use logic to control when questions are asked and what answers are valid. " +
                        "You can add logic to display a question based on a previous answer, to make " +
                        "the question required or ensure the answer is in a valid range.",
                    link: "https://confluence.dimagi.com/display/commcarepublic/Common+Logic+and+Calculations"
                }
            },
            {
                displayName: "Media",
                slug: "content",
                properties: this.getMediaProperties(),
                isCollapsed: true,
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
                properties: this.getAdvancedProperties(),
                isCollapsed: true,
                help: {
                    title: "Advanced",
                    text: "These are advanced settings and are not needed for most applications.  " +
                        "Please only change these if you have a specific need!",
                    link: "https://confluence.dimagi.com/display/commcarepublic/Application+Building"
                }
            }
        ];
    };

    fn.getMainProperties = function () {
        return [
            "nodeID",
            "label",
            "readOnlyControl",
            "itemsetData",
            "imageSize",
        ];
    };

    fn.getDataSourceProperties = function () {
        return [ ];
    };

    fn.getMediaProperties = function () {
        return [
            "mediaItext"
        ];
    };

    fn.getLogicProperties = function () {
        return [
            "calculateAttr",
            "requiredAttr",
            "relevantAttr",
            "constraintAttr",
            "repeat_count",
            'defaultValue',
        ];
    };

    fn.getAdvancedProperties = function () {
        return [
            "dataSource",
            "dataValue",
            "xmlnsAttr",
            "label",
            "hintLabel",
            "constraintMsgAttr",
            "dataParent",
            'appearance',
            'comment',
        ];
    };

    function getWidgetClassAndOptions(propPath, mug) {
        var propDef = mug.p.getDefinition(propPath);
        if (!propDef || !mug.isVisible(propPath)) {
            return null;
        }
        return {
            widget: propDef.widget || widgets.text,
            options: $.extend(true, {path: propPath}, propDef)
        };
    }

    fn.getMugSpec = function () {
        return mugs.baseSpecs;
    };

    fn.isMugRemoveable = function (mug, path) {
        return mug.options.isRemoveable;
    };

    fn.isPropertyLocked = function (mugPath, propertyPath) {
        return false;
    };

    fn.isMugPathMoveable = function (mugPath) {
        return true;
    };

    fn.isMugTypeChangeable = function (mug, mugPath) {
        return mug.options.isTypeChangeable;
    };

    fn.handleMugRename = function (form, mug, newId, oldId, newPath, oldPath, oldParent) {
        form.handleMugRename(mug, newId, oldId, newPath, oldPath, oldParent);
    };

    fn.duplicateMugProperties = function(mug) {};

    fn.beforeSerialize = function () {};
    fn.afterSerialize = function () {};

    fn.beforeBulkInsert = function (form) {};
    fn.afterBulkInsert = function (form) {
        this.refreshVisibleData();
    };

    fn.parseDataElement = function (form, el, parentMug, role) {
        return parser.parseDataElement(form, el, parentMug, role);
    };

    fn.parseBindElement = function (form, el, path) {
        return parser.parseBindElement(form, el, path);
    };

    fn.parseSetValue = function (form, el, path) {
        return parser.parseSetValue(form, el, path);
    };

    fn.getControlNodeAdaptorFactory = function (tagName) {
        return this.data.core.controlNodeAdaptorMap[tagName];
    };

    /**
     * Extension point for mug setup during control node parsing
     *
     * The mug has been inserted into the tree by the time this method
     * is called.
     *
     * @param mug - for which the control element is being parsed.
     * @param controlElement - jQuery-wrapped control element.
     */
    fn.populateControlMug = function (mug, controlElement) {
        return parser.populateControlMug(mug, controlElement);
    };

    /**
     * Extension point for plugins to hook into the mapping of control nodes
     * to control mugs.
     *
     * @param map - An object mapping control node tag names to functions.
     *  The keys to this map are lowercase control node tag names.
     *  The values are functions that support the following call signature:
     *
     *      `adapt = makeMugAdaptor($controlElement, appearance, form, parentMug)`
     *
     *  `makeMugAdaptor` must return a function that converts a data-bind-only
     *  mug or null to a control mug. This function must support the following
     *  call signature:
     *
     *      `mug = adapt(mug, form)`
     *
     *  Most adaptor factories will use `parser.js:makeMugAdaptor` to create an
     *  `adapt` function that does a typical mug conversion. See also
     *  `parser.js:makeControlOnlyMugAdaptor` for control-only mugs.
     */
    fn.updateControlNodeAdaptorMap = function (map) {};

    fn.contributeToModelXML = function (xmlWriter, form) {};

    fn.contributeToHeadXML = function (xmlWriter, form) {}; 

    fn.initMediaUploaderWidget = function (widget) {};

    fn.destroy = function () {};

    $.vellum.plugin("core", {
        form: null,
        loadDelay: 500,
        patchUrl: false,
        saveUrl: false,
        saveType: 'full',
        staticPrefix: "",
        allowedDataNodeReferences: [],
        noTextString: '[no text]',
        onReady: function () {},
        onFormSave: function (data) {},
        bindBeforeUnload: function (handler) {
            $(window).on('beforeunload', handler);
        }
    }, fn);
});
