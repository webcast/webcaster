class Webcaster.Source.Mad extends Webcaster.Source
  bufferSize: 4096
  resampler: Samplerate.FASTEST

  initialize: ->
    @stop()
    @remaining  = new Array @encoder.channels
    @resamplers = new Array @encoder.channels
    @pending    = new Array @encoder.channels
    for i in [0..@encoder.channels-1]
      @remaining[i]  = new Float32Array
      @pending[i]    = new Float32Array
      @resamplers[i] = new Samplerate
        type: @resampler

  concat: (a,b) ->
    if typeof b == "undefined"
      return a

    ret = new Float32Array a.length+b.length
    ret.set a
    ret.subarray(a.length).set b
    ret

  prepare: ({file}, cb) ->
    super
    @initialize()

    @oscillator = @context.createOscillator()
    @source = @context.createScriptProcessor @bufferSize, @encoder.channels, @encoder.channels

    @source.onaudioprocess = @processBuffer
    @oscillator.connect @source

    file.createMadDecoder (@decoder) =>
      @decoder.decodeFrame (data, err) =>
        return if err? # TODO: notify app?

        @format = @decoder.getCurrentFormat()
        @bufferDuration = parseFloat(@bufferSize)/parseFloat(@context.sampleRate)

        @processFrame data, err
        cb()

  processFrame: (buffer, err) =>
    if err?
      @encoderDone = true
      return

    buffer = buffer.slice 0, @model.get("channels")

    for i in [0..buffer.length-1]
      if @format.sampleRate != @context.sampleRate
        buffer[i] = @concat @remaining[i], buffer[i]

        {data, used} = @resamplers[i].process
          data:  buffer[i]
          ratio: parseFloat(@context.sampleRate) / parseFloat(@format.sampleRate)

        @remaining[i] = buffer[i].subarray used
        buffer[i] = data

      @pending[i] = @concat @pending[i], buffer[i]

    pendingDuration = parseFloat(@pending[0].length)/parseFloat(@context.sampleRate)

    return if pendingDuration >= @bufferDuration

    @decoder.decodeFrame @processFrame

  processBuffer: (buf) =>
    @decoder.decodeFrame @processFrame

    if @encoderDone and @pending[0].length == 0
      @trigger "ended"
      return @stop()

    for i in [0..@encoder.channels-1]
      channelData = buf.outputBuffer.getChannelData i
      samples = Math.min @pending[i].length, channelData.length
      channelData.set @pending[i].subarray(0, samples)
      @pending[i] = @pending[i].subarray samples, @pending[i].length

  play: ->
    super
    @oscillator.start 0
    
  stop: ->
    @oscillator?.stop 0
    @oscillator = null
