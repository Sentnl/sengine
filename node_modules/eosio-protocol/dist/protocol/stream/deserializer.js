"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EOSIOStreamDeserializer = void 0;
const stream = require("stream");
const { Serialize } = require('eosjs');
const net_protocol_1 = require("../net-protocol");
const { TextDecoder, TextEncoder } = require('util');
/*
Deserializing stream

Transform stream which reads tokenised binary messages from the EOSIOStreamTokenizer
 */
class EOSIOStreamDeserializer extends stream.Transform {
    constructor(options) {
        super({ readableObjectMode: true, highWaterMark: 1024 * 1024 });
    }
    _transform(data, encoding, callback) {
        try {
            const msg = this.deserialize_message(data);
            if (msg) {
                // console.log(`Sending from deserializer `, msg);
                this.push(msg);
            }
            callback();
        }
        catch (e) {
            this.destroy(new Error(`Failed to deserialize`));
            console.error(e);
            callback(`Failed to deserialize`);
        }
    }
    deserialize_message(array) {
        const sb = new Serialize.SerialBuffer({
            textEncoder: new TextEncoder(),
            textDecoder: new TextDecoder(),
            array
        });
        const len = sb.getUint32();
        const type = sb.get();
        const msg_types = net_protocol_1.NetProtocol.variant_types();
        const type_name = msg_types[type];
        if (typeof type_name === 'undefined') {
            throw new Error(`Unknown message type "${type}" while deserializing`);
        }
        return [type, type_name, net_protocol_1.NetProtocol.types.get(type_name).deserialize(sb)];
    }
}
exports.EOSIOStreamDeserializer = EOSIOStreamDeserializer;
//# sourceMappingURL=deserializer.js.map