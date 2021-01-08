class Webcaster.View.Camera extends Backbone.View
  events:
    "change .enable-camera": "onEnableCamera"

  initialize: ->
    super arguments...

    @model.on "change:camera", =>
      if @model.get("camera")
        navigator.mediaDevices.getUserMedia({audio:false, video:true}).then (stream) =>
          @$(".camera-preview").get(0).srcObject = stream
          @$(".camera-preview").get(0).play()
          @model.set "mimeType", @model.get("videoMimeTypes")[0]?.value
          @model.set "mimeTypes", @model.get("videoMimeTypes")
      else
        @$(".camera-preview").get(0).srcObject = null
        @model.set "mimeType", @model.get("audioMimeTypes")[0]?.value
        @model.set "mimeTypes", @model.get("audioMimeTypes")

  render: ->
    navigator.mediaDevices.getUserMedia({audio:false, video:true}).then =>
      @$(".camera-settings").show()

    this

  onEnableCamera: (e) ->
    e.preventDefault()

    @model.set camera: $(e.target).is(":checked")
