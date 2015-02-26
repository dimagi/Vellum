/**
 * Functions for handling user-typed XML
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
     * @param value - String, jQuery object, or DOM node(s).
     * @returns - Normalized XML string safe to be embedded in an XML document.
     */
    function normalize(value) {
        if (!value) {
            return "";
        } else if (_.isString(value) && !/[<>&]/.test(value)) {
            return value; // value contains no XML tags
        }
        var xml = new XMLSerializer(),
            divwrap = /^<div(?:\s+\w+=(["'])[^>]*\1\s*)*>([\w\W]*)<\/div>$/g,
            emptytag = /<(\w+)((?:\s+\w+=(["'])[^>]*?\3\s*)*) ?><\/\1>/g,
            node = $("<div />").append(value)[0];
        return xml.serializeToString(node)  // pure magic
            .replace(divwrap, "$2")         // remove <div> wrapper
            .replace(emptytag, "<$1$2 />")  // <tag></tag> to <tag />
            .replace(/&nbsp;|\xa0/g, " ");  // &nbsp; is not a valid XML entity
    }

    return {
        normalize: normalize,
    };
});
