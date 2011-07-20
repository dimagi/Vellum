/*jslint maxerr: 50, indent: 4 */
/*globals $,document,console*/
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
                    '<div id="fd-print-tree-button">'+
                '<span id="fd-print-tree-but"></span>Print DATA tree to Console ' +
              '</div>');
            toolbar.append(printTreeBut);

            printTreeBut.button().click(function () {
                console.group("Tree Pretty Print");
                console.log("Control Tree:"+controller.form.controlTree.printTree())
                console.log("Data Tree:   "+controller.form.dataTree.printTree());
                console.groupEnd();
            });
            $("#fd-print-tree-but")
                    .addClass("ui-corner-all ui-icon ui-icon-plusthick")
                    .css("float", "left");

            buttons.printTree = printTreeBut;
        })();

       (function c_fancyBox() {
            var fancyBut = $(
                    '<div id="fd-fancy-button">'+
                '<span id="fd-fancy-but"></span>View Source ' +
              '</div>');
            toolbar.append(fancyBut);

            fancyBut.button().click(function () {
                var d = controller.get_form_data();
                var output = $('#data');
                output.text(d);
                $('#inline').click();
            });
            $("#fd-print-tree-but")
                    .addClass("ui-corner-all ui-icon ui-icon-plusthick")
                    .css("float", "left");

            buttons.fancyBut = fancyBut;
        })();



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

    that.displayMugProperties = that.displayQuestion = function(mugType){
        if (!mugType.properties.controlElement) {
            //fuggedaboudit
            throw "Attempted to display properties for a MugType that doesn't have a controlElement!";
        }


        var displayFuncs = {};

        /**
         * Runs through a properties block and generates the
         * correct li elements (and appends them to the given parentUL)
         *
         * @param propertiesBlock
         * @param parentUL
         */
        function listDisplay(propertiesBlock,parentUL, mugProps){
            var i, li;
            for(i in propertiesBlock){
                if(propertiesBlock.hasOwnProperty(i) && propertiesBlock[i].visibility === 'visible'){
                    var pBlock = propertiesBlock[i],
                            labelStr = pBlock.lstring ? pBlock.lstring : i,
                            liStr = '<li>'+labelStr+': '+'<input>'+'</li>';
                    li = $(liStr);
                    parentUL.append(li);
                }
            }
        }

        function showControlProps(){
            var properties = mugType.properties.controlElement,
                    uiBlock = $('#fd-props-control'),
                    ul;

            uiBlock.empty(); //clear it out first in case there's anything present.
            ul = $('<ul>Control Props</ul>');


            listDisplay(properties,ul,mugType.mug.properties.controlElement.properties);
            uiBlock.append(ul);
            uiBlock.show();
        }
        displayFuncs.controlElement = showControlProps;

        function showDataProps(){
            var properties = mugType.properties.dataElement,
                    uiBlock = $('#fd-props-data'),
                    ul;
            uiBlock.empty(); //clear it out first in case there's anything present.
            ul = $('<ul>Data Props</ul>');

            listDisplay(properties,ul,mugType.mug.properties.dataElement);
            uiBlock.append(ul);
            uiBlock.show();
        }
        displayFuncs.dataElement = showDataProps;


        function showBindProps(){
            var properties = mugType.properties.bindElement,
                    uiBlock = $('#fd-props-bind'),
                    ul;
            uiBlock.empty(); //clear it out first in case there's anything present.
            ul = $('<ul>Bind Props</ul>');


            listDisplay(properties,ul,mugType.mug.properties.bindElement.properties);
            uiBlock.append(ul);
            uiBlock.show();
        }
        displayFuncs.bindElement = showBindProps;

        function showItextProps(){

        }
        displayFuncs.itext = showItextProps; //not sure if this will ever be used like this, but may as well stick with the pattern

        function showAdvanced(){
            var str = '<div id="fd-props-adv-accordion"><h3><a href="#">Advanced Properties</a></h3><div>Some Content<br />asdasddas</div></div>'
            var adv = $(str);
            $('#fd-props-advanced').append(adv);
            adv.accordion({
//                fillSpace: true,
                autoHeight: false,
                collapsible: true
            });
            adv.accordion("activate",false);
        }

        function updateDisplay(){
            var mugTProps = mugType.properties,
            i = 0;
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
            $("#fd-question-properties").show();
        };

        updateDisplay();
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
        var eContainer = $("fd-extra-tools"),
            accordion = $("#fd-extra-tools-accordion"),
                min_max = $('#fd-acc-min-max');
        accordion.accordion({
            fillSpace: true,
            collapsible: true
        });
        accordion.accordion("activate",false);

        min_max.button();
        min_max.click(function(){
            var b = $("#fd-extra-tools"),
            curRight = b.css('right');
            if(curRight === '-255px'){
                b.animate({
                    right:'0px'
                },200);
            }else if(curRight === "0px"){
                b.animate({
                    right:'-255px'
                },200);
            }
        });
        
    };

    var create_data_tree = function(){
        var tree = $("#fd-data-tree-container");
        tree.hover(
                function () {
                    $(this).stop().animate({
                        'left': '0px'
                    }, 200);
                },
                function () {
                    $(this).stop().animate({
                        'left': '-260px'
                    }, 200);
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
        console.log('tarea',tarea);
        tarea.change(function(){
            var parser = new controller.Parser();
            var out = parser.parse(tarea.val());
            $("#fd-form-paste-output").val(out);
        })
    }

    $(document).ready(function () {
        generate_scaffolding($("#formdesigner"));
        do_loading_bar();
        init_toolbar();
        init_extra_tools();
        create_question_tree();
        create_data_tree();
        init_form_paste();

        controller = formdesigner.controller;
        controller.initFormDesigner();

        setup_fancybox();


    });

    return that;
}());

