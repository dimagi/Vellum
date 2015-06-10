// Knockout might help make some of the binding here more maintainable.
// Hopefully its not too hard to follow.

// I chose to use regex parsing of nodeset filter conditions because it was fast
// and I knew it would work, but we might want to switch to using the XPath
// JISON parser if it can handle parsing nodesets with filter conditions in a
// way that lets us test equality minus whitespace, quotes, etc.  For instance,
// it currently prevents you from referencing instances with filter conditions
// of their own in a filter condition.

// I chose not to use the property/widget framework for each individual widget
// because it seemed like the interactions between the different properties
// would require a lot of complicated code to make it work with that framework.
// It might be a good idea to flesh out the BoundPropertyMap thing using ES5
// properties and then have some sort of formal system for mapping model objects
// with nested properties to UI objects with nested properties.

// It would be nice to convert the instance definition storage to use
// first-class abstractions rather than simple hashes.
define([
    'underscore',
    'jquery',
    'tpl!vellum/templates/external_data_source', 
    'tpl!vellum/templates/custom_data_source',
    'vellum/widgets',
    'vellum/datasources',
    'vellum/form',
    'vellum/mugs',
    'vellum/parser',
    'vellum/util',
    'vellum/debugutil',
    'vellum/core',
    'jquery.bootstrap-better-typeahead'
], function (
    _,
    $,
    external_data_source,
    custom_data_source,
    widgets,
    datasources,
    form,
    mugs,
    parser,
    util,
    debug
) {
    var mugTypes = mugs.baseMugTypes.normal,
        Itemset, isAdvancedItemsetEnabled,
        END_FILTER = /\[[^\[]*\]$/;

    Itemset = util.extend(mugs.defaultOptions, {
        isControlOnly: true,
        typeName: 'Lookup Table Data',
        tagName: 'itemset',
        icon: 'icon-th',
        isTypeChangeable: false,
        // have to delete the parent select
        isRemoveable: false,
        isCopyable: false,
        getIcon: function (mug) {
            return 'icon-th';
        },
        init: function (mug, form, baseSpec) {
            mug.p.itemsetData = {};
        },
        writeControlLabel: false,
        writeControlRefAttr: null,
        writeCustomXML: function (xmlWriter, mug) {
            var data = mug.p.itemsetData,
                nodeset = data.nodeset,
                filter = mug.p.filter;
            if (filter) {
                nodeset += '[' + filter + ']';
            }
            xmlWriter.writeAttributeString(
                'nodeset', nodeset || '');
            xmlWriter.writeStartElement('label');
            xmlWriter.writeAttributeString(
                'ref', data.labelRef || '');
            xmlWriter.writeEndElement();
            xmlWriter.writeStartElement('value');
            xmlWriter.writeAttributeString(
                'ref', data.valueRef || '');
            xmlWriter.writeEndElement();
        },
        spec: {
            label: { presence: 'notallowed' },
            labelItext: { presence: 'notallowed' },
            labelItextID: { presence: 'notallowed' },
            hintLabel: { presence: 'notallowed' },
            hintItext: { presence: 'notallowed' },
            hintItextID: { presence: 'notallowed' },
            helpItext: { presence: 'notallowed' },
            helpItextID: { presence: 'notallowed' },
            mediaItext: { presence: 'notallowed' },
            otherItext: { presence: 'notallowed' },
            appearance: { presence: 'notallowed' },
            itemsetData: {
                lstring: 'Lookup Table',
                visibility: 'visible_if_present',
                presence: 'optional',
                widget: itemsetWidget,
                validationFunc: function (mug) {
                    var itemsetData = mug.p.itemsetData;
                    if (!itemsetData.nodeset) {
                        return "A data source must be selected.";
                    }
                    if (!itemsetData.valueRef) {
                        return "Choice Value must be specified.";
                    }
                    if (!itemsetData.labelRef) {
                        return "Choice Label must be specified.";
                    }

                    // HACK accessing async-loaded data; it may not be here yet
                    var fixtures = datasources.getPossibleFixtures(),
                        notCustom = _.some(fixtures, function (fixture) {
                            return fixture.src === itemsetData.instance.src;
                        }),
                        choices = datasources.autocompleteChoices(itemsetData.instance.src),
                        filterRegex = /\[[^\[]+]/g,
                        strippedValue = itemsetData.valueRef.replace(filterRegex, ""),
                        strippedLabel = itemsetData.labelRef.replace(filterRegex, "");

                    if (notCustom && !_.contains(choices, strippedValue)) {
                        return itemsetData.valueRef + " was not found in the lookup table";
                    } else if (notCustom && !_.contains(choices, strippedLabel)) {
                        return itemsetData.labelRef + " was not found in the lookup table";
                    }

                    return 'pass';
                }
            },
            filter: {
                lstring: 'Filter',
                presence: 'optional',
                widget: widgets.xPath,
                xpathType: 'bool',
                visibility: 'visible',
                leftPlaceholder: '',
                autocompleteSources: function() {
                    // HACK accessing async-loaded data; it may not be here yet
                    // TODO convert to callback; setup auto-complete when data is ready
                    return datasources.autocompleteChoices(this.p.itemsetData.instance.src);
                },
                help: "This is an XPath expression that will filter the set " +
                      "of choices from the lookup table",
            }
        }
    });

    function afterDynamicSelectInsert(form, mug) {
        return form.createQuestion(mug, 'into', "Itemset", true);
    }

    var itemsetDataSpec = {
            presence: 'optional',
            visibility: 'hidden',
            serialize: function (value, key, mug, data) {
                var children = mug.form.getChildren(mug);
                return _.pluck(_.pluck(children, "p"), key);
            },
            deserialize: function (data, key, mug) {
                _.each(data[key], function (value) {
                    var itemset = afterDynamicSelectInsert(mug.form, mug);
                    itemset.p[key] = value;
                });
            }
        };

    $.vellum.plugin("itemset", {}, {
        init: function () {
            isAdvancedItemsetEnabled = this.opts().features.advanced_itemsets;
        },
        getSelectQuestions: function () {
            return this.__callOld().concat([
                "SelectDynamic",
                "MSelectDynamic"
            ]);
        },
        getMugTypes: function () {
            var types = this.__callOld();
            types.auxiliary.Itemset = Itemset;
            types.normal = $.extend(types.normal, {
                "MSelectDynamic": util.extend(mugTypes.MSelect, {
                    typeName: 'Multiple Answer Lookup Table',
                    typeChangeError: function (mug, typeName) {
                        return typeName === "SelectDynamic" ? "" : "Can only change to a dynamic single answer";
                    },
                    validChildTypes: ["Itemset"],
                    maxChildren: 1,
                    afterInsert: afterDynamicSelectInsert,
                    spec: {
                        itemsetData: itemsetDataSpec,
                    }
                }),
                "SelectDynamic": util.extend(mugTypes.Select, {
                    typeName: 'Single Answer Lookup Table',
                    typeChangeError: function (mug, typeName) {
                        return typeName === "MSelectDynamic" ? "" : "Can only change to a dynamic multiple answer";
                    },
                    validChildTypes: ["Itemset"],
                    maxChildren: 1,
                    afterInsert: afterDynamicSelectInsert,
                    spec: {
                        itemsetData: itemsetDataSpec,
                    }
                })
            });
            return types;
        },
        updateControlNodeAdaptorMap: function (map) {
            this.__callOld();
            var adaptItemset = parser.makeControlOnlyMugAdaptor('Itemset');
            map.itemset = function ($element, appearance, form, parentMug) {
                var adapt = function (mug, form) {
                    if (parentMug.__className === 'Select') {
                        form.changeMugType(parentMug, 'SelectDynamic');
                    } else if (parentMug.__className === 'MSelect') {
                        form.changeMugType(parentMug, 'MSelectDynamic');
                    } else {
                        debug.log("Unknown parent type: " + parentMug.__className);
                    }
                    mug = adaptItemset(mug, form);
                    var nodeset = parseNodeset($element.popAttr('nodeset'));
                    mug.p.filter = nodeset.filter;
                    mug.p.itemsetData = {
                        instance: form.parseInstance(
                                    nodeset.value, mug, "itemsetData.instance"),
                        nodeset: nodeset.value,
                        labelRef: $element.children('label').attr('ref'),
                        valueRef: $element.children('value').attr('ref')
                    };
                    return mug;
                };
                adapt.ignoreDataNode = true;
                return adapt;
            };
        },
        loadXML: function () {
            this.__callOld();
            this.data.core.form.on("mug-property-change", function (event) {
                var mug = event.mug;
                if (mug.__className === "Itemset" && event.property === "itemsetData") {
                    updateDataSource(mug, event.val, event.previous);
                }
            });
        },
        getLogicProperties: function () {
            var ret = this.__callOld();
            ret.push('filter');
            return ret;
        }
    });

    function updateDataSource(mug, value, previous) {
        if (previous && previous.instance && previous.instance.src) {
            mug.form.dropInstanceReference(
                        previous.instance.src, mug, "itemsetData.instance");
        }
        if (value && value.instance && value.instance.src) {
            var instanceId = mug.form.addInstanceIfNotExists(
                    value.instance, mug, "itemsetData.instance");
            if (instanceId !== value.instance.id) {
                value.instance.id = instanceId;
                value.nodeset = mug.form.updateInstanceQuery(value.nodeset, instanceId);
            }
        }
    }

    function parseNodeset(nodeset) {
        var i = nodeset.search(END_FILTER);
        if (i !== -1) {
            return {
                value: nodeset.slice(0, i),
                filter: nodeset.slice(i + 1, -1)
            };
        }
        return {value: nodeset, filter: ''};
    }

    function itemsetWidget(mug, options) {
        function isEmptyValue(value) {
            return !value || _.all(_.map(value, _.isEmpty));
        }

        function updateAutocomplete() {
            var choices = datasources.autocompleteChoices(super_getValue().src);
            labelRef.addAutocomplete(choices, super_handleChange);
            valueRef.addAutocomplete(choices, super_handleChange);
            return choices;
        }

        function onOptionsLoaded() {
            optionsLoaded = true;
            if (canUpdateAutocomplete) {
                // cannot do this until widget is fully initialized
                // because updateAutocomplete() calls super_getValue()
                var choices = updateAutocomplete();
                if (choices && choices.length && isEmptyValue(current.value)) {
                    if (_.contains(choices, "name")) {
                        labelRef.val("name");
                    } else {
                        labelRef.val(choices[0]);
                    }
                    if (_.contains(choices, "@id")) {
                        valueRef.val("@id");
                    } else {
                        valueRef.val(choices.length > 1 ? choices[1] : choices[0]);
                    }
                    if (current.hasOwnProperty("value")) {
                        // HACK push async-loaded default value to the mug.
                        // This should not be done in UI (widget) code.
                        // TODO kick off async load options in SelectDynamic mug
                        // init and clean up related hacks.
                        super_handleChange();
                    }
                }
            }
        }

        options = _.extend({}, options, {onOptionsLoaded: onOptionsLoaded});
        if (isAdvancedItemsetEnabled) {
            options.hasAdvancedEditor = true;
            options.getSource = function (mug) {
                var val = super_getValue();
                if (mug.p.filter) {
                    val.query += "[" + mug.p.filter + "]";
                }
                return val;
            };
            options.setSource = function (source, mug) {
                var val = source,
                    nodeset = parseNodeset(source.query);
                val.query = nodeset.value;
                mug.p.filter = nodeset.filter;
                super_setValue(val);
            };
        }

        var current = {},
            optionsLoaded = false,
            canUpdateAutocomplete = false,
            widget = datasources.fixtureWidget(mug, options, "Lookup Table"),
            super_getUIElement = widget.getUIElement,
            super_getValue = widget.getValue,
            super_setValue = widget.setValue,
            super_handleChange = widget.handleChange,
            labelRef = refSelect("label_ref", "Label Field", false),
            valueRef = refSelect("value_ref", "Value Field", false);

        widget.handleChange = function() {
            updateAutocomplete();
            super_handleChange();
        };

        labelRef.onChange(super_handleChange);
        valueRef.onChange(super_handleChange);

        widget.getUIElement = function () {
            return $('<div>').append(super_getUIElement())
                .append(valueRef.element)
                .append(labelRef.element);
        };

        widget.getValue = function () {
            var val = super_getValue();
            return {
                instance: ($.trim(val.src) ? {id: val.id, src: val.src} : {id: null, src: null}),
                nodeset: val.query,
                labelRef: labelRef.val(),
                valueRef: valueRef.val()
            };
        };

        widget.setValue = function (val) {
            var hasValue = current.hasOwnProperty("value");
            current.value = val;
            if (optionsLoaded && !hasValue && isEmptyValue(val)) {
                // ignore first call (during core widget init) to retain the
                // default value that was set when options were loaded
                super_handleChange();
                return;
            }
            val = _.isEmpty(val) ? {instance: {}} : val;
            super_setValue({
                id: (val.instance ? val.instance.id : ""),
                src: (val.instance ? val.instance.src : ""),
                query: val.nodeset || ""
            });
            labelRef.val(val.labelRef);
            valueRef.val(val.valueRef);
        };

        canUpdateAutocomplete = true;
        if (optionsLoaded) {
            // call again to update auto-complete and set defaults
            onOptionsLoaded();
        }

        return widget;
    }

    function refSelect(name, label, isDisabled) {
        var input = $("<input type='text' class='input-block-level'>");
        input.attr("name", name);
        return {
            addAutocomplete: function(sources, changeFunction) {
                input.autocomplete({
                    source: sources,
                    minLength: 0,
                    change: changeFunction,
                    close: changeFunction
                }).focus(function (e) {
                    // populate the list
                    $(this).autocomplete('search', $(this).val());
                });
            },
            element: widgets.util.getUIElement(input, label, isDisabled),
            val: function (value) {
                if (_.isUndefined(value)) {
                    return input.val();
                } else {
                    input.val(value || "");
                }
            },
            onChange: function (callback) {
                input.bind("change keyup", callback);
            }
        };
    }
});
