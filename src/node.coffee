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
          if @model.get("passThrough")
            buf.outputBuffer.getChannelData(channel).set channelData
          else
            buf.outputBuffer.getChannelData(channel).set (new Float32Array channelData.length)

      @sink.connect @context.destination

      @destination = @context.createMediaStreamDestination()
      @destination.channelCount = channels

    setContext()

    @model.on "change:samplerate", setContext
    @model.on "change:channels", setContext

  startStream: =>
    @context.resume()

    mimeType = @model.get("mimeType")
    bitrate = Number(@model.get("bitrate"))*1000;
    url = @model.get("url")

    @mediaRecorder = new MediaRecorder(@destination.stream,
      mimeType: mimeType,
      audioBitsPerSecond: bitrate
    );

    @socket = new Webcast.Socket(
      mediaRecorder: @mediaRecorder,
      url: url
    )

    @mediaRecorder.start()

  stopStream: =>
    @mediaRecorder?.stop()

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
