class Webcaster.View.Playlist extends Backbone.View
  events:
    "click .record-audio"   : "onRecord"
    "click .play-audio"     : "onPlay"
    "click .previous"       : "onPrevious"
    "click .next"           : "onNext"
    "click .stop"           : "onStop"
    "click .metadata"       : "onMetadata"
    "change .files"         : "onFiles"
    "change .passThrough"   : "onPassThrough"
    "change .loop"          : "onLoop"
    "submit"                : "onSubmit"

  initialize: ->
    # TODO
    @listenTo Webcaster.node, "ended", ->
      @$(".track-row").removeClass "success"
      return unless @model.get("loop")
      @play()

    @model.on "change:fileIndex", =>
      @$(".track-row").removeClass "success"
      @$(".track-row-#{@model.get("fileIndex")}").addClass "success"

    @model.on "change:volumeLeft", =>
      @$(".volume-left").width "#{@model.get("volumeLeft")}%"

    @model.on "change:volumeRight", =>
      @$(".volume-right").width "#{@model.get("volumeRight")}%"

    if (new Audio).canPlayType("audio/mpeg") == ""
      @model.set mad: true

  render: ->
    files = @model.get "files"

    @$(".files-table").empty()

    return unless files.length > 0

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

  onRecord: ->

  play: (options) ->
    @file = @model.selectFile options

    @$(".play-control").attr disabled: "disabled"
    @model.play @file, =>
      @$(".play-control").removeAttr "disabled"

  onPlay: (e) ->
    e.preventDefault()
    @play()

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

  onMetadata: (e) ->
    e.preventDefault()
    return unless @file?

    @model.sendMetadata @file

  onFiles: ->
    files = @$(".files")[0].files
    @$(".files").attr disabled: "disabled"

    @model.appendFiles files, =>
      @$(".files").removeAttr("disabled").val ""
      @render()

  onPassThrough: (e) ->
    @model.set passThrough: $(e.target).is(":checked")

  onLoop: (e) ->
    @model.set loop: $(e.target).is(":checked")

  onSubmit: (e) ->
    e.preventDefault()
