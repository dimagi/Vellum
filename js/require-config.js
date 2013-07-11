requirejs.config({
    paths: {
        "jquery"                     : "lib/jquery-1.6.1",
        "underscore"                 : "lib/underscore-1.3.1",
        "xml-writer"                 : "lib/XMLWriter-1.0.0",
        "jquery-ui"                  : "bower_components/jquery-ui/ui/jquery-ui"
    },
    packages: [
        {"name": "chai", "main": "chai.js", "location": "node_modules/chai" },
        //{"name": "mocha", "main": "mocha.js", "location": "node_modules/mocha" }
    ],
    urlArgs: "v=" + (new Date).getTime(),
    waitSeconds: 0,
    shim: {
        "jquery": {
            exports: "jQuery"
        },
        "jquery-ui": {
            deps: ["jquery"]
        },
        //"mocha": {
        //    exports: "mocha"
        //},
        "underscore": {
            exports: "_"
        },
        "xml-writer": {
            exports: "XMLWriter"
        }
    }
});
