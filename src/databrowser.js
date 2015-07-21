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
        panelHeight;

    // plugin adds an item to the Tools menu when enabled
    $.vellum.plugin('databrowser', {}, {
        init: function () {
            var vellum = this,
                pane = this.$f.find(".fd-accessory-pane"),
                head, headHeight;
            fn.initDataBrowser = _.once(_initDataBrowser);
            pane.append($(external_sources_tree()));
            head = pane.find(".fd-head-external-sources");
            headHeight = head.outerHeight(true) || 0;
            pane.data("min-size", headHeight)
                .height(headHeight)
                .resize(function () {
                    if (pane.height() > 100) {
                        panelHeight = pane.height();
                    } else if (pane.height() > headHeight) {
                        fn.initDataBrowser(vellum);
                    }
                });
            window_.preventDoubleScrolling(pane.find(".fd-scrollable"));
            datasources.getDataSources(function () {});
            var toggle = _.partial(toggleExternalDataTree, vellum);
            pane.parent().find(".fd-external-sources-divider")
                .clickExceptAfterDrag(toggle);
            head.click(toggle);
        }
    });

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
                            var result;
                            try {
                                result = dataTreeJson(data, vellum);
                            } catch (err) {
                                result = [{
                                    text: util.formatExc(err),
                                    icon: false
                                }];
                            }
                            callback.call(_this, result);
                        });
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
                should_activate: function (node, event) {
                    setTimeout(function () {
                        var x = event.pageX,
                            y = event.pageY;
                        $tree.jstree(true).show_contextmenu(node, x, y, event);
                    }, 0);
                    return false;
                }
            },
            contextmenu: {
                select_node: false,
                show_at_node: false,
                items: function (node) { return {
                    repeat: getRepeatItem(node, vellum)
                }; }
            },
            "plugins" : [
                "themes",
                "conditionalevents",
                "contextmenu",
                "dnd",
                "search"
            ]
        });
        $search.keyup(_.debounce(function () {
            $tree.jstree(true).search($search.val());
        }, 250));
    }

    function dataTreeJson(data, vellum) {
        function node(parentPath, info) {
            var getPath = parentPath;
            if (_.isString(parentPath)) {
                getPath = function (id) { return parentPath + "/" + id; };
            } else if (!_.isFunction(parentPath)) {
                throw new Error("invalid parentPath: " + String(parentPath));
            }
            return function (item, id) {
                var path = getPath(id, item),
                    tree = getTree(item, id, path, info);
                return {
                    text: tree.name,
                    icon: tree.nodes === true || tree.nodes.length ?
                            "fcc fcc-fd-external-case" :
                            "fcc fcc-fd-external-case-data",
                    state: {opened: tree.nodes !== true &&
                                    tree.nodes.length <= MAX_OPEN_NODE},
                    children: tree.nodes,
                    data: {
                        path: path,
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
                    info = getInfo(source, info);
                    path = "instance('" + source.id + "')" + source.path +
                           "[" + ref.key + "=" + path + "]";
                    if (source.subsets && ref.subset) {
                        // magic: match key: "@case_type"
                        source = _.findWhere(
                            source.subsets,
                            {id: ref.subset, key: "@case_type"}
                        ) || source;
                    }
                    var name = source.name || source.id;
                    if (name) {
                        tree.name = tree.name + " (" + name + ")";
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
                .map(node(path, info))
                .sortBy("text")
                .value();
            if (source && source.related) {
                nodes = _.chain(source.related)
                    .map(function (subset, relation) {
                        // magic: reference key: @case_id
                        var item = {reference: {subset: subset, key: "@case_id"}};
                        // magic: append "/index" to path
                        return node(path + "/index", info)(item, relation);
                    })
                    .sortBy("text")
                    .value()
                    .concat(nodes);
            }
            if (source && source.subsets) {
                var getPath = function (id, sub) {
                    return path + "[" + sub.key + "='" + id + "']";
                };
                nodes = _.map(source.subsets, function (sub) {
                    return node(getPath, getInfo(sub, info))(sub, sub.id);
                }).concat(nodes);
            }
            return nodes;
        }
        function getInfo(item, parent) {
            return {id: item.id, uri: item.uri, parent: parent};
        }
        function handleDrop(path, info, target) {
            var widget = widgets.util.getWidget(target, vellum);
            if (!widget) {
                throw new Error("cannot find widget for target: " + target);
            } else if (!widget.path) {
                throw new Error("widget has no path: " + widget.id);
            }
            path = addInstanceRefs(widget.mug, widget.path, path, info);
            vellum.handleDropFinish(target, path);
        }
        var MAX_OPEN_NODE = 10,
            sources = _.chain(data)
                .map(function (src) { return [src.id, src]; })
                .object()
                .value(),
            seen = {};
        return _.map(data, function (source) {
            var info = getInfo(source),
                path = "instance('" + source.id + "')" + source.path;
            return node(_.identity, info)(source, path);
        });
    }

    function addInstanceRefs(mug, property, xpath, info) {
        var form = mug.form;
        while (info) {
            if (info.uri) {
                var attrs = {id: info.id, src: info.uri},
                    id = form.addInstanceIfNotExists(attrs, mug, property);
                if (id !== info.id) {
                    xpath = form.updateInstanceQuery(xpath, id, info.id);
                }
            }
            info = info.parent;
        }
        return xpath;
    }

    function getRepeatItem(node, vellum) {
        function action() {
            vellum.addQuestion("Repeat", function (mug) {
                var path = node.data.path;
                path = addInstanceRefs(mug, "dataSource", path, node.data.info);
                mug.p.dataSource = { idsQuery: path };
                vellum.displayMugProperties(mug, true);
            });
        }
        return {
            label: "Repeat for each " + node.text,
            icon: "icon-retweet",
            action: action,
        };
    }

    function toggleExternalDataTree(vellum) {
        var pane = vellum.$f.find(".fd-accessory-pane"),
            headHeight = pane.find(".fd-head-external-sources").outerHeight(true);
        if (pane.height() > headHeight) {
            pane.css("height", headHeight + "px");
            $(window).resize();
        } else {
            var tree = vellum.$f.find(".fd-tree"),
                height = panelHeight || tree.height() * 0.45;
            pane.css("height", height + "px");
            $(window).resize();
            fn.initDataBrowser(vellum);
        }
    }

    return fn;
});
