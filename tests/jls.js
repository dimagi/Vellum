// TODO: delete this file
console.log("do absolutely nothing");

import mocha from "mocha/mocha";
mocha.setup({
    ui: 'bdd',
    timeout: '10000',
});

require(["jquery", "tests/jls2"], function ($, jls2) {
    console.log("required something");
    jls2.logSomething();

    // TODO: copied from tests/main.js
    function runTests() {
        function showTestResults() {
            $("#resultsTab").click();
            return false;
        }
        $(".sidebar #mocha-stats").remove();
        mocha.run();
        // move progress indicator into sidebar
        $("#mocha-stats").css({
            "margin-top": "3em",
            position: "relative",
            left: 0,
            top: 0
        }).appendTo(".sidebar");
        $("#mocha-stats li").css({display: "block"});
        $("#mocha-stats li.progress").css({height: "40px"});
        $("#mocha-stats li.passes a").click(showTestResults);
        $("#mocha-stats li.failures a").click(showTestResults);
    }
    $('#run-tests').click(runTests);
});
