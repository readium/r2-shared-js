// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as path from "path";

import { Publication } from "@models/publication";
import { TaJsonDeserialize } from "@r2-lcp-js/serializable";
import { isHTTP } from "@r2-utils-js/_utils/http/UrlUtils";
import { streamToBufferPromise } from "@r2-utils-js/_utils/stream/BufferUtils";
import { IStreamAndLength, IZip } from "@r2-utils-js/_utils/zip/zip";
import { zipLoadPromise } from "@r2-utils-js/_utils/zip/zipFactory";

import { zipHasEntry } from "../_utils/zipHasEntry";

const debug = debug_("r2:shared#parser/audiobook");

export async function AudioBookParsePromise(filePath: string): Promise<Publication> {

    const isAnAudioBook = await isAudioBookPublication(filePath);

    // // excludes AudioBookis.RemoteExploded
    // const canLoad = isAnAudioBook === AudioBookis.LocalExploded ||
    //     isAnAudioBook === AudioBookis.LocalPacked ||
    //     isAnAudioBook === AudioBookis.RemotePacked;
    // if (!canLoad) {
    //     // TODO? r2-utils-js zip-ext.ts => variant for HTTP without directory listing? (no deterministic zip entries)
    //     const err = "Cannot load exploded remote EPUB (needs filesystem access to list directory contents).";
    //     debug(err);
    //     return Promise.reject(err);
    // }

    let entryName = "manifest.json";

    let filePathToLoad = filePath;
    if (isAnAudioBook === AudioBookis.LocalExploded) { // (must ensure is directory/folder)
        filePathToLoad = path.dirname(filePathToLoad) + "/";
    } else if (isAnAudioBook === AudioBookis.RemoteExploded) {
        const url = new URL(filePathToLoad);
        entryName = path.basename(url.pathname);
        url.pathname = path.dirname(url.pathname) + "/";

        // contains trailing slash
        filePathToLoad = url.toString();
    }

    let zip: IZip;
    try {
        zip = await zipLoadPromise(filePathToLoad);
    } catch (err) {
        return Promise.reject(err);
    }

    if (!zip.hasEntries()) {
        return Promise.reject("AudioBook zip empty");
    }
    if (isAnAudioBook === AudioBookis.LocalExploded ||
        isAnAudioBook === AudioBookis.LocalPacked) {

        const has = await zipHasEntry(zip, entryName, undefined);
        if (!has) {
            const zipEntries = await zip.getEntries();
            for (const zipEntry of zipEntries) {
                debug(zipEntry);
            }
            return Promise.reject("AudioBook no manifest?!");
        }
    }

    // let entries: string[];
    // try {
    //     entries = await zip.getEntries();
    // } catch (err) {
    //     console.log(err);
    //     return Promise.reject("Problem getting AudioBook zip entries");
    // }
    // for (const entryName of entries) {
    //     // debug("++ZIP: entry");
    //     // debug(entryName);

    //     if (entryName === "manifest.json") {
    //         // import { tryDecodeURI } from "../_utils/decodeURI";
    //         // const entryNameDecoded = tryDecodeURI(entryName);
    //         // if (!entryNameDecoded) {
    //         //     return Promise.reject(`Cannot decode URI?! ${entryName}`);
    //         // }
    //     }
    // }

    let manifestZipStream_: IStreamAndLength;
    try {
        manifestZipStream_ = await zip.entryStreamPromise(entryName);
    } catch (err) {
        debug(err);
        return Promise.reject(`Problem streaming AudioBook zip entry?! ${entryName}`);
    }
    const manifestZipStream = manifestZipStream_.stream;
    let manifestZipData: Buffer;
    try {
        manifestZipData = await streamToBufferPromise(manifestZipStream);
    } catch (err) {
        debug(err);
        return Promise.reject(`Problem buffering AudioBook zip entry?! ${entryName}`);
    }

    const manifestJsonStr = manifestZipData.toString("utf8");
    const manifestJson = JSON.parse(manifestJsonStr);

    const publication = TaJsonDeserialize<Publication>(manifestJson, Publication);

    publication.AddToInternal("type", "audiobook");
    publication.AddToInternal("zip", zip);

    return Promise.resolve(publication);
}

