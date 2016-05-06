/*jshint multistr: true */
define([
    'tests/options',
    'tests/utils',
    'vellum/util',
    'chai',
    'jquery',
    'underscore',
    'vellum/databrowser',
    'vellum/datasources',
    'text!static/databrowser/child-ref.xml',
    'text!static/databrowser/child-ref-no-hashtag.xml',
    'text!static/databrowser/itext.xml',
    'text!static/databrowser/mother-ref.xml',
    'text!static/databrowser/preloaded-hashtags.xml',
], function (
    options,
    util,
    vellumUtil,
    chai,
    $,
    _,
    databrowser,
    datasources,
    CHILD_REF_XML,
    CHILD_REF_NO_HASHTAG_XML,
    ITEXT_XML,
    MOTHER_REF_XML,
    PRELOADED_HASHTAGS_XML
) {
    var assert = chai.assert,
        call = util.call,
        plugins = _.union(util.options.options.plugins || [], ["databrowser"]),
        CASE_DATA = [{
            id: "commcaresession",
            uri: "jr://instance/session",
            path: "/session/data",
            name: 'Session',
            structure: {
                "case_id": {
                    reference: {
                        source: "casedb",
                        subset: "child",
                        key: "@case_id",
                    },
                },
            },
        }, {
            id: "casedb",
            uri: "jr://instance/casedb",
            path: "/cases/case",
            name: 'Cases',
            structure: {
                name: {},
            },
            subsets: [{
                id: "mother",
                key: "@case_type",
                structure: {
                    edd: {},
                },
                related: {
                    "first-child": "child",
                }
            }, {
                id: "child",
                key: "@case_type",
                structure: {
                    dob: {},
                },
                related: {
                    parent: "mother",
                },
            }],
        }];

    describe("The data browser", function () {
        var dataTree;

        function getInstanceId(form, src) {
            var meta = _.find(form.instanceMetadata, function (meta) {
                return meta.attributes.src === src;
            });
            return meta ? meta.attributes.id : null;
        }

        describe("when loaded before the form", function () {
            beforeEach(function (done) {
                util.init({
                    plugins: plugins,
                    javaRosa: {langs: ['en']},
                    core: {
                        dataSourcesEndpoint: function (callback) { callback(CASE_DATA); },
                        onReady: function () {
                            var _this = this;
                            datasources.getDataSources(function () {
                                databrowser.initDataBrowser(_this);
                                dataTree = _this.$f.find(".fd-external-sources-tree").jstree(true);
                                done();
                            });
                        }
                    }
                });
            });

            it("should add ref on drag/drop", function(done) {
                util.loadXML("");
                var mug = util.addQuestion("DataBindOnly", "mug"),
                    calc = $("[name=property-calculateAttr]"),
                    sessionUri = CASE_DATA[0].uri,
                    casedbUri = CASE_DATA[1].uri,
                    editor = calc.ckeditor().editor,
                    widget = util.getWidget('property-calculateAttr');
                widget.input.promise.then(function () { 
                    editor.on('change', function() {
                        assert.equal(mug.p.calculateAttr, "`#case/child/dob`");
                        assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
                        assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
                        util.assertXmlEqual(call("createXML"), CHILD_REF_XML,
                                            {normalize_xmlns: true});
                        done();
                    });
                    assert.equal(getInstanceId(mug.form, sessionUri), null);
                    assert.equal(getInstanceId(mug.form, casedbUri), null);
                    assert.equal(calc.length, 1);
                    util.findNode(dataTree, "dob").data.handleDrop(calc);
                });
            });

            it("should add parent ref on drag/drop", function(done) {
                util.loadXML("");
                var mug = util.addQuestion("DataBindOnly", "mug"),
                    calc = $("[name=property-calculateAttr]"),
                    sessionUri = CASE_DATA[0].uri,
                    casedbUri = CASE_DATA[1].uri,
                    editor = calc.ckeditor().editor,
                    widget = util.getWidget('property-calculateAttr');
                widget.input.promise.then(function () { 
                    editor.on('change', function() {
                        assert.equal(mug.p.calculateAttr, "`#case/mother/edd`");
                        assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
                        assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
                        util.assertXmlEqual(call("createXML"), MOTHER_REF_XML,
                                            {normalize_xmlns: true});
                        done();
                    });
                    assert.equal(getInstanceId(mug.form, sessionUri), null);
                    assert.equal(getInstanceId(mug.form, casedbUri), null);
                    assert.equal(calc.length, 1);
                    util.findNode(dataTree, "edd").data.handleDrop(calc);
                });
            });

            it("should add recursive ref on drag/drop", function(done) {
                util.loadXML("");
                var mug = util.addQuestion("DataBindOnly", "mug"),
                    calc = $("[name=property-calculateAttr]"),
                    sessionUri = CASE_DATA[0].uri,
                    casedbUri = CASE_DATA[1].uri,
                    editor = calc.ckeditor().editor,
                    widget = util.getWidget('property-calculateAttr');
                widget.input.promise.then(function () { 
                    editor.on('change', function() {
                        assert.equal(mug.p.calculateAttr, '`#case/child/dob`');
                        assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
                        assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
                        util.assertXmlEqual(call("createXML"), CHILD_REF_XML,
                                            {normalize_xmlns: true});
                        done();
                    });
                    assert.equal(getInstanceId(mug.form, sessionUri), null);
                    assert.equal(getInstanceId(mug.form, casedbUri), null);
                    assert.equal(calc.length, 1);
                    var motherNode = util.findNode(dataTree, "mother"),
                        node = util.findNode(dataTree, "child", motherNode);
                    dataTree.open_node(node);
                    util.findNode(dataTree, "dob", node).data.handleDrop(calc);
                });
            });

            it("should add instances on drag/drop of case property into itext", function(done) {
                util.loadXML("");
                var itext = $("[name=itext-en-label]"),
                    editor = itext.ckeditor().editor,
                    widget = util.getWidget('itext-en-label');

                util.addQuestion("Text", "mug");
                widget.input.promise.then(function () { 
                    editor.on('change', function() {
                        util.assertXmlEqual(call("createXML"), ITEXT_XML,
                                            {normalize_xmlns: true});
                        done();
                    });
                    util.findNode(dataTree, "dob").data.handleDrop(itext);
                });
            });

            it("should hashtagify refs when written", function() {
                // this won't write the hashtags as the logic manager won't
                // have the #case reference but it will properly hashtagify
                // once the databrowser is loaded
                util.loadXML(CHILD_REF_NO_HASHTAG_XML);
                util.assertXmlEqual(call("createXML"), CHILD_REF_XML.replace(
                    "<vellum:hashtags>{&quot;#case/child/dob&quot;:null}</vellum:hashtags>", ''
                ));
            });

            it("is not overwritten by the forms preloaded tags", function() {
                util.loadXML(PRELOADED_HASHTAGS_XML);
                var form = call('getData').core.form;
                assert(form.isValidHashtag('#case/child/dob'));
                assert.notStrictEqual(form.hashtagDictionary['#case/child/dob'], null);
            });

            it("should write externally referenced hashtags to form", function() {
                util.loadXML(PRELOADED_HASHTAGS_XML);
                util.assertXmlEqual(call("createXML"), PRELOADED_HASHTAGS_XML, {normalize_xmlns: true});
            });

            describe("when rich_text is off", function () {
                beforeEach(function (done) {
                    util.init({
                        plugins: plugins,
                        javaRosa: {langs: ['en']},
                        core: {
                            dataSourcesEndpoint: function (callback) { callback(CASE_DATA); },
                            onReady: function () {
                                var _this = this;
                                datasources.getDataSources(function () {
                                    databrowser.initDataBrowser(_this);
                                    dataTree = _this.$f.find(".fd-external-sources-tree").jstree(true);
                                    done();
                                });
                            }
                        },
                        features: { rich_text: false },
                    });
                });

                it("should add ref on drag/drop", function() {
                    util.loadXML("");
                    var mug = util.addQuestion("DataBindOnly", "mug"),
                        calc = $("[name=property-calculateAttr]"),
                        sessionUri = CASE_DATA[0].uri,
                        casedbUri = CASE_DATA[1].uri,
                        where = "@case_id = instance('commcaresession')/session/data/case_id";
                    assert.equal(getInstanceId(mug.form, sessionUri), null);
                    assert.equal(getInstanceId(mug.form, casedbUri), null);
                    assert.equal(calc.length, 1);
                    util.findNode(dataTree, "dob").data.handleDrop(calc);
                    assert.equal(mug.p.calculateAttr,
                                 "instance('casedb')/cases/case[" + where + "]/dob");
                    assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
                    assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
                });

                it("should add parent ref on drag/drop", function() {
                    util.loadXML("");
                    var mug = util.addQuestion("DataBindOnly", "mug"),
                        calc = $("[name=property-calculateAttr]"),
                        sessionUri = CASE_DATA[0].uri,
                        casedbUri = CASE_DATA[1].uri,
                        whereSession = "@case_id = instance('commcaresession')/session/data/case_id",
                        whereParent = "@case_id = instance('casedb')/cases/case[" + whereSession + "]/index/parent";
                    assert.equal(getInstanceId(mug.form, sessionUri), null);
                    assert.equal(getInstanceId(mug.form, casedbUri), null);
                    assert.equal(calc.length, 1);
                    util.findNode(dataTree, "edd").data.handleDrop(calc);
                    assert.equal(mug.p.calculateAttr, "instance('casedb')/cases/case[" + whereParent + "]/edd");
                    assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
                    assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
                });

                it("should add recursive ref on drag/drop", function() {
                    util.loadXML("");
                    var mug = util.addQuestion("DataBindOnly", "mug"),
                        calc = $("[name=property-calculateAttr]"),
                        sessionUri = CASE_DATA[0].uri,
                        casedbUri = CASE_DATA[1].uri,
                        whereSession = "@case_id = instance('commcaresession')/session/data/case_id",
                        whereParent = "@case_id = instance('casedb')/cases/case[" + whereSession + "]/index/parent",
                        whereChild = "@case_id = instance('casedb')/cases/case[" + whereParent + "]/index/first-child";
                    assert.equal(getInstanceId(mug.form, sessionUri), null);
                    assert.equal(getInstanceId(mug.form, casedbUri), null);
                    assert.equal(calc.length, 1);
                    var motherNode = util.findNode(dataTree, "mother"),
                        node = util.findNode(dataTree, "child", motherNode);
                        dataTree.open_node(node);
                        util.findNode(dataTree, "dob", node).data.handleDrop(calc);
                    assert.equal(mug.p.calculateAttr, "instance('casedb')/cases/case[" + whereChild + "]/dob");
                    assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
                    assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
                });
            });

            // TODO should remove instances when expression ref is removed
        });

        describe("when loaded after the form", function () {
            var _this, widget, blue, event = {};
            vellumUtil.eventuality(event);
            function loadDataTree(done) {
                datasources.getDataSources(function () {
                    databrowser.initDataBrowser(_this);
                    done();
                });
            }
            beforeEach(function (done) {
                util.init({
                    plugins: plugins,
                    javaRosa: {langs: ['en']},
                    core: {
                        dataSourcesEndpoint: function (callback) {
                            event.on("nodeError", function() {
                                callback(CASE_DATA);
                            });
                        },
                        form: "",
                        onReady: function () {
                            _this = this;
                            blue = util.addQuestion("DataBindOnly", "blue");
                            widget = util.getWidget('property-calculateAttr');
                            widget.input.promise.then(done);
                        }
                    }
                });
            });

            it("should error for unknown properties", function(done) {
                widget.setValue("`#case/child/dob`");
                assert(!util.isTreeNodeValid(blue), "expected validation error");
                event.fire("nodeError");
                loadDataTree(function() {
                    assert(util.isTreeNodeValid(blue), blue.getErrors().join("\n"));
                    done();
                });
            });

            it("overwrites the forms preloaded tags", function() {
                util.loadXML(PRELOADED_HASHTAGS_XML);
                var form = call('getData').core.form;
                assert(form.isValidHashtag('#case/child/dob'));
                assert.strictEqual(form.hashtagDictionary['#case/child/dob'], null);
                event.fire("nodeError");
                assert(form.isValidHashtag('#case/child/dob'));
                assert.notStrictEqual(form.hashtagDictionary['#case/child/dob'], null);
            });
        });
    });
});
