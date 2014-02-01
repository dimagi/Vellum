var fs = require('fs');
var exec = require('child_process').exec;


module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-githooks');

    grunt.registerTask('dist', [
        'concat:css', 
        'concat:js', 
        'uglify'
    ]);

    grunt.registerTask('git_add_dist', "Git add modified dist files",
        function () {
            exec("git add dist");
        }
    );

    var dest;
    if (fs.lstatSync('.git').isDirectory()) {
        dest = '.git/hooks';
    } else {
        // hardcoded CommCare HQ submodule path
        dest = '../../.git/modules/submodules/formdesigner/.git/hooks';
    }

    grunt.initConfig({
        githooks: {
            options: {
                dest: dest
            },
            all: {
                'pre-commit': 'dist git_add_dist'
            }
        },
        concat: {
            css: {
                src: [
                    'css/chosen.css',
                    'js/lib/codemirror/codemirror.css',
                    'css/jquery.fancybox-1.3.4.css',
                    'style/structure.css',
                    'style/editor-column.css',
                    'style/tree-content.css',
                    'style/question-props.css',
                    'style/xpath-editor.css'
                ],
                dest: 'dist/vellum.css'
            },
            js: {
                options: {
                    separator: ';'
                },
                src: [
                    'js/lib/xpath/lib/biginteger.js',
                    'js/lib/xpath/lib/schemeNumber.js',
                    'js/lib/xpath/models.js',
                    'js/lib/xpath/xpath.js',

                    'js/lib/jquery.jstree.js',
                    'js/lib/jquery.fancybox-1.3.4.js',
                    'js/lib/chosen.jquery.js',
                    'js/lib/sha1.js',
                    'js/lib/diff_match_patch.js',
                    'js/lib/XMLWriter-1.0.0.js',
                    'js/lib/codemirror/codemirror.js',
                    'js/lib/codemirror/xml.js',
                    'js/lib/classy-1.4.js',
                    'js/formdesigner.javarosa.js',
                    'js/window.js',
                    'js/util.js',
                    'js/multimedia.js',
                    'js/widgets.js',
                    'js/model.js',
                    'js/controller.js',
                    'js/ui.js'
                ],
                dest: 'dist/vellum.js'
            }
        },
        uglify: {
            options: {
                // the banner is inserted at the top of the output
                banner: '/*! Vellum <%= grunt.template.today("dd-mm-yyyy") %> \n' +
                        '    Copyright 2009-2014, Dimagi Inc., and individual contributors \n' +
                        '    See http://github.com/dimagi/Vellum for license */\n',
                sourceMap: true,
                preserveComments: false,
                mangle: false
            },
            dist: {
                files: {
                    'dist/vellum.min.js': ['dist/vellum.js']
                }
            }
        }
    });
}
