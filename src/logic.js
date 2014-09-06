define([
    'vellum/util',
    'xpath',
    'xpathmodels',
    'underscore'
], function (
    util,
    xpath,
    xpathmodels,
    _
) {
    function LogicExpression (exprText) {
        this._text = exprText || "";
        
        this.valid = false;
        if (exprText) {
            try {
                this.parsed = xpath.parse(exprText);
                this.valid = true;
            } catch (err) {
                // nothing to do
            }
        } else {
            this.empty = true;
        }
    }
    LogicExpression.prototype = {
        getPaths: function () {
            var paths = [];
            if (this.parsed) {
                var queue = [this.parsed], 
                    node, i, children;
                while (queue.length > 0) {
                    node = queue.shift();
                    if (node instanceof xpathmodels.XPathPathExpr) {
                        paths.push(node);
                    }
                    children = node.getChildren();
                    for (i = 0; i < children.length; i++) {
                        queue.push(children[i]);
                    }
                }
            }
            return paths;
        },
        updatePath: function (from, to) {
            var paths = this.getPaths(),
                path;
            
            var replacePathInfo = function (source, destination) {
                // copies information from source to destination in place,
                // resulting in mutating destination while preserving the 
                // original object reference.
                destination.initial_context = source.initial_context;
                destination.steps = source.steps;
                destination.filter = source.filter;
            };
            
            for (var i = 0; i < paths.length; i++) {
                path = paths[i];
                if (path.toXPath() === from) {
                    replacePathInfo(xpath.parse(to), path);
                }
            }
        },
        getText: function () {
            if (this.valid) {
                return this.parsed.toXPath();
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
        getErrors: function (mug) {
            return _.pluck(
                _.values(this.errors[mug.ufid] || {}), 'message');
        },
        clearReferences: function (mug, property) {
            this.all = this.all.filter(function (elem) { 
                return elem.mug !== mug.ufid || elem.property !== property;
            });
        },
        addReferences: function (mug, property) {
            // get absolute paths from mug property's value
            var _this = this,
                expr = new LogicExpression(mug.p[property]),
                paths = expr.getPaths().filter(function (p) {
                    // currently we don't do anything with relative paths
                    return p.initial_context ===
                        xpathmodels.XPathInitialContextEnum.ROOT; 
                }),
                error = {
                    level: "form-warning",
                    key: mug.ufid + "-" + property + "-badpath",
                    message: []
                };

            // append item for each mug referenced (by absolute path) in mug's
            // property value
            this.all = this.all.concat(paths.map(function (path) {
                var pathString = path.pathWithoutPredicates(),
                    pathWithoutRoot = pathString.substring(1 + pathString.indexOf('/', 1)),
                    refMug = _this.form.getMugByPath(pathString);

                if (!refMug && _this.opts.allowedDataNodeReferences.indexOf(pathWithoutRoot) === -1) {
                    error.message.push("The question '" + mug.p.nodeID + 
                        "' references an unknown question " + path.toXPath() + 
                        " in its " + mug.p.getDefinition(property).lstring + ".");

                }
                return {
                    mug: mug.ufid, // mug with property value referencing refMug
                    ref: refMug ? refMug.ufid : "", // referenced Mug
                    property: property,
                    path: path.toXPath(), // path to refMug
                    sourcePath: _this.form.getAbsolutePath(mug)
                };      
            }));
           
            if (error.message.length > 0) {
                if (!this.errors[mug.ufid]) {
                    this.errors[mug.ufid] = {};
                }
                this.errors[mug.ufid][property] = error;
            } else {
                if (this.errors[mug.ufid]) {
                    delete this.errors[mug.ufid][property];
                }
            }        
        },
        updateAllReferences: function (mug, clear) {
            // avoid control-only nodes
            if (mug.p.nodeID) {
                for (var i = 0; i < util.XPATH_REFERENCES.length; i++) {
                    var property = util.XPATH_REFERENCES[i];
                    this.clearReferences(mug, property);
                    this.addReferences(mug, property);
                }
            }
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
            var found = this.all.filter(function (elem) {
                return data.hasOwnProperty(elem.ref) && 
                    (!subtree || elem.sourcePath === subtree || elem.sourcePath.indexOf(subtree + '/') === 0);
            });
            var ref, mug, expr, pkey, mugId, orig, seen = {};
            for (var i = 0; i < found.length; i++) {
                ref = found[i];
                pkey = ref.mug + " " + ref.property;
                if (seen.hasOwnProperty(pkey)) {
                    continue;
                }
                seen[pkey] = null;
                mug = this.form.getMugByUFID(ref.mug);
                expr = new LogicExpression(mug.p[ref.property]);
                orig = expr.getText();
                for (mugId in data) {
                    if (data.hasOwnProperty(mugId)) {
                        expr.updatePath(data[mugId][0], data[mugId][1]);
                    }
                }
                if (orig !== expr.getText()) {
                    mug.p[ref.property] = expr.getText();
                } 
            }
        },
        reset: function () {
            this.all = [];
        }
    };

    return {
        LogicManager: LogicManager
    };
});
