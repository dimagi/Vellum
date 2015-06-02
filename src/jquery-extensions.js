(function ($) {
    var originalVal = $.fn.val;
    $.fn.val = function(){
        if (this.hasClass('fake-textarea') || this.hasClass('fake-input')) {
            return $.fn.text.apply(this, arguments);
        }
        var result = originalVal.apply(this,arguments);
        if(arguments.length>0)
            $(this).change();
        return result;
    };
})(jQuery);
