navigator.getUserMedia  = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

// Configuration
var wsUri = "ws://localhost:8080/mount";
var playlistFiles = [];
var playlistPosition = -1;
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
var loop = true;
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

function sendfileMetadata(file) {
  file.readTaglibMetadata(function (data) {
    if (!webcast) {
      return;
    }

    if (data.metadata) {
      webcast.sendMetadata({
        title: data.metadata.title,
        artist: data.metadata.artist
      });
    }
  });
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
    var file = pickFile();
    if (!file) {
      return;
    }
    sendfileMetadata(file);

    file.createMadDecoder(function (decoder) {
      var fn = function (data, err) {
        if (!socket.isOpen() || err) {
          clearInterval(handler);
          format = handler = null;
          decoder.close();

          enc.close(function (data) {
            if (socket.isOpen() && loop) {
              socket.sendData(data);
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

// TODO: update for playlist..
function createAudioSource() {
  killWebcast();
  createAudioContext();

  audioSource = new Audio();

  var file = pickFile();
  if (!file) {
    return;
  }
  sendfileMetadata(file);

  audioSource.src = URL.createObjectURL(file);
  audioSource.controls = true;
  audioSource.autoplay = false;
  audioSource.loop = false;

  audioSource.addEventListener("canplay", function () {
    var source = audioContext.createMediaElementSource(audioSource);
    createWebcastNode(source);
    audioSource.play();
  }, false);

  $("#player").append(audioSource);
}

function pickFile(backward) {
  $(".track-row").removeClass("success"); 

  if (playlistFiles.length === 0) {
    return;
  }

  playlistPosition += backward ? -1 : 1;

  if (playlistPosition >= playlistFiles.length) {
    if (loop) {
      playlistPosition = 0;
    } else {
      return;
    }
  }

  $(".track-row-" + (playlistPosition+1)).addClass("success");
  var file = playlistFiles[playlistPosition]; 

  return file;
}

function renderFilesTable(cb) {
  var selectedFiles = $("#files")[0].files;
  var i = 0;
  var len = playlistFiles.length;
  var fn = function () {
    if (i>=selectedFiles.length) {
      $(".playlist-table").show();
      return cb();
    }
    playlistFiles.push(selectedFiles[i]);
    selectedFiles[i].readTaglibMetadata(function (data) {
      var time;
      if (data.audio.length && data.audio.length != 0) {
        var length = parseInt(data.audio.length);
        var hours  = parseInt(length / 3600);
        length %= 3600;
        var minutes = parseInt(length / 60);
        length %= 60;
        var seconds = length;
        if (minutes < 10) {
          minutes = "0" + minutes;
        }
        if (seconds < 10) {
          seconds = "0" + seconds;
        }
        time = minutes + ":" + seconds;
        if (hours > 0) {
          time = hours + ":" + time;
        } 
      } else {
        time = "N/A";
      }

      var pos = len+i+1;
      $(".files-table").append([
        "<tr class='track-row track-row-" + pos + "'>",
          "<td>" + pos                  + "</td>",
          "<td>" + data.metadata.title  + "</td>",
          "<td>" + data.metadata.artist + "</td>",
          "<td>" + time                 + "</td>",
        "</tr>"
      ].join(""));

      i += 1;
      setTimeout(fn, 0);
    });
  };
  fn(0);
}

function clearFilesInput() {
  $("#files").val("");
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

  $("#files").change(function () {
    renderFilesTable(clearFilesInput);
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
