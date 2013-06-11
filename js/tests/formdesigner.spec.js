/* global describe, it */
if (typeof define !== 'function') { var define = require('amdefine')(module); }
define([
    'underscore',
    'chai',
    'formdesigner'
], function(_, chai, formdesigner) {
    'use strict';

    var assert = chai.assert;

    describe("The assembled formdesigner module", function() {
        it("Contains model, util, ui, etc. (aka the imports/exports are not botched)", function() {
            assert(_(formdesigner).has('model'));
            assert(_(formdesigner).has('ui'));
            assert(_(formdesigner).has('saveButton'));
            assert(_(formdesigner).has('widgets'));
            assert(_(formdesigner).has('controller'));
            assert(_(formdesigner).has('util'));
        });
    });
});
