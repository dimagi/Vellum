import _ from "underscore";
import util from "vellum/util";

// question-type specific properties, gets reset when you change the
// question type
var defaultOptions = {
    typeName: "Base",
    tagName: "input",
    isDataOnly: false,
    isControlOnly: false,
    // whether you can change to or from this question's type in the UI
    isTypeChangeable: true,
    /**
     * Determine if this mug can have its type changed to typeName
     *
     * Note: this method will also be called to verify that the reverse
     * type change is possible, in which case `mug`'s type will be the
     * same as `typeName`. This works for all current question types, but
     * could conceivably be wrong for some type that does not yet exist.
     *
     * @param mug - The mug object.
     * @param typeName - The name of the new type for mug (e.g., 'MSelect').
     * @returns - Empty string if the mug can change to type, otherwise error message.
     */
    typeChangeError: function (mug, typeName) {
        return '';
    },
    changeTypeTransform: function (mug) {
        return;
    },
    // controls whether delete button shows up - you can still delete a
    // mug's ancestor even if it's not removeable
    isRemoveable: true,
    isCopyable: true,
    canOutputValue: true,
    maxChildren: -1,
    icon: null,
    // whether it can be created during data node parsing
    // due to presence of vellum:role="TypeName" attribute
    supportsDataNodeRole: false,
    /**
     * Parser integration: get children from data node
     *
     * Additionally, this may perform extra mug initialization. It is
     * called before the mug is inserted into the data tree/mug hierarchy.
     *
     * @param mug - The mug object.
     * @param node - This mug's data node, a jQuery object.
     * @returns - A jquery collection of child nodes which will be passed through the parser in turn.
     */
    parseDataNode: function (mug, $node) {
        return $node.children();
    },
    controlNodeChildren: null,

    /**
     * Get data node path name.
     *
     * Use this to override the default path name.
     *
     * @param mug - The mug.
     * @param name - The default path name.
     * @returns - the name used in data node paths. It should
     *      uniquely identify the data node among its siblings.
     */
    getPathName: null,
    /**
     * Get data node tag name.
     *
     * Use this to override the default tag name.
     *
     * @param mug - The mug.
     * @param name - The default tag name.
     * @returns - the tag name used by the writer.
     */
    getTagName: null,

    /**
     * Filter function for data node children.
     *
     * This allows integration into the XForm writer. It can be used to filter out
     * child elements or generate additional child elements.
     *
     * The writer passes these filter functions to `processChildren` of
     * `Tree.walk`. See `Tree.walk` documentation for more details.
     *
     *  @param treeNodes - The list of child nodes.
     *  @param parentMug - The parent mug.
     *  @returns {Array<Tree.Node>} - The list of child nodes to add to the form XML data element.
     */
    dataChildFilter: null,
    controlChildFilter: null,

    /**
     * Get extra data node attributes to write to the XML.
     *
     * @param {Mug} mug - The mug.
     * @returns {Object} - An object containing extra attributes to write to the XML.
     */
    getExtraDataAttributes: null,
    writeDataNodeXML: null,       // function (xmlWriter, mug) { ... }

    /**
     * Returns a list of objects containing bind element attributes which will
     * be written to the form XML.
     */
    getBindList: function (mug) {
        var constraintMsgItext = mug.p.constraintMsgItext,
            constraintMsg;
        if (constraintMsgItext && !constraintMsgItext.isEmpty()) {
            constraintMsg = "jr:itext('" + constraintMsgItext.id + "')";
        } else {
            constraintMsg = mug.p.constraintMsgAttr;
        }

        var required;
        if (mug.p.requiredAttr) {
            required = mug.p.requiredCondition || util.createXPathBoolFromJS(mug.p.requiredAttr);
        } else {
            required = util.createXPathBoolFromJS(mug.p.requiredAttr);
        }

        var attrs = {
            nodeset: mug.hashtagPath,
            type: mug.options.dataType,
            constraint: mug.p.constraintAttr,
            "jr:constraintMsg": constraintMsg,
            relevant: mug.p.relevantAttr,
            required: required,
            requiredCondition: mug.p.requiredCondition,
            calculate: mug.p.calculateAttr,
        };
        _.each(mug.p.rawBindAttributes, function (value, key) {
            if (!attrs.hasOwnProperty(key) || _.isUndefined(attrs[key])) {
                attrs[key] = value;
            }
        });
        return attrs.nodeset ? [attrs] : [];
    },

    /**
     * Returns a list of objects containing `setvalue` element attributes which will
     * be written to the form XML.
     */
    getSetValues: function (mug) {
        var ret = [];

        if (mug.p.defaultValue) {
            ret = [{
                value: mug.p.defaultValue,
                event: mug.isInRepeat() ? 'jr-insert' : 'xforms-ready',
                ref: mug.hashtagPath
            }];
        }

        return ret;
    },

    // control node writer options
    writeControlLabel: true,
    writeControlHint: true,
    writeControlHelp: true,
    writeControlAlert: true,
    writeControlRefAttr: 'ref',
    // a function with signature `(xmlWriter, mug)` to write custom XML
    writeCustomXML: null,
    writesOnlyCustomXML: false,

    afterInsert: function (form, mug) {},
    getAppearanceAttribute: function (mug) {
        return mug.p.appearance;
    },
    getIcon: function (mug) {
        return mug.options.icon;
    },
    isHashtaggable: true,
    /**
     * Init function called when adding a mug to a form. Typically used ot initialize
     * mug properties.
     *
     * @param {Mug} mug
     * @param {Form} form
     */
    init: function (mug, form) {},

    /**
     * Attribute spec for the mug. Each attribute on the object
     * defines the attribute spec for that attribute. The attribute
     * spec is an object with the following properties:
     * - visibility: 'visible', 'hidden', 'visible_if_present', 'visible_if_not_present'
     * - presence: 'required', 'optional', 'notallowed'
     * - lstring: The label string to use for the attribute on the UI
     * - widget: The widget to use for the attribute. See `widgets.js`.
     * - defaultOptions: The default options for the widget
     * - validationFunc: A function to validate the attribute.
     *      // (mug) => isValid ? "pass" : gettext("Error message")
     * - mayReferenceSelf: Whether the attribute may reference the mug itself
     * - enabled: A function to determine whether the attribute is enabled
     *      // (mug) => true/false
     * - help: Help text for the attribute
     * - serialize: A function to serialize the attribute e.g. `mug.serializeXPath`
     * - deserialize: A function to deserialize the attribute e.g. `mug.deserializeXPath`
     */
    spec: {}
};

export default defaultOptions;
