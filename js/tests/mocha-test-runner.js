var requirejs = require('requirejs');

// For remapping to use the compiled version or code-coverage instrumented version
var formdesignerPath = process.env.FORMDESIGNER_PATH || 'formdesigner';

requirejs.config({
    baseUrl: '.',
    nodeRequire: require,
    map: {
        '*': {
            'formdesigner': formdesignerPath,
            'jqueryui': 'lib/jquery-ui-1.10.3/jqueryui'
        }
    }
});

var jsdom = require("jsdom").jsdom;

global.navigator = { userAgent: 'mocha' }; // jQuery-UI touches this
global.document = jsdom('<html><body></body></html>');
global.window = document.createWindow();

/* This single-module-name invocation is the only way to invoke requirejs synchronously */
requirejs('tests/all');

