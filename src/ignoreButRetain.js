/*
 * "Ignore but Retain" plugin.
 *
 * This plugin allows you to mark any node in an XForm's XML with
 * 'vellum:ignore="retain"'.
 *
 * Marked nodes (with the exception of data, bind, and control nodes) will be
 * removed from the XML before it's processed by Vellum, and reinserted when
 * Vellum writes out XML. Data, bind, and control nodes are consumed by a
 * special `Ignored` mug type and inserted into the question tree like other
 * mugs. Ignored nodes are reinserted as close as possible to their original
 * position relative to the nodes that were around them when the form was
 * originally parsed.
 *
 * Most question ID and path changes are handled.
 *
 * Spec:
 * https://docs.google.com/document/d/12see6m3Lr6nVVgjfstS3oS6Vc1UT7l4bqYNRtDB-GXQ/
 */
define([
    'underscore',
    'jquery',
    'vellum/xml',
    'vellum/parser',
    'vellum/core'
], function (
    _,
    $,
    xml,
    parser
) {
    var xmls = new XMLSerializer(),
        parseXML = xml.parseXML,
        MUG = "mug",
        PARENT = "parent";

    $.vellum.plugin("ignore", {}, {
        loadXML: function (xmlStr, options) {
            this.data.ignore.ignoredNodes = [];
            if (!xmlStr) {
                this.__callOld();
                return;
            }
            var _this = this,
                ignoredEls = [],
                xmlDoc = parseXML(xmlStr),
                xml = $(xmlDoc),
                ignores = xml.find('[vellum\\:ignore="retain"]');

            this.data.ignore.active = ignores.length;
            if (!this.data.ignore.active) {
                // skip serialize
                this.__callOld();
                return;
            }

            options.enableInstanceRefCounting = false;
            this.data.ignore.ignoredMugs = [];

            var model = xml.find('h\\:xdoc > h\\:head > model').first(),
                instance = model.find('instance').first(),
                body = xml.find('h\\:xdoc > h\\:body, h\\:xdoc > body').first();
            _.each([model, instance, body], function (el) {
                if (!el.length) {
                    window.console.log("WARNING", el.tagName, "not found");
                }
            });
            ignores = ignores.not(function (i, el) {
                var isDataOrControl = _.any($(el).parents(), function (parent) {
                        return instance.is(parent) || body.is(parent) ||
                            _.any(ignores, function (ignored) {
                                // exclude nested nodes ... O(n^2)
                                return $(ignored).is(parent);
                            });
                    });
                if (!isDataOrControl && el.nodeName === "bind") {
                    return $(el).parent().is(model);
                }
                return isDataOrControl;
            });
            ignores.each(function (i, el) {
                _this.data.ignore.ignoredNodes.push(getPathAndPosition(el));
                ignoredEls.push(el);
            });

            // do this last in case one ignore node follows another; it can still
            // use the first one as its reference
            _.each(ignoredEls, function (el) {
                el.parentElement.removeChild(el);
            });
           
            this.__callOld(xmls.serializeToString(xml[0]), options);
        },
        createXML: function () {
            var xmlStr = this.__callOld(),
                ignoredNodes = this.data.ignore.ignoredNodes;
            if (!this.data.ignore.active) {
                return xmlStr;
            }

            var xml = $(parseXML(xmlStr));

            _.each(ignoredNodes, function (node) {
                if (node.path === "h\\:xdoc > h\\:body") {
                    // Something weird happens involving body since it's an HTML
                    // tag, apparently.  But only when it's the terminal node in a
                    // selector. Also behaves differently in FF and Chrome.
                    node.path = "h\\:xdoc > body, h\\:xdoc > h\\:body";
                } else if (node.path === "h\\:xdoc > h\\:head") {
                    // same as above?
                    node.path = "h\\:xdoc > head, h\\:xdoc > h\\:head";
                }

                var parentNode = xml.find(node.path),
                    ignored = $(parseXML(node.nodeXML).childNodes[0]),
                    prev = node.prev && parentNode.find(node.prev),
                    next = node.next && parentNode.find(node.next);

                if (prev && prev.length) {
                    prev.first().after(ignored);
                } else if (next && next.length) {
                    next.first().before(ignored);
                } else {
                    // sibling was deleted, insert at end
                    parentNode.append(ignored);
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
        },
        getMugTypes: function () {
            var types = this.__callOld();
            types.normal.Ignored = IgnoredQuestion;
            return types;
        },
        parseDataElement: function (form, el, parentMug) {
            if (this.data.ignore.active) {
                var $el = $(el);
                if ($el.xmlAttr("vellum:ignore") === "retain") {
                    var mug = form.mugTypes.make("Ignored", form);
                    mug.p.nodeID = el.nodeName;
                    mug.p.rawDataAttributes = parser.getAttributes(el);
                    if ($el.children().length) {
                        mug.p.dataNodeXML = serializeXML($el)
                            // strip wrapper element
                            .replace(/^<[^>]+>([^]*)<\/[^>]+>$/, "$1");
                    } else {
                        mug.p.dataNodeXML = "";
                    }
                    this.data.ignore.ignoredMugs.push(mug);
                    return mug;
                }
            }
            return this.__callOld();
        },
        parseBindElement: function (form, el, path) {
            if (this.data.ignore.active) {
                path = form.normalizeXPath(path);
                var mug = form.getMugByPath(path);
                if (!mug) {
                    mug = findParent(path, form);
                }
                if ((mug && mug.__className === "Ignored") ||
                    el.xmlAttr("vellum:ignore") === "retain")
                {
                    var basePath, relativeTo;
                    if (mug && mug.__className === "Ignored") {
                        basePath = mug.absolutePath;
                        relativeTo = MUG;
                    } else {
                        var parent = null;
                        if (mug) {
                            parent = mug.options.isSpecialGroup ? mug : mug.parentMug;
                        }
                        mug = makeIgnoredMug(form, parent);
                        form.tree.insertMug(mug, 'into', parent);
                        // HACK fix abstraction broken by direct tree insert
                        form._fixMugState(mug);
                        basePath = parent ? parent.absolutePath : form.getBasePath(true);
                        relativeTo = PARENT;
                        this.data.ignore.ignoredMugs.push(mug);
                    }
                    mug.p.binds.push({
                        path: path.startsWith(basePath) ?
                                    path.slice(basePath.length) : path,
                        relativeTo: path.startsWith(basePath) ? relativeTo : null,
                        attrs: parser.getAttributes(el)
                    });
                    return;
                }
            }
            this.__callOld();
        },
        parseSetValue: function (form, el, path) {
            if (this.data.ignore.active) {
                path = form.normalizeXPath(path);
                var mug = form.getMugByPath(path);
                if (!mug) {
                    mug = findParent(path, form);
                }
                if ((mug && mug.__className === "Ignored") ||
                    el.xmlAttr("vellum:ignore") === "retain")
                {
                    var basePath, relativeTo;
                    if (mug && mug.__className === "Ignored") {
                        basePath = mug.absolutePath;
                        relativeTo = MUG;
                    } else {
                        var parent = null;
                        if (mug) {
                            parent = mug.options.isSpecialGroup ? mug : mug.parentMug;
                        }
                        mug = makeIgnoredMug(form, parent);
                        form.tree.insertMug(mug, 'into', parent);
                        // HACK fix abstraction broken by direct tree insert
                        form._fixMugState(mug);
                        basePath = parent ? parent.absolutePath : form.getBasePath(true);
                        relativeTo = PARENT;
                        this.data.ignore.ignoredMugs.push(mug);
                    }
                    mug.p.setValues.push({
                        ref: el.xmlAttr('ref'),
                        event: el.xmlAttr('event'),
                        value: el.xmlAttr('value')
                    });
                    return;
                }
            }
            this.__callOld();
        },
        getControlNodeAdaptorFactory: function (tagName) {
            var getAdaptor = this.__callOld();
            if (this.data.ignore.active) {
                var ignoredMugs = this.data.ignore.ignoredMugs;
                return function ($cEl, appearance, form, parentMug) {
                    function adapt() {
                        if (!mug || mug.__className !== "Ignored") {
                            mug = makeIgnoredMug(form, parentMug);
                            ignoredMugs.push(mug);
                        }
                        restoreAttributes($cEl);
                        mug.p.controlNode = serializeXML($cEl);
                        return mug;
                    }
                    adapt.skipPopulate = true;
                    var path = parser.getPathFromControlElement(
                                        $cEl, form, parentMug, true),
                        mug = form.getMugByPath(path);
                    if ($cEl.xmlAttr("vellum:ignore") === "retain") {
                        adapt.ignoreDataNode = mug && mug.__className !== "Ignored";
                        return adapt;
                    }
                    if (mug && mug.__className === "Ignored") {
                        return adapt;
                    }
                    var args = Array.prototype.slice.call(arguments);
                    return getAdaptor && getAdaptor.apply(null, args);
                };
            }
            return getAdaptor;
        },
        getSections: function (mug) {
            if (this.data.ignore.active && mug.__className === "Ignored") {
                return [{
                    slug: "advanced",
                    type: "accordion",
                    displayName: "Advanced",
                    properties: [
                        "nodeID",
                    ],
                    isCollapsed: true,
                    help: {
                        title: gettext("Advanced"),
                        text: gettext("This question represents advanced content " +
                          "that is not supported by the form builder. Please " +
                          "only change it if you have a specific need!")
                    }
                }];
            }
            return this.__callOld();
        },
        handleMugRename: function (form, mug, newID, oldID, newPath, oldPath) {
            this.__callOld();
            var _this = this;
            if (this.data.ignore.active && oldPath) {
                // does not use normalizeXPath for oldPath as old XPath is invalid
                oldPath = oldPath.replace(/^#form\//, form.getBasePath(true) + "/");
                newPath = form.normalizeXPath(newPath);
                var oldEscaped = RegExp.escape(oldPath),
                    pathRegex = new RegExp(oldEscaped + '(\\W|$)', 'g'),
                    newPattern = newPath + "$1";
                _.each(_this.data.ignore.ignoredNodes, function (node) {
                    node.nodeXML = node.nodeXML.replace(pathRegex, newPattern);
                });
                _.each(_this.data.ignore.ignoredMugs, function (mug) {
                    if (mug.p.controlNode) {
                        mug.p.controlNode =
                            mug.p.controlNode.replace(pathRegex, newPattern);
                    }
                    _.each(mug.p.binds, function (bind) {
                        bind.attrs = _.object(_.map(bind.attrs, function (value, key) {
                            return [key, value.replace(pathRegex, newPattern)];
                        }));
                    });
                });
            }
        }
    });

    var IgnoredQuestion = {
            typeName: gettext("Ignored XML"),
            icon: 'fa fa-question-circle',
            isTypeChangeable: false,
            isRemoveable: false,
            isCopyable: false,
            ignoreHashtags: true,
            isHashtaggable: false,
            init: function (mug) {
                mug.p.binds = [];
                mug.p.setValues = [];
            },
            parseDataNode: function (mug, node) {
                return $([]);
            },
            getTagName: function (mug, nodeID) {
                return mug.p.rawDataAttributes ? nodeID : null;
            },
            writeDataNodeXML: function (writer, mug) {
                if (mug.p.dataNodeXML) {
                    writer.writeXML(mug.p.dataNodeXML);
                }
            },
            getBindList: function (mug) {
                return _.map(mug.p.binds, function (bind) {
                    var attrs = _.clone(bind.attrs),
                        basePath = "";
                    if (bind.relativeTo === MUG) {
                        basePath = mug.absolutePath;
                    } else if (bind.relativeTo === PARENT) {
                        var parent = mug.parentMug;
                        basePath = parent ? parent.absolutePath :
                                            mug.form.getBasePath(true);
                    }
                    attrs.nodeset = basePath + bind.path;
                    return attrs;
                });
            },
            getSetValues: function(mug) {
                return mug.p.setValues;
            },
            writesOnlyCustomXML: true,
            writeCustomXML: function (writer, mug) {
                if (mug.p.controlNode) {
                    writer.writeXML(mug.p.controlNode);
                }
            },
            spec: {
                label: { presence: 'notallowed' },
                labelItext: { presence: 'notallowed' },
                labelItextID: { presence: 'notallowed' },
                hintLabel: { presence: 'notallowed' },
                hintItext: { presence: 'notallowed' },
                hintItextID: { presence: 'notallowed' },
                helpItext: { presence: 'notallowed' },
                helpItextID: { presence: 'notallowed' },
                mediaItext: { presence: 'notallowed' },
                otherItext: { presence: 'notallowed' },
                appearance: { presence: 'notallowed' },
            }
        };

    function findParent(path, form) {
        var parent = null,
            regex = /[\/[][^\/[]+$/;
        while (!parent && path && regex.test(path)) {
            path = path.replace(regex, "");
            if (path) {
                parent = form.getMugByPath(path);
            }
        }
        return parent;
    }

    function makeIgnoredMug(form, parent) {
        var mug = form.mugTypes.make("Ignored", form);
        mug.p.nodeID = form.generate_item_label(parent, "ignored--", 1);
        return mug;
    }

    function restoreAttributes(el) {
        if (el.length && el[0].poppedAttributes) {
            el.xmlAttr(el[0].poppedAttributes);
        }
    }

    function serializeXML(xml) {
        var string = xmls.serializeToString(xml[0]),
            i = string.indexOf(">");
        if (i === -1) {
            return string;
        }
        // remove xmlns attributes from the root node
        return string.slice(0, i)
                     .replace(/ xmlns(:.*?)?="(.*?)"/g, "") + string.slice(i);
    }

    function getPathAndPosition(node) {
        var origNode = node,
            path = [],
            prev, next;

        prev = getSiblingSelector(node, "previous");
        next = getSiblingSelector(node, "next");
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
            prev: prev,
            next: next,
            path: path.join(" > "),
            nodeXML: "\n" + nodeXML
        };
    }

    function getSiblingSelector(node, position) {
        var sel = getNodeIdentifierSelector(node[position + "ElementSibling"]);
        return sel && sel + ", " + sel.replace(/\w+:([^:]*)$/, "$1");
    }

    function getNodeIdentifierSelector(node) {
        if (!node) {
            return null;
        }
        var $node = $(node),
            nodeset = $node.xmlAttr('nodeset'),
            ref = $node.xmlAttr('ref'),
            id = $node.xmlAttr('id'),
            tagName = ($node.prop('tagName') || '').toLowerCase();

        if (tagName === 'setvalue') {
            return '[event="' + $node.xmlAttr('event') + '"]' +
                   '[ref="' + ref + '"]';
        } else if (nodeset) {
            return '[nodeset="' + nodeset + '"]';
        } else if (ref) {
            return '[ref="' + ref + '"]';
        } else if (id) {
            return '[id="' + id + '"]';
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
});
