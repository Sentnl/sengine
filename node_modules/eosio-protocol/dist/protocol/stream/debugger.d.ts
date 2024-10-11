/// <reference types="node" />
import * as stream from 'stream';
export declare class EOSIOStreamConsoleDebugger extends stream.Writable {
    private prefix;
    private client_identifier;
    constructor(options: any);
    _write(chunk: any, encoding: string, callback: (error?: (Error | null)) => void): void;
}
