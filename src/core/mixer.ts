import { Socket, type HelloInfo, type Metadata } from "@webcast.js/socket"
import { crossfade, nextIndex, rmsDb, type Format } from "./util.js"

export * from "./util.js"

export type StreamState = "idle" | "connecting" | "live"

export type StreamOptions = {
  url: string
  mimeType: string
  channels: 1 | 2
  /** kbit/s */
  audioBitrate: number
  /** Video track to stream along with the mix. */
  video?: MediaStream
  /** kbit/s */
  videoBitrate?: number
  info?: HelloInfo
}

export type Side = "left" | "right"

/** A source that can be sent alone to the local speakers, for monitoring. */
export interface Cueable {
  applyCue(on: boolean): void
}

export const supportedFormats = (formats: Format[]) => formats.filter(f => MediaRecorder.isTypeSupported(f.mimeType))

const changed = (target: EventTarget) => target.dispatchEvent(new Event("change"))

const emit = (target: EventTarget, type: string) => target.dispatchEvent(new Event(type))

const rampTo = (param: AudioParam, value: number) => param.setTargetAtTime(value, 0, 0.01)

/**
 * The audio graph and the outgoing stream. Dispatches `change` when its state changes, and `status` with every new
 * stream status message, even one identical to the previous.
 *
 * The AudioContext is created on first use, which must happen in a user gesture for audio to start.
 */
export class Mixer extends EventTarget implements Cueable {
  context: AudioContext | null = null
  state: StreamState = "idle"
  message = ""
  crossfade = 0.5
  cued: Cueable | null = null
  readonly decks: Deck[] = []

  private master!: GainNode
  private monitor!: GainNode
  private output!: MediaStreamAudioDestinationNode
  private socket: Socket | null = null
  private stopping = false

  ensureContext(): AudioContext {
    if (!this.context) {
      const context = new AudioContext()
      this.master = context.createGain()
      this.output = context.createMediaStreamDestination()
      this.monitor = context.createGain()
      this.monitor.gain.value = this.cued === this ? 1 : 0
      this.master.connect(this.output)
      this.master.connect(this.monitor).connect(context.destination)
      this.context = context
    }
    void this.context.resume()
    return this.context
  }

  get input(): AudioNode {
    this.ensureContext()
    return this.master
  }

  /** Only one source is cued at a time: cueing one releases the previous one. */
  toggleCue(target: Cueable) {
    const next = this.cued === target ? null : target
    this.cued?.applyCue(false)
    this.cued = next
    next?.applyCue(true)
    changed(this)
  }

  applyCue(on: boolean) {
    if (this.context) rampTo(this.monitor.gain, on ? 1 : 0)
  }

  /** 0 is all left, 1 is all right. */
  setCrossfade(position: number) {
    this.crossfade = position
    for (const deck of this.decks) deck.applyMix()
    changed(this)
  }

  mixFor(side: Side) {
    const [left, right] = crossfade(this.crossfade)
    return side === "left" ? left : right
  }

  startStream({ url, mimeType, channels, audioBitrate, video, videoBitrate, info }: StreamOptions) {
    if (this.socket) return
    this.ensureContext()
    this.output.channelCount = channels
    const tracks = [...this.output.stream.getAudioTracks(), ...(video?.getVideoTracks() ?? [])]

    this.stopping = false
    let socket: Socket | null = null
    try {
      const mediaRecorder = new MediaRecorder(new MediaStream(tracks), {
        mimeType,
        audioBitsPerSecond: audioBitrate * 1000,
        ...(video && videoBitrate ? { videoBitsPerSecond: videoBitrate * 1000 } : {}),
      })
      socket = new Socket({
        mediaRecorder,
        url,
        info: {
          ...info,
          audio: { channels, bitrate: audioBitrate, ...info?.audio },
          ...(video ? { video: { bitrate: videoBitrate, ...info?.video } } : {}),
        },
        onOpen: () => {
          if (this.socket === socket) this.setState("live", "Streaming.")
        },
        onClose: ({ code, reason }) => {
          if (this.socket !== socket) return
          this.socket = null
          this.setState("idle", this.stopping ? "Stopped." : `Disconnected: ${reason || `code ${code}`}.`)
        },
      })
      mediaRecorder.start(1000)
      this.socket = socket
      this.setState("connecting", "Connecting…")
    } catch (error) {
      socket?.close()
      this.setState("idle", `Cannot start: ${error instanceof Error ? error.message : error}`)
    }
  }

