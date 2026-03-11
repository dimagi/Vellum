import $ from "jquery";
import _ from "underscore";
import mugs from "vellum/mugs";
import util from "vellum/util";
import widgets from "vellum/widgets";
import { compareCaseMappings } from "vellum/caseDiff";


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

class CaseMappingsBuilder {
    updateMappingsFromXML (form, data, xml) {
        if (!xml) {
            return;
        }

        const head = xml.find(':root > h\\:head, :root > head');
        const caseMappingSection = head.find('> vellum\\:case_mappings');
        if (caseMappingSection.length > 0) {
            const mappingElements = caseMappingSection.children().toArray();
            data.caseMappings = this.buildMappingsFromXMLElements(mappingElements);
            data.caseMappingsByQuestion = this.buildQuestionMappingsFromCaseMappings(data.caseMappings);
        }

        const maintainer = new CaseMapMaintainer(form, data);
        maintainer.pruneInvalidMappings();
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

    buildQuestionMappingsFromCaseMappings(caseMappings) {
        const mappingsByQuestion = {};
        Object.entries(caseMappings).forEach(([caseProperty, questions]) => {
            questions.forEach(question => {
                const path = question.question_path;
                mappingsByQuestion[path] = mappingsByQuestion[path] || [];
                mappingsByQuestion[path].push(caseProperty);
            });
        });

        return mappingsByQuestion;
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
        let questions = prev ? this.data.caseMappings[prev] || [] : [];
        let question = null;

        let prevIndex = questions.findIndex((question) => question.question_path === questionPath);
        if (prevIndex !== -1) {
            // grab the previous question to preserve any additional properties it had
            question = questions[prevIndex];
            // remove the old question
            questions.splice(prevIndex, 1);
            if (questions.length === 0) {
                // delete the old case property questions
                delete this.data.caseMappings[prev];
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
            this.data.caseMappings[current] = this.data.caseMappings[current] || [];
            if (!question) {
                question = {'question_path': questionPath};
            }
            this.data.caseMappings[current].push(question);

            if (this.data.caseMappings[current].length >= 2) {
                // this new mapping creates a conflict, so add a warning to each assigned question
                // these warnings will cause the save button to mention validation errors,
                // but they do not prevent saving the form
                this.data.caseMappings[current].forEach(question => {
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
                        mugWithConflict.dropMessage('caseProperty', CONFLICT_MSG_KEY);
                    }
                }
            }
        });
    }

    removeMappings (path) {
        this.moveMappings(path, null);
    }

    pruneInvalidMappings () {
        Object.keys(this.data.caseMappingsByQuestion).forEach(questionPath => {
            const mug = this.form.getMugByPath(questionPath);
            if (!mug) {
                this.removeMappings(questionPath);
            }
        });
    }
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
        const builder = new CaseMappingsBuilder();
        if (!data.caseMappings) {
            data.caseMappings = JSON.parse(JSON.stringify(data.baseline));
            data.caseMappingsByQuestion = builder.buildQuestionMappingsFromCaseMappings(data.caseMappings);
        } else {
            builder.updateMappingsFromXML(form, data, xml);
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

    getMugTypes: function () {
        const types = this.__callOld();
        const excludedTypes = [
            types.normal.Trigger,
            types.normal.Group,
            types.normal.Repeat,
            types.normal.FieldList
        ];
        excludedTypes.forEach(excludedType => excludedType.spec.caseProperty = { presence: 'notallowed' });

        return types;
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
            const saveButton = this.data.core.saveButton;
            const builder = new CaseMappingsBuilder();
            data.caseMappings = formData.caseManagement.mappings;
            data.caseMappingsByQuestion = builder.buildQuestionMappingsFromCaseMappings(data.caseMappings);
            this.data.core.form.walkMugs(mug => addCaseMappings(mug, data, saveButton));
            refreshCurrentMug(this);
        }
        // clone the existing mappings and overwrite the baseline
        data.baseline = JSON.parse(JSON.stringify(data.caseMappings));
    },

    augmentSentData: function (sentData, saveType) {
        const result = this.__callOld();
        const data = this.data.caseManagement;
        const diff = compareCaseMappings(data.baseline, data.caseMappings);
        result.mapping_diff = JSON.stringify(diff);
        return result;
    }

});
