/*jslint maxerr: 50, indent: 4 */
/*globals $,document,console*/

(function () {
    "use strict";

    function do_loading_bar(){
            var pbar = $("#progressbar"),
            content = $("#content"),
            loadingBar = $("#loadingBar");

            content.show();
            loadingBar.css("background-color", "white");
            loadingBar.fadeIn(100);

            pbar.progressbar({ value: 0 });

            $("#loadingInfo").html("downloading util.js");
            $.getScript("js/util.js", function (){
                pbar.progressbar({ value: (pbar.progressbar( "option", "value" )+33)});
            });

            $("#loadingInfo").html("downloading model.js");
            $.getScript("js/model.js", function(){
                pbar.progressbar({ value: (pbar.progressbar( "option", "value" )+33)});

            });

            $("#loadingInfo").html("downloading controller.js");
            $.getScript("js/controller.js", function(){
                pbar.progressbar({ value: (pbar.progressbar( "option", "value" )+33)});
                loadingBar.delay(500).fadeOut(500);
            });
    }

    function switch_question(question){
        function add_row(prop, val){
            var row;
                row = $("<tr></tr>").appendTo($("#properties-table-body"));

                $("<td>" + prop +"</td>").appendTo(row);
                $("<td><input value=\""+val+"\"</td>").appendTo(row);
        }
        
        var i;
        for(i in question){
            if(question.hasOwnProperty(i)){
                add_row(i,question[i]);
            }
        }

    }

    function init_toolbar(){
        $("#add-question").button().click(function(){
           switch_question({
               foo:"foo",
               bar:"bar",
               bash:"bash"
           });
        });
        $("#add-question-button")
                .addClass("ui-corner-all ui-icon ui-icon-plusthick")
                .css("float", "left");
    }



    $(document).ready(function () {
        do_loading_bar();
        init_toolbar();
    });
}());