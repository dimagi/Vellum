define([
    './options',
    'chai',
    'equivalent-xml',
    'jsdiff',
    'underscore',
    'jquery',
    'jquery.jstree',
    'jquery.vellum'
], function (
    options,
    chai,
    EquivalentXml,
    jsdiff,
    _,
    $
) {
    var assert = chai.assert,
        savedForm = null,
        saveCount = 0;
    
    function xmlEqual(str1, str2) {
        var xml1 = EquivalentXml.xml(str1),
            xml2 = EquivalentXml.xml(str2);
        return EquivalentXml.isEquivalent(xml1, xml2, {element_order: true});
    }

    function assertXmlEqual(actual, expected, opts) {
        opts = opts || {};
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
            var patch = jsdiff.createPatch("", actual, expected, "actual", "expected");
            patch = patch.replace(/^Index:/,
                    "XML " + (opts.not ? "should not be equivalent" : "mismatch"));
            assert(false, colorDiff(patch));
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
        if (expected !== actual) {
            var patch = jsdiff.createPatch("", actual, expected, "actual", "expected");
            patch = patch.replace(/^Index:/, "Unexpected jstree state");
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
        if (opts.plugins) {
            vellum_options.plugins = opts.plugins;
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

            // clean up modal dialog artifacts
            $('.fd-dialog-confirm').dialog("destroy");
            $('body > div.ui-dialog, ' +
              'body > div.modal, ' +
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
    function loadXML(value, options) {
        var xml, data = call("getData");
        data.core.parseWarnings = [];
        xml = call("loadXML", value, options || {});
        delete data.core.parseWarnings;
        return xml;
    }

    function clickQuestion(path) {
        var node, mug = getMug(path);
        if (!(mug && mug.ufid)) {
            throw new Error("mug not found: " + path);
        }
        node = $("#" + mug.ufid + "_anchor");
        if (!node.length) {
            throw new Error("tree node not found: " + path);
        }
        $(node).click();
        return node;
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
                        children[0].p.tagName === "itemset") {
                    return children[0];
                }
                for (var i = 0; i < children.length; i++) {
                    if (children[i].p.defaultValue === nodeID) {
                        return children[i];
                    }
                }
            }
        }
        return mug;
    }

    function deleteQuestion (path) {
        call("getData").core.form.removeMugFromForm(getMug(path));
        assert(!getMug(path), "mug not removed: " + path);
    }

    function expandGroup(mug) {
        call("jstree", "open_node", mug.ufid);
    }

    function collapseGroup(mug) {
        call("jstree", "close_node", mug.ufid);
    }

    return {
        options: options,
        init: init,
        call: call,
        loadXML: loadXML,
        saveAndReload: function(callback) {
            call("loadXFormOrError", call("createXML"), callback);
        },
        getMug: getMug,
        getInput: getInput,
        assertInputCount: assertInputCount,
        assertXmlEqual: assertXmlEqual,
        assertXmlNotEqual: assertXmlNotEqual,
        assertJSTreeState: assertJSTreeState,
        xmlines: function(xml) {
            return xml.replace(/>(\s\s+)</g, ">\n$1<");
        },
        addQuestion: function (qType, nodeId, attrs) {
            attrs = attrs || {};
            if (this.prevId) {
                clickQuestion(this.prevId);
            }
            var mug = call('addQuestion', qType);
            if (nodeId) {
                assert(_.isUndefined(attrs.nodeID),
                       "unexpected attribute for " + qType + "[" + nodeId + "]");
                if (mug.p.labelItextID) {
                    mug.p.labelItextID.setDefaultValue(nodeId);
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
        clickQuestion: clickQuestion,
        deleteQuestion: deleteQuestion,
        expandGroup: expandGroup,
        collapseGroup: collapseGroup,
        isTreeNodeValid: function (mug) {
            var $node = $("#vellum").find('#' + mug.ufid + ' > a');
            return $node.children(".fd-tree-valid-alert-icon").length === 0;
        }
    };
});
