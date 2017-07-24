#! /usr/bin/env python
"""Build main.js from build.js and src/main.js

- Compile RequireJS bundles from modles in build.js
- Load main components from src/main.js

This script prints its output to stdout.
"""
import json
import re

def main():
    modules_js = "[%s]" % get_delimited_range("build.js").rstrip(",")
    modules = json.loads(clean_json(modules_js))
    bundles = dict((module["name"], module["include"])
                   for module in modules
                   if module["name"] != "exclude")
    main_components_js = get_delimited_range("src/main.js").rstrip(",")
    main_components = json.loads(clean_json("[%s]" % main_components_js))
    bundles["main-components"] = main_components
    print(MAIN_JS_TEMPLATE % {
        "bundles": json.dumps(bundles, indent=4, sort_keys=True)
                       .replace("\n", "\n    "),
        "main_components": main_components_js
    })

def get_delimited_range(filename, name="buildmain.py delimiter"):
    regex = re.compile(
        r"// begin " + re.escape(name) +
        r"([\w\W]*?)"
        r"// end " + re.escape(name))
    with open(filename) as fh:
        data = fh.read()
    return regex.search(data).group(1).strip()

def drop_comments(js):
    for line in js.split("\n"):
        if not line.lstrip().startswith("//"):
            if "//" in line:
                yield line[:line.find("//")]
            else:
                yield line

def clean_json(js):
    lines = []
    keyfixer = re.compile(r"(\s)([\w]+)(:\s)")
    for line in drop_comments(js):
        if '"' not in line:
            line = line.replace("'", '"')
        lines.append(keyfixer.sub(r'\1"\2"\3', line))
    return "\n".join(lines)

MAIN_JS_TEMPLATE = """
requirejs.config({
    paths: {
        vellum: "."
    },
    bundles: %(bundles)s
});

// stubs (stubModules build option puts them in exclude.js, which is removed)
define('css/css', {});
define('less/less', {});

if (!window.gettext) {
    window.gettext = function (arg) { return arg; };
    window.ngettext = function (singular, plural, count) {
        return count === 1 ? singular : plural;
    };
}

define([
    'jquery',
    %(main_components)s
], function () {});
"""

if __name__ == "__main__":
    main()
