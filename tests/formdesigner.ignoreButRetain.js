/*jshint multistr: true */
define([
    'tests/utils',
    'chai',
    'jquery',
    'text!static/ignoreButRetain/common.xml',
    'text!static/ignoreButRetain/common-ignored.xml',
    'text!static/ignoreButRetain/delete-bug-after.xml',
    'text!static/ignoreButRetain/delete-bug-before.xml',
    'text!static/ignoreButRetain/empty-parent.xml',
    'text!static/ignoreButRetain/ignore-in-head.xml',
    'text!static/ignoreButRetain/multiple-ignores.xml',
    'text!static/ignoreButRetain/multi-match.xml',
    'text!static/ignoreButRetain/referenced-renamed.xml',
    'text!static/ignoreButRetain/referenced-unrenamed.xml',
    'text!static/ignoreButRetain/renamed.xml',
    'text!static/ignoreButRetain/unrenamed.xml'
], function (
    util,
    chai,
    $,
    COMMON,
    COMMON_IGNORED,
    DELETE_BUG_AFTER,
    DELETE_BUG_BEFORE,
    EMPTY_PARENT,
    IGNORE_IN_HEAD,
    MULTIPLE_IGNORES,
    MUTLI_MATCH,
    REFERENCED_RENAMED,
    REFERENCED_UNRENAMED,
    RENAMED,
    UNRENAMED
) {
    var assertXmlEqual = util.assertXmlEqual,
        call = util.call;

    describe("The Ignore-But-Retain plugin", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        });

        var testXmlPair = function (rawXml, processedXml) {
            util.loadXML(rawXml);
            assertXmlEqual(call('createXML'), rawXml);

            call('getData').ignore.ignoredNodes = [];
            assertXmlEqual(call('createXML'), processedXml);
        };

        it("ignores data, bind, body, and setvalue nodes with various edge cases (see XML)", function () {
            testXmlPair(COMMON, COMMON_IGNORED);
        });

        it("can insert ignored element into empty parent", function () {
            util.loadXML(EMPTY_PARENT);
            assertXmlEqual(call('createXML'), EMPTY_PARENT);
        });

        it("does not insert multiple copies of ignored nodes", function () {
            util.loadXML(MUTLI_MATCH);
            assertXmlEqual(call('createXML'), MUTLI_MATCH);
        });

        it("can ignore elements in <head>", function () {
            // fixes TypeError: 'undefined' is not an object (evaluating 'element.firstElementChild')
            util.loadXML(IGNORE_IN_HEAD);
            assertXmlEqual(call('createXML'), IGNORE_IN_HEAD);
        });

        it("handles multiple ignore nodes in a row", function () {
            testXmlPair(MULTIPLE_IGNORES, MULTIPLE_IGNORES);
        });

        it("handles an ignore node's reference node being renamed", function () {
            util.loadXML(UNRENAMED);
            call('getMugByPath', '/data/question9').p.nodeID = 'question9a';
            assertXmlEqual(RENAMED, call('createXML'));
        });

        it("handles a node being renamed that's referenced in an ignore node's XML", function () {
            util.loadXML(REFERENCED_UNRENAMED);
            call('getMugByPath', '/data/question1').p.nodeID = 'foobar';
            assertXmlEqual(REFERENCED_RENAMED, call('createXML'));
        });

        it("keeps relative position on delete sibling of ignored element", function () {
            util.loadXML(DELETE_BUG_BEFORE);
            util.deleteQuestion("delete-me");
            assertXmlEqual(call('createXML'), DELETE_BUG_AFTER);
        });
    });
});
