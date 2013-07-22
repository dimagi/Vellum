if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

formdesigner.windowManager = (function () {
    "use strict";
    var that = {};

    that.init = function () {
        $(window).resize(that.adjustToWindow);
        $(document).scroll(that.adjustToWindow);
         $('#fd-ui-container').css('top', '0px');

        that.minHeight = formdesigner.windowConfig.minHeight || 200;
        that.offset = {
            top: formdesigner.windowConfig.topOffset || $('#formdesigner').offset().top-1,
            bottom: formdesigner.windowConfig.bottomOffset || 0,
            left: formdesigner.windowConfig.leftOffset || $('#formdesigner').offset().left
        };

        that.adjustToWindow();
    };

    that.adjustToWindow = function () {
        var availableVertSpace = $(window).height() - that.getCurrentTopOffset(),
            availableHorizSpace = $('.hq-content').width(),
            position = (that.getCurrentTopOffset() === 0) ? 'fixed' : 'static',
            $formdesigner = $('#fd-ui-container');
        $formdesigner.css('height', availableVertSpace + 'px');
        $formdesigner.parent().css('height', availableVertSpace + 'px');

        $formdesigner.css('width', $formdesigner.parent().width())
            .css('position', position)
            .css('left', that.getCurrentLeftOffset() + 'px');

        var availableColumnSpace = availableVertSpace - ($('.fd-toolbar').outerHeight() + that.getCurrentBottomOffset()),
            panelHeight, columnHeight, treeHeight;

        panelHeight = Math.max(availableColumnSpace, that.minHeight);
        columnHeight = panelHeight - $('.fd-head').outerHeight();
        treeHeight = columnHeight - $('#fd-question-tree-lang').outerHeight() - $('#fd-question-tree-actions').outerHeight();

        $formdesigner.find('.fd-content').css('height', panelHeight + 'px');

        $formdesigner.find('.fd-content-left')
            .find('.fd-scrollable').css('height', treeHeight + 'px');

        $formdesigner.find('.fd-content-right')
            .css('width', availableHorizSpace - that.geLeftWidth() + 'px')
            .find('.fd-scrollable').css('height', columnHeight + 'px');

    };


    that.geLeftWidth = function () {
        return $('.fd-content-left').outerWidth() + $('.fd-content-divider').outerWidth(true) + 2;
    };

    that.getCurrentTopOffset = function () {
        var scrollPosition = $(window).scrollTop(),
            topOffset = (typeof that.offset.top === 'function') ? that.offset.top() : that.offset.top;
        return Math.min(Math.max(topOffset - scrollPosition, 0), topOffset);
    };

    that.getCurrentBottomOffset = function () {
        var scrollBottom = $(document).height() - ($(window).height() + $(document).scrollTop()),
            offsetBottom = (typeof that.offset.bottom === 'function') ? that.offset.bottom() : that.offset.bottom;
        return Math.min(Math.max(offsetBottom - scrollBottom, 0), offsetBottom);
    };

    that.getCurrentLeftOffset = function () {
        var scrollLeft = $(window).scrollLeft(),
            offsetLeft = (typeof that.offset.left === 'function') ? that.offset.left() : that.offset.left;
        return Math.min(offsetLeft - scrollLeft, offsetLeft);
    };

    return that;

})();
