# Webcaster

Browser-based streaming client for the [webcast.js](https://github.com/webcast/webcast.js) websocket protocol.

You can try it here: [https://webcast.github.io/webcaster/](https://webcast.github.io/webcaster/)

You need to run a server that supports the [webcast.js](https://github.com/webcast/webcast.js) protocol. For instance:
```
liquidsoap "output.ao(fallible=true,audio_to_stereo(input.harbor('mount',port=8080)))"
```

The client looks like this:

![Webcaster](https://user-images.githubusercontent.com/2012073/118627421-fd3fe800-b7cb-11eb-9626-8da1e0b52189.png)
