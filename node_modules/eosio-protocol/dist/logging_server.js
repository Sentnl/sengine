"use strict";
/*
Logging proxy server - Logs all messages flowing between two peers
 */
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const { EOSIOStreamTokenizer } = require("./protocol/stream/tokenizer");
const { EOSIOStreamDeserializer } = require("./protocol/stream/deserializer");
const { EOSIOStreamConsoleDebugger } = require("./protocol/stream/debugger");
const net = require("net");
const { target, source } = require('../logging_server.config');
class Peer extends events_1.EventEmitter {
    constructor(client_socket) {
        super();
        this.socket = client_socket;
        this.connect_target().then(() => {
            client_socket.on('error', (e) => {
                console.error(`CLIENT SOCKET ERROR ${client_socket.remoteAddress} - ${e.message}`);
                client_socket.destroy();
                this.emit('client_error', e);
            });
            client_socket.on('end', () => {
                console.error(`CLIENT SOCKET END ${client_socket.remoteAddress}`);
                client_socket.destroy();
                this.emit('client_end');
            });
            // send all data to the target server
            client_socket.pipe(this.target);
            // Log received messages
            client_socket
                .pipe(new EOSIOStreamTokenizer({}))
                .pipe(new EOSIOStreamDeserializer({}))
                .pipe(new EOSIOStreamConsoleDebugger({ prefix: `<<< ${client_socket.remoteAddress}:${client_socket.remotePort}` }));
            // Send all data from our target to the connected client
            this.target.pipe(client_socket);
            //
            // // log outgoing messages
            this.target
                .pipe(new EOSIOStreamTokenizer({}))
                .pipe(new EOSIOStreamDeserializer({}))
                .pipe(new EOSIOStreamConsoleDebugger({ prefix: `>>> ${client_socket.remoteAddress}:${client_socket.remotePort}` }));
        });
    }
    async connect_target() {
        return new Promise((resolve, reject) => {
            // connect to upstream server
            this.target = new net.Socket();
            this.target.on('error', (e) => {
                console.error(`TARGET SOCKET ERROR ${this.target.remoteAddress} - ${e.message}`);
                this.target.end();
                this.emit('target_error', e);
                // TODO : try to reconnect
            });
            this.target.on('end', () => {
                console.error(`TARGET SOCKET END ${this.target.remoteAddress}`);
                this.target.end();
                this.emit('target_end');
                // TODO : try to reconnect
            });
            this.target.connect(target.port, target.host, () => {
                console.log('Connected to nodeos target');
                resolve();
                this.emit('target_connected', target);
            });
        });
    }
    destroy() {
        this.target.end();
        this.socket.end();
    }
}
const peers = new Set();
const server = net.createServer(function (socket) {
    console.log(`Connection received from ${socket.remoteAddress}`);
    const peer = new Peer(socket);
    peer.on('client_error', function (e) {
        console.log("Peer client_error");
        peers.delete(peer);
    });
    peer.on('client_end', function (e) {
        console.log("Peer client_end");
        if (peers.has(peer)) {
            peers.delete(peer);
        }
        console.log(`Total peers : ${peers.size}`);
    });
    peers.add(peer);
    console.log(`Total peers : ${peers.size}`);
});
server.listen(source.port, source.host);
//# sourceMappingURL=logging_server.js.map