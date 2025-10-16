define([
    'jquery',
    'vellum/mugs',
    'vellum/util',
    'vellum/widgets',
], function (
    $,
    mugs,
    util,
    widgets
) {
    'use strict';

    function casePropertyDropdownWidget (mug, opts) {
        const rawOptions = opts.vellum.caseManager.getProperties();
        const defaultOptions = rawOptions.map(prop => ({ text: prop, value: prop }));
        opts.defaultOptions = defaultOptions;
        opts.useValueAsCustomName = true;
        var widget = widgets.dropdown(mug, opts);
        widget.postRender = function () {
            widget.input.select2({
                tags: true,
                allowClear: true,
                placeholder: '',
            });
            widget.input.on('remove', function () {
                if ($(this).data('select2')) {
                    $(this).select2('destroy');
                }
            });
        };

        return widget;
    }

    const CONFLICT_MSG_KEY = 'mug-caseProperty-conflict';
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
        mug.addMessage('case_property', message);
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
        mug.addMessage('case_property', message);
    }

    class CaseMappingsBuilder {
        addMappingsToForm (form, xml) {
            let mappingElements = [];
            // XML should always be present in real environments,
            // but can be empty when developing vellum
            if (xml) {
                const caseMappingSection = xml.find(':root > case_mappings');
                mappingElements = caseMappingSection.children().toArray();
            }

            form.mappings = this.buildMappingsFromXMLElements(mappingElements);
            form.mappingsByQuestion = this.buildQuestionMappingsFromCaseMappings(form.mappings);
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

        writeCaseMappingsElement (form) {
            if (!form.hasOwnProperty('mappings')) {
                return;
            }

            this.writer.writeStartElement('case_mappings');
            Object.entries(form.mappings).forEach(([property, questions]) => {
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
        constructor (form) {
            this.form = form;
        }

        updateFormMappings (questionPath, prev, current) {
            this.replaceFormQuestionMappings(questionPath, prev, current);
            this.replaceFormPropertyMappings(questionPath, prev, current);
        }

        replaceFormQuestionMappings (questionPath, prev, current) {
            this.form.mappingsByQuestion[questionPath] = this.form.mappingsByQuestion[questionPath] || [];
            const mappings = this.form.mappingsByQuestion[questionPath];
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
                    delete this.form.mappingsByQuestion[questionPath];
                }
            }
        }

        replaceFormPropertyMappings (questionPath, prev, current) {
            let questions = prev ? this.form.mappings[prev] : [];
            let question = null;

            let prevIndex = questions.findIndex((question) => question.question_path === questionPath);
            if (prevIndex !== -1) {
                // grab the previous question to preserve any additional properties it had
                question = questions[prevIndex];
                // remove the old question
                questions.splice(prevIndex, 1);
                if (questions.length === 0) {
                    // delete the old case property questions
                    delete this.form.mappings[prev];
                } else if (questions.length === 1) {
                    // this case property is now unique, so we can remove conflict warnings from the remaining mug
                    const remainingMug = this.form.getMugByPath(questions[0].question_path);
                    remainingMug.dropMessage('case_property', CONFLICT_MSG_KEY);
                }

                const mug = this.form.getMugByPath(question.question_path);
                // always drop the conflict message. Moving may create a conflict, but it will be
                // generated again later
                mug.dropMessage('case_property', CONFLICT_MSG_KEY);
            }

            if (current) {
                this.form.mappings[current] = this.form.mappings[current] || [];
                if (!question) {
                    question = {'question_path': questionPath};
                }
                this.form.mappings[current].push(question);

                if (this.form.mappings[current].length >= 2) {
                    // this new mapping creates a conflict, so add a warning to each assigned question
                    // these warnings will cause the save button to mention validation errors,
                    // but they do not prevent saving the form
                    this.form.mappings[current].forEach(question => {
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
            if (!this.form.hasOwnProperty('mappingsByQuestion')) {
                return;
            }

            // determine what case properties were affected by this question
            const prevMappings = this.form.mappingsByQuestion[prevPath] || [];
            if (prevMappings.length === 0) {
                // this question wasn't using case management, so there is nothing to update
                return;
            }

            // otherwise, record the affected case properties
            const case_properties = prevMappings.slice();
            // move those case properties from prevPath to newPath
            delete this.form.mappingsByQuestion[prevPath];
            
            if (newPath) {
                this.form.mappingsByQuestion[newPath] = case_properties;
            }

            // rebuild mappings by case
            case_properties.forEach(case_property => {
                const questions = this.form.mappings[case_property];
                const index = questions.findIndex((question) => question.question_path === prevPath);
                if (index !== -1) {
                    if (newPath) {
                        questions[index].question_path = newPath;
                    } else {
                        // just remove the element
                        questions.splice(index, 1);
                        if (questions.length === 0) {
                            delete this.form.mappings[case_property];
                        }
                    }
                }
            });
        }

        removeMappings (path) {
            this.moveMappings(path, null);
        }
    }

    class CaseManager {
        constructor (baseProperties, viewFormUrl) {
            this.baseProperties = new Set(baseProperties);
            this.customProperties = {};
            this.viewFormUrl = viewFormUrl;
        }

        addProperty (property) {
            if (this.baseProperties.has(property)) {
                // no need to modify the base properties
                return;
            }

            this.customProperties[property] = this.customProperties[property] || 0;
            this.customProperties[property]++;
        }

        removeProperty (property) {
            if (!this.customProperties.hasOwnProperty(property)) {
                return;
            }

            this.customProperties[property]--;
            if (this.customProperties[property] <= 0){
                delete this.customProperties[property];
            }
        }

        getProperties () {
            return Array.from(this.baseProperties.values()).concat(
                Object.keys(this.customProperties)
            );
        }
    }

    $.vellum.plugin('caseManagement', {}, {
        init: function () {
            const data = this.data.caseManagement;

            data.properties = this.opts().caseManagement.properties;
            data.isActive = !!data.properties;
            data.view_form_url = this.opts().caseManagement.view_form_url;

            this.caseManager = new CaseManager(
                this.opts().caseManagement.properties,
                this.opts().caseManagement.view_form_url
            );
        },

        loadXML: function () {
            this.__callOld();
            const form = this.data.core.form;

            form.on('question-remove', function (e) {
                const maintainer = new CaseMapMaintainer(form);
                maintainer.removeMappings(e.absolutePath);
            });
            form.on('question-create', function (e) {
                // this will get called when a deletion is undone.
                // Ensure that we restore the previously deleted mappings, if present
                const maintainer = new CaseMapMaintainer(form);
                const mug = e.mug;
                const case_property = mug.p.case_property;
                if (case_property) {
                    maintainer.updateFormMappings(mug.absolutePath, null, case_property);
                }
            });
        },

        performAdditionalParsing: function (form, xml) {
            this.__callOld();

            if (!this.data.caseManagement.isActive) {
                return;
            }

            const builder = new CaseMappingsBuilder();
            builder.addMappingsToForm(form, xml);
        },

        contributeToAdditionalXML: function (xmlWriter, form) {
            this.__callOld();

            if (!this.data.caseManagement.isActive) {
                return;
            }

            const writer = new XMLCaseMappingWriter(xmlWriter);
            writer.writeCaseMappingsElement(form);
        },

        getMugTypes: function () {
            const types = this.__callOld();
            // never show the case management property for labels
            types.normal.Trigger.spec.case_property = { presence: 'notallowed' };

            const groupTypes = [
                types.normal.Group,
                types.normal.Repeat,
                types.normal.FieldList
            ];
            groupTypes.forEach(groupType => groupType.spec.case_property = { presence: 'notallowed' });

            return types;
        },

        getSections: function (mug) {
            const sections = this.__callOld(mug);

            if (!this.data.caseManagement.isActive) {
                return sections;
            }

            sections.splice(1, 0, {
                slug: 'caseManagement',
                displayName: gettext('Case Management'),
                properties: ['case_property'],
                help: {
                    title: gettext('Case Management'),
                    text: gettext(
                        'Saving a question as a case property makes it accessible and reuseable ' +
                        'across your application. Case properties can be tracked and updated ' +
                        'over time.'
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
                'case_property': {
                    visibility: 'visible',
                    widget: casePropertyDropdownWidget,
                    presence: 'optional',
                    enabled: function (mug) {
                        if (!mug.absolutePath || !mug.form.mappingsByQuestion) {
                            return true;
                        }
                        const questionMappings = mug.form.mappingsByQuestion[mug.absolutePath];
                        if (!questionMappings) {
                            return true;
                        }
                        return questionMappings.length <= 1;
                    },
                    lstring: gettext('Case Property'),
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    setter: function (mug, attr, value) {
                        const maintainer = new CaseMapMaintainer(mug.form);
                        maintainer.updateFormMappings(mug.absolutePath, mug.p[attr], value);
                        const prevValue = mug.p[attr];
                        if (prevValue) {
                            that.caseManager.removeProperty(prevValue);
                        }
                        if (value) {
                            that.caseManager.addProperty(value);
                        }
                        mug.p.set(attr, value);
                    },
                },
            });

            const oldNodeIDSetter = databindSpecs.nodeID.setter;
            databindSpecs.nodeID.setter = function (mug, attr, value) {
                const prevPath = mug.absolutePath;
                oldNodeIDSetter(mug, attr, value);
                const currentPath = mug.absolutePath;
                const maintainer = new CaseMapMaintainer(mug.form);
                maintainer.moveMappings(prevPath, currentPath);
            };

            specs.databind = databindSpecs;

            return specs;
        },

        handleMugParseFinish: function (mug) {
            this.__callOld();

            if (!this.data.caseManagement.isActive) {
                return;
            }

            if (!mug.absolutePath) {
                // no use trying to find a mapping for a question that doesn't have a path
                return;
            }

            const questionMappings = mug.form.mappingsByQuestion[mug.absolutePath];

            if (questionMappings && questionMappings.length > 0) {
                mug.p.set('case_property', questionMappings[0]);

                if (questionMappings.length > 1) {
                    // if a question is attempting to update multiple cases,
                    // it will be disabled. Leave an informational message
                    // to explain that this needs to be edited with the case management page
                    addMultipleAssignmentsMessageToMug(mug, this.data.caseManagement.view_form_url);
                }

                questionMappings.forEach(caseProperty => {
                    if (mug.form.mappings[caseProperty].length >= 2) {
                        addConflictMessageToMug(mug, caseProperty);
                    }
                });
            }
        },

        handleMugRename: function (form, mug, newID, oldID, newPath, oldPath) {
            const updates = this.__callOld();

            const basePath = form.getBasePath();
            function restoreAbsolutePath(hashtagPath) {
                return hashtagPath.replace(/^#form\//, basePath);
            }

            const maintainer = new CaseMapMaintainer(form);
            Object.values(updates).forEach(([oldHashtagPath, newHashtagPath]) => {
                const oldPath = restoreAbsolutePath(oldHashtagPath);
                const newPath = restoreAbsolutePath(newHashtagPath);

                maintainer.moveMappings(oldPath, newPath);
            });

            return updates;
        }

    });
});
