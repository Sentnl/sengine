import { EOSIOP2PClientConnection } from './connection';
export declare class EOSIOSharedState {
    chain_id: string;
    head_block_num: number;
    head_block_id: string;
    last_irreversible_block_num: number;
    last_irreversible_block_id: string;
    private json;
    load(): void;
    save(): void;
    get(): {
        chain_id: string;
        head_block_num: number;
        head_block_id: string;
        last_irreversible_block_num: number;
        last_irreversible_block_id: string;
    };
}
export declare class EOSIOP2PClient extends EOSIOP2PClientConnection {
    private current_buffer;
    private api;
    my_info: any;
    private types;
    constructor({ host, port, api, debug }: {
        host: any;
        port: any;
        api: any;
        debug: any;
    });
    debug(...msg: any[]): void;
    error(...msg: any[]): void;
    get_block_id(block_num_or_id: number | string): Promise<string>;
    get_prev_info(info: any, num?: number): Promise<any>;
}
