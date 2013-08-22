class Broster.View.Settings extends Backbone.View
  events:
    "change #uri"           : "onUri"
    "change input.encoder"  : "onEncoder"
    "change input.channels" : "onChannels"
    "change #mono"          : "onMono"
    "change #asynchronous"  : "onAsynchronous"
    "change #passThrough"   : "onPassThrough"
    "change #loop"          : "onLoop"
    "change #mad"           : "onMad"
    "submit"                : "onSubmit"

  render: ->
    samplerate = @model.get "samplerate"
    @$("#samplerate").empty()
    _.each @model.get("samplerates"), (rate) =>
      selected = if samplerate == rate then "selected" else ""
      $("<option value='#{rate}' #{selected}>#{rate}</option>").
        appendTo @$("#samplerate")

    bitrate = @model.get "bitrate"
    @$("#bitrate").empty()
    _.each @model.get("bitrates"), (rate) =>
      selected = if bitrate == rate then "selected" else ""
      $("<option value='#{rate}' #{selected}>#{rate}</option>").
        appendTo @$("#bitrate")

    if (new Audio).canPlayType("audio/mpeg") == ""
      @model.set
        mad:         true
        passThrough: false

      @$("#mad").attr
        checked:  "checked"
        disabled: "disabled"

      @$("#passThrough").removeAttr("checked").attr
        disabled: "disabled"

    this

  onUri: ->
    @model.set uri: @$("#uri").val()

  onEncoder: (e) ->
    @model.set encoder: $(e.target).val()

  onChannels: (e) ->
    @model.set channels: parseInt($(e.target).val())

  onAsynchronous: (e) ->
    @model.set asynchronous: $(e.target).is(":checked")

  onPassThrough: (e) ->
    @model.set passThrough: $(e.target).is(":checked")

  onLoop: (e) ->
    @model.set loop: $(e.target).is(":checked")

  onMad: (e) ->
    checked = $(e.target).is(":checked")

    @model.set mad: checked

    if checked
      @$("#file").attr
        accept: "audio/mpeg"

      @$("#passThrough").removeAttr("checked").attr
        disabled: "disabled"

      @model.set passThrough: false
    else
      @$("#file").attr
        accept: "audio/*8"

      @$("#passThrough").removeAttr "disabled"

  onSubmit: (e) ->
    e.preventDefault()