  stopStream() {
    this.stopping = true
    this.socket?.close()
  }

  sendMetadata(metadata: Metadata) {
    this.socket?.sendMetadata(metadata)
  }

  private setState(state: StreamState, message: string) {
    this.state = state
    this.message = message
    changed(this)
    emit(this, "status")
  }
}

type ChannelNodes = {
  source: AudioNode
  gain: GainNode
  mix: GainNode
  cue: GainNode
  stereo: GainNode
  meters: AnalyserNode[]
}

/** A mixer input with its own gain, cue and level meters. Dispatches `change` when its state changes. */
export abstract class Channel extends EventTarget implements Cueable {
  gain = 1
  private nodes: ChannelNodes | null = null
  private samples = new Float32Array(2048)

  constructor(readonly mixer: Mixer) {
    super()
  }

  get cued() {
    return this.mixer.cued === this
  }

  protected mix() {
    return 1
  }

  protected attach(source: AudioNode) {
    const context = source.context
    const gain = new GainNode(context, { gain: this.gain })
    const mix = new GainNode(context, { gain: this.mix() })
    const cue = new GainNode(context, { gain: this.cued ? 1 : 0 })
    // A splitter does not upmix: this node feeds a mono source to both meters.
    const stereo = new GainNode(context, {
      channelCount: 2,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
    })
    const splitter = new ChannelSplitterNode(context, { numberOfOutputs: 2 })
    const meters = [0, 1].map(channel => {
      const meter = new AnalyserNode(context, { fftSize: this.samples.length })
      splitter.connect(meter, channel)
      return meter
    })
    source.connect(gain)
    gain.connect(mix).connect(this.mixer.input)
    gain.connect(cue).connect(context.destination)
    gain.connect(stereo).connect(splitter)
    this.nodes = { source, gain, mix, cue, stereo, meters }
  }

  protected detach() {
    if (!this.nodes) return
    const { source, gain, mix, cue, stereo } = this.nodes
    for (const node of [source, gain, mix, cue, stereo]) node.disconnect()
    this.nodes = null
  }

  setGain(gain: number) {
    this.gain = gain
    if (this.nodes) rampTo(this.nodes.gain.gain, gain)
    changed(this)
  }

  applyMix() {
    if (this.nodes) rampTo(this.nodes.mix.gain, this.mix())
  }

  applyCue(on: boolean) {
    if (this.nodes) rampTo(this.nodes.cue.gain, on ? 1 : 0)
    changed(this)
  }

  /** RMS level of each channel in dBFS, or null when the channel is not playing. */
  levels(): [left: number, right: number] | null {
    if (!this.nodes) return null
    const [left, right] = this.nodes.meters.map(meter => {
      meter.getFloatTimeDomainData(this.samples)
      return rmsDb(this.samples)
    })
    return [left, right]
  }
}

export type Track = { file: File; title: string; artist: string; duration: number }

export type Tags = { title?: string; artist?: string; duration?: number }

/** Reads a file's tags. Optional: tracks are listed by file name until their tags are known. */
export type TagReader = (file: File) => Promise<Tags>

/** Dispatches `tracks` when the track list, a track's tags or the current track change. */
export class Deck extends Channel {
  tracks: Track[] = []
  index = -1
  loop = false
  playThrough = true
  private element: HTMLAudioElement | null = null

