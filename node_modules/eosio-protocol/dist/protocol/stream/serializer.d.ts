/// <reference types="node" />
import * as stream from 'stream';
export declare class EOSIOStreamSerializer extends stream.Transform {
    constructor(options: any);
    _transform(data: any, encoding: any, callback: any): void;
    serialize_message([type, type_name, data]: [any, any, any]): Buffer;
}
