/*jshint multistr: true */
import chai from "chai";
import _ from "underscore";
import util from "tests/utils";

var assert = chai.assert;

describe("The plugin manager", function () {
    it("should ignore unknown plugins", function (done) {
        util.init({
            plugins: ["plugin-will-not-be-found"],
            core: { onReady: function () {
                assert(!this.isPluginEnabled("plugin-will-not-be-found"),
                    "loaded unknown plugin");
                done();
            }
        }});
    });
});
