// TODO: delete this file
define([
    "jquery",
    "underscore",
    "tests/xml",
    "jstree",
], function (
    $,
    _,
) {
    console.log("inside jls2");
    console.log("stuff: " + _.map([1,2], function (x) { return x * 2; }));
    console.log("Button label: " + $("#load-saved").text());

    return {
        logSomething: function () { console.log("this function is defined in jls2"); },
    };
})
