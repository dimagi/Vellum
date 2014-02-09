var fs = require('fs');
var exec = require('child_process').exec;

module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-githooks');

    grunt.registerTask('dist', [
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
        cssmin: {
            combine: {
                files: {
                    'dist/vellum.min.css': ['dist/vellum.css']
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
                    'src/js/lib/xpath/lib/biginteger.js',
                    'src/js/lib/xpath/lib/schemeNumber.js',
                    'src/js/lib/xpath/models.js',
                    'src/js/lib/xpath/xpath.js',

                    'src/js/lib/jquery.jstree.js',
                    'src/js/lib/jquery.fancybox-1.3.4.js',
                    'src/js/lib/chosen.jquery.js',
                    'src/js/lib/sha1.js',
                    'src/js/lib/diff_match_patch.js',
                    'src/js/lib/XMLWriter-1.0.0.js',
                    'src/js/lib/codemirror/codemirror.js',
                    'src/js/lib/codemirror/xml.js',
                    'src/js/lib/classy-1.4.js',
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
