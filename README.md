Vellum
======

Vellum is an [XForm](http://en.wikipedia.org/wiki/XForms) designer built by
[Dimagi][0] for [CommCare HQ][1].

 [0]: http://www.dimagi.com
 [1]: http://www.commcarehq.org

Setup
-----

Vellum expects jQuery and Underscore.js to be present.   It also expects
`SaveButton` from CommCare HQ
([link](https://github.com/dimagi/commcare-hq/blob/master/corehq/apps/hqwebapp/static/hqwebapp/js/main.js))
to be present, or you can use the version included in `js/`, which may be out of
date.

All other dependencies are bundled in `dist/vellum.min.js` and
`dist/vellum.css`.

You'll need to change line 39 in `css/jquery.fancybox-1.3.4.css` to the URL that
points to fancybox.png, and re-run the grunt tasks.

Usage
-----

    formdesigner.launch({
        rootElement: "#formdesigner",
        staticPrefix: "",
        langs: ""
    });

formdesigner.launch causes the formdesigner to initialize itself fully in the
element specified by rootElement.

Form Options:
* rootElement: "jQuery selector to FD Container",
* staticPrefix : "url prefix for static resources like css and pngs",
* saveUrl : "URL that the FD should post saved forms to",
* [form] : "string of the xml form that you wish to load"
* [formName] : "Default Form Name"

Testing
-------

Install PhantomJS from NPM:

```
$ npm install -g phantomjs
```

Then:

```
$ cd js
$ npm install -d
$ npm test
```

Currently, the tests don't behave correctly under PhantomJS (or in Firefox).
You can open `js/tests/runner.html` to manually run the tests.


Contributing
------------

To install grunt plugins and setup git hooks to run `grunt dist`:

```
$ npm install grunt grunt-contrib-uglify grunt-contrib-cssmin grunt-contrib-concat grunt-githooks
$ grunt githooks
```

Note: git pre-commit hook integration doesn't seem to work at the moment, so you
will have to manually run the following before every commit:

```
$ grunt dist
$ git add dist
```

To modify Vellum's CSS, you need to have [LESS](http://lesscss.org) installed.
You each file in `style` is compiled individually and share a common library `style/lib/main.less`
with useful mixins and variables borrowed from [Twitter Bootstrap](http://getbootstrap.com).

Event Tracking
--------------

If you have Google Analytics installed, Vellum will track events.
