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
        $vellum;
    
    function xmlEqual(str1, str2) {
        var xml1 = EquivalentXml.xml(str1),
            xml2 = EquivalentXml.xml(str2);
        return EquivalentXml.isEquivalent(xml1, xml2, {element_order: true});
    }

    function formatXml(str) {
        // doesn't work?
        return new XMLSerializer().serializeToString($.parseXML(str));
    }


    return {
        before: function (opts, done) {
            opts = opts || {};
            vellum_options = $.extend(true, {}, options.options, opts);
            // $.extend merges arrays :(
            if (opts.javaRosa && opts.javaRosa.langs) {
                vellum_options.javaRosa.langs = opts.javaRosa.langs;
            }
            $vellum = $("#vellum").empty().vellum(vellum_options);
            setTimeout(done, 1000);
        },
        // call a method on the active instance
        call: function () {
            var args = Array.prototype.slice.call(arguments);
            return $vellum.vellum.apply($vellum, args);
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
        clickQuestion: function(displayName) {
            // todo: change to use explicit .text() filtering, not :contains()
            var $q = $("li[rel] > a:contains('" + displayName + "')");
           
            if ($q.length !== 1) {
                throw Error("Couldn't find question '" + displayName + "'");
            
            }
            $q.click();
        }
    };
});
