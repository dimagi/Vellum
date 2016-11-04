define([], function () {
    function _workflow(message) {
        if (window.analytics) {
            window.analytics.workflow(message);
        }
    }

    function _usage(label, group, message) {
        if (window.analytics) {
            window.analytics.usage(label, group, message);
        }
    }

    function _fbUsage(group, message) {
        _usage("Form Builder", group, message);
    }

    function clickedSave() {
        _workflow("Clicked Save in the form builder");
    }

    function clickedGoToQuestion() {
        _fbUsage("Form Builder", "Clicked link to show in tree");
        _workflow("Clicked on easy reference popover's link to show in tree");
    }

    function clickedToolsMenu(itemName) {
        _fbUsage("Tools", itemName);
    }

    function clickedCopyPaste() {
        _usage("Copy Paste", "Copy Button");
        _workflow("Clicked Copy Button in form builder");
    }

    function fullScreenMode(formid) {
        _fbUsage("Full Screen Mode", formid);
    }

    function dragAndDropRef(category, targetType) {
        _usage(category, "Drag and Drop", targetType);
    }

    function addQuestion() {
        _workflow("Added question in form builder");
    }

    function autocompleteReference(category, targetType) {
        _usage(category, "Autocomplete", targetType);
    }

    function editXPath(propertyString) {
        _fbUsage('Logic', propertyString);
    }

    function cut(numMugs) {
        _usage("Copy Paste", "Cut", numMugs);
        _workflow("Cut questions in form builder");
    }

    function copy(numMugs) {
        _usage("Copy Paste", "Copy", numMugs);
        _workflow("Copy questions in form builder");
    }

    function beforePaste() {
        _workflow("Paste questions in form builder");
    }

    function afterPaste(numMugs) {
        _usage("Copy Paste", "Paste", numMugs);
    }

    function advancedXPath() {
        _fbUsage('Edit Expression', 'Show Advanced Mode');
    }

    function easyReferenceHover(type) {
        _fbUsage("Hovered over easy " + type + " reference");
        _workflow("Hovered over easy reference");
    }

    return {
        clickedSave: clickedSave,
        clickedGoToQuestion: clickedGoToQuestion,
        clickedToolsMenu: clickedToolsMenu,
        clickedCopyPaste: clickedCopyPaste,
        fullScreenMode: fullScreenMode,
        dragAndDropRef: dragAndDropRef,
        addQuestion: addQuestion,
        autocompleteReference: autocompleteReference,
        editXPath: editXPath,
        cut: cut,
        copy: copy,
        beforePaste: beforePaste,
        afterPaste: afterPaste,
        advancedXPath: advancedXPath,
        easyReferenceHover: easyReferenceHover,
    };
});
