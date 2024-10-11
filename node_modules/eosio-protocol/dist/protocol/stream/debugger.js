"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EOSIOStreamConsoleDebugger = void 0;
const sha256 = require('sha256');
const stream = require("stream");
const messages_1 = require("../messages");
const dist_1 = require("eosjs/dist");
/*
Debugging stream

Writable stream which takes the object output from EOSIOStreamDeserializer and logs it to the console in a compact format
 */
class EOSIOStreamConsoleDebugger extends stream.Writable {
    constructor(options) {
        super({ objectMode: true });
        this.client_identifier = '';
        this.prefix = options.prefix || '';
    }
    _write(chunk, encoding, callback) {
        const msg = messages_1.NetMessage.from(chunk[0]);
        msg.copy(chunk[2]);
        const prefix = `${this.prefix}  [${chunk[1]}]`;
        let log_msg = '';
        switch (chunk[1]) {
            case 'handshake_message':
                log_msg = `handshake from ${chunk[2].p2p_address}`;
                this.client_identifier = chunk[2].p2p_address;
                break;
            case 'time_message':
                const t_msg = msg;
                log_msg = `time message dst: ${t_msg.dst}, org: ${t_msg.org}, rec: ${t_msg.rec}, xmt: ${t_msg.xmt}`;
                break;
            case 'go_away_message':
                const ga_msg = msg;
                let reason = messages_1.GoAwayMessage.reasons[ga_msg.reason];
                log_msg = `go away message ${reason}`;
                break;
            case 'notice_message':
                const n_msg = msg;
                const notice_mode = messages_1.NoticeMessage.modes[n_msg.known_blocks.mode];
                // log_msg = n_msg);
                if (notice_mode === 'normal') {
                    log_msg = `notice message, remote server is ${n_msg.known_blocks.pending} blocks ahead`;
                }
                else {
                    log_msg = `${notice_mode} notice message, lib : ${n_msg.known_trx.pending}, head ${n_msg.known_blocks.pending}`;
                }
                break;
            case 'request_message':
                const r_msg = msg;
                log_msg = `request message`;
                break;
            case 'sync_request_message':
                const sr_msg = msg;
                log_msg = `sync request message`;
                break;
            case 'signed_block':
                const sb_msg = msg;
                const block_num_hex = sb_msg.previous.substr(0, 8); // first 64 bits
                const block_num = parseInt(block_num_hex, 16) + 1;
                log_msg = `#${block_num} signed by ${sb_msg.producer}`;
                break;
            case 'packed_transaction':
                const pt_msg = msg;
                const trx_bin = dist_1.Serialize.hexToUint8Array(pt_msg.packed_trx);
                const trx_id = sha256(trx_bin);
                log_msg = `Transaction ${trx_id}`;
                break;
        }
        if (!log_msg) {
            console.log('Unknown chunk', chunk);
        }
        else {
            console.log(`${prefix} - ${this.client_identifier} ${log_msg}`);
        }
        callback();
    }
}
exports.EOSIOStreamConsoleDebugger = EOSIOStreamConsoleDebugger;
//# sourceMappingURL=debugger.js.map