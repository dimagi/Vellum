define([
    'require',
    'underscore',
    'jquery',
    'vellum/tree',
    'vellum/logic',
    'vellum/richText',
    'vellum/xpath',
    'vellum/fuse',
    'vellum/undomanager',
    'vellum/util'
], function (
    require,
    _,
    $,
    Tree,
    logic,
    richText,
    xpath,
    Fuse,
    undomanager,
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
    var INSTANCE_REGEXP = /(^)instance\((['"])([^'"]+)\2\)/i;

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

        this.formName = vellum.opts().core.formName || "New Form";
        this.noMarkdown = false;
        this.mugMap = {};
        this.instanceMetadata = [InstanceMetadata({})];
        // {<instance id>: { src or children: <instance src or children>}
        this.knownInstances = {};
        this.richText = !!vellum.opts().features.rich_text;
        // TODO remove mayDisableRichText once the rich_text feature is enabled
        // by default. Otherwise instances of vellum loaded without rich_text
        // specified in features will always write vellum:ignore="richText"
        this.mayDisableRichText = this.richText;

        vellum.datasources.on("change", this._updateHashtags.bind(this), null, null, this);
        this._updateHashtags();

        this.tree = new Tree('data', 'control');
        // initalize #form as /data
        // if data is not root node, it will be changed later
        this.addHashtag('#form', '/data');
        this.tree.on('change', function (e) {
            _this.fireChange(e.mug);
        });
        this.enableInstanceRefCounting = opts.enableInstanceRefCounting;
        this.errors = [];
        this.question_counter = 1;
        this.xpath = xpath.parser(this);
        this.undomanager = new undomanager();

        this.undomanager.on('reset', function(e) {
            _this.vellum.adjustToWindow();
        });

        //make the object event aware
        util.eventuality(this);
        this.on('form-load-finished', function() {
            _this.fuse = new Fuse(_this);
        }).on('question-create', function () {
            _this.undomanager.resetUndo();
        });
        this.disconnectDataSources = function () {
            vellum.datasources.unbind(_this, "change");
        };
    }

    Form.prototype = {
        _updateHashtags: function () {
            var form = this,
                vellum = form.vellum,
                oldHashtags = form.hashtagMap;
            if (form.richText) {
                // TODO always load hashtags, even when rich text is disabled
                form.hashtagMap = _.clone(vellum.datasources.getHashtagMap({}));
                form.invertedHashtagMap = _.invert(form.hashtagMap);
                form.hashtagTransformations = vellum.datasources.getHashtagTransforms({});
                form.hasCaseHashtags = true;
            } else {
                form.hashtagMap = {};
                form.invertedHashtagMap = {};
                form.hashtagTransformations = {};
            }
            form.updateKnownInstances(
                _.chain(vellum.datasources.getDataSources([]))
                 .map(function (source) { return [source.id, source.uri]; })
                 .object()
                 .value()
            );
            if (oldHashtags) {
                _.each(oldHashtags, function (xpath, tag) {
                    if (tag.startsWith("#form/")) {
                        form.addHashtag(tag, xpath);
                    }
                });
            }
            // done here for performance reasons. would be nice to be done after
            // every new hashtag, but only for the mugs that reference that hashtag
            form.fixBrokenReferences();
        },
        isValidHashtag: function(tag) {
            tag = this.normalizeHashtag(tag);
            return this.hashtagMap.hasOwnProperty(tag);
        },
        isValidHashtagPrefix: function(tag) {
            tag = this.normalizeHashtag(tag);
            return this.hashtagTransformations.hasOwnProperty(tag);
        },
        hasValidHashtagPrefix: function(tag) {
            tag = this.normalizeHashtag(tag);
            var lastSlashIndex = tag.lastIndexOf("/");
            return lastSlashIndex !== -1 &&
                this.hashtagTransformations.hasOwnProperty(tag.substring(0, lastSlashIndex + 1)) &&
                tag.substring(lastSlashIndex + 1) !== "";
        },
        addHashtag: function(hashtag, xpath) {
            this.hashtagMap[hashtag] = xpath;
            this.invertedHashtagMap[xpath] = hashtag;
        },
        initHashtag: function(hashtag, xpath) {
            if (!this.hashtagMap[hashtag]) {
                this.addHashtag(hashtag, xpath);
            }
        },
        removeHashtag: function(hashtag) {
            if (this.hashtagMap.hasOwnProperty(hashtag)) {
                delete this.invertedHashtagMap[this.hashtagMap[hashtag]];
                delete this.hashtagMap[hashtag];
            }
        },
        normalize: function (methodName, xpath) {
            if (!xpath || (this.richText && richText.isInvalid(xpath))) {
                return xpath;
            }
            // try catch is needed as workaround for having an itemset without
            // the itemset plugin enabled
            try {
                return this.xpath.parse(xpath)[methodName]();
            } catch (err) {
                return xpath;
            }
        },
        normalizeHashtag: function (xpath_) {
            return this.normalize('toHashtag', xpath_);
        },
        normalizeXPath: function (xpath_) {
            return this.normalize('toXPath', xpath_);
        },
        getHashtagsInXPath: function (xpath_) {
            try {
                return new logic.LogicExpression(xpath_, this.xpath).getHashtags();
            } catch (err) {
                return [];
            }
        },
        knownExternalReferences: function () {
            return this._logicManager.knownExternalReferences();
        },
        referenceHashtag: function(hashtag, mug, property) {
            if (/^#case\//.test(hashtag.toHashtag())) {
                this.referenceInstance('casedb', mug, property);
                this.referenceInstance('commcaresession', mug, property);
            }
        },
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
                var dataParentMug = _this.mugMap[_this.normalizeHashtag(dataParent)];
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
         *          match other instances on the form. A matching instance will
         *          be found by `id` if the instance has no `src` attribute.
         *          If no matching instance is found, a new instance will be
         *          added with a unique `id`.
         * @param mug - (optional) The mug with which this query is associated.
         *          This and the next parameter are used for instance ref
         *          counting. If omitted, ref counting will be disabled for the
         *          instance.
         * @param property - (optional) The mug property name.
         * @returns - The `id` of the added or already-existing instance.
         */
        addInstanceIfNotExists: function (attrs, mug, property) {
            function getUniqueId(id, ids) {
                var temp = (id || "data") + "-",
                    num = 1;
                while (!id || ids.hasOwnProperty(id)) {
                    id = temp + num;
                    num++;
                }
                return id;
            }
            var meta;
            if (attrs.src) {
                meta = _.find(this.instanceMetadata, function (m) {
                    return m.attributes.src === attrs.src;
                });
                if (!meta) {
                    // attrs.src not found, try to find by id
                    var ids = _.indexBy(this.instanceMetadata, function (m) {
                            return m.attributes.id;
                        });
                    meta = attrs.id && ids.hasOwnProperty(attrs.id) ? ids[attrs.id] : null;
                    if (meta && meta.internal) {
                        // assign new src to internal instance
                        meta.internal = false;
                        meta.attributes.src = attrs.src;
                    } else {
                        // assign unique id to attrs (will create new meta)
                        attrs = _.clone(attrs);
                        attrs.id = getUniqueId(attrs.id, ids);
                        meta = null;
                    }
                    this.knownInstances[attrs.id] = { src: attrs.src };
                }
            } else if (attrs.id) {
                // attrs has no src, find by id
                meta = _.find(this.instanceMetadata, function (m) {
                    return m.attributes.id === attrs.id;
                });
                if (meta) {
                    if (meta.internal && this.knownInstances.hasOwnProperty(attrs.id)) {
                        meta.internal = false;
                        meta.attributes.src = this.knownInstances[attrs.id].src;
                    }
                } else if (this.knownInstances.hasOwnProperty(attrs.id)) {
                    _.defaults(attrs, this.knownInstances[attrs.id]);
                }
            } else {
                throw new Error("unsupported: non-primary instance without id or src");
            }
            if (!meta) {
                meta = InstanceMetadata({
                    src: attrs.src,
                    id: attrs.id
                }, attrs.children, mug || null, property);
                if (!attrs.src && !attrs.children) {
                    meta.internal = true;
                }
                this.instanceMetadata.push(meta);
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
         * TODO eliminate this method after refactoring callers to not
         * use it (there can be more than one instance reference in an
         * XPath query, so this doesn't make much sense).
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
                var instanceId = match[3],
                    meta = this.referenceInstance(instanceId, mug, property);
                if (meta) {
                    instance = _.clone(meta.attributes);
                }
            }
            return instance;
        },
        /**
         * Parse query and get a mapping of instance id: src
         *
         * @param query - A query string, which may contain "instance(...)"
         * @param mug - The mug with which this query is associated.
         * @param property - (optional) The mug property name for the query.
         * @reutrns - {<id>: <src>, ...}
         */
        parseInstanceRefs: function (query, mug, property) {
            var expr = new logic.LogicExpression(query, this.xpath),
                knownInstances = this.knownInstances,
                instances = {};
            expr.analyze();
            _.each(expr.instanceRefs, function (ignore, id) {
                if (knownInstances.hasOwnProperty(id) && knownInstances[id]) {
                    instances[id] = util.extend(knownInstances[id]);
                    if (instances[id].children) {
                        instances[id].children = $('<div>').append(instances[id].children).html();
                    }
                }
            });
            return instances;
        },
        referenceInstance: function (id, mug, property) {
            function idMatch(meta) {
                return meta.attributes.id === id;
            }
            var meta = _.find(this.instanceMetadata, idMatch);
            if (this.enableInstanceRefCounting) {
                if (meta) {
                    meta.addReference(mug, property);
                } else {
                    id = this.addInstanceIfNotExists({id: id}, mug, property);
                    meta = _.find(this.instanceMetadata, idMatch);
                }
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
        updateInstanceQuery: function (query, instanceId, oldId) {
            var regexp = INSTANCE_REGEXP;
            if (oldId) {
                regexp = new RegExp("(^|\W)instance\\((['\"])" +
                                    RegExp.escape(oldId) + "\2\\)", "ig");
            }
            return query.replace(regexp, "$1instance('" + instanceId + "')");
        },
        /**
         * Update internal record of instances known by this form
         *
         * @param map - an object mapping instance IDs to instance sources.
         *      If not given, update the form's internal known instances
         *      using instance metadata in the form.
         */
        updateKnownInstances: function (map) {
            var instances = this.knownInstances;
            if (map) {
                var metas = _.indexBy(this.instanceMetadata, function (m) {
                        return m.attributes.id;
                    });
                _.each(map, function (instance, id) {
                    if (instance && !instances.hasOwnProperty(id)) {
                        if (instance.children) {
                            instances[id] = { children: $(instance.children)};
                        } else if (_.isString(instance)){
                            // assume a string is the src
                            instances[id] = { src: instance };
                        } else {
                            // assume we are fed a correct instance dict
                            instances[id] = instance;
                        }
                        var meta = metas[id];
                        if (meta && meta.internal) {
                            meta.internal = false;
                            meta.attributes.src = instances[id].src;
                        }
                    }
                });
            } else {
                _.each(this.instanceMetadata, function (meta) {
                    if (!meta.attributes.id) {
                        return;
                    }
                    if (meta.attributes.src) {
                        instances[meta.attributes.id] = { src: meta.attributes.src };
                    } else if (meta.children) {
                        instances[meta.attributes.id] = { children: meta.children };
                    }
                });
            }
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
        /**
         * Drop all instance references from the given mug/property
         */
        dropAllInstanceReferences: function (mug, property) {
            this.instanceMetadata = _.filter(this.instanceMetadata, function (meta) {
                return !meta.dropReference(mug, property);
            });
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
            this.addHashtag('#form', '/' + id);
        },
        setAttr: function (slug, val) {
            this[slug] = val;
            if (slug === "richText" && val && !this.hasCaseHashtags) {
                // TODO remove this if/when hashtags are loaded on form init
                this._updateHashtags();
            }
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
        /**
         * Add parsing error to the form
         *
         * NOTE these errors are displayed on form load only.
         */
        updateError: function (errObj) {
            errObj = FormError(errObj);
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
        },
        /**
         * Get a list of warnings pertaining to form serialization
         *
         * All serialization warnings reported here can be fixed
         * automatically, but the user may prefer to fix them manually.
         *
         * @returns - A list of error objects. See
         * `Mug.getSerializationWarnings` for more details.
         */
        getSerializationWarnings: function () {
            var errors = [];
            this.walkMugs(function (mug) {
                var errs = mug.getSerializationWarnings();
                if (errs.length) {
                    errors.push({mug: mug, errors: errs});
                }
            });
            return errors;
        },
        /**
         * Automatically fix serialization errors
         *
         * After fixing serialization errors, no more errors
         * should be reported by `getSerializationWarnings`.
         *
         * @param errors - The list of error objects returned by
         *                 `getSerializationWarnings`.
         */
        fixSerializationWarnings: function (errors) {
            _.each(errors || [], function (error) {
                error.mug.fixSerializationWarnings(error.errors);
            });
        },
        isFormValid: function (validateMug) {
            return this.tree.isTreeValid(validateMug);
        },
        findFirstMatchingChild: function (parentMug, match) {
            var parent = (parentMug ? this.tree.getNodeFromMug(parentMug)
                                    : this.tree.rootNode);
            return _.find(parent.getChildrenMugs(), match);
        },
        insertMug: function (refMug, newMug, position) {
            this.tree.insertMug(newMug, position, refMug);
        },
        /**
         * Move a mug from its current place to
         * the position specified by the arguments.
         *
         * NOTE the cannonical way to rename a mug is to set its
         * `nodeID` property: `mug.p.nodeID = "name"`
         *
         * @param mug - The mug to be moved.
         * @param position - The position relative to `refMug`
         *          ("after", "into", "last", etc.) or "rename", in
         *          which case `refMug` is the new name.
         * @param refMug - The mug relative to which `mug` is moving.
         *          Alternately, the new name if `position` is "rename".
         */
        moveMug: function (mug, position, refMug) {
            function match(sibling) {
                return sibling !== mug && sibling.p.nodeID === newId;
            }
            var newId, oldId, oldPath, oldParent, conflictParent;

            if (position === "rename") {
                newId = refMug;
                if (!this.tree.getNodeFromMug(mug)) {
                    // skip conflict resolution if not in tree
                    mug.p.set("nodeID", newId);
                    return;
                }
                oldId = mug.p.nodeID;
                oldPath = mug.hashtagPath;
                oldParent = conflictParent = mug.parentMug;
            } else {
                oldId = mug.p.nodeID;
                oldPath = mug.hashtagPath;
                oldParent = mug.parentMug;
                this.insertMug(refMug, mug, position);
                var spec = mug.spec.dataParent;
                if (spec && spec.validationFunc(mug) !== 'pass') {
                    mug.p.set("dataParent"); // clear dataParent
                }
                newId = mug.p.conflictedNodeId || oldId;
                conflictParent = mug.parentMug;
            }

            if (!mug.options.isControlOnly) {
                if (this.findFirstMatchingChild(conflictParent, match)) {
                    mug.p.conflictedNodeId = newId;
                    newId = this.generate_question_id(newId, mug);
                } else if (mug.p.has("conflictedNodeId")) {
                    mug.p.conflictedNodeId = null;
                }

                if (mug.p.nodeID !== newId) {
                    // rename without events; nodeID setter calls form.moveMug
                    mug.p.set("nodeID", newId);
                }
            }

            var newPath = mug.hashtagPath;
            this.vellum.handleMugRename(
                this, mug, newId, oldId, newPath, oldPath, oldParent);

            if (position !== "rename") {
                this.fireChange(mug);
            }
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
        /**
         * Update references to mug and its children after it is renamed.
         */
        handleMugRename: function (mug, newId, oldId, newPath, oldPath, oldParent) {
            function getPreMovePath(postPath) {
                if (postPath === newPath) {
                    return oldPath;
                }
                return postPath.replace(postRegExp, oldPath + "/");
            }
            this._logicManager.updatePath(mug.ufid, oldPath, newPath);
            if (!newPath) {
                // Items don't have an absolute path. I wonder if it would
                // matter if they had one?
                return;
            }
            var mugs = this.getDescendants(mug).concat([mug]),
                postMovePaths = _(mugs).map(function(mug) { return mug.hashtagPath; }),
                postRegExp = new RegExp("^" + RegExp.escape(newPath) + "/"),
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
            this.fixBrokenReferences();
            // TODO make Item not a special case
            if (oldId && mug.__className !== "Choice") {
                // update first child of old parent with matching conflicted nodeID
                var conflict = this.findFirstMatchingChild(oldParent, function (mug) {
                        return mug.p.conflictedNodeId === oldId;
                    });
                if (conflict) {
                    this.moveMug(conflict, "rename", oldId);
                }
            }
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

            if (window.analytics) {
                window.analytics.usage('Form Builder', 'Copy', duplicate.options.typeName);
            }

            for (var i = 0; i < pathReplacements.length; i++) {
                var pr = pathReplacements[i];
                this._logicManager.updatePath(pr.mugId, pr.from, pr.to, duplicate.hashtagPath);
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
                if (duplicate.p.conflictedNodeId) {
                    duplicate.p.conflictedNodeId = null;
                } else {
                    duplicate.p.nodeID = this.generate_question_id(nodeID, mug);
                }
                
                this.insertQuestion(duplicate, mug, 'after', true);
            } else {
                this.insertQuestion(duplicate, parentMug, 'into', true);
            }

            this.updateLogicReferences(duplicate);
            this.vellum.duplicateMugProperties(duplicate);

            var children = this.getChildren(mug),
                pathReplacements = [];
            for (var i = 0; i < children.length; i++) {
                pathReplacements = pathReplacements.concat(
                    this._duplicateMug(children[i], duplicate, depth + 1)[1]);
            }

            pathReplacements.push({
                mugId: mug.ufid,
                from: mug.hashtagPath,
                to: duplicate.hashtagPath,
            });

            return [duplicate, pathReplacements];
        },
        updateLogicReferences: function (mug, property, value) {
            this._logicManager.updateReferences(mug, property, value);
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

            return function () {
                var event = {
                    type: 'mug-property-change',
                    mug: mug,
                    property: property,
                    val: value,
                    previous: previous
                };
                mug.validate(property);
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
        createQuestion: function (refMug, position, newMugType, isInternal) {
            var mug = this.mugTypes.make(newMugType, this);
            if (isInternal && !mug.options.isControlOnly) {
                mug.p.nodeID = this.generate_question_id();
            }
            if (mug.__className === "Choice") {
                var parent = refMug.__className === "Choice" ? refMug.parentMug : refMug;
                mug.p.nodeID = this.generate_item_label(parent);
            }
            this.insertQuestion(mug, refMug, position, isInternal);
            // should we fix broken references when nodeID is auto-generated?
            //if (!mug.options.isControlOnly && !this.isLoadingXForm) {
            //    this.fixBrokenReferences();
            //}
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
        _updateMugPath: function (mug, oldHashtag, newHashtag) {
            var map = this.mugMap, newPath;
            delete map[this.normalizeHashtag(oldHashtag)];
            if (oldHashtag) {
                this.removeHashtag(oldHashtag);
            }
            if (_.isUndefined(newHashtag)) {
                newPath = mug.absolutePath;
                newHashtag = mug.hashtagPath;
            } else {
                newPath = newHashtag.replace(/^#form/, this.getBasePath(true));
                if (newPath === newHashtag) {
                    // this happens if _updateMugPath is commtrack (#supply one day)
                    newPath = null;
                }
            }
            if (newHashtag) {
                if (newPath) {
                    this.addHashtag(newHashtag, newPath);
                }
                map[this.normalizeHashtag(newHashtag)] = mug;
            }
        },
        _fixMugState: function (mug) {
            // parser needs this because it inserts directly into the tree
            this.mugMap[mug.ufid] = mug;
            var path = mug.absolutePath;
            if (path) {
                this.addHashtag(mug.hashtagPath, path);
                this.mugMap[this.normalizeHashtag(mug.hashtagPath)] = mug;
            }
        },
        fixBrokenReferences: function () {
            function updateReferences(mug) {
                _this.updateLogicReferences(mug);
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
            return this.mugMap[this.normalizeHashtag(path)];
        },
        getIconByPath: function (path) {
            var mug = this.getMugByPath(path);
            return mug ? mug.getIcon() : null;
        },
        removeMugsFromForm: function (mugs) {
            function breakReferences(mug, property) {
                if (mug && !seen.hasOwnProperty(mug.ufid + " " + property)) {
                    seen[mug.ufid + " " + property] = null;
                    _this.updateLogicReferences(mug, property);
                }
            }
            var _this = this,
                seen = {},
                ufids = {},
                undoUfids = {};
            this.undomanager.resetUndo();
            _.each(mugs, function (mug) {
                _this._addToUndoManager(mug, undoUfids);
            });
            _.each(mugs, function (mug) {
                _this._removeMugFromForm(mug, ufids, false);
            });
            this._logicManager.forEachReferencingProperty(ufids, breakReferences);
        },
        _addToUndoManager: function(mug, ufids) {
            if (ufids.hasOwnProperty(mug.ufid)) {
                return; // already removed
            }
            ufids[mug.ufid] = null;
            var node = this.tree.getNodeFromMug(mug),
                parentMug = mug.parentMug,
                hasChildren = false,
                previousSibling = mug.previousSibling,
                position = previousSibling === parentMug ? 'first' : 'after';
            this.undomanager.appendMug(mug, previousSibling, position);
            if (node) {
                var children = node.getChildrenMugs();
                hasChildren = children.length > 0;
                for (var i = 0; i < children.length; i++) {
                    this._addToUndoManager(children[i], ufids);
                }
            }
        },
        _removeMugFromForm: function(mug, ufids, isInternal) {
            if (ufids.hasOwnProperty(mug.ufid)) {
                return; // already removed
            }
            ufids[mug.ufid] = null;
            var node = this.tree.getNodeFromMug(mug);
            if (node) {
                var children = node.getChildrenMugs();
                for (var i = 0; i < children.length; i++) {
                    this._removeMugFromForm(children[i], ufids, true);
                }
                delete this.mugMap[this.normalizeHashtag(mug.hashtagPath)];
                this.tree.removeMug(mug);
            }
            if (this.enableInstanceRefCounting) {
                this.instanceMetadata = _.filter(this.instanceMetadata, function (meta) {
                    return !meta.dropReference(mug);
                });
            }
            this._logicManager.clearReferences(mug);
            delete this.mugMap[mug.ufid];
            this.fire({
                type: 'question-remove',
                mug: mug,
                isInternal: isInternal,
            });
        },
        isUniqueQuestionId: function (qId, mug) {
            var mugs;
            if (!mug) {
                mugs = this.getMugList(); // check against entire form
            } else {
                var node = this.tree.getNodeFromMug(mug);
                mugs = this.tree.getParentNode(node).getChildrenMugs();
            }
            return !_.any(mugs, function (mug) { return mug.p.nodeID === qId; });
        },

        /**
         * Generates a unique question ID
         *
         * @param question_id - a proposed question ID (may be empty)
         * @param mug
         */
        generate_question_id: function (question_id, mug) {
            if (question_id) {
                var match = /^copy-(\d+)-of-(.+)$/.exec(question_id) ;
                if (match) {
                    question_id = match[2]; 
                }
                var new_id = question_id;
                for (var i = 1;; i++) {
                    if (this.isUniqueQuestionId(new_id, mug)) {
                        return new_id; 
                    }
                    new_id = "copy-" + i + "-of-" + question_id;
                }
            } else {
                return this._make_label('question', mug);
            }
        },
        generate_item_label: function (parentMug, name, i) {
            var node = (parentMug ? this.tree.getNodeFromMug(parentMug)
                                  : this.tree.rootNode),
                items = node.getChildrenMugs(),
                ret;
            if (!name) { name = "choice"; }
            if (arguments.length < 3) {
                i = items.length + 1;
            }
            do {
                ret = name + i++;
            } while (_.any(items, function (item) {
                return item.p.nodeID === ret;
            }));
            return ret;
        },
        /**
         * Private method for constructing unique questionIDs, labels for items, etc
         */
        _make_label: function (prefixStr, mug) {
            var ret;
            do {
                ret = prefixStr + this.question_counter;
                this.question_counter += 1;
            } while (!this.isUniqueQuestionId(ret, mug));
            return ret;
        },
        getExportTSV: function () {
            this.vellum.beforeSerialize();
            var value = exporter.generateExportTSV(this);
            this.vellum.afterSerialize();
            return value;
        },
        undo: function() {
            this.undomanager.undo();
            this.vellum.selectSomethingOrHideProperties();
        },
        isCaseReference: function (path) {
            return /^#case/.test(path);
        },
        findUsages: function (path) {
            return this._logicManager.findUsages(path);
        },
    };

    return {
        Form: Form,
        InstanceMetadata: InstanceMetadata
    };
});
