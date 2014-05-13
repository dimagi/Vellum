/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-focus', function (Y, NAME) {

/**
 * Adds bubbling and delegation support to DOM events focus and blur.
 *
 * @module event
 * @submodule event-focus
 */
var Event    = Y.Event,

    YLang    = Y.Lang,

    isString = YLang.isString,

    arrayIndex = Y.Array.indexOf,

    useActivate = (function() {

        // Changing the structure of this test, so that it doesn't use inline JS in HTML,
        // which throws an exception in Win8 packaged apps, due to additional security restrictions:
        // http://msdn.microsoft.com/en-us/library/windows/apps/hh465380.aspx#differences

        var supported = false,
            doc = Y.config.doc,
            p;

        if (doc) {

            p = doc.createElement("p");
            p.setAttribute("onbeforeactivate", ";");

            // onbeforeactivate is a function in IE8+.
            // onbeforeactivate is a string in IE6,7 (unfortunate, otherwise we could have just checked for function below).
            // onbeforeactivate is a function in IE10, in a Win8 App environment (no exception running the test).

            // onbeforeactivate is undefined in Webkit/Gecko.
            // onbeforeactivate is a function in Webkit/Gecko if it's a supported event (e.g. onclick).

            supported = (p.onbeforeactivate !== undefined);
        }

        return supported;
    }());

function define(type, proxy, directEvent) {
    var nodeDataKey = '_' + type + 'Notifiers';

    Y.Event.define(type, {

        _useActivate : useActivate,

        _attach: function (el, notifier, delegate) {
            if (Y.DOM.isWindow(el)) {
                return Event._attach([type, function (e) {
                    notifier.fire(e);
                }, el]);
            } else {
                return Event._attach(
                    [proxy, this._proxy, el, this, notifier, delegate],
                    { capture: true });
            }
        },

        _proxy: function (e, notifier, delegate) {
            var target        = e.target,
                currentTarget = e.currentTarget,
                notifiers     = target.getData(nodeDataKey),
                yuid          = Y.stamp(currentTarget._node),
                defer         = (useActivate || target !== currentTarget),
                directSub;

            notifier.currentTarget = (delegate) ? target : currentTarget;
            notifier.container     = (delegate) ? currentTarget : null;

            // Maintain a list to handle subscriptions from nested
            // containers div#a>div#b>input #a.on(focus..) #b.on(focus..),
            // use one focus or blur subscription that fires notifiers from
            // #b then #a to emulate bubble sequence.
            if (!notifiers) {
                notifiers = {};
                target.setData(nodeDataKey, notifiers);

                // only subscribe to the element's focus if the target is
                // not the current target (
                if (defer) {
                    directSub = Event._attach(
                        [directEvent, this._notify, target._node]).sub;
                    directSub.once = true;
                }
            } else {
                // In old IE, defer is always true.  In capture-phase browsers,
                // The delegate subscriptions will be encountered first, which
                // will establish the notifiers data and direct subscription
                // on the node.  If there is also a direct subscription to the
                // node's focus/blur, it should not call _notify because the
                // direct subscription from the delegate sub(s) exists, which
                // will call _notify.  So this avoids _notify being called
                // twice, unnecessarily.
                defer = true;
            }

            if (!notifiers[yuid]) {
                notifiers[yuid] = [];
            }

            notifiers[yuid].push(notifier);

            if (!defer) {
                this._notify(e);
            }
        },

        _notify: function (e, container) {
            var currentTarget = e.currentTarget,
                notifierData  = currentTarget.getData(nodeDataKey),
                axisNodes     = currentTarget.ancestors(),
                doc           = currentTarget.get('ownerDocument'),
                delegates     = [],
                                // Used to escape loops when there are no more
                                // notifiers to consider
                count         = notifierData ?
                                    Y.Object.keys(notifierData).length :
                                    0,
                target, notifiers, notifier, yuid, match, tmp, i, len, sub, ret;

            // clear the notifications list (mainly for delegation)
            currentTarget.clearData(nodeDataKey);

            // Order the delegate subs by their placement in the parent axis
            axisNodes.push(currentTarget);
            // document.get('ownerDocument') returns null
            // which we'll use to prevent having duplicate Nodes in the list
            if (doc) {
                axisNodes.unshift(doc);
            }

            // ancestors() returns the Nodes from top to bottom
            axisNodes._nodes.reverse();

            if (count) {
                // Store the count for step 2
                tmp = count;
                axisNodes.some(function (node) {
                    var yuid      = Y.stamp(node),
                        notifiers = notifierData[yuid],
                        i, len;

                    if (notifiers) {
                        count--;
                        for (i = 0, len = notifiers.length; i < len; ++i) {
                            if (notifiers[i].handle.sub.filter) {
                                delegates.push(notifiers[i]);
                            }
                        }
                    }

                    return !count;
                });
                count = tmp;
            }

            // Walk up the parent axis, notifying direct subscriptions and
            // testing delegate filters.
            while (count && (target = axisNodes.shift())) {
                yuid = Y.stamp(target);

                notifiers = notifierData[yuid];

                if (notifiers) {
                    for (i = 0, len = notifiers.length; i < len; ++i) {
                        notifier = notifiers[i];
                        sub      = notifier.handle.sub;
                        match    = true;

                        e.currentTarget = target;

                        if (sub.filter) {
                            match = sub.filter.apply(target,
                                [target, e].concat(sub.args || []));

                            // No longer necessary to test against this
                            // delegate subscription for the nodes along
                            // the parent axis.
                            delegates.splice(
                                arrayIndex(delegates, notifier), 1);
                        }

                        if (match) {
                            // undefined for direct subs
                            e.container = notifier.container;
                            ret = notifier.fire(e);
                        }

                        if (ret === false || e.stopped === 2) {
                            break;
                        }
                    }

                    delete notifiers[yuid];
                    count--;
                }

                if (e.stopped !== 2) {
                    // delegates come after subs targeting this specific node
                    // because they would not normally report until they'd
                    // bubbled to the container node.
                    for (i = 0, len = delegates.length; i < len; ++i) {
                        notifier = delegates[i];
                        sub = notifier.handle.sub;

                        if (sub.filter.apply(target,
                            [target, e].concat(sub.args || []))) {

                            e.container = notifier.container;
                            e.currentTarget = target;
                            ret = notifier.fire(e);
                        }

                        if (ret === false || e.stopped === 2 ||
                            // If e.stopPropagation() is called, notify any
                            // delegate subs from the same container, but break
                            // once the container changes. This emulates
                            // delegate() behavior for events like 'click' which
                            // won't notify delegates higher up the parent axis.
                            (e.stopped && delegates[i+1] &&
                             delegates[i+1].container !== notifier.container)) {
                            break;
                        }
                    }
                }

                if (e.stopped) {
                    break;
                }
            }
        },

        on: function (node, sub, notifier) {
            sub.handle = this._attach(node._node, notifier);
        },

        detach: function (node, sub) {
            sub.handle.detach();
        },

        delegate: function (node, sub, notifier, filter) {
            if (isString(filter)) {
                sub.filter = function (target) {
                    return Y.Selector.test(target._node, filter,
                        node === target ? null : node._node);
                };
            }

            sub.handle = this._attach(node._node, notifier, true);
        },

        detachDelegate: function (node, sub) {
            sub.handle.detach();
        }
    }, true);
}

// For IE, we need to defer to focusin rather than focus because
// `el.focus(); doSomething();` executes el.onbeforeactivate, el.onactivate,
// el.onfocusin, doSomething, then el.onfocus.  All others support capture
// phase focus, which executes before doSomething.  To guarantee consistent
// behavior for this use case, IE's direct subscriptions are made against
// focusin so subscribers will be notified before js following el.focus() is
// executed.
if (useActivate) {
    //     name     capture phase       direct subscription
    define("focus", "beforeactivate",   "focusin");
    define("blur",  "beforedeactivate", "focusout");
} else {
    define("focus", "focus", "focus");
    define("blur",  "blur",  "blur");
}


}, '3.16.0', {"requires": ["event-synthetic"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('node-style', function (Y, NAME) {

(function(Y) {
/**
 * Extended Node interface for managing node styles.
 * @module node
 * @submodule node-style
 */

Y.mix(Y.Node.prototype, {
    /**
     * Sets a style property of the node.
     * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
     * @method setStyle
     * @param {String} attr The style attribute to set.
     * @param {String|Number} val The value.
     * @chainable
     */
    setStyle: function(attr, val) {
        Y.DOM.setStyle(this._node, attr, val);
        return this;
    },

    /**
     * Sets multiple style properties on the node.
     * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
     * @method setStyles
     * @param {Object} hash An object literal of property:value pairs.
     * @chainable
     */
    setStyles: function(hash) {
        Y.DOM.setStyles(this._node, hash);
        return this;
    },

    /**
     * Returns the style's current value.
     * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
     * @method getStyle
     * @for Node
     * @param {String} attr The style attribute to retrieve.
     * @return {String} The current value of the style property for the element.
     */

     getStyle: function(attr) {
        return Y.DOM.getStyle(this._node, attr);
     },

    /**
     * Returns the computed value for the given style property.
     * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
     * @method getComputedStyle
     * @param {String} attr The style attribute to retrieve.
     * @return {String} The computed value of the style property for the element.
     */
     getComputedStyle: function(attr) {
        return Y.DOM.getComputedStyle(this._node, attr);
     }
});

/**
 * Returns an array of values for each node.
 * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
 * @method getStyle
 * @for NodeList
 * @see Node.getStyle
 * @param {String} attr The style attribute to retrieve.
 * @return {Array} The current values of the style property for the element.
 */

/**
 * Returns an array of the computed value for each node.
 * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
 * @method getComputedStyle
 * @see Node.getComputedStyle
 * @param {String} attr The style attribute to retrieve.
 * @return {Array} The computed values for each node.
 */

/**
 * Sets a style property on each node.
 * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
 * @method setStyle
 * @see Node.setStyle
 * @param {String} attr The style attribute to set.
 * @param {String|Number} val The value.
 * @chainable
 */

/**
 * Sets multiple style properties on each node.
 * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
 * @method setStyles
 * @see Node.setStyles
 * @param {Object} hash An object literal of property:value pairs.
 * @chainable
 */

// These are broken out to handle undefined return (avoid false positive for
// chainable)

Y.NodeList.importMethod(Y.Node.prototype, ['getStyle', 'getComputedStyle', 'setStyle', 'setStyles']);
})(Y);
/**
 * @module node
 * @submodule node-base
 */

var Y_Node = Y.Node;

Y.mix(Y_Node.prototype, {
    /**
     * Makes the node visible.
     * If the "transition" module is loaded, show optionally
     * animates the showing of the node using either the default
     * transition effect ('fadeIn'), or the given named effect.
     * @method show
     * @for Node
     * @param {String} name A named Transition effect to use as the show effect.
     * @param {Object} config Options to use with the transition.
     * @param {Function} callback An optional function to run after the transition completes.
     * @chainable
     */
    show: function(callback) {
        callback = arguments[arguments.length - 1];
        this.toggleView(true, callback);
        return this;
    },

    /**
     * The implementation for showing nodes.
     * Default is to remove the hidden attribute and reset the CSS style.display property.
     * @method _show
     * @protected
     * @chainable
     */
    _show: function() {
        this.removeAttribute('hidden');

        // For back-compat we need to leave this in for browsers that
        // do not visually hide a node via the hidden attribute
        // and for users that check visibility based on style display.
        this.setStyle('display', '');

    },

    /**
    Returns whether the node is hidden by YUI or not. The hidden status is
    determined by the 'hidden' attribute and the value of the 'display' CSS
    property.

    @method _isHidden
    @return {Boolean} `true` if the node is hidden.
    @private
    **/
    _isHidden: function() {
        return  this.hasAttribute('hidden') || Y.DOM.getComputedStyle(this._node, 'display') === 'none';
    },

    /**
     * Displays or hides the node.
     * If the "transition" module is loaded, toggleView optionally
     * animates the toggling of the node using given named effect.
     * @method toggleView
     * @for Node
     * @param {Boolean} [on] An optional boolean value to force the node to be shown or hidden
     * @param {Function} [callback] An optional function to run after the transition completes.
     * @chainable
     */
    toggleView: function(on, callback) {
        this._toggleView.apply(this, arguments);
        return this;
    },

    _toggleView: function(on, callback) {
        callback = arguments[arguments.length - 1];

        // base on current state if not forcing
        if (typeof on != 'boolean') {
            on = (this._isHidden()) ? 1 : 0;
        }

        if (on) {
            this._show();
        }  else {
            this._hide();
        }

        if (typeof callback == 'function') {
            callback.call(this);
        }

        return this;
    },

    /**
     * Hides the node.
     * If the "transition" module is loaded, hide optionally
     * animates the hiding of the node using either the default
     * transition effect ('fadeOut'), or the given named effect.
     * @method hide
     * @param {String} name A named Transition effect to use as the show effect.
     * @param {Object} config Options to use with the transition.
     * @param {Function} callback An optional function to run after the transition completes.
     * @chainable
     */
    hide: function(callback) {
        callback = arguments[arguments.length - 1];
        this.toggleView(false, callback);
        return this;
    },

    /**
     * The implementation for hiding nodes.
     * Default is to set the hidden attribute to true and set the CSS style.display to 'none'.
     * @method _hide
     * @protected
     * @chainable
     */
    _hide: function() {
        this.setAttribute('hidden', 'hidden');

        // For back-compat we need to leave this in for browsers that
        // do not visually hide a node via the hidden attribute
        // and for users that check visibility based on style display.
        this.setStyle('display', 'none');
    }
});

Y.NodeList.importMethod(Y.Node.prototype, [
    /**
     * Makes each node visible.
     * If the "transition" module is loaded, show optionally
     * animates the showing of the node using either the default
     * transition effect ('fadeIn'), or the given named effect.
     * @method show
     * @param {String} name A named Transition effect to use as the show effect.
     * @param {Object} config Options to use with the transition.
     * @param {Function} callback An optional function to run after the transition completes.
     * @for NodeList
     * @chainable
     */
    'show',

    /**
     * Hides each node.
     * If the "transition" module is loaded, hide optionally
     * animates the hiding of the node using either the default
     * transition effect ('fadeOut'), or the given named effect.
     * @method hide
     * @param {String} name A named Transition effect to use as the show effect.
     * @param {Object} config Options to use with the transition.
     * @param {Function} callback An optional function to run after the transition completes.
     * @chainable
     */
    'hide',

    /**
     * Displays or hides each node.
     * If the "transition" module is loaded, toggleView optionally
     * animates the toggling of the nodes using given named effect.
     * @method toggleView
     * @param {Boolean} [on] An optional boolean value to force the nodes to be shown or hidden
     * @param {Function} [callback] An optional function to run after the transition completes.
     * @chainable
     */
    'toggleView'
]);


}, '3.16.0', {"requires": ["dom-style", "node-base"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-base', function (Y, NAME) {

/**
 * Provides the base Widget class, with HTML Parser support
 *
 * @module widget
 * @main widget
 */

/**
 * Provides the base Widget class
 *
 * @module widget
 * @submodule widget-base
 */
var L = Y.Lang,
    Node = Y.Node,

    ClassNameManager = Y.ClassNameManager,

    _getClassName = ClassNameManager.getClassName,
    _getWidgetClassName,

    _toInitialCap = Y.cached(function(str) {
        return str.substring(0, 1).toUpperCase() + str.substring(1);
    }),

    // K-Weight, IE GC optimizations
    CONTENT = "content",
    VISIBLE = "visible",
    HIDDEN = "hidden",
    DISABLED = "disabled",
    FOCUSED = "focused",
    WIDTH = "width",
    HEIGHT = "height",
    BOUNDING_BOX = "boundingBox",
    CONTENT_BOX = "contentBox",
    PARENT_NODE = "parentNode",
    OWNER_DOCUMENT = "ownerDocument",
    AUTO = "auto",
    SRC_NODE = "srcNode",
    BODY = "body",
    TAB_INDEX = "tabIndex",
    ID = "id",
    RENDER = "render",
    RENDERED = "rendered",
    DESTROYED = "destroyed",
    STRINGS = "strings",
    DIV = "<div></div>",
    CHANGE = "Change",
    LOADING = "loading",

    _UISET = "_uiSet",

    EMPTY_STR = "",
    EMPTY_FN = function() {},

    TRUE = true,
    FALSE = false,

    UI,
    ATTRS = {},
    UI_ATTRS = [VISIBLE, DISABLED, HEIGHT, WIDTH, FOCUSED, TAB_INDEX],

    WEBKIT = Y.UA.webkit,

    // Widget nodeid-to-instance map.
    _instances = {};

/**
 * A base class for widgets, providing:
 * <ul>
 *    <li>The render lifecycle method, in addition to the init and destroy
 *        lifecycle methods provide by Base</li>
 *    <li>Abstract methods to support consistent MVC structure across
 *        widgets: renderer, renderUI, bindUI, syncUI</li>
 *    <li>Support for common widget attributes, such as boundingBox, contentBox, visible,
 *        disabled, focused, strings</li>
 * </ul>
 *
 * @param config {Object} Object literal specifying widget configuration properties.
 *
 * @class Widget
 * @constructor
 * @extends Base
 */
function Widget(config) {

    // kweight
    var widget = this,
        parentNode,
        render,
        constructor = widget.constructor;

    widget._strs = {};
    widget._cssPrefix = constructor.CSS_PREFIX || _getClassName(constructor.NAME.toLowerCase());

    // We need a config for HTML_PARSER to work.
    config = config || {};

    Widget.superclass.constructor.call(widget, config);

    render = widget.get(RENDER);

    if (render) {
        // Render could be a node or boolean
        if (render !== TRUE) {
            parentNode = render;
        }
        widget.render(parentNode);
    }
}

/**
 * Static property provides a string to identify the class.
 * <p>
 * Currently used to apply class identifiers to the bounding box
 * and to classify events fired by the widget.
 * </p>
 *
 * @property NAME
 * @type String
 * @static
 */
Widget.NAME = "widget";

/**
 * Constant used to identify state changes originating from
 * the DOM (as opposed to the JavaScript model).
 *
 * @property UI_SRC
 * @type String
 * @static
 * @final
 */
UI = Widget.UI_SRC = "ui";

/**
 * Static property used to define the default attribute
 * configuration for the Widget.
 *
 * @property ATTRS
 * @type Object
 * @static
 */
Widget.ATTRS = ATTRS;

// Trying to optimize kweight by setting up attrs this way saves about 0.4K min'd

/**
 * @attribute id
 * @writeOnce
 * @default Generated using guid()
 * @type String
 */

ATTRS[ID] = {
    valueFn: "_guid",
    writeOnce: TRUE
};

/**
 * Flag indicating whether or not this Widget
 * has been through the render lifecycle phase.
 *
 * @attribute rendered
 * @readOnly
 * @default false
 * @type boolean
 */
ATTRS[RENDERED] = {
    value:FALSE,
    readOnly: TRUE
};

/**
 * @attribute boundingBox
 * @description The outermost DOM node for the Widget, used for sizing and positioning
 * of a Widget as well as a containing element for any decorator elements used
 * for skinning.
 * @type String | Node
 * @writeOnce
 */
ATTRS[BOUNDING_BOX] = {
    valueFn:"_defaultBB",
    setter: "_setBB",
    writeOnce: TRUE
};

/**
 * @attribute contentBox
 * @description A DOM node that is a direct descendant of a Widget's bounding box that
 * houses its content.
 * @type String | Node
 * @writeOnce
 */
ATTRS[CONTENT_BOX] = {
    valueFn:"_defaultCB",
    setter: "_setCB",
    writeOnce: TRUE
};

/**
 * @attribute tabIndex
 * @description Number (between -32767 to 32767) indicating the widget's
 * position in the default tab flow.  The value is used to set the
 * "tabIndex" attribute on the widget's bounding box.  Negative values allow
 * the widget to receive DOM focus programmatically (by calling the focus
 * method), while being removed from the default tab flow.  A value of
 * null removes the "tabIndex" attribute from the widget's bounding box.
 * @type Number
 * @default null
 */
ATTRS[TAB_INDEX] = {
    value: null,
    validator: "_validTabIndex"
};

/**
 * @attribute focused
 * @description Boolean indicating if the Widget, or one of its descendants,
 * has focus.
 * @readOnly
 * @default false
 * @type boolean
 */
ATTRS[FOCUSED] = {
    value: FALSE,
    readOnly:TRUE
};

/**
 * @attribute disabled
 * @description Boolean indicating if the Widget should be disabled. The disabled implementation
 * is left to the specific classes extending widget.
 * @default false
 * @type boolean
 */
ATTRS[DISABLED] = {
    value: FALSE
};

/**
 * @attribute visible
 * @description Boolean indicating whether or not the Widget is visible.
 * @default TRUE
 * @type boolean
 */
ATTRS[VISIBLE] = {
    value: TRUE
};

/**
 * @attribute height
 * @description String with units, or number, representing the height of the Widget. If a number is provided,
 * the default unit, defined by the Widgets DEF_UNIT, property is used.
 * @default EMPTY_STR
 * @type {String | Number}
 */
ATTRS[HEIGHT] = {
    value: EMPTY_STR
};

/**
 * @attribute width
 * @description String with units, or number, representing the width of the Widget. If a number is provided,
 * the default unit, defined by the Widgets DEF_UNIT, property is used.
 * @default EMPTY_STR
 * @type {String | Number}
 */
ATTRS[WIDTH] = {
    value: EMPTY_STR
};

/**
 * @attribute strings
 * @description Collection of strings used to label elements of the Widget's UI.
 * @default null
 * @type Object
 */
ATTRS[STRINGS] = {
    value: {},
    setter: "_strSetter",
    getter: "_strGetter"
};

/**
 * Whether or not to render the widget automatically after init, and optionally, to which parent node.
 *
 * @attribute render
 * @type boolean | Node
 * @writeOnce
 */
ATTRS[RENDER] = {
    value:FALSE,
    writeOnce:TRUE
};

/**
 * The css prefix which the static Widget.getClassName method should use when constructing class names
 *
 * @property CSS_PREFIX
 * @type String
 * @default Widget.NAME.toLowerCase()
 * @private
 * @static
 */
Widget.CSS_PREFIX = _getClassName(Widget.NAME.toLowerCase());

/**
 * Generate a standard prefixed classname for the Widget, prefixed by the default prefix defined
 * by the <code>Y.config.classNamePrefix</code> attribute used by <code>ClassNameManager</code> and
 * <code>Widget.NAME.toLowerCase()</code> (e.g. "yui-widget-xxxxx-yyyyy", based on default values for
 * the prefix and widget class name).
 * <p>
 * The instance based version of this method can be used to generate standard prefixed classnames,
 * based on the instances NAME, as opposed to Widget.NAME. This method should be used when you
 * need to use a constant class name across different types instances.
 * </p>
 * @method getClassName
 * @param {String*} args* 0..n strings which should be concatenated, using the default separator defined by ClassNameManager, to create the class name
 */
Widget.getClassName = function() {
    // arguments needs to be array'fied to concat
    return _getClassName.apply(ClassNameManager, [Widget.CSS_PREFIX].concat(Y.Array(arguments), true));
};

_getWidgetClassName = Widget.getClassName;

/**
 * Returns the widget instance whose bounding box contains, or is, the given node.
 * <p>
 * In the case of nested widgets, the nearest bounding box ancestor is used to
 * return the widget instance.
 * </p>
 * @method getByNode
 * @static
 * @param node {Node | String} The node for which to return a Widget instance. If a selector
 * string is passed in, which selects more than one node, the first node found is used.
 * @return {Widget} Widget instance, or null if not found.
 */
Widget.getByNode = function(node) {
    var widget,
        widgetMarker = _getWidgetClassName();

    node = Node.one(node);
    if (node) {
        node = node.ancestor("." + widgetMarker, true);
        if (node) {
            widget = _instances[Y.stamp(node, true)];
        }
    }

    return widget || null;
};

Y.extend(Widget, Y.Base, {

    /**
     * Returns a class name prefixed with the the value of the
     * <code>YUI.config.classNamePrefix</code> attribute + the instances <code>NAME</code> property.
     * Uses <code>YUI.config.classNameDelimiter</code> attribute to delimit the provided strings.
     * e.g.
     * <code>
     * <pre>
     *    // returns "yui-slider-foo-bar", for a slider instance
     *    var scn = slider.getClassName('foo','bar');
     *
     *    // returns "yui-overlay-foo-bar", for an overlay instance
     *    var ocn = overlay.getClassName('foo','bar');
     * </pre>
     * </code>
     *
     * @method getClassName
     * @param {String} [classnames*] One or more classname bits to be joined and prefixed
     */
    getClassName: function () {
        return _getClassName.apply(ClassNameManager, [this._cssPrefix].concat(Y.Array(arguments), true));
    },

    /**
     * Initializer lifecycle implementation for the Widget class. Registers the
     * widget instance, and runs through the Widget's HTML_PARSER definition.
     *
     * @method initializer
     * @protected
     * @param  config {Object} Configuration object literal for the widget
     */
    initializer: function(config) {

        var bb = this.get(BOUNDING_BOX);

        if (bb instanceof Node) {
            this._mapInstance(Y.stamp(bb));
        }

        /**
         * Notification event, which widget implementations can fire, when
         * they change the content of the widget. This event has no default
         * behavior and cannot be prevented, so the "on" or "after"
         * moments are effectively equivalent (with on listeners being invoked before
         * after listeners).
         *
         * @event widget:contentUpdate
         * @preventable false
         * @param {EventFacade} e The Event Facade
         */
    },

    /**
     * Utility method used to add an entry to the boundingBox id to instance map.
     *
     * This method can be used to populate the instance with lazily created boundingBox Node references.
     *
     * @method _mapInstance
     * @param {String} The boundingBox id
     * @protected
     */
    _mapInstance : function(id) {
        _instances[id] = this;
    },

    /**
     * Destructor lifecycle implementation for the Widget class. Purges events attached
     * to the bounding box and content box, removes them from the DOM and removes
     * the Widget from the list of registered widgets.
     *
     * @method destructor
     * @protected
     */
    destructor: function() {

        var boundingBox = this.get(BOUNDING_BOX),
            bbGuid;

        if (boundingBox instanceof Node) {
            bbGuid = Y.stamp(boundingBox,true);

            if (bbGuid in _instances) {
                delete _instances[bbGuid];
            }

            this._destroyBox();
        }
    },

    /**
     * <p>
     * Destroy lifecycle method. Fires the destroy
     * event, prior to invoking destructors for the
     * class hierarchy.
     *
     * Overrides Base's implementation, to support arguments to destroy
     * </p>
     * <p>
     * Subscribers to the destroy
     * event can invoke preventDefault on the event object, to prevent destruction
     * from proceeding.
     * </p>
     * @method destroy
     * @param destroyAllNodes {Boolean} If true, all nodes contained within the Widget are
     * removed and destroyed. Defaults to false due to potentially high run-time cost.
     * @return {Widget} A reference to this object
     * @chainable
     */
    destroy: function(destroyAllNodes) {
        this._destroyAllNodes = destroyAllNodes;
        return Widget.superclass.destroy.apply(this);
    },

    /**
     * Removes and destroys the widgets rendered boundingBox, contentBox,
     * and detaches bound UI events.
     *
     * @method _destroyBox
     * @protected
     */
    _destroyBox : function() {

        var boundingBox = this.get(BOUNDING_BOX),
            contentBox = this.get(CONTENT_BOX),
            deep = this._destroyAllNodes,
            same;

        same = boundingBox && boundingBox.compareTo(contentBox);

        if (this.UI_EVENTS) {
            this._destroyUIEvents();
        }

        this._unbindUI(boundingBox);

        if (contentBox) {
            if (deep) {
                contentBox.empty();
            }
            contentBox.remove(TRUE);
        }

        if (!same) {
            if (deep) {
                boundingBox.empty();
            }
            boundingBox.remove(TRUE);
        }
    },

    /**
     * Establishes the initial DOM for the widget. Invoking this
     * method will lead to the creating of all DOM elements for
     * the widget (or the manipulation of existing DOM elements
     * for the progressive enhancement use case).
     * <p>
     * This method should only be invoked once for an initialized
     * widget.
     * </p>
     * <p>
     * It delegates to the widget specific renderer method to do
     * the actual work.
     * </p>
     *
     * @method render
     * @chainable
     * @final
     * @param  parentNode {Object | String} Optional. The Node under which the
     * Widget is to be rendered. This can be a Node instance or a CSS selector string.
     * <p>
     * If the selector string returns more than one Node, the first node will be used
     * as the parentNode. NOTE: This argument is required if both the boundingBox and contentBox
     * are not currently in the document. If it's not provided, the Widget will be rendered
     * to the body of the current document in this case.
     * </p>
     */
    render: function(parentNode) {

        if (!this.get(DESTROYED) && !this.get(RENDERED)) {
             /**
              * Lifecycle event for the render phase, fired prior to rendering the UI
              * for the widget (prior to invoking the widget's renderer method).
              * <p>
              * Subscribers to the "on" moment of this event, will be notified
              * before the widget is rendered.
              * </p>
              * <p>
              * Subscribers to the "after" moment of this event, will be notified
              * after rendering is complete.
              * </p>
              *
              * @event render
              * @preventable _defRenderFn
              * @param {EventFacade} e The Event Facade
              */
            this.publish(RENDER, {
                queuable:FALSE,
                fireOnce:TRUE,
                defaultTargetOnly:TRUE,
                defaultFn: this._defRenderFn
            });

            this.fire(RENDER, {parentNode: (parentNode) ? Node.one(parentNode) : null});
        }
        return this;
    },

    /**
     * Default render handler
     *
     * @method _defRenderFn
     * @protected
     * @param {EventFacade} e The Event object
     * @param {Node} parentNode The parent node to render to, if passed in to the <code>render</code> method
     */
    _defRenderFn : function(e) {
        this._parentNode = e.parentNode;

        this.renderer();
        this._set(RENDERED, TRUE);

        this._removeLoadingClassNames();
    },

    /**
     * Creates DOM (or manipulates DOM for progressive enhancement)
     * This method is invoked by render() and is not chained
     * automatically for the class hierarchy (unlike initializer, destructor)
     * so it should be chained manually for subclasses if required.
     *
     * @method renderer
     * @protected
     */
    renderer: function() {
        // kweight
        var widget = this;

        widget._renderUI();
        widget.renderUI();

        widget._bindUI();
        widget.bindUI();

        widget._syncUI();
        widget.syncUI();
    },

    /**
     * Configures/Sets up listeners to bind Widget State to UI/DOM
     *
     * This method is not called by framework and is not chained
     * automatically for the class hierarchy.
     *
     * @method bindUI
     * @protected
     */
    bindUI: EMPTY_FN,

    /**
     * Adds nodes to the DOM
     *
     * This method is not called by framework and is not chained
     * automatically for the class hierarchy.
     *
     * @method renderUI
     * @protected
     */
    renderUI: EMPTY_FN,

    /**
     * Refreshes the rendered UI, based on Widget State
     *
     * This method is not called by framework and is not chained
     * automatically for the class hierarchy.
     *
     * @method syncUI
     * @protected
     *
     */
    syncUI: EMPTY_FN,

    /**
     * @method hide
     * @description Hides the Widget by setting the "visible" attribute to "false".
     * @chainable
     */
    hide: function() {
        return this.set(VISIBLE, FALSE);
    },

    /**
     * @method show
     * @description Shows the Widget by setting the "visible" attribute to "true".
     * @chainable
     */
    show: function() {
        return this.set(VISIBLE, TRUE);
    },

    /**
     * @method focus
     * @description Causes the Widget to receive the focus by setting the "focused"
     * attribute to "true".
     * @chainable
     */
    focus: function () {
        return this._set(FOCUSED, TRUE);
    },

    /**
     * @method blur
     * @description Causes the Widget to lose focus by setting the "focused" attribute
     * to "false"
     * @chainable
     */
    blur: function () {
        return this._set(FOCUSED, FALSE);
    },

    /**
     * @method enable
     * @description Set the Widget's "disabled" attribute to "false".
     * @chainable
     */
    enable: function() {
        return this.set(DISABLED, FALSE);
    },

    /**
     * @method disable
     * @description Set the Widget's "disabled" attribute to "true".
     * @chainable
     */
    disable: function() {
        return this.set(DISABLED, TRUE);
    },

    /**
     * @method _uiSizeCB
     * @protected
     * @param {boolean} expand
     */
    _uiSizeCB : function(expand) {
        this.get(CONTENT_BOX).toggleClass(_getWidgetClassName(CONTENT, "expanded"), expand);
    },

    /**
     * Helper method to collect the boundingBox and contentBox and append to the provided parentNode, if not
     * already a child. The owner document of the boundingBox, or the owner document of the contentBox will be used
     * as the document into which the Widget is rendered if a parentNode is node is not provided. If both the boundingBox and
     * the contentBox are not currently in the document, and no parentNode is provided, the widget will be rendered
     * to the current document's body.
     *
     * @method _renderBox
     * @private
     * @param {Node} parentNode The parentNode to render the widget to. If not provided, and both the boundingBox and
     * the contentBox are not currently in the document, the widget will be rendered to the current document's body.
     */
    _renderBox: function(parentNode) {

        // TODO: Performance Optimization [ More effective algo to reduce Node refs, compares, replaces? ]

        var widget = this, // kweight
            contentBox = widget.get(CONTENT_BOX),
            boundingBox = widget.get(BOUNDING_BOX),
            srcNode = widget.get(SRC_NODE),
            defParentNode = widget.DEF_PARENT_NODE,

            doc = (srcNode && srcNode.get(OWNER_DOCUMENT)) || boundingBox.get(OWNER_DOCUMENT) || contentBox.get(OWNER_DOCUMENT);

        // If srcNode (assume it's always in doc), have contentBox take its place (widget render responsible for re-use of srcNode contents)
        if (srcNode && !srcNode.compareTo(contentBox) && !contentBox.inDoc(doc)) {
            srcNode.replace(contentBox);
        }

        if (!boundingBox.compareTo(contentBox.get(PARENT_NODE)) && !boundingBox.compareTo(contentBox)) {
            // If contentBox box is already in the document, have boundingBox box take it's place
            if (contentBox.inDoc(doc)) {
                contentBox.replace(boundingBox);
            }
            boundingBox.appendChild(contentBox);
        }

        parentNode = parentNode || (defParentNode && Node.one(defParentNode));

        if (parentNode) {
            parentNode.appendChild(boundingBox);
        } else if (!boundingBox.inDoc(doc)) {
            Node.one(BODY).insert(boundingBox, 0);
        }
    },

    /**
     * Setter for the boundingBox attribute
     *
     * @method _setBB
     * @private
     * @param {Node|String} node
     * @return Node
     */
    _setBB: function(node) {
        return this._setBox(this.get(ID), node, this.BOUNDING_TEMPLATE, true);
    },

    /**
     * Setter for the contentBox attribute
     *
     * @method _setCB
     * @private
     * @param {Node|String} node
     * @return Node
     */
    _setCB: function(node) {
        return (this.CONTENT_TEMPLATE === null) ? this.get(BOUNDING_BOX) : this._setBox(null, node, this.CONTENT_TEMPLATE, false);
    },

    /**
     * Returns the default value for the boundingBox attribute.
     *
     * For the Widget class, this will most commonly be null (resulting in a new
     * boundingBox node instance being created), unless a srcNode was provided
     * and CONTENT_TEMPLATE is null, in which case it will be srcNode.
     * This behavior was introduced in 3.16.0 to accomodate single-box widgets
     * whose BB & CB both point to srcNode (e.g. Y.Button).
     *
     * @method _defaultBB
     * @protected
     */
    _defaultBB : function() {
        var node = this.get(SRC_NODE),
            nullCT = (this.CONTENT_TEMPLATE === null);

        return ((node && nullCT) ? node : null);
    },

    /**
     * Returns the default value for the contentBox attribute.
     *
     * For the Widget class, this will be the srcNode if provided, otherwise null (resulting in
     * a new contentBox node instance being created)
     *
     * @method _defaultCB
     * @protected
     */
    _defaultCB : function(node) {
        return this.get(SRC_NODE) || null;
    },

    /**
     * Helper method to set the bounding/content box, or create it from
     * the provided template if not found.
     *
     * @method _setBox
     * @private
     *
     * @param {String} id The node's id attribute
     * @param {Node|String} node The node reference
     * @param {String} template HTML string template for the node
     * @param {boolean} isBounding true if this is the boundingBox, false if it's the contentBox
     * @return {Node} The node
     */
    _setBox : function(id, node, template, isBounding) {

        node = Node.one(node);

        if (!node) {
            node = Node.create(template);

            if (isBounding) {
                this._bbFromTemplate = true;
            } else {
                this._cbFromTemplate = true;
            }
        }

        if (!node.get(ID)) {
            node.set(ID, id || Y.guid());
        }

        return node;
    },

    /**
     * Initializes the UI state for the Widget's bounding/content boxes.
     *
     * @method _renderUI
     * @protected
     */
    _renderUI: function() {
        this._renderBoxClassNames();
        this._renderBox(this._parentNode);
    },

    /**
     * Applies standard class names to the boundingBox and contentBox
     *
     * @method _renderBoxClassNames
     * @protected
     */
    _renderBoxClassNames : function() {
        var classes = this._getClasses(),
            cl,
            boundingBox = this.get(BOUNDING_BOX),
            i;

        boundingBox.addClass(_getWidgetClassName());

        // Start from Widget Sub Class
        for (i = classes.length-3; i >= 0; i--) {
            cl = classes[i];
            boundingBox.addClass(cl.CSS_PREFIX || _getClassName(cl.NAME.toLowerCase()));
        }

        // Use instance based name for content box
        this.get(CONTENT_BOX).addClass(this.getClassName(CONTENT));
    },

    /**
     * Removes class names representative of the widget's loading state from
     * the boundingBox.
     *
     * @method _removeLoadingClassNames
     * @protected
     */
    _removeLoadingClassNames: function () {

        var boundingBox = this.get(BOUNDING_BOX),
            contentBox = this.get(CONTENT_BOX),
            instClass = this.getClassName(LOADING),
            widgetClass = _getWidgetClassName(LOADING);

        boundingBox.removeClass(widgetClass)
                   .removeClass(instClass);

        contentBox.removeClass(widgetClass)
                  .removeClass(instClass);
    },

    /**
     * Sets up DOM and CustomEvent listeners for the widget.
     *
     * @method _bindUI
     * @protected
     */
    _bindUI: function() {
        this._bindAttrUI(this._UI_ATTRS.BIND);
        this._bindDOM();
    },

    /**
     * @method _unbindUI
     * @protected
     */
    _unbindUI : function(boundingBox) {
        this._unbindDOM(boundingBox);
    },

    /**
     * Sets up DOM listeners, on elements rendered by the widget.
     *
     * @method _bindDOM
     * @protected
     */
    _bindDOM : function() {
        var oDocument = this.get(BOUNDING_BOX).get(OWNER_DOCUMENT),
            focusHandle = Widget._hDocFocus;

        // Shared listener across all Widgets.
        if (!focusHandle) {
            focusHandle = Widget._hDocFocus = oDocument.on("focus", this._onDocFocus, this);
            focusHandle.listeners = {
                count: 0
            };
        }

        focusHandle.listeners[Y.stamp(this, true)] = true;
        focusHandle.listeners.count++;

        //	Fix for Webkit:
        //	Document doesn't receive focus in Webkit when the user mouses
        //	down on it, so the "focused" attribute won't get set to the
        //	correct value. Keeping this instance based for now, potential better performance.
        //  Otherwise we'll end up looking up widgets from the DOM on every mousedown.
        if (WEBKIT){
            this._hDocMouseDown = oDocument.on("mousedown", this._onDocMouseDown, this);
        }
    },

    /**
     * @method _unbindDOM
     * @protected
     */
    _unbindDOM : function(boundingBox) {

        var focusHandle = Widget._hDocFocus,
            yuid = Y.stamp(this, true),
            focusListeners,
            mouseHandle = this._hDocMouseDown;

        if (focusHandle) {

            focusListeners = focusHandle.listeners;

            if (focusListeners[yuid]) {
                delete focusListeners[yuid];
                focusListeners.count--;
            }

            if (focusListeners.count === 0) {
                focusHandle.detach();
                Widget._hDocFocus = null;
            }
        }

        if (WEBKIT && mouseHandle) {
            mouseHandle.detach();
        }
    },

    /**
     * Updates the widget UI to reflect the attribute state.
     *
     * @method _syncUI
     * @protected
     */
    _syncUI: function() {
        this._syncAttrUI(this._UI_ATTRS.SYNC);
    },

    /**
     * Sets the height on the widget's bounding box element
     *
     * @method _uiSetHeight
     * @protected
     * @param {String | Number} val
     */
    _uiSetHeight: function(val) {
        this._uiSetDim(HEIGHT, val);
        this._uiSizeCB((val !== EMPTY_STR && val !== AUTO));
    },

    /**
     * Sets the width on the widget's bounding box element
     *
     * @method _uiSetWidth
     * @protected
     * @param {String | Number} val
     */
    _uiSetWidth: function(val) {
        this._uiSetDim(WIDTH, val);
    },

    /**
     * @method _uiSetDim
     * @private
     * @param {String} dim The dimension - "width" or "height"
     * @param {Number | String} val The value to set
     */
    _uiSetDim: function(dimension, val) {
        this.get(BOUNDING_BOX).setStyle(dimension, L.isNumber(val) ? val + this.DEF_UNIT : val);
    },

    /**
     * Sets the visible state for the UI
     *
     * @method _uiSetVisible
     * @protected
     * @param {boolean} val
     */
    _uiSetVisible: function(val) {
        this.get(BOUNDING_BOX).toggleClass(this.getClassName(HIDDEN), !val);
    },

    /**
     * Sets the disabled state for the UI
     *
     * @method _uiSetDisabled
     * @protected
     * @param {boolean} val
     */
    _uiSetDisabled: function(val) {
        this.get(BOUNDING_BOX).toggleClass(this.getClassName(DISABLED), val);
    },

    /**
     * Sets the focused state for the UI
     *
     * @method _uiSetFocused
     * @protected
     * @param {boolean} val
     * @param {string} src String representing the source that triggered an update to
     * the UI.
     */
    _uiSetFocused: function(val, src) {
         var boundingBox = this.get(BOUNDING_BOX);
         boundingBox.toggleClass(this.getClassName(FOCUSED), val);

         if (src !== UI) {
            if (val) {
                boundingBox.focus();
            } else {
                boundingBox.blur();
            }
         }
    },

    /**
     * Set the tabIndex on the widget's rendered UI
     *
     * @method _uiSetTabIndex
     * @protected
     * @param Number
     */
    _uiSetTabIndex: function(index) {
        var boundingBox = this.get(BOUNDING_BOX);

        if (L.isNumber(index)) {
            boundingBox.set(TAB_INDEX, index);
        } else {
            boundingBox.removeAttribute(TAB_INDEX);
        }
    },

    /**
     * @method _onDocMouseDown
     * @description "mousedown" event handler for the owner document of the
     * widget's bounding box.
     * @protected
     * @param {EventFacade} evt The event facade for the DOM focus event
     */
    _onDocMouseDown: function (evt) {
        if (this._domFocus) {
            this._onDocFocus(evt);
        }
    },

    /**
     * DOM focus event handler, used to sync the state of the Widget with the DOM
     *
     * @method _onDocFocus
     * @protected
     * @param {EventFacade} evt The event facade for the DOM focus event
     */
    _onDocFocus: function (evt) {
        var widget = Widget.getByNode(evt.target),
            activeWidget = Widget._active;

        if (activeWidget && (activeWidget !== widget)) {
            activeWidget._domFocus = false;
            activeWidget._set(FOCUSED, false, {src:UI});

            Widget._active = null;
        }

        if (widget) {
            widget._domFocus = true;
            widget._set(FOCUSED, true, {src:UI});

            Widget._active = widget;
        }
    },

    /**
     * Generic toString implementation for all widgets.
     *
     * @method toString
     * @return {String} The default string value for the widget [ displays the NAME of the instance, and the unique id ]
     */
    toString: function() {
        // Using deprecated name prop for kweight squeeze.
        return this.name + "[" + this.get(ID) + "]";
    },

    /**
     * Default unit to use for dimension values
     *
     * @property DEF_UNIT
     * @type String
     */
    DEF_UNIT : "px",

    /**
     * Default node to render the bounding box to. If not set,
     * will default to the current document body.
     *
     * @property DEF_PARENT_NODE
     * @type String | Node
     */
    DEF_PARENT_NODE : null,

    /**
     * Property defining the markup template for content box. If your Widget doesn't
     * need the dual boundingBox/contentBox structure, set CONTENT_TEMPLATE to null,
     * and contentBox and boundingBox will both point to the same Node.
     *
     * @property CONTENT_TEMPLATE
     * @type String
     */
    CONTENT_TEMPLATE : DIV,

    /**
     * Property defining the markup template for bounding box.
     *
     * @property BOUNDING_TEMPLATE
     * @type String
     */
    BOUNDING_TEMPLATE : DIV,

    /**
     * @method _guid
     * @protected
     */
    _guid : function() {
        return Y.guid();
    },

    /**
     * @method _validTabIndex
     * @protected
     * @param {Number} tabIndex
     */
    _validTabIndex : function (tabIndex) {
        return (L.isNumber(tabIndex) || L.isNull(tabIndex));
    },

    /**
     * Binds after listeners for the list of attributes provided
     *
     * @method _bindAttrUI
     * @private
     * @param {Array} attrs
     */
    _bindAttrUI : function(attrs) {
        var i,
            l = attrs.length;

        for (i = 0; i < l; i++) {
            this.after(attrs[i] + CHANGE, this._setAttrUI);
        }
    },

    /**
     * Invokes the _uiSet&#61;ATTR NAME&#62; method for the list of attributes provided
     *
     * @method _syncAttrUI
     * @private
     * @param {Array} attrs
     */
    _syncAttrUI : function(attrs) {
        var i, l = attrs.length, attr;
        for (i = 0; i < l; i++) {
            attr = attrs[i];
            this[_UISET + _toInitialCap(attr)](this.get(attr));
        }
    },

    /**
     * @method _setAttrUI
     * @private
     * @param {EventFacade} e
     */
    _setAttrUI : function(e) {
        if (e.target === this) {
            this[_UISET + _toInitialCap(e.attrName)](e.newVal, e.src);
        }
    },

    /**
     * The default setter for the strings attribute. Merges partial sets
     * into the full string set, to allow users to partial sets of strings
     *
     * @method _strSetter
     * @protected
     * @param {Object} strings
     * @return {String} The full set of strings to set
     */
    _strSetter : function(strings) {
        return Y.merge(this.get(STRINGS), strings);
    },

    /**
     * Helper method to get a specific string value
     *
     * @deprecated Used by deprecated WidgetLocale implementations.
     * @method getString
     * @param {String} key
     * @return {String} The string
     */
    getString : function(key) {
        return this.get(STRINGS)[key];
    },

    /**
     * Helper method to get the complete set of strings for the widget
     *
     * @deprecated  Used by deprecated WidgetLocale implementations.
     * @method getStrings
     * @param {String} key
     * @return {String} The strings
     */
    getStrings : function() {
        return this.get(STRINGS);
    },

    /**
     * The lists of UI attributes to bind and sync for widget's _bindUI and _syncUI implementations
     *
     * @property _UI_ATTRS
     * @type Object
     * @private
     */
    _UI_ATTRS : {
        BIND: UI_ATTRS,
        SYNC: UI_ATTRS
    }
});

Y.Widget = Widget;


}, '3.16.0', {
    "requires": [
        "attribute",
        "base-base",
        "base-pluginhost",
        "classnamemanager",
        "event-focus",
        "node-base",
        "node-style"
    ],
    "skinnable": true
});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-htmlparser', function (Y, NAME) {

/**
 * Adds HTML Parser support to the base Widget class
 *
 * @module widget
 * @submodule widget-htmlparser
 * @for Widget
 */

var Widget = Y.Widget,
    Node = Y.Node,
    Lang = Y.Lang,

    SRC_NODE = "srcNode",
    CONTENT_BOX = "contentBox";

/**
 * Object hash, defining how attribute values are to be parsed from
 * markup contained in the widget's content box. e.g.:
 * <pre>
 *   {
 *       // Set single Node references using selector syntax
 *       // (selector is run through node.one)
 *       titleNode: "span.yui-title",
 *       // Set NodeList references using selector syntax
 *       // (array indicates selector is to be run through node.all)
 *       listNodes: ["li.yui-item"],
 *       // Set other attribute types, using a parse function.
 *       // Context is set to the widget instance.
 *       label: function(contentBox) {
 *           return contentBox.one("span.title").get("innerHTML");
 *       }
 *   }
 * </pre>
 *
 * @property HTML_PARSER
 * @type Object
 * @static
 */
Widget.HTML_PARSER = {};

/**
 * The build configuration for the Widget class.
 * <p>
 * Defines the static fields which need to be aggregated,
 * when this class is used as the main class passed to
 * the <a href="Base.html#method_build">Base.build</a> method.
 * </p>
 * @property _buildCfg
 * @type Object
 * @static
 * @final
 * @private
 */
Widget._buildCfg = {
    aggregates : ["HTML_PARSER"]
};

/**
 * The DOM node to parse for configuration values, passed to the Widget's HTML_PARSER definition
 *
 * @attribute srcNode
 * @type String | Node
 * @writeOnce
 */
Widget.ATTRS[SRC_NODE] = {
    value: null,
    setter: Node.one,
    getter: "_getSrcNode",
    writeOnce: true
};

Y.mix(Widget.prototype, {

    /**
     * @method _getSrcNode
     * @protected
     * @return {Node} The Node to apply HTML_PARSER to
     */
    _getSrcNode : function(val) {
        return val || this.get(CONTENT_BOX);
    },

    /**
     * Implement the BaseCore _preAddAttrs method hook, to add
     * the srcNode and related attributes, so that HTML_PARSER
     * (which relies on `this.get("srcNode")`) can merge in it's
     * results before the rest of the attributes are added.
     *
     * @method _preAddAttrs
     * @protected
     *
     * @param attrs {Object} The full hash of statically defined ATTRS
     * attributes being added for this instance
     *
     * @param userVals {Object} The hash of user values passed to
     * the constructor
     *
     * @param lazy {boolean} Whether or not to add the attributes lazily
     */
    _preAddAttrs : function(attrs, userVals, lazy) {

        var preAttrs = {
            id : attrs.id,
            boundingBox : attrs.boundingBox,
            contentBox : attrs.contentBox,
            srcNode : attrs.srcNode
        };

        this.addAttrs(preAttrs, userVals, lazy);

        delete attrs.boundingBox;
        delete attrs.contentBox;
        delete attrs.srcNode;
        delete attrs.id;

        if (this._applyParser) {
            this._applyParser(userVals);
        }
    },

    /**
     * @method _applyParsedConfig
     * @protected
     * @return {Object} The merged configuration literal
     */
    _applyParsedConfig : function(node, cfg, parsedCfg) {
        return (parsedCfg) ? Y.mix(cfg, parsedCfg, false) : cfg;
    },

    /**
     * Utility method used to apply the <code>HTML_PARSER</code> configuration for the
     * instance, to retrieve config data values.
     *
     * @method _applyParser
     * @protected
     * @param config {Object} User configuration object (will be populated with values from Node)
     */
    _applyParser : function(config) {

        var widget = this,
            srcNode = this._getNodeToParse(),
            schema = widget._getHtmlParser(),
            parsedConfig,
            val;

        if (schema && srcNode) {
            Y.Object.each(schema, function(v, k, o) {
                val = null;

                if (Lang.isFunction(v)) {
                    val = v.call(widget, srcNode);
                } else {
                    if (Lang.isArray(v)) {
                        val = srcNode.all(v[0]);
                        if (val.isEmpty()) {
                            val = null;
                        }
                    } else {
                        val = srcNode.one(v);
                    }
                }

                if (val !== null && val !== undefined) {
                    parsedConfig = parsedConfig || {};
                    parsedConfig[k] = val;
                }
            });
        }
        config = widget._applyParsedConfig(srcNode, config, parsedConfig);
    },

    /**
     * Determines whether we have a node reference which we should try and parse.
     *
     * The current implementation does not parse nodes generated from CONTENT_TEMPLATE,
     * only explicitly set srcNode, or contentBox attributes.
     *
     * @method _getNodeToParse
     * @return {Node} The node reference to apply HTML_PARSER to.
     * @private
     */
    _getNodeToParse : function() {
        var srcNode = this.get("srcNode");
        return (!this._cbFromTemplate) ? srcNode : null;
    },

    /**
     * Gets the HTML_PARSER definition for this instance, by merging HTML_PARSER
     * definitions across the class hierarchy.
     *
     * @private
     * @method _getHtmlParser
     * @return {Object} HTML_PARSER definition for this instance
     */
    _getHtmlParser : function() {
        // Removed caching for kweight. This is a private method
        // and only called once so don't need to cache HTML_PARSER
        var classes = this._getClasses(),
            parser = {},
            i, p;

        for (i = classes.length - 1; i >= 0; i--) {
            p = classes[i].HTML_PARSER;
            if (p) {
                Y.mix(parser, p, true);
            }
        }
        return parser;
    }
});


}, '3.16.0', {"requires": ["widget-base"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-skin', function (Y, NAME) {

/**
 * Provides skin related utlility methods.
 *
 * @module widget
 * @submodule widget-skin
 */
var BOUNDING_BOX = "boundingBox",
    CONTENT_BOX = "contentBox",
    SKIN = "skin",
    _getClassName = Y.ClassNameManager.getClassName;

/**
 * Returns the name of the skin that's currently applied to the widget.
 *
 * Searches up the Widget's ancestor axis for, by default, a class
 * yui3-skin-(name), and returns the (name) portion. Otherwise, returns null.
 *
 * This is only really useful after the widget's DOM structure is in the
 * document, either by render or by progressive enhancement.
 *
 * @method getSkinName
 * @for Widget
 * @param {String} [skinPrefix] The prefix which the implementation uses for the skin
 * ("yui3-skin-" is the default).
 *
 * NOTE: skinPrefix will be used as part of a regular expression:
 *
 *     new RegExp('\\b' + skinPrefix + '(\\S+)')
 *
 * Although an unlikely use case, literal characters which may result in an invalid
 * regular expression should be escaped.
 *
 * @return {String} The name of the skin, or null, if a matching skin class is not found.
 */

Y.Widget.prototype.getSkinName = function (skinPrefix) {

    var root = this.get( CONTENT_BOX ) || this.get( BOUNDING_BOX ),
        match,
        search;

    skinPrefix = skinPrefix || _getClassName(SKIN, "");

    search = new RegExp( '\\b' + skinPrefix + '(\\S+)' );

    if ( root ) {
        root.ancestor( function ( node ) {
            match = node.get( 'className' ).match( search );
            return match;
        } );
    }

    return ( match ) ? match[1] : null;
};


}, '3.16.0', {"requires": ["widget-base"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-delegate', function (Y, NAME) {

/**
 * Adds event delegation support to the library.
 *
 * @module event
 * @submodule event-delegate
 */

var toArray          = Y.Array,
    YLang            = Y.Lang,
    isString         = YLang.isString,
    isObject         = YLang.isObject,
    isArray          = YLang.isArray,
    selectorTest     = Y.Selector.test,
    detachCategories = Y.Env.evt.handles;

/**
 * <p>Sets up event delegation on a container element.  The delegated event
 * will use a supplied selector or filtering function to test if the event
 * references at least one node that should trigger the subscription
 * callback.</p>
 *
 * <p>Selector string filters will trigger the callback if the event originated
 * from a node that matches it or is contained in a node that matches it.
 * Function filters are called for each Node up the parent axis to the
 * subscribing container node, and receive at each level the Node and the event
 * object.  The function should return true (or a truthy value) if that Node
 * should trigger the subscription callback.  Note, it is possible for filters
 * to match multiple Nodes for a single event.  In this case, the delegate
 * callback will be executed for each matching Node.</p>
 *
 * <p>For each matching Node, the callback will be executed with its 'this'
 * object set to the Node matched by the filter (unless a specific context was
 * provided during subscription), and the provided event's
 * <code>currentTarget</code> will also be set to the matching Node.  The
 * containing Node from which the subscription was originally made can be
 * referenced as <code>e.container</code>.
 *
 * @method delegate
 * @param type {String} the event type to delegate
 * @param fn {Function} the callback function to execute.  This function
 *              will be provided the event object for the delegated event.
 * @param el {String|node} the element that is the delegation container
 * @param filter {string|Function} a selector that must match the target of the
 *              event or a function to test target and its parents for a match
 * @param context optional argument that specifies what 'this' refers to.
 * @param args* 0..n additional arguments to pass on to the callback function.
 *              These arguments will be added after the event object.
 * @return {EventHandle} the detach handle
 * @static
 * @for Event
 */
function delegate(type, fn, el, filter) {
    var args     = toArray(arguments, 0, true),
        query    = isString(el) ? el : null,
        typeBits, synth, container, categories, cat, i, len, handles, handle;

    // Support Y.delegate({ click: fnA, key: fnB }, el, filter, ...);
    // and Y.delegate(['click', 'key'], fn, el, filter, ...);
    if (isObject(type)) {
        handles = [];

        if (isArray(type)) {
            for (i = 0, len = type.length; i < len; ++i) {
                args[0] = type[i];
                handles.push(Y.delegate.apply(Y, args));
            }
        } else {
            // Y.delegate({'click', fn}, el, filter) =>
            // Y.delegate('click', fn, el, filter)
            args.unshift(null); // one arg becomes two; need to make space

            for (i in type) {
                if (type.hasOwnProperty(i)) {
                    args[0] = i;
                    args[1] = type[i];
                    handles.push(Y.delegate.apply(Y, args));
                }
            }
        }

        return new Y.EventHandle(handles);
    }

    typeBits = type.split(/\|/);

    if (typeBits.length > 1) {
        cat  = typeBits.shift();
        args[0] = type = typeBits.shift();
    }

    synth = Y.Node.DOM_EVENTS[type];

    if (isObject(synth) && synth.delegate) {
        handle = synth.delegate.apply(synth, arguments);
    }

    if (!handle) {
        if (!type || !fn || !el || !filter) {
            return;
        }

        container = (query) ? Y.Selector.query(query, null, true) : el;

        if (!container && isString(el)) {
            handle = Y.on('available', function () {
                Y.mix(handle, Y.delegate.apply(Y, args), true);
            }, el);
        }

        if (!handle && container) {
            args.splice(2, 2, container); // remove the filter

            handle = Y.Event._attach(args, { facade: false });
            handle.sub.filter  = filter;
            handle.sub._notify = delegate.notifySub;
        }
    }

    if (handle && cat) {
        categories = detachCategories[cat]  || (detachCategories[cat] = {});
        categories = categories[type] || (categories[type] = []);
        categories.push(handle);
    }

    return handle;
}

/**
Overrides the <code>_notify</code> method on the normal DOM subscription to
inject the filtering logic and only proceed in the case of a match.

This method is hosted as a private property of the `delegate` method
(e.g. `Y.delegate.notifySub`)

@method notifySub
@param thisObj {Object} default 'this' object for the callback
@param args {Array} arguments passed to the event's <code>fire()</code>
@param ce {CustomEvent} the custom event managing the DOM subscriptions for
             the subscribed event on the subscribing node.
@return {Boolean} false if the event was stopped
@private
@static
@since 3.2.0
**/
delegate.notifySub = function (thisObj, args, ce) {
    // Preserve args for other subscribers
    args = args.slice();
    if (this.args) {
        args.push.apply(args, this.args);
    }

    // Only notify subs if the event occurred on a targeted element
    var currentTarget = delegate._applyFilter(this.filter, args, ce),
        //container     = e.currentTarget,
        e, i, len, ret;

    if (currentTarget) {
        // Support multiple matches up the the container subtree
        currentTarget = toArray(currentTarget);

        // The second arg is the currentTarget, but we'll be reusing this
        // facade, replacing the currentTarget for each use, so it doesn't
        // matter what element we seed it with.
        e = args[0] = new Y.DOMEventFacade(args[0], ce.el, ce);

        e.container = Y.one(ce.el);

        for (i = 0, len = currentTarget.length; i < len && !e.stopped; ++i) {
            e.currentTarget = Y.one(currentTarget[i]);

            ret = this.fn.apply(this.context || e.currentTarget, args);

            if (ret === false) { // stop further notifications
                break;
            }
        }

        return ret;
    }
};

/**
Compiles a selector string into a filter function to identify whether
Nodes along the parent axis of an event's target should trigger event
notification.

This function is memoized, so previously compiled filter functions are
returned if the same selector string is provided.

This function may be useful when defining synthetic events for delegate
handling.

Hosted as a property of the `delegate` method (e.g. `Y.delegate.compileFilter`).

@method compileFilter
@param selector {String} the selector string to base the filtration on
@return {Function}
@since 3.2.0
@static
**/
delegate.compileFilter = Y.cached(function (selector) {
    return function (target, e) {
        return selectorTest(target._node, selector,
            (e.currentTarget === e.target) ? null : e.currentTarget._node);
    };
});

/**
Regex to test for disabled elements during filtering. This is only relevant to
IE to normalize behavior with other browsers, which swallow events that occur
to disabled elements. IE fires the event from the parent element instead of the
original target, though it does preserve `event.srcElement` as the disabled
element. IE also supports disabled on `<a>`, but the event still bubbles, so it
acts more like `e.preventDefault()` plus styling. That issue is not handled here
because other browsers fire the event on the `<a>`, so delegate is supported in
both cases.

@property _disabledRE
@type {RegExp}
@protected
@since 3.8.1
**/
delegate._disabledRE = /^(?:button|input|select|textarea)$/i;

/**
Walks up the parent axis of an event's target, and tests each element
against a supplied filter function.  If any Nodes, including the container,
satisfy the filter, the delegated callback will be triggered for each.

Hosted as a protected property of the `delegate` method (e.g.
`Y.delegate._applyFilter`).

@method _applyFilter
@param filter {Function} boolean function to test for inclusion in event
                 notification
@param args {Array} the arguments that would be passed to subscribers
@param ce   {CustomEvent} the DOM event wrapper
@return {Node|Node[]|undefined} The Node or Nodes that satisfy the filter
@protected
**/
delegate._applyFilter = function (filter, args, ce) {
    var e         = args[0],
        container = ce.el, // facadeless events in IE, have no e.currentTarget
        target    = e.target || e.srcElement,
        match     = [],
        isContainer = false;

    // Resolve text nodes to their containing element
    if (target.nodeType === 3) {
        target = target.parentNode;
    }

    // For IE. IE propagates events from the parent element of disabled
    // elements, where other browsers swallow the event entirely. To normalize
    // this in IE, filtering for matching elements should abort if the target
    // is a disabled form control.
    if (target.disabled && delegate._disabledRE.test(target.nodeName)) {
        return match;
    }

    // passing target as the first arg rather than leaving well enough alone
    // making 'this' in the filter function refer to the target.  This is to
    // support bound filter functions.
    args.unshift(target);

    if (isString(filter)) {
        while (target) {
            isContainer = (target === container);
            if (selectorTest(target, filter, (isContainer ? null: container))) {
                match.push(target);
            }

            if (isContainer) {
                break;
            }

            target = target.parentNode;
        }
    } else {
        // filter functions are implementer code and should receive wrappers
        args[0] = Y.one(target);
        args[1] = new Y.DOMEventFacade(e, container, ce);

        while (target) {
            // filter(target, e, extra args...) - this === target
            if (filter.apply(args[0], args)) {
                match.push(target);
            }

            if (target === container) {
                break;
            }

            target = target.parentNode;
            args[0] = Y.one(target);
        }
        args[1] = e; // restore the raw DOM event
    }

    if (match.length <= 1) {
        match = match[0]; // single match or undefined
    }

    // remove the target
    args.shift();

    return match;
};

/**
 * Sets up event delegation on a container element.  The delegated event
 * will use a supplied filter to test if the callback should be executed.
 * This filter can be either a selector string or a function that returns
 * a Node to use as the currentTarget for the event.
 *
 * The event object for the delegated event is supplied to the callback
 * function.  It is modified slightly in order to support all properties
 * that may be needed for event delegation.  'currentTarget' is set to
 * the element that matched the selector string filter or the Node returned
 * from the filter function.  'container' is set to the element that the
 * listener is delegated from (this normally would be the 'currentTarget').
 *
 * Filter functions will be called with the arguments that would be passed to
 * the callback function, including the event object as the first parameter.
 * The function should return false (or a falsey value) if the success criteria
 * aren't met, and the Node to use as the event's currentTarget and 'this'
 * object if they are.
 *
 * @method delegate
 * @param type {string} the event type to delegate
 * @param fn {function} the callback function to execute.  This function
 * will be provided the event object for the delegated event.
 * @param el {string|node} the element that is the delegation container
 * @param filter {string|function} a selector that must match the target of the
 * event or a function that returns a Node or false.
 * @param context optional argument that specifies what 'this' refers to.
 * @param args* 0..n additional arguments to pass on to the callback function.
 * These arguments will be added after the event object.
 * @return {EventHandle} the detach handle
 * @for YUI
 */
Y.delegate = Y.Event.delegate = delegate;


}, '3.16.0', {"requires": ["node-base"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('node-event-delegate', function (Y, NAME) {

/**
 * Functionality to make the node a delegated event container
 * @module node
 * @submodule node-event-delegate
 */

/**
 * <p>Sets up a delegation listener for an event occurring inside the Node.
 * The delegated event will be verified against a supplied selector or
 * filtering function to test if the event references at least one node that
 * should trigger the subscription callback.</p>
 *
 * <p>Selector string filters will trigger the callback if the event originated
 * from a node that matches it or is contained in a node that matches it.
 * Function filters are called for each Node up the parent axis to the
 * subscribing container node, and receive at each level the Node and the event
 * object.  The function should return true (or a truthy value) if that Node
 * should trigger the subscription callback.  Note, it is possible for filters
 * to match multiple Nodes for a single event.  In this case, the delegate
 * callback will be executed for each matching Node.</p>
 *
 * <p>For each matching Node, the callback will be executed with its 'this'
 * object set to the Node matched by the filter (unless a specific context was
 * provided during subscription), and the provided event's
 * <code>currentTarget</code> will also be set to the matching Node.  The
 * containing Node from which the subscription was originally made can be
 * referenced as <code>e.container</code>.
 *
 * @method delegate
 * @param type {String} the event type to delegate
 * @param fn {Function} the callback function to execute.  This function
 *              will be provided the event object for the delegated event.
 * @param spec {String|Function} a selector that must match the target of the
 *              event or a function to test target and its parents for a match
 * @param context {Object} optional argument that specifies what 'this' refers to.
 * @param args* {any} 0..n additional arguments to pass on to the callback function.
 *              These arguments will be added after the event object.
 * @return {EventHandle} the detach handle
 * @for Node
 */
Y.Node.prototype.delegate = function(type) {

    var args = Y.Array(arguments, 0, true),
        index = (Y.Lang.isObject(type) && !Y.Lang.isArray(type)) ? 1 : 2;

    args.splice(index, 0, this._node);

    return Y.delegate.apply(Y, args);
};


}, '3.16.0', {"requires": ["node-base", "event-delegate"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-uievents', function (Y, NAME) {

/**
 * Support for Widget UI Events (Custom Events fired by the widget, which wrap the underlying DOM events - e.g. widget:click, widget:mousedown)
 *
 * @module widget
 * @submodule widget-uievents
 */

var BOUNDING_BOX = "boundingBox",
    Widget = Y.Widget,
    RENDER = "render",
    L = Y.Lang,
    EVENT_PREFIX_DELIMITER = ":",

    //  Map of Node instances serving as a delegation containers for a specific
    //  event type to Widget instances using that delegation container.
    _uievts = Y.Widget._uievts = Y.Widget._uievts || {};

Y.mix(Widget.prototype, {

    /**
     * Destructor logic for UI event infrastructure,
     * invoked during Widget destruction.
     *
     * @method _destroyUIEvents
     * @for Widget
     * @private
     */
    _destroyUIEvents: function() {

        var widgetGuid = Y.stamp(this, true);

        Y.each(_uievts, function (info, key) {
            if (info.instances[widgetGuid]) {
                //  Unregister this Widget instance as needing this delegated
                //  event listener.
                delete info.instances[widgetGuid];

                //  There are no more Widget instances using this delegated
                //  event listener, so detach it.

                if (Y.Object.isEmpty(info.instances)) {
                    info.handle.detach();

                    if (_uievts[key]) {
                        delete _uievts[key];
                    }
                }
            }
        });
    },

    /**
     * Map of DOM events that should be fired as Custom Events by the
     * Widget instance.
     *
     * @property UI_EVENTS
     * @for Widget
     * @type Object
     */
    UI_EVENTS: Y.Node.DOM_EVENTS,

    /**
     * Returns the node on which to bind delegate listeners.
     *
     * @method _getUIEventNode
     * @for Widget
     * @protected
     */
    _getUIEventNode: function () {
        return this.get(BOUNDING_BOX);
    },

    /**
     * Binds a delegated DOM event listener of the specified type to the
     * Widget's outtermost DOM element to facilitate the firing of a Custom
     * Event of the same type for the Widget instance.
     *
     * @method _createUIEvent
     * @for Widget
     * @param type {String} String representing the name of the event
     * @private
     */
    _createUIEvent: function (type) {

        var uiEvtNode = this._getUIEventNode(),
            key = (Y.stamp(uiEvtNode) + type),
            info = _uievts[key],
            handle;

        //  For each Node instance: Ensure that there is only one delegated
        //  event listener used to fire Widget UI events.

        if (!info) {

            handle = uiEvtNode.delegate(type, function (evt) {

                var widget = Widget.getByNode(this);

                // Widget could be null if node instance belongs to
                // another Y instance.

                if (widget) {
                    if (widget._filterUIEvent(evt)) {
                        widget.fire(evt.type, { domEvent: evt });
                    }
                }

            }, "." + Y.Widget.getClassName());

            _uievts[key] = info = { instances: {}, handle: handle };
        }

        //  Register this Widget as using this Node as a delegation container.
        info.instances[Y.stamp(this)] = 1;
    },

    /**
     * This method is used to determine if we should fire
     * the UI Event or not. The default implementation makes sure
     * that for nested delegates (nested unrelated widgets), we don't
     * fire the UI event listener more than once at each level.
     *
     * <p>For example, without the additional filter, if you have nested
     * widgets, each widget will have a delegate listener. If you
     * click on the inner widget, the inner delegate listener's
     * filter will match once, but the outer will match twice
     * (based on delegate's design) - once for the inner widget,
     * and once for the outer.</p>
     *
     * @method _filterUIEvent
     * @for Widget
     * @param {DOMEventFacade} evt
     * @return {boolean} true if it's OK to fire the custom UI event, false if not.
     * @private
     *
     */
    _filterUIEvent: function(evt) {
        // Either it's hitting this widget's delegate container (and not some other widget's),
        // or the container it's hitting is handling this widget's ui events.
        return (evt.currentTarget.compareTo(evt.container) || evt.container.compareTo(this._getUIEventNode()));
    },

    /**
     * Determines if the specified event is a UI event.
     *
     * @private
     * @method _isUIEvent
     * @for Widget
     * @param type {String} String representing the name of the event
     * @return {String} Event Returns the name of the UI Event, otherwise
     * undefined.
     */
    _getUIEvent: function (type) {

        if (L.isString(type)) {
            var sType = this.parseType(type)[1],
                iDelim,
                returnVal;

            if (sType) {
                // TODO: Get delimiter from ET, or have ET support this.
                iDelim = sType.indexOf(EVENT_PREFIX_DELIMITER);
                if (iDelim > -1) {
                    sType = sType.substring(iDelim + EVENT_PREFIX_DELIMITER.length);
                }

                if (this.UI_EVENTS[sType]) {
                    returnVal = sType;
                }
            }

            return returnVal;
        }
    },

    /**
     * Sets up infrastructure required to fire a UI event.
     *
     * @private
     * @method _initUIEvent
     * @for Widget
     * @param type {String} String representing the name of the event
     * @return {String}
     */
    _initUIEvent: function (type) {
        var sType = this._getUIEvent(type),
            queue = this._uiEvtsInitQueue || {};

        if (sType && !queue[sType]) {

            this._uiEvtsInitQueue = queue[sType] = 1;

            this.after(RENDER, function() {
                this._createUIEvent(sType);
                delete this._uiEvtsInitQueue[sType];
            });
        }
    },

    //  Override of "on" from Base to facilitate the firing of Widget events
    //  based on DOM events of the same name/type (e.g. "click", "mouseover").
    //  Temporary solution until we have the ability to listen to when
    //  someone adds an event listener (bug 2528230)
    on: function (type) {
        this._initUIEvent(type);
        return Widget.superclass.on.apply(this, arguments);
    },

    //  Override of "publish" from Base to facilitate the firing of Widget events
    //  based on DOM events of the same name/type (e.g. "click", "mouseover").
    //  Temporary solution until we have the ability to listen to when
    //  someone publishes an event (bug 2528230)
    publish: function (type, config) {
        var sType = this._getUIEvent(type);
        if (sType && config && config.defaultFn) {
            this._initUIEvent(sType);
        }
        return Widget.superclass.publish.apply(this, arguments);
    }

}, true); // overwrite existing EventTarget methods


}, '3.16.0', {"requires": ["node-event-delegate", "widget-base"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-simulate', function (Y, NAME) {

(function() {
/**
 * Simulate user interaction by generating native DOM events.
 *
 * @module event-simulate
 * @requires event
 */

//shortcuts
var L   = Y.Lang,
    win = Y.config.win,
    isFunction  = L.isFunction,
    isString    = L.isString,
    isBoolean   = L.isBoolean,
    isObject    = L.isObject,
    isNumber    = L.isNumber,

    //mouse events supported
    mouseEvents = {
        click:      1,
        dblclick:   1,
        mouseover:  1,
        mouseout:   1,
        mousedown:  1,
        mouseup:    1,
        mousemove:  1,
        contextmenu:1
    },

    pointerEvents = (win && win.PointerEvent) ? {
        pointerover:  1,
        pointerout:   1,
        pointerdown:  1,
        pointerup:    1,
        pointermove:  1
    } : {
        MSPointerOver:  1,
        MSPointerOut:   1,
        MSPointerDown:  1,
        MSPointerUp:    1,
        MSPointerMove:  1
    },

    //key events supported
    keyEvents   = {
        keydown:    1,
        keyup:      1,
        keypress:   1
    },

    //HTML events supported
    uiEvents  = {
        submit:     1,
        blur:       1,
        change:     1,
        focus:      1,
        resize:     1,
        scroll:     1,
        select:     1
    },

    //events that bubble by default
    bubbleEvents = {
        scroll:     1,
        resize:     1,
        reset:      1,
        submit:     1,
        change:     1,
        select:     1,
        error:      1,
        abort:      1
    },

    //touch events supported
    touchEvents = {
        touchstart: 1,
        touchmove: 1,
        touchend: 1,
        touchcancel: 1
    },

    gestureEvents = {
        gesturestart: 1,
        gesturechange: 1,
        gestureend: 1
    };

//all key, mouse and touch events bubble
Y.mix(bubbleEvents, mouseEvents);
Y.mix(bubbleEvents, keyEvents);
Y.mix(bubbleEvents, touchEvents);

/*
 * Note: Intentionally not for YUIDoc generation.
 * Simulates a key event using the given event information to populate
 * the generated event object. This method does browser-equalizing
 * calculations to account for differences in the DOM and IE event models
 * as well as different browser quirks. Note: keydown causes Safari 2.x to
 * crash.
 * @method simulateKeyEvent
 * @private
 * @static
 * @param {HTMLElement} target The target of the given event.
 * @param {String} type The type of event to fire. This can be any one of
 *      the following: keyup, keydown, and keypress.
 * @param {Boolean} [bubbles=true] Indicates if the event can be
 *      bubbled up. DOM Level 3 specifies that all key events bubble by
 *      default.
 * @param {Boolean} [cancelable=true] Indicates if the event can be
 *      canceled using preventDefault(). DOM Level 3 specifies that all
 *      key events can be cancelled.
 * @param {Window} [view=window] The view containing the target. This is
 *      typically the window object.
 * @param {Boolean} [ctrlKey=false] Indicates if one of the CTRL keys
 *      is pressed while the event is firing.
 * @param {Boolean} [altKey=false] Indicates if one of the ALT keys
 *      is pressed while the event is firing.
 * @param {Boolean} [shiftKey=false] Indicates if one of the SHIFT keys
 *      is pressed while the event is firing.
 * @param {Boolean} [metaKey=false] Indicates if one of the META keys
 *      is pressed while the event is firing.
 * @param {Number} [keyCode=0] The code for the key that is in use.
 * @param {Number} [charCode=0] The Unicode code for the character
 *      associated with the key being used.
 */
function simulateKeyEvent(target /*:HTMLElement*/, type /*:String*/,
                             bubbles /*:Boolean*/,  cancelable /*:Boolean*/,
                             view /*:Window*/,
                             ctrlKey /*:Boolean*/,    altKey /*:Boolean*/,
                             shiftKey /*:Boolean*/,   metaKey /*:Boolean*/,
                             keyCode /*:int*/,        charCode /*:int*/) /*:Void*/
{
    //check target
    if (!target){
        Y.error("simulateKeyEvent(): Invalid target.");
    }

    //check event type
    if (isString(type)){
        type = type.toLowerCase();
        switch(type){
            case "textevent": //DOM Level 3
                type = "keypress";
                break;
            case "keyup":
            case "keydown":
            case "keypress":
                break;
            default:
                Y.error("simulateKeyEvent(): Event type '" + type + "' not supported.");
        }
    } else {
        Y.error("simulateKeyEvent(): Event type must be a string.");
    }

    //setup default values
    if (!isBoolean(bubbles)){
        bubbles = true; //all key events bubble
    }
    if (!isBoolean(cancelable)){
        cancelable = true; //all key events can be cancelled
    }
    if (!isObject(view)){
        view = Y.config.win; //view is typically window
    }
    if (!isBoolean(ctrlKey)){
        ctrlKey = false;
    }
    if (!isBoolean(altKey)){
        altKey = false;
    }
    if (!isBoolean(shiftKey)){
        shiftKey = false;
    }
    if (!isBoolean(metaKey)){
        metaKey = false;
    }
    if (!isNumber(keyCode)){
        keyCode = 0;
    }
    if (!isNumber(charCode)){
        charCode = 0;
    }

    //try to create a mouse event
    var customEvent /*:MouseEvent*/ = null;

    //check for DOM-compliant browsers first
    if (isFunction(Y.config.doc.createEvent)){

        try {

            //try to create key event
            customEvent = Y.config.doc.createEvent("KeyEvents");

            /*
             * Interesting problem: Firefox implemented a non-standard
             * version of initKeyEvent() based on DOM Level 2 specs.
             * Key event was removed from DOM Level 2 and re-introduced
             * in DOM Level 3 with a different interface. Firefox is the
             * only browser with any implementation of Key Events, so for
             * now, assume it's Firefox if the above line doesn't error.
             */
            // @TODO: Decipher between Firefox's implementation and a correct one.
            customEvent.initKeyEvent(type, bubbles, cancelable, view, ctrlKey,
                altKey, shiftKey, metaKey, keyCode, charCode);

        } catch (ex /*:Error*/){

            /*
             * If it got here, that means key events aren't officially supported.
             * Safari/WebKit is a real problem now. WebKit 522 won't let you
             * set keyCode, charCode, or other properties if you use a
             * UIEvent, so we first must try to create a generic event. The
             * fun part is that this will throw an error on Safari 2.x. The
             * end result is that we need another try...catch statement just to
             * deal with this mess.
             */
            try {

                //try to create generic event - will fail in Safari 2.x
                customEvent = Y.config.doc.createEvent("Events");

            } catch (uierror /*:Error*/){

                //the above failed, so create a UIEvent for Safari 2.x
                customEvent = Y.config.doc.createEvent("UIEvents");

            } finally {

                customEvent.initEvent(type, bubbles, cancelable);

                //initialize
                customEvent.view = view;
                customEvent.altKey = altKey;
                customEvent.ctrlKey = ctrlKey;
                customEvent.shiftKey = shiftKey;
                customEvent.metaKey = metaKey;
                customEvent.keyCode = keyCode;
                customEvent.charCode = charCode;

            }

        }

        //fire the event
        target.dispatchEvent(customEvent);

    } else if (isObject(Y.config.doc.createEventObject)){ //IE

        //create an IE event object
        customEvent = Y.config.doc.createEventObject();

        //assign available properties
        customEvent.bubbles = bubbles;
        customEvent.cancelable = cancelable;
        customEvent.view = view;
        customEvent.ctrlKey = ctrlKey;
        customEvent.altKey = altKey;
        customEvent.shiftKey = shiftKey;
        customEvent.metaKey = metaKey;

        /*
         * IE doesn't support charCode explicitly. CharCode should
         * take precedence over any keyCode value for accurate
         * representation.
         */
        customEvent.keyCode = (charCode > 0) ? charCode : keyCode;

        //fire the event
        target.fireEvent("on" + type, customEvent);

    } else {
        Y.error("simulateKeyEvent(): No event simulation framework present.");
    }
}

/*
 * Note: Intentionally not for YUIDoc generation.
 * Simulates a mouse event using the given event information to populate
 * the generated event object. This method does browser-equalizing
 * calculations to account for differences in the DOM and IE event models
 * as well as different browser quirks.
 * @method simulateMouseEvent
 * @private
 * @static
 * @param {HTMLElement} target The target of the given event.
 * @param {String} type The type of event to fire. This can be any one of
 *      the following: click, dblclick, mousedown, mouseup, mouseout,
 *      mouseover, and mousemove.
 * @param {Boolean} bubbles (Optional) Indicates if the event can be
 *      bubbled up. DOM Level 2 specifies that all mouse events bubble by
 *      default. The default is true.
 * @param {Boolean} cancelable (Optional) Indicates if the event can be
 *      canceled using preventDefault(). DOM Level 2 specifies that all
 *      mouse events except mousemove can be cancelled. The default
 *      is true for all events except mousemove, for which the default
 *      is false.
 * @param {Window} view (Optional) The view containing the target. This is
 *      typically the window object. The default is window.
 * @param {Number} detail (Optional) The number of times the mouse button has
 *      been used. The default value is 1.
 * @param {Number} screenX (Optional) The x-coordinate on the screen at which
 *      point the event occured. The default is 0.
 * @param {Number} screenY (Optional) The y-coordinate on the screen at which
 *      point the event occured. The default is 0.
 * @param {Number} clientX (Optional) The x-coordinate on the client at which
 *      point the event occured. The default is 0.
 * @param {Number} clientY (Optional) The y-coordinate on the client at which
 *      point the event occured. The default is 0.
 * @param {Boolean} ctrlKey (Optional) Indicates if one of the CTRL keys
 *      is pressed while the event is firing. The default is false.
 * @param {Boolean} altKey (Optional) Indicates if one of the ALT keys
 *      is pressed while the event is firing. The default is false.
 * @param {Boolean} shiftKey (Optional) Indicates if one of the SHIFT keys
 *      is pressed while the event is firing. The default is false.
 * @param {Boolean} metaKey (Optional) Indicates if one of the META keys
 *      is pressed while the event is firing. The default is false.
 * @param {Number} button (Optional) The button being pressed while the event
 *      is executing. The value should be 0 for the primary mouse button
 *      (typically the left button), 1 for the terciary mouse button
 *      (typically the middle button), and 2 for the secondary mouse button
 *      (typically the right button). The default is 0.
 * @param {HTMLElement} relatedTarget (Optional) For mouseout events,
 *      this is the element that the mouse has moved to. For mouseover
 *      events, this is the element that the mouse has moved from. This
 *      argument is ignored for all other events. The default is null.
 */
function simulateMouseEvent(target /*:HTMLElement*/, type /*:String*/,
                               bubbles /*:Boolean*/,  cancelable /*:Boolean*/,
                               view /*:Window*/,        detail /*:int*/,
                               screenX /*:int*/,        screenY /*:int*/,
                               clientX /*:int*/,        clientY /*:int*/,
                               ctrlKey /*:Boolean*/,    altKey /*:Boolean*/,
                               shiftKey /*:Boolean*/,   metaKey /*:Boolean*/,
                               button /*:int*/,         relatedTarget /*:HTMLElement*/) /*:Void*/
{
    //check target
    if (!target){
        Y.error("simulateMouseEvent(): Invalid target.");
    }


    if (isString(type)){

        //make sure it's a supported mouse event or an msPointerEvent.
        if (!mouseEvents[type.toLowerCase()] && !pointerEvents[type]){
            Y.error("simulateMouseEvent(): Event type '" + type + "' not supported.");
        }
    }
    else {
        Y.error("simulateMouseEvent(): Event type must be a string.");
    }

    //setup default values
    if (!isBoolean(bubbles)){
        bubbles = true; //all mouse events bubble
    }
    if (!isBoolean(cancelable)){
        cancelable = (type !== "mousemove"); //mousemove is the only one that can't be cancelled
    }
    if (!isObject(view)){
        view = Y.config.win; //view is typically window
    }
    if (!isNumber(detail)){
        detail = 1;  //number of mouse clicks must be at least one
    }
    if (!isNumber(screenX)){
        screenX = 0;
    }
    if (!isNumber(screenY)){
        screenY = 0;
    }
    if (!isNumber(clientX)){
        clientX = 0;
    }
    if (!isNumber(clientY)){
        clientY = 0;
    }
    if (!isBoolean(ctrlKey)){
        ctrlKey = false;
    }
    if (!isBoolean(altKey)){
        altKey = false;
    }
    if (!isBoolean(shiftKey)){
        shiftKey = false;
    }
    if (!isBoolean(metaKey)){
        metaKey = false;
    }
    if (!isNumber(button)){
        button = 0;
    }

    relatedTarget = relatedTarget || null;

    //try to create a mouse event
    var customEvent /*:MouseEvent*/ = null;

    //check for DOM-compliant browsers first
    if (isFunction(Y.config.doc.createEvent)){

        customEvent = Y.config.doc.createEvent("MouseEvents");

        //Safari 2.x (WebKit 418) still doesn't implement initMouseEvent()
        if (customEvent.initMouseEvent){
            customEvent.initMouseEvent(type, bubbles, cancelable, view, detail,
                                 screenX, screenY, clientX, clientY,
                                 ctrlKey, altKey, shiftKey, metaKey,
                                 button, relatedTarget);
        } else { //Safari

            //the closest thing available in Safari 2.x is UIEvents
            customEvent = Y.config.doc.createEvent("UIEvents");
            customEvent.initEvent(type, bubbles, cancelable);
            customEvent.view = view;
            customEvent.detail = detail;
            customEvent.screenX = screenX;
            customEvent.screenY = screenY;
            customEvent.clientX = clientX;
            customEvent.clientY = clientY;
            customEvent.ctrlKey = ctrlKey;
            customEvent.altKey = altKey;
            customEvent.metaKey = metaKey;
            customEvent.shiftKey = shiftKey;
            customEvent.button = button;
            customEvent.relatedTarget = relatedTarget;
        }

        /*
         * Check to see if relatedTarget has been assigned. Firefox
         * versions less than 2.0 don't allow it to be assigned via
         * initMouseEvent() and the property is readonly after event
         * creation, so in order to keep YAHOO.util.getRelatedTarget()
         * working, assign to the IE proprietary toElement property
         * for mouseout event and fromElement property for mouseover
         * event.
         */
        if (relatedTarget && !customEvent.relatedTarget){
            if (type === "mouseout"){
                customEvent.toElement = relatedTarget;
            } else if (type === "mouseover"){
                customEvent.fromElement = relatedTarget;
            }
        }

        //fire the event
        target.dispatchEvent(customEvent);

    } else if (isObject(Y.config.doc.createEventObject)){ //IE

        //create an IE event object
        customEvent = Y.config.doc.createEventObject();

        //assign available properties
        customEvent.bubbles = bubbles;
        customEvent.cancelable = cancelable;
        customEvent.view = view;
        customEvent.detail = detail;
        customEvent.screenX = screenX;
        customEvent.screenY = screenY;
        customEvent.clientX = clientX;
        customEvent.clientY = clientY;
        customEvent.ctrlKey = ctrlKey;
        customEvent.altKey = altKey;
        customEvent.metaKey = metaKey;
        customEvent.shiftKey = shiftKey;

        //fix button property for IE's wacky implementation
        switch(button){
            case 0:
                customEvent.button = 1;
                break;
            case 1:
                customEvent.button = 4;
                break;
            case 2:
                //leave as is
                break;
            default:
                customEvent.button = 0;
        }

        /*
         * Have to use relatedTarget because IE won't allow assignment
         * to toElement or fromElement on generic events. This keeps
         * YAHOO.util.customEvent.getRelatedTarget() functional.
         */
        customEvent.relatedTarget = relatedTarget;

        //fire the event
        target.fireEvent("on" + type, customEvent);

    } else {
        Y.error("simulateMouseEvent(): No event simulation framework present.");
    }
}

/*
 * Note: Intentionally not for YUIDoc generation.
 * Simulates a UI event using the given event information to populate
 * the generated event object. This method does browser-equalizing
 * calculations to account for differences in the DOM and IE event models
 * as well as different browser quirks.
 * @method simulateHTMLEvent
 * @private
 * @static
 * @param {HTMLElement} target The target of the given event.
 * @param {String} type The type of event to fire. This can be any one of
 *      the following: click, dblclick, mousedown, mouseup, mouseout,
 *      mouseover, and mousemove.
 * @param {Boolean} bubbles (Optional) Indicates if the event can be
 *      bubbled up. DOM Level 2 specifies that all mouse events bubble by
 *      default. The default is true.
 * @param {Boolean} cancelable (Optional) Indicates if the event can be
 *      canceled using preventDefault(). DOM Level 2 specifies that all
 *      mouse events except mousemove can be cancelled. The default
 *      is true for all events except mousemove, for which the default
 *      is false.
 * @param {Window} view (Optional) The view containing the target. This is
 *      typically the window object. The default is window.
 * @param {Number} detail (Optional) The number of times the mouse button has
 *      been used. The default value is 1.
 */
function simulateUIEvent(target /*:HTMLElement*/, type /*:String*/,
                               bubbles /*:Boolean*/,  cancelable /*:Boolean*/,
                               view /*:Window*/,        detail /*:int*/) /*:Void*/
{

    //check target
    if (!target){
        Y.error("simulateUIEvent(): Invalid target.");
    }

    //check event type
    if (isString(type)){
        type = type.toLowerCase();

        //make sure it's a supported mouse event
        if (!uiEvents[type]){
            Y.error("simulateUIEvent(): Event type '" + type + "' not supported.");
        }
    } else {
        Y.error("simulateUIEvent(): Event type must be a string.");
    }

    //try to create a mouse event
    var customEvent = null;


    //setup default values
    if (!isBoolean(bubbles)){
        bubbles = (type in bubbleEvents);  //not all events bubble
    }
    if (!isBoolean(cancelable)){
        cancelable = (type === "submit"); //submit is the only one that can be cancelled
    }
    if (!isObject(view)){
        view = Y.config.win; //view is typically window
    }
    if (!isNumber(detail)){
        detail = 1;  //usually not used but defaulted to this
    }

    //check for DOM-compliant browsers first
    if (isFunction(Y.config.doc.createEvent)){

        //just a generic UI Event object is needed
        customEvent = Y.config.doc.createEvent("UIEvents");
        customEvent.initUIEvent(type, bubbles, cancelable, view, detail);

        //fire the event
        target.dispatchEvent(customEvent);

    } else if (isObject(Y.config.doc.createEventObject)){ //IE

        //create an IE event object
        customEvent = Y.config.doc.createEventObject();

        //assign available properties
        customEvent.bubbles = bubbles;
        customEvent.cancelable = cancelable;
        customEvent.view = view;
        customEvent.detail = detail;

        //fire the event
        target.fireEvent("on" + type, customEvent);

    } else {
        Y.error("simulateUIEvent(): No event simulation framework present.");
    }
}

/*
 * (iOS only) This is for creating native DOM gesture events which only iOS
 * v2.0+ is supporting.
 *
 * @method simulateGestureEvent
 * @private
 * @param {HTMLElement} target The target of the given event.
 * @param {String} type The type of event to fire. This can be any one of
 *      the following: touchstart, touchmove, touchend, touchcancel.
 * @param {Boolean} bubbles (Optional) Indicates if the event can be
 *      bubbled up. DOM Level 2 specifies that all mouse events bubble by
 *      default. The default is true.
 * @param {Boolean} cancelable (Optional) Indicates if the event can be
 *      canceled using preventDefault(). DOM Level 2 specifies that all
 *      touch events except touchcancel can be cancelled. The default
 *      is true for all events except touchcancel, for which the default
 *      is false.
 * @param {Window} view (Optional) The view containing the target. This is
 *      typically the window object. The default is window.
 * @param {Number} detail (Optional) Specifies some detail information about
 *      the event depending on the type of event.
 * @param {Number} screenX (Optional) The x-coordinate on the screen at which
 *      point the event occured. The default is 0.
 * @param {Number} screenY (Optional) The y-coordinate on the screen at which
 *      point the event occured. The default is 0.
 * @param {Number} clientX (Optional) The x-coordinate on the client at which
 *      point the event occured. The default is 0.
 * @param {Number} clientY (Optional) The y-coordinate on the client at which
 *      point the event occured. The default is 0.
 * @param {Boolean} ctrlKey (Optional) Indicates if one of the CTRL keys
 *      is pressed while the event is firing. The default is false.
 * @param {Boolean} altKey (Optional) Indicates if one of the ALT keys
 *      is pressed while the event is firing. The default is false.
 * @param {Boolean} shiftKey (Optional) Indicates if one of the SHIFT keys
 *      is pressed while the event is firing. The default is false.
 * @param {Boolean} metaKey (Optional) Indicates if one of the META keys
 *      is pressed while the event is firing. The default is false.
 * @param {Number} scale (iOS v2+ only) The distance between two fingers
 *      since the start of an event as a multiplier of the initial distance.
 *      The default value is 1.0.
 * @param {Number} rotation (iOS v2+ only) The delta rotation since the start
 *      of an event, in degrees, where clockwise is positive and
 *      counter-clockwise is negative. The default value is 0.0.
 */
function simulateGestureEvent(target, type,
    bubbles,            // boolean
    cancelable,         // boolean
    view,               // DOMWindow
    detail,             // long
    screenX, screenY,   // long
    clientX, clientY,   // long
    ctrlKey, altKey, shiftKey, metaKey, // boolean
    scale,              // float
    rotation            // float
) {
    var customEvent;

    if(!Y.UA.ios || Y.UA.ios<2.0) {
        Y.error("simulateGestureEvent(): Native gesture DOM eventframe is not available in this platform.");
    }

    // check taget
    if (!target){
        Y.error("simulateGestureEvent(): Invalid target.");
    }

    //check event type
    if (Y.Lang.isString(type)) {
        type = type.toLowerCase();

        //make sure it's a supported touch event
        if (!gestureEvents[type]){
            Y.error("simulateTouchEvent(): Event type '" + type + "' not supported.");
        }
    } else {
        Y.error("simulateGestureEvent(): Event type must be a string.");
    }

    // setup default values
    if (!Y.Lang.isBoolean(bubbles)) { bubbles = true; } // bubble by default
    if (!Y.Lang.isBoolean(cancelable)) { cancelable = true; }
    if (!Y.Lang.isObject(view))     { view = Y.config.win; }
    if (!Y.Lang.isNumber(detail))   { detail = 2; }     // usually not used.
    if (!Y.Lang.isNumber(screenX))  { screenX = 0; }
    if (!Y.Lang.isNumber(screenY))  { screenY = 0; }
    if (!Y.Lang.isNumber(clientX))  { clientX = 0; }
    if (!Y.Lang.isNumber(clientY))  { clientY = 0; }
    if (!Y.Lang.isBoolean(ctrlKey)) { ctrlKey = false; }
    if (!Y.Lang.isBoolean(altKey))  { altKey = false; }
    if (!Y.Lang.isBoolean(shiftKey)){ shiftKey = false; }
    if (!Y.Lang.isBoolean(metaKey)) { metaKey = false; }

    if (!Y.Lang.isNumber(scale)){ scale = 1.0; }
    if (!Y.Lang.isNumber(rotation)){ rotation = 0.0; }

    customEvent = Y.config.doc.createEvent("GestureEvent");

    customEvent.initGestureEvent(type, bubbles, cancelable, view, detail,
        screenX, screenY, clientX, clientY,
        ctrlKey, altKey, shiftKey, metaKey,
        target, scale, rotation);

    target.dispatchEvent(customEvent);
}


/*
 * @method simulateTouchEvent
 * @private
 * @param {HTMLElement} target The target of the given event.
 * @param {String} type The type of event to fire. This can be any one of
 *      the following: touchstart, touchmove, touchend, touchcancel.
 * @param {Boolean} bubbles (Optional) Indicates if the event can be
 *      bubbled up. DOM Level 2 specifies that all mouse events bubble by
 *      default. The default is true.
 * @param {Boolean} cancelable (Optional) Indicates if the event can be
 *      canceled using preventDefault(). DOM Level 2 specifies that all
 *      touch events except touchcancel can be cancelled. The default
 *      is true for all events except touchcancel, for which the default
 *      is false.
 * @param {Window} view (Optional) The view containing the target. This is
 *      typically the window object. The default is window.
 * @param {Number} detail (Optional) Specifies some detail information about
 *      the event depending on the type of event.
 * @param {Number} screenX (Optional) The x-coordinate on the screen at which
 *      point the event occured. The default is 0.
 * @param {Number} screenY (Optional) The y-coordinate on the screen at which
 *      point the event occured. The default is 0.
 * @param {Number} clientX (Optional) The x-coordinate on the client at which
 *      point the event occured. The default is 0.
 * @param {Number} clientY (Optional) The y-coordinate on the client at which
 *      point the event occured. The default is 0.
 * @param {Boolean} ctrlKey (Optional) Indicates if one of the CTRL keys
 *      is pressed while the event is firing. The default is false.
 * @param {Boolean} altKey (Optional) Indicates if one of the ALT keys
 *      is pressed while the event is firing. The default is false.
 * @param {Boolean} shiftKey (Optional) Indicates if one of the SHIFT keys
 *      is pressed while the event is firing. The default is false.
 * @param {Boolean} metaKey (Optional) Indicates if one of the META keys
 *      is pressed while the event is firing. The default is false.
 * @param {TouchList} touches A collection of Touch objects representing
 *      all touches associated with this event.
 * @param {TouchList} targetTouches A collection of Touch objects
 *      representing all touches associated with this target.
 * @param {TouchList} changedTouches A collection of Touch objects
 *      representing all touches that changed in this event.
 * @param {Number} scale (iOS v2+ only) The distance between two fingers
 *      since the start of an event as a multiplier of the initial distance.
 *      The default value is 1.0.
 * @param {Number} rotation (iOS v2+ only) The delta rotation since the start
 *      of an event, in degrees, where clockwise is positive and
 *      counter-clockwise is negative. The default value is 0.0.
 */
function simulateTouchEvent(target, type,
    bubbles,            // boolean
    cancelable,         // boolean
    view,               // DOMWindow
    detail,             // long
    screenX, screenY,   // long
    clientX, clientY,   // long
    ctrlKey, altKey, shiftKey, metaKey, // boolean
    touches,            // TouchList
    targetTouches,      // TouchList
    changedTouches,     // TouchList
    scale,              // float
    rotation            // float
) {

    var customEvent;

    // check taget
    if (!target){
        Y.error("simulateTouchEvent(): Invalid target.");
    }

    //check event type
    if (Y.Lang.isString(type)) {
        type = type.toLowerCase();

        //make sure it's a supported touch event
        if (!touchEvents[type]){
            Y.error("simulateTouchEvent(): Event type '" + type + "' not supported.");
        }
    } else {
        Y.error("simulateTouchEvent(): Event type must be a string.");
    }

    // note that the caller is responsible to pass appropriate touch objects.
    // check touch objects
    // Android(even 4.0) doesn't define TouchList yet
    /*if(type === 'touchstart' || type === 'touchmove') {
        if(!touches instanceof TouchList) {
            Y.error('simulateTouchEvent(): Invalid touches. It must be a TouchList');
        } else {
            if(touches.length === 0) {
                Y.error('simulateTouchEvent(): No touch object found.');
            }
        }
    } else if(type === 'touchend') {
        if(!changedTouches instanceof TouchList) {
            Y.error('simulateTouchEvent(): Invalid touches. It must be a TouchList');
        } else {
            if(changedTouches.length === 0) {
                Y.error('simulateTouchEvent(): No touch object found.');
            }
        }
    }*/

    if(type === 'touchstart' || type === 'touchmove') {
        if(touches.length === 0) {
            Y.error('simulateTouchEvent(): No touch object in touches');
        }
    } else if(type === 'touchend') {
        if(changedTouches.length === 0) {
            Y.error('simulateTouchEvent(): No touch object in changedTouches');
        }
    }

    // setup default values
    if (!Y.Lang.isBoolean(bubbles)) { bubbles = true; } // bubble by default.
    if (!Y.Lang.isBoolean(cancelable)) {
        cancelable = (type !== "touchcancel"); // touchcancel is not cancelled
    }
    if (!Y.Lang.isObject(view))     { view = Y.config.win; }
    if (!Y.Lang.isNumber(detail))   { detail = 1; } // usually not used. defaulted to # of touch objects.
    if (!Y.Lang.isNumber(screenX))  { screenX = 0; }
    if (!Y.Lang.isNumber(screenY))  { screenY = 0; }
    if (!Y.Lang.isNumber(clientX))  { clientX = 0; }
    if (!Y.Lang.isNumber(clientY))  { clientY = 0; }
    if (!Y.Lang.isBoolean(ctrlKey)) { ctrlKey = false; }
    if (!Y.Lang.isBoolean(altKey))  { altKey = false; }
    if (!Y.Lang.isBoolean(shiftKey)){ shiftKey = false; }
    if (!Y.Lang.isBoolean(metaKey)) { metaKey = false; }
    if (!Y.Lang.isNumber(scale))    { scale = 1.0; }
    if (!Y.Lang.isNumber(rotation)) { rotation = 0.0; }


    //check for DOM-compliant browsers first
    if (Y.Lang.isFunction(Y.config.doc.createEvent)) {
        if (Y.UA.android) {
            /*
                * Couldn't find android start version that supports touch event.
                * Assumed supported(btw APIs broken till icecream sandwitch)
                * from the beginning.
            */
            if(Y.UA.android < 4.0) {
                /*
                    * Touch APIs are broken in androids older than 4.0. We will use
                    * simulated touch apis for these versions.
                    * App developer still can listen for touch events. This events
                    * will be dispatched with touch event types.
                    *
                    * (Note) Used target for the relatedTarget. Need to verify if
                    * it has a side effect.
                */
                customEvent = Y.config.doc.createEvent("MouseEvents");
                customEvent.initMouseEvent(type, bubbles, cancelable, view, detail,
                    screenX, screenY, clientX, clientY,
                    ctrlKey, altKey, shiftKey, metaKey,
                    0, target);

                customEvent.touches = touches;
                customEvent.targetTouches = targetTouches;
                customEvent.changedTouches = changedTouches;
            } else {
                customEvent = Y.config.doc.createEvent("TouchEvent");

                // Andoroid isn't compliant W3C initTouchEvent method signature.
                customEvent.initTouchEvent(touches, targetTouches, changedTouches,
                    type, view,
                    screenX, screenY, clientX, clientY,
                    ctrlKey, altKey, shiftKey, metaKey);
            }
        } else if (Y.UA.ios) {
            if(Y.UA.ios >= 2.0) {
                customEvent = Y.config.doc.createEvent("TouchEvent");

                // Available iOS 2.0 and later
                customEvent.initTouchEvent(type, bubbles, cancelable, view, detail,
                    screenX, screenY, clientX, clientY,
                    ctrlKey, altKey, shiftKey, metaKey,
                    touches, targetTouches, changedTouches,
                    scale, rotation);
            } else {
                Y.error('simulateTouchEvent(): No touch event simulation framework present for iOS, '+Y.UA.ios+'.');
            }
        } else {
            Y.error('simulateTouchEvent(): Not supported agent yet, '+Y.UA.userAgent);
        }

        //fire the event
        target.dispatchEvent(customEvent);
    //} else if (Y.Lang.isObject(doc.createEventObject)){ // Windows Mobile/IE, support later
    } else {
        Y.error('simulateTouchEvent(): No event simulation framework present.');
    }
}

/**
 * Simulates the event or gesture with the given name on a target.
 * @param {HTMLElement} target The DOM element that's the target of the event.
 * @param {String} type The type of event or name of the supported gesture to simulate
 *      (i.e., "click", "doubletap", "flick").
 * @param {Object} options (Optional) Extra options to copy onto the event object.
 *      For gestures, options are used to refine the gesture behavior.
 * @for Event
 * @method simulate
 * @static
 */
Y.Event.simulate = function(target, type, options){

    options = options || {};

    if (mouseEvents[type] || pointerEvents[type]){
        simulateMouseEvent(target, type, options.bubbles,
            options.cancelable, options.view, options.detail, options.screenX,
            options.screenY, options.clientX, options.clientY, options.ctrlKey,
            options.altKey, options.shiftKey, options.metaKey, options.button,
            options.relatedTarget);
    } else if (keyEvents[type]){
        simulateKeyEvent(target, type, options.bubbles,
            options.cancelable, options.view, options.ctrlKey,
            options.altKey, options.shiftKey, options.metaKey,
            options.keyCode, options.charCode);
    } else if (uiEvents[type]){
        simulateUIEvent(target, type, options.bubbles,
            options.cancelable, options.view, options.detail);

    // touch low-level event simulation
    } else if (touchEvents[type]) {
        if((Y.config.win && ("ontouchstart" in Y.config.win)) && !(Y.UA.phantomjs) && !(Y.UA.chrome && Y.UA.chrome < 6)) {
            simulateTouchEvent(target, type,
                options.bubbles, options.cancelable, options.view, options.detail,
                options.screenX, options.screenY, options.clientX, options.clientY,
                options.ctrlKey, options.altKey, options.shiftKey, options.metaKey,
                options.touches, options.targetTouches, options.changedTouches,
                options.scale, options.rotation);
        } else {
            Y.error("simulate(): Event '" + type + "' can't be simulated. Use gesture-simulate module instead.");
        }

    // ios gesture low-level event simulation (iOS v2+ only)
    } else if(Y.UA.ios && Y.UA.ios >= 2.0 && gestureEvents[type]) {
        simulateGestureEvent(target, type,
            options.bubbles, options.cancelable, options.view, options.detail,
            options.screenX, options.screenY, options.clientX, options.clientY,
            options.ctrlKey, options.altKey, options.shiftKey, options.metaKey,
            options.scale, options.rotation);

    // anything else
    } else {
        Y.error("simulate(): Event '" + type + "' can't be simulated.");
    }
};


})();



}, '3.16.0', {"requires": ["event-base"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('async-queue', function (Y, NAME) {

/**
 * <p>AsyncQueue allows you create a chain of function callbacks executed
 * via setTimeout (or synchronously) that are guaranteed to run in order.
 * Items in the queue can be promoted or removed.  Start or resume the
 * execution chain with run().  pause() to temporarily delay execution, or
 * stop() to halt and clear the queue.</p>
 *
 * @module async-queue
 */

/**
 * <p>A specialized queue class that supports scheduling callbacks to execute
 * sequentially, iteratively, even asynchronously.</p>
 *
 * <p>Callbacks can be function refs or objects with the following keys.  Only
 * the <code>fn</code> key is required.</p>
 *
 * <ul>
 * <li><code>fn</code> -- The callback function</li>
 * <li><code>context</code> -- The execution context for the callbackFn.</li>
 * <li><code>args</code> -- Arguments to pass to callbackFn.</li>
 * <li><code>timeout</code> -- Millisecond delay before executing callbackFn.
 *                     (Applies to each iterative execution of callback)</li>
 * <li><code>iterations</code> -- Number of times to repeat the callback.
 * <li><code>until</code> -- Repeat the callback until this function returns
 *                         true.  This setting trumps iterations.</li>
 * <li><code>autoContinue</code> -- Set to false to prevent the AsyncQueue from
 *                        executing the next callback in the Queue after
 *                        the callback completes.</li>
 * <li><code>id</code> -- Name that can be used to get, promote, get the
 *                        indexOf, or delete this callback.</li>
 * </ul>
 *
 * @class AsyncQueue
 * @extends EventTarget
 * @constructor
 * @param callback* {Function|Object} 0..n callbacks to seed the queue
 */
Y.AsyncQueue = function() {
    this._init();
    this.add.apply(this, arguments);
};

var Queue   = Y.AsyncQueue,
    EXECUTE = 'execute',
    SHIFT   = 'shift',
    PROMOTE = 'promote',
    REMOVE  = 'remove',

    isObject   = Y.Lang.isObject,
    isFunction = Y.Lang.isFunction;

/**
 * <p>Static default values used to populate callback configuration properties.
 * Preconfigured defaults include:</p>
 *
 * <ul>
 *  <li><code>autoContinue</code>: <code>true</code></li>
 *  <li><code>iterations</code>: 1</li>
 *  <li><code>timeout</code>: 10 (10ms between callbacks)</li>
 *  <li><code>until</code>: (function to run until iterations &lt;= 0)</li>
 * </ul>
 *
 * @property defaults
 * @type {Object}
 * @static
 */
Queue.defaults = Y.mix({
    autoContinue : true,
    iterations   : 1,
    timeout      : 10,
    until        : function () {
        this.iterations |= 0;
        return this.iterations <= 0;
    }
}, Y.config.queueDefaults || {});

Y.extend(Queue, Y.EventTarget, {
    /**
     * Used to indicate the queue is currently executing a callback.
     *
     * @property _running
     * @type {Boolean|Object} true for synchronous callback execution, the
     *                        return handle from Y.later for async callbacks.
     *                        Otherwise false.
     * @protected
     */
    _running : false,

    /**
     * Initializes the AsyncQueue instance properties and events.
     *
     * @method _init
     * @protected
     */
    _init : function () {
        Y.EventTarget.call(this, { prefix: 'queue', emitFacade: true });

        this._q = [];

        /**
         * Callback defaults for this instance.  Static defaults that are not
         * overridden are also included.
         *
         * @property defaults
         * @type {Object}
         */
        this.defaults = {};

        this._initEvents();
    },

    /**
     * Initializes the instance events.
     *
     * @method _initEvents
     * @protected
     */
    _initEvents : function () {
        this.publish({
            'execute' : { defaultFn : this._defExecFn,    emitFacade: true },
            'shift'   : { defaultFn : this._defShiftFn,   emitFacade: true },
            'add'     : { defaultFn : this._defAddFn,     emitFacade: true },
            'promote' : { defaultFn : this._defPromoteFn, emitFacade: true },
            'remove'  : { defaultFn : this._defRemoveFn,  emitFacade: true }
        });
    },

    /**
     * Returns the next callback needing execution.  If a callback is
     * configured to repeat via iterations or until, it will be returned until
     * the completion criteria is met.
     *
     * When the queue is empty, null is returned.
     *
     * @method next
     * @return {Function} the callback to execute
     */
    next : function () {
        var callback;

        while (this._q.length) {
            callback = this._q[0] = this._prepare(this._q[0]);
            if (callback && callback.until()) {
                this.fire(SHIFT, { callback: callback });
                callback = null;
            } else {
                break;
            }
        }

        return callback || null;
    },

    /**
     * Default functionality for the &quot;shift&quot; event.  Shifts the
     * callback stored in the event object's <em>callback</em> property from
     * the queue if it is the first item.
     *
     * @method _defShiftFn
     * @param e {Event} The event object
     * @protected
     */
    _defShiftFn : function (e) {
        if (this.indexOf(e.callback) === 0) {
            this._q.shift();
        }
    },

    /**
     * Creates a wrapper function to execute the callback using the aggregated
     * configuration generated by combining the static AsyncQueue.defaults, the
     * instance defaults, and the specified callback settings.
     *
     * The wrapper function is decorated with the callback configuration as
     * properties for runtime modification.
     *
     * @method _prepare
     * @param callback {Object|Function} the raw callback
     * @return {Function} a decorated function wrapper to execute the callback
     * @protected
     */
    _prepare: function (callback) {
        if (isFunction(callback) && callback._prepared) {
            return callback;
        }

        var config = Y.merge(
            Queue.defaults,
            { context : this, args: [], _prepared: true },
            this.defaults,
            (isFunction(callback) ? { fn: callback } : callback)),

            wrapper = Y.bind(function () {
                if (!wrapper._running) {
                    wrapper.iterations--;
                }
                if (isFunction(wrapper.fn)) {
                    wrapper.fn.apply(wrapper.context || Y,
                                     Y.Array(wrapper.args));
                }
            }, this);

        return Y.mix(wrapper, config);
    },

    /**
     * Sets the queue in motion.  All queued callbacks will be executed in
     * order unless pause() or stop() is called or if one of the callbacks is
     * configured with autoContinue: false.
     *
     * @method run
     * @return {AsyncQueue} the AsyncQueue instance
     * @chainable
     */
    run : function () {
        var callback,
            cont = true;

        if (this._executing) {
            this._running = true;
            return this;
        }

        for (callback = this.next();
            callback && !this.isRunning();
            callback = this.next())
        {
            cont = (callback.timeout < 0) ?
                this._execute(callback) :
                this._schedule(callback);

            // Break to avoid an extra call to next (final-expression of the
            // 'for' loop), because the until function of the next callback
            // in the queue may return a wrong result if it depends on the
            // not-yet-finished work of the previous callback.
            if (!cont) {
                break;
            }
        }

        if (!callback) {
            /**
             * Event fired when there is no remaining callback in the running queue. Also fired after stop().
             * @event complete
             */
            this.fire('complete');
        }

        return this;
    },

    /**
     * Handles the execution of callbacks. Returns a boolean indicating
     * whether it is appropriate to continue running.
     *
     * @method _execute
     * @param callback {Object} the callback object to execute
     * @return {Boolean} whether the run loop should continue
     * @protected
     */
    _execute : function (callback) {

        this._running   = callback._running = true;
        this._executing = callback;

        callback.iterations--;
        this.fire(EXECUTE, { callback: callback });

        var cont = this._running && callback.autoContinue;

        this._running   = callback._running = false;
        this._executing = false;

        return cont;
    },

    /**
     * Schedules the execution of asynchronous callbacks.
     *
     * @method _schedule
     * @param callback {Object} the callback object to execute
     * @return {Boolean} whether the run loop should continue
     * @protected
     */
    _schedule : function (callback) {
        this._running = Y.later(callback.timeout, this, function () {
            if (this._execute(callback)) {
                this.run();
            }
        });

        return false;
    },

    /**
     * Determines if the queue is waiting for a callback to complete execution.
     *
     * @method isRunning
     * @return {Boolean} true if queue is waiting for a
     *                   from any initiated transactions
     */
    isRunning : function () {
        return !!this._running;
    },

    /**
     * Default functionality for the &quot;execute&quot; event.  Executes the
     * callback function
     *
     * @method _defExecFn
     * @param e {Event} the event object
     * @protected
     */
    _defExecFn : function (e) {
        e.callback();
    },

    /**
     * Add any number of callbacks to the end of the queue. Callbacks may be
     * provided as functions or objects.
     *
     * @method add
     * @param callback* {Function|Object} 0..n callbacks
     * @return {AsyncQueue} the AsyncQueue instance
     * @chainable
     */
    add : function () {
        this.fire('add', { callbacks: Y.Array(arguments,0,true) });

        return this;
    },

    /**
     * Default functionality for the &quot;add&quot; event.  Adds the callbacks
     * in the event facade to the queue. Callbacks successfully added to the
     * queue are present in the event's <code>added</code> property in the
     * after phase.
     *
     * @method _defAddFn
     * @param e {Event} the event object
     * @protected
     */
    _defAddFn : function(e) {
        var _q = this._q,
            added = [];

        Y.Array.each(e.callbacks, function (c) {
            if (isObject(c)) {
                _q.push(c);
                added.push(c);
            }
        });

        e.added = added;
    },

    /**
     * Pause the execution of the queue after the execution of the current
     * callback completes.  If called from code outside of a queued callback,
     * clears the timeout for the pending callback. Paused queue can be
     * restarted with q.run()
     *
     * @method pause
     * @return {AsyncQueue} the AsyncQueue instance
     * @chainable
     */
    pause: function () {
        if (this._running && isObject(this._running)) {
            this._running.cancel();
        }

        this._running = false;

        return this;
    },

    /**
     * Stop and clear the queue after the current execution of the
     * current callback completes.
     *
     * @method stop
     * @return {AsyncQueue} the AsyncQueue instance
     * @chainable
     */
    stop : function () {

        this._q = [];

        if (this._running && isObject(this._running)) {
            this._running.cancel();
            this._running = false;
        }
        // otherwise don't systematically set this._running to false, because if
        // stop has been called from inside a queued callback, the _execute method
        // currenty running needs to call run() one more time for the 'complete'
        // event to be fired.

        // if stop is called from outside a callback, we need to explicitely call
        // run() once again to fire the 'complete' event.
        if (!this._executing) {
            this.run();
        }

        return this;
    },

    /**
     * Returns the current index of a callback.  Pass in either the id or
     * callback function from getCallback.
     *
     * @method indexOf
     * @param callback {String|Function} the callback or its specified id
     * @return {Number} index of the callback or -1 if not found
     */
    indexOf : function (callback) {
        var i = 0, len = this._q.length, c;

        for (; i < len; ++i) {
            c = this._q[i];
            if (c === callback || c.id === callback) {
                return i;
            }
        }

        return -1;
    },

    /**
     * Retrieve a callback by its id.  Useful to modify the configuration
     * while the queue is running.
     *
     * @method getCallback
     * @param id {String} the id assigned to the callback
     * @return {Object} the callback object
     */
    getCallback : function (id) {
        var i = this.indexOf(id);

        return (i > -1) ? this._q[i] : null;
    },

    /**
     * Promotes the named callback to the top of the queue. If a callback is
     * currently executing or looping (via until or iterations), the promotion
     * is scheduled to occur after the current callback has completed.
     *
     * @method promote
     * @param callback {String|Object} the callback object or a callback's id
     * @return {AsyncQueue} the AsyncQueue instance
     * @chainable
     */
    promote : function (callback) {
        var payload = { callback : callback },e;

        if (this.isRunning()) {
            e = this.after(SHIFT, function () {
                    this.fire(PROMOTE, payload);
                    e.detach();
                }, this);
        } else {
            this.fire(PROMOTE, payload);
        }

        return this;
    },

    /**
     * <p>Default functionality for the &quot;promote&quot; event.  Promotes the
     * named callback to the head of the queue.</p>
     *
     * <p>The event object will contain a property &quot;callback&quot;, which
     * holds the id of a callback or the callback object itself.</p>
     *
     * @method _defPromoteFn
     * @param e {Event} the custom event
     * @protected
     */
    _defPromoteFn : function (e) {
        var i = this.indexOf(e.callback),
            promoted = (i > -1) ? this._q.splice(i,1)[0] : null;

        e.promoted = promoted;

        if (promoted) {
            this._q.unshift(promoted);
        }
    },

    /**
     * Removes the callback from the queue.  If the queue is active, the
     * removal is scheduled to occur after the current callback has completed.
     *
     * @method remove
     * @param callback {String|Object} the callback object or a callback's id
     * @return {AsyncQueue} the AsyncQueue instance
     * @chainable
     */
    remove : function (callback) {
        var payload = { callback : callback },e;

        // Can't return the removed callback because of the deferral until
        // current callback is complete
        if (this.isRunning()) {
            e = this.after(SHIFT, function () {
                    this.fire(REMOVE, payload);
                    e.detach();
                },this);
        } else {
            this.fire(REMOVE, payload);
        }

        return this;
    },

    /**
     * <p>Default functionality for the &quot;remove&quot; event.  Removes the
     * callback from the queue.</p>
     *
     * <p>The event object will contain a property &quot;callback&quot;, which
     * holds the id of a callback or the callback object itself.</p>
     *
     * @method _defRemoveFn
     * @param e {Event} the custom event
     * @protected
     */
    _defRemoveFn : function (e) {
        var i = this.indexOf(e.callback);

        e.removed = (i > -1) ? this._q.splice(i,1)[0] : null;
    },

    /**
     * Returns the number of callbacks in the queue.
     *
     * @method size
     * @return {Number}
     */
    size : function () {
        // next() flushes callbacks that have met their until() criteria and
        // therefore shouldn't count since they wouldn't execute anyway.
        if (!this.isRunning()) {
            this.next();
        }

        return this._q.length;
    }
});



}, '3.16.0', {"requires": ["event-custom"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('dom-screen', function (Y, NAME) {

(function(Y) {

/**
 * Adds position and region management functionality to DOM.
 * @module dom
 * @submodule dom-screen
 * @for DOM
 */

var DOCUMENT_ELEMENT = 'documentElement',
    COMPAT_MODE = 'compatMode',
    POSITION = 'position',
    FIXED = 'fixed',
    RELATIVE = 'relative',
    LEFT = 'left',
    TOP = 'top',
    _BACK_COMPAT = 'BackCompat',
    MEDIUM = 'medium',
    BORDER_LEFT_WIDTH = 'borderLeftWidth',
    BORDER_TOP_WIDTH = 'borderTopWidth',
    GET_BOUNDING_CLIENT_RECT = 'getBoundingClientRect',
    GET_COMPUTED_STYLE = 'getComputedStyle',

    Y_DOM = Y.DOM,

    // TODO: how about thead/tbody/tfoot/tr?
    // TODO: does caption matter?
    RE_TABLE = /^t(?:able|d|h)$/i,

    SCROLL_NODE;

if (Y.UA.ie) {
    if (Y.config.doc[COMPAT_MODE] !== 'BackCompat') {
        SCROLL_NODE = DOCUMENT_ELEMENT;
    } else {
        SCROLL_NODE = 'body';
    }
}

Y.mix(Y_DOM, {
    /**
     * Returns the inner height of the viewport (exludes scrollbar).
     * @method winHeight
     * @return {Number} The current height of the viewport.
     */
    winHeight: function(node) {
        var h = Y_DOM._getWinSize(node).height;
        return h;
    },

    /**
     * Returns the inner width of the viewport (exludes scrollbar).
     * @method winWidth
     * @return {Number} The current width of the viewport.
     */
    winWidth: function(node) {
        var w = Y_DOM._getWinSize(node).width;
        return w;
    },

    /**
     * Document height
     * @method docHeight
     * @return {Number} The current height of the document.
     */
    docHeight:  function(node) {
        var h = Y_DOM._getDocSize(node).height;
        return Math.max(h, Y_DOM._getWinSize(node).height);
    },

    /**
     * Document width
     * @method docWidth
     * @return {Number} The current width of the document.
     */
    docWidth:  function(node) {
        var w = Y_DOM._getDocSize(node).width;
        return Math.max(w, Y_DOM._getWinSize(node).width);
    },

    /**
     * Amount page has been scroll horizontally
     * @method docScrollX
     * @return {Number} The current amount the screen is scrolled horizontally.
     */
    docScrollX: function(node, doc) {
        doc = doc || (node) ? Y_DOM._getDoc(node) : Y.config.doc; // perf optimization
        var dv = doc.defaultView,
            pageOffset = (dv) ? dv.pageXOffset : 0;
        return Math.max(doc[DOCUMENT_ELEMENT].scrollLeft, doc.body.scrollLeft, pageOffset);
    },

    /**
     * Amount page has been scroll vertically
     * @method docScrollY
     * @return {Number} The current amount the screen is scrolled vertically.
     */
    docScrollY:  function(node, doc) {
        doc = doc || (node) ? Y_DOM._getDoc(node) : Y.config.doc; // perf optimization
        var dv = doc.defaultView,
            pageOffset = (dv) ? dv.pageYOffset : 0;
        return Math.max(doc[DOCUMENT_ELEMENT].scrollTop, doc.body.scrollTop, pageOffset);
    },

    /**
     * Gets the current position of an element based on page coordinates.
     * Element must be part of the DOM tree to have page coordinates
     * (display:none or elements not appended return false).
     * @method getXY
     * @param element The target element
     * @return {Array} The XY position of the element

     TODO: test inDocument/display?
     */
    getXY: function() {
        if (Y.config.doc[DOCUMENT_ELEMENT][GET_BOUNDING_CLIENT_RECT]) {
            return function(node) {
                var xy = null,
                    scrollLeft,
                    scrollTop,
                    mode,
                    box,
                    offX,
                    offY,
                    doc,
                    win,
                    inDoc,
                    rootNode;

                if (node && node.tagName) {
                    doc = node.ownerDocument;
                    mode = doc[COMPAT_MODE];

                    if (mode !== _BACK_COMPAT) {
                        rootNode = doc[DOCUMENT_ELEMENT];
                    } else {
                        rootNode = doc.body;
                    }

                    // inline inDoc check for perf
                    if (rootNode.contains) {
                        inDoc = rootNode.contains(node);
                    } else {
                        inDoc = Y.DOM.contains(rootNode, node);
                    }

                    if (inDoc) {
                        win = doc.defaultView;

                        // inline scroll calc for perf
                        if (win && 'pageXOffset' in win) {
                            scrollLeft = win.pageXOffset;
                            scrollTop = win.pageYOffset;
                        } else {
                            scrollLeft = (SCROLL_NODE) ? doc[SCROLL_NODE].scrollLeft : Y_DOM.docScrollX(node, doc);
                            scrollTop = (SCROLL_NODE) ? doc[SCROLL_NODE].scrollTop : Y_DOM.docScrollY(node, doc);
                        }

                        if (Y.UA.ie) { // IE < 8, quirks, or compatMode
                            if (!doc.documentMode || doc.documentMode < 8 || mode === _BACK_COMPAT) {
                                offX = rootNode.clientLeft;
                                offY = rootNode.clientTop;
                            }
                        }
                        box = node[GET_BOUNDING_CLIENT_RECT]();
                        xy = [box.left, box.top];

                        if (offX || offY) {
                                xy[0] -= offX;
                                xy[1] -= offY;

                        }
                        if ((scrollTop || scrollLeft)) {
                            if (!Y.UA.ios || (Y.UA.ios >= 4.2)) {
                                xy[0] += scrollLeft;
                                xy[1] += scrollTop;
                            }

                        }
                    } else {
                        xy = Y_DOM._getOffset(node);
                    }
                }
                return xy;
            };
        } else {
            return function(node) { // manually calculate by crawling up offsetParents
                //Calculate the Top and Left border sizes (assumes pixels)
                var xy = null,
                    doc,
                    parentNode,
                    bCheck,
                    scrollTop,
                    scrollLeft;

                if (node) {
                    if (Y_DOM.inDoc(node)) {
                        xy = [node.offsetLeft, node.offsetTop];
                        doc = node.ownerDocument;
                        parentNode = node;
                        // TODO: refactor with !! or just falsey
                        bCheck = ((Y.UA.gecko || Y.UA.webkit > 519) ? true : false);

                        // TODO: worth refactoring for TOP/LEFT only?
                        while ((parentNode = parentNode.offsetParent)) {
                            xy[0] += parentNode.offsetLeft;
                            xy[1] += parentNode.offsetTop;
                            if (bCheck) {
                                xy = Y_DOM._calcBorders(parentNode, xy);
                            }
                        }

                        // account for any scrolled ancestors
                        if (Y_DOM.getStyle(node, POSITION) != FIXED) {
                            parentNode = node;

                            while ((parentNode = parentNode.parentNode)) {
                                scrollTop = parentNode.scrollTop;
                                scrollLeft = parentNode.scrollLeft;

                                //Firefox does something funky with borders when overflow is not visible.
                                if (Y.UA.gecko && (Y_DOM.getStyle(parentNode, 'overflow') !== 'visible')) {
                                        xy = Y_DOM._calcBorders(parentNode, xy);
                                }


                                if (scrollTop || scrollLeft) {
                                    xy[0] -= scrollLeft;
                                    xy[1] -= scrollTop;
                                }
                            }
                            xy[0] += Y_DOM.docScrollX(node, doc);
                            xy[1] += Y_DOM.docScrollY(node, doc);

                        } else {
                            //Fix FIXED position -- add scrollbars
                            xy[0] += Y_DOM.docScrollX(node, doc);
                            xy[1] += Y_DOM.docScrollY(node, doc);
                        }
                    } else {
                        xy = Y_DOM._getOffset(node);
                    }
                }

                return xy;
            };
        }
    }(),// NOTE: Executing for loadtime branching

    /**
    Gets the width of vertical scrollbars on overflowed containers in the body
    content.

    @method getScrollbarWidth
    @return {Number} Pixel width of a scrollbar in the current browser
    **/
    getScrollbarWidth: Y.cached(function () {
        var doc      = Y.config.doc,
            testNode = doc.createElement('div'),
            body     = doc.getElementsByTagName('body')[0],
            // 0.1 because cached doesn't support falsy refetch values
            width    = 0.1;

        if (body) {
            testNode.style.cssText = "position:absolute;visibility:hidden;overflow:scroll;width:20px;";
            testNode.appendChild(doc.createElement('p')).style.height = '1px';
            body.insertBefore(testNode, body.firstChild);
            width = testNode.offsetWidth - testNode.clientWidth;

            body.removeChild(testNode);
        }

        return width;
    }, null, 0.1),

    /**
     * Gets the current X position of an element based on page coordinates.
     * Element must be part of the DOM tree to have page coordinates
     * (display:none or elements not appended return false).
     * @method getX
     * @param element The target element
     * @return {Number} The X position of the element
     */

    getX: function(node) {
        return Y_DOM.getXY(node)[0];
    },

    /**
     * Gets the current Y position of an element based on page coordinates.
     * Element must be part of the DOM tree to have page coordinates
     * (display:none or elements not appended return false).
     * @method getY
     * @param element The target element
     * @return {Number} The Y position of the element
     */

    getY: function(node) {
        return Y_DOM.getXY(node)[1];
    },

    /**
     * Set the position of an html element in page coordinates.
     * The element must be part of the DOM tree to have page coordinates (display:none or elements not appended return false).
     * @method setXY
     * @param element The target element
     * @param {Array} xy Contains X & Y values for new position (coordinates are page-based)
     * @param {Boolean} noRetry By default we try and set the position a second time if the first fails
     */
    setXY: function(node, xy, noRetry) {
        var setStyle = Y_DOM.setStyle,
            pos,
            delta,
            newXY,
            currentXY;

        if (node && xy) {
            pos = Y_DOM.getStyle(node, POSITION);

            delta = Y_DOM._getOffset(node);
            if (pos == 'static') { // default to relative
                pos = RELATIVE;
                setStyle(node, POSITION, pos);
            }
            currentXY = Y_DOM.getXY(node);

            if (xy[0] !== null) {
                setStyle(node, LEFT, xy[0] - currentXY[0] + delta[0] + 'px');
            }

            if (xy[1] !== null) {
                setStyle(node, TOP, xy[1] - currentXY[1] + delta[1] + 'px');
            }

            if (!noRetry) {
                newXY = Y_DOM.getXY(node);
                if (newXY[0] !== xy[0] || newXY[1] !== xy[1]) {
                    Y_DOM.setXY(node, xy, true);
                }
            }

        } else {
        }
    },

    /**
     * Set the X position of an html element in page coordinates, regardless of how the element is positioned.
     * The element(s) must be part of the DOM tree to have page coordinates (display:none or elements not appended return false).
     * @method setX
     * @param element The target element
     * @param {Number} x The X values for new position (coordinates are page-based)
     */
    setX: function(node, x) {
        return Y_DOM.setXY(node, [x, null]);
    },

    /**
     * Set the Y position of an html element in page coordinates, regardless of how the element is positioned.
     * The element(s) must be part of the DOM tree to have page coordinates (display:none or elements not appended return false).
     * @method setY
     * @param element The target element
     * @param {Number} y The Y values for new position (coordinates are page-based)
     */
    setY: function(node, y) {
        return Y_DOM.setXY(node, [null, y]);
    },

    /**
     * @method swapXY
     * @description Swap the xy position with another node
     * @param {Node} node The node to swap with
     * @param {Node} otherNode The other node to swap with
     * @return {Node}
     */
    swapXY: function(node, otherNode) {
        var xy = Y_DOM.getXY(node);
        Y_DOM.setXY(node, Y_DOM.getXY(otherNode));
        Y_DOM.setXY(otherNode, xy);
    },

    _calcBorders: function(node, xy2) {
        var t = parseInt(Y_DOM[GET_COMPUTED_STYLE](node, BORDER_TOP_WIDTH), 10) || 0,
            l = parseInt(Y_DOM[GET_COMPUTED_STYLE](node, BORDER_LEFT_WIDTH), 10) || 0;
        if (Y.UA.gecko) {
            if (RE_TABLE.test(node.tagName)) {
                t = 0;
                l = 0;
            }
        }
        xy2[0] += l;
        xy2[1] += t;
        return xy2;
    },

    _getWinSize: function(node, doc) {
        doc  = doc || (node) ? Y_DOM._getDoc(node) : Y.config.doc;
        var win = doc.defaultView || doc.parentWindow,
            mode = doc[COMPAT_MODE],
            h = win.innerHeight,
            w = win.innerWidth,
            root = doc[DOCUMENT_ELEMENT];

        if ( mode && !Y.UA.opera ) { // IE, Gecko
            if (mode != 'CSS1Compat') { // Quirks
                root = doc.body;
            }
            h = root.clientHeight;
            w = root.clientWidth;
        }
        return { height: h, width: w };
    },

    _getDocSize: function(node) {
        var doc = (node) ? Y_DOM._getDoc(node) : Y.config.doc,
            root = doc[DOCUMENT_ELEMENT];

        if (doc[COMPAT_MODE] != 'CSS1Compat') {
            root = doc.body;
        }

        return { height: root.scrollHeight, width: root.scrollWidth };
    }
});

})(Y);
(function(Y) {
var TOP = 'top',
    RIGHT = 'right',
    BOTTOM = 'bottom',
    LEFT = 'left',

    getOffsets = function(r1, r2) {
        var t = Math.max(r1[TOP], r2[TOP]),
            r = Math.min(r1[RIGHT], r2[RIGHT]),
            b = Math.min(r1[BOTTOM], r2[BOTTOM]),
            l = Math.max(r1[LEFT], r2[LEFT]),
            ret = {};

        ret[TOP] = t;
        ret[RIGHT] = r;
        ret[BOTTOM] = b;
        ret[LEFT] = l;
        return ret;
    },

    DOM = Y.DOM;

Y.mix(DOM, {
    /**
     * Returns an Object literal containing the following about this element: (top, right, bottom, left)
     * @for DOM
     * @method region
     * @param {HTMLElement} element The DOM element.
     * @return {Object} Object literal containing the following about this element: (top, right, bottom, left)
     */
    region: function(node) {
        var xy = DOM.getXY(node),
            ret = false;

        if (node && xy) {
            ret = DOM._getRegion(
                xy[1], // top
                xy[0] + node.offsetWidth, // right
                xy[1] + node.offsetHeight, // bottom
                xy[0] // left
            );
        }

        return ret;
    },

    /**
     * Find the intersect information for the passed nodes.
     * @method intersect
     * @for DOM
     * @param {HTMLElement} element The first element
     * @param {HTMLElement | Object} element2 The element or region to check the interect with
     * @param {Object} altRegion An object literal containing the region for the first element if we already have the data (for performance e.g. DragDrop)
     * @return {Object} Object literal containing the following intersection data: (top, right, bottom, left, area, yoff, xoff, inRegion)
     */
    intersect: function(node, node2, altRegion) {
        var r = altRegion || DOM.region(node), region = {},
            n = node2,
            off;

        if (n.tagName) {
            region = DOM.region(n);
        } else if (Y.Lang.isObject(node2)) {
            region = node2;
        } else {
            return false;
        }

        off = getOffsets(region, r);
        return {
            top: off[TOP],
            right: off[RIGHT],
            bottom: off[BOTTOM],
            left: off[LEFT],
            area: ((off[BOTTOM] - off[TOP]) * (off[RIGHT] - off[LEFT])),
            yoff: ((off[BOTTOM] - off[TOP])),
            xoff: (off[RIGHT] - off[LEFT]),
            inRegion: DOM.inRegion(node, node2, false, altRegion)
        };

    },
    /**
     * Check if any part of this node is in the passed region
     * @method inRegion
     * @for DOM
     * @param {Object} node The node to get the region from
     * @param {Object} node2 The second node to get the region from or an Object literal of the region
     * @param {Boolean} all Should all of the node be inside the region
     * @param {Object} altRegion An object literal containing the region for this node if we already have the data (for performance e.g. DragDrop)
     * @return {Boolean} True if in region, false if not.
     */
    inRegion: function(node, node2, all, altRegion) {
        var region = {},
            r = altRegion || DOM.region(node),
            n = node2,
            off;

        if (n.tagName) {
            region = DOM.region(n);
        } else if (Y.Lang.isObject(node2)) {
            region = node2;
        } else {
            return false;
        }

        if (all) {
            return (
                r[LEFT]   >= region[LEFT]   &&
                r[RIGHT]  <= region[RIGHT]  &&
                r[TOP]    >= region[TOP]    &&
                r[BOTTOM] <= region[BOTTOM]  );
        } else {
            off = getOffsets(region, r);
            if (off[BOTTOM] >= off[TOP] && off[RIGHT] >= off[LEFT]) {
                return true;
            } else {
                return false;
            }

        }
    },

    /**
     * Check if any part of this element is in the viewport
     * @method inViewportRegion
     * @for DOM
     * @param {HTMLElement} element The DOM element.
     * @param {Boolean} all Should all of the node be inside the region
     * @param {Object} altRegion An object literal containing the region for this node if we already have the data (for performance e.g. DragDrop)
     * @return {Boolean} True if in region, false if not.
     */
    inViewportRegion: function(node, all, altRegion) {
        return DOM.inRegion(node, DOM.viewportRegion(node), all, altRegion);

    },

    _getRegion: function(t, r, b, l) {
        var region = {};

        region[TOP] = region[1] = t;
        region[LEFT] = region[0] = l;
        region[BOTTOM] = b;
        region[RIGHT] = r;
        region.width = region[RIGHT] - region[LEFT];
        region.height = region[BOTTOM] - region[TOP];

        return region;
    },

    /**
     * Returns an Object literal containing the following about the visible region of viewport: (top, right, bottom, left)
     * @method viewportRegion
     * @for DOM
     * @return {Object} Object literal containing the following about the visible region of the viewport: (top, right, bottom, left)
     */
    viewportRegion: function(node) {
        node = node || Y.config.doc.documentElement;
        var ret = false,
            scrollX,
            scrollY;

        if (node) {
            scrollX = DOM.docScrollX(node);
            scrollY = DOM.docScrollY(node);

            ret = DOM._getRegion(scrollY, // top
                DOM.winWidth(node) + scrollX, // right
                scrollY + DOM.winHeight(node), // bottom
                scrollX); // left
        }

        return ret;
    }
});
})(Y);


}, '3.16.0', {"requires": ["dom-base", "dom-style"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('node-screen', function (Y, NAME) {

/**
 * Extended Node interface for managing regions and screen positioning.
 * Adds support for positioning elements and normalizes window size and scroll detection.
 * @module node
 * @submodule node-screen
 */

// these are all "safe" returns, no wrapping required
Y.each([
    /**
     * Returns the inner width of the viewport (exludes scrollbar).
     * @config winWidth
     * @for Node
     * @type {Number}
     */
    'winWidth',

    /**
     * Returns the inner height of the viewport (exludes scrollbar).
     * @config winHeight
     * @type {Number}
     */
    'winHeight',

    /**
     * Document width
     * @config docWidth
     * @type {Number}
     */
    'docWidth',

    /**
     * Document height
     * @config docHeight
     * @type {Number}
     */
    'docHeight',

    /**
     * Pixel distance the page has been scrolled horizontally
     * @config docScrollX
     * @type {Number}
     */
    'docScrollX',

    /**
     * Pixel distance the page has been scrolled vertically
     * @config docScrollY
     * @type {Number}
     */
    'docScrollY'
    ],
    function(name) {
        Y.Node.ATTRS[name] = {
            getter: function() {
                var args = Array.prototype.slice.call(arguments);
                args.unshift(Y.Node.getDOMNode(this));

                return Y.DOM[name].apply(this, args);
            }
        };
    }
);

Y.Node.ATTRS.scrollLeft = {
    getter: function() {
        var node = Y.Node.getDOMNode(this);
        return ('scrollLeft' in node) ? node.scrollLeft : Y.DOM.docScrollX(node);
    },

    setter: function(val) {
        var node = Y.Node.getDOMNode(this);
        if (node) {
            if ('scrollLeft' in node) {
                node.scrollLeft = val;
            } else if (node.document || node.nodeType === 9) {
                Y.DOM._getWin(node).scrollTo(val, Y.DOM.docScrollY(node)); // scroll window if win or doc
            }
        } else {
        }
    }
};

Y.Node.ATTRS.scrollTop = {
    getter: function() {
        var node = Y.Node.getDOMNode(this);
        return ('scrollTop' in node) ? node.scrollTop : Y.DOM.docScrollY(node);
    },

    setter: function(val) {
        var node = Y.Node.getDOMNode(this);
        if (node) {
            if ('scrollTop' in node) {
                node.scrollTop = val;
            } else if (node.document || node.nodeType === 9) {
                Y.DOM._getWin(node).scrollTo(Y.DOM.docScrollX(node), val); // scroll window if win or doc
            }
        } else {
        }
    }
};

Y.Node.importMethod(Y.DOM, [
/**
 * Gets the current position of the node in page coordinates.
 * @method getXY
 * @for Node
 * @return {Array} The XY position of the node
*/
    'getXY',

/**
 * Set the position of the node in page coordinates, regardless of how the node is positioned.
 * @method setXY
 * @param {Array} xy Contains X & Y values for new position (coordinates are page-based)
 * @chainable
 */
    'setXY',

/**
 * Gets the current position of the node in page coordinates.
 * @method getX
 * @return {Number} The X position of the node
*/
    'getX',

/**
 * Set the position of the node in page coordinates, regardless of how the node is positioned.
 * @method setX
 * @param {Number} x X value for new position (coordinates are page-based)
 * @chainable
 */
    'setX',

/**
 * Gets the current position of the node in page coordinates.
 * @method getY
 * @return {Number} The Y position of the node
*/
    'getY',

/**
 * Set the position of the node in page coordinates, regardless of how the node is positioned.
 * @method setY
 * @param {Number} y Y value for new position (coordinates are page-based)
 * @chainable
 */
    'setY',

/**
 * Swaps the XY position of this node with another node.
 * @method swapXY
 * @param {Node | HTMLElement} otherNode The node to swap with.
 * @chainable
 */
    'swapXY'
]);

/**
 * @module node
 * @submodule node-screen
 */

/**
 * Returns a region object for the node
 * @config region
 * @for Node
 * @type Node
 */
Y.Node.ATTRS.region = {
    getter: function() {
        var node = this.getDOMNode(),
            region;

        if (node && !node.tagName) {
            if (node.nodeType === 9) { // document
                node = node.documentElement;
            }
        }
        if (Y.DOM.isWindow(node)) {
            region = Y.DOM.viewportRegion(node);
        } else {
            region = Y.DOM.region(node);
        }
        return region;
    }
};

/**
 * Returns a region object for the node's viewport
 * @config viewportRegion
 * @type Node
 */
Y.Node.ATTRS.viewportRegion = {
    getter: function() {
        return Y.DOM.viewportRegion(Y.Node.getDOMNode(this));
    }
};

Y.Node.importMethod(Y.DOM, 'inViewportRegion');

// these need special treatment to extract 2nd node arg
/**
 * Compares the intersection of the node with another node or region
 * @method intersect
 * @for Node
 * @param {Node|Object} node2 The node or region to compare with.
 * @param {Object} altRegion An alternate region to use (rather than this node's).
 * @return {Object} An object representing the intersection of the regions.
 */
Y.Node.prototype.intersect = function(node2, altRegion) {
    var node1 = Y.Node.getDOMNode(this);
    if (Y.instanceOf(node2, Y.Node)) { // might be a region object
        node2 = Y.Node.getDOMNode(node2);
    }
    return Y.DOM.intersect(node1, node2, altRegion);
};

/**
 * Determines whether or not the node is within the given region.
 * @method inRegion
 * @param {Node|Object} node2 The node or region to compare with.
 * @param {Boolean} all Whether or not all of the node must be in the region.
 * @param {Object} altRegion An alternate region to use (rather than this node's).
 * @return {Boolean} True if in region, false if not.
 */
Y.Node.prototype.inRegion = function(node2, all, altRegion) {
    var node1 = Y.Node.getDOMNode(this);
    if (Y.instanceOf(node2, Y.Node)) { // might be a region object
        node2 = Y.Node.getDOMNode(node2);
    }
    return Y.DOM.inRegion(node1, node2, all, altRegion);
};


}, '3.16.0', {"requires": ["dom-screen", "node-base"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('gesture-simulate', function (Y, NAME) {

/**
 * Simulate high-level user gestures by generating a set of native DOM events.
 *
 * @module gesture-simulate
 * @requires event-simulate, async-queue, node-screen
 */

var NAME = "gesture-simulate",

    // phantomjs check may be temporary, until we determine if it really support touch all the way through, like it claims to (http://code.google.com/p/phantomjs/issues/detail?id=375)
    SUPPORTS_TOUCH = ((Y.config.win && ("ontouchstart" in Y.config.win)) && !(Y.UA.phantomjs) && !(Y.UA.chrome && Y.UA.chrome < 6)),

    gestureNames = {
        tap: 1,
        doubletap: 1,
        press: 1,
        move: 1,
        flick: 1,
        pinch: 1,
        rotate: 1
    },

    touchEvents = {
        touchstart: 1,
        touchmove: 1,
        touchend: 1,
        touchcancel: 1
    },

    document = Y.config.doc,
    emptyTouchList,

    EVENT_INTERVAL = 20,        // 20ms
    START_PAGEX,                // will be adjusted to the node element center
    START_PAGEY,                // will be adjusted to the node element center

    // defaults that user can override.
    DEFAULTS = {
        // tap gestures
        HOLD_TAP: 10,           // 10ms
        DELAY_TAP: 10,          // 10ms

        // press gesture
        HOLD_PRESS: 3000,       // 3sec
        MIN_HOLD_PRESS: 1000,   // 1sec
        MAX_HOLD_PRESS: 60000,  // 1min

        // move gesture
        DISTANCE_MOVE: 200,     // 200 pixels
        DURATION_MOVE: 1000,    // 1sec
        MAX_DURATION_MOVE: 5000,// 5sec

        // flick gesture
        MIN_VELOCITY_FLICK: 1.3,
        DISTANCE_FLICK: 200,     // 200 pixels
        DURATION_FLICK: 1000,    // 1sec
        MAX_DURATION_FLICK: 5000,// 5sec

        // pinch/rotation
        DURATION_PINCH: 1000     // 1sec
    },

    TOUCH_START = 'touchstart',
    TOUCH_MOVE = 'touchmove',
    TOUCH_END = 'touchend',

    GESTURE_START = 'gesturestart',
    GESTURE_CHANGE = 'gesturechange',
    GESTURE_END = 'gestureend',

    MOUSE_UP    = 'mouseup',
    MOUSE_MOVE  = 'mousemove',
    MOUSE_DOWN  = 'mousedown',
    MOUSE_CLICK = 'click',
    MOUSE_DBLCLICK = 'dblclick',

    X_AXIS = 'x',
    Y_AXIS = 'y';


function Simulations(node) {
    if(!node) {
        Y.error(NAME+': invalid target node');
    }
    this.node = node;
    this.target = Y.Node.getDOMNode(node);

    var startXY = this.node.getXY(),
        dims = this._getDims();

    START_PAGEX = startXY[0] + (dims[0])/2;
    START_PAGEY = startXY[1] + (dims[1])/2;
}

Simulations.prototype = {

    /**
     * Helper method to convert a degree to a radian.
     *
     * @method _toRadian
     * @private
     * @param {Number} deg A degree to be converted to a radian.
     * @return {Number} The degree in radian.
     */
    _toRadian: function(deg) {
        return deg * (Math.PI/180);
    },

    /**
     * Helper method to get height/width while accounting for
     * rotation/scale transforms where possible by using the
     * bounding client rectangle height/width instead of the
     * offsetWidth/Height which region uses.
     * @method _getDims
     * @private
     * @return {Array} Array with [height, width]
     */
    _getDims : function() {
        var region,
            width,
            height;

        // Ideally, this should be in DOM somewhere.
        if (this.target.getBoundingClientRect) {
            region = this.target.getBoundingClientRect();

            if ("height" in region) {
                height = region.height;
            } else {
                // IE7,8 has getBCR, but no height.
                height = Math.abs(region.bottom - region.top);
            }

            if ("width" in region) {
                width = region.width;
            } else {
                // IE7,8 has getBCR, but no width.
                width = Math.abs(region.right - region.left);
            }
        } else {
            region = this.node.get("region");
            width = region.width;
            height = region.height;
        }

        return [width, height];
    },

    /**
     * Helper method to convert a point relative to the node element into
     * the point in the page coordination.
     *
     * @method _calculateDefaultPoint
     * @private
     * @param {Array} point A point relative to the node element.
     * @return {Array} The same point in the page coordination.
     */
    _calculateDefaultPoint: function(point) {

        var height;

        if(!Y.Lang.isArray(point) || point.length === 0) {
            point = [START_PAGEX, START_PAGEY];
        } else {
            if(point.length == 1) {
                height = this._getDims[1];
                point[1] = height/2;
            }
            // convert to page(viewport) coordination
            point[0] = this.node.getX() + point[0];
            point[1] = this.node.getY() + point[1];
        }

        return point;
    },

    /**
     * The "rotate" and "pinch" methods are essencially same with the exact same
     * arguments. Only difference is the required parameters. The rotate method
     * requires "rotation" parameter while the pinch method requires "startRadius"
     * and "endRadius" parameters.
     *
     * @method rotate
     * @param {Function} cb The callback to execute when the gesture simulation
     *      is completed.
     * @param {Array} center A center point where the pinch gesture of two fingers
     *      should happen. It is relative to the top left corner of the target
     *      node element.
     * @param {Number} startRadius A radius of start circle where 2 fingers are
     *      on when the gesture starts. This is optional. The default is a fourth of
     *      either target node width or height whichever is smaller.
     * @param {Number} endRadius A radius of end circle where 2 fingers will be on when
     *      the pinch or spread gestures are completed. This is optional.
     *      The default is a fourth of either target node width or height whichever is less.
     * @param {Number} duration A duration of the gesture in millisecond.
     * @param {Number} start A start angle(0 degree at 12 o'clock) where the
     *      gesture should start. Default is 0.
     * @param {Number} rotation A rotation in degree. It is required.
     */
    rotate: function(cb, center, startRadius, endRadius, duration, start, rotation) {
        var radius,
            r1 = startRadius,   // optional
            r2 = endRadius;     // optional

        if(!Y.Lang.isNumber(r1) || !Y.Lang.isNumber(r2) || r1<0 || r2<0) {
            radius = (this.target.offsetWidth < this.target.offsetHeight)?
                this.target.offsetWidth/4 : this.target.offsetHeight/4;
            r1 = radius;
            r2 = radius;
        }

        // required
        if(!Y.Lang.isNumber(rotation)) {
            Y.error(NAME+'Invalid rotation detected.');
        }

        this.pinch(cb, center, r1, r2, duration, start, rotation);
    },

    /**
     * The "rotate" and "pinch" methods are essencially same with the exact same
     * arguments. Only difference is the required parameters. The rotate method
     * requires "rotation" parameter while the pinch method requires "startRadius"
     * and "endRadius" parameters.
     *
     * The "pinch" gesture can simulate various 2 finger gestures such as pinch,
     * spread and/or rotation. The "startRadius" and "endRadius" are required.
     * If endRadius is larger than startRadius, it becomes a spread gesture
     * otherwise a pinch gesture.
     *
     * @method pinch
     * @param {Function} cb The callback to execute when the gesture simulation
     *      is completed.
     * @param {Array} center A center point where the pinch gesture of two fingers
     *      should happen. It is relative to the top left corner of the target
     *      node element.
     * @param {Number} startRadius A radius of start circle where 2 fingers are
     *      on when the gesture starts. This paramenter is required.
     * @param {Number} endRadius A radius of end circle where 2 fingers will be on when
     *      the pinch or spread gestures are completed. This parameter is required.
     * @param {Number} duration A duration of the gesture in millisecond.
     * @param {Number} start A start angle(0 degree at 12 o'clock) where the
     *      gesture should start. Default is 0.
     * @param {Number} rotation If rotation is desired during the pinch or
     *      spread gestures, this parameter can be used. Default is 0 degree.
     */
    pinch: function(cb, center, startRadius, endRadius, duration, start, rotation) {
        var eventQueue,
            i,
            interval = EVENT_INTERVAL,
            touches,
            id = 0,
            r1 = startRadius,   // required
            r2 = endRadius,     // required
            radiusPerStep,
            centerX, centerY,
            startScale, endScale, scalePerStep,
            startRot, endRot, rotPerStep,
            path1 = {start: [], end: []}, // paths for 1st and 2nd fingers.
            path2 = {start: [], end: []},
            steps,
            touchMove;

        center = this._calculateDefaultPoint(center);

        if(!Y.Lang.isNumber(r1) || !Y.Lang.isNumber(r2) || r1<0 || r2<0) {
            Y.error(NAME+'Invalid startRadius and endRadius detected.');
        }

        if(!Y.Lang.isNumber(duration) || duration <= 0) {
            duration = DEFAULTS.DURATION_PINCH;
        }

        if(!Y.Lang.isNumber(start)) {
            start = 0.0;
        } else {
            start = start%360;
            while(start < 0) {
                start += 360;
            }
        }

        if(!Y.Lang.isNumber(rotation)) {
            rotation = 0.0;
        }

        Y.AsyncQueue.defaults.timeout = interval;
        eventQueue = new Y.AsyncQueue();

        // range determination
        centerX = center[0];
        centerY = center[1];

        startRot = start;
        endRot = start + rotation;

        // 1st finger path
        path1.start = [
            centerX + r1*Math.sin(this._toRadian(startRot)),
            centerY - r1*Math.cos(this._toRadian(startRot))
        ];
        path1.end   = [
            centerX + r2*Math.sin(this._toRadian(endRot)),
            centerY - r2*Math.cos(this._toRadian(endRot))
        ];

        // 2nd finger path
        path2.start = [
            centerX - r1*Math.sin(this._toRadian(startRot)),
            centerY + r1*Math.cos(this._toRadian(startRot))
        ];
        path2.end   = [
            centerX - r2*Math.sin(this._toRadian(endRot)),
            centerY + r2*Math.cos(this._toRadian(endRot))
        ];

        startScale = 1.0;
        endScale = endRadius/startRadius;

        // touch/gesture start
        eventQueue.add({
            fn: function() {
                var coord1, coord2, coord, touches;

                // coordinate for each touch object.
                coord1 = {
                    pageX: path1.start[0],
                    pageY: path1.start[1],
                    clientX: path1.start[0],
                    clientY: path1.start[1]
                };
                coord2 = {
                    pageX: path2.start[0],
                    pageY: path2.start[1],
                    clientX: path2.start[0],
                    clientY: path2.start[1]
                };
                touches = this._createTouchList([Y.merge({
                    identifier: (id++)
                }, coord1), Y.merge({
                    identifier: (id++)
                }, coord2)]);

                // coordinate for top level event
                coord = {
                    pageX: (path1.start[0] + path2.start[0])/2,
                    pageY: (path1.start[0] + path2.start[1])/2,
                    clientX: (path1.start[0] + path2.start[0])/2,
                    clientY: (path1.start[0] + path2.start[1])/2
                };

                this._simulateEvent(this.target, TOUCH_START, Y.merge({
                    touches: touches,
                    targetTouches: touches,
                    changedTouches: touches,
                    scale: startScale,
                    rotation: startRot
                }, coord));

                if(Y.UA.ios >= 2.0) {
                    /* gesture starts when the 2nd finger touch starts.
                    * The implementation will fire 1 touch start event for both fingers,
                    * simulating 2 fingers touched on the screen at the same time.
                    */
                    this._simulateEvent(this.target, GESTURE_START, Y.merge({
                        scale: startScale,
                        rotation: startRot
                    }, coord));
                }
            },
            timeout: 0,
            context: this
        });

        // gesture change
        steps = Math.floor(duration/interval);
        radiusPerStep = (r2 - r1)/steps;
        scalePerStep = (endScale - startScale)/steps;
        rotPerStep = (endRot - startRot)/steps;

        touchMove = function(step) {
            var radius = r1 + (radiusPerStep)*step,
                px1 = centerX + radius*Math.sin(this._toRadian(startRot + rotPerStep*step)),
                py1 = centerY - radius*Math.cos(this._toRadian(startRot + rotPerStep*step)),
                px2 = centerX - radius*Math.sin(this._toRadian(startRot + rotPerStep*step)),
                py2 = centerY + radius*Math.cos(this._toRadian(startRot + rotPerStep*step)),
                px = (px1+px2)/2,
                py = (py1+py2)/2,
                coord1, coord2, coord, touches;

            // coordinate for each touch object.
            coord1 = {
                pageX: px1,
                pageY: py1,
                clientX: px1,
                clientY: py1
            };
            coord2 = {
                pageX: px2,
                pageY: py2,
                clientX: px2,
                clientY: py2
            };
            touches = this._createTouchList([Y.merge({
                identifier: (id++)
            }, coord1), Y.merge({
                identifier: (id++)
            }, coord2)]);

            // coordinate for top level event
            coord = {
                pageX: px,
                pageY: py,
                clientX: px,
                clientY: py
            };

            this._simulateEvent(this.target, TOUCH_MOVE, Y.merge({
                touches: touches,
                targetTouches: touches,
                changedTouches: touches,
                scale: startScale + scalePerStep*step,
                rotation: startRot + rotPerStep*step
            }, coord));

            if(Y.UA.ios >= 2.0) {
                this._simulateEvent(this.target, GESTURE_CHANGE, Y.merge({
                    scale: startScale + scalePerStep*step,
                    rotation: startRot + rotPerStep*step
                }, coord));
            }
        };

        for (i=0; i < steps; i++) {
            eventQueue.add({
                fn: touchMove,
                args: [i],
                context: this
            });
        }

        // gesture end
        eventQueue.add({
            fn: function() {
                var emptyTouchList = this._getEmptyTouchList(),
                    coord1, coord2, coord, touches;

                // coordinate for each touch object.
                coord1 = {
                    pageX: path1.end[0],
                    pageY: path1.end[1],
                    clientX: path1.end[0],
                    clientY: path1.end[1]
                };
                coord2 = {
                    pageX: path2.end[0],
                    pageY: path2.end[1],
                    clientX: path2.end[0],
                    clientY: path2.end[1]
                };
                touches = this._createTouchList([Y.merge({
                    identifier: (id++)
                }, coord1), Y.merge({
                    identifier: (id++)
                }, coord2)]);

                // coordinate for top level event
                coord = {
                    pageX: (path1.end[0] + path2.end[0])/2,
                    pageY: (path1.end[0] + path2.end[1])/2,
                    clientX: (path1.end[0] + path2.end[0])/2,
                    clientY: (path1.end[0] + path2.end[1])/2
                };

                if(Y.UA.ios >= 2.0) {
                    this._simulateEvent(this.target, GESTURE_END, Y.merge({
                        scale: endScale,
                        rotation: endRot
                    }, coord));
                }

                this._simulateEvent(this.target, TOUCH_END, Y.merge({
                    touches: emptyTouchList,
                    targetTouches: emptyTouchList,
                    changedTouches: touches,
                    scale: endScale,
                    rotation: endRot
                }, coord));
            },
            context: this
        });

        if(cb && Y.Lang.isFunction(cb)) {
            eventQueue.add({
                fn: cb,

                // by default, the callback runs the node context where
                // simulateGesture method is called.
                context: this.node

                //TODO: Use args to pass error object as 1st param if there is an error.
                //args:
            });
        }

        eventQueue.run();
    },

    /**
     * The "tap" gesture can be used for various single touch point gestures
     * such as single tap, N number of taps, long press. The default is a single
     * tap.
     *
     * @method tap
     * @param {Function} cb The callback to execute when the gesture simulation
     *      is completed.
     * @param {Array} point A point(relative to the top left corner of the
     *      target node element) where the tap gesture should start. The default
     *      is the center of the taget node.
     * @param {Number} times The number of taps. Default is 1.
     * @param {Number} hold The hold time in milliseconds between "touchstart" and
     *      "touchend" event generation. Default is 10ms.
     * @param {Number} delay The time gap in millisecond between taps if this
     *      gesture has more than 1 tap. Default is 10ms.
     */
    tap: function(cb, point, times, hold, delay) {
        var eventQueue = new Y.AsyncQueue(),
            emptyTouchList = this._getEmptyTouchList(),
            touches,
            coord,
            i,
            touchStart,
            touchEnd;

        point = this._calculateDefaultPoint(point);

        if(!Y.Lang.isNumber(times) || times < 1) {
            times = 1;
        }

        if(!Y.Lang.isNumber(hold)) {
            hold = DEFAULTS.HOLD_TAP;
        }

        if(!Y.Lang.isNumber(delay)) {
            delay = DEFAULTS.DELAY_TAP;
        }

        coord = {
            pageX: point[0],
            pageY: point[1],
            clientX: point[0],
            clientY: point[1]
        };

        touches = this._createTouchList([Y.merge({identifier: 0}, coord)]);

        touchStart = function() {
            this._simulateEvent(this.target, TOUCH_START, Y.merge({
                touches: touches,
                targetTouches: touches,
                changedTouches: touches
            }, coord));
        };

        touchEnd = function() {
            this._simulateEvent(this.target, TOUCH_END, Y.merge({
                touches: emptyTouchList,
                targetTouches: emptyTouchList,
                changedTouches: touches
            }, coord));
        };

        for (i=0; i < times; i++) {
            eventQueue.add({
                fn: touchStart,
                context: this,
                timeout: (i === 0)? 0 : delay
            });

            eventQueue.add({
                fn: touchEnd,
                context: this,
                timeout: hold
            });
        }

        if(times > 1 && !SUPPORTS_TOUCH) {
            eventQueue.add({
                fn: function() {
                    this._simulateEvent(this.target, MOUSE_DBLCLICK, coord);
                },
                context: this
            });
        }

        if(cb && Y.Lang.isFunction(cb)) {
            eventQueue.add({
                fn: cb,

                // by default, the callback runs the node context where
                // simulateGesture method is called.
                context: this.node

                //TODO: Use args to pass error object as 1st param if there is an error.
                //args:
            });
        }

        eventQueue.run();
    },

    /**
     * The "flick" gesture is a specialized "move" that has some velocity
     * and the movement always runs either x or y axis. The velocity is calculated
     * with "distance" and "duration" arguments. If the calculated velocity is
     * below than the minimum velocity, the given duration will be ignored and
     * new duration will be created to make a valid flick gesture.
     *
     * @method flick
     * @param {Function} cb The callback to execute when the gesture simulation
     *      is completed.
     * @param {Array} point A point(relative to the top left corner of the
     *      target node element) where the flick gesture should start. The default
     *      is the center of the taget node.
     * @param {String} axis Either "x" or "y".
     * @param {Number} distance A distance in pixels to flick.
     * @param {Number} duration A duration of the gesture in millisecond.
     *
     */
    flick: function(cb, point, axis, distance, duration) {
        var path;

        point = this._calculateDefaultPoint(point);

        if(!Y.Lang.isString(axis)) {
            axis = X_AXIS;
        } else {
            axis = axis.toLowerCase();
            if(axis !== X_AXIS && axis !== Y_AXIS) {
                Y.error(NAME+'(flick): Only x or y axis allowed');
            }
        }

        if(!Y.Lang.isNumber(distance)) {
            distance = DEFAULTS.DISTANCE_FLICK;
        }

        if(!Y.Lang.isNumber(duration)){
            duration = DEFAULTS.DURATION_FLICK; // ms
        } else {
            if(duration > DEFAULTS.MAX_DURATION_FLICK) {
                duration = DEFAULTS.MAX_DURATION_FLICK;
            }
        }

        /*
         * Check if too slow for a flick.
         * Adjust duration if the calculated velocity is less than
         * the minimum velcocity to be claimed as a flick.
         */
        if(Math.abs(distance)/duration < DEFAULTS.MIN_VELOCITY_FLICK) {
            duration = Math.abs(distance)/DEFAULTS.MIN_VELOCITY_FLICK;
        }

        path = {
            start: Y.clone(point),
            end: [
                (axis === X_AXIS) ? point[0]+distance : point[0],
                (axis === Y_AXIS) ? point[1]+distance : point[1]
            ]
        };

        this._move(cb, path, duration);
    },

    /**
     * The "move" gesture simulate the movement of any direction between
     * the straight line of start and end point for the given duration.
     * The path argument is an object with "point", "xdist" and "ydist" properties.
     * The "point" property is an array with x and y coordinations(relative to the
     * top left corner of the target node element) while "xdist" and "ydist"
     * properties are used for the distance along the x and y axis. A negative
     * distance number can be used to drag either left or up direction.
     *
     * If no arguments are given, it will simulate the default move, which
     * is moving 200 pixels from the center of the element to the positive X-axis
     * direction for 1 sec.
     *
     * @method move
     * @param {Function} cb The callback to execute when the gesture simulation
     *      is completed.
     * @param {Object} path An object with "point", "xdist" and "ydist".
     * @param {Number} duration A duration of the gesture in millisecond.
     */
    move: function(cb, path, duration) {
        var convertedPath;

        if(!Y.Lang.isObject(path)) {
            path = {
                point: this._calculateDefaultPoint([]),
                xdist: DEFAULTS.DISTANCE_MOVE,
                ydist: 0
            };
        } else {
            // convert to the page coordination
            if(!Y.Lang.isArray(path.point)) {
                path.point = this._calculateDefaultPoint([]);
            } else {
                path.point = this._calculateDefaultPoint(path.point);
            }

            if(!Y.Lang.isNumber(path.xdist)) {
                path.xdist = DEFAULTS.DISTANCE_MOVE;
            }

            if(!Y.Lang.isNumber(path.ydist)) {
                path.ydist = 0;
            }
        }

        if(!Y.Lang.isNumber(duration)){
            duration = DEFAULTS.DURATION_MOVE; // ms
        } else {
            if(duration > DEFAULTS.MAX_DURATION_MOVE) {
                duration = DEFAULTS.MAX_DURATION_MOVE;
            }
        }

        convertedPath = {
            start: Y.clone(path.point),
            end: [path.point[0]+path.xdist, path.point[1]+path.ydist]
        };

        this._move(cb, convertedPath, duration);
    },

    /**
     * A base method on top of "move" and "flick" methods. The method takes
     * the path with start/end properties and duration to generate a set of
     * touch events for the movement gesture.
     *
     * @method _move
     * @private
     * @param {Function} cb The callback to execute when the gesture simulation
     *      is completed.
     * @param {Object} path An object with "start" and "end" properties. Each
     *      property should be an array with x and y coordination (e.g. start: [100, 50])
     * @param {Number} duration A duration of the gesture in millisecond.
     */
    _move: function(cb, path, duration) {
        var eventQueue,
            i,
            interval = EVENT_INTERVAL,
            steps, stepX, stepY,
            id = 0,
            touchMove;

        if(!Y.Lang.isNumber(duration)){
            duration = DEFAULTS.DURATION_MOVE; // ms
        } else {
            if(duration > DEFAULTS.MAX_DURATION_MOVE) {
                duration = DEFAULTS.MAX_DURATION_MOVE;
            }
        }

        if(!Y.Lang.isObject(path)) {
            path = {
                start: [
                    START_PAGEX,
                    START_PAGEY
                ],
                end: [
                    START_PAGEX + DEFAULTS.DISTANCE_MOVE,
                    START_PAGEY
                ]
            };
        } else {
            if(!Y.Lang.isArray(path.start)) {
                path.start = [
                    START_PAGEX,
                    START_PAGEY
                ];
            }
            if(!Y.Lang.isArray(path.end)) {
                path.end = [
                    START_PAGEX + DEFAULTS.DISTANCE_MOVE,
                    START_PAGEY
                ];
            }
        }

        Y.AsyncQueue.defaults.timeout = interval;
        eventQueue = new Y.AsyncQueue();

        // start
        eventQueue.add({
            fn: function() {
                var coord = {
                        pageX: path.start[0],
                        pageY: path.start[1],
                        clientX: path.start[0],
                        clientY: path.start[1]
                    },
                    touches = this._createTouchList([
                        Y.merge({identifier: (id++)}, coord)
                    ]);

                this._simulateEvent(this.target, TOUCH_START, Y.merge({
                    touches: touches,
                    targetTouches: touches,
                    changedTouches: touches
                }, coord));
            },
            timeout: 0,
            context: this
        });

        // move
        steps = Math.floor(duration/interval);
        stepX = (path.end[0] - path.start[0])/steps;
        stepY = (path.end[1] - path.start[1])/steps;

        touchMove = function(step) {
            var px = path.start[0]+(stepX * step),
                py = path.start[1]+(stepY * step),
                coord = {
                    pageX: px,
                    pageY: py,
                    clientX: px,
                    clientY: py
                },
                touches = this._createTouchList([
                    Y.merge({identifier: (id++)}, coord)
                ]);

            this._simulateEvent(this.target, TOUCH_MOVE, Y.merge({
                touches: touches,
                targetTouches: touches,
                changedTouches: touches
            }, coord));
        };

        for (i=0; i < steps; i++) {
            eventQueue.add({
                fn: touchMove,
                args: [i],
                context: this
            });
        }

        // last move
        eventQueue.add({
            fn: function() {
                var coord = {
                        pageX: path.end[0],
                        pageY: path.end[1],
                        clientX: path.end[0],
                        clientY: path.end[1]
                    },
                    touches = this._createTouchList([
                        Y.merge({identifier: id}, coord)
                    ]);

                this._simulateEvent(this.target, TOUCH_MOVE, Y.merge({
                    touches: touches,
                    targetTouches: touches,
                    changedTouches: touches
                }, coord));
            },
            timeout: 0,
            context: this
        });

        // end
        eventQueue.add({
            fn: function() {
                var coord = {
                    pageX: path.end[0],
                    pageY: path.end[1],
                    clientX: path.end[0],
                    clientY: path.end[1]
                },
                emptyTouchList = this._getEmptyTouchList(),
                touches = this._createTouchList([
                    Y.merge({identifier: id}, coord)
                ]);

                this._simulateEvent(this.target, TOUCH_END, Y.merge({
                    touches: emptyTouchList,
                    targetTouches: emptyTouchList,
                    changedTouches: touches
                }, coord));
            },
            context: this
        });

        if(cb && Y.Lang.isFunction(cb)) {
            eventQueue.add({
                fn: cb,

                // by default, the callback runs the node context where
                // simulateGesture method is called.
                context: this.node

                //TODO: Use args to pass error object as 1st param if there is an error.
                //args:
            });
        }

        eventQueue.run();
    },

    /**
     * Helper method to return a singleton instance of empty touch list.
     *
     * @method _getEmptyTouchList
     * @private
     * @return {TouchList | Array} An empty touch list object.
     */
    _getEmptyTouchList: function() {
        if(!emptyTouchList) {
            emptyTouchList = this._createTouchList([]);
        }

        return emptyTouchList;
    },

    /**
     * Helper method to convert an array with touch points to TouchList object as
     * defined in http://www.w3.org/TR/touch-events/
     *
     * @method _createTouchList
     * @private
     * @param {Array} touchPoints
     * @return {TouchList | Array} If underlaying platform support creating touch list
     *      a TouchList object will be returned otherwise a fake Array object
     *      will be returned.
     */
    _createTouchList: function(touchPoints) {
        /*
        * Android 4.0.3 emulator:
        * Native touch api supported starting in version 4.0 (Ice Cream Sandwich).
        * However the support seems limited. In Android 4.0.3 emulator, I got
        * "TouchList is not defined".
        */
        var touches = [],
            touchList,
            self = this;

        if(!!touchPoints && Y.Lang.isArray(touchPoints)) {
            if(Y.UA.android && Y.UA.android >= 4.0 || Y.UA.ios && Y.UA.ios >= 2.0) {
                Y.each(touchPoints, function(point) {
                    if(!point.identifier) {point.identifier = 0;}
                    if(!point.pageX) {point.pageX = 0;}
                    if(!point.pageY) {point.pageY = 0;}
                    if(!point.screenX) {point.screenX = 0;}
                    if(!point.screenY) {point.screenY = 0;}

                    touches.push(document.createTouch(Y.config.win,
                        self.target,
                        point.identifier,
                        point.pageX, point.pageY,
                        point.screenX, point.screenY));
                });

                touchList = document.createTouchList.apply(document, touches);
            } else if(Y.UA.ios && Y.UA.ios < 2.0) {
                Y.error(NAME+': No touch event simulation framework present.');
            } else {
                // this will inclide android(Y.UA.android && Y.UA.android < 4.0)
                // and desktops among all others.

                /*
                 * Touch APIs are broken in androids older than 4.0. We will use
                 * simulated touch apis for these versions.
                 */
                touchList = [];
                Y.each(touchPoints, function(point) {
                    if(!point.identifier) {point.identifier = 0;}
                    if(!point.clientX)  {point.clientX = 0;}
                    if(!point.clientY)  {point.clientY = 0;}
                    if(!point.pageX)    {point.pageX = 0;}
                    if(!point.pageY)    {point.pageY = 0;}
                    if(!point.screenX)  {point.screenX = 0;}
                    if(!point.screenY)  {point.screenY = 0;}

                    touchList.push({
                        target: self.target,
                        identifier: point.identifier,
                        clientX: point.clientX,
                        clientY: point.clientY,
                        pageX: point.pageX,
                        pageY: point.pageY,
                        screenX: point.screenX,
                        screenY: point.screenY
                    });
                });

                touchList.item = function(i) {
                    return touchList[i];
                };
            }
        } else {
            Y.error(NAME+': Invalid touchPoints passed');
        }

        return touchList;
    },

    /**
     * @method _simulateEvent
     * @private
     * @param {HTMLElement} target The DOM element that's the target of the event.
     * @param {String} type The type of event or name of the supported gesture to simulate
     *      (i.e., "click", "doubletap", "flick").
     * @param {Object} options (Optional) Extra options to copy onto the event object.
     *      For gestures, options are used to refine the gesture behavior.
     */
    _simulateEvent: function(target, type, options) {
        var touches;

        if (touchEvents[type]) {
            if(SUPPORTS_TOUCH) {
                Y.Event.simulate(target, type, options);
            } else {
                // simulate using mouse events if touch is not applicable on this platform.
                // but only single touch event can be simulated.
                if(this._isSingleTouch(options.touches, options.targetTouches, options.changedTouches)) {
                    type = {
                        touchstart: MOUSE_DOWN,
                        touchmove: MOUSE_MOVE,
                        touchend: MOUSE_UP
                    }[type];

                    options.button = 0;
                    options.relatedTarget = null; // since we are not using mouseover event.

                    // touchend has none in options.touches.
                    touches = (type === MOUSE_UP)? options.changedTouches : options.touches;

                    options = Y.mix(options, {
                        screenX: touches.item(0).screenX,
                        screenY: touches.item(0).screenY,
                        clientX: touches.item(0).clientX,
                        clientY: touches.item(0).clientY
                    }, true);

                    Y.Event.simulate(target, type, options);

                    if(type == MOUSE_UP) {
                        Y.Event.simulate(target, MOUSE_CLICK, options);
                    }
                } else {
                    Y.error("_simulateEvent(): Event '" + type + "' has multi touch objects that can't be simulated in your platform.");
                }
            }
        } else {
            // pass thru for all non touch events
            Y.Event.simulate(target, type, options);
        }
    },

    /**
     * Helper method to check the single touch.
     * @method _isSingleTouch
     * @private
     * @param {TouchList} touches
     * @param {TouchList} targetTouches
     * @param {TouchList} changedTouches
     */
    _isSingleTouch: function(touches, targetTouches, changedTouches) {
        return (touches && (touches.length <= 1)) &&
            (targetTouches && (targetTouches.length <= 1)) &&
            (changedTouches && (changedTouches.length <= 1));
    }
};

/*
 * A gesture simulation class.
 */
Y.GestureSimulation = Simulations;

/*
 * Various simulation default behavior properties. If user override
 * Y.GestureSimulation.defaults, overriden values will be used and this
 * should be done before the gesture simulation.
 */
Y.GestureSimulation.defaults = DEFAULTS;

/*
 * The high level gesture names that YUI knows how to simulate.
 */
Y.GestureSimulation.GESTURES = gestureNames;

/**
 * Simulates the higher user level gesture of the given name on a target.
 * This method generates a set of low level touch events(Apple specific gesture
 * events as well for the iOS platforms) asynchronously. Note that gesture
 * simulation is relying on `Y.Event.simulate()` method to generate
 * the touch events under the hood. The `Y.Event.simulate()` method
 * itself is a synchronous method.
 *
 * Users are suggested to use `Node.simulateGesture()` method which
 * basically calls this method internally. Supported gestures are `tap`,
 * `doubletap`, `press`, `move`, `flick`, `pinch` and `rotate`.
 *
 * The `pinch` gesture is used to simulate the pinching and spreading of two
 * fingers. During a pinch simulation, rotation is also possible. Essentially
 * `pinch` and `rotate` simulations share the same base implementation to allow
 * both pinching and rotation at the same time. The only difference is `pinch`
 * requires `start` and `end` option properties while `rotate` requires `rotation`
 * option property.
 *
 * The `pinch` and `rotate` gestures can be described as placing 2 fingers along a
 * circle. Pinching and spreading can be described by start and end circles while
 * rotation occurs on a single circle. If the radius of the start circle is greater
 * than the end circle, the gesture becomes a pinch, otherwise it is a spread spread.
 *
 * @example
 *
 *     var node = Y.one("#target");
 *
 *     // double tap example
 *     node.simulateGesture("doubletap", function() {
 *         // my callback function
 *     });
 *
 *     // flick example from the center of the node, move 50 pixels down for 50ms)
 *     node.simulateGesture("flick", {
 *         axis: y,
 *         distance: -100
 *         duration: 50
 *     }, function() {
 *         // my callback function
 *     });
 *
 *     // simulate rotating a node 75 degrees counter-clockwise
 *     node.simulateGesture("rotate", {
 *         rotation: -75
 *     });
 *
 *     // simulate a pinch and a rotation at the same time.
 *     // fingers start on a circle of radius 100 px, placed at top/bottom
 *     // fingers end on a circle of radius 50px, placed at right/left
 *     node.simulateGesture("pinch", {
 *         r1: 100,
 *         r2: 50,
 *         start: 0
 *         rotation: 90
 *     });
 *
 * @method simulateGesture
 * @param {HTMLElement|Node} node The YUI node or HTML element that's the target
 *      of the event.
 * @param {String} name The name of the supported gesture to simulate. The
 *      supported gesture name is one of "tap", "doubletap", "press", "move",
 *      "flick", "pinch" and "rotate".
 * @param {Object} [options] Extra options used to define the gesture behavior:
 *
 *      Valid options properties for the `tap` gesture:
 *
 *      @param {Array} [options.point] (Optional) Indicates the [x,y] coordinates
 *        where the tap should be simulated. Default is the center of the node
 *        element.
 *      @param {Number} [options.hold=10] (Optional) The hold time in milliseconds.
 *        This is the time between `touchstart` and `touchend` event generation.
 *      @param {Number} [options.times=1] (Optional) Indicates the number of taps.
 *      @param {Number} [options.delay=10] (Optional) The number of milliseconds
 *        before the next tap simulation happens. This is valid only when `times`
 *        is more than 1.
 *
 *      Valid options properties for the `doubletap` gesture:
 *
 *      @param {Array} [options.point] (Optional) Indicates the [x,y] coordinates
 *        where the doubletap should be simulated. Default is the center of the
 *        node element.
 *
 *      Valid options properties for the `press` gesture:
 *
 *      @param {Array} [options.point] (Optional) Indicates the [x,y] coordinates
 *        where the press should be simulated. Default is the center of the node
 *        element.
 *      @param {Number} [options.hold=3000] (Optional) The hold time in milliseconds.
 *        This is the time between `touchstart` and `touchend` event generation.
 *        Default is 3000ms (3 seconds).
 *
 *      Valid options properties for the `move` gesture:
 *
 *      @param {Object} [options.path] (Optional) Indicates the path of the finger
 *        movement. It's an object with three optional properties: `point`,
 *        `xdist` and  `ydist`.
 *        @param {Array} [options.path.point] A starting point of the gesture.
 *          Default is the center of the node element.
 *        @param {Number} [options.path.xdist=200] A distance to move in pixels
 *          along the X axis. A negative distance value indicates moving left.
 *        @param {Number} [options.path.ydist=0] A distance to move in pixels
 *          along the Y axis. A negative distance value indicates moving up.
 *      @param {Number} [options.duration=1000] (Optional) The duration of the
 *        gesture in milliseconds.
 *
 *      Valid options properties for the `flick` gesture:
 *
 *      @param {Array} [options.point] (Optional) Indicates the [x, y] coordinates
 *        where the flick should be simulated. Default is the center of the
 *        node element.
 *      @param {String} [options.axis='x'] (Optional) Valid values are either
 *        "x" or "y". Indicates axis to move along. The flick can move to one of
 *        4 directions(left, right, up and down).
 *      @param {Number} [options.distance=200] (Optional) Distance to move in pixels
 *      @param {Number} [options.duration=1000] (Optional) The duration of the
 *        gesture in milliseconds. User given value could be automatically
 *        adjusted by the framework if it is below the minimum velocity to be
 *        a flick gesture.
 *
 *      Valid options properties for the `pinch` gesture:
 *
 *      @param {Array} [options.center] (Optional) The center of the circle where
 *        two fingers are placed. Default is the center of the node element.
 *      @param {Number} [options.r1] (Required) Pixel radius of the start circle
 *        where 2 fingers will be on when the gesture starts. The circles are
 *        centered at the center of the element.
 *      @param {Number} [options.r2] (Required) Pixel radius of the end circle
 *        when this gesture ends.
 *      @param {Number} [options.duration=1000] (Optional) The duration of the
 *        gesture in milliseconds.
 *      @param {Number} [options.start=0] (Optional) Starting degree of the first
 *        finger. The value is relative to the path of the north. Default is 0
 *        (i.e., 12:00 on a clock).
 *      @param {Number} [options.rotation=0] (Optional) Degrees to rotate from
 *        the starting degree. A negative value means rotation to the
 *        counter-clockwise direction.
 *
 *      Valid options properties for the `rotate` gesture:
 *
 *      @param {Array} [options.center] (Optional) The center of the circle where
 *        two fingers are placed. Default is the center of the node element.
 *      @param {Number} [options.r1] (Optional) Pixel radius of the start circle
 *        where 2 fingers will be on when the gesture starts. The circles are
 *        centered at the center of the element. Default is a fourth of the node
 *        element width or height, whichever is smaller.
 *      @param {Number} [options.r2] (Optional) Pixel radius of the end circle
 *        when this gesture ends. Default is a fourth of the node element width or
 *        height, whichever is smaller.
 *      @param {Number} [options.duration=1000] (Optional) The duration of the
 *        gesture in milliseconds.
 *      @param {Number} [options.start=0] (Optional) Starting degree of the first
 *        finger. The value is relative to the path of the north. Default is 0
 *        (i.e., 12:00 on a clock).
 *      @param {Number} [options.rotation] (Required) Degrees to rotate from
 *        the starting degree. A negative value means rotation to the
 *        counter-clockwise direction.
 *
 * @param {Function} [cb] The callback to execute when the asynchronouse gesture
 *      simulation is completed.
 *      @param {Error} cb.err An error object if the simulation is failed.
 * @for Event
 * @static
 */
Y.Event.simulateGesture = function(node, name, options, cb) {

    node = Y.one(node);

    var sim = new Y.GestureSimulation(node);
    name = name.toLowerCase();

    if(!cb && Y.Lang.isFunction(options)) {
        cb = options;
        options = {};
    }

    options = options || {};

    if (gestureNames[name]) {
        switch(name) {
            // single-touch: point gestures
            case 'tap':
                sim.tap(cb, options.point, options.times, options.hold, options.delay);
                break;
            case 'doubletap':
                sim.tap(cb, options.point, 2);
                break;
            case 'press':
                if(!Y.Lang.isNumber(options.hold)) {
                    options.hold = DEFAULTS.HOLD_PRESS;
                } else if(options.hold < DEFAULTS.MIN_HOLD_PRESS) {
                    options.hold = DEFAULTS.MIN_HOLD_PRESS;
                } else if(options.hold > DEFAULTS.MAX_HOLD_PRESS) {
                    options.hold = DEFAULTS.MAX_HOLD_PRESS;
                }
                sim.tap(cb, options.point, 1, options.hold);
                break;

            // single-touch: move gestures
            case 'move':
                sim.move(cb, options.path, options.duration);
                break;
            case 'flick':
                sim.flick(cb, options.point, options.axis, options.distance,
                    options.duration);
                break;

            // multi-touch: pinch/rotation gestures
            case 'pinch':
                sim.pinch(cb, options.center, options.r1, options.r2,
                    options.duration, options.start, options.rotation);
                break;
            case 'rotate':
                sim.rotate(cb, options.center, options.r1, options.r2,
                    options.duration, options.start, options.rotation);
                break;
        }
    } else {
        Y.error(NAME+': Not a supported gesture simulation: '+name);
    }
};


}, '3.16.0', {"requires": ["async-queue", "event-simulate", "node-screen"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('node-event-simulate', function (Y, NAME) {

/**
 * Adds functionality to simulate events.
 * @module node
 * @submodule node-event-simulate
 */

/**
 * Simulates an event on the node.
 * @param {String} type The type of event (i.e., "click").
 * @param {Object} options (Optional) Extra options to copy onto the event object.
 * @for Node
 * @method simulate
 */
Y.Node.prototype.simulate = function (type, options) {

    Y.Event.simulate(Y.Node.getDOMNode(this), type, options);
};

/**
 * Simulates the higher user level gesture of the given name on this node.
 * This method generates a set of low level touch events(Apple specific gesture
 * events as well for the iOS platforms) asynchronously. Note that gesture
 * simulation is relying on `Y.Event.simulate()` method to generate
 * the touch events under the hood. The `Y.Event.simulate()` method
 * itself is a synchronous method.
 *
 * Supported gestures are `tap`, `doubletap`, `press`, `move`, `flick`, `pinch`
 * and `rotate`.
 *
 * The `pinch` gesture is used to simulate the pinching and spreading of two
 * fingers. During a pinch simulation, rotation is also possible. Essentially
 * `pinch` and `rotate` simulations share the same base implementation to allow
 * both pinching and rotation at the same time. The only difference is `pinch`
 * requires `start` and `end` option properties while `rotate` requires `rotation`
 * option property.
 *
 * The `pinch` and `rotate` gestures can be described as placing 2 fingers along a
 * circle. Pinching and spreading can be described by start and end circles while
 * rotation occurs on a single circle. If the radius of the start circle is greater
 * than the end circle, the gesture becomes a pinch, otherwise it is a spread spread.
 *
 * @example
 *
 *     var node = Y.one("#target");
 *
 *     // double tap example
 *     node.simulateGesture("doubletap", function() {
 *         // my callback function
 *     });
 *
 *     // flick example from the center of the node, move 50 pixels down for 50ms)
 *     node.simulateGesture("flick", {
 *         axis: y,
 *         distance: -100
 *         duration: 50
 *     }, function() {
 *         // my callback function
 *     });
 *
 *     // simulate rotating a node 75 degrees counter-clockwise
 *     node.simulateGesture("rotate", {
 *         rotation: -75
 *     });
 *
 *     // simulate a pinch and a rotation at the same time.
 *     // fingers start on a circle of radius 100 px, placed at top/bottom
 *     // fingers end on a circle of radius 50px, placed at right/left
 *     node.simulateGesture("pinch", {
 *         r1: 100,
 *         r2: 50,
 *         start: 0
 *         rotation: 90
 *     });
 *
 * @method simulateGesture
 * @param {String} name The name of the supported gesture to simulate. The
 *      supported gesture name is one of "tap", "doubletap", "press", "move",
 *      "flick", "pinch" and "rotate".
 * @param {Object} [options] Extra options used to define the gesture behavior:
 *
 *      Valid options properties for the `tap` gesture:
 *
 *      @param {Array} [options.point] (Optional) Indicates the [x,y] coordinates
 *        where the tap should be simulated. Default is the center of the node
 *        element.
 *      @param {Number} [options.hold=10] (Optional) The hold time in milliseconds.
 *        This is the time between `touchstart` and `touchend` event generation.
 *      @param {Number} [options.times=1] (Optional) Indicates the number of taps.
 *      @param {Number} [options.delay=10] (Optional) The number of milliseconds
 *        before the next tap simulation happens. This is valid only when `times`
 *        is more than 1.
 *
 *      Valid options properties for the `doubletap` gesture:
 *
 *      @param {Array} [options.point] (Optional) Indicates the [x,y] coordinates
 *        where the doubletap should be simulated. Default is the center of the
 *        node element.
 *
 *      Valid options properties for the `press` gesture:
 *
 *      @param {Array} [options.point] (Optional) Indicates the [x,y] coordinates
 *        where the press should be simulated. Default is the center of the node
 *        element.
 *      @param {Number} [options.hold=3000] (Optional) The hold time in milliseconds.
 *        This is the time between `touchstart` and `touchend` event generation.
 *        Default is 3000ms (3 seconds).
 *
 *      Valid options properties for the `move` gesture:
 *
 *      @param {Object} [options.path] (Optional) Indicates the path of the finger
 *        movement. It's an object with three optional properties: `point`,
 *        `xdist` and  `ydist`.
 *        @param {Array} [options.path.point] A starting point of the gesture.
 *          Default is the center of the node element.
 *        @param {Number} [options.path.xdist=200] A distance to move in pixels
 *          along the X axis. A negative distance value indicates moving left.
 *        @param {Number} [options.path.ydist=0] A distance to move in pixels
 *          along the Y axis. A negative distance value indicates moving up.
 *      @param {Number} [options.duration=1000] (Optional) The duration of the
 *        gesture in milliseconds.
 *
 *      Valid options properties for the `flick` gesture:
 *
 *      @param {Array} [options.point] (Optional) Indicates the [x, y] coordinates
 *        where the flick should be simulated. Default is the center of the
 *        node element.
 *      @param {String} [options.axis='x'] (Optional) Valid values are either
 *        "x" or "y". Indicates axis to move along. The flick can move to one of
 *        4 directions(left, right, up and down).
 *      @param {Number} [options.distance=200] (Optional) Distance to move in pixels
 *      @param {Number} [options.duration=1000] (Optional) The duration of the
 *        gesture in milliseconds. User given value could be automatically
 *        adjusted by the framework if it is below the minimum velocity to be
 *        a flick gesture.
 *
 *      Valid options properties for the `pinch` gesture:
 *
 *      @param {Array} [options.center] (Optional) The center of the circle where
 *        two fingers are placed. Default is the center of the node element.
 *      @param {Number} [options.r1] (Required) Pixel radius of the start circle
 *        where 2 fingers will be on when the gesture starts. The circles are
 *        centered at the center of the element.
 *      @param {Number} [options.r2] (Required) Pixel radius of the end circle
 *        when this gesture ends.
 *      @param {Number} [options.duration=1000] (Optional) The duration of the
 *        gesture in milliseconds.
 *      @param {Number} [options.start=0] (Optional) Starting degree of the first
 *        finger. The value is relative to the path of the north. Default is 0
 *        (i.e., 12:00 on a clock).
 *      @param {Number} [options.rotation=0] (Optional) Degrees to rotate from
 *        the starting degree. A negative value means rotation to the
 *        counter-clockwise direction.
 *
 *      Valid options properties for the `rotate` gesture:
 *
 *      @param {Array} [options.center] (Optional) The center of the circle where
 *        two fingers are placed. Default is the center of the node element.
 *      @param {Number} [options.r1] (Optional) Pixel radius of the start circle
 *        where 2 fingers will be on when the gesture starts. The circles are
 *        centered at the center of the element. Default is a fourth of the node
 *        element width or height, whichever is smaller.
 *      @param {Number} [options.r2] (Optional) Pixel radius of the end circle
 *        when this gesture ends. Default is a fourth of the node element width or
 *        height, whichever is smaller.
 *      @param {Number} [options.duration=1000] (Optional) The duration of the
 *        gesture in milliseconds.
 *      @param {Number} [options.start=0] (Optional) Starting degree of the first
 *        finger. The value is relative to the path of the north. Default is 0
 *        (i.e., 12:00 on a clock).
 *      @param {Number} [options.rotation] (Required) Degrees to rotate from
 *        the starting degree. A negative value means rotation to the
 *        counter-clockwise direction.
 *
 * @param {Function} [cb] The callback to execute when the asynchronouse gesture
 *      simulation is completed.
 *      @param {Error} cb.err An error object if the simulation is failed.
 * @for Node
 */
Y.Node.prototype.simulateGesture = function (name, options, cb) {

    Y.Event.simulateGesture(this, name, options, cb);
};


}, '3.16.0', {"requires": ["node-base", "event-simulate", "gesture-simulate"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('base-build', function (Y, NAME) {

    /**
     * The base-build submodule provides Base.build functionality, which
     * can be used to create custom classes, by aggregating extensions onto
     * a main class.
     *
     * @module base
     * @submodule base-build
     * @for Base
     */
    var BaseCore = Y.BaseCore,
        Base     = Y.Base,
        L        = Y.Lang,

        INITIALIZER = "initializer",
        DESTRUCTOR  = "destructor",
        AGGREGATES  = ["_PLUG", "_UNPLUG"],

        build;

    // Utility function used in `_buildCfg` to aggregate array values into a new
    // array from the sender constructor to the receiver constructor.
    function arrayAggregator(prop, r, s) {
        if (s[prop]) {
            r[prop] = (r[prop] || []).concat(s[prop]);
        }
    }

    // Utility function used in `_buildCfg` to aggregate `_ATTR_CFG` array
    // values from the sender constructor into a new array on receiver's
    // constructor, and clear the cached hash.
    function attrCfgAggregator(prop, r, s) {
        if (s._ATTR_CFG) {
            // Clear cached hash.
            r._ATTR_CFG_HASH = null;

            arrayAggregator.apply(null, arguments);
        }
    }

    // Utility function used in `_buildCfg` to aggregate ATTRS configs from one
    // the sender constructor to the receiver constructor.
    function attrsAggregator(prop, r, s) {
        BaseCore.modifyAttrs(r, s.ATTRS);
    }

    Base._build = function(name, main, extensions, px, sx, cfg) {

        var build = Base._build,

            builtClass = build._ctor(main, cfg),
            buildCfg = build._cfg(main, cfg, extensions),

            _mixCust = build._mixCust,

            dynamic = builtClass._yuibuild.dynamic,

            i, l, extClass, extProto,
            initializer,
            destructor;

        // Augment/Aggregate
        for (i = 0, l = extensions.length; i < l; i++) {
            extClass = extensions[i];

            extProto = extClass.prototype;

            initializer = extProto[INITIALIZER];
            destructor = extProto[DESTRUCTOR];
            delete extProto[INITIALIZER];
            delete extProto[DESTRUCTOR];

            // Prototype, old non-displacing augment
            Y.mix(builtClass, extClass, true, null, 1);

            // Custom Statics
            _mixCust(builtClass, extClass, buildCfg);

            if (initializer) {
                extProto[INITIALIZER] = initializer;
            }

            if (destructor) {
                extProto[DESTRUCTOR] = destructor;
            }

            builtClass._yuibuild.exts.push(extClass);
        }

        if (px) {
            Y.mix(builtClass.prototype, px, true);
        }

        if (sx) {
            Y.mix(builtClass, build._clean(sx, buildCfg), true);
            _mixCust(builtClass, sx, buildCfg);
        }

        builtClass.prototype.hasImpl = build._impl;

        if (dynamic) {
            builtClass.NAME = name;
            builtClass.prototype.constructor = builtClass;

            // Carry along the reference to `modifyAttrs()` from `main`.
            builtClass.modifyAttrs = main.modifyAttrs;
        }

        return builtClass;
    };

    build = Base._build;

    Y.mix(build, {

        _mixCust: function(r, s, cfg) {

            var aggregates,
                custom,
                statics,
                aggr,
                l,
                i;

            if (cfg) {
                aggregates = cfg.aggregates;
                custom = cfg.custom;
                statics = cfg.statics;
            }

            if (statics) {
                Y.mix(r, s, true, statics);
            }

            if (aggregates) {
                for (i = 0, l = aggregates.length; i < l; i++) {
                    aggr = aggregates[i];
                    if (!r.hasOwnProperty(aggr) && s.hasOwnProperty(aggr)) {
                        r[aggr] = L.isArray(s[aggr]) ? [] : {};
                    }
                    Y.aggregate(r, s, true, [aggr]);
                }
            }

            if (custom) {
                for (i in custom) {
                    if (custom.hasOwnProperty(i)) {
                        custom[i](i, r, s);
                    }
                }
            }

        },

        _tmpl: function(main) {

            function BuiltClass() {
                BuiltClass.superclass.constructor.apply(this, arguments);
            }
            Y.extend(BuiltClass, main);

            return BuiltClass;
        },

        _impl : function(extClass) {
            var classes = this._getClasses(), i, l, cls, exts, ll, j;
            for (i = 0, l = classes.length; i < l; i++) {
                cls = classes[i];
                if (cls._yuibuild) {
                    exts = cls._yuibuild.exts;
                    ll = exts.length;

                    for (j = 0; j < ll; j++) {
                        if (exts[j] === extClass) {
                            return true;
                        }
                    }
                }
            }
            return false;
        },

        _ctor : function(main, cfg) {

           var dynamic = (cfg && false === cfg.dynamic) ? false : true,
               builtClass = (dynamic) ? build._tmpl(main) : main,
               buildCfg = builtClass._yuibuild;

            if (!buildCfg) {
                buildCfg = builtClass._yuibuild = {};
            }

            buildCfg.id = buildCfg.id || null;
            buildCfg.exts = buildCfg.exts || [];
            buildCfg.dynamic = dynamic;

            return builtClass;
        },

        _cfg : function(main, cfg, exts) {
            var aggr = [],
                cust = {},
                statics = [],
                buildCfg,
                cfgAggr = (cfg && cfg.aggregates),
                cfgCustBuild = (cfg && cfg.custom),
                cfgStatics = (cfg && cfg.statics),
                c = main,
                i,
                l;

            // Prototype Chain
            while (c && c.prototype) {
                buildCfg = c._buildCfg;
                if (buildCfg) {
                    if (buildCfg.aggregates) {
                        aggr = aggr.concat(buildCfg.aggregates);
                    }
                    if (buildCfg.custom) {
                        Y.mix(cust, buildCfg.custom, true);
                    }
                    if (buildCfg.statics) {
                        statics = statics.concat(buildCfg.statics);
                    }
                }
                c = c.superclass ? c.superclass.constructor : null;
            }

            // Exts
            if (exts) {
                for (i = 0, l = exts.length; i < l; i++) {
                    c = exts[i];
                    buildCfg = c._buildCfg;
                    if (buildCfg) {
                        if (buildCfg.aggregates) {
                            aggr = aggr.concat(buildCfg.aggregates);
                        }
                        if (buildCfg.custom) {
                            Y.mix(cust, buildCfg.custom, true);
                        }
                        if (buildCfg.statics) {
                            statics = statics.concat(buildCfg.statics);
                        }
                    }
                }
            }

            if (cfgAggr) {
                aggr = aggr.concat(cfgAggr);
            }

            if (cfgCustBuild) {
                Y.mix(cust, cfg.cfgBuild, true);
            }

            if (cfgStatics) {
                statics = statics.concat(cfgStatics);
            }

            return {
                aggregates: aggr,
                custom: cust,
                statics: statics
            };
        },

        _clean : function(sx, cfg) {
            var prop, i, l, sxclone = Y.merge(sx),
                aggregates = cfg.aggregates,
                custom = cfg.custom;

            for (prop in custom) {
                if (sxclone.hasOwnProperty(prop)) {
                    delete sxclone[prop];
                }
            }

            for (i = 0, l = aggregates.length; i < l; i++) {
                prop = aggregates[i];
                if (sxclone.hasOwnProperty(prop)) {
                    delete sxclone[prop];
                }
            }

            return sxclone;
        }
    });

    /**
     * <p>
     * Builds a custom constructor function (class) from the
     * main function, and array of extension functions (classes)
     * provided. The NAME field for the constructor function is
     * defined by the first argument passed in.
     * </p>
     * <p>
     * The cfg object supports the following properties
     * </p>
     * <dl>
     *    <dt>dynamic &#60;boolean&#62;</dt>
     *    <dd>
     *    <p>If true (default), a completely new class
     *    is created which extends the main class, and acts as the
     *    host on which the extension classes are augmented.</p>
     *    <p>If false, the extensions classes are augmented directly to
     *    the main class, modifying the main class' prototype.</p>
     *    </dd>
     *    <dt>aggregates &#60;String[]&#62;</dt>
     *    <dd>An array of static property names, which will get aggregated
     *    on to the built class, in addition to the default properties build
     *    will always aggregate as defined by the main class' static _buildCfg
     *    property.
     *    </dd>
     * </dl>
     *
     * @method build
     * @deprecated Use the more convenient Base.create and Base.mix methods instead
     * @static
     * @param {Function} name The name of the new class. Used to define the NAME property for the new class.
     * @param {Function} main The main class on which to base the built class
     * @param {Function[]} extensions The set of extension classes which will be
     * augmented/aggregated to the built class.
     * @param {Object} cfg Optional. Build configuration for the class (see description).
     * @return {Function} A custom class, created from the provided main and extension classes
     */
    Base.build = function(name, main, extensions, cfg) {
        return build(name, main, extensions, null, null, cfg);
    };

    /**
     * Creates a new class (constructor function) which extends the base class passed in as the second argument,
     * and mixes in the array of extensions provided.
     *
     * Prototype properties or methods can be added to the new class, using the px argument (similar to Y.extend).
     *
     * Static properties or methods can be added to the new class, using the sx argument (similar to Y.extend).
     *
     * **NOTE FOR COMPONENT DEVELOPERS**: Both the `base` class, and `extensions` can define static a `_buildCfg`
     * property, which acts as class creation meta-data, and drives how special static properties from the base
     * class, or extensions should be copied, aggregated or (custom) mixed into the newly created class.
     *
     * The `_buildCfg` property is a hash with 3 supported properties: `statics`, `aggregates` and `custom`, e.g:
     *
     *     // If the Base/Main class is the thing introducing the property:
     *
     *     MyBaseClass._buildCfg = {
     *
     *        // Static properties/methods to copy (Alias) to the built class.
     *        statics: ["CopyThisMethod", "CopyThisProperty"],
     *
     *        // Static props to aggregate onto the built class.
     *        aggregates: ["AggregateThisProperty"],
     *
     *        // Static properties which need custom handling (e.g. deep merge etc.)
     *        custom: {
     *           "CustomProperty" : function(property, Receiver, Supplier) {
     *              ...
     *              var triggers = Receiver.CustomProperty.triggers;
     *              Receiver.CustomProperty.triggers = triggers.concat(Supplier.CustomProperty.triggers);
     *              ...
     *           }
     *        }
     *     };
     *
     *     MyBaseClass.CopyThisMethod = function() {...};
     *     MyBaseClass.CopyThisProperty = "foo";
     *     MyBaseClass.AggregateThisProperty = {...};
     *     MyBaseClass.CustomProperty = {
     *        triggers: [...]
     *     }
     *
     *     // Or, if the Extension is the thing introducing the property:
     *
     *     MyExtension._buildCfg = {
     *         statics : ...
     *         aggregates : ...
     *         custom : ...
     *     }
     *
     * This way, when users pass your base or extension class to `Y.Base.create` or `Y.Base.mix`, they don't need to
     * know which properties need special handling. `Y.Base` has a buildCfg which defines `ATTRS` for custom mix handling
     * (to protect the static config objects), and `Y.Widget` has a buildCfg which specifies `HTML_PARSER` for
     * straight up aggregation.
     *
     * @method create
     * @static
     * @param {String} name The name of the newly created class. Used to define the NAME property for the new class.
     * @param {Function} main The base class which the new class should extend.
     * This class needs to be Base or a class derived from base (e.g. Widget).
     * @param {Function[]} extensions The list of extensions which will be mixed into the built class.
     * @param {Object} px The set of prototype properties/methods to add to the built class.
     * @param {Object} sx The set of static properties/methods to add to the built class.
     * @return {Function} The newly created class.
     */
    Base.create = function(name, base, extensions, px, sx) {
        return build(name, base, extensions, px, sx);
    };

    /**
     * <p>Mixes in a list of extensions to an existing class.</p>
     * @method mix
     * @static
     * @param {Function} main The existing class into which the extensions should be mixed.
     * The class needs to be Base or a class derived from Base (e.g. Widget)
     * @param {Function[]} extensions The set of extension classes which will mixed into the existing main class.
     * @return {Function} The modified main class, with extensions mixed in.
     */
    Base.mix = function(main, extensions) {

        if (main._CACHED_CLASS_DATA) {
            main._CACHED_CLASS_DATA = null;
        }

        return build(null, main, extensions, null, null, {dynamic:false});
    };

    /**
     * The build configuration for the Base class.
     *
     * Defines the static fields which need to be aggregated when the Base class
     * is used as the main class passed to the
     * <a href="#method_Base.build">Base.build</a> method.
     *
     * @property _buildCfg
     * @type Object
     * @static
     * @final
     * @private
     */
    BaseCore._buildCfg = {
        aggregates: AGGREGATES.concat(),

        custom: {
            ATTRS         : attrsAggregator,
            _ATTR_CFG     : attrCfgAggregator,
            _NON_ATTRS_CFG: arrayAggregator
        }
    };

    // Makes sure Base and BaseCore use separate `_buildCfg` objects.
    Base._buildCfg = {
        aggregates: AGGREGATES.concat(),

        custom: {
            ATTRS         : attrsAggregator,
            _ATTR_CFG     : attrCfgAggregator,
            _NON_ATTRS_CFG: arrayAggregator
        }
    };


}, '3.16.0', {"requires": ["base-base"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('file-html5', function (Y, NAME) {

    /**
     * The FileHTML5 class provides a wrapper for a file pointer in an HTML5 The File wrapper
     * also implements the mechanics for uploading a file and tracking its progress.
     * @module file-html5
     */

    /**
     * The class provides a wrapper for a file pointer.
     * @class FileHTML5
     * @extends Base
     * @constructor
     * @param {Object} config Configuration object.
     */
    var Lang = Y.Lang,
        Bind = Y.bind,
        Win = Y.config.win;

    var FileHTML5 = function(o) {

        var file = null;

        if (FileHTML5.isValidFile(o)) {
            file = o;
        }
        else if (FileHTML5.isValidFile(o.file)) {
            file = o.file;
        }
        else {
            file = false;
        }

        FileHTML5.superclass.constructor.apply(this, arguments);

        if (file && FileHTML5.canUpload()) {
           if (!this.get("file")) {
               this._set("file", file);
           }

           if (!this.get("name")) {
           this._set("name", file.name || file.fileName);
           }

           if (this.get("size") != (file.size || file.fileSize)) {
           this._set("size", file.size || file.fileSize);
           }

           if (!this.get("type")) {
           this._set("type", file.type);
           }

           if (file.hasOwnProperty("lastModifiedDate") && !this.get("dateModified")) {
               this._set("dateModified", file.lastModifiedDate);
           }
        }
    };


    Y.extend(FileHTML5, Y.Base, {

       /**
        * Construction logic executed during FileHTML5 instantiation.
        *
        * @method initializer
        * @protected
        */
        initializer : function (cfg) {
            if (!this.get("id")) {
                this._set("id", Y.guid("file"));
            }
        },

       /**
        * Handler of events dispatched by the XMLHTTPRequest.
        *
        * @method _uploadEventHandler
        * @param {Event} event The event object received from the XMLHTTPRequest.
        * @protected
        */
        _uploadEventHandler: function (event) {
            var xhr = this.get("xhr");

            switch (event.type) {
                case "progress":
                  /**
                   * Signals that progress has been made on the upload of this file.
                   *
                   * @event uploadprogress
                   * @param event {Event} The event object for the `uploadprogress` with the
                   *                      following payload:
                   *  <dl>
                   *      <dt>originEvent</dt>
                   *          <dd>The original event fired by the XMLHttpRequest instance.</dd>
                   *      <dt>bytesLoaded</dt>
                   *          <dd>The number of bytes of the file that has been uploaded.</dd>
                   *      <dt>bytesTotal</dt>
                   *          <dd>The total number of bytes in the file (the file size)</dd>
                   *      <dt>percentLoaded</dt>
                   *          <dd>The fraction of the file that has been uploaded, out of 100.</dd>
                   *  </dl>
                   */
                   this.fire("uploadprogress", {originEvent: event,
                                               bytesLoaded: event.loaded,
                                               bytesTotal: this.get("size"),
                                               percentLoaded: Math.min(100, Math.round(10000*event.loaded/this.get("size"))/100)
                                               });
                   this._set("bytesUploaded", event.loaded);
                   break;

                case "load":
                  /**
                   * Signals that this file's upload has completed and data has been received from the server.
                   *
                   * @event uploadcomplete
                   * @param event {Event} The event object for the `uploadcomplete` with the
                   *                      following payload:
                   *  <dl>
                   *      <dt>originEvent</dt>
                   *          <dd>The original event fired by the XMLHttpRequest instance.</dd>
                   *      <dt>data</dt>
                   *          <dd>The data returned by the server.</dd>
                   *  </dl>
                   */

                   if (xhr.status >= 200 && xhr.status <= 299) {
                        this.fire("uploadcomplete", {originEvent: event,
                                                     data: event.target.responseText});
                        var xhrupload = xhr.upload,
                            boundEventHandler = this.get("boundEventHandler");

                        xhrupload.removeEventListener ("progress", boundEventHandler);
                        xhrupload.removeEventListener ("error", boundEventHandler);
                        xhrupload.removeEventListener ("abort", boundEventHandler);
                        xhr.removeEventListener ("load", boundEventHandler);
                        xhr.removeEventListener ("error", boundEventHandler);
                        xhr.removeEventListener ("readystatechange", boundEventHandler);

                        this._set("xhr", null);
                   }
                   else {
                        this.fire("uploaderror", {originEvent: event,
                                                  data: xhr.responseText,
                                                  status: xhr.status,
                                                  statusText: xhr.statusText,
                                                  source: "http"});
                   }
                   break;

                case "error":
                  /**
                   * Signals that this file's upload has encountered an error.
                   *
                   * @event uploaderror
                   * @param event {Event} The event object for the `uploaderror` with the
                   *                      following payload:
                   *  <dl>
                   *      <dt>originEvent</dt>
                   *          <dd>The original event fired by the XMLHttpRequest instance.</dd>
                   *      <dt>data</dt>
                   *          <dd>The data returned by the server.</dd>
                   *      <dt>status</dt>
                   *          <dd>The status code reported by the XMLHttpRequest. If it's an HTTP error,
                                  then this corresponds to the HTTP status code received by the uploader.</dd>
                   *      <dt>statusText</dt>
                   *          <dd>The text of the error event reported by the XMLHttpRequest instance</dd>
                   *      <dt>source</dt>
                   *          <dd>Either "http" (if it's an HTTP error), or "io" (if it's a network transmission
                   *              error.)</dd>
                   *
                   *  </dl>
                   */
                   this.fire("uploaderror", {originEvent: event,
                                                  data: xhr.responseText,
                                                  status: xhr.status,
                                                  statusText: xhr.statusText,
                                                  source: "io"});
                   break;

                case "abort":

                  /**
                   * Signals that this file's upload has been cancelled.
                   *
                   * @event uploadcancel
                   * @param event {Event} The event object for the `uploadcancel` with the
                   *                      following payload:
                   *  <dl>
                   *      <dt>originEvent</dt>
                   *          <dd>The original event fired by the XMLHttpRequest instance.</dd>
                   *  </dl>
                   */
                   this.fire("uploadcancel", {originEvent: event});
                   break;

                case "readystatechange":

                  /**
                   * Signals that XMLHttpRequest has fired a readystatechange event.
                   *
                   * @event readystatechange
                   * @param event {Event} The event object for the `readystatechange` with the
                   *                      following payload:
                   *  <dl>
                   *      <dt>readyState</dt>
                   *          <dd>The readyState code reported by the XMLHttpRequest instance.</dd>
                   *      <dt>originEvent</dt>
                   *          <dd>The original event fired by the XMLHttpRequest instance.</dd>
                   *  </dl>
                   */
                   this.fire("readystatechange", {readyState: event.target.readyState,
                                                  originEvent: event});
                   break;
            }
        },

       /**
        * Starts the upload of a specific file.
        *
        * @method startUpload
        * @param url {String} The URL to upload the file to.
        * @param parameters {Object} (optional) A set of key-value pairs to send as variables along with the file upload HTTP request.
        * @param fileFieldName {String} (optional) The name of the POST variable that should contain the uploaded file ('Filedata' by default)
        */
        startUpload: function(url, parameters, fileFieldName) {

            this._set("bytesUploaded", 0);

            this._set("xhr", new XMLHttpRequest());
            this._set("boundEventHandler", Bind(this._uploadEventHandler, this));

            var uploadData = new FormData(),
                fileField = fileFieldName || "Filedata",
                xhr = this.get("xhr"),
                xhrupload = this.get("xhr").upload,
                boundEventHandler = this.get("boundEventHandler");

            Y.each(parameters, function (value, key) {uploadData.append(key, value);});
            uploadData.append(fileField, this.get("file"));




            xhr.addEventListener ("loadstart", boundEventHandler, false);
            xhrupload.addEventListener ("progress", boundEventHandler, false);
            xhr.addEventListener ("load", boundEventHandler, false);
            xhr.addEventListener ("error", boundEventHandler, false);
            xhrupload.addEventListener ("error", boundEventHandler, false);
            xhrupload.addEventListener ("abort", boundEventHandler, false);
            xhr.addEventListener ("abort", boundEventHandler, false);
            xhr.addEventListener ("loadend", boundEventHandler, false);
            xhr.addEventListener ("readystatechange", boundEventHandler, false);

            xhr.open("POST", url, true);

            xhr.withCredentials = this.get("xhrWithCredentials");

            Y.each(this.get("xhrHeaders"), function (value, key) {
                 xhr.setRequestHeader(key, value);
            });

            xhr.send(uploadData);

            /**
             * Signals that this file's upload has started.
             *
             * @event uploadstart
             * @param event {Event} The event object for the `uploadstart` with the
             *                      following payload:
             *  <dl>
             *      <dt>xhr</dt>
             *          <dd>The XMLHttpRequest instance handling the file upload.</dd>
             *  </dl>
             */
             this.fire("uploadstart", {xhr: xhr});

        },

       /**
        * Cancels the upload of a specific file, if currently in progress.
        *
        * @method cancelUpload
        */
        cancelUpload: function () {
            var xhr = this.get('xhr');
            if (xhr) {
                xhr.abort();
            }
        }


    }, {

       /**
        * The identity of the class.
        *
        * @property NAME
        * @type String
        * @default 'file'
        * @readOnly
        * @protected
        * @static
        */
        NAME: 'file',

       /**
        * The type of transport.
        *
        * @property TYPE
        * @type String
        * @default 'html5'
        * @readOnly
        * @protected
        * @static
        */
        TYPE: 'html5',

       /**
        * Static property used to define the default attribute configuration of
        * the File.
        *
        * @property ATTRS
        * @type {Object}
        * @protected
        * @static
        */
        ATTRS: {

       /**
        * A String containing the unique id of the file wrapped by the FileFlash instance.
        * The id is supplied by the Flash player uploader.
        *
        * @attribute id
        * @type {String}
        * @initOnly
        */
        id: {
            writeOnce: "initOnly",
            value: null
        },

       /**
        * The size of the file wrapped by FileHTML5. This value is supplied by the instance of File().
        *
        * @attribute size
        * @type {Number}
        * @initOnly
        */
        size: {
            writeOnce: "initOnly",
            value: 0
        },

       /**
        * The name of the file wrapped by FileHTML5. This value is supplied by the instance of File().
        *
        * @attribute name
        * @type {String}
        * @initOnly
        */
        name: {
            writeOnce: "initOnly",
            value: null
        },

       /**
        * The date that the file wrapped by FileHTML5 was created on. This value is supplied by the instance of File().
        *
        * @attribute dateCreated
        * @type {Date}
        * @initOnly
        * @default null
        */
        dateCreated: {
            writeOnce: "initOnly",
            value: null
        },

       /**
        * The date that the file wrapped by FileHTML5 was last modified on. This value is supplied by the instance of File().
        *
        * @attribute dateModified
        * @type {Date}
        * @initOnly
        */
        dateModified: {
            writeOnce: "initOnly",
            value: null
        },

       /**
        * The number of bytes of the file that has been uploaded to the server. This value is
        * non-zero only while a file is being uploaded.
        *
        * @attribute bytesUploaded
        * @type {Date}
        * @readOnly
        */
        bytesUploaded: {
            readOnly: true,
            value: 0
        },

       /**
        * The type of the file wrapped by FileHTML. This value is provided by the instance of File()
        *
        * @attribute type
        * @type {String}
        * @initOnly
        */
        type: {
            writeOnce: "initOnly",
            value: null
        },

       /**
        * The pointer to the instance of File() wrapped by FileHTML5.
        *
        * @attribute file
        * @type {File}
        * @initOnly
        */
        file: {
            writeOnce: "initOnly",
            value: null
        },

       /**
        * The pointer to the instance of XMLHttpRequest used by FileHTML5 to upload the file.
        *
        * @attribute xhr
        * @type {XMLHttpRequest}
        * @initOnly
        */
        xhr: {
            readOnly: true,
            value: null
        },

       /**
        * The dictionary of headers that should be set on the XMLHttpRequest object before
        * sending it.
        *
        * @attribute xhrHeaders
        * @type {Object}
        * @initOnly
        */
        xhrHeaders: {
            value: {}
        },

       /**
        * A Boolean indicating whether the XMLHttpRequest should be sent with user credentials.
        * This does not affect same-site requests.
        *
        * @attribute xhrWithCredentials
        * @type {Boolean}
        * @initOnly
        */
        xhrWithCredentials: {
            value: true
        },

       /**
        * The bound event handler used to handle events from XMLHttpRequest.
        *
        * @attribute boundEventHandler
        * @type {Function}
        * @initOnly
        */
        boundEventHandler: {
            readOnly: true,
            value: null
        }
        },

       /**
        * Checks whether a specific native file instance is valid
        *
        * @method isValidFile
        * @param file {File} A native File() instance.
        * @static
        */
        isValidFile: function (file) {
            return (Win && Win.File && file instanceof File);
        },

       /**
        * Checks whether the browser has a native upload capability
        * via XMLHttpRequest Level 2.
        *
        * @method canUpload
        * @static
        */
        canUpload: function () {
            return (Win && Win.FormData && Win.XMLHttpRequest);
        }
    });

    Y.FileHTML5 = FileHTML5;


}, '3.16.0', {"requires": ["base"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('uploader-queue', function (Y, NAME) {

/**
* The class manages a queue of files that should be uploaded to the server.
* It initializes the required number of uploads, tracks them as they progress,
* and automatically advances to the next upload when a preceding one has completed.
* @module uploader-queue
*/



/**
* This class manages a queue of files to be uploaded to the server.
* @class Uploader.Queue
* @extends Base
* @constructor
*/
var UploaderQueue = function() {
    this.queuedFiles = [];
    this.uploadRetries = {};
    this.numberOfUploads = 0;
    this.currentUploadedByteValues = {};
    this.currentFiles = {};
    this.totalBytesUploaded = 0;
    this.totalBytes = 0;

    UploaderQueue.superclass.constructor.apply(this, arguments);
};


Y.extend(UploaderQueue, Y.Base, {

    /**
    * Stored value of the current queue state
    * @property _currentState
    * @type {String}
    * @protected
    * @default UploaderQueue.STOPPED
    */
    _currentState: UploaderQueue.STOPPED,

    /**
    * Construction logic executed during UploaderQueue instantiation.
    *
    * @method initializer
    * @protected
    */
    initializer : function () {},

    /**
    * Handles and retransmits upload start event.
    *
    * @method _uploadStartHandler
    * @param event The event dispatched during the upload process.
    * @private
    */
    _uploadStartHandler : function (event) {
        var updatedEvent = event;
        updatedEvent.file = event.target;
        updatedEvent.originEvent = event;

        this.fire("uploadstart", updatedEvent);
    },

    /**
    * Handles and retransmits upload error event.
    *
    * @method _uploadErrorHandler
    * @param event The event dispatched during the upload process.
    * @private
    */
    _uploadErrorHandler : function (event) {
        var errorAction = this.get("errorAction"),
            updatedEvent = event,
            fileid,
            retries;

        updatedEvent.file = event.target;
        updatedEvent.originEvent = event;

        this.numberOfUploads-=1;
        delete this.currentFiles[event.target.get("id")];
        this._detachFileEvents(event.target);

        event.target.cancelUpload();

        if (errorAction === UploaderQueue.STOP) {
            this.pauseUpload();
        }

        else if (errorAction === UploaderQueue.RESTART_ASAP) {
            fileid = event.target.get("id");
            retries = this.uploadRetries[fileid] || 0;

            if (retries < this.get("retryCount")) {
                this.uploadRetries[fileid] = retries + 1;
                this.addToQueueTop(event.target);
            }
            this._startNextFile();
        }
        else if (errorAction === UploaderQueue.RESTART_AFTER) {
            fileid = event.target.get("id");
            retries = this.uploadRetries[fileid] || 0;

            if (retries < this.get("retryCount")) {
                this.uploadRetries[fileid] = retries + 1;
                this.addToQueueBottom(event.target);
            }
            this._startNextFile();
        }

        this.fire("uploaderror", updatedEvent);
    },

    /**
    * Launches the upload of the next file in the queue.
    *
    * @method _startNextFile
    * @private
    */
    _startNextFile : function () {
        if (this.queuedFiles.length > 0) {
            var currentFile = this.queuedFiles.shift(),
                fileId = currentFile.get("id"),
                parameters = this.get("perFileParameters"),
                fileParameters = parameters.hasOwnProperty(fileId) ? parameters[fileId] : parameters;

            this.currentUploadedByteValues[fileId] = 0;

            currentFile.on("uploadstart", this._uploadStartHandler, this);
            currentFile.on("uploadprogress", this._uploadProgressHandler, this);
            currentFile.on("uploadcomplete", this._uploadCompleteHandler, this);
            currentFile.on("uploaderror", this._uploadErrorHandler, this);
            currentFile.on("uploadcancel", this._uploadCancelHandler, this);

            currentFile.set("xhrHeaders", this.get("uploadHeaders"));
            currentFile.set("xhrWithCredentials", this.get("withCredentials"));

            currentFile.startUpload(this.get("uploadURL"), fileParameters, this.get("fileFieldName"));

            this._registerUpload(currentFile);
        }
    },

    /**
    * Register a new upload process.
    *
    * @method _registerUpload
    * @private
    */
    _registerUpload : function (file) {
        this.numberOfUploads += 1;
        this.currentFiles[file.get("id")] = file;
    },

    /**
    * Unregisters a new upload process.
    *
    * @method _unregisterUpload
    * @private
    */
    _unregisterUpload : function (file) {
        if (this.numberOfUploads > 0) {
            this.numberOfUploads -= 1;
        }

        delete this.currentFiles[file.get("id")];
        delete this.uploadRetries[file.get("id")];

        this._detachFileEvents(file);
    },

    _detachFileEvents : function (file) {
        file.detach("uploadstart", this._uploadStartHandler);
        file.detach("uploadprogress", this._uploadProgressHandler);
        file.detach("uploadcomplete", this._uploadCompleteHandler);
        file.detach("uploaderror", this._uploadErrorHandler);
        file.detach("uploadcancel", this._uploadCancelHandler);
    },

    /**
    * Handles and retransmits upload complete event.
    *
    * @method _uploadCompleteHandler
    * @param event The event dispatched during the upload process.
    * @private
    */
    _uploadCompleteHandler : function (event) {

        this._unregisterUpload(event.target);

        this.totalBytesUploaded += event.target.get("size");
        delete this.currentUploadedByteValues[event.target.get("id")];


        if (this.queuedFiles.length > 0 && this._currentState === UploaderQueue.UPLOADING) {
            this._startNextFile();
        }

        var updatedEvent = event,
            uploadedTotal = this.totalBytesUploaded,
            percentLoaded = Math.min(100, Math.round(10000*uploadedTotal/this.totalBytes) / 100);

        updatedEvent.file = event.target;
        updatedEvent.originEvent = event;

        Y.each(this.currentUploadedByteValues, function (value) {
            uploadedTotal += value;
        });

        this.fire("totaluploadprogress", {
            bytesLoaded: uploadedTotal,
            bytesTotal: this.totalBytes,
            percentLoaded: percentLoaded
        });

        this.fire("uploadcomplete", updatedEvent);

        if (this.queuedFiles.length === 0 && this.numberOfUploads <= 0) {
            this.fire("alluploadscomplete");
            this._currentState = UploaderQueue.STOPPED;
        }
    },

    /**
    * Handles and retransmits upload cancel event.
    *
    * @method _uploadCancelHandler
    * @param event The event dispatched during the upload process.
    * @private
    */
    _uploadCancelHandler : function (event) {

        var updatedEvent = event;
        updatedEvent.originEvent = event;
        updatedEvent.file = event.target;

        this.fire("uploadcancel", updatedEvent);
    },



    /**
    * Handles and retransmits upload progress event.
    *
    * @method _uploadProgressHandler
    * @param event The event dispatched during the upload process.
    * @private
    */
    _uploadProgressHandler : function (event) {

        this.currentUploadedByteValues[event.target.get("id")] = event.bytesLoaded;

        var updatedEvent = event,
            uploadedTotal = this.totalBytesUploaded,
            percentLoaded = Math.min(100, Math.round(10000*uploadedTotal/this.totalBytes) / 100);

        updatedEvent.originEvent = event;
        updatedEvent.file = event.target;

        this.fire("uploadprogress", updatedEvent);

        Y.each(this.currentUploadedByteValues, function (value) {
            uploadedTotal += value;
        });

        this.fire("totaluploadprogress", {
            bytesLoaded: uploadedTotal,
            bytesTotal: this.totalBytes,
            percentLoaded: percentLoaded
        });
    },

    /**
    * Starts uploading the queued up file list.
    *
    * @method startUpload
    */
    startUpload: function() {
        this.queuedFiles = this.get("fileList").slice(0);
        this.numberOfUploads = 0;
        this.currentUploadedByteValues = {};
        this.currentFiles = {};
        this.totalBytesUploaded = 0;

        this._currentState = UploaderQueue.UPLOADING;

        while (this.numberOfUploads < this.get("simUploads") && this.queuedFiles.length > 0) {
            this._startNextFile();
        }
    },

    /**
    * Pauses the upload process. The ongoing file uploads
    * will complete after this method is called, but no
    * new ones will be launched.
    *
    * @method pauseUpload
    */
    pauseUpload: function () {
        this._currentState = UploaderQueue.STOPPED;
    },

    /**
    * Restarts a paused upload process.
    *
    * @method restartUpload
    */
    restartUpload: function () {
        this._currentState = UploaderQueue.UPLOADING;
        while (this.numberOfUploads < this.get("simUploads")) {
             this._startNextFile();
        }
    },

    /**
    * If a particular file is stuck in an ongoing upload without
    * any progress events, this method allows to force its reupload
    * by cancelling its upload and immediately relaunching it.
    *
    * @method forceReupload
    * @param file {File} The file to force reupload on.
    */
    forceReupload : function (file) {
        var id = file.get("id");
        if (this.currentFiles.hasOwnProperty(id)) {
            file.cancelUpload();
            this._unregisterUpload(file);
            this.addToQueueTop(file);
            this._startNextFile();
        }
    },

    /**
    * Add a new file to the top of the queue (the upload will be
    * launched as soon as the current number of uploading files
    * drops below the maximum permissible value).
    *
    * @method addToQueueTop
    * @param file {File} The file to add to the top of the queue.
    */
    addToQueueTop: function (file) {
            this.queuedFiles.unshift(file);
    },

    /**
    * Add a new file to the bottom of the queue (the upload will be
    * launched after all the other queued files are uploaded.)
    *
    * @method addToQueueBottom
    * @param file {File} The file to add to the bottom of the queue.
    */
    addToQueueBottom: function (file) {
            this.queuedFiles.push(file);
    },

    /**
    * Cancels a specific file's upload. If no argument is passed,
    * all ongoing uploads are cancelled and the upload process is
    * stopped.
    *
    * @method cancelUpload
    * @param file {File} An optional parameter - the file whose upload
    * should be cancelled.
    */
    cancelUpload: function (file) {
        var id,
            i,
            fid;

        if (file) {
            id = file.get("id");

            if (this.currentFiles[id]) {
                this.currentFiles[id].cancelUpload();
                this._unregisterUpload(this.currentFiles[id]);
                if (this._currentState === UploaderQueue.UPLOADING) {
                    this._startNextFile();
                }
            }
            else {
                for (i = 0, len = this.queuedFiles.length; i < len; i++) {
                    if (this.queuedFiles[i].get("id") === id) {
                        this.queuedFiles.splice(i, 1);
                        break;
                    }
                }
            }
        }
        else {
            for (fid in this.currentFiles) {
                this.currentFiles[fid].cancelUpload();
                this._unregisterUpload(this.currentFiles[fid]);
            }

            this.currentUploadedByteValues = {};
            this.currentFiles = {};
            this.totalBytesUploaded = 0;
            this.fire("alluploadscancelled");
            this._currentState = UploaderQueue.STOPPED;
        }
    }
}, {
    /**
    * Static constant for the value of the `errorAction` attribute:
    * prescribes the queue to continue uploading files in case of
    * an error.
    * @property CONTINUE
    * @readOnly
    * @type {String}
    * @static
    */
    CONTINUE: "continue",

    /**
    * Static constant for the value of the `errorAction` attribute:
    * prescribes the queue to stop uploading files in case of
    * an error.
    * @property STOP
    * @readOnly
    * @type {String}
    * @static
    */
    STOP: "stop",

    /**
    * Static constant for the value of the `errorAction` attribute:
    * prescribes the queue to restart a file upload immediately in case of
    * an error.
    * @property RESTART_ASAP
    * @readOnly
    * @type {String}
    * @static
    */
    RESTART_ASAP: "restartasap",

    /**
    * Static constant for the value of the `errorAction` attribute:
    * prescribes the queue to restart an errored out file upload after
    * other files have finished uploading.
    * @property RESTART_AFTER
    * @readOnly
    * @type {String}
    * @static
    */
    RESTART_AFTER: "restartafter",

    /**
    * Static constant for the value of the `_currentState` property:
    * implies that the queue is currently not uploading files.
    * @property STOPPED
    * @readOnly
    * @type {String}
    * @static
    */
    STOPPED: "stopped",

    /**
    * Static constant for the value of the `_currentState` property:
    * implies that the queue is currently uploading files.
    * @property UPLOADING
    * @readOnly
    * @type {String}
    * @static
    */
    UPLOADING: "uploading",

    /**
    * The identity of the class.
    *
    * @property NAME
    * @type String
    * @default 'uploaderqueue'
    * @readOnly
    * @protected
    * @static
    */
    NAME: 'uploaderqueue',

    /**
    * Static property used to define the default attribute configuration of
    * the class.
    *
    * @property ATTRS
    * @type {Object}
    * @protected
    * @static
    */
    ATTRS: {

        /**
        * Maximum number of simultaneous uploads; must be in the
        * range between 1 and 5. The value of `2` is default. It
        * is recommended that this value does not exceed 3.
        * @attribute simUploads
        * @type Number
        * @default 2
        */
         simUploads: {
                 value: 2,
                 validator: function (val) {
                         return (val >= 1 && val <= 5);
                 }
         },

        /**
        * The action to take in case of error. The valid values for this attribute are:
        * `Y.Uploader.Queue.CONTINUE` (the upload process should continue on other files,
        * ignoring the error), `Y.Uploader.Queue.STOP` (the upload process
        * should stop completely), `Y.Uploader.Queue.RESTART_ASAP` (the upload
        * should restart immediately on the errored out file and continue as planned), or
        * Y.Uploader.Queue.RESTART_AFTER (the upload of the errored out file should restart
        * after all other files have uploaded)
        * @attribute errorAction
        * @type String
        * @default Y.Uploader.Queue.CONTINUE
        */
        errorAction: {
            value: "continue",
                validator: function (val) {
                return (
                    val === UploaderQueue.CONTINUE ||
                    val === UploaderQueue.STOP ||
                    val === UploaderQueue.RESTART_ASAP ||
                    val === UploaderQueue.RESTART_AFTER
                );
            }
        },

        /**
        * The total number of bytes that has been uploaded.
        * @attribute bytesUploaded
        * @type Number
        */
        bytesUploaded: {
            readOnly: true,
            value: 0
        },

        /**
        * The total number of bytes in the queue.
        * @attribute bytesTotal
        * @type Number
        */
        bytesTotal: {
            readOnly: true,
            value: 0
        },

        /**
        * The queue file list. This file list should only be modified
        * before the upload has been started; modifying it after starting
        * the upload has no effect, and `addToQueueTop` or `addToQueueBottom` methods
        * should be used instead.
        * @attribute fileList
        * @type Array
        */
        fileList: {
            value: [],
            lazyAdd: false,
            setter: function (val) {
                var newValue = val;
                Y.Array.each(newValue, function (value) {
                    this.totalBytes += value.get("size");
                }, this);

                return val;
            }
        },

        /**
        * A String specifying what should be the POST field name for the file
        * content in the upload request.
        *
        * @attribute fileFieldName
        * @type {String}
        * @default Filedata
        */
        fileFieldName: {
            value: "Filedata"
        },

        /**
        * The URL to POST the file upload requests to.
        *
        * @attribute uploadURL
        * @type {String}
        * @default ""
        */
        uploadURL: {
            value: ""
        },

        /**
        * Additional HTTP headers that should be included
        * in the upload request. Due to Flash Player security
        * restrictions, this attribute is only honored in the
        * HTML5 Uploader.
        *
        * @attribute uploadHeaders
        * @type {Object}
        * @default {}
        */
        uploadHeaders: {
            value: {}
        },

        /**
        * A Boolean that specifies whether the file should be
        * uploaded with the appropriate user credentials for the
        * domain. Due to Flash Player security restrictions, this
        * attribute is only honored in the HTML5 Uploader.
        *
        * @attribute withCredentials
        * @type {Boolean}
        * @default true
        */
        withCredentials: {
            value: true
        },


        /**
        * An object, keyed by `fileId`, containing sets of key-value pairs
        * that should be passed as POST variables along with each corresponding
        * file.
        *
        * @attribute perFileParameters
        * @type {Object}
        * @default {}
        */
        perFileParameters: {
            value: {}
        },

        /**
        * The number of times to try re-uploading a file that failed to upload before
        * cancelling its upload.
        *
        * @attribute retryCount
        * @type {Number}
        * @default 3
        */
        retryCount: {
            value: 3
        }

    }
});


Y.namespace('Uploader');
Y.Uploader.Queue = UploaderQueue;


}, '3.16.0', {"requires": ["base"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('uploader-html5', function (Y, NAME) {

/**
* This module provides a UI for file selection and multiple file upload capability using
* HTML5 XMLHTTPRequest Level 2 as a transport engine.
* The supported features include: automatic upload queue management, upload progress
* tracking, drag-and-drop support, server response retrieval and error reporting.
*
* @module uploader-html5
*/

// Shorthands for the external modules
var  substitute  = Y.Lang.sub,
     UploaderQueue = Y.Uploader.Queue;

/**
* This module provides a UI for file selection and multiple file upload capability using
* HTML5 XMLHTTPRequest Level 2 as a transport engine.
* @class UploaderHTML5
* @extends Widget
* @constructor
*/
function UploaderHTML5() {
    UploaderHTML5.superclass.constructor.apply ( this, arguments );
}



Y.UploaderHTML5 = Y.extend( UploaderHTML5, Y.Widget, {

    /**
    * Stored reference to the instance of the file input field used to
    * initiate the file selection dialog.
    *
    * @property _fileInputField
    * @type {Node}
    * @protected
    */
    _fileInputField: null,

    /**
    * Stored reference to the click event binding of the `Select Files`
    * button.
    *
    * @property _buttonBinding
    * @type {EventHandle}
    * @protected
    */
    _buttonBinding: null,

    /**
    * Stored reference to the instance of Uploader.Queue used to manage
    * the upload process. This is a read-only property that only exists
    * during an active upload process. Only one queue can be active at
    * a time; if an upload start is attempted while a queue is active,
    * it will be ignored.
    *
    * @property queue
    * @type {Uploader.Queue}
    */
    queue: null,

    // Y.UploaderHTML5 prototype

    /**
    * Construction logic executed during UploaderHTML5 instantiation.
    *
    * @method initializer
    * @protected
    */
    initializer : function () {

        this._fileInputField = null;
        this.queue = null;
        this._buttonBinding = null;
        this._fileList = [];

        // Publish available events

        /**
        * Signals that files have been selected.
        *
        * @event fileselect
        * @param event {Event} The event object for the `fileselect` with the
        *                      following payload:
        *  <dl>
        *      <dt>fileList</dt>
        *          <dd>An `Array` of files selected by the user, encapsulated
        *              in Y.FileHTML5 objects.</dd>
        *  </dl>
        */
        this.publish("fileselect");

        /**
        * Signals that an upload of multiple files has been started.
        *
        * @event uploadstart
        * @param event {Event} The event object for the `uploadstart`.
        */
        this.publish("uploadstart");

        /**
        * Signals that an upload of a specific file has started.
        *
        * @event fileuploadstart
        * @param event {Event} The event object for the `fileuploadstart` with the
        *                      following payload:
        *  <dl>
        *      <dt>file</dt>
        *          <dd>A reference to the Y.File that dispatched the event.</dd>
        *      <dt>originEvent</dt>
        *          <dd>The original event dispatched by Y.File.</dd>
        *  </dl>
        */
        this.publish("fileuploadstart");

        /**
        * Reports on upload progress of a specific file.
        *
        * @event uploadprogress
        * @param event {Event} The event object for the `uploadprogress` with the
        *                      following payload:
        *  <dl>
        *      <dt>file</dt>
        *          <dd>The pointer to the instance of `Y.File` that dispatched the event.</dd>
        *      <dt>bytesLoaded</dt>
        *          <dd>The number of bytes of the file that has been uploaded</dd>
        *      <dt>bytesTotal</dt>
        *          <dd>The total number of bytes in the file</dd>
        *      <dt>percentLoaded</dt>
        *          <dd>The fraction of the file that has been uploaded, out of 100</dd>
        *      <dt>originEvent</dt>
        *          <dd>The original event dispatched by the HTML5 uploader</dd>
        *  </dl>
        */
        this.publish("uploadprogress");

        /**
        * Reports on the total upload progress of the file list.
        *
        * @event totaluploadprogress
        * @param event {Event} The event object for the `totaluploadprogress` with the
        *                      following payload:
        *  <dl>
        *      <dt>bytesLoaded</dt>
        *          <dd>The number of bytes of the file list that has been uploaded</dd>
        *      <dt>bytesTotal</dt>
        *          <dd>The total number of bytes in the file list</dd>
        *      <dt>percentLoaded</dt>
        *          <dd>The fraction of the file list that has been uploaded, out of 100</dd>
        *  </dl>
        */
        this.publish("totaluploadprogress");

        /**
        * Signals that a single file upload has been completed.
        *
        * @event uploadcomplete
        * @param event {Event} The event object for the `uploadcomplete` with the
        *                      following payload:
        *  <dl>
        *      <dt>file</dt>
        *          <dd>The pointer to the instance of `Y.File` whose upload has been completed.</dd>
        *      <dt>originEvent</dt>
        *          <dd>The original event fired by the SWF Uploader</dd>
        *      <dt>data</dt>
        *          <dd>Data returned by the server.</dd>
        *  </dl>
        */
        this.publish("uploadcomplete");

        /**
        * Signals that the upload process of the entire file list has been completed.
        *
        * @event alluploadscomplete
        * @param event {Event} The event object for the `alluploadscomplete`.
        */
        this.publish("alluploadscomplete");

        /**
        * Signals that a error has occurred in a specific file's upload process.
        *
        * @event uploaderror
        * @param event {Event} The event object for the `uploaderror` with the
        *                      following payload:
        *  <dl>
        *      <dt>originEvent</dt>
        *          <dd>The original error event fired by the HTML5 Uploader. </dd>
        *      <dt>file</dt>
        *          <dd>The pointer at the instance of Y.File that returned the error.</dd>
        *      <dt>status</dt>
        *          <dd>The status reported by the XMLHttpRequest object.</dd>
        *      <dt>statusText</dt>
        *          <dd>The statusText reported by the XMLHttpRequest object.</dd>
        *  </dl>
        */
        this.publish("uploaderror");

        /**
        * Signals that a dragged object has entered into the uploader's associated drag-and-drop area.
        *
        * @event dragenter
        * @param event {Event} The event object for the `dragenter`.
        */
        this.publish("dragenter");

        /**
        * Signals that an object has been dragged over the uploader's associated drag-and-drop area.
        *
        * @event dragover
        * @param event {Event} The event object for the `dragover`.
        */
        this.publish("dragover");

        /**
        * Signals that an object has been dragged off of the uploader's associated drag-and-drop area.
        *
        * @event dragleave
        * @param event {Event} The event object for the `dragleave`.
        */
        this.publish("dragleave");

        /**
        * Signals that an object has been dropped over the uploader's associated drag-and-drop area.
        *
        * @event drop
        * @param event {Event} The event object for the `drop` with the
        *                      following payload:
        *  <dl>
        *      <dt>fileList</dt>
        *          <dd>An `Array` of files dropped by the user, encapsulated
        *              in Y.FileHTML5 objects.</dd>
        *  </dl>
        */
        this.publish("drop");

    },

    /**
    * Create the DOM structure for the UploaderHTML5.
    * UploaderHTML5's DOM structure consists of a "Select Files" button that can
    * be replaced by the developer's widget of choice; and a hidden file input field
    * that is used to instantiate the File Select dialog.
    *
    * @method renderUI
    * @protected
    */
    renderUI : function () {
        var contentBox = this.get('contentBox'),
            selButton = this.get("selectFilesButton");

        selButton.setStyles({width:"100%", height:"100%"});
        contentBox.append(selButton);
        this._fileInputField = Y.Node.create(UploaderHTML5.HTML5FILEFIELD_TEMPLATE);
        contentBox.append(this._fileInputField);
    },

    /**
    * Binds to the UploaderHTML5 UI and subscribes to the necessary events.
    *
    * @method bindUI
    * @protected
    */
    bindUI : function () {

        this._bindSelectButton();
        this._setMultipleFiles();
        this._setFileFilters();
        this._bindDropArea();
        this._triggerEnabled();

        this.after("multipleFilesChange", this._setMultipleFiles, this);
        this.after("fileFiltersChange", this._setFileFilters, this);
        this.after("enabledChange", this._triggerEnabled, this);
        this.after("selectFilesButtonChange", this._bindSelectButton, this);
        this.after("dragAndDropAreaChange", this._bindDropArea, this);
        this.after("tabIndexChange", function () {
            this.get("selectFilesButton").set("tabIndex", this.get("tabIndex"));
        }, this);
        this._fileInputField.on("change", this._updateFileList, this);
        this._fileInputField.on("click", function(event) {
            event.stopPropagation();
        }, this);

        this.get("selectFilesButton").set("tabIndex", this.get("tabIndex"));
    },


    /**
    * Recreates the file field to null out the previous list of files and
    * thus allow for an identical file list selection.
    *
    * @method _rebindFileField
    * @protected
    */
    _rebindFileField : function () {
        this._fileInputField.remove(true);
        this._fileInputField = Y.Node.create(UploaderHTML5.HTML5FILEFIELD_TEMPLATE);
        this.get("contentBox").append(this._fileInputField);
        this._fileInputField.on("change", this._updateFileList, this);
        this._setMultipleFiles();
        this._setFileFilters();
    },


    /**
    * Binds the specified drop area's drag and drop events to the
    * uploader's custom handler.
    *
    * @method _bindDropArea
    * @protected
    */
    _bindDropArea : function (event) {
        var ev = event || {prevVal: null},
            ddArea = this.get("dragAndDropArea");

        if (ev.prevVal !== null) {
            ev.prevVal.detach('drop', this._ddEventHandler);
            ev.prevVal.detach('dragenter', this._ddEventHandler);
            ev.prevVal.detach('dragover', this._ddEventHandler);
            ev.prevVal.detach('dragleave', this._ddEventHandler);
        }

        if (ddArea !== null) {
            ddArea.on('drop', this._ddEventHandler, this);
            ddArea.on('dragenter', this._ddEventHandler, this);
            ddArea.on('dragover', this._ddEventHandler, this);
            ddArea.on('dragleave', this._ddEventHandler, this);
        }
    },

    /**
    * Binds the instantiation of the file select dialog to the current file select
    * control.
    *
    * @method _bindSelectButton
    * @protected
    */
    _bindSelectButton : function () {
       this._buttonBinding = this.get("selectFilesButton").on("click", this.openFileSelectDialog, this);
    },

    /**
    * Handles the drag and drop events from the uploader's specified drop
    * area.
    *
    * @method _ddEventHandler
    * @protected
    */
    _ddEventHandler : function (event) {


        event.stopPropagation();
        event.preventDefault();

        if (Y.Array.indexOf(event._event.dataTransfer.types, 'Files') > -1) {
            switch (event.type) {
                case "dragenter":
                    this.fire("dragenter");
                    break;
                case "dragover":
                    this.fire("dragover");
                    break;
                case "dragleave":
                    this.fire("dragleave");
                    break;
                case "drop":

                    var newfiles = event._event.dataTransfer.files,
                        parsedFiles = [],
                        filterFunc = this.get("fileFilterFunction"),
                        oldfiles;

                    if (filterFunc) {
                        Y.each(newfiles, function (value) {
                            var newfile = new Y.FileHTML5(value);
                            if (filterFunc(newfile)) {
                                parsedFiles.push(newfile);
                            }
                        });
                    }
                    else {
                        Y.each(newfiles, function (value) {
                            parsedFiles.push(new Y.FileHTML5(value));
                        });
                    }

                    if (parsedFiles.length > 0) {
                        oldfiles = this.get("fileList");
                        this.set("fileList",
                        this.get("appendNewFiles") ? oldfiles.concat(parsedFiles) : parsedFiles);
                        this.fire("fileselect", {fileList: parsedFiles});
                    }

                    this.fire("drop", {fileList: parsedFiles});
                    break;
            }
        }
    },

    /**
    * Adds or removes a specified state CSS class to the underlying uploader button.
    *
    * @method _setButtonClass
    * @protected
    * @param state {String} The name of the state enumerated in `buttonClassNames` attribute
    * from which to derive the needed class name.
    * @param add {Boolean} A Boolean indicating whether to add or remove the class.
    */
    _setButtonClass : function (state, add) {
        if (add) {
            this.get("selectFilesButton").addClass(this.get("buttonClassNames")[state]);
        }
        else {
            this.get("selectFilesButton").removeClass(this.get("buttonClassNames")[state]);
        }
    },

    /**
    * Syncs the state of the `multipleFiles` attribute between this class
    * and the file input field.
    *
    * @method _setMultipleFiles
    * @protected
    */
    _setMultipleFiles : function () {
        if (this.get("multipleFiles") === true) {
            this._fileInputField.set("multiple", "multiple");
        }
        else {
            this._fileInputField.set("multiple", "");
        }
    },

    /**
    * Syncs the state of the `fileFilters` attribute between this class
    * and the file input field.
    *
    * @method _setFileFilters
    * @protected
    */
    _setFileFilters : function () {
        if (this.get("fileFilters").length > 0) {
            this._fileInputField.set("accept", this.get("fileFilters").join(","));
        }
        else {
            this._fileInputField.set("accept", "");
        }
    },


    /**
    * Syncs the state of the `enabled` attribute between this class
    * and the underlying button.
    *
    * @method _triggerEnabled
    * @private
    */
    _triggerEnabled : function () {
        if (this.get("enabled") && this._buttonBinding === null) {
            this._bindSelectButton();
            this._setButtonClass("disabled", false);
            this.get("selectFilesButton").setAttribute("aria-disabled", "false");
        }
        else if (!this.get("enabled") && this._buttonBinding) {
            this._buttonBinding.detach();
            this._buttonBinding = null;
            this._setButtonClass("disabled", true);
            this.get("selectFilesButton").setAttribute("aria-disabled", "true");
        }
    },

    /**
    * Getter for the `fileList` attribute
    *
    * @method _getFileList
    * @private
    */
    _getFileList : function () {
        return this._fileList.concat();
    },

    /**
    * Setter for the `fileList` attribute
    *
    * @method _setFileList
    * @private
    */
    _setFileList : function (val) {
        this._fileList = val.concat();
        return this._fileList.concat();
    },

    /**
    * Adjusts the content of the `fileList` based on the results of file selection
    * and the `appendNewFiles` attribute. If the `appendNewFiles` attribute is true,
    * then selected files are appended to the existing list; otherwise, the list is
    * cleared and populated with the newly selected files.
    *
    * @method _updateFileList
    * @param ev {Event} The file selection event received from the uploader.
    * @protected
    */
    _updateFileList : function (ev) {
        var newfiles = ev.target.getDOMNode().files,
            parsedFiles = [],
            filterFunc = this.get("fileFilterFunction"),
            oldfiles;

        if (filterFunc) {
            Y.each(newfiles, function (value) {
                var newfile = new Y.FileHTML5(value);
                if (filterFunc(newfile)) {
                    parsedFiles.push(newfile);
                }
            });
        }
        else {
            Y.each(newfiles, function (value) {
                parsedFiles.push(new Y.FileHTML5(value));
            });
        }

        if (parsedFiles.length > 0) {
            oldfiles = this.get("fileList");

            this.set("fileList",
                    this.get("appendNewFiles") ? oldfiles.concat(parsedFiles) : parsedFiles );

            this.fire("fileselect", {fileList: parsedFiles});
        }

        this._rebindFileField();
    },


    /**
    * Handles and retransmits events fired by `Y.File` and `Y.Uploader.Queue`.
    *
    * @method _uploadEventHandler
    * @param event The event dispatched during the upload process.
    * @protected
    */
    _uploadEventHandler : function (event) {

        switch (event.type) {
            case "file:uploadstart":
                this.fire("fileuploadstart", event);
                break;
            case "file:uploadprogress":
                this.fire("uploadprogress", event);
                break;
            case "uploaderqueue:totaluploadprogress":
                this.fire("totaluploadprogress", event);
                break;
            case "file:uploadcomplete":
                this.fire("uploadcomplete", event);
                break;
            case "uploaderqueue:alluploadscomplete":
                this.queue = null;
                this.fire("alluploadscomplete", event);
                break;
            case "file:uploaderror": // overflow intentional
            case "uploaderqueue:uploaderror":
                this.fire("uploaderror", event);
                break;
            case "file:uploadcancel": // overflow intentional
            case "uploaderqueue:uploadcancel":
                this.fire("uploadcancel", event);
                break;
        }

    },

    /**
    * Opens the File Selection dialog by simulating a click on the file input field.
    *
    * @method openFileSelectDialog
    */
    openFileSelectDialog : function () {
        var fileDomNode = this._fileInputField.getDOMNode();
        if (fileDomNode.click) {
            fileDomNode.click();
        }
    },

    /**
    * Starts the upload of a specific file.
    *
    * @method upload
    * @param file {File} Reference to the instance of the file to be uploaded.
    * @param url {String} The URL to upload the file to.
    * @param postVars {Object} (optional) A set of key-value pairs to send as variables along with the file upload HTTP request.
    *                          If not specified, the values from the attribute `postVarsPerFile` are used instead.
    */
    upload : function (file, url, postvars) {

        var uploadURL = url || this.get("uploadURL"),
            postVars = postvars || this.get("postVarsPerFile"),
            fileId = file.get("id");

        postVars = postVars.hasOwnProperty(fileId) ? postVars[fileId] : postVars;

        if (file instanceof Y.FileHTML5) {

            file.on("uploadstart", this._uploadEventHandler, this);
            file.on("uploadprogress", this._uploadEventHandler, this);
            file.on("uploadcomplete", this._uploadEventHandler, this);
            file.on("uploaderror", this._uploadEventHandler, this);
            file.on("uploadcancel", this._uploadEventHandler, this);

            file.startUpload(uploadURL, postVars, this.get("fileFieldName"));
        }
    },

   /**
    * Starts the upload of all files on the file list, using an automated queue.
    *
    * @method uploadAll
    * @param url {String} The URL to upload the files to.
    * @param [postVars] {Object} A set of key-value pairs to send as variables along with the file upload HTTP request.
    *                          If not specified, the values from the attribute `postVarsPerFile` are used instead.
    */
    uploadAll : function (url, postvars) {
        this.uploadThese(this.get("fileList"), url, postvars);
    },

    /**
    * Starts the upload of the files specified in the first argument, using an automated queue.
    *
    * @method uploadThese
    * @param files {Array} The list of files to upload.
    * @param url {String} The URL to upload the files to.
    * @param [postVars] {Object} A set of key-value pairs to send as variables along with the file upload HTTP request.
    *                          If not specified, the values from the attribute `postVarsPerFile` are used instead.
    */
    uploadThese : function (files, url, postvars) {
        if (!this.queue) {
            var uploadURL = url || this.get("uploadURL"),
                postVars = postvars || this.get("postVarsPerFile");

            this.queue = new UploaderQueue({
                simUploads: this.get("simLimit"),
                errorAction: this.get("errorAction"),
                fileFieldName: this.get("fileFieldName"),
                fileList: files,
                uploadURL: uploadURL,
                perFileParameters: postVars,
                retryCount: this.get("retryCount"),
                uploadHeaders: this.get("uploadHeaders"),
                withCredentials: this.get("withCredentials")
            });

            this.queue.on("uploadstart", this._uploadEventHandler, this);
            this.queue.on("uploadprogress", this._uploadEventHandler, this);
            this.queue.on("totaluploadprogress", this._uploadEventHandler, this);
            this.queue.on("uploadcomplete", this._uploadEventHandler, this);
            this.queue.on("alluploadscomplete", this._uploadEventHandler, this);
            this.queue.on("uploadcancel", this._uploadEventHandler, this);
            this.queue.on("uploaderror", this._uploadEventHandler, this);
            this.queue.startUpload();

            this.fire("uploadstart");
       }
       else if (this.queue._currentState === UploaderQueue.UPLOADING) {
            this.queue.set("perFileParameters", this.get("postVarsPerFile"));
            Y.each(files, function (file) {
                this.queue.addToQueueBottom(file);
            }, this);
       }
    }
}, {

    /**
    * The template for the hidden file input field container. The file input field will only
    * accept clicks if its visibility is set to hidden (and will not if it's `display` value
    * is set to `none`)
    *
    * @property HTML5FILEFIELD_TEMPLATE
    * @type {String}
    * @static
    */
    HTML5FILEFIELD_TEMPLATE: "<input type='file' style='visibility:hidden; width:0px; height: 0px;'>",

    /**
    * The template for the "Select Files" button.
    *
    * @property SELECT_FILES_BUTTON
    * @type {String}
    * @static
    * @default '<button type="button" class="yui3-button" role="button" aria-label="{selectButtonLabel}"
    *           tabindex="{tabIndex}">{selectButtonLabel}</button>'
    */
    SELECT_FILES_BUTTON: '<button type="button" class="yui3-button" role="button" aria-label="{selectButtonLabel}" ' +
                         'tabindex="{tabIndex}">{selectButtonLabel}</button>',

    /**
    * The static property reflecting the type of uploader that `Y.Uploader`
    * aliases. The UploaderHTML5 value is `"html5"`.
    *
    * @property TYPE
    * @type {String}
    * @static
    */
    TYPE: "html5",

    /**
    * The identity of the widget.
    *
    * @property NAME
    * @type String
    * @default 'uploader'
    * @readOnly
    * @protected
    * @static
    */
    NAME: "uploader",

    /**
    * Static property used to define the default attribute configuration of
    * the Widget.
    *
    * @property ATTRS
    * @type {Object}
    * @protected
    * @static
    */
    ATTRS: {

        /**
        * A Boolean indicating whether newly selected files should be appended
        * to the existing file list, or whether they should replace it.
        *
        * @attribute appendNewFiles
        * @type {Boolean}
        * @default true
        */
        appendNewFiles : {
            value: true
        },

        /**
        * The names of CSS classes that correspond to different button states
        * of the "Select Files" control. These classes are assigned to the
        * "Select Files" control based on the configuration of the uploader.
        * Currently, the only class name used is that corresponding to the
        * `disabled` state of the uploader. Other button states should be managed
        * directly via CSS selectors.
        * <ul>
        *   <li> <strong>`disabled`</strong>: the class corresponding to the disabled state
        *      of the "Select Files" button.</li>
        * </ul>
        * @attribute buttonClassNames
        * @type {Object}
        * @default {
        *            disabled: "yui3-button-disabled"
        *          }
        */
        buttonClassNames: {
            value: {
                "hover": "yui3-button-hover",
                "active": "yui3-button-active",
                "disabled": "yui3-button-disabled",
                "focus": "yui3-button-selected"
            }
        },

        /**
        * The node that serves as the drop target for files.
        *
        * @attribute dragAndDropArea
        * @type {Node}
        * @default null
        */
        dragAndDropArea: {
            value: null,
            setter: function (val) {
                return Y.one(val);
            }
        },

        /**
        * A Boolean indicating whether the uploader is enabled or disabled for user input.
        *
        * @attribute enabled
        * @type {Boolean}
        * @default true
        */
        enabled : {
            value: true
        },

        /**
        * The action  performed when an upload error occurs for a specific file being uploaded.
        * The possible values are:
        * <ul>
        *   <li> <strong>`UploaderQueue.CONTINUE`</strong>: the error is ignored and the upload process is continued.</li>
        *   <li> <strong>`UploaderQueue.STOP`</strong>: the upload process is stopped as soon as any other parallel file
        *     uploads are finished.</li>
        *   <li> <strong>`UploaderQueue.RESTART_ASAP`</strong>: the file is added back to the front of the queue.</li>
        *   <li> <strong>`UploaderQueue.RESTART_AFTER`</strong>: the file is added to the back of the queue.</li>
        * </ul>
        * @attribute errorAction
        * @type {String}
        * @default UploaderQueue.CONTINUE
        */
        errorAction: {
            value: "continue",
            validator: function (val) {
                return (
                    val === UploaderQueue.CONTINUE ||
                    val === UploaderQueue.STOP ||
                    val === UploaderQueue.RESTART_ASAP ||
                    val === UploaderQueue.RESTART_AFTER
                );
            }
        },

        /**
        * An array indicating what fileFilters should be applied to the file
        * selection dialog. Each element in the array should be a string
        * indicating the Media (MIME) type for the files that should be supported
        * for selection. The Media type strings should be properly formatted
        * or this parameter will be ignored. Examples of valid strings include:
        * "audio/*", "video/*", "application/pdf", etc. More information
        * on valid Media type strings is available here:
        * http://www.iana.org/assignments/media-types/index.html
        * @attribute fileFilters
        * @type {Array}
        * @default []
        */
        fileFilters: {
            value: []
        },

        /**
        * A filtering function that is applied to every file selected by the user.
        * The function receives the `Y.File` object and must return a Boolean value.
        * If a `false` value is returned, the file in question is not added to the
        * list of files to be uploaded.
        * Use this function to put limits on file sizes or check the file names for
        * correct extension, but make sure that a server-side check is also performed,
        * since any client-side restrictions are only advisory and can be circumvented.
        *
        * @attribute fileFilterFunction
        * @type {Function}
        * @default null
        */
        fileFilterFunction: {
            value: null
        },

        /**
        * A String specifying what should be the POST field name for the file
        * content in the upload request.
        *
        * @attribute fileFieldName
        * @type {String}
        * @default Filedata
        */
        fileFieldName: {
            value: "Filedata"
        },

        /**
        * The array of files to be uploaded. All elements in the array
        * must be instances of `Y.File` and be instantiated with an instance
        * of native JavaScript File() class.
        *
        * @attribute fileList
        * @type {Array}
        * @default []
        */
        fileList: {
            value: [],
            getter: "_getFileList",
            setter: "_setFileList"
        },

        /**
        * A Boolean indicating whether multiple file selection is enabled.
        *
        * @attribute multipleFiles
        * @type {Boolean}
        * @default false
        */
        multipleFiles: {
            value: false
        },

        /**
        * An object, keyed by `fileId`, containing sets of key-value pairs
        * that should be passed as POST variables along with each corresponding
        * file. This attribute is only used if no POST variables are specifed
        * in the upload method call.
        *
        * @attribute postVarsPerFile
        * @type {Object}
        * @default {}
        */
        postVarsPerFile: {
            value: {}
        },

        /**
        * The label for the "Select Files" widget. This is the value that replaces the
        * `{selectButtonLabel}` token in the `SELECT_FILES_BUTTON` template.
        *
        * @attribute selectButtonLabel
        * @type {String}
        * @default "Select Files"
        */
        selectButtonLabel: {
            value: "Select Files"
        },

        /**
        * The widget that serves as the "Select Files control for the file uploader
        *
        *
        * @attribute selectFilesButton
        * @type {Node | Widget}
        * @default A standard HTML button with YUI CSS Button skin.
        */
        selectFilesButton : {
            valueFn: function () {
                return Y.Node.create(substitute(Y.UploaderHTML5.SELECT_FILES_BUTTON, {
                    selectButtonLabel: this.get("selectButtonLabel"),
                    tabIndex: this.get("tabIndex")
                }));
            }
        },

        /**
        * The number of files that can be uploaded
        * simultaneously if the automatic queue management
        * is used. This value can be in the range between 2
        * and 5.
        *
        * @attribute simLimit
        * @type {Number}
        * @default 2
        */
        simLimit: {
            value: 2,
            validator: function (val) {
                return (val >= 1 && val <= 5);
            }
        },

        /**
        * The URL to which file upload requested are POSTed. Only used if a different url is not passed to the upload method call.
        *
        * @attribute uploadURL
        * @type {String}
        * @default ""
        */
        uploadURL: {
            value: ""
        },

        /**
        * Additional HTTP headers that should be included
        * in the upload request.
        *
        *
        * @attribute uploadHeaders
        * @type {Object}
        * @default {}
        */
        uploadHeaders: {
            value: {}
        },

        /**
        * A Boolean that specifies whether the file should be
        * uploaded with the appropriate user credentials for the
        * domain.
        *
        * @attribute withCredentials
        * @type {Boolean}
        * @default true
        */
        withCredentials: {
            value: true
        },

        /**
        * The number of times to try re-uploading a file that failed to upload before
        * cancelling its upload.
        *
        * @attribute retryCount
        * @type {Number}
        * @default 3
        */
        retryCount: {
            value: 3
        }
    }
});

Y.UploaderHTML5.Queue = UploaderQueue;



}, '3.16.0', {"requires": ["widget", "node-event-simulate", "file-html5", "uploader-queue"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('swfdetect', function (Y, NAME) {

/**
 * Utility for Flash version detection
 * @module swfdetect
 */

// Shortcuts and helper methods
var version = 0,
    uA = Y.UA,
    lG = Y.Lang,
    sF = "ShockwaveFlash",
    mF, eP, vS, ax6, ax;

function makeInt(n) {
    return parseInt(n, 10);
}

function parseFlashVersion (flashVer) {
    if (lG.isNumber(makeInt(flashVer[0]))) {
        uA.flashMajor = flashVer[0];
    }

    if (lG.isNumber(makeInt(flashVer[1]))) {
        uA.flashMinor = flashVer[1];
    }

    if (lG.isNumber(makeInt(flashVer[2]))) {
        uA.flashRev = flashVer[2];
    }
}

if (uA.gecko || uA.webkit || uA.opera) {
   if ((mF = navigator.mimeTypes['application/x-shockwave-flash'])) {
      if ((eP = mF.enabledPlugin)) {
         vS = eP.description.replace(/\s[rd]/g, '.').replace(/[A-Za-z\s]+/g, '').split('.');
         parseFlashVersion(vS);
      }
   }
}
else if(uA.ie) {
    try
    {
        ax6 = new ActiveXObject(sF + "." + sF + ".6");
        ax6.AllowScriptAccess = "always";
    }
    catch (e)
    {
        if(ax6 !== null)
        {
            version = 6.0;
        }
    }
    if (version === 0) {
    try
    {
        ax = new ActiveXObject(sF + "." + sF);
        vS = ax.GetVariable("$version").replace(/[A-Za-z\s]+/g, '').split(',');
        parseFlashVersion(vS);
    } catch (e2) {}
    }
}

/** Create a calendar view to represent a single or multiple
  * month range of dates, rendered as a grid with date and
  * weekday labels.
  *
  * @class SWFDetect
  * @constructor
  */


Y.SWFDetect = {

    /**
     * Returns the version of either the Flash Player plugin (in Mozilla/WebKit/Opera browsers),
     * or the Flash Player ActiveX control (in IE), as a String of the form "MM.mm.rr", where
     * MM is the major version, mm is the minor version, and rr is the revision.
     * @method getFlashVersion
     */

    getFlashVersion : function () {
        return (String(uA.flashMajor) + "." + String(uA.flashMinor) + "." + String(uA.flashRev));
    },

    /**
     * Checks whether the version of the Flash player installed on the user's machine is greater
     * than or equal to the one specified. If it is, this method returns true; it is false otherwise.
     * @method isFlashVersionAtLeast
     * @return {Boolean} Whether the Flash player version is greater than or equal to the one specified.
     * @param flashMajor {Number} The Major version of the Flash player to compare against.
     * @param flashMinor {Number} The Minor version of the Flash player to compare against.
     * @param flashRev {Number} The Revision version of the Flash player to compare against.
     */
    isFlashVersionAtLeast : function (flashMajor, flashMinor, flashRev) {
        var uaMajor    = makeInt(uA.flashMajor),
            uaMinor    = makeInt(uA.flashMinor),
            uaRev      = makeInt(uA.flashRev);

        flashMajor = makeInt(flashMajor || 0);
        flashMinor = makeInt(flashMinor || 0);
        flashRev   = makeInt(flashRev || 0);

        if (flashMajor === uaMajor) {
            if (flashMinor === uaMinor) {
                return flashRev <= uaRev;
            }
            return flashMinor < uaMinor;
        }
        return flashMajor < uaMajor;
    }
};


}, '3.16.0', {"requires": ["yui-base"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('escape', function (Y, NAME) {

/**
Provides utility methods for escaping strings.

@module escape
@class Escape
@static
@since 3.3.0
**/

var HTML_CHARS = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;'
    },

Escape = {
    // -- Public Static Methods ------------------------------------------------

    /**
    Returns a copy of the specified string with special HTML characters
    escaped. The following characters will be converted to their
    corresponding character entities:

        & < > " ' / `

    This implementation is based on the [OWASP HTML escaping
    recommendations][1]. In addition to the characters in the OWASP
    recommendations, we also escape the <code>&#x60;</code> character, since IE
    interprets it as an attribute delimiter.

    If _string_ is not already a string, it will be coerced to a string.

    [1]: http://www.owasp.org/index.php/XSS_(Cross_Site_Scripting)_Prevention_Cheat_Sheet

    @method html
    @param {String} string String to escape.
    @return {String} Escaped string.
    @static
    **/
    html: function (string) {
        return (string + '').replace(/[&<>"'\/`]/g, Escape._htmlReplacer);
    },

    /**
    Returns a copy of the specified string with special regular expression
    characters escaped, allowing the string to be used safely inside a regex.
    The following characters, and all whitespace characters, are escaped:

        - $ ^ * ( ) + [ ] { } | \ , . ?

    If _string_ is not already a string, it will be coerced to a string.

    @method regex
    @param {String} string String to escape.
    @return {String} Escaped string.
    @static
    **/
    regex: function (string) {
        // There's no need to escape !, =, and : since they only have meaning
        // when they follow a parenthesized ?, as in (?:...), and we already
        // escape parens and question marks.
        return (string + '').replace(/[\-$\^*()+\[\]{}|\\,.?\s]/g, '\\$&');
    },

    // -- Protected Static Methods ---------------------------------------------

    /**
     * Regex replacer for HTML escaping.
     *
     * @method _htmlReplacer
     * @param {String} match Matched character (must exist in HTML_CHARS).
     * @return {String} HTML entity.
     * @static
     * @protected
     */
    _htmlReplacer: function (match) {
        return HTML_CHARS[match];
    }
};

Escape.regexp = Escape.regex;

Y.Escape = Escape;


}, '3.16.0', {"requires": ["yui-base"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('node-pluginhost', function (Y, NAME) {

/**
 * @module node
 * @submodule node-pluginhost
 */

/**
 * Registers plugins to be instantiated at the class level (plugins
 * which should be plugged into every instance of Node by default).
 *
 * @method plug
 * @static
 * @for Node
 * @param {Function | Array} plugin Either the plugin class, an array of plugin classes or an array of objects (with fn and cfg properties defined)
 * @param {Object} config (Optional) If plugin is the plugin class, the configuration for the plugin
 */
Y.Node.plug = function() {
    var args = Y.Array(arguments);
    args.unshift(Y.Node);
    Y.Plugin.Host.plug.apply(Y.Base, args);
    return Y.Node;
};

/**
 * Unregisters any class level plugins which have been registered by the Node
 *
 * @method unplug
 * @static
 *
 * @param {Function | Array} plugin The plugin class, or an array of plugin classes
 */
Y.Node.unplug = function() {
    var args = Y.Array(arguments);
    args.unshift(Y.Node);
    Y.Plugin.Host.unplug.apply(Y.Base, args);
    return Y.Node;
};

Y.mix(Y.Node, Y.Plugin.Host, false, null, 1);

// run PluginHost constructor on cached Node instances
Y.Object.each(Y.Node._instances, function (node) {
    Y.Plugin.Host.apply(node);
});

// allow batching of plug/unplug via NodeList
// doesn't use NodeList.importMethod because we need real Nodes (not tmpNode)
/**
 * Adds a plugin to each node in the NodeList.
 * This will instantiate the plugin and attach it to the configured namespace on each node
 * @method plug
 * @for NodeList
 * @param P {Function | Object |Array} Accepts the plugin class, or an
 * object with a "fn" property specifying the plugin class and
 * a "cfg" property specifying the configuration for the Plugin.
 * <p>
 * Additionally an Array can also be passed in, with the above function or
 * object values, allowing the user to add multiple plugins in a single call.
 * </p>
 * @param config (Optional) If the first argument is the plugin class, the second argument
 * can be the configuration for the plugin.
 * @chainable
 */
Y.NodeList.prototype.plug = function() {
    var args = arguments;
    Y.NodeList.each(this, function(node) {
        Y.Node.prototype.plug.apply(Y.one(node), args);
    });
    return this;
};

/**
 * Removes a plugin from all nodes in the NodeList. This will destroy the
 * plugin instance and delete the namespace each node.
 * @method unplug
 * @for NodeList
 * @param {String | Function} plugin The namespace of the plugin, or the plugin class with the static NS namespace property defined. If not provided,
 * all registered plugins are unplugged.
 * @chainable
 */
Y.NodeList.prototype.unplug = function() {
    var args = arguments;
    Y.NodeList.each(this, function(node) {
        Y.Node.prototype.unplug.apply(Y.one(node), args);
    });
    return this;
};


}, '3.16.0', {"requires": ["node-base", "pluginhost"]});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('uploader-flash', function (Y, NAME) {

/**
* This module provides a UI for file selection and multiple file upload capability using
* Flash as a transport engine.
* The supported features include: automatic upload queue management, upload progress
* tracking, file filtering, server response retrieval and error reporting.
*
* @module uploader-flash
* @deprecated
*/

// Shorthands for external modules
var substitute            = Y.Lang.sub,
    UploaderQueue         = Y.Uploader.Queue;


/**
 * Embed a Flash applications in a standard manner and communicate with it
 * via External Interface.
 * @module swf
 */

    var Event = Y.Event,
        SWFDetect = Y.SWFDetect,
        Lang = Y.Lang,
        uA = Y.UA,
        Node = Y.Node,
        Escape = Y.Escape,

        // private
        FLASH_CID = "clsid:d27cdb6e-ae6d-11cf-96b8-444553540000",
        FLASH_TYPE = "application/x-shockwave-flash",
        FLASH_VER = "10.0.22",
        EXPRESS_INSTALL_URL = "http://fpdownload.macromedia.com/pub/flashplayer/update/current/swf/autoUpdater.swf?" + Math.random(),
        EVENT_HANDLER = "SWF.eventHandler",
        possibleAttributes = {align:"", allowFullScreen:"", allowNetworking:"", allowScriptAccess:"", base:"", bgcolor:"", loop:"", menu:"", name:"", play: "", quality:"", salign:"", scale:"", tabindex:"", wmode:""};

        /**
         * The SWF utility is a tool for embedding Flash applications in HTML pages.
         * @module swf
         * @title SWF Utility
         * @requires event-custom, node, swfdetect
         */

        /**
         * Creates the SWF instance and keeps the configuration data
         *
         * @class SWF
         * @uses Y.Event.Target
         * @constructor
         * @param {String|HTMLElement} id The id of the element, or the element itself that the SWF will be inserted into.
         *        The width and height of the SWF will be set to the width and height of this container element.
         * @param {String} swfURL The URL of the SWF to be embedded into the page.
         * @param {Object} p_oAttributes (optional) Configuration parameters for the Flash application and values for Flashvars
         *        to be passed to the SWF. The p_oAttributes object allows the following additional properties:
         *        <dl>
         *          <dt>version : String</dt>
         *          <dd>The minimum version of Flash required on the user's machine.</dd>
         *          <dt>fixedAttributes : Object</dt>
         *          <dd>An object literal containing one or more of the following String keys and their values: <code>align,
         *              allowFullScreen, allowNetworking, allowScriptAccess, base, bgcolor, menu, name, quality, salign, scale,
         *              tabindex, wmode.</code> event from the thumb</dd>
         *        </dl>
         */

function SWF (p_oElement /*:String*/, swfURL /*:String*/, p_oAttributes /*:Object*/ ) {

    this._id = Y.guid("yuiswf");


    var _id = this._id;
    var oElement = Node.one(p_oElement);

    var p_oAttributes = p_oAttributes || {};

    var flashVersion = p_oAttributes.version || FLASH_VER;

    var flashVersionSplit = (flashVersion + '').split(".");
    var isFlashVersionRight = SWFDetect.isFlashVersionAtLeast(parseInt(flashVersionSplit[0], 10), parseInt(flashVersionSplit[1], 10), parseInt(flashVersionSplit[2], 10));
    var canExpressInstall = (SWFDetect.isFlashVersionAtLeast(8,0,0));
    var shouldExpressInstall = canExpressInstall && !isFlashVersionRight && p_oAttributes.useExpressInstall;
    var flashURL = (shouldExpressInstall)?EXPRESS_INSTALL_URL:swfURL;
    var objstring = '<object ';
    var w, h;
    var flashvarstring = "yId=" + Y.id + "&YUISwfId=" + _id + "&YUIBridgeCallback=" + EVENT_HANDLER + "&allowedDomain=" + document.location.hostname;

    Y.SWF._instances[_id] = this;
    if (oElement && (isFlashVersionRight || shouldExpressInstall) && flashURL) {
        objstring += 'id="' + _id + '" ';
        if (uA.ie) {
            objstring += 'classid="' + FLASH_CID + '" ';
        } else {
            objstring += 'type="' + FLASH_TYPE + '" data="' + Escape.html(flashURL) + '" ';
        }

        w = "100%";
        h = "100%";

        objstring += 'width="' + w + '" height="' + h + '">';

        if (uA.ie) {
            objstring += '<param name="movie" value="' + Escape.html(flashURL) + '"/>';
        }

        for (var attribute in p_oAttributes.fixedAttributes) {
            if (possibleAttributes.hasOwnProperty(attribute)) {
                objstring += '<param name="' + Escape.html(attribute) + '" value="' + Escape.html(p_oAttributes.fixedAttributes[attribute]) + '"/>';
            }
        }

        for (var flashvar in p_oAttributes.flashVars) {
            var fvar = p_oAttributes.flashVars[flashvar];
            if (Lang.isString(fvar)) {
                flashvarstring += "&" + Escape.html(flashvar) + "=" + Escape.html(encodeURIComponent(fvar));
            }
        }

        if (flashvarstring) {
            objstring += '<param name="flashVars" value="' + flashvarstring + '"/>';
        }

        objstring += "</object>";
        //using innerHTML as setHTML/setContent causes some issues with ExternalInterface for IE versions of the player
        oElement.set("innerHTML", objstring);

        this._swf = Node.one("#" + _id);
    } else {
        /**
         * Fired when the Flash player version on the user's machine is
         * below the required value.
         *
         * @event wrongflashversion
         */
        var event = {};
        event.type = "wrongflashversion";
        this.publish("wrongflashversion", {fireOnce:true});
        this.fire("wrongflashversion", event);
    }
}

/**
 * @private
 * The static collection of all instances of the SWFs on the page.
 * @property _instances
 * @type Object
 */

SWF._instances = SWF._instances || {};

/**
 * @private
 * Handles an event coming from within the SWF and delegate it
 * to a specific instance of SWF.
 * @method eventHandler
 * @param swfid {String} the id of the SWF dispatching the event
 * @param event {Object} the event being transmitted.
 */
SWF.eventHandler = function (swfid, event) {
    SWF._instances[swfid]._eventHandler(event);
};

SWF.prototype = {
    /**
     * @private
     * Propagates a specific event from Flash to JS.
     * @method _eventHandler
     * @param event {Object} The event to be propagated from Flash.
     */
    _eventHandler: function(event) {
        if (event.type === "swfReady") {
            this.publish("swfReady", {fireOnce:true});
            this.fire("swfReady", event);
        } else if(event.type === "log") {
        } else {
            this.fire(event.type, event);
        }
    },

        /**
     * Calls a specific function exposed by the SWF's
     * ExternalInterface.
     * @method callSWF
     * @param func {String} the name of the function to call
     * @param args {Array} the set of arguments to pass to the function.
     */

    callSWF: function (func, args)
    {
    if (!args) {
          args= [];
    }
        if (this._swf._node[func]) {
        return(this._swf._node[func].apply(this._swf._node, args));
        } else {
        return null;
        }
    },

    /**
     * Public accessor to the unique name of the SWF instance.
     *
     * @method toString
     * @return {String} Unique name of the SWF instance.
     */
    toString: function()
    {
        return "SWF " + this._id;
    }
};

Y.augment(SWF, Y.EventTarget);

Y.SWF = SWF;
    /**
     * The FileFlash class provides a wrapper for a file pointer stored in Flash. The File wrapper
     * also implements the mechanics for uploading a file and tracking its progress.
     * @module file-flash
     */
    /**
     * The class provides a wrapper for a file pointer in Flash.
     * @class FileFlash
     * @extends Base
     * @constructor
     * @param {Object} config Configuration object.
     */

    var FileFlash = function(o) {
        FileFlash.superclass.constructor.apply(this, arguments);
    };

    Y.extend(FileFlash, Y.Base, {

       /**
        * Construction logic executed during FileFlash instantiation.
        *
        * @method initializer
        * @protected
        */
        initializer : function (cfg) {
            if (!this.get("id")) {
                this._set("id", Y.guid("file"));
            }
        },

       /**
        * Handler of events dispatched by the Flash player.
        *
        * @method _swfEventHandler
        * @param {Event} event The event object received from the Flash player.
        * @protected
        */
        _swfEventHandler: function (event) {
          if (event.id === this.get("id")) {
          switch (event.type) {
            /**
             * Signals that this file's upload has started.
             *
             * @event uploadstart
             * @param event {Event} The event object for the `uploadstart` with the
             *                      following payload:
             *  <dl>
             *      <dt>uploader</dt>
             *          <dd>The Y.SWF instance of Flash uploader that's handling the upload.</dd>
             *  </dl>
             */
            case "uploadstart":
                 this.fire("uploadstart", {uploader: this.get("uploader")});
                 break;
            case "uploadprogress":

                  /**
                   * Signals that progress has been made on the upload of this file.
                   *
                   * @event uploadprogress
                   * @param event {Event} The event object for the `uploadprogress` with the
                   *                      following payload:
                   *  <dl>
                   *      <dt>originEvent</dt>
                   *          <dd>The original event fired by the Flash uploader instance.</dd>
                   *      <dt>bytesLoaded</dt>
                   *          <dd>The number of bytes of the file that has been uploaded.</dd>
                   *      <dt>bytesTotal</dt>
                   *          <dd>The total number of bytes in the file (the file size)</dd>
                   *      <dt>percentLoaded</dt>
                   *          <dd>The fraction of the file that has been uploaded, out of 100.</dd>
                   *  </dl>
                   */
                 this.fire("uploadprogress", {originEvent: event,
                                              bytesLoaded: event.bytesLoaded,
                                              bytesTotal: event.bytesTotal,
                                              percentLoaded: Math.min(100, Math.round(10000*event.bytesLoaded/event.bytesTotal)/100)
                                             });
                 this._set("bytesUploaded", event.bytesLoaded);
                 break;
            case "uploadcomplete":

                  /**
                   * Signals that this file's upload has completed, but data has not yet been received from the server.
                   *
                   * @event uploadfinished
                   * @param event {Event} The event object for the `uploadfinished` with the
                   *                      following payload:
                   *  <dl>
                   *      <dt>originEvent</dt>
                   *          <dd>The original event fired by the Flash player instance.</dd>
                   *  </dl>
                   */
                 this.fire("uploadfinished", {originEvent: event});
                 break;
            case "uploadcompletedata":
                /**
                 * Signals that this file's upload has completed and data has been received from the server.
                 *
                 * @event uploadcomplete
                 * @param event {Event} The event object for the `uploadcomplete` with the
                 *                      following payload:
                 *  <dl>
                 *      <dt>originEvent</dt>
                 *          <dd>The original event fired by the Flash player instance.</dd>
                 *      <dt>data</dt>
                 *          <dd>The data returned by the server.</dd>
                 *  </dl>
                 */
                 this.fire("uploadcomplete", {originEvent: event,
                                              data: event.data});
                 break;
            case "uploadcancel":

                /**
                 * Signals that this file's upload has been cancelled.
                 *
                 * @event uploadcancel
                 * @param event {Event} The event object for the `uploadcancel` with the
                 *                      following payload:
                 *  <dl>
                 *      <dt>originEvent</dt>
                 *          <dd>The original event fired by the Flash player instance.</dd>
                 *  </dl>
                 */
                 this.fire("uploadcancel", {originEvent: event});
                 break;
            case "uploaderror":

                /**
                 * Signals that this file's upload has encountered an error.
                 *
                 * @event uploaderror
                 * @param event {Event} The event object for the `uploaderror` with the
                 *                      following payload:
                 *  <dl>
                 *      <dt>originEvent</dt>
                 *          <dd>The original event fired by the Flash player instance.</dd>
                 *      <dt>status</dt>
                 *          <dd>The status code reported by the Flash Player. If it's an HTTP error,
                 *                then this corresponds to the HTTP status code received by the uploader.</dd>
                 *      <dt>statusText</dt>
                 *          <dd>The text of the error event reported by the Flash Player.</dd>
                 *      <dt>source</dt>
                 *          <dd>Either "http" (if it's an HTTP error), or "io" (if it's a network transmission
                 *              error.)</dd>
                 *  </dl>
                 */
                 this.fire("uploaderror", {originEvent: event, status: event.status, statusText: event.message, source: event.source});

          }
        }
        },

       /**
        * Starts the upload of a specific file.
        *
        * @method startUpload
        * @param url {String} The URL to upload the file to.
        * @param parameters {Object} (optional) A set of key-value pairs to send as variables along with the file upload HTTP request.
        * @param fileFieldName {String} (optional) The name of the POST variable that should contain the uploaded file ('Filedata' by default)
        */
        startUpload: function(url, parameters, fileFieldName) {

        if (this.get("uploader")) {

            var myUploader = this.get("uploader"),
                fileField = fileFieldName || "Filedata",
                id = this.get("id"),
                params = parameters || null;

            this._set("bytesUploaded", 0);

            myUploader.on("uploadstart", this._swfEventHandler, this);
            myUploader.on("uploadprogress", this._swfEventHandler, this);
            myUploader.on("uploadcomplete", this._swfEventHandler, this);
            myUploader.on("uploadcompletedata", this._swfEventHandler, this);
            myUploader.on("uploaderror", this._swfEventHandler, this);

            myUploader.callSWF("upload", [id, url, params, fileField]);
         }

        },

       /**
        * Cancels the upload of a specific file, if currently in progress.
        *
        * @method cancelUpload
        */
        cancelUpload: function () {
         if (this.get("uploader")) {
           this.get("uploader").callSWF("cancel", [this.get("id")]);
           this.fire("uploadcancel");
         }
        }

    }, {

       /**
        * The identity of the class.
        *
        * @property NAME
        * @type String
        * @default 'file'
        * @readOnly
        * @protected
        * @static
        */
        NAME: 'file',

       /**
        * The type of transport.
        *
        * @property TYPE
        * @type String
        * @default 'flash'
        * @readOnly
        * @protected
        * @static
        */
        TYPE: "flash",

       /**
        * Static property used to define the default attribute configuration of
        * the File.
        *
        * @property ATTRS
        * @type {Object}
        * @protected
        * @static
        */
        ATTRS: {

       /**
        * A String containing the unique id of the file wrapped by the FileFlash instance.
        * The id is supplied by the Flash player uploader.
        *
        * @attribute id
        * @type {String}
        * @initOnly
        */
        id: {
            writeOnce: "initOnly",
            value: null
        },

       /**
        * The size of the file wrapped by FileFlash. This value is supplied by the Flash player uploader.
        *
        * @attribute size
        * @type {Number}
        * @initOnly
        */
        size: {
            writeOnce: "initOnly",
            value: 0
        },

       /**
        * The name of the file wrapped by FileFlash. This value is supplied by the Flash player uploader.
        *
        * @attribute name
        * @type {String}
        * @initOnly
        */
        name: {
            writeOnce: "initOnly",
            value: null
        },

       /**
        * The date that the file wrapped by FileFlash was created on. This value is supplied by the Flash player uploader.
        *
        * @attribute dateCreated
        * @type {Date}
        * @initOnly
        */
        dateCreated: {
            writeOnce: "initOnly",
            value: null
        },

       /**
        * The date that the file wrapped by FileFlash was last modified on. This value is supplied by the Flash player uploader.
        *
        * @attribute dateModified
        * @type {Date}
        * @initOnly
        */
        dateModified: {
            writeOnce: "initOnly",
            value: null
        },

       /**
        * The number of bytes of the file that has been uploaded to the server. This value is
        * non-zero only while a file is being uploaded.
        *
        * @attribute bytesUploaded
        * @type {Date}
        * @readOnly
        */
        bytesUploaded: {
            readOnly: true,
            value: 0
        },

       /**
        * The type of the file wrapped by FileFlash. This value is provided by the Flash player
        * uploader.
        *
        * @attribute type
        * @type {String}
        * @initOnly
        */
        type: {
            writeOnce: "initOnly",
            value: null
        },

       /**
        * The instance of Y.SWF wrapping the Flash player uploader associated with this file.
        *
        * @attribute uploder
        * @type {SWF}
        * @initOnly
        */
        uploader: {
            writeOnce: "initOnly",
            value: null
        }
        }
    });

    Y.FileFlash = FileFlash;
/**
* This module provides a UI for file selection and multiple file upload capability
* using Flash as a transport engine.
* @class UploaderFlash
* @extends Widget
* @param {Object} config Configuration object.
* @constructor
* @deprecated
*/

function UploaderFlash() {
    UploaderFlash.superclass.constructor.apply ( this, arguments );
}



Y.UploaderFlash = Y.extend(UploaderFlash, Y.Widget, {

    /**
    * Stored value of the current button state (based on
    * mouse events dispatched by the Flash player)
    * @property _buttonState
    * @type {String}
    * @protected
    */
    _buttonState: "up",

    /**
    * Stored value of the current button focus state (based
    * on keyboard and mouse events).
    * @property _buttonFocus
    * @type {Boolean}
    * @protected
    */
    _buttonFocus: false,

    /**
    * Stored value of the unique id for the container that holds the
    * Flash uploader.
    *
    * @property _swfContainerId
    * @type {String}
    * @protected
    */
    _swfContainerId: null,

    /**
    * Stored reference to the instance of SWF used to host the
    * Flash uploader.
    *
    * @property _swfReference
    * @type {SWF}
    * @protected
    */
    _swfReference: null,

    /**
    * Stored reference to the instance of Uploader.Queue used to manage
    * the upload process. This is a read-only property that only exists
    * during an active upload process. Only one queue can be active at
    * a time; if an upload start is attempted while a queue is active,
    * it will be ignored.
    *
    * @property queue
    * @type {Uploader.Queue}
    */
    queue: null,

    /**
    * Stored event bindings for keyboard navigation to and from the uploader.
    *
    * @property _tabElementBindings
    * @type {Object}
    * @protected
    */
    _tabElementBindings: null,


    /**
    * Construction logic executed during UploaderFlash instantiation.
    *
    * @method initializer
    * @protected
    */
    initializer : function () {

        // Assign protected variable values
        this._swfContainerId = Y.guid("uploader");
        this._swfReference = null;
        this.queue = null;
        this._buttonState = "up";
        this._buttonFocus = null;
        this._tabElementBindings = null;
        this._fileList = [];

        // Publish available events

        /**
        * Signals that files have been selected.
        *
        * @event fileselect
        * @param event {Event} The event object for the `fileselect` with the
        *                      following payload:
        *  <dl>
        *      <dt>fileList</dt>
        *          <dd>An `Array` of files selected by the user, encapsulated
        *              in Y.FileFlash objects.</dd>
        *  </dl>
        */
        this.publish("fileselect");

        /**
        * Signals that an upload of multiple files has been started.
        *
        * @event uploadstart
        * @param event {Event} The event object for the `uploadstart`.
        */
        this.publish("uploadstart");

        /**
        * Signals that an upload of a specific file has started.
        *
        * @event fileuploadstart
        * @param event {Event} The event object for the `fileuploadstart` with the
        *                      following payload:
        *  <dl>
        *      <dt>file</dt>
        *          <dd>A reference to the Y.File that dispatched the event.</dd>
        *      <dt>originEvent</dt>
        *          <dd>The original event dispatched by Y.File.</dd>
        *  </dl>
        */
        this.publish("fileuploadstart");

        /**
        * Reports on upload progress of a specific file.
        *
        * @event uploadprogress
        * @param event {Event} The event object for the `uploadprogress` with the
        *                      following payload:
        *  <dl>
        *      <dt>bytesLoaded</dt>
        *          <dd>The number of bytes of the file that has been uploaded</dd>
        *      <dt>bytesTotal</dt>
        *          <dd>The total number of bytes in the file</dd>
        *      <dt>percentLoaded</dt>
        *          <dd>The fraction of the file that has been uploaded, out of 100</dd>
        *      <dt>originEvent</dt>
        *          <dd>The original event dispatched by the SWF uploader</dd>
        *  </dl>
        */
        this.publish("uploadprogress");

        /**
        * Reports on the total upload progress of the file list.
        *
        * @event totaluploadprogress
        * @param event {Event} The event object for the `totaluploadprogress` with the
        *                      following payload:
        *  <dl>
        *      <dt>bytesLoaded</dt>
        *          <dd>The number of bytes of the file list that has been uploaded</dd>
        *      <dt>bytesTotal</dt>
        *          <dd>The total number of bytes in the file list</dd>
        *      <dt>percentLoaded</dt>
        *          <dd>The fraction of the file list that has been uploaded, out of 100</dd>
        *  </dl>
        */
        this.publish("totaluploadprogress");

        /**
        * Signals that a single file upload has been completed.
        *
        * @event uploadcomplete
        * @param event {Event} The event object for the `uploadcomplete` with the
        *                      following payload:
        *  <dl>
        *      <dt>file</dt>
        *          <dd>The pointer to the instance of `Y.File` whose upload has been completed.</dd>
        *      <dt>originEvent</dt>
        *          <dd>The original event fired by the SWF Uploader</dd>
        *      <dt>data</dt>
        *          <dd>Data returned by the server.</dd>
        *  </dl>
        */
        this.publish("uploadcomplete");

        /**
        * Signals that the upload process of the entire file list has been completed.
        *
        * @event alluploadscomplete
        * @param event {Event} The event object for the `alluploadscomplete`.
        */
        this.publish("alluploadscomplete");

        /**
        * Signals that a error has occurred in a specific file's upload process.
        *
        * @event uploaderror
        * @param event {Event} The event object for the `uploaderror` with the
        *                      following payload:
        *  <dl>
        *      <dt>originEvent</dt>
        *          <dd>The original error event fired by the SWF Uploader. </dd>
        *      <dt>file</dt>
        *          <dd>The pointer at the instance of Y.FileFlash that returned the error.</dd>
        *      <dt>source</dt>
        *          <dd>The source of the upload error, either "io" or "http"</dd>
        *      <dt>message</dt>
        *          <dd>The message that accompanied the error. Corresponds to the text of
        *              the error in cases where source is "io", and to the HTTP status for
                                     cases where source is "http".</dd>
        *  </dl>
        */
        this.publish("uploaderror");

        /**
        * Signals that a mouse has begun hovering over the `Select Files` button.
        *
        * @event mouseenter
        * @param event {Event} The event object for the `mouseenter` event.
        */
        this.publish("mouseenter");

        /**
        * Signals that a mouse has stopped hovering over the `Select Files` button.
        *
        * @event mouseleave
        * @param event {Event} The event object for the `mouseleave` event.
        */
        this.publish("mouseleave");

        /**
        * Signals that a mouse button has been pressed over the `Select Files` button.
        *
        * @event mousedown
        * @param event {Event} The event object for the `mousedown` event.
        */
        this.publish("mousedown");

        /**
        * Signals that a mouse button has been released over the `Select Files` button.
        *
        * @event mouseup
        * @param event {Event} The event object for the `mouseup` event.
        */
        this.publish("mouseup");

        /**
        * Signals that a mouse has been clicked over the `Select Files` button.
        *
        * @event click
        * @param event {Event} The event object for the `click` event.
        */
        this.publish("click");
    },

    /**
    * Creates the DOM structure for the UploaderFlash.
    * UploaderFlash's DOM structure consists of two layers: the base "Select Files"
    * button that can be replaced by the developer's widget of choice; and a transparent
    * Flash overlay positoned above the button that captures all input events.
    * The `position` style attribute of the `boundingBox` of the `Uploader` widget
    * is forced to be `relative`, in order to accommodate the Flash player overlay
    * (which is `position`ed `absolute`ly).
    *
    * @method renderUI
    * @protected
    */
    renderUI : function () {
        var boundingBox = this.get("boundingBox"),
            contentBox = this.get('contentBox'),
            selFilesButton = this.get("selectFilesButton"),
            flashContainer = Y.Node.create(substitute(UploaderFlash.FLASH_CONTAINER, {
                swfContainerId: this._swfContainerId
            })),
            params = {
                version: "10.0.45",
                fixedAttributes: {
                    wmode: "transparent",
                    allowScriptAccess:"always",
                    allowNetworking:"all",
                    scale: "noscale"
                }
            };

        boundingBox.setStyle("position", "relative");
        selFilesButton.setStyles({width: "100%", height: "100%"});
        contentBox.append(selFilesButton);
        contentBox.append(flashContainer);

        this._swfReference = new Y.SWF(flashContainer, this.get("swfURL"), params);
    },

    /**
    * Binds handlers to the UploaderFlash UI events and propagates attribute
    * values to the Flash player.
    * The propagation of initial values is set to occur once the Flash player
    * instance is ready (as indicated by the `swfReady` event.)
    *
    * @method bindUI
    * @protected
    */
    bindUI : function () {

        this._swfReference.on("swfReady", function () {
            this._setMultipleFiles();
            this._setFileFilters();
            this._triggerEnabled();
            this._attachTabElements();
            this.after("multipleFilesChange", this._setMultipleFiles, this);
            this.after("fileFiltersChange", this._setFileFilters, this);
            this.after("enabledChange", this._triggerEnabled, this);
            this.after("tabElementsChange", this._attachTabElements);
        }, this);

        this._swfReference.on("fileselect", this._updateFileList, this);



        // this._swfReference.on("trace", function (ev) {console.log(ev.message);});

        this._swfReference.on("mouseenter", function () {
            this.fire("mouseenter");
            this._setButtonClass("hover", true);
            if (this._buttonState === "down") {
                this._setButtonClass("active", true);
            }
        }, this);

        this._swfReference.on("mouseleave", function () {
            this.fire("mouseleave");
            this._setButtonClass("hover", false);
            this._setButtonClass("active", false);
        }, this);

        this._swfReference.on("mousedown", function () {
            this.fire("mousedown");
            this._buttonState = "down";
            this._setButtonClass("active", true);
        }, this);

        this._swfReference.on("mouseup", function () {
            this.fire("mouseup");
            this._buttonState = "up";
            this._setButtonClass("active", false);
        }, this);

        this._swfReference.on("click", function () {
            this.fire("click");
            this._buttonFocus = true;
            this._setButtonClass("focus", true);
            Y.one("body").focus();
            this._swfReference._swf.focus();
        }, this);
    },

    /**
    * Attaches keyboard bindings to enabling tabbing to and from the instance of the Flash
    * player in the Uploader widget. If the previous and next elements are specified, the
    * keyboard bindings enable the user to tab from the `tabElements["from"]` node to the
    * Flash-powered "Select Files" button, and to the `tabElements["to"]` node.
    *
    * @method _attachTabElements
    * @protected
    * @param ev {Event} Optional event payload if called as a `tabElementsChange` handler.
    */
    _attachTabElements : function () {
        if (this.get("tabElements") !== null && this.get("tabElements").from !== null && this.get("tabElements").to !== null) {

            if (this._tabElementBindings !== null) {
                this._tabElementBindings.from.detach();
                this._tabElementBindings.to.detach();
                this._tabElementBindings.tabback.detach();
                this._tabElementBindings.tabforward.detach();
                this._tabElementBindings.focus.detach();
                this._tabElementBindings.blur.detach();
            }
            else {
                this._tabElementBindings = {};
            }

            var fromElement = Y.one(this.get("tabElements").from),
                toElement = Y.one(this.get("tabElements").to);


            this._tabElementBindings.from = fromElement.on("keydown", function (ev) {
                if (ev.keyCode === 9 && !ev.shiftKey) {
                    ev.preventDefault();
                    this._swfReference._swf.setAttribute("tabindex", 0);
                    this._swfReference._swf.setAttribute("role", "button");
                    this._swfReference._swf.setAttribute("aria-label", this.get("selectButtonLabel"));
                    this._swfReference._swf.focus();
                }
            }, this);

            this._tabElementBindings.to = toElement.on("keydown", function (ev) {
                if (ev.keyCode === 9 && ev.shiftKey) {
                    ev.preventDefault();
                    this._swfReference._swf.setAttribute("tabindex", 0);
                    this._swfReference._swf.setAttribute("role", "button");
                    this._swfReference._swf.setAttribute("aria-label", this.get("selectButtonLabel"));
                    this._swfReference._swf.focus();
                }
            }, this);

            this._tabElementBindings.tabback = this._swfReference.on("tabback", function () {
                this._swfReference._swf.blur();
                setTimeout(function () {
                    fromElement.focus();
                }, 30);
            }, this);

            this._tabElementBindings.tabforward = this._swfReference.on("tabforward", function () {
                this._swfReference._swf.blur();
                setTimeout(function () {
                    toElement.focus();
                }, 30);
            }, this);

            this._tabElementBindings.focus = this._swfReference._swf.on("focus", function () {
                this._buttonFocus = true;
                this._setButtonClass("focus", true);
            }, this);

            this._tabElementBindings.blur = this._swfReference._swf.on("blur", function () {
                this._buttonFocus = false;
                this._setButtonClass("focus", false);
            }, this);
        }
        else if (this._tabElementBindings !== null) {
            this._tabElementBindings.from.detach();
            this._tabElementBindings.to.detach();
            this._tabElementBindings.tabback.detach();
            this._tabElementBindings.tabforward.detach();
            this._tabElementBindings.focus.detach();
            this._tabElementBindings.blur.detach();
        }
    },


    /**
    * Adds or removes a specified state CSS class to the underlying uploader button.
    *
    * @method _setButtonClass
    * @protected
    * @param state {String} The name of the state enumerated in `buttonClassNames` attribute
    * from which to derive the needed class name.
    * @param add {Boolean} A Boolean indicating whether to add or remove the class.
    */
    _setButtonClass : function (state, add) {
        if (add) {
            this.get("selectFilesButton").addClass(this.get("buttonClassNames")[state]);
        }
        else {
            this.get("selectFilesButton").removeClass(this.get("buttonClassNames")[state]);
        }
    },


    /**
    * Syncs the state of the `fileFilters` attribute between the instance of UploaderFlash
    * and the Flash player.
    *
    * @method _setFileFilters
    * @private
    */
    _setFileFilters : function () {
        if (this._swfReference && this.get("fileFilters").length > 0) {
            this._swfReference.callSWF("setFileFilters", [this.get("fileFilters")]);
        }
    },



    /**
    * Syncs the state of the `multipleFiles` attribute between this class
    * and the Flash uploader.
    *
    * @method _setMultipleFiles
    * @private
    */
    _setMultipleFiles : function () {
        if (this._swfReference) {
            this._swfReference.callSWF("setAllowMultipleFiles", [this.get("multipleFiles")]);
        }
    },

    /**
    * Syncs the state of the `enabled` attribute between this class
    * and the Flash uploader.
    *
    * @method _triggerEnabled
    * @private
    */
    _triggerEnabled : function () {
        if (this.get("enabled")) {
            this._swfReference.callSWF("enable");
            this._swfReference._swf.setAttribute("aria-disabled", "false");
            this._setButtonClass("disabled", false);
        }
        else {
            this._swfReference.callSWF("disable");
            this._swfReference._swf.setAttribute("aria-disabled", "true");
            this._setButtonClass("disabled", true);
        }
    },

    /**
    * Getter for the `fileList` attribute
    *
    * @method _getFileList
    * @private
    */
    _getFileList : function () {
        return this._fileList.concat();
    },

    /**
    * Setter for the `fileList` attribute
    *
    * @method _setFileList
    * @private
    */
    _setFileList : function (val) {
        this._fileList = val.concat();
        return this._fileList.concat();
    },

    /**
    * Adjusts the content of the `fileList` based on the results of file selection
    * and the `appendNewFiles` attribute. If the `appendNewFiles` attribute is true,
    * then selected files are appended to the existing list; otherwise, the list is
    * cleared and populated with the newly selected files.
    *
    * @method _updateFileList
    * @param ev {Event} The file selection event received from the uploader.
    * @private
    */
    _updateFileList : function (ev) {

        Y.one("body").focus();
        this._swfReference._swf.focus();


        var newfiles = ev.fileList,
            fileConfObjects = [],
            parsedFiles = [],
            swfRef = this._swfReference,
            filterFunc = this.get("fileFilterFunction"),
            oldfiles;

        Y.each(newfiles, function (value) {
            var newFileConf = {};
            newFileConf.id = value.fileId;
            newFileConf.name = value.fileReference.name;
            newFileConf.size = value.fileReference.size;
            newFileConf.type = value.fileReference.type;
            newFileConf.dateCreated = value.fileReference.creationDate;
            newFileConf.dateModified = value.fileReference.modificationDate;
            newFileConf.uploader = swfRef;

            fileConfObjects.push(newFileConf);
        });

         if (filterFunc) {
            Y.each(fileConfObjects, function (value) {
                var newfile = new Y.FileFlash(value);
                if (filterFunc(newfile)) {
                    parsedFiles.push(newfile);
                }
            });
         }
         else {
            Y.each(fileConfObjects, function (value) {
                parsedFiles.push(new Y.FileFlash(value));
            });
         }

        if (parsedFiles.length > 0) {
            oldfiles = this.get("fileList");

            this.set("fileList",
                             this.get("appendNewFiles") ? oldfiles.concat(parsedFiles) : parsedFiles );

            this.fire("fileselect", { fileList: parsedFiles });
        }

    },



    /**
    * Handles and retransmits events fired by `Y.FileFlash` and `Y.Uploader.Queue`.
    *
    * @method _uploadEventHandler
    * @param event The event dispatched during the upload process.
    * @private
    */
    _uploadEventHandler : function (event) {

        switch (event.type) {
            case "file:uploadstart":
                 this.fire("fileuploadstart", event);
                break;
            case "file:uploadprogress":
                 this.fire("uploadprogress", event);
                break;
            case "uploaderqueue:totaluploadprogress":
                 this.fire("totaluploadprogress", event);
                break;
            case "file:uploadcomplete":
                 this.fire("uploadcomplete", event);
                break;
            case "uploaderqueue:alluploadscomplete":
                 this.queue = null;
                 this.fire("alluploadscomplete", event);
                break;
            case "file:uploaderror": //overflow intentional
            case "uploaderqueue:uploaderror":
                 this.fire("uploaderror", event);
                break;
            case "file:uploadcancel": // overflow intentional
            case "uploaderqueue:uploadcancel":
                 this.fire("uploadcancel", event);
            break;
        }

    },



    /**
    * Starts the upload of a specific file.
    *
    * @method upload
    * @param file {FileFlash} Reference to the instance of the file to be uploaded.
    * @param url {String} The URL to upload the file to.
    * @param [postVars] {Object} A set of key-value pairs to send as variables along with the file upload HTTP request.
    *                          If not specified, the values from the attribute `postVarsPerFile` are used instead.
    */
    upload : function (file, url, postvars) {

        var uploadURL = url || this.get("uploadURL"),
            postVars = postvars || this.get("postVarsPerFile"),
            fileId = file.get("id");

            postVars = postVars.hasOwnProperty(fileId) ? postVars[fileId] : postVars;

        if (file instanceof Y.FileFlash) {

            file.on("uploadstart", this._uploadEventHandler, this);
            file.on("uploadprogress", this._uploadEventHandler, this);
            file.on("uploadcomplete", this._uploadEventHandler, this);
            file.on("uploaderror", this._uploadEventHandler, this);
            file.on("uploadcancel", this._uploadEventHandler, this);

            file.startUpload(uploadURL, postVars, this.get("fileFieldName"));
        }
    },

    /**
    * Starts the upload of all files on the file list, using an automated queue.
    *
    * @method uploadAll
    * @param url {String} The URL to upload the files to.
    * @param [postVars] {Object} A set of key-value pairs to send as variables along with the file upload HTTP request.
    *                          If not specified, the values from the attribute `postVarsPerFile` are used instead.
    */
    uploadAll : function (url, postvars) {
        this.uploadThese(this.get("fileList"), url, postvars);
    },

    /**
    * Starts the upload of the files specified in the first argument, using an automated queue.
    *
    * @method uploadThese
    * @param files {Array} The list of files to upload.
    * @param url {String} The URL to upload the files to.
    * @param [postVars] {Object} A set of key-value pairs to send as variables along with the file upload HTTP request.
    *                          If not specified, the values from the attribute `postVarsPerFile` are used instead.
    */
    uploadThese : function (files, url, postvars) {
        if (!this.queue) {
            var uploadURL = url || this.get("uploadURL"),
                postVars = postvars || this.get("postVarsPerFile");

            this.queue = new UploaderQueue({
                simUploads: this.get("simLimit"),
                errorAction: this.get("errorAction"),
                fileFieldName: this.get("fileFieldName"),
                fileList: files,
                uploadURL: uploadURL,
                perFileParameters: postVars,
                retryCount: this.get("retryCount")
            });

            this.queue.on("uploadstart", this._uploadEventHandler, this);
            this.queue.on("uploadprogress", this._uploadEventHandler, this);
            this.queue.on("totaluploadprogress", this._uploadEventHandler, this);
            this.queue.on("uploadcomplete", this._uploadEventHandler, this);
            this.queue.on("alluploadscomplete", this._uploadEventHandler, this);
            this.queue.on("alluploadscancelled", function () {this.queue = null;}, this);
            this.queue.on("uploaderror", this._uploadEventHandler, this);
            this.queue.startUpload();

            this.fire("uploadstart");
        }
    }
},

{
    /**
    * The template for the Flash player container. Since the Flash player container needs
    * to completely overlay the &lquot;Select Files&rqot; control, it's positioned absolutely,
    * with width and height set to 100% of the parent.
    *
    * @property FLASH_CONTAINER
    * @type {String}
    * @static
    * @default '<div id="{swfContainerId}" style="position:absolute; top:0px; left: 0px; margin: 0; padding: 0;
    *           border: 0; width:100%; height:100%"></div>'
    */
    FLASH_CONTAINER: '<div id="{swfContainerId}" style="position:absolute; top:0px; left: 0px; margin: 0; ' +
                     'padding: 0; border: 0; width:100%; height:100%"></div>',

    /**
    * The template for the "Select Files" button.
    *
    * @property SELECT_FILES_BUTTON
    * @type {String}
    * @static
    * @default "<button type='button' class='yui3-button' tabindex='-1'>{selectButtonLabel}</button>"
    */
    SELECT_FILES_BUTTON: "<button type='button' class='yui3-button' tabindex='-1'>{selectButtonLabel}</button>",

    /**
    * The static property reflecting the type of uploader that `Y.Uploader`
    * aliases. The UploaderFlash value is `"flash"`.
    *
    * @property TYPE
    * @type {String}
    * @static
    */
    TYPE: "flash",

    /**
    * The identity of the widget.
    *
    * @property NAME
    * @type String
    * @default 'uploader'
    * @readOnly
    * @protected
    * @static
    */
    NAME: "uploader",

    /**
    * Static property used to define the default attribute configuration of
    * the Widget.
    *
    * @property ATTRS
    * @type {Object}
    * @protected
    * @static
    */
    ATTRS: {

        /**
        * A Boolean indicating whether newly selected files should be appended
        * to the existing file list, or whether they should replace it.
        *
        * @attribute appendNewFiles
        * @type {Boolean}
        * @default true
        */
        appendNewFiles : {
            value: true
        },

        /**
        * The names of CSS classes that correspond to different button states
        * of the "Select Files" control. These classes are assigned to the
        * "Select Files" control based on the mouse states reported by the
        * Flash player. The keys for the class names are:
        * <ul>
        *   <li> <strong>`hover`</strong>: the class corresponding to mouse hovering over
        *      the "Select Files" button.</li>
        *   <li> <strong>`active`</strong>: the class corresponding to mouse down state of
        *      the "Select Files" button.</li>
        *   <li> <strong>`disabled`</strong>: the class corresponding to the disabled state
        *      of the "Select Files" button.</li>
        *   <li> <strong>`focus`</strong>: the class corresponding to the focused state of
        *      the "Select Files" button.</li>
        * </ul>
        * @attribute buttonClassNames
        * @type {Object}
        * @default { hover: "yui3-button-hover",
        *            active: "yui3-button-active",
        *            disabled: "yui3-button-disabled",
        *            focus: "yui3-button-selected"
        *          }
        */
        buttonClassNames: {
            value: {
                "hover": "yui3-button-hover",
                "active": "yui3-button-active",
                "disabled": "yui3-button-disabled",
                "focus": "yui3-button-selected"
            }
        },

        /**
        * A Boolean indicating whether the uploader is enabled or disabled for user input.
        *
        * @attribute enabled
        * @type {Boolean}
        * @default true
        */
        enabled : {
            value: true
        },

        /**
        * The action  performed when an upload error occurs for a specific file being uploaded.
        * The possible values are:
        * <ul>
        *   <li> <strong>`UploaderQueue.CONTINUE`</strong>: the error is ignored and the upload process is continued.</li>
        *   <li> <strong>`UploaderQueue.STOP`</strong>: the upload process is stopped as soon as any other parallel file
        *     uploads are finished.</li>
        *   <li> <strong>`UploaderQueue.RESTART_ASAP`</strong>: the file is added back to the front of the queue.</li>
        *   <li> <strong>`UploaderQueue.RESTART_AFTER`</strong>: the file is added to the back of the queue.</li>
        * </ul>
        * @attribute errorAction
        * @type {String}
        * @default UploaderQueue.CONTINUE
        */
        errorAction: {
            value: "continue",
            validator: function (val) {
                return (
                    val === UploaderQueue.CONTINUE ||
                    val === UploaderQueue.STOP ||
                    val === UploaderQueue.RESTART_ASAP ||
                    val === UploaderQueue.RESTART_AFTER
                );
            }
        },

        /**
        * An array indicating what fileFilters should be applied to the file
        * selection dialog. Each element in the array should be an object with
        * the following key-value pairs:
        * {
        *   description : String
         extensions: String of the form &lquot;*.ext1;*.ext2;*.ext3;...&rquot;
        * }
        * @attribute fileFilters
        * @type {Array}
        * @default []
        */
        fileFilters: {
            value: []
        },

        /**
        * A filtering function that is applied to every file selected by the user.
        * The function receives the `Y.File` object and must return a Boolean value.
        * If a `false` value is returned, the file in question is not added to the
        * list of files to be uploaded.
        * Use this function to put limits on file sizes or check the file names for
        * correct extension, but make sure that a server-side check is also performed,
        * since any client-side restrictions are only advisory and can be circumvented.
        *
        * @attribute fileFilterFunction
        * @type {Function}
        * @default null
        */
        fileFilterFunction: {
            value: null
        },

        /**
        * A String specifying what should be the POST field name for the file
        * content in the upload request.
        *
        * @attribute fileFieldName
        * @type {String}
        * @default Filedata
        */
        fileFieldName: {
            value: "Filedata"
        },

        /**
        * The array of files to be uploaded. All elements in the array
        * must be instances of `Y.FileFlash` and be instantiated with a `fileId`
        * retrieved from an instance of the uploader.
        *
        * @attribute fileList
        * @type {Array}
        * @default []
        */
        fileList: {
            value: [],
            getter: "_getFileList",
            setter: "_setFileList"
        },

        /**
        * A Boolean indicating whether multiple file selection is enabled.
        *
        * @attribute multipleFiles
        * @type {Boolean}
        * @default false
        */
        multipleFiles: {
            value: false
        },

        /**
        * An object, keyed by `fileId`, containing sets of key-value pairs
        * that should be passed as POST variables along with each corresponding
        * file. This attribute is only used if no POST variables are specifed
        * in the upload method call.
        *
        * @attribute postVarsPerFile
        * @type {Object}
        * @default {}
        */
        postVarsPerFile: {
            value: {}
        },

        /**
        * The label for the "Select Files" widget. This is the value that replaces the
        * `{selectButtonLabel}` token in the `SELECT_FILES_BUTTON` template.
        *
        * @attribute selectButtonLabel
        * @type {String}
        * @default "Select Files"
        */
        selectButtonLabel: {
            value: "Select Files"
        },

        /**
        * The widget that serves as the "Select Files" control for the file uploader
        *
        *
        * @attribute selectFilesButton
        * @type {Node | Widget}
        * @default A standard HTML button with YUI CSS Button skin.
        */
        selectFilesButton : {
            valueFn: function () {
                return Y.Node.create(substitute(Y.UploaderFlash.SELECT_FILES_BUTTON, {selectButtonLabel: this.get("selectButtonLabel")}));
             }
        },

        /**
        * The number of files that can be uploaded
        * simultaneously if the automatic queue management
        * is used. This value can be in the range between 2
        * and 5.
        *
        * @attribute simLimit
        * @type {Number}
        * @default 2
        */
        simLimit: {
            value: 2,
            validator: function (val) {
                    return (val >= 2 && val <= 5);
            }
        },

        /**
        * The URL to the SWF file of the flash uploader. A copy local to
        * the server that hosts the page on which the uploader appears is
        * recommended.
        *
        * @attribute swfURL
        * @type {String}
        * @default "flashuploader.swf" with a
        * random GET parameter for IE (to prevent buggy behavior when the SWF
        * is cached).
        */
        swfURL: {
            valueFn: function () {
                var prefix = "flashuploader.swf";

                if (Y.UA.ie > 0) {
                    return (prefix + "?t=" + Y.guid("uploader"));
                }

                return prefix;
            }
        },

        /**
        * The id's or `Node` references of the DOM elements that precede
        * and follow the `Select Files` button in the tab order. Specifying
        * these allows keyboard navigation to and from the Flash player
        * layer of the uploader.
        * The two keys corresponding to the DOM elements are:
        <ul>
        *   <li> `from`: the id or the `Node` reference corresponding to the
        *     DOM element that precedes the `Select Files` button in the tab order.</li>
        *   <li> `to`: the id or the `Node` reference corresponding to the
        *     DOM element that follows the `Select Files` button in the tab order.</li>
        * </ul>
        * @attribute tabElements
        * @type {Object}
        * @default null
        */
        tabElements: {
            value: null
        },

        /**
        * The URL to which file upload requested are POSTed. Only used if a different url is not passed to the upload method call.
        *
        * @attribute uploadURL
        * @type {String}
        * @default ""
        */
        uploadURL: {
            value: ""
        },

        /**
        * The number of times to try re-uploading a file that failed to upload before
        * cancelling its upload.
        *
        * @attribute retryCount
        * @type {Number}
        * @default 3
        */
        retryCount: {
            value: 3
        }
    }
});

Y.UploaderFlash.Queue = UploaderQueue;


}, '3.16.0', {
    "requires": [
        "swfdetect",
        "escape",
        "widget",
        "base",
        "cssbutton",
        "node",
        "event-custom",
        "uploader-queue"
    ]
});
/*
YUI 3.16.0 (build 76f0e08)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('uploader', function (Y, NAME) {

/**
* Provides UI for selecting multiple files and functionality for
* uploading multiple files to the server with support for either
* html5 or Flash transport mechanisms, automatic queue management,
* upload progress monitoring, and error events.
* @module uploader
* @main uploader
* @since 3.5.0
*/

/**
* `Y.Uploader` serves as an alias for either <a href="UploaderFlash.html">`Y.UploaderFlash`</a>
* or <a href="UploaderHTML5.html">`Y.UploaderHTML5`</a>, depending on the feature set available
* in a specific browser. If neither HTML5 nor Flash transport layers are available, `Y.Uploader.TYPE`
* static property is set to `"none"`.
*
* @class Uploader
*/

/**
* The static property reflecting the type of uploader that `Y.Uploader`
* aliases. The possible values are:
* <ul>
* <li><strong>`"html5"`</strong>: Y.Uploader is an alias for <a href="UploaderHTML5.html">Y.UploaderHTML5</a></li>
* <li><strong>`"flash"`</strong>: Y.Uploader is an alias for <a href="UploaderFlash.html">Y.UploaderFlash</a></li>
* <li><strong>`"none"`</strong>: Neither Flash not HTML5 are available, and Y.Uploader does
* not reference an actual implementation.</li>
* </ul>
*
* @property TYPE
* @type {String}
* @static
*/

var Win = Y.config.win;

if (Win && Win.File && Win.FormData && Win.XMLHttpRequest) {
    Y.Uploader = Y.UploaderHTML5;
}

else if (Y.SWFDetect.isFlashVersionAtLeast(10,0,45)) {
    Y.Uploader = Y.UploaderFlash;
}

else {
    Y.namespace("Uploader");
    Y.Uploader.TYPE = "none";
}


}, '3.16.0', {"requires": ["uploader-html5", "uploader-flash"]});
