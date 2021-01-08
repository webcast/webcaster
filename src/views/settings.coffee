class Webcaster.View.Settings extends Backbone.View
  events:
    "change .url"            : "onUrl"
    "change input.encoder"   : "onEncoder"
    "change input.channels"  : "onChannels"
    "change .mimeType"       : "onMimeType"
    "change .samplerate"     : "onSamplerate"
    "change .audio-bitrate"  : "onAudioBitrate"
    "change .video-bitrate"  : "onVideoBitrate"
    "change .asynchronous"   : "onAsynchronous"
    "click .passThrough"     : "onPassThrough"
    "click .start-stream"    : "onStart"
    "click .stop-stream"     : "onStop"
    "click .update-metadata" : "onMetadataUpdate"
    "submit"                 : "onSubmit"

  initialize: ({@node}) ->
    @model.on "change:mimeTypes", => @setFormats()

    @model.on "change:passThrough", =>
      if @model.get("passThrough")
        @$(".passThrough").addClass("btn-cued").removeClass "btn-info"
      else
        @$(".passThrough").addClass("btn-info").removeClass "btn-cued"

    @model.on "change:playing", =>
      if @model.get("playing") > 0
        @setPlaying()
      else
        @setNotPlaying()

    @model.on "change:streaming", =>
      if @model.get("streaming")
        @setStreaming()
      else
        @setNotStreaming()

    @model.on "change:camera", =>
      if @model.get("camera")
        @$(".video-settings").show()
      else
        @$(".video-settings").hide()

  setPlaying: ->
    @$(".samplerate, .channels").attr disabled: "disabled"

  setNotPlaying: ->
    @$(".samplerate, .channels").removeAttr "disabled"

  setStreaming: ->
    @setPlaying()

    @$(".stop-stream").show()
    @$(".start-stream").hide()
    @$(".mimeType, .audio-bitrate, .video-bitrate, .url").attr disabled: "disabled"
    @$(".manual-metadata, .update-metadata").removeAttr "disabled"

  setNotStreaming: ->
    unless @model.get("playing")
      @setNotPlaying()

    @$(".stop-stream").hide()
    @$(".start-stream").show()
    @$(".mimeType, .audio-bitrate, .video-bitrate, .url").removeAttr "disabled"
    @$(".manual-metadata, .update-metadata").attr disabled: "disabled"

  setFormats: ->
    mimeType = @model.get "mimeType"
    @$(".mimeType").empty()
    _.each @model.get("mimeTypes"), ({name, value}) =>
      selected = if mimeType == value then "selected" else ""
      $("<option value='#{value}' #{selected}>#{name}</option>").
        appendTo @$(".mimeType")

  render: ->
    @setFormats()

    samplerate = @model.get "samplerate"
    @$(".samplerate").empty()
    _.each @model.get("samplerates"), (rate) =>
      selected = if samplerate == rate then "selected" else ""
      $("<option value='#{rate}' #{selected}>#{rate}</option>").
        appendTo @$(".samplerate")

    audioBitrate = @model.get "audioBitrate"
    @$(".audio-bitrate").empty()
    _.each @model.get("audioBitrates"), (rate) =>
      selected = if audioBitrate == rate then "selected" else ""
      $("<option value='#{rate}' #{selected}>#{rate}</option>").
        appendTo @$(".audio-bitrate")

    videoBitrate = @model.get "videoBitrate"
    @$(".video-bitrate").empty()
    _.each @model.get("videoBitrates"), (rate) =>
      selected = if videoBitrate == rate then "selected" else ""
      $("<option value='#{rate}' #{selected}>#{rate}</option>").
        appendTo @$(".video-bitrate")

    this

  onUrl: ->
    @model.set url: @$(".url").val()

  onEncoder: (e) ->
    @model.set encoder: $(e.target).val()

  onChannels: (e) ->
    @model.set channels: parseInt($(e.target).val())

  onMimeType: (e) ->
    @model.set mimeType: $(e.target).val()

  onSamplerate: (e) ->
    @model.set samplerate: parseInt($(e.target).val())

  onAudioBitrate: (e) ->
    @model.set audioBitrate: parseInt($(e.target).val())

  onVideoBitrate: (e) ->
    @model.set videoBitrate: parseInt($(e.target).val())

  onAsynchronous: (e) ->
    @model.set asynchronous: $(e.target).is(":checked")

  onPassThrough: (e) ->
    e.preventDefault()

    @model.togglePassThrough()

  onStart: (e) ->
    e.preventDefault()

    @node.startStream()

  onStop: (e) ->
    e.preventDefault()

    @node.stopStream()

  onMetadataUpdate: (e) ->
    e.preventDefault()

    title = @$(".manual-metadata.artist").val()
    artist = @$(".manual-metadata.title").val()

    return unless artist != "" || title != ""

    @node.sendMetadata
      artist: artist
      title:  title

    @$(".metadata-updated").show 400, =>
     cb = =>
       @$(".metadata-updated").hide 400

     setTimeout cb, 2000

  onSubmit: (e) ->
    e.preventDefault()
