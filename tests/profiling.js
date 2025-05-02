define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/profiling/small-form.xml',
    'text!static/profiling/huge_form.xml'
], function (
    chai,
    $,
    _,
    util,
    SMALL_FORM_XML,
    HUGE_FORM_XML
) {
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
});