  constructor(
    mixer: Mixer,
    readonly side: Side,
    private readonly readTags?: TagReader
  ) {
    super(mixer)
    mixer.decks.push(this)
  }

  protected mix() {
    return this.mixer.mixFor(this.side)
  }

  get loaded() {
    return this.element !== null
  }

  get playing() {
    return this.element !== null && !this.element.paused
  }

  get position() {
    return this.element?.currentTime ?? 0
  }

  get duration() {
    return this.element?.duration || this.tracks[this.index]?.duration || 0
  }

  add(files: Iterable<File>) {
    for (const file of files) {
      const track: Track = { file, title: file.name, artist: "", duration: NaN }
      this.tracks.push(track)
      this.readTags?.(file).then(
        ({ title, artist, duration }) => {
          if (title) track.title = title
          if (artist) track.artist = artist
          if (duration) track.duration = duration
          emit(this, "tracks")
        },
        () => {}
      )
    }
    emit(this, "tracks")
  }

  play(index: number) {
    this.stop()
    const track = this.tracks[index]
    this.index = track ? index : -1
    emit(this, "tracks")
    if (!track) return changed(this)

    const context = this.mixer.ensureContext()
    const element = new Audio(URL.createObjectURL(track.file))
    element.addEventListener("ended", () => this.ended())
    element.addEventListener("play", () => changed(this))
    element.addEventListener("pause", () => changed(this))
    element.addEventListener("loadedmetadata", () => {
      track.duration = element.duration
      emit(this, "tracks")
    })
    this.attach(context.createMediaElementSource(element))
    this.element = element
    // Switching tracks aborts the previous element's play(): only a failure of the current one stops the deck.
    element.play().catch(() => {
      if (this.element === element) this.stop()
    })
    changed(this)
  }

  togglePause() {
    if (!this.element) return this.play(Math.max(this.index, 0))
    if (this.element.paused) this.element.play().catch(() => {})
    else this.element.pause()
  }

  skip({ backward = false } = {}) {
    this.play(nextIndex(this.index, this.tracks.length, { backward, loop: this.loop }))
  }

  seek(seconds: number) {
    if (this.element) this.element.currentTime = seconds
  }

  stop() {
    if (!this.element) return
    const element = this.element
    this.element = null
    element.pause()
    URL.revokeObjectURL(element.src)
    this.detach()
    changed(this)
  }

  private ended() {
    if (this.playThrough) this.skip()
    else this.stop()
  }
}

export class Microphone extends Channel {
  private stream: MediaStream | null = null
  // Identifies the latest start() or stop(): an older start() that resolves late releases its stream.
  private request = 0

  get active() {
    return this.stream !== null
  }

  /** Device labels are only available once the user has granted microphone access. */
  static async devices() {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter(d => d.kind === "audioinput" && d.deviceId && d.deviceId !== "default")
  }

  /**
   * `lineIn` turns off the browser's voice processing (echo cancellation, noise suppression, automatic gain), which
   * degrades music from a mixer or any other line-level source, and asks for stereo.
   */
  async start({ deviceId, lineIn = false }: { deviceId?: string; lineIn?: boolean } = {}) {
    this.stop()
    const request = ++this.request
    const context = this.mixer.ensureContext()
    const audio: MediaTrackConstraints = {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      ...(lineIn
        ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 } }
        : {}),
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio })
    if (request !== this.request) {
      for (const track of stream.getTracks()) track.stop()
      return
    }
    // An unplugged device or a revoked permission ends the track.
    for (const track of stream.getAudioTracks())
      track.addEventListener("ended", () => {
        if (this.stream === stream) this.stop()
      })
    this.stream = stream
    this.attach(context.createMediaStreamSource(stream))
    changed(this)
  }

  stop() {
    this.request++
    if (!this.stream) return
    this.detach()
    for (const track of this.stream.getTracks()) track.stop()
    this.stream = null
    changed(this)
  }
}
