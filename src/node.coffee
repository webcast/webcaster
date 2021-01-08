class Webcaster.Node
  _.extend @prototype, Backbone.Events

  constructor: ({@model}) ->
    setContext = =>
      sampleRate = @model.get("samplerate")
      channels = @model.get("channels")

      @context = new AudioContext(
        sampleRate: sampleRate
      )

      @sink = @context.createScriptProcessor 256, 2, 2
      @sink.onaudioprocess = (buf) =>
        channelData = buf.inputBuffer.getChannelData channel

        for channel in [0..buf.inputBuffer.numberOfChannels-1]
          buf.outputBuffer.getChannelData(channel).set channelData    

      @playThrough = @context.createScriptProcessor 256, 2, 2

      @playThrough.onaudioprocess = (buf) =>
        channelData = buf.inputBuffer.getChannelData channel

        for channel in [0..buf.inputBuffer.numberOfChannels-1]
          if @model.get("passThrough")
            buf.outputBuffer.getChannelData(channel).set channelData
          else
            buf.outputBuffer.getChannelData(channel).set (new Float32Array channelData.length)

      @sink.connect @playThrough
      @playThrough.connect @context.destination

      @streamNode = @context.createMediaStreamDestination()
      @streamNode.channelCount = channels

      @sink.connect @streamNode

    setContext()

    @model.on "change:samplerate", setContext
    @model.on "change:channels", setContext

  registerSource: ->
    @model.set "playing", @model.get("playing") + 1

  unregisterSource: ->
    @model.set "playing", Math.max(0, @model.get("playing") - 1)

  startStream: =>
    @model.set "streaming", true

    @context.resume()

    mimeType = @model.get("mimeType")
    audioBitrate = Number(@model.get("audioBitrate"))*1000;
    videoBitrate = Number(@model.get("videoBitrate"))*1000000;
    url = @model.get("url")

    if @model.get("camera")
      @streamNode.stream.addTrack $(".camera-preview").get(0).captureStream().getTracks()[0]

    @mediaRecorder = new MediaRecorder(@streamNode.stream,
      mimeType: mimeType,
      audioBitsPerSecond: audioBitrate
      videoBitsPerSecond: videoBitrate
    );

    @socket = new Webcast.Socket(
      mediaRecorder: @mediaRecorder,
      url: url
    )

    @mediaRecorder.start(1000)

  stopStream: =>
    @mediaRecorder?.stop()
    @model.set "streaming", false

  createAudioSource: ({file, audio}, model, cb) ->
    el = new Audio URL.createObjectURL(file)
    el.controls = false
    el.autoplay = false
    el.loop     = false

    el.addEventListener "ended", =>
      model.onEnd()

    source = null

    el.addEventListener "canplay", =>
      return if source?

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

  createFileSource: (file, model, cb) ->
    @source?.disconnect()

    @createAudioSource file, model, cb

  createMicrophoneSource: (constraints, cb) ->
    navigator.mediaDevices.getUserMedia(constraints).then (stream) =>
      source = @context.createMediaStreamSource stream

      source.stop = ->
        stream.getAudioTracks()?[0].stop()

      cb source

  sendMetadata: (data) ->
    @socket?.sendMetadata data
