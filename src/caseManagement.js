import $ from "jquery";
import _ from "underscore";
import mugs from "vellum/mugs";
import nudgeLearn from "vellum/templates/case_management_learning_nudge.html";
import nudgeName from "vellum/templates/case_management_name_nudge.html";
import tmpAutoAssign from "vellum/templates/case_management_auto_assign_name.html";
import tplAutoAssignedName from "vellum/templates/case_management_auto_assigned_name.html";
import util from "vellum/util";
import widgets from "vellum/widgets";
import { compareCaseMappings, formatCaseMappingDiff } from "vellum/caseDiff";


function casePropertyDropdownWidget (mug, opts) {
    opts.defaultOptions = getOptions(opts.vellum.data.caseManagement, mug);
    opts.useValueAsCustomName = true;
    const widget = widgets.dropdown(mug, opts);
    widget.postRender = function () {
        widget.input.select2({
            tags: true,
            allowClear: true,
            placeholder: '',
        });
        widget.input.on('remove', function () {
            if (widget.input.data('select2')) {
                widget.input.select2('destroy');
            }
        });
    };

    const super_updateValue = widget.updateValue;
    widget.updateValue = function () {
        const val = widget.getValue();
        const WHITESPACE = /\s/g;

        if (val && WHITESPACE.test(val)) {
            widget.setValue(val.replace(WHITESPACE, '_'));
        }

        super_updateValue();
    };

    const updateProperties = _.debounce(() => {
        const value = widget.input.val();
        widget.clearOptions();
        widget.addOptions(getOptions(opts.vellum.data.caseManagement, mug, value));
        widget.input.val(value);
        widget.input.trigger('change.select2');
    }, 500);

    mug.on('property-changed', e => (
        e.property === 'nodeID' && updateProperties()
    ), null, 'teardown-mug-properties');

    mug.form.on('question-label-text-change', () => (
        !mug.p.nodeID && updateProperties()
    ), null, null, widget);

    mug.on("teardown-mug-properties", () => {
        mug.form.unbind(widget);
    }, null, "teardown-mug-properties");

    return widget;
}

function getOptions(data, mug, value) {
    const properties = new Set(data.properties);
    Object.keys(data.caseMappings || {}).forEach(p => properties.add(p));
    if (value) {
        properties.add(value);
    }
    let nodeID = mug.p.nodeID;
    if (!nodeID && mug.form.vellum.getMugDisplayName(mug)) {
        nodeID = mug.form.vellum.nodeIDFromLabel(mug);
    }
    properties.delete(nodeID);
    const options = [...properties].sort();
    if (nodeID) {
        options.unshift(nodeID);  // nodeID is always the first option
    }
    return options.map(prop => ({ text: prop, value: prop }));
}

function addCaseMappings(mug, data, saveButton) {
    if (!mug.absolutePath) {
        // no use trying to find a mapping for a question that doesn't have a path
        return;
    }

    const questionMappings = data.caseMappingsByQuestion[mug.absolutePath];

    mug.p.set('caseProperty', questionMappings?.[0] || null);
    mug.dropAllMessages('caseProperty');
    if (questionMappings && questionMappings.length > 0) {
        if (questionMappings.length > 1) {
            // if a question is attempting to update multiple cases,
            // it will be disabled. Leave an informational message
            // to explain that this needs to be edited with the case management page
            addMultipleAssignmentsMessageToMug(mug, data.view_form_url);
        }

        questionMappings.forEach(caseProperty => {
            const questions = data.caseMappings[caseProperty];
            if (questions.length >= 2) {
                addConflictMessageToMug(mug, caseProperty);
            }
            if (questions.find(q => q.question_path === mug.absolutePath)?.conflicting_delete) {
                addConflictingDeleteMessageToMug(mug, questions[0], saveButton);
            }
        });
    }
}

const CONFLICT_MSG_KEY = 'mug-caseProperty-conflict';
const CONFLICTING_DELETE_MSG_KEY = 'mug-caseProperty-conflicting-delete';
const MULTI_ASSIGNMENT_MSG_KEY = 'mug-caseProperty-multipleAssignments';

