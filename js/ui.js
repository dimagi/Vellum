/*jslint maxerr: 50, indent: 4 */
/*globals $,document,console*/

if(!Object.keys) Object.keys = function(o){
    if (o !== Object(o))
        throw new TypeError('Object.keys called on non-object');
    var ret=[],p;
    for(p in o) if(Object.prototype.hasOwnProperty.call(o,p)) ret.push(p);
    return ret;
}

if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

formdesigner.ui = (function () {
    "use strict";
    var that = {},
        question_list = [],
        buttons = {},
        controller = formdesigner.controller,
        questionTree,
        dataTree,
        LINK_CONTROL_MOVES_TO_DATA_TREE = true,
        DEBUG_MODE = false,
        TOKEN_INPUT = false; // change this if you want tokenized xpath mode
        
    that.TOKEN_INPUT = TOKEN_INPUT;
    
    /**
     * Displays an info box on the properties view.
     * Use hideMessage() to hide.
     * @param msg - the actual message contents
     * @param header - message header (optional)
     * @param msgType - can be either 'warning' or 'error' - defaults to 'warning'
     */
    var showMessage  = function (msg, header, msgType) {
        var div, warningClass, iconClass, iconSpan, msgtxt, headertxt, icon;
        div = $('#fd-props-message');
        div.empty();
        if(msgType === 'error') {
            warningClass = 'ui-state-error';
            iconClass = 'ui-icon-alert';
        } else {
            warningClass = 'ui-state-highlight';
            iconClass = 'ui-icon-info';
        }
        iconSpan = '<span class="ui-icon ' + iconClass + '" style="float: left; margin-right: .3em;"></span>';
        icon = $(iconSpan);
        headertxt = '<strong>' + header + '</strong>';
        msgtxt = ' ' + msg;
        div.append(icon).append(headertxt).append(msgtxt);
        div.addClass(warningClass).addClass('ui-corner-all');
        div.show();
    }
    that.showMessage = showMessage;

    /**
     * Hides the question properties message box;
     */
    var hideMessage = function () {
        $('#fd-props-message').hide();
    }

    var showParseErrorMessage = function (msg) {
        var container = $('#fd-notify');
        container.html(msg);
        container.addClass('ui-state-error');
        container.show();
    };
    that.showParseErrorMessage = showParseErrorMessage;

    var hideParseErrorMessage = function () {
        var container = $('#fd-notify');
        container.html("");
        container.removeClass("ui-state-error");
        container.hide();
    };
    that.hideParseErrorMessage = hideParseErrorMessage;

    function init_toolbar() {
        var toolbar = $(".fd-toolbar"), select, addbutstr, addbut;

        select = $('#fd-question-select');
        addbutstr = '<button id="fd-add-but">Add</button>';
        select.after(addbutstr);
        addbut = $('#fd-add-but');
        addbut.button({
            icons:{
                primary: 'ui-icon-plusthick'
            }
        });

        function addQuestion () {
            var selVal, qID,qType;
            selVal = $('#fd-question-select').val();
            qID = $('#fd-question-select').find('[value*="'+selVal+'"]').attr('id');
            qType = qID.split('-')[2];
            try {
                var newMug = formdesigner.controller.createQuestion(qType);
                that.selectMugTypeInUI(newMug);
            } catch (e) {
                if (e.name === "IllegalMove") {
                    if (qType == "item") {
                        alert("You can't do that. Select items can only be added to Single Select or Multi-Select Questions.");
                    } else {
                        alert("Sorry that question type can't be added to the currently selected question.");
                    }
                } else if (e.name === "NoNodeFound") {
                    // this is the error that gets raised when you add to a select item.
                    // kinda sketch but more user friendly
                    alert("You can't add questions to Select Items. Select something else before adding your question.");
                } else {
                    // we don't know what went wrong here.
                    throw e;
                }
                
            }
        }
        addbut.click(addQuestion);

        select.chosen();

        //debug tools
        (function c_printDataTreeToConsole() {
            var printTreeBut = $(
                    '<button id="fd-print-tree-button" class="toolbarButton questionButton">'+
                'Print tree to Console' +
              '</button>');
            $('#fd-dragons').append(printTreeBut);

            printTreeBut.button().click(function () {
                formdesigner.util.dumpFormTreesToConsole();
            });

        })();

        (function c_showLoadItextXLS() {
            var editXLSBut = $(
                    '<button id="fd-load-xls-button" class="toolbarButton questionButton">'+
                'Edit Bulk Translations' +
              '</button>');
            $('#fd-extra-advanced').append(editXLSBut);

            editXLSBut.button().click(function () {
                formdesigner.controller.showItextDialog();

            });
        })();

        (function c_saveForm() {
            var savebut = $('<div id="fd-save-button" class="toolbarButton"/>');
            toolbar.append(savebut);
            formdesigner.controller.saveButton.ui.appendTo(savebut);
        })();

        (function c_removeSelected() {
            var removebut = $(
                    '<button id="fd-remove-button" class="toolbarButton">'+
                'Remove Selected' +
              '</button>');
            toolbar.append(removebut);

            removebut.button({
                icons: {
                    primary: 'ui-icon-minusthick'
                }
            }).click(function () {
                var selected = formdesigner.controller.getCurrentlySelectedMugType();
                formdesigner.controller.removeMugTypeFromForm(selected);
            });
        })();

    }
    that.buttons = buttons;

    function getDataJSTreeTypes() {
        var jquery_icon_url = formdesigner.iconUrl,
            types =  {
            "max_children" : -1,
			"valid_children" : "all",
			"types" : {
                    "default" : {
                        "icon": {
                            "image": jquery_icon_url,
                            "position": "-112px -144px"
                        },
                    "valid_children" : "all"
                }
			}
        }

        return types;
    }

    function getJSTreeTypes() {
        var groupRepeatValidChildren = formdesigner.util.GROUP_OR_REPEAT_VALID_CHILDREN,
            jquery_icon_url = formdesigner.iconUrl,
        types =  {
            "max_children" : -1,
			"valid_children" : groupRepeatValidChildren,
			"types" : {
                "group" : {
                    "icon": {
                        "image" : jquery_icon_url,
                        "position": "-16px -96px"
                    },
                    "valid_children" : groupRepeatValidChildren
                },
                "repeat" : {
                    "icon": {
                        "image" : jquery_icon_url,
                        "position": "-64px -80px"
                    },
                    "valid_children" : groupRepeatValidChildren
                },
                "question" : {
                    "icon": {
                        "image" : jquery_icon_url,
                        "position": "-128px -96px"
                    },
                    "valid_children" : "none"
                },
                "date" : {
                    "icon": {
                        "image" : jquery_icon_url,
                        "position": "-32px -112px"
                    },
                    "valid_children" : "none"
                },
                "datetime" : {
                    "icon": {
                        "image" : jquery_icon_url,
                        "position": "-80px -112px"
                    },
                    "valid_children" : "none"
                },
                "int" : {
                    "icon": {
                        "image" : jquery_icon_url,
                        "position": "-112px -112px"
                    },
                    "valid_children" : "none"
                },
                "long" : {
                    "icon": {
                        "image" : jquery_icon_url,
                        "position": "-112px -112px"
                    },
                    "valid_children" : "none"
                },
                "double" : {
                    "icon": {
                        "image" : jquery_icon_url,
                        "position": "-112px -112px"
                    },
                    "valid_children" : "none"
                },
                "selectQuestion" : {
                    "icon": {
                        "image" : jquery_icon_url,
                        "position": "-96px -176px"
                    },
                    "valid_children": ["item"]
                },
                "item" : {
                    "icon": {
                        "image" : jquery_icon_url,
                        "position": "-48px -128px"
                    },
                    "valid_children" : "none"
                },
                "trigger" : {
                    "icon": {
                        "image" : jquery_icon_url,
                        "position": "-16px -144px"
                    },
                    "valid_children" : "none"
                },
                "secret" : {
                    "icon": {
                        "image": jquery_icon_url,
                        "position": "-112px -128px"
                    },
                    "valid_children" : "none"
                },
                "datanode" : {
                    "icon": {
                        "image": jquery_icon_url,
                        "position": "-112px -144px"
                    },
                    "valid_children" : "none"
                },
				"default" : {
					"valid_children" : groupRepeatValidChildren
				}
			}
		};
        return types;

    }

    /**
     * Determine if we're in DataView mode based on whether
     * the data JS Tree (container) is visible or not.
     */
    var isInDataViewMode = function () {
        var controlTreeContainer = $('#fd-question-tree-container');
        if (controlTreeContainer.is(":visible")) {
            return false;
        } else { //we're in data view mode.
            return true;
        }
    }
    that.isInDataViewMode = isInDataViewMode;

    /**
     * returns either the Data UI tree or the Question JS Tree,
     * depending on what's visible
     */
    var getJSTree = function () {
        if (isInDataViewMode()) {
            return getDataJSTree();
        } else {
            return getQuestionJSTree();
        }
    }
    that.getJSTree = getJSTree;


    var getQuestionJSTree = function () {
        return $('#fd-question-tree');
    }
    that.getQuestionJSTree = getQuestionJSTree;

    var getDataJSTree = function () {
        return $('#fd-data-tree');
    }
    that.getDataJSTree = getDataJSTree;

    var showVisualValidation = function (mugType){
        function setValidationFailedIcon(li, showIcon, message) {
            var exists = ($(li).find('.fd-props-validate').length > 0);
            if(exists && showIcon){
                $(li).find('.fd-props-validate').attr("title", message).addClass("ui-icon");
            } else if (exists && !showIcon){
                $(li).find('.fd-props-validate').removeClass('ui-icon').attr("title", "");
            } else if(!exists && showIcon){
                var icon = $('<span class="fd-props-validate ui-icon ui-icon-alert"></span>');
                icon.attr('title',message);
                li.append(icon);
            }
            return li;
        };

        function loopValProps (block, name){
            var i, res, msg, input;
            if(block){
                for(i in block){
                    if(block.hasOwnProperty(i)){
                        res = block[i].result;
                        msg = block[i].resultMessage;
                        input = findInputByReference(name, i);
                        if(res === 'fail'){
                            setValidationFailedIcon(input.parent(), true, msg);
                            propsMessage += '<p>' + msg + '</p>';
                        }else if(res === 'pass'){
                            setValidationFailedIcon(input.parent(), false, msg);
                        }
                    }
                }
            }
        };

        function findInputByReference(blockName, elementName){
            return $('#' + blockName + '-' + elementName);
        };

        if (!mugType) {
            return;
        }
        var vObj = mugType.validateMug(),
                bProps = vObj.bindElement,
                cProps = vObj.controlElement,
                dProps = vObj.dataElement,
                i, propsMessage, itextValidation;

        hideMessage();
        propsMessage = '';
        loopValProps(bProps, 'bindElement');
        loopValProps(cProps, 'controlElement');
        loopValProps(dProps, 'dataElement');
        itextValidation = formdesigner.model.Itext.validateItext();
        if(itextValidation !== true) {
            propsMessage += '<p>' + JSON.stringify(itextValidation) + '</p>';
        }
        if(propsMessage) {
            
            showMessage(propsMessage, 'Question Problems', 'warning');
        }


    };
    that.showVisualValidation = showVisualValidation;

    var displayMugDataProperties = that.displayMugDataProperties  = function(mugType){
        return displayMugProperties(mugType, false, true, true);
    }

    /**
     * Draws the properties to be edited to the screen.
     * @param mugType - the MugType that has been selected for editing
     * @param showControl - Show control type properties? Optional, defaults to true
     * @param showBind - Show bind type properties? Optional, defaults to true
     * @param showData - Show data type properties? Optional, defaults to true
     */
    var displayMugProperties = that.displayMugProperties = function (mugType, showControl, showBind, showData) {
        // always hide the xpath editor if necessary 
        that.hideXPathEditor();
        that.showTools();
        
        // set default values for properties
        if (typeof showControl === 'undefined') {
            showControl = true;
        }
        if (typeof showBind === 'undefined') {
            showBind = true;
        }
        if (typeof showData === 'undefined') {
            showData = true;
        }

        //Override these flags if the mugType doesn't actually contain these blocks;
        showControl = showControl && mugType.properties.controlElement;
        showBind = showBind && mugType.properties.bindElement;
        showData = showData && mugType.properties.dataElement;

        /**
         * creates and returns a <ul> element with the heading set and the correct classes configured.
         * @param heading
         */
        
        
        function attachCommonEventListeners () {
            /**
             * Sets things up such that if you alter one NodeID box (e.g. bind)
             * the other NodeID (e.g. data) gets changed and the model gets updated too.
             */
            
            /**
             * When either bindElement.nodeID or dataElement.nodeID changes value,
             * the node label in the jstree (UITree) should be updated to reflect that change
             */
            
            // this mainly updates the save button
            mugType.mug.on('property-changed', function (e) {
                formdesigner.controller.setFormChanged();
            });
            
            // update the question tree (only if it's a data node, and only if
            // it has changed)
            mugType.mug.on('property-changed', function (e) {
                if (e.property === 'nodeID' && e.element === 'dataElement') {
                    var node = $('#' + e.mugTypeUfid);
                    if (mugType.typeName === "Data Node" && e.val &&
                        e.val !== $('#fd-question-tree').jstree("get_text", node)) {
	                    $('#fd-question-tree').jstree('rename_node', node, e.val);
	                }
	            }
            });

            function updateDataViewLabels () {
                var mug, util, dataJSTree;
                if (!mugType.properties.dataElement) {
                    return ; //this shouldn't do anything for MT's that don't have a Data Node
                }
                mug = mugType.mug,
                util = formdesigner.util;
                dataJSTree = $('#fd-data-tree');

                mug.on('property-changed',function(e){
                    if(e.property === 'nodeID' && e.element === 'dataElement'){
                        var node = $('#' + e.mugTypeUfid + '_data');
                        dataJSTree.jstree('rename_node',node,this.properties.dataElement.properties.nodeID);
                    }
                });
            };
            
            updateDataViewLabels();

        }

        function updateDisplay(){
            $('#fd-question-properties').animate({
                        height:'900px'
                    },200);

            that.hideQuestionProperties();
            
            var content = $("#fd-props-content").empty();
            
            // Add heading to indicate what kind of question vellum thinks this is
            $("<h1 />").text(mugType.typeName).attr("id", "fd-props-mugtype-info").appendTo(content);
            
            // TODO: where does this belong? eventually we want this to be per-question-type
            
            var sections = formdesigner.widgets.getSectionListForMug(mugType);
        
            var sec;
            for (var i = 0; i < sections.length; i++) {
                sec = sections[i];
                sec.getSectionDisplay().appendTo(content);
            }
	        
	        attachCommonEventListeners();
            $("#fd-question-properties").show();
        };

        updateDisplay();
        formdesigner.ui.showVisualValidation(mugType);
    }

    /**
     * Private function (to the UI anyway) for handling node_select events.
     * @param e
     * @param data
     */
    function node_select(e, data) {
        var curSelUfid = jQuery.data(data.rslt.obj[0], 'mugTypeUfid');
        // don't do anything if we're already on the selected node
        var curMug = formdesigner.controller.getCurrentlySelectedMugType();
        
        // don't bother resetting everything if they just clicked
        // on the mug that was already selected
        if (!curMug || curMug.ufid !== curSelUfid) {
	        formdesigner.controller.setCurrentlySelectedMugType(curSelUfid);
	        if($(e.currentTarget).attr('id') === 'fd-question-tree') {
	            that.displayMugProperties(formdesigner.controller.getCurrentlySelectedMugType());
	        } else if ($(e.currentTarget).attr('id') === 'fd-data-tree') {
	            that.displayMugDataProperties(formdesigner.controller.getCurrentlySelectedMugType());
	        }
	    }
    };
    
    function selectMugTypeInUI(mugType) {
        var ufid = mugType.ufid;
        return $('#fd-question-tree').jstree('select_node', $('#'+ufid), true);
    };
    that.selectMugTypeInUI = selectMugTypeInUI;
    
    function forceUpdateUI() {
        // after deleting a question the tree can in a state where nothing is 
        // selected which makes the form designer sad.
        // If there is nothing selected and there are other questions, just select
        // the first thing. Otherwise, clear out the question editing pane.
        var tree = getJSTree();
        var selected = tree.jstree('get_selected');
        if (selected.length === 0) {
            // if there's any nodes in the tree, just select the first
            var all_nodes = $(tree).find("li");
            if (all_nodes.length > 0) {
                tree.jstree('select_node', all_nodes[0]);
            }
            else {
                // otherwise clear the Question Edit UI pane
                that.hideQuestionProperties();
                // and the selected mug + other stuff in the UI  
                formdesigner.controller.reloadUI();
                
            }            
        } else {
            // already selected, nothing to do 
        }
    };
    that.forceUpdateUI = forceUpdateUI;
    
    /**
     * Creates the UI tree
     */
    function create_question_tree() {
        $.jstree._themes = formdesigner.staticPrefix + "themes/";
        $("#fd-question-tree").jstree({
            "json_data" : {
                "data" : []
            },
            "ui" : {
                select_limit: 1
            },
            "crrm" : {
                "move": {
                    "always_copy": false,
                    "check_move" : function (m) {
                        var controller = formdesigner.controller,
                                mugType = controller.form.controlTree.getMugTypeFromUFID($(m.o).attr('id')),
                                refMugType = controller.form.controlTree.getMugTypeFromUFID($(m.r).attr('id')),
                                position = m.p;
                        return controller.checkMoveOp(mugType, position, refMugType);
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
	    }).bind("select_node.jstree", function (e, data) {
            node_select(e, data);
        }).bind("move_node.jstree", function (e, data) {
            var controller = formdesigner.controller,
                        mugType = controller.form.controlTree.getMugTypeFromUFID($(data.rslt.o).attr('id')),
                        refMugType = controller.form.controlTree.getMugTypeFromUFID($(data.rslt.r).attr('id')),
                        position = data.rslt.p;
            controller.moveMugType(mugType, position, refMugType, 'both');

            if (LINK_CONTROL_MOVES_TO_DATA_TREE) {   //for matching the move in the GUI question tree with the GUI Data Tree
                var elMT, elMTRef, pos;
                elMT = $('#' + mugType.ufid + '_data');
                elMTRef = $('#' + refMugType.ufid + '_data');
                if (elMTRef.length === 0) {
                    elMTRef = -1;
                }
                pos = position;
                $('#fd-data-tree').jstree("move_node",elMT, elMTRef, pos, false);
            }

        });
        questionTree = $("#fd-question-tree");
    }

    function create_data_tree() {
        $.jstree._themes = formdesigner.staticPrefix + "themes/";
        $("#fd-data-tree").jstree({
            "json_data" : {
                "data" : []
            },
            "ui" : {
                select_limit: 1
            },
            "crrm" : {
                "move": {
                    "always_copy": false,
                    "check_move" : function (m) {
                        var controller = formdesigner.controller,
                                mugType = controller.form.dataTree.getMugTypeFromUFID($(m.o).attr('id')),
                                refMugType = controller.form.dataTree.getMugTypeFromUFID($(m.r).attr('id')),
                                position = m.p;
                        return controller.checkMoveOp(mugType, position, refMugType,'data');
//                        return true;  //Data nodes have no bad moves (all data nodes can have data nodes as children)
				    }
                }
            },
            "dnd" : {
                "drop_target" : false,
                "drag_target" : false
            },
            "types": getDataJSTreeTypes(),
            "plugins" : [ "themes", "json_data", "ui", "crrm", "types", "dnd" ]
	    }).bind("select_node.jstree", function (e, data) {
            node_select(e, data);
        }).bind("move_node.jstree", function (e, data) {
            var controller, mugType, refMugType, position;
            controller = formdesigner.controller;
            mugType = controller.form.dataTree.getMugTypeFromUFID($(data.rslt.o).attr('id').replace('_data',''));
            refMugType = controller.form.dataTree.getMugTypeFromUFID($(data.rslt.r).attr('id').replace('_data',''));
            position = data.rslt.p;
            controller.moveMugType(mugType, position, refMugType, 'data');



        }).bind("deselect_all.jstree", function (e, data) {
//            formdesigner.controller.setCurrentlySelectedMugType(null);
//            formdesigner.controller.curSelUfid = null;
        });
        dataTree = $("#fd-data-tree");
    }

    /**
     *
     * @param rootElement
     */
    var generate_scaffolding = function (rootElement) {
        var root = $(rootElement);
        root.empty();
        $.ajax({
            url: formdesigner.staticPrefix + 'templates/main.html',
            async: false,
            cache: false,
            success: function(html){
                root.append(html);
                formdesigner.fire('formdesigner.loading_complete');
            }
        });

    };

    var init_extra_tools = function(){
        function makeLangDrop() {
            var div, addLangButton, removeLangButton, langList, langs, i, str, selectedLang, Itext;
            $('#fd-extra-settings').find('#fd-lang-disp-div').remove();
            div = $('<div id="fd-lang-disp-div"></div>');
            Itext = formdesigner.model.Itext;
            langs = Itext.getLanguages();
            div.append('<span class="fd-form-props-heading">Choose Display Language</span>');

            str = '<select data-placeholder="Choose a Language" style="width:150px;" class="chzn-select" id="fd-land-disp-select">' +
                    '<option value="blank"></option>'
            for (i in langs) {
                if (langs.hasOwnProperty(i)) {
                    if(Itext.getDefaultLanguage() === langs[i]){
                        selectedLang = 'selected';
                    }

                    str = str + '<option value="' + langs[i] + '" >' + langs[i] + '</option>';
                }
            }

            str += '</select>';

            langList = $(str);
            div.append(langList);
            langList.change (function (e) {
                formdesigner.currentItextDisplayLanguage = $(this).val();
                formdesigner.controller.reloadUI();
            })

            langList.val(formdesigner.currentItextDisplayLanguage);

            str = '';
            str = '<button id="fd-lang-disp-add-lang-button">Add Language</button>';
            addLangButton = $(str);
            addLangButton.button();
            addLangButton.click (function () {
                formdesigner.ui.showAddLanguageDialog();
            })
            div.append(addLangButton);
            str = '';
            str = '<button id="fd-lang-disp-remove-lang-button">Remove Langauge</button>';
            removeLangButton = $(str);
            removeLangButton.button();
            removeLangButton.click(function () {
                formdesigner.ui.showRemoveLanguageDialog();
            })
            div.append(removeLangButton);
            div.append('<br/><br/><br/><br/><br/>');
            $('#fd-extra-settings').append(div);
            $(div).find('#fd-land-disp-select').chosen();


        }


        var accContainer = $("#fd-extra-tools"),
            accordion = $("#fd-extra-tools-accordion"),
            minMax = $('#fd-acc-min-max'),
            minMaxButton = $('#fd-min-max-button'),
            questionProps = $('#fd-question-properties'),
            fdTree = $('.fd-tree'),
            fdContainer = $('#fd-ui-container');

        makeLangDrop();
        formdesigner.controller.on('fd-reload-ui', function () {
            makeLangDrop();
        })


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


        (function c_generateSource() {
             var editSource = $(
                     '<button id="fd-editsource-button" class="toolbarButton questionButton">'+
                 'Edit Source XML' +
               '</button>');
             $('#fd-extra-advanced').append(editSource);

             editSource.button().click(function () {
                 formdesigner.controller.showSourceXMLDialog();
             });

         })();

//        (function c_showDataView() {
//             var showDataViewBut = $(
//                     '<button id="fd-dataview-button" class="toolbarButton questionButton">'+
//                 'Show Data View ' +
//               '</button>');
//             $('#fd-extra-advanced').append(showDataViewBut);
//
//             showDataViewBut.button().click(function () {
//                 formdesigner.ui.showDataView();
//             });
//
//            showDataViewBut.button('disable');
//
//         })();

        (function c_clearCruftyItext() {
            var clearCruftBut = $(
                     '<button id="fd-cruftyItextRemove-button" class="toolbarButton questionButton">'+
                 'Remove Unused Itext ' +
               '</button>');
             $('#fd-extra-advanced').append(clearCruftBut);

            clearCruftBut.button().click(function () {
                var msg = "Are you sure you want to remove all unused Itext?";
                var onContinue = function () {
                    formdesigner.ui.hideConfirmDialog();
                    window.setTimeout(function () {
                        formdesigner.controller.removeCruftyItext();
                    }, 200);
                };

                var onAbort = function () {
                    formdesigner.ui.hideConfirmDialog();
                }

                formdesigner.ui.setDialogInfo(msg,'Continue',onContinue,'Abort',onAbort);
                formdesigner.ui.showConfirmDialog();
            });

        }());


        $('#fd-extra-template-questions div').each(function(){
            $(this).button({
                            icons : {
                                primary : 'ui-icon-gear'
                            }
                        });
        }).button("disable");

        function makeFormProp (propLabel, propName, keyUpFunc, initVal){
            var liStr = '<li id="fd-form-prop-' + propName + '" class="fd-form-property"><span class="fd-form-property-text">'+propLabel+': '+'</span>' +
                '<input id="fd-form-prop-' + propName + '-' + 'input" class="fd-form-property-input">'+
                '</li>',
                li = $(liStr),
                ul = $('#fd-form-opts-ul');

            ul.append(li);
            $(li).find('input').val(initVal)
                               .keyup(keyUpFunc);


        };

        function fireFormPropChanged (propName, oldVal, newVal) {
            formdesigner.controller.form.fire({
                type: 'form-property-changed',
                propName: propName,
                oldVal: oldVal,
                newVal: newVal
            })
        };

        var formNameFunc = function (e) {
            fireFormPropChanged('formName',formdesigner.controller.form.formName, $( this ).val());
            formdesigner.controller.form.formName = $(this).val();
        }
        makeFormProp("Form Name","formName", formNameFunc, formdesigner.controller.form.formName);

        var formIDFunc = function (e) {
            $(this).val($(this).val().replace(/ /g,'_'));
            fireFormPropChanged('formID',formdesigner.controller.form.formID, $( this ).val());
            formdesigner.controller.form.formID = $(this).val();
        }
        makeFormProp("Form ID", "formID", formIDFunc, formdesigner.controller.form.formID);

    };
    
    
    var setTreeNodeInvalid = function (uid, msg) {
        $($('#' + uid)[0]).append('<div class="ui-icon ui-icon-alert fd-tree-valid-alert-icon" title="'+msg+'"></div>')
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
    var setAllTreeValidationIcons = function () {
        var dTree, cTree, uiDTree, uiCTree, form,
                invalidMTs, i, invalidMsg, liID;

        //init things
        uiCTree = $('#fd-question-tree');
        uiDTree = $('#fd-data-tree');
        form = controller.form;
        cTree = form.controlTree;
        dTree = form.dataTree;


        function clearIcons (tree) {
            tree.find('.fd-tree-valid-alert-icon').remove();
        };

        clearIcons(uiCTree); //clear existing warning icons to start fresh.
        clearIcons(uiDTree); //same for data tree
        invalidMTs = form.getInvalidMugTypeUFIDs();
        for (i in invalidMTs){
            if(invalidMTs.hasOwnProperty(i)){
                invalidMsg = invalidMTs[i].message.replace(/"/g,"'");
                //ui tree
                liID = i;
                setTreeNodeInvalid(liID, invalidMsg);

                //data tree
                liID = i + "_data";
                setTreeNodeInvalid(liID, invalidMsg);
            }
        }

    };
    that.setAllTreeValidationIcons = setAllTreeValidationIcons;

    var removeMugTypeFromUITree = function (mugType) {
//        var controlTree, el, ufid;
//        ufid = mugType.ufid;
//        el = $("#" + ufid);
//        controlTree = $("#fd-question-tree");
//        // this event _usually_ will select another mug from the tree
//        // but NOT if the first element is removed.
//        // In this case we select the topmost node (if available)
//        // See also: forceUpdateUI
//        controlTree.jstree("remove",el);
        removeMugTypeFromTree (mugType, $('#fd-question-tree'));
        
    };
    that.removeMugTypeFromUITree = removeMugTypeFromUITree;

    var removeMugTypeFromDataTree = function (mugType) {
        removeMugTypeFromTree (mugType, $('#fd-data-tree'));
    };
    that.removeMugTypeFromDataTree = removeMugTypeFromDataTree;

    var removeMugTypeFromTree = function (mugType, tree) {
        var el, ufid;
        tree = $(tree); //ensure it's a jquery element
        ufid = mugType.ufid;
        el = $("#" + ufid);
        if (tree.attr('id') === 'fd-data-tree') {
            el = $('#' + ufid + '_data');
        }
        tree.jstree("remove",el);
    }

    function setup_fancybox(){
        $("a#inline").fancybox({
            hideOnOverlayClick: false,
            hideOnContentClick: false,
            enableEscapeButton: false,
            showCloseButton : true,
            onClosed: function(){
            }
        });

        $('#fancybox-overlay').click(function () {

        })
    };

    function init_form_paste(){
        var tarea = $("#fd-form-paste-textarea");
        tarea.change(function(){
            var parser = new controller.Parser();
            var out = parser.parse(tarea.val());
            $("#fd-form-paste-output").val(out);
        })
    }

    /**
     * Clears all elements of current form data (like in the Control/Data  tree)
     * without destroying jqueryUI elements or other widgets.  Should be slightly
     * faster/easier than rebuilding the entire interface from scratch.
     */
    that.resetUI = function(){
        /**
         * Clear out all nodes from the given UI jsTree.
         * @param tree - Jquery selector pointing to jstree instance
         */
        function clearUITree(tree){
            tree.jstree('deselect_all');
            tree.find('ul').empty();
        };

        clearUITree($('#fd-question-tree'));
        clearUITree($('#fd-data-tree'));

        $('#fd-form-prop-formName-input').val(formdesigner.controller.form.formName);
        $('#fd-form-prop-formID-input').val(formdesigner.controller.form.formID);

    };

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

        $('#fd-remove-button').button(butState); //remove question button
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

    var disableUI = function () {
        flipUI(false);
    }
    that.disableUI = disableUI;

    var enableUI = function () {
        flipUI(true);
    }
    that.enableUI = enableUI;




    function init_modal_dialogs () {
        $( "#fd-dialog-confirm" ).dialog({
			resizable: false,
			modal: true,
			buttons: {
				"Confirm": function() {
					$( this ).dialog( "close" );
				},
				Cancel: function() {
					$( this ).dialog( "close" );
				}
			},
            autoOpen: false
		});
    }
    var newLang = null;
    var addLanguageDialog = function() {
        function beforeClose (event,ui) {
            //grab the input value and add the new language
            if($('#fd-new-lang-input').val()) {
                formdesigner.model.Itext.addLanguage($('#fd-new-lang-input').val())
            }
        }

        var div = $( "#fd-dialog-confirm" ),input,contStr;
                
        div.dialog( "destroy" );
        div.empty();


        contStr = '<p> <span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>' +
                '<span class="fd-message">Enter name of new Language</span> ' +
                '<div id="fd-new-lang-div"><input id="fd-new-lang-input" /></div>' +
                '</p>'
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
                    displayMugProperties(currentMug);
                }
                
            }
            
        })

    }

    var removeLanguageDialog = function () {
        function beforeClose (event,ui) {
            //grab the input value and add the new language
            if($('#fd-remove-lang-input').val() != '') {
                formdesigner.model.Itext.removeLanguage($('#fd-remove-lang-input').val())
                formdesigner.currentItextDisplayLanguage = formdesigner.model.Itext.getDefaultLanguage();
            }
        }

        var div = $( "#fd-dialog-confirm" ),input,contStr, langToBeRemoved, buttons, msg;

        div.dialog( "destroy" );
        div.empty();


        if(formdesigner.model.Itext.getLanguages().length == 1) {
            //When there is only one language in the 
            langToBeRemoved = '';
            msg = 'You need to have at least one language in the form.  Please add a new language before removing this one.';
        } else {
            langToBeRemoved = formdesigner.currentItextDisplayLanguage
            msg = 'Are you sure you want to permanently remove this language?';
        }

        contStr = '<p> <span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>' +
                '<span class="fd-message">' + msg + '</span> ' +
                '<div id="fd-new-lang-div"><input id="fd-remove-lang-input" type="hidden"/></div>' +
                '</p>'

        div.append(contStr);

        // We use the following hidden input box as a flag to determine what to do in the beforeClose() func above.
        $('#fd-remove-lang-input').val(langToBeRemoved);

        buttons = {}
        buttons["Cancel"] = function () {
            $('#fd-remove-lang-input').val('')
            $(this).dialog("close");
        }

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
                    displayMugProperties(currentMug);
                }
            }
        })
    }


    /**
     * A simple toggle for flipping the type of UI tree visible to the user.
     */
    var showDataView = function () {
        that.hideQuestionProperties();
        $('#fd-data-tree-container').toggle();
        $('#fd-question-tree-container').toggle();
    }
    that.showDataView = showDataView;

    var showConfirmDialog = function () {
        $( "#fd-dialog-confirm" ).dialog("open");
    };
    that.showConfirmDialog = showConfirmDialog;

    var hideConfirmDialog = function () {
        $( "#fd-dialog-confirm" ).dialog("close");
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
    }
    that.showRemoveLanguageDialog = showRemoveLanguageDialog;

    /**
     * Set the values for the Confirm Modal Dialog
     * (box that pops up that has a confirm and cancel button)
     * @param confButName
     * @param confFunction
     * @param cancelButName
     * @param cancelButFunction
     */
    var setDialogInfo = that.setDialogInfo = function (message, confButName, confFunction, cancelButName, cancelButFunction){
        var buttons = {}, opt,
                dial = $('#fd-dialog-confirm'), contentStr;
            buttons[confButName] = confFunction;
            buttons[cancelButName] = cancelButFunction;

        dial.empty();
        contentStr = '<p>' +
                    '<span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>' +
            '<span class="fd-message">These items will be permanently deleted and cannot be recovered. Are you sure?</span></p>';
        dial.append(contentStr);
        if(!message || typeof(message) !== "string"){
            message = "";
        }
        $('#fd-dialog-confirm .fd-message').text(message);
        
        $( "#fd-dialog-confirm" ).dialog("option",{buttons: buttons});
    }
    that.setDialogInfo = setDialogInfo;

    var showWaitingDialog = that.showWaitingDialog = function (msg) {
        var dial = $('#fd-dialog-confirm'), contentStr;
        if(!msg || typeof msg !== 'string') {
            msg = 'Saving form to server...';
        }
        dial.empty();
        dial.dialog("destroy");
        dial.dialog({
            modal: true,
            autoOpen: false,
            buttons : {},
            closeOnEscape: false,
            open: function(event, ui) { $(".ui-dialog-titlebar-close").hide(); },
            close: function(event, ui) { $(".ui-dialog-titlebar-close").show(); }
        });
        contentStr = '<p>' +
            '<span class="fd-message">' + msg+ '</span><div id="fd-form-saving-anim"></div></p>'
        dial.append(contentStr);
        $('#fd-form-saving-anim').append('<img src="'+formdesigner.staticPrefix+'images/ajax-loader.gif" id="fd-form-saving-img"/>')

        showConfirmDialog();
    }

    that.hideWaitingDialog = function () {
        hideConfirmDialog();
    }

    var init_misc = function () {
        controller.on('question-creation', function (e) {
            setAllTreeValidationIcons();
        });
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
		            if (it === e.item && e.form === "default") {
		                if (e.value && e.value !== $('#fd-question-tree').jstree("get_text", node)) {
                            $('#fd-question-tree').jstree('rename_node', node, e.value);
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
                if (it && it.getValue("default", currLang) !== $('#fd-question-tree').jstree("get_text", node)) {
                    $('#fd-question-tree').jstree('rename_node', node, it.getValue("default", currLang));
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
        /*
         * All the logic to display the XPath Editor widget.
         * 
         */
        var expTypes = xpathmodels.XPathExpressionTypeEnum;
        var questionList = formdesigner.controller.getMugTypeList();
        var questionChoiceAutoComplete = questionList.map(function (item) { 
            return formdesigner.util.mugToAutoCompleteUIElement(item);
        });
        
        var editorPane = $('#fd-xpath-editor');
        
        var getExpressionInput = function () {
            return $("#fd-xpath-editor-text");
        }
        var getValidationSummary = function () {
            return $("#fd-xpath-validation-summary");
        }
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
            
            var isPath  = function (subElement) {
                return (subElement instanceof xpathmodels.XPathPathExpr); 
            }
            var isJoiningOp = function (subElement) {
                // something that joins expressions
                return (subElement instanceof xpathmodels.XPathBoolExpr); 
            };
            
            var isExpressionOp = function (subElement) {
                // something that can be put into an expression
                return (subElement instanceof xpathmodels.XPathCmpExpr ||
                        subElement instanceof xpathmodels.XPathEqExpr); 
            }
            
            var isSupportedBaseType = function (subelement) {
                // something that can be stuck in a base string
                // currently everything is supported.
                return true;
            };
            
            var createJoinSelector = function() {
                var ops = [["and", expTypes.AND],
                           ["or", expTypes.OR]];
                return constructSelect(ops).addClass("join-select");
            };
            
            var newExpressionUIElement = function (expOp) {
            
                // create the UI for an individual expression
                var createQuestionAcceptor = function() {
	                var questionAcceptor = $("<input />").attr("type", "text").attr("placeholder", "Hint: drag a question here.");
	                return questionAcceptor;
	            };
	            
	            var createOperationSelector = function() {
	                var ops = [["is equal to", expTypes.EQ],
	                           ["is not equal to", expTypes.NEQ],
	                           ["is less than", expTypes.LT],
	                           ["is less than or equal to", expTypes.LTE],
	                           ["is greater than", expTypes.GT],
	                           ["is greater than or equal to", expTypes.GTE]];
	                     
	                return constructSelect(ops).addClass("op-select");
	            };
	            
	            var expression = $("<div />").addClass("bin-expression");
                
                var createQuestionInGroup = function (type) {
                     var group = $("<div />").addClass("expression-part").appendTo(expression);
                     return createQuestionAcceptor().addClass(type + "-question xpath-edit-node").appendTo(group);
                };
                
                var getLeftQuestionInput = function () {
                    return $(expression.find(".left-question")[0]);
                } 
                
                var getRightQuestionInput = function () {
                    return $(expression.find(".right-question")[0]);
                } 
                
                var getValidationResults = function () {
                    return $(expression.find(".validation-results")[0]);
                }
                
                var validateExpression = function(item) {
                    var le = getLeftQuestionInput().val(),
                        re = getRightQuestionInput().val();
                    if (le && validate(le)[0] && re && validate(re)[0]) {
                        getValidationResults().text("ok").addClass("success ui-icon-circle-check").removeClass("error");
                    } else {
                        getValidationResults().text("fix").addClass("error").removeClass("success");
                    }
                }
                
                var left = createQuestionInGroup("left")
                var op = createOperationSelector().appendTo(expression);
                var right = createQuestionInGroup("right")
                var deleteButton = $("<div />").text("Delete").button().css("float", "left").appendTo(expression);
                var validationResults = $("<div />").addClass("validation-results").appendTo(expression);
                
                // BEGIN token input code (not used, but configurably reenabled)
	            var updateTokenInputSelectOptions = function (inputControl, selectQuestion, value) {
	                // this does nothing.
	                
	                // with token input enabled it correctly populates the autocomplete,
	                // which only works on the right box
	                if (TOKEN_INPUT) {
		                // this is pretty ridiculous but it seems to work.
	                    // remove and re add the entire right expression part
	                    inputControl.parents(".expression-part").remove();
		                inputControl = createQuestionInGroup("right");
		                var children = formdesigner.controller.getChildren(selectQuestion);
		                var autoCompleteChildren = children.map(function (item) { 
		                    return formdesigner.util.mugToAutoCompleteUIElement(item);
		                });
		                var selectItemOptions = {
		                       theme: "facebook", 
		                       //tokenLimit: 1,
		                       tokenDelimiter: " ", 
		                       searchDelay: 0, 
		                       allowFreetext: true,
		                       hintText: "Type in a select option name.",
		                       noResultsText: "No matching options found.",
		                       onAdd: validateExpression,
		                       onDelete: validateExpression
		                };
		                inputControl.tokenInput(autoCompleteChildren, selectItemOptions);
		                var found = false;
	                    if (value && value instanceof xpathmodels.XPathStringLiteral) {
		                    for (var i = 0; i < children.length; i++) {
		                       if (children[i].mug.properties.controlElement.properties.defaultValue === value.value) {
		                           inputControl.tokenInput("add", formdesigner.util.mugToAutoCompleteUIElement(children[i]));
		                           found = true;
		                           break;
	                           }
		                    }
		                }
		                if (value && !found) {
		                   // put in something, even though it wasn't properly handled
		                   inputControl.tokenInput("add", {id: value.toXPath(), name: value.toXPath()});
		                }
	                    // reenable drop target
	                    expression.find(".token-input-list-facebook").addClass("jstree-drop");
	                }
	            }
	            
	            var setTokenInputOptions = function() {
	                // set fancy input mode on the boxes
	                var baseOptions = {theme: "facebook", 
	                                   //tokenLimit: 1,
	                                   tokenDelimiter: " ", 
	                                   searchDelay: 0, 
	                                   allowFreetext: true,
	                                   hintText: "Type in a question name or drag a question here.",
	                                   noResultsText: "No questions found. Press 'ENTER' to use a freetext value.",
	                                   onDelete: validateExpression
	                                   };
	                
	                var leftOptions = formdesigner.util.clone(baseOptions); 
	                var rightOptions = formdesigner.util.clone(baseOptions); 
	                
	                rightOptions.onAdd = validateExpression;
	                leftOptions.onAdd = function (item) {
	                    validateExpression();
	                    // for the left input only, if we add a select question, 
	                    // rebuild the autocomplete on the right side to support options
	                    if (item.uid) {
	                        // only questions have a uid
	                        var mug = formdesigner.controller.form.controlTree.getMugTypeFromUFID(item.uid);
	                        if (formdesigner.util.isSelect(mug)) {
	                            updateTokenInputSelectOptions(right, mug);
	                        }
	                    }    
	                };
	                
	                left.tokenInput(questionChoiceAutoComplete, leftOptions);
                    right.tokenInput(questionChoiceAutoComplete, rightOptions);
                    // also make them drop targets for the tree
                    expression.find(".token-input-list-facebook").addClass("jstree-drop");
                };
                
                var updateTokenInputQuestionBox = function(input, expr, pairedExpr) {
                    var mug;
                    if (isPath(expr)) {
                       mug = formdesigner.controller.getMugByPath(expr.toXPath());
                       if (mug) {
                           input.tokenInput("add", formdesigner.util.mugToAutoCompleteUIElement(mug));
                           return;       
                       }
                    } else if (isPath(pairedExpr)) {
                       // potentially load the UI element for the select value
                       // currently only if the left hand side is a select
                       mug = formdesigner.controller.getMugByPath(pairedExpr.toXPath());
                       if (mug && formdesigner.util.isSelect(mug)) {
                           updateTokenInputSelectOptions(input, mug, expr);
                           return;
                       }
                    }
                    // default case
                    input.tokenInput("add", {id: expr.toXPath(), name: expr.toXPath()});
                };
                
                // END token input code (not used, but configurably reenabled)
                
                var populateQuestionInputBox = function (input, expr, pairedExpr) {
                    if (TOKEN_INPUT) {
                        updateTokenInputQuestionBox(input, expr, pairedExpr);
                    } else {
                        input.val(expr.toXPath());
                    }
                };
                
                var setBasicOptions = function () {
                    // just make the inputs droppable and add event handlers to validate
                    // the inputs
                    expression.find(".xpath-edit-node").addClass("jstree-drop");
                    expression.find(".xpath-edit-node").keyup(validateExpression);
                    expression.find(".xpath-edit-node").change(validateExpression);                    
                }
                
                if (TOKEN_INPUT) {
                    setTokenInputOptions();
                } else {
                    setBasicOptions();
                }
                
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
	        }
	        
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
            var advancedFailover = function (text) {
               alert("We couldn't interpret your expression to our format, so defaulting to advanced mode. " +
                     "Please fix your expression before using the expression builder. To start over " + 
                     "delete the contents of the advanced editor box and uncheck 'Advanced Mode'.");
               showAdvancedMode(text);
            }
            if (results[0]) {
               // it parsed correctly, try to load it.
               var parsed = results[1];
               // try to load the operation into the UI.
               if (tryAddExpression(parsed)) {
                   // it succeeded. nothing more to do
               } else {
                   // show advanced mode.
                   advancedFailover(parsed.toXPath());
               }
	        } else {
               advancedFailover(xpathstring);
	        }
        }
        var updateXPathEditor = function(options) {
            // set data properties for callbacks and such
            editorPane.data("group", options.group).data("property", options.property);
	        // clear validation text
	        getValidationSummary().text("").removeClass("error").removeClass("success");
	        
	        // clear expression builder
	        var expressionPane = getExpressionPane();
	        expressionPane.empty();
	        
	        // update expression builder
	        if (options.value) {
	           showSimpleMode(options.value);
	        } else {
	           // nothing to do     
	           showSimpleMode();
	        }
	        
	        $("#fd-xpath-editor-text").val(options.value);
	        
        };
        
        // toggle simple/advanced mode
        var showAdvancedMode = function (text) {
            getExpressionInput().val(text);
            getExpressionPane().empty();
            $("#xpath-advanced-check").attr("checked", true);
            $("#xpath-advanced").show();
            $("#xpath-simple").hide();
        };
        var showSimpleMode = function (text) {
            $("#xpath-simple").show();
            $("#xpath-advanced").hide();
            $("#xpath-advanced-check").attr("checked", false);
            getExpressionPane().empty();
            // this sometimes sends us back to advanced mode (if we couldn't parse)
            // for now consider that fine.
            if (text) {
                setUIForExpression(text);
            }
        };
        var initXPathEditor = function() {
            $("<div />").attr("id", "xpath-edit-head").addClass("ui-widget-header").text("Expression Editor").appendTo(editorPane);
            var mainPane = $("<div />").attr("id", "xpath-edit-inner").appendTo(editorPane);
            $("<label />").attr("for", "xpath-advanced-check").text("Advanced Mode?").appendTo(mainPane);
            var advancedModeSelector = $("<input />").attr("type", "checkbox").attr("id", "xpath-advanced-check").appendTo(mainPane);
            advancedModeSelector.css("clear", "both");
            
            advancedModeSelector.click( function(){
                if ($(this).is(':checked')) {
                    showAdvancedMode(getExpressionFromSimpleMode());
                } else {
                    showSimpleMode(getExpressionInput().val());
                }
            });
            
            // advanced UI
            var advancedUI = $("<div />").attr("id", "xpath-advanced").appendTo(mainPane);
            $("<label />").attr("for", "fd-xpath-editor-text").text("XPath String: ").appendTo(advancedUI);
            $("<textarea />").attr("id", "fd-xpath-editor-text").attr("rows", "2").attr("cols", "50").appendTo(advancedUI);
            
            // simple UI
            var simpleUI = $("<div />").attr("id", "xpath-simple").appendTo(mainPane);
            
            var topLevelJoinOps = [["True when ALL of the expressions are true.", expTypes.AND],
                                ["True when ANY of the expressions are true.", expTypes.OR]]
                    
            constructSelect(topLevelJoinOps).appendTo(simpleUI).attr("id", "top-level-join-select");
            $("<div />").attr("id", "fd-xpath-editor-expressions").appendTo(simpleUI);
            var addExpressionButton = $("<button />").text("Add expression").button().appendTo(simpleUI);
            addExpressionButton.click(function() {
                tryAddExpression();
            });
            
            // shared UI
            var doneButton = $('<button />').text("Save").button().appendTo(mainPane);
	        doneButton.click(function() {
	           getExpressionInput().val(getExpressionFromUI());
	           var results = validateCurrent();
	           if (results[0]) {
		           formdesigner.controller.doneXPathEditor({
		               group:    $('#fd-xpath-editor').data("group"),
		               property: $('#fd-xpath-editor').data("property"),
		               value:    getExpressionFromUI()
		           });
	           } else {
	               getValidationSummary().text("Validation Failed! Please fix all errors before leaving this page. " + results[1]).removeClass("success").addClass("error");
	           }
	        });
	        var validationSummary = $("<div />").attr("id", "fd-xpath-validation-summary").appendTo(mainPane);
        }
        
        if (editorPane.children().length === 0) {
            initXPathEditor();
        } 
        
        updateXPathEditor(options);
        editorPane.show();
    };
    
    that.hideXPathEditor = function() {
        $('#fd-xpath-editor').hide();
    }

    that.init = function(){
        controller = formdesigner.controller;
        generate_scaffolding($(formdesigner.rootElement));
        init_toolbar();
        init_extra_tools();
        create_question_tree();
        create_data_tree();
        //hide the data JSTree initially.
        $('#fd-data-tree-container').hide();
        init_form_paste();
        init_modal_dialogs();

        init_misc();
        set_event_listeners(); 
        
        setup_fancybox();
    }



    $(document).ready(function () {

    });

    return that;
}());

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
    if(opts.rootElement){
        formdesigner.rootElement = opts.rootElement;
    }else{
        formdesigner.rootElement = '#formdesigner';
    }

    if(opts.staticPrefix){
        formdesigner.staticPrefix = opts.staticPrefix
    }else {
        formdesigner.staticPrefix = "";
    }

    formdesigner.saveUrl = opts.saveUrl;
    formdesigner.loadMe = opts.form;
    
    formdesigner.iconUrl = opts.iconUrl ? opts.iconUrl : "css/smoothness/images/ui-icons_888888_256x240.png";

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

    window.setTimeout(function () {
        formdesigner.ui.showWaitingDialog("Loading form...");
        formdesigner.controller.reloadUI();
        formdesigner.ui.hideConfirmDialog();
    }, 400);



}

formdesigner.rootElement = '';
