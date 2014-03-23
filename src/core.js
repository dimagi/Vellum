// the UI/ViewModel

define([
    'text!./templates/main.html',
    'tpl!./templates/question_type_group',
    'tpl!./templates/edit_source',
    'tpl!./templates/control_group_stdInput',
    'tpl!./templates/question_fieldset',
    'tpl!./templates/question_type_changer',
    'tpl!./templates/question_toolbar',
    'tpl!./templates/alert_global',
    'tpl!./templates/modal_content',
    'tpl!./templates/modal_button',
    './mugs',
    './widgets',
    './parser',
    './expressionEditor',
    './util',
    'save-button',
    'underscore',
    'codemirror',
    'diff-match-patch',
    'CryptoJS',
    'xpathmodels',
    'jquery',
    './base',
    'jquery.jstree',
    'jquery.fancybox',  // only thing we use fancybox for is its spinner, no actual display of anything
    'jquery-ui',  // should only be needed for buttons in Edit Source XML
    'less!./less-style/main'
], function (
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
    parser,
    expressionEditor,
    util,
    SaveButton,
    _,
    CodeMirror,
    diff_match_patch,
    CryptoJS,
    xpathmodels,
    $
) {
    var noTextString = '[no text]',
        DEBUG_MODE = false,
        MESSAGES_DIV = '#fd-messages',
        mugTypes = mugs.mugTypes;
    
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
    var QUESTION_GROUPS = [
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
            questions: [
                "Select",
                "MSelect",
                "SelectDynamic",
                "MSelectDynamic"
            ]
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
            showDropdown: false,
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

    var QUESTIONS_IN_TOOLBAR = [];
    var QUESTION_TYPE_TO_GROUP = {};
    // this is necessary (as opposed to getting it from the mug at the same
    // time as node creation) because jstree types are used to determine whether
    // it's a valid insertion, so the mug can't be found in the form by node
    // id at the point in time we might otherwise want to use it. Would be good
    // to instead store create dummy mugs to get their properties / get it
    // from the prototype if we were using prototypical inheritance.
    _.each(QUESTION_GROUPS, function (groupData) {
        var groupSlug = groupData.group[0];

        var getQuestionData = function (questionType) {
            var mug = mugTypes[questionType],
                questionData = [questionType, mug.prototype.typeName, mug.prototype.icon];
            
            QUESTIONS_IN_TOOLBAR.push(questionType);
            QUESTION_TYPE_TO_GROUP[questionType] = groupSlug;
            return questionData;
        };
        
        groupData.questions = _.map(groupData.questions, getQuestionData);
        if (groupData.related && groupData.related.length) {
            groupData.related = _.map(groupData.related, getQuestionData);
        }

        if (typeof groupData.group[2] === 'undefined') {
            groupData.group[2] = mugTypes[groupData.group[0]].prototype.icon;
        }
    });

    var getQuestionTypeGroupID = function (slug) {
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
            groupID = getQuestionTypeGroupID(defaultQuestion.slug);

        var $questionGroup = $(question_type_group({
            groupID: groupID,
            showDropdown: groupData.showDropdown || true,
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
        mugs.setSpec(this.getMugSpec());
        var _this = this,
            bindBeforeUnload = this.opts().core.bindBeforeUnload;
        // opts.allowLanguageEdits = !(opts["langs"] && opts["langs"].length > 0
        // && opts["langs"][0] !== "");
        // opts.langs = opts.allowLanguageEdits ? null : opts.langs;  //clean up
        // so it's definitely an array with something or null.
        this.data.core.saveButton = SaveButton.init({
            save: function() {
                if (!_this.currentMugHasUnsavedChanges()) {
                    _this.validateAndSaveXForm();
                }
            },
            unsavedMessage: 'Are you sure you want to exit? All unsaved changes will be lost!'
        });
        bindBeforeUnload(this.data.core.saveButton.beforeunload);
        this.data.core.currentErrors = [];

        this.data.core.lastSavedXForm = this.opts().core.form;

        var root = $("#formdesigner");
        root.empty().append(main_template);

        this._init_toolbar();
        this._init_extra_tools();
        this._createJSTree();
        this._init_modal_dialogs();
        this._setup_fancybox();
    };

    fn.postInit = function () {
        this._loadXFormOrError(this.opts().core.form);
    };
        
    fn._init_toolbar = function () {
        var _this = this,
            toolbar = $(".fd-toolbar");

        var $questionGroupContainer = $('#fd-container-question-type-group');

        _.each(QUESTION_GROUPS, function (groupData) {
            var questionGroup = new QuestionTypeGroup(groupData, _this);
            $questionGroupContainer.append(questionGroup);
        });

        var $saveButtonContainer = $('#fd-save-button');
        this.data.core.saveButton.ui.appendTo($saveButtonContainer);
    };

    fn._init_extra_tools = function () {
        var _this = this,
            menuItems = this.getToolsMenuItems();

        var $toolsMenu = $("#fd-tools-menu");
        $toolsMenu.empty();
        _(menuItems).each(function (menuItem) {
            var $a = $("<a tabindex='-1' href='#'>" + menuItem.name + "</a>").click(
                function (e) {
                    e.preventDefault();
                    if (_this.currentMugHasUnsavedChanges()) {
                        return;
                    }

                    menuItem.action(_this.data.core.form, function () {
                        _this.refreshVisibleData();
                    });
                }
            );
            $("<li></li>").append($a).appendTo($toolsMenu);
        });

        $("#fd-expand-all").click(function() {
            _this.data.core.$tree.jstree("open_all");
        });

        $("#fd-collapse-all").click(function() {
            _this.data.core.$tree.jstree("close_all");
        });
    };

    fn.getToolsMenuItems = function () {
        var _this = this;
        return [
            {
                name: "Export Form Contents",
                action: function () {
                    _this.showExportDialog();
                }
            },
            {
                name: "Edit Source XML",
                action: function () {
                    _this.showSourceXMLDialog();
                }
            },
            {
                name: "Form Properties",
                action: function () {
                    _this.showFormPropertiesDialog();
                }
            }
        ];
    };

    // should switch to use jstree languages plugin
    fn.refreshVisibleData = function () {
        // update any display values that are affected
        var _this = this,
            allMugs = this.data.core.form.getMugList(true),
            currLang = this.data.core.currentItextDisplayLanguage;
        allMugs.map(function (mug) {
            var node = $('#' + mug.ufid),
                it = mug.controlElement ? mug.controlElement.labelItextID : null;
            var treeName = (it) ? it.getValue("default", currLang) : _this.getMugDisplayName(mug);
            treeName = treeName || _this.getMugDisplayName(mug);
            if (treeName !== _this.jstree("get_text", node)) {
                _this.jstree('rename_node', node, treeName);
            }
        });

        var curMug = _this.getCurrentlySelectedMug();
        if (curMug) {
            _this.displayMugProperties(curMug);
        }
    };

    fn.getMugDisplayName = function (mug) {
        return mug.getDisplayName(
            this.data.core.currentItextDisplayLanguage || 
            this.data.javaRosa.Itext.getDefaultLanguage());
    };

    var showConfirmDialog = function () {
        $("#fd-dialog-confirm").dialog("open");
    };

    var hideConfirmDialog = function () {
        $("#fd-dialog-confirm").dialog("close");
    };

    /**
     * Set the values for the Confirm Modal Dialog
     * (box that pops up that has a confirm and cancel button)
     * @param confButName
     * @param confFunction
     * @param cancelButName
     * @param cancelButFunction
     */
    fn.setDialogInfo = function (message, confButName, confFunction,
                                 cancelButName, cancelButFunction, title) {
        title = title || "";
        var buttons = {}, opt,
                dial = $('#fd-dialog-confirm'), contentStr;
        buttons[confButName] = confFunction;
        buttons[cancelButName] = cancelButFunction;

        dial.empty();
        contentStr = '<p>' +
                '<span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>' +
                '<span class="fd-message">These items will be permanently deleted and cannot be recovered. Are you sure?</span></p>';
        dial.append(contentStr);
        if (!message || typeof(message) !== "string") {
            message = "";
        }
        $('#fd-dialog-confirm .fd-message').text(message);
        $("#fd-dialog-confirm").dialog("option", {buttons: buttons, "title": title});
    };

    fn.showSourceXMLDialog = function (done, form) {
        var _this = this;
        // There are validation errors but user continues anyway
        function onContinue () {
            hideConfirmDialog();
            _this.showSourceInModal();
        }

        function onAbort () {
            hideConfirmDialog();
        }

        var msg = "There are validation errors in the form.  Do you want to continue anyway? WARNING:" +
                  "The form will not be valid and likely not perform correctly on your device!";

        this.setDialogInfo(msg, 'Continue', onContinue, 'Abort', onAbort);
        if (!this.data.core.form.isFormValid()) {
            showConfirmDialog();
        } else {
            this.showSourceInModal();
        }
    };

    fn.showSourceInModal = function () {
        var _this = this,
            $modal, $updateForm, $textarea, codeMirror, modalHeaderHeight,
            modalFooterHeight, modalHeight, modalBodyHeight;

        $modal = util.generateNewModal("Edit Form's Source XML", [
            {
                id: 'fd-update-source-button',
                title: "Update Source",
                cssClasses: "btn-primary"
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
            $textarea.val(this.data.core.form.createXML());
        } else {
            $textarea.val(this.data.core.failedLoadXML);
        }

        try {
            codeMirror = CodeMirror.fromTextArea($textarea.get(0));
            codeMirror.setOption('viewportMargin', Infinity);
            codeMirror.setOption('lineNumbers', true);
            codeMirror.setSize('100%', '100%');
        } catch (e) {
            // pass
        }

        $modal.find('#fd-update-source-button').click(function () {
            if (codeMirror) {
                codeMirror.save();
            }
            _this._loadXFormOrError($textarea.val());
            $modal.modal('hide');
        });

        $modal.modal('show');
        $modal.on('shown', function () {
            if (codeMirror) {
                codeMirror.refresh();
            }
        });
    };

    fn.showExportDialog = function(done, form) {
        var $modal,
            $exportForm;

        $modal = util.generateNewModal("Export Form Contents", []);
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
            $modal = util.generateNewModal("Edit Form Properties", []),
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
                label: prop.label,
                controlId: 'fd-form-prop-' + prop.slug + '-input'
            }));
            $modalBody.append($propertyInput);
            $propertyInput.find('input')
                .val(_this.data.core.form[prop.slug])
                .on('keyup', function () {
                    var currentVal = $(this).val();
                    if (typeof prop.cleanValue === 'function') {
                        currentVal = prop.cleanValue(currentVal);
                        $(this).val(currentVal);
                    }
                    _this.data.core.form.setAttr(prop.slug, currentVal);
                });
        });

        $modal.modal('show');
    };

    fn._init_modal_dialogs = function () {
        $("#fd-dialog-confirm").dialog({
            resizable: false,
            modal: true,
            buttons: {
                "Confirm": function() {
                    $(this).dialog("close");
                },
                Cancel: function() {
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
            onClosed: function() {
            }
        });
    };
        

        
    fn._resetMessages = function (errors) {
        var error, messages_div = $(MESSAGES_DIV);
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
  
    function warnOnCircularReference(propertyPath, form, mug, path) {
        var parts = propertyPath.split('/'),
            group = parts[0],
            property = parts[1];

        if (path === "." && group === "bindElement" && (
            property === "relevantAttr" ||
            property === "calculateAttr"
        )) {
            var fieldName = mug.getPropertyDefinition(
                    'bindElement/' + property).lstring;
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
        _(mugTypes).each(function (Mug, typeName) {
            typeData[typeName] = {
                max_children: Mug.prototype.maxChildren,
                valid_children: 
                    Mug.prototype.validChildTypes.length ?  
                    Mug.prototype.validChildTypes : "none"
            };
        });
        validRootChildren = mugTypes.Group.prototype.validChildTypes.concat(
            ['DataBindOnly']);

        var _this = this;
        this.data.core.$tree = $tree = $('#fd-question-tree');
        $tree.jstree({
            "json_data" : {
                "data" : []
            },
            "core": {
                strings: {
                    new_node: noTextString
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

                        if (refIsData + nodeIsData == 1) {
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

                    if (mug && ops && mug.defaultOperator) {
                        ops.val(mug.defaultOperator);
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
            _this.activateQuestionTypeGroup(mug);
        }).bind("move_node.jstree", function (e, data) {
            var form = _this.data.core.form,
                mug = form.getMugByUFID($(data.rslt.o).attr('id')),
                refMug = form.getMugByUFID($(data.rslt.r).attr('id')),
                position = data.rslt.p;

            form.moveMug(mug, refMug, position);

            _this.displayMugProperties(_this.getCurrentlySelectedMug());
        }).bind("deselect_all.jstree deselect_node.jstree", function (e, data) {
            _this.resetQuestionTypeGroups();
        }).bind('before.jstree', function (e, data) {
            var stop = function () {
                e.stopImmediatePropagation();
                return false;
            };

            if (data.func === 'select_node' && _this.currentMugHasUnsavedChanges()) {
                return stop();
            }

            if (data.func === 'move_node' && data.args[0].jquery) {
                if (_this.currentMugHasUnsavedChanges()) {
                    return stop();
                }
                var form = _this.data.core.form,
                    mug = form.getMugByUFID($(data.args[0]).attr('id')),
                    refMug = form.getMugByUFID($(data.args[1]).attr('id')),
                    position = data.args[2],
                    parentMug;

                // disallow moving a node if it would have the same ID as a sibling
                if (mug.dataElement) {
                    if (['into', 'first', 'last'].indexOf(position) !== -1) {
                        parentMug = refMug;
                    } else {
                        parentMug = refMug.parentMug;
                    }

                    var nodeID = mug.dataElement.nodeID,
                        childMug = form.getMugChildByNodeID(parentMug, nodeID);
                    if (childMug && childMug !== mug) {
                        _this.setUnsavedDuplicateNodeId(nodeID, true);
                        // trigger alert
                        _this.currentMugHasUnsavedChanges(function () {
                            _this.setUnsavedDuplicateNodeId(false);
                        });
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

    var setTreeNodeInvalid = function (uid, msg) {
        $($('#' + uid)[0]).append('<div class="ui-icon ui-icon-alert fd-tree-valid-alert-icon" title="' + msg + '"></div>');
    };

    var setTreeNodeValid = function (uid) {
        $($('#' + uid)[0]).find(".fd-tree-valid-alert-icon").remove();
    };

    fn.setTreeValidationIcon = function (mug) {
        var errors = mug.getErrors();
        if (!errors.length) {
            setTreeNodeValid(mug.ufid);
        } else {
            var message = _(errors).pluck("message").join("<p>").replace(/"/g, "'");
            setTreeNodeInvalid(mug.ufid, message);
        }
    };

    fn.setAllTreeValidationIcons = function () {
        //clear existing warning icons to start fresh.
        this.data.core.$tree.find('.fd-tree-valid-alert-icon').remove();
        
        _(this.data.core.form.getInvalidMugUFIDs()).each(function (messages, ufid) {
            var message = messages.join("<p>").replace(/"/g, "'");
            setTreeNodeInvalid(ufid, message);
        });
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
            return '"' + mug.controlElement.defaultValue + '"';
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
        if (typeof mug.getIcon === 'undefined') {
            iconClass = mug.constructor.prototype.icon;
        } else {
            iconClass = mug.getIcon();
        }
        iconClass = iconClass || 'icon-circle';
        if (!$questionNode.find('> a > ins').hasClass(iconClass)) {
            $questionNode.find('> a > ins')
                .attr('class', 'jstree-icon')
                .addClass(iconClass);
        }
        this.activateQuestionTypeGroup(mug);
    };

    fn.activateQuestionTypeGroup = function (mug) {
        this.resetQuestionTypeGroups();

        var className = mug.__className || mug.prototype.__className,
            groupSlug = QUESTION_TYPE_TO_GROUP[className];
        if (groupSlug && className !== 'MSelectDynamic' && className !== 'SelectDynamic') {
            var $questionGroup = $('#' + getQuestionTypeGroupID(groupSlug));
            $questionGroup.find('.fd-question-type-related').removeClass('disabled');
        }
    };

    fn.resetQuestionTypeGroups = function () {
        var $questionGroupContainer = $('#fd-container-question-type-group');
        $questionGroupContainer.find('.fd-question-type-related')
            .addClass('disabled');
    };

    fn.setUnsavedDuplicateNodeId = function (nodeId, forMove) {
        this.data.core.unsavedDuplicateNodeId = nodeId;
        this.data.core.duplicateIsForMove = forMove;
    };

    fn.currentMugHasUnsavedChanges = function (callback) {
        var duplicate = this.data.core.unsavedDuplicateNodeId,
            duplicateIsForMove = this.data.core.duplicateIsForMove,
            ret = false;

        if (this.data.core.hasXPathEditorChanged) {
            this.alert(
                "Unsaved Changes in Editor",
                "You have UNSAVED changes in the Expression Editor. Please save "+
                "changes before continuing.");
            ret = true;
        } else if (duplicate) {
            var verb = duplicateIsForMove ? 'would be' : 'is';
            this.alert(
                "Duplicate Question ID",
                "'" + duplicate + "' " + verb + " the same Question ID as another question " +
                "belonging to the same parent question. Please change '" + duplicate +
                "' to a unique Question ID before continuing.");
            ret = true;
        }

        if (callback) {
            callback();
        }

        return ret;
    };


    fn._loadXFormOrError = function (formString) {
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
                } else {
                    $('#fd-default-panel').removeClass('hide');
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
                var showSourceButton = $('#fd-editsource-button');
                //disable all buttons and inputs
                _this.disableUI();
                //enable the view source button so the form can be tweaked by
                //hand.
                showSourceButton.button('enable');

                _this.setDialogInfo(msg, 
                    'ok', function() {
                        hideConfirmDialog();
                    }, 
                    'cancel', function(){
                        hideConfirmDialog();
                    });
                showConfirmDialog();
                
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

                _this.data.core.form.updateError({
                    message: msg,
                    level: "error"
                });
                $.fancybox.hideActivity();
                throw e;
            }
        }, 500);
    };

    fn.disableUI = function () {
        flipUI(false);
    };

    fn.enableUI = function () {
        flipUI(true);
    };

    function flipUI(state) {
        //var butState;
        //we need a button State variable since it uses different syntax for disabling
        //(compared to input widgets)
        //if (state) {
            //butState = 'enable';
        //} else {
            //butState = 'disable';
        //}
        // TODO: in making fd-save-button controlled by saveButton, do we need to do anything explicit here?
//        $('#fd-save-button').button(butState);

        /*
        $('#fd-lang-disp-add-lang-button').button(butState);
        $('#fd-lang-disp-remove-lang-button').button(butState);
        */

        //other stuff
        if (state) {
            $('#fd-question-properties').show();
        } else {
            $('#fd-question-properties').hide();
        }

    }
        
    fn.loadXML = function (formXML) {
        var _this = this;
        this.data.core.form = form = parser.parseXForm(formXML, {
            allowedDataNodeReferences: this.opts().core.allowedDataNodeReferences, 
            externalInstances: this.opts().core.externalInstances
        }, this);
        form.formName = this.opts().core.formName || form.formName;

        form.on('question-type-change', function (e) {
            _this.jstree("set_type", e.qType, '#' + e.mug.ufid);
            // update question type changer
            var $currentChanger = $('#fd-question-changer');
            $currentChanger.after(_this.getQuestionTypeChanger(e.mug))
                .remove();
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
            if (e.mug) {
                _this.setTreeValidationIcon(e.mug);
            }
            _this.data.core.saveButton.fire('change');
        }).on('question-text-change', function (e) {
            var $node = $('#' + e.mugUfid);
            if (e.text !== _this.jstree("get_text", $node)) {
                _this.jstree('rename_node', $node, e.text);
            }
        }).on('mug-property-change', function (e) {
            var mug = e.mug;
            e = e.e;

            if (mug.bindElement) {
                if (e.property === 'constraintAttr' && 
                    (mug.__className !== "DataBindOnly")) 
                {
                    _this.toggleConstraintItextBlock(!!e.val);
                }

                if (e.property === 'constraintMsgItextID' && !e.val.id && 
                    !mug.bindElement.constraintAttr)
                {
                    _this.toggleConstraintItextBlock(false);
                }
            }
        });
    };

    fn.toggleConstraintItextBlock = function (bool) {
        var $constraintItext = $('#itext-block-constraintMsg');
        
        if (bool) {
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
        });
        //get list of pure data nodes and throw them in the Question UI tree
        //(at the bottom)
        var dataNodeList = form.getDataNodeList();
        for (var i = 0; i < dataNodeList.length; i++) {
            // check for control element because we want data nodes to be a flat
            // list at bottom.
            var mug = dataNodeList[i],
                refMug = mug.parentMug && mug.controlElement
                    ? mug.parentMug : null;
            _this.createQuestion(mug, refMug, 'into');
        }
        this.setAllTreeValidationIcons();
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
        if (this.currentMugHasUnsavedChanges()) {
            return;
        }
        var foo = this.getInsertTargetAndPosition(
            this.getCurrentlySelectedMug(), qType);
        this.data.core.form.createQuestion(foo[0], foo[1], qType);
    };

    // Test ability to insert a new mug of type `qType` into refMug, then after
    // refMug, then after all of refMug's ancestors.  Delegates type checking to
    // JSTree types plugin.
    fn.getInsertTargetAndPosition = function (refMug, qType) {
        var position = 'into';
        if (qType === 'DataBindOnly') {
            // put data nodes at the end
            refMug = null;
            position = 'last';
        } else if (refMug && !refMug.controlElement) {
            // don't insert a regular node inside the data node range
            refMug = this.getLowestNonDataNodeMug();
            position = 'after';
        }

        while (true) {
            var r = refMug;
            if (position !== 'into' && position !== 'last') {
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
        var rootId = this.data.core.$tree.attr('id');
        var result = this.jstree("create",
            refMug ? "#" + refMug.ufid : rootId,
            position,
            {
                data: this.getMugDisplayName(mug),
                metadata: {
                    mug: mug,
                    mugUfid: mug.ufid,
                    dataID: mug.getDataElementID(),
                    bindID: mug.getBindElementID()
                },
                attr: {
                    id: mug.ufid,
                    rel: mug.__className
                },
                state: mug.isSpecialGroup ? 'open' : undefined
            },
            null, // callback
            true  // skip_rename
        );

        // jstree.create returns the tree root if types prevent creation
        return result && result[0].id !== rootId;  
    };
    
    fn.displayMugProperties = function (mug) {
        $('#fd-default-panel').addClass('hide');

        /* update display */
        $('#fd-question-properties').animate({}, 200);

        this.showContent();
        this.hideQuestionProperties();

        var $content = $("#fd-props-content").empty(),
            questionToolbar = this.getToolbarForMug(mug),
            sections = this.getSections(mug);

        $('#fd-props-toolbar').html(questionToolbar);
        for (var i = 0; i < sections.length; i++) {
            var section = sections[i];

            section.mug = mug;
            section.properties = _(section.properties)
                .map(function (property) {
                    return getWidgetClassAndOptions(property, mug);
                })
                .filter(_.identity);
           
            if (section.properties.length) {
                this.getSectionDisplay(mug, section)
                    .appendTo($content);
            }
        }

        $("#fd-question-properties").show();
        $('.fd-help').fdHelp();

        var $validationCondition = $('#bindElement-constraintAttr');
        if ($validationCondition && !$validationCondition.val()) {
            this.toggleConstraintItextBlock(false);
        }

        this.showVisualValidation(mug);
    };
        
    fn.hideQuestionProperties = function() {
        $("#fd-question-properties").hide();
    };

    fn.showContent = function () {
        $(".fd-content-right").show();
    };

    fn.hideContent = function () {
        $(".fd-content-right").hide();
    };

    fn.displayXPathEditor = function(options) {
        var _this = this;
        options.DEBUG_MODE = DEBUG_MODE;
        this.hideQuestionProperties();

        var done = options.done;
        options.done = function (val) {
            done(val);
            _this.data.core.hasXPathEditorChanged = false;
            _this.displayMugProperties(_this.getCurrentlySelectedMug());
        };
        var editor = expressionEditor.showXPathEditor(options);
        editor.on('change', function () {
            _this.data.core.hasXPathEditorChanged = true;
        });
    };

    fn.alert = function (title, message) {
        if (this.data.core.isAlertVisible) return;

        var _this = this;
        this.data.core.isAlertVisible = true;

        var $modal = util.generateNewModal(title, [], "OK");
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
        function setValidationFailedIcon(li, showIcon, message) {
            var exists = ($(li).find('.fd-props-validate').length > 0);
            if (exists && showIcon) {
                $(li).find('.fd-props-validate').attr("title", message).addClass("ui-icon");
            } else if (exists && !showIcon) {
                $(li).find('.fd-props-validate').removeClass('ui-icon').attr("title", "");
            } else if (!exists && showIcon) {
                var icon = $('<span class="fd-props-validate ui-icon ui-icon-alert"></span>');
                icon.attr('title', message);
                li.append(icon);
            }
            return li;
        }


        function findInputByReference(blockName, elementName) {
            // todo: make this work (it hasn't in a while)
            return $('#' + blockName + '-' + elementName);
        }

        // for now form warnings get reset every time validation gets called.
        this.data.core.form.clearErrors('form-warning');
       
        var errors = this.getVisibleErrors(mug);

        _(errors).each(function (error) {
            var input = findInputByReference(name, "foo-id");  // todo: make work
            setValidationFailedIcon(input.parent(), true, error);
            _this.data.core.form.updateError({
                message: error,
                level: 'form-warning'
            });
        });
        this._resetMessages(this.data.core.form.errors);
    };

    fn.getVisibleErrors = function (mug) {
        return mug.getErrors();
    };

    fn.getSectionDisplay = function (mug, options) {
        var _this = this,
            $sec = $(question_fieldset({
            fieldsetId: "fd-question-edit-" + options.slug || "anon",
            fieldsetTitle: options.displayName,
            isCollapsed: !!options.isCollapsed,
            help: options.help || {}
        })),
            $fieldsetContent = $sec.find('.fd-fieldset-content');
        options.properties.map(function (prop) {
            var elemWidget = prop.widget(mug, $.extend(prop.options, {
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
        
    fn.getToolbarForMug = function (mug) {
        var _this = this;
        var $baseToolbar = $(question_toolbar({
            isDeleteable: this.isMugRemoveable(mug,
                    this.data.core.form.getAbsolutePath(mug)),
            isCopyable: mug.isCopyable
        }));
        $baseToolbar.find('#fd-button-remove').click(function () {
            var mug = _this.getCurrentlySelectedMug();
            _this.data.core.form.removeMugFromForm(mug);
        });
        $baseToolbar.find('#fd-button-copy').click(function () {
            if (_this.currentMugHasUnsavedChanges()) {
                return;
            }

            var duplicate = _this.data.core.form.duplicateMug(
                _this.getCurrentlySelectedMug(),
                {itext: 'copy'});

            _this.jstree("deselect_all")
                .jstree("select_node", '#' + duplicate.ufid);
        });
        $baseToolbar.find('.btn-toolbar.pull-left')
            .prepend(this.getQuestionTypeChanger(mug));

        return $baseToolbar;
    };

    fn.getQuestionTypeChanger = function (mug) {
        var _this = this;
        var getQuestionList = function (mug) {
            var questions = mug.limitTypeChangeTo || QUESTIONS_IN_TOOLBAR,
                ret = [];

            for (var i = 0; i < questions.length; i++) {
                var q = mugTypes[questions[i]];
                if (q.prototype.isTypeChangeable && mug.$class.prototype !== q.prototype) {
                    ret.push({
                        slug: questions[i],
                        name: q.prototype.typeName,
                        icon: q.prototype.icon
                    });
                }
            }
            return ret;
        };
        var form = this.data.core.form,
            changeable = this.isMugTypeChangeable(mug, form.getAbsolutePath(mug));

        var $questionTypeChanger = $(question_type_changer({
            currentQuestionIcon: mug.getIcon(),
            currentTypeName: mug.typeName,
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
        $questionTypeChanger.attr('id', 'fd-question-changer');
        return $questionTypeChanger;
    };

    fn.validateAndSaveXForm = function () {
        var _this = this,
            formText = false;
        formText = this.data.core.form.createXML();
        try {
            // ensure that form is valid XML; throws an error if not
            $.parseXML(formText);
            this.send(formText);
        } catch (err) {
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
            showConfirmDialog();
        }
    };
        
    fn.send = function (formText, saveType) {
        var _this = this,
            opts = this.opts().core,
            data;
        saveType = saveType || opts.saveType;

        var url = saveType === 'patch' ?  opts.patchUrl : opts.saveUrl;

        $('body').ajaxStart(function () {
            this.showWaitingDialog();
        });
        $('body').ajaxStop(function () {
            hideConfirmDialog();
        });

        if (saveType === 'patch') {
            var dmp = new diff_match_patch();
            var patch = dmp.patch_toText(
                dmp.patch_make(this.data.core.lastSavedXForm, formText)
            );
            // abort if diff too long and send full instead
            if (patch.length > formText.length && opts.saveUrl) {
                saveType = 'full';
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
                hideConfirmDialog();
                _this.data.core.lastSavedXForm = formText;
            }
        });
    };

    fn.showWaitingDialog = function (msg) {
        var dial = $('#fd-dialog-confirm'), contentStr;
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
                $(".ui-dialog-titlebar-close").hide();
            },
            close: function(event) {
                $(".ui-dialog-titlebar-close").show();
            },
            title: "Processing..."
        });
        contentStr = '<p><span class="fd-message">' + msg + 
            '</span><div id="fd-form-saving-anim"></div></p>';
        dial.append(contentStr);
        $('#fd-form-saving-anim').append(
            '<img src="' + this.opts().core.staticPrefix + 
            'images/ajax-loader.gif" id="fd-form-saving-img"/>');

        showConfirmDialog();
    };

    fn.getSections = function (mug) {
        return [
            {
                slug: "main",
                displayName: "Basic",
                properties: this.getMainProperties(),
                help: {
                    title: "Basic",
                    text: "<p>The <strong>Question ID</strong> is a unique identifier for a question. " +
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
            "dataElement/nodeID",
            "controlElement/defaultValue",
            "controlElement/label",
            "controlElement/showOKCheckbox",
            "controlElement/readOnlyControl",
            "controlElement/androidIntentAppId",
            "controlElement/androidIntentExtra",
            "controlElement/androidIntentResponse"
        ];
    };

    fn.getDataSourceProperties = function () {
        return [
            "controlElement/itemsetData"
        ];
    };

    fn.getMediaProperties = function () {
        return [
            "controlElement/mediaItext"
        ];
    };

    fn.getLogicProperties = function () {
        return [
            "bindElement/calculateAttr",
            "bindElement/requiredAttr",
            "bindElement/relevantAttr",
            "bindElement/constraintAttr",
            "controlElement/repeat_count",
            "controlElement/no_add_remove"
        ];
    };

    fn.getAdvancedProperties = function () {
        return [
            "dataElement/dataValue",
            "dataElement/xmlnsAttr",
            "controlElement/label",
            "controlElement/hintLabel",
            "bindElement/constraintMsgAttr",
        ];
    };

        
    function getWidgetClassAndOptions(propPath, mug) {
        var propDef = mug.getPropertyDefinition(propPath),
            propVal = mug.getPropertyValue(propPath);

        if (propDef && propDef.visibility &&
            propDef.visibility.indexOf('/') !== -1 &&
                !getWidgetClassAndOptions(propDef.visibility, mug))
        {
            return null;
        }

        if (!propDef || 
            (!propVal &&
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
        return {
            dataElement: this.getDataElementSpec(),
            bindElement: this.getBindElementSpec(),
            controlElement: this.getControlElementSpec()
        };
    };

    fn.getDataElementSpec = function () {
        return mugs.baseDataSpecs;
    };

    fn.getBindElementSpec = function () {
        return mugs.baseBindSpecs;
    };

    fn.getControlElementSpec = function () {
        return mugs.baseControlSpecs;
    };

    fn.isMugRemoveable = function (mug, path) {
        return mug.isRemoveable;
    };

    fn.isPropertyLocked = function (mugPath, propertyPath) {
        return false;
    };

    fn.isMugPathMoveable = function (mugPath) {
        return true;
    };

    fn.isMugTypeChangeable = function (mug, mugPath) {
        return mug.isTypeChangeable;
    };

    fn.beforeSerialize = function () {
        // gets extended in plugins
    
    };

    fn.parseBindElement = function (el, path) {
    
    };

    fn.contributeToModelXML = function (xmlWriter) {
    
    };

    fn.initWidget = function (widget) {
    
    };

    return $.vellum.plugin("core", {
        form: null,
        patchUrl: false,
        saveUrl: false,
        saveType: 'full',
        staticPrefix: "",
        allowedDataNodeReferences: [],
        externalInstances: [],
        bindBeforeUnload: function (handler) {
            $(window).bind('beforeunload', handler);
        }
    }, fn);

 /*  currently never run
-        var closeDialog = function (event, ui) {
-            var currentMug = that.getCurrentlySelectedMug();
-            // rerender the side nav so the language list refreshes
-            // this is one way to do this although it might be overkill
-            that.reloadTree();
-            if (currentMug) {
-                // also rerender the mug page to update the inner UI.
-                // this is a fickle beast. something in the underlying
-                // spaghetti requires the first call before the second
-                // and requires both of these calls after the reloadTree call
-                that.jstree('select_node', '#' + currentMug.ufid);
-                that.displayMugProperties(currentMug);
-            }
-        };
-    var newLang = null;
-    var addLanguageDialog = function() {
-        function beforeClose(event, ui) {
-            //grab the input value and add the new language
-            if ($('#fd-new-lang-input').val()) {
-                that.form.data.javaRosa.Itext.addLanguage($('#fd-new-lang-input').val());
-            }
-        }
-
-        var div = $("#fd-dialog-confirm"),input,contStr;
-
-        div.dialog("destroy");
-        div.empty();
-
-
-        contStr = '<p> <span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>' +
-                '<span class="fd-message">Enter name of new Language</span> ' +
-                '<div id="fd-new-lang-div"><input id="fd-new-lang-input" /></div>' +
-                '</p>';
-        div.append(contStr);
-
-        div.dialog({
-            autoOpen: false,
-            modal: true,
-            buttons: {
-                "Create": function () {
-                    $(this).dialog("close");
-                },
-                "Cancel": function () {
-                    $('#fd-new-lang-input').val('');
-                    $(this).dialog("close");
-                }
-            },
-            beforeClose: beforeClose,
-            close: closeDialog
-        });
-    };
-
-    var removeLanguageDialog = function () {
-        function beforeClose(event, ui) {
-            //grab the input value and add the new language
-            if ($('#fd-remove-lang-input').val() != '') {
           that.form.data.javaRosa.Itext.removeLanguage($('#fd-remove-lang-input').val());
-                that.data.ui.currentItextDisplayLanguage = that.form.data.javaRosa.Itext.getDefaultLanguage();
-            }
-        }
-
-        var div = $("#fd-dialog-confirm"),input,contStr, langToBeRemoved, buttons, msg;
-
-        div.dialog("destroy");
-        div.empty();
-
-
-        if (that.form.data.javaRosa.Itext.getLanguages().length == 1) {
-            //When there is only one language in the
-            langToBeRemoved = '';
-            msg = 'You need to have at least one language in the form.  Please add a new language before removing this one.';
-        } else {
-            langToBeRemoved = that.data.ui.currentItextDisplayLanguage;
-            msg = 'Are you sure you want to permanently remove this language?';
-        }
-
-        contStr = '<p> <span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>' +
-                '<span class="fd-message">' + msg + '</span> ' +
-                '<div id="fd-new-lang-div"><input id="fd-remove-lang-input" type="hidden"/></div>' +
-                '</p>';
-
-        div.append(contStr);
-
-        // We use the following hidden input box as a flag to determine what to do in the beforeClose() func above.
-        $('#fd-remove-lang-input').val(langToBeRemoved);
-
-        buttons = {};
-        buttons["Cancel"] = function () {
-            $('#fd-remove-lang-input').val('');
-            $(this).dialog("close");
-        };
-
-        if (langToBeRemoved != '') {
-            buttons["Yes"] = function () {
-                $(this).dialog("close");
-            };
-        }
-
-        div.dialog({
-            autoOpen: false,
-            modal: true,
-            buttons: buttons,
-            beforeClose: beforeClose,
-            close: closeDialog
-        });
-    }; */

});
