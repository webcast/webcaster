(function() {
  var Webcaster, getUserMedia,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  window.Webcaster = Webcaster = {
    View: {},
    Model: {},
    Source: {},
    prettifyTime: function(time) {
      var hours, minutes, result, seconds;
      hours = parseInt(time / 3600);
      time %= 3600;
      minutes = parseInt(time / 60);
      seconds = parseInt(time % 60);
      if (minutes < 10) minutes = "0" + minutes;
      if (seconds < 10) seconds = "0" + seconds;
      result = "" + minutes + ":" + seconds;
      if (hours > 0) result = "" + hours + ":" + result;
      return result;
    }
  };

  getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

  Webcaster.Node = (function() {

    _.extend(Node.prototype, Backbone.Events);

    function Node(_arg) {
      var _this = this;
      this.model = _arg.model;
      if (typeof webkitAudioContext !== "undefined") {
        this.context = new webkitAudioContext;
      } else {
        this.context = new AudioContext;
      }
      this.webcast = this.context.createWebcastSource(4096, 2);
      this.webcast.connect(this.context.destination);
      this.model.on("change:passThrough", function() {
        return _this.webcast.setPassThrough(_this.model.get("passThrough"));
      });
    }

    Node.prototype.startStream = function() {
      var encoder;
      switch (this.model.get("encoder")) {
        case "mp3":
          encoder = Webcast.Encoder.Mp3;
          break;
        case "raw":
          encoder = Webcast.Encoder.Raw;
      }
      this.encoder = new encoder({
        channels: this.model.get("channels"),
        samplerate: this.model.get("samplerate"),
        bitrate: this.model.get("bitrate")
      });
      if (this.model.get("samplerate") !== this.context.sampleRate) {
        this.encoder = new Webcast.Encoder.Resample({
          encoder: this.encoder,
          type: Samplerate.LINEAR,
          samplerate: this.context.sampleRate
        });
      }
      if (this.model.get("asynchronous")) {
        this.encoder = new Webcast.Encoder.Asynchronous({
          encoder: this.encoder,
          scripts: ["https://rawgithub.com/webcast/libsamplerate.js/master/dist/libsamplerate.js", "https://rawgithub.com/savonet/shine/master/js/dist/libshine.js", "https://rawgithub.com/webcast/webcast.js/master/lib/webcast.js"]
        });
      }
      return this.webcast.connectSocket(this.encoder, this.model.get("uri"));
    };

    Node.prototype.stopStream = function() {
      return this.webcast.close();
    };

    Node.prototype.createAudioSource = function(_arg, model, cb) {
      var audio, el, file,
        _this = this;
      file = _arg.file, audio = _arg.audio;
      el = new Audio(URL.createObjectURL(file));
      el.controls = false;
      el.autoplay = false;
      el.loop = false;
      el.addEventListener("ended", function() {
        return model.onEnd();
      });
      return el.addEventListener("canplay", function() {
        var source;
        source = _this.context.createMediaElementSource(el);
        source.play = function() {
          return el.play();
        };
        source.position = function() {
          return el.currentTime;
        };
        source.duration = function() {
          return el.duration;
        };
        source.paused = function() {
          return el.paused;
        };
        source.stop = function() {
          el.pause();
          return el.remove();
        };
        source.pause = function() {
          return el.pause();
        };
        source.seek = function(percent) {
          var time;
          time = percent * parseFloat(audio.length);
          el.currentTime = time;
          return time;
        };
        return cb(source);
      });
    };

    Node.prototype.createMadSource = function(file, model, cb) {
      var _this = this;
      return file.createMadDecoder(function(decoder, format) {
        var fn, source;
        source = _this.context.createMadSource(1024, decoder, format);
        source.play = function() {
          return source.start(0);
        };
        fn = source.stop;
        source.stop = function() {
          return fn.call(source, 0);
        };
        return cb(source);
      });
    };

    Node.prototype.createFileSource = function(file, model, cb) {
      var _ref;
      if ((_ref = this.source) != null) _ref.disconnect();
      if (/\.mp3$/i.test(file.name) && model.get("mad")) {
        return this.createMadSource(file, model, cb);
      } else {
        return this.createAudioSource(file, model, cb);
      }
    };

    Node.prototype.createMicrophoneSource = function(cb) {
      var _this = this;
      return getUserMedia.call(navigator, {
        audio: true,
        video: false
      }, function(stream) {
        var source;
        source = _this.context.createMediaStreamSource(stream);
        source.stop = function() {
          return stream.stop();
        };
        return cb(source);
      });
    };

    Node.prototype.sendMetadata = function(data) {
      return this.webcast.sendMetadata(data);
    };

    Node.prototype.close = function(cb) {
      return this.webcast.close(cb);
    };

    return Node;

  })();

  Webcaster.Model.Track = (function(_super) {

    __extends(Track, _super);

    function Track() {
      this.setTrackGain = __bind(this.setTrackGain, this);
      Track.__super__.constructor.apply(this, arguments);
    }

    Track.prototype.initialize = function(attributes, options) {
      var _this = this;
      this.node = options.node;
      this.mixer = options.mixer;
      this.mixer.on("cue", function() {
        return _this.set({
          passThrough: false
        });
      });
      this.on("change:trackGain", this.setTrackGain);
      this.on("ended", this.stop);
      return this.sink = this.node.webcast;
    };

    Track.prototype.togglePassThrough = function() {
      var passThrough;
      passThrough = this.get("passThrough");
      if (passThrough) {
        return this.set({
          passThrough: false
        });
      } else {
        this.mixer.trigger("cue");
        return this.set({
          passThrough: true
        });
      }
    };

    Track.prototype.isPlaying = function() {
      return this.source != null;
    };

    Track.prototype.createControlsNode = function() {
      var bufferLog, bufferSize, log10, source,
        _this = this;
      bufferSize = 4096;
      bufferLog = Math.log(parseFloat(bufferSize));
      log10 = 2.0 * Math.log(10);
      source = this.node.context.createScriptProcessor(bufferSize, 2, 2);
      source.onaudioprocess = function(buf) {
        var channel, channelData, i, ret, rms, volume, _ref, _ref2, _ref3, _results;
        ret = {};
        if (((_ref = _this.source) != null ? _ref.position : void 0) != null) {
          ret["position"] = _this.source.position();
        }
        _results = [];
        for (channel = 0, _ref2 = buf.inputBuffer.numberOfChannels - 1; 0 <= _ref2 ? channel <= _ref2 : channel >= _ref2; 0 <= _ref2 ? channel++ : channel--) {
          channelData = buf.inputBuffer.getChannelData(channel);
          rms = 0.0;
          for (i = 0, _ref3 = channelData.length - 1; 0 <= _ref3 ? i <= _ref3 : i >= _ref3; 0 <= _ref3 ? i++ : i--) {
            rms += Math.pow(channelData[i], 2);
          }
          volume = 100 * Math.exp((Math.log(rms) - bufferLog) / log10);
          if (channel === 0) {
            ret["volumeLeft"] = volume;
          } else {
            ret["volumeRight"] = volume;
          }
          _this.set(ret);
          _results.push(buf.outputBuffer.getChannelData(channel).set(channelData));
        }
        return _results;
      };
      return source;
    };

    Track.prototype.createPassThrough = function() {
      var source,
        _this = this;
      source = this.node.context.createScriptProcessor(8192, 2, 2);
      source.onaudioprocess = function(buf) {
        var channel, channelData, _ref, _results;
        channelData = buf.inputBuffer.getChannelData(channel);
        _results = [];
        for (channel = 0, _ref = buf.inputBuffer.numberOfChannels - 1; 0 <= _ref ? channel <= _ref : channel >= _ref; 0 <= _ref ? channel++ : channel--) {
          if (_this.get("passThrough")) {
            _results.push(buf.outputBuffer.getChannelData(channel).set(channelData));
          } else {
            _results.push(buf.outputBuffer.getChannelData(channel).set(new Float32Array(channelData.length)));
          }
        }
        return _results;
      };
      return source;
    };

    Track.prototype.setTrackGain = function() {
      if (this.trackGain == null) return;
      return this.trackGain.gain.value = parseFloat(this.get("trackGain")) / 100.0;
    };

    Track.prototype.prepare = function() {
      this.controlsNode = this.createControlsNode();
      this.controlsNode.connect(this.sink);
      this.trackGain = this.node.context.createGain();
      this.trackGain.connect(this.controlsNode);
      this.setTrackGain();
      this.destination = this.trackGain;
      this.passThrough = this.createPassThrough();
      this.passThrough.connect(this.node.context.destination);
      return this.destination.connect(this.passThrough);
    };

    Track.prototype.togglePause = function() {
      var _ref, _ref2;
      if (((_ref = this.source) != null ? _ref.pause : void 0) == null) return;
      if ((_ref2 = this.source) != null ? typeof _ref2.paused === "function" ? _ref2.paused() : void 0 : void 0) {
        this.source.play();
        return this.trigger("playing");
      } else {
        this.source.pause();
        return this.trigger("paused");
      }
    };

    Track.prototype.stop = function() {
      var _ref, _ref2, _ref3, _ref4, _ref5;
      if ((_ref = this.source) != null) {
        if (typeof _ref.stop === "function") _ref.stop();
      }
      if ((_ref2 = this.source) != null) _ref2.disconnect();
      if ((_ref3 = this.trackGain) != null) _ref3.disconnect();
      if ((_ref4 = this.controlsNode) != null) _ref4.disconnect();
      if ((_ref5 = this.passThrough) != null) _ref5.disconnect();
      this.source = this.trackGain = this.controlsNode = this.passThrough = null;
      this.set({
        position: 0.0
      });
      return this.trigger("stopped");
    };

    Track.prototype.seek = function(percent) {
      var position, _ref;
      if (!(position = (_ref = this.source) != null ? typeof _ref.seek === "function" ? _ref.seek(percent) : void 0 : void 0)) {
        return;
      }
      return this.set({
        position: position
      });
    };

    Track.prototype.sendMetadata = function(file) {
      return this.node.sendMetadata(file.metadata);
    };

    return Track;

  })(Backbone.Model);

  Webcaster.Model.Microphone = (function(_super) {

    __extends(Microphone, _super);

    function Microphone() {
      Microphone.__super__.constructor.apply(this, arguments);
    }

    Microphone.prototype.play = function() {
      var _this = this;
      this.prepare();
      return this.node.createMicrophoneSource(function(source) {
        _this.source = source;
        source.connect(_this.destination);
        return _this.trigger("playing");
      });
    };

    return Microphone;

  })(Webcaster.Model.Track);

  Webcaster.Model.Mixer = (function(_super) {

    __extends(Mixer, _super);

    function Mixer() {
      Mixer.__super__.constructor.apply(this, arguments);
    }

    Mixer.prototype.getLeftVolume = function() {
      return 1.0 - this.getRightVolume();
    };

    Mixer.prototype.getRightVolume = function() {
      return parseFloat(this.get("slider")) / 100.00;
    };

    return Mixer;

  })(Backbone.Model);

  Webcaster.Model.Playlist = (function(_super) {

    __extends(Playlist, _super);

    function Playlist() {
      this.setMixGain = __bind(this.setMixGain, this);
      Playlist.__super__.constructor.apply(this, arguments);
    }

    Playlist.prototype.initialize = function() {
      Playlist.__super__.initialize.apply(this, arguments);
      this.mixer.on("change:slider", this.setMixGain);
      this.mixGain = this.node.context.createGain();
      this.mixGain.connect(this.node.webcast);
      return this.sink = this.mixGain;
    };

    Playlist.prototype.setMixGain = function() {
      if (this.mixGain == null) return;
      if (this.get("side") === "left") {
        return this.mixGain.gain.value = this.mixer.getLeftVolume();
      } else {
        return this.mixGain.gain.value = this.mixer.getRightVolume();
      }
    };

    Playlist.prototype.appendFiles = function(newFiles, cb) {
      var addFile, files, i, onDone, _ref, _results,
        _this = this;
      files = this.get("files");
      onDone = _.after(newFiles.length, function() {
        _this.set({
          files: files
        });
        return typeof cb === "function" ? cb() : void 0;
      });
      addFile = function(file) {
        var _this = this;
        return file.readTaglibMetadata(function(data) {
          files.push({
            file: file,
            audio: data.audio,
            metadata: data.metadata
          });
          return onDone();
        });
      };
      _results = [];
      for (i = 0, _ref = newFiles.length - 1; 0 <= _ref ? i <= _ref : i >= _ref; 0 <= _ref ? i++ : i--) {
        _results.push(addFile(newFiles[i]));
      }
      return _results;
    };

    Playlist.prototype.selectFile = function(options) {
      var file, files, index;
      if (options == null) options = {};
      files = this.get("files");
      index = this.get("fileIndex");
      if (files.length === 0) return;
      index += options.backward ? -1 : 1;
      if (index < 0 || index >= files.length) {
        if (!this.get("loop")) return;
        if (index < 0) {
          index = files.length - 1;
        } else {
          index = 0;
        }
      }
      file = files[index];
      this.set({
        fileIndex: index
      });
      return file;
    };

    Playlist.prototype.play = function(file) {
      var _this = this;
      this.prepare();
      this.setMixGain();
      return this.node.createFileSource(file, this, function(source) {
        _this.source = source;
        source.connect(_this.destination);
        if (_this.source.duration != null) {
          _this.set({
            duration: _this.source.duration()
          });
        }
        source.play(file);
        return _this.trigger("playing");
      });
    };

    Playlist.prototype.onEnd = function() {
      this.stop();
      if (this.get("loop")) return this.play(this.selectFile());
    };

    return Playlist;

  })(Webcaster.Model.Track);

  Webcaster.Model.Settings = (function(_super) {

    __extends(Settings, _super);

    function Settings() {
      Settings.__super__.constructor.apply(this, arguments);
    }

    Settings.prototype.initialize = function(attributes, options) {
      var _this = this;
      this.mixer = options.mixer;
      return this.mixer.on("cue", function() {
        return _this.set({
          passThrough: false
        });
      });
    };

    Settings.prototype.togglePassThrough = function() {
      var passThrough;
      passThrough = this.get("passThrough");
      if (passThrough) {
        return this.set({
          passThrough: false
        });
      } else {
        this.mixer.trigger("cue");
        return this.set({
          passThrough: true
        });
      }
    };

    return Settings;

  })(Backbone.Model);

  Webcaster.View.Track = (function(_super) {

    __extends(Track, _super);

    function Track() {
      Track.__super__.constructor.apply(this, arguments);
    }

    Track.prototype.initialize = function() {
      var _this = this;
      this.model.on("change:passThrough", function() {
        if (_this.model.get("passThrough")) {
          return _this.$(".passThrough").addClass("btn-cued").removeClass("btn-info");
        } else {
          return _this.$(".passThrough").addClass("btn-info").removeClass("btn-cued");
        }
      });
      this.model.on("change:volumeLeft", function() {
        return _this.$(".volume-left").width("" + (_this.model.get("volumeLeft")) + "%");
      });
      return this.model.on("change:volumeRight", function() {
        return _this.$(".volume-right").width("" + (_this.model.get("volumeRight")) + "%");
      });
    };

    Track.prototype.onPassThrough = function(e) {
      e.preventDefault();
      return this.model.togglePassThrough();
    };

    Track.prototype.onSubmit = function(e) {
      return e.preventDefault();
    };

    return Track;

  })(Backbone.View);

  Webcaster.View.Microphone = (function(_super) {

    __extends(Microphone, _super);

    function Microphone() {
      Microphone.__super__.constructor.apply(this, arguments);
    }

    Microphone.prototype.events = {
      "click .record-audio": "onRecord",
      "click .passThrough": "onPassThrough",
      "submit": "onSubmit"
    };

    Microphone.prototype.initialize = function() {
      var _this = this;
      Microphone.__super__.initialize.apply(this, arguments);
      this.model.on("playing", function() {
        _this.$(".play-control").removeAttr("disabled");
        _this.$(".record-audio").addClass("btn-recording");
        _this.$(".volume-left").width("0%");
        return _this.$(".volume-right").width("0%");
      });
      return this.model.on("stopped", function() {
        _this.$(".record-audio").removeClass("btn-recording");
        _this.$(".volume-left").width("0%");
        return _this.$(".volume-right").width("0%");
      });
    };

    Microphone.prototype.render = function() {
      var _this = this;
      this.$(".microphone-slider").slider({
        orientation: "vertical",
        min: 0,
        max: 150,
        value: 100,
        stop: function() {
          return _this.$("a.ui-slider-handle").tooltip("hide");
        },
        slide: function(e, ui) {
          _this.model.set({
            trackGain: ui.value
          });
          return _this.$("a.ui-slider-handle").tooltip("show");
        }
      });
      this.$("a.ui-slider-handle").tooltip({
        title: function() {
          return _this.model.get("trackGain");
        },
        trigger: "",
        animation: false,
        placement: "left"
      });
      return this;
    };

    Microphone.prototype.onRecord = function(e) {
      e.preventDefault();
      if (this.model.isPlaying()) return this.model.stop();
      this.$(".play-control").attr({
        disabled: "disabled"
      });
      return this.model.play();
    };

    return Microphone;

  })(Webcaster.View.Track);

  Webcaster.View.Mixer = (function(_super) {

    __extends(Mixer, _super);

    function Mixer() {
      Mixer.__super__.constructor.apply(this, arguments);
    }

    Mixer.prototype.render = function() {
      var _this = this;
      this.$(".slider").slider({
        stop: function() {
          return _this.$("a.ui-slider-handle").tooltip("hide");
        },
        slide: function(e, ui) {
          _this.model.set({
            slider: ui.value
          });
          return _this.$("a.ui-slider-handle").tooltip("show");
        }
      });
      this.$("a.ui-slider-handle").tooltip({
        title: function() {
          return _this.model.get("slider");
        },
        trigger: "",
        animation: false,
        placement: "bottom"
      });
      return this;
    };

    return Mixer;

  })(Backbone.View);

  Webcaster.View.Playlist = (function(_super) {

    __extends(Playlist, _super);

    function Playlist() {
      Playlist.__super__.constructor.apply(this, arguments);
    }

    Playlist.prototype.events = {
      "click .play-audio": "onPlay",
      "click .pause-audio": "onPause",
      "click .previous": "onPrevious",
      "click .next": "onNext",
      "click .stop": "onStop",
      "click .progress-seek": "onSeek",
      "click .passThrough": "onPassThrough",
      "change .files": "onFiles",
      "change .loop": "onLoop",
      "submit": "onSubmit"
    };

    Playlist.prototype.initialize = function() {
      var _this = this;
      Playlist.__super__.initialize.apply(this, arguments);
      this.model.on("change:fileIndex", function() {
        _this.$(".track-row").removeClass("success");
        return _this.$(".track-row-" + (_this.model.get("fileIndex"))).addClass("success");
      });
      this.model.on("playing", function() {
        _this.$(".play-control").removeAttr("disabled");
        _this.$(".play-audio").hide();
        _this.$(".pause-audio").show();
        _this.$(".track-position-text").removeClass("blink").text("");
        _this.$(".volume-left").width("0%");
        _this.$(".volume-right").width("0%");
        if (_this.model.get("duration")) {
          return _this.$(".progress-volume").css("cursor", "pointer");
        } else {
          return _this.$(".track-position").addClass("progress-striped active").width("100%");
        }
      });
      this.model.on("paused", function() {
        _this.$(".play-audio").show();
        _this.$(".pause-audio").hide();
        _this.$(".volume-left").width("0%");
        _this.$(".volume-right").width("0%");
        return _this.$(".track-position-text").addClass("blink");
      });
      this.model.on("stopped", function() {
        _this.$(".play-audio").show();
        _this.$(".pause-audio").hide();
        _this.$(".progress-volume").css("cursor", "");
        _this.$(".track-position").removeClass("progress-striped active").width("0%");
        _this.$(".track-position-text").removeClass("blink").text("");
        _this.$(".volume-left").width("0%");
        return _this.$(".volume-right").width("0%");
      });
      this.model.on("change:position", function() {
        var duration, position;
        if (!(duration = _this.model.get("duration"))) return;
        position = parseFloat(_this.model.get("position"));
        _this.$(".track-position").width("" + (100.0 * position / parseFloat(duration)) + "%");
        return _this.$(".track-position-text").text("" + (Webcaster.prettifyTime(position)) + " / " + (Webcaster.prettifyTime(duration)));
      });
      if ((new Audio).canPlayType("audio/mpeg") === "") {
        return this.model.set({
          mad: true
        });
      }
    };

    Playlist.prototype.render = function() {
      var files,
        _this = this;
      this.$(".volume-slider").slider({
        orientation: "vertical",
        min: 0,
        max: 150,
        value: 100,
        stop: function() {
          return _this.$("a.ui-slider-handle").tooltip("hide");
        },
        slide: function(e, ui) {
          _this.model.set({
            trackGain: ui.value
          });
          return _this.$("a.ui-slider-handle").tooltip("show");
        }
      });
      this.$("a.ui-slider-handle").tooltip({
        title: function() {
          return _this.model.get("trackGain");
        },
        trigger: "",
        animation: false,
        placement: "left"
      });
      files = this.model.get("files");
      this.$(".files-table").empty();
      if (!(files.length > 0)) return this;
      _.each(files, function(_arg, index) {
        var audio, file, klass, metadata, time;
        file = _arg.file, audio = _arg.audio, metadata = _arg.metadata;
        if ((audio != null ? audio.length : void 0) !== 0) {
          time = Webcaster.prettifyTime(audio.length);
        } else {
          time = "N/A";
        }
        if (_this.model.get("fileIndex") === index) {
          klass = "success";
        } else {
          klass = "";
        }
        return _this.$(".files-table").append("<tr class='track-row track-row-" + index + " " + klass + "'>\n  <td>" + (index + 1) + "</td>\n  <td>" + metadata.title + "</td>\n  <td>" + metadata.artist + "</td>\n  <td>" + time + "</td>\n</tr>");
      });
      this.$(".playlist-table").show();
      return this;
    };

    Playlist.prototype.play = function(options) {
      if (this.model.isPlaying()) {
        this.model.togglePause();
        return;
      }
      if (!(this.file = this.model.selectFile(options))) return;
      this.$(".play-control").attr({
        disabled: "disabled"
      });
      return this.model.play(this.file);
    };

    Playlist.prototype.onPlay = function(e) {
      e.preventDefault();
      return this.play();
    };

    Playlist.prototype.onPause = function(e) {
      e.preventDefault();
      return this.model.togglePause();
    };

    Playlist.prototype.onPrevious = function(e) {
      e.preventDefault();
      if (this.file == null) return;
      return this.play({
        backward: true
      });
    };

    Playlist.prototype.onNext = function(e) {
      e.preventDefault();
      if (this.file == null) return;
      return this.play();
    };

    Playlist.prototype.onStop = function(e) {
      e.preventDefault();
      this.$(".track-row").removeClass("success");
      this.model.stop();
      return this.file = null;
    };

    Playlist.prototype.onSeek = function(e) {
      e.preventDefault();
      return this.model.seek((e.pageX - $(e.target).offset().left) / $(e.target).width());
    };

    Playlist.prototype.onFiles = function() {
      var files,
        _this = this;
      files = this.$(".files")[0].files;
      this.$(".files").attr({
        disabled: "disabled"
      });
      return this.model.appendFiles(files, function() {
        _this.$(".files").removeAttr("disabled").val("");
        return _this.render();
      });
    };

    Playlist.prototype.onLoop = function(e) {
      return this.model.set({
        loop: $(e.target).is(":checked")
      });
    };

    return Playlist;

  })(Webcaster.View.Track);

  Webcaster.View.Settings = (function(_super) {

    __extends(Settings, _super);

    function Settings() {
      Settings.__super__.constructor.apply(this, arguments);
    }

    Settings.prototype.events = {
      "change .uri": "onUri",
      "change input.encoder": "onEncoder",
      "change input.channels": "onChannels",
      "change .samplerate": "onSamplerate",
      "change .bitrate": "onBitrate",
      "change .mono": "onMono",
      "change .asynchronous": "onAsynchronous",
      "click .passThrough": "onPassThrough",
      "click .start-stream": "onStart",
      "click .stop-stream": "onStop",
      "submit": "onSubmit"
    };

    Settings.prototype.initialize = function(_arg) {
      var _this = this;
      this.node = _arg.node;
      return this.model.on("change:passThrough", function() {
        if (_this.model.get("passThrough")) {
          return _this.$(".passThrough").addClass("btn-cued").removeClass("btn-info");
        } else {
          return _this.$(".passThrough").addClass("btn-info").removeClass("btn-cued");
        }
      });
    };

    Settings.prototype.render = function() {
      var bitrate, samplerate,
        _this = this;
      samplerate = this.model.get("samplerate");
      this.$(".samplerate").empty();
      _.each(this.model.get("samplerates"), function(rate) {
        var selected;
        selected = samplerate === rate ? "selected" : "";
        return $("<option value='" + rate + "' " + selected + ">" + rate + "</option>").appendTo(_this.$(".samplerate"));
      });
      bitrate = this.model.get("bitrate");
      this.$(".bitrate").empty();
      _.each(this.model.get("bitrates"), function(rate) {
        var selected;
        selected = bitrate === rate ? "selected" : "";
        return $("<option value='" + rate + "' " + selected + ">" + rate + "</option>").appendTo(_this.$(".bitrate"));
      });
      return this;
    };

    Settings.prototype.onUri = function() {
      return this.model.set({
        uri: this.$(".uri").val()
      });
    };

    Settings.prototype.onEncoder = function(e) {
      return this.model.set({
        encoder: $(e.target).val()
      });
    };

    Settings.prototype.onChannels = function(e) {
      return this.model.set({
        channels: parseInt($(e.target).val())
      });
    };

    Settings.prototype.onSamplerate = function(e) {
      return this.model.set({
        samplerate: parseInt($(e.target).val())
      });
    };

    Settings.prototype.onBitrate = function(e) {
      return this.model.set({
        bitrate: parseInt($(e.target).val())
      });
    };

    Settings.prototype.onAsynchronous = function(e) {
      return this.model.set({
        asynchronous: $(e.target).is(":checked")
      });
    };

    Settings.prototype.onPassThrough = function(e) {
      e.preventDefault();
      return this.model.togglePassThrough();
    };

    Settings.prototype.onStart = function(e) {
      e.preventDefault();
      this.$(".stop-stream").show();
      this.$(".start-stream").hide();
      this.$("input, select").attr({
        disabled: "disabled"
      });
      return this.node.startStream();
    };

    Settings.prototype.onStop = function(e) {
      e.preventDefault();
      this.$(".stop-stream").hide();
      this.$(".start-stream").show();
      this.$("input, select").removeAttr("disabled");
      return this.node.stopStream();
    };

    Settings.prototype.onSubmit = function(e) {
      return e.preventDefault();
    };

    return Settings;

  })(Backbone.View);

  $(function() {
    Webcaster.mixer = new Webcaster.Model.Mixer({
      slider: 0
    });
    Webcaster.settings = new Webcaster.Model.Settings({
      uri: "ws://localhost:8080/mount",
      bitrate: 128,
      bitrates: [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256, 320],
      samplerate: 44100,
      samplerates: [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000],
      channels: 2,
      encoder: "mp3",
      asynchronous: true,
      passThrough: false,
      mad: false
    }, {
      mixer: Webcaster.mixer
    });
    Webcaster.node = new Webcaster.Node({
      model: Webcaster.settings
    });
    _.extend(Webcaster, {
      views: {
        settings: new Webcaster.View.Settings({
          model: Webcaster.settings,
          node: Webcaster.node,
          el: $("div.settings")
        }),
        mixer: new Webcaster.View.Mixer({
          model: Webcaster.mixer,
          el: $("div.mixer")
        }),
        microphone: new Webcaster.View.Microphone({
          model: new Webcaster.Model.Microphone({
            passThrough: false
          }, {
            mixer: Webcaster.mixer,
            node: Webcaster.node
          }),
          el: $("div.microphone")
        }),
        playlistLeft: new Webcaster.View.Playlist({
          model: new Webcaster.Model.Playlist({
            side: "left",
            files: [],
            fileIndex: -1,
            volumeLeft: 0,
            volumeRight: 0,
            trackGain: 100,
            passThrough: false,
            position: 0.0,
            loop: true
          }, {
            mixer: Webcaster.mixer,
            node: Webcaster.node
          }),
          el: $("div.playlist-left")
        }),
        playlistRight: new Webcaster.View.Playlist({
          model: new Webcaster.Model.Playlist({
            side: "right",
            files: [],
            fileIndex: -1,
            volumeLeft: 0,
            volumeRight: 0,
            trackGain: 100,
            passThrough: false,
            position: 0.0,
            loop: true
          }, {
            mixer: Webcaster.mixer,
            node: Webcaster.node
          }),
          el: $("div.playlist-right")
        })
      }
    });
    return _.invoke(Webcaster.views, "render");
  });

}).call(this);
