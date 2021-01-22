/* global requirejs */
requirejs.config({
    // For some reason when using the map config as suggested by some of the
    // plugins' documentation, and only when including vellum in another
    // app, it tries to get requirejs-promise instead of
    // requirejs-promise.js, so using packages instead.  This might be a bug
    // that should be reported.
    packages: [
        {
            name: 'less',
            location: '../node_modules/@bracken/require-less',
            main: 'less.js'
        },
        {
            name: 'css',
            location: '../node_modules/require-css',
            main: 'css.js'
        },
        {
            name: 'text',
            location: '../node_modules/requirejs-text',
            main: 'text.js'
        },
        {
            name: 'tpl',
            location: '../node_modules/requirejs-undertemplate',
            main: 'tpl.js'
        },
        {
            name: 'json',
            location: '../node_modules/requirejs-plugins/src',
            main: 'json.js'
        },
        {
            name: "codemirror",
            location: "../node_modules/codemirror",
            main: "lib/codemirror",
        },
    ],
    paths: {
        'vellum': '.',

        'CryptoJS': '../lib/sha1',
        'diff-match-patch': '../lib/diff_match_patch',
        'jquery': '../node_modules/jquery/dist/jquery',
        'jquery.jstree': '../node_modules/jstree/dist/jstree',
        'jstree-actions': '../node_modules/jstree-actions/jstree-actions',
        'jquery.bootstrap': '../node_modules/bootstrap/dist/js/bootstrap',
        'underscore': '../node_modules/underscore/underscore',
        'XMLWriter': '../node_modules/XMLWriter/XMLWriter',

        // todo: should convert xpath submodule to AMD
        'xpath': '../node_modules/xpath/xpath',

        'langCodes': '../node_modules/langcodes/langs.json',

        'save-button': '../lib/SaveButton',

        'yui-base': '../node_modules/MediaUploader/yui-base',
        'yui-combo': '../node_modules/MediaUploader/yui-combo',
        'yui-loader': '../node_modules/MediaUploader/yui-loader',
        'yui-uploader': '../node_modules/MediaUploader/yui-uploader',

        'file-uploader': '../node_modules/MediaUploader/hqmedia.upload_controller',
        'jsdiff': '../node_modules/jsdiff/diff',
        'markdown-it': '../node_modules/markdown-it/dist/markdown-it',
        'caretjs': '../node_modules/Caret.js/dist/jquery.caret',
        'atjs': '../node_modules/At.js/dist/js/jquery.atwho',
        'ckeditor': '../lib/ckeditor/ckeditor',
        'ckeditor-jquery': '../lib/ckeditor/adapters/jquery',
        'fusejs': '../node_modules/fuse.js/src/fuse'
    },
    shim: {
        'CryptoJS': {
            exports: 'CryptoJS'
        },
        'diff-match-patch': {
            exports: 'diff_match_patch'
        },

        'jquery.jstree': {
            deps: ['jquery', 'css!../node_modules/jstree/dist/themes/default/style'],
            exports: '$.fn.jstree'
        },
        'jstree-actions': {
            deps: ['jquery.jstree'],
        },
        'jquery.bootstrap': {
            deps: ['jquery'],
            exports: '$.fn.popover'
        },
        'underscore': {
            exports: '_'
        },
        'XMLWriter': {
            exports: 'XMLWriter'
        },

        'save-button': {
            deps: ['jquery'],
            exports: 'SaveButton'
        },

        'yui-base': {
            exports: 'YUI'
        },
        'yui-loader': {
            deps: ['yui-base'],
            exports: 'YUI'
        },
        'yui-uploader': {
            deps: ['yui-base', 'yui-loader', 'css!yui-combo'],
            exports: 'YUI'
        },
        'file-uploader': {
            deps: ['yui-uploader', 'underscore', 'jquery'],
            exports: 'HQMediaFileUploadController'
        },

        'xpath': {
            exports: 'xpath'
        },
        'jsdiff': {
            exports: 'JsDiff'
        },
        'markdown-it': {
            exports: 'markdown-it'
        },
        'caretjs': {
            deps: ['jquery'],
            exports: 'caretjs'
        },
        'atjs': {
            deps: ['jquery', 'caretjs', 'css!../node_modules/At.js/dist/css/jquery.atwho'],
            exports: 'atjs'
        },
        'ckeditor': {
            exports: 'CKEDITOR'
        },
        'ckeditor-jquery': {
            deps: ['jquery', 'ckeditor'],
            exports: '$.fn.ckeditor'
        },
        'fusejs': {
            exports: 'fusejs'
        }
    },
    less: {
        logLevel: 1
    }
});

// If jQuery was loaded before RequireJS, use the existing instance.
// http://www.manuel-strehl.de/dev/load_jquery_before_requirejs.en.html
if (window.jQuery) {
    define('jquery', [], function() {
        return window.jQuery;
    });
}

if (!window.gettext) {
    window.gettext = function (arg) { return arg; };
    window.ngettext = function (singular, plural, count) {
        return count === 1 ? singular : plural;
    };
}

define([
    // begin buildmain.py delimiter
    'vellum/core',
    'vellum/ignoreButRetain',
    'vellum/intentManager',
    'vellum/itemset',
    'vellum/javaRosa/plugin',
    'vellum/datasources',
    'vellum/lock',
    'vellum/databrowser',
    'vellum/commtrack',
    'vellum/modeliteration',
    'vellum/saveToCase',
    'vellum/uploader',
    'vellum/window',
    'vellum/polyfills',
    'vellum/copy-paste',
    'vellum/commander'
    // end buildmain.py delimiter
], function () {
    // adds $.vellum as a side-effect
});
