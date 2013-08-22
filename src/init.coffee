$ ->
  Broster.model = new Broster.Model

  Broster.player = new Broster.Player
    model : Broster.model

  _.extend Broster,
    model : Broster.model

    settings : new Broster.View.Settings
      model : Broster.model
      el    : $("div.settings")

    client : new Broster.View.Client
      model  : Broster.model
      player : Broster.player
      el     : $("div.client")

    metadata : new Broster.View.Metadata
      model  : Broster.model
      player : Broster.player
      el     : $("div.metadata")

  Broster.settings.render()
  Broster.client.render()
  Broster.metadata.render()
