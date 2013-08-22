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
    if err?
      clearInterval @handler if @handler?
      @trigger "ended"
      return

    data = data.slice 0, @model.get("channels")

    @encoder.encode data, (encoded) =>
      @webcast?.sendData encoded

    if @handler?
      @model.set position: @model.get("position")+@frameDuration
      return
  
    format = @decoder.getCurrentFormat()
    @frameDuration = 1000*parseFloat(data[0].length)/format.sampleRate

    fn = =>
      @decoder.decodeFrame @processFrame

    @handler = setInterval fn, frameDuration

    @model.set position: @model.get("position")+@frameDuration

  close: (cb) ->
    clearInterval @handler if @handler?

    encoder = @encoder
    webcast = @webcast
    @handler = @webcast = @handler = @frameDuration = null

    return cb() unless encoder?
    encoder.close (data) ->
      webcast?.sendData data
      webcast?.close()
      cb()
