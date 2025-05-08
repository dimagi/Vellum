define([
    'jquery',
    'underscore',
    'vellum/templates/date_format_menu.html'
], function(
    $,
    _,
    date_format_menu
){
    function showMenu(x, y, callback, hideOnLeave) {
        var formats = {
                "": gettext("No Formatting"),
                "%e/%n/%y": "d/m/yy e.g. 30/1/14",
                "%a, %b %e, %Y": "ddd, mmm d, yyyy e.g. Thu, Jan 30, 2014"
            };
        var menu = $(date_format_menu({formats: formats}));
        $('body').append(menu);
        menu.find('li a').click(function () {
            var format = $(this).data("format");
            try {
                callback(format);
            } finally {
                menu.remove();
            }
            return false;
        });
        menu.css({'top': y, 'left': x}).show();
        if (hideOnLeave) {
            menu.mouseleave(function () {
                menu.fadeOut(400, function () { menu.remove(); });
            });
        }
    }

    return {
        showMenu: showMenu,
    };
});
