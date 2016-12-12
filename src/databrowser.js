/**
 * External data source tree/browser plugin
 */
define([
    'jquery',
    'underscore',
    'vellum/util',
    'vellum/widgets',
    'vellum/window',
    'tpl!vellum/templates/external_sources_tree',
], function (
    $,
    _,
    util,
    widgets,
    window_,
    external_sources_tree
) {
    var fn = {},
        DATABROWSER_HEIGHT = 0.33;

    // plugin adds an item to the Tools menu when enabled
    $.vellum.plugin('databrowser', {}, {
        init: function () {
            var vellum = this,
                tree = this.$f.find(".fd-tree"),
                pane = this.$f.find(".fd-accessory-pane"),
                head, headHeight, searchBar, paneRatio;
            vellum.data.core.databrowser = {
                errorContainer: pane,
                panelHeight: null,
            };
            fn.initDataBrowser = _.once(_initDataBrowser);
            pane.append($(external_sources_tree()));
            head = pane.find(".fd-head-external-sources");
            headHeight = head.outerHeight(true) || 0;
            pane.data("min-size", headHeight)
                .height(Math.min(tree.height() * DATABROWSER_HEIGHT, headHeight * 12))
                .resize(function () {
                    if (pane.height() > headHeight + 100) {
                        vellum.data.core.databrowser.panelHeight = pane.height();
                        paneRatio = pane.height() / $('.fd-content-left').height();
                    }
                });
            paneRatio = pane.height() / $('.fd-content-left').height();
            $(window).scroll(function() {
                if (pane.height() > headHeight) {
                    pane.height($('.fd-content-left').height() * paneRatio);
                    vellum.data.core.databrowser.panelHeight = pane.height();
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
            fn.initDataBrowser(vellum);
            window_.preventDoubleScrolling(pane.find(".fd-scrollable"));
            vellum.datasources.on("error", function(event) {
                var container = vellum.data.core.databrowser.errorContainer;
                if (container && event.xhr.responseText) {
                    container.find(".fd-external-sources-error")
                        .removeClass("hide")
                        .text(event.xhr.responseText);
                }
            });
            var toggle = _.partial(toggleExternalDataTree, vellum);
            pane.parent().find(".fd-external-sources-divider")
                .clickExceptAfterDrag(toggle);
            head.click(toggle);
        },
    });

    function _initDataBrowser(vellum) {
        // display spinner and begin loading...
        var $container = vellum.$f.find(".fd-external-sources-container"),
            $search = $container.find(".fd-external-resource-search input"),
            $tree = $container.find(".fd-external-sources-tree");
        vellum.data.core.databrowser.errorContainer = $container;
        $tree.jstree({
            core: {
                data: function (node, callback) {
                    function fillTree() {
                        var nodes = vellum.datasources.getDataNodes([]);
                        callback.call(tree, dataTreeJson(nodes, vellum));
                    }
                    var tree = this;
                    if (node.data && node.data.getNodes) {
                        // load children of recursive node
                        callback.call(this, node.data.getNodes());
                    } else {
                        if (vellum.datasources.isReady()) {
                            fillTree();
                        } else {
                            vellum.datasources.on("change", fillTree, null, "change");
                        }
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
        function treeNode(node) {
            var getNodes = function () { return _.map(node.getNodes(), treeNode); },
                children = node.recursive ? true : getNodes();
            return {
                text: node.name,
                icon: node.recursive || children.length ?
                        "fcc fcc-fd-external-case" :
                        "fcc fcc-fd-case-property",
                state: {opened: !node.recursive && children.length <= MAX_OPEN_NODE},
                children: children,
                data: {
                    handleDrop: _.partial(handleDrop, node, node.sourceInfo),
                    getNodes: node.recursive ? getNodes : null,
                }
            };
        }
        function handleDrop(node, info, target) {
            var widget = widgets.util.getWidget(target, vellum),
                path = widget.mug.form.richText ? node.hashtag : node.xpath,
                id;
            while (info) {
                if (info.id && info.uri) {
                    id = widget.addInstanceRef({id: info.id, src: info.uri});
                    if (id !== info.id) {
                        path = widget.mug.form.updateInstanceQuery(path, id, info.id);
                    }
                }
                info = info._parent;
            }
            vellum.handleDropFinish(target, path);
        }
        function flattenNode(node) {
            // data sources should be in a flat list instead of hierarchy
            var subCases = _.filter(node.children, function(child) {
                return child.children.length;
            });
            node.children = _.filter(node.children, function(child) {
                return child.children.length === 0;
            });
            subCases = _.flatten(_.map(subCases, flattenNode));
            return [node].concat(subCases);
        }
        var MAX_OPEN_NODE = 50;
        return _.chain(data)
            .map(treeNode)
            .map(flattenNode)
            .flatten()
            .value();
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
                panelHeight = vellum.data.core.databrowser.panelHeight,
                height = panelHeight || tree.height() * DATABROWSER_HEIGHT;
            pane.css("height", height + "px");
            pane.find('.fd-head-external-sources .fd-head-max-indicator i')
                .removeClass('fa-arrow-circle-o-up')
                .addClass('fa-arrow-circle-o-down');
            $(window).resize();
            fn.initDataBrowser(vellum);
        }
    }

    return fn;
});
