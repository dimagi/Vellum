define([
    'require',
    'underscore',
    'xpath',
    'vellum/tree',
    'vellum/logic',
    'vellum/widgets',
    'vellum/util'
], function (
    require,
    _,
    xpath,
    Tree,
    logic,
    widgets,
    util
) {
    // Load these dependencies in the background after all other run-time
    // dependencies have been resolved, since they shouldn't be necessary
    // initially.
    var writer,
        exporter;
    require(['vellum/writer', 'vellum/exporter'], function (w, e) {
        writer = w;
        exporter = e;
    });

    var FormError = function (options) {
        var that = {};
        that.message = options.message;
        // the key is how uniqueness is determined
        that.key = options.key; 
        that.level = options.level || "form-warning";
        that.options = options;
        
        that.isMatch = function (other) {
            if (this.key && other.key) {
                return this.key === other.key;
            }
            return false;
        };
        
        return that;
    };
    
    function processInstance(instance) {
        instance.defaultId = instance.defaultId || convertToId(instance.sourceUri);
        instance.id = instance.defaultId;
        _.each(instance.levels, function (level) {
            var i = 1,
                mappedSubsets = {};
            _.each(level.subsets, function (subset) {
                subset.id = i++;
                subset.selector = normalizeXPathExpr(subset.selector);
                mappedSubsets[subset.id] = subset;
            });
            level.subsets = mappedSubsets;
        });
        return instance;
    }
    
    // Parsing the instance selectors using the XPath models and comparing the
    // parsed expressions might be a better approach that these hacky functions.
    function normalizeXPathExpr(str) {
        return normalizeToSingleQuotes(removeSpaces(str));
    }

    // remove spaces around = and []
    function removeSpaces(str) {
        return str.replace(/\s*([=\[\]])\s*/g, function (match, p1) {
            return p1;
        });
    }

    // Change any top-level double quotes to single quotes. (Assumes no
    // top-level escaped double quotes).  This may not correctly handle escaped
    // quotes within a quote.  Moving on.
    function normalizeToSingleQuotes(str) {
        var ret = '';
        eachCharByQuotedStatus(str,
            function (c) {
                ret += c;
            },
            function (c) {
                if (c === '"') {
                    c = "'";
                }
                ret += c;
            });
        return ret;
    }

    // abstracted this because I was using it for two things before
    function eachCharByQuotedStatus(str, quoted, unquoted) {
        var prevIsBackslash = false,
            inSingleQuote = false,
            inDoubleQuote = false;

        for (var i=0, l=str.length; i < l; i++) {
            var c = str[i],
                inQuote = inSingleQuote || inDoubleQuote;
          
            if (!prevIsBackslash && ((inSingleQuote && c === "'") ||
                                     (inDoubleQuote && c === '"'))) {
                inQuote = false;
            }
            (inQuote ? quoted : unquoted)(c);

            if (!prevIsBackslash) {
                if (c === "'" && !inDoubleQuote) {
                    inSingleQuote = !inSingleQuote;
                } else if (c === '"' && !inSingleQuote) {
                    inDoubleQuote = !inDoubleQuote;
                }
            }

            if (c === '\\') {
                prevIsBackslash = !prevIsBackslash;
            } else {
                prevIsBackslash = false;
            }
        }
    }
    
    function convertToId(str) {
        return str
            .toLowerCase()
            .replace(/ /g,'_')
            .replace(/[^\w-]+/g,'');
    }
    
    var InstanceMetadata = function (attributes, children, mug, property) {
        var that = {},
            refs = {};
        that.attributes = attributes;
        that.children = children || [];

        /**
         * Add a reference from mug/property to this instance
         *
         * This does nothing if ref counting is disabled for this instance.
         *
         * @param mug - the referencing mug. Ref counting will be disabled
         *      for this instance if this is evaluates to false.
         * @param property - the property referencing this instance. A generic
         *      reference will be created if this evaluates to false.
         */
        that.addReference = function (mug, property) {
            if (!refs) { return; }
            if (!mug) {
                // disable ref counting for this instance. how unfortunate
                refs = null;
            } else {
                if (!refs[mug.ufid]) {
                    refs[mug.ufid] = {};
                }
                refs[mug.ufid][property || "."] = null;
            }
        };

        /**
         * Drop reference from mug/property to this instance
         *
         * @param mug - the referencing mug. Must be a real mug.
         * @param property - the property referencing this instance. All
         *      references from mug will be removed if this evaluates to false.
         * @returns - true if the last reference to this instance was dropped,
         *      otherwise false. Note: returns false if the given mug did not
         *      reference this instance, even if there are no other references.
         */
        that.dropReference = function (mug, property) {
            if (refs && refs[mug.ufid]) {
                if (property) {
                    delete refs[mug.ufid][property];
                    if (_.isEmpty(refs[mug.ufid])) {
                        delete refs[mug.ufid];
                    }
                } else {
                    delete refs[mug.ufid];
                }
                return _.isEmpty(refs);
            }
            return false;
        };

        if (!_.isUndefined(mug)) {
            that.addReference(mug, property);
        }
        return that;
    };
    var INSTANCE_REGEXP = /^instance\((['"])([^'"]+)\1\)/i;

    function Form (opts, vellum, mugTypes) {
        var _this = this;

        this.setValues = [];
        this._setValueId = 1;

        this._logicManager = new logic.LogicManager(this, {
                allowedDataNodeReferences: opts.allowedDataNodeReferences
            });

        // Some things in the form and mug methods depend on the UI.  These
        // should eventually be factored out.
        this.vellum = vellum;
        this.mugTypes = mugTypes;

        this.formName = 'New Form';
        this.mugMap = {};
        this.tree = new Tree('data', 'control');
        this.tree.on('change', function (e) {
            _this.fireChange(e.mug);
        });
        this.instanceMetadata = [InstanceMetadata({})];
        this.enableInstanceRefCounting = opts.enableInstanceRefCounting;
        this.errors = [];
        this.question_counter = 1;
        
        //make the object event aware
        util.eventuality(this);
    }

    Form.prototype = {
        dataTree: function() {
            var rootId = this.getBasePath().slice(1,-1),
                dataTree = new Tree(rootId, 'data'),
                diffDataParents = {},
                _this = this;
            this.tree.walk(function(mug, nodeID, processChildren) {
                if (mug) {
                    if (mug.options.isControlOnly) {
                        return;
                    } else if (mug.p.dataParent) {
                        var dp = mug.p.dataParent;
                        if (diffDataParents[dp]) {
                            diffDataParents[dp].push(mug);
                        } else {
                            diffDataParents[dp] = [mug];
                        }
                    } else {
                        dataTree.insertMug(mug, 'into', mug.parentMug);
                    }
                }
                processChildren();
            });
            _.each(diffDataParents, function (mugs, dataParent) {
                var dataParentMug = _this.mugMap[dataParent];
                for (var i = 0, len = mugs.length; i < len; i++) {
                    dataTree.insertMug(mugs[i], 'into', dataParentMug);
                }
            });
            return dataTree;
        },
        getBasePath: function (noSep) {
            return "/" + this.tree.getRootNode().getID() + (noSep ? "" : "/");
        },
        fireChange: function (mug) {
            this.fire({
                type: 'change',
                mug: mug
            });
        },
        /**
         * Add an instance if it is not already on the form
         *
         * @param attrs - Instance attributes. The `src` attribute is used to
         *          match other instances on the form, and is required. The
         *          instance will be unconditionally added and it's id returned
         *          if the instance has no `src` attribute.
         * @param mug - (optional) The mug with which this query is associated.
         *          This and the next parameter are used for instance ref
         *          counting. If omitted, ref counting will be disabled for the
         *          instance.
         * @param property - (optional) The mug property name.
         * @returns - The `id` of the added or already-existing instance.
         */
        addInstanceIfNotExists: function (attrs, mug, property) {
            if (attrs.src === null || _.isUndefined(attrs.src)) {
                // no ref counting for instances without a `src` since they cannot be dropped
                this.instanceMetadata.push(InstanceMetadata({
                    src: attrs.src,
                    id: attrs.id
                }));
                return attrs.id;
            }

            var meta = _.find(this.instanceMetadata, function (m) {
                    return m.attributes.src === attrs.src;
                });
            if (!meta) {
                this.instanceMetadata.push(InstanceMetadata({
                    src: attrs.src,
                    id: attrs.id
                }, null, mug || null, property));
                return attrs.id;
            } else if (this.enableInstanceRefCounting) {
                meta.addReference(mug, property);
            }
            return meta.attributes.id;
        },
        /**
         * Parse query and get instance metadata
         *
         * This adds a reference to the instance if found.
         *
         * @param query - A query string, which may start with "instance(...)"
         * @param mug - The mug with which this query is associated.
         * @param property - (optional) The mug property name for the query.
         * @reutrns - an object containing instance attributes or null.
         */
        parseInstance: function (query, mug, property) {
            var match = query.match(INSTANCE_REGEXP),
                instance = null;
            if (match) {
                var instanceId = match[2],
                    meta = this._referenceInstance(instanceId, mug, property);
                if (meta) {
                    instance = _.clone(meta.attributes);
                }
            }
            return instance;
        },
        _referenceInstance: function (id, mug, property) {
            var meta = _.find(this.instanceMetadata, function (meta) {
                    return meta.attributes.id === id;
                });
            if (meta && this.enableInstanceRefCounting) {
                meta.addReference(mug, property);
            }
            return meta || null;
        },
        /**
         * Replace the instance id in the given query (utility function)
         *
         * Is it too magical to replace the instance id in the query?
         * There might be edge cases where a user is entering a
         * custom instance and query and does not want this.
         */
        updateInstanceQuery: function (query, instanceId) {
            return query.replace(INSTANCE_REGEXP, "instance('" + instanceId + "')");
        },
        /**
         * Drop instance reference, possibly removing the instance
         *
         * @param src - The instance `src` attribute value.
         * @param mug - (optional) A mug that references the query.
         * @param property - (optional) The mug property name for the query.
         * @returns - True if the instance was removed, otherwise false.
         */
        dropInstanceReference: function (src, mug, property) {
            if (!this.enableInstanceRefCounting || !mug) {
                return false;
            }
            var meta = _.find(this.instanceMetadata, function (m) {
                    return m.attributes.src === src;
                });
            if (meta) {
                if (meta.dropReference(mug, property)) {
                    this.instanceMetadata = _.without(this.instanceMetadata, meta);
                    return true;
                }
            }
            return false;
        },
        // todo: update references on rename
        addSetValue: function (event, ref, value) {
            var setValue = _.find(this.setValues, function (setValue) {
                return setValue.event === event && setValue.ref === ref;
            });
            if (setValue) {
                setValue.value = value;
            } else {
                setValue = {
                    _id: this._setValueId++,
                    event: event,
                    ref: ref,
                    value: value
                };
                this.setValues.push(setValue);
            }
            return setValue;
        },
        getSetValues: function () {
            return this.setValues;
        },
        dropSetValues: function (predicate) {
            // Remove all <setvalue> elements matching predicate
            this.setValues = _.reject(this.setValues, predicate);
        },
        setFormID: function (id) {
            this.tree.setRootID(id);
        },
        setAttr: function (slug, val) {
            this[slug] = val;
            this.fire({
                type: 'change'
            });
        },
        createXML: function () {
            return writer.createXForm(this);
        },
        /**
         * Walks through internal tree and grabs
         * all mugs that are not (1)Choices.  Returns
         * a flat list of unique mugs.  This list is primarily for the
         * autocomplete skip logic wizard.
         */
        getMugList: function () {
            return this.tree.treeMap( function (node) {
                if(node.isRootNode) {
                    return;
                }

                return node.getValue();
            });
        },
        updateError: function (errObj, options) {
            errObj = FormError(errObj);
            options = options || {};
            if (!errObj.key) {
                this.errors.push(errObj);
            }
            else {
                var removed = null;
                for (var i = 0; i < this.errors.length; i++) {
                    if (errObj.isMatch(this.errors[i])) {
                        removed = this.errors.splice(i, 1, errObj);
                    }
                }
                if (!removed) {
                    this.errors.push(errObj);
                }
            }
            this.fire({
                type: 'error-change',
                errors: this.errors
            });
        },
        clearErrors: function (type, options) {
            var filterFn = function (err) {
                return err.level !== type;
            };
            options = options || {};
            for (var i = 0; i < this.errors.length; i++) {
                this.errors = this.errors.filter(filterFn);
            }
            this.fire({
                type: 'error-change',
                errors: this.errors
            });
        },
        isFormValid: function (validateMug) {
            return this.tree.isTreeValid(validateMug);
        },
        getMugChildrenByNodeID: function (mug, nodeID) {
            var parentNode = (mug ? this.tree.getNodeFromMug(mug)
                                  : this.tree.rootNode);
            return _.filter(parentNode.getChildrenMugs(), function (m) {
                return m.p.nodeID === nodeID;
            });
        },
        insertMug: function (refMug, newMug, position) {
            this.tree.insertMug(newMug, position, refMug);
        },
        /**
         * Move a mug from its current place to
         * the position specified by the arguments,
         */
        moveMug: function (mug, refMug, position) {
            var oldPath = this.tree.getAbsolutePath(mug);

            this.insertMug(refMug, mug, position);

            var currentPath = this.tree.getAbsolutePath(mug);
            this.vellum.handleMugRename(
                this, mug, mug.p.nodeID, mug.p.nodeID, currentPath, oldPath);

            this.fire({
                type: 'question-move',
                mug: mug
            });
            this.fireChange(mug);
        },
        /**
         * Walk through the mugs of the tree and call valueFunc on each mug
         *
         * @param valueFunc - a function called for each mug in the tree. The
         * single argument is the mug.
         */
        walkMugs: function (valueFunc) {
            function callback(mug, nodeID, processChildren) {
                if (mug !== null) {
                    valueFunc(mug);
                }
                processChildren();
            }
            this.tree.walk(callback);
        },
        getDescendants: function (mug) {
            var desc = this.getChildren(mug), i;
            for (i = desc.length - 1; i >= 0; i--) {
                desc = desc.concat(this.getDescendants(desc[i]));
            }
            return desc;
        },
        handleMugRename: function (mug, currentId, oldId, currentPath, oldPath) {
            this._logicManager.updatePath(mug.ufid, oldPath, currentPath);
            this.mugWasRenamed(mug, oldId, oldPath);
        },
        /**
         * Update references to mug and its children after it is renamed.
         */
        mugWasRenamed: function(mug, oldName, oldPath) {
            function getPreMovePath(postPath) {
                if (postPath === mugPath) {
                    return oldPath;
                }
                return postPath.replace(postRegExp, oldPath + "/");
            }
            var tree = this.tree,
                mugPath = tree.getAbsolutePath(mug);
            if (!mugPath) {
                // Items don't have an absolute path. I wonder if it would
                // matter if they had one?
                return;
            }
            var mugs = this.getDescendants(mug).concat([mug]),
                postMovePaths = _(mugs).map(function(mug) { return tree.getAbsolutePath(mug); }),
                postRegExp = new RegExp("^" + RegExp.escape(mugPath) + "/"),
                updates = {},
                preMovePath;
            for (var i = 0; i < mugs.length; i++) {
                if (postMovePaths[i]) {
                    preMovePath = getPreMovePath(postMovePaths[i]);
                    updates[mugs[i].ufid] = [preMovePath, postMovePaths[i]];
                    this._updateMugPath(mugs[i], preMovePath, postMovePaths[i]);
                }
            }
            this._logicManager.updatePaths(updates);
            this.fixBrokenReferences(mug);
        },
        changeMugType: function (mug, questionType) {
            this.mugTypes.changeType(mug, questionType);
        },
        getChildren: function (mug) {
            var ctrlNode = this.tree.getNodeFromMug(mug),
                ctrlNodes = ctrlNode ? ctrlNode.getChildren() : [];
            return ctrlNodes.map(function (item) { return item.getValue(); });
        },
        duplicateMug: function (mug) {
            var foo = this._duplicateMug(mug, mug.parentMug),
                duplicate = foo[0],
                pathReplacements = foo[1];

            if (typeof window.ga !== "undefined") {
                window.ga('send', 'event', 'Form Builder', 'Copy', duplicate.options.typeName);
            }

            for (var i = 0; i < pathReplacements.length; i++) {
                var pr = pathReplacements[i];
                this._logicManager.updatePath(pr.mugId, pr.from, pr.to, 
                    this.getAbsolutePath(duplicate));
            }
            return duplicate;
        },
        /**
         * Copy a Mug and its descendants and insert them after the original
         * Mug. Returns an array with two values:
         *  1. The duplicate Mug.
         *  2. An array of path replacements that should be executed on logic references.
         *
         * @param mug - the mugtype in the original tree to duplicate
         * @param parentMug - the mugtype in the duplicate tree to insert into
         *        
         */
        _duplicateMug: function (mug, parentMug, depth) {
            depth = depth || 0;
            var duplicate = this.mugTypes.make(mug.__className, this, mug);

            if (depth === 0) {
                var nodeID = mug.p.nodeID;
                if (nodeID) {
                    var newQuestionID = this.generate_question_id(nodeID); 
                    duplicate.p.nodeID = newQuestionID;
                } else {
                    var newItemValue = this.generate_question_id(
                        mug.p.defaultValue);
                    duplicate.p.defaultValue = newItemValue;
                }
                
                this.insertQuestion(duplicate, mug, 'after', true);
            } else {
                this.insertQuestion(duplicate, parentMug, 'into', true);
            }

            this.updateAllLogicReferences(duplicate);
            this.vellum.duplicateMugProperties(duplicate);

            var children = this.getChildren(mug),
                pathReplacements = [];
            for (var i = 0; i < children.length; i++) {
                pathReplacements = pathReplacements.concat(
                    this._duplicateMug(children[i], duplicate, depth + 1)[1]);
            }

            pathReplacements.push({
                mugId: mug.ufid,
                from: this.getAbsolutePath(mug),
                to: this.getAbsolutePath(duplicate)
            });

            return [duplicate, pathReplacements];
        },
        updateAllLogicReferences: function (mug) {
            this._logicManager.updateAllReferences(mug);
        },
        /**
         * Determine if a mug property should change
         *
         * This method must be called before the property value has changed.
         *
         * Returns a function that should be called after the property has
         * changed; null if the property should not change.
         */
        shouldMugPropertyChange: function (mug, property, value, previous) {
            if (this.isLoadingXForm) {
                // skip property change handlers during loading phase
                return function () {};
            }
            // update the logic properties that reference the mug
            if (property === 'nodeID' && previous &&
                this.getMugChildrenByNodeID(mug.parentMug, value).length > 0)
            {
                // Short-circuit invalid change and trigger warning in UI
                this.vellum.setUnsavedDuplicateNodeId(value);
                return null;
            }

            return function () {
                var event = {
                    type: 'mug-property-change',
                    mug: mug,
                    property: property,
                    val: value,
                    previous: previous
                };
                this.handleMugPropertyChange(mug, event);
                this.fire(event);

                // legacy, enables auto itext ID behavior, don't add
                // additional dependencies on this code.  Some sort of
                // data binding would be better.
                mug.fire({
                    type: 'property-changed',
                    property: property,
                    val: value,
                    previous: previous
                });

                this.fireChange(mug);
            }.bind(this);
        },
        handleMugPropertyChange: function (mug, e) {
            if (e.property === 'nodeID') {
                var currentPath = this.getAbsolutePath(mug),
                    valid = true,
                    parsed;
                try {
                    parsed = xpath.parse(currentPath);
                    if (_.isUndefined(parsed.steps)) {
                        valid = false;
                    }
                } catch (err) {
                    valid = false;
                }
                if (valid) {
                    parsed.steps[parsed.steps.length - 1].name = e.previous;
                    var oldPath = parsed.toXPath();
                    this.vellum.handleMugRename(this, mug, e.val, e.previous, currentPath, oldPath);
                }
            } else {
                if (mug.p.getDefinition(e.property).widget === widgets.xPath ||
                    mug.p.getDefinition(e.property).widget === widgets.droppableText) {
                    this.updateAllLogicReferences(mug);
                }
            }
        },
        createQuestion: function (refMug, position, newMugType, isInternal) {
            var mug = this.mugTypes.make(newMugType, this);
            if (!mug.options.isControlOnly) {
                mug.p.nodeID = this.generate_question_id();
            }
            if (mug.__className === "Item") {
                var parent = refMug.__className === "Item" ? refMug.parentMug : refMug;
                mug.p.defaultValue = this.generate_item_label(parent);
            }
            this.insertQuestion(mug, refMug, position, isInternal);
            // should we fix broken references when nodeID is auto-generated?
            //if (!mug.options.isControlOnly && !this.isLoadingXForm) {
            //    this.fixBrokenReferences(mug);
            //}
            if (mug.options.isODKOnly) {
                this.updateError({
                    message: mug.options.typeName + ' works on Android devices ' +
                        'and some feature phones; please test your specific ' +
                        'model to ensure that this question type is supported',
                    level: 'form-warning'
                });
            }
            return mug;
        },
        insertQuestion: function (mug, refMug, position, isInternal) {
            this.mugMap[mug.ufid] = mug;
            refMug = refMug || this.tree.getRootNode().getValue();
            this.insertMug(refMug, mug, position);
            this._updateMugPath(mug);
            // todo: abstraction barrier

            this.fire({
                type: 'question-create',
                mug: mug,
                refMug: refMug,
                position: position,
                isInternal: isInternal
            });
            if (!isInternal) {
                mug.options.afterInsert(this, mug);
            }
        },
        _updateMugPath: function (mug, oldPath, newPath) {
            var map = this.mugMap;
            delete map[oldPath];
            if (_.isUndefined(newPath)) {
                newPath = this.getAbsolutePath(mug);
            }
            if (newPath) {
                map[newPath] = mug;
            }
        },
        _fixMugState: function (mug) {
            // parser needs this because it inserts directly into the tree
            this.mugMap[mug.ufid] = mug;
            var path = this.tree.getAbsolutePath(mug);
            if (path) {
                this.mugMap[path] = mug;
            }
        },
        fixBrokenReferences: function (mug) {
            function updateReferences(mug) {
                _this.updateAllLogicReferences(mug);
                _this.vellum.setTreeValidationIcon(mug);
            }
            var _this = this;
            this._logicManager.forEachBrokenReference(updateReferences);
        },
        /**
         * Get the logical path of the mug's node in the data tree
         *
         * Invariant: absolute paths returned by this function are always
         * data paths, and may not match the control hierarchy.
         *
         * It is not always possible to lookup a mug by traversing the tree
         * using it's absolute path. For example, some mugs encapsulate multiple
         * levels of XML elements. This Form object maintains a hash table to
         * quickly get a mug by its path.
         */
        getAbsolutePath: function (mug, excludeRoot) {
            if (mug && !mug.options.isControlOnly) {
                return this.tree.getAbsolutePath(mug, excludeRoot);
            }
            return null;
        },
        getMugByUFID: function (ufid) {
            return this.mugMap[ufid];
        },
        getMugByPath: function (path) {
            if(!path) { //no path specified
                return null;
            }
            return this.mugMap[path];
        },
        removeMugFromForm: function (mug) {
            function breakReferences(mug) {
                if (!seen.hasOwnProperty(mug.ufid)) {
                    seen[mug.ufid] = null;
                    _this.updateAllLogicReferences(mug);
                    _this.vellum.setTreeValidationIcon(mug);
                }
            }
            var _this = this,
                seen = {},
                mugs = this.getDescendants(mug).concat([mug]),
                ufids = _.object(_(mugs).map(function(mug) { return [mug.ufid, null]; }));
            this._removeMugFromForm(mug, false);
            this._logicManager.forEachReferencingProperty(ufids, breakReferences);
        },
        _removeMugFromForm: function(mug, isInternal) {
            var fromTree = this.tree.getNodeFromMug(mug);
            if (fromTree) {
                var children = this.tree.getNodeFromMug(mug).getChildrenMugs();
                for (var i = 0; i < children.length; i++) {
                    this._removeMugFromForm(children[i], true);
                }
            }
            if (this.enableInstanceRefCounting) {
                this.instanceMetadata = _.filter(this.instanceMetadata, function (meta) {
                    return !meta.dropReference(mug);
                });
            }
            delete this.mugMap[mug.ufid];
            delete this.mugMap[this.tree.getAbsolutePath(mug)];
            this.tree.removeMug(mug);
            this.fire({
                type: 'question-remove',
                mug: mug,
                isInternal: isInternal
            });
        },
        questionIdCount: function (qId) {
            var allMugs = this.getMugList(),
                count = 0;
            for (var i = 0; i < allMugs.length; i++) {
                var mug = allMugs[i];
                if (qId === mug.p.nodeID || qId === mug.p.defaultValue) {
                    count++; 
                }
            }
            return count;
        },

        /**
         * Generates a unique question ID (unique in this form) and
         * returns it as a string.
         */
        generate_question_id: function (question_id) {
            if (question_id) {
                var match = /^copy-(\d+)-of-(.+)$/.exec(question_id) ;
                if (match) {
                    question_id = match[2]; 
                }
                for (var i = 1;; i++) {
                    var new_id = "copy-" + i + "-of-" + question_id;
                    if (!this.questionIdCount(new_id)) {
                        return new_id; 
                    }
                }
            } else {
                return this._make_label('question');
            }
        },
        generate_item_label: function (parentMug, name, i) {
            var node = (parentMug ? this.tree.getNodeFromMug(parentMug)
                                  : this.tree.rootNode),
                items = node.getChildrenMugs(),
                ret;
            if (!name) { name = "item"; }
            if (arguments.length < 3) {
                i = items.length + 1;
            }
            do {
                ret = name + i++;
            } while (_.any(items, function (item) {
                return item.getNodeID() === ret;
            }));
            return ret;
        },
        /**
         * Private method for constructing unique questionIDs, labels for items, etc
         */
        _make_label: function (prefixStr) {
            var ret;
            do {
                ret = prefixStr + this.question_counter;
                this.question_counter += 1;
            } while (this.questionIdCount(ret));
            return ret;
        },
        getExportTSV: function () {
            this.vellum.beforeSerialize();
            var value = exporter.generateExportTSV(this);
            this.vellum.afterSerialize();
            return value;
        }
    };

    return {
        Form: Form,
        processInstance: processInstance,
        normalizeXPathExpr: normalizeXPathExpr,
        InstanceMetadata: InstanceMetadata
    };
});
