class Webcaster.Model.Playlist extends Backbone.Model
  initialize: (attributes, options) ->
    @node = options.node
    @controls = options.controls
    @gain = @node.context.createGain()
    @gain.connect @node.webcast

    @listenTo @controls, "change:slider", @setGain
    @setGain()

  setGain: (slider) ->
    slider = parseFloat @controls.get("slider")
    if @get("position") == "left"
      @gain.gain.value = 1.0 - slider/100.0
    else
      @gain.gain.value = slider/100.0

  appendFiles: (newFiles, cb) ->
    files = @get "files"

    onDone = _.after newFiles.length, =>
      @set files: files
      cb?()

    addFile = (file) ->
      file.readTaglibMetadata (data) =>
        files.push
          file     : file
          audio    : data.audio
          metadata : data.metadata

        onDone()

    addFile newFiles[i] for i in [0..newFiles.length-1]

  selectFile: (options = {}) ->
    files = @get "files"
    index = @get "fileIndex"

    return if files.length == 0

    index += if options.backward then -1 else 1

    if index < 0 or index >= files.length
      return unless @get("loop")

      if index < 0
        index = files.length-1
      else
        index = 0

    file = files[index]
    @set fileIndex: index

    file

  play: (file, cb) ->
    @stop()

    @node.createSource file, @get("mad"), (@source) =>
      source.connect @gain
      source.play file
      cb()

  stop: ->
    @source?.stop()
    @source?.disconnect()

  sendMetadata: (file) ->
    @node.sendMetadata file.metadata
