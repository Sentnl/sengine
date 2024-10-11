declare class OrderedChecksum {
    mode: number;
    pending: number;
    ids: string[];
}
export declare class NetMessage {
    type_name: string;
    type: number;
    constructor();
    copy(data: object): void;
    static from(type: number): NetMessage;
}
export declare class HandshakeMessage extends NetMessage {
    type_name: string;
    type: number;
    network_version: number;
    chain_id: string;
    node_id: string;
    key: string;
    time: string;
    token: string;
    sig: string;
    p2p_address: string;
    last_irreversible_block_num: number;
    last_irreversible_block_id: string;
    head_num: number;
    head_id: string;
    os: string;
    agent: string;
    generation: number;
}
export declare class ChainSizeMessage extends NetMessage {
    type_name: string;
    type: number;
    last_irreversible_block_num: number;
    last_irreversible_block_id: string;
    head_num: number;
    head_id: string;
}
export declare class GoAwayMessage extends NetMessage {
    type_name: string;
    type: number;
    static reasons: string[];
    reason: number;
    node_id: string;
}
export declare class TimeMessage extends NetMessage {
    type_name: string;
    type: number;
    org: BigInt;
    rec: BigInt;
    xmt: BigInt;
    dst: BigInt;
}
export declare class NoticeMessage extends NetMessage {
    type_name: string;
    type: number;
    static modes: string[];
    known_trx: OrderedChecksum;
    known_blocks: OrderedChecksum;
}
export declare class RequestMessage extends NetMessage {
    type_name: string;
    type: number;
    req_trx: OrderedChecksum;
    req_blocks: OrderedChecksum;
}
export declare class SyncRequestMessage extends NetMessage {
    type_name: string;
    type: number;
    start_block: number;
    end_block: number;
}
export declare class SignedBlockMessage extends NetMessage {
    type_name: string;
    type: number;
    timestamp: string;
    producer: string;
    confirmed: number;
    previous: string;
    transaction_mroot: string;
    action_mroot: string;
    schedule_version: number;
    new_producers: any[];
    header_extensions: any[];
    producer_signature: string;
    transactions: any[];
    block_extensions: any[];
}
export declare class PackedTransactionMessage extends NetMessage {
    type_name: string;
    type: number;
    signatures: string[];
    compression: boolean;
    packed_context_free_data: string;
    packed_trx: string;
}
export {};
