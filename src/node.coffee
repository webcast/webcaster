class Webcaster.Node
  _.extend @prototype, Backbone.Events

  constructor: ({@model}) ->
    if typeof webkitAudioContext != "undefined"
      @context = new webkitAudioContext
    else
      @context = new AudioContext

    @webcast = @context.createWebcastSource 4096, 2
    @webcast.connect @context.destination
 
    @model.on "change:passThrough", =>
      @webcast.setPassThrough @model.get("passThrough")

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

  createAudioSource: ({file, audio}, model, cb) ->
    el = new Audio URL.createObjectURL(file)
    el.controls = false
    el.autoplay = false
    el.loop     = false

    el.addEventListener "ended", =>
      model.onEnd()

    el.addEventListener "canplay", =>
      source = @context.createMediaElementSource el

      source.play = ->
        el.play()

      source.position = ->
        el.currentTime

      source.duration = ->
        el.duration

      source.paused = ->
        el.paused

      source.stop = ->
        el.pause()
        el.remove()

      source.pause = ->
        el.pause()

      source.seek = (percent) ->
        time = percent*parseFloat(audio.length)

        el.currentTime = time
        time

      cb source

  createMadSource: ({file}, model, cb) ->
    # TODO: "ended" event
    file.createMadDecoder (decoder, format) =>
      source = @context.createMadSource 1024, decoder, format

      source.play = ->
        source.start 0

      fn = source.stop
      source.stop = ->
        fn.call source, 0

      cb source

  createFileSource: (file, model, cb) ->
    @source?.disconnect()

    if /\.mp3$/i.test(file.file.name) and model.get("mad")
      @createMadSource file, model, cb
    else
      @createAudioSource file, model, cb

  createMicrophoneSource: (constraints, cb) ->
    navigator.mediaDevices.getUserMedia(constraints).then (stream) =>
      source = @context.createMediaStreamSource stream

      source.stop = ->
        stream.getAudioTracks()?[0].stop()

      cb source

  sendMetadata: (data) ->
    @webcast.sendMetadata data

  close: (cb) ->
    @webcast.close cb
