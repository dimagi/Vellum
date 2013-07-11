require([ 
    "require",
    //"mocha"
], function(requirejs) {
    'use strict';

    if (window.mochaPhantomJS) { 
        requirejs(['tests/all'], function() {
            mochaPhantomJS.run(); 
        });
    }
    else { 
        requirejs(['tests/all'], function() {
            mocha.run();
        });
    }
});
