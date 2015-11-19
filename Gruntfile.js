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
            'Gruntfile.js',
        ],
        tasks: ['test', 'jshint'],
    },
    mocha_phantomjs: {
        all: {
            options: {
                urls: ['http://localhost:8000/index.html']
            }
        }
    },
    connect: {
        server: {
            options: {
                port: 8000,
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
