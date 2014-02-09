if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

formdesigner.windowManager = (function () {
    "use strict";
    var that = {};

    that.init = function () {
        formdesigner.windowConfig = formdesigner.windowConfig || {};

        $(window).resize(that.adjustToWindow);
        $(document).scroll(that.adjustToWindow);

        that.minHeight = formdesigner.windowConfig.minHeight || 200;
        that.offset = {
            top: formdesigner.windowConfig.topOffset || $('#formdesigner').offset().top-1,
            bottom: formdesigner.windowConfig.bottomOffset || 0,
            left: formdesigner.windowConfig.leftOffset || $('#formdesigner').offset().left
        };

        that.adjustToWindow();
    };

    that.adjustToWindow = function () {
        var $fd = $("#formdesigner");
        if (!$fd.is(':visible')) {
            return;
        }

        var availableVertSpace = $(window).height() - that.getCurrentTopOffset(),
            availableHorizSpace,
            position = (that.getCurrentTopOffset() === 0) ? 'fixed' : 'static',
            $formdesigner = $('#fd-ui-container');


        // so that the document doesn't have to resize for the footer.
        $formdesigner.parent().css('height', availableVertSpace + 'px');

        availableVertSpace = availableVertSpace - that.getCurrentBottomOffset();
        $formdesigner.css('height', availableVertSpace + 'px');

        $formdesigner.css('width', $formdesigner.parent().width())
            .css('position', position)
            .css('left', that.getCurrentLeftOffset() + 'px');

        availableHorizSpace = $fd.width();

        var availableColumnSpace = availableVertSpace - $('.fd-toolbar').outerHeight(),
            panelHeight, columnHeight, treeHeight, questionPropHeight;

        panelHeight = Math.max(availableColumnSpace - 5, that.minHeight);
        columnHeight = panelHeight - $('.fd-head').outerHeight();
        treeHeight = columnHeight;

        $formdesigner.find('.fd-content').css('height', panelHeight + 'px');

        $formdesigner.find('.fd-content-left')
            .find('.fd-scrollable').css('height', treeHeight + 'px');

        $formdesigner.find('.fd-content-right')
            .css('width', availableHorizSpace - that.geLeftWidth() + 'px')
            .find('.fd-scrollable.full').css('height', columnHeight + 'px');

        $formdesigner.find('#fd-props-scrollable')
            .css('height', columnHeight - $('#fd-props-toolbar').outerHeight(true) + 'px');

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
        return (typeof that.offset.bottom === 'function') ? that.offset.bottom() : that.offset.bottom;
    };

    that.getCurrentLeftOffset = function () {
        var scrollLeft = $(window).scrollLeft(),
            offsetLeft = (typeof that.offset.left === 'function') ? that.offset.left() : that.offset.left;
        return Math.min(offsetLeft - scrollLeft, offsetLeft);
    };

    return that;

})();
