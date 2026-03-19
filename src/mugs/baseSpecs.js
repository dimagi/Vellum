import _ from "underscore";
import widgets from "vellum/widgets";
import util from "vellum/util";
import {deserializeXPath, serializeXPath} from "./xpath";

function resolveConflictedNodeId(mug) {
    // clear warning; mug already has copy-N-of-... ID
    mug.p.conflictedNodeId = null;
}

var RESERVED_NAMES = {"case": true, "registration": true, "script": true};
var baseSpecs = {
    databind: {
        // DATA ELEMENT
        nodeID: {
            visibility: 'visible',
            presence: 'optional',
            lstring: gettext('Question ID'),
            setter: function (mug, attr, value) {
                mug.form.moveMug(mug, "rename", value);
            },
            mugValue: function (mug, value) {
                if (arguments.length === 1) {
                    if (mug.p.has("conflictedNodeId")) {
                        return mug.p.conflictedNodeId;
                    }
                    return mug.p.nodeID;
                }
                mug.p.nodeID = value;
            },
            widget: widgets.identifier,
            validationFunc: function (mug) {
                if (!mug.p.nodeID) {
                    return "pass";
                }
                var lcid = mug.p.nodeID.toLowerCase(),
                    nameWarning = {
                        key: "mug-nodeID-reserved-name-warning",
                        level: mug.WARNING,
                    },
                    changedQuestionIDWarning = {
                        key: "mug-nodeID-changed-warning",
                        level: mug.INFO
                    },
                    return_value = "pass";

                if (RESERVED_NAMES.hasOwnProperty(lcid)) {
                    nameWarning.message = util.format(
                        gettext("The ID '{nodeID}' may cause problems " +
                        "with form parsing. It is recommended to pick " +
                        "a different Question ID."),
                        {nodeID: mug.p.nodeID}
                    );
                }
                mug.addMessage("nodeID", nameWarning);

                if (!util.isValidElementName(mug.p.nodeID)) {
                    return_value = util.format(gettext(
                        "{nodeID} is not a valid Question ID. " +
                        "It must start with a letter and contain only " +
                        "letters, numbers, and '-' or '_' characters."),
                        {nodeID: mug.p.nodeID});
                } else if (mug.p.nodeID.toLowerCase() === "meta") {
                    return_value = gettext("'meta' is not a valid Question ID.");
                } else if (mug.form.warnWhenChanged && mug.showChangedMsg &&
                    mug.__originalNodeID && mug.p.nodeID !== mug.__originalNodeID) {
                    changedQuestionIDWarning.message = gettext(
                        "Making this change will create a new Question ID (and a new column in exports).");
                }
                mug.addMessage("nodeID", changedQuestionIDWarning);
                return return_value;
            },
            dropMessage: function (mug, attr, key) {
                if (attr === "nodeID" && key === "mug-conflictedNodeId-warning") {
                    resolveConflictedNodeId(mug);
                }
            },
            serialize: function (value, key, mug, data) {
                data.id = mug.absolutePathNoRoot;
            },
            deserialize: function (data, key, mug, context) {
                if (data.id && data.id !== mug.p.nodeID) {
                    mug.p.nodeID = data.id.slice(data.id.lastIndexOf("/") + 1) ||
                                   mug.form.generate_question_id(null, mug);
                    if (data.conflictedNodeId) {
                        // Obscure edge case: if mug.p.nodeID conflicts with
                        // an existing question then expressions will be
                        // associated with that question and this later
                        // assignment will not restore those connections to
                        // this mug.
                        return context.later(function () {
                            // after all other properties are deserialized,
                            // assign conflicted ID to convert expressions
                            // or setup new conflict
                            mug.p.nodeID = data.conflictedNodeId;
                        });
                    }
                }
                return context.later(function () {
                    if (mug.p.conflictedNodeId) {
                        resolveConflictedNodeId(mug);
                    }
                });
            }
        },
        conflictedNodeId: {
            visibility: 'hidden',
            presence: 'optional',
            setter: function (mug, attr, value) {
                var message = null;
                if (value) {
                    mug.p.set(attr, value);
                    message = gettext("This question has the same " +
                        "Question ID as another question in the same " +
                        "group. Please choose a unique Question ID.");
                } else {
                    mug.p.set(attr);
                }
                mug.addMessage("nodeID", {
                    key: "mug-conflictedNodeId-warning",
                    level: mug.WARNING,
                    message: message,
                    fixSerializationWarning: resolveConflictedNodeId
                });
            },
            deserialize: function () {
                // deserialization is done by nodeID
            }
        },
        dataValue: {
            visibility: 'visible_if_present',
            presence: 'optional',
            lstring: gettext('Default Data Value'),
        },
        xmlnsAttr: {
            visibility: 'visible',
            presence: 'notallowed',
            lstring: gettext("Special Hidden Value XMLNS attribute")
        },
        rawDataAttributes: {
            presence: 'optional',
            lstring: gettext('Extra Data Attributes'),
        },

        // BIND ELEMENT
        relevantAttr: {
            visibility: 'visible',
            presence: 'optional',
            widget: widgets.xPath,
            xpathType: "bool",
            serialize: serializeXPath,
            deserialize: deserializeXPath,
            lstring: gettext('Display Condition')
        },
        calculateAttr: {
            // only show calculate condition for non-data nodes if it already
            // exists.  It's a highly discouraged use-case because the user will
            // think they can edit an input when they really can't, but we
            // shouldn't break existing forms doing this.
            visibility: 'visible_if_present',
            presence: 'optional',
            widget: widgets.xPath,
            xpathType: "generic",
            serialize: serializeXPath,
            deserialize: deserializeXPath,
            lstring: gettext('Calculate Condition')
        },
        constraintAttr: {
            visibility: 'visible',
            presence: 'optional',
            validationFunc: function (mug) {
                return baseSpecs.databind.constraintMsgAttr.validationFunc(mug);
            },
            widget: widgets.xPath,
            xpathType: "bool",
            mayReferenceSelf: true,
            serialize: serializeXPath,
            deserialize: deserializeXPath,
            lstring: gettext('Validation Condition')
        },
        // non-itext constraint message
        constraintMsgAttr: {
            visibility: 'visible',
            presence: 'optional',
            validationFunc : function (mug) {
                if (mug.p.constraintMsgAttr && !mug.p.constraintAttr) {
                    return gettext('You cannot have a Validation Error Message with no Validation Condition!');
                } else {
                    return 'pass';
                }
            },
            lstring: gettext('Validation Error Message')
        },
        requiredAttr: {
            visibility: 'visible',
            presence: 'optional',
            lstring: gettext("Required"),
            widget: widgets.checkbox,
            validationFunc: function(mug) {
                return baseSpecs.databind.requiredCondition.validationFunc(mug);
            }
        },
        requiredCondition: {
            visibility: 'requiredAttr',
            presence: 'optional',
            lstring: gettext("Required Condition"),
            widget: widgets.xPath,
            xpathType: "bool",
            serialize: serializeXPath,
            deserialize: deserializeXPath,
            validationFunc: function (mug) {
                var warningKey = "mug-requiredCondition-warning",
                    warningAttrs = ["requiredAttr", "requiredCondition"];
                if (mug.p.requiredCondition && !mug.p.requiredAttr) {
                    var message = gettext("The condition will be ignored unless you mark the question required.");
                    _.each(warningAttrs, function (attr) {
                        mug.addMessage(attr, {
                            key: warningKey,
                            level: mug.WARNING,
                            message: message
                        });
                    });
                } else {
                    _.each(warningAttrs, function (attr) {
                        mug.dropMessage(attr, warningKey);
                    });
                }
                return 'pass';
            }
        },
        nodeset: {
            visibility: 'hidden',
            presence: 'optional' //if not present one will be generated... hopefully.
        },
        // could use a key-value widget for this in the future
        rawBindAttributes: {
            presence: 'optional',
            lstring: gettext('Extra Bind Attributes')
        },
        defaultValue: {
            visibility: 'visible',
            presence: 'optional',
            lstring: gettext('Default Value'),
            widget: widgets.xPath,
            xpathType: 'generic',
            serialize: serializeXPath,
            deserialize: deserializeXPath,
            validationFunc: function (mug) {
                var form = mug.form;
                if (!form.vellum.opts().features.allow_data_reference_in_setvalue) {
                    var paths = mug.form.getHashtagsInXPath(mug.p.defaultValue);
                    paths =  _.filter(paths, function(path) { return path.namespace === 'form'; });
                    if (paths.length) {
                        return gettext(
                            "You are referencing a node in this form. " +
                            "This can cause errors in the form");
                    }
                }
                return 'pass';
            }
        },
        comment: {
            lstring: gettext('Comment'),
            visibility: 'visible',
            widget: widgets.multilineText,
        }
    },

    control: {
        appearance: {
            deleteOnCopy: true,
            visibility: 'visible',
            presence: 'optional',
            lstring: gettext('Appearance Attribute')
        },
        label: {
            visibility: 'visible',
            presence: 'optional',
            lstring: gettext("Default Display Text"),
            validationFunc: function (mug) {
                if (!mug.p.label && mug.getPresence("label") === 'required') {
                    return gettext('Default Display Text is required');
                }
                return 'pass';
            }
        },
        hintLabel: {
            visibility: 'visible',
            presence: 'optional',
            lstring: gettext("Hint Display Text")
        },
        rawControlAttributes: {
            presence: 'optional',
            lstring: gettext("Extra Control Attributes"),
        },
        rawControlXML: {
            presence: 'optional',
            lstring: gettext('Raw XML')
        },
        dataParent: {
            lstring: gettext('Data Parent'),
            visibility: 'visible',
            presence: 'optional',
            setter: function (mug, attr, value) {
                var oldPath = mug.hashtagPath;
                mug.p.set(attr, value);
                mug.form._updateMugPath(mug, oldPath);
            },
            widget: widgets.droppableText,
            validationFunc: function(mug) {
                function limitingParent(mug) {
                    if (!mug) {
                        return null;
                    } else if (mug.options.possibleDataParent === 'limited') {
                        return mug;
                    }
                    return limitingParent(mug.parentMug);
                }
                var dataParent = mug.p.dataParent,
                    form = mug.form,
                    parent;

                if (dataParent) {
                    parent = form.getMugByPath(dataParent);
                    if (!parent) {
                        if (form.getBasePath().slice(0, -1) !== dataParent) {
                            return gettext("Must be valid path");
                        }
                    } else if (parent === mug || !parent.options.possibleDataParent) {
                        return util.format(
                            gettext("{path} is not a valid data parent"),
                            {path: parent.hashtagPath}
                        );
                    } else if (limitingParent(mug) !== limitingParent(parent)) {
                        return gettext("Data parent of question in repeat " +
                            "group must be (in) the same repeat group");
                    }
                }

                return "pass";
            }
        },
    }
};

export default baseSpecs;
