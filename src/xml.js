/**
 * Functions for handling user-entered XML
 */
define([
    'jquery',
    'underscore'
], function (
    $,
    _
) {
    /**
     * Parse XML string and return a document node
     */
    function parseXML(xmlStr) {
        // HACK convince jQuery Sizzle that this is XML, not HTML
        xmlStr = xmlStr
            .replace(/<(h:)?html\b/, "<h:xdoc")
            .replace(/<\/(h:)?html\b>/, "</h:xdoc>");
        return $.parseXML(xmlStr);
    }

    /**
     * DOM-ify and wrap XML fragment (string) with jQuery
     *
     * Use jQuery in XML mode when possible. Fall back to HTML mode when
     * fragment is not valid XML.
     *
     * Use this to convert XML string to jQuery/DOM, manipulate, then
     * convert back to XML string.
     */
    function query(fragment) {
        var xopen = '<xml xmlns="http://www.w3.org/1999/xhtml"' +
                    ' xmlns:vellum="http://commcarehq.org/xforms/vellum">',
            doc = xopen + fragment + "</xml>",
            xquery;
        try {
            xquery = $($.parseXML(doc));
        } catch (e) {
            // fall back to HTML, which deals with all kinds of malformed stuff
            xquery = $("<xml></xml>").html(fragment);
        }
        xquery.toString = function () {
            var xml = new XMLSerializer(),
                emptytag = /(<([\w:.-]+)(?:\s[^>]*|))><\/\2>/g;
            return xml.serializeToString(xquery[0])
                .replace(/^<xml\b[^>]*>/, "")   // remove <xml ...>
                .replace(/<\/xml>$/, "")        // remove </xml>
                .replace(emptytag, "$1 />")     // <tag></tag> to <tag />
                .replace(/"\/>/g, '" />')       // space before />
                .replace(/&nbsp;|\xa0/g, " ");  // &nbsp; is not a valid XML entity
        };
        return xquery;
    }

    /**
     * Convert XML string to HTML dom nodes to be manipulated with jQuery
     */
    function xhtml(xmlString) {
        return $("<div>").html(fixEmptyTags(xmlString || ""));
    }

    /**
     * Normalize XML string
     *
     * Escapes < and > not used as tag delimiters as well as unescaped &.
     * The trick here is to use the browser to construct DOM nodes from
     * possibly sloppy hand-coded XML (modern browsers are very good at this),
     * and then use the XML serializer to produce valid XML.
     * This is lossy for some inputs. Example: '<output value="/path"' -> ''
     *
     * @param value - String or jQuery object.
     * @param inner - Optional, remove outer tag if true. The default is false.
     *                Ignored/always true for jQuery object.
     * @returns - Normalized XML string safe to be embedded in an XML document.
     */
    function normalize(value, inner) {
        if (!value) {
            return "";
        } else if (_.isString(value)) {
            if (!/[<>&]/.test(value)) {
                return value; // value contains no XML tags
            }
            value = fixGTBug(fixEmptyTags(value));
            value = inner ? $(value) : $("<div />").append(value);
        }
        var xml = new XMLSerializer(),
            xmlns = / xmlns:vellum="http:\/\/commcarehq.org\/xforms\/vellum"([ \/>])/g,
            wrapper = /^<([\w:.-]+)(?:\s+[\w:.-]+=(["'])[^]*?\2)*\s*(?:\/>|>([^]*)<\/\1>)$/g,
            // emptytag does not match <tag attr="a > b"></tag>
            emptytag = /(<([\w:.-]+)(?:\s[^>]*|))><\/\2>/g;
        return xml.serializeToString(value[0]) // pure magic
            .replace(wrapper, "$3")         // remove outer tag
            .replace(emptytag, "$1 />")     // <tag></tag> to <tag />
            .replace(/&nbsp;|\xa0/g, " ")   // &nbsp; is not a valid XML entity
            // HACK xmlns could match and remove text that is not XML (unlikely)
            .replace(xmlns, "$1");          // remove vellum namespace
    }

    /**
     * Make XML string more user-friendly
     *
     * Un-escapes &, < and > when not used as tag delimiters and convert
     * <tag attr="value"></tag> to <tag attr="value" />.
     * This does approximately the opposite of `normalize` for most sane cases.
     *
     * @param value - String or jQuery object.
     * @param inner - See `normalize()` parameter with the same name.
     * @returns - XML string ready for human editing.
     */
    function humanize(value, inner) {
        // emptytag does not match <tag attr="a > b"></tag>
        var emptytag = /<([\w:.-]+)(?:\s[^>]*|)><\/\1>/;
        if (!value) {
            return "";
        } else if (_.isString(value) && value.indexOf("&") === -1 && !emptytag.test(value)) {
            return value; // value contains no character entity references or empty tags.
        }
        var xml = normalize(value, inner),
            refs = /(?:&lt;(=?\s)|(\s)&gt;|&amp;(\s))/g;
        return xml.replace(refs, function (match, lt, gt, amp) {
            return lt ? ("<" + lt) : (gt ? (gt + ">") : ("&" + amp));
        });
    }

    /**
     * Work around XML escaping bug in browser
     *
     * Buggy conversion:
     * '<tag attr="a > b" />tail' => '<tag attr="a > b">tail</tag>'
     *
     * Empty tags that do not end with /> do not have this problem:
     * '<tag attr="a > b"></tag>tail' => '<tag attr="a > b"></tag>tail'
     *
     * For the examples above, assume => is a funciton that does
     * xml.query(value).toString()
     *
     * NOTE: there are still edge cases (mainly malformed XML) that will not be
     * fixed by this. For example:
     *      <tag attr=a<b />
     *
     * Will mangle some (probably invalid) attribute values:
     * '<tag attr="../>.." />' => '<tag attr="..></attr>.." />'
     */
    function fixGTBug(value) {
        var empty = /<(([\w:.-]+)(?:\s[^<]*?|))\/>/g;
        return value.replace(empty, "<$1></$2>");
    }

    /**
     * Convert self-closing tag to empty tag
     *
     * HTML5 interprets self-closing tags as unclosed tags.
     *
     * Replace <tag.../> with <tag...></tag>
     */
    function fixEmptyTags(xmlString) {
        return xmlString.replace(/<(([\w:.-]+)(?:\s[^>]*|))\/>/g, "<$1></$2>");
    }

    return {
        humanize: humanize,
        normalize: normalize,
        parseXML: parseXML,
        query: query,
        xhtml: xhtml,
    };
});
