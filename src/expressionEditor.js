define([
    'jquery',
    'underscore',
    'vellum/debugutil',
    'vellum/util',
    'xpath',
    'xpathmodels',
    'tpl!vellum/templates/xpath_validation_errors',
    'tpl!vellum/templates/xpath_expression',
    'tpl!vellum/templates/xpath',
    'less!vellum/less-style/xpath-editor'
], function (
    $,
    _,
    debug,
    util,
    xpath,
    xpathmodels,
    xpath_validation_errors,
    xpath_expression,
    xpath_tpl
) {
    // Handlers for the simple expression editor
    var simpleExpressions = {};
    var operationOpts = [];
    var expTypes = xpathmodels.XPathExpressionTypeEnum;
    var BinOpHandler = {
        toString: function(op, left, right) {
            // make sure we wrap the vals in parens in case they were necessary
            // todo, construct manually, and validate individual parts.
            return "(" + left + ") " + 
                xpathmodels.expressionTypeEnumToXPathLiteral(op) + 
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
        value = xpathmodels.expressionTypeEnumToXPathLiteral(value);
        simpleExpressions[value] = expr;
        operationOpts.push([label, value]);
    }

    addOp(BinOpHandler, expTypes.EQ, "is equal to");
    addOp(BinOpHandler, expTypes.NEQ, "is not equal to");
    addOp(BinOpHandler, expTypes.LT, "is less than");
    addOp(BinOpHandler, expTypes.LTE, "is less than or equal to");
    addOp(BinOpHandler, expTypes.GT, "is greater than");
    addOp(BinOpHandler, expTypes.GTE, "is greater than or equal to");
    addOp(FunctionHandler, "selected", "has selected value");

    function showXPathEditor($div, options) {
        var editorContent = $div;
        options = _.defaults(options, {
            leftPlaceholder: "Hint: drag a question here.",
            rightPlaceholder: "Hint: drag a question here.",
        });

        var getExpressionInput = function () {
            return $div.find(".fd-xpath-editor-text");
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
                util.dropdownAutocomplete(input, choices);
            }
            else {
                util.questionAutocomplete(input, options.mug,
                                          {property: options.path});
            }
        };

        var getExpressionFromSimpleMode = function () {
            // basic
            var pane = getExpressionPane();
            var expressionParts = [];
            var joinType = getTopLevelJoinSelect().val();
            pane.children().each(function() {
                var left = $($(this).find(".left-question")[0]).val();
                var right = $($(this).find(".right-question")[0]).val();
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
                return getExpressionInput().val();
            } else {
                return getExpressionFromSimpleMode();
            }
        };

        var validate = function (expr) {
            if (expr) {
                try {
                    var parsed = xpath.parse(expr);
                    return [true, parsed];
                } catch (err) {
                    return [false, err];
                }
            }
            return [true, null];
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
                return (subElement instanceof xpathmodels.XPathBoolExpr);
            };

            var isExpressionOp = function (subElement) {
                // something that can be put into an expression
                return (subElement instanceof xpathmodels.XPathCmpExpr ||
                        subElement instanceof xpathmodels.XPathEqExpr ||
                        simpleExpressions.hasOwnProperty(subElement.id));
            };

            var newExpressionUIElement = function (expOp) {

                var $expUI = $(xpath_expression({
                    operationOpts: operationOpts,
                    leftPlaceholder: options.leftPlaceholder,
                    rightPlaceholder: options.rightPlaceholder
                }));

                var getLeftQuestionInput = function () {
                    return $($expUI.find(".left-question")[0]);
                };

                var getRightQuestionInput = function () {
                    return $($expUI.find(".right-question")[0]);
                };

                var validateExpression = function(item) {
                    options.change();

                    var le = getLeftQuestionInput().val(),
                        re = getRightQuestionInput().val();

                    $expUI.find('.validation-results').addClass('hide');

                    if (le && validate(le)[0] && re && validate(re)[0]) {
                        $expUI.find('.validation-results.alert-success').removeClass('hide');
                    } else {
                        $expUI.find('.validation-results.alert-error').removeClass('hide');
                    }
                };

                var populateQuestionInputBox = function (input, expr, pairedExpr) {
                    input.val(expr.toXPath());
                };

                // add event handlers to validate the inputs
                $expUI.find('.xpath-edit-node').on('keyup change', validateExpression);

                $expUI.find('.xpath-delete-expression').click(function() {
                    $expUI.remove();
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
                    $expUI.find('.op-select').val(xpathmodels.expressionTypeEnumToXPathLiteral(expOp.type));
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
                    $div.find('.fd-add-exp').click();
                }
            } else {
                showAdvancedMode(options.value);
            }

            $div.find(".fd-xpath-editor-text").val(options.value);
        };

        // toggle simple/advanced mode
        var showAdvancedMode = function (text, showNotice) {
            getExpressionInput().val(text);
            addAutocomplete(getExpressionInput());
            getExpressionPane().empty();

            $div.find(".xpath-advanced").removeClass('hide');
            $div.find(".xpath-simple").addClass('hide');
            $div.find('.fd-xpath-actions').removeClass('form-actions-condensed');
            if (showNotice) {
                $div.find(".xpath-advanced-notice").removeClass('hide');
            } else {
                $div.find(".xpath-advanced-notice").addClass('hide');
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
            var $xpathUI = $(xpath_tpl({
                topLevelJoinOpts: [
                    ["True when ALL of the expressions are true.", expTypes.AND],
                    ["True when ANY of the expressions are true.", expTypes.OR]
                ]
            }));
            editorContent.empty().append($xpathUI);

            $xpathUI.find('.fd-xpath-show-advanced-button').click(function () {
                if (window.analytics) {
                    window.analytics.usage('Form Builder', 'Edit Expression',
                              'Show Advanced Mode');
                }

                showAdvancedMode(getExpressionFromSimpleMode());

            });

            $xpathUI.find('.fd-xpath-show-simple-button').click(function () {
                showSimpleMode(getExpressionInput().val());
            });

            $xpathUI.find('.fd-add-exp').click(function () {
                tryAddExpression();
            });

            $xpathUI.find('.fd-xpath-editor-text').on('change keyup', function (){
                options.change();
            });

            var done = function (val) {
                $div.find('.fd-xpath-editor').hide();
                options.done(val);
            };

            $xpathUI.find('.fd-xpath-save-button').click(function() {
                var uiExpression  = getExpressionFromUI();
                getExpressionInput().val(uiExpression);
                var results = validate(uiExpression),
                    hasInstance = uiExpression.match('instance\\(');
                if (results[0] || hasInstance) {
                    if (hasInstance) {
                        window.alert(
                            "This expression is too complex for us to verify; " +
                            "specifically, it makes use of the 'instance' " +
                            "construct. Please be aware that if you use this " +
                            "construct you're on your own in verifying that " +
                            "your expression is correct.");
                    }
                    done(uiExpression);
                } else {
                    getValidationSummary()
                        .html($(xpath_validation_errors({
                            errors: results[1]
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
        showXPathEditor: showXPathEditor
    };
});
