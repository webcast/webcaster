class Webcaster.Source.AudioElement extends Webcaster.Source
  prepare: ({file}, cb) ->
    super
    @audio?.pause()
    @audio?.remove()

    @audio = new Audio URL.createObjectURL(file)
    @audio.controls = false
    @audio.autoplay = false
    @audio.loop     = false

    @audio.addEventListener "ended", =>
      @trigger "ended"

    @audio.addEventListener "canplay", =>
      @source = @context.createMediaElementSource @audio
      cb()

  play: ->
    super
    @audio.play()

  stop: ->
    super
    @audio?.pause()
    @audio?.remove()

  close: ->
    super
    @audio = null
