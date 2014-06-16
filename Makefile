all:    clean rjs madge

clean:
	rm -rf dist

madge:
	madge --format amd src -R src/require-config.js -i deps.png -x "^(css.*|jquery|underscore|require-config|util)$$"

rjs:
	r.js -o build.js
	rm -rf dist/.git
	
