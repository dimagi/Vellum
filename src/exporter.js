define([
    'vellum/tsv',
    'vellum/richText',
], function (
    tsv,
    richText,
) {
    // todo: abstract out IText stuff into part of the plugin interface
    var generateExportTSV = function (form) {
        var languages = form.vellum.data.javaRosa.Itext.getLanguages();

        var itextColumns = {
            "default": "Text",
            "audio": "Audio",
            "image": "Image",
            "video": "Video",
            "video-inline": "Video Inline",
        };

        var columnOrder = [
            "Question",
            "Type",
        ];

        for (var type in itextColumns) {
            var colName = itextColumns[type];

            for (var i = 0; i < languages.length; i++) {
                columnOrder.push(colName + " (" + languages[i] + ")");
            }
        }

        columnOrder = columnOrder.concat([
            "Display Condition",
            "Validation Condition",
            "Validation Message",
            "Calculate Condition",
            "Required",
            "Hint Text",
            "Help Text",
            "Comment",
        ]);
        const formContainsRepeatGroup = Boolean(form.getMugList().find(mug => mug.options.isRepeat));
        if (formContainsRepeatGroup && form.vellum.opts().features.use_custom_repeat_button_text) {
            columnOrder = columnOrder.concat(["'Add New' Button Text", "'Add Another' Button Text"]);
        }

        var mugToExportRow = function (mug) {
            var row = {},
                itext = mug.p.labelItext,
                defaultLanguage = form.vellum.data.javaRosa.Itext.getDefaultLanguage(),
                i;

            var defaultOrNothing = function (item, language, form) {
                return (item && item.hasForm(form)) ?
                    item.getForm(form).getValueOrDefault(language) : "";
                // TODO see newline treatment in javaRosa.js TSV logic
                //return value.replace(/\r?\n/g, "&#10;");
            };

            // initialize all columns to empty string
            for (i = 0; i < columnOrder.length; i++) {
                row[columnOrder[i]] = "";
            }

            if (mug.options.tagName !== "item") {
                row.Question = mug.absolutePathNoRoot;
            } else {
                row.Question = mug.parentMug.absolutePathNoRoot +
                                "-" + mug.p.nodeID;
            }
            row.Type = mug.options.typeName;

            if (!mug.options.isDataOnly) {
                for (var type in itextColumns) {
                    var colName = itextColumns[type];

                    for (i = 0; i < languages.length; i++) {
                        var key = colName + " (" + languages[i] + ")";
                        row[key] = defaultOrNothing(itext, languages[i], type);
                    }
                }
            }

            if (mug.p.getDefinition('relevantAttr')) {
                row["Display Condition"] = mug.p.relevantAttr;
                row["Calculate Condition"] = mug.p.calculateAttr;
                row.Required = mug.p.requiredAttr ? 'yes' : 'no';
                row["Required Condition"] = mug.p.requiredCondition;

                row["Validation Condition"] = mug.p.constraintAttr;
                row["Validation Message"] = defaultOrNothing(
                    mug.p.constraintMsgItext,
                    defaultLanguage, 'default');
            }

            row["Hint Text"] = defaultOrNothing(mug.p.hintItext, defaultLanguage, 'default');
            row["Help Text"] = defaultOrNothing(mug.p.helpItext, defaultLanguage, 'default');
            if (formContainsRepeatGroup && mug.options.customRepeatButtonText) {
                row["'Add New' Button Text"] = defaultOrNothing(mug.p.addEmptyCaptionItext, defaultLanguage, 'default');
                row["'Add Another' Button Text"] = defaultOrNothing(mug.p.addCaptionItext, defaultLanguage, 'default');
            }
            row.Comment = richText.sanitizeInput(mug.p.comment);

            // make sure there aren't any null values
            for (var prop in row) {
                if (Object.prototype.hasOwnProperty.call(row, prop)) {
                    row[prop] = row[prop] || "";
                }
            }

            return columnOrder.map(function (column) { return row[column]; });
        };

        var rows = [columnOrder].concat(form.getMugList().map(mugToExportRow));
        return tsv.tabDelimit(rows);
    };

    return {
        generateExportTSV: generateExportTSV,
    };
});
