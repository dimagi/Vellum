/*jslint maxerr: 50, indent: 4 */
/*globals $,document,console*/
if(typeof formdesigner === 'undefined'){
    var formdesigner = {};
}

formdesigner.ui = (function () {
    "use strict";
    var that = {}, question_list = [];

    function do_loading_bar(){
        var pbar = $("#progressbar"),
        content = $("#content"),
        loadingBar = $("#loadingBar"),
                doneController = false,
                doneUtil = false,
                doneModel = false,
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

        $("#loadingInfo").html("downloading util.js");
        $.getScript("js/util.js", function (){
            pbar.progressbar({ value: (pbar.progressbar( "option", "value" )+35)});
            doneUtil = true;
            tryComplete();
        });

        $("#loadingInfo").html("downloading model.js");
        $.getScript("js/model.js", function(){
            pbar.progressbar({ value: (pbar.progressbar( "option", "value" )+32)});
            doneModel = true;
            tryComplete();
        });

        $("#loadingInfo").html("downloading controller.js");
        $.getScript("js/controller.js", function(){
            pbar.progressbar({ value: (pbar.progressbar( "option", "value" )+33)});
            doneController = true;
            tryComplete();
        });

        window.setTimeout(function(){
            if(!allDone){
                    allDone = doneUtil && doneController && doneModel;
                    if(allDone){
                        loadingBar.delay(500).fadeOut(500);
                    }else{
                        alert("Problem loading FormDesigner! Haha!");
                    }
            }
                },5000);



    }

    function init_toolbar(){
        $("#add-question").button().click(function(){
            var mug = formdesigner.controller.createQuestion(),
            uiQuestion = new Question(mug);
            question_list.push(mug)
            $('#question-properties').append('<br>');
        });
        $("#add-question-button")
                .addClass("ui-corner-all ui-icon ui-icon-plusthick")
                .css("float", "left");
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

    $(document).ready(function () {
        do_loading_bar();
        init_toolbar();
        do_nav_bar();
    });

    var Question = function(mug){
        var that = {}, qTable, qTHeader,qTBody, questionHolder, localMug = mug;

        questionHolder = $("#question-table-body")

        that.qTable = qTable;
        that.qTHeader = qTHeader;
        that.qTBody = qTBody;

        var create = function (mug, title){
            var i,
                monWin = $('<div class="monitor-window"></div>');
            $('#question-properties').append(monWin);
            monWin.append('<textarea id="monitor-window-'+mug.ufid+'" class="monitor-window-textarea">'+JSON.stringify(mug,null,'\t')+'</textarea>');
            qTable = $('<table id="question-table" class="'+title+'"></table>');
            $('#question-properties').append(qTable);

//            qTable.css("border","1");

            qTHeader = $('<thead class="question-table-header"></thead>');
            qTHeader.append('<tr><td colspan=2><b><h2>Question Properties: '+mug.dataElement.nodeID+'</h1 ></b></td></tr>');
            qTHeader.append("<tr><td><b>Property Name</b></td><td><b>Property Value</b></td></tr>");
            qTable.append(qTHeader);
            qTBody = $("<tbody></tbody>");
            qTable.append(qTBody);




            i = 'ufid';
            var row, col1,col2;

            row = $("<tr></tr>");
            qTBody.append(row);
            row.attr('id', i);
            row.attr('class', "question-property-row");
            col1 = $("<td></td>");
            col2 = $("<td></td>");
            row.append(col1);
            row.append(col2);

            col1.html(i);
            col2.html(mug[i]);

            for(var p in mug){
                var block = mug[p];
                if(!mug.hasOwnProperty(p)){
                    continue;
                }
                if(typeof block === 'function' || typeof block === 'string'){
                    continue;
                }

                qTBody.append("<hr />");
                qTBody.append('<tr><td colspan=2><h2>'+p+' Properties:</h2></tr>')

                for(i in block){
                    var inputBox;
                    if(!block.hasOwnProperty(i) || typeof block[i] === 'function'){
                        continue;
                    }
                    row = $("<tr></tr>");
                    qTBody.append(row);
                    row.attr('id', i);
                    row.attr('class', "question-property-row");
                    col1 = $('<td>'+i+'</td>');
                    col2 = $('<td></td>');
                    inputBox = $('<input value="'+block[i]+'" name="'+i+'" class="'+p+'" />');
                    col2.append(inputBox);
                    inputBox.change(function(e){
                        var target = $(e.target);

                        mug[target.attr("class")][target.attr("name")] = target.val();
                       console.log("asdasd");
                        console.log(e.target);
                       mug.fire('property-changed');
                    });
                    row.append(col1);
                    row.append(col2);

                }

            }

            mug.on('property-changed',function(){
                console.log(mug);
                $('#monitor-window-'+mug.ufid).filter(":input").text(JSON.stringify(mug,null,'\t'));
            },null);




        }(localMug, localMug.ufid);


        function setPropertyValForUI(property, value){
            $(".question-property-row "+property+" td:nth-child(2)").html(value);
        }
        that.setPropertValForUI = setPropertyValForUI;

        /**
         *
         * @param element can be one of (string) 'bind','data','control'
         * @param property (string) property name
         * @param val new value the property should be set to.
         */
        function setPropertyValForModel(element,property, val){
            mug[element][property] = val;
            mug.fire('property-changed');
        }

        return that;
    };
    that.Question = Question;

    return that;
}());