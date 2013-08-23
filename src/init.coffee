$ ->
  Webcaster.model = new Webcaster.Model

  Webcaster.player = new Webcaster.Player
    model : Webcaster.model

  _.extend Webcaster,
    model : Webcaster.model

    settings : new Webcaster.View.Settings
      model : Webcaster.model
      el    : $("div.settings")

    client : new Webcaster.View.Client
      model  : Webcaster.model
      player : Webcaster.player
      el     : $("div.client")

    metadata : new Webcaster.View.Metadata
      model  : Webcaster.model
      player : Webcaster.player
      el     : $("div.metadata")

  Webcaster.settings.render()
  Webcaster.client.render()
  Webcaster.metadata.render()
