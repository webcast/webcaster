class Broster.Player
  _.extend @prototype, Backbone.Events

  constructor: ({@model}) ->

  selectFile: (options = {}) ->
    files = @model.get "files"
    index = @model.get "fileIndex"

    return if files.length == 0

    index += if options.backward then -1 else 1

    if index < 0 or index >= files.length
      return unless @model.get("loop")

      if index < 0
        index = files.length-1
      else
        index = 0

    file = files[index]
    @model.set fileIndex: index

    file

  getSource: ->
    return @source if @source?

    if @model.get("mad")
      @source = new Broster.Source.Mad
        model: @model
    else
      @source = new Broster.Source.AudioElement
        model: @model

    @listenTo @source, "ended", =>
      @trigger "ended"

    @source

  play: (file, cb) ->
    @getSource().prepare file, =>
      @getSource().play file
      @playing = true
      cb?()

  stop: (cb) ->
    @model.set fileIndex: -1

    source = @getSource()

    @source = null
    @playing = false

    return cb() unless source?
    @stopListening source
    source.close cb

  sendMetadata: (data) ->
    @source?.sendMetadata data
