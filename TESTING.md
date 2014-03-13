Vellum test plan
================

## All changes

On a newly created form (use two languages) and an existing form:

1. Click add to add a Text Question. The Save button should change from gray to green.

2. Click Edit Source XML. It should work.

3. Click Save.  It should work and the button should change to gray.

On the newly created form:

## Optional depending on change

4. Click Copy to copy the question you created. A copy should be created in the tree with the same name and a different ID.  Verify in Edit Source XML that the correct data, bind, itext, and control structure exists.

5. Click Delete to delete both questions.  Verify that the XML structure is empty.

6. Create the following structure using the question dropdown and add button:

- Group
  - Multiple Choice
    - Choice
    - Choice
- Data Node

7. Change the Multi-Select question type to Single Select.  This should change the tag in the control XML from select to select1.

8. On the select question, add a constraint message and image block.

9. On data node, edit the calculate condition and drag a reference to the select question.

10. Drag the select question above the group.  Verify in the first data node that the referenced path in the calculate condition changed.

11. Verify that the tree is collapsible where it should be.

Verify that the XML reflects the changes made above.

## All changes

12. Click Edit Bulk Translations, change a question label, click Update Translations, and verify that this worked using Edit Source XML.

13. Click Export Form Contents. It should work.

14. Switch the Display Language. Verify that the question names in the question tree changed.
