$ ->
  Webcaster.settings = new Webcaster.Model.Settings
    uri:          "ws://localhost:8080/mount"
    bitrate:      128
    bitrates:     [ 8, 16, 24, 32, 40, 48, 56,
                    64, 80, 96, 112, 128, 144,
                    160, 192, 224, 256, 320 ]
    samplerate:   44100
    samplerates:  [ 8000, 11025, 12000, 16000,
                    22050, 24000, 32000, 44100, 48000 ]
    channels:     2
    encoder:      "mp3"
    asynchronous: false
    passThrough:  false
    mad:          false

  Webcaster.controls = new Webcaster.Model.Controls
    slider: 0

  Webcaster.node = new Webcaster.Node
    model: Webcaster.settings

  _.extend Webcaster,
    views:
      settings : new Webcaster.View.Settings
        model : Webcaster.settings
        node  : Webcaster.node
        el    : $("div.settings")

      controls: new Webcaster.View.Controls
        model : Webcaster.controls
        el    : $("div.controls")

      playlistLeft : new Webcaster.View.Playlist
        model : new Webcaster.Model.Playlist({
          position    : "left"
          files       : []
          fileIndex   : -1
          passThrough :false
          loop        : true
        }, {
          controls : Webcaster.controls
          node     : Webcaster.node
        })
        el : $("div.playlist-left")

      playlistRight : new Webcaster.View.Playlist
        model : new Webcaster.Model.Playlist({
          position    : "right"
          files       : []
          fileIndex   : -1
          passThrough : false
          loop        : true
        }, {
          controls : Webcaster.controls
          node     : Webcaster.node
        })
        el : $("div.playlist-right")


  _.invoke Webcaster.views, "render"
