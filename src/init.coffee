$ ->
  Webcaster.mixer = new Webcaster.Model.Mixer
    slider: 0

  enabledMimeTypes = (types) =>
    _.filter types, ({value}) =>
      MediaRecorder.isTypeSupported value

  audioMimeTypes = enabledMimeTypes [
    { name: "Opus audio", value: "audio/webm;codecs=opus"}
  ]
  videoMimeTypes = enabledMimeTypes [
    { name: "Opus audio/h264 video", value: "video/webm;codecs=h264,opus"},
    { name: "Opus audio/vp9 video", value: "video/webm;codecs=vp9,opus"},
    { name: "Opus audio/vp8 video", value: "video/webm;codecs=vp8,opus"}
  ]

  Webcaster.settings = new Webcaster.Model.Settings({
    url:            "ws://source:hackme@localhost:8080/mount"
    audioBitrate:   128
    audioBitrates:  [ 8, 16, 24, 32, 40, 48, 56,
                      64, 80, 96, 112, 128, 144,
                      160, 192, 224, 256, 320 ]
    videoBitrate:   2.5
    videoBitrates:  [ 2.5, 3.5, 5, 7, 10]
    samplerate:     44100
    samplerates:    [ 8000, 11025, 12000, 16000,
                     22050, 24000, 32000, 44100, 48000 ]
    channels:       2
    mimeTypes:      audioMimeTypes
    audioMimeTypes: audioMimeTypes
    videoMimeTypes: videoMimeTypes
    mimeType:       audioMimeTypes[0]?.value
    passThrough:    false
    camera:         false
    streaming:      false
    playing:        0
  }, {
    mixer: Webcaster.mixer
  })

  Webcaster.node = new Webcaster.Node
    model: Webcaster.settings

  _.extend Webcaster,
    views:
      settings : new Webcaster.View.Settings
        model : Webcaster.settings
        node  : Webcaster.node
        el    : $("div.settings")

      mixer: new Webcaster.View.Mixer
        model : Webcaster.mixer
        el    : $("div.mixer")

      microphone: new Webcaster.View.Microphone
        model: new Webcaster.Model.Microphone({
          trackGain   : 100
          passThrough : false
        }, {
          mixer: Webcaster.mixer
          node:  Webcaster.node
        })
        el: $("div.microphone")

      camera: new Webcaster.View.Camera
        model: Webcaster.settings
        el: $("div.camera")

      playlistLeft : new Webcaster.View.Playlist
        model : new Webcaster.Model.Playlist({
          side        : "left"
          files       : []
          fileIndex   : -1
          volumeLeft  : 0
          volumeRight : 0
          trackGain   : 100
          passThrough : false
          playThrough : true
          position    : 0.0
          loop        : false
        }, {
          mixer : Webcaster.mixer
          node  : Webcaster.node
        })
        el : $("div.playlist-left")

      playlistRight : new Webcaster.View.Playlist
        model : new Webcaster.Model.Playlist({
          side        : "right"
          files       : []
          fileIndex   : -1
          volumeLeft  : 0
          volumeRight : 0
          trackGain   : 100
          passThrough : false
          playThrough : true
          position    : 0.0
          loop        : false
        }, {
          mixer : Webcaster.mixer
          node  : Webcaster.node
        })
        el : $("div.playlist-right")


  _.invoke Webcaster.views, "render"
