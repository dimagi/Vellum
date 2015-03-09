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
            value = inner ? $(value) : $("<div />").append(fixGTBug(value));
        }
        var xml = new XMLSerializer(),
            wrapper = /^<([\w:.-]+)(?:\s+[\w:.-]+=(["'])[^]*?\2)*\s*(?:\/>|>([^]*)<\/\1>)$/g,
            emptytag = /<(([\w:.-]+)(?:\s+[\w:.-]+=(["'])[^]*?\3)*\s*)><\/\2>/g;
        return xml.serializeToString(value[0]) // pure magic
            .replace(wrapper, "$3")         // remove outer tag
            .replace(emptytag, "<$1 />")    // <tag></tag> to <tag />
            .replace(/&nbsp;|\xa0/g, " ");  // &nbsp; is not a valid XML entity
    }

    /**
     * Make XML string more user-friendly
     *
     * Un-escapes &, < and > when not used as tag delimiters.
     * This does approximately the opposite of `normalize` for most sane cases.
     *
     * @param value - String or jQuery object.
     * @param inner - See `normalize()` parameter with the same name.
     * @returns - XML string ready for human editing.
     */
    function humanize(value, inner) {
        if (!value) {
            return "";
        } else if (_.isString(value) && value.indexOf("&") === -1) {
            return value; // value contains no character entity references.
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
     * $("<div/>").append(value).html()
     *
     * NOTE: there are still edge cases (mainly malformed XML) that will not be
     * fixed by this. For example:
     *      <tag attr=a>b />
     */
    function fixGTBug(value) {
        var empty = /<(([\w:.-]+)(?:\s+[\w:.-]+=(["'])[^]*?\3)*\s*)\/>/g;
        return value.replace(empty, "<$1></$2>");
    }

    return {
        normalize: normalize,
        humanize: humanize
    };
});
