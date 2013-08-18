navigator.getUserMedia  = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

// Configuration
var wsUri = "ws://localhost:8080/mount";
var file;
var bitrate = 128;
var bitrates = [ 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256, 320 ];
var samplerate = 44100;
var samplerates = [ 8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000 ];
var channels = 2;
var samplerate;
var encoder = Webcast.Encoder.Mp3;
var audioContext;
var webcast;
var passThrough = false;
var useAsynchronous = false;
var useMad = false;
var loop = false;
var audioSource;

function createAudioContext() {
  if (typeof webkitAudioContext !== "undefined") {
    audioContext = new webkitAudioContext();
  } else {
    audioContext = new AudioContext();
  }
  samplerate = audioContext.sampleRate;
}

function killWebcast() {
  if (audioSource) {
    audioSource.remove();
    audioSource = null;
  }
  if (webcast) {
    webcast.close();
    webcast = null;
  }
  if (audioContext) {
    audioContext = null;
  }
}

function createEncoder(inputSamplerate) {
  samplerate = parseInt($("#samplerate").val());
  bitrate = parseInt($("#bitrate").val());

  inputSamplerate = inputSamplerate || samplerate;

  if ($("#stereo").is(":checked")) {
    channels = 2;
  } else {
    channels = 1;
  }

  var enc = new encoder({
    channels: channels,
    samplerate: samplerate,
    bitrate: bitrate
  });

  if (inputSamplerate !== samplerate) {
    enc = new Webcast.Encoder.Resample({
      encoder: enc,
      type: Samplerate.LINEAR,
      samplerate: inputSamplerate
    });
  }

  if (useAsynchronous) {
    enc = new Webcast.Encoder.Asynchronous({
      scripts: [
        "https://rawgithub.com/webcast/libsamplerate.js/master/dist/libsamplerate.js",
        "https://rawgithub.com/savonet/shine/master/js/dist/libshine.js",
        "https://rawgithub.com/webcast/webcast.js/master/lib/webcast.js"
      ],
      encoder: enc
    });
  }

  return enc;
}

function createWebcastNode(source) {
  webcast = new Webcast.Node({
    url: wsUri,
    encoder: createEncoder(audioContext.sampleRate),
    context: audioContext,
    options: {passThrough: passThrough}
  });

  source.connect(webcast);
  webcast.connect(audioContext.destination);
}

function createMadSource() {
  killWebcast();

  var enc = createEncoder();
  var socket = webcast = new Webcast.Socket({
    url: wsUri,
    mime: enc.mime,
    info: enc.info
  });

  var format;
  var handler;
  var create = function () {
    file.createMadDecoder(function (decoder) {
      var fn = function (data, err) {
        if (!socket.isOpen() || err) {
          clearInterval(handler);
          format = handler = null;
          decoder.close();

          enc.close(function (data) {
            if (socket.isOpen() && loop) {
              socket.send(data);
              create();
            }
          });
          return;
        }

        data = data.slice(0,channels);
        enc.encode(data, function (encoded) {
          if (socket) {
            socket.sendData(encoded);
          }

          // Let's pretend format does not change accross mp3 frame,
          // Screw you crazy specs and encoders.
          if (!handler) {
            format = decoder.getCurrentFormat();
            if (format.sampleRate !== samplerate) {
              enc = createEncoder(format.sampleRate);
            }
            var frameDuration = 1000*parseFloat(data[0].length)/format.sampleRate;

            // Now, execute this function every frameDuration.
            handler = setInterval(function () {
              decoder.decodeFrame(fn);
            }, frameDuration);
          }
        });
      };
      decoder.decodeFrame(fn);
    });
  };
  socket.addEventListener("open", function() {
    create();
  });
}

function createAudioSource() {
  killWebcast();
  createAudioContext();

  audioSource = new Audio();

  audioSource.src = URL.createObjectURL(file);
  audioSource.controls = true;
  audioSource.autoplay = false;
  audioSource.loop = true;

  audioSource.addEventListener("canplay", function () {
    var source = audioContext.createMediaElementSource(audioSource);
    createWebcastNode(source);
    audioSource.play();
  }, false);

  $("#player").append(audioSource);
}

function init() {
  var test = new Audio;
  if (test.canPlayType("audio/mpeg") === "") {
    useMad = true;
    passThrough = false;
    $("#mad").attr({checked: "checked", disabled: "disabled"});
    $("#passThrough").removeAttr("checked").attr({disabled: "disabled"});
  }

  $("#play-audio").click(function(e) {
    e.preventDefault();
    if (useMad) {
      createMadSource();
    } else {
      createAudioSource();
    }
  });

  $("#metadata").click(function (e) {
    e.preventDefault();
    file.readTaglibMetadata(function (data) {
      $("#artist").val(data.metadata.artist);
      $("#title").val(data.metadata.title);
    });
  });

  var el, i, v;
  for (i = 0; i<samplerates.length; i++) {
    v = samplerates[i];
    el = $("<option value='" + v + "'" + (samplerate == v ? "selected" : "") + ">" + v + "</option>");
    $("#samplerate").append(el);
  }

  for (i = 0; i<bitrates.length; i++) {
    v = bitrates[i];
    el = $("<option value='" + v + "'" + (bitrate == v ? "selected" : "") + ">" + v + "</option>");
    $("#bitrate").append(el);
  }

  $("#record-audio").click(function (e) {
    e.preventDefault();
    navigator.getUserMedia({audio:true, video:false}, function (stream) {
      killWebcast();

      createAudioContext();
      var source = audioContext.createMediaStreamSource(stream);

      createWebcastNode(source);
    }, function(e) {
      console.log("getUserMedia error: "+e.name+" "+e.message);
    });
  });

  $("#send-metadata").click(function (e) {
    e.preventDefault();
    if (webcast) {
      webcast.sendMetadata({
        title:  $("#title").val(),
        artist: $("#artist").val()
      });
    }
  });

  $("#mp3").change(function () {
    if (this.checked)
      encoder = Webcast.Encoder.Mp3;
  });

  $("#raw").change(function () {
    if (this.checked)
      encoder = Webcast.Encoder.Raw;
  });

  $("#stop").click(function (e) {
    e.preventDefault();
    killWebcast();
  });

  $("#file").change(function () {
    file = this.files[0];
  });

  $("#asynchronous").change(function () {
    useAsynchronous = this.checked;
  });

  $("#passThrough").change(function () {
    passThrough = this.checked;
  });

  $("#loop").change(function () {
    loop = this.checked;
  });

  $("#mad").change(function () {
    useMad = this.checked;
    if (useMad) {
      $("#file").attr({accept: "audio/mpeg"});
      $("#passThrough").removeAttr("checked");
      passThrough = false;
    } else {
      $("#file").attr({accept: "audio/*"});
    }
  });
}

$(init);
