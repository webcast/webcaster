class Webcaster.Model.Microphone extends Webcaster.Model.Track
  play: ->
    @prepare()

    @node.createMicrophoneSource (@source) =>
      @source.connect @destination
      @trigger "playing"
