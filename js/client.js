(function() {
  var Webcaster, createPassThrough, createVolumeMeter,
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
      seconds = time % 60;
      if (minutes < 10) minutes = "0" + minutes;
      if (seconds < 10) seconds = "0" + seconds;
      result = "" + minutes + ":" + seconds;
      if (hours > 0) result = "" + hours + ":" + result;
      return result;
    }
  };

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

    Node.prototype.createAudioSource = function(file, cb) {
      var audio,
        _this = this;
      if (typeof audio !== "undefined" && audio !== null) audio.pause();
      if (typeof audio !== "undefined" && audio !== null) audio.remove();
      audio = new Audio(URL.createObjectURL(file));
      audio.controls = false;
      audio.autoplay = false;
      audio.loop = false;
      audio.addEventListener("ended", function() {});
      return audio.addEventListener("canplay", function() {
        var source;
        source = _this.context.createMediaElementSource(audio);
        source.play = function() {
          return audio.play();
        };
        source.stop = function() {
          audio.pause();
          return audio.remove();
        };
        return cb(source);
      });
    };

    Node.prototype.createMadSource = function(file, cb) {
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

    Node.prototype.createSource = function(_arg, mad, cb) {
      var file, _ref;
      file = _arg.file;
      if ((_ref = this.source) != null) _ref.disconnect();
      if (/\.mp3$/i.test(file.name) && mad) {
        return this.createMadSource(file, cb);
      } else {
        return this.createAudioSource(file, cb);
      }
    };

    Node.prototype.sendMetadata = function(data) {
      return this.webcast.sendMetadata(data);
    };

    Node.prototype.close = function(cb) {
      return this.webcast.close(cb);
    };

    return Node;

  })();

  Webcaster.Model.Controls = (function(_super) {

    __extends(Controls, _super);

    function Controls() {
      Controls.__super__.constructor.apply(this, arguments);
    }

    return Controls;

  })(Backbone.Model);

  createVolumeMeter = function(context, model) {
    var bufferLog, bufferSize, log10, source;
    bufferSize = 4096;
    bufferLog = Math.log(parseFloat(bufferSize));
    log10 = 2.0 * Math.log(10);
    source = context.createScriptProcessor(bufferSize, 2, 2);
    source.onaudioprocess = function(buf) {
      var channel, channelData, i, label, rms, _ref, _ref2, _results;
      _results = [];
      for (channel = 0, _ref = buf.inputBuffer.numberOfChannels - 1; 0 <= _ref ? channel <= _ref : channel >= _ref; 0 <= _ref ? channel++ : channel--) {
        channelData = buf.inputBuffer.getChannelData(channel);
        if (channel === 0) {
          label = "volumeLeft";
        } else {
          label = "volumeRight";
        }
        rms = 0.0;
        for (i = 0, _ref2 = channelData.length - 1; 0 <= _ref2 ? i <= _ref2 : i >= _ref2; 0 <= _ref2 ? i++ : i--) {
          rms += Math.pow(channelData[i], 2);
        }
        model.set(label, 100 * Math.exp((Math.log(rms) - bufferLog) / log10));
        _results.push(buf.outputBuffer.getChannelData(channel).set(channelData));
      }
      return _results;
    };
    return source;
  };

  createPassThrough = function(context, model) {
    var source;
    source = context.createScriptProcessor(8192, 2, 2);
    source.onaudioprocess = function(buf) {
      var channel, channelData, _ref, _results;
      channelData = buf.inputBuffer.getChannelData(channel);
      _results = [];
      for (channel = 0, _ref = buf.inputBuffer.numberOfChannels - 1; 0 <= _ref ? channel <= _ref : channel >= _ref; 0 <= _ref ? channel++ : channel--) {
        if (model.get("passThrough")) {
          _results.push(buf.outputBuffer.getChannelData(channel).set(channelData));
        } else {
          _results.push(buf.outputBuffer.getChannelData(channel).set(new Float32Array(channelData.length)));
        }
      }
      return _results;
    };
    return source;
  };

  Webcaster.Model.Playlist = (function(_super) {

    __extends(Playlist, _super);

    function Playlist() {
      Playlist.__super__.constructor.apply(this, arguments);
    }

    Playlist.prototype.initialize = function(attributes, options) {
      this.node = options.node;
      this.controls = options.controls;
      this.gain = this.node.context.createGain();
      this.gain.connect(this.node.webcast);
      this.vuMeter = createVolumeMeter(this.node.context, this);
      this.vuMeter.connect(this.gain);
      this.destination = this.vuMeter;
      this.passThrough = createPassThrough(this.node.context, this);
      this.passThrough.connect(this.node.context.destination);
      this.destination.connect(this.passThrough);
      this.listenTo(this.controls, "change:slider", this.setGain);
      return this.setGain();
    };

    Playlist.prototype.setGain = function(slider) {
      slider = parseFloat(this.controls.get("slider"));
      if (this.get("position") === "left") {
        return this.gain.gain.value = 1.0 - slider / 100.0;
      } else {
        return this.gain.gain.value = slider / 100.0;
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

    Playlist.prototype.play = function(file, cb) {
      var _this = this;
      this.stop();
      return this.node.createSource(file, this.get("mad"), function(source) {
        _this.source = source;
        source.connect(_this.destination);
        source.play(file);
        return cb();
      });
    };

    Playlist.prototype.stop = function() {
      var _ref, _ref2;
      if ((_ref = this.source) != null) _ref.stop();
      return (_ref2 = this.source) != null ? _ref2.disconnect() : void 0;
    };

    Playlist.prototype.sendMetadata = function(file) {
      return this.node.sendMetadata(file.metadata);
    };

    return Playlist;

  })(Backbone.Model);

  Webcaster.Model.Settings = (function(_super) {

    __extends(Settings, _super);

    function Settings() {
      Settings.__super__.constructor.apply(this, arguments);
    }

    return Settings;

  })(Backbone.Model);

  Webcaster.View.Controls = (function(_super) {

    __extends(Controls, _super);

    function Controls() {
      Controls.__super__.constructor.apply(this, arguments);
    }

    Controls.prototype.render = function() {
      var _this = this;
      this.$(".slider").slider({
        slide: function(e, ui) {
          return _this.model.set({
            slider: ui.value
          });
        }
      });
      return this;
    };

    return Controls;

  })(Backbone.View);

  Webcaster.View.Playlist = (function(_super) {

    __extends(Playlist, _super);

    function Playlist() {
      Playlist.__super__.constructor.apply(this, arguments);
    }

    Playlist.prototype.events = {
      "click .record-audio": "onRecord",
      "click .play-audio": "onPlay",
      "click .previous": "onPrevious",
      "click .next": "onNext",
      "click .stop": "onStop",
      "click .metadata": "onMetadata",
      "change .files": "onFiles",
      "change .passThrough": "onPassThrough",
      "change .loop": "onLoop",
      "submit": "onSubmit"
    };

    Playlist.prototype.initialize = function() {
      var _this = this;
      this.listenTo(Webcaster.node, "ended", function() {
        this.$(".track-row").removeClass("success");
        if (!this.model.get("loop")) return;
        return this.play();
      });
      this.model.on("change:fileIndex", function() {
        _this.$(".track-row").removeClass("success");
        return _this.$(".track-row-" + (_this.model.get("fileIndex"))).addClass("success");
      });
      this.model.on("change:volumeLeft", function() {
        return _this.$(".volume-left").width("" + (_this.model.get("volumeLeft")) + "%");
      });
      this.model.on("change:volumeRight", function() {
        return _this.$(".volume-right").width("" + (_this.model.get("volumeRight")) + "%");
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
      files = this.model.get("files");
      this.$(".files-table").empty();
      if (!(files.length > 0)) return;
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

    Playlist.prototype.onRecord = function() {};

    Playlist.prototype.play = function(options) {
      var _this = this;
      this.file = this.model.selectFile(options);
      this.$(".play-control").attr({
        disabled: "disabled"
      });
      return this.model.play(this.file, function() {
        return _this.$(".play-control").removeAttr("disabled");
      });
    };

    Playlist.prototype.onPlay = function(e) {
      e.preventDefault();
      return this.play();
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

    Playlist.prototype.onMetadata = function(e) {
      e.preventDefault();
      if (this.file == null) return;
      return this.model.sendMetadata(this.file);
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

    Playlist.prototype.onPassThrough = function(e) {
      return this.model.set({
        passThrough: $(e.target).is(":checked")
      });
    };

    Playlist.prototype.onLoop = function(e) {
      return this.model.set({
        loop: $(e.target).is(":checked")
      });
    };

    Playlist.prototype.onSubmit = function(e) {
      return e.preventDefault();
    };

    return Playlist;

  })(Backbone.View);

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
      "change .passThrough": "onPassThrough",
      "click .start-stream": "onStart",
      "click .stop-stream": "onStop",
      "submit": "onSubmit"
    };

    Settings.prototype.initialize = function(_arg) {
      this.node = _arg.node;
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
      return this.model.set({
        passThrough: $(e.target).is(":checked")
      });
    };

    Settings.prototype.onStart = function(e) {
      e.preventDefault();
      this.$(".stop-stream").show();
      this.$(".start-stream").hide();
      this.$("input").attr({
        disabled: "disabled"
      });
      this.$("input.passThrough").removeAttr("disabled");
      return this.node.startStream();
    };

    Settings.prototype.onStop = function(e) {
      e.preventDefault();
      this.$(".stop-stream").hide();
      this.$(".start-stream").show();
      this.$("input").removeAttr("disabled");
      return this.node.stopStream();
    };

    Settings.prototype.onSubmit = function(e) {
      return e.preventDefault();
    };

    return Settings;

  })(Backbone.View);

  $(function() {
    Webcaster.settings = new Webcaster.Model.Settings({
      uri: "ws://localhost:8080/mount",
      bitrate: 128,
      bitrates: [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256, 320],
      samplerate: 44100,
      samplerates: [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000],
      channels: 2,
      encoder: "mp3",
      asynchronous: false,
      passThrough: false,
      mad: false
    });
    Webcaster.controls = new Webcaster.Model.Controls({
      slider: 0
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
        controls: new Webcaster.View.Controls({
          model: Webcaster.controls,
          el: $("div.controls")
        }),
        playlistLeft: new Webcaster.View.Playlist({
          model: new Webcaster.Model.Playlist({
            position: "left",
            files: [],
            fileIndex: -1,
            volumeLeft: 0,
            volumeRight: 0,
            passThrough: false,
            loop: true
          }, {
            controls: Webcaster.controls,
            node: Webcaster.node
          }),
          el: $("div.playlist-left")
        }),
        playlistRight: new Webcaster.View.Playlist({
          model: new Webcaster.Model.Playlist({
            position: "right",
            files: [],
            fileIndex: -1,
            volumeLeft: 0,
            volumeRight: 0,
            passThrough: false,
            loop: true
          }, {
            controls: Webcaster.controls,
            node: Webcaster.node
          }),
          el: $("div.playlist-right")
        })
      }
    });
    return _.invoke(Webcaster.views, "render");
  });

}).call(this);
