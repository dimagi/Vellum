define([
    'markdown-it',
    'underscore',
], function (
    markdownIt,
    _,
) {
    var md = markdownIt('zero')
            .enable(['link', 'emphasis', 'strikethrough', 'heading', 'list', 'table']),
        defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

    // https://github.com/markdown-it/markdown-it/blob/6db517357af5bb42398b474efd3755ad33245877/docs/architecture.md#renderer
    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
        // If you are sure other plugins can't add `target` - drop check below
        var aIndex = tokens[idx].attrIndex('target');

        if (aIndex < 0) {
            tokens[idx].attrPush(['target', '_blank']); // add new attribute
        } else {
            tokens[idx].attrs[aIndex][1] = '_blank';    // replace value of existing attr
        }

        // pass token to default renderer.
        return defaultRender(tokens, idx, options, env, self);
    };

    function markdown(text) {
        if (_.isString(text)) {
            text = text.replace(/\\\\n/g, '\n');
            return md.render(text);
        }
        return "";
    }

    return markdown;
});
