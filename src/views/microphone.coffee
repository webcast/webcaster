class Webcaster.View.Microphone extends Webcaster.View.Track
  events:
    "click .record-audio"    : "onRecord"
    "click .passThrough"     : "onPassThrough"
    "submit"                 : "onSubmit"

  initialize: ->
    super

    @model.on "playing", =>
      @$(".play-control").removeAttr "disabled"
      @$(".record-audio").addClass "btn-recording"
      @$(".volume-left").width "0%"
      @$(".volume-right").width "0%"

    @model.on "stopped", =>
      @$(".record-audio").removeClass "btn-recording"
      @$(".volume-left").width "0%"
      @$(".volume-right").width "0%"

  render: ->
    @$(".microphone-slider").slider
      orientation: "vertical"
      min: 0
      max: 150
      value: 100
      slide: (e, ui) =>
        @model.set trackGain: ui.value

    this

  onRecord: (e) ->
    e.preventDefault()

    if @model.isPlaying()
      return @model.stop()

    @$(".play-control").attr disabled: "disabled"
    @model.play()
