/*
 * Locked Questions plugin.
 *
 * Lets you lock questions by setting vellum:lock on their bind.
 *
 *    'node':  The question can't be deleted or renamed, or moved to a different
 *         parent.  Everything else can be changed.
 *    'value': The only thing that can be changed is itext IDs and itext values.
 *    'none': same as nothing
 *
 * Locking is not recursive; you must lock a node's entire hierarchy if you
 * really don't want it to be moved.
 *
 * Spec:
 * https://docs.google.com/document/d/1g4o3_OQfAYHjHdw7m7WcIAIRTomRV48yRQayL31jvIc
 */
formdesigner.plugins = formdesigner.plugins || {};

formdesigner.plugins.lock = function () {
    var locks;

    this.beforeParse = function (xml) {
        locks = {};
    };

    this.parseBindElement = function (el, path) {
        var locked = el.attr('vellum:lock');
        if (locked && locked !== 'none') {
            locks[path] = locked;
        }

        return el;
    };

    this.isPropertyLocked = function (mugPath, propertyPath) {
        var lock = locks[mugPath];
        if (!lock) { 
            return false; 
        }

        if ((lock === 'node' || lock === 'value') && 
            propertyPath === 'dataElement/nodeID') 
        {
            return true;
        } else if (lock === 'value' && propertyPath.indexOf('ItextID') === -1) {
            return true;
        }

        return false;
    };

    this.isMugPathMoveable = function (mugPath) {
        return !locks[mugPath];
    };

    this.isMugRemoveable = function (mugPath) {
        return !locks[mugPath];
    };

    this.isMugTypeChangeable = function (mugPath) {
        return locks[mugPath] !== 'value';
    };
};
