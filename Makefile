.PHONY: all test

FILES:=src/webcaster.coffee src/node.coffee src/models/*.coffee \
	src/views/*.coffee src/init.coffee
OPTIONS:=-c -j js/client.js $(FILES)

all:
	coffee $(OPTIONS)

test:
	python -m SimpleHTTPServer

watch:
	coffee -w $(OPTIONS)
