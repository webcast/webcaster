# Webcaster

Browser-based streaming client for the [webcast](https://github.com/webcast/webcast.js) protocol: two playlists with a
crossfader, a microphone, an optional camera, and live metadata, streamed from the browser to a server.

You can try it here: [https://webcast.github.io/webcaster/](https://webcast.github.io/webcaster/)

<img src="https://raw.githubusercontent.com/webcast/webcaster/master/img/screenshot.png"/>

## Running a server

Webcaster does not talk to Icecast or Shoutcast directly. It streams to a server that speaks the
[webcast protocol](https://github.com/webcast/webcast.js/blob/main/SPECS.md), which then broadcasts to listeners. Today,
that server is [Liquidsoap](https://www.liquidsoap.info/), with `input.harbor`. The protocol is small and documented,
so other servers can implement it too.

[`examples/server.liq`](examples/server.liq) receives the stream from Webcaster and relays it to Icecast as MP3:

```
liquidsoap examples/server.liq
```

In Webcaster, set the destination to `ws://source:hackme@your-server:8080/mount` and press _Start streaming_. The user,
password, port and mount must match the `input.harbor` settings. If the connection fails, the status line under the
button shows the reason the server gave.

The browser encodes the stream (Opus, AAC or PCM, depending on the browser) and the server re-encodes it for listeners,
so the listener format, MP3 here, is set in the server script.

### HTTPS

Browsers refuse `ws://` connections from a page served over HTTPS, such as the
[online version](https://webcast.github.io/webcaster/). Some make an exception for `localhost`, not all of them. Either:

- enable TLS on the server, by uncommenting the `transport` line in `examples/server.liq`, and use a `wss://` URL, or
- serve the page yourself over plain HTTP.

### Hosting the page

The page is static. Build it with `npm install && npm run build`, then copy `index.html`, `css/`, `img/` and `dist/`
to any web server.

The microphone, line-in and camera need a secure origin: HTTPS, or `localhost`.

## Using the core in your own client

The mixing and streaming logic lives in `src/core` and has no dependency on this page's UI. It is published on npm as
an ES module with TypeScript types:

```
npm install @webcast.js/webcaster
```

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
