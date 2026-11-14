import { test } from "node:test"
import assert from "node:assert/strict"
import { Deck, Mixer, crossfade, formatTime, nextIndex, rmsDb } from "../dist/core/mixer.js"

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
  deck.addEventListener("change", () => changes.push(deck.tracks[0].title))
  deck.add([new File(["x"], "song.mp3")])
  assert.equal(deck.tracks[0].title, "song.mp3")
  resolveTags({ title: "Song", artist: "Artist", duration: 42 })
  await new Promise(setImmediate)
  assert.deepEqual(deck.tracks[0], { file: deck.tracks[0].file, title: "Song", artist: "Artist", duration: 42 })
  assert.deepEqual(changes, ["song.mp3", "Song"])
})
