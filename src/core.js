// the UI/ViewModel

define([
    'require',
    'save-button',
    'underscore',
    'xpathmodels',
    'jquery',
    'text!vellum/templates/main.html',
    'tpl!vellum/templates/question_type_group',
    'tpl!vellum/templates/edit_source',
    'tpl!vellum/templates/control_group_stdInput',
    'tpl!vellum/templates/question_fieldset',
    'tpl!vellum/templates/question_type_changer',
    'tpl!vellum/templates/question_toolbar',
    'tpl!vellum/templates/alert_global',
    'tpl!vellum/templates/modal_content',
    'tpl!vellum/templates/modal_button',
    'vellum/mugs',
    'vellum/widgets',
    'vellum/parser',
    'vellum/base',
    'less!vellum/less-style/main',
    'jquery.jstree',
    'jquery.bootstrap',
    'jquery.fancybox',  // only thing we use fancybox for is its spinner, no actual display of anything
    'jquery-ui'  // used for buttons in Edit Source XML, and dialogs
], function (
    require,
    SaveButton,
    _,
    xpathmodels,
    $,
    main_template,
    question_type_group,
    edit_source,
    control_group_stdInput,
    question_fieldset,
    question_type_changer,
    question_toolbar,
    alert_global,
    modal_content,
    modal_button,
    mugs,
    widgets,
    parser
) {
    
    // Load these modules in the background after all runtime dependencies have
    // been resolved, since they're not needed initially.
    setTimeout(function () {
        require([
            'codemirror',
            'diff-match-patch',
            'CryptoJS',
            'vellum/expressionEditor',
        ], function () {});
    }, 0);

    var DEBUG_MODE = false;
    xpathmodels.DEBUG_MODE = DEBUG_MODE;

    var MESSAGE_TYPES = {
        "error": {
            cssClass: "alert-error",
            title: "Error",
            icon: "icon-exclamation-sign"
        },
        "parse-warning": {
            cssClass: "",
            title: "Warning",
            icon: "icon-warning-sign"
        },
        "form-warning": {
            cssClass: "",
            title: "Form Warning",
            icon: "icon-info-sign"
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
                vellum._addQuestion($(this).data('qtype'));
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
            this.getMugSpec(), this.getMugTypes());

        var _this = this,
            bindBeforeUnload = this.opts().core.bindBeforeUnload;
        this.data.core.saveButton = SaveButton.init({
            save: function() {
                _this.ensureCurrentMugIsSaved(function () {
                    _this.validateAndSaveXForm();
                });
            },
            unsavedMessage: 'Are you sure you want to exit? All unsaved changes will be lost!'
        });
        bindBeforeUnload(this.data.core.saveButton.beforeunload);
        this.data.core.currentErrors = [];

        this.data.core.lastSavedXForm = this.opts().core.form;

        this.$f.addClass('formdesigner');
        this.$f.empty().append(main_template);

        this._init_toolbar();
        this._init_extra_tools();
        this._createJSTree();
        this._init_modal_dialogs();
        this._setup_fancybox();
    };

    fn.postInit = function () {
        var _this = this;
        this.loadXFormOrError(this.opts().core.form, function () {
            setTimeout(_this.opts().core.onReady, 0);
        });
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
                    "Item"
                    // an Itemset is added automatically when you add a new dynamic
                    // select
                ],
                questions: this.getSelectQuestions()
            },
            {
                group: ["Int", 'Number'],
                questions: [
                    "Int",
                    "PhoneNumber",
                    "Double",
                    "Long"
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
                    "Video"
                ]
            },
            {
                group: ["Geopoint", 'Advanced', ''],
                textOnly: true,
                questions: [
                    "Geopoint",
                    "Barcode",
                    "Secret",
                    "AndroidIntent"
                ]
            }
        ];
    };

    fn.getSelectQuestions = function () {
        return [
            "Select",
            "MSelect"
        ];
    };

    fn._init_extra_tools = function () {
        var _this = this,
            menuItems = this.getToolsMenuItems();

        var $toolsMenu = this.$f.find('.fd-tools-menu');
        $toolsMenu.empty();
        _(menuItems).each(function (menuItem) {
            var $a = $("<a tabindex='-1' href='#'>" + menuItem.name + "</a>").click(
                function (e) {
                    e.preventDefault();
                    _this.ensureCurrentMugIsSaved(function () {
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
    };

    fn.getToolsMenuItems = function () {
        var _this = this;
        return [
            {
                name: "Export Form Contents",
                action: function (done) {
                    _this.showExportDialog(done);
                }
            },
            {
                name: "Edit Source XML",
                action: function (done) {
                    _this.showSourceXMLDialog(done);
                }
            },
            {
                name: "Form Properties",
                action: function (done) {
                    _this.showFormPropertiesDialog(done);
                }
            }
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
        return mug.getDisplayName(
            this.data.core.currentItextDisplayLanguage || 
            this.data.javaRosa.Itext.getDefaultLanguage());
    };

    fn._showConfirmDialog = function () {
        $('.fd-dialog-confirm').dialog("open");
    };

    fn._hideConfirmDialog = function () {
        $('.fd-dialog-confirm').dialog("close");
    };

    /**
     * Set the values for the Confirm Modal Dialog
     * (box that pops up that has a confirm and cancel button)
     */
    fn.setDialogInfo = function (message, confButName, confFunction,
                                 cancelButName, cancelButFunction, title) {
        title = title || "";
        var buttons = {}, opt,
            $dial = $('.fd-dialog-confirm'), contentStr;
        buttons[confButName] = confFunction;
        buttons[cancelButName] = cancelButFunction;

        $dial.empty();
        contentStr = '<p>' +
                '<span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>' +
                '<span class="fd-message">These items will be permanently deleted and cannot be recovered. Are you sure?</span></p>';
        $dial.append(contentStr);
        if (!message || typeof(message) !== "string") {
            message = "";
        }
        $dial.find('.fd-message').text(message);
        $dial.dialog("option", {buttons: buttons, "title": title});
    };

    fn.showSourceXMLDialog = function (done) {
        var _this = this;
        
        function onContinue () {
            _this._hideConfirmDialog();
            _this.showSourceInModal(done);
        }

        function onAbort () {
            _this._hideConfirmDialog();
        }
        function validateMug(mug) {
            return !_this.getErrors(mug).length;
        }
        // todo: should this also show up for saving? Did it at some point in
        // the past?
        if (!this.data.core.form.isFormValid(validateMug)) {

            var msg = "There are validation errors in the form.  Do you want to continue anyway? WARNING:" +
                      "The form will not be valid and likely not perform correctly on your device!";
            this.setDialogInfo(msg, 'Continue', onContinue, 'Abort', onAbort);
            this._showConfirmDialog();
        } else {
            this.showSourceInModal(done);
        }
    };

    fn.showSourceInModal = function (done) {
        var _this = this,
            $modal, $updateForm, $textarea, codeMirror, modalHeaderHeight,
            modalFooterHeight, modalHeight, modalBodyHeight;

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
        modalHeaderHeight = $modal.find('.modal-header').outerHeight();
        modalFooterHeight = $modal.find('.modal-footer').outerHeight();
        modalHeight = $(window).height() - 40;
        modalBodyHeight = modalHeight - (modalFooterHeight - modalHeaderHeight) - 126;

        $modal
            .css('height', modalHeight + 'px')
            .css('width', $(window).width() - 40 + 'px');

        $modal.addClass('fd-source-modal')
            .removeClass('form-horizontal')
            .find('.modal-body')
            .html($updateForm)
            .css('height', modalBodyHeight + 'px');

        $textarea = $updateForm.find('textarea');

        // populate text
        if(!this.data.core.formLoadingFailed){
            $textarea.val(this.createXML());
        } else {
            $textarea.val(this.data.core.failedLoadXML);
        }

        codeMirror = require('codemirror').fromTextArea($textarea.get(0));
        codeMirror.setOption('viewportMargin', Infinity);
        codeMirror.setOption('lineNumbers', true);
        codeMirror.setSize('100%', '100%');

        $modal.modal('show');
        $modal.on('shown', function () {
            codeMirror.refresh();
        });
    };

    fn.showExportDialog = function(done) {
        var $modal,
            $exportForm;

        $modal = this.generateNewModal("Export Form Contents", []);
        $exportForm = $(edit_source({
            description: "Copy and paste this content into a spreadsheet program like Excel " +
                         "to easily share your form with others."
        }));
        $modal.find('.modal-body').html($exportForm);

        // display current values
        $exportForm.find('textarea').val(this.data.core.form.getExportTSV());
        $modal.modal('show');
    };
        
    fn.showFormPropertiesDialog = function () {
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
                    label: "Form ID",
                    slug: "formID",
                    cleanValue: function (val) {
                        return val.replace(/ /g, '_');
                    }
                }
            ];

        $modalBody.append($('<p />').text(
            "Note: changing the Form ID here will not automatically change " +
            "the Form ID in existing references in your logic conditions.  " +
            "If you change the Form ID, you must manually change any " +
            "existing logic references."));

        _.each(formProperties, function (prop) {
            var $propertyInput = $(control_group_stdInput({
                label: prop.label
            }));
            $modalBody.append($propertyInput);
            $propertyInput.find('input')
                .val(_this.data.core.form[prop.slug])
                .on('keyup', function () {
                    var $this = $(this),
                        currentVal = $this.val();
                    if (typeof prop.cleanValue === 'function') {
                        currentVal = prop.cleanValue(currentVal);
                        $this.val(currentVal);
                    }
                    _this.data.core.form.setAttr(prop.slug, currentVal);
                });
        });

        $modal.modal('show');
    };
    
    fn.generateNewModal = function (title, buttons, closeButtonTitle) {
        if (typeof closeButtonTitle === "undefined") {
            closeButtonTitle = "Close";
        }
        buttons.reverse();
        buttons = _.map(buttons, function (button) {
            button.cssClasses = button.cssClasses || "";
            return button;
        });

        var $modalContainer = this.$f.find('.fd-modal-generic-container'),
            $modal = $(modal_content({
                title: title,
                closeButtonTitle: closeButtonTitle
            }));

        _.each(buttons, function (button) {
            button.action = button.action || function () {
                $modal.modal('hide');
            };
            $modal.find('.modal-footer').prepend(
                $(modal_button(button)).click(button.action));
        });
        $modalContainer.html($modal);
        return $modal;
    };

    fn._init_modal_dialogs = function () {
        this.$f.find('.fd-dialog-confirm').dialog({
            resizable: false,
            modal: true,
            buttons: {
                "Confirm": function() {
                    $(this).dialog("close");
                },
                "Cancel": function() {
                    $(this).dialog("close");
                }
            },
            autoOpen: false
        });
    };
        
    fn._setup_fancybox = function () {
        $.fancybox.init();
        this.$f.find("a.inline").fancybox({
            hideOnOverlayClick: false,
            hideOnContentClick: false,
            enableEscapeButton: false,
            showCloseButton : true,
            onClosed: function() {}
        });
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
  
    function warnOnCircularReference(property, form, mug, path) {
        if (path === "." && (
            property === "relevantAttr" ||
            property === "calculateAttr"
        )) {
            var fieldName = mug.p.getDefinition(property).lstring;
            form.updateError({
                level: "form-warning",
                message: "The " + fieldName + " for a question " + 
                    "is not allowed to reference the question itself. " + 
                    "Please remove the period from the " + fieldName + 
                    " or your form will have errors."
            }, {updateUI: true});
        }
    }

    var validRootChildren,
        typeData;
    // todo: jstree-related methods could be extracted out as a jstree wrapper
    // separate from the rest of the UI code.
    fn._createJSTree = function () {
        typeData = {};
        _(this.data.core.mugTypes.allTypes).each(function (type, typeName) {
            typeData[typeName] = {
                max_children: type.maxChildren,
                valid_children: 
                    type.validChildTypes.length ? type.validChildTypes : "none"
            };
        });
        validRootChildren = this.data.core.mugTypes.Group
            .validChildTypes.concat(['DataBindOnly']);

        var $tree, _this = this;
        this.data.core.$tree = $tree = this.$f.find('.fd-question-tree');
        $tree.jstree({
            "json_data" : {
                "data" : []
            },
            "core": {
                strings: {
                    new_node: this.opts().core.noTextString
                }
            },
            "ui" : {
                select_limit: 1
            },
            "crrm" : {
                "move": {
                    "always_copy": false,
                    "check_move": function (m) {
                        // disallow moving a data node or onto a data node
                        // unless both nodes are data nodes
                        var source = $(m.o),
                            target = $(m.r),
                            position = m.p,
                            refIsData = target.attr('rel') === 'DataBindOnly',
                            nodeIsData = source.attr('rel') === 'DataBindOnly';

                        if (Number(refIsData) + Number(nodeIsData) === 1) {
                            return false;
                        }

                        var form = _this.data.core.form,
                            sourceMug = form.getMugByUFID(source.attr('id')),
                            isMoveable = _this.isMugPathMoveable(
                                sourceMug.getAbsolutePath());

                        if (!isMoveable) {
                            var id = target.attr('id'),
                                targetMug = form.getMugByUFID(id);
                            if (position === 'inside' || position === 'last') {
                                return sourceMug.parentMug === targetMug;
                            } else {
                                return sourceMug.parentMug === targetMug.parentMug;
                            }
                        }

                        return true;
                    }
                }
            },
            "dnd" : {
                "drop_finish" : function(data) {
                    var target = $(data.r),
                        sourceUid = $(data.o).attr('id'),
                        mug = _this.data.core.form.getMugByUFID(sourceUid),
                        ops = target.closest(".xpath-expression-row").find(".op-select");

                    if (target) {
                        var path = _this.mugToXPathReference(mug);
                        // the .change fires the validation controls
                        target.val(target.val() + path).change();

                        if (_this.data.core.currentlyEditedProperty) {
                            warnOnCircularReference(
                                _this.data.core.currentlyEditedProperty,
                                _this.data.core.form,
                                mug,
                                path);
                        }
                    }

                    if (mug && ops && mug.options.defaultOperator) {
                        ops.val(mug.options.defaultOperator);
                    }
                }
            },
            "types": {
                "max_children" : -1,
                // valid root node types
                "valid_children" : validRootChildren,
                "types" : typeData
            },
            "plugins" : [ "themes", "json_data", "ui", "crrm", "types", "dnd" ]
            // We enable the "themes" plugin, but bundle the default theme CSS
            // (with base64-embedded images) in our CSS build.  The themes
            // plugin needs to stay enabled because it adds CSS selectors to
            // themeable items, which it would be hard to adapt the existing
            // selectors to if they didn't exist.  This would result in the
            // themes plugin getting a 404 for the CSS file, but we comment that
            // out.
        }).bind("select_node.jstree", function (e, data) {
            var ufid = $(data.rslt.obj[0]).prop('id'),
                mug = _this.data.core.form.getMugByUFID(ufid);

            _this.displayMugProperties(mug);
            _this.activateQuestionTypeGroup(mug.__className);
        }).bind("move_node.jstree", function (e, data) {
            var form = _this.data.core.form,
                mug = form.getMugByUFID($(data.rslt.o).attr('id')),
                refMug = form.getMugByUFID($(data.rslt.r).attr('id')),
                position = data.rslt.p;

            form.moveMug(mug, refMug, position);
            _this.refreshCurrentMug();
        }).bind("deselect_all.jstree deselect_node.jstree", function (e, data) {
            _this.resetQuestionTypeGroups();
        }).bind('before.jstree', function (e, data) {
            var stop = function () {
                e.stopImmediatePropagation();
                return false;
            };

            if (data.func === 'select_node' && !_this.ensureCurrentMugIsSaved()) {
                return stop();
            }

            if (data.func === 'move_node' && data.args[0].jquery) {
                if (!_this.ensureCurrentMugIsSaved()) {
                    return stop();
                }
                var form = _this.data.core.form,
                    mug = form.getMugByUFID($(data.args[0]).attr('id')),
                    nodeID = mug.p.nodeID,
                    refMug = form.getMugByUFID($(data.args[1]).attr('id')),
                    position = data.args[2],
                    parentMug;

                // disallow moving a node if it would have the same ID as a sibling
                if (nodeID) {
                    if (['into', 'first', 'last'].indexOf(position) !== -1) {
                        parentMug = refMug;
                    } else {
                        parentMug = refMug.parentMug;
                    }

                    var childMug = form.getMugChildByNodeID(parentMug, nodeID);
                    if (childMug && childMug !== mug) {
                        // setup state for alert
                        _this.setUnsavedDuplicateNodeId(nodeID, true);
                        // trigger alert
                        _this.ensureCurrentMugIsSaved();
                        return stop();
                    }
                }
            }
        }).bind('create_node.jstree', function (e, data) {
            _this.overrideJSTreeIcon(data.args[2].metadata.mug);
        }).bind('set_type.jstree', function (e, data) {
            var mug = _this.data.core.form.getMugByUFID(data.args[1].substring(1));
            _this.overrideJSTreeIcon(mug);
        });
    };

    fn.setTreeNodeInvalid = function (uid, msg) {
        msg = msg.replace(/"/g, "'");
        var $node = this.$f.find('#' + uid + ' > a');
        this.setTreeNodeValid(uid);
        $node.after(
            '<div class="ui-icon ui-icon-alert fd-tree-valid-alert-icon"' +
            ' title="' + msg + '"></div>');
    };

    fn.setTreeNodeValid = function (uid) {
        this.$f.find('#' + uid + ' > a')
            .siblings(".fd-tree-valid-alert-icon").remove();
    };

    fn.setTreeValidationIcon = function (mug) {
        var errors = this.getErrors(mug);
        if (!errors.length) {
            this.setTreeNodeValid(mug.ufid);
        } else {
            this.setTreeNodeInvalid(mug.ufid, errors.join("<p>"));
        }
    };

    fn.jstree = function () {
        var tree = this.data.core.$tree;
        return tree.jstree.apply(tree, arguments);
    };

    /**
     * Use only when absolutely necessary, or you're probably doing something
     * wrong!
     */
    fn.getCurrentlySelectedMug = function () {
        var selected = this.jstree('get_selected'),
            ret;

        if (!selected || !selected[0]) {
            ret = null;
        } else {
            selected = selected[0];
            ret = this.data.core.form.getMugByUFID($(selected).prop('id'));
        }
        return ret;
    };

    fn.mugToXPathReference = function (mug) {
        // for choices, return the quoted value.
        // for everything else return the path
        if (mug.__className === "Item") {
            return '"' + mug.p.defaultValue + '"';
        } else {
            // for the currently selected mug, return a "."
            return (mug.ufid === this.getCurrentlySelectedMug().ufid) ? 
                "." : this.data.core.form.getAbsolutePath(mug);
        }
        // Instead of depending on the UI state (currently selected mug), it
        // would probably be better to have this be handled by the widget using
        // its bound mug.
    };

    fn.overrideJSTreeIcon = function (mug) {
        var $questionNode = this.$f.find('#' + mug.ufid),
            iconClass;
        if (!mug.getIcon) {
            // mug is the question type definition, not an instance
            iconClass = mug.icon;
        } else {
            iconClass = mug.getIcon();
        }
        iconClass = iconClass || 'icon-circle';
        if (!$questionNode.find('> a > ins').hasClass(iconClass)) {
            $questionNode.find('> a > ins')
                .attr('class', 'jstree-icon')
                .addClass(iconClass);
        }
        this.activateQuestionTypeGroup(mug.__className || mug.typeName);
    };

    fn.activateQuestionTypeGroup = function (className) {
        this.resetQuestionTypeGroups();

        var groupSlug = this.data.core.QUESTION_TYPE_TO_GROUP[className];
        if (groupSlug && className !== 'MSelectDynamic' && className !== 'SelectDynamic') {
            this.$f
                .find('.' + getQuestionTypeGroupClass(groupSlug))
                .find('.fd-question-type-related').removeClass('disabled');
        }
    };

    fn.resetQuestionTypeGroups = function () {
        this.$f.find('.fd-container-question-type-group .fd-question-type-related')
            .addClass('disabled');
    };

    fn.setUnsavedDuplicateNodeId = function (nodeId, forMove) {
        this.data.core.unsavedDuplicateNodeId = nodeId;
        this.data.core.duplicateIsForMove = forMove;
    };

    // Attempt to guard against doing actions when there are unsaved or invalid
    // pending changes. In the case of an invalid duplicate sibling ID, it tries
    // to call 'callback' after the user automatically fixes the invalid state,
    // if they choose, but in any case returns false immediately if the current
    // mug is not saved, for use when this is called in response to a JSTree
    // event that needs to immediately be decided whether to stop propagation
    // of.
    fn.ensureCurrentMugIsSaved = function (callback) {
        callback = callback || function () {};

        var _this = this,
            mug = this.getCurrentlySelectedMug(),
            duplicate = this.data.core.unsavedDuplicateNodeId,
            duplicateIsForMove = this.data.core.duplicateIsForMove;

        if (this.data.core.hasXPathEditorChanged) {
            this.alert(
                "Unsaved Changes in Editor",
                "You have UNSAVED changes in the Expression Editor. Please save "+
                "changes before continuing.");
            return false;
        } else if (duplicate) {
            var verb = duplicateIsForMove ? 'would have' : 'has',
                newQuestionId = this.data.core.form.generate_question_id(duplicate);

            this.alert(
                "Duplicate Question ID",
                "'" + duplicate + "' " + verb + " the same Question ID as " +
                "another question in the same group. Please change '" + 
                duplicate + "' to a unique Question ID before continuing.",
                [
                    {
                        title: "Fix Manually",
                        action: function () {
                            // Since we just changed state to trigger this
                            // message when calling ensureCurrentMugIsSaved()
                            // when attempting a move, reset the state.  It will
                            // be changed again if the same move is attempted.
                            if (duplicateIsForMove) {
                                _this.setUnsavedDuplicateNodeId(false);
                            }
                            _this.data.core.$modal.modal('hide');
                        }
                    },
                    {
                        title: "Automatically rename to '" + newQuestionId + "'",
                        cssClasses: 'btn-primary',
                        action: function () {
                            mug.p.nodeID = newQuestionId;
                            _this.setUnsavedDuplicateNodeId(false);
                            _this.data.core.$modal.modal('hide');
                            _this.refreshVisibleData();
                            callback();
                        } 
                    }
                
                ]);
            return false;
        } else {
            callback();
            return true;
        }
    };

    fn.loadXFormOrError = function (formString, done, updateSaveButton) {
        done = done || function () {};
        var _this = this;

        $.fancybox.showActivity();
        //wait for the spinner to come up.
        window.setTimeout(function () {
            //universal flag for indicating that there's something wrong enough
            //with the form that vellum can't deal.
            _this.data.core.formLoadingFailed = false;
            _this.data.core.$tree.children().children().each(function (i, el) {
                _this.jstree("delete_node", el);
            });
            try {
                _this.loadXML(formString);

                if (formString) {
                    _this._resetMessages(_this.data.core.form.errors);
                    _this.reloadTree();
                    //re-enable all buttons and inputs in case they were disabled before.
                    _this.enableUI();
                    if (updateSaveButton) {
                        _this.data.core.saveButton.fire('change');
                    }
                } else {
                    _this.$f.find('.fd-default-panel').removeClass('hide');
                }
                $.fancybox.hideActivity();
            } catch (e) {
                // hack: don't display the whole invalid XML block if it
                // was a parse error
                var msg = e.toString();
                if (msg.indexOf("Invalid XML") === 0) {
                    msg = "Parsing Error. Please check that your form is valid XML.";
                }

                // this button doesn't seem to actually exist
                // todo: fix
                //var showSourceButton = $('#fd-editsource-button');
                //disable all buttons and inputs
                _this.disableUI();
                //enable the view source button so the form can be tweaked by
                //hand.
                //showSourceButton.button('enable');

                _this.setDialogInfo(msg, 
                    'ok', function() {
                        _this._hideConfirmDialog();
                    }, 
                    'cancel', function(){
                        _this._hideConfirmDialog();
                    });
                _this._showConfirmDialog();
                
                _this.data.core.formLoadingFailed = true;
                _this.data.core.failedLoadXML = formString;

                // ok to hard code this because it's public
                var validator_url = "https://www.commcarehq.org/formtranslate/";
                
                msg = "We're sorry, Vellum cannot load your form.  You " +
                    "can edit your form directly by clicking the \"Edit Source" +
                    "XML\" button or go back to download your form. <br>" +
                    "It is likely that your form contains errors.  You can " + 
                    "check to see if your form is valid by pasting your" +
                    "entire form into the " + '<a href="' + validator_url +
                    '" target="_blank">Form Validator</a>';

                //_this.data.core.form.updateError({
                    //message: msg,
                    //level: "error"
                //});
                $.fancybox.hideActivity();
                throw e;
            }
            done();
        }, 500);
    };

    fn.disableUI = function () {
        this.flipUI(false);
    };

    fn.enableUI = function () {
        this.flipUI(true);
    };

    fn.flipUI = function (state) {
        var $props = this.$f.find('.fd-question-properties');
        if (state) {
            $props.show();
        } else {
            $props.hide();
        }
    };
        
    fn.loadXML = function (formXML) {
        var _this = this;
        this.data.core.form = form = parser.parseXForm(formXML, {
            mugTypes: this.data.core.mugTypes,
            allowedDataNodeReferences: this.opts().core.allowedDataNodeReferences, 
            externalInstances: this.opts().core.externalInstances
        }, this);
        form.formName = this.opts().core.formName || form.formName;

        form.on('question-type-change', function (e) {
            _this.jstree("set_type", e.qType, '#' + e.mug.ufid);

            if (e.mug === _this.getCurrentlySelectedMug()) {
                _this.refreshCurrentMug();
            }
        }).on('parent-question-type-change', function (e) {
            _this.overrideJSTreeIcon(e.childMug);
        }).on('question-move', function (e) {
            // for select items
            _this.overrideJSTreeIcon(e.mug);
        }).on('remove-question', function (e) {
            if (!e.isInternal) {
                _this.jstree("remove", '#' + e.mug.ufid);
                _this.selectSomethingOrHideProperties();
            }
        }).on('error-change', function (e) {
            _this._resetMessages(e.errors);
        }).on('question-create', function (e) {
            _this.createQuestion(e.mug, e.refMug, e.position);
            if (!e.isInternal) {
                _this.jstree('select_node', '#' + e.mug.ufid, true);
            }
        }).on('change', function (e) {
            try {
                if (e.mug) {
                    _this.setTreeValidationIcon(e.mug);
                }
            } catch (err) {
                // Some changes can temporarily leave the form in a state where
                // this will raise an exception (copying a question and you try
                // to get errors for it before all of its elements have been
                // populated).
                // It might be better to add an option for these changes not to
                // fire a change event.
            }

            _this.data.core.saveButton.fire('change');
        }).on('question-label-text-change', function (e) {
            _this.refreshMugName(e.mug);
            _this.toggleConstraintItext(e.mug);
        }).on('mug-property-change', function (e) {
            // The nodeID property for the current question successfully
            // changed, so it wasn't caught as a duplicate, so remove any
            // existing duplicate warning state.
            if (e.e.property === 'nodeID') {
                _this.setUnsavedDuplicateNodeId(false);
            }

            _this.refreshMugName(e.mug);
            _this.toggleConstraintItext(e.mug);
        });
    };

    fn.refreshMugName = function (mug, displayLang) {
        var $node = $('#' + mug.ufid),
            name = mug.getDisplayName(this.data.core.currentItextDisplayLanguage);
        if (name !== this.jstree("get_text", $node)) {
            this.jstree('rename_node', $node, name);
        }
    };

    fn.toggleConstraintItext = function (mug) {
        // todo: don't handle this one-off in the UI layer
        var state = (mug.p.constraintMsgItextID && 
                     (!mug.p.constraintMsgItextID.isEmpty() || 
                      mug.p.constraintAttr)),
            $constraintItext = $('.itext-block-constraintMsg');
        
        if (state) {
            $constraintItext.removeClass('hide');
        } else {
            $constraintItext.addClass('hide');
        }
    };

    fn.reloadTree = function () {
        var _this = this,
            form = this.data.core.form;

        // monkey patch jstree.create to be faster, see
        // https://groups.google.com/d/msg/jstree/AT8b9fWdBw8/SB3bXFwYbiQJ
        // Patching clean_node as described in the above link actually seems
        // to lead to a slight decrease in speed, and also messes up the
        // collapsibility of internal nodes, so we don't do that.
        var get_rollback = $.jstree._fn.get_rollback;
        $.jstree._fn.get_rollback = function(){};

        form.controlTree.treeMap(function (node) {
            if(node.isRootNode) {
                return;
            }
            var mug = node.getValue();
            _this.createQuestion(mug, mug.parentMug, 'into');
            _this.setTreeValidationIcon(mug);
        });
        //get list of pure data nodes and throw them in the Question UI tree
        //(at the bottom)
        var dataNodeList = form.getDataNodeList();
        for (var i = 0; i < dataNodeList.length; i++) {
            // make hidden values a flat list at the bottom.
            var mug = dataNodeList[i],
                refMug = (mug.parentMug && !mug.options.isDataOnly) ? 
                    mug.parentMug : null;
            _this.createQuestion(mug, refMug, 'into');
        }
        this.selectSomethingOrHideProperties(true);

        // restore original jstree behavior
        $.jstree._fn.get_rollback = get_rollback;
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
                this.hideContent();
                this.jstree('deselect_all');
                return false;
            }
        }

        return true;
    };
        
    fn._addQuestion = function (qType) {
        var _this = this;
        this.ensureCurrentMugIsSaved(function () {
            var foo = _this.getInsertTargetAndPosition(
                _this.getCurrentlySelectedMug(), qType);
            _this.data.core.form.createQuestion(foo[0], foo[1], qType);
        });
    };

    // Test ability to insert a new mug of type `qType` into refMug, then after
    // refMug, then after all of refMug's ancestors.  Delegates type checking to
    // JSTree types plugin.
    fn.getInsertTargetAndPosition = function (refMug, qType) {
        var position = 'into';
        if (qType === 'DataBindOnly') {
            // put data nodes at the end
            return [null, 'last'];
        } else if (refMug && refMug.__className === 'DataBindOnly') {
            // don't insert a regular node inside the data node range
            refMug = this.getLowestNonDataNodeMug();
            position = refMug ? 'after' : 'first';
        }

        while (true) {
            var r = refMug;
            if (refMug && position !== 'into' && position !== 'last') {
                r = refMug.parentMug;
            }
            var childTypes = r && typeData[r.__className].valid_children;
            if ((!r && validRootChildren.indexOf(qType) !== -1) ||
                (r && childTypes !== "none" && childTypes.indexOf(qType) !== -1))
            {
                break;
            } else if (r && position !== 'after') {
                position = 'after';
            } else {
                refMug = refMug ? refMug.parentMug: null;
                // root node
                if (!refMug) {
                    break;
                }
            }
        }
        return [refMug, position];
    };

    // todo: change this to use the model
    fn.getLowestNonDataNodeMug = function () {
        var questions = this.data.core.$tree.children().children()
                .filter("[rel!='DataBindOnly']");
        if (questions.length > 0) {
            return this.data.core.form.getMugByUFID(
                $(questions[questions.length - 1]).attr('id'));
        } else {
            return null;
        }
    };
    
    fn.createQuestion = function (mug, refMug, position) {
        var result = this.jstree("create",
            refMug ? "#" + refMug.ufid : this.data.core.$tree,
            position,
            {
                data: this.getMugDisplayName(mug),
                metadata: {
                    mug: mug,
                    mugUfid: mug.ufid
                },
                attr: {
                    id: mug.ufid,
                    rel: mug.__className
                },
                state: mug.options.isSpecialGroup ? 'open' : undefined
            },
            null, // callback
            true  // skip_rename
        );

        // jstree.create returns the tree root if types prevent creation
        if (result[0] === this.data.core.$tree) {
            throw new Error(
                "Can't insert " + mug.__className + " into " + refMug.__className +
                " (position: " + position + ")");
        }
        return result;  
    };

    fn.getMugByPath = function (path) {
        return this.data.core.form.getMugByPath(path);
    };
    
    fn.displayMugProperties = function (mug) {
        var $props = this.$f.find('.fd-question-properties'),
            _getWidgetClassAndOptions = function (property) {
                return getWidgetClassAndOptions(property, mug);
            };
        this.$f.find('.fd-default-panel').addClass('hide');

        /* update display */
        $props.animate({}, 200);

        this.showContent();
        this.hideQuestionProperties();

        var $content = this.$f.find(".fd-props-content").empty(),
            sections = this.getSections(mug);

        this.$f.find('.fd-props-toolbar').html(this.getMugToolbar(mug));
        for (var i = 0; i < sections.length; i++) {
            var section = sections[i];

            section.mug = mug;
            section.properties = _(section.properties)
                .map(_getWidgetClassAndOptions)
                .filter(_.identity);
           
            if (section.properties.length) {
                this.getSectionDisplay(mug, section)
                    .appendTo($content);
            }
        }

        $props.show();
        this.$f.find('.fd-help').fdHelp();

        this.toggleConstraintItext(mug);
        this.showVisualValidation(mug);
    };
        
    fn.hideQuestionProperties = function() {
        this.$f.find('.fd-question-properties').hide();
    };

    fn.showContent = function () {
        this.$f.find('.fd-content-right').show();
    };

    fn.hideContent = function () {
        this.$f.find('.fd-content-right').hide();
    };

    fn.displayXPathEditor = function(options) {
        var _this = this,
            $editor = this.$f.find('.fd-xpath-editor');

        options.DEBUG_MODE = DEBUG_MODE;
        this.hideQuestionProperties();

        var done = options.done;
        options.done = function (val) {
            done(val);
            _this.data.core.hasXPathEditorChanged = false;
            $editor.hide();
            _this.refreshCurrentMug();
        };
        options.change = function () {
            _this.data.core.hasXPathEditorChanged = true;
        };
        $editor.show();

        require(['vellum/expressionEditor'], function (expressionEditor) {
            expressionEditor.showXPathEditor(
                _this.$f.find('.fd-xpath-editor-content'), options);
        });
    };

    fn.alert = function (title, message, buttons) {
        buttons = buttons || [];
        if (this.data.core.isAlertVisible) {
            return;
        }

        var _this = this;
        this.data.core.isAlertVisible = true;

        var $modal = this.generateNewModal(
            title, buttons, buttons.length ? false : "OK");

        // store a reference to $modal on this so modal button actions can
        // reference it in order to hide it at the right point in time.  This is
        // a bit of a hack but any alternative is probably a lot more
        // complicated.
        this.data.core.$modal = $modal;

        $modal.removeClass('fade');
        $modal.find('.modal-body')
            .append($('<p />').text(message));
        $modal
            .modal('show')
            .on('hide', function () {
                _this.data.core.isAlertVisible = false;
            });
    };

    fn.showVisualValidation = function (mug) {
        var _this = this;
        //function setValidationFailedIcon(li, showIcon, message) {
            //var $li = $(li),
                //exists = ($li.find('.fd-props-validate').length > 0);
            //if (exists && showIcon) {
                //$li.find('.fd-props-validate').attr("title", message).addClass("ui-icon");
            //} else if (exists && !showIcon) {
                //$li.find('.fd-props-validate').removeClass('ui-icon').attr("title", "");
            //} else if (!exists && showIcon) {
                //var icon = $('<span class="fd-props-validate ui-icon ui-icon-alert"></span>');
                //icon.attr('title', message);
                //$li.append(icon);
            //}
        //}

        function findInputByReference(blockName, elementName) {
            // todo: make this work (it hasn't in a while)
            //return $('#' + blockName + '-' + elementName);
        }

        // for now form warnings get reset every time validation gets called.
        this.data.core.form.clearErrors('form-warning');
      
        this._resetMessages(
            this.data.core.form.errors.concat(
                _.map(this.getErrors(mug), function (error) {
                    return {
                        message: error,
                        level: "form-warning",
                    };
                })));
        this.setTreeValidationIcon(mug);
    };

    fn.getErrors = function (mug) {
        return mug.getErrors().concat(
            this.data.core.form._logicManager.getErrors(mug));
    };

    fn.getSectionDisplay = function (mug, options) {
        var _this = this,
            $sec = $(question_fieldset({
                fieldsetClass: "fd-question-edit-" + options.slug || "anon",
                fieldsetTitle: options.displayName,
                isCollapsed: !!options.isCollapsed,
                help: options.help || {}
            })),
            $fieldsetContent = $sec.find('.fd-fieldset-content');
        options.properties.map(function (prop) {
            var elemWidget = prop.widget(mug, $.extend(prop.options, {
                afterChange: function () {
                    _this.showVisualValidation(mug);
                },
                displayXPathEditor: function (options) {
                    _this.data.core.currentlyEditedProperty = prop.options.path;
                    _this.displayXPathEditor(options);
                }
            }));
            elemWidget.setValue(elemWidget.currentValue);
            $fieldsetContent.append(elemWidget.getUIElement());
        });
        return $sec;
    };
        
    fn.getMugToolbar = function (mug) {
        var _this = this;
        var $baseToolbar = $(question_toolbar({
            isDeleteable: this.isMugRemoveable(mug,
                    this.data.core.form.getAbsolutePath(mug)),
            isCopyable: mug.options.isCopyable
        }));
        $baseToolbar.find('.fd-button-remove').click(function () {
            var mug = _this.getCurrentlySelectedMug();
            _this.data.core.form.removeMugFromForm(mug);
        });
        $baseToolbar.find('.fd-button-copy').click(function () {
            _this.ensureCurrentMugIsSaved(function () {
                var duplicate = _this.data.core.form.duplicateMug(
                    _this.getCurrentlySelectedMug());

                _this.jstree("deselect_all")
                    .jstree("select_node", '#' + duplicate.ufid);
            });
        });
        $baseToolbar.find('.btn-toolbar.pull-left')
            .prepend(this.getQuestionTypeChanger(mug));

        return $baseToolbar;
    };

    fn.getQuestionTypeChanger = function (mug) {
        var _this = this;
        var getQuestionList = function (mug) {
            var currentType = mug.__className,
                questions = (mug.options.limitTypeChangeTo || 
                     _this.data.core.QUESTIONS_IN_TOOLBAR),
                ret = [];

            for (var i = 0; i < questions.length; i++) {
                var typeName = questions[i],
                    q = _this.data.core.mugTypes[typeName];
                if (q.isTypeChangeable && currentType !== typeName &&
                    (!q.limitTypeChangeTo || 
                     q.limitTypeChangeTo.indexOf(currentType) !== -1))
                {
                    ret.push({
                        slug: questions[i],
                        name: q.typeName,
                        icon: q.icon
                    });
                }
            }
            return ret;
        };
        var form = this.data.core.form,
            changeable = this.isMugTypeChangeable(mug, form.getAbsolutePath(mug));

        var $questionTypeChanger = $(question_type_changer({
            currentQuestionIcon: mug.getIcon(),
            currentTypeName: mug.options.typeName,
            questions: changeable ? getQuestionList(mug) : []
        }));
        $questionTypeChanger.find('.change-question').click(function (e) {
            try {
                _this.data.core.form.changeQuestionType(mug, $(this).data('qtype'));
            } catch (err) {
                alert("Sorry, " + err);
            }
            e.preventDefault();
        });
        $questionTypeChanger.addClass('fd-question-changer');
        return $questionTypeChanger;
    };

    fn.createXML = function () {
        return this.data.core.form.createXML();
    };

    fn.validateAndSaveXForm = function () {
        var _this = this,
            formText = this.createXML(),
            isValidXML = true;

        try {
            // ensure that form is valid XML; throws an error if not
            $.parseXML(formText);
        } catch (err) {
            isValidXML = false;
            formText = false;
            // something went wrong parsing, but maybe the user wants to save anyway
            // let's ask them with a scary message encouraging them not to.
            var theScaryWarning = "It looks like your form is not valid XML. This can " +
                "often happen if you use a reserved character in one of your questions. " +
                "Characters to look out for are <, >, and &. You can still save, but " +
                "you CANNOT LOAD THIS FORM again until you fix the XML by hand. " +
                "What would you like to do?";
            _this.setDialogInfo(theScaryWarning,
                'Fix the problem (recommended)', function () {
                    $(this).dialog("close");
                },
                'Save anyway', function () {
                    $(this).dialog("close");
                    _this.send(formText);
                },
                'Form Validation Error');
            this._showConfirmDialog();
        }

        if (isValidXML) {
            this.send(formText);
        }
    };
        
    fn.send = function (formText, saveType) {
        var CryptoJS = require('CryptoJS'),
            _this = this,
            opts = this.opts().core,
            patch, data;
        saveType = saveType || opts.saveType;

        var url = saveType === 'patch' ?  opts.patchUrl : opts.saveUrl;

        $(document).ajaxStart(function () {
            _this.showWaitingDialog();
        });
        $(document).ajaxStop(function () {
            _this._hideConfirmDialog();
        });

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

        this.data.core.saveButton.ajax({
            type: "POST",
            url: url,
            data: data,
            dataType: 'json',
            success: function (data) {
                if (saveType === 'patch') {
                    if (data.status === 'conflict') {
                        /* todo: display diff and ask instead overwriting */
//                            var diffHtml = dmp.diff_prettyHtml(
//                                dmp.diff_main(lastSavedXForm, data.xform)
//                            );
                        _this.send(formText, 'full');
                    } else if (CryptoJS.SHA1(formText).toString() !== data.sha1) {
                        console.error("sha1's didn't match");
                        _this.send(formText, 'full');
                    }
                }
                _this._hideConfirmDialog();
                _this.opts().core.onFormSave(data);
                _this.data.core.lastSavedXForm = formText;
            }
        });
    };

    fn.showWaitingDialog = function (msg) {
        var dial = $('.fd-dialog-confirm'), contentStr;
        if (!msg || typeof msg !== 'string') {
            msg = 'Saving form to server...';
        }
        dial.empty();
        dial.dialog("destroy");
        dial.dialog({
            modal: true,
            autoOpen: false,
            buttons : {},
            closeOnEscape: false,
            open: function(event) {
                // where in the DOM are these?
                $(".ui-dialog-titlebar-close").hide();
            },
            close: function(event) {
                $(".ui-dialog-titlebar-close").show();
            },
            title: "Processing..."
        });
        contentStr = '<p><span class="fd-message">' + msg + 
            '</span><div class="fd-form-saving-anim"></div></p>';
        dial.append(contentStr);
        dial.find('.fd-form-saving-anim').append(
            '<span class="fd-form-saving-img"></span>');

        this._showConfirmDialog();
    };

    fn.getSections = function (mug) {
        return [
            {
                slug: "main",
                displayName: "Basic",
                properties: this.getMainProperties(),
                help: {
                    title: "Basic",
                    text: "<p>The <strong>Question ID</strong> is an internal identifier for a question. " +
                        "It does not appear on the phone. It is the name of the question in data exports.</p>" +
                        "<p>The <strong>Label</strong> is text that appears in the application. " +
                        "This text will not appear in data exports.</p> " +
                        "<p>Click through for more info.</p>",
                    link: "https://confluence.dimagi.com/display/commcarepublic/Form+Builder"
                }
            },
            {
                slug: "data_source",
                displayName: "Data Source",
                properties: this.getDataSourceProperties(),
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
                isCollapsed: false,
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
            "defaultValue",
            "label",
            "showOKCheckbox",
            "readOnlyControl",
            "androidIntentAppId",
            "androidIntentExtra",
            "androidIntentResponse"
        ];
    };

    fn.getDataSourceProperties = function () {
        return [
            "itemsetData"
        ];
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
            "no_add_remove"
        ];
    };

    fn.getAdvancedProperties = function () {
        return [
            "dataValue",
            "xmlnsAttr",
            "label",
            "hintLabel",
            "constraintMsgAttr",
        ];
    };

    function getWidgetClassAndOptions(propPath, mug) {
        var propDef = mug.p.getDefinition(propPath),
            propVal = mug.p[propPath];

        // handle properties whose visibility depends on other properties'
        // visibility (implied visible_if_present on the depending property
        // takes precedence)
        if (_.isUndefined(propVal) &&
            propDef && propDef.visibility &&
            mug.p.getDefinition(propDef.visibility) &&
                !getWidgetClassAndOptions(propDef.visibility, mug))
        {
            return null;
        }

        if (!propDef || 
            (_.isUndefined(propVal) &&
             (propDef.visibility === "visible_if_present" ||
              propDef.presence === "notallowed")))
        {
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

    fn.handleMugRename = function (form, mug, val, previous, currentPath, oldPath) {
        form.handleMugRename(form, mug, val, previous, currentPath, oldPath);
    };

    fn.beforeSerialize = function () {
        // gets extended in plugins
    
    };

    fn.parseDataElement = function (form, el, parentMug) {
        return parser.parseDataElement(form, el, parentMug);
    };

    fn.parseBindElement = function (form, el, path) {
        return parser.parseBindElement(form, el, path);
    };

    fn.parseControlElement = function (form, path, $el, $parentEl) {
        return parser.parseControlElement(form, path, $el, $parentEl);
    };

    fn.contributeToModelXML = function (xmlWriter) {
    
    };

    fn.initWidget = function (widget) {
    
    };

    $.vellum.plugin("core", {
        form: null,
        patchUrl: false,
        saveUrl: false,
        saveType: 'full',
        staticPrefix: "",
        allowedDataNodeReferences: [],
        externalInstances: [],
        noTextString: '[no text]',
        onReady: function () {},
        onFormSave: function (data) {},
        bindBeforeUnload: function (handler) {
            $(window).bind('beforeunload', handler);
        }
    }, fn);
});
