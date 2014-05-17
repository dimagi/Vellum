// If jQuery, underscore, or Bootstrap were loaded before requirejs, make
// requirejs use the existing instance. 
// http://www.manuel-strehl.de/dev/load_jquery_before_requirejs.en.html
//if (window.jQuery) {
    //define('jquery', [], function() {
        //return jQuery;
    //});
    //if (jQuery.fn.typeahead) {
        //define('jquery.bootstrap', [], function () {
            //return $;
        //});
    //}
    //if (jQuery.fn.popout) {
        //define('jquery.popout', [], function () {
        
        //});
    //}

    //if (jQuery.fn.datepicker) {
        //define('jquery-ui', [], function () {
            //return $;
        //});
    //}
//}

//var gte15 = function (versionStr) {
    //return parseFloat(versionStr.split('.').slice(0, 2).join('.')) >= 1.5;
//};

//if (window._ && gte15(_.VERSION)) {
    //define('underscore', [], function () {
        //return _;
    //});
//}

require.config({
    baseUrl: '.',
    map: {
        '*': {
            'less': 'bower_components/require-less/less',
            'css': 'bower_components/require-css/css',
            'text': 'bower_components/requirejs-text/text',
            'tpl': 'bower_components/requirejs-tpl/tpl'
        }
    },
    less: {
        logLevel: 1
    },
    paths: {
        'vellum': 'src',

        'classy': 'bower_components/classy/classy',
        'codemirror': 'lib/codemirror/xml',
        'codemirrorBase': 'lib/codemirror/codemirror',
        'CryptoJS': 'lib/sha1',
        'diff-match-patch': 'lib/diff_match_patch',
        'jquery': 'bower_components/jquery/jquery',
        'jquery-ui': 'lib/jquery-ui/jquery-ui-1.8.14.custom.min',
        'jquery.jstree': 'lib/jstree/jquery.jstree',
        'jquery.fancybox': 'lib/fancybox/jquery.fancybox-1.3.4',
        'jquery.bootstrap': 'lib/bootstrap',
        'jquery.bootstrap-popout': 'lib/bootstrap-popout',
        'jquery.bootstrap-better-typeahead': 'bower_components/bootstrap-better-typeahead/js/bootstrap-better-typeahead',
        'underscore': 'bower_components/underscore/underscore',
        'XMLWriter': 'bower_components/XMLWriter/XMLWriter',

        // todo: should convert xpath submodule to AMD
        'xpath': 'bower_components/xpath/xpath',
        'xpathmodels': 'bower_components/xpath/models',
        'scheme-number': 'bower_components/xpath/lib/schemeNumber',
        'biginteger': 'bower_components/xpath/lib/biginteger',

        'langCodes': 'bower_components/langcodes/langs.json',

        'save-button': 'lib/SaveButton',

        'yui-base': 'lib/MediaUploader/yui-base',
        'yui-uploader': 'lib/MediaUploader/yui-uploader',

        'swfobject': 'lib/MediaUploader/swfobject',
        'file-uploader': 'lib/MediaUploader/hqmedia.upload_controller',
    },
    shim: {
        'classy': {
            exports: 'Class'
        },
        'codemirror': {
            deps: ['codemirrorBase', 'css!lib/codemirror/codemirror'],
            exports: 'CodeMirror',
        },
        'codemirrorBase': {
            exports: 'CodeMirror'
        },
        'CryptoJS': {
            exports: 'CryptoJS'
        },
        'diff-match-path': {
            exports: 'diff_match_patch'
        },

        'jquery-ui': {
            deps: ['jquery', 'css!lib/jquery-ui/redmond/jquery-ui-1.8.14.custom'],
            exports: 'jQuery'
        },
        'jquery.jstree': {
            deps: ['jquery', 'css!lib/jstree/default/style']
        },
        'jquery.fancybox': {
            deps: ['jquery', 'css!lib/fancybox/jquery.fancybox-1.3.4']
        },
        'jquery.bootstrap': {
            deps: ['jquery']
        },
        'jquery.bootstrap-popout': {
            deps: ['jquery.bootstrap']
        },
        'jquery.bootstrap-better-typeahead': {
            deps: ['jquery.bootstrap']
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
        'yui-uploader': {
            deps: ['yui-base'],
            exports: 'YUI'
        },
        'swfobject': {
            exports: 'swfobject'
        },
        'file-uploader': {
            deps: ['yui-uploader', 'swfobject', 'underscore', 'jquery'],
            exports: 'HQMediaFileUploadController'
        },

        'xpath': {
            deps: ['xpathmodels'],
            exports: 'xpath'
        },
        'xpathmodels': {
            deps: ['scheme-number'],
            exports: 'xpathmodels'
        },
        'scheme-number': {
            deps: ['biginteger'],
            exports: 'SchemeNumber'
        },
        'biginteger': {
            exports: 'BigInteger'
        }
    }
});

define([
    './src/core',
    './src/ignoreButRetain',
    './src/itemset',
    './src/javaRosa',
    './src/lock',
    './src/uploader',
    './src/window'
], function ($) {
    return $;
    // adds $.vellum as a side-effect
});
