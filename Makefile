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
	cd _build/bower_components && ls . | grep -v MediaUploader | xargs rm -r
	mkdir -p _build/bower_components/jstree/dist/themes/default
	cp bower_components/jstree/dist/themes/default/*.png \
	   bower_components/jstree/dist/themes/default/*.gif \
	   _build/bower_components/jstree/dist/themes/default
	mkdir -p _build/bower_components/jquery-ui/themes/redmond/images
	cp bower_components/jquery-ui/themes/redmond/images/*.png \
	   bower_components/jquery-ui/themes/redmond/images/*.gif \
	   _build/bower_components/jquery-ui/themes/redmond/images
# combine CSS files (and adjust location for relative image paths)
	# TODO do we need a blank line between the files? doesn't seem like it after initial test
	cat _build/src/local-deps.css _build/src/main-components.css > _build/style.css
	rm _build/src/local-deps.css _build/src/main-components.css
	# for some reason relative image paths are wrong, so move stuff around
	mv _build/src/global-deps.css _build/src/images _build/
	(`npm bin`/bower list || `npm bin`/bower list --offline) | \
		grep -Ev "^(Vellum|bower) " > _build/bower_components/manifest.txt
# TODO auto-generate this file from build.js
	python buildmain.py > _build/src/main.js


_tar:
	rm -f vellum.tar.gz
	tar -czf vellum.tar.gz -C _build .

_test:
	npm test
