class Webcaster.Model.Mixer extends Backbone.Model
  getLeftVolume: ->
    1.0 - @getRightVolume()
    
  getRightVolume: ->
    parseFloat(@get("slider"))/100.00
