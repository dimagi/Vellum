/**
 * Just some useful JS tools and idioms
 */

if(typeof Object.create !== 'function') {
    Object.create = function(obj) {
        var Blank_Function = function(){};
        Blank_Function.prototype = obj;
        return new Blank_Function();
    };
}

if(typeof formdesigner === 'undefined'){
    var formdesigner = {};
}

formdesigner.util = (function(){
    var that = {};

    //VERIFY_RETURN_CODES:
    var VERIFY_CODES = {
            VERIFY_SUCCESS : 0,
            VERIFY_FAIL : 1,
            VERIFY_NO_DEFINITION : 2,
            VERIFY_ERROR : 3
    };
    that.VERIFY_CODES = VERIFY_CODES;

    var verify_mug = function(mug, definition){
        return VERIFY_CODES.VERIFY_ERROR; //not implemented yet!
    };
    that.verify_mug = verify_mug;

    //Simple Event Framework
    //Just run your object through this function to make it event aware
    //Take from 'JavaScript: The Good Parts'
    var eventuality = function (that) {
        var registry = {};
        that.fire = function (event) {
    // Fire an event on an object. The event can be either
    // a string containing the name of the event or an
    // object containing a type property containing the
    // name of the event. Handlers registered by the 'on'
    // method that match the event name will be invoked.
            var array,
                func,
                handler,
                i,
                type = typeof event === 'string' ?
                        event : event.type;
    // If an array of handlers exist for this event, then
    // loop through it and execute the handlers in order.
            if (registry.hasOwnProperty(type)) {
                array = registry[type];
                for (i = 0; i < array.length; i += 1) {
                    handler = array[i];
    // A handler record contains a method and an optional
    // array of parameters. If the method is a name, look
    // up the function.
                    func = handler.method;
                    if (typeof func === 'string') {
                        func = this[func];
                    }
    // Invoke a handler. If the record contained
    // parameters, then pass them. Otherwise, pass the
    // event object.
                    func.apply(this,
                        handler.parameters || [event]);
                }
            }
            return this;
        };
        that.on = function (type, method, parameters) {
    // Register an event. Make a handler record. Put it
    // in a handler array, making one if it doesn't yet
    // exist for this type.
            var handler = {
                method: method,
                parameters: parameters
            };
            if (registry.hasOwnProperty(type)) {
                registry[type].push(handler);
            } else {
                registry[type] = [handler];
            }
            return this;
        };
        return that;
    };
    that.eventuality = eventuality;

    /**
     * This method gives the passed object
     * a Unique Mug ID plus standardized method(s)
     * for accessing the ID.
     * @param that
     */
    var give_ufid = function(that){
        that.ufid = generate_guid();
    };
    that.give_ufid = give_ufid;

    var generate_guid = function() {
        // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
        var S4 = function() {
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        }
        return (S4()+S4()+S4()+S4()+S4()+S4()+S4()+S4());
    }

    /**
     * Shortcut func because I'm tired of typing this out all the time.
     * @param obj
     */
    var exists = function(obj){
        return typeof obj !== 'undefined';
    };
    that.exists = exists;

    return that;

}());