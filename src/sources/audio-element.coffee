class Broster.Source.AudioElement extends Broster.Source
  constructor: ->
    super

    if typeof webkitAudioContext != "undefined"
      @context = new webkitAudioContext
    else
      @context = new AudioContext

    @samplerate = @context.sampleRate

  prepare: ({file}, cb) ->
    super =>
      unless @webcast?
        @webcast = new Webcast.Node
          url     : @model.get("uri")
          encoder : @encoder
          context : @context,
          options :
            passThrough : @model.get("passThrough")

        @webcast.connect @context.destination

      @source?.disconnect()
      @audio?.remove()

      # This needs to be set for each track in case
      # samplerate has changed
      @webcast.encoder = @encoder

      @audio = new Audio URL.createObjectURL(file)
      @audio.controls = false
      @audio.autoplay = false
      @audio.loop     = false

      @audio.addEventListener "ended", =>
        @trigger "ended"

      @audio.addEventListener "canplay", cb

  play: ->
    super
    @source = @context.createMediaElementSource @audio
    @source.connect @webcast
    @audio.play()

  close: (cb) ->
    @webcast?.close()
    @source?.disconnect()
    @audio?.pause()
    @audio?.remove()
    @context = @source = @audio = @webcast = null
    cb()
