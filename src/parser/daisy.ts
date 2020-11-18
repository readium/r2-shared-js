// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";
import * as fs from "fs";
import * as moment from "moment";
import * as path from "path";

import { Metadata } from "@models/metadata";
import { Publication } from "@models/publication";
import { Link } from "@models/publication-link";
import { isHTTP } from "@r2-utils-js/_utils/http/UrlUtils";
import { IZip } from "@r2-utils-js/_utils/zip/zip";
import { zipLoadPromise } from "@r2-utils-js/_utils/zip/zipFactory";

import { zipHasEntry } from "../_utils/zipHasEntry";
import {
    addIdentifier, addLanguage, addMediaOverlaySMIL, addOtherMetadata, addTitle,
    fillPublicationDate, fillSpineAndResource, fillSubject, fillTOC, findContributorInMeta, getNcx,
    getOpf, lazyLoadMediaOverlays, setPublicationDirection, updateDurations,
} from "./epub-daisy-common";
import { Rootfile } from "./epub/container-rootfile";
import { NCX } from "./epub/ncx";
import { OPF } from "./epub/opf";
import { Manifest } from "./epub/opf-manifest";

const debug = debug_("r2:shared#parser/daisy");

export enum DaisyBookis {
    LocalExploded = "LocalExploded",
    LocalPacked = "LocalPacked",
    RemoteExploded = "RemoteExploded",
    RemotePacked = "RemotePacked",
}

export async function isDaisyPublication(urlOrPath: string): Promise<DaisyBookis | undefined> {
    let p = urlOrPath;
    const http = isHTTP(urlOrPath);
    if (http) {
        const url = new URL(urlOrPath);
        p = url.pathname;
        return undefined; // remote DAISY not supported
    } else if (/\.daisy[23]?$/.test(path.extname(path.basename(p)).toLowerCase())) {

        return DaisyBookis.LocalPacked;

    } else if (fs.existsSync(path.join(urlOrPath, "package.opf")) ||
        fs.existsSync(path.join(urlOrPath, "Book.opf")) ||
        fs.existsSync(path.join(urlOrPath, "speechgen.opf"))
    ) {
        if (!fs.existsSync(path.join(urlOrPath, "META-INF", "container.xml"))) {

            return DaisyBookis.LocalExploded;
        }
    } else {
        let zip: IZip;
        try {
            zip = await zipLoadPromise(urlOrPath);
        } catch (err) {
            debug(err);
            return Promise.reject(err);
        }
        if (!await zipHasEntry(zip, "META-INF/container.xml", undefined) &&
            (await zipHasEntry(zip, "package.opf", undefined) ||
                await zipHasEntry(zip, "Book.opf", undefined) ||
                await zipHasEntry(zip, "speechgen.opf", undefined))) {

            return DaisyBookis.LocalPacked;
        }
    }
    return undefined;
}

// const isFileValid = (files: string[]) => {
//     // const keys = Object.keys(files);

//     if (files.some((file) => file.match(/\.xml$/)) === false) {
//         return [false, "No xml file found."];
//     }

//     if (files.some((file) => file.match(/\/ncc\.html$/))) {
//         return [false, "DAISY 2 format is not supported."];
//     }

//     // if (files.some((file) => file.match(/\.mp3$/)) === false) {
//     //   console.log("mp3");
//     //   return [false];
//     // }
//     // if (files.some((file) => file.match(/\.smil$/)) === false) {
//     //   console.log("smil");
//     //   return [false];
//     // }

//     return [true];
// };

export async function DaisyParsePromise(filePath: string): Promise<Publication> {

    // const isDaisy = await isDaisyPublication(filePath);

    let zip: IZip;
    try {
        zip = await zipLoadPromise(filePath);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }

    if (!zip.hasEntries()) {
        return Promise.reject("Daisy zip empty");
    }

    const publication = new Publication();
    publication.Context = ["https://readium.org/webpub-manifest/context.jsonld"];
    publication.Metadata = new Metadata();
    publication.Metadata.RDFType = "http://schema.org/Book";
    publication.Metadata.Modified = moment(Date.now()).toDate();

    publication.AddToInternal("filename", path.basename(filePath));

    publication.AddToInternal("type", "daisy");
    publication.AddToInternal("zip", zip);

    // note: does not work in RemoteExploded
    const entries = await zip.getEntries();

    // const [valid, message] = isFileValid(entries);
    // if (!valid) {
    //     return Promise.reject(message || "File validation failed.");
    // }

    // generic "text/xml" content type
    // manifest/item@media-type
    const opfZipEntryPath = entries.find((entry) => {
        // regexp fails?!
        // return /[^/]+\.opf$/.test(entry);
        return entry.endsWith(".opf") && entry.indexOf("/") < 0 && entry.indexOf("\\") < 0;
    });
    if (!opfZipEntryPath) {
        return Promise.reject("Opf File doesn't exists");
    }

    const rootfilePathDecoded = opfZipEntryPath; // || "package.opf";
    if (!rootfilePathDecoded) {
        return Promise.reject("?!rootfile.PathDecoded");
    }

    const opf = await getOpf(zip, rootfilePathDecoded, opfZipEntryPath);

    addLanguage(publication, opf);

    addTitle(publication, undefined, opf);

    addIdentifier(publication, opf);

    addOtherMetadata(publication, undefined, opf);

    setPublicationDirection(publication, opf);

    findContributorInMeta(publication, undefined, opf);

    await fillSpineAndResource(publication, undefined, opf, zip, addLinkData);

    let ncx: NCX | undefined;
    if (opf.Manifest) {
        let ncxManItem = opf.Manifest.find((manifestItem) => {
            return manifestItem.MediaType === "application/x-dtbncx+xml";
        });
        if (!ncxManItem) {
            ncxManItem = opf.Manifest.find((manifestItem) => {
                return manifestItem.MediaType === "text/xml" &&
                    manifestItem.Href && manifestItem.Href.endsWith(".ncx");
            });
        }
        if (ncxManItem) {
            ncx = await getNcx(ncxManItem, opf, zip);
        }
    }

    fillTOC(publication, opf, ncx);

    fillSubject(publication, opf);

    fillPublicationDate(publication, undefined, opf);

    return publication;
}

const addLinkData = async (
    publication: Publication, _rootfile: Rootfile | undefined,
    opf: OPF, zip: IZip, linkItem: Link, item: Manifest) => {

    if (publication.Metadata?.AdditionalJSON) {

        // dtb:multimediaContent ==> audio,text
        const isFullTextAudio = publication.Metadata.AdditionalJSON["dtb:multimediaType"] === "audioFullText";

        // dtb:multimediaContent ==> text
        const isTextOnly = publication.Metadata.AdditionalJSON["dtb:multimediaType"] === "textNCX";

        if (isFullTextAudio || isTextOnly) {
            await addMediaOverlaySMIL(linkItem, item, opf, zip);

            if (linkItem.MediaOverlays && !linkItem.MediaOverlays.initialized) {

                // mo.initialized true/false is automatically handled
                await lazyLoadMediaOverlays(publication, linkItem.MediaOverlays);

                if (isFullTextAudio) {
                    updateDurations(linkItem.MediaOverlays.duration, linkItem);
                }
            }
        }
    }
};
