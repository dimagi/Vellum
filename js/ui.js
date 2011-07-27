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
var log = console.log, exports = {};

formdesigner.ui = (function () {
    "use strict";
    var that = {}, question_list = [],
    buttons = {},
    controller = formdesigner.controller,
    questionTree;

    var appendErrorMessage = that.appendErrorMessage = function (msg) {
        $('#fd-notify').addClass("notice");
        $('#fd-notify').text($('#fd-notify').text() + msg);
    };

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
                console.group("Tree Pretty Print");
                console.log("Control Tree:"+controller.form.controlTree.printTree())
                console.log("Data Tree:   "+controller.form.dataTree.printTree());
                console.groupEnd();
                console.log("TREE VALIDATION RESULT",controller.form.controlTree.isTreeValid());
                console.log("INVALID MTs", controller.form.getInvalidMugTypes());
                console.log("TREE MAP INVALID UFIDS", controller.form.getInvalidMugTypeUFIDs())
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
                '<span id="fd-opensource-but"></span>Open Source ' +
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
        types =  {
            "max_children" : -1,
			"valid_children" : groupRepeatValidChildren,
			"types" : {
                "group" : {
                    "icon": {
                        "image" : "css/smoothness/images/ui-icons_888888_256x240.png",
                        "position": "-16px -96px"
                    },
                    "valid_children" : groupRepeatValidChildren
                },
                "repeat" : {
                    "icon": {
                        "image" : "css/smoothness/images/ui-icons_888888_256x240.png",
                        "position": "-64px -80px"
                    },
                    "valid_children" : groupRepeatValidChildren
                },
                "question" : {
                    "icon": {
                        "image" : "css/smoothness/images/ui-icons_888888_256x240.png",
                        "position": "-128px -96px"
                    },
                    "valid_children" : "none"
                },
                "selectQuestion" : {
                    "icon": {
                        "image" : "css/smoothness/images/ui-icons_888888_256x240.png",
                        "position": "-96px -176px"
                    },
                    "valid_children": ["item"]
                },
                "item" : {
                    "icon": {
                        "image" : "css/smoothness/images/ui-icons_888888_256x240.png",
                        "position": "-48px -128px"
                    },
                    "valid_children" : "none"
                },
                "trigger" : {
                    "icon": {
                        "image" : "css/smoothness/images/ui-icons_888888_256x240.png",
                        "position": "-16px -144px"
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

    var showVisualValidation = that.showVisualValidation = function showVisualValidation (mugType){
        function setValidationFailedIcon(li,showIcon, message){
            var exists = ($(li).find('.fd-props-validate').length > 0);
            if(exists && showIcon){
                return;
            }else if (exists && !showIcon){
                $(li).find('.fd-props-validate').removeClass('ui-icon');
            }else if(!exists && showIcon){
                var icon = $('<span class="fd-props-validate ui-icon ui-icon-alert"></span>');
                console.log("MESSAGE HERE!",message)
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
                i;


        loopValProps(bProps, 'bindElement');
        loopValProps(cProps, 'controlElement');
        loopValProps(dProps, 'dataElement');

    }

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
            var i, li;
            for(i in propertiesBlock){
                if(propertiesBlock.hasOwnProperty(i)){
                    var show = (showVisible && propertiesBlock[i].visibility === 'visible') || (showHidden && propertiesBlock[i].visibility === 'hidden');
                    if(show){
                        var pBlock = propertiesBlock[i],
                                labelStr = pBlock.lstring ? pBlock.lstring : i,
                                liStr = '<li id="' + groupName + '-' + i + '" class="fd-property"><span class="fd-property-text">'+labelStr+': '+'</span>' +
                                        '<input id="' + groupName + '-' + i + '-' + 'input" class="fd-property-input">'+
                                        '</li>',
                                input;

                        li = $(liStr);
                        input = $(li).find('input');

                        //set some useful data properties
                        input.data('propName',i);
                        input.data('groupName', groupName);


                        //set initial value for each input box (if any)
                        input.val(mugProps[i]);  //<--- POTENTIAL PAIN POINT! Could be something that's not a string!

                        //set event handler
                        input.keyup(function(e){
                            var input = $(e.currentTarget),
                                    groupName = input.data('groupName'),
                                    propName = input.data('propName'),
                                    curMug = formdesigner.controller.getCurrentlySelectedMug(),
                                    curMT = formdesigner.controller.getCurrentlySelectedMugType();
                            formdesigner.controller.setMugPropertyValue(curMug,groupName,propName,input.val(),curMT);
                        });


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
            uiBlock.show();
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
            uiBlock.show();
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
            uiBlock.show();
        }
        displayFuncs.bindElement = showBindProps;

        function showItextProps(){

        }
        displayFuncs.itext = showItextProps; //not sure if this will ever be used like this, but may as well stick with the pattern

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
                collapsible: true
            });

            adv.find('h3').click(function () {
                var props = $('#fd-question-properties');
                if(props.css('height') === '500px'){
                    $('#fd-question-properties').animate({
                        height:'700px'
                    },200);
                }else{
                    $('#fd-question-properties').animate({
                        height:'500px'
                    },200);
                }
            })

            adv.accordion("activate",false);

            var contentEl = $('#fd-adv-props-content');

            contentEl.empty();
            displayBlock('dataElement');
            displayBlock('bindElement');
            displayBlock('controlElement');

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
                        height:'500px'
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

    /**
     * Creates the UI tree
     */
    function create_question_tree() {
        $.jstree._themes = "themes/";
        $("#fd-question-tree").jstree({
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
            "dnd" : {
                "drop_target" : false,
                "drag_target" : false
            },
            "types": getJSTreeTypes(),
            "plugins" : [ "themes", "json_data", "ui", "types", "crrm", "dnd" ]
	    }).bind("select_node.jstree", function (e, data) {
                    node_select(e, data);
        }).bind("move_node.jstree", function (e, data) {
                    var controller = formdesigner.controller,
                                mugType = controller.form.controlTree.getMugTypeFromUFID($(data.rslt.o).attr('id')),
                                refMugType = controller.form.controlTree.getMugTypeFromUFID($(data.rslt.r).attr('id')),
                                position = data.rslt.p;
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
            url: 'templates/main.html',
            async: false,
            cache: false,
            success: function(html){
                root.append(html);
                console.log("Successfully loaded main template!");
            }
        });

    };

    var init_extra_tools = function(){
        var accContainer = $("#fd-extra-tools"),
            accordion = $("#fd-extra-tools-accordion"),
            min_max = $('#fd-acc-min-max'),
            min_max_button = $('#fd-min-max-button'),
            question_props = $('#fd-question-properties'),
            fd_tree = $('.fd-tree');
        accordion.hide();
        accordion.accordion({
            fillSpace: true,
            collapsible: false
        });

        accordion.show();
        accordion.accordion("resize");
        min_max_button.button({
            icons: {
                primary: 'ui-icon-arrowthick-2-n-s'
            }
        })
//        min_max.button();
        min_max.click(function(){
            var curWidth = accContainer.css('width');
            if(curWidth === '300px'){
                accordion.hide(200)
                accContainer.css('border','');
                min_max.css('border', '');
                accContainer.animate({
                    width:'20px'
                },200);
                question_props.animate({
                    width:'503px'
                },200);
                fd_tree.animate({
                    width:'41%'
                },200);
            }else if(curWidth === '20px'){
                accordion.show(200)
                min_max.css('border','');
                accContainer.css('border', '1px solid gray');
                accContainer.animate({
                    width:'300px'
                },200);
                question_props.animate({
                    width:'374px'
                },200);
                fd_tree.each(function () {
                    $(this).animate({
                        width:'25%'
                    },200)
                });
            }
        });

        $('#fd-add-data-node-button').button({
            icons : {
                primary : 'ui-icon-gear'
            },
            text : false
        });

        $('#fd-template-question-box div').each(function(){
            $(this).button({
                            icons : {
                                primary : 'ui-icon-gear'
                            }
                        });
        })

        function makeFormProp (propLabel, propName, keyUpFunc, initVal){
            var liStr = '<li id=fd-form-prop-"' + propName + '" class="fd-form-property"><span class="fd-form-property-text">'+propLabel+': '+'</span>' +
                '<input id=fd-form-prop-"' + propName + '-' + 'input" class="fd-form-property-input">'+
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
                invalidMTs, i;
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
                $($('#' + invalidMTs[i] + ' a')[0]).append('<span class="ui-icon ui-icon-alert fd-tree-valid-alert-icon"></span>')
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
    //                console.log("onClosed called");
            }
        });

        $('#fancybox-overlay').click(function () {
//            console.log('overlay clicked!');
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

    var showConfirmDialog = function () {
        $( "#fd-dialog-confirm" ).dialog("open");
    };
    that.showConfirmDialog = showConfirmDialog;

    var hideConfirmDialog = function () {
        $( "#fd-dialog-confirm" ).dialog("close");
    };
    that.hideConfirmDialog = hideConfirmDialog;

    /**
     * Set the values for the Confirm Modal Dialog
     * (box that pops up that has a confirm and cancel button)
     * @param confButName
     * @param confFunction
     * @param cancelButName
     * @param cancelButFunction
     */
    var setDialogInfo = that.setDialogInfo = function (message, confButName, confFunction, cancelButName, cancelButFunction){
        var buttons = {}, opt;
            buttons[confButName] = confFunction;
            buttons[cancelButName] = cancelButFunction;
        $('#fd-dialog-confirm .fd-message').text(message);
        
        $( "#fd-dialog-confirm" ).dialog("option",{buttons: buttons});
    }
    that.setDialogInfo = setDialogInfo;

    var init_misc = function () {
        controller.on('question-creation', function (e) {
            setTreeValidationIcons();
        });
    };

    that.init = function(){
        generate_scaffolding($("#formdesigner"));
        do_loading_bar();
        init_toolbar();
        init_extra_tools();
        create_question_tree();
        create_data_tree();
        init_form_paste();
        init_modal_dialogs();

        init_misc();

        setup_fancybox();
    }

    $(document).ready(function () {
        controller = formdesigner.controller;
        controller.initFormDesigner();

    });

    return that;
}());

