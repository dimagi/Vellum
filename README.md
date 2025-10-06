Vellum
======

![build status](https://github.com/dimagi/vellum/actions/workflows/tests.yml/badge.svg)

Vellum is a JavaRosa [XForm](http://en.wikipedia.org/wiki/XForms) designer used
in [CommCare HQ](http://github.com/dimagi/commcare-hq).

![](http://i.imgur.com/PvrL8Rr.jpg)

Image courtesy of the [ReMIND
project](https://www.crs.org/our-work-overseas/research-publications/remind-project).

Vocabulary
----------

Some of the names used in the source code are less than intuitive. Hopefully
this list will help to reduce the confusion. The list is ordered with the least
intuitive items first.

- **Vellum**: also known as the _Form Builder_.
- **Mug**: an object representing a question. Each mug has a type: _Text_,
  _Date_, _Audio_, etc. While some mug type names match the corresponding label
  used in the UI, some do not. For example, a _Trigger_ is called a _Label_ in
  the UI.
- **JavaRosa**: the language/translation module. A core part of the JavaRosa
  module is the **IText** system, which provides an API for translated strings
  and multimedia used to adorn questions.
- **Widget**: a control or group of controls displayed on the right side of the
  screen and used to interact with mug properties.
- **Plugins**: features that are not part of the core are implemented as plugins.
  The plugin architecture is loosely based on the
  [JSTree](https://www.jstree.com/plugins/) plugin system. Many very important
  components are implemented as plugins, so just because something is a plugin
  does not mean it is a second-rate feature.
  For more details on plugins, see [PLUGIN_DEVELOPMENT.md](PLUGIN_DEVELOPMENT.md).

Usage
-----

Checkout the source from [GitHub](https://github.com/dimagi/Vellum)

Run `yarn dev` to watch and continuously bundle files during development.

To bundle for production, run `yarn build`.

Running `make` will run `yarn build` and all TAR up artifacts in `vellum.tar.gz`.

Load `index.html` to run in a browser.

See
[here](https://github.com/dimagi/commcare-hq/blob/master/corehq/apps/app_manager/static/app_manager/js/forms/form_designer.js)
and `tests/main.js` for example options usage.

Vellum targets modern browsers.  IE8 and earlier are not supported.

Testing and Running Locally
---------------------------

### Prerequisites

Make sure you have Node.js 14.x installed and are using `node 14.x` in your working directory (tip: manage multiple versions of node.js with nvm)

Make sure you have `npm 7.x` installed (`npm install npm@7`)

Run `yarn dev` to generate bundles based on the dev webpack configuration.

### Setup

Make sure everything is up-to-date:
```
$ yarn install --frozen-lockfile
```

You may now run the testserver.  This allows you to run vellum in dev mode and/or run the test suite.
```
$ npm run testserver
```
Click the link in the output to open in your browser, or run
```
$ chromium-browser http://localhost:${VELLUM_PORT:-8088}
```


### Running tests

You can run tests in the browser using the testserver described above.
For best results, we recommend using a Chromium browser.
Firefox currently has issues when running all tests.

Additionally, if you are running Ubuntu 23.10+, you may run into issues running tests headlessly.
See [the Chromium Docs](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md) for background. While any of the approaches outlined there will work,
we recommend [Option 3](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md#option-3_the-safest-way):
- Download and install Chrome from [the official Chrome website](https://www.google.com/chrome/dr/download/)
- add the following to your `.bashrc`:
```
export CHROME_DEVEL_SANDBOX=/opt/google/chrome/chrome-sandbox
```

The testserver will run all tests by default. If you wish to run a subset of tests (or debug one specific test), append a `?grep=<pattern>` to the URL, such as <http://localhost:${VELLUM_PORT:-8088}/?grep=Vellum%20core>, which will test against all of the "Vellum core" tests. The same techniques described below for running specific tests can be used here.


Commands to run tests headlessly (make sure `npm run testserver` is called in the background):
```
./test
```

or to run a specific test:
```
./test "Name of specific test"
```

or pass a regex to run multiple tests:
```
./test "SaveToCase"  # run all tests with 'SaveToCase' in the name
```

A block like the following:
```
describe('the test', () => ...
  describe('with this condition', () => ...
    it('passes', ...)
```
would be referenced as `the test with this condition passes`.
So the final command would be:
```
./test 'the test with this condition passes'
```


Contributing
------------

Follow the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript).

Install dependencies:
```
$ npm install --no-package-lock yarn  # if yarn is not installed globally
$ `npm bin`/yarn install
```

Build optimized version:
```
$ make
```
