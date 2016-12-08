define([
    "jquery",
    "underscore",
    "jquery.bootstrap"
], function ($, _) {

    $.fn.popAttr = function (name) {
        var removed = false,
            val = this.attr(name);
        try {
            this.removeAttr(name);
            removed = true;
        } catch (e) {
            // catch InvalidCharacterError due to \: in attribute name
        }
        if (removed && !_.isUndefined(val)) {
            if (!this[0].poppedAttributes) {
                this[0].poppedAttributes = {};
            }
            this[0].poppedAttributes[name] = val;
        }
        return val;
    };

    $.fn.stopLink = function() {
        // stops anchor tags from clicking through
        this.click(function (e) {
            e.preventDefault();
        });
        return this;
    };

    $.fn.fdHelp = function () {
        // creates a help popover, requires twitter bootstrap
        this.append($('<i />').addClass('fa fa-question-circle'))
            .popover({
                trigger: 'focus',
                html: true,
                container: 'body',
            }).click(function(e) {
                // If this help icon is inside a bigger click target, don't trigger the ancestor
                e.stopPropagation();
            });
        return this;
    };

    $.fn.clickExceptAfterDrag = function (callback) {
        var $el = $(this);
        callback.currentXY = [];
        function move(e) {
            callback.currentXY = [e.pageX, e.pageY];
            $el.off("mousemove", move);
        }
        function up(e) {
            var a = callback.currentXY[0] - e.pageX,
                b = callback.currentXY[1] - e.pageY,
                c = Math.sqrt(a*a + b*b);
            if (c < 3) {
                callback(e);
            }
            $el.off("mouseup", up);
        }
        $el.on("mousedown", function (e) {
            move(e);
            $el.on("mousemove", move).on("mouseup", up);
        });
    };

    if (!$.fn.disableSelection) {
        // stolen from jquery-ui
        // https://github.com/jquery/jquery-ui/blob/c2224bf/ui/core.js#L299-L315
        $.fn.extend( {
        	disableSelection: ( function() {
        		var eventType = "onselectstart" in document.createElement( "div" ) ?
        			"selectstart" :
        			"mousedown";

        		return function() {
        			return this.on( eventType + ".ui-disableSelection", function( event ) {
        				event.preventDefault();
        			} );
        		};
        	} )(),

        	enableSelection: function() {
        		return this.off( ".ui-disableSelection" );
        	}
        } );
    }
});
