"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EOSIOP2PClient = exports.EOSIOSharedState = void 0;
const fetch = require('node-fetch');
const net_protocol_1 = require("./net-protocol");
const connection_1 = require("./connection");
/*
Node implementation (work in progress)
 */
class EOSIOSharedState {
    json() {
        return {
            chain_id: this.chain_id,
            head_block_num: this.head_block_num,
            head_block_id: this.head_block_id,
            last_irreversible_block_num: this.last_irreversible_block_num,
            last_irreversible_block_id: this.last_irreversible_block_id,
        };
    }
    load() { }
    save() { }
    get() {
        return this.json();
    }
}
exports.EOSIOSharedState = EOSIOSharedState;
class EOSIOP2PClient extends connection_1.EOSIOP2PClientConnection {
    constructor({ host, port, api, debug }) {
        super({ host, port, api, debug });
        this.api = api;
        this.current_buffer = new Uint8Array();
        this.my_info; // state of current node
        this.types = net_protocol_1.NetProtocol.types;
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
    async get_block_id(block_num_or_id) {
        const res = await fetch(`${this.api}/v1/chain/get_block`, {
            method: 'POST',
            body: JSON.stringify({ block_num_or_id })
        });
        const info = await res.json();
        return info.id;
    }
    async get_prev_info(info, num = 1000) {
        if (num > 0) {
            info.head_block_num -= num;
            info.last_irreversible_block_num -= num;
            info.head_block_id = await this.get_block_id(info.head_block_num);
            info.last_irreversible_block_id = await this.get_block_id(info.last_irreversible_block_num);
        }
        return info;
    }
}
exports.EOSIOP2PClient = EOSIOP2PClient;
//# sourceMappingURL=client.js.map