/// <reference types="node" />
import * as stream from 'stream';
export declare class EOSIOStreamDeserializer extends stream.Transform {
    constructor(options: any);
    _transform(data: any, encoding: any, callback: any): void;
    deserialize_message(array: any): any[];
}
