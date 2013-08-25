class Webcaster.View.Controls extends Backbone.View
  render: ->
    @$(".slider").slider
      slide: (e, ui) =>
        @model.set slider: ui.value

    this
