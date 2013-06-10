require([ 
    "require",
    "mocha"
], function(requirejs, mocha) {
    'use strict';

    mocha.setup('bdd');
    requirejs(['tests/all'], function() {
        mocha.run();
    });
});
