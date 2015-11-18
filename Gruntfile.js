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
    // test: {
    //   options: {
    //     banner: '#<{(|! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> |)}>#\n'
    //   },
    //   build: {
    //     src: 'src/<%= pkg.name %>.js',
    //     dest: 'build/<%= pkg.name %>.min.js'
    //   }
    // }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');

  grunt.registerTask('default', ['jshint']);
};
