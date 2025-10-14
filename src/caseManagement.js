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
        const defaultOptions = 
            opts.vellum.data.caseManagement.properties.map(prop => ({ text: prop, value: prop }));
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
                }
            }

            if (current) {
                this.form.mappings[current] = this.form.mappings[current] || [];
                if (!question) {
                    question = {'question_path': questionPath};
                }
                this.form.mappings[current].push(question);
            }
        }
    }

    $.vellum.plugin('caseManagement', {}, {
        init: function () {
            const data = this.data.caseManagement;

            data.properties = this.opts().caseManagement.properties;
            data.isActive = !!data.properties;
            data.view_form_url = this.opts().caseManagement.view_form_url;
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
                        mug.p.set(attr, value);
                    },
                },
            });

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
                    const message = {
                        key: 'mug-caseProperty-multipleAssignments',
                        message: {
                            markdown: util.format(
                                gettext(
                                    'This question is used to update multiple case properties. ' +
                                    'If you wish to update these case properties, ' +
                                    'please visit the [Manage Case Page]({url})'
                                ),
                                {url: this.data.caseManagement.view_form_url}
                            )
                        },
                        level: mug.INFO,
                    };
                    mug.addMessage('case_property', message);
                }
            }
        }

    });
});
