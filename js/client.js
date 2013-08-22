(function() {
  var Broster,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  window.Broster = Broster = {
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

  Broster.Model = (function(_super) {

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

  Broster.Player = (function() {

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
        this.source = new Broster.Source.Mad({
          model: this.model
        });
      } else {
        this.source = new Broster.Source.AudioElement({
          model: this.model
        });
      }
      this.listenTo(this.source, "ended", function() {
        return _this.trigger("ended");
      });
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

  Broster.Source = (function() {

    _.extend(Source.prototype, Backbone.Events);

    function Source(_arg) {
      this.model = _arg.model;
    }

    Source.prototype.prepare = function(cb) {
      var encoder, old;
      this.model.set({
        position: 0.0
      });
      old = this.encoder;
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
      if ((this.samplerate != null) && this.model.get("samplerate") !== this.samplerate) {
        this.encoder = new Webcast.Encoder.Resample({
          encoder: this.encoder,
          type: Samplerate.LINEAR,
          samplerate: this.samplerate
        });
      }
      if (this.model.get("asynchronous")) {
        this.encoder = new Webcast.Encoder.Asynchronous({
          encoder: this.encoder,
          scripts: ["https://rawgithub.com/webcast/libsamplerate.js/master/dist/libsamplerate.js", "https://rawgithub.com/savonet/shine/master/js/dist/libshine.js", "https://rawgithub.com/webcast/webcast.js/master/lib/webcast.js"]
        });
      }
      if (old == null) return cb();
      return old.close(function(data) {
        var _ref;
        if ((_ref = this.websocket) != null) _ref.sendData(data);
        return cb();
      });
    };

    Source.prototype.play = function(_arg) {
      var metadata;
      metadata = _arg.metadata;
      return this.sendMetadata(metadata);
    };

    Source.prototype.sendMetadata = function(data) {
      var _ref;
      return (_ref = this.webcast) != null ? _ref.sendMetadata(data) : void 0;
    };

    return Source;

  })();

  Broster.Source.AudioElement = (function(_super) {

    __extends(AudioElement, _super);

    function AudioElement() {
      AudioElement.__super__.constructor.apply(this, arguments);
      if (typeof webkitAudioContext !== "undefined") {
        this.context = new webkitAudioContext;
      } else {
        this.context = new AudioContext;
      }
      this.samplerate = this.context.sampleRate;
    }

    AudioElement.prototype.prepare = function(_arg, cb) {
      var file,
        _this = this;
      file = _arg.file;
      return AudioElement.__super__.prepare.call(this, function() {
        var _ref, _ref2;
        if (_this.webcast == null) {
          _this.webcast = new Webcast.Node({
            url: _this.model.get("uri"),
            encoder: _this.encoder,
            context: _this.context,
            options: {
              passThrough: _this.model.get("passThrough")
            }
          });
          _this.webcast.connect(_this.context.destination);
        }
        if ((_ref = _this.source) != null) _ref.disconnect();
        if ((_ref2 = _this.audio) != null) _ref2.remove();
        _this.webcast.encoder = _this.encoder;
        _this.audio = new Audio(URL.createObjectURL(file));
        _this.audio.controls = false;
        _this.audio.autoplay = false;
        _this.audio.loop = false;
        _this.audio.addEventListener("ended", function() {
          return _this.trigger("ended");
        });
        return _this.audio.addEventListener("canplay", cb);
      });
    };

    AudioElement.prototype.play = function() {
      AudioElement.__super__.play.apply(this, arguments);
      this.source = this.context.createMediaElementSource(this.audio);
      this.source.connect(this.webcast);
      return this.audio.play();
    };

    AudioElement.prototype.close = function(cb) {
      var _ref, _ref2, _ref3, _ref4;
      if ((_ref = this.webcast) != null) _ref.close();
      if ((_ref2 = this.source) != null) _ref2.disconnect();
      if ((_ref3 = this.audio) != null) _ref3.pause();
      if ((_ref4 = this.audio) != null) _ref4.remove();
      this.context = this.source = this.audio = this.webcast = null;
      return cb();
    };

    return AudioElement;

  })(Broster.Source);

  Broster.Source.Mad = (function(_super) {

    __extends(Mad, _super);

    function Mad() {
      this.processFrame = __bind(this.processFrame, this);
      Mad.__super__.constructor.apply(this, arguments);
    }

    Mad.prototype.prepare = function(_arg, cb) {
      var audio, file,
        _this = this;
      audio = _arg.audio, file = _arg.file;
      this.samplerate = audio.samplerate;
      return Mad.__super__.prepare.call(this, function() {
        if (_this.handler != null) clearInterval(_this.handler);
        _this.handler = null;
        return file.createMadDecoder(function(decoder) {
          _this.decoder = decoder;
          if (_this.webcast != null) return cb();
          _this.webcast = new Webcast.Socket({
            url: _this.model.get("uri"),
            mime: _this.encoder.mime,
            info: _this.encoder.info
          });
          return _this.webcast.addEventListener("open", cb);
        });
      });
    };

    Mad.prototype.play = function() {
      Mad.__super__.play.apply(this, arguments);
      return this.decoder.decodeFrame(this.processFrame);
    };

    Mad.prototype.processFrame = function(data, err) {
      var fn, format,
        _this = this;
      if (err != null) {
        if (this.handler != null) clearInterval(this.handler);
        this.trigger("ended");
        return;
      }
      data = data.slice(0, this.model.get("channels"));
      this.encoder.encode(data, function(encoded) {
        var _ref;
        return (_ref = _this.webcast) != null ? _ref.sendData(encoded) : void 0;
      });
      if (this.handler != null) {
        this.model.set({
          position: this.model.get("position") + this.frameDuration
        });
        return;
      }
      format = this.decoder.getCurrentFormat();
      this.frameDuration = 1000 * parseFloat(data[0].length) / format.sampleRate;
      fn = function() {
        return _this.decoder.decodeFrame(_this.processFrame);
      };
      this.handler = setInterval(fn, frameDuration);
      return this.model.set({
        position: this.model.get("position") + this.frameDuration
      });
    };

    Mad.prototype.close = function(cb) {
      var encoder, webcast;
      if (this.handler != null) clearInterval(this.handler);
      encoder = this.encoder;
      webcast = this.webcast;
      this.handler = this.webcast = this.handler = this.frameDuration = null;
      if (encoder == null) return cb();
      return encoder.close(function(data) {
        if (webcast != null) webcast.sendData(data);
        if (webcast != null) webcast.close();
        return cb();
      });
    };

    return Mad;

  })(Broster.Source);

  Broster.View.Client = (function(_super) {

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
          time = Broster.prettifyTime(audio.length);
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

  Broster.View.Metadata = (function(_super) {

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

  Broster.View.Settings = (function(_super) {

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
      "change #mad": "onMad",
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
          mad: true,
          passThrough: false
        });
        this.$("#mad").attr({
          checked: "checked",
          disabled: "disabled"
        });
        this.$("#passThrough").removeAttr("checked").attr({
          disabled: "disabled"
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

    Settings.prototype.onMad = function(e) {
      var checked;
      checked = $(e.target).is(":checked");
      this.model.set({
        mad: checked
      });
      if (checked) {
        this.$("#file").attr({
          accept: "audio/mpeg"
        });
        this.$("#passThrough").removeAttr("checked").attr({
          disabled: "disabled"
        });
        return this.model.set({
          passThrough: false
        });
      } else {
        this.$("#file").attr({
          accept: "audio/*8"
        });
        return this.$("#passThrough").removeAttr("disabled");
      }
    };

    Settings.prototype.onSubmit = function(e) {
      return e.preventDefault();
    };

    return Settings;

  })(Backbone.View);

  $(function() {
    Broster.model = new Broster.Model;
    Broster.player = new Broster.Player({
      model: Broster.model
    });
    _.extend(Broster, {
      model: Broster.model,
      settings: new Broster.View.Settings({
        model: Broster.model,
        el: $("div.settings")
      }),
      client: new Broster.View.Client({
        model: Broster.model,
        player: Broster.player,
        el: $("div.client")
      }),
      metadata: new Broster.View.Metadata({
        model: Broster.model,
        player: Broster.player,
        el: $("div.metadata")
      })
    });
    Broster.settings.render();
    Broster.client.render();
    return Broster.metadata.render();
  });

}).call(this);
