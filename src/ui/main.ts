import {
  Deck,
  Microphone,
  Mixer,
  audioFormats,
  formatTime,
  supportedFormats,
  videoFormats,
  type Channel,
  type Cueable,
  type Format,
  type Side,
  type TagReader,
} from "../core/mixer.js"

type TaglibData = { metadata?: { title?: string; artist?: string }; audio?: { length?: number } }

declare global {
  interface File {
    readTaglibMetadata?: (callback: (data: TaglibData) => void) => void
  }
}

const $ = <T extends Element>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<T>(selector)
  if (!element) throw new Error(`Missing element: ${selector}`)
  return element
}

// taglib.js never calls back on files it cannot parse: those tracks keep their file name.
const readTags: TagReader = file =>
  new Promise(resolve =>
    file.readTaglibMetadata?.(({ metadata, audio }) =>
      resolve({ title: metadata?.title, artist: metadata?.artist, duration: audio?.length })
    )
  )

const mixer = new Mixer()
const frameCallbacks: (() => void)[] = []

const setStatus = (message: string) => {
  $("#stream .status").textContent = message
}

const cueButtons = new Map<Cueable, HTMLButtonElement>()

const bindCue = (target: Cueable, button: HTMLButtonElement) => {
  cueButtons.set(target, button)
  button.addEventListener("click", () => mixer.toggleCue(target))
}

mixer.addEventListener("change", () => {
  for (const [target, button] of cueButtons) button.setAttribute("aria-pressed", String(mixer.cued === target))
})

const bindChannel = (channel: Channel, root: ParentNode) => {
  const gain = $<HTMLInputElement>(".gain", root)
  const gainValue = $<HTMLOutputElement>(".gain-value", root)
  gain.addEventListener("input", () => {
    channel.setGain(gain.valueAsNumber / 100)
    gainValue.value = `${gain.value}%`
  })

  bindCue(channel, $(".cue", root))

  const meters = [...root.querySelectorAll<HTMLMeterElement>("meter.level")]
  frameCallbacks.push(() => {
    const levels = channel.levels()
    meters.forEach((meter, index) => (meter.value = levels?.[index] ?? meter.min))
  })
}

const trackRow = (deck: Deck, index: number) => {
  const track = deck.tracks[index]
  const row = document.createElement("tr")
  row.classList.toggle("current", index === deck.index)
  const play = document.createElement("button")
  play.type = "button"
  play.textContent = String(index + 1)
  play.ariaLabel = `Play ${track.title}`
  play.addEventListener("click", () => deck.play(index))
  row.insertCell().append(play)
  for (const text of [track.title, track.artist, formatTime(track.duration)]) row.insertCell().textContent = text
  return row
}

const setupDeck = (side: Side, title: string) => {
  const root = $<HTMLElement>(`#deck-${side}`)
  root.append($<HTMLTemplateElement>("#deck-template").content.cloneNode(true))
  const heading = $(".deck-title", root)
  heading.id = `deck-${side}-title`
  heading.textContent = title

  const deck = new Deck(mixer, side, readTags)
  bindChannel(deck, root)

  const play = $<HTMLButtonElement>(".play", root)
  const seek = $<HTMLInputElement>(".seek", root)
  const time = $<HTMLOutputElement>(".time", root)
  const tracks = $("tbody", root)

  play.addEventListener("click", () => deck.togglePause())
  $(".previous", root).addEventListener("click", () => deck.skip({ backward: true }))
  $(".next", root).addEventListener("click", () => deck.skip())
  $(".stop", root).addEventListener("click", () => deck.stop())
  seek.addEventListener("change", () => deck.seek(seek.valueAsNumber))

  const files = $<HTMLInputElement>(".files", root)
  files.addEventListener("change", () => {
    if (files.files) deck.add(files.files)
    files.value = ""
  })
  const playThrough = $<HTMLInputElement>(".play-through", root)
  playThrough.addEventListener("change", () => (deck.playThrough = playThrough.checked))
  const loop = $<HTMLInputElement>(".loop", root)
  loop.addEventListener("change", () => (deck.loop = loop.checked))

  deck.addEventListener("change", () => {
    play.textContent = deck.playing ? "⏸" : "▶"
    play.ariaLabel = deck.playing ? "Pause" : "Play"
    seek.disabled = !deck.loaded
    tracks.replaceChildren(...deck.tracks.map((_, index) => trackRow(deck, index)))
  })

  frameCallbacks.push(() => {
    // Leave the slider alone while the user drags it.
    if (!seek.matches(":active")) {
      seek.max = String(deck.duration)
      seek.value = String(deck.position)
    }
    time.value = deck.loaded ? `${formatTime(deck.position)} / ${formatTime(deck.duration)}` : "--:-- / --:--"
  })
}

