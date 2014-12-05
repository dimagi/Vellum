define([
    'jquery',
    'vellum/core'
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

            $(window).resize(adjustToWindow);
            $(document).scroll(adjustToWindow);

            this.data.windowManager.offset = {
                top: opts.topOffset || this.$f.offset().top-1,
                bottom: opts.bottomOffset || 0,
                left: opts.leftOffset || this.$f.offset().left
            };
            this.data.windowManager.fullscreen = opts.fullscreen;
            this.data.windowManager.adjustToWindow = adjustToWindow;

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

            var availableColumnSpace = availableVertSpace - $('.fd-toolbar').outerHeight(false),
            panelHeight, columnHeight, treeHeight;

            panelHeight = Math.max(availableColumnSpace - 5, this.opts().windowManager.minHeight);
            columnHeight = panelHeight - $('.fd-head').outerHeight(false);
            treeHeight = columnHeight;

            $fdc.find('.fd-content').css('height', panelHeight + 'px');

            $fdc.find('.fd-content-left')
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
});
