(function() {
  var Webcaster,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  window.Webcaster = Webcaster = {
    View: {},
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

  Webcaster.Model = (function(_super) {

    __extends(Model, _super);

    function Model(attributes, options) {
      attributes || (attributes = {});
      attributes = _.defaults(attributes, {
        files: [],
        fileIndex: -1,
        position: 0.0,
        uri: "ws://localhost:8080/mount",
        bitrate: 128,
        bitrates: [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256, 320],
        samplerate: 44100,
        samplerates: [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000],
        channels: 2,
        encoder: "mp3",
        passThrough: false,
        asynchronous: false,
        mad: false,
        loop: true
      });
      Model.__super__.constructor.call(this, attributes, options);
    }

    Model.prototype.appendFiles = function(newFiles, cb) {
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

    return Model;

  })(Backbone.Model);

  Webcaster.Player = (function() {

    _.extend(Player.prototype, Backbone.Events);

    function Player(_arg) {
      this.model = _arg.model;
    }

    Player.prototype.selectFile = function(options) {
      var file, files, index;
      if (options == null) options = {};
      files = this.model.get("files");
      index = this.model.get("fileIndex");
      if (files.length === 0) return;
      index += options.backward ? -1 : 1;
      if (index < 0 || index >= files.length) {
        if (!this.model.get("loop")) return;
        if (index < 0) {
          index = files.length - 1;
        } else {
          index = 0;
        }
      }
      file = files[index];
      this.model.set({
        fileIndex: index
      });
      return file;
    };

    Player.prototype.getSource = function() {
      var _this = this;
      if (this.source != null) return this.source;
      if (this.model.get("mad")) {
        this.source = new Webcaster.Source.Mad({
          model: this.model
        });
      } else {
        this.source = new Webcaster.Source.AudioElement({
          model: this.model
        });
      }
      this.listenTo(this.source, "ended", function() {
        return _this.trigger("ended");
      });
      this.source.connect();
      return this.source;
    };

    Player.prototype.play = function(file, cb) {
      var _this = this;
      return this.getSource().prepare(file, function() {
        _this.getSource().play(file);
        _this.playing = true;
        return typeof cb === "function" ? cb() : void 0;
      });
    };

    Player.prototype.stop = function(cb) {
      var source;
      this.model.set({
        fileIndex: -1
      });
      source = this.getSource();
      this.source = null;
      this.playing = false;
      if (source == null) return cb();
      this.stopListening(source);
      return source.close(cb);
    };

    Player.prototype.sendMetadata = function(data) {
      var _ref;
      return (_ref = this.source) != null ? _ref.sendMetadata(data) : void 0;
    };

    return Player;

  })();

  Webcaster.Source = (function() {

    _.extend(Source.prototype, Backbone.Events);

    function Source(_arg) {
      var encoder;
      this.model = _arg.model;
      if (typeof webkitAudioContext !== "undefined") {
        this.context = new webkitAudioContext;
      } else {
        this.context = new AudioContext;
      }
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
    }

    Source.prototype.connect = function() {
      this.webcast = new Webcast.Node({
        url: this.model.get("uri"),
        encoder: this.encoder,
        context: this.context,
        options: {
          passThrough: this.model.get("passThrough")
        }
      });
      return this.webcast.connect(this.context.destination);
    };

    Source.prototype.prepare = function() {
      var _ref;
      if ((_ref = this.source) != null) _ref.disconnect();
      return this.model.set({
        position: 0.0
      });
    };

    Source.prototype.play = function(_arg) {
      var metadata;
      metadata = _arg.metadata;
      this.source.connect(this.webcast);
      return this.sendMetadata(metadata);
    };

    Source.prototype.stop = function() {
      var _ref;
      if ((_ref = this.source) != null) _ref.disconnect();
      return this.source = null;
    };

    Source.prototype.sendMetadata = function(data) {
      var _ref;
      return (_ref = this.webcast) != null ? _ref.sendMetadata(data) : void 0;
    };

    Source.prototype.close = function() {
      var _ref;
      this.stop();
      if ((_ref = this.webcast) != null) _ref.close();
      return this.webcast = null;
    };

    return Source;

  })();

  Webcaster.Source.AudioElement = (function(_super) {

    __extends(AudioElement, _super);

    function AudioElement() {
      AudioElement.__super__.constructor.apply(this, arguments);
    }

    AudioElement.prototype.prepare = function(_arg, cb) {
      var file, _ref, _ref2,
        _this = this;
      file = _arg.file;
      AudioElement.__super__.prepare.apply(this, arguments);
      if ((_ref = this.audio) != null) _ref.pause();
      if ((_ref2 = this.audio) != null) _ref2.remove();
      this.audio = new Audio(URL.createObjectURL(file));
      this.audio.controls = false;
      this.audio.autoplay = false;
      this.audio.loop = false;
      this.audio.addEventListener("ended", function() {
        return _this.trigger("ended");
      });
      return this.audio.addEventListener("canplay", function() {
        _this.source = _this.context.createMediaElementSource(_this.audio);
        return cb();
      });
    };

    AudioElement.prototype.play = function() {
      AudioElement.__super__.play.apply(this, arguments);
      return this.audio.play();
    };

    AudioElement.prototype.stop = function() {
      var _ref, _ref2;
      AudioElement.__super__.stop.apply(this, arguments);
      if ((_ref = this.audio) != null) _ref.pause();
      return (_ref2 = this.audio) != null ? _ref2.remove() : void 0;
    };

    AudioElement.prototype.close = function() {
      AudioElement.__super__.close.apply(this, arguments);
      return this.audio = null;
    };

    return AudioElement;

  })(Webcaster.Source);

  Webcaster.Source.Mad = (function(_super) {

    __extends(Mad, _super);

    function Mad() {
      this.processFrame = __bind(this.processFrame, this);
      this.processBuffer = __bind(this.processBuffer, this);
      Mad.__super__.constructor.apply(this, arguments);
    }

    Mad.prototype.bufferSize = 4096;

    Mad.prototype.resampler = Samplerate.FASTEST;

    Mad.prototype.initialize = function() {
      var i, _ref, _results;
      this.stop();
      this.remaining = new Array(this.encoder.channels);
      this.resamplers = new Array(this.encoder.channels);
      this.pending = new Array(this.encoder.channels);
      _results = [];
      for (i = 0, _ref = this.encoder.channels - 1; 0 <= _ref ? i <= _ref : i >= _ref; 0 <= _ref ? i++ : i--) {
        this.remaining[i] = new Float32Array;
        this.pending[i] = new Float32Array;
        _results.push(this.resamplers[i] = new Samplerate({
          type: this.resampler
        }));
      }
      return _results;
    };

    Mad.prototype.concat = function(a, b) {
      var ret;
      if (typeof b === "undefined") return a;
      ret = new Float32Array(a.length + b.length);
      ret.set(a);
      ret.subarray(a.length).set(b);
      return ret;
    };

    Mad.prototype.prepare = function(_arg, cb) {
      var file,
        _this = this;
      file = _arg.file;
      Mad.__super__.prepare.apply(this, arguments);
      this.initialize();
      this.oscillator = this.context.createOscillator();
      this.source = this.context.createScriptProcessor(this.bufferSize, this.encoder.channels, this.encoder.channels);
      this.source.onaudioprocess = this.processBuffer;
      this.oscillator.connect(this.source);
      return file.createMadDecoder(function(decoder) {
        _this.decoder = decoder;
        return _this.decoder.decodeFrame(function(data, err) {
          var fn;
          if (err != null) return;
          _this.format = _this.decoder.getCurrentFormat();
          _this.frameDuration = 1000 * parseFloat(data[0].length) / _this.format.sampleRate;
          fn = function() {
            return _this.decoder.decodeFrame(_this.processFrame);
          };
          _this.handler = setInterval(fn, _this.frameDuration);
          _this.processFrame(data, err);
          return cb();
        });
      });
    };

    Mad.prototype.processBuffer = function(buf) {
      var channelData, i, samples, _ref, _results;
      if (this.encodingDone) {
        if (this.sourceDone) {
          this.trigger("ended");
          this.stop();
          return;
        }
        this.sourceDone = true;
      }
      _results = [];
      for (i = 0, _ref = this.encoder.channels - 1; 0 <= _ref ? i <= _ref : i >= _ref; 0 <= _ref ? i++ : i--) {
        channelData = buf.outputBuffer.getChannelData(i);
        samples = Math.min(this.pending[i].length, channelData.length);
        channelData.set(this.pending[i].subarray(0, samples));
        _results.push(this.pending[i] = this.pending[i].subarray(samples, this.pending[i].length));
      }
      return _results;
    };

    Mad.prototype.processFrame = function(buffer, err) {
      var data, i, used, _ref, _ref2, _results;
      if (err != null) {
        this.encodingDone = true;
        this.trigger("ended");
        return this.stop();
      }
      buffer = buffer.slice(0, this.model.get("channels"));
      _results = [];
      for (i = 0, _ref = buffer.length - 1; 0 <= _ref ? i <= _ref : i >= _ref; 0 <= _ref ? i++ : i--) {
        if (this.format.sampleRate !== this.context.sampleRate) {
          buffer[i] = this.concat(this.remaining[i], buffer[i]);
          _ref2 = this.resamplers[i].process({
            data: buffer[i],
            ratio: parseFloat(this.context.sampleRate) / parseFloat(this.format.sampleRate)
          }), data = _ref2.data, used = _ref2.used;
          this.remaining[i] = buffer[i].subarray(used);
          buffer[i] = data;
        }
        _results.push(this.pending[i] = this.concat(this.pending[i], buffer[i]));
      }
      return _results;
    };

    Mad.prototype.play = function() {
      Mad.__super__.play.apply(this, arguments);
      return this.oscillator.start(0);
    };

    Mad.prototype.stop = function() {
      var _ref;
      if (this.handler != null) {
        clearInterval(this.handler);
        this.handler = null;
      }
      if ((_ref = this.oscillator) != null) _ref.stop(0);
      return this.oscillator = this.encodingDone = this.sourceDone = null;
    };

    return Mad;

  })(Webcaster.Source);

  Webcaster.View.Client = (function(_super) {

    __extends(Client, _super);

    function Client() {
      Client.__super__.constructor.apply(this, arguments);
    }

    Client.prototype.events = {
      "click #record-audio": "onRecord",
      "click #play-audio": "onPlay",
      "click #previous": "onPrevious",
      "click #next": "onNext",
      "click #stop": "onStop",
      "change #files": "onFiles",
      "submit": "onSubmit"
    };

    Client.prototype.initialize = function(options) {
      var _this = this;
      if (options == null) options = {};
      this.player = options.player;
      this.listenTo(this.player, "ended", function() {
        this.$(".track-row").removeClass("success");
        if (!this.model.get("loop")) return;
        return this.play();
      });
      return this.model.on("change:fileIndex", function() {
        _this.$(".track-row").removeClass("success");
        return _this.$(".track-row-" + (_this.model.get("fileIndex"))).addClass("success");
      });
    };

    Client.prototype.render = function() {
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

    Client.prototype.onRecord = function() {};

    Client.prototype.play = function(options) {
      var _this = this;
      this.$(".play-control").attr({
        disabled: "disabled"
      });
      return this.player.play(this.player.selectFile(options), function() {
        return _this.$(".play-control").removeAttr("disabled");
      });
    };

    Client.prototype.onPlay = function(e) {
      e.preventDefault();
      return this.play();
    };

    Client.prototype.onPrevious = function(e) {
      e.preventDefault();
      if (!this.player.playing) return;
      return this.play({
        backward: true
      });
    };

    Client.prototype.onNext = function(e) {
      e.preventDefault();
      if (!this.player.playing) return;
      return this.play();
    };

    Client.prototype.onStop = function(e) {
      var _this = this;
      e.preventDefault();
      this.$(".track-row").removeClass("success");
      this.$(".play-control").attr({
        disabled: "disabled"
      });
      return this.player.stop(function() {
        return _this.$(".play-control").removeAttr("disabled");
      });
    };

    Client.prototype.onFiles = function() {
      var files,
        _this = this;
      files = this.$("#files")[0].files;
      this.$("#files").attr({
        disabled: "disabled"
      });
      return this.model.appendFiles(files, function() {
        _this.$("#files").removeAttr("disabled").val("");
        return _this.render();
      });
    };

    Client.prototype.onSubmit = function(e) {
      return e.preventDefault();
    };

    return Client;

  })(Backbone.View);

  Webcaster.View.Metadata = (function(_super) {

    __extends(Metadata, _super);

    function Metadata() {
      Metadata.__super__.constructor.apply(this, arguments);
    }

    Metadata.prototype.events = {
      "click #send-metadata": "onMetadata",
      "submit": "onSubmit"
    };

    Metadata.prototype.initialize = function(options) {
      if (options == null) options = {};
      return this.player = options.player;
    };

    Metadata.prototype.onMetadata = function(e) {
      e.preventDefault();
      return this.player.sendMetadata({
        title: this.$("#title").val(),
        artist: this.$("#artist").val()
      });
    };

    Metadata.prototype.onSubmit = function(e) {
      return e.preventDefault();
    };

    return Metadata;

  })(Backbone.View);

  Webcaster.View.Settings = (function(_super) {

    __extends(Settings, _super);

    function Settings() {
      Settings.__super__.constructor.apply(this, arguments);
    }

    Settings.prototype.events = {
      "change #uri": "onUri",
      "change input.encoder": "onEncoder",
      "change input.channels": "onChannels",
      "change #mono": "onMono",
      "change #asynchronous": "onAsynchronous",
      "change #passThrough": "onPassThrough",
      "change #loop": "onLoop",
      "submit": "onSubmit"
    };

    Settings.prototype.render = function() {
      var bitrate, samplerate,
        _this = this;
      samplerate = this.model.get("samplerate");
      this.$("#samplerate").empty();
      _.each(this.model.get("samplerates"), function(rate) {
        var selected;
        selected = samplerate === rate ? "selected" : "";
        return $("<option value='" + rate + "' " + selected + ">" + rate + "</option>").appendTo(_this.$("#samplerate"));
      });
      bitrate = this.model.get("bitrate");
      this.$("#bitrate").empty();
      _.each(this.model.get("bitrates"), function(rate) {
        var selected;
        selected = bitrate === rate ? "selected" : "";
        return $("<option value='" + rate + "' " + selected + ">" + rate + "</option>").appendTo(_this.$("#bitrate"));
      });
      if ((new Audio).canPlayType("audio/mpeg") === "") {
        this.model.set({
          mad: true
        });
      }
      return this;
    };

    Settings.prototype.onUri = function() {
      return this.model.set({
        uri: this.$("#uri").val()
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

    Settings.prototype.onLoop = function(e) {
      return this.model.set({
        loop: $(e.target).is(":checked")
      });
    };

    Settings.prototype.onSubmit = function(e) {
      return e.preventDefault();
    };

    return Settings;

  })(Backbone.View);

  $(function() {
    Webcaster.model = new Webcaster.Model;
    Webcaster.player = new Webcaster.Player({
      model: Webcaster.model
    });
    _.extend(Webcaster, {
      model: Webcaster.model,
      settings: new Webcaster.View.Settings({
        model: Webcaster.model,
        el: $("div.settings")
      }),
      client: new Webcaster.View.Client({
        model: Webcaster.model,
        player: Webcaster.player,
        el: $("div.client")
      }),
      metadata: new Webcaster.View.Metadata({
        model: Webcaster.model,
        player: Webcaster.player,
        el: $("div.metadata")
      })
    });
    Webcaster.settings.render();
    Webcaster.client.render();
    return Webcaster.metadata.render();
  });

}).call(this);