function addConflictMessageToMug(mug, caseProperty) {
    const message = {
        key: CONFLICT_MSG_KEY,
        message: util.format(gettext(
            '"{caseProperty}" is assigned by another question. You can still save the form, ' +
            'but will need to have only one question for any case property in order to ' +
            'build the application'), {caseProperty}),
        level: mug.WARNING,
    };
    mug.addMessage('caseProperty', message);
}

function addConflictingDeleteMessageToMug(mug, question, saveButton) {
    const message = {
        key: CONFLICTING_DELETE_MSG_KEY,
        message: gettext(
            'This mapping was concurrently changed and deleted.\n\n' +
            'Dismiss this alert to keep the mapping.'),
        level: mug.WARNING,
        onDrop: () => {
            delete question.conflicting_delete;
            saveButton.fire('change');
        },
    };
    mug.addMessage('caseProperty', message);
}

function addMultipleAssignmentsMessageToMug(mug, url) {
    const message = {
        key: MULTI_ASSIGNMENT_MSG_KEY,
        message: {
            markdown: util.format(
                gettext(
                    'This question is used to update multiple case properties. ' +
                    'If you wish to update these case properties, ' +
                    'please visit the [Manage Case Page]({url})'
                ),
                {url}
            )
        },
        level: mug.INFO,
    };
    mug.addMessage('caseProperty', message);
}

/**
 * Add case mappings to plugin data
 *
 * Mappings for unknown questions are not added to the plugin data.
 *
 * @param {Object} caseMappings - {"caseProperty": [{"question_path": ...}, ...], ...}
 * @param {Object} data - plugin data to which caseMappings and
 *                        caseMappingsByQuestion will be assigned.
 * @param {Form} form
 */
function addCaseMappingsToPlugin(caseMappings, data, form) {
    function isKnownQuestion(question) {
        const path = question.question_path;
        if (!path) {
            return false;
        } else if (!Object.hasOwn(cache, path)) {
            cache[path] = !!form.getMugByPath(path);
        }
        return cache[path];
    }
    const cache = {};
    const mappings = {};
    const byQuestion = {};
    Object.entries(caseMappings).forEach(([property, questions]) => {
        questions = questions.filter(isKnownQuestion);
        if (questions.length) {
            mappings[property] = questions;
            questions.forEach(question => {
                const path = question.question_path;
                byQuestion[path] = byQuestion[path] || [];
                byQuestion[path].push(property);
            });
        }
    });
    data.caseMappings = mappings;
    data.caseMappingsByQuestion = byQuestion;
}

class XMLCaseMappingsBuilder {
    getMappings (xml) {
        if (!xml) {
            return;
        }

        const head = xml.find(':root > h\\:head, :root > head');
        const caseMappingSection = head.find('> vellum\\:case_mappings');
        if (caseMappingSection.length > 0) {
            const mappingElements = caseMappingSection.children().toArray();
            return this.buildMappingsFromXMLElements(mappingElements);
        }
    }

    buildMappingsFromXMLElements (mappingElements) {
        const mappings = {};
        mappingElements.forEach(mappingElement => {
            const propertyValue = mappingElement.attributes.property.value;
            const questionsList = [];
            const questionElements = $(mappingElement).children();
            questionElements.each((index, questionElement) => {
                questionsList.push(this.buildQuestionFromXMLElement(questionElement));
            });
            mappings[propertyValue] = questionsList;
        });

        return mappings;
    }

    buildQuestionFromXMLElement (questionElement) {
        const question = {};
        for (let i = 0; i < questionElement.attributes.length; i++) {
            const item = questionElement.attributes.item(i);
            question[item.name] = item.value;
        }

        return question;
    }
}

class XMLCaseMappingWriter {
    constructor (xmlWriter) {
        this.writer = xmlWriter;
    }

    writeCaseMappingsElement (data) {
        if (!data.hasOwnProperty('caseMappings')) {
            return;
        }

        this.writer.writeStartElement('vellum:case_mappings');
        Object.entries(data.caseMappings).forEach(([property, questions]) => {
            this.writeMappingElement(property, questions);
        });
        this.writer.writeEndElement();
    }

