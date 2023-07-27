define([
    'jquery',
    'underscore',
    'vellum/mugs',
    'vellum/tree',
    'vellum/util',
    'vellum/atwho',
    'vellum/widgets',
    'vellum/core'
], function (
    $,
    _,
    mugs,
    Tree,
    util,
    atwho,
    widgets,
){
    let CCC_XMLNS = 'http://commcareconnect.com/data/v1/learn',
        MUG_NAME = 'CCCLearnModule',
        cccMugOptions = {
            typeName: 'CommCare Connect Metadata',
            isTypeChangeable: false,
            isDataOnly: true,
            supportsDataNodeRole: true,
            icon: 'fa fa-compress',
            init: (mug, form) => {
                mug.p.name = "";
            },
            getExtraDataAttributes: function (mug) {
                return {
                    // allows the parser to know which mug to associate with this node
                    "vellum:role": MUG_NAME,
                };
            },
            parseDataNode: () => {
                // Extract values from the data node
                // Return an empty list of child nodes since children are handled
                // by this plugin directly.
                return $([])
            },
            dataChildFilter: (children, mug) => {
                // called during write
                // return a list nodes to add to the forms data node
                children = [
                    new Tree.Node([], {
                        getNodeID: function () { return "name"; },
                        p: {rawDataAttributes: null},
                        options: {getExtraDataAttributes: () => {}}
                    })
                ]
                return [new Tree.Node(children, {
                    getNodeID: function () { return "module"; },
                    p: {rawDataAttributes: null},
                    options: {
                        getExtraDataAttributes: () => {
                            return  {
                                "xmlns": CCC_XMLNS,
                                "id": mug.p.nodeID,
                            }
                        }
                    }
                })];
            },
            getBindList: (mug) => {
                // return list of bind elements to add to the form
                return [
                    {
                        nodeset: mug.absolutePath + "/module/name",
                        calculate: `'${mug.p.name}'`,
                    }
                ];
            },
            spec: {
                xmlnsAttr: {
                    presence: "optional",
                    serialize: function () {},
                    deserialize: function () {}
                },
                name: {
                    lstring: gettext("Name"),
                    visibility: 'visible',
                    presence: 'required',
                    widget: widgets.text,
                },
                requiredAttr: { presence: "notallowed" },
                constraintAttr: { presence: "notallowed" },
                calculateAttr: { presence: "notallowed" }
            },
        },
        sectionData = [
            // UI sections for the mug
            {
                slug: "main",
                displayName: gettext("Basic"),
                properties: [
                    "nodeID",
                    "name",
                ],
            },
        ];

    $.vellum.plugin("commcareConnect", {}, {
        getAdvancedQuestions: function () {
            return this.__callOld().concat([MUG_NAME]);
        },
        getMugTypes: function () {
            let types = this.__callOld();
            types.normal[MUG_NAME] = util.extend(mugs.defaultOptions, cccMugOptions);
            return types;
        },
        getSections: function (mug) {
            if (mug.__className !== MUG_NAME) return this.__callOld();
            return _.clone(sectionData);
        },
        parseBindElement: function (form, el, path) {
            let mug = form.getMugByPath(path);
            if (!mug) {
                let pathRegex = /\/module\/(name)$/,
                    matchRet = path.match(pathRegex),
                    basePath;
                if (matchRet && matchRet.length > 0) {
                    basePath = path.replace(pathRegex, "");
                    mug = form.getMugByPath(basePath);
                    if (mug && mug.__className === MUG_NAME) {
                        let attr = matchRet[1];
                        mug.p[attr] = el.xmlAttr("calculate");
                        return;
                    }
                }
            }
            this.__callOld();
        },
    });
});
