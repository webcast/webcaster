.PHONY: all test

FILES:=src/webcaster.coffee src/node.coffee \
  src/models/track.coffee src/models/microphone.coffee src/models/mixer.coffee src/models/playlist.coffee src/models/settings.coffee \
	src/views/track.coffee src/views/microphone.coffee src/views/mixer.coffee src/views/playlist.coffee src/views/settings.coffee \
	src/init.coffee
OPTIONS:=-c -j js/client.js $(FILES)

all:
	coffee $(OPTIONS)

init:
	git submodule init
	git submodule update

run:
	python -m SimpleHTTPServer

watch:
	coffee -w $(OPTIONS)
