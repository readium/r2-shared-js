// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { Publication } from "@models/publication";
import { Link } from "@models/publication-link";
import { bufferToStream, streamToBufferPromise } from "@utils/stream/BufferUtils";
import { IStreamAndLength } from "@utils/zip/zip";

import { ITransformer } from "./transformer";

export class TransformerObfAdobe implements ITransformer {
    public supports(_publication: Publication, link: Link): boolean {
        return link.Properties && link.Properties.Encrypted &&
            link.Properties.Encrypted.Algorithm === "http://ns.adobe.com/pdf/enc#RC";
    }

    public async transformStream(
        publication: Publication, link: Link,
        stream: IStreamAndLength,
        _isPartialByteRangeRequest: boolean,
        _partialByteBegin: number, _partialByteEnd: number): Promise<IStreamAndLength> {

        let data: Buffer;
        try {
            data = await streamToBufferPromise(stream.stream);
        } catch (err) {
            return Promise.reject(err);
        }

        let buff: Buffer;
        try {
            buff = await this.transformBuffer(publication, link, data);
        } catch (err) {
            return Promise.reject(err);
        }

        const sal: IStreamAndLength = {
            length: buff.length,
            reset: async () => {
                return Promise.resolve(sal);
            },
            stream: bufferToStream(buff),
        };
        return Promise.resolve(sal);
    }

    private async transformBuffer(publication: Publication, _link: Link, data: Buffer): Promise<Buffer> {

        let pubID = publication.Metadata.Identifier;
        pubID = pubID.replace("urn:uuid:", "");
        pubID = pubID.replace(/-/g, "");
        pubID = pubID.replace(/\s/g, "");

        const key = [];
        for (let i = 0; i < 16; i++) {
            const byteHex = pubID.substr(i * 2, 2);
            const byteNumer = parseInt(byteHex, 16);
            key.push(byteNumer);
        }

        const prefixLength = 1024;
        const zipDataPrefix = data.slice(0, prefixLength);

        for (let i = 0; i < prefixLength; i++) {
            /* tslint:disable:no-bitwise */
            zipDataPrefix[i] = zipDataPrefix[i] ^ (key[i % key.length]);
        }

        const zipDataRemainder = data.slice(prefixLength);
        return Promise.resolve(Buffer.concat([zipDataPrefix, zipDataRemainder]));
    }

    // public async getDecryptedSizeStream(
    //     publication: Publication, link: Link,
    //     stream: IStreamAndLength): Promise<number> {
    //     let sal: IStreamAndLength;
    //     try {
    //         sal = await this.transformStream(publication, link, stream, false, 0, 0);
    //     } catch (err) {
    //         console.log(err);
    //         return Promise.reject("WTF?");
    //     }
    //     return Promise.resolve(sal.length);
    // }

    // public async getDecryptedSizeBuffer(publication: Publication, link: Link, data: Buffer): Promise<number> {
    //     let buff: Buffer;
    //     try {
    //         buff = await this.transformBuffer(publication, link, data);
    //     } catch (err) {
    //         console.log(err);
    //         return Promise.reject("WTF?");
    //     }
    //     return Promise.resolve(buff.length);
    // }
}
