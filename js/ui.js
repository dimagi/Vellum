/*jslint maxerr: 50, indent: 4 */
/*globals $,document,console*/
if(typeof formdesigner === 'undefined'){
    var formdesigner = {};
}

formdesigner.ui = (function () {
    "use strict";
    var that = {}, question_list = [],
    buttons = {},
    controller = formdesigner.controller,
    questionTree;

    var appendErrorMessage = that.appendErrorMessage = function(msg){
        $('#fd-notify').addClass("notice");
        $('#fd-notify').text($('#fd-notify').text() + msg);
    };
    
    function do_loading_bar(){
        var pbar = $("#progressbar"),
        content = $("#content"),
        loadingBar = $("#loadingBar"),
                doneController = false,
                doneUtil = false,
                doneModel = false,
                doneTree = true,
                allDone = false,
                tryComplete = function(){
                    allDone = doneUtil && doneController && doneModel;
                    if(allDone){
                        loadingBar.delay(500).fadeOut(500);
                    }
                };

        content.show();
        loadingBar.css("background-color", "white");
        loadingBar.fadeIn(100);

        pbar.progressbar({ value: 0 });

//        $("#loadingInfo").html("downloading jstree.js");
//        $.getScript("js/jquery.jstree.js", function(){
//            pbar.progressbar({ value: (pbar.progressbar( "option", "value" )+25)});
//            doneTree = true;
//            tryComplete();
//        });
//
//        $("#loadingInfo").html("downloading util.js");
//        $.getScript("js/util.js", function (){
//            pbar.progressbar({ value: (pbar.progressbar( "option", "value" )+25)});
//            doneUtil = true;
//            tryComplete();
//        });
//
//        $("#loadingInfo").html("downloading model.js");
//        $.getScript("js/model.js", function(){
//            pbar.progressbar({ value: (pbar.progressbar( "option", "value" )+25)});
//            doneModel = true;
//            tryComplete();
//        });
//
//        $("#loadingInfo").html("downloading controller.js");
//        $.getScript("js/controller.js", function(){
//            pbar.progressbar({ value: (pbar.progressbar( "option", "value" )+25)});
//            doneController = true;
//            tryComplete();
//        });
//
//        window.setTimeout(function(){
//            if(!allDone){
//                    allDone = doneUtil && doneController && doneModel && doneTree;
//                    if(allDone){
//                        loadingBar.delay(500).fadeOut(500);
//                    }else{
//                        var alertString = '';
//                        if(!doneUtil){ alertString += '[Util.js]'; }
//                        if(!doneController){ alertString += '[Controller.js]';}
//                        if(!doneModel){ alertString += '[Model.js]';}
//                        if(!doneTree){ alertString += '[jsTree]'; }
//
//                        alert("Problem loading FormDesigner Libraries! Libraries not loaded: "+alertString);
//                    }
//            }
//                },5000);

        loadingBar.fadeOut(200);

    }

    function do_nav_bar(){
        $(function() {
            var d=300;
            $('#navigation a').each(function(){
                $(this).stop().animate({
                    'marginTop':'-80px'
                },d+=150);
            });

            $('#navigation > li').hover(
                function () {
                    $('a',$(this)).stop().animate({
                        'marginTop':'-2px'
                    },200);
                },
                function () {
                    $('a',$(this)).stop().animate({
                        'marginTop':'-80px'
                    },200);
                }
            );
        });
    }

    function init_toolbar(){
        var toolbar = $("#fd-toolbar");
        (function c_add_text_question(){ //c_ means 'create' here
            $("#fd-add-question").button().click(function(){
                formdesigner.controller.createQuestion("text");
            });
            $("#fd-add-question-button")
                    .addClass("ui-corner-all ui-icon ui-icon-plusthick")
                    .css("float", "left");

            buttons.addTextQuestion = $("#fd-add-question");
        })();

        (function c_add_group(){
            $("#fd-add-group-but").button().click(function(){
                formdesigner.controller.createQuestion("group");
            });
            $("#fd-add-group-button")
                    .addClass("ui-corner-all ui-icon ui-icon-plusthick")
                    .css("float", "left");
            buttons.addGroup = $("#fd-add-group-but");
        })();

        (function c_printDataTreeToConsole(){
            var printTreeBut = $(
                    '<div id="fd-print-tree-but"> \
                <span id="fd-print-tree-button"></span>Print DATA tree to Console \
              </div>');
            toolbar.append(printTreeBut);

            printTreeBut.button().click(function(){
                console.log(controller.form.dataTree.printTree());
            });
            $("#fd-print-tree-button")
                    .addClass("ui-corner-all ui-icon ui-icon-plusthick")
                    .css("float", "left");

            buttons.printTree = printTreeBut;
        })();

    }
    that.buttons = buttons;



    /**
     * Private function (to the UI anyway) for handling node_select events.
     * @param e
     * @param data
     */
    function node_select(e,data){
        var curSelUfid = jQuery.data(data.rslt.obj[0],'mugTypeUfid');
        formdesigner.controller.setCurrentlySelectedMugType(curSelUfid);
        displayMugProperties(formdesigner.controller.getCurrentlySelectedMugType());
    };

    /**
     * Creates the UI tree
     * TODO: set up DND plugin, attach event bindings for DND.
     */
    function create_tree(){
        $.jstree._themes = "themes/";
        $("#fd-question-tree").jstree({
            "json_data" : {
                "data" : []
            },
            "crrm" : {
                "move": {
                    "always_copy": false,
                    "check_move" : function (m) {
//                        console.group("check_mode jstree init function callback");
//                        console.log(m);
//                        console.log($(m.o));
                        var controller = formdesigner.controller,
                                mugType = controller.form.controlTree.getMugTypeFromUFID($(m.o).attr('id')),
                                refMugType = controller.form.controlTree.getMugTypeFromUFID($(m.r).attr('id')),
                                position = m.p;

//                        console.log("MugType...");
//                        console.log(mugType);
//                        console.log("refMugType...");
//                        console.log(refMugType);
//                        console.log("Position...");
                        console.log(position);
                        console.log(Math.random());
//                        console.groupEnd();
                        return formdesigner.model.checkMoveOp(mugType,position,refMugType);
				    }
                }
            },
            "dnd" : {
                        "drop_target" : false,
                        "drag_target" : false
            },
            "types": getJSTreeTypes(),
            "plugins" : [ "themes", "json_data", "ui", "types", "crrm","dnd" ]
	    }).bind("select_node.jstree", function (e, data) {
                   node_select(e,data);
        });
        questionTree = $("#fd-question-tree");
    }

    function getJSTreeTypes(){
        var groupRepeatValidChildren = formdesigner.util.GROUP_OR_REPEAT_VALID_CHILDREN;
       var types =  {
            "max_children" : -1,
			"valid_children" : groupRepeatValidChildren,
			"types" : {
                "group" : {
                    "icon":{
                        "image" : "css/smoothness/images/ui-icons_888888_256x240.png",
                        "position": "-16px -96px"
                    },
                    "valid_children" : groupRepeatValidChildren
                },
                "repeat" : {
                    "valid_children" : groupRepeatValidChildren
                },
                "question" : {
                    "icon":{
                        "image" : "css/smoothness/images/ui-icons_888888_256x240.png",
                        "position": "-128px -96px"
                    },
                    "valid_children" : "none"
                },
                "selectQuestion" : {
                    "valid_children": ["item"]
                },
                "item" : {
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
     * Updates the properties view such that it reflects the
     * properties of the currently selected tree item.
     *
     * This means it will show only fields that are available for this
     * specific MugType and whatever properties are already set.
     *
     *
     * @param mugType
     */
    var displayMugProperties = function(mugType){
        var that = {},
                qTable,
                qTHeader,
                qTBody,
                localMug = mugType.mug,
                qPropHolder,
                showPropertiesFactory = {};

        if(!mugType.properties.controlElement){
            //fuggedaboudit
            throw "Attempted to display properties for a MugType that doesn't have a controlElement!";
        }

        qPropHolder = $('#fd-question-properties');
        qPropHolder.empty();
        that.qTable = qTable;
        that.qTHeader = qTHeader;
        that.qTBody = qTBody;

        /**
         * Creates the Properties Box on the UI
         */
        var create = function (mugT, title){
            var i,
            mug = mugT.mug;


            qTable = $('<table id="fd-question-table" class=fd-"'+title+'"></table>');
            qPropHolder.append(qTable);
            qTHeader = $('<thead class="fd-question-table-header"></thead>');
            qTHeader.append('<tr><td colspan=2><b><h1>Question Properties: '+mug.properties.dataElement.properties.nodeID+'</h1></b></td></tr>');
            qTHeader.append("<tr><td><b>Property Name</b></td><td><b>Property Value</b></td></tr>");
            qTable.append(qTHeader);
            qTBody = $("<tbody></tbody>");
            qTable.append(qTBody);


            i = 'ufid';
            var row, col1,col2,mugProps;

            row = $("<tr></tr>");
            qTBody.append(row);
            row.attr('id', 'fd-'+i);
            row.attr('class', "fd-question-property-row");
            col1 = $("<td></td>");
            col2 = $("<td></td>");
            row.append(col1);
            row.append(col2);

            col1.html(i);
            col2.html(mug[i]);
            mugProps = mug.properties;
            for(var p in mugProps){
                var block = mugProps[p].properties;
                if(!mugProps.hasOwnProperty(p)){
                    continue;
                }
                if(typeof block === 'function' || typeof block === 'string'){
                    continue;
                }

                qTBody.append("<hr />");
                qTBody.append('<tr><td colspan=2><h2 class="fd-properties-block-header">'+p+' Properties:</h2></tr>')

                for(i in block){
                    var inputBox;
                    if(!block.hasOwnProperty(i) || typeof block[i] === 'function'){
                        continue;
                    }
                    row = $("<tr></tr>");
                    qTBody.append(row);
                    row.attr('id', 'fd-'+i);
                    row.attr('class', "fd-question-property-row");
                    col1 = $('<td>'+i+'</td>');
                    col2 = $('<td></td>');
                    inputBox = $('<input value="'+block[i]+'" name=fd-'+i+' class=fd-'+p+' />');
                    col2.append(inputBox);
                    inputBox.change(function(e){
                        var target = $(e.target),
                                el = target.attr("class").replace('fd-',''),
                                prop = target.attr("name").replace('fd-',''),
                                newVal = target.val().replace('"','').replace('"','');
                        setPropertyValForModel(mug,el,prop, newVal);
                    });
                    row.append(col1);
                    row.append(col2);
                }
            }

            $('input[class="fd-dataElement"][name="fd-nodeID"]').keyup(function(){
                var node = $('#'+controller.getCurrentlySelectedMug().ufid);
                $('#fd-question-tree').jstree("rename_node",node,this.value);
            })




        }(mugType, localMug.ufid);

        /**
         * Used for setting up the basic skeleton for properties editing
         * (i.e. all the stuff that's common across the different MugTypes)
         * @param mugT
         * @return an object containing the various fields/items that are
         * usefully editable
         */
        showPropertiesFactory.generic = function(mugT){

        }



        /**
         * Shows the properties that are editable by the user
         * (as either a repeat or group)
         * @param mugT - the MugType associated with this group/repeat
         * @param isRepeat
         */
        showPropertiesFactory.group = showPropertiesFactory.repeat = function(mugT){
            var fields = showPropertiesFactory.generic(mugT);
        }

        /**
         * Here 'Normal Question' means whatever
         * isn't a repeat, group, (1)select, item, trigger
         * @param mugT
         */
        var showNormalQuestionProperties = function(mugT){
            var fields = showPropertiesFactory.generic(mugT);
        }
        var s = showPropertiesFactory;
        s.text = s.int = s.long = s.double = s.date = s.datetime = s.picture = showNormalQuestionProperties;

        //We use the showProperties object as dictionary to make it easier to select
        //the right function based on the MugType without a pita long and complex if/switch statement.

        /**
         * Shows the props for 1selec/select type questions
         * @param mugT
         */
        var showSelectQuestionProperties = function(mugT){
            var fields = showPropertiesFactory.generic(mugT);
        }

        /**
         * Shows props for Items (in a select/1select).
         * @param itemData - the data object associated with this item
         */
        var showSelectItemProperties = function(itemData){

        }

        /**
         * Shows the props for a Trigger item.
         * @param mugT
         */
        var showTriggerProperties = function(mugT){

        }


        function setPropertyValForUI(property, value){
            $(".fd-question-property-row fd-"+property+" td:nth-child(2)").html(value);
        }
        that.setPropertValForUI = setPropertyValForUI;

        /**
         *
         * @param element can be one of (string) 'bind','data','control'
         * @param property (string) property name
         * @param val new value the property should be set to.
         */
        function setPropertyValForModel(myMug, element,property, val){
            var rootProps = myMug['properties'];
            var elProps = rootProps[element].properties,
                propertyToChange = elProps[property], event = {};

            myMug.properties[element].properties[property] = val;
            event.type = 'property-changed';
            event.property = property;
            event.element = element;
            event.val = val;
            myMug.fire(event);

        }

        return that;
    };
    that.displayMugProperties = displayMugProperties;

    /**
     *
     * @param rootElement
     */
    var generate_scaffolding = function(rootElement){
        var root = $(rootElement);
        root.append('<div id="fd-ui-container"> \
          <div id="fd-notify"></div> \
          <div id="fd-toolbar" class="fd-toolbar"> \
              <div id="fd-add-question"> \
                <span id="fd-add-question-button"></span>Add a Text Question \
              </div> \
              <div id="fd-add-group-but"> \
                <span id="add-group-button"></span>Add a Group \
              </div> \
          </div> \
          <div id="fd-question-tree" class="fd-tree"> \
\
           </div> \
          <div id="fd-question-properties" class="fd-question-properties"> \
\
          </div> \
      </div>');

    };

    $(document).ready(function () {
        generate_scaffolding($("#formdesigner"));
        do_loading_bar();
        init_toolbar();
        create_tree();
        do_nav_bar();

        controller = formdesigner.controller;
        controller.initFormDesigner();


    });

    return that;
}());