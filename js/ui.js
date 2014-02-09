/*jslint maxerr: 50, indent: 4 */
/*globals $,document,console*/

if(!Object.keys) {
    Object.keys = function(o){
        if (o !== Object(o)) {
            throw new TypeError('Object.keys called on non-object');
        }
        var ret=[],p;
        for(p in o) {
            if(Object.prototype.hasOwnProperty.call(o,p)) {
                ret.push(p);
            }
        }
        return ret;
    };
}

if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

formdesigner.ui = function () {
    "use strict";
    var that = {
        QUESTION_TREE_DIV: 'fd-question-tree',
        noTextString: '[no text]'
    },
        question_list = [],
        buttons = {},
        controller = formdesigner.controller,
        dataTree,
        DEBUG_MODE = false,
        MESSAGES_DIV = '#fd-messages';

    that.MESSAGE_TYPES = {
        "error": {
            cssClass: "alert-error",
            title: "Error",
            icon: "icon-exclamation-sign"
        },
        "parse-warning": {
            cssClass: "",
            title: "Parse Warning",
            icon: "icon-warning-sign"
        },
        "form-warning": {
            cssClass: "",
            title: "Form Warning",
            icon: "icon-info-sign"
        }
    };

    that.QUESTION_GROUPS = [
        {
            group: ["Text", 'Text'],  // key in mugs, <title>
            questions: [
                "Text",
                "Trigger"
            ]
        },
        {
            group: ["Select", 'Multiple Choice'],
            related: [
                "Item"
            ],
            questions: [
                "Select",
                "MSelect"
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

    that.getQuestionTypeGroupID = function (slug) {
        return "fd-question-group-" + slug;
    };

    that.QUESTIONS_IN_TOOLBAR = [];
    that.QUESTION_TYPE_TO_GROUP = {};
    // this is necessary (as opposed to getting it from the mug at the same
    // time as node creation) because jstree types are used to determine whether
    // it's a valid insertion, so the mug can't be found in the form by node
    // id at the point in time we might otherwise want to use it. Would be good
    // to instead store create dummy mugs to get their properties / get it
    // from the prototype if we were using prototypical inheritance.

    _.each(that.QUESTION_GROUPS, function (groupData) {
        var groupSlug = groupData.group[0];

        var getQuestionData = function (questionType) {
            var mug = mugs[questionType],
                questionData = [questionType, mug.prototype.typeName, mug.prototype.icon];
            
            that.QUESTIONS_IN_TOOLBAR.push(questionType);
            that.QUESTION_TYPE_TO_GROUP[questionType] = groupSlug;
            return questionData;
        };
        
        groupData.questions = _.map(groupData.questions, getQuestionData);
        if (groupData.related && groupData.related.length) {
            groupData.related = _.map(groupData.related, getQuestionData);
        }

        if (typeof groupData.group[2] === 'undefined') {
            groupData.group[2] = mugs[groupData.group[0]].prototype.icon;
        }
    });

    that.CONSTRAINT_ITEXT_BLOCK_SELECTOR = '#itext-block-constraintMsg';
    
    that.currentErrors = [];

    that.reset = function () {
        that.getJSTree().children().children().each(function (i, el) {
            that.jstree("delete_node", el);
        });
    };
    
    that.showMessage = function (errorObj) {
        var messages = errorObj.message;
        // TODO: I don't like this array business, should be refactored away to the callers.
        if (typeof messages === "string" || !(messages instanceof Array)) {
            //msg is a string or not-an-array (so try turn it into a string)
            messages = ['' + messages];
        }

        $(MESSAGES_DIV)
            .empty()
            .html(_.template($('#fd-template-alert-global').text(), {
                messageType: that.MESSAGE_TYPES[errorObj.level],
                messages: messages
            }))
            .find('.alert').removeClass('hide').addClass('in');
    };
    
    that.clearMessages = function () {
        $(MESSAGES_DIV).empty();
    };
    
    that.resetMessages = function (errors) {
        that.clearMessages();
        for (var i = 0; i < errors.length; i++) {
            that.showMessage(errors[i]);
        }
    };

    that.generateNewModal = function (modalTitle, modalButtons, closeButtonTitle) {
        var $modalContainer = $('#fd-modal-generic-container'),
            $modal = formdesigner.ui.getTemplateObject('#fd-template-modal-content', {
                modalTitle: modalTitle,
                modalButtons: modalButtons || [],
                closeButtonTitle: closeButtonTitle || "Close"
            });
        $modalContainer.html($modal);
        return $modal;
    };

    that.getTemplateObject = function (templateSelector, templateParams) {
        return $(_.template($(templateSelector).text(), templateParams));
    };
    
    that.addQuestion = function (qType) {
        if (that.hasXpathEditorChanged) {
            that.alertUnsavedChangesInXpathEditor();
            return null;
        } else {
            var newMug = new mugs[qType](); 
            formdesigner.controller.initQuestion(newMug);
            that.jstree('select_node', '#' + newMug.ufid, true);
            if (newMug.isODKOnly) {
                //it's an ODK media question
                formdesigner.model.form.updateError(formdesigner.model.FormError({
                    message: 'This question type will ONLY work with Android phones!',
                    level: 'form-warning'
                }), {updateUI: true});
            }
            return newMug;
        }
    };

    that.QuestionTypeButton = function (buttonSpec) {
        var self = this;
        self.slug = buttonSpec[0];
        self.title = buttonSpec[1];
        self.icon = (buttonSpec.length > 2) ? buttonSpec[2] : null;
    };

    that.QuestionTypeGroup = function (groupData) {
        var self = this;
        self.groupData = groupData;
        self.showDropdown = true;
        self.textOnly = false;
        self.relatedQuestions = [];

        self.init = function () {
            self.defaultQuestion = new formdesigner.ui.QuestionTypeButton(self.groupData.group);
            self.groupID = that.getQuestionTypeGroupID(self.defaultQuestion.slug);
            if ('showDropdown' in self.groupData) {
                self.showDropdown = self.groupData.showDropdown;
            }
            if ('related' in self.groupData) {
                self.relatedQuestions = _.map(self.groupData.related, self.makeQuestion);
            }
            if ('textOnly' in self.groupData) {
                self.textOnly = self.groupData.textOnly;
            }
            self.questions = _.map(self.groupData.questions, self.makeQuestion);
        };

        self.makeQuestion = function (questionSpec) {
            return new formdesigner.ui.QuestionTypeButton(questionSpec);
        };

        self.getFormattedTemplate = function () {
            var $template = $('#fd-question-type-group-template');
            return _.template($template.text(), {
                groupID: self.groupID,
                showDropdown: self.showDropdown,
                textOnly: self.textOnly,
                relatedQuestions: self.relatedQuestions,
                defaultQuestion: self.defaultQuestion,
                questions: self.questions
            });
        };

        self.activateGroup = function () {
            var $questionGroup = $('#'+self.groupID);
            $questionGroup.find('.fd-question-type').click(function (event) {
                if (!$(this).hasClass('disabled')) {
                    that.addQuestion($(this).data('qtype'));
                }
                event.preventDefault();
            });
            $questionGroup.find('.btn.fd-question-type > span').tooltip({
                title: function () {
                    var qLabel = $(this).data('qlabel'),
                        $qType = $(this).parent();

                    if($qType.hasClass('disabled')) {
                        qLabel = qLabel + " (add " + $($qType.parent().find('.btn:first-child span')).data('qlabel') + " first)";
                    } else {
                        qLabel = "Add " + qLabel;
                    }
                    return qLabel;
                },
                placement: 'bottom'
            });
        };
    };

    that.activateQuestionTypeGroup = function (mug) {
        var className = mug.__className || mug.prototype.__className,
            groupSlug = that.QUESTION_TYPE_TO_GROUP[className];
        if (groupSlug) {
            var $questionGroup = $('#' + that.getQuestionTypeGroupID(groupSlug));
            $questionGroup.find('.fd-question-type-related').removeClass('disabled');
        }
    };

    that.resetQuestionTypeGroups = function () {
        var $questionGroupContainer = $('#fd-container-question-type-group');
        $questionGroupContainer.find('.fd-question-type-related').addClass('disabled');
    };
    
    function init_toolbar() {

        var toolbar = $(".fd-toolbar");

        var $questionGroupContainer = $('#fd-container-question-type-group');

        _.each(that.QUESTION_GROUPS, function (groupData) {
            var questionGroup = new formdesigner.ui.QuestionTypeGroup(groupData);
            questionGroup.init();
            $questionGroupContainer.append(questionGroup.getFormattedTemplate());
            questionGroup.activateGroup();
        });

        (function c_saveForm() {
            var $saveButtonContainer = $('#fd-save-button');
            formdesigner.controller.saveButton.ui.appendTo($saveButtonContainer);
        })();

    }

    that.showVisualValidation = function (mug) {
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
        formdesigner.model.form.clearErrors('form-warning', {updateUI: true});
       
        var errors = mug.getErrors().concat(_.filter(_.flatten(
                formdesigner.pluginManager.call('getFormErrors')),
                _.identity));

        _(errors).each(function (error) {
            var input = findInputByReference(name, "foo-id");  // todo: make work
            setValidationFailedIcon(input.parent(), true, error);
            formdesigner.model.form.updateError(formdesigner.model.FormError({
                message: error,
                level: 'form-warning'
            }));
        });
        that.resetMessages(formdesigner.model.form.errors);
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
            widgetClass: propDef.uiType || formdesigner.widgets.textWidget,
            options: $.extend(true, {path: propPath}, propDef,
                              propDef.widgetOptions)
        };
    }
    /**
     * Draws the properties to be edited to the screen.
     */
    that.displayMugProperties = function (mug) {
        $('#fd-default-panel').addClass('hide');
        // always hide the xpath editor if necessary
        that.hideXPathEditor();
        that.showTools();

        /* update display */
        $('#fd-question-properties').animate({}, 200);

        that.hideQuestionProperties();

        var $content = $("#fd-props-content").empty(),
            questionToolbar = formdesigner.widgets.getToolbarForMug(mug),
            sections = formdesigner.widgets.getSectionListForMug(mug);

        $('#fd-props-toolbar').html(questionToolbar);
        for (var i = 0; i < sections.length; i++) {
            var section = sections[i];

            section.mug = mug;
            section.properties = _(section.properties)
                .map(function (property) {
                    var foo = getWidgetClassAndOptions(property, mug);
                    return foo;
                })
                .filter(_.identity);
           
            if (section.properties.length) {
                formdesigner.widgets.questionSection(mug, section)
                    .getSectionDisplay().appendTo($content);
            }
        }

        /* attach common event listeners */

        /**
         * (These comments are old and I don't know what they refer to - MW)
         *
         * Sets things up such that if you alter one NodeID box (e.g. bind)
         * the other NodeID (e.g. data) gets changed and the model gets updated
         * too.
         * 
         * When either bindElement.nodeID or dataElement.nodeID changes value,
         * the node label in the jstree (UITree) should be updated to reflect
         * that change
         */

        // update the question tree (only if it's a data node, and only if
        // it has changed)
        mug.on('property-changed', function (e) {
            formdesigner.controller.setFormChanged();

            if (e.property === 'nodeID' && e.element === 'dataElement') {
                var node = $('#' + e.mugUfid),
                    newNameForTree = '[' + e.val +']';
                if (e.val && (
                    (mug.__className === "DataBindOnly" && newNameForTree !== that.jstree("get_text", node)) ||
                    (!(mug.__className === "DataBindOnly") &&
                        (!mug.controlElement || !mug.controlElement.labelItextID || (mug.controlElement.labelItextID && mug.controlElement.labelItextID.isEmpty()) )
                        )
                    )
                ) {
                    that.jstree('rename_node', node, newNameForTree);
                }
            }
            if (mug.bindElement) {
                if (e.property === 'constraintAttr' && !(mug.__className === "DataBindOnly")) {
                    var $constraintItext = $(formdesigner.ui.CONSTRAINT_ITEXT_BLOCK_SELECTOR);
                    if (e.val) {
                        $constraintItext.removeClass('hide');
                    } else if (!mug.bindElement.constraintMsgItextID.id) {
                        $constraintItext.addClass('hide');
                    }
                }

                if (e.property === 'constraintMsgItextID' && !e.val.id && !mug.bindElement.constraintAttr) {
                    $(formdesigner.ui.CONSTRAINT_ITEXT_BLOCK_SELECTOR).addClass('hide');
                }
            }

        });

        $("#fd-question-properties").show();
        $('.fd-help').fdHelp();

        var $validationCondition = $('#bindElement-constraintAttr');
        if ($validationCondition && !$validationCondition.val()) {
            $(formdesigner.ui.CONSTRAINT_ITEXT_BLOCK_SELECTOR).addClass('hide');
        }

        that.showVisualValidation(mug);
    };

    /**
     * Handler for node_select events.
     *
     * Set that.skipNodeSelectEvent to true to disable during form loading,
     * recursive question duplication, etc.
     */
    that.handleNodeSelect = function (e, data) {
        if (that.skipNodeSelectEvent) {
            return;
        }

        var ufid = $(data.rslt.obj[0]).prop('id'),
            mug = formdesigner.controller.getMugFromFormByUFID(ufid);

        that.displayMugProperties(mug);
        // First neutralize all the existing buttons.
        that.resetQuestionTypeGroups();
        that.activateQuestionTypeGroup(mug);
    };

    that.isSelectNodeBlocked = function (e, data) {
        if (that.hasXpathEditorChanged) {
            that.alertUnsavedChangesInXpathEditor();
            return true;
        }
        return false;
    };

    that.alertUnsavedChangesInXpathEditor = function () {
        if (!that.isUnsavedAlertVisible) {
            that.isUnsavedAlertVisible = true;

            var $modal = formdesigner.ui.generateNewModal("Unsaved Changes in Editor", [], "OK");
            $modal.removeClass('fade');
            $modal.find('.modal-body')
                .append($('<p />').text("You have UNSAVED changes in the Expression Editor. Please save "+
                                        "changes before switching questions."));
            $modal
                .modal('show')
                .on('hide', function () {
                    that.isUnsavedAlertVisible = false;
                });
        }
    };

    /**
     * Try to select any node in the UI tree, otherwise hide the question
     * properties window. Used after initial load, question deletion, etc.
     * 
     * @return bool success
     */
    that.selectSomethingOrResetUI = function (forceDeselect) {
        if (forceDeselect) {
            that.jstree('deselect_all');
        }
        // ensure something is selected if possible
        var selected;
        if (!that.jstree('get_selected').length) {
            // if there's any nodes in the tree, just select the first
            var all_nodes = that.getJSTree().find("li");
            if (all_nodes.length > 0) {
                that.jstree('select_node', all_nodes[0]);
                return true;
            } else {
                // otherwise clear the Question Edit UI pane
                that.hideQuestionProperties();
                that.jstree('deselect_all');
                return false;
            }
        }

        return true;
    };

    /**
     * Select the lowest top-level non-data node
     *
     * @return jquery object for the lowest node if there are any question
     *         nodes, otherwise false
     */
    that.selectLowestQuestionNode = function () {
        that.jstree("deselect_all");
        var questions = that.getJSTree().children().children().filter("[rel!='DataBindOnly']");
        if (questions.length > 0) {
            var newSelectEl = $(questions[questions.length - 1]);
            that.jstree("select_node", newSelectEl, false);
            return newSelectEl;
        } else {
            return false;
        }
    };

    that.questionTree = null;


    /**
     *
     * @param rootElement
     */
    var generate_scaffolding = function () {
        var root = $(formdesigner.rootElement);
        root.empty();
        $.ajax({
            url: formdesigner.staticPrefix + 'templates/main.html',
            async: false,
            cache: false,
            success: function(html) {
                root.append(html);
            }
        });
    };

    that.makeLanguageSelectorDropdown = function () {
        var addLangButton,
            removeLangButton,
            langList,
            langs,
            str,
            Itext,
            $langSelector,
            fullLangs;
        Itext = formdesigner.pluginManager.javaRosa.Itext;
        langs = Itext.getLanguages();

        if (langs.length < 2) {
            return;
        }

        fullLangs = _.map(langs, function (lang) {
            return {
                code: lang,
                name: formdesigner.langCodeToName[lang] || lang
            }
        });

        $langSelector = formdesigner.ui.getTemplateObject('#fd-template-language-selector', {
            languages: fullLangs
        });

        langList = $langSelector.find('select');
        langList.change(function () {
            that.changeTreeDisplayLanguage($(this).val());
        });

        langList.val(formdesigner.currentItextDisplayLanguage);

        if (formdesigner.opts.allowLanguageEdits) {
            str = '<button class="btn btn-primary" id="fd-lang-disp-add-lang-button">Add Language</button>';
            addLangButton = $(str);
            addLangButton.button();
            addLangButton.click(function () {
                that.showAddLanguageDialog();
            });
            $langSelector.append(addLangButton);
            str = '<button class="btn btn-warning" id="fd-lang-disp-remove-lang-button">Remove Language</button>';
            removeLangButton = $(str);
            removeLangButton.button();
            removeLangButton.click(function () {
                that.showRemoveLanguageDialog();
            });
            $langSelector.append(removeLangButton);
        }

        $('#fd-question-tree-lang').html($langSelector);
    };

    that.changeTreeDisplayLanguage = function (lang) {
        var itext = formdesigner.pluginManager.javaRosa.Itext;
        
        formdesigner.currentItextDisplayLanguage = lang;

        that.getJSTree().find('li').each(function (i, el) {
            var $el = $(el),
                mug = formdesigner.controller.form.getMugByUFID($el.prop('id'));

            // don't rename data nodes, they don't have itext
            if (mug.controlElement) {
                try {
                    var itextID = mug.controlElement.labelItextID.id,
                        text = itext.getItem(itextID).getValue("default", lang);
                    text = text || formdesigner.util.getMugDisplayName(mug);
                    that.jstree('rename_node', $el, text || that.noTextString);
                } catch (e) {
                    /* This happens immediately after question duplication when
                     * we try to rename the duplicated node in the UI tree. The
                     * form XML is correct and the inputs change the appropriate
                     * strings in the XML and in the UI tree, so we're just
                     * going to ignore the fact that this internal data
                     * structure isn't initialized with the default language's
                     * itext value for this field yet, and simply not rename the
                     * UI node, which will produce the same behavior. */
                    if (e !== "NoItextItemFound") {
                        throw e;
                    }
                }
            }
        });
    };

    var init_extra_tools = function () {
        that.makeLanguageSelectorDropdown();
        formdesigner.controller.on('fd-reload-ui', function () {
            that.makeLanguageSelectorDropdown();
        });
        formdesigner.controller.on('fd-update-language-name', function () {
            that.makeLanguageSelectorDropdown();
        });

        var menuItems = [
            {
                name: "Export Form Contents",
                action: formdesigner.controller.showExportDialog
            },
            {
                name: "Edit Source XML",
                action: formdesigner.controller.showSourceXMLDialog
            },
            {
                name: "Form Properties",
                action: formdesigner.controller.showFormPropertiesDialog
            }
        ].concat(_.filter(_.flatten(
                formdesigner.pluginManager.call('getToolsMenuItems')
            ), _.identity));

        var $toolsMenu = $("#fd-tools-menu");
        _(menuItems).each(function (menuItem) {
            var $a = $("<a tabindex='-1' href='#'>" + menuItem.name + "</a>").click(
                function (e) {
                    e.preventDefault();
                    menuItem.action();
                }
            );
            $("<li></li>").append($a).appendTo($toolsMenu);
        });
    };

    var setTreeNodeInvalid = function (uid, msg) {
        $($('#' + uid)[0]).append('<div class="ui-icon ui-icon-alert fd-tree-valid-alert-icon" title="' + msg + '"></div>')
    };

    var setTreeNodeValid = function (uid) {
        $($('#' + uid)[0]).find(".fd-tree-valid-alert-icon").remove();
    };

    that.setTreeValidationIcon = function (mug) {
        var errors = mug.getErrors();
        if (!errors.length) {
            setTreeNodeValid(mug.ufid);
        } else {
            var message = _(errors).pluck("message").join("<p>").replace(/"/g, "'");
            setTreeNodeInvalid(mug.ufid, message);
        }
    };

    /**
     * Goes through the internal data/controlTrees and determines which mugs are not valid.
     *
     * Then adds an icon in the UI tree next to each node that corresponds to an invalid Mug.
     *
     * Will clear icons for nodes that are valid (if they were invalid before)
     */
    that.setAllTreeValidationIcons = function () {
        var form = controller.form,
            cTree = form.controlTree,
            dTree = form.dataTree,
            invalidMugs, i;

        //clear existing warning icons to start fresh.
        that.getJSTree().find('.fd-tree-valid-alert-icon').remove();
        
        _(form.getInvalidMugUFIDs()).each(function (messages, ufid) {
            var message = messages.join("<p>").replace(/"/g, "'");
            setTreeNodeInvalid(ufid, message);
        });
    };

    that.removeMugFromTree = function (mug) {
        that.jstree("remove", '#' + mug.ufid);
    };

    function setup_fancybox() {
        $("a#inline").fancybox({
            hideOnOverlayClick: false,
            hideOnContentClick: false,
            enableEscapeButton: false,
            showCloseButton : true,
            onClosed: function() {
            }
        });
    }

    function init_form_paste() {
        var tarea = $("#fd-form-paste-textarea");
        tarea.change(function() {
            var parser = new controller.Parser();
            var out = parser.parse(tarea.val());
            $("#fd-form-paste-output").val(out);
        })
    }

    /**
     * Turns the UI on/off. Primarily used by disableUI() and enableUI()
     * @param state - if false: turn UI off.  if true turn UI on.
     */
    function flipUI(state) {
        var butState;
        //we need a button State variable since it uses different syntax for disabling
        //(compared to input widgets)
        if (state) {
            butState = 'enable';
        } else {
            butState = 'disable';
        }

        // TODO: in making fd-save-button controlled by saveButton, do we need to do anything explicit here?
//        $('#fd-save-button').button(butState);

        $('#fd-lang-disp-add-lang-button').button(butState);
        $('#fd-lang-disp-remove-lang-button').button(butState);
        //Print tree to console button is not disabled since it's almost always useful.

        //other stuff
        if (state) {
            $('#fd-question-properties').show();
        } else {
            $('#fd-question-properties').hide();
        }

    }

    that.disableUI = function () {
        flipUI(false);
    };

    that.enableUI = function () {
        flipUI(true);
    };


    function init_modal_dialogs() {
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
    }

    var newLang = null;
    var addLanguageDialog = function() {
        function beforeClose(event, ui) {
            //grab the input value and add the new language
            if ($('#fd-new-lang-input').val()) {
                formdesigner.pluginManager.javaRosa.Itext.addLanguage($('#fd-new-lang-input').val())
            }
        }

        var div = $("#fd-dialog-confirm"),input,contStr;

        div.dialog("destroy");
        div.empty();


        contStr = '<p> <span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>' +
                '<span class="fd-message">Enter name of new Language</span> ' +
                '<div id="fd-new-lang-div"><input id="fd-new-lang-input" /></div>' +
                '</p>';
        div.append(contStr);

        div.dialog({
            autoOpen: false,
            modal: true,
            buttons: {
                "Create": function () {
                    $(this).dialog("close");
                },
                "Cancel": function () {
                    $('#fd-new-lang-input').val('');
                    $(this).dialog("close");
                }
            },
            beforeClose: beforeClose,
            close: function (event, ui) {
                var currentMug = formdesigner.controller.getCurrentlySelectedMug();
                // rerender the side nav so the language list refreshes
                // this is one way to do this although it might be overkill
                formdesigner.controller.reloadUI();
                if (currentMug) {
                    // also rerender the mug page to update the inner UI.
                    // this is a fickle beast. something in the underlying
                    // spaghetti requires the first call before the second
                    // and requires both of these calls after the reloadUI call
                    formdesigner.controller.setCurrentlySelectedMug(currentMug.ufid);
                    that.displayMugProperties(currentMug);
                }

            }

        })

    };

    var removeLanguageDialog = function () {
        function beforeClose(event, ui) {
            //grab the input value and add the new language
            if ($('#fd-remove-lang-input').val() != '') {
                formdesigner.pluginManager.javaRosa.Itext.removeLanguage($('#fd-remove-lang-input').val());
                formdesigner.currentItextDisplayLanguage = formdesigner.pluginManager.javaRosa.Itext.getDefaultLanguage();
            }
        }

        var div = $("#fd-dialog-confirm"),input,contStr, langToBeRemoved, buttons, msg;

        div.dialog("destroy");
        div.empty();


        if (formdesigner.pluginManager.javaRosa.Itext.getLanguages().length == 1) {
            //When there is only one language in the
            langToBeRemoved = '';
            msg = 'You need to have at least one language in the form.  Please add a new language before removing this one.';
        } else {
            langToBeRemoved = formdesigner.currentItextDisplayLanguage;
            msg = 'Are you sure you want to permanently remove this language?';
        }

        contStr = '<p> <span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>' +
                '<span class="fd-message">' + msg + '</span> ' +
                '<div id="fd-new-lang-div"><input id="fd-remove-lang-input" type="hidden"/></div>' +
                '</p>';

        div.append(contStr);

        // We use the following hidden input box as a flag to determine what to do in the beforeClose() func above.
        $('#fd-remove-lang-input').val(langToBeRemoved);

        buttons = {};
        buttons["Cancel"] = function () {
            $('#fd-remove-lang-input').val('');
            $(this).dialog("close");
        };

        if (langToBeRemoved != '') {
            buttons["Yes"] = function () {
                $(this).dialog("close");
            }
        }

        div.dialog({
            autoOpen: false,
            modal: true,
            buttons: buttons,
            beforeClose: beforeClose,
            close: function (event, ui) {
                var currentMug = formdesigner.controller.getCurrentlySelectedMug();
                // rerender the side nav so the language list refreshes
                // this is one way to do this although it might be overkill
                formdesigner.controller.reloadUI();
                if (currentMug) {
                    // also rerender the mug page to update the inner UI.
                    // this is a fickle beast. something in the underlying
                    // spaghetti requires the first call before the second
                    // and requires both of these calls after the reloadUI call
                    formdesigner.controller.setCurrentlySelectedMug(currentMug.ufid);
                    that.displayMugProperties(currentMug);
                }
            }
        })
    };

    var showConfirmDialog = function () {
        $("#fd-dialog-confirm").dialog("open");
    };
    that.showConfirmDialog = showConfirmDialog;

    var hideConfirmDialog = function () {
        $("#fd-dialog-confirm").dialog("close");
    };
    that.hideConfirmDialog = hideConfirmDialog;

    var showAddLanguageDialog = function () {
        addLanguageDialog();
        showConfirmDialog();
    };
    that.showAddLanguageDialog = showAddLanguageDialog;

    var showRemoveLanguageDialog = function () {
        removeLanguageDialog();
        showConfirmDialog();
    };
    that.showRemoveLanguageDialog = showRemoveLanguageDialog;

    /**
     * Set the values for the Confirm Modal Dialog
     * (box that pops up that has a confirm and cancel button)
     * @param confButName
     * @param confFunction
     * @param cancelButName
     * @param cancelButFunction
     */
    var setDialogInfo = that.setDialogInfo = function (message, confButName, confFunction, 
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
    that.setDialogInfo = setDialogInfo;

    var showWaitingDialog = that.showWaitingDialog = function (msg) {
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
            open: function(event, ui) {
                $(".ui-dialog-titlebar-close").hide();
            },
            close: function(event, ui) {
                $(".ui-dialog-titlebar-close").show();
            },
            title: "Processing..."
        });
        contentStr = '<p>' +
                '<span class="fd-message">' + msg + '</span><div id="fd-form-saving-anim"></div></p>';
        dial.append(contentStr);
        $('#fd-form-saving-anim').append('<img src="' + formdesigner.staticPrefix + 'images/ajax-loader.gif" id="fd-form-saving-img"/>');

        showConfirmDialog();
    };

    var set_event_listeners = function () {
        formdesigner.controller.on("question-itext-changed", function (e) {
            // Update any display values that are affected
            // NOTE: This currently walks the whole tree since you may
            // be sharing itext IDs. Generally it would be far more
            // efficient to just do it based off the currently changing
            // node. Left as a TODO if we have performance problems with
            // this operation, but the current behavior is more correct.
            var allMugs = formdesigner.controller.getMugList(true);
            if (formdesigner.currentItextDisplayLanguage === e.language) {
                allMugs.map(function (mug) {
                    var node = $('#' + mug.ufid),
                        treeName = e.value || formdesigner.util.getMugDisplayName(mug),
                        it = mug.controlElement ? mug.controlElement.labelItextID : null;
                    if (it && it.id === e.item.id && e.form === "default") {
                        if (treeName !== that.jstree("get_text", node)) {
                            that.jstree('rename_node', node, treeName);
                        }
                    }
                });
            }
        });

        formdesigner.controller.on("global-itext-changed", function (e) {
            // update any display values that are affected
            var allMugs = formdesigner.controller.getMugList(true);
            var currLang = formdesigner.currentItextDisplayLanguage;
            allMugs.map(function (mug) {
                var node = $('#' + mug.ufid),
                    it = mug.controlElement ? mug.controlElement.labelItextID : null;
                var treeName = (it) ? it.getValue("default", currLang) : formdesigner.util.getMugDisplayName(mug);
                treeName = treeName || formdesigner.util.getMugDisplayName(mug);
                if (treeName !== that.jstree("get_text", node)) {
                    that.jstree('rename_node', node, treeName);
                }
            });
        });

        formdesigner.controller.on('question-creation', function (e) {
            that.overrideJSTreeIcon(e.mug.ufid, e.mug);
        });

        formdesigner.controller.on('parent-question-type-changed', function (e) {
            that.overrideJSTreeIcon(e.mug.ufid, e.mug);
        });
    };

    that.hideQuestionProperties = function() {
        $("#fd-question-properties").hide();
    };

    that.hideTools = function() {
        $("#fd-extra-tools").hide();
    };
    that.showTools = function() {
        $("#fd-extra-tools").show();
    };


    that.showXPathEditor = function (options) {
        /**
         * All the logic to display the XPath Editor widget.
         */
        var expTypes = xpathmodels.XPathExpressionTypeEnum;
        var questionList = formdesigner.controller.getMugList();

        var editorPane = $('#fd-xpath-editor');
        var editorContent = $('#fd-xpath-editor-content');

        var getExpressionInput = function () {
            return $("#fd-xpath-editor-text");
        };
        var getValidationSummary = function () {
            return $("#fd-xpath-validation-summary");
        };
        var getExpressionPane = function () {
            return $("#fd-xpath-editor-expressions");
        };
        var getExpressionList = function () {
            return getExpressionPane().children();
        };
        var getTopLevelJoinSelect = function () {
            return $(editorPane.find("#top-level-join-select")[0]);
        };

        var getExpressionFromSimpleMode = function () {
            // basic
            var pane = getExpressionPane();
            var expressionParts = [];
            var joinType = getTopLevelJoinSelect().val();
            pane.children().each(function() {
                var left = $($(this).find(".left-question")[0]);
                var right = $($(this).find(".right-question")[0]);
                // ignore empty expressions
                if (left.val() === "" && right.val() === "") {
                    return;
                }
                var op = $($(this).find(".op-select")[0]);
                // make sure we wrap the vals in parens in case they were necessary
                // todo, construct manually, and validate individual parts.
                var exprPath = "(" + left.val() + ") " + xpathmodels.expressionTypeEnumToXPathLiteral(op.val()) + " (" + right.val() + ")";
                expressionParts.push(exprPath);
            });
            var preparsed = expressionParts.join(" " + joinType + " ");
            // try to parse and unparse to clean up the formatting
            var results = validate(preparsed);
            if (results[0] && results[1]) {
                return results[1].toXPath();
            }
            return preparsed;
        };

        var getExpressionFromUI = function () {
            if ($("#xpath-simple").hasClass('hide')) {
                // advanced
                return getExpressionInput().val();
            } else {
                return getExpressionFromSimpleMode();
            }
        };

        var validate = function (expr) {
            if (expr) {
                try {
                    var parsed = xpath.parse(expr);
                    return [true, parsed];
                } catch (err) {
                    return [false, err];
                }
            }
            return [true, null];
        };

        var tryAddExpression = function(parsedExpression, joiningOp) {
            // trys to add an expression to the UI.
            // if the expression is empty just appends a new div for the expression.
            // if the expression exists, it will try to parse it into sub
            // expressions.
            // returns the expression if it succeeds, otherwise false.
            if (parsedExpression && DEBUG_MODE) {
                console.log("trying to add", parsedExpression.toString());
            }

            var isPath = function (subElement) {
                return (subElement instanceof xpathmodels.XPathPathExpr);
            };
            var isJoiningOp = function (subElement) {
                // something that joins expressions
                return (subElement instanceof xpathmodels.XPathBoolExpr);
            };

            var isExpressionOp = function (subElement) {
                // something that can be put into an expression
                return (subElement instanceof xpathmodels.XPathCmpExpr ||
                        subElement instanceof xpathmodels.XPathEqExpr);
            };

            var isSupportedBaseType = function (subelement) {
                // something that can be stuck in a base string
                // currently everything is supported.
                return true;
            };

            var newExpressionUIElement = function (expOp) {

                var $expUI = formdesigner.ui.getTemplateObject('#fd-template-xpath-expression', {
                    operationOpts: [
                        ["is equal to", expTypes.EQ],
                        ["is not equal to", expTypes.NEQ],
                        ["is less than", expTypes.LT],
                        ["is less than or equal to", expTypes.LTE],
                        ["is greater than", expTypes.GT],
                        ["is greater than or equal to", expTypes.GTE]
                    ]
                });

                var getLeftQuestionInput = function () {
                    return $($expUI.find(".left-question")[0]);
                };

                var getRightQuestionInput = function () {
                    return $($expUI.find(".right-question")[0]);
                };

                var validateExpression = function(item) {
                    formdesigner.ui.hasXpathEditorChanged = true;

                    var le = getLeftQuestionInput().val(),
                        re = getRightQuestionInput().val();

                    $expUI.find('.validation-results').addClass('hide');

                    if (le && validate(le)[0] && re && validate(re)[0]) {
                        $expUI.find('.validation-results.alert-success').removeClass('hide');
                    } else {
                        $expUI.find('.validation-results.alert-error').removeClass('hide');
                    }
                };

                var populateQuestionInputBox = function (input, expr, pairedExpr) {
                    input.val(expr.toXPath());
                };

                // add event handlers to validate the inputs
                $expUI.find('.xpath-edit-node').on('keyup change', validateExpression);

                $expUI.find('.xpath-delete-expression').click(function() {
                    $expUI.remove();
                });

                if (expOp) {
                    // populate
                    if (DEBUG_MODE) {
                        console.log("populating", expOp.toString());
                    }
                    populateQuestionInputBox(getLeftQuestionInput(), expOp.left);
                    $expUI.find('.op-select').val(xpathmodels.expressionTypeEnumToXPathLiteral(expOp.type));
                    // the population of the left can affect the right,
                    // so we need to update the reference
                    populateQuestionInputBox(getRightQuestionInput(), expOp.right, expOp.left);
                }
                return $expUI;
            };

            var failAndClear = function () {
                getExpressionPane().empty();
                if (DEBUG_MODE) {
                    console.log("fail", parsedExpression);
                }
                return false;
            };

            var expressionPane = getExpressionPane();
            var expressionUIElem, leftUIElem, rightUIElem;
            if (!parsedExpression) {
                // just create a new expression
                expressionUIElem = newExpressionUIElement();
                return expressionUIElem.appendTo(expressionPane);
            } else {
                // we're creating for an existing expression, this is more complicated

                if (isExpressionOp(parsedExpression)) {
                    // if it's an expression op stick it in.
                    // no need to join, so this is good.
                    return newExpressionUIElement(parsedExpression).appendTo(expressionPane);
                } else if (isJoiningOp(parsedExpression)) {
                    // if it's a joining op the first element has to be
                    // an expression and the second must be a valid op
                    // isExpressionOp(parsedExpression.right))
                    if (joiningOp && parsedExpression.type != joiningOp) {
                        // we tried to add a joining op that was different from
                        // what we were already working on. Fail.
                        return failAndClear();
                    }
                    leftUIElem = tryAddExpression(parsedExpression.left, parsedExpression.type);
                    rightUIElem = tryAddExpression(parsedExpression.right, parsedExpression.type);
                    if (leftUIElem && rightUIElem) {
                        leftUIElem.appendTo(expressionPane);
                        rightUIElem.appendTo(expressionPane);
                        getTopLevelJoinSelect().val(parsedExpression.type);
                    } else {
                        // something recursively failed. Raise failure up.
                        return failAndClear();
                    }
                    return rightUIElem; // this is arbitrary / maybe wrong
                } else {
                    // fail and return nothing.
                    return failAndClear();
                }
            }
        };

        var setUIForExpression = function (xpathstring) {
            if (DEBUG_MODE) {
                console.log("setting ui for", xpathstring);
            }
            var results = validate(xpathstring);
            if (results[0]) {
                // it parsed correctly, try to load it.
                var parsed = results[1];
                // try to load the operation into the UI.
                if (tryAddExpression(parsed)) {
                    // it succeeded. nothing more to do
                } else {
                    // show advanced mode.
                    showAdvancedMode(parsed.toXPath(), true);
                }
            } else {
                showAdvancedMode(xpathstring, true);
            }
        };

        var updateXPathEditor = function(options) {
            // set data properties for callbacks and such
            editorPane.data("group", options.group).data("property", options.property);
            // clear validation text
            getValidationSummary()
                .text("")
                .addClass("hide");

            // clear expression builder
            var expressionPane = getExpressionPane();
            expressionPane.empty();

            // update expression builder
            if (options.xpathType === "bool") {
	            showSimpleMode(options.value);
                if (!options.value) {
                    $('#fd-add-exp').click();
                }
            } else {
                showAdvancedMode(options.value);
            }

            $("#fd-xpath-editor-text").val(options.value);
        };

        // toggle simple/advanced mode
        var showAdvancedMode = function (text, showNotice) {
            getExpressionInput().val(text);
            getExpressionPane().empty();

            $("#xpath-advanced").removeClass('hide');
            $("#xpath-simple").addClass('hide');
            $('#fd-xpath-actions').removeClass('form-actions-condensed');
            if (showNotice) {
                $("#xpath-advanced-notice").removeClass('hide');
            } else {
                $("#xpath-advanced-notice").addClass('hide');
            }
        };
        var showSimpleMode = function (text) {
            $("#xpath-simple").removeClass('hide');
            $('#fd-xpath-actions').addClass('form-actions-condensed');
            $("#xpath-advanced").addClass('hide');

            getExpressionPane().empty();
            // this sometimes sends us back to advanced mode (if we couldn't parse)
            // for now consider that fine.
            if (text) {
                setUIForExpression(text);
            }
        };

        var initXPathEditor = function() {
            var $xpathUI = formdesigner.ui.getTemplateObject('#fd-template-xpath', {
                topLevelJoinOpts: [
                    ["True when ALL of the expressions are true.", expTypes.AND],
                    ["True when ANY of the expressions are true.", expTypes.OR]
                ]
            });
            editorContent.append($xpathUI);

            $xpathUI.find('#fd-xpath-show-advanced-button').click(function () {
                showAdvancedMode(getExpressionFromSimpleMode());
            });

            $xpathUI.find('#fd-xpath-show-simple-button').click(function () {
                showSimpleMode(getExpressionInput().val());
            });

            $xpathUI.find('#fd-add-exp').click(function () {
                tryAddExpression();
            });

            $xpathUI.find('#fd-xpath-editor-text').on('change keyup', function (){
                formdesigner.ui.hasXpathEditorChanged = true;
            });

            var saveExpression = function(expression) {

                formdesigner.controller.doneXPathEditor({
                    group:    $('#fd-xpath-editor').data("group"),
                    property: $('#fd-xpath-editor').data("property"),
                    value:    expression
                });
                formdesigner.controller.form.fire('form-property-changed');
            };

            $xpathUI.find('#fd-xpath-save-button').click(function() {
                var uiExpression  = getExpressionFromUI();
                getExpressionInput().val(uiExpression);
                var results = validate(uiExpression);
                if (results[0]) {
                    saveExpression(uiExpression);
                } else if (uiExpression.match('instance\\(')) {
                    saveExpression(uiExpression);
                    alert("This expression is too complex for us to verify; specifically, it makes use of the " +
                        "'instance' construct. Please be aware that if you use this construct you're " +
                        "on your own in verifying that your expression is correct.");
                } else {
                    getValidationSummary()
                        .html(formdesigner.ui.getTemplateObject('#fd-template-xpath-validation-errors', {
                            errors: results[1]
                        }))
                        .removeClass("hide");
                }
            });

            $xpathUI.find('#fd-xpath-cancel-button').click(function () {
                formdesigner.controller.doneXPathEditor({
                    cancel:   true
                });
            });
        };

        if (editorContent.children().length === 0) {
            initXPathEditor();
        }

        updateXPathEditor(options);
        editorPane.show();
    };

    that.hideXPathEditor = function() {
        formdesigner.ui.hasXpathEditorChanged = false;
        $('#fd-xpath-editor').hide();
    };

    that.createJSTree = function () {
        $.jstree._themes = formdesigner.staticPrefix + "themes/";
        that.questionTree = $('#' + that.QUESTION_TREE_DIV);
        that.questionTree.jstree({
            "json_data" : {
                "data" : []
            },
            "core": {
                strings: {
                    new_node: that.noTextString
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
                        var form = formdesigner.controller.form,
                            source = $(m.o),
                            target = $(m.r),
                            position = m.p,
                            refIsData = target.attr('rel') === 'DataBindOnly',
                            nodeIsData = source.attr('rel') === 'DataBindOnly';

                        if (refIsData + nodeIsData == 1) {
                            return false;
                        }

                        var sourceMug = form.getMugByUFID(source.attr('id')),
                            isMoveable = _.all(formdesigner.pluginManager.call(
                                'isMugPathMoveable', sourceMug));

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
                    formdesigner.controller.handleTreeDrop(data.o, data.r);
                }
            },
            "types": {
                "max_children" : -1,
                // valid root node types
                "valid_children" : mugs.Group.prototype.validChildTypes.concat(['DataBindOnly']),
                "types" : (function () {
                    var types = {};
                    _(mugs).each(function (Mug, typeName) {
                        types[typeName] = {
                            valid_children: 
                                Mug.prototype.validChildTypes.length ?  Mug.prototype.validChildTypes : "none"
                        };
                    });
                    return types;
                })()
            },
            "plugins" : [ "themes", "json_data", "ui", "crrm", "types", "dnd" ]
        }).bind("select_node.jstree", 
            that.handleNodeSelect
        ).bind("move_node.jstree", function (e, data) {
            var controller = formdesigner.controller,
                mug = controller.getMugFromFormByUFID($(data.rslt.o).attr('id')),
                refMug = controller.getMugFromFormByUFID($(data.rslt.r).attr('id')),
                position = data.rslt.p;

            controller.moveMug(mug, refMug, position);

            that.displayMugProperties(controller.getCurrentlySelectedMug());
        }).bind("deselect_all.jstree", function (e, data) {
            that.resetQuestionTypeGroups();
        }).bind("deselect_node.jstree", function (e, data) {
            that.resetQuestionTypeGroups();
        }).bind('before.jstree', function (e, data) {
            if (data.func === 'select_node' && that.isSelectNodeBlocked(e, data)) {
                e.stopImmediatePropagation();
                return false;
            }
        }).bind('create_node.jstree', function (e, data) {
            that.overrideJSTreeIcon(
                data.args[2].attr.id,
                data.args[2].metadata.mug
            );
        }).bind('set_type.jstree', function (e, data) {
            that.overrideJSTreeIcon(
                data.args[1].replace('#', ''),
                mugs[data.args[0]]
            );
        });

        $("#fd-expand-all").click(function() {
            that.questionTree.jstree("open_all");
        });

        $("#fd-collapse-all").click(function() {
            that.questionTree.jstree("close_all");
        });
    };

    that.overrideJSTreeIcon = function (node_id, mug) {
        var $questionNode = $('#'+node_id),
            iconClass;
        if (!mug) {
            // todo: check necessity of this
            mug = formdesigner.controller.getMugFromFormByUFID(node_id);
        }
        try {
            iconClass = mug.getIcon();
        } catch (e) {  // we're dealing with a class, not an instance
            if (e.message.indexOf('__className') === -1 &&
                e.message.indexOf('getIcon') === -1)
            {
                throw e;
            }
            iconClass = mug.constructor.prototype.icon;
        }
        iconClass = iconClass || 'icon-circle';
        if (!$questionNode.find('> a > ins').hasClass(iconClass)) {
            $questionNode.find('> a > ins').attr('class', 'jstree-icon').addClass(iconClass);
        }
        that.resetQuestionTypeGroups();
        that.activateQuestionTypeGroup(mug);
    };

    that.getJSTree = function () {
        return that.questionTree;
    };

    /**
     * Wrapper for jstree() calls.  Also very useful for debugging.
     */
    that.jstree = function () {
        var tree = that.getJSTree(),
            retval = tree.jstree.apply(tree, arguments);

        if (DEBUG_MODE) {
            console.error(arguments, retval);
        }

        return retval;
    };

    that.init = function (sessionid) {
//        //Override CCHQ's SaveButton labels:
//        //Bug: Does not work yet. See ticket: http://manage.dimagi.com/default.asp?31223
//        SaveButton.message.SAVE = 'Save to Server';
//        SaveButton.message.SAVED = 'Saved to Server';
        //
        formdesigner.pluginManager.call('init');
        controller = formdesigner.controller;
        generate_scaffolding();
        init_toolbar();
        init_extra_tools();
        formdesigner.multimedia.initControllers(sessionid);
        that.createJSTree();
        init_form_paste();
        init_modal_dialogs();

        set_event_listeners();

        setup_fancybox();

        formdesigner.windowManager.init();
    };

    return that;
}();

var PluginManager = function (options) {
    this._methods = options.methods || {};
    this._plugins = [];

    this.register = function (name, plugin) {
        this._plugins.push(plugin);

        // set attribute directly on plugin manager for easy access
        this[name] = plugin;
    };

    this.call = function (methodName) {
        var methodArguments = Array.prototype.slice.call(arguments, 1),
            methodType = this._methods[methodName];

        if (methodType === "return_all") {
            var ret = [];

            _(this._plugins).each(function (plugin) {
                var fn = plugin[methodName];
                if (fn) {
                    ret.push(fn.apply(plugin, methodArguments));
                }
            });

            return ret;
        } else if (methodType === "process_sequentially") {
            // call plugin functions such that they process the first argument
            // in a pipeline, and the remaining arguments are untouched
            var retval = methodArguments[0],
                otherArguments = methodArguments.slice(1);
            _(this._plugins).each(function (plugin) {
                var fn = plugin[methodName];
                if (fn) {
                    var returned = fn.apply(
                        plugin, [retval].concat(otherArguments)
                    );
                    // guard against functions that modified the referenced
                    // value but forgot to return the existing reference
                    if (typeof returned !== "undefined") {
                        retval = returned;
                    }
                }
            });
            return retval;
        } else {
            throw methodName + " must have its type defined";
        }
    };
};

/**
 *
 * @param opts - {
 *  rootElement: "jQuery selector to FD Container",
 *  staticPrefix : "url prefix for static resources like css and pngs",
 *  saveUrl : "URL that the FD should post saved forms to",
 *  [form] : "string of the xml form that you wish to load"
 *  [formName] : "Default Form Name"
 *  [langs] : ["en", "por", ... ] in order of preference.  First language in list will be set to the default language for this form.
 *  }
 */
formdesigner.launch = function (opts) {
    formdesigner.util.eventuality(formdesigner);

    formdesigner.pluginManager = new PluginManager({
        methods: {
            'getToolsMenuItems': 'return_all',
            'init': 'return_all',
            'beforeParse': 'process_sequentially',
            'parseBindElement': 'process_sequentially',
            'contributeToModelXML': 'return_all',
            'contributeToDataElementSpec': 'process_sequentially',
            'contributeToBindElementSpec': 'process_sequentially',
            'contributeToControlElementSpec': 'process_sequentially',
            'contributeToMainProperties': 'process_sequentially',
            'contributeToLogicProperties': 'process_sequentially',
            'contributeToAdvancedProperties': 'process_sequentially',
            'onMugRename': 'return_all',
            'isPropertyLocked': 'return_all',
            'isMugPathMoveable': 'return_all',
            'isMugRemoveable': 'return_all',
            'isMugTypeChangeable': 'return_all',
            'getFormErrors': 'return_all',
            'preSerialize': 'return_all',
            'afterSerialize': 'process_sequentially'
        }
    });
    formdesigner.pluginManager.register('ignoreButRetain', new formdesigner.plugins.ignoreButRetain());
    formdesigner.pluginManager.register('lock', new formdesigner.plugins.lock());
    formdesigner.pluginManager.register('javaRosa', new formdesigner.plugins.javaRosa());

    if(!opts){
        opts = {};
    }
    formdesigner.rootElement = opts.rootElement || "#formdesigner";
    formdesigner.saveType = opts.saveType || 'full';

    if(opts.staticPrefix){
        formdesigner.staticPrefix = opts.staticPrefix
    }else {
        formdesigner.staticPrefix = "";
    }

    formdesigner.saveUrl = opts.saveUrl;
    formdesigner.patchUrl = opts.patchUrl;

    formdesigner.allowedDataNodeReferences = opts.allowedDataNodeReferences || [];

    formdesigner.multimediaConfig = opts.multimediaConfig;

    formdesigner.windowConfig = opts.windowConfig || {};

    formdesigner.loadMe = opts.form;
    formdesigner.originalXForm = opts.form;

    //if Languages are provided as launch arguments, do not allow adding/removing additional languages.
    opts.allowLanguageEdits = !(opts["langs"] && opts["langs"].length > 0 && opts["langs"][0] !== "");
    opts.langs = opts.allowLanguageEdits ? null : opts.langs;  //clean up so it's definitely an array with something or null.


    formdesigner.opts = opts;  //for additional options used elsewhere.

    ///////////WARNING!/////////////////////////////////////////////////////////////////////////////////////////
    // formdesigner.opts should be used exclusively! Do NOT add vars directly to formdesigner (as is done above)
    // for anything related to the actual form being loaded.  Not following this advice will result in subtle
    // consequences
    ////////////HAVE A NICE DAY//////////////////////////////////////////////////////////////////////////////////

    formdesigner.ui.controller = formdesigner.controller;
    formdesigner.controller.initFormDesigner(opts.sessionid);

    if(formdesigner.loadMe) {
        formdesigner.controller.loadXForm(formdesigner.loadMe);
    } else {
        $('#fd-default-panel').removeClass('hide');
    }
    
    // a bit hacky, but if a form name was specified, override 
    // whatever happened during init / parsing with that. have 
    // to wait for the load-complete event to be sure it's the 
    // last thing on the stack. This will (intentionally) also
    // override the form name anytime you manually load the xml.
    if (opts.formName) {
	    formdesigner.controller.on("parse-finish", function () {
	        formdesigner.controller.setFormName(formdesigner.opts.formName);
        });
    } 
};

formdesigner.rootElement = '';



