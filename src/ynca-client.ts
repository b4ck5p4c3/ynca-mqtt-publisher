import {Socket} from "net";
import PromiseSocket from "promise-socket";
import {getLogger} from "./logger";
import {sleep} from "./utils";
import EventEmitter from "node:events";
import {Mitt} from "./mitt";

const YNCA_RECONNECT_INTERVAL = 1000;

export interface YNCAClientConfig {
    host: string;
    port: number;
    connectTimeout: number;
    pingCommand: string;
    pingInterval: number;
}

function readBuffers(buffers: Buffer[], lines: string[]): Buffer[] {
    const buffer = Buffer.concat(buffers);

    let currentStartPointer = 0;

    for (let i = 0; i < buffer.length - 1; i++) {
        if (buffer[i] == 0x0D && buffer[i + 1] == 0x0A) { // \r\n
            const line = buffer.subarray(currentStartPointer, i);
            lines.push(line.toString("utf8"));
            currentStartPointer = i + 2;
        }
    }

    return [buffer.subarray(currentStartPointer)];
}

const LINE_REGEX = /^@(?<subUnit>[A-Z0-9]+):(?<functionName>[A-Z0-9]+)=(?<value>.*?)$/;

export interface YNCAMessage {
    subUnit: string;
    functionName: string;
    value: string;
    raw: string;
}

interface YNCAEvents extends Record<string | symbol, unknown> {
    message: YNCAMessage
}

export class YNCAClient extends Mitt<YNCAEvents> {
    private logger = getLogger<YNCAClient>();

    constructor(private config: YNCAClientConfig) {
        super();
    }

    async run(): Promise<void> {
        // noinspection InfiniteLoopJS
        while (true) {
            let promiseSocket: PromiseSocket<Socket> | undefined;

            try {
                const socket = new Socket();
                promiseSocket = new PromiseSocket(socket);
                promiseSocket.setTimeout(this.config.connectTimeout);
                await promiseSocket.connect(this.config.port, this.config.host);
                promiseSocket.setTimeout(this.config.pingInterval * 2);

                this.logger.info(`Connected to YNCA at ${this.config.host}:${this.config.port}`);

                let currentBuffers: Buffer[] = [];

                (async () => {
                    const currentSocket = promiseSocket;
                    try {
                        // noinspection InfiniteLoopJS
                        while (true) {
                            await currentSocket.write(Buffer.from(`${this.config.pingCommand}\r\n`, "utf8"));
                            await sleep(this.config.pingInterval);
                        }
                    } catch (e) {
                        currentSocket.destroy();
                        // ignore
                    }
                })().catch(() => {});

                // noinspection InfiniteLoopJS
                while (true) {
                    const buffer = await promiseSocket.read() as Buffer;
                    currentBuffers.push(buffer);

                    const receivedLines: string[] = [];
                    currentBuffers = readBuffers(currentBuffers, receivedLines);

                    for (const line of receivedLines) {
                        this.processLine(line);
                    }
                }
            } catch (e) {
                this.logger.error(`Failed to receive from YNCA socket: ${e}`);

                promiseSocket?.destroy();
            }

            await sleep(YNCA_RECONNECT_INTERVAL);
        }
    }

    private processLine(line: string): void {
        const match = LINE_REGEX.exec(line);
        if (!match) {
            throw new Error(`Line ${JSON.stringify(line)} does not match regex`);
        }

        this.emit("message", {
            subUnit: match.groups!.subUnit,
            functionName: match.groups!.functionName,
            value: match.groups!.value,
            raw: line
        });
    }
}