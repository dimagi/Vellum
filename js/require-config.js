requirejs.config({
    paths: {
        "underscore"                 : "lib/underscore-1.3.1",
    },
    packages: [
        {"name": "mocha", "main": "mocha.js", "location": "node_modules/mocha" }
    ],
    urlArgs: "v=" + (new Date).getTime(),
    waitSeconds: 0,
    shim: {
        "mocha": {
            exports: "mocha"
        },
        "underscore": {
            exports: "_"
        },
    }
});
