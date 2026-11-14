# Receives the stream from webcaster and relays it to Icecast.
# Run with: liquidsoap server.liq

live = input.harbor(
  "mount",
  port=8080,
  user="source",
  password="hackme",
  # Uncomment to accept wss:// connections, required when the page is served over HTTPS.
  # transport=http.transport.ssl(certificate="/path/to/cert.pem", key="/path/to/key.pem"),
)

# Silence while nobody is streaming, so listeners stay connected.
radio = mksafe(live)

output.icecast(
  %mp3(bitrate = 128),
  host="localhost",
  port=8000,
  password="hackme",
  mount="radio",
  radio
)
