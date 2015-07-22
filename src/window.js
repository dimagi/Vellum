define([
    'jquery',
    'vellum/core',
    'vellum/jquery-extensions'
], function (
    $
) {
    $.vellum.plugin('windowManager', {
        minHeight: 200,
        bottomOffset: 0
    }, {
        init: function () {
            var _this = this,
                opts = this.opts().windowManager,
                adjustToWindow = function () { _this.adjustToWindow(); };

            preventDoubleScrolling(this.$f.find('.fd-scrollable'));
            setupDraggableDivider(
                this.$f.find('.fd-content-divider'),
                this.$f.find('.fd-content-left'),
                adjustToWindow
            );
            setupDraggableDivider(
                this.$f.find('.fd-content-left-divider'),
                this.$f.find('.fd-accessory-pane'),
                adjustToWindow
            );

            this.data.windowManager.offset = {
                top: opts.topOffset || this.$f.offset().top-1,
                bottom: opts.bottomOffset || 0,
                left: opts.leftOffset || this.$f.offset().left
            };
            this.data.windowManager.fullscreen = opts.fullscreen;
            this.data.windowManager.adjustToWindow = adjustToWindow;

            // start with accessory pane collapsed
            $(window).resize(adjustToWindow);
            $(document).scroll(adjustToWindow);
            $(document).ready(adjustToWindow);
            this.adjustToWindow();
        },
        adjustToWindow: function () {
            if (!this.$f.is(':visible')) {
                return;
            }

            var availableVertSpace = $(window).height() - this.getCurrentTopOffset(),
                availableHorizSpace,
                position = (this.getCurrentTopOffset() === 0) ? 'fixed' : 'static',
                $fdc = this.$f.find('.fd-ui-container');
            if (this.data.windowManager.fullscreen) {
                $fdc.parent().css({height: null, width: null});
                $fdc.css({height: null, width: null});
                $fdc.parent().css({
                    position: 'fixed',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 10000,
                    backgroundColor: 'white'
                });
            } else {
                $fdc.parent().css({
                    position: '',
                    top: '',
                    bottom: '',
                    left: '',
                    right: '',
                    backgroundColor: 'white'
                });
            }
            // so that the document doesn't have to resize for the footer.
            $fdc.parent().css('height', availableVertSpace + 'px');

            availableVertSpace = availableVertSpace - this.getCurrentBottomOffset();
            $fdc.css('height', availableVertSpace + 'px');

            $fdc.css('width', $fdc.parent().width())
                .css('position', position)
                .css('left', this.getCurrentLeftOffset() + 'px');

            availableHorizSpace = $fdc.width();

            var toolbarHeight = this.$f.find('.fd-toolbar').outerHeight(false),
                availableColumnSpace = availableVertSpace - toolbarHeight,
                panelHeight = Math.max(availableColumnSpace,
                                       this.opts().windowManager.minHeight),
                columnHeight = panelHeight - this.$f.find('.fd-head').outerHeight(false),
                treeHeight = columnHeight,
                accessoryPane = this.$f.find(".fd-accessory-pane");

            $fdc.find('.fd-content').css('height', panelHeight + 'px');

            if (accessoryPane.children().length) {
                var accessoryHeight = accessoryPane.outerHeight(false),
                    accessoryScrollableHeight = accessoryHeight -
                        accessoryPane.find('.fd-head').outerHeight(true);
                treeHeight -= 2 + accessoryHeight +
                    this.$f.find('.fd-content-left-divider').outerHeight(true);
                accessoryPane.find(".fd-scrollable")
                             .css('height', accessoryScrollableHeight + 'px');
                accessoryPane.show();
                this.$f.find(".fd-content-left-divider").show();
            } else {
                accessoryPane.hide();
                this.$f.find(".fd-content-left-divider").hide();
            }
            $fdc.find('.fd-content-left')
                .find('.fd-tree')
                .find('.fd-scrollable').css('height', treeHeight + 'px');

            $fdc.find('.fd-content-right')
                .css('width', availableHorizSpace - this.getLeftWidth() + 'px')
                .find('.fd-scrollable.full').css('height', columnHeight + 'px');

            $fdc.find('.fd-props-scrollable')
                .css('height', columnHeight - $fdc.find('.fd-props-toolbar').outerHeight(true) + 'px');
        },
        getLeftWidth: function () {
            return 2 + this.$f.find('.fd-content-left').outerWidth(false) + 
               this.$f.find('.fd-content-divider').outerWidth(true);
        },
        getCurrentTopOffset: function () {
            if (this.data.windowManager.fullscreen) {
                return 0;
            }
            var scrollPosition = $(window).scrollTop(),
                offset = this.data.windowManager.offset,
                topOffset = (typeof offset.top === 'function') ? offset.top() : offset.top;
            return Math.min(Math.max(topOffset - scrollPosition, 0), topOffset);
        },
        getCurrentBottomOffset: function () {
            if (this.data.windowManager.fullscreen) {
                return 0;
            }
            var offset = this.data.windowManager.offset;
            return (typeof offset.bottom === 'function') ? offset.bottom() : offset.bottom;
        },
        getCurrentLeftOffset: function () {
            if (this.data.windowManager.fullscreen) {
                return 0;
            }
            var scrollLeft = $(window).scrollLeft(),
                offset = this.data.windowManager.offset,
                offsetLeft = (typeof offset.left === 'function') ? offset.left() : offset.left;
            return Math.min(offsetLeft - scrollLeft, offsetLeft);
        }
    });

    function preventDoubleScrolling($scrollable) {
        $scrollable.on('DOMMouseScroll mousewheel', function (ev) {
            /*
             * Copied from http://jsfiddle.net/TroyAlford/4wrxq/1/
             *
             * if your mouse is over the one of vellum's scrollable sections
             * and you use your mouse wheel (or touchpad, etc.) to scroll
             * you no longer start scrolling the window when the pane reaches the top/bottom
             *
             * up/down keys still have double scrolling behavior,
             * and you can still click the up down arrows on either scroll bar
             * for OS's that have that (i.e. most except macs)
             */
            var $this = $(this),
                scrollTop = this.scrollTop,
                scrollHeight = this.scrollHeight,
                height = $this.height(),
                delta = ev.originalEvent.wheelDelta,
                up = delta > 0,
                prevent = function() {
                    ev.stopPropagation();
                    ev.preventDefault();
                    ev.returnValue = false;
                    return false;
                };

            if (!up && -delta > scrollHeight - height - scrollTop) {
                // Scrolling down, but this will take us past the bottom.
                $this.scrollTop(scrollHeight);
                return prevent();
            } else if (up && delta > scrollTop) {
                // Scrolling up, but this will take us past the top.
                $this.scrollTop(0);
                return prevent();
            }
        });
    }

    function setupDraggableDivider($divider, $resizable, adjustToWindow) {
        var pageVar, sizeVar, before, cursor;
        if ($divider.hasClass("fd-content-vertical-divider")) {
            before = $resizable.offset().left < $divider.offset().left;
            pageVar = "pageX";
            sizeVar = "width";
            cursor = 'col-resize';
        } else {
            before = $resizable.offset().top < $divider.offset().top;
            pageVar = "pageY";
            sizeVar = "height";
            cursor = 'row-resize';
        }
        var direction = before ? 1 : -1;
        $divider.mousedown(function (mousedown) {
            var minSize = $resizable.data("min-size") || 0,
                size = $resizable[sizeVar](),
                resize = function (mousemove) {
                    var distance = mousemove[pageVar] - mousedown[pageVar];
                    $resizable[sizeVar](Math.max(size + distance * direction, minSize));
                    $resizable.resize();
                    adjustToWindow();
                };
            $(window).disableSelection()
                .on('mousemove', resize)
                .one('mouseup', function () {
                    $(this).enableSelection();
                    $(this).off('mousemove', resize);
                });
        }).hover(function (e) {
            e.target.style.cursor = cursor;
        });
    }

    return {
        preventDoubleScrolling: preventDoubleScrolling
    };
});
