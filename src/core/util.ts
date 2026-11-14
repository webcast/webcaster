export type Format = { label: string; mimeType: string }

export const audioFormats: Format[] = [
  { label: "Opus (WebM)", mimeType: "audio/webm;codecs=opus" },
  { label: "Opus (Ogg)", mimeType: "audio/ogg;codecs=opus" },
  { label: "AAC (MP4)", mimeType: "audio/mp4;codecs=mp4a.40.2" },
  { label: "PCM, lossless (WebM)", mimeType: "audio/webm;codecs=pcm" },
]

export const videoFormats: Format[] = [
  { label: "H.264 + Opus (WebM)", mimeType: "video/webm;codecs=h264,opus" },
  { label: "VP9 + Opus (WebM)", mimeType: "video/webm;codecs=vp9,opus" },
  { label: "VP8 + Opus (WebM)", mimeType: "video/webm;codecs=vp8,opus" },
  { label: "H.264 + AAC (MP4)", mimeType: "video/mp4;codecs=avc1,mp4a.40.2" },
]

// Full volume until the fader is halfway to the other side, then a linear fade out.
export const crossfade = (position: number): [left: number, right: number] => {
  const law = (p: number) => Math.min(1, 2 * p)
  return [law(1 - position), law(position)]
}

export const nextIndex = (index: number, length: number, { backward = false, loop = false } = {}) => {
  if (length === 0) return -1
  if (index < 0) return backward ? length - 1 : 0
  const next = index + (backward ? -1 : 1)
  if (next >= 0 && next < length) return next
  if (!loop) return -1
  return next < 0 ? length - 1 : 0
}

export const rmsDb = (samples: Float32Array, floor = -60) => {
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.max(floor, 10 * Math.log10(sum / samples.length))
}

export const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--"
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor(total / 60) % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  const time = `${pad(minutes)}:${pad(total % 60)}`
  return hours > 0 ? `${hours}:${time}` : time
}
