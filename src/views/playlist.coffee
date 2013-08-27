class Webcaster.View.Playlist extends Webcaster.View.Track
  events:
    "click .play-audio"      : "onPlay"
    "click .pause-audio"     : "onPause"
    "click .previous"        : "onPrevious"
    "click .next"            : "onNext"
    "click .stop"            : "onStop"
    "click .progress-seek"   : "onSeek"
    "click .passThrough"     : "onPassThrough"
    "change .files"          : "onFiles"
    "change .loop"           : "onLoop"
    "submit"                 : "onSubmit"

  initialize: ->
    super

    # TODO
    @listenTo Webcaster.node, "ended", ->
      @$(".track-row").removeClass "success"
      return unless @model.get("loop")
      @play()

    @model.on "change:fileIndex", =>
      @$(".track-row").removeClass "success"
      @$(".track-row-#{@model.get("fileIndex")}").addClass "success"

    @model.on "playing", =>
      @$(".play-control").removeAttr "disabled"
      @$(".play-audio").hide()
      @$(".pause-audio").show()
      @$(".track-position-text").removeClass("blink").text ""
      @$(".volume-left").width "0%"
      @$(".volume-right").width "0%"

      if @model.get("duration")
        @$(".progress-volume").css "cursor", "pointer"
      else
        @$(".track-position").addClass("progress-striped active").width "100%"

    @model.on "paused", =>
      @$(".play-audio").show()
      @$(".pause-audio").hide()
      @$(".volume-left").width "0%"
      @$(".volume-right").width "0%"
      @$(".track-position-text").addClass "blink"

    @model.on "stopped", =>
      @$(".play-audio").show()
      @$(".pause-audio").hide()
      @$(".progress-volume").css "cursor", ""
      @$(".track-position").removeClass("progress-striped active").width "0%"
      @$(".track-position-text").removeClass("blink").text ""
      @$(".volume-left").width "0%"
      @$(".volume-right").width "0%"

    @model.on "change:position", =>
      return unless duration = @model.get("duration")

      position = parseFloat @model.get("position")

      @$(".track-position").
        width "#{100.0*position/parseFloat(duration)}%"

      @$(".track-position-text").
        text "#{Webcaster.prettifyTime(position)} / #{Webcaster.prettifyTime(duration)}"

    if (new Audio).canPlayType("audio/mpeg") == ""
      @model.set mad: true

  render: ->
    @$(".volume-slider").slider
      orientation: "vertical"
      min: 0
      max: 150
      value: 100
      slide: (e, ui) =>
        @model.set trackGain: ui.value

    files = @model.get "files"

    @$(".files-table").empty()

    return this unless files.length > 0

    _.each files, ({file, audio, metadata}, index) =>
      if audio?.length != 0
        time = Webcaster.prettifyTime audio.length
      else
        time = "N/A"

      if @model.get("fileIndex") == index
        klass = "success"
      else
        klass = ""
        
      @$(".files-table").append """
        <tr class='track-row track-row-#{index} #{klass}'>
          <td>#{index+1}</td>
          <td>#{metadata.title}</td>
          <td>#{metadata.artist}</td>
          <td>#{time}</td>
        </tr>
                                """

    @$(".playlist-table").show()

    this

  play: (options) ->
    if @model.isPlaying()
      @model.togglePause()
      return

    return unless @file = @model.selectFile options

    @$(".play-control").attr disabled: "disabled"
    @model.play @file

  onPlay: (e) ->
    e.preventDefault()
    @play()

  onPause: (e) ->
    e.preventDefault()
    @model.togglePause()

  onPrevious: (e) ->
    e.preventDefault()
    return unless @file?

    @play backward: true

  onNext: (e) ->
    e.preventDefault()
    return unless @file?

    @play()

  onStop: (e) ->
    e.preventDefault()

    @$(".track-row").removeClass "success"
    @model.stop()
    @file = null

  onSeek: (e) ->
    e.preventDefault()

    @model.seek ((e.pageX - $(e.target).offset().left) / $(e.target).width())

  onFiles: ->
    files = @$(".files")[0].files
    @$(".files").attr disabled: "disabled"

    @model.appendFiles files, =>
      @$(".files").removeAttr("disabled").val ""
      @render()

  onLoop: (e) ->
    @model.set loop: $(e.target).is(":checked")
