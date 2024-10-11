"use strict";
/*
Net protocol message types

   using net_message = static_variant<handshake_message,
                                      chain_size_message,
                                      go_away_message,
                                      time_message,
                                      notice_message,
                                      request_message,
                                      sync_request_message,
                                      signed_block,         // which = 7
                                      packed_transaction>;  // which = 8
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackedTransactionMessage = exports.SignedBlockMessage = exports.SyncRequestMessage = exports.RequestMessage = exports.NoticeMessage = exports.TimeMessage = exports.GoAwayMessage = exports.ChainSizeMessage = exports.HandshakeMessage = exports.NetMessage = void 0;
class OrderedChecksum {
}
class NetMessage {
    constructor() {
        this.type_name = '';
        this.type = -1;
    }
    copy(data) {
        for (var p in data) {
            this[p] = data[p];
        }
    }
    static from(type) {
        switch (type) {
            case 0:
                return new HandshakeMessage();
                break;
            case 1:
                return new ChainSizeMessage();
                break;
            case 2:
                return new GoAwayMessage();
                break;
            case 3:
                return new TimeMessage();
                break;
            case 4:
                return new NoticeMessage();
                break;
            case 5:
                return new RequestMessage();
                break;
            case 6:
                return new SyncRequestMessage();
                break;
            case 7:
                return new SignedBlockMessage();
                break;
            case 8:
                return new PackedTransactionMessage();
                break;
            default:
                throw new Error(`Unknown message type ${type}`);
        }
    }
}
exports.NetMessage = NetMessage;
class HandshakeMessage extends NetMessage {
    constructor() {
        super(...arguments);
        this.type_name = 'handshake_message';
        this.type = 0;
    }
}
exports.HandshakeMessage = HandshakeMessage;
class ChainSizeMessage extends NetMessage {
    constructor() {
        super(...arguments);
        this.type_name = 'chain_size_message';
        this.type = 1;
    }
}
exports.ChainSizeMessage = ChainSizeMessage;
class GoAwayMessage extends NetMessage {
    constructor() {
        super(...arguments);
        this.type_name = 'go_away_message';
        this.type = 2;
    }
}
exports.GoAwayMessage = GoAwayMessage;
GoAwayMessage.reasons = [
    'no reason',
    'self connect',
    'duplicate',
    'wrong chain',
    'wrong version',
    'chain is forked',
    'unlinkable block received',
    'bad transaction',
    'invalid block',
    'authentication failure',
    'some other failure',
    'some other non-fatal condition'
];
class TimeMessage extends NetMessage {
    constructor() {
        super(...arguments);
        this.type_name = 'time_message';
        this.type = 3;
    }
}
exports.TimeMessage = TimeMessage;
class NoticeMessage extends NetMessage {
    constructor() {
        super(...arguments);
        this.type_name = 'notice_message';
        this.type = 4;
    }
}
exports.NoticeMessage = NoticeMessage;
NoticeMessage.modes = [
    'none',
    'catch up',
    'lib catch up',
    'normal'
];
class RequestMessage extends NetMessage {
    constructor() {
        super(...arguments);
        this.type_name = 'request_message';
        this.type = 5;
    }
}
exports.RequestMessage = RequestMessage;
class SyncRequestMessage extends NetMessage {
    constructor() {
        super(...arguments);
        this.type_name = 'sync_request_message';
        this.type = 6;
    }
}
exports.SyncRequestMessage = SyncRequestMessage;
class SignedBlockMessage extends NetMessage {
    constructor() {
        super(...arguments);
        this.type_name = 'signed_block';
        this.type = 7;
    }
}
exports.SignedBlockMessage = SignedBlockMessage;
class PackedTransactionMessage extends NetMessage {
    constructor() {
        super(...arguments);
        this.type_name = 'packed_transaction';
        this.type = 8;
    }
}
exports.PackedTransactionMessage = PackedTransactionMessage;
//# sourceMappingURL=messages.js.map