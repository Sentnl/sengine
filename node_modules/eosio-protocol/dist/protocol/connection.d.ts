/// <reference types="node" />
import * as EventEmitter from 'events';
import * as stream from 'stream';
import { NetMessage } from './messages';
export declare class EOSIOP2PClientConnection extends EventEmitter {
    protected host: string;
    protected port: number;
    protected client: any;
    protected _debug: boolean;
    constructor({ host, port, api, debug }: {
        host: any;
        port: any;
        api: any;
        debug: any;
    });
    debug(...msg: any[]): void;
    error(...msg: any[]): void;
    connect(): Promise<stream.Stream>;
    disconnect(): void;
    send_message(msg: NetMessage): Promise<void>;
}
