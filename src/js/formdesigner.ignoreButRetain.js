/*
 * "Ignore but Retain" plugin.
 *
 * This plugin allows you to mark any node in an XForm's XML with
 * 'ignore="true"'.
 *
 * Marked nodes will be removed from the XML before it's processed by Vellum,
 * and reinserted when Vellum writes out XML.  Crucially, marked nodes are
 * reinserted in the same position relative to the node that they originally
 * followed, as identified by that node's attribute which includes a question
 * ID.
 *
 * Question ID changes are handled.
 *
 * If a reference node for an ignore node is deleted by the user, then that node
 * will be lost.
 *
 * Spec:
 * https://docs.google.com/document/d/12see6m3Lr6nVVgjfstS3oS6Vc1UT7l4bqYNRtDB-GXQ/
 */
formdesigner.plugins = formdesigner.plugins || {};

formdesigner.plugins.ignoreButRetain = function () {
    // initial state must be initialized outside of beforeParse to handle new
    // form case
    var ignoredNodes = [],
        xmls = new XMLSerializer();

    this.beforeParse = function (xml) {
        ignoredNodes = [];

        var ignoredEls = [];

        xml.find('[vellum\\:ignore="retain"]').each(function (i, el) {
            ignoredNodes.push(getPathAndPosition(el));
            ignoredEls.push(el);
        });

        // do this last in case one ignore node follows another; it can still
        // use the first one as its reference
        _.each(ignoredEls, function (el) {
            el.parentElement.removeChild(el);
        });
    
        return xml;
    };


    this.afterSerialize = function (xmlStr) {
        if (!ignoredNodes.length) {
            return xmlStr;
        }

        var xml = $($.parseXML(xmlStr));

        _.each(ignoredNodes, function (node) {
            if (node.path === "h\\:html > h\\:body") {
                // Something weird happens involving body since it's an HTML
                // tag, apparently.  But only when it's the terminal node in a
                // selector. Also behaves differently in FF and Chrome.
                node.path = "h\\:html > body, h\\:html > h\\:body";
            }

            var parentNode = xml.find(node.path),
                appendNode = $.parseXML(node.nodeXML).children[0];

            if (node.position) {
                var target = parentNode.find(node.position);
                if (target.length) {
                    target.after($(appendNode));
                } else {
                    // sibling node of ignored node got deleted, insert at
                    // beginning
                    prependChild(parentNode[0], appendNode);
                }
            } else {
                prependChild(parentNode[0], appendNode);
            }
        });

        var count = 0;
        return xmls.serializeToString(xml[0])
            // firefox adds xmlns="" to fragments when adding them to the
            // document
            .replace(/ xmlns=""/g, '')
            .replace(/ xmlns:vellum="(.+?)"/g, function (match) {
                return count++ ? '' : match;
            });
    };

    function prependChild(element, child) {
        if (element.firstElementChild) {
            $(element).prepend($(child));
        } else {
            $(element).append($(child));
        }
    }

    function getPathAndPosition(node) {
        var origNode = node,
            path = [],
            position;
        
        position = getPreviousSiblingSelector(node);
        node = node.parentElement;
        
        while (node) {   
            path.unshift(getNodeIdentifierSelector(node));
            node = node.parentElement;
        }

        var nodeXML = xmls.serializeToString(origNode)
            // XMLSerializer adds xmlns to fragments, which we don't want.  This
            // should only remove the xmlns from the root node, so if inner elements
            // have an XMLNS, it will be preserved.
                .replace(/xmlns="(.*?)"/, "");

        return {
            position: position,
            path: path.join(" > "),
            nodeXML: "\n" + nodeXML
        };
    }

    function getPreviousSiblingSelector(node) {
        if (node.previousElementSibling) {
            return getNodeIdentifierSelector(node.previousElementSibling);
        } else {
            return false;
        }
    }

    function getNodeIdentifierSelector(node) {
        var $node = $(node),
            nodeset = $node.attr('nodeset'),
            ref = $node.attr('ref'),
            tagName = $node.prop('tagName').toLowerCase();

        if (tagName == 'setvalue') {
            return '[event="' + $node.attr('event') + '"]' +
                   '[ref="' + ref + '"]';
        } else if (nodeset) {
            return '[nodeset="' + nodeset + '"]';
        } else if (ref) {
            return '[ref="' + ref + '"]';
        } else {
            // escape ':' in namespaced selector for jQuery selector usage
            return node.nodeName.replace(":", "\\:");

            // to have this be fully generic for a node with any path,
            // we would have to add an :nth-child or even better :nth-of-type
            // selector for intermediate nodes without a question ID but which
            // could be at a level with multiple nodes with the same tag name.
            // But this would have complex edge cases for when nodes at inner
            // levels were added or deleted -- being able to recognize that a
            // find failed and then retry with a different selector expression.
            //
            // For XForms and the ignored nodes that we expect to see, the
            // current implementation is sufficient.
        }
    }
    
    this.onMugRename = function (newID, oldID, newPath, oldPath) {
        var pathRegex = new RegExp(oldPath, 'g'),
            idNameRegex = new RegExp('(> )?' + oldID + '( >)?', 'g'),
            // this depends on itext ids being question ID + '-label' in order
            // for node positions referencing a node with a label ID (e.g.,
            // first label inside a group) to be correctly updated.  Not that
            // bad of an assumption.
            idRegex = new RegExp('(\'|")' + oldID + '(\-label)?(\'|")', 'g');

        var replaceIdInSelector = function (val) {
            var replaced = false;
            val = val.replace(idNameRegex, function (match) {
                if (match.indexOf(oldID) !== -1 && match.indexOf(newID) === -1)
                {
                    replaced = true;
                    return match.replace(oldID, newID);
                } else {
                    return match;
                }
            });
            val = val.replace(idRegex, function (match) {
                if (!replaced && match.indexOf(oldID) !== -1 && 
                    match.indexOf(newID) === -1)
                {
                    return match.replace(oldID, newID);
                } else {
                    return match;
                }
            });
            return val;
        };
        _.each(ignoredNodes, function (node) {
            if (node.position) {
                node.position = replaceIdInSelector(node.position);
            }
            node.path = replaceIdInSelector(node.path);
            node.nodeXML = node.nodeXML.replace(pathRegex, newPath);
        });
    };

};
