/**
 *  The itemset plugin enables questions to interact with sets of data.
 *  Its primary use is to populate data-driven select questions.
 *
 *  Itemsets contain
 *      instance: which top-level data source contains the items
 *      nodeset: path to apply to the instance to get at the desired items
 *      valueRef: reference to apply to each node to get the item's value
 *      labelRef: reference to apply to each node to get the item's display name
 *
 *  Dynamic select mugs have a child itemset mug. A dynamic select mug's
 *  p.itemsetData, an array with at most one item, stores the itemset's
 *  persistent state.
 */
define([
    'underscore',
    'jquery',
    'vellum/widgets',
    'vellum/dataSourceWidgets',
    'vellum/mugs',
    'vellum/parser',
    'vellum/util',
    'vellum/atwho',
    'vellum/debugutil'
], function (
    _,
    $,
    widgets,
    datasourceWidgets,
    mugs,
    parser,
    util,
    atwho,
    debug
) {
    var mugTypes = mugs.baseMugTypes.normal,
        Itemset, isAdvancedItemsetEnabled, opts,
        changeSubscriptionLink,
        END_FILTER = /\[[^\[\]]*\]$/;

    Itemset = util.extend(mugs.defaultOptions, {
        isControlOnly: true,
        typeName: gettext('Lookup Table Data'),
        tagName: 'itemset',
        icon: 'fa fa-th',
        isTypeChangeable: false,
        // have to delete the parent select
        isRemoveable: false,
        isCopyable: false,
        getIcon: function (mug) {
            return 'fa fa-th';
        },
        init: function (mug, form, baseSpec) {
            mug.p.itemsetData = {};
        },
        writeControlLabel: false,
        writeControlRefAttr: null,
        writeCustomXML: function (xmlWriter, mug) {
            var data = mug.p.itemsetData,
                nodeset = data.nodeset,
                filter = mug.p.filter,
                valueRef = mug.p.valueRef,
                labelRef = mug.p.labelRef,
                sortRef = mug.p.sortRef;
            if (filter) {
                nodeset += '[' + filter + ']';
            }
            util.writeHashtags(xmlWriter, 'nodeset', nodeset || '', mug);
            xmlWriter.writeStartElement('label');
            xmlWriter.writeAttributeString('ref', labelRef || '');
            xmlWriter.writeEndElement();
            xmlWriter.writeStartElement('value');
            xmlWriter.writeAttributeString('ref', valueRef || '');
            xmlWriter.writeEndElement();
            var features = mug.form.vellum.opts().features;
            if (sortRef && sortRef.trim() && features.sorted_itemsets) {
                xmlWriter.writeStartElement('sort');
                xmlWriter.writeAttributeString('ref', sortRef);
                xmlWriter.writeEndElement();
            }
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
                lstring: gettext('Lookup Table'),
                visibility: 'visible_if_present',
                presence: 'optional',
                widget: itemsetWidget,
                serialize: function (value, key, mug, data) {
                    value.nodeset = mugs.serializeXPath(value.nodeset, key, mug, data);
                    return value;
                },
                deserialize: function (data, key, mug) {
                    var value = mugs.deserializeXPath(data, key, mug);
                    if (value) {
                        if (value.instance && value.instance.id && value.instance.src) {
                            var instances = {};
                            instances[value.instance.id] = value.instance.src;
                            mug.form.updateKnownInstances(instances);
                        }
                        //support old copy/paste
                        if (value.valueRef) {
                            mug.p.valueRef = value.valueRef;
                        }
                        if (value.labelRef) {
                            mug.p.labelRef = value.labelRef;
                        }
                        if (value.sortRef) {
                            mug.p.sortRef = value.sortRef;
                        }
                    }
                    return value;
                },
                validationFunc: function (mug) {
                    if (!mug.options.lookupTablesEnabled) {
                        return util.format(gettext(
                            "You no longer have access to Lookup Tables in your application. " +
                            "Lookup Tables are available on the Standard plan and higher.\n" +
                            "Before you can make a new version of your application, " +
                            "you must {link} or delete this question"
                        ), {
                            link: changeSubscriptionLink ?
                                "[" + gettext("change your subscription") +
                                "](" + changeSubscriptionLink + ")" :
                                gettext("change your subscription")
                        });
                    }
                    var itemsetData = mug.p.itemsetData;
                    if (!itemsetData.nodeset) {
                        return gettext("A data source must be selected.");
                    } else {
                        mug.form.updateLogicReferences(
                            mug, "itemsetData", itemsetData.nodeset);
                    }

                    return 'pass';
                }
            },
            valueRef: {
                lstring: 'Value Field',
                widget: refWidget,
                visibility: 'visible',
                presence: 'required',
                validationFunc: validateRefWidget('valueRef'),
                serialize: function (value, key, mug, data) {
                    if (mug.p.valueRef) {
                        data.itemsetData[0].valueRef = mug.p.valueRef;
                    }
                },
            },
            labelRef: {
                lstring: gettext('Display Text Field'),
                widget: refWidget,
                visibility: 'visible',
                presence: 'required',
                validationFunc: validateRefWidget('labelRef'),
                serialize: function (value, key, mug, data) {
                    if (mug.p.labelRef) {
                        data.itemsetData[0].labelRef = mug.p.labelRef;
                    }
                },
            },
            sortRef: {
                lstring: gettext('Sort Field'),
                widget: refWidget,
                visibility: function (mug) {
                    return mug.form.vellum.opts().features.sorted_itemsets;
                },
                presence: 'optional',
                validationFunc: validateRefWidget('sortRef'),
                serialize: function (value, key, mug, data) {
                    if (mug.p.sortRef) {
                        data.itemsetData[0].sortRef = mug.p.sortRef;
                    }
                },
            },
            filter: {
                lstring: gettext('Filter'),
                presence: 'optional',
                widget: widgets.xPath,
                xpathType: 'bool',
                serialize: mugs.serializeXPath,
                deserialize: mugs.deserializeXPath,
                visibility: 'visible',
                leftPlaceholder: '',
                autocompleteChoices: function(mug) {
                    var sources = getDataSources(mug),
                        src = mug.p.itemsetData.instance.src;
                    return datasourceWidgets.autocompleteChoices(sources, src);
                },
                help: gettext("This is an XPath expression that will filter the set " +
                      "of choices from the lookup table"),
            }
        }
    });

    function afterDynamicSelectInsert(form, mug) {
        var children = mug.form.getChildren(mug);
        if (children.length) {
            return children[0];
        }
        var sources = getDataSources(mug),
            newMug = form.createQuestion(mug, 'into', "Itemset", true);
        if (sources.length) {
            var src = sources[0].uri,
                nodeset = "instance('" + sources[0].id + "')" + sources[0].path,
                choices = datasourceWidgets.autocompleteChoices(sources, src);
            newMug = populateNodesetAttributes(newMug, choices);
            newMug.p.filter = '';
            newMug.p.itemsetData = {
                instance: form.parseInstance(
                    nodeset, newMug, "itemsetData"),
                nodeset: nodeset,
            };
        }
        return newMug;
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
            Itemset.lookupTablesEnabled = this.opts().features.lookup_tables;
            changeSubscriptionLink = this.opts().core.externalLinks.changeSubscription;
        },
        getQuestionGroups: function () {
            var groups = this.__callOld();
            if (this.opts().features.lookup_tables) {
               groups.splice(groups.length - 1, 0, {
                    group: ["SelectDynamic", gettext('Lookup Tables')],
                    questions: ["SelectDynamic", "MSelectDynamic"],
                });
            }
            return groups;
        },
        getMugTypes: function () {
            var types = this.__callOld();
            types.auxiliary.Itemset = Itemset;
            types.normal = $.extend(types.normal, {
                "MSelectDynamic": util.extend(mugTypes.MSelect, {
                    typeName: gettext('Checkbox Lookup Table'),
                    typeChangeError: function (mug, typeName) {
                        if (typeName.match(/^M?Select$/)) {
                            if (mug.form.getChildren(mug).length > 0) {
                                return gettext("Cannot change to Multiple/Single Choice " +
                                      "question if it has Choices. " +
                                      "Please remove all Choices and try again.");
                            }
                            return '';
                        }
                        return typeName === "SelectDynamic" ? "" :
                            gettext("Can only change to a Multiple Choice Lookup Table");
                    },
                    validChildTypes: ["Itemset"],
                    maxChildren: 1,
                    afterInsert: afterDynamicSelectInsert,
                    canAddChoices: false,
                    spec: {
                        itemsetData: itemsetDataSpec,
                        valueRef: itemsetDataSpec,
                        labelRef: itemsetDataSpec,
                        sortRef: itemsetDataSpec,
                        filter: itemsetDataSpec,
                    }
                }),
                "SelectDynamic": util.extend(mugTypes.Select, {
                    typeName: gettext('Multiple Choice Lookup Table'),
                    typeChangeError: function (mug, typeName) {
                        if (typeName.match(/^M?Select$/)) {
                            if (mug.form.getChildren(mug).length > 0) {
                                return gettext("Cannot change to Multiple/Single Choice " +
                                      "question if it has Choices. " +
                                      "Please remove all Choices and try again.");
                            }
                            return '';
                        }
                        return typeName === "MSelectDynamic" ? "" :
                            gettext("Can only change to a Checkbox Lookup Table");
                    },
                    validChildTypes: ["Itemset"],
                    maxChildren: 1,
                    afterInsert: afterDynamicSelectInsert,
                    canAddChoices: false,
                    spec: {
                        itemsetData: itemsetDataSpec,
                        valueRef: itemsetDataSpec,
                        labelRef: itemsetDataSpec,
                        sortRef: itemsetDataSpec,
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
                    var nodeset = parseNodeset(
                            $element.popAttr('vellum:nodeset') ||
                            $element.popAttr('nodeset'));
                    mug.p.filter = nodeset.filter;
                    mug.p.itemsetData = {
                        instance: form.parseInstance(
                                    nodeset.value, mug, "itemsetData"),
                        nodeset: nodeset.value,
                    };
                    mug.p.labelRef = $element.children('label').attr('ref');
                    mug.p.valueRef = $element.children('value').attr('ref');
                    var sortEl = $element.children('sort');
                    if (sortEl.length) {
                        mug.p.sortRef = sortEl.attr('ref');
                    }
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
        getMainProperties: function() {
            return this.__callOld().concat([
                'valueRef',
                'labelRef',
                'sortRef',
            ]);
        },
        getLogicProperties: function () {
            var ret = this.__callOld();
            ret.push('filter');
            return ret;
        },
        changeMugType: function (mug, type) {
            var changeToItemset = mug.__className.match(/^M?Select/) && type.match(/^M?SelectDynamic$/);
            this.__callOld();
            if (changeToItemset) {
                afterDynamicSelectInsert(mug.form, mug);
            }
        },
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

    function getDataSources(mug) {
        // get asynchronously loaded data if available
        var sources = mug.form.vellum.datasources.getDataSources([]);
        if (opts.dataSourcesFilter) {
            sources = opts.dataSourcesFilter(sources);
        }
        return sources;
    }

    function populateNodesetAttributes(mug, choices) {
        if (!mug.p.labelRef) {
            if (_.contains(choices, "name")) {
                mug.p.labelRef = "name";
            } else {
                mug.p.labelRef = choices[0];
            }
        }
        if (!mug.p.valueRef) {
            if (_.contains(choices, "@id")) {
                mug.p.valueRef = "@id";
            } else {
                mug.p.valueRef = choices.length > 1 ? choices[1] : choices[0];
            }
        }
        return mug;
    }

    function itemsetWidget(mug, options) {
        function isEmptyValue(value) {
            return !value || _.all(_.map(value, _.isEmpty));
        }

        function updateAutocomplete(data) {
            var value = super_getValue(),
                choices = datasourceWidgets.autocompleteChoices(data, value ? value.src : "");
            atwho.autocomplete(valueRef(), mug, {choices: choices});
            atwho.autocomplete(labelRef(), mug, {choices: choices});
            atwho.autocomplete(sortRef(), mug, {choices: choices});
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
                    mug = populateNodesetAttributes(mug, choices);
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

        function labelRef() { return $('#property-labelRef'); }
        function valueRef() { return $('#property-valueRef'); }
        function sortRef() { return $('#property-sortRef'); }

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
            widget = datasourceWidgets.fixtureWidget(mug, options, gettext("Lookup Table")),
            super_getValue = widget.getValue,
            super_setValue = widget.setValue,
            super_handleChange = widget.handleChange;

        widget.handleChange = function() {
            updateAutocomplete(dataSources);
            super_handleChange();
        };

        widget.getValue = function () {
            var val = super_getValue();
            return {
                instance: ($.trim(val.src) ? {id: val.id, src: val.src} : {id: null, src: null}),
                nodeset: val.query,
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
        };

        canUpdateAutocomplete = true;
        if (optionsLoaded) {
            // call again to update auto-complete and set defaults
            onOptionsLoaded(dataSources);
        }

        return widget;
    }

    function refWidget(mug, options) {
        var widget = widgets.text(mug, options);

        var value = mug.p.itemsetData,
            instance = value ? value.instance : null,
            src = instance ? instance.src : "",
            choices = datasourceWidgets.autocompleteChoices(getDataSources(mug), src);

        atwho.autocomplete(widget.input, mug, {choices: choices});

        return widget;
    }

    function validateRefWidget(attr) {
        return function(mug) {
            var itemsetData = mug.p.itemsetData,
                mugAttr = mug.p[attr],
                instance = itemsetData.instance,
                instanceSrc = instance ? instance.src : '',
                sources = getDataSources(mug),
                fixtures = datasourceWidgets.getPossibleFixtures(sources),
                notCustom = _.some(fixtures, function (fixture) {
                    return fixture.src === instanceSrc;
                }),
                choices = datasourceWidgets.autocompleteChoices(sources, instanceSrc),
                filterRegex = /\[[^\[]+]/g,
                strippedMugAttr = mugAttr.replace(filterRegex, "");

            if (notCustom && !_.contains(choices, strippedMugAttr)) {
                return util.format(
                    gettext("{attr} was not found in the lookup table"),
                    {attr: mugAttr}
                );
            }

            return 'pass';
        };
    }
});
