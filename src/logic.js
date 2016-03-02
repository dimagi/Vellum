define([
    'jquery',
    'underscore'
], function (
    $,
    _
) {
    var XPATH_REFERENCES = [
            "relevantAttr",
            "calculateAttr",
            "constraintAttr",
            "dataParent",
            "repeat_count",
            "filter",
            "defaultValue"
        ],
        NO_SELF_REFERENCES = _.without(XPATH_REFERENCES, 'constraintAttr');

    function LogicExpression (exprText, xpathParser) {
        this._text = exprText || "";
        this._xpathParser = xpathParser;
        if ($.trim(exprText)) {
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
                                    insideFilter: insideFilter
                                });
                            }
                            predicates = node.filter.predicates;
                            for (i = 0; i < predicates.length; i++) {
                                queue.push({
                                    xpath: predicates[i],
                                    insideFilter: insideFilter
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
                            insideFilter: insideFilter
                        });
                        if (children[i].predicates && children[i].predicates.length) {
                            predicates = children[i].predicates;
                            for (j = 0; j < predicates.length; j++) {
                                queue.push({
                                    xpath: predicates[j],
                                    insideFilter: insideFilter
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
            var paths = this.getPaths(),
                hashtags = this.getHashtags(),
                path, i;

            var replacePathInfo = function (source, destination) {
                // copies information from source to destination in place,
                // resulting in mutating destination while preserving the 
                // original object reference.
                destination.initial_context = source.initial_context;
                destination.steps = source.steps;
                destination.filter = source.filter;
            };
            
            for (i = 0; i < paths.length; i++) {
                path = paths[i];
                if (path.toHashtag() === from) {
                    replacePathInfo(this._xpathParser.parse(to), path);
                }
            }
            for (i = 0; i < hashtags.length; i++) {
                path = hashtags[i];
                if (path.toHashtag() === from) {
                    replacePathInfo(this._xpathParser.parse(to), path);
                }
            }
        },
        getText: function () {
            if (this._text && this.parsed) {
                return this.parsed.toBanana();
            } else {
                return this._text;
            }
        }
    };

    function LogicManager (form, opts) {
        opts.allowedDataNodeReferences = opts.allowedDataNodeReferences || {};

        this.opts = opts;
        this.form = form;
        this.all = [];
        this.errors = {};
    }

    LogicManager.prototype = {
        clearReferences: function (mug, property) {
            mug.form.dropAllInstanceReferences(mug, property, true);
            this.all = this.all.filter(function (elem) { 
                return elem.mug !== mug.ufid || elem.property !== property;
            });
        },
        addReferences: function (mug, property, value) {
            // get absolute paths from mug property's value
            var _this = this,
                form = _this.form,
                expr = new LogicExpression(value || mug.p[property], form.xpath),
                unknowns = [],
                messages = [],
                warning = "",
                propertyName = mug.spec[property] ? mug.spec[property].lstring : property;

            expr.analyze();
            if (expr.referencesSelf && _.contains(NO_SELF_REFERENCES, property)) {
                warning = "The " + propertyName + " for a question " +
                    "is not allowed to reference the question itself. " +
                    "Please remove the . from the " +
                    propertyName +" or your form will have errors.";
            }

            messages.push({
                key: "core-circular-reference-warning",
                level: mug.WARNING,
                message: warning
            });

            // append item for each mug referenced (by absolute path) in mug's
            // property value
            this.all = this.all.concat(expr.absolutePaths.concat(expr.hashtags).map(function (path) {
                var isHashtag = path.toHashtag().startsWith('#'),
                    pathString = isHashtag ? path.toHashtag() : path.pathWithoutPredicates(),
                    pathWithoutRoot = isHashtag ? '' : pathString.substring(1 + pathString.indexOf('/', 1)),
                    refMug = form.getMugByPath(pathString),
                    xpath = path.toHashtag(),
                    knownHashtag = pathString.startsWith('#case') && form.isValidHashtag(xpath);

                // last part is hack to allow root node in data parents
                if ((!refMug && !knownHashtag) &&
                    (!mug.options.ignoreReferenceWarning || !mug.options.ignoreReferenceWarning(mug)) &&
                    _this.opts.allowedDataNodeReferences.indexOf(pathWithoutRoot) === -1 &&
                    !(property === "dataParent" && pathString === form.getBasePath().slice(0,-1)))
                {
                    unknowns.push(xpath);
                } else if (!refMug && pathString.startsWith('#case') && !knownHashtag) {
                    unknowns.push(xpath);
                }
                return {
                    mug: mug.ufid, // mug with property value referencing refMug
                    ref: refMug ? refMug.ufid : "", // referenced Mug
                    property: property,
                    path: xpath, // path to refMug
                    sourcePath: mug.hashtagPath
                };      
            }));
            _.each(expr.instanceRefs, function (ignore, id) {
                form.referenceInstance(id, mug, property);
            });
            _.each(expr.hashtags, function (hashtag) {
                if (/^#case/.test(hashtag.toHashtag())) {
                    form.referenceInstance('casedb', mug, property);
                    form.referenceInstance('commcaresession', mug, property);
                }
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
                        return "Unknown question: " + unknowns[0];
                    }
                    return "Unknown questions:\n- " + unknowns.join("\n- ");
                })()
            });
            return messages;
        },
        updateReferences: function (mug, property, value) {
            function update(property) {
                _this.clearReferences(mug, property);
                messages[property] = _this.addReferences(mug, property, value);
            }
            var _this = this,
                messages = {};
            if (property) {
                if (arguments.length > 2 || XPATH_REFERENCES.indexOf(property) !== -1) {
                    update(property);
                }
            } else {
                _.each(XPATH_REFERENCES, update);
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
                var pkey = mug.ufid + " " + property + " " + paths[0];
                if (seen.hasOwnProperty(pkey)) {
                    return;
                }
                seen[pkey] = null;
                var expr = new LogicExpression(mug.p[property], form.xpath),
                    orig = expr.getText();
                expr.updatePath(paths[0], paths[1]);
                if (orig !== expr.getText()) {
                    // update without triggering validation/events
                    mug.p.set(property, expr.getText());
                }
            }
            this.forEachReferencingProperty(data, updatePath, subtree);
        },
        /**
         * Call a function for each mug with broken references
         *
         * The function is called with one argument: the mug with broken
         * references.
         */
        forEachBrokenReference: function(func) {
            _.each(_.keys(this.errors), function (ufid) {
                var mug = this.form.getMugByUFID(ufid);
                if (mug) {
                    func(mug);
                } else {
                    delete this.errors[ufid];
                }
            }, this);
        },
        /**
         * Call function for each expression property that references a mug
         * identified by one of the given ufids
         *
         * @param ufids - a mapping (object) keyed by mug ufids.
         *        Example: {"mug-ufid": <someValue>, ...}
         * @param func - a function to be called for each expression property that
         *        references one of the mugs. The function is called with
         *        three arguments: (mug, property, mapValue)
         *        - mug: the mug with an expression property referencing the mug
         *          identified one of the given ufids ("mug-ufid").
         *        - property: the name of the expression property.
         *        - mapValue: the value from ufids (<someValue>).
         * @param subtree - (optional) only visit references from nodes
         *        beginning with this path (no trailing /)
         */
        forEachReferencingProperty: function(ufids, func, subtree) {
            var _this = this;
            _(this.all).each(function (elem) {
                if (ufids.hasOwnProperty(elem.ref) &&
                    (!subtree ||
                     elem.sourcePath === subtree ||
                     elem.sourcePath.indexOf(subtree + '/') === 0))
                {
                    var mug = _this.form.getMugByUFID(elem.mug);
                    func(mug, elem.property, ufids[elem.ref]);
                }
            });
        },
        reset: function () {
            this.all = [];
        },
        // This is to tell HQ's case summary what is referenced
        caseReferences: function () {
            // hq implementation details
            var ret = {
                condition: {
                    answer: null,
                    question: null,
                    type: 'always',
                    operator: null
                }
            };

            ret.preload = _.chain(this.all)
                .filter(function(ref) {
                    return ref.path.startsWith('#case');
                })
                .map(function(ref) {
                    var info = ref.path.split('/'),
                        prop = info[2];
                    if (prop === 'case_name') {
                        prop = 'name';
                    }
                    return [ref.sourcePath.replace(/^#form/, '/data'), prop];
                }).object().value();

            return ret;
        },
        // returns object of hashtags. used for writing to xml
        // format {hashtag: xpath} (null is used fmr cases as they will be loaded later)
        referencedHashtags: function () {
            return _.chain(this.all)
                .filter(function(ref) {
                    return ref.path.startsWith('#case');
                })
                .map(function(ref) {
                    return [ref.path, null];
                }).object().value();
        }
    };

    return {
        LogicManager: LogicManager,
        LogicExpression: LogicExpression,
        XPATH_REFERENCES: XPATH_REFERENCES,
        NO_SELF_REFERENCES: NO_SELF_REFERENCES,
    };
});
