/*  Stickyover Bootstrap Plugin
 *   ------------------------
 *   Designed for CommCare HQ. Copyright 2012 Dimagi, Inc.
 *
 *   This extends Twitter Bootstrap's popover plugin to display the popover absolutely positioned in the page.
 *   AND makes sure the popover stays open on mouseover of the tooltip
 *
 */

!function ($) {

    "use strict"; // jshint ;_;

    /* STICKYOVER PUBLIC CLASS DEFINITION
     * =============================== */

    var Stickyover = function (element, options) {
        this.init('stickyover', element, options)
    };

    /* NOTE: STICKYOVER EXTENDS BOOTSTRAP-POPOVER.js
     ========================================== */

    Stickyover.prototype = $.extend({}, $.fn.popover.Constructor.prototype, {

        constructor: Stickyover
        , init: function (type, element, options) {
            this.type = type;
            this.$element = $(element);
            this.options = this.getOptions(options);
            this.enabled = true;

            this.$element.on('mouseenter' + '.' + this.type,
                this.options.selector,
                $.proxy(this.enter, this)
            );
            this.$element.on('mouseleave' + '.' + this.type,
                this.options.selector,
                $.proxy(this.leave, this)
            );

            var $tip = this.tip();
            $tip.on('mouseenter',
                this.options.selector,
                $.proxy(this.enter, this)
            );
            $tip.on('mouseleave',
                this.options.selector,
                $.proxy(this.unstick, this)
            );

            this.options.selector ?
                (this._options = $.extend({}, this.options, { trigger: 'manual', selector: '' })) :
                this.fixTitle()
        }
        , unstick: function (e) {
            if (this.timeout) clearTimeout(this.timeout);
            var $tip = this.tip();
            this.timeout = setTimeout(function() {
                $tip.detach();
            }, 100);
        }
        , enter: function (e) {
            if (this.timeout) clearTimeout(this.timeout);
            var self = $(e.currentTarget)[this.type](this._options).data(this.type);
            self.show();
        }
        , leave: function (e) {
            if (this.timeout) clearTimeout(this.timeout);
            var self = $(e.currentTarget)[this.type](this._options).data(this.type);
            this.timeout = setTimeout(function() {
                self.hide();
            }, 200);
        }
        , show: function () {
            var $tip
                , inside
                , pos
                , actualWidth
                , actualHeight
                , placement
                , tp
                , triggerOffset;

            if (this.hasContent() && this.enabled) {
                $tip = this.tip();
                this.setContent();

                if (this.options.animation) {
                    $tip.addClass('fade')
                }

                placement = typeof this.options.placement == 'function' ?
                    this.options.placement.call(this, $tip[0], this.$element[0]) :
                    this.options.placement;

                inside = /in/.test(placement);

                $tip
                    .detach()
                    .css({ top: 0, left: 0, display: 'block', position: 'absolute' });

                $(this.options.container).append($tip);

                pos = this.getPosition(inside);

                actualWidth = $tip[0].offsetWidth;
                actualHeight = $tip[0].offsetHeight;

                triggerOffset = this.$element.offset();

                var hiddenOffsetLeft = $(window).innerWidth() - Math.round(pos.left + actualWidth);
                var hiddenOffsetTop = $(window).innerHeight() - Math.round(pos.top + actualHeight);

                pos.top = triggerOffset.top;
                pos.left = triggerOffset.left;

                if (hiddenOffsetTop < 0) {
                    pos.top += hiddenOffsetTop/2 - pos.height - 20;
                    pos.left -= actualWidth + 5;
                } else if (hiddenOffsetLeft < 0) {
                    pos.top += 2;
                    pos.left += hiddenOffsetLeft - 20;
                } else {
                    pos.top += 2;
                }

                tp = {
                    top: pos.top + pos.height,
                    left: pos.left
                };

                $tip
                    .offset(tp)
                    .addClass(placement)
                    .addClass('in');
            }
        }
        , getTitle: function () {
            var title
                , $e = this.$element
                , o = this.options;

            title = (typeof o.title == 'function' ? o.title.call($e[0]) :  o.title)
                || $e.attr('data-title');

            return title;
        }
        , getContent: function () {
            var content
                , $e = this.$element
                , o = this.options;

            content = (typeof o.content == 'function' ? o.content.call($e[0]) :  o.content)
                || $e.attr('data-content');

            return content;
        }
    });

    /* STICKYOVER PLUGIN DEFINITION
     * ======================= */

    $.fn.stickyover = function (option) {
        return this.each(function () {
            var $this = $(this)
                , data = $this.data('stickyover')
                , options = typeof option == 'object' && option;
            if (!data) $this.data('stickyover', (data = new Stickyover(this, options)));
            if (typeof option == 'string') data[option]();
        });
    };

    $.fn.stickyover.Constructor = Stickyover;

    $.fn.stickyover.defaults = $.extend({} , $.fn.popover.defaults, {
        container: 'body'
    });

}(window.jQuery);
