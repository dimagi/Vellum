requirejs.config({
    paths: {
        "jquery"                     : "lib/jquery-1.6.1",
        "underscore"                 : "lib/underscore-1.3.1",
        "xml-writer"                 : "lib/XMLWriter-1.0.0"
    },
    packages: [
        {"name": "chai", "main": "chai.js", "location": "node_modules/chai" },
        {"name": "mocha", "main": "mocha.js", "location": "node_modules/mocha" },
        {"name": "xmldom", "main": "dom-parser.js", "location": "node_modules/xmldom" }
    ],
    urlArgs: "v=" + (new Date).getTime(),
    waitSeconds: 0,
    map: {
        '*': {
            'jqueryui': 'lib/jquery-ui-1.10.3/jqueryui'
        }
    },
    shim: {
        "jquery": {
            exports: "jQuery"
        },
        "jquery-ui": {
            deps: ["jquery"],
            exports: "jQuery"
        },
        "mocha": {
            exports: "mocha"
        },
        "underscore": {
            exports: "_"
        },
        "xml-writer": {
            exports: "XMLWriter"
        }
    }
});
