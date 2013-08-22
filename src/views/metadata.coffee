class Broster.View.Metadata extends Backbone.View
  events:
    "click #send-metadata"  : "onMetadata"
    "submit"                : "onSubmit"

  initialize: (options = {}) ->
    @player = options.player

  onMetadata: (e) ->
    e.preventDefault()

    @player.sendMetadata
      title:  @$("#title").val()
      artist: @$("#artist").val()

  onSubmit: (e) ->
    e.preventDefault()
