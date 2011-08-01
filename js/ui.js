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
//var log = console.log, exports = {};

formdesigner.ui = (function () {
    "use strict";
    var that = {}, question_list = [],
    buttons = {},
    controller = formdesigner.controller,
    questionTree;

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

    function do_loading_bar() {
        var pbar = $("#progressbar"),
        content = $("#content"),
        loadingBar = $("#loadingBar"),
                doneController = false,
                doneUtil = false,
                doneModel = false,
                doneTree = true,
                allDone = false,
                tryComplete = function () {
                    allDone = doneUtil && doneController && doneModel;
                    if (allDone) {
                        loadingBar.delay(500).fadeOut(500);
                    }
                };

        content.show();
        loadingBar.css("background-color", "white");
        loadingBar.fadeIn(100);

        pbar.progressbar({ value: 0 });

//        $("#loadingInfo").html("downloading jstree.js");
//        $.getScript("js/jquery.jstree.js", function () {
//            pbar.progressbar({ value: (pbar.progressbar( "option", "value" )+25)});
//            doneTree = true;
//            tryComplete();
//        });
//
//        $("#loadingInfo").html("downloading util.js");
//        $.getScript("js/util.js", function () {
//            pbar.progressbar({ value: (pbar.progressbar( "option", "value" )+25)});
//            doneUtil = true;
//            tryComplete();
//        });
//
//        $("#loadingInfo").html("downloading model.js");
//        $.getScript("js/model.js", function () {
//            pbar.progressbar({ value: (pbar.progressbar( "option", "value" )+25)});
//            doneModel = true;
//            tryComplete();
//        });
//
//        $("#loadingInfo").html("downloading controller.js");
//        $.getScript("js/controller.js", function () {
//            pbar.progressbar({ value: (pbar.progressbar( "option", "value" )+25)});
//            doneController = true;
//            tryComplete();
//        });
//
//        window.setTimeout(function () {
//            if (!allDone) {
//                    allDone = doneUtil && doneController && doneModel && doneTree;
//                    if (allDone) {
//                        loadingBar.delay(500).fadeOut(500);
//                    }else{
//                        var alertString = '';
//                        if (!doneUtil) { alertString += '[Util.js]'; }
//                        if (!doneController) { alertString += '[Controller.js]';}
//                        if (!doneModel) { alertString += '[Model.js]';}
//                        if (!doneTree) { alertString += '[jsTree]'; }
//
//                        alert("Problem loading FormDesigner Libraries! Libraries not loaded: "+alertString);
//                    }
//            }
//                }, 5000);

        loadingBar.fadeOut(200);

    }

    function init_toolbar() {
        var toolbar = $(".fd-toolbar");
        var buts =  $(".questionButton");

        //make each element a button
        buts.button();

        //bind a function to the click event for each button
        buts.each(function (index) {
           var qType = $(this).attr("id").split('-')[2],
                   name = $(this).attr("id").replace('fd-','').replace('-','').replace('-','');
           $(this).click(function (){
              formdesigner.controller.createQuestion(qType);
           });
           buttons[name] = $(this);
        });

        //debug tools
        (function c_printDataTreeToConsole() {
            var printTreeBut = $(
                    '<div id="fd-print-tree-button" class="toolbarButton questionButton">'+
                'Print tree to Console' +
              '</div>');
            $('#fd-dragons').append(printTreeBut);

            printTreeBut.button().click(function () {
                var vObj = [], vOut = [], i, invalidMT = [], mt;
                console.group("Tree Pretty Print");
                console.log("Control Tree:"+controller.form.controlTree.printTree())
                console.log("Data Tree:   "+controller.form.dataTree.printTree());
                console.log("TREE VALIDATION RESULT",controller.form.controlTree.isTreeValid());
                invalidMT = controller.form.getInvalidMugTypes();

                console.log("TREE MAP INVALID UFIDS", controller.form.getInvalidMugTypeUFIDs());
                for (i in invalidMT){
                    if(invalidMT.hasOwnProperty(i)){
                        mt = invalidMT[i];
                        vOut.push(mt);
                        vOut.push(mt.validateMug());
                    }
                }
                console.log("INVALID MTs,VALIDATION OBJ",vOut);
                console.groupEnd();

            });

            buttons.printTree = printTreeBut;
        })();

       (function c_fancyBox() {
            var fancyBut = $(
                    '<div id="fd-fancy-button" class="toolbarButton questionButton">'+
                '<span id="fd-fancy-but"></span>View Source ' +
              '</div>');
            toolbar.append(fancyBut);

            fancyBut.button().click(function () {
                controller.generateXForm();
            });

            buttons.fancyBut = fancyBut;
        })();

        (function c_openSource() {
            var openSourcebut = $(
                    '<div id="fd-opensource-button" class="toolbarButton questionButton">'+
                '<span id="fd-opensource-but"></span>Load Source ' +
              '</div>');
            toolbar.append(openSourcebut);

            openSourcebut.button().click(function () {
                formdesigner.controller.showLoadXformBox();
            });

            buttons.openSourcebut = openSourcebut;
        })();

        $('.questionButton').button({
            icons:{
                primary: 'ui-icon-gear'
            }
        })



    }
    that.buttons = buttons;

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
				"default" : {
					"valid_children" : groupRepeatValidChildren
				}
			}
		};
        return types;

    }

    var showVisualValidation = function showVisualValidation (mugType){
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
                            propsMessage += '<br>' + msg + '</br>';
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

        var vObj = mugType.validateMug(),
                bProps = vObj.bindElement,
                cProps = vObj.controlElement,
                dProps = vObj.dataElement,
                i, propsMessage;

        hideMessage();
        propsMessage = '';
        loopValProps(bProps, 'bindElement');
        loopValProps(cProps, 'controlElement');
        loopValProps(dProps, 'dataElement');
        console.log("PROPS MESSAGE", propsMessage);
        if(propsMessage) {
            showMessage(propsMessage, 'Question Problems', 'warning');
        }

    }
    that.showVisualValidation = showVisualValidation;

    var displayMugProperties = that.displayMugProperties = that.displayQuestion = function(mugType){
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
         * @param propertiesBlock - The properties block from the MugType (e.g. mugType.properties.controlElement
         * @param parentUL - The UL DOM node that an LI should be appended to.
         * @param mugProps - actual mug properties corresponding to the propertiesBlock above
         * @param groupName - Name of the current properties block (e.g. 'controlElement'
         * @param showVisible - Show properties with the visibility flag set to 'visible'
         * @param showHidden - Show properties with the visibility flag set to 'hidden'
         */
        function listDisplay(propertiesBlock,parentUL, mugProps, groupName, showVisible, showHidden){
            function getWidget (propBlockIndex) {
                var liStr,li,
                p = propertiesBlock[propBlockIndex],
                        itemID,html, labelStr, i;

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
                }

                liStr = '<li id="' + groupName + '-' + propBlockIndex + '" class="fd-property">' +
                            html +
                            '</li>'
                li = $(liStr);

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

                        if(!pBlock.uiType || pBlock.uiType === 'input'){
                            input.keyup(function(e){
                                var input = $(e.currentTarget),
                                        groupName = input.data('groupName'),
                                        propName = input.data('propName'),
                                        curMug = formdesigner.controller.getCurrentlySelectedMug(),
                                        curMT = formdesigner.controller.getCurrentlySelectedMugType();
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

        function showItextProps(){
            function makeLI(textForm) {
                var mugType, liStr, txtStr, inputStr, id, li, text, input, currentLang, Itext, iID;
                Itext = formdesigner.model.Itext;
                currentLang = formdesigner.currentItextDisplayLanguage;
                mugType = formdesigner.controller.getCurrentlySelectedMugType();
                iID = mugType.mug.properties.controlElement.properties.labelItextID;
                if(!iID) {
                    iID = mugType.mug.properties.controlElement.properties.labelItextID = formdesigner.util.getNewItextID(mugType);
                }

                id = 'fd-itext-' + textForm.toLowerCase();
                liStr = '<li id="' + id + '" class="fd-property"></li>';
                txtStr = '<span id="' + id +'-txt" class="fd-property-text">' + formdesigner.util.fromCamelToRegularCase(textForm) + '</span>';
                inputStr = '<div id="' + id + '-input-div" class="fd-prop-input-div chzn-container"><input id="' + id + '-input" class="fd-property-input"/>';
                li = $(liStr);
                text = $(txtStr);
                input = $(inputStr);

                input.find(':input').val(Itext.getValue(iID, currentLang, textForm));
                li.append(text);
                li.append(input);

                input.data('ufid', mugType.ufid);
                input.data('textform', textForm);
                input.children(':input').data('ufid', mugType.ufid).data('textform', textForm);;
                input.find(':input').keyup ( function (e) {
                    var mugType = formdesigner.controller.form.controlTree.getMugTypeFromUFID($(this).data('ufid'));
                    Itext.setValue(iID, currentLang, textForm, $(this).val());
                    formdesigner.util.changeUITreeNodeLabel($ (this).data('ufid'), formdesigner.util.getMugDisplayName(mugType))
                });

                return li;
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
                    liDef : makeLI('default'),
                    liLong : makeLI('long'),
                    liShort : makeLI('short'),
                    liAudio : makeLI('audio'),
                    liImage : makeLI('image')
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
                contentEl.append(ul);
                if(ul.children().length === 0){
                    $(ul).remove();
                }
            }

            $('#fd-props-advanced').append(adv);
            adv.accordion({
//                fillSpace: true,
                autoHeight: false,
                collapsible: true,
                active: IS_ADVANCED_ACC_EXPANDED
            });

            $('#fd-props-advanced').bind( "accordionchangestart", function(event, ui) {
                var newSize = '900px';
                if (ui.newContent.length === 0) {
                    IS_ADVANCED_ACC_EXPANDED = false;
                    newSize = '900px';
                }else {
                    IS_ADVANCED_ACC_EXPANDED = true;
                    newSize = '900px';
                }
                $('#fd-question-properties').animate({
                        height:newSize
                },200);
            });

//            adv.find('h3').click(function () {
//                var props = $('#fd-question-properties');
//                if(props.css('height') === '500px'){
//                    $('#fd-question-properties').animate({
//                        height:'900px'
//                    },200);
//                }else{
//                    $('#fd-question-properties').animate({
//                        height:'500px'
//                    },200);
//                }
//            })

            adv.accordion("activate",false);

            var contentEl = $('#fd-adv-props-content');

            contentEl.empty();
            displayBlock('dataElement');
            displayBlock('bindElement');
            displayBlock('controlElement');

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
                            formdesigner.controller.setMugPropertyValue(curMug,groupName,propName,otherInput.val(), curMugType);
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
                var mug = mugType.mug;
                mug.on('property-changed',function(e){
                    if(e.property === 'nodeID'){
                        var node = $('#' + e.mugTypeUfid);
                        $('#fd-question-tree').jstree('rename_node',node,this.properties[e.element].properties[e.property]);
                    }
                });

            }

            syncNodeIDInputs();
            updateUITreeNodeLabel();


        }

        function updateDisplay(){
            var mugTProps = mugType.properties,
            i = 0;
            $('#fd-question-properties').animate({
                        height:'900px'
                    },200);

            $("#fd-question-properties").hide();

            $('#fd-props-bind').empty();
            $('#fd-props-data').empty();
            $('#fd-props-control').empty();
            $('#fd-props-advanced').empty();
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
        that.displayMugProperties(formdesigner.controller.getCurrentlySelectedMugType());
    }

    function selectMugTypeInUI(mugType) {
        var ufid = mugType.ufid;
        return getJSTree().jstree('select_node', $('#'+ufid));
    }
    that.selectMugTypeInUI = selectMugTypeInUI;

    /**
     * Returns the current UI tree instance as a Jquery Selector object
     */
    function getJSTree () {
        return $('#fd-question-tree');
    }
    that.getJSTree = getJSTree;

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
                "drop_target" : false,
                "drag_target" : false
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
//                    console.log('MOVE_NODE.JSTREE EVENT',mugType,position,refMugType);
            controller.moveMugType(mugType, position, refMugType);
        });
        questionTree = $("#fd-question-tree");
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
        var accContainer = $("#fd-extra-tools"),
            accordion = $("#fd-extra-tools-accordion"),
            minMax = $('#fd-acc-min-max'),
            minMaxButton = $('#fd-min-max-button'),
            questionProps = $('#fd-question-properties'),
            fdTree = $('.fd-tree'),
            fdContainer = $('#fd-ui-container'),


            TREE_MIN_WIDTH = 250,
            TREE_MAX_WIDTH = 380,
            PROPS_MIN_WIDTH = 470,
            PROPS_MAX_WIDTH = 720,
            EXTRAS_MIN_WIDTH = 20,
            EXTRAS_MAX_WIDTH = 235,
            STATE_EXTRAS_MAXIMIZE = true; //should you be maximizing or minimizing windows right now?

        function resizeTree () {
            //Ideally we want the tree to take up about 25% of the global width

            var cur, global, desired, limit, extras;

            extras = STATE_EXTRAS_MAXIMIZE ? EXTRAS_MAX_WIDTH : EXTRAS_MIN_WIDTH;
            cur = fdTree.width();
            global = fdContainer.width() - extras;
            desired = global * 0.25;

            if (desired > TREE_MAX_WIDTH) {
                desired = TREE_MAX_WIDTH;
            }else if (desired < TREE_MIN_WIDTH){
                desired = TREE_MIN_WIDTH;
            }

            fdTree.animate({
                    width: desired + 'px'
            },200);

        }

        function resizeProps () {
            //Ideally we want the properties view to take up about 75% of the global width

            var cur, global, desired, limit, extras;

            extras = STATE_EXTRAS_MAXIMIZE ? EXTRAS_MAX_WIDTH : EXTRAS_MIN_WIDTH;
            cur = questionProps.width();
            global = fdContainer.width() - extras - fdTree.width() - 40;
            desired = global;
            if (desired > PROPS_MAX_WIDTH) {
                desired = PROPS_MAX_WIDTH;
            }else if (desired < PROPS_MIN_WIDTH){
                desired = PROPS_MIN_WIDTH;
            }

            questionProps.animate({
                    width: desired + 'px'
            },200);

        }

        function resizeExtras () {
            if (STATE_EXTRAS_MAXIMIZE) {

                accContainer.animate({
                    width: EXTRAS_MAX_WIDTH + 'px'
                },200);
                accordion.show(300);
            } else {

                accContainer.animate({
                    width: EXTRAS_MIN_WIDTH + 'px'
                },200);
                accordion.hide(200);
            }
        }



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
        })
//        min_max.button();
        minMax.click(function(){
            if (STATE_EXTRAS_MAXIMIZE) {
                STATE_EXTRAS_MAXIMIZE = false;
            }else {
                STATE_EXTRAS_MAXIMIZE = true;
            }
            resizeTree();
            resizeProps();
            resizeExtras();
        });

        $(window).resize(function () {
            resizeTree();
            resizeProps();
            resizeExtras();
        });

        $('#fd-add-data-node-button').button({
            icons : {
                primary : 'ui-icon-gear'
            },
            text : false
        }).button("disable");

        $('#fd-extra-template-questions div').each(function(){
            $(this).button({
                            icons : {
                                primary : 'ui-icon-gear'
                            }
                        });
        }).button("disable");

        function makeFormProp (propLabel, propName, keyUpFunc, initVal){
            var liStr = '<li id=fd-form-prop-"' + propName + '" class="fd-form-property"><span class="fd-form-property-text">'+propLabel+': '+'</span>' +
                '<input id=fd-form-prop-' + propName + '-' + 'input" class="fd-form-property-input">'+
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
                oldVal: formdesigner.controller.form.formName,
                newVal: $( this ).val()
            })
        }

        var formNameFunc = function (e) {
            fireFormPropChanged('formName',formdesigner.controller.form.formName, $( this ).val());
            formdesigner.controller.form.formName = $(this).val();
        }
        makeFormProp("Form Name","formName", formNameFunc, formdesigner.controller.form.formName);

        var formIDFunc = function (e) {
            fireFormPropChanged('formID',formdesigner.controller.form.formName, $( this ).val());
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
                invalidMTs, i, invalidMsg;
        uiCTree = $('#fd-question-tree');
        uiDTree = $('#fd-data-tree');
        form = controller.form;
        cTree = form.controlTree;
        dTree = form.dataTree;

        function clearIcons() {
            var nodes;
            nodes = uiCTree.find('.jstree-leaf, .jstree-open');
            nodes.each(function (idx, el){
                $(el).find('.fd-tree-valid-alert-icon').remove();
            })
        }



        clearIcons() //clear existing warning icons to start fresh.
        invalidMTs = form.getInvalidMugTypeUFIDs();
        for (i in invalidMTs){
            if(invalidMTs.hasOwnProperty(i)){
                invalidMsg = invalidMTs[i].message;
                $($('#' + i + ' a')[0]).append('<span class="ui-icon ui-icon-alert fd-tree-valid-alert-icon" title="'+invalidMsg+'></span>')
            }
        }
    };
    that.setTreeValidationIcons = setTreeValidationIcons;

    var create_data_tree = function(){
        var tree = $("#fd-data-tree-container");
        $("#fd-data-tree-head").click(function () {
                var container = $("#fd-data-tree-container"),
                    curLeft = container.css('left');
                if(curLeft === '-260px'){
                    container.stop().animate({
                            'left': '0px'
                        }, 200);
                }else if(curLeft === '0px'){
                    container.stop().animate({
                            'left': '-260px'
                        }, 200);
                }
            }
        );

        //DATA TREE
        tree = $("#fd-data-tree");
        tree.jstree({
            "json_data" : {
                "data" : []
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
//            "dnd" : {
//                "drop_target" : false,
//                "drag_target" : false
//            },
            "types": getJSTreeTypes(),
            "plugins" : [ "themes", "json_data", "ui", "types", "crrm" ]
	    }).bind("select_node.jstree", function (e, data) {
//                    node_select(e, data);
        }).bind("move_node.jstree", function (e, data) {
//                    var controller = formdesigner.controller,
//                                mugType = controller.form.controlTree.getMugTypeFromUFID($(data.rslt.o).attr('id')),
//                                refMugType = controller.form.controlTree.getMugTypeFromUFID($(data.rslt.r).attr('id')),
//                                position = data.rslt.p;
//                    controller.moveMugType(mugType, position, refMugType);
        });


    };

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
        console.log("resetUI() called");
        /**
         * Clear out all nodes from the given UI jsTree.
         * @param tree - Jquery selector pointing to jstree instance
         */
        function clearUITree(tree){
            tree.jstree('deselect_all');
            tree.find('ul').empty();
        };

        clearUITree($('#fd-question-tree'));

        console.log("resetUI() finished");

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
            console.log("New language beforeClose!");
            if($('#fd-new-lang-input').val()) {
                console.log('adding a new language to Itext!');
                formdesigner.model.Itext.addLanguage($('#fd-new-lang-input').val())
            } else {
                console.log("no new language added!");
            }
            
        }

        var div = $( "#fd-dialog-confirm" ),input,
                contStr;
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
                displayMugProperties(
                        formdesigner.controller.getCurrentlySelectedMugType()
                );
            }
        })

    }

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
        if(!msg) {
            msg = 'Saving form to server...';
        }
        dial.empty();
        dial.dialog("destroy");
        dial.dialog({
            modal: true,
            autoOpen: false,
            buttons : {},
            closeOnEscape: false,
            open: function(event, ui) { $(".ui-dialog-titlebar-close").hide(); }
        });
        contentStr = '<p>' +
            '<span class="fd-message">' + msg+ '</span><div id="fd-form-saving-anim"></div></p>'
        dial.append(contentStr);
        $('#fd-form-saving-anim').append('<img src="'+formdesigner.staticPrefix+'images/ajax-loader.gif" id="fd-form-saving-img"/>')

        showConfirmDialog();
    }

    var init_misc = function () {
        controller.on('question-creation', function (e) {
            setTreeValidationIcons();
        });
    };

    that.init = function(){
        controller = formdesigner.controller;
        generate_scaffolding($(formdesigner.rootElement));
        do_loading_bar();
        init_toolbar();
        init_extra_tools();
        create_question_tree();
//        create_data_tree();
        init_form_paste();
        init_modal_dialogs();

        init_misc();

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
 *  [langs] : ["en", "por", ... ]
 *  }
 */
formdesigner.launch = function (opts) {
    formdesigner.util.eventuality(formdesigner);
    formdesigner.on('load-form-complete', function () {
        console.log("LOAD FORM COMPLETE EVENT RECEIVED");
    })

    formdesigner.on('load-form-start', function (e) {
       console.log("LOAD_FORM_START EVENT");
    });

    formdesigner.on('load-form-error', function (e) {
           console.log("LOAD_FORM_ERROR EVENT");
        });



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
