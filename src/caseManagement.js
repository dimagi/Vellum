define([
    'jquery',
], function (
    $
) {
    'use strict';

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

    $.vellum.plugin('caseManagement', {}, {
        init: function () {
            const data = this.data.caseManagement;

            data.properties = this.opts().caseManagement.properties;
            data.isActive = !!data.properties;
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

    });
});
