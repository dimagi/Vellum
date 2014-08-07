define([
    './options',
    'chai',
    'equivalent-xml',
    'jquery',
    'jquery.vellum'
], function (
    options,
    chai,
    EquivalentXml,
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

    function formatXml(str) {
        // doesn't work?
        return new XMLSerializer().serializeToString($.parseXML(str));
    }

    function getInput(property) {
        return $("[name='property-" + property + "']");
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
        function onSave(data) {
        }
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
        saveAndReload: function(callback) {
            call("loadXFormOrError", call("createXML"), callback);
        },
        getInput: getInput,
        assertInputCount: assertInputCount,
        assertXmlEqual: function (actual, expected, opts) {
            opts = opts || {};
            if (opts.normalize_xmlns) {
                var xmlns = $($.parseXML(expected)).find('data').attr('xmlns');
                actual = actual.replace(/(data[^>]+xmlns=")(.+?)"/,
                                        '$1' + xmlns + '"');
            }
            assert(xmlEqual(actual, expected),
                "Expected \n\n" + formatXml(actual) + 
                    "\n\n to be equivalent to \n\n" + formatXml(expected));
        },
        assertXmlNotEqual: function (str1, str2) {
            assert.isFalse(xmlEqual(str1, str2),
                "Expected \n\n" + formatXml(str1) + 
                    "\n\n not to be equivalent to \n\n" + formatXml(str2));
        },
        xmlines: function(xml) {
            return xml.replace(/>(\s\s+)</g, ">\n$1<");
        },
        addQuestion: function (qType, nodeId, attrs) {
            attrs = attrs || {};
            if (nodeId) {
                attrs.nodeID = nodeId;
            }
            if (this.prevId) {
                clickQuestion(this.prevId);
            }
            call('addQuestion', qType);
            $("[name='property-nodeID']").val(nodeId).change();
            $("[name='itext-en-label']").val(nodeId).change();
            _.each(attrs, function (val, name) {
                var input = getInput(name);
                assertInputCount(input, 1, nodeId + " " + name);
                if (input.attr('type') === 'checkbox') {
                    input.prop('checked', val).change();
                } else {
                    input.val(val).change();
                }
            });
        },
        clickQuestion: clickQuestion
    };
});
