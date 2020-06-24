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

  grunt.registerTask('default', ['test', 'jshint']);
};
