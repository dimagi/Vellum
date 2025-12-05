/*jshint multistr: true */
import util from "tests/utils";
import SMALL_FORM_XML from "static/profiling/small-form.xml";
import HUGE_FORM_XML from "static/profiling/huge_form.xml";

describe("Profiling tests", function () {
    beforeEach(function (done) {
        // start with empty form to reduce effect of previous tests
        util.init({
            core: {
                onReady: function () {
                    done();
                }
            }
        });
    });

    for (var i = 0; i < 6; i++) {
        it("should load small form " + i, function (done) {
            util.init({
                core: {
                    form: SMALL_FORM_XML,
                    onReady: function () {
                        done();
                    }
                }
            });
        });
    }

    it("should load huge form ", function (done) {
        // measured time was ~1.5 minutes, this is artificially high
        this.timeout(5 * 60 * 1000);

        util.init({
            core: {
                form: HUGE_FORM_XML,
                onReady: function () {
                    done();
                }
            }
        });
    });
});
