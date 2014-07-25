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
    var assert = chai.assert;
    
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

    return {
        // initialize/reset active vellum instance
        init: function (opts) {
            opts = opts || {};
            var vellum_options = $.extend(true, {}, options.options, opts);
            // $.extend merges arrays :(
            if (opts.javaRosa && opts.javaRosa.langs) {
                vellum_options.javaRosa.langs = opts.javaRosa.langs;
            }
            $("#vellum").empty().vellum(vellum_options);
        },
        // call a method on the active instance
        call: function () {
            var args = Array.prototype.slice.call(arguments),
                $vellum = $("#vellum");
            return $vellum.vellum.apply($vellum, args);
        },
        getInput: getInput,
        assertInputCount: function (name_or_inputs, num, name) {
            if (_.isString(name_or_inputs)) {
                name = " for " + (name ? name + " " : "") + name_or_inputs;
                name_or_inputs = getInput(name_or_inputs);
            } else {
                name = name ? " for " + name : "";
            }
            assert.equal(name_or_inputs.length, num, "wrong number of inputs" + name);
        },
        assertXmlEqual: function (str1, str2) {
            assert(xmlEqual(str1, str2),
                "Expected \n\n" + formatXml(str1) + 
                    "\n\n to be equivalent to \n\n" + formatXml(str2));
        },
        assertXmlNotEqual: function (str1, str2) {
            assert.isFalse(xmlEqual(str1, str2),
                "Expected \n\n" + formatXml(str1) + 
                    "\n\n not to be equivalent to \n\n" + formatXml(str2));
        },
        // might need to convert this to use a deferred, see
        // https://github.com/mwhite/Vellum/commit/423360cd520f27d5fe3b0657984d2e023bf72fb8#diff-74a635be9be46d0f8b20784f5117bb0cR9
        clickQuestion: function() {
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
    };
});
