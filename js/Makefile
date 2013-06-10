# Special notes:
# 1. Tests are always run on the instrumented source just to keep things simple. Speed is not a problem.
# 2. Everything is written in AMD style, hence uses amdefine for the Node bits, hence gives useless errors if it doesn't parse, hence jshint is crucial.

BIN=node_modules/.bin
MOCHA=$(BIN)/mocha # --harmony-proxies --harmony-collections

#
# .PHONY targets for the command-line
#

.PHONY: test
test: 
	$(MOCHA) --reporter dot ./tests/mocha-test-runner.js

