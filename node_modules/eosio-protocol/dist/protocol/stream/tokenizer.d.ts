/// <reference types="node" />
import * as stream from 'stream';
export declare class EOSIOStreamTokenizer extends stream.Transform {
    private array;
    private buffer;
    constructor(options: any);
    _transform(data: any, encoding: any, callback: any): void;
    _flush(callback: any): void;
    process(): any;
}