    writeMappingElement (property, questions) {
        this.writer.writeStartElement('mapping');
        this.writer.writeAttributeString('property', property);
        questions.forEach(question => this.writeQuestionElement(question));
        this.writer.writeEndElement(); // end mapping element
    }

    writeQuestionElement (question) {
        this.writer.writeStartElement('question');
        Object.entries(question).forEach(([key, val]) => {
            this.writer.writeAttributeString(key, val);
        });
        this.writer.writeEndElement(); // end question element
    }
}

class CaseMapMaintainer {
    constructor (form, data) {
        this.form = form;
        this.data = data;
    }

    updateFormMappings (questionPath, prev, current) {
        this.replaceFormQuestionMappings(questionPath, prev, current);
        this.replaceFormPropertyMappings(questionPath, prev, current);
    }

    replaceFormQuestionMappings (questionPath, prev, current) {
        this.data.caseMappingsByQuestion[questionPath] = this.data.caseMappingsByQuestion[questionPath] || [];
        const mappings = this.data.caseMappingsByQuestion[questionPath];
        let prevIndex = 0;

        if (prev) {
            // remove the previous element
            prevIndex = mappings.findIndex((ele) => ele === prev);
            mappings.splice(prevIndex, 1);
        }

        if (current) {
            mappings.splice(prevIndex, 0, current);
        } else {
            // no current, check if we should remove the mappings
            if (mappings.length === 0) {
                delete this.data.caseMappingsByQuestion[questionPath];
            }
        }
    }

    replaceFormPropertyMappings (questionPath, prev, current) {
        const mappings = this.data.caseMappings;
        let questions = prev ? mappings[prev] || [] : [];
        let question = null;

        let prevIndex = questions.findIndex((question) => question.question_path === questionPath);
        if (prevIndex !== -1) {
            // grab the previous question to preserve any additional properties it had
            question = questions[prevIndex];
            // remove the old question
            questions.splice(prevIndex, 1);
            if (questions.length === 0) {
                // delete the old case property questions
                delete mappings[prev];
            } else if (questions.length === 1) {
                // this case property is now unique, so we can remove conflict warnings from the remaining mug
                const remainingMug = this.form.getMugByPath(questions[0].question_path);
                remainingMug.dropMessage('caseProperty', CONFLICT_MSG_KEY);
            }

            const mug = this.form.getMugByPath(question.question_path);
            // always drop the conflict message. Moving may create a conflict, but it will be
            // generated again later
            mug.dropMessage('caseProperty', CONFLICT_MSG_KEY);
            mug.dropMessage('caseProperty', CONFLICTING_DELETE_MSG_KEY);
        }

        if (current) {
            mappings[current] = mappings[current] || [];
            if (!question) {
                const originals = this.data.baseline[current];
                question = originals?.find(q => q.question_path === questionPath);
                if (!question) {
                    question = {'question_path': questionPath};
                }
            }
            mappings[current].push(question);

            if (mappings[current].length >= 2) {
                // this new mapping creates a conflict, so add a warning to each assigned question
                // these warnings will cause the save button to mention validation errors,
                // but they do not prevent saving the form
                mappings[current].forEach(question => {
                    const mugWithConflict = this.form.getMugByPath(question.question_path);
                    addConflictMessageToMug(mugWithConflict, current);
                });
            }
        }
    }

