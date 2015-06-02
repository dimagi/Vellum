/**
 * External data source tree/browser plugin
 */
define([
    'jquery',
    'underscore',
    'vellum/datasources',
    'vellum/widgets',
    'tpl!vellum/templates/external_data_tree',
], function (
    $,
    _,
    datasources,
    widgets,
    external_data_tree
) {
    var panelHeight, isDataTreeLoaded;

    // plugin adds an item to the Tools menu when enabled
    $.vellum.plugin('databrowser', {}, {
        init: function () {
            var vellum = this,
                pane = this.$f.find(".fd-accessory-pane");
            isDataTreeLoaded = false;
            pane.append($(external_data_tree()));
            pane.resize(function () {
                if (pane.height() > 100) {
                    panelHeight = pane.height();
                } else if (pane.height() > 0) {
                    initDataBrowser(vellum);
                }
            });
        },
        getToolsMenuItems: function () {
            var vellum = this,
                items = this.__callOld();
            items.push({
                name: "External Data",
                action: function (done) {
                    toggleExternalDataTree(vellum, done);
                }
            });
            return items;
        }
    });

    var initDataBrowser = function (vellum) {
        if (isDataTreeLoaded) { return; }
        isDataTreeLoaded = true;

        // display spinner and begin loading...
        var $container = vellum.$f.find(".fd-external-data-tree-container"),
            $search = $container.find(".fd-search-box input"),
            $tree = $container.find(".fd-external-data-tree"),
            pending = false;
        $tree.jstree({
            core: {
                data: function (node, callback) {
                    var _this = this;
                    datasources.getDataSources(function (data) {
                        callback.call(_this, dataTreeJson(data, vellum));
                    });
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
        $search.keyup(function () {
            if (pending) {
                clearTimeout(pending);
            }
            pending = setTimeout(function () {
                $tree.jstree(true).search($search.val());
            }, 250);
        });
    };

    function dataTreeJson(data, vellum) {
        var MAX_OPEN_NODE = 50;
        function node(parentPath, info) {
            return function (item, name) {
                var path = parentPath ? (parentPath + "/" + name) : name,
                    children = _.map(item.structure, node(path, info));
                return {
                    icon: false,
                    text: item.name || name,
                    state: {opened: children.length <= MAX_OPEN_NODE},
                    children: children,
                    data: {
                        handleDrop: function (target) {
                            var widget = widgets.util.getWidget(target, vellum),
                                id = widget.addInstanceRef({
                                    id: info.id,
                                    src: info.uri
                                }),
                                query = widget.mug.form.updateInstanceQuery(path, id);
                            vellum.handleDropFinish(target, query);
                        }
                    }
                };
            };
        }
        return _.map(data, function (source) {
            var info = _.omit(source, "structure"),
                path = "instance('" + source.id + "')" + source.path;
            return node(null, info)(source, path);
        });
    }

    function toggleExternalDataTree(vellum, done) {
        var pane = vellum.$f.find(".fd-accessory-pane");
        if (pane.height()) {
            pane.css("height", "0");
            $(window).resize();
        } else {
            var tree = vellum.$f.find(".fd-tree"),
                height = panelHeight || Math.min(tree.height() / 2, 200);
            pane.css("height", height + "px");
            $(window).resize();
            initDataBrowser(vellum);
        }
        done();
    }

    return {
        initDataBrowser: initDataBrowser,
    };
});
