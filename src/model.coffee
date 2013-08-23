class Webcaster.Model extends Backbone.Model
  constructor: (attributes, options) ->
    attributes ||= {}

    attributes = _.defaults attributes,
      files: []
      fileIndex: -1
      position: 0.0
      uri: "ws://localhost:8080/mount"
      bitrate: 128
      bitrates: [ 8, 16, 24, 32, 40, 48, 56,
                  64, 80, 96, 112, 128, 144,
                  160, 192, 224, 256, 320 ]
      samplerate: 44100
      samplerates: [ 8000, 11025, 12000, 16000,
                     22050, 24000, 32000, 44100, 48000 ]
      channels: 2
      encoder: "mp3"
      passThrough: false
      asynchronous: false
      mad: false
      loop: true

    super attributes, options

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
