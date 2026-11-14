import { test } from "node:test"
import assert from "node:assert/strict"
import { Deck, Microphone, Mixer, crossfade, formatTime, nextIndex, rmsDb } from "../dist/core/mixer.js"

test("crossfade keeps both sides at full volume in the middle", () => {
  assert.deepEqual(crossfade(0), [1, 0])
  assert.deepEqual(crossfade(0.5), [1, 1])
  assert.deepEqual(crossfade(1), [0, 1])
  assert.deepEqual(crossfade(0.75), [0.5, 1])
})

test("nextIndex walks the playlist and wraps only when looping", () => {
  assert.equal(nextIndex(-1, 3), 0)
  assert.equal(nextIndex(-1, 3, { backward: true }), 2)
  assert.equal(nextIndex(0, 3), 1)
  assert.equal(nextIndex(2, 3), -1)
  assert.equal(nextIndex(2, 3, { loop: true }), 0)
  assert.equal(nextIndex(0, 3, { backward: true }), -1)
  assert.equal(nextIndex(0, 3, { backward: true, loop: true }), 2)
  assert.equal(nextIndex(-1, 0), -1)
})

test("rmsDb measures dBFS and clamps silence to the floor", () => {
  assert.equal(rmsDb(new Float32Array(16)), -60)
  assert.equal(rmsDb(new Float32Array(16).fill(1)), 0)
  assert.ok(Math.abs(rmsDb(new Float32Array(16).fill(0.5)) - -6.0206) < 1e-3)
})

test("formatTime", () => {
  assert.equal(formatTime(0), "00:00")
  assert.equal(formatTime(65.9), "01:05")
  assert.equal(formatTime(3725), "1:02:05")
  assert.equal(formatTime(NaN), "--:--")
  assert.equal(formatTime(Infinity), "--:--")
})

test("cueing is exclusive and toggles off", () => {
  const mixer = new Mixer()
  const left = new Deck(mixer, "left")
  const right = new Deck(mixer, "right")
  mixer.toggleCue(left)
  assert.equal(left.cued, true)
  mixer.toggleCue(right)
  assert.deepEqual([left.cued, right.cued], [false, true])
  mixer.toggleCue(mixer)
  assert.deepEqual([right.cued, mixer.cued === mixer], [false, true])
  mixer.toggleCue(mixer)
  assert.equal(mixer.cued, null)
})

test("each deck follows its side of the crossfader", () => {
  const mixer = new Mixer()
  assert.deepEqual([mixer.mixFor("left"), mixer.mixFor("right")], [1, 1])
  mixer.setCrossfade(1)
  assert.deepEqual([mixer.mixFor("left"), mixer.mixFor("right")], [0, 1])
})

test("decks list files by name until their tags are read", async () => {
  let resolveTags
  const deck = new Deck(new Mixer(), "left", () => new Promise(resolve => (resolveTags = resolve)))
  const changes = []
  deck.addEventListener("tracks", () => changes.push(deck.tracks[0].title))
  deck.add([new File(["x"], "song.mp3")])
  assert.equal(deck.tracks[0].title, "song.mp3")
  resolveTags({ title: "Song", artist: "Artist", duration: 42 })
  await new Promise(setImmediate)
  assert.deepEqual(deck.tracks[0], { file: deck.tracks[0].file, title: "Song", artist: "Artist", duration: 42 })
  assert.deepEqual(changes, ["song.mp3", "Song"])
})

// Just enough of Web Audio, HTMLAudioElement and getUserMedia to drive decks and the microphone.
class FakeNode {
  constructor(context) {
    this.context = context
    this.gain = { value: 1, setTargetAtTime() {} }
  }
  connect(node) {
    return node
  }
  disconnect() {}
}

class FakeContext {
  constructor() {
    this.destination = new FakeNode(this)
  }
  resume() {
    return Promise.resolve()
  }
  createGain() {
    return new FakeNode(this)
  }
  createMediaStreamDestination() {
    return new FakeNode(this)
  }
  createMediaElementSource() {
    return new FakeNode(this)
  }
  createMediaStreamSource() {
    return new FakeNode(this)
  }
}

class FakeAudio extends EventTarget {
  static instances = []
  constructor(src) {
    super()
    Object.assign(this, { src, paused: true, currentTime: 0, duration: NaN })
    FakeAudio.instances.push(this)
  }
  play() {
    this.paused = false
    return new Promise((resolve, reject) => Object.assign(this, { resolvePlay: resolve, rejectPlay: reject }))
  }
  pause() {
    this.paused = true
  }
}

class FakeTrack extends EventTarget {
  stopped = false
  stop() {
    this.stopped = true
  }
}

const fakeStream = () => {
  const tracks = [new FakeTrack()]
  return { tracks, getTracks: () => tracks, getAudioTracks: () => tracks }
}

const pendingUserMedia = []

Object.assign(globalThis, {
  AudioContext: FakeContext,
  GainNode: FakeNode,
  ChannelSplitterNode: FakeNode,
  AnalyserNode: FakeNode,
  Audio: FakeAudio,
})
Object.assign(URL, { createObjectURL: () => "blob:fake", revokeObjectURL: () => {} })
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    mediaDevices: {
      getUserMedia: () => new Promise(resolve => pendingUserMedia.push(resolve)),
    },
  },
})

const tick = () => new Promise(setImmediate)
const files = names => names.map(name => new File(["x"], name))

test("a play() aborted by switching tracks does not stop the new track", async () => {
  FakeAudio.instances = []
  const deck = new Deck(new Mixer(), "left")
  deck.add(files(["a.mp3", "b.mp3"]))
  deck.play(0)
  deck.play(1)
  FakeAudio.instances[0].rejectPlay(new Error("AbortError"))
  await tick()
  assert.equal(deck.loaded, true)
  assert.equal(deck.index, 1)

  FakeAudio.instances[1].rejectPlay(new Error("NotSupportedError"))
  await tick()
  assert.equal(deck.loaded, false)
})

test("play on an empty deck leaves no current track", () => {
  const deck = new Deck(new Mixer(), "left")
  deck.togglePause()
  assert.equal(deck.index, -1)
  deck.add(files(["a.mp3", "b.mp3"]))
  deck.skip()
  assert.equal(deck.index, 0)
})

test("overlapping microphone starts keep only the latest stream", async () => {
  pendingUserMedia.length = 0
  const microphone = new Microphone(new Mixer())
  const first = microphone.start()
  const second = microphone.start()
  const [older, newer] = [fakeStream(), fakeStream()]
  pendingUserMedia[1](newer)
  pendingUserMedia[0](older)
  await Promise.all([first, second])
  assert.equal(older.tracks[0].stopped, true)
  assert.equal(newer.tracks[0].stopped, false)
  assert.equal(microphone.active, true)

  microphone.stop()
  assert.equal(newer.tracks[0].stopped, true)
  assert.equal(microphone.active, false)
})

test("stopping the microphone while access is pending releases the stream", async () => {
  pendingUserMedia.length = 0
  const microphone = new Microphone(new Mixer())
  const started = microphone.start()
  microphone.stop()
  const stream = fakeStream()
  pendingUserMedia[0](stream)
  await started
  assert.equal(stream.tracks[0].stopped, true)
  assert.equal(microphone.active, false)
})

test("an ended microphone track stops the microphone", async () => {
  pendingUserMedia.length = 0
  const microphone = new Microphone(new Mixer())
  const started = microphone.start()
  const stream = fakeStream()
  pendingUserMedia[0](stream)
  await started
  stream.tracks[0].dispatchEvent(new Event("ended"))
  assert.equal(microphone.active, false)
})
