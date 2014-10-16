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
        function repr(node) {
            var str, level = (this === window ? 0 : this.level);
            if (_.isArray(node)) {
                return _.map(node, repr, {level: level}).join("\n");
            }
            str = Array(level * 2 + 1).join(" ") + node.data.title;
            if (node.children) {
                str = str + "\n" + repr.bind({level: level + 1})(node.children);
            }
            return str;
        }
        var expected = Array.prototype.slice.call(arguments).join("\n") + "\n",
            actual = repr(call("jstree", "get_json", -1)) + "\n";
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
        $("#vellum").empty().vellum(vellum_options);
    }
        
    // call a method on the active instance
    function call () {
        var args = Array.prototype.slice.call(arguments),
            $vellum = $("#vellum");
        return $vellum.vellum.apply($vellum, args);
    }

    // load XML syncronously
    function loadXML(value) {
        var xml, data = call("getData");
        data.core.parseWarnings = [];
        xml = call("loadXML", value);
        delete data.core.parseWarnings;
        return xml;
    }

    // might need to convert this to use a deferred, see
    // https://github.com/mwhite/Vellum/commit/423360cd520f27d5fe3b0657984d2e023bf72fb8#diff-74a635be9be46d0f8b20784f5117bb0cR9
    function clickQuestion() {
        var questionDisplayNamesPath = Array.prototype.slice.call(arguments),
            $current = $(".jstree");

        // try path
        _.map(questionDisplayNamesPath, function (name) {
            $current = $current.hasClass('jstree') ? 
                $current.children('ul') : $current.next('ul');
            $current = $current.children("li[rel]")
                .children("a:contains('" + name + "')");
            $current = $(_.filter($current, function (c) {
                return $.trim($(c).text()) === name;
            }));
        });

        // if that didn't work, try global
        if (!$current.length && questionDisplayNamesPath.length === 1) {
            var name = questionDisplayNamesPath[0];
            $current = $("li[rel] > a:contains('" + name + "')");
            $current = $(_.filter($current, function (c) {
                return $.trim($(c).text()) === name;
            }));
        }

        if (!$current.length || $current.hasClass('jstree')) {
            throw Error("No question " + questionDisplayNamesPath + " found");
        } else if ($current.length > 1) {
            throw Error("Too many questions " + questionDisplayNamesPath + " found");
        }
        $($current[0]).click();
    }

    return {
        options: options,
        init: init,
        call: call,
        loadXML: loadXML,
        saveAndReload: function(callback) {
            call("loadXFormOrError", call("createXML"), callback);
        },
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
        isTreeNodeValid: function (mug) {
            var $node = $("#vellum").find('#' + mug.ufid + ' > a');
            return $node.siblings(".fd-tree-valid-alert-icon").length === 0;
        }
    };
});
