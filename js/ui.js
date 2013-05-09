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
        MESSAGES_DIV = '#fd-messages',
        MESSAGE_TYPES = ["error", "parse-warning", "form-warning"],
        WARN_MSG_DIV = '#fd-parse-warn',
        ERROR_MSG_DIV = '#fd-parse-error',
        FORM_WARN_DIV = '#fd-form-warn';

    that.ODK_ONLY_QUESTION_TYPES = ['image','audio','video','barcode'];
    
    var initMessagesPane = function () {
        var messagesDiv = $(MESSAGES_DIV);
        var displayClasses = {"error":   "fd-message ui-state-error ui-corner-all",
                              "parse-warning": "fd-message ui-state-highlight ui-corner-all",
                              "form-warning": "fd-message ui-state-highlight ui-corner-all"};
        var iconClasses = {"error":   "ui-icon-alert",
                           "parse-warning": "ui-icon-info",
                           "form-warning": "ui-icon-info"};
        var type, div, span, header, ul;
        
        for (var i = 0; i < MESSAGE_TYPES.length; i++) {
            type = MESSAGE_TYPES[i];
            div = $("<div />").addClass(type).addClass(displayClasses[type]).hide().appendTo(messagesDiv);
            span = $("<span />").addClass("ui-icon").addClass(iconClasses[type]).appendTo(div);
            header = $('<strong></strong>').text(formdesigner.util.capitaliseFirstLetter(type)).appendTo(div);
            ul = $("<ul />").appendTo(div);
        }
    };
    
    that.currentErrors = [];

    that.reset = function () {
        that.getJSTree().children().children().each(function (i, el) {
            that.jstree("delete_node", el);
        });
    };
    
    that._getMessageDiv = function (type) {
        return $(MESSAGES_DIV).find("." + type);
    };
    
    that.showMessage = function (errorObj) {
        var mainDiv = that._getMessageDiv(errorObj.level);
        var ul = mainDiv.find("ul");
        var msg = errorObj.message;
        // TODO: I don't like this array business, should be refactored away to the callers.
        var tempMsg;
        if (typeof msg === "string" || !(msg instanceof Array)) { 
            //msg is a string or not-an-array (so try turn it into a string)
            tempMsg = $('<li></li>');
            tempMsg.append('' + msg);
            ul.append(tempMsg);
        } else {
            //msg is an array
            for (var i=0;i<msg.length;i++) {
                if(msg.hasOwnProperty(i)) {
                    tempMsg = $('<li></li>');
                    tempMsg.append(msg[i]);
                    ul.append(tempMsg);
                }
            }
        }
        mainDiv.show();
    };
    
    /**
     * Hides the question properties message box;
     */
    that.hideMessages = function (type) {
        var div = that._getMessageDiv(type);
        // clear list elements so they don't come back later
        div.find("ul").empty();
        div.hide();
    };
    
    that.clearMessages = function () {
        for (var i = 0; i < MESSAGE_TYPES.length; i++) {
            that.hideMessages(MESSAGE_TYPES[i]);
        }
    };
    
    that.resetMessages = function (errors) {
        that.clearMessages();
        for (var i = 0; i < errors.length; i++) {
            that.showMessage(errors[i]);
        }
    };
    
    that.addQuestion = function (qType) {
        var newMug = formdesigner.controller.createQuestion(qType);
        that.jstree('select_node', '#' + newMug.ufid, true);
        if (that.ODK_ONLY_QUESTION_TYPES.indexOf(qType) !== -1) { 
            //it's an ODK media question
            formdesigner.model.form.updateError(formdesigner.model.FormError({
                message: 'This question type will ONLY work with CommCareODK/ODK Collect!',
                level: 'form-warning'
            }), {updateUI: true});
        }
        return newMug;
    };

    that.getQuestionTypeSelector = function () {
        // the question type selector inside the question form itself
        var select = $('<select/>');
        
        function makeOptionItem(idTag, attrvalue, label) {
           var opt = $('<option />')
                   .attr('id', idTag)
                   .attr('value', attrvalue)
                   .text(label);
           return opt;
        }
        
        var questions = formdesigner.util.getQuestionList();
        for (var i = 0; i < questions.length; i++) {
            select.append(makeOptionItem(questions[i][0], 
                                         questions[i][0], 
                                         questions[i][1]));
        }
        return select;
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
        self.questionTypeTemplate = "fd-question-type-group-template";
        self.showDropdown = true;
        self.textOnly = false;
        self.relatedQuestions = [];

        self.init = function () {
            self.defaultQuestion = new formdesigner.ui.QuestionTypeButton(self.groupData.group);
            self.groupID = formdesigner.util.getQuestionTypeGroupID(self.defaultQuestion.slug);
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
            var $template = $('#'+self.questionTypeTemplate);
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
                }
            });
        };
    };

    that.activateQuestionTypeGroup = function (slug) {
        var $questionGroup = $('#' + formdesigner.util.getQuestionTypeGroupID(slug));
        $questionGroup.find('.fd-question-type-related').removeClass('disabled');
    };

    that.resetQuestionTypeGroups = function () {
        var $questionGroupContainer = $('#fd-container-question-type-group');
        $questionGroupContainer.find('.fd-question-type-related').addClass('disabled');
    };
    
    function init_toolbar() {

        var toolbar = $(".fd-toolbar");

        var $questionGroupContainer = $('#fd-container-question-type-group');

        _.each(formdesigner.util.QUESTION_GROUPS, function (groupData) {
            var questionGroup = new formdesigner.ui.QuestionTypeGroup(groupData);
            questionGroup.init();
            $questionGroupContainer.append(questionGroup.getFormattedTemplate());
            questionGroup.activateGroup();
        });

        //debug tools
        (function c_printDataTreeToConsole() {
            var printTreeBut = $(
                    '<button class="btn" id="fd-print-tree-button" class="toolbarButton questionButton">' +
                            'Print tree to Console' +
                            '</button>');
            $('#fd-dragons').append(printTreeBut);

            printTreeBut.button().click(function () {
                formdesigner.util.dumpFormTreesToConsole();
            });

        })();

        (function c_saveForm() {
            var $saveButtonContainer = $('#fd-save-button');
            formdesigner.controller.saveButton.ui.appendTo($saveButtonContainer);
        })();

    }

    that.buttons = buttons;

    function getJSTreeTypes() {
        var questionTypes = [
            "group",
            "repeat",
            "question",
            "phonenumber",
            "date",
            "datetime",
            "time",
            "int",
            "barcode",
            "geopoint",
            "long",
            "double",
            "selectQuestion",
            "trigger",
            "secret",
            "default",
            "image",
            "audio",
            "video"
        ],
            allTypes = questionTypes.concat(["datanode"]),
            jquery_icon_url = formdesigner.iconUrl;

        return {
            "max_children" : -1,
            "valid_children" : allTypes,  // valid root node types (aka children of the root node)
            "types" : {
                "group" : {
                    "valid_children" : questionTypes
                },
                "repeat" : {
                    "valid_children" : questionTypes
                },
                "question" : {

                    "valid_children" : "none"
                },
                "phonenumber": {
                    "valid_children" : "none"
                },
                "date" : {
                    "valid_children" : "none"
                },
                "datetime" : {
                    "valid_children" : "none"
                },
                "time" : {
                    "valid_children" : "none"
                },
                "int" : {
                    "valid_children" : "none"
                },
                "long" : {
                    "valid_children" : "none"
                },
                "double" : {
                    "valid_children" : "none"
                },
                "selectQuestion" : {
                    "valid_children": ["item"]
                },
                "item" : {
                    "valid_children" : "none"
                },
                "trigger" : {
                    "valid_children" : "none"
                },
                "secret" : {
                    "valid_children" : "none"
                },
                "barcode" : {
                    "valid_children" : "none"
                },
                "geopoint" : {
                    "valid_children" : "none"
                },
                "image" : {
                    "valid_children" : "none"
                },
                "audio" : {
                    "valid_children" : "none"
                },
                "video" : {
                    "valid_children" : "none"
                },
                "datanode" : {
                    "valid_children" : "none"
                },
                "unknown" : {
                },
                "default" : {
                    "valid_children" : questionTypes
                }
            }
        };
    };

    that.showVisualValidation = function (mugType) {
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

        function loopValProps(block, name) {
            var i, res, msg, input;
            if (block) {
                for (i in block) {
                    if (block.hasOwnProperty(i)) {
                        res = block[i].result;
                        msg = block[i].resultMessage;
                        input = findInputByReference(name, i);
                        if (res === 'fail') {
                            setValidationFailedIcon(input.parent(), true, msg);
                            propsMessage.push(msg);
                        } else if (res === 'pass') {
                            setValidationFailedIcon(input.parent(), false, msg);
                        }
                    }
                }
            }
        }

        function findInputByReference(blockName, elementName) {
            return $('#' + blockName + '-' + elementName);
        }

        if (!mugType) {
            return;
        }
        var vObj = mugType.validateMug(),
                bProps = vObj.bindElement,
                cProps = vObj.controlElement,
                dProps = vObj.dataElement,
                // DRAGONS: this is used in a closure above so 
                // don't assume it's not touched
                propsMessage = [],
                i, itextValidation;

        // for now form warnings get reset every time validation gets called.
        formdesigner.model.form.clearErrors('form-warning', {updateUI: true});
        loopValProps(bProps, 'bindElement');
        loopValProps(cProps, 'controlElement');
        loopValProps(dProps, 'dataElement');
        itextValidation = formdesigner.model.Itext.validateItext();
        if (itextValidation !== true) {
            propsMessage.push(JSON.stringify(itextValidation));
        }
        if (propsMessage.length > 0) {
            for (var i = 0; i < propsMessage.length; i++) {
	            formdesigner.model.form.updateError(formdesigner.model.FormError({
	                    message: propsMessage[i],
	                    level: 'form-warning'
	                }));
	        }
	        that.resetMessages(formdesigner.model.form.errors);
        }
    };

    /**
     * Draws the properties to be edited to the screen.
     */
    that.displayMugProperties = function (mugType) {
        // always hide the xpath editor if necessary
        that.hideXPathEditor();
        that.showTools();

        /* update display */
        $('#fd-question-properties').animate({}, 200);

        that.hideQuestionProperties();

        var content = $("#fd-props-content").empty();
        var sections = formdesigner.widgets.getSectionListForMug(mugType);

        for (var i = 0; i < sections.length; i++) {
            sections[i].getSectionDisplay().appendTo(content);
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
        mugType.mug.on('property-changed', function (e) {
            formdesigner.controller.setFormChanged();

            if (e.property === 'nodeID' && e.element === 'dataElement') {
                var node = $('#' + e.mugTypeUfid);
                if (mugType.typeSlug === "datanode" && e.val &&
                    e.val !== that.jstree("get_text", node)) 
                {
                    that.jstree('rename_node', node, e.val);
                }
            }
        });

        $("#fd-question-properties").show();

        that.showVisualValidation(mugType);
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
            mugType = formdesigner.controller.getMTFromFormByUFID(ufid),
            typeSlug;

        that.displayMugProperties(mugType);
        typeSlug = mugType.typeSlug;
        // First neutralize all the existing buttons.
        that.resetQuestionTypeGroups();
        var groupSlug = formdesigner.util.QUESTION_TYPE_TO_GROUP[typeSlug];
        if (groupSlug) {
            that.activateQuestionTypeGroup(groupSlug);
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

        var questions = that.getJSTree().children().children().filter("[rel!='datanode']");
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

    that.changeTreeDisplayLanguage = function (lang) {
        var itext = formdesigner.model.Itext;
        
        formdesigner.currentItextDisplayLanguage = lang;

        that.getJSTree().find('li').each(function (i, el) {
            var $el = $(el),
                mugType = formdesigner.controller.form.getMugTypeByUFID($el.prop('id'));

            // don't rename data nodes, they don't have itext
            if (mugType.hasControlElement()) {

                try {
                    var itextID = mugType.mug.properties.controlElement.properties.labelItextID.id,
                        text = itext.getItem(itextID).getValue("default", lang);
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
        function makeLangDrop() {
            var div, addLangButton, removeLangButton, langList, langs, i, str, selectedLang, Itext;
            $('#fd-question-tree-container').find('#fd-lang-disp-div').remove();
            Itext = formdesigner.model.Itext;
            langs = Itext.getLanguages();
            if (langs.length < 2) {
                return;
            }
            div = $('<div id="fd-lang-disp-div"></div>');
            div.append('<label>Display Language: </label>');

            str = '<select data-placeholder="Choose a Language" id="fd-land-disp-select">';
            for (var i = 0; i < langs.length; i++) {
                str = str + '<option value="' + langs[i] + '" >' + langs[i] + '</option>';
            }
            str += '</select>';

            langList = $(str);
            langList.change(function () {
                that.changeTreeDisplayLanguage($(this).val());
            });

            langList.val(formdesigner.currentItextDisplayLanguage);
            div.append(langList);
            
            if (formdesigner.opts.allowLanguageEdits) {
                str = '';
                str = '<button class="btn btn-primary" id="fd-lang-disp-add-lang-button">Add Language</button>';
                addLangButton = $(str);
                addLangButton.button();
                addLangButton.click(function () {
                    that.showAddLanguageDialog();
                });
                div.append(addLangButton);
                str = '';
                str = '<button class="btn btn-warning" id="fd-lang-disp-remove-lang-button">Remove Langauge</button>';
                removeLangButton = $(str);
                removeLangButton.button();
                removeLangButton.click(function () {
                    that.showRemoveLanguageDialog();
                });
                div.append(removeLangButton);
            }
            $('#fd-question-tree-head').after(div);
        }

        var accordion = $("#fd-extra-tools-accordion"),
            minMaxButton = $('#fd-min-max-button');

        makeLangDrop();
        formdesigner.controller.on('fd-reload-ui', function () {
            makeLangDrop();
        });

        accordion.hide();
        accordion.accordion({
            autoHeight: false
        });

        accordion.show();
        accordion.accordion("resize");
        minMaxButton.button({
            icons: {
                primary: 'ui-icon-arrowthick-2-n-s'
            }
        });

        $('#fd-load-xls-button').click(formdesigner.controller.showItextDialog);
        $('#fd-export-xls-button').click(formdesigner.controller.showExportDialog);
        $('#fd-editsource-button').click(formdesigner.controller.showSourceXMLDialog);

        $('#fd-extra-template-questions div').each(function () {
            $(this).button({
                icons : {
                    primary : 'ui-icon-gear'
                }
            });
        }).button("disable");

        function makeFormProp(propLabel, propName, keyUpFunc, initVal) {
            var liStr = '<li id="fd-form-prop-' + propName + '" class="fd-form-property"><span class="fd-form-property-text">' + propLabel + ': ' + '</span>' +
                    '<input id="fd-form-prop-' + propName + '-' + 'input" class="fd-form-property-input">' +
                    '</li>',
                    li = $(liStr),
                    ul = $('#fd-form-opts-ul');

            ul.append(li);
            $(li).find('input').val(initVal)
                    .keyup(keyUpFunc);
        }

        function fireFormPropChanged(propName, oldVal, newVal) {
            formdesigner.controller.form.fire({
                type: 'form-property-changed',
                propName: propName,
                oldVal: oldVal,
                newVal: newVal
            })
        }

        var formNameFunc = function (e) {
            fireFormPropChanged('formName', formdesigner.controller.form.formName, $(this).val());
            formdesigner.controller.form.formName = $(this).val();
        };
        makeFormProp("Form Name", "formName", formNameFunc, formdesigner.controller.form.formName);

        var formIDFunc = function (e) {
            $(this).val($(this).val().replace(/ /g, '_'));
            fireFormPropChanged('formID', formdesigner.controller.form.formID, $(this).val());
            formdesigner.controller.form.formID = $(this).val();
        };
        makeFormProp("Form ID", "formID", formIDFunc, formdesigner.controller.form.formID);

    };


    var setTreeNodeInvalid = function (uid, msg) {
        $($('#' + uid)[0]).append('<div class="ui-icon ui-icon-alert fd-tree-valid-alert-icon" title="' + msg + '"></div>')
    };

    var setTreeNodeValid = function (uid) {
        $($('#' + uid)[0]).find(".fd-tree-valid-alert-icon").remove();
    };

    that.setTreeValidationIcon = function (mugType) {
        var validationResult = mugType.validateMug();
        if (validationResult.status !== 'pass') {
            setTreeNodeInvalid(mugType.ufid, validationResult.message.replace(/"/g, "'"));
        } else {
            setTreeNodeValid(mugType.ufid);
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
            invalidMTs, i, invalidMsg, liID;

        //clear existing warning icons to start fresh.
        that.getJSTree().find('.fd-tree-valid-alert-icon').remove();
        
        invalidMTs = form.getInvalidMugTypeUFIDs();
        for (i in invalidMTs) {
            if (invalidMTs.hasOwnProperty(i)) {
                invalidMsg = invalidMTs[i].message.replace(/"/g, "'");
                //ui tree
                liID = i;
                setTreeNodeInvalid(liID, invalidMsg);
            }
        }

    };

    that.removeMugTypeFromTree = function (mugType) {
        that.jstree("remove", '#' + mugType.ufid);
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

        $('#fancybox-overlay').click(function () {

        })
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

        // buttons
        $('#fd-add-but').button(butState);
        // TODO: in making fd-save-button controlled by saveButton, do we need to do anything explicit here?
//        $('#fd-save-button').button(butState);

        $('#fd-lang-disp-add-lang-button').button(butState);
        $('#fd-lang-disp-remove-lang-button').button(butState);
        $('#fd-load-xls-button').button(butState);
        $('#fd-editsource-button').button(butState);
        $('#fd-cruftyItextRemove-button').button(butState);
        //Print tree to console button is not disabled since it's almost always useful.

        //inputs
        $('#fd-form-prop-formName-input').prop('enabled', state);
        $('#fd-form-prop-formID-input').prop('enabled', state);

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
                formdesigner.model.Itext.addLanguage($('#fd-new-lang-input').val())
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
                var currentMug = formdesigner.controller.getCurrentlySelectedMugType();
                // rerender the side nav so the language list refreshes
                // this is one way to do this although it might be overkill
                formdesigner.controller.reloadUI();
                if (currentMug) {
                    // also rerender the mug page to update the inner UI.
                    // this is a fickle beast. something in the underlying
                    // spaghetti requires the first call before the second
                    // and requires both of these calls after the reloadUI call
                    formdesigner.controller.setCurrentlySelectedMugType(currentMug.ufid);
                    that.displayMugProperties(currentMug);
                }

            }

        })

    };

    var removeLanguageDialog = function () {
        function beforeClose(event, ui) {
            //grab the input value and add the new language
            if ($('#fd-remove-lang-input').val() != '') {
                formdesigner.model.Itext.removeLanguage($('#fd-remove-lang-input').val());
                formdesigner.currentItextDisplayLanguage = formdesigner.model.Itext.getDefaultLanguage();
            }
        }

        var div = $("#fd-dialog-confirm"),input,contStr, langToBeRemoved, buttons, msg;

        div.dialog("destroy");
        div.empty();


        if (formdesigner.model.Itext.getLanguages().length == 1) {
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
                var currentMug = formdesigner.controller.getCurrentlySelectedMugType();
                // rerender the side nav so the language list refreshes
                // this is one way to do this although it might be overkill
                formdesigner.controller.reloadUI();
                if (currentMug) {
                    // also rerender the mug page to update the inner UI.
                    // this is a fickle beast. something in the underlying
                    // spaghetti requires the first call before the second
                    // and requires both of these calls after the reloadUI call
                    formdesigner.controller.setCurrentlySelectedMugType(currentMug.ufid);
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
            var allMugs = formdesigner.controller.getMugTypeList(true);
            if (formdesigner.currentItextDisplayLanguage === e.language) {
                allMugs.map(function (mug) {
                    var node = $('#' + mug.ufid);
                    var it = mug.getItext();
                    if (it && it.id === e.item.id && e.form === "default") {
                        if (e.value && e.value !== that.jstree("get_text", node)) {
                            that.jstree('rename_node', node, e.value);
                        }
                    }
                });
            }
        });

        formdesigner.controller.on("global-itext-changed", function (e) {
            // update any display values that are affected
            var allMugs = formdesigner.controller.getMugTypeList(true);
            var currLang = formdesigner.currentItextDisplayLanguage;
            allMugs.map(function (mug) {
                var node = $('#' + mug.ufid);
                var it = mug.getItext();
                if (it && it.getValue("default", currLang) !== that.jstree("get_text", node)) {
                    that.jstree('rename_node', node, it.getValue("default", currLang));
                }
            });
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
        var questionList = formdesigner.controller.getMugTypeList();
        var questionChoiceAutoComplete = questionList.map(function (item) {
            return formdesigner.util.mugToAutoCompleteUIElement(item);
        });

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
            if ($("#xpath-advanced-check").is(':checked')) {
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

        var validateCurrent = function () {
            return validate(getExpressionFromUI());
        };

        var constructSelect = function (ops) {
            var sel = $("<select />");
            for (var i = 0; i < ops.length; i++) {
                $("<option />").text(ops[i][0]).val(ops[i][1]).appendTo(sel);
            }
            return sel;
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

            var createJoinSelector = function() {
                var ops = [
                    ["and", expTypes.AND],
                    ["or", expTypes.OR]
                ];
                return constructSelect(ops).addClass("join-select");
            };

            var newExpressionUIElement = function (expOp) {

                // create the UI for an individual expression
                var createQuestionAcceptor = function() {
                    var questionAcceptor = $("<input />").attr("type", "text").attr("placeholder", "Hint: drag a question here.");
                    return questionAcceptor;
                };

                var createOperationSelector = function() {
                    var ops = [
                        ["is equal to", expTypes.EQ],
                        ["is not equal to", expTypes.NEQ],
                        ["is less than", expTypes.LT],
                        ["is less than or equal to", expTypes.LTE],
                        ["is greater than", expTypes.GT],
                        ["is greater than or equal to", expTypes.GTE]
                    ];

                    return constructSelect(ops).addClass("op-select");
                };

                var expression = $("<div />").addClass("bin-expression");

                var createQuestionInGroup = function (type) {
                    var group = $("<div />").addClass("expression-part").appendTo(expression);
                    return createQuestionAcceptor().addClass(type + "-question xpath-edit-node").appendTo(group);
                };

                var getLeftQuestionInput = function () {
                    return $(expression.find(".left-question")[0]);
                };

                var getRightQuestionInput = function () {
                    return $(expression.find(".right-question")[0]);
                };

                var getValidationResults = function () {
                    return $(expression.find(".validation-results")[0]);
                };

                var validateExpression = function(item) {
                    var le = getLeftQuestionInput().val(),
                            re = getRightQuestionInput().val();
                    if (le && validate(le)[0] && re && validate(re)[0]) {
                        getValidationResults().text("ok").addClass("success ui-icon-circle-check").removeClass("error");
                    } else {
                        getValidationResults().text("fix").addClass("error").removeClass("success");
                    }
                };

                var left = createQuestionInGroup("left");
                var op = createOperationSelector().appendTo(expression);
                var right = createQuestionInGroup("right");
                var deleteButton = $("<div />").addClass('btn').addClass('btn-danger').text("Delete").button().css("float", "left").appendTo(expression);
                var validationResults = $("<div />").addClass("validation-results").appendTo(expression);

                var populateQuestionInputBox = function (input, expr, pairedExpr) {
                    input.val(expr.toXPath());
                };

                var setBasicOptions = function () {
                    // just make the inputs droppable and add event handlers to validate
                    // the inputs
                    expression.find(".xpath-edit-node").addClass("jstree-drop");
                    expression.find(".xpath-edit-node").keyup(validateExpression);
                    expression.find(".xpath-edit-node").change(validateExpression);
                };

                setBasicOptions();
                
                deleteButton.click(function() {
                    var isFirst = expression.children(".join-select").length == 0;
                    expression.remove();
                    if (isFirst && getExpressionList().length > 0) {
                        // when removing the first expression, make sure to update the
                        // next one in the UI to not have a join, if necessary.
                        $($(getExpressionList()[0]).children(".join-select")).remove();
                    }
                });

                if (expOp) {
                    // populate
                    if (DEBUG_MODE) {
                        console.log("populating", expOp.toString());
                    }
                    populateQuestionInputBox(getLeftQuestionInput(), expOp.left);
                    op.val(xpathmodels.expressionTypeEnumToXPathLiteral(expOp.type));
                    // the population of the left can affect the right,
                    // so we need to update the reference
                    populateQuestionInputBox(getRightQuestionInput(), expOp.right, expOp.left);
                }
                return expression;
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
                // and if it's not the first additionally add the join selector
                if (getExpressionPane().children().length !== 0) {
                    // No longer handled internally
                    // TODO: clean up
                    // createJoinSelector().prependTo(expressionUIElem);
                }
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
            getValidationSummary().text("").removeClass("error").removeClass("success");

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
            $("#xpath-advanced-check").attr("checked", true);
            $("#xpath-advanced").show();
            $("#xpath-simple").hide();
            $("#xpath-advanced-notice").toggle(typeof showNotice != 'undefined' ? showNotice : false)
        };
        var showSimpleMode = function (text) {
            $("#xpath-simple").show();
            $("#xpath-advanced").hide();
            $("#xpath-advanced-check").attr("checked", false);
            $("#xpath-advanced-notice").hide();
            getExpressionPane().empty();
            // this sometimes sends us back to advanced mode (if we couldn't parse)
            // for now consider that fine.
            if (text) {
                setUIForExpression(text);
            }
        };
        var initXPathEditor = function() {
            var mainPane = editorContent;

            $("<div />").attr("id", "xpath-advanced-notice")
                .addClass("alert")
                .text("Sorry, your logic is too complicated for our logic builder." +
                    "   You can only edit this logic in Advanced Mode.")
                .appendTo(editorContent);

            $("<label />")
                    .attr("for", "xpath-advanced-check")
                    .text("Advanced Mode?").
                    appendTo(editorContent);

            var advancedModeSelector = $("<input />")
                    .attr("type", "checkbox")
                    .attr("id", "xpath-advanced-check")
                    .appendTo(editorContent);
            advancedModeSelector.css("clear", "both");

            advancedModeSelector.click(function() {
                if ($(this).is(':checked')) {
                    showAdvancedMode(getExpressionFromSimpleMode());
                } else {
                    showSimpleMode(getExpressionInput().val());
                }
            });

            // advanced UI
            var advancedUI = $("<div />").attr("id", "xpath-advanced")
                    .appendTo(editorContent);

            $("<label />").attr("for", "fd-xpath-editor-text")
                    .text("XPath Expression: ")
                    .appendTo(advancedUI);

            $("<textarea />").attr("id", "fd-xpath-editor-text")
                    .attr("rows", "2")
                    .attr("cols", "50")
                    .attr("style", "width:540px; height:140px")
                    .appendTo(advancedUI)
                    .addClass("jstree-drop");
            
            $("<p>Hint: you can drag a question into the box.</p>")
                .appendTo(advancedUI);

                    
            // simple UI
            var simpleUI = $("<div />").attr("id", "xpath-simple").appendTo(editorContent);

            var topLevelJoinOps = [
                ["True when ALL of the expressions are true.", expTypes.AND],
                ["True when ANY of the expressions are true.", expTypes.OR]
            ];

            constructSelect(topLevelJoinOps).appendTo(simpleUI)
                    .attr("id", "top-level-join-select");

            $("<div />").attr("id", "fd-xpath-editor-expressions")
                    .appendTo(simpleUI);

            var addExpressionButton = $("<button id='fd-add-exp'/>").text("Add expression").addClass("btn")
                    .button()
                    .appendTo(simpleUI);

            addExpressionButton.click(function() {
                tryAddExpression();
            });

            // shared UI
            var actions = $("<div />").addClass("btn-group")
                    .css("padding-top", "5px").appendTo(editorContent);
            
            var doneButton = $('<button />').text("Save to Form").addClass("btn").addClass("btn-primary")
                    .button()
                    .appendTo(actions);

            doneButton.click(function() {
                getExpressionInput().val(getExpressionFromUI());
                var results = validateCurrent();
                if (results[0]) {
                    formdesigner.controller.doneXPathEditor({
                        group:    $('#fd-xpath-editor').data("group"),
                        property: $('#fd-xpath-editor').data("property"),
                        value:    getExpressionFromUI()
                    });
                    formdesigner.controller.form.fire('form-property-changed');
                } else {
                    getValidationSummary().text("Validation Failed! Please fix all errors before leaving this page. " + results[1]).removeClass("success").addClass("error");
                }
            });
            
            var cancelButton = $('<button />').text("Cancel").addClass("btn")
                    .button()
                    .appendTo(actions);
            cancelButton.click(function () {
                formdesigner.controller.doneXPathEditor({
                    cancel:   true
                });
            });
            
            var validationSummary = $("<div />").attr("id", "fd-xpath-validation-summary").appendTo(editorContent);
        };

        if (editorContent.children().length === 0) {
            initXPathEditor();
        }

        updateXPathEditor(options);
        editorPane.show();
    };

    that.hideXPathEditor = function() {
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
                        var refIsData = $(m.r).attr('rel') === 'datanode',
                            nodeIsData = $(m.o).attr('rel') === 'datanode';

                        if (refIsData + nodeIsData == 1) {
                            return false;
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
            "types": getJSTreeTypes(),
            "plugins" : [ "themes", "json_data", "ui", "crrm", "types", "dnd" ]
        }).bind("select_node.jstree", 
            that.handleNodeSelect
        ).bind("move_node.jstree", function (e, data) {
            var controller = formdesigner.controller,
                mugType = controller.getMTFromFormByUFID($(data.rslt.o).attr('id')),
                refMugType = controller.getMTFromFormByUFID($(data.rslt.r).attr('id')),
                position = data.rslt.p;

            controller.moveMugType(mugType, refMugType, position);

            that.displayMugProperties(controller.getCurrentlySelectedMugType());
        }).bind("deselect_all.jstree", function (e, data) {
            that.resetQuestionTypeGroups();
        }).bind("deselect_node.jstree", function (e, data) {
            that.resetQuestionTypeGroups();
        }).bind('before.jstree', function (e, data) {
            var nodeId, qtype;
            if (data.func == 'is_selected' || data.func == 'get_text') {
                nodeId = $(data.args[0]).attr('id');
            } else if (data.func == 'set_type') {
                qtype = data.args[2];
                nodeId = data.args[1].replace('#', '');
            }
            if (nodeId) {
                that.overrideJSTreeIcon(nodeId, qtype);
            }

        });

        $("#fd-expand-all").click(function() {
            that.questionTree.jstree("open_all");
        });

        $("#fd-collapse-all").click(function() {
            that.questionTree.jstree("close_all");
        });
    };

    that.overrideJSTreeIcon = function (node_id, qtype) {
        var $questionNode = $('#'+node_id),
            iconClass,
            mugType = formdesigner.controller.getMTFromFormByUFID(node_id);
        if (!qtype && mugType) {
            qtype = mugType.typeSlug;
        }
        iconClass = formdesigner.util.QUESTION_TYPE_TO_ICONS[qtype];
        if (!iconClass) {
            iconClass = 'icon-circle';
        }
        if (!$questionNode.find('> a > ins').hasClass(iconClass)) {
            $questionNode.find('> a > ins').attr('class', 'jstree-icon').addClass(iconClass);
        }
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

    that.init = function() {
//        //Override CCHQ's SaveButton labels:
//        //Bug: Does not work yet. See ticket: http://manage.dimagi.com/default.asp?31223
//        SaveButton.message.SAVE = 'Save to Server';
//        SaveButton.message.SAVED = 'Saved to Server';
        controller = formdesigner.controller;
        generate_scaffolding();
        initMessagesPane();
        init_toolbar();
        init_extra_tools();
        that.createJSTree();
        init_form_paste();
        init_modal_dialogs();

        set_event_listeners();

        setup_fancybox();
    };


    $(document).ready(function () {

    });

    return that;
}();

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
    formdesigner.loadMe = opts.form;
    formdesigner.originalXForm = opts.form;
    
    formdesigner.iconUrl = opts.iconUrl ? opts.iconUrl : "css/smoothness/images/ui-icons_888888_256x240.png";

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
    formdesigner.controller.initFormDesigner();

    if(formdesigner.loadMe) {
        formdesigner.controller.loadXForm(formdesigner.loadMe);
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



