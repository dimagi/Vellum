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
    'vellum/form',
    'vellum/mugs',
    'vellum/util',
    'vellum/core',
    'jquery.bootstrap-better-typeahead'
], function (
    _,
    $,
    external_data_source,
    custom_data_source,
    widgets,
    form,
    mugs,
    util
) {
    var mugTypes = mugs.baseMugTypes.normal,
        normalizeXPathExpr = form.normalizeXPathExpr,
        NONE = "NONE",
        CUSTOM = "CUSTOM";

    var Itemset = util.extend(mugs.defaultOptions, {
        isControlOnly: true,
        typeName: 'External Data',
        icon: 'icon-circle-blank',
        isTypeChangeable: false,
        // have to delete the parent select
        isRemoveable: false,
        isCopyable: false,
        getIcon: function (mug) {
            if (mug.parentMug.__className === "SelectDynamic") {
                return 'icon-circle-blank';
            } else {
                return 'icon-check-empty';
            }
        },
        init: function (mug, form, baseSpec) {
            mug.p.tagName = "itemset";
            mug.p.itemsetData = new util.BoundPropertyMap(mug.form, {
                // avoids serialization error
                nodeset: ''
            });
        },
        spec: {
            label: { presence: 'notallowed' },
            labelItext: { presence: 'notallowed' },
            labelItextID: { presence: 'notallowed' },
            hintLabel: { presence: 'notallowed' },
            hintItextID: { presence: 'notallowed' },
            mediaItext: { presence: 'notallowed' },
            otherItext: { presence: 'notallowed' },
            itemsetData: {
                visibility: 'visible_if_present',
                presence: 'optional',
                widget: itemsetWidget,
                validationFunc: function (mug) {
                    var itemsetData = mug.p.itemsetData;
                    if (!itemsetData.getAttr('nodeset')) {
                        return "A data source must be selected.";
                    }
                    if (!itemsetData.getAttr('valueRef')) {
                        return "Choice Value must be specified.";
                    }
                    if (!itemsetData.getAttr('labelRef')) {
                        return "Choice Label must be specified.";
                    }
                    return 'pass';
                }
            }
        }
    });

    function afterDynamicSelectInsert(form, mug) {
        form.createQuestion(mug, 'into', "Itemset", true);
    }

    $.vellum.plugin("itemset", {}, {
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
                    typeName: 'Multiple Answer - Dynamic List',
                    limitTypeChangeTo: ["SelectDynamic"],
                    validChildTypes: ["Itemset"],
                    maxChildren: 1,
                    afterInsert: afterDynamicSelectInsert,
                }),
                "SelectDynamic": util.extend(mugTypes.Select, {
                    typeName: 'Single Answer - Dynamic List',
                    limitTypeChangeTo: ["MSelectDynamic"],
                    validChildTypes: ["Itemset"],
                    maxChildren: 1,
                    afterInsert: afterDynamicSelectInsert
                })
            });
            return types;
        },
        getMugSpec: function () {
            var spec = this.__callOld();

            return spec;
        }
    });

    function itemsetWidget(mug, options) {
        var widget = widgets.normal(mug, options),
            externalInstances = mug.form.externalInstances,
            itemsetData = mug.p.itemsetData,
            getUIElement = widgets.util.getUIElement,
            getUIElementWithEditButton = widgets.util.getUIElementWithEditButton,
            $nodeset;

        widget.getUIElement = function () {
            var valueRef = getUIElement(
                    $valueRefSelect, "Choice Value", widget.isDisabled()),
                labelRef = getUIElement(
                    $labelRefSelect, "Choice Label", widget.isDisabled()),
                source = getUIElement($sourceSelect, "Data Source", widget.isDisabled()),
                condition = getUIElementWithEditButton(
                    getUIElement($filterInput, "Filter Condition"), 
                    function () {
                        widget.options.displayXPathEditor({
                            value: $filterInput.val(),
                            xpathType: 'bool',
                            done: function (val) {
                                if (val !== false) {
                                    $filterInput.val(val).change();
                                }
                            }
                        });
                    }
                );

            $nodeset = $("<div></div>"
                    ).append(valueRef).append(labelRef).append(condition);
            return $("<div></div>").append(source).append($nodeset);
        };
        
        function updateValue() {
            itemsetData.setAttr('valueRef', $valueRefSelect.val());
            itemsetData.setAttr('labelRef', $labelRefSelect.val());

            var sourceId = $sourceSelect.val(),
                pieces = sourceId.split(':'),
                nodeset;

            if (pieces[0] !== NONE) {
                var foo = getNodesetAndInstance(externalInstances, origLevels,
                        pieces[0], pieces[1], $.trim($filterInput.val())),
                    instance = foo[1];
                mug.form.addInstanceIfNotExists({
                        src: instance.sourceUri,
                        id: instance.defaultId
                });
                nodeset = foo[0];
            } else {
                nodeset = '';
            }
            itemsetData.setAttr('nodeset', nodeset);
        }
        
        // Only expose last level in UI for now; If a nodeset has filter conditions
        // on internal levels, they're stored here and will be written back when
        // the question is saved, as long as the data source is never changed (even
        // if it's changed back).
        var origLevels;
        
        widget.setValue = function (val) {
            var nodeset = val.getAttr('nodeset'),
                valueRef = val.getAttr('valueRef'),
                labelRef = val.getAttr('labelRef');

            populateSourceSelect();
            if (!nodeset) {
                // for some reason the other inputs that need to be greyed out don't
                // seem to be rendered at this point the first time the question
                // properties are loaded
                setTimeout(function () {
                    $sourceSelect.val(NONE).change();
                }, 50);
                return;
            }
            
            var foo = getSourceData(nodeset, externalInstances),
                sourceId = foo.instanceId,
                leafLevel = foo.levels[foo.levels.length - 1];

            if (leafLevel && leafLevel.subsetId !== false) {
                sourceId += ":" + leafLevel.subsetId;
            }

            $sourceSelect.val(sourceId);
            handleSourceChange(sourceId);
            origLevels = foo.levels;
            if (leafLevel && leafLevel.condition) {
                $filterInput.val(leafLevel.condition);
            }
            if (valueRef) {
                $valueRefSelect.val(valueRef);
            }
            if (labelRef) {
                $labelRefSelect.val(labelRef);
            }
        };
        
      
        // This is just a dummy select that gets inserted in getUIElement() and then
        // immediately replaced via populateSourceSelect() when setValue() is
        // called, and thereafter whenever a new custom source is added.
        var $sourceSelect = $("<select name='data_source'></select>"),
            // this stores the previous source id for when you select custom but
            // then cancel out of it
            oldSourceVal;
        function populateSourceSelect() {
            $sourceSelect = $(external_data_source({
                options: getSourceOptions(externalInstances),
                NONE: NONE,
                CUSTOM: CUSTOM
            })).change(function () {
                handleSourceChange($(this).val());
                updateValue();
            });
            mug.form.vellum.$f.find('[name="data_source"]')
                .replaceWith($sourceSelect);
            oldSourceVal = NONE;
        }

        var $valueRefSelect = $("<input type='text' name='value_ref' class='input-block-level'>"),
            $labelRefSelect = $("<input type='text' name='label_ref' class='input-block-level'>");

        _.each([$valueRefSelect, $labelRefSelect], function ($select) {
            $select.typeahead({minLength: 0, items: Infinity})
                .on('change keyup', updateValue)
                .on('focus', function () {
                    if (!$(this).val()) {
                        $(this).data('typeahead').lookup();
                    }
                });
        });

        var $filterInput = $(
            "<input type='text' name='filter_condition' class='input-block-level'/>"
        ).on('change keyup', updateValue);
       
        function handleSourceChange(val) {
            if (!$nodeset) {
                return;
            }

            var $stuff = $nodeset.find("input, button");
            if (val === CUSTOM) {
                showCustomModal();
            } else {
                origLevels = null;
                if (val === NONE) {
                    $stuff.addClass('disabled').prop('disabled', true);
                } else {
                    $stuff.removeClass('disabled').prop('disabled', false);
                }
                var pieces = val.split(':'),
                    oldPieces = oldSourceVal.split(':'),
                    properties = getProperties(externalInstances, pieces[0], pieces[1]);
               
                _.each([$labelRefSelect, $valueRefSelect], function ($select) {
                    $select.data('typeahead').source = properties;
                    if (properties.indexOf($select.val()) === -1) {
                        $select.val('');
                    }
                });
                if (pieces[0] !== oldPieces[0]) {
                    $filterInput.val('');
                }
                oldSourceVal = val;
            }
        }

        function showCustomModal() {
            var $modal = $(custom_data_source());
            $modal.find('.data_source_cancel').click(function () {
                $sourceSelect.val(oldSourceVal);
                $modal.modal('hide');
                $modal.remove();
            });
            $modal.find('.data_source_save').click(function () {
                var sourceUri = $.trim($modal.find('[name="source_uri"]').val()),
                    nodeLevels = $.trim($modal.find('[name="node_levels"]').val());
                nodeLevels = nodeLevels ? nodeLevels.split('/') : null;
                var nodeLevelsValid = nodeLevels && _.all(nodeLevels, function (l) {
                    return l.match(/^[a-z0-9]+$/i);
                }) && nodeLevels.length > 1;

                if (sourceUri && nodeLevelsValid) {
                    var instance = form.processInstance({
                        sourceUri: sourceUri,
                        levels: _.map(nodeLevels, function (l) {
                            return {nodeName: l};
                        })
                    });
                    mug.form.addInstance(instance);
                    populateSourceSelect();
                    $sourceSelect.val(instance.id).change();

                    $modal.modal('hide');
                } else {
                    $modal.find(".source_error").removeClass('hide');
                }
            });
            $("body").append($modal);
            $modal.modal('show');
        }
        
        return widget;
    }
    
    function getNodesetAndInstance(externalInstances, origLevels, instanceId,
                                   leafSubsetId, leafFilterCondition) 
    {
        leafFilterCondition = $.trim(leafFilterCondition);

        var instance = externalInstances[instanceId],
            nodeset = "instance('" + instanceId + "')/" + instance.rootNodeName,
            butLastLevels = instance.levels.slice(0, instance.levels.length - 1),
            leafLevel = instance.levels[instance.levels.length - 1];

        _.each(butLastLevels, function (level, i) {
            nodeset += '/' + level.nodeName;
            if (origLevels && origLevels[i]) {
                var origLevel = origLevels[i];
                if (origLevel.subsetId !== false) {
                    nodeset += "[" + level.subsets[origLevel.subsetId].selector + "]";
                }
                if (origLevel.condition) {
                    nodeset += "[" + origLevel.condition + "]";
                }
            }
        });

        nodeset += '/' + leafLevel.nodeName;
        if (leafSubsetId) {
            var subsets = instance.levels[instance.levels.length - 1].subsets,
                subset = subsets[leafSubsetId];

            nodeset += "[" + subset.selector + "]";
        }

        if (leafFilterCondition) {
            nodeset += "[" + leafFilterCondition + "]";
        }
        return [nodeset, instance];
    }

    function getSourceOptions(instanceDefs) {
        var options = [];
        _.each(instanceDefs, function (instance) {
            options.push({
                name: instance.name || instance.sourceUri,
                value: instance.id
            });
            // for now we only do anything with the subsets of the last
            // level
            var leafLevel = instance.levels[instance.levels.length - 1];
            _.each(leafLevel.subsets, function (subset) {
                options.push({
                    name: "- " + subset.name,
                    value: instance.id + ':' + subset.id
                });
            });
        });
        return options;
    }

    function getProperties(instanceDefs, instanceId, leafSubsetId) {
        if (instanceId === NONE) {
            return [];
        }
        var instance = instanceDefs[instanceId],
            leafLevel = instance.levels[instance.levels.length - 1] || {},
            subset = (leafLevel.subsets || {})[leafSubsetId] || {};
        var ret = _.uniq(_.flatten(
            _.map([{}, leafLevel.properties || {}, subset.properties || {}],
                  function (l) { return _.pluck(l, 'id'); })));
        ret.sort();
        return ret;
    }


    // Currently this all happens in the UI layer.  In the future, if we need to be
    // able to rename properties and do other intelligent stuff regarding filter
    // conditions, it may be necessary to have this information be persistent in the
    // model. Or not.
    function getSourceData(nodeset, instanceDefs) {
        if (!nodeset) {
            return false;
        }
        nodeset = normalizeXPathExpr(nodeset);
        var match = nodeset.match(/instance\('(.+?)'\)/),
            instanceId = match ? match[1] : false;
        if (!instanceId) {
            return false;
        }
        var instanceDef = instanceDefs[instanceId],
            levelInfo = [];

        if (instanceDef) {
            for (var k in instanceDef.levels) {
                if (instanceDef.levels.hasOwnProperty(k)) {
                    // assumes all levels have unique nodeNames
                    var level = instanceDef.levels[k],
                        subsets = level.subsets,
                        subsetId = false;
                    for (var j in subsets) {
                        if (subsets.hasOwnProperty(j)) {
                            // Test nodeset for subset selector at appropriate level.
                            // If present, remove subset selector from nodeset and
                            // record it as one of the explicit subsets that this
                            // nodeset level uses.
                            var subset = subsets[j],
                                selector = normalizeXPathExpr(subset.selector),
                                subsetRegex = new RegExp(
                                    '/' + level.nodeName + "([^/]*)" +
                                    "\\[" + RegExp.escape(selector) + "\\]");
                            if (nodeset.match(subsetRegex)) {
                                subsetId = subset.id; 
                                nodeset = nodeset.replace(subsetRegex, function (match, p1) {
                                    return '/' + level.nodeName + p1;
                                }); 
                                // subsets of a level are assumed to be mutually
                                // exclusive
                                break;
                            }
                        }
                    }
                    var foo = extractLevelCondition(nodeset, level.nodeName);
                    // the nodeset doesn't go all the way to the leaf level
                    if (foo === false) {
                        break;
                    }
                    nodeset = foo[0];
                    levelInfo.push({
                        subsetId: subsetId,
                        condition: foo[1]
                    });
                }
            }
        }
        return {
            instanceId: instanceId,
            levels: levelInfo
        };
    }

    function extractLevelCondition(nodeset, nodeName) {
        var filterRegex = new RegExp(
            '/' + nodeName + "(\\[.+?\\])?(/|$)"),
            condition = false;

        if (!nodeset.match(filterRegex)) {
            return false;
        }

        nodeset = nodeset.replace(filterRegex, function (match, p1, p2) {
            if (!p1) {
                return match;
            }
            condition = getConditionFromSelectors(p1);
            return '/' + nodeName + p2;
        });

        return [nodeset, condition];
    }

    function getConditionFromSelectors(str) {
        var matches = str.match(/\[[^\]]+?\]/g),
            condition = false;
        if (matches && matches.length) {
            if (matches.length === 1) {
                condition = trimBrackets(matches[0]);
            } else {
                condition = _.map(matches, function (s) {
                    return "(" + trimBrackets(s) + ")";
                }).join(" and "); 
            }
        }
        return condition;
    }

    function trimBrackets(str) {
        return str.substring(1, str.length - 1);
    }

//    function getAvailableProperties(instanceDefs, instanceId, subsetId) {
//        var instanceDef = instanceDefs[instanceId] || {},
//            instanceProps = instanceDef.properties || {},
//            subsetDef = instanceDef.subset || {},
//            subsetProps = subsetDef.properties || {};
//        return $.extend({}, instanceProps, subsetProps);
//    }

    // for testing
    return {
        getSourceData: getSourceData
    };
});
