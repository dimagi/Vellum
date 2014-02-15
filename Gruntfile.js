var fs = require('fs'),
    exec = require('child_process').exec,
    _ = require('underscore');

module.exports = function (grunt) {
    _.each([
        'grunt-contrib-concat',
        'grunt-contrib-cssmin',
        'grunt-contrib-less',
        'grunt-contrib-uglify',
        'grunt-image-embed',
        'grunt-githooks'
    ], grunt.loadNpmTasks);

    grunt.registerTask('dist', [
        'less',
        'concat:css', 
        'concat:js',
        'cssmin',
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
        less: {
            main: {
                files: {
                    "src/style/structure.css": "src/style/structure.less",
                    "src/style/editor-column.css": "src/style/editor-column.less",
                    "src/style/tree-content.css": "src/style/tree-content.less",
                    "src/style/question-props.css": "src/style/question-props.less",
                    "src/style/xpath-editor.css": "src/style/xpath-editor.less"
                }
            }
        },
        concat: {
            css: {
                src: [
                    'src/css/chosen.css',
                    'src/js/lib/codemirror/codemirror.css',
                    'src/css/jquery.fancybox-1.3.4.css',
                    'src/style/structure.css',
                    'src/style/editor-column.css',
                    'src/style/tree-content.css',
                    'src/style/question-props.css',
                    'src/style/xpath-editor.css'
                ],
                dest: 'dist/vellum.css'
            },
            js: {
                options: {
                    separator: ';'
                },
                src: [
                    'node_modules/xpath/lib/biginteger.js',
                    'node_modules/xpath/lib/schemeNumber.js',
                    'node_modules/xpath/models.js',
                    'node_modules/xpath/xpath.js',

                    'src/js/lib/jquery.jstree.js',
                    'src/js/lib/jquery.fancybox-1.3.4.js',
                    'src/js/lib/chosen.jquery.js',
                    'src/js/lib/sha1.js',
                    'src/js/lib/diff_match_patch.js',
                    'node_modules/XMLWriter/XMLWriter.js',
                    'src/js/lib/codemirror/codemirror.js',
                    'src/js/lib/codemirror/xml.js',
                    'node_modules/classy/classy-1.4/classy.js',
                    'src/js/formdesigner.javarosa.js',
                    'src/js/formdesigner.ignoreButRetain.js',
                    'src/js/formdesigner.lock.js',
                    'src/js/window.js',
                    'src/js/util.js',
                    'src/js/multimedia.js',
                    'src/js/widgets.js',
                    'src/js/model.js',
                    'src/js/controller.js',
                    'src/js/ui.js'
                ],
                dest: 'dist/vellum.js'
            }
        },
        cssmin: {
            combine: {
                files: {
                    'dist/vellum.min.css': ['dist/vellum.css']
                }
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
