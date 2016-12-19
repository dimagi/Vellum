define([
    './options',
    'chai',
    'equivalent-xml',
    'jsdiff',
    'underscore',
    'jquery',
    'vellum/copy-paste',
    'vellum/tsv',
    'vellum/widgets',
    'jquery.jstree',
    'jquery.vellum'
], function (
    options,
    chai,
    EquivalentXml,
    jsdiff,
    _,
    $,
    copypaste,
    tsv,
    widgets
) {
    var assert = chai.assert,
        savedForm = null,
        saveCount = 0,
        PASTE_HEADER = ["Form Builder clip", "version 1"];

    // monkey-patch chai to use ===/!== instead of ==/!= in assert.equal
    assert.equal = assert.strictEqual;
    assert.notEqual = assert.notStrictEqual;

    function xmlEqual(str1, str2) {
        var xml1 = EquivalentXml.xml(str1),
            xml2 = EquivalentXml.xml(str2);
        return EquivalentXml.isEquivalent(xml1, xml2, {element_order: true});
    }

    function assertXmlEqual(actual, expected, opts) {
        opts = _.defaults(opts || {}, {
            normalize_xmlns: false,
            not: false,
        });
        if (opts.normalize_xmlns) {
            var xmlns = $($.parseXML(expected)).find('data').attr('xmlns');
            actual = actual.replace(/(data[^>]+xmlns=")(.+?)"/,
                                    '$1' + xmlns + '"');
        }
        var result = xmlEqual(actual, expected);
        if (opts.not) {
            result = !result;
        }
        if (!result) {
            actual = cleanForDiff(actual);
            expected = cleanForDiff(expected);
            assertEqual(actual, expected,
                "XML " + (opts.not ? "should not be equivalent" : "mismatch"));
        }
    }

    function assertXmlNotEqual(actual, expected, opts) {
        opts = opts || {};
        opts.not = true;
        assertXmlEqual(actual, expected, opts);
    }

    function assertJSTreeState() {
        function repr(node, level) {
            var i, len, child, items = [];
            if (node.id === "#") {
                level = -1;
            } else {
                items.push(Array(level * 2 + 1).join(" ") + node.text);
            }
            for (i = 0, len = node.children.length; i < len; i++) {
                child = call("jstree", "get_node", node.children[i]);
                items.push(repr(child, level + 1));
            }
            return items.join("\n");
        }
        var expected = Array.prototype.slice.call(arguments).join("\n") + "\n",
            actual = repr(call("jstree", "get_node", "#")) + "\n";
        assertEqual(actual, expected, "Unexpected jstree state");
    }

    function assertTreeState(tree) {
        function repr(node, level) {
            var i, len, child, items = [];
            if (node.isRootNode) {
                level = -1;
            } else {
                items.push(Array(level * 2 + 1).join(" ") + node.value.p.nodeID);
            }
            for (i = 0, len = node.children.length; i < len; i++) {
                child = node.children[i];
                items.push(repr(child, level + 1));
            }
            return items.join("\n");
        }
        var expected = Array.prototype.slice.call(arguments, 1).join("\n") + "\n",
            actual = repr(tree.rootNode, 0) + "\n";
        assertEqual(actual, expected, "Unexpected tree state");
    }

    /**
     * Assert equality, diff actual/expected if unequal
     */
    function assertEqual(actual, expected, message) {
        if (actual !== expected) {
            var patch = jsdiff.createPatch("", actual, expected, "actual", "expected");
            patch = patch.replace(/^Index:/, message || "Not equal:");
            assert(false, colorDiff(patch));
        }
    }

    function cleanForDiff(value) {
        // convert leading tabs to spaces
        value = value.replace(/^\t+/mg, function (match) {
            return match.replace(/\t/g, "  ");
        });
        // add newline at end of file if missing
        if (!value.match(/\n$/)) {
            value = value + "\n";
        }
        return value;
    }

    function colorDiff(patch) {
        if (!window.mochaPhantomJS) {
            // patch colors not supported in browser yet
            return patch;
        }
        var colors = {
                "-": 31, // red
                "+": 32  // green
            };
        function color(str) {
            var code = colors[str[0]] || 0;
            return '\u001b[' + code + 'm' + str + '\u001b[0m';
        }
        return patch.replace(/^.+?$/gm, color);
    }

    function getInput(property) {
        return call("getCurrentMugInput", property);
    }

    function getWidget(name) {
        var vellum = $("#vellum").vellum("get"),
            target = _.isString(name) ? $("[name=" + name + "]") : name;
        return widgets.util.getWidget(target, vellum);
    }

    function getMediaUploader($el) {
        var media = {},
            widget = getWidget($el),
            $uiElem;
        if (!widget) {
            throw new Error("media uploader widget not found");
        }
        _.find([
            ".widget[data-hqmediapath]",
            ".itext-block-container",
        ], function (sel) {
            $uiElem = $el.closest(sel);
            return $uiElem.length;
        });
        if (!$uiElem) {
            throw new Error("media uploader element not found");
        }

        /**
         * Simulate media upload
         *
         * The filename passed in here is used to set the extension on
         * the media path. The new randomized media path obtained here
         * by calling `widget.getRandomizedMediaPath(filename)` is
         * constructed in two steps in the real media uploader:
         *
         * - uploader.js overrides the upload controller's `startUpload`
         *   method to call `widget.getRandomizedMediaPath(path)` and
         *   assign a new media path to the upload controller's
         *   `uploadParams` object. This new media path has the same
         *   file type extension (e.g., .jpg) as the old media path.
         * - `BaseHQMediaUploadController.startUpload()` replaces the
         *   old file extension with the one from the uploaded file and
         *   then POSTs it to the upload URL. A `ref` object containing
         *   the new media path is received in the upload response and
         *   broadcasted in the "mediaUploadComplete" event data.
         */
        media.upload = function (filename) {
            var path = widget.getRandomizedMediaPath(filename),
                data = {ref: {path: path}, errors: []};
            $uiElem.trigger("mediaUploadComplete", data);
        };

        return media;
    }

    function assertInputCount(nameOrInputs, num, name) {
        if (_.isString(nameOrInputs)) {
            name = " for " + (name ? name + " " : "") + nameOrInputs;
            nameOrInputs = getInput(nameOrInputs);
        } else {
            name = name ? " for " + name : "";
        }
        assert.equal(nameOrInputs.length, num, "wrong number of inputs" + name);
    }

    // initialize/reset active vellum instance
    function init(opts) {
        opts = opts || {};
        var vellum_options = $.extend(true, {}, options.options, opts);
        // $.extend merges arrays :(
        if (opts.javaRosa && opts.javaRosa.langs) {
            vellum_options.javaRosa.langs = opts.javaRosa.langs;
        }
        vellum_options.plugins = _.without(vellum_options.plugins, "atwho");
        if (opts.plugins) {
            vellum_options.plugins = opts.plugins;
        }
        if (vellum_options && vellum_options.features &&
            _.isUndefined(vellum_options.features.disable_popovers)) {
            vellum_options.features.disable_popovers = true;
        }
        vellum_options.core = vellum_options.core || {};
        var originalSaveUrl = vellum_options.core.saveUrl || function () {};
        vellum_options.core.saveUrl = function (data) {
            savedForm = data.xform;
            saveCount++;
            originalSaveUrl(data);
        };
        var vellum = $("#vellum"),
            old = vellum.vellum("get");
        if (old) {
            old.destroy();

            $('body > div.modal, ' +
              'body > div.modal-backdrop').remove();
        }
        vellum.empty().vellum(vellum_options);
    }
        
    // call a method on the active instance
    function call () {
        var args = Array.prototype.slice.call(arguments),
            $vellum = $("#vellum");
        return $vellum.vellum.apply($vellum, args);
    }

    // load XML syncronously
    function loadXML(value, options, ignoreParseWarnings) {
        var warnings = [], data = call("getData");
        data.core.parseWarnings = [];
        call("loadXML", value, options || {});
        if (!ignoreParseWarnings) {
            warnings = data.core.parseWarnings;
        } else if (_.isRegExp(ignoreParseWarnings)) {
            warnings = _.filter(data.core.parseWarnings, function (warning) {
                return !ignoreParseWarnings.test(warning);
            });
        }
        assert(!warnings.length, "unexpected parse warnings:\n- " + warnings.join("\n- "));
        delete data.core.parseWarnings;
        return data.core.form; // return the Form object
    }

    function paste(rows, errors, print) {
        if (!_.isString(rows)) {
            rows = tsv.tabDelimit([PASTE_HEADER].concat(rows));
        }
        if (print) { window.console.log(rows); } // debugging helper
        assert.deepEqual(copypaste.paste(rows), errors || []);
    }

    function clickQuestion() {
        var mugs = [],
            ufids = _.map(arguments, function (path) {
                var mug = getMug(path);
                if (!(mug && mug.ufid)) {
                    throw new Error("mug not found: " + path);
                }
                mugs.push(mug);
                return mug.ufid;
            });
        call("jstree", "deselect_all", true);
        call("jstree", "select_node", ufids);

        // Make all question properties visible
        $(".collapse-toggle.collapsed").click();

        return mugs;
    }

    function selectAll() {
        call("jstree", "select_all");
    }

    /**
     * Get a mug by path (even items!) from the active form
     *
     * @param path - The path of the item. If this is not an absolute path then
     *               '/data/' will be prepended.
     * @returns null if a mug with the given path is not found.
     */
    function getMug(path) {
        if (path.indexOf("/") !== 0) {
            path = "/data/" + path;
        }
        var mug = call("getMugByPath", path);
        if (!mug) {
            // look for item if the parent mug is a select
            // not sure why getMugByPath doesn't do this... should it?
            var elements = path.split("/"),
                parentPath = elements.slice(0, -1).join("/"),
                parent = call("getMugByPath", parentPath);
            if (parent && parent.__className.indexOf("Select") > -1) {
                var children = call("getData").core.form.getChildren(parent),
                    nodeID = elements[elements.length - 1];
                if (children.length === 1 && nodeID === "itemset" &&
                        children[0].options.tagName === "itemset") {
                    return children[0];
                }
                for (var i = 0; i < children.length; i++) {
                    if (children[i].p.nodeID === nodeID) {
                        return children[i];
                    }
                }
            }
        }
        return mug;
    }

    function deleteQuestion () {
        var mugs = _.map(arguments, function (path) {
                var mug = getMug(path);
                assert(mug, "mug not found: " + path);
                return mug;
            });
        call("getData").core.form.removeMugsFromForm(mugs);
        _.each(arguments, function (path) {
            assert(!getMug(path), "mug not removed: " + path);
        });
    }

    /**
     * Query or set save button enabled state
     *
     * @param value - (opitonal) set enabled/disabled (true/false).
     * @returns - true if the save button is enabled, otherwise false.
     */
    function saveButtonEnabled(value) {
        var button = call("getData").core.saveButton;
        if (!_.isUndefined(value)) {
            var state = value ? "save" : "saved";
            button.setStateWhenReady(state);
            assert.equal(button.state, state, "sanity check failed");
        }
        return button.state === "save";
    }

    function expandGroup(mug) {
        call("jstree", "open_node", mug.ufid);
        call("jstree", "redraw_node", mug.ufid, true, false, false);
    }

    function collapseGroup(mug) {
        call("jstree", "close_node", mug.ufid);
        call("jstree", "redraw_node", mug.ufid, true, false, false);
    }

    function getMessages(mug) {
        var messages = [],
            last = null;
        if (_.isString(mug)) {
            var path = mug;
            mug = getMug(path);
            assert(mug, "mug not found: " + path);
        }
        mug.messages.each(function (msg, attr) {
            if (attr !== last) {
                messages.push(attr + ":");
                last = attr;
            }
            messages.push("  - " + msg.message); // + " [" + msg.key + "]");
        });
        return messages.join("\n");
    }

    function findNode(tree, predicate, node) {
        if (_.isString(predicate)) {
            var text = predicate;
            predicate = function (node) {
                return node.text === text;
            };
        }
        function find(node) {
            var i, len, result;
            if (predicate(node)) {
                return node;
            }
            for (i = 0, len = node.children.length; i < len; i++) {
                result = find(tree.get_node(node.children[i]));
                if (result) {
                    return result;
                }
            }
            return null;
        }
        return find(node || tree.get_node("#"));
    }

    /**
     * Report full stack trace on async callback error
     *
     * Wrap async callback functions with this function to report the
     * full stack trace if they fail. It is recommended to only use this
     * temporarily while debugging a test that is throwing a hard-to-
     * trace error. It destroys pretty assertion diff output. Also,
     * assertion errors thrown from within an async callback do include
     * full stack trace information.
     *
     * Fixes the problem described in
     * https://github.com/mochajs/mocha/issues/815
     *
     * Usage:
     *
     *  it("will always fail", function (done) {
     *      someAsyncFunction(asyncatch(function (arg) {
     *          doSomethingThatThrowsAnError();
     *          done();
     *      }));
     *  });
     */
    function asyncatch(fn) {
        return function () {
            try {
                var args = Array.prototype.slice.call(arguments);
                return fn.apply(this, args);
            } catch (err) {
                throw err && err.stack ? new Error(err.stack) : err;
            }
        };
    }

    function markdownVisible() {
        return $('.itext-block-label-group-default')
            .find('.markdown-output')
            .is(':visible');
    }

    return {
        options: options,
        asyncatch: asyncatch,
        init: init,
        call: call,
        loadXML: loadXML,
        saveAndReload: function(callback) {
            call("loadXFormOrError", call("createXML"), callback);
        },
        getMug: getMug,
        getInput: getInput,
        getWidget: getWidget,
        getMediaUploader: getMediaUploader,
        assertEqual: assertEqual,
        assertInputCount: assertInputCount,
        assertXmlEqual: assertXmlEqual,
        assertXmlNotEqual: assertXmlNotEqual,
        assertJSTreeState: assertJSTreeState,
        assertTreeState: assertTreeState,
        addQuestion: function (qType, nodeId, attrs) {
            attrs = attrs || {};
            if (this.prevId) {
                clickQuestion(this.prevId);
            }
            var mug = call('addQuestion', qType);
            if (nodeId) {
                assert(_.isUndefined(attrs.nodeID),
                       "unexpected attribute for " + qType + "[" + nodeId + "]");
                if (mug.p.labelItext) {
                    mug.p.labelItext.set(mug.getDefaultLabelValue());
                }
                // HACK set nodeID after label itext so tree node gets renamed
                mug.p.nodeID = nodeId;
            }
            _.each(attrs, function (val, name) {
                if (!_.isBoolean(val)) {
                    val = String(val);
                }
                mug.p[name] = val;
            });
            return mug;
        },
        paste: paste,
        clickQuestion: clickQuestion,
        selectAll: selectAll,
        deleteQuestion: deleteQuestion,
        saveButtonEnabled: saveButtonEnabled,
        expandGroup: expandGroup,
        collapseGroup: collapseGroup,
        getMessages: getMessages,
        findNode: findNode,
        isTreeNodeValid: function (mug) {
            if (_.isString(mug)) {
                var path = mug;
                mug = getMug(path);
                assert(mug, "mug not found: " + path);
            }
            var $node = $("#vellum").find('#' + mug.ufid + ' > a');
            return $node.children(".fd-tree-valid-alert-icon").length === 0;
        },
        markdownVisible: markdownVisible,
    };
});
