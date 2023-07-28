# Vellum Plugin Development

Each plugin should live in its own file under `src` and should be named "<plugin_name>.js".
The plugin should be a RequireJS module with at least the following dependencies: `jquery`, `vellum/core`.
The plugin must be added to the list of RequireJS dependencies in `src/main.js`.


The main entry point for plugins is the `$.vellum.plugin` function.  It takes three arguments:
- pluginName: The name of the plugin. This can be used to reference the plugin in the future.
- defaults:  An object containing any default values for the plugin.
- functions: An object containing hook functions for the plugin.

A minimal plugin looks like this:

```javascript
define([
    'jquery',
    'vellum/core'
], function (
    $
) {
    $.vellum.plugin("<plugin name>", {}, {
        ...
    });
});
```

## Common dependencies

The following is a list of common dependencies:

- `underscore` - Underscore.js
- `vellum/mugs` - The Mugs module. Used when creating new mugs.
- `vellum/tree` - The Tree module. Used when dealing with XML e.g. serializing mug data.
- `vellum/util` - Utility functions e.g. `extend`
- `vellum/widgets` - Vellum widgets

## Hook Functions

Adding functionality to Vellum requires implementing hook functions in the `functions` object
passed to `$.vellum.plugin`. These functions can extend or override existing functionality.

Each function is bound to the main Vellum instance i.e. Accessing `this`, will give you access
to the main Vellum instance. Within in context of the hook function, the Vellum instance defines
a `__callOld` function which can be used to call the original function:

```javascript
$.vellum.plugin("examplePlugin", {}, {
    exampleHookFunction: function () {
        // this is a noop since it just returns the value from the original function
        return this.__callOld();
    }
});
```

The following list of functions are some of the more commonly used ones. The full list of functions
as well as additional documentation for each function can be found in [src/core.js](src/core.js).

Looking at existing plugin implementations is also helpful to see how to use the hook functions.

### - getMugTypes

Get all mug types definitions.

### - getQuestionGroups

Get the list of question groups to display in the sidebar.

### - getAdvancedQuestions

Get the list of mug types to display in the advanced questions section of the sidebar.

### - getSections

Get the list of sections to display in the editor window for the given mug.

### - parseBindElement

This is called when loading a form and is used to extract data from the bind elements in a form.
If the bind element was created by a plugin, the plugin should return use this hook
to read the data from the bind element.

If the bind element does not belong to the plugin, the `__callOld` function should be called to
pass parsing on to the next plugin.

### - parseSetValue

Similar to `parseBindElement` but for `setvalue` elements.


## Mug Configuration

The `getMugTypes` hook function is used to define new mug types. The common practice when defining new mugs
is to extend the default mug options found in `mug.defaultOptions`:

```javascript
let newMug = utils.extend(mug.defaultOptions, {
    // new mug options
});
```

See `mug.defaultOptions` for a list of mug options.
