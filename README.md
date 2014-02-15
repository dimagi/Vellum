Vellum
======

Vellum is a JavaRosa [XForm](http://en.wikipedia.org/wiki/XForms) designer built by
[Dimagi][0] for [CommCare HQ][1].

 [0]: http://www.dimagi.com
 [1]: http://www.commcarehq.org

Usage
-----

Vellum depends on jQuery, Underscore.js, and Bootstrap.  Other dependencies are
bundled and included in `dist/vellum.js` and `dist/vellum.css`, but some
additional dependencies that are part of [CommCare
HQ](http://github.com/dimagi/commcare-hq) aren't well-defined yet.

You also need to change line 39 in `css/jquery.fancybox-1.3.4.css` to the URL that
points to `fancybox.png`.

For an example of a minimal setup and usage of Vellum, including all known
dependencies, see `tests/runner.html`.

For some additional configuration options, see
[`form_designer.html`](https://github.com/dimagi/commcare-hq/blob/master/corehq/apps/app_manager/templates/app_manager/form_designer.html)
in CommCare HQ.


Contributing
------------

Install dependencies:
```
$ npm install napa
$ npm install
```

Create build artifacts for each commit:
```
$ grunt dist
```

Run tests in a browser:
```
$ python -m SimpleHTTPServer
$ chromium-browser tests/runner.html
```

Run tests headlessly (currently broken):
```
$ npm install -g phantomjs
$ npm test
```

Event Tracking
--------------

If you have Google Analytics installed, Vellum will track events.
