class Webcaster.Node
  _.extend @prototype, Backbone.Events

  constructor: ({@model}) ->
    if typeof webkitAudioContext != "undefined"
      @context = new webkitAudioContext
    else
      @context = new AudioContext

    @webcast = @context.createWebcastSource 4096, 2, @model.get("passThrough")
    @webcast.connect @context.destination

  startStream: ->
    switch @model.get("encoder")
      when "mp3"
        encoder = Webcast.Encoder.Mp3
      when "raw"
        encoder = Webcast.Encoder.Raw

    @encoder = new encoder
      channels   : @model.get("channels")
      samplerate : @model.get("samplerate")
      bitrate    : @model.get("bitrate")

    if @model.get("samplerate") != @context.sampleRate
      @encoder = new Webcast.Encoder.Resample
        encoder    : @encoder
        type       : Samplerate.LINEAR,
        samplerate : @context.sampleRate

    if @model.get("asynchronous")
      @encoder = new Webcast.Encoder.Asynchronous
        encoder : @encoder
        scripts: [
          "https://rawgithub.com/webcast/libsamplerate.js/master/dist/libsamplerate.js",
          "https://rawgithub.com/savonet/shine/master/js/dist/libshine.js",
          "https://rawgithub.com/webcast/webcast.js/master/lib/webcast.js"
        ]

    @webcast.connectSocket @encoder, @model.get("uri")

  stopStream: ->
    @webcast.close()

  createAudioSource: (file, cb) ->
    audio?.pause()
    audio?.remove()

    audio = new Audio URL.createObjectURL(file)
    audio.controls = false
    audio.autoplay = false
    audio.loop     = false

    audio.addEventListener "ended", =>
      # TODO @trigger "ended"

    audio.addEventListener "canplay", =>
      source = @context.createMediaElementSource audio

      source.play = ->
        audio.play()

      source.stop = ->
        audio.pause()
        audio.remove()

      cb source

  createMadSource: (file, cb) ->
    file.createMadDecoder (decoder, format) =>
      source = @context.createMadSource 1024, decoder, format

      source.play = ->
        source.start 0

      fn = source.stop
      source.stop = ->
        fn.call source, 0

      cb source

  createSource: ({file}, mad, cb) ->
    @source?.disconnect()

    if /\.mp3$/i.test(file.name) and mad
      @createMadSource file, cb
    else
      @createAudioSource file, cb

  sendMetadata: (data) ->
    @webcast.sendMetadata data

  close: (cb) ->
    @webcast.close cb
