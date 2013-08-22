class Broster.Source
  _.extend @prototype, Backbone.Events

  constructor: ({@model}) ->

  prepare: (cb) ->
    @model.set position: 0.0

    old = @encoder

    switch @model.get("encoder")
      when "mp3"
        encoder = Webcast.Encoder.Mp3
      when "raw"
        encoder = Webcast.Encoder.Raw

    @encoder = new encoder
      channels   : @model.get("channels")
      samplerate : @model.get("samplerate")
      bitrate    : @model.get("bitrate")

    if @samplerate? and @model.get("samplerate") != @samplerate
      @encoder = new Webcast.Encoder.Resample
        encoder    : @encoder
        type       : Samplerate.LINEAR,
        samplerate : @samplerate

    if @model.get("asynchronous")
      @encoder = new Webcast.Encoder.Asynchronous
        encoder : @encoder
        scripts: [
          "https://rawgithub.com/webcast/libsamplerate.js/master/dist/libsamplerate.js",
          "https://rawgithub.com/savonet/shine/master/js/dist/libshine.js",
          "https://rawgithub.com/webcast/webcast.js/master/lib/webcast.js"
        ]

    return cb() unless old?

    old.close (data) ->
      @websocket?.sendData data
      cb()

  play: ({metadata}) ->
    @sendMetadata metadata

  sendMetadata: (data) ->
    @webcast?.sendMetadata data
