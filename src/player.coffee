class Broster.Player
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

  play: (file, cb) ->
    unless @source?
      if @model.get("mad")
        @source = new Broster.Source.Mad
          model: @model
      else
        @source = new Broster.Source.AudioElement
          model: @model

    @source.prepare file, =>
      @source.play file
      @playing = true
      cb?()

  stop: (cb) ->
    @model.set fileIndex: -1

    source = @source
    @source = null
    @playing = false

    return cb() unless source?
    source.close cb

  sendMetadata: (data) ->
    @source?.sendMetadata data