// https://api.archivelab.org/books/armand_durand/opds_audio_manifest
// https://api.archivelab.org/books/art_letters_1809_librivox/opds_audio_manifest
// curl -s -L -I -X GET xxx
// Content-Type: application/audiobook+json; charset=utf-8
export enum AudioBookis {
    LocalExploded = "LocalExploded",
    LocalPacked = "LocalPacked",
    RemoteExploded = "RemoteExploded",
    // RemotePacked = "RemotePacked",
}
export async function isAudioBookPublication(urlOrPath: string): Promise<AudioBookis> {
    let p = urlOrPath;
    const isHttp = isHTTP(urlOrPath);
    if (isHttp) {
        const url = new URL(urlOrPath);
        p = url.pathname;
    } else {
        const manPath = path.join(urlOrPath, "manifest.json");
        if (fs.existsSync(manPath)) {
            const manStr = fs.readFileSync(manPath, { encoding: "utf8" });
            const manJson = JSON.parse(manStr);
            if (manJson["@type"] === "https://schema.org/Audiobook") {
                return AudioBookis.LocalExploded;
            }
        }
    }
    const fileName = path.basename(p);
    const ext = path.extname(fileName).toLowerCase();

    const audio = /\.audiobook?$/.test(ext);
    if (audio) {
        // return isHttp ? AudioBookis.RemotePacked : AudioBookis.LocalPacked;
        if (!isHttp) {
            return AudioBookis.LocalPacked;
        }
    }

    // // filePath.replace(/\//, "/").endsWith("audiobook/manifest.json")
    // if (/audiobook[\/|\\]manifest.json$/.test(p)) {
    //     return isHttp ? AudioBookis.RemoteExploded : AudioBookis.LocalExploded;
    // }

    if (isHttp) {
        async function doRequest(u: string): Promise<AudioBookis> {
            return new Promise((resolve, reject) => {
                const url = new URL(u);
                const secure = url.protocol === "https:";
                const options = {
                    headers: {
                        "Accept": "*/*,application/audiobook+json",
                        "Accept-Language": "en-UK,en-US;q=0.7,en;q=0.5",
                        "Host": url.host,
                        "User-Agent": "Readium2-AudioBooks",
                    },
                    host: url.host,
                    method: "GET",
                    path: url.pathname + url.search,
                    port: secure ? 443 : 80,
                    protocol: url.protocol,
                };
                debug(JSON.stringify(options));
                const req = (secure ? https : http).request(options, (res) => {
                    if (!res) {
                        reject(`HTTP no response ${u}`);
                        return;
                    }

                    debug(res.statusCode);
                    debug(JSON.stringify(res.headers));

                    if (res.statusCode && (res.statusCode >= 300 && res.statusCode < 400)) {
                        const loc = res.headers.Location || res.headers.location;
                        if (loc && loc.length) {
                            const l = Array.isArray(loc) ? loc[0] : loc;
                            process.nextTick(async () => {
                                try {
                                    const redirectRes = await doRequest(l);
                                    resolve(redirectRes);
                                } catch (err) {
                                    reject(`HTTP audiobook redirect, then fail ${u} ${err}`);
                                }
                            });
                        } else {
                            reject(`HTTP audiobook redirect without location?! ${u}`);
                        }
                        return;
                    }
                    const type = res.headers["Content-Type"] || res.headers["content-type"];
                    if (type && type.includes("application/audiobook+json")) {
                        resolve(AudioBookis.RemoteExploded);
                        return;
                    }
                    reject(`Not HTTP audiobook type ${u}`);
                }).on("error", (err) => {
                    debug(err);
                    reject(`HTTP error ${u} ${err}`);
                });
                req.end();
            });
        }
        return doRequest(urlOrPath);
    }

    return Promise.reject("Cannot determine audiobook type");
}
