module.exports = function(grunt)  {
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
        src: {
            src: ['src/*.js'],
            options: {
                jshintrc: '.jshintrc',
            }
        },
        tests: {
            src: ['tests/*.js'],
            options: {
                jshintrc: 'tests/.jshintrc'
            }
        }
    },
    watch: {
        files: [
            '<%= jshint.src.src %>',
            '<%= jshint.tests.src %>',
            'tests/static/**/*.xml',
            'Gruntfile.js',
        ],
        tasks: ['test', 'jshint'],
        options: {
            interrupt: true,
        }
    },
    mocha_phantomjs: {
        all: {
            options: {
                urls: ['http://localhost:8081/index.html'],
                reporter: 'nyan', // the only one that gives # of tests completed
                config: {
                    'bail': true,
                    'grep': grunt.option('grep') || "",
                }
            }
        }
    },
    connect: {
        server: {
            options: {
                port: grunt.option('port') || 8081,
                base: '.',
            }
        }
    },

  });

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha-phantomjs');

  grunt.registerTask('default', ['test', 'jshint']);
  grunt.registerTask('test', ['connect', 'mocha_phantomjs']);
};
