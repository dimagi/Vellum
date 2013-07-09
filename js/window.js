if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

formdesigner.windowManager = (function () {
    "use strict";
    var that = {};

    that.init = function () {
        $(window).resize(that.adjustToWindow);
        $(document).scroll(that.adjustToWindow);

        that.minHeight = formdesigner.windowConfig.minHeight || 200;
        that.offset = {
            top: formdesigner.windowConfig.topOffset || $('#formdesigner').offset().top-1,
            bottom: formdesigner.windowConfig.bottomOffset || 0
        };

        that.adjustToWindow();
    };

    that.adjustToWindow = function () {
        var availableSpace = $(window).height() - that.getCurrentTopOffset(),
            position = (that.getCurrentTopOffset() === 0) ? 'fixed' : 'static',
            $formdesigner = $('#formdesigner');

        $formdesigner.css('height', availableSpace + 'px');
        $formdesigner.parent().css('height', availableSpace + 'px');

        $formdesigner.css('width', $formdesigner.parent().width());
        $formdesigner.css('position', position);

        var availableColumnSpace = availableSpace - ($('.fd-toolbar').outerHeight() + that.getCurrentBottomOffset()),
            columnHeight, scrollableContentHeight, treeHeight;

        columnHeight = Math.max(availableColumnSpace, that.minHeight);
        $('#formdesigner .fd-column').css('height', columnHeight + 'px');

        scrollableContentHeight = columnHeight - $('.fd-head').outerHeight();
        $('#formdesigner .fd-scrollable.fd-scrollable-main').css('height', scrollableContentHeight + 'px');

        treeHeight = scrollableContentHeight - $('#fd-question-tree-lang').outerHeight() - $('#fd-question-tree-actions').outerHeight();
        $('#formdesigner .fd-scrollable.fd-scrollable-tree').css('height', treeHeight + 'px');
    };

    that.getCurrentTopOffset = function () {
        var scrollPosition = $(window).scrollTop();
        return Math.min(Math.max(that.offset.top - scrollPosition, 0), that.offset.top);
    };

    that.getCurrentBottomOffset = function () {
        var scrollBottom = $(document).height() - ($(window).height() + $(document).scrollTop());
        return Math.min(Math.max(that.offset.bottom - scrollBottom, 0), that.offset.bottom);
    };

    return that;

})();
