class Broster.View.Client extends Backbone.View
  events:
    "click #record-audio"   : "onRecord"
    "click #play-audio"     : "onPlay"
    "click #previous"       : "onPrevious"
    "click #next"           : "onNext"
    "click #stop"           : "onStop"
    "change #files"         : "onFiles"
    "submit"                : "onSubmit"

  initialize: (options = {}) ->
    @player = options.player

    @model.on "change:fileIndex", =>
      @$(".track-row").removeClass "success"
      @$(".track-row-#{@model.get("fileIndex")}").addClass "success"

  render: ->
    files = @model.get "files"

    @$(".files-table").empty()

    return unless files.length > 0

    _.each files, ({file, audio, metadata}, index) =>
      if audio?.length != 0
        time = Broster.prettifyTime audio.length
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
    @$(".play-control").attr disabled: "disabled"
    @player.play @player.selectFile(options), =>
      @$(".play-control").removeAttr "disabled"

  onPlay: (e) ->
    e.preventDefault()
    @play()

  onPrevious: (e) ->
    e.preventDefault()
    return unless @player.playing

    @play backward: true

  onNext: (e) ->
    e.preventDefault()
    return unless @player.playing

    @play()

  onStop: (e) ->
    e.preventDefault()

    @$(".track-row").removeClass "success"
    @$(".play-control").attr disabled: "disabled"
    @player.stop =>
      @$(".play-control").removeAttr "disabled"

  onFiles: ->
    files = @$("#files")[0].files
    @$("#files").attr disabled: "disabled"

    @model.appendFiles files, =>
      @$("#files").removeAttr("disabled").val ""
      @render()

  onSubmit: (e) ->
    e.preventDefault()
