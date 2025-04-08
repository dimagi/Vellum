module.exports = function (source) {
    return `const _ = require("underscore"); module.exports = _.template(${JSON.stringify(source)})`;
};
