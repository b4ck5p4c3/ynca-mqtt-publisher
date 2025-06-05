# ynca-mqtt-publisher

Simple tool to publish Yamaha YNCA updates to MQTT

Config:
- `YAMAHA_RECEIVER_HOST` - host in format `ip:port` for YNCA to connect to
- `YAMAHA_RECEIVER_CONNECT_TIMEOUT` - TCP connect timeout in ms
- `YAMAHA_RECEIVER_PING_COMMAND` - YNCA ping command (`@MAIN:PWR=?` by default)
- `YAMAHA_RECEIVER_PING_INTERVAL` - ping interval in ms
- `MQTT_URL` - MQTT broker url with username/password
- `CA_CERTIFICATE_PATH` - path to MQTT broker CA certificate
- `PORT` - port for exposing HTTP API with `/now-playing` endpoint