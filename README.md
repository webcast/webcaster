# Webcaster

Browser-based streaming client for the [webcast](https://github.com/webcast/webcast.js) protocol: two playlists with a
crossfader, a microphone, an optional camera, and live metadata, streamed from the browser to a server.

You can try it here: [https://webcast.github.io/webcaster/](https://webcast.github.io/webcaster/)

You need a server that supports the [webcast protocol](https://github.com/webcast/webcast.js/blob/main/SPECS.md). For
instance, with [Liquidsoap](https://www.liquidsoap.info/):

```
liquidsoap "output.ao(fallible=true,audio_to_stereo(input.harbor('mount',port=8080)))"
```

<img src="https://raw.githubusercontent.com/webcast/webcaster/master/img/screenshot.png"/>

## Using the core in your own client

The mixing and streaming logic lives in `src/core` and has no dependency on this page's UI. It is exported as an ES
module:

```js
import { Mixer, Deck, Microphone } from "@webcast.js/webcaster"

const mixer = new Mixer()
const deck = new Deck(mixer, "left")
deck.add(fileInput.files)
deck.play(0)

mixer.startStream({
  url: "wss://source:hackme@example.com/mount",
  mimeType: "audio/webm;codecs=opus",
  channels: 2,
  audioBitrate: 128,
})
mixer.sendMetadata({ title: "My Track", artist: "Me" })
```

`Mixer`, `Deck` and `Microphone` dispatch a `change` event whenever their state changes, which is all a view needs to
listen to. `src/ui/main.ts` is the view used by this page.

## Development

```
npm install
npm run build   # or: npm run watch
npm run serve   # http://localhost:8000
npm test
```

`localhost` is a secure origin, so microphone and camera access work without HTTPS.

The page is deployed to GitHub Pages by `.github/workflows/pages.yml`.
