import _ from "underscore";

function MugProperties (options) {
    this.__data = {};
    this.__spec = options.spec;
    this.__mug = options.mug;
    this.shouldChange = function () { return function () {}; };
}
MugProperties.setBaseSpec = function (baseSpec) {
    _.each(baseSpec, function (spec, name) {
        Object.defineProperty(MugProperties.prototype, name, {
            get: function () {
                return this._get(name);
            },
            set: function (value) {
                this._set(name, value);
            },
            // Allow properties to be redefined.  This should not be
            // necessary, but if we don't do this then if vellum.init() is
            // called a second time (i.e., when reloading Vellum on the test
            // page), we get an error.  This is an easy and harmless
            // alternative, but properties should never need to be redefined
            // otherwise.
            configurable: true
        });
    });
};
MugProperties.prototype = {
    getDefinition: function (name) {
        return this.__spec[name];
    },
    getAttrs: function () {
        return _.clone(this.__data);
    },
    has: function (attr) {
        return this.__data.hasOwnProperty(attr);
    },
    set: function (attr, val) {
        // set or clear property without triggering events, unlike _set
        if (arguments.length > 1) {
            this.__data[attr] = val;
        } else {
            delete this.__data[attr];
        }
    },
    _get: function (attr) {
        return this.__data[attr];
    },
    _set: function (attr, val) {
        var spec = this.__spec[attr],
            prev = this.__data[attr],
            mug = this.__mug;

        if (!spec || val === prev ||
            // only set attr if spec allows this attr, except if mug is a
            // DataBindOnly (which all mugs are before the control block has
            // been parsed).
            (mug.getPresence(attr) === 'notallowed' &&
             mug.__className !== 'DataBindOnly'))
        {
            return;
        }

        var callback = this.shouldChange(mug, attr, val, prev);
        if (callback) {
            if (spec.setter) {
                spec.setter(mug, attr, val);
            } else {
                this.__data[attr] = val;
            }
            callback();
        }
    },
    setAttrs: function (attrs) {
        var _this = this;
        _(attrs).each(function (val, attr) {
            _this[attr] = val;
        });
    }
};

export default MugProperties;