const setupMicrophone = () => {
  const root = $("#mixer .microphone")
  const microphone = new Microphone(mixer)
  bindChannel(microphone, root)

  const record = $<HTMLButtonElement>(".record", root)
  const device = $<HTMLSelectElement>(".device", root)
  const lineIn = $<HTMLInputElement>(".line-in", root)

  const listDevices = async () => {
    const selected = device.value
    const inputs = await Microphone.devices()
    device.replaceChildren(
      new Option("Default", ""),
      ...inputs.map((input, index) => new Option(input.label || `Microphone ${index + 1}`, input.deviceId))
    )
    device.value = inputs.some(input => input.deviceId === selected) ? selected : ""
  }

  const start = async () => {
    try {
      await microphone.start({ deviceId: device.value || undefined, lineIn: lineIn.checked })
      await listDevices()
    } catch (error) {
      setStatus(`Microphone: ${error instanceof Error ? error.message : error}`)
    }
  }

  record.addEventListener("click", () => (microphone.active ? microphone.stop() : start()))
  device.addEventListener("change", () => microphone.active && start())
  lineIn.addEventListener("change", () => microphone.active && start())
  microphone.addEventListener("change", () => {
    record.setAttribute("aria-pressed", String(microphone.active))
    record.textContent = microphone.active ? "Microphone off" : "Microphone on"
  })

  navigator.mediaDevices.addEventListener("devicechange", listDevices)
  void listDevices()
}

const fillSelect = (select: HTMLSelectElement, options: [label: string, value: string][], selected?: string) => {
  select.replaceChildren(...options.map(([label, value]) => new Option(label, value, false, value === selected)))
}

const setupStream = () => {
  const root = $("#stream")
  const form = $<HTMLFormElement>(".stream-form", root)
  const settings = $<HTMLFieldSetElement>(".settings", form)
  const start = $<HTMLButtonElement>(".start", form)
  const preview = $<HTMLVideoElement>(".camera-preview", root)
  const fields = form.elements as HTMLFormControlsCollection & {
    url: HTMLInputElement
    format: HTMLSelectElement
    audioBitrate: HTMLSelectElement
    videoBitrate: HTMLSelectElement
    channels: RadioNodeList
    camera: HTMLInputElement
  }

  const audio = supportedFormats(audioFormats)
  const video = supportedFormats(videoFormats)
  let camera: MediaStream | null = null

  const showFormats = (formats: Format[]) => {
    fillSelect(
      fields.format,
      formats.map(({ label, mimeType }) => [label, mimeType])
    )
    $<HTMLElement>(".video-only", form).hidden = !camera
    start.disabled = formats.length === 0
    if (formats.length === 0) setStatus("This browser cannot record any supported format.")
  }

  fillSelect(
    fields.audioBitrate,
    [8, 16, 24, 32, 48, 64, 96, 128, 160, 192, 256, 320].map(b => [`${b}`, `${b}`]),
    "128"
  )
  fillSelect(
    fields.videoBitrate,
    [1, 2.5, 3.5, 5, 7, 10].map(b => [`${b}`, `${b}`]),
    "2.5"
  )
  $<HTMLElement>(".camera-option", form).hidden = video.length === 0
  showFormats(audio)

  fields.camera.addEventListener("change", async () => {
    camera?.getTracks().forEach(track => track.stop())
    camera = null
    if (fields.camera.checked) {
      try {
        camera = await navigator.mediaDevices.getUserMedia({ video: true })
      } catch (error) {
        fields.camera.checked = false
        setStatus(`Camera: ${error instanceof Error ? error.message : error}`)
      }
    }
    preview.srcObject = camera
    preview.hidden = !camera
    if (camera) void preview.play()
    showFormats(camera ? video : audio)
  })

  form.addEventListener("submit", event => {
    event.preventDefault()
    if (mixer.state !== "idle") return mixer.stopStream()
    mixer.startStream({
      url: fields.url.value,
      mimeType: fields.format.value,
      channels: fields.channels.value === "1" ? 1 : 2,
      audioBitrate: Number(fields.audioBitrate.value),
      ...(camera ? { video: camera, videoBitrate: Number(fields.videoBitrate.value) * 1000 } : {}),
    })
  })

  bindCue(mixer, $(".cue", form))

  const metadataForm = $<HTMLFormElement>(".metadata-form", root)
  const metadataFields = $<HTMLFieldSetElement>("fieldset", metadataForm)
  metadataForm.addEventListener("submit", event => {
    event.preventDefault()
    const title = $<HTMLInputElement>("[name=title]", metadataForm).value
    const artist = $<HTMLInputElement>("[name=artist]", metadataForm).value
    if (!title && !artist) return
    mixer.sendMetadata({ title, artist })
    setStatus("Metadata updated.")
  })

  // The mixer also changes on cue and crossfade: only stream updates replace the status line.
  let message = mixer.message
  mixer.addEventListener("change", () => {
    settings.disabled = mixer.state !== "idle"
    metadataFields.disabled = mixer.state !== "live"
    start.textContent = mixer.state === "idle" ? "Start streaming" : "Stop streaming"
    start.classList.toggle("live", mixer.state !== "idle")
    if (mixer.message !== message) setStatus((message = mixer.message))
  })
}

const setupCrossfader = () => {
  const crossfader = $<HTMLInputElement>("#mixer .crossfader")
  crossfader.addEventListener("input", () => mixer.setCrossfade(crossfader.valueAsNumber / 100))
}

setupStream()
setupDeck("left", "Playlist 1")
setupCrossfader()
setupMicrophone()
setupDeck("right", "Playlist 2")

const frame = () => {
  for (const callback of frameCallbacks) callback()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
