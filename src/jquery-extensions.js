define(["jquery"], function ($) {
    var originalVal = $.fn.val;
    $.fn.val = function () {
        if (this.hasClass('fd-textarea') || this.hasClass('fd-input')) {
            return $.fn.text.apply(this, arguments);
        }
        return originalVal.apply(this, arguments);
    };
});
