define([
    'tests/utils',
    'chai',
    'jquery',
    'text!static/setvalue/set-value.xml',
    'text!static/setvalue/set-value-special.xml'
], function (
    util,
    chai,
    $,
    SET_VALUE_XML,
    SET_VALUE_SPECIAL_XML
) {
    var assert = chai.assert,
        call = util.call;

    describe("setvalues", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        });

        it("should be associated with the correct mug on form load", function() {
            util.loadXML(SET_VALUE_XML);
            var text = util.getMug('text');
            assert.strictEqual(text.p.setValue, 'blah');
        });

        it("should have event jr-insert when added into repeat", function() {
            util.loadXML("");
            util.addQuestion("Repeat", 'repeat');
            var text = util.addQuestion("Text", 'text'),
                form, setvalue;

            text.p.setValue = 'blah';

            form = call("createXML");
            setvalue = $($.parseXML(form)).find('setvalue');

            assert.strictEqual(setvalue.attr('event'), 'jr-insert');
            assert.strictEqual(setvalue.attr('ref'), '/data/repeat/text');
            assert.strictEqual(setvalue.attr('value'), 'blah');
        });

        it("should have event xforms-ready when added outside of repeat", function() {
            util.loadXML("");
            var text = util.addQuestion("Text", 'text'),
                form, setvalue;

            text.p.setValue = 'blah';

            form = call("createXML");
            setvalue = $($.parseXML(form)).find('setvalue');

            assert.strictEqual(setvalue.attr('event'), 'xforms-ready');
            assert.strictEqual(setvalue.attr('ref'), '/data/text');
            assert.strictEqual(setvalue.attr('value'), 'blah');
        });

        it("should not be associated with a question if event is not xforms-ready or jr-insert", function() {
            util.loadXML(SET_VALUE_SPECIAL_XML);
            var form = call("createXML"),
                setvalue = $($.parseXML(form)).find('setvalue');
            assert.strictEqual(setvalue.attr('event'), 'special-snowflake');
            assert.strictEqual(setvalue.attr('ref'), '/data/text');
            assert.strictEqual(setvalue.attr('value'), 'blah');
        });
    });
});
