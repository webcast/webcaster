class Broster.Source extends Backbone.Events
  constructor: ({@model}) ->

  prepare: (cb) ->
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

class Broster.Source.Mad extends Broster.Source
  prepare: ({audio, file}, cb) ->
    @samplerate = audio.samplerate
    super =>
      clearInterval @handler if @handler?
      @handler = null

      file.createMadDecoder (decoder) =>
        @decoder = decoder

        return cb() if @webcast?

        @webcast = new Webcast.Socket
          url  :  @model.get("uri")
          mime :  @encoder.mime
          info :  @encoder.info
    
        @webcast.addEventListener "open", cb

  play: ->
    super
    @decoder.decodeFrame @processFrame
      
  processFrame: (data, err) =>
    return if err?

    data = data.slice 0, @model.get("channels")

    @encoder.encode data, (encoded) =>
      @webcast?.sendData encoded

    return if @handler?
  
    format = @decoder.getCurrentFormat()
    frameDuration = 1000*parseFloat(data[0].length)/format.sampleRate

    fn = =>
      @decoder.decodeFrame @processFrame
    @handler = setInterval fn, frameDuration

  close: (cb) ->
    clearInterval @handler if @handler?

    encoder = @encoder
    webcast = @webcast
    @handler = @webcast = @handler = null

    return cb() unless encoder?
    encoder.close (data) ->
      webcast?.sendData data
      webcast?.close()
      cb()

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