    moveMappings (prevPath, newPath) {
        /*
        Move all existing mappings from prevPath to newPath.
        If newPath is falsy, remove all mappings from prevPath.
        */
        if (!this.data.hasOwnProperty('caseMappingsByQuestion')) {
            return;
        }

        // determine what case properties were affected by this question
        const prevMappings = this.data.caseMappingsByQuestion[prevPath] || [];
        if (prevMappings.length === 0) {
            // this question wasn't using case management, so there is nothing to update
            return;
        }

        // move those case properties from prevPath to newPath
        delete this.data.caseMappingsByQuestion[prevPath];
        if (newPath) {
            this.data.caseMappingsByQuestion[newPath] = prevMappings;
        }

        // rebuild mappings by case
        prevMappings.forEach(caseProperty => {
            const questions = this.data.caseMappings[caseProperty];
            const index = questions.findIndex((question) => question.question_path === prevPath);
            if (index !== -1) {
                if (newPath) {
                    questions[index].question_path = newPath;
                } else {
                    // just remove the element
                    questions.splice(index, 1);
                    if (questions.length === 0) {
                        delete this.data.caseMappings[caseProperty];
                    } else if (questions.length === 1) {
                        // multiple questions no longer are assigned to this case property,
                        // so we can remove the conflict message
                        const mugWithConflict = this.form.getMugByPath(questions[0].question_path);
                        if (mugWithConflict) {
                            mugWithConflict.dropMessage('caseProperty', CONFLICT_MSG_KEY);
                        }
                    }
                }
            }
        });
    }

    removeMappings (path) {
        this.moveMappings(path, null);
    }
}

function initAutoAssignName(vellum) {
    const saveButtonUi = vellum.data.core.saveButton.ui;
    saveButtonUi.on('shown.bs.popover', function () {
        const $tip = saveButtonUi.data('bs.popover').$tip;
        $tip.off('click.autoAssignName');
        $tip.on('click.autoAssignName', '.fd-auto-assign-case-name', function () {
            autoAssignName(vellum);
            saveButtonUi.popover('hide');
        });
    });
}

function autoAssignName(vellum) {
    vellum.ensureCurrentMugIsSaved(() => {
        const form = vellum.data.core.form;
        let mug = form.findFirstMatchingChild(null, () => true);
        if (!mug || mug.p.caseProperty || mug.spec.caseProperty?.presence !== 'optional') {
            mug = vellum.addQuestion('DataBindOnly', 'first');
            mug.p.nodeID = form.generate_question_id('case-name');
            mug.p.calculateAttr = 'uuid()';
        }
        mug._caseManagementAutoAssignedName = true;
        mug.p.caseProperty = 'name';
        vellum.data.core.saveButton.fire('change');
        vellum.setCurrentMug(mug);
    });
}

function refreshCurrentMug(vellum) {
    const mugs = vellum.getCurrentlySelectedMug(true);
    if (mugs.length !== 1) { return; }
    const select = $(".fd-content-right").find('fieldset[data-slug="caseManagement"]').find("select");
    if (select.length) {
        const mappings = vellum.data.caseManagement.caseMappingsByQuestion;
        const widget = widgets.util.getWidget(select, vellum);
        widget.setValue(mugs[0].p.caseProperty || "");
        select.trigger("change.select2");
        select.prop('disabled', (mappings[mugs[0].absolutePath]?.length || 0) > 1);
    }
}

