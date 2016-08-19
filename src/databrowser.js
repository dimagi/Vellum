/**
 * External data source tree/browser plugin
 */
define([
    'jquery',
    'underscore',
    'vellum/datasources',
    'vellum/util',
    'vellum/widgets',
    'vellum/window',
    'tpl!vellum/templates/external_sources_tree',
], function (
    $,
    _,
    datasources,
    util,
    widgets,
    window_,
    external_sources_tree
) {
    var fn = {},
        DATABROWSER_HEIGHT = 0.33,
        panelHeight,
        handleError = function($container) {
            return function(jqXHR, textStatus, errorThrown) {
                if ($container && jqXHR.responseText) {
                    $container.find(".fd-external-sources-error").removeClass("hide").text(jqXHR.responseText);
                } else {
                    window.console.log(util.formatExc(textStatus || errorThrown));
                }
            };
        };

    // plugin adds an item to the Tools menu when enabled
    $.vellum.plugin('databrowser', {}, {
        init: function () {
            var vellum = this,
                tree = this.$f.find(".fd-tree"),
                pane = this.$f.find(".fd-accessory-pane"),
                head, headHeight, searchBar, paneRatio;
            fn.initDataBrowser = _.once(_initDataBrowser);
            pane.append($(external_sources_tree()));
            head = pane.find(".fd-head-external-sources");
            headHeight = head.outerHeight(true) || 0;
            pane.data("min-size", headHeight)
                .height(Math.min(tree.height() * DATABROWSER_HEIGHT, headHeight * 12))
                .resize(function () {
                    if (pane.height() > headHeight + 100) {
                        panelHeight = pane.height();
                        paneRatio = pane.height() / $('.fd-content-left').height();
                    }
                });
            paneRatio = pane.height() / $('.fd-content-left').height();
            $(window).scroll(function() {
                if (pane.height() > headHeight) {
                    pane.height($('.fd-content-left').height() * paneRatio);
                    panelHeight = pane.height();
                }
            });
            searchBar = pane.find('#fdExternalSearch');
            searchBar.on('keyup keypress', function(e) {
                var code = e.keyCode || e.which;
                if (code === 13) {
                    //disable submitting on enter
                    e.preventDefault();
                    return false;
                }
            });
            vellum.data.core.databrowser = { dataHashtags: {}, dataHashtagTransformations: {} };
            fn.initDataBrowser(vellum);
            window_.preventDoubleScrolling(pane.find(".fd-scrollable"));
            datasources.getDataSources(function () {}, handleError(pane));
            var toggle = _.partial(toggleExternalDataTree, vellum);
            pane.parent().find(".fd-external-sources-divider")
                .clickExceptAfterDrag(toggle);
            head.click(toggle);
        },
        loadXML: function(xml) {
            this.__callOld();
            var _this = this, hashtags;
            if (!_.isEmpty(this.data.core.databrowser.dataHashtags)) {
                hashtags = this.data.core.databrowser.dataHashtags;
            } else {
                hashtags = parsePreloadedHashtags(
                    $(xml).find('h\\:head, head').children('vellum\\:hashtags, hashtags')
                );
            }
            _.each(hashtags, function (path, hash) {
                addHashtag(hash, path, _this);
            });
            _.each(this.data.core.databrowser.dataHashtagTransformations, function(trans, hash) {
                addHashtagTransformation(hash, trans, _this);
            });

            fixFormReferences(this.data.core.form);
            this.refreshVisibleData();
        },
        contributeToHeadXML: function (xmlWriter, form) {
            var hashtags = this.data.core.form.knownExternalReferences();
            if (!_.isEmpty(hashtags)) {
                xmlWriter.writeStartElement('vellum:hashtags');
                xmlWriter.writeString(JSON.stringify(hashtags));
                xmlWriter.writeEndElement();
            }
            this.__callOld();
        },
    });

    function parsePreloadedHashtags(hashtags) {
        // known external properties that are referenced in the form
        // used so that those references don't show up as unknown on next form
        // load before data browser is fully loaded
        try {
            return JSON.parse($.trim(hashtags.text()));
        } catch (err) {
            return {};
        }
    }

    function _initDataBrowser(vellum) {
        // display spinner and begin loading...
        var $container = vellum.$f.find(".fd-external-sources-container"),
            $search = $container.find(".fd-external-resource-search input"),
            $tree = $container.find(".fd-external-sources-tree");
        $tree.jstree({
            core: {
                data: function (node, callback) {
                    if (node.data && node.data.getNodes) {
                        // load children of deferred node
                        callback.call(this, node.data.getNodes());
                    } else {
                        var _this = this;
                        datasources.getDataSources(function (data) {
                            callback.call(_this, dataTreeJson(data, vellum));
                        }, handleError($container));
                    }
                },
                worker: false,
                multiple: false,
                check_callback: function(operation, node, parent, position, more) {
                    return false;
                }
            },
            search: {
                show_only_matches: true
            },
            conditionalevents: {
                should_activate: function () { return false; }
            },
            "plugins" : [ "themes", "conditionalevents", "dnd", "search" ]
        });
        $search.keyup(_.debounce(function () {
            $tree.jstree(true).search($search.val());
        }, 250));
    }

    function dataTreeJson(data, vellum) {
        var invalidCaseProperties = vellum.opts().core.invalidCaseProperties;

        function node(source, parentPath, info) {
            return function (item, id) {
                if (_.contains(invalidCaseProperties, id)) {
                    return null;
                }

                var path = parentPath ? (parentPath + "/" + id) : id,
                    tree = getTree(item, id, path, info);
                if (vellum.opts().features.rich_text && source && source.id !== "commcaresession") {
                    // magic: case as the id means that this is the base case
                    var hashtagPrefix = '#case/' + (source.id !== 'case' ? source.id + '/' : ''),
                        hashtagPath = hashtagPrefix + id;
                    addHashtag(hashtagPath, path, vellum);
                    path = hashtagPath;
                    if (parentPath) {
                        addHashtagTransformation(hashtagPrefix, function(prop) {
                            return parentPath + "/" + prop;
                        }, vellum);
                    }
                }
                return {
                    text: tree.name,
                    icon: tree.nodes === true || tree.nodes.length ?
                            "fcc fcc-fd-external-case" :
                            "fcc fcc-fd-case-property",
                    state: {opened: tree.nodes !== true &&
                                    tree.nodes.length <= MAX_OPEN_NODE},
                    children: tree.nodes,
                    data: {
                        handleDrop: _.partial(handleDrop, path, info),
                        getNodes: tree.getNodes,
                    }
                };
            };
        }
        function getTree(item, id, path, info) {
            var tree = {name: item.name || id},
                source = item;
            if (!item.structure && item.reference) {
                var ref = item.reference;
                source = sources[ref.source || info.id];
                if (source) {
                    info = _.extend(_.omit(source, "structure"), {_parent: info});
                    path = "instance('" + source.id + "')" + source.path +
                           "[" + ref.key + " = " + path + "]";
                    if (source.subsets && ref.subset) {
                        // magic: match key: "@case_type"
                        source = _.findWhere(
                            source.subsets,
                            {id: ref.subset, key: "@case_type"}
                        ) || source;
                    }
                    var name = source.name || source.id;
                    if (name) {
                        tree.name = name;
                    }
                    if (seen.hasOwnProperty(source.id)) {
                        // defer to prevent infinite loop
                        tree.nodes = true;
                        tree.getNodes = _.partial(getNodes, source, path, info);
                        return tree;
                    }
                    seen[source.id] = true;
                }
            }
            tree.nodes = getNodes(source, path, info);
            return tree;
        }
        function getNodes(source, path, info) {
            var nodes = _.chain(source && source.structure)
                .map(node(source, path, info))
                .compact()
                .sortBy("text")
                .value();
            if (source && source.related) {
                nodes = _.chain(source.related)
                    .map(function (subset, relation) {
                        // magic: reference key: @case_id
                        var item = {reference: {subset: subset, key: "@case_id"}};
                        // magic: append "/index" to path
                        return node(source, path + "/index", info)(item, relation);
                    })
                    .sortBy("text")
                    .value()
                    .concat(nodes);
            }
            return nodes;
        }
        function handleDrop(path, info, target) {
            var widget = widgets.util.getWidget(target, vellum);
            while (info) {
                var id = widget.addInstanceRef({id: info.id, src: info.uri});
                if (id !== info.id) {
                    path = widget.mug.form.updateInstanceQuery(path, id, info.id);
                }
                info = info._parent;
            }
            vellum.handleDropFinish(target, path);
        }
        var MAX_OPEN_NODE = 50,
            sources = _.indexBy(data, "id"),
            nodes = [],
            seen = {};
        if (sources.commcaresession) {
            var source = sources.commcaresession,
                info = _.omit(source, "structure"),
                path = "instance('" + source.id + "')" + source.path;
            // do not show Session node for now
            nodes = node(source, null, info)(source, path).children;
        }

        function flattenNode(node) {
            var subCases = _.filter(node.children, function(child) {
                return child.children.length;
            });
            node.children = _.filter(node.children, function(child) {
                return child.children.length === 0;
            });
            subCases = _.flatten(_.map(subCases, flattenNode));
            return [node].concat(subCases);
        }
        // data sources should be in a flat list instead of hierarchy
        nodes = _.flatten(_.map(nodes, flattenNode));

        if (vellum.data.core.form) {
            // remove renamed case properties
            vellum.data.core.form.clearNullHashtags();
        }

        // done here for performance reasons. would be nice to be done after
        // every new hashtag, but only for the mugs that reference that hashtag
        fixFormReferences(vellum.data.core.form);
        return nodes;
    }

    function toggleExternalDataTree(vellum) {
        var pane = vellum.$f.find(".fd-accessory-pane"),
            headHeight = pane.find(".fd-head-external-sources").outerHeight(true);
        if (pane.height() > headHeight) {
            pane.css("height", headHeight + "px");
            pane.find('.fd-head-external-sources .fd-head-max-indicator i')
                .removeClass('fa-arrow-circle-o-down')
                .addClass('fa-arrow-circle-o-up');
            $(window).resize();
        } else {
            var tree = vellum.$f.find(".fd-tree"),
                height = panelHeight || tree.height() * DATABROWSER_HEIGHT;
            pane.css("height", height + "px");
            pane.find('.fd-head-external-sources .fd-head-max-indicator i')
                .removeClass('fa-arrow-circle-o-up')
                .addClass('fa-arrow-circle-o-down');
            $(window).resize();
            fn.initDataBrowser(vellum);
        }
    }

    function addHashtag(hashtag, fullPath, vellum) {
        var form = vellum.data.core.form,
            dataHashtags = vellum.data.core.databrowser.dataHashtags;

        // if we get the same hashtag it will be due to recursive references
        if (!dataHashtags.hasOwnProperty(hashtag)) {
            dataHashtags[hashtag] = fullPath;
        }
        if (form && form.addHashtag) {
            form.initHashtag(hashtag, fullPath);
        }
    }

    function addHashtagTransformation(prefix, transformation, vellum) {
        var form = vellum.data.core.form,
            dataHashtagTransformations = vellum.data.core.databrowser.dataHashtagTransformations;

        if (!dataHashtagTransformations.hasOwnProperty(prefix)) {
            dataHashtagTransformations[prefix] = transformation;
        }
        if (form && form.initHashtagTransformation) {
            form.initHashtagTransformation(prefix, transformation);
        }
    }

    function fixFormReferences(form) {
        if (form) {
            form.fixBrokenReferences();
        }
    }

    return fn;
});
