class Webcaster.Model.Microphone extends Webcaster.Model.Track
  initialize: ->
    super arguments...

  createSource: (cb) ->
    constraints = {video:false}

    if @get("device")
      constraints.audio =
        exact: @get("device")
    else
      constraints.audio = true

    @node.createMicrophoneSource constraints, (@source) =>
      @source.connect @destination
      cb?()

  play: ->
    @prepare()

    @createSource =>
      @trigger "playing"

  stop: ->
    @source?.disconnect()

    super arguments...
