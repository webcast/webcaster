class Webcaster.View.Settings extends Backbone.View
  events:
    "change .uri"           : "onUri"
    "change input.encoder"  : "onEncoder"
    "change input.channels" : "onChannels"
    "change .samplerate"    : "onSamplerate"
    "change .bitrate"       : "onBitrate"
    "change .mono"          : "onMono"
    "change .asynchronous"  : "onAsynchronous"
    "click .passThrough"    : "onPassThrough"
    "click .start-stream"   : "onStart"
    "click .stop-stream"    : "onStop"
    "submit"                : "onSubmit"

  initialize: ({@node}) ->
    @model.on "change:passThrough", =>
      if @model.get("passThrough")
        @$(".passThrough").addClass("btn-cued").removeClass "btn-info"
      else
        @$(".passThrough").addClass("btn-info").removeClass "btn-cued"

  render: ->
    samplerate = @model.get "samplerate"
    @$(".samplerate").empty()
    _.each @model.get("samplerates"), (rate) =>
      selected = if samplerate == rate then "selected" else ""
      $("<option value='#{rate}' #{selected}>#{rate}</option>").
        appendTo @$(".samplerate")

    bitrate = @model.get "bitrate"
    @$(".bitrate").empty()
    _.each @model.get("bitrates"), (rate) =>
      selected = if bitrate == rate then "selected" else ""
      $("<option value='#{rate}' #{selected}>#{rate}</option>").
        appendTo @$(".bitrate")

    this

  onUri: ->
    @model.set uri: @$(".uri").val()

  onEncoder: (e) ->
    @model.set encoder: $(e.target).val()

  onChannels: (e) ->
    @model.set channels: parseInt($(e.target).val())

  onSamplerate: (e) ->
    @model.set samplerate: parseInt($(e.target).val())

  onBitrate: (e) ->
    @model.set bitrate: parseInt($(e.target).val())

  onAsynchronous: (e) ->
    @model.set asynchronous: $(e.target).is(":checked")

  onPassThrough: (e) ->
    e.preventDefault()

    @model.togglePassThrough()

  onStart: (e) ->
    e.preventDefault()

    @$(".stop-stream").show()
    @$(".start-stream").hide()
    @$("input, select").attr disabled: "disabled"

    @node.startStream()

  onStop: (e) ->
    e.preventDefault()

    @$(".stop-stream").hide()
    @$(".start-stream").show()
    @$("input, select").removeAttr "disabled"

    @node.stopStream()

  onSubmit: (e) ->
    e.preventDefault()
