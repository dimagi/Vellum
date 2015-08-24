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
    'vellum/debugutil'
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
        Itemset, isAdvancedItemsetEnabled, opts,
        END_FILTER = /\[[^\[\]]*\]$/;

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
                serialize: function (value, key, mug, data) {
                    value.nodeset = mugs.serializeXPath(value.nodeset, key, mug, data);
                    return value;
                },
                deserialize: function (data, key, mug) {
                    var value = mugs.deserializeXPath(data, key, mug);
                    if (value && value.instance &&
                                 value.instance.id && value.instance.src) {
                        var instances = {};
                        instances[value.instance.id] = value.instance.src;
                        mug.form.updateKnownInstances(instances);
                    }
                    return value;
                },
                validationFunc: function (mug) {
                    var itemsetData = mug.p.itemsetData;
                    if (!itemsetData.nodeset) {
                        return "A data source must be selected.";
                    } else {
                        mug.form.updateLogicReferences(
                            mug, "itemsetData", itemsetData.nodeset);
                    }
                    if (!itemsetData.valueRef) {
                        return "Choice Value must be specified.";
                    }
                    if (!itemsetData.labelRef) {
                        return "Choice Label must be specified.";
                    }

                    var sources = getDataSources(),
                        fixtures = datasources.getPossibleFixtures(sources),
                        notCustom = _.some(fixtures, function (fixture) {
                            return fixture.src === itemsetData.instance.src;
                        }),
                        choices = datasources.autocompleteChoices(sources, itemsetData.instance.src),
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
                serialize: mugs.serializeXPath,
                deserialize: mugs.deserializeXPath,
                visibility: 'visible',
                leftPlaceholder: '',
                autocompleteChoices: function(mug) {
                    var sources = getDataSources(),
                        src = mug.p.itemsetData.instance.src;
                    return datasources.autocompleteChoices(sources, src);
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
                value = _.chain(mug.form.getChildren(mug))
                    .map(function (child) {
                        return child.spec[key].serialize(child.p[key], key, child, data);
                    })
                    .filter(_.identity)
                    .value();
                return !_.isEmpty(value) ? value : undefined;
            },
            deserialize: function (data, key, mug) {
                _.each(data[key], function (value, i) {
                    var children = mug.form.getChildren(mug),
                        itemset = children[i] || afterDynamicSelectInsert(mug.form, mug),
                        dat = _.clone(data);
                    dat[key] = value;
                    itemset.p[key] = itemset.spec[key].deserialize(dat, key, itemset);
                });
            }
        };

    $.vellum.plugin("itemset", {}, {
        init: function () {
            opts = this.opts().itemset;
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
                        filter: itemsetDataSpec,
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
                        filter: itemsetDataSpec,
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
                                    nodeset.value, mug, "itemsetData"),
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

    function getDataSources() {
        // HACK synchronously get asynchronously loaded data (if available)
        var sources = [];
        datasources.getDataSources(function (data) {
            // will execute synchronously if data sources have been loaded
            if (opts.dataSourcesFilter) {
                data = opts.dataSourcesFilter(data);
            }
            sources = data;
        });
        return sources;
    }

    function itemsetWidget(mug, options) {
        function isEmptyValue(value) {
            return !value || _.all(_.map(value, _.isEmpty));
        }

        function updateAutocomplete(data) {
            var value = super_getValue(),
                choices = datasources.autocompleteChoices(data, value ? value.src : "");
            labelRef.addAutocomplete(choices, super_handleChange);
            valueRef.addAutocomplete(choices, super_handleChange);
            return choices;
        }

        function onOptionsLoaded(data) {
            dataSources = data;
            optionsLoaded = true;
            if (canUpdateAutocomplete) {
                // cannot do this until widget is fully initialized
                // because updateAutocomplete() calls super_getValue()
                var choices = updateAutocomplete(data);
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

        options = _.extend({}, options, {
            onOptionsLoaded: onOptionsLoaded,
            dataSourcesFilter: opts.dataSourcesFilter,
        });
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
            dataSources = [],
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
            updateAutocomplete(dataSources);
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
            onOptionsLoaded(dataSources);
        }

        return widget;
    }

    function refSelect(name, label, isDisabled) {
        var input = $("<input type='text' class='input-block-level'>");
        input.attr("name", name);
        return {
            addAutocomplete: function(sources, changeFunction) {
                util.dropdownAutocomplete(input, sources);
                input.on("blur change", function() {
                    if (_.isFunction(changeFunction)) {
                        changeFunction();
                    }
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
