class Webcaster.Source
  _.extend @prototype, Backbone.Events

  constructor: ({@model}) ->
    if typeof webkitAudioContext != "undefined"
      @context = new webkitAudioContext
    else
      @context = new AudioContext

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

  connect: ->
    @webcast = new Webcast.Node
      url     : @model.get("uri")
      encoder : @encoder
      context : @context,
      options :
        passThrough : @model.get("passThrough")

    @webcast.connect @context.destination

  prepare: ->
    @source?.disconnect()
    @model.set position: 0.0

  play: ({metadata}) ->
    @source.connect @webcast
    @sendMetadata metadata

  stop: ->
    @source?.disconnect()
    @source = null

  sendMetadata: (data) ->
    @webcast?.sendMetadata data

  close: ->
    @stop()
    @webcast?.close()
    @webcast = null
