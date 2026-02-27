import _ from "underscore";

/**
 * Add instances referenced to serialized data
 */
function serializeXPath(value, key, mug, data) {
    if (value && /\binstance\(/.test(value)) {
        data.instances = _.extend(data.instances || {},
                                  mug.form.parseInstanceRefs(value));
    }
    try {
        if (value) {
            value = mug.form.xpath.parse(value.toString()).toHashtag();
        }
    } catch (err) {
        if (_.isString(value) && !value.startsWith('#invalid/')) {
            value = '#invalid/xpath ' + value;
        }
    }
    return value || undefined;
}

function deserializeXPath(data, key, mug, context) {
    updateInstances(data, mug);
    var value = data[key];
    if (value) {
        try {
            value = mug.form.xpath.parse(value).toHashtag();
            context.later(function () {
                mug.p[key] = context.transformHashtags(value);
            });
        } catch (err) {
            if (_.isString(value) && !value.startsWith('#invalid/')) {
                value = '#invalid/xpath ' + value;
            }
        }
    } else if (value === null) {
        value = undefined;
    }
    return value;
}

function updateInstances(data, mug) {
    if (data.hasOwnProperty("instances") && !_.isEmpty(data.instances)) {
        mug.form.updateKnownInstances(data.instances);
    }
}

export {
    deserializeXPath,
    serializeXPath,
    updateInstances,
};
