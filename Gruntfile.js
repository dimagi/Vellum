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
        'imageEmbed',
        'concat:css', 
        'cssmin',
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
        less: {
            main: {
                files: {
                    "src/less/main.css": "src/less/main.less"
                }
            }
        },
        imageEmbed: {
            dist: {
                src: [
                    "src/js/lib/jstree/default/style.css",
                    "src/css/redmond/jquery-ui-1.8.14.custom.css"
                ],
                dest: "dist/image-embedded.tmp.css"
            }
        },
        concat: {
            css: {
                src: [
                    'src/js/lib/codemirror/codemirror.css',
                    'src/js/lib/fancybox/jquery.fancybox-1.3.4.css',
                    'dist/image-embedded.tmp.css',
                    'src/less/main.css'
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

                    'src/js/lib/jstree/jquery.jstree.js',
                    'src/js/lib/fancybox/jquery.fancybox-1.3.4.js',
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
                        '    Released under the MIT License \n' +
                        '    http://github.com/dimagi/Vellum */\n',
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
};
