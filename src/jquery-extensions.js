define(["jquery"], function ($) {
    var originalVal = $.fn.val;
    $.fn.val = function(){
        if (this.hasClass('fake-textarea') || this.hasClass('fake-input')) {
            return $.fn.text.apply(this, arguments);
        }
        return originalVal.apply(this,arguments);
    };
});
