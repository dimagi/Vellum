define(["jquery"], function ($) {
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