$.vellum.plugin('caseManagement', {}, {
    init: function () {
        const data = this.data.caseManagement;
        data.properties = this.opts().caseManagement.properties || [];
        data.baseline = this.opts().caseManagement.mappings || {};
        data.view_form_url = this.opts().caseManagement.view_form_url;
        data.is_registration_form = this.opts().caseManagement.is_registration_form;
        if (data.is_registration_form && !data.properties.includes('name')) {
            data.properties.push('name');
        }
        initAutoAssignName(this);
    },

    postInit: function() {
        this.__callOld();
        const types = this.data.core.mugTypes.normalTypes;
        const exclude = {'Trigger': true, 'SaveToCase': true};
        _(types).each((type, name) => {
            if (Object.hasOwn(exclude, name) ||
                    type.dataType === 'binary' ||  // multimedia: Audio, Image, ...
                    type.tagName === 'group') {
                type.spec.caseProperty = { presence: 'notallowed' };
            }
        });
    },

    loadXML: function () {
        this.__callOld();
        const _this = this;
        const form = this.data.core.form;

        form.on('question-remove', function (e) {
            const maintainer = new CaseMapMaintainer(form, _this.data.caseManagement);
            maintainer.removeMappings(e.absolutePath);
        });
        form.on('question-create', function (e) {
            // this will get called when a deletion is undone.
            // Ensure that we restore the previously deleted mappings, if present
            const maintainer = new CaseMapMaintainer(form, _this.data.caseManagement);
            const mug = e.mug;
            const caseProperty = mug.p.caseProperty;
            if (caseProperty) {
                maintainer.updateFormMappings(mug.absolutePath, null, caseProperty);
            }
        });
    },

    performAdditionalParsing: function (form, xml) {
        this.__callOld();
        const data = this.data.caseManagement;
        if (!data.caseMappings) {
            const mappings = JSON.parse(JSON.stringify(data.baseline));
            addCaseMappingsToPlugin(mappings, data, form);
        } else {
            const builder = new XMLCaseMappingsBuilder();
            const mappings = builder.getMappings(xml);
            if (mappings) {
                addCaseMappingsToPlugin(mappings, data, form);
            }
        }
    },

    contributeToHeadXML: function (xmlWriter, form, options={withCaseMappings: false}) {
        this.__callOld();
        if (options.withCaseMappings) {
            // Case mappings are not normally written in form XML
            // because they are sent to HQ as a "mapping_diff" in
            // augmentSentData. However, they are included in the source
            // XML so they are preserved when copying XML between forms.
            const writer = new XMLCaseMappingWriter(xmlWriter);
            writer.writeCaseMappingsElement(this.data.caseManagement);
        }
    },

    getSections: function (mug) {
        const sections = this.__callOld(mug);
        sections.splice(1, 0, {
            slug: 'caseManagement',
            displayName: gettext('Case Management'),
            properties: ['caseProperty'],
            help: {
                title: gettext('Case Management'),
                text: gettext(
                    'Saving a question as a case property makes it accessible and reusable ' +
                    'across your application. To manage all your case properties from this form, ' +
                    'click on the Manage Case button. '
                ),
                link: 'https://dimagi.atlassian.net/wiki/spaces/commcarepublic' +
                    '/pages/2143955170/Case+Management+Overview',
            }
        });

        return sections;
    },

    getSectionDisplay: function (mug, options) {
        const $sec = this.__callOld();
        if (options.slug !== 'caseManagement') {
            return $sec;
        }
        const data = this.data.caseManagement;
        if (data.is_registration_form && !data.caseMappings?.name?.length) {
            const $nudge = $(nudgeName({format: util.format}));
            $sec.find('.fd-fieldset-content').prepend($nudge);
            mug.on('property-changed', event => {
                if (event.property === 'caseProperty' && event.val === 'name') {
                    $nudge.fadeOut(300, function () { $(this).remove(); });
                }
            }, null, 'teardown-mug-properties');
        } else if (mug._caseManagementAutoAssignedName) {
            delete mug._caseManagementAutoAssignedName;
            const $explainer = $(tplAutoAssignedName());
            $explainer.on('close.bs.alert', () => {
                $explainer.fadeOut(300, function () { $(this).remove(); });
            });
            $sec.find('.fd-fieldset-content').prepend($explainer);
        } else if (mug.p.caseProperty !== 'name') {
            // can be removed when the learning nudge is no longer needed
            const NUDGE_KEY = 'nudge-caseManagement';
            const DISMISS_ON = 3;
            let useCount = parseInt(localStorage.getItem(NUDGE_KEY) || '0');
            if (useCount < DISMISS_ON) {
                const $nudge = $(nudgeLearn());
                $nudge.on('close.bs.alert', () => localStorage.setItem(NUDGE_KEY, String(DISMISS_ON)));
                $sec.find('.fd-fieldset-content').prepend($nudge);
                mug.on('property-changed', event => {
                    if (event.property === 'caseProperty' && event.val) {
                        localStorage.setItem(NUDGE_KEY, String(++useCount));
                        if (useCount >= DISMISS_ON) {
                            $nudge.fadeOut(300, function () { $(this).remove(); });
                        }
                    }
                }, null, 'teardown-mug-properties');
            }
        }
        return $sec;
    },

    preSaveValidation: function () {
        const alerts = this.__callOld();
        const data = this.data.caseManagement;
        if (!data.caseMappings?.name?.length && data.is_registration_form &&
                this.data.core.form.tree.getRootChildren().length) {
            alerts.push(util.format(gettext(
                'This registration form is missing a case name. ' +
                'Assign the {name} property to a question.'
            ), {name: '<code>name</code>'}) + tmpAutoAssign());
        }
        return alerts;
    },

    getMugSpec: function () {
        const specs = this.__callOld();
        const that = this;
        const databindSpecs = Object.assign(specs.databind, {
            'caseProperty': {
                visibility: 'visible',
                widget: casePropertyDropdownWidget,
                presence: 'optional',
                enabled: function (mug) {
                    const data = that.data.caseManagement;
                    if (!mug.absolutePath || !data.caseMappingsByQuestion) {
                        return true;
                    }
                    const questionMappings = data.caseMappingsByQuestion[mug.absolutePath];
                    if (!questionMappings) {
                        return true;
                    }
                    return questionMappings.length <= 1;
                },
                lstring: gettext('Case Property'),
                serialize: mugs.serializeXPath,
                deserialize: mugs.deserializeXPath,
                setter: function (mug, attr, value) {
                    const maintainer = new CaseMapMaintainer(mug.form, that.data.caseManagement);
                    maintainer.updateFormMappings(mug.absolutePath, mug.p[attr], value);
                    mug.p.set(attr, value);
                },
                validationFunc: function (mug) {
                    const currentValue = mug.p.caseProperty;
                    const reservedWords = that.opts().caseManagement.reserved_words;
                    if (currentValue && reservedWords.indexOf(currentValue) !== -1) {
                        return {markdown: util.format(
                            gettext("**{word}** is a reserved word"),
                            {word: currentValue}
                        )};
                    }
                    return 'pass';
                },
            },
        });

        const oldNodeIDSetter = databindSpecs.nodeID.setter;
        databindSpecs.nodeID.setter = function (mug, attr, value) {
            const prevPath = mug.absolutePath;
            oldNodeIDSetter(mug, attr, value);
            const currentPath = mug.absolutePath;
            const maintainer = new CaseMapMaintainer(mug.form, that.data.caseManagement);
            maintainer.moveMappings(prevPath, currentPath);
        };

        return specs;
    },

    handleMugParseFinish: function (mug) {
        this.__callOld();
        const data = this.data.caseManagement;
        addCaseMappings(mug, data, this.data.core.saveButton);
    },

    handleMugRename: function (form, mug, newID, oldID, newPath, oldPath) {
        const updates = this.__callOld();
        const basePath = form.getBasePath();
        function restoreAbsolutePath(hashtagPath) {
            return hashtagPath.replace(/^#form\//, basePath);
        }

        const maintainer = new CaseMapMaintainer(form, this.data.caseManagement);
        Object.values(updates).forEach(([oldHashtagPath, newHashtagPath]) => {
            const oldPath = restoreAbsolutePath(oldHashtagPath);
            const newPath = restoreAbsolutePath(newHashtagPath);

            maintainer.moveMappings(oldPath, newPath);
        });

        return updates;
    },

    onFormSave: function (formData) {
        this.__callOld();
        const data = this.data.caseManagement;
        if (formData.caseManagement?.mappings) {
            const form = this.data.core.form;
            const saveButton = this.data.core.saveButton;
            addCaseMappingsToPlugin(formData.caseManagement.mappings, data, form);
            this.data.core.form.walkMugs(mug => addCaseMappings(mug, data, saveButton));
            refreshCurrentMug(this);
        }
        // clone the existing mappings and overwrite the baseline
        data.baseline = JSON.parse(JSON.stringify(data.caseMappings));
    },

    augmentSentData: function (sentData, saveType) {
        const result = this.__callOld();
        const data = this.data.caseManagement;
        const is_reg = this.data.caseManagement.is_registration_form;
        const diff = compareCaseMappings(data.baseline, data.caseMappings);
        result.case_mapping_diff = JSON.stringify(formatCaseMappingDiff(diff, is_reg));
        return result;
    }

});
