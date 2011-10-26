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
        DEBUG_MODE = false;
        

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


    function init_toolbar() {4
        var toolbar = $(".fd-toolbar"), select, addbutstr, addbut;

        select = $('#fd-question-select');
        addbutstr = '<button id="fd-add-but">Add</button>';
        select.after(addbutstr);
        addbut = $('#fd-add-but');
        addbut.button({
            icons:{
                primary: 'ui-icon-gear'
            }
        });

        function findq () {
            var selVal, qID,qType;
            selVal = $('#fd-question-select').val();
            qID = $('#fd-question-select').find('[value*="'+selVal+'"]').attr('id');
            qType = qID.split('-')[2];
            formdesigner.controller.createQuestion(qType);
        }
        addbut.click(findq);

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
            var loadXLSBut = $(
                    '<button id="fd-load-xls-button" class="toolbarButton questionButton">'+
                'Load Itext XLS From Clipboard' +
              '</button>');
            $('#fd-dragons').append(loadXLSBut);

            loadXLSBut.button().click(function () {
                formdesigner.controller.showLoadItextFromClipboard();

            });
        })();

        (function c_showGeneratedItextXLS() {
            var genXLSgbut = $(
                    '<button id="fd-gen-xls-button" class="toolbarButton questionButton">'+
                'Save Itext XLS to Clipboard' +
              '</button>');
            $('#fd-dragons').append(genXLSgbut);

            genXLSgbut.button().click(function () {
                formdesigner.controller.showGeneratedItextXLS();
            });
        })();

        (function c_saveForm() {
            var savebut = $(
                    '<button id="fd-save-button" class="toolbarButton questionButton">'+
                'Save Form to Server' +
              '</button>');
            toolbar.append(savebut);

            savebut.button().click(function () {
                formdesigner.controller.sendXForm();
            });

        })();

        (function c_removeSelected() {
            var removebut = $(
                    '<button id="fd-remove-button" class="toolbarButton questionButton">'+
                'Remove Selected' +
              '</button>');
            toolbar.append(removebut);

            removebut.button().click(function () {
                var selected = formdesigner.controller.getCurrentlySelectedMugType();
                formdesigner.controller.removeMugTypeFromForm(selected);
            });

        })();

    }
    that.buttons = buttons;

    //Sets a visual indicator that the form needs saving on the 'Save Form To Server' Button
    that.setSaveButtonFormUnsaved = function () {
        var saveBut = $('#fd-save-button');
        saveBut.button('enable');
        saveBut.button('option', 'icons', {primary:'ui-icon-alert'});
    }

    //Sets a visual indicator that the form IS saved (on 'Save Form To Server' Button)
    that.setSaveButtonFormSaved = function () {
        var saveBut = $('#fd-save-button');
        saveBut.button('disable');
        saveBut.button('option', 'icons', {primary:'ui-icon-check'});
    }

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
        function setValidationFailedIcon(li,showIcon, message){
            var exists = ($(li).find('.fd-props-validate').length > 0);
            if(exists && showIcon){
                return;
            }else if (exists && !showIcon){
                $(li).find('.fd-props-validate').removeClass('ui-icon');
            }else if(!exists && showIcon){
                var icon = $('<span class="fd-props-validate ui-icon ui-icon-alert"></span>');
                icon.attr('title',message);
                
                li.append(icon);
            }
            return li;
        }

        function loopValProps (block, name){
            var i, res, msg, li;
            if(block){
                for(i in block){
                    if(block.hasOwnProperty(i)){
                        res = block[i].result;
                        msg = block[i].resultMessage;
                        li = findLIbyPropertyName(i, name);
                        if(res === 'fail'){
                            setValidationFailedIcon(li, true, msg);
                            propsMessage += '<p>' + msg + '</p>';
                        }else if(res === 'pass'){
                            setValidationFailedIcon(li, false, msg);
                        }
                    }
                }
            }
        }

        function findLIbyPropertyName(i,blockName){
            return $('#' + blockName + '-' + i);
        }

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
    var displayMugProperties = that.displayMugProperties = that.displayQuestion = function(mugType, showControl, showBind, showData){
        // always hide the xpath editor if necessary 
        that.hideXPathEditor();
        that.showTools();
        
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
         
        
        var makeUL = function (heading){
            var str = '<ul class="fd-props-ul"><span class="fd-props-heading">' + heading + '</span></ul>';
            return $(str);
        }

        var displayFuncs = {};

        function setSpecialDataValueWidgetTypes (selector) {
            if(!selector) {
                selector = $('#dataElement-dataValue :input')
            } else {
                selector = $(selector);
            }
            var dIn = selector,
                curMug = formdesigner.controller.getCurrentlySelectedMugType().mug,
                selectedDataType;
            if(dIn.length === 1) { //Default Data Value element exists
                //cleanup
                if(dIn.datepicker) {
                    dIn.datepicker('destroy');
                }
                if(dIn.datetimepicker) {
                    dIn.datetimepicker('destroy');
                }
                if(dIn.timepicker) {
                    dIn.timepicker('destroy');
                }
                if(curMug.properties.bindElement) {
                    if(curMug.properties.bindElement.properties.dataType){
                        selectedDataType = curMug.properties.bindElement.properties.dataType.toLowerCase();
                    }
                }

            }

            if(selectedDataType === 'xsd:date') {
                dIn.datepicker({ dateFormat: 'yy-mm-dd' });
            } else if (selectedDataType === 'xsd:datetime') {
                dIn.datetimepicker();
            } else if (selectedDataType === 'xsd:time') {
                dIn.timepicker({});
            }
        }
        
        /**
         * Runs through a properties block and generates the
         * correct li elements (and appends them to the given parentUL)
         *
         * @param propertiesBlock - The propertiesinput block from the MugType (e.g. mugType.properties.controlElement
         * @param parentUL - The UL DOM node that an LI should be appended to.
         * @param mugProps - actual mug properties corresponding to the propertiesBlock above
         * @param groupName - Name of the current properties block (e.g. 'controlElement'
         * @param showVisible - Show properties with the visibility flag set to 'visible'
         * @param showHidden - Show properties with the visibility flag set to 'hidden'
         */
        function listDisplay(propertiesBlock, parentUL, mugProps, groupName, showVisible, showHidden){
            function getWidget (propBlockIndex) {
                var liStr,li,
                p = propertiesBlock[propBlockIndex],
                        itemID,html, labelStr, i, xPathButton;

                labelStr = p.lstring ? p.lstring : propBlockIndex;
                itemID = groupName + '-' + propBlockIndex + '-' + 'input';
                html = '<span class="fd-property-text">'+labelStr+': '+'</span>'
                if (!p.uiType || p.uiType === 'input') {
                    html = html + '<div class="fd-prop-input-div chzn-container"><input id="' + itemID + '" class="fd-property-input" /></div>'
                } else if (p.uiType === 'select') {
                    html = html +
                            '<span class="fd-prop-input-div"><select data-placeholder="Choose a ' + labelStr + '" style="width:300px;" class="chzn-select"' +
                            ' id="' + itemID + '">' +
                                '<option value="blank"></option>';
                    for (i in p.values) {
                        if (p.values.hasOwnProperty(i)) {
                            var strVal = formdesigner.util.fromCamelToRegularCase(p.values[i].replace('xsd:','')),
                            isSelected = '';

                            if (mugProps[propBlockIndex] === p.values[i]) {
                                isSelected = 'selected';
                            }


                            html = html + '<option value="' + p.values[i] + '" '+ isSelected + '>' + strVal + '</option>';
                        }
                    }

                    html = html + '</select></span>';
                } else if (p.uiType === 'mselect') {
                    html = html + '<span class="fd-prop-input-div">' + '</span>';
                } else if (p.uiType === 'checkbox') {
                    html = html + '<div class="fd-prop-input-div-checkbox"><input id="' + itemID + '" class="fd-property-checkbox" type="checkbox"></div>'
                } else if (p.uiType === "xpath") {
                    html = html + '<div class="fd-prop-input-div chzn-container">';
                    html = html + '<input id="' + itemID + '" style="width:220px;"/>';
                    // the button gets added later
                    html = html + '</div>';
                }

                liStr = '<li id="' + groupName + '-' + propBlockIndex + '" class="fd-property">' +
                            html +
                            '</li>'
                li = $(liStr);
                if (p.uiType === "xpath") {
                    // make and add the xpath button down here, since we want to work with 
                    // the jquery objects
                    xPathButton = $('<button />').addClass("xpath-edit-button").text("Edit").button();
                    xPathButton.data("group", groupName).data("prop", propBlockIndex).data("inputControlID", itemID);
                    xPathButton.click(function () {
                        formdesigner.controller.displayXPathEditor({
                            group:    $(this).data("group"),
                            property: $(this).data("prop"),
                            value:    $("#" + $(this).data("inputControlID")).val()
                        });
                    });
                    
                    $(li.children("div")[0]).append(xPathButton);
                }
                return li;
            }



            var i, li;
            for(i in propertiesBlock){
                if(propertiesBlock.hasOwnProperty(i)){
                    var show = ((showVisible && propertiesBlock[i].visibility === 'visible') || (showHidden && propertiesBlock[i].visibility === 'advanced')) && propertiesBlock[i].presence !== 'notallowed';
                    if(show){
                        var pBlock = propertiesBlock[i],
                        input;

                        li = getWidget(i);
                        input = $(li).find(':input');

                        //set some useful data properties
                        input.data('propName',i);
                        input.data('groupName', groupName);


                        //set initial value for each input box (if any)
                        input.val(mugProps[i]);  //<--- POTENTIAL PAIN POINT! Could be something that's not a string!

                        //set event handler

                        if(!pBlock.uiType || pBlock.uiType === 'input' || pBlock.uiType === 'xpath'){
                            input.keyup(function(e){
                                var input = $(e.currentTarget),
                                        groupName = input.data('groupName'),
                                        propName = input.data('propName'),
                                        curMug = formdesigner.controller.getCurrentlySelectedMug(),
                                        curMT = formdesigner.controller.getCurrentlySelectedMugType(),
                                        oldItextID;

                                if (propName === 'nodeID' && input.val().indexOf(" ") != -1){ 
                                    // sanitize nodeID;
                                    input.val(input.val().replace(/\s/g,'_'));
                                }

                                //short circuit the mug property changing process for when the
                                //nodeID is changed to empty-string (i.e. when the user backspaces
                                //the whole value).  This allows us to keep a reference to everything
                                //and rename smoothly to the new value the user will ultimately enter.
                                if (input.val() === "" && (propName === 'nodeID' || propName === 'labelItextID' || propName === 'hintItextID')) {
                                    return;
                                }

                                if (propName === 'labelItextID' || propName === 'hintItextID') {
                                    oldItextID = curMug.properties.controlElement.properties[propName];
                                    formdesigner.model.Itext.renameItextID(oldItextID,input.val());
                                }



                                formdesigner.controller.setMugPropertyValue(curMug,groupName,propName,input.val(),curMT);
                            });
                        }else if(pBlock.uiType === 'select'){
                            input.change(function (e) {
                                var select = $(e.currentTarget),
                                        groupName = select.data('groupName'),
                                        propName = select.data('propName'),
                                        curMug = formdesigner.controller.getCurrentlySelectedMug(),
                                        curMT = formdesigner.controller.getCurrentlySelectedMugType(),
                                        propVal = select.val();

                                formdesigner.controller.setMugPropertyValue(curMug,groupName,propName,select.val(),curMT);
                                setSpecialDataValueWidgetTypes();
                            });
                        }else if(pBlock.uiType === 'checkbox'){
                            input.prop("checked",mugProps[i]);

                            input.change(function (e) {
                                var input = $(e.currentTarget),
                                        groupName = input.data('groupName'),
                                        propName = input.data('propName'),
                                        curMug = formdesigner.controller.getCurrentlySelectedMug(),
                                        curMT = formdesigner.controller.getCurrentlySelectedMugType();
                                formdesigner.controller.setMugPropertyValue(curMug,groupName,propName,input.prop("checked"),curMT);
                            });
                        }



                        


                        parentUL.append(li);
                    }
                }
            }
        }

        function showControlProps(){
            if (!showControl) {
                return;
            }
            var properties = mugType.properties.controlElement,
                    uiBlock = $('#fd-props-control'),
                    ul;

            uiBlock.empty(); //clear it out first in case there's anything present.
            ul = makeUL('Control Properties');


            listDisplay(properties, ul, mugType.mug.properties.controlElement.properties, 'controlElement',true,false);

            uiBlock.append(ul);
            if(uiBlock.find('li').length === 0){
                uiBlock.empty();
            }
            uiBlock.show();
            uiBlock.find('select').chosen();
        }
        displayFuncs.controlElement = showControlProps;

        function showDataProps(){
            if (!showData) {
                return;
            }
            var properties = mugType.properties.dataElement,
                    uiBlock = $('#fd-props-data'),
                    ul;
            uiBlock.empty(); //clear it out first in case there's anything present.
            ul = makeUL('Data Properties');

            listDisplay(properties,ul,mugType.mug.properties.dataElement.properties, 'dataElement', true, false);
            uiBlock.append(ul);
            if(uiBlock.find('li').length === 0){
                uiBlock.empty();
            }
            setSpecialDataValueWidgetTypes();
            uiBlock.show();
            uiBlock.find('select').chosen();
        }
        displayFuncs.dataElement = showDataProps;

        function showBindProps(){
            if (!showBind) {
                return;
            }
            var properties = mugType.properties.bindElement,
                    uiBlock = $('#fd-props-bind'),
                    ul;
            uiBlock.empty(); //clear it out first in case there's anything present.
            ul = makeUL('Bind Properties');


            listDisplay(properties, ul, mugType.mug.properties.bindElement.properties, 'bindElement', true, false);
            uiBlock.append(ul);
            if(uiBlock.find('li').length === 0){
                uiBlock.empty();
            }
            uiBlock.show();
            uiBlock.find('select').chosen();
        }
        displayFuncs.bindElement = showBindProps;

        /**
         * Makes an Itext LI for UI user input of Itext values. Assumes the Itext ID is already present,
         * if not will generate one and add it to the Itext object.
         * @param textForm
         * @param iflabel
         * @param ishint - flag for if this is a 'hint' type itext (hint itext ID is located in a different place to regular itext ID)
         */
        function makeItextLI(textForm, iflabel, ishint) {
            var mugType, liStr, txtStr, inputStr, id, li, text, input, currentLang, Itext, iID, iIDInput,
                    isRequired;
            Itext = formdesigner.model.Itext;
            currentLang = formdesigner.currentItextDisplayLanguage;
            mugType = formdesigner.controller.getCurrentlySelectedMugType();
            if(!ishint){
                isRequired = true; //at present we can give everything an Itext ID so...
                iID = mugType.mug.properties.controlElement.properties.labelItextID;
            } else {
                isRequired = (mugType.properties.controlElement.hintItextID.presence === 'required') ||
                             (mugType.properties.controlElement.hintLabel === 'required');
                iID = mugType.mug.properties.controlElement.properties.hintItextID;
            }
            if(!iID && isRequired) {
                //make a new iID;
                iID = formdesigner.util.getNewItextID(mugType,ishint);
                //set the new Itext ID in it's respective UI element
                if(ishint) {
                    mugType.mug.properties.controlElement.properties.hintItextID = iID;
                    iIDInput = $('#controlElement-hintItextID-input');
                }else {
                    mugType.mug.properties.controlElement.properties.labelItextID = iID;
                    iIDInput = $('#controlElement-labelItextID-input');
                }
                iIDInput.val(iID).keyup(); //.keyup() to trigger existing behaviour, if any.
            }
            if (ishint){
                id = 'fd-itext-hint';
            } else {
                id = 'fd-itext-' + textForm.toLowerCase();
            }
            liStr = '<li id="' + id + '" class="fd-property"></li>';
            txtStr = '<span id="' + id +'-txt" class="fd-property-text">' + iflabel + '</span>';
            inputStr = '<div id="' + id + '-input-div" class="fd-prop-input-div chzn-container"><input id="' + id + '-input" class="fd-property-input"/>';
            li = $(liStr);
            text = $(txtStr);
            input = $(inputStr);

            input.find(':input').val(Itext.getValue(iID, currentLang, textForm));
            li.append(text);
            li.append(input);

            input.data('ufid', mugType.ufid);
            input.data('textform', textForm);
            input.children(':input').data('ufid', mugType.ufid).data('textform', textForm);
            input.find(':input').keyup ( function (e) {
                var oldVal, newVal, mugType, curIID;
                oldVal = Itext.getValue(iID,currentLang, textForm);
                newVal = $ (this).val();
                mugType = formdesigner.controller.form.controlTree.getMugTypeFromUFID($(this).data('ufid'));
                if(ishint){
                    curIID = mugType.mug.properties.controlElement.properties.hintItextID;
                } else {
                    curIID = mugType.mug.properties.controlElement.properties.labelItextID;
                }
                Itext.setValue(curIID, currentLang, textForm, newVal);
                formdesigner.util.changeUITreeNodeLabel($ (this).data('ufid'), formdesigner.util.getMugDisplayName(mugType))
                formdesigner.controller.form.fire({
                    type: 'form-property-changed',
                    propName: 'itext;'+textForm,
                    iID: curIID,
                    mugType: mugType,
                    oldVal: oldVal,
                    newVal: newVal
                })

            });

            return li;
        }

        function showItextProps(){
            if (!showControl) {
                return;
            }
            function makeItextUL() {
                var ulStr = '<ul id="fd-props-itext-ul" class="fd-props-ul">' +
                        '<span class="fd-props-heading">Display Properties</span>' +
                        '</ul>';
                return $(ulStr);
            }

            function langSelectorCallback (e) {
                formdesigner.currentItextDisplayLanguage = $('#fd-itext-lang-select').val();
                showItextProps(); //redraw the Itext section
            }

            function makeLangDropDown() {
                var div = $('#fd-itext-langs'), addLangButton, langList, langs, i, str, selectedLang, Itext;
                Itext = formdesigner.model.Itext;
                langs = Itext.getLanguages();

                str = '<select data-placeholder="Choose a Language" style="width:300px;" class="chzn-select" id="fd-itext-lang-select">' +
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
                })

                langList.val(formdesigner.currentItextDisplayLanguage);

                str = '';
                str = '<button id="fd-itext-add-lang-button">Add Language</button>';
                addLangButton = $(str);
                addLangButton.button();
                addLangButton.click (function () {
                    formdesigner.ui.showAddLanguageDialog();
                })
                div.append(addLangButton);

            }
            var langDrop = $('#fd-itext-langs').detach();
            if(langDrop.length === 0) {
                langDrop = $('<div id="fd-itext-langs"></div>');
            }
            $('#fd-props-itext').prepend(langDrop);
            langDrop.empty();
            $('#fd-itext-inputs').empty();


            makeLangDropDown();
            $('#fd-itext-lang-select').chosen();
            $('#fd-itext-lang-select').change (langSelectorCallback);
            
            var uiBlock = $('#fd-itext-inputs'),
                ul, LIs, i, langSettings, itextHeading;
            ul = makeItextUL();
            uiBlock.append(ul);
            LIs = {
                liDef : makeItextLI('default', 'Display Label'),
                liAudio : makeItextLI('audio', 'Audio URI'),
                liImage : makeItextLI('image', 'Image URI')
            }

            for (i in LIs) {
                if(LIs.hasOwnProperty(i)) {
                    ul.append(LIs[i]);
                }
            }

            //shuffle layout a bit.
            langSettings = $('#fd-itext-langs');
            itextHeading = $('#fd-props-itext-ul').children('span');
            langSettings.detach();
            itextHeading.after(langSettings);

        }
        displayFuncs.itext = showItextProps; //not sure if this will ever be used like this, but may as well stick with the pattern

        var IS_ADVANCED_ACC_EXPANDED = false;
        function showAdvanced(){
            var str = '<div id="fd-props-adv-accordion"><h3><a href="#">Advanced Properties</a></h3><div id="fd-adv-props-content">Some Content<br />asdasddas</div></div>',
                adv = $(str),
                contentEl,
                ul,properties;

            function displayBlock(blockName){
                if (!mugType.properties[blockName]) {
                    return;
                }

                var contentEl = $('#fd-adv-props-content'),
                    regBlockName = formdesigner.util.fromCamelToRegularCase(blockName),
                    ul = makeUL(regBlockName + ' Advanced Properties:'),
                    mugTypeProperties = mugType.properties[blockName],
                    mugProperties = mugType.mug.properties[blockName].properties;

                listDisplay(mugTypeProperties, ul, mugProperties, blockName, false, true);

                if(ul.children().length === 1){
                    $(ul).remove();
                } else {
                    contentEl.append(ul);
                }
            }

            $('#fd-props-advanced').append(adv);

            if(typeof formdesigner.IS_ADVANCED_ACC_EXPANDED === 'undefined') {
                formdesigner.IS_ADVANCED_ACC_EXPANDED = false;
            }

            adv.accordion({
//                fillSpace: true,
                autoHeight: false,
                collapsible: true,
                active: formdesigner.IS_ADVANCED_ACC_EXPANDED
            });
            if(formdesigner.IS_ADVANCED_ACC_EXPANDED) {
                $('#fd-props-adv-accordion').accordion('activate',0);
            }

            $('#fd-props-adv-accordion h3').click(function () {
                formdesigner.IS_ADVANCED_ACC_EXPANDED = !formdesigner.IS_ADVANCED_ACC_EXPANDED;
            });

            var contentEl = $('#fd-adv-props-content');

            contentEl.empty();
            if (showControl) {
                //Itext input widgets
                var itextul = makeUL('');
                itextul.append(makeItextLI('short', 'Short Display Label'))
                        .append(makeItextLI('long', 'Long Display Label'));
                if(mugType.properties.controlElement.hintItextID && mugType.properties.controlElement.hintItextID.presence !== "notallowed") {
                    itextul.append(makeItextLI('default', 'Hint Display Label', true));
                }
                contentEl.append('<br /><br />').append(itextul);
            }
            
            if (showData) {
                displayBlock('dataElement');
            }
            if (showBind) {
                displayBlock('bindElement');
            }
            if (showControl) {
                displayBlock('controlElement');
            }

            contentEl.find('select').chosen();

        }

        function attachCommonEventListeners () {
            /**
             * Sets things up such that if you alter one NodeID box (e.g. bind)
             * the other NodeID (e.g. data) gets changed and the model gets updated too.
             */
            function syncNodeIDInputs(){
                //this spaghetti is terrible :(

                function otherInputUpdate (otherIn) {
                    var otherInput = $(otherIn),
                                groupName = otherInput.data('groupName'),
                                propName = otherInput.data('propName'),
                                curMug = formdesigner.controller.getCurrentlySelectedMug(),
                                curMugType = formdesigner.controller.getCurrentlySelectedMugType();

                    //Short circuit the process of syncing the two IDs
                    //when the text box is blank (i.e. a user backspaced away all chars).
                    //This prevents us from getting into a hairy situation
                    //with ItextIDs being blank/getting unsynchronized with
                    //the data stored in Itext.
                    if (otherInput.val() === "") {
                        return;
                    }

                    formdesigner.controller.setMugPropertyValue(curMug,groupName,propName,otherInput.val(), curMugType);
                    //update ItextID stuff
                    if($('#controlElement-labelItextID-input').length > 0) { //does it have itextID?
                        $('#controlElement-labelItextID-input').val(otherInput.val()).keyup(); //trigger keyup to have this change be taken care of in the regular way.
                    }
                }

                var nodeIDBoxes = $('input[id*="nodeID"]'); //gets all input boxes with ID attribute containing 'nodeID'
                if(nodeIDBoxes.length === 2){
                    $(nodeIDBoxes[0]).keyup(function(e) {
                        $(nodeIDBoxes[1]).val($(e.currentTarget).val());
                        otherInputUpdate(nodeIDBoxes[1]);

                    });
                    $(nodeIDBoxes[1]).keyup(function (e) {
                        $(nodeIDBoxes[0]).val($(e.currentTarget).val());
                        otherInputUpdate(nodeIDBoxes[0]);
                    });
                }
            }

            /**
             * When either bindElement.nodeID or dataElement.nodeID changes value,
             * the node label in the jstree (UITree) should be updated to reflect that change
             */
            function updateUITreeNodeLabel(){
                var mug = mugType.mug,
                        util = formdesigner.util;

                mug.on('property-changed',function(e){
                    if(e.property === 'nodeID' && !formdesigner.util.getDefaultDisplayItext(mug)){
                        var node = $('#' + e.mugTypeUfid);
                        $('#fd-question-tree').jstree('rename_node',node,this.properties[e.element].properties[e.property]);
                    }
                });

            }

            function updateSaveState () {
                var mug = mugType.mug;
                mug.on('property-changed', function (e) {
                    formdesigner.controller.setFormChanged();
                });
            }

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
            }

            syncNodeIDInputs();
            updateUITreeNodeLabel();
            updateSaveState();
            updateDataViewLabels();

        }

        //Throws a little label at the top of the question properties block to indicate what kind of question
        //vellum thinks this is
        function showQuestionType () {
            var uiBlock = $('#fd-props-mugtype-info'),
                ul, typeString = mugType.typeName;

            uiBlock.empty();
            ul = makeUL(typeString);

            uiBlock.append(ul);
            uiBlock.show();
        }
        
        function updateDisplay(){
            var mugTProps = mugType.properties,
            i = 0;
            $('#fd-question-properties').animate({
                        height:'900px'
                    },200);

            that.hideQuestionProperties();
            
            $('#fd-props-bind').empty();
            $('#fd-props-data').empty();
            $('#fd-props-control').empty();
            $('#fd-props-advanced').empty();
            $('#fd-itext-inputs').empty();

            showQuestionType();
            for(i in mugTProps){
                if(mugTProps.hasOwnProperty(i)){
                    displayFuncs[i]();
                }
            };
            displayFuncs.itext();
            showAdvanced();
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
        
        formdesigner.controller.setCurrentlySelectedMugType(curSelUfid);
        if($(e.currentTarget).attr('id') === 'fd-question-tree') {
//            $('#fd-data-tree').jstree('select_node');
            that.displayMugProperties(formdesigner.controller.getCurrentlySelectedMugType());
        } else if ($(e.currentTarget).attr('id') === 'fd-data-tree') {
//            $('#fd-question-tree').jstree('deselect_all');
            that.displayMugDataProperties(formdesigner.controller.getCurrentlySelectedMugType());
        }
    }
    
    function selectMugTypeInUI(mugType) {
        var ufid = mugType.ufid;
        return $('#fd-question-tree').jstree('select_node', $('#'+ufid), true);
    }
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
    }
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

        }).bind("deselect_all.jstree", function (e, data) {
            formdesigner.controller.setCurrentlySelectedMugType(null);
            formdesigner.controller.curSelUfid = null;
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
            var div, addLangButton, langList, langs, i, str, selectedLang, Itext;
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
             var fancyBut = $(
                     '<button id="fd-fancy-button" class="toolbarButton questionButton">'+
                 'View Source ' +
               '</button>');
             $('#fd-extra-advanced').append(fancyBut);

             fancyBut.button().click(function () {
                 controller.generateXForm();
             });

         })();

         (function c_openSource() {
             var openSourcebut = $(
                     '<button id="fd-opensource-button" class="toolbarButton questionButton">'+
                 'Load Source ' +
               '</button>');
             $('#fd-extra-advanced').append(openSourcebut);

             openSourcebut.button().click(function () {
                 formdesigner.controller.showLoadXformBox();
             });

         })();

        (function c_showDataView() {
             var showDataViewBut = $(
                     '<button id="fd-dataview-button" class="toolbarButton questionButton">'+
                 'Show Data View ' +
               '</button>');
             $('#fd-extra-advanced').append(showDataViewBut);

             showDataViewBut.button().click(function () {
                 formdesigner.ui.showDataView();
             });

            showDataViewBut.button('disable');

         })();

        (function c_clearCruftyItext() {
            var clearCruftBut = $(
                     '<button id="fd-dataview-button" class="toolbarButton questionButton">'+
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
        }

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

    }

    /**
     * Goes through the internal data/controlTrees and determines which mugs are not valid.
     *
     * Then adds an icon in the UI tree next to each node that corresponds to an invalid Mug.
     *
     * Will clear icons for nodes that are valid (if they were invalid before)
     */
    var setTreeValidationIcons = function () {
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
        }

        function appendIcon (id, msg) {
            $($('#' + i)[0]).append('<div class="ui-icon ui-icon-alert fd-tree-valid-alert-icon" title="'+msg+'"></div>')
        }



        clearIcons(uiCTree); //clear existing warning icons to start fresh.
        clearIcons(uiDTree); //same for data tree
        invalidMTs = form.getInvalidMugTypeUFIDs();
        for (i in invalidMTs){
            if(invalidMTs.hasOwnProperty(i)){
                invalidMsg = invalidMTs[i].message.replace(/"/g,"'");
                //ui tree
                liID = i;
                appendIcon (liID, invalidMsg);

                //data tree
                liID = i + "_data";
                appendIcon (liID, invalidMsg);
            }
        }

    };
    that.setTreeValidationIcons = setTreeValidationIcons;

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

    function init_modal_dialogs () {
        $( "#fd-dialog-confirm" ).dialog({
			resizable: false,
//			height:140,
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
            setTreeValidationIcons();
        });

        //set prompt when navigating away from the FD
        $(window).bind('beforeunload', function () {
            if(!formdesigner.controller.isFormSaved()){
                return 'Are you sure you want to exit? All unsaved changes will be lost!';
            }
        })
    };

    var set_event_listeners = function () {

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
        var questionList = formdesigner.controller.getListMugTypesNotItems();
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
	                var questionAcceptor = $("<input />").attr("placeholder", "Hint: drag a question here.");
	                questionAcceptor.css("min-width", "200px")
	                return questionAcceptor;
	            };
	            var createOperationSelector = function() {
	                var ops = [["is equal to", expTypes.EQ],
	                           ["is not equal to", expTypes.NEQ],
	                           ["is less than", expTypes.LT],
	                           ["is less than or equal to", expTypes.LTE],
	                           ["is greater than", expTypes.GT],
	                           ["is greater than or equal to", expTypes.GTE]];
	                     
	                return constructSelect(ops).addClass("op-select").css("vertical-align", "text-bottom");
	            };
	            
	            var expression = $("<div />").addClass("bin-expression");
                
                var createQuestionInGroup = function (type) {
                     var group = $("<div />").addClass("expression-part").appendTo(expression).css("display", "inline");
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
                
                
	            var updateSelectOptions = function (inputControl, selectQuestion, value) {
	                // this only works on the right box
	                
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
	                       tokenLimit: 1, 
	                       searchDelay: 0, 
	                       allowFreetext: false,
	                       hintText: "Type in a select option name.",
	                       noResultsText: "No matching options found.",
	                       onAdd: validateExpression,
	                       onDelete: validateExpression
	                };
	                inputControl.tokenInput(autoCompleteChildren, selectItemOptions);
	                var found = false;
                    if (value && value instanceof xpathmodels.XPathStringLiteral) {
	                    for (var i = 0; i < children.length; i++) {
	                       if (children[i].mug.properties.controlElement.properties.defaultValue == value.value) {
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
	            
	            var populateTokenInputBox = function (input, expr, pairedExpr) {
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
	                       updateSelectOptions(input, mug, expr);
	                       return;
	                   }
	                }
	                // default case
	                input.tokenInput("add", {id: expr.toXPath(), name: expr.toXPath()});
	            };
	            
                
                // set fancy input mode on the boxes
	            var baseOptions = {theme: "facebook", 
	                               tokenLimit: 1, 
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
                            updateSelectOptions(right, mug);
                        }
                    }    
                }
                
                var left = createQuestionInGroup("left")
                left.tokenInput(questionChoiceAutoComplete, leftOptions);
	            
	            var op = createOperationSelector().appendTo(expression);
                var right = createQuestionInGroup("right")
                $("<div />").text("Delete").button().css("float", "left").appendTo(expression).click(function() {
                    var isFirst = expression.children(".join-select").length == 0;
                    expression.remove();
                    if (isFirst && getExpressionList().length > 0) {
                        // when removing the first expression, make sure to update the 
                        // next one in the UI to not have a join, if necessary.
                        $($(getExpressionList()[0]).children(".join-select")).remove();   
                    }
                });
                $("<div />").addClass("validation-results").appendTo(expression);
                
                right.tokenInput(questionChoiceAutoComplete, rightOptions);
                // also make them drop targets for the tree
	            expression.find(".token-input-list-facebook").addClass("jstree-drop");
                if (expOp) {
	                // populate
                    if (DEBUG_MODE) {
                        console.log("populating", expOp.toString());
                    }
                    populateTokenInputBox(getLeftQuestionInput(), expOp.left);
                    op.val(xpathmodels.expressionTypeEnumToXPathLiteral(expOp.type));
	                // the population of the left can affect the right, 
	                // so we need to update the reference 
	                populateTokenInputBox(getRightQuestionInput(), expOp.right, expOp.left);
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
            var doneButton = $('<button />').text("Done").button().appendTo(mainPane);
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
	        var validateButton = $('<button />').text("Validate").button().appendTo(mainPane);
            var validationSummary = $("<div />").attr("id", "fd-xpath-validation-summary").appendTo(mainPane);
	        validateButton.click(function() {
                var results = validateCurrent();
                if (results[0]) {
                    if (results[1]) {
                        validationSummary.text("Validation Succeeded! " + results[1].toString());
                    } else {
                        validationSummary.text("Nothing to validate.");
                    }
                    validationSummary.removeClass("error").addClass("success");
                } else {
                    validationSummary.text("Validation Failed! " + results[1]).removeClass("success").addClass("error");
                }
	        });
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

    formdesigner.saveUrl = opts["saveUrl"];
    formdesigner.loadMe = opts["form"];
    
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
