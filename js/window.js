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

        console.log(that.getCurrentBottomOffset());

        var availableQuestionSpace = availableSpace - ($('.fd-toolbar').outerHeight() + that.getCurrentBottomOffset()),
            questionHeight;

        questionHeight = (availableQuestionSpace > that.minHeight) ? availableQuestionSpace : that.minHeight;
        $('#formdesigner .fd-scrollable-content').css('height', questionHeight + 'px');
    };

    that.getCurrentTopOffset = function () {
        var scrollPosition = $(window).scrollTop();
        return Math.min(Math.max(that.offset.top - scrollPosition, 0), that.offset.top);
    };

    that.getCurrentBottomOffset = function () {
        var scrollBottom = $(document).height() - ($(window).height() + $(document).scrollTop());
        return Math.min(Math.max(that.offset.bottom - scrollBottom, 0), that.offset.bottom);
    };

    that.checkIfFixed = function (e) {

    };

    return that;

})();
