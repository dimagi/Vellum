import $ from "jquery";
import _ from "underscore";
import util from "vellum/util";
import MugProperties from "./mugProperties";

function MugTypesManager(baseSpec, mugTypes, opts) {
    var _this = this,
        // Nestable Field List not supported in CommCare before v2.16
        group_in_field_list = opts.features.group_in_field_list;
    mugTypes.normal.Image.resize_enabled = opts.features.image_resize;

    this.auxiliaryTypes = mugTypes.auxiliary;
    this.normalTypes = mugTypes.normal;
    this.baseSpec = baseSpec;

    MugProperties.setBaseSpec(
        util.extend.apply(null,
            [baseSpec.databind, baseSpec.control].concat(_.filter(
                _.pluck(
                    util.extend(this.normalTypes, this.auxiliaryTypes),
                    'spec'),
                _.identity))));

    this.allTypes = $.extend({}, this.auxiliaryTypes, this.normalTypes);

    var allTypeNames = _.keys(this.allTypes),
        innerChildTypeNames = _.without.apply(_,
              [allTypeNames].concat(_.keys(this.auxiliaryTypes)));

    if (!group_in_field_list) {
        this.normalTypes.FieldList.validChildTypes = _.without.apply(_,
            [innerChildTypeNames].concat(_.without(_.map(this.allTypes,
                function (type, name) {
                    return type.isNestableGroup ? name : null;
                }
            ), null))
        );
    }

    _.each(this.auxiliaryTypes, function (type) {
        type.validChildTypes = [];
    });

    _.each(this.normalTypes, function (Mug, name) {
        if (Mug.validChildTypes) {
            return; // do nothing if validChildTypes is already set
        }
        var validChildTypes;
        if (Mug.isNestableGroup) {
            validChildTypes = innerChildTypeNames;
        } else {
            validChildTypes = [];
        }
        Mug.validChildTypes = validChildTypes;
    });

    _.each(this.allTypes, function (Mug, name) {
        Mug.__className = name;

        // set on this for easy access
        _this[name] = Mug;
    });
}
MugTypesManager.prototype = {
    make: function (typeName, form, copyFrom) {
        var mugType = this.allTypes[typeName];
        var attrs = copyFrom ? copyFrom.p.getAttrs() : null;
        return new MugTypesManager.Mug(mugType, form, this.baseSpec, attrs);
    },
    changeType: function (mug, typeName) {
        var form = mug.form,
            children = form.getChildren(mug);

        var message = this.allTypes[mug.__className].typeChangeError(mug, typeName);
        if (message) {
            throw new Error(message);
        }
        this.allTypes[mug.__className].changeTypeTransform(mug);

        mug.setOptionsAndProperties(this.allTypes[typeName]);

        if (typeName.indexOf("Select") !== -1) {
            _.each(children, function (childMug) {
                form.fire({
                    type: 'parent-question-type-change',
                    childMug: childMug
                });
            });
        }

        mug.validate();
        form.fire({
            type: 'question-type-change',
            qType: typeName,
            mug: mug
        });
        form.fireChange(mug);
    }
};


export default MugTypesManager;
