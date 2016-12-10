# Webcaster

Browser-based streaming client for the [webcast.js](https://github.com/webcast/webcast.js) websocket protocol.

You can try it here: [https://webcast.github.io/webcaster/](https://webcast.github.io/webcaster/)

You need to run a server that supports the [webcast.js](https://github.com/webcast/webcast.js) protocol. For instance:
```
liquidsoap "output.ao(fallible=true,audio_to_stereo(input.harbor('mount',port=8080)))"
```

The client looks like this:

<img src="https://raw.githubusercontent.com/webcast/webcaster/master/img/screenshot.png"/>

