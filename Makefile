.PHONY: all test

FILES:=src/webcaster.coffee src/model.coffee src/player.coffee src/source.coffee \
	src/sources/*.coffee src/views/*.coffee src/init.coffee
OPTIONS:=-c -j js/client.js $(FILES)

all:
	coffee $(OPTIONS)

test:
	python -m SimpleHTTPServer

watch:
	coffee -w $(OPTIONS)
