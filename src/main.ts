import dotenv from "dotenv";
import {YNCAClient, YNCAMessage} from "./ynca-client";
import {getLogger} from "./logger";
import mqtt from "mqtt";
import fs from "fs";
import {AVInput, AVStatus, AVStatusMessage} from "./types";
import express from "express";

dotenv.config({
    path: ".env.local"
});
dotenv.config();

const YAMAHA_RECEIVER_HOST = process.env.YAMAHA_RECEIVER_HOST ?? "127.0.0.1:50000";
const YAMAHA_RECEIVER_CONNECT_TIMEOUT = parseInt(process.env.YAMAHA_RECEIVER_CONNECT_TIMEOUT ?? "5000");
const YAMAHA_RECEIVER_PING_COMMAND = process.env.YAMAHA_RECEIVER_PING_COMMAND ?? "@MAIN:PWR=?";
const YAMAHA_RECEIVER_PING_INTERVAL = parseInt(process.env.YAMAHA_RECEIVER_PING_INTERVAL ?? "1000");
const MQTT_URL = process.env.MQTT_URL ?? "mqtts://avreceiver:avreceiver@mqtt.svc.bksp.in:8883";
const CA_CERTIFICATE_PATH = process.env.CA_CERTIFICATE_PATH ?? "ca-cert.pem";
const PORT = parseInt(process.env.PORT ?? "8015");

const logger = getLogger();

const yncaClient = new YNCAClient({
    host: YAMAHA_RECEIVER_HOST.split(":")[0],
    port: parseInt(YAMAHA_RECEIVER_HOST.split(":")[1]),
    connectTimeout: YAMAHA_RECEIVER_CONNECT_TIMEOUT,
    pingCommand: YAMAHA_RECEIVER_PING_COMMAND,
    pingInterval: YAMAHA_RECEIVER_PING_INTERVAL
});

const mqttClient = mqtt.connect(MQTT_URL, {
    ca: [fs.readFileSync(CA_CERTIFICATE_PATH)]
});

const app = express();

mqttClient.on("connect", () => {
    logger.info("Connected to MQTT");
});
mqttClient.on("error", e => {
    logger.error(`MQTT error: ${e}`);
});

yncaClient.run().catch(e => logger.error(`Failed to run YNCA client: ${e}`));

yncaClient.on("message", message => {
    mqttClient.publish("bus/devices/solgaleo-av/raw", message.raw);
});

let state: AVStatusMessage = {
    status: AVStatus.Standby,
    media: {
        album: "",
        artist: "",
        title: ""
    },
    input: AVInput.Other
};

function processMessageForState(currentState: AVStatusMessage, message: YNCAMessage): boolean {
    let changed = false;
    switch (message.subUnit) {
        case "AIRPLAY":
            switch (message.functionName) {
                case "PLAYBACKINFO":
                    switch (message.value) {
                        case "Play":
                            currentState.status = AVStatus.Playing;
                            currentState.input = AVInput.AirPlay;
                            changed = true;
                            break;
                        case "Pause":
                            currentState.status = AVStatus.Pause;
                            changed = true;
                            break;
                    }
                    break;
                case "ARTIST": {
                    currentState.media.artist = message.value;
                    changed = true;
                    break;
                }
                case "ALBUM": {
                    currentState.media.album = message.value;
                    changed = true;
                    break;
                }
                case "SONG": {
                    currentState.media.title = message.value;
                    changed = true;
                    break;
                }
            }
            break;
        case "BT":
            switch (message.functionName) {
                case "PLAYBACKINFO":
                    switch (message.value) {
                        case "Play":
                            currentState.status = AVStatus.Playing;
                            currentState.input = AVInput.Bluetooth;
                            changed = true;
                            break;
                        case "Pause":
                            currentState.status = AVStatus.Pause;
                            changed = true;
                            break;
                    }
                    break;
                case "ARTIST": {
                    currentState.media.artist = message.value;
                    changed = true;
                    break;
                }
                case "ALBUM": {
                    currentState.media.album = message.value;
                    changed = true;
                    break;
                }
                case "SONG": {
                    currentState.media.title = message.value;
                    changed = true;
                    break;
                }
            }
            break;
        case "SPOTIFY":
            switch (message.functionName) {
                case "PLAYBACKINFO":
                    switch (message.value) {
                        case "Play":
                            currentState.status = AVStatus.Playing;
                            currentState.input = AVInput.Spotify;
                            changed = true;
                            break;
                        case "Pause":
                            currentState.status = AVStatus.Pause;
                            changed = true;
                            break;
                    }
                    break;
                case "ARTIST": {
                    currentState.media.artist = message.value;
                    changed = true;
                    break;
                }
                case "ALBUM": {
                    currentState.media.album = message.value;
                    changed = true;
                    break;
                }
                case "TRACK": {
                    currentState.media.title = message.value;
                    changed = true;
                    break;
                }
            }
            break;
    }
    return changed;
}

yncaClient.on("message", message => {
    if (processMessageForState(state, message)) {
        mqttClient.publish("bus/devices/av/now_playing", JSON.stringify(message));
    }
});

app.get("/now-playing", (req, res) => {
    res.json(state);
});

app.listen(PORT, () => {
    logger.info(`HTTP server started on :${PORT}`);
});