// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as crypto from "crypto";
import * as deepEqual from "fast-deep-equal";
import * as fs from "fs";
import * as jsonDiff from "json-diff";
import * as path from "path";
import { URL } from "url";
import * as util from "util";

import { MediaOverlayNode } from "@models/media-overlay";
import { Publication } from "@models/publication";
import { Link } from "@models/publication-link";
import { AudioBookis, isAudioBookPublication } from "@parser/audiobook";
import { isEPUBlication, lazyLoadMediaOverlays } from "@parser/epub";
import { PublicationParsePromise } from "@parser/publication-parser";
import { setLcpNativePluginPath } from "@r2-lcp-js/parser/epub/lcp";
import { JsonArray, JsonMap, TaJsonDeserialize, TaJsonSerialize } from "@r2-lcp-js/serializable";
import { isHTTP } from "@r2-utils-js/_utils/http/UrlUtils";
import { streamToBufferPromise } from "@r2-utils-js/_utils/stream/BufferUtils";
import { IStreamAndLength, IZip } from "@r2-utils-js/_utils/zip/zip";
import { Transformers } from "@transform/transformer";

import { initGlobalConverters_GENERIC, initGlobalConverters_SHARED } from "../init-globals";
import { zipHasEntry } from "./zipHasEntry";

// import { initGlobalConverters_OPDS } from "@opds/init-globals";

// initGlobalConverters_OPDS();
initGlobalConverters_SHARED();
initGlobalConverters_GENERIC();

setLcpNativePluginPath(path.join(process.cwd(), "LCP", "lcp.node"));

console.log("process.cwd():");
console.log(process.cwd());

console.log("__dirname: ");
console.log(__dirname);

const args = process.argv.slice(2);
console.log("args:");
console.log(args);

if (!args[0]) {
    console.log("FILEPATH ARGUMENT IS MISSING.");
    process.exit(1);
}
const argPath = args[0].trim();
let filePath = argPath;
console.log(filePath);

if (!isHTTP(filePath)) {
    if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, argPath);
        console.log(filePath);
        if (!fs.existsSync(filePath)) {
            filePath = path.join(process.cwd(), argPath);
            console.log(filePath);
            if (!fs.existsSync(filePath)) {
                console.log("FILEPATH DOES NOT EXIST.");
                process.exit(1);
            }
        }
    }

    const stats = fs.lstatSync(filePath);
    if (!stats.isFile() && !stats.isDirectory()) {
        console.log("FILEPATH MUST BE FILE OR DIRECTORY.");
        process.exit(1);
    }
}

let fileName = filePath;
if (isHTTP(filePath)) {
    const url = new URL(filePath);
    fileName = url.pathname;
}
fileName = fileName.replace(/META-INF[\/|\\]container.xml$/, "");
fileName = path.basename(fileName);

let outputDirPath: string | undefined;
if (args[1]) {
    const argDir = args[1].trim();
    let dirPath = argDir;
    console.log(dirPath);
    if (!fs.existsSync(dirPath)) {
        dirPath = path.join(__dirname, argDir);
        console.log(dirPath);
        if (!fs.existsSync(dirPath)) {
            dirPath = path.join(process.cwd(), argDir);
            console.log(dirPath);
            if (!fs.existsSync(dirPath)) {
                console.log("DIRPATH DOES NOT EXIST.");
                process.exit(1);
            } else {
                if (!fs.lstatSync(dirPath).isDirectory()) {
                    console.log("DIRPATH MUST BE DIRECTORY.");
                    process.exit(1);
                }
            }
        }
    }

    dirPath = fs.realpathSync(dirPath);

    const fileNameNoExt = fileName + "_R2_EXTRACTED";
    console.log(fileNameNoExt);
    outputDirPath = path.join(dirPath, fileNameNoExt);
    console.log(outputDirPath);
    if (fs.existsSync(outputDirPath)) {
        console.log("OUTPUT FOLDER ALREADY EXISTS!");
        process.exit(1);
    }
}

let decryptKeys: string[] | undefined;
if (args[2]) {
    decryptKeys = args[2].trim().split(";");
}

// tslint:disable-next-line:no-floating-promises
(async () => {
    let publication: Publication;
    try {
        publication = await PublicationParsePromise(filePath);
    } catch (err) {
        console.log("== Publication Parser: reject");
        console.log(err);
        return;
    }

    const isAnEPUB = isEPUBlication(filePath);
    let isAnAudioBook: AudioBookis | undefined;
    try {
        isAnAudioBook = await isAudioBookPublication(filePath);
    } catch (_err) {
        // console.log(err);
        // ignore
    }

    if ((publication || isAnAudioBook || isAnEPUB) && outputDirPath) {
        try {
            await extractEPUB(isAnEPUB ? true : false, publication, outputDirPath, decryptKeys);
        } catch (err) {
            console.log("== Publication extract FAIL");
            console.log(err);
            return;
        }
    } else { //  if (ext === ".cbz")
        await dumpPublication(publication);
    }
})();

function extractEPUB_ManifestJSON(pub: Publication, outDir: string, keys: string[] | undefined) {

    const manifestJson = TaJsonSerialize(pub);

    const arrLinks = [];
    if (manifestJson.readingOrder) {
        arrLinks.push(...(manifestJson.readingOrder as JsonArray));
    }
    if (manifestJson.resources) {
        arrLinks.push(...(manifestJson.resources as JsonArray));
    }

    if (keys) {
        arrLinks.forEach((link: any) => {
            if (link.properties && link.properties.encrypted &&
                link.properties.encrypted.scheme === "http://readium.org/2014/01/lcp") {
                delete link.properties.encrypted;

                let atLeastOne = false;
                const jsonProps = Object.keys(link.properties);
                if (jsonProps) {
                    jsonProps.forEach((jsonProp) => {
                        if (link.properties.hasOwnProperty(jsonProp)) {
                            atLeastOne = true;
                            return false;
                        }
                        return true;
                    });
                }
                if (!atLeastOne) {
                    delete link.properties;
                }
            }
        });
        if (manifestJson.links) {
            const lks = (manifestJson.links as JsonArray);
            let index = -1;
            for (let i = 0; i < lks.length; i++) {
                const link = lks[i] as JsonMap;
                if (link.type === "application/vnd.readium.lcp.license.v1.0+json"
                    && link.rel === "license") {
                        index = i;
                        break;
                    }
            }
            if (index >= 0) {
                lks.splice(index, 1);
            }
            if (lks.length === 0) {
                delete manifestJson.links;
            }
        }
    }

    arrLinks.forEach((link: any) => {
        if (link.properties && link.properties.encrypted &&
            (link.properties.encrypted.algorithm === "http://www.idpf.org/2008/embedding" ||
            link.properties.encrypted.algorithm === "http://ns.adobe.com/pdf/enc#RC")) {
            delete link.properties.encrypted;

            let atLeastOne = false;
            const jsonProps = Object.keys(link.properties);
            if (jsonProps) {
                jsonProps.forEach((jsonProp) => {
                    if (link.properties.hasOwnProperty(jsonProp)) {
                        atLeastOne = true;
                        return false;
                    }
                    return true;
                });
            }
            if (!atLeastOne) {
                delete link.properties;
            }
        }
    });

    const manifestJsonStr = JSON.stringify(manifestJson, null, "  ");
    // console.log(manifestJsonStr);

    const manifestJsonPath = path.join(outDir, "manifest.json");
    fs.writeFileSync(manifestJsonPath, manifestJsonStr, "utf8");
}

async function extractEPUB_Check(zip: IZip, outDir: string) {
    let zipEntries: string[] | undefined;
    try {
        zipEntries = await zip.getEntries();
    } catch (err) {
        console.log(err);
    }
    if (zipEntries) {
        for (const zipEntry of zipEntries) {
            if (zipEntry !== "mimetype" &&
                !zipEntry.startsWith("META-INF/") &&
                !zipEntry.endsWith(".opf") &&
                zipEntry !== "publication.json" &&
                zipEntry !== "license.lcpl" &&
                !zipEntry.endsWith(".DS_Store") &&
                !zipEntry.startsWith("__MACOSX/")) { // zip entry can actually be exploded EPUB file

                const expectedOutputPath = path.join(outDir, zipEntry);
                if (!fs.existsSync(expectedOutputPath)) {
                    console.log("Zip entry not extracted??");
                    console.log(expectedOutputPath);
                }
            }
        }
    }
}

async function extractEPUB_ProcessKeys(pub: Publication, keys: string[] | undefined) {

    if (!pub.LCP || !keys) {
        return;
    }

    const keysSha256Hex = keys.map((key) => {
        console.log("@@@");
        console.log(key);

        // sniffing for already-encoded plain-text passphrase
        // (looking for SHA256 checksum / hex digest)
        if (key.length === 64) { // 32 bytes
            let isHex = true;
            for (let i = 0; i < key.length; i += 2) {

                const hexByte = key.substr(i, 2).toLowerCase();

                const parsedInt = parseInt(hexByte, 16);
                if (isNaN(parsedInt)) {
                    isHex = false;
                    break;
                }

                // let hexByteCheck = parsedInt.toString(16);
                // if (hexByteCheck.length === 1) {
                //     hexByteCheck = "0" + hexByteCheck; // pad
                // }
                // // console.log(hexByteCheck);
                // if (hexByteCheck !== hexByte) {
                //     console.log(hexByte + " != " + hexByteCheck);
                //     isHex = false;
                //     break;
                // }
            }
            if (isHex) {
                return key;
            }
        }

        const checkSum = crypto.createHash("sha256");
        checkSum.update(key);
        const keySha256Hex = checkSum.digest("hex");
        console.log(keySha256Hex);
        return keySha256Hex;

        // const lcpPass64 = Buffer.from(hash).toString("base64");
        // const lcpPassHex = Buffer.from(lcpPass64, "base64").toString("utf8");
    });

    try {
        await pub.LCP.tryUserKeys(keysSha256Hex);
    } catch (err) {
        console.log(err);
        throw Error("FAIL publication.LCP.tryUserKeys()");

        // DRMErrorCode (from r2-lcp-client)
        // 1 === NO CORRECT PASSPHRASE / UERKEY IN GIVEN ARRAY
        //     // No error
        //     NONE = 0,
        //     /**
        //         WARNING ERRORS > 10
        //     **/
        //     // License is out of date (check start and end date)
        //     LICENSE_OUT_OF_DATE = 11,
        //     /**
        //         CRITICAL ERRORS > 100
        //     **/
        //     // Certificate has been revoked in the CRL
        //     CERTIFICATE_REVOKED = 101,
        //     // Certificate has not been signed by CA
        //     CERTIFICATE_SIGNATURE_INVALID = 102,
        //     // License has been issued by an expired certificate
        //     LICENSE_SIGNATURE_DATE_INVALID = 111,
        //     // License signature does not match
        //     LICENSE_SIGNATURE_INVALID = 112,
        //     // The drm context is invalid
        //     CONTEXT_INVALID = 121,
        //     // Unable to decrypt encrypted content key from user key
        //     CONTENT_KEY_DECRYPT_ERROR = 131,
        //     // User key check invalid
        //     USER_KEY_CHECK_INVALID = 141,
        //     // Unable to decrypt encrypted content from content key
        //     CONTENT_DECRYPT_ERROR = 151
    }
}

async function extractEPUB_Link(pub: Publication, zip: IZip, outDir: string, link: Link) {

    const hrefDecoded = link.HrefDecoded;
    console.log("===== " + hrefDecoded);
    if (!hrefDecoded) {
        console.log("!?link.HrefDecoded");
        return;
    }

    const has = await zipHasEntry(zip, hrefDecoded, link.Href);
    if (!has) {
        console.log(`NOT IN ZIP (extractEPUB_Link): ${link.Href} --- ${hrefDecoded}`);
        const zipEntries = await zip.getEntries();
        for (const zipEntry of zipEntries) {
            console.log(zipEntry);
        }
        return;
    }

    let zipStream_: IStreamAndLength;
    try {
        zipStream_ = await zip.entryStreamPromise(hrefDecoded);
    } catch (err) {
        console.log(hrefDecoded);
        console.log(err);
        return;
    }

    let transformedStream: IStreamAndLength;
    try {
        transformedStream = await Transformers.tryStream(
            pub, link, undefined,
            zipStream_,
            false,
            0,
            0,
            undefined,
        );
    } catch (err) {
        // Note that the "LCP not ready!" message is a warning, not an error caught here.
        console.log(hrefDecoded);
        console.log(err);
        return;
    }

    // if (transformedStream !== zipStream_) {
    //     console.log("(asset transformed)");
    // }
    zipStream_ = transformedStream; // can be unchanged

    let zipData: Buffer;
    try {
        zipData = await streamToBufferPromise(zipStream_.stream);
    } catch (err) {
        console.log(hrefDecoded);
        console.log(err);
        return;
    }
    // console.log("CHECK: " + zipStream_.length + " ==> " + zipData.length);

    const linkOutputPath = path.join(outDir, hrefDecoded);
    ensureDirs(linkOutputPath);
    fs.writeFileSync(linkOutputPath, zipData);
}

async function extractEPUB(isEPUB: boolean, pub: Publication, outDir: string, keys: string[] | undefined) {

    // automatically handles exploded filesystem too,
    // via the zip-ex.ts abstraction in r2-utils-js
    // returned by zip-factory.ts (zipLoadPromise() function)
    const zipInternal = pub.findFromInternal("zip");
    if (!zipInternal) {
        console.log("No publication zip!?");
        return;
    }

    const zip = zipInternal.Value as IZip;

    try {
        await extractEPUB_ProcessKeys(pub, keys);
    } catch (err) {
        console.log(err);
        throw err;
    }

    fs.mkdirSync(outDir); // { recursive: false }

    extractEPUB_ManifestJSON(pub, outDir, keys);

    const links = [];
    if (pub.Resources) {
        links.push(...pub.Resources);
    }
    if (pub.Spine) { // JSON.readingOrder
        links.push(...pub.Spine);
    }
    // if (await zipHasEntry(zip, "META-INF/container.xml", undefined)) {
    //     const l = new Link();
    //     l.setHrefDecoded("META-INF/container.xml");
    //     links.push(l);
    // }
    if (!keys) {
        const lic = (isEPUB ? "META-INF/" : "") + "license.lcpl";
        const has = await zipHasEntry(zip, lic, undefined);
        if (has) {
            const l = new Link();
            l.setHrefDecoded(lic);
            links.push(l);
        }
    }
    for (const link of links) {
        try {
            await extractEPUB_Link(pub, zip, outDir, link);
        } catch (err) {
            console.log(err);
        }
    }

    try {
        await extractEPUB_Check(zip, outDir);
    } catch (err) {
        console.log(err);
    }
}

function ensureDirs(fspath: string) {
    const dirname = path.dirname(fspath);

    if (!fs.existsSync(dirname)) {
        ensureDirs(dirname);
        fs.mkdirSync(dirname);
    }
}

async function dumpPublication(publication: Publication): Promise<void> {

    console.log("#### RAW OBJECT:");
    // breakLength: 100  maxArrayLength: undefined
    console.log(util.inspect(publication,
        { showHidden: false, depth: 1000, colors: true, customInspect: true }));

    const publicationJsonObj = TaJsonSerialize(publication);
    console.log(util.inspect(publicationJsonObj,
        { showHidden: false, depth: 1000, colors: true, customInspect: true }));

    const publicationJsonStr = global.JSON.stringify(publicationJsonObj, null, "  ");

    // const publicationJsonStrCanonical = JSON.stringify(sortObject(publicationJsonObj));

    const publicationReverse = TaJsonDeserialize(publicationJsonObj, Publication);
    // publicationReverse.AddLink("fake type", ["fake rel"], "fake url", undefined);

    const publicationJsonObjReverse = TaJsonSerialize(publicationReverse);

    const eq = deepEqual(publicationJsonObj, publicationJsonObjReverse);
    if (!eq) {
        console.log("#### TA-JSON SERIALIZED JSON OBJ:");
        console.log(publicationJsonObj);

        console.log("#### STRINGIFIED JSON OBJ:");
        console.log(publicationJsonStr);

        // console.log("#### CANONICAL JSON:");
        // console.log(publicationJsonStrCanonical);

        console.log("#### TA-JSON DESERIALIZED (REVERSE):");
        console.log(util.inspect(publicationReverse,
            { showHidden: false, depth: 1000, colors: true, customInspect: true }));

        console.log("#### TA-JSON SERIALIZED JSON OBJ (REVERSE):");
        console.log(publicationJsonObjReverse);

        console.log("#### REVERSE NOT DEEP EQUAL!\n\n");
        console.log("#### REVERSE NOT DEEP EQUAL!\n\n");
        console.log("#### REVERSE NOT DEEP EQUAL!\n\n");
    }
    console.log(jsonDiff.diffString(publicationJsonObj, publicationJsonObjReverse));

    if (publication.Spine) {
        for (const spineItem of publication.Spine) {
            if (spineItem.Properties && spineItem.Properties.MediaOverlay) {
                console.log(spineItem.Href);
                console.log(spineItem.Properties.MediaOverlay);
                console.log(spineItem.Duration);
            }
            if (spineItem.Alternate) {
                for (const altLink of spineItem.Alternate) {
                    if (altLink.TypeLink === "application/vnd.syncnarr+json") {
                        console.log(altLink.Href);
                        console.log(altLink.TypeLink);
                        console.log(altLink.Duration);
                    }
                }
            }
            if (spineItem.MediaOverlays) {
                const mo = spineItem.MediaOverlays;
                console.log(mo.SmilPathInZip);
                // mo.initialized true/false automatically handled
                try {
                    await lazyLoadMediaOverlays(publication, mo);
                } catch (err) {
                    return Promise.reject(err);
                }
                // console.log(util.inspect(mo,
                //     { showHidden: false, depth: 1000, colors: true, customInspect: true }));
                const moJsonObj = TaJsonSerialize(mo);
                // console.log(util.inspect(moJsonObj,
                //     { showHidden: false, depth: 1000, colors: true, customInspect: true }));

                const moJsonStr = global.JSON.stringify(moJsonObj, null, "  ");
                console.log(moJsonStr.substr(0, 1000) + "\n...\n");

                // const moJsonStrCanonical = JSON.stringify(sortObject(moJsonObj));

                const moReverse = TaJsonDeserialize(moJsonObj, MediaOverlayNode);
                // moReverse.AddLink("fake type", ["fake rel"], "fake url", undefined);

                const moJsonObjReverse = TaJsonSerialize(moReverse);

                const equa = deepEqual(moJsonObj, moJsonObjReverse);
                if (!equa) {
                    console.log("#### TA-JSON SERIALIZED JSON OBJ:");
                    console.log(moJsonObj);

                    console.log("#### STRINGIFIED JSON OBJ:");
                    console.log(moJsonStr);

                    // console.log("#### CANONICAL JSON:");
                    // console.log(moJsonStrCanonical);

                    console.log("#### TA-JSON DESERIALIZED (REVERSE):");
                    console.log(util.inspect(moReverse,
                        { showHidden: false, depth: 1000, colors: true, customInspect: true }));

                    console.log("#### TA-JSON SERIALIZED JSON OBJ (REVERSE):");
                    console.log(moJsonObjReverse);

                    console.log("#### REVERSE NOT DEEP EQUAL!\n\n");
                    console.log("#### REVERSE NOT DEEP EQUAL!\n\n");
                    console.log("#### REVERSE NOT DEEP EQUAL!\n\n");
                }
                console.log(jsonDiff.diffString(moJsonObj, moJsonObjReverse));
            }
        }
    }
}
