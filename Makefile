all:  tar

rjs: deps _rjs

tar: rjs _tar

test: tar _test

deps:
	npm install

madge:
	PATH=$$(npm bin):$$PATH madge --format amd src -R src/main.js -i deps.png -x "^(css.*|jquery|underscore|main|util)$$"

_rjs:
	rm -rf _build
	PATH=$$(npm bin):$$PATH r.js -o build.js
# r.js removeCombined option doesn't handle plugin resources
	rm -r _build/src/exclude.js _build/src/templates _build/src/less-style
	find _build/ -maxdepth 1 -mindepth 1 -not -name src -not -name lib -not -name README.md -not -name bower_components | xargs rm -rf
# https://github.com/guybedford/require-css/issues/133 
	cd _build/bower_components && ls . | grep -v MediaUploader | grep -v require-css | xargs rm -r
# gets removed by removeCombined
	cp bower_components/require-css/css.js _build/bower_components/require-css/
# TODO auto-generate this file from build.js
	cp bundles.js _build/src/main.js


_tar:
	rm -f vellum.tar.gz
	tar -czf vellum.tar.gz -C _build .

_test:
	npm test
