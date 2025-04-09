/*jshint multistr: true */
define([
    'tests/utils',
    'chai',
    'jquery',
    'static/ignoreButRetain/case-with-update.xml',
    'static/ignoreButRetain/common.xml',
    'static/ignoreButRetain/common-ignored.xml',
    'static/ignoreButRetain/delete-bug-after.xml',
    'static/ignoreButRetain/delete-bug-before.xml',
    'static/ignoreButRetain/empty-parent.xml',
    'static/ignoreButRetain/ignore-in-head.xml',
    'static/ignoreButRetain/ignored-binds-with-extra-path.xml',
    'static/ignoreButRetain/ignored-control-node.xml',
    'static/ignoreButRetain/ignored-data-node.xml',
    'static/ignoreButRetain/ignored-tag-first.xml',
    'static/ignoreButRetain/multiple-ignores.xml',
    'static/ignoreButRetain/multi-match.xml',
    'static/ignoreButRetain/nested-ignored-nodes.xml',
    'static/ignoreButRetain/referenced-renamed.xml',
    'static/ignoreButRetain/referenced-unrenamed.xml',
    'static/ignoreButRetain/renamed.xml',
    'static/ignoreButRetain/unknown-element.xml',
    'static/ignoreButRetain/unrenamed.xml'
], function (
    util,
    chai,
    $,
    CASE_WITH_UPDATE,
    COMMON,
    COMMON_IGNORED,
    DELETE_BUG_AFTER,
    DELETE_BUG_BEFORE,
    EMPTY_PARENT,
    IGNORE_IN_HEAD,
    IGNORED_BINDS_WITH_EXTRA_PATH,
    IGNORED_CONTROL_NODE,
    IGNORED_DATA_NODE,
    IGNORED_TAG_FIRST,
    MULTIPLE_IGNORES,
    MUTLI_MATCH,
    NESTED_IGNORED_NODES,
    REFERENCED_RENAMED,
    REFERENCED_UNRENAMED,
    RENAMED,
    UNKNOWN_ELEMENT,
    UNRENAMED
) {
    var assertXmlEqual = util.assertXmlEqual,
        call = util.call;

    describe("The Ignore-But-Retain plugin", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: function () { done(); }},
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

        it("preserves position when first tag in <HEAD> is ignored", function () {
            util.loadXML(IGNORED_TAG_FIRST);
            assertXmlEqual(call('createXML'), IGNORED_TAG_FIRST);
        });

        it("handles multiple ignore nodes in a row", function () {
            testXmlPair(MULTIPLE_IGNORES, MULTIPLE_IGNORES);
        });

        it("handles an ignore node's reference node being renamed", function () {
            util.loadXML(UNRENAMED);
            call('getMugByPath', '/data/question9').p.nodeID = 'question9a';
            assertXmlEqual(call('createXML'), RENAMED);
        });

        it("handles a node being renamed that's referenced in an ignore node's XML", function () {
            util.loadXML(REFERENCED_UNRENAMED);
            call('getMugByPath', '/data/question1').p.nodeID = 'foobar';
            assertXmlEqual(call('createXML'), REFERENCED_RENAMED);
        });

        it("keeps relative position on delete sibling of ignored element", function () {
            util.loadXML(DELETE_BUG_BEFORE);
            util.deleteQuestion("delete-me");
            assertXmlEqual(call('createXML'), DELETE_BUG_AFTER);
        });

        it("should not duplicate nested ignored nodes", function () {
            util.loadXML(NESTED_IGNORED_NODES);
            assertXmlEqual(call('createXML'), NESTED_IGNORED_NODES);
        });

        it("should preserve data node children", function () {
            util.loadXML(CASE_WITH_UPDATE);
            assertXmlEqual(call('createXML'), CASE_WITH_UPDATE);
        });

        it("should ignore binds and controls associated with ignored data node", function () {
            util.loadXML(IGNORED_DATA_NODE);
            util.assertJSTreeState("question");
            assertXmlEqual(call('createXML'), IGNORED_DATA_NODE);
        });

        it("should ignore bind nodes with extra path elements", function () {
            util.loadXML(IGNORED_BINDS_WITH_EXTRA_PATH);
            util.assertJSTreeState(
                "question",
                "question2"
            );
            assertXmlEqual(call('createXML'), IGNORED_BINDS_WITH_EXTRA_PATH);
        });

        it("should ignore control node", function () {
            util.loadXML(IGNORED_CONTROL_NODE);
            util.assertJSTreeState(
                "question",
                "ignored--1"
            );
            assertXmlEqual(call('createXML'), IGNORED_CONTROL_NODE);
        });

        it("should load form with unknown/un-ignored element", function () {
            util.loadXML(UNKNOWN_ELEMENT);
            assertXmlEqual(call('createXML'), UNKNOWN_ELEMENT);
        });
    });
});
