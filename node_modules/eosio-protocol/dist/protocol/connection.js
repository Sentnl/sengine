"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EOSIOP2PClientConnection = void 0;
const net = require("net");
const EventEmitter = require("events");
const stream = require("stream");
const serializer_1 = require("./stream/serializer");
/*
Utility class for maintaining a single client connection, provides functionality for holding a connection and sending
data to the TCP stream
 */
class EOSIOP2PClientConnection extends EventEmitter {
    constructor({ host, port, api, debug }) {
        super();
        this.host = host;
        this.port = port;
        this.client = null;
        this._debug = debug;
    }
    debug(...msg) {
        if (this._debug) {
            console.log(...msg);
        }
    }
    error(...msg) {
        console.error(...msg);
    }
    async connect() {
        return new Promise((resolve, reject) => {
            this.client = new net.Socket();
            this.client.on('error', (e) => {
                this.emit('net_error', e);
                reject(e);
            });
            const self = this;
            this.client.connect(this.port, this.host, function () {
                //console.log('Connected to p2p');
                self.emit('connected');
                resolve(self.client);
            });
        });
    }
    disconnect() {
        this.client.end();
        this.client.destroy();
        this.client = null;
    }
    async send_message(msg) {
        const sr = new stream.Readable({ objectMode: true, read() { } });
        sr.push([msg.type, msg.type_name, msg]);
        const write_stream = new serializer_1.EOSIOStreamSerializer({});
        sr.pipe(write_stream).on('data', (d) => {
            this.debug(`>>> DATA TO CLIENT `, d);
            // console.log(this.client);
            if (this.client) {
                this.client.write(d);
            }
            else {
                this.error(`Not sending message because we do not have a client`);
            }
        });
    }
}
exports.EOSIOP2PClientConnection = EOSIOP2PClientConnection;
//# sourceMappingURL=connection.js.map