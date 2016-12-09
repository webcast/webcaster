.PHONY: all init run github.io

FILES:=src/compat.coffee src/webcaster.coffee src/node.coffee \
  src/models/track.coffee src/models/microphone.coffee src/models/mixer.coffee src/models/playlist.coffee src/models/settings.coffee \
	src/views/track.coffee src/views/microphone.coffee src/views/mixer.coffee src/views/playlist.coffee src/views/settings.coffee \
	src/init.coffee

all: js/client.js

js/client.js: $(FILES)
	cat $^ | coffee  --compile --stdio > $@ 

init:
	git submodule init
	git submodule update

run:
	python -m SimpleHTTPServer
