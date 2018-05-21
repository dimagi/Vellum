define([
    'jquery',
    'underscore',
    'vellum/debugutil',
    'vellum/atwho',
    'vellum/richText',
    'vellum/hqAnalytics',
    'tpl!vellum/templates/xpath_validation_errors',
    'tpl!vellum/templates/xpath_expression',
    'tpl!vellum/templates/xpath',
], function (
    $,
    _,
    debug,
    atwho,
    richText,
    analytics,
    xpath_validation_errors,
    xpath_expression,
    xpath_tpl
) {
    function validateXPath(form, expr) {
        if (expr) {
            if (richText.isInvalid(expr)) {
                expr = richText.unescapeXPath(expr, form);
            }
            try {
                var parsed = form.xpath.parse(expr);
                return [true, parsed];
            } catch (err) {
                return [false, err];
            }
        }
        return [true, null];
    }

    function showXPathEditor($div, options) {
        var editorContent = $div,
            richTextOptions = {isExpression: true},
            form = options.mug.form,
            validate = _.partial(validateXPath, form),
            saveButton;
        options = _.defaults(options, {
            leftPlaceholder: gettext("Drag question here"),
            rightPlaceholder: gettext("Drag question here"),
        });

        var handleChange = function () {
            saveButton.removeClass("btn-default disabled").addClass("btn-success");
            options.change();
        };

        // Handlers for the simple expression editor
        var simpleExpressions = {};
        var operationOpts = [];
        var expTypes = form.xpath.models.XPathExpressionTypeEnum;
        var BinOpHandler = {
            toString: function(op, left, right) {
                // make sure we wrap the vals in parens in case they were necessary
                // todo, construct manually, and validate individual parts.
                return "(" + left + ") " + 
                    form.xpath.models.expressionTypeEnumToXPathLiteral(op) + 
                    " (" + right + ")";
            },
            typeLeftRight: function(expOp) {
                return expOp;
            }
        };
        var FunctionHandler = {
            toString: function(op, left, right) {
                return op + "(" + left + ", " + right + ")";
            },
            typeLeftRight: function(expOp) {
                if (expOp.args.length !== 2) return false;
                return {
                    type: expOp.id,
                    left: expOp.args[0],
                    right: expOp.args[1]
                };
            }
        };
        function addOp(expr, value, label) {
            value = form.xpath.models.expressionTypeEnumToXPathLiteral(value);
            simpleExpressions[value] = expr;
            operationOpts.push([label, value]);
        }

        addOp(BinOpHandler, expTypes.EQ, gettext("is equal to"));
        addOp(BinOpHandler, expTypes.NEQ, gettext("is not equal to"));
        addOp(BinOpHandler, expTypes.LT, gettext("is less than"));
        addOp(BinOpHandler, expTypes.LTE, gettext("is less than or equal to"));
        addOp(BinOpHandler, expTypes.GT, gettext("is greater than"));
        addOp(BinOpHandler, expTypes.GTE, gettext("is greater than or equal to"));
        addOp(FunctionHandler, "selected", gettext("has selected value"));

        var getExpressionInput = function () {
            return $div.find(".fd-xpath-editor-text");
        };

        var setExpression = function(input, val) {
            if (options.mug.form.richText) {
                richText.editor(input, form, richTextOptions).setValue(val);
            } else {
                input.val(val);
            }
        };

        var getExpression = function(input) {
            if (options.mug.form.richText) {
                return richText.editor(input, form, richTextOptions).getValue();
            } else {
                return input.val();
            }
        };

        var getValidationSummary = function () {
            return $div.find(".fd-xpath-validation-summary");
        };
        var getExpressionPane = function () {
            return $div.find(".fd-xpath-editor-expressions");
        };
        var getTopLevelJoinSelect = function () {
            return $(editorContent.find(".top-level-join-select")[0]);
        };
        var addAutocomplete = function (input, choices) {
            if (choices) {
                if (_.isFunction(choices)) {
                    choices = choices();
                }
                atwho.autocomplete(input, options.mug, {choices: choices});
            } else {
                atwho.autocomplete(input, options.mug, {
                    property: options.path,
                    useRichText: options.mug.form.richText,
                });
            }
        };

        var getExpressionFromSimpleMode = function () {
            // basic
            var pane = getExpressionPane();
            var expressionParts = [];
            var joinType = getTopLevelJoinSelect().val();
            pane.children().each(function() {
                var left = getExpression($(this).find(".left-question")),
                    right = getExpression($(this).find(".right-question"));

                // ignore empty expressions
                if (left === "" && right === "") {
                    return;
                }
                var op = $($(this).find(".op-select")[0]).val();
                var exprPath = simpleExpressions[op].toString(op, left, right);
                expressionParts.push(exprPath);
            });
            var preparsed = expressionParts.join(" " + joinType + " ");
            // try to parse and unparse to clean up the formatting
            var results = validate(preparsed);
            if (results[0] && results[1]) {
                return results[1].toXPath();
            }
            return preparsed;
        };

        var getExpressionFromUI = function () {
            if ($div.find(".xpath-simple").hasClass('hide')) {
                // advanced
                return getExpression(getExpressionInput());
            } else {
                return getExpressionFromSimpleMode();
            }
        };

        var tryAddExpression = function(parsedExpression, joiningOp) {
            // trys to add an expression to the UI.
            // if the expression is empty just appends a new div for the expression.
            // if the expression exists, it will try to parse it into sub
            // expressions.
            // returns the expression if it succeeds, otherwise false.
            if (parsedExpression && options.DEBUG_MODE) {
                debug.log("trying to add", parsedExpression.toString());
            }

            var isJoiningOp = function (subElement) {
                // something that joins expressions
                return (subElement instanceof form.xpath.models.XPathBoolExpr);
            };

            var isExpressionOp = function (subElement) {
                // something that can be put into an expression
                return (subElement instanceof form.xpath.models.XPathCmpExpr ||
                        subElement instanceof form.xpath.models.XPathEqExpr ||
                        simpleExpressions.hasOwnProperty(subElement.id));
            };

            var newExpressionUIElement = function (expOp) {
                var tag = 'input', tagArgs = '';
                if (options.mug.form.richText) {
                    tag = 'div';
                    tagArgs = 'contenteditable="true"';
                }

                var $expUI = $(xpath_expression({
                    operationOpts: operationOpts,
                    leftPlaceholder: options.leftPlaceholder,
                    rightPlaceholder: options.rightPlaceholder,
                    tag: tag,
                    tagArgs: tagArgs,
                }));

                if (options.mug.form.richText) {
                    $expUI.find('.fd-input').each(function () {
                        richText.editor($(this), form, richTextOptions);
                    });
                }

                var getLeftQuestionInput = function () {
                    return $($expUI.find(".left-question")[0]);
                };

                var getRightQuestionInput = function () {
                    return $($expUI.find(".right-question")[0]);
                };

                var validateExpression = function(item) {
                    handleChange();
                    var le = getExpression(getLeftQuestionInput()),
                        re = getExpression(getRightQuestionInput());


                    $expUI.find('.validation-results').addClass('hide');

                    if (le && validate(le)[0] && re && validate(re)[0]) {
                        $expUI.find('.validation-results.alert-success').removeClass('hide');
                    } else {
                        $expUI.find('.validation-results.alert-danger').removeClass('hide');
                    }
                };

                var populateQuestionInputBox = function (input, expr, pairedExpr) {
                    setExpression(input, expr.toXPath());
                };

                // add event handlers to validate the inputs
                if (options.mug.form.richText) {
                    $expUI.find('.xpath-edit-node').each(function () {
                        richText.editor($(this), form, richTextOptions).on('change', validateExpression);
                    });
                } else {
                    $expUI.find('.xpath-edit-node').on('keyup change', validateExpression);
                }
                $expUI.find('.op-select').on('change', validateExpression);

                $expUI.find('.xpath-delete-expression').click(function() {
                    $expUI.remove();
                    handleChange();
                });

                if (expOp) {
                    // populate
                    if (options.DEBUG_MODE) {
                        debug.log("populating", expOp.toString());
                    }
                    if (simpleExpressions.hasOwnProperty(expOp.id)) {
                        // comparison and equality operators DO NOT have an "id"
                        // property, so they will not get here. It doesn't
                        // matter though since already fulfill the necessary
                        // "type/left/right" interface.
                        expOp = simpleExpressions[expOp.id].typeLeftRight(expOp);
                        if (!expOp) return false;
                    }
                    populateQuestionInputBox(getLeftQuestionInput(), expOp.left);
                    $expUI.find('.op-select').val(form.xpath.models.expressionTypeEnumToXPathLiteral(expOp.type));
                    // the population of the left can affect the right,
                    // so we need to update the reference
                    populateQuestionInputBox(getRightQuestionInput(), expOp.right, expOp.left);
                }

                addAutocomplete(getLeftQuestionInput(), options.leftAutocompleteChoices);
                addAutocomplete(getRightQuestionInput(), options.rightAutocompleteChoices);

                return $expUI;
            };

            var failAndClear = function () {
                getExpressionPane().empty();
                if (options.DEBUG_MODE) {
                    debug.log("fail", parsedExpression);
                }
                return false;
            };

            var expressionPane = getExpressionPane();
            var expressionUIElem, leftUIElem, rightUIElem;
            if (!parsedExpression) {
                // just create a new expression
                expressionUIElem = newExpressionUIElement();
                return expressionUIElem.appendTo(expressionPane);
            } else {
                // we're creating for an existing expression, this is more complicated

                if (isExpressionOp(parsedExpression)) {
                    // if it's an expression op stick it in.
                    // no need to join, so this is good.
                    expressionUIElem = newExpressionUIElement(parsedExpression);
                    if (!expressionUIElem) {
                        return failAndClear();
                    }
                    return expressionUIElem.appendTo(expressionPane);
                } else if (isJoiningOp(parsedExpression)) {
                    // if it's a joining op the first element has to be
                    // an expression and the second must be a valid op
                    // isExpressionOp(parsedExpression.right))
                    if (joiningOp && parsedExpression.type !== joiningOp) {
                        // we tried to add a joining op that was different from
                        // what we were already working on. Fail.
                        return failAndClear();
                    }
                    leftUIElem = tryAddExpression(parsedExpression.left, parsedExpression.type);
                    rightUIElem = tryAddExpression(parsedExpression.right, parsedExpression.type);
                    if (leftUIElem && rightUIElem) {
                        leftUIElem.appendTo(expressionPane);
                        rightUIElem.appendTo(expressionPane);
                        getTopLevelJoinSelect().val(parsedExpression.type);
                    } else {
                        // something recursively failed. Raise failure up.
                        return failAndClear();
                    }
                    return rightUIElem; // this is arbitrary / maybe wrong
                } else {
                    // fail and return nothing.
                    return failAndClear();
                }
            }
        };

        var setUIForExpression = function (xpathstring) {
            if (options.DEBUG_MODE) {
                debug.log("setting ui for", xpathstring);
            }
            var results = validate(xpathstring);
            if (results[0]) {
                // it parsed correctly, try to load it.
                var parsed = results[1];
                // try to load the operation into the UI.
                if (tryAddExpression(parsed)) {
                    // it succeeded. nothing more to do
                } else {
                    // show advanced mode.
                    showAdvancedMode(parsed.toXPath(), true);
                }
            } else {
                showAdvancedMode(xpathstring, true);
            }
        };

        var updateXPathEditor = function(options) {
            // clear validation text
            getValidationSummary()
                .text("")
                .addClass("hide");

            // clear expression builder
            var expressionPane = getExpressionPane();
            expressionPane.empty();

            // update expression builder
            if (options.xpathType === "bool") {
                showSimpleMode(options.value);
                if (!options.value) {
                    tryAddExpression();
                }
            } else {
                if (options.mug.form.richText) {
                    showAdvancedMode(options.value);
                } else {
                    showAdvancedMode(form.normalizeXPath(options.value));
                }
            }
        };

        // toggle simple/advanced mode
        var showAdvancedMode = function (text, showNotice) {
            setExpression(getExpressionInput(), text);
            addAutocomplete(getExpressionInput());
            getExpressionPane().empty();

            $div.find(".xpath-advanced").removeClass('hide');
            $div.find(".xpath-simple").addClass('hide');
            $div.find('.fd-xpath-actions').removeClass('form-actions-condensed');
            if (showNotice) {
                $div.find(".xpath-advanced-notice").removeClass('hide');
                $div.find(".fd-xpath-show-simple-button").addClass('hide');
            } else {
                $div.find(".xpath-advanced-notice").addClass('hide');
                $div.find(".fd-xpath-show-simple-button").removeClass('hide');
            }
        };
        var showSimpleMode = function (text) {
            $div.find(".xpath-simple").removeClass('hide');
            $div.find('.fd-xpath-actions').addClass('form-actions-condensed');
            $div.find(".xpath-advanced").addClass('hide');

            getExpressionPane().empty();
            // this sometimes sends us back to advanced mode (if we couldn't parse)
            // for now consider that fine.
            if (text) {
                setUIForExpression(text);
            }
        };

        var initXPathEditor = function() {
            var tag = 'textarea', tagArgs = 'rows="5"';
            if (options.mug.form.richText) {
                tag = 'div';
                tagArgs = 'contenteditable="true"';
            }

            var $xpathUI = $(xpath_tpl({
                topLevelJoinOpts: [
                    [gettext("True when ALL of the expressions are true."), expTypes.AND],
                    [gettext("True when ANY of the expressions are true."), expTypes.OR]
                ],
                tag: tag,
                tagArgs: tagArgs,
            }));
            editorContent.html($xpathUI);
            saveButton = $xpathUI.find('.fd-xpath-save-button');

            $xpathUI.find('.fd-xpath-show-advanced-button').click(function () {
                analytics.fbUsage('Edit Expression', 'Show Advanced Mode');
                showAdvancedMode(getExpressionFromSimpleMode());

            });

            $xpathUI.find('.fd-xpath-show-simple-button').click(function () {
                showSimpleMode(getExpression(getExpressionInput()));
            });

            $xpathUI.find('.fd-add-exp').click(function () {
                tryAddExpression();
            });

            var advancedInput = $xpathUI.find('.fd-xpath-editor-text');
            if (options.mug.form.richText) {
                richText.editor(advancedInput, form, richTextOptions)
                        .on('change', handleChange);
            } else {
                advancedInput.on('change keyup', handleChange);
            }

            var done = function (val) {
                options.done(val);
                editorContent.empty();
            };

            saveButton.addClass("disabled").click(function() {
                var uiExpression  = getExpressionFromUI();
                setExpression(getExpressionInput(), uiExpression);
                var results = validate(uiExpression);
                if (results[0]) {
                    done(uiExpression);
                } else {
                    getValidationSummary()
                        .html($(xpath_validation_errors({
                            errors: results[1].message
                        })))
                        .removeClass("hide");
                }
            });

            $xpathUI.find('.fd-xpath-cancel-button').click(function () {
                done(false);
            });
            return $xpathUI;
        };

        var $xpathUI = initXPathEditor();
        updateXPathEditor(options);
        if (options.onLoad) {
            options.onLoad($xpathUI);
        }
    }

    return {
        showXPathEditor: showXPathEditor,
        validateXPath: validateXPath,
    };
});
