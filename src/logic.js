define([
    'jquery',
    'underscore',
    'vellum/util',
], function (
    $,
    _,
    util,
) {
    var EXTERNAL_REF = "#",
        INVALID_XPATH = "#invalid/xpath ";

    function LogicExpression(exprText, xpathParser) {
        this._text = exprText || "";
        this._xpathParser = xpathParser;
        if (typeof this._text === "string" && this._text.startsWith(INVALID_XPATH)) {
            this.parsed = null;
            this.error = INVALID_XPATH;
        } else if ($.trim(exprText)) {
            try {
                this.parsed = this._xpathParser.parse(exprText);
            } catch (err) {
                this.parsed = null;
                this.error = err;
            }
        } else {
            this.parsed = null;
        }
    }
    LogicExpression.prototype = {
        analyze: function () {
            var paths = [],
                absolutePaths = [],
                topLevelPaths = [],
                hashtags = [],
                ROOT = this._xpathParser.models.XPathInitialContextEnum.ROOT,
                RELATIVE = this._xpathParser.models.XPathInitialContextEnum.RELATIVE,
                EXPR = this._xpathParser.models.XPathInitialContextEnum.EXPR,
                predicates;
            this.paths = paths;
            this.absolutePaths = absolutePaths;
            this.hashtags = hashtags;
            this.instanceRefs = {};
            this.referencesSelf = false;
            this.topLevelPaths = topLevelPaths;
            if (this.parsed) {
                var queue = [{xpath: this.parsed, insideFilter: false}],
                    node, i, children, j, k, insideFilter;
                while (queue.length > 0) {
                    k = queue.shift();
                    node = k.xpath;
                    insideFilter = k.insideFilter;
                    if (node instanceof this._xpathParser.models.XPathPathExpr) {
                        paths.push(node);
                        if (!insideFilter) {
                            topLevelPaths.push(node);
                        }

                        insideFilter = true;

                        if (node.initial_context === ROOT) {
                            absolutePaths.push(node);
                        } else if (node.initial_context === RELATIVE &&
                                   node.steps.length === 1 &&
                                   node.steps[0].axis === 'self') {
                            this.referencesSelf = true;
                        } else if (node.initial_context === EXPR) {
                            if (!this._addInstanceRef(node.filter.expr)) {
                                queue.push({
                                    xpath: node.filter.expr,
                                    insideFilter: insideFilter,
                                });
                            }
                            predicates = node.filter.predicates;
                            for (i = 0; i < predicates.length; i++) {
                                queue.push({
                                    xpath: predicates[i],
                                    insideFilter: insideFilter,
                                });
                            }
                        }
                    } else if (node instanceof this._xpathParser.models.XPathFuncExpr) {
                        this._addInstanceRef(node);
                    } else if (node instanceof this._xpathParser.models.HashtagExpr) {
                        hashtags.push(node);
                    }
                    children = node.getChildren();
                    for (i = 0; i < children.length; i++) {
                        queue.push({
                            xpath: children[i],
                            insideFilter: insideFilter,
                        });
                        if (children[i].predicates && children[i].predicates.length) {
                            predicates = children[i].predicates;
                            for (j = 0; j < predicates.length; j++) {
                                queue.push({
                                    xpath: predicates[j],
                                    insideFilter: insideFilter,
                                });
                            }
                        }
                    }
                }
            }
        },
        _addInstanceRef: function (expr) {
            if (expr.id === "instance" && expr.args.length === 1 &&
                    expr.args[0] instanceof this._xpathParser.models.XPathStringLiteral) {
                var id = expr.args[0].value;
                this.instanceRefs[id] = null;
                return true;
            }
            return false;
        },
        getPaths: function () {
            if (!this.paths) {
                this.analyze();
            }
            return this.paths;
        },
        getTopLevelPaths: function () {
            if (!this.topLevelPaths) {
                this.analyze();
            }
            return this.topLevelPaths;
        },
        getHashtags: function () {
            if (!this.hashtags) {
                this.analyze();
            }
            return this.hashtags;
        },
        updatePath: function (from, to) {
            var paths = this.getPaths().concat(this.getHashtags()),
                path, i;

            var replacePathInfo = function (source, destination) {
                // Copy methods from source to destination, resulting in
                // mutating destination while preserving the original
                // object reference. It is not enough to simply copy
                // state variables since source and destination types
                // may differ (HashtagExpr, XPathPathExpr).
                destination.toHashtag = source.toHashtag.bind(source);
                destination.toXPath = source.toXPath.bind(source);
            };
            
            for (i = 0; i < paths.length; i++) {
                path = paths[i];
                if (path.toHashtag() === from) {
                    replacePathInfo(this._xpathParser.parse(to), path);
                }
            }
        },
        getText: function () {
            if (this._text && this.parsed) {
                return this.parsed.toHashtag();
            } else {
                return this._text;
            }
        },
    };

    function LogicManager(form, opts) {
        opts.allowedDataNodeReferences = opts.allowedDataNodeReferences || {};

        this.opts = opts;
        this.form = form;
        // see this._addReferences for ref structure
        // refid is either refMug.ufid or EXTERNAL_REF
        this.forward = {};  // {mug.ufid: {property: [ref, ...], ...}, ...}
        this.reverse = {};  // {refid: {mug.ufid: [ref, ...], ...}, ...}
        this.errors = {};   // {mug.ufid: {property: true, ...}, ...}
    }

    LogicManager.prototype = {
        clearReferences: function (mug, property) {
            function _removeMugFromReverse(property, ref) {
                if (ref.ref) {
                    // assert ref.mug === mug.ufid
                    if (ref.mug !== mug.ufid) {
                        throw new Error([mug, ref]);
                    }
                    reverse[ref.ref][ref.mug] = _.filter(
                        reverse[ref.ref][ref.mug],
                        function (r) { return r.property !== property; },
                    );
                }
            }

            var reverse = this.reverse,
                forward = this.forward,
                errors = this.errors,
                removeMugFromReverse;
            mug.form.dropAllInstanceReferences(mug, property, true);
            if (forward.hasOwnProperty(mug.ufid)) {
                if (property) {
                    if (forward[mug.ufid].hasOwnProperty(property)) {
                        removeMugFromReverse = _.partial(_removeMugFromReverse, property);
                        _.each(forward[mug.ufid][property], removeMugFromReverse);
                    }
                    forward[mug.ufid][property] = [];
                } else {
                    _.each(forward[mug.ufid], function (refs, property) {
                        removeMugFromReverse = _.partial(_removeMugFromReverse, property);
                        _.each(refs, removeMugFromReverse);
                    });
                    forward[mug.ufid] = {};
                }
            } else {
                forward[mug.ufid] = {};
            }
            if (errors.hasOwnProperty(mug.ufid)) {
                if (property) {
                    delete this.errors[mug.ufid][property];
                } else {
                    delete this.errors[mug.ufid];
                }
            }
        },
        _addReferences: function (mug, property, value) {
            value = this.form.getLogicalXPath(value || mug.p[property]);
            var _this = this,
                form = _this.form,
                expr = new LogicExpression(value, form.xpath),
                unknowns = [],
                messages = [],
                warning = "",
                spec = mug.spec[property],
                propertyName = spec ? spec.lstring : property,
                reverse = this.reverse,
                refs;

            messages.push({
                key: "logic-invalid-xpath-warning",
                level: mug.WARNING,
                message: expr.error === INVALID_XPATH ? gettext("Invalid XPath expression.") : "",
            });

            expr.analyze();
            if (expr.referencesSelf && !(spec && spec.mayReferenceSelf)) {
                warning = util.format(gettext("The {property} for a question " +
                    "is not allowed to reference the question itself. " +
                    "Please remove the . from the {property} " +
                    "or your form will have errors."),
                {property: propertyName});
            }
            messages.push({
                key: "core-circular-reference-warning",
                level: mug.WARNING,
                message: warning,
            });

            // append item for each mug referenced (by absolute path) in mug's
            // property value
            refs = expr.absolutePaths.concat(expr.hashtags).map(function (xobj) {
                var xpath = xobj.toHashtag(),
                    isHashtag = xpath.startsWith('#'),
                    pathString = isHashtag ? xpath : xobj.pathWithoutPredicates(),
                    pathWithoutRoot = isHashtag ? '' : pathString.substring(1 + pathString.indexOf('/', 1)),
                    refMug = form.getMugByPath(pathString),
                    isHashRef = form.hasValidHashtagPrefix(xpath),
                    knownHashtag = isHashRef && form.isValidHashtag(xpath);

                // last part is hack to allow root node in data parents
                if ((!refMug && !knownHashtag) &&
                    (!mug.options.ignoreReferenceWarning || !mug.options.ignoreReferenceWarning(mug)) &&
                    _this.opts.allowedDataNodeReferences.indexOf(pathWithoutRoot) === -1 &&
                    !(property === "dataParent" && pathString === form.getBasePath().slice(0,-1))) {
                    unknowns.push(xpath);
                } else if (!refMug && isHashRef && !knownHashtag) {
                    unknowns.push(xpath);
                }
                var refid = refMug ? refMug.ufid : (isHashRef ? EXTERNAL_REF : ""),
                    ref = {
                        mug: mug.ufid, // mug with property value referencing refMug
                        ref: refid, // referenced Mug or EXTERNAL_REF or ""
                        property: property,
                        path: xpath, // path to refMug
                        sourcePath: mug.hashtagPath,
                    };
                if (refid) {
                    if (!reverse.hasOwnProperty(refid)) {
                        reverse[refid] = {};
                        reverse[refid][mug.ufid] = [];
                    } else if (!reverse[refid].hasOwnProperty(mug.ufid)) {
                        reverse[refid][mug.ufid] = [];
                    }
                    reverse[refid][mug.ufid].push(ref);
                }
                return ref;
            });
            this.forward[mug.ufid][property] = refs;
            _.each(expr.instanceRefs, function (ignore, id) {
                form.referenceInstance(id, mug, property);
            });
            _.each(expr.hashtags, function (hashtag) {
                form.referenceHashtag(hashtag.toHashtag(), mug, property);
            });
            if (unknowns.length > 0) {
                if (!this.errors[mug.ufid]) {
                    this.errors[mug.ufid] = {};
                }
                this.errors[mug.ufid][property] = true;
            } else if (this.errors[mug.ufid]) {
                delete this.errors[mug.ufid][property];
            }
            messages.push({
                key: "logic-bad-path-warning",
                level: mug.WARNING,
                message: (function () {
                    if (!unknowns.length) {
                        return "";
                    } else if (unknowns.length === 1) {
                        return gettext("Unknown question:") + " " + unknowns[0];
                    }
                    return gettext("Unknown questions:") + "\n- " + unknowns.join("\n- ");
                })(),
            });
            return messages;
        },
        addReferences: function (mug, property, value) {
            // get absolute paths from mug property's value
            var _this = this,
                returned = {};
            this.clearReferences(mug, property);
            if (!value && mug.p[property] && _.isFunction(mug.p[property].mapLogicExpressions)) {
                return mug.p[property].mapLogicExpressions(function (expr) {
                    var messages = _this._addReferences(mug, property, expr);
                    return _.filter(messages, function (msg) {
                        if (!returned.hasOwnProperty(msg.key)) {
                            returned[msg.key] = msg;
                        } else if (!returned[msg.key].message || !msg.message) {
                            if (msg.message) {
                                _.extend(returned[msg.key], msg);
                            }
                            return false;
                        }
                        return true;
                    });
                });
            } else {
                return this._addReferences(mug, property, value);
            }
        },
        updateReferences: function (mug, property, value) {
            function update(property) {
                messages[property] = _this.addReferences(mug, property, value);
            }
            var _this = this,
                messages = {};
            if (property) {
                update(property);
            } else {
                _.each(mug.logicReferenceAttrs, update);
            }
            mug.addMessages(messages);
        },
        /**
         * Update references to a node with its new path. Used when a node is
         * moved or duplicated (with subtree).
         *
         * @param mugId - ufid of the mug to update references for
         * @param from - old absolute path of the mug
         * @param to - new absolute path of the mug
         * @param subtree - (optional) only replace references from nodes
         *        beginning with this path (no trailing /)
         */
        updatePath: function (mugId, from, to, subtree) {
            if (from === to) { return; }

            var data = {};
            data[mugId] = [from, to];

            this.updatePaths(data, subtree);
        },
        /**
         * Update references nodes with theirs new paths. Used when a node,
         * which may have sub-nodes, is moved or duplicated.
         *
         * @param data - an object with the following structure:
         *        { "<mug ufid>": ["/old/path", "/new/path"], ... }
         * @param subtree - (optional) only replace references from nodes
         *        beginning with this path (no trailing /)
         */
        updatePaths: function (data, subtree) {
            var seen = {},
                form = this.form;
            function updatePath(mug, property, paths) {
                function updateExpression(value) {
                    if (!value) {
                        return value;
                    }
                    var expr = new LogicExpression(value, form.xpath),
                        orig = expr.getText();
                    expr.updatePath(paths[0], paths[1]);
                    var updated = expr.getText();
                    return updated !== orig ? updated : value;
                }

                var pkey = mug.ufid + " " + property + " " + paths[0];
                if (seen.hasOwnProperty(pkey)) {
                    return;
                }
                seen[pkey] = null;
                var value = mug.p[property];
                if (value && _.isFunction(value.updateLogicExpressions)) {
                    value.updateLogicExpressions(updateExpression, mug);
                } else {
                    var result = updateExpression(value);
                    if (value !== result) {
                        // update without triggering validation/events
                        mug.p.set(property, result);
                    }
                }
            }
            this.forEachReferencingProperty(data, updatePath, subtree);
        },
        /**
         * Call a function for each mug with broken references
         *
         * The function is called with one argument or two arguments:
         * the mug with broken references and property if known.
         */
        forEachBrokenReference: function (func) {
            _.each(this.errors, function (props, ufid) {
                var mug = this.form.getMugByUFID(ufid);
                if (mug) {
                    if (props) {
                        _.each(props, function (v, prop) { func(mug, prop); });
                    } else {
                        func(mug);
                    }
                } else {
                    delete this.errors[ufid];
                }
            }, this);
        },
        hasBrokenReferences: function () {
            return _.find(this.errors, function (properties) {
                return _.some(properties);
            });
        },
        /**
         * Find and update invalid external references
         */
        validateExternalReferences: function () {
            var _this = this,
                invalid = _.chain(this.reverse[EXTERNAL_REF] || {})
                    .values()
                    .flatten(true)
                    .filter(function (ref) {
                        return !_this.form.isValidHashtag(ref.path);
                    })
                    .value();
            _.each(invalid, function (ref) {
                var mug = _this.form.getMugByUFID(ref.mug);
                _this.updateReferences(mug, ref.property);
            });
        },
        /**
         * Call function for each expression property that references a mug
         * identified by one of the given ufids
         *
         * @param ufids - a mapping (object) keyed by mug ufids.
         *        Example: {"mug-ufid": <mapValue>, ...}
         * @param func - a function to be called for each expression property that
         *        references one of the mugs. The function is called with
         *        three arguments: (mug, property, mapValue)
         *        - mug: the mug with an expression property referencing a mug
         *          identified by one of the given ufids ("mug-ufid").
         *        - property: the name of the expression property.
         *        - mapValue: the value from ufids (<mapValue>).
         * @param subtree - (optional) only visit references from nodes
         *        beginning with this path (no trailing /)
         */
        forEachReferencingProperty: function (ufids, func, subtree) {
            var form = this.form,
                reverse = this.reverse;
            _.each(ufids, function (mapValue, ufid) {
                if (reverse.hasOwnProperty(ufid)) {
                    _.each(reverse[ufid], function (refs, mugUfid) {
                        var mug = form.getMugByUFID(mugUfid);
                        _.each(refs, function (ref) {
                            if (!subtree ||
                                ref.sourcePath === subtree ||
                                ref.sourcePath.indexOf(subtree + '/') === 0) {
                                func(mug, ref.property, mapValue);
                            }
                        });
                    });
                }
            });
        },
        /**
         * Find a mug that references the given mug
         *
         * @param predicate - predicate function used to find a match.
         * @returns Boolean
         */
        hasReferencingMug: function (mug, predicate) {
            var form = this.form;
            if (this.reverse.hasOwnProperty(mug.ufid)) {
                return _.find(this.reverse[mug.ufid], function (refs, ufid) {
                    var mug = form.getMugByUFID(ufid);
                    return refs.length && mug && predicate(mug);
                });
            }
            return false;
        },
        reset: function () {
            this.forward = {};
            this.reverse = {};
        },
        // This is to tell HQ's case summary what is referenced
        caseReferences: function () {
            var _this = this,
                load = {},
                save = {};
            _.each(_.flatten(_.values(this.reverse[EXTERNAL_REF] || {})), function (ref) {
                var path = _this.form.normalizeXPath(ref.sourcePath);
                if (path === null) {
                    // Choices have null path, use parent path.
                    // This is a little fragile. Currently all mug types
                    // that have a null path also have a parent that does
                    // not have a null path. If that ever changes this will
                    // likely need to change.
                    var parent = _this.form.getMugByUFID(ref.mug).parentMug;
                    if (parent) {
                        path = parent.absolutePath;
                    }
                }
                if (load.hasOwnProperty(path)) {
                    if (!_.contains(load[path], ref.path)) {
                        load[path].push(ref.path);
                    }
                } else {
                    load[path] = [ref.path];
                }
            });
            var saveToCaseQuestions = _.filter(this.form.getMugList(), function (mug) {
                return mug.options.getCaseSaveData !== undefined;
            });
            _.each(saveToCaseQuestions, function (mug) {
                var mugPath = _this.form.getAbsolutePath(mug);
                save[mugPath] = mug.options.getCaseSaveData(mug);
            });
            return {load: load, save: save};
        },
        // returns object of external references that are known to be valid
        knownExternalReferences: function () {
            var _this = this;
            return _.chain(this.reverse[EXTERNAL_REF] || {})
                .values()
                .flatten(true)
                .filter(function (ref) {
                    return _this.form.isValidHashtag(ref.path);
                })
                .map(function (ref) {
                    return [ref.path, null];
                }).object().value();
        },
        /*
         * Returns object describing references used in the logic manager
         *
         * {
         *   /path/of/referenced/mug: {
         *     /path/of/mug/referencing: property where ref occurs
         *   }
         * }
         *
         * Optionally can filter based on hashtag path
         */
        findUsages: function (path) {
            var _this = this,
                form = _this.form,
                tableData = {},
                formRefs = _.omit(_this.reverse, EXTERNAL_REF);

            _.each(formRefs, function (refsToUsedMug, usedMugUfid) {
                var usedMug = form.getMugByUFID(usedMugUfid),
                    mugReferences = {};
                if (!usedMug || path && path !== usedMug.hashtagPath) {
                    return;
                }
                _.each(refsToUsedMug, function (refs, usedInMugUfid) {
                    _.each(refs, function (ref) {
                        var usedInMug = form.getMugByUFID(usedInMugUfid),
                            usedInMugPath = usedInMug.hashtagPath,
                            readablePropName = usedInMug.spec[ref.property].lstring;
                        if (!usedInMugPath) {
                            usedInMugPath = usedInMug.parentMug.hashtagPath;
                        }
                        mugReferences[usedInMugPath] = readablePropName;
                    });
                });
                tableData[usedMug.hashtagPath] = mugReferences;
            });

            return tableData;
        },
    };

    return {
        LogicManager: LogicManager,
        LogicExpression: LogicExpression,
    };
});
