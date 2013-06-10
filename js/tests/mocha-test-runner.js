var requirejs = require('requirejs');

// For remapping to use the compiled version or code-coverage instrumented version
var formdesignerPath = process.env.FORMDESIGNER_PATH || 'formdesigner';

requirejs.config({
    baseUrl: '.',
    nodeRequire: require,
    map: {
        '*': {
            'formdesigner': formdesignerPath
        }
    }
});

/* This single-module-name invocation is the only way to invoke requirejs synchronously */
requirejs('tests/all');
