.PHONY: all test

FILES:=src/broster.coffee src/model.coffee src/player.coffee src/source.coffee $(wildcard src/views/*.coffee) src/init.coffee
OPTIONS:=-c -j js/client.js $(FILES)

all:
	coffee $(OPTIONS)

test:
	python -m SimpleHTTPServer

watch:
	coffee -w $(OPTIONS)
