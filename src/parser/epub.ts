// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";
import * as fs from "fs";
import { imageSize } from "image-size";
import { ISize } from "image-size/dist/types/interface";
import * as moment from "moment";
import * as path from "path";
import * as querystring from "querystring";
import { URL } from "url";
import * as xmldom from "xmldom";
import * as xpath from "xpath";

import { MediaOverlayNode, timeStrToSeconds } from "@models/media-overlay";
import { DirectionEnum, Metadata } from "@models/metadata";
import { BelongsTo } from "@models/metadata-belongsto";
import { Contributor } from "@models/metadata-contributor";
import { MediaOverlay } from "@models/metadata-media-overlay";
import { IStringMap } from "@models/metadata-multilang";
import {
    LayoutEnum, OrientationEnum, OverflowEnum, PageEnum, Properties, SpreadEnum,
} from "@models/metadata-properties";
import { Subject } from "@models/metadata-subject";
import { Publication } from "@models/publication";
import { Link } from "@models/publication-link";
import { DelinearizeAccessModeSufficient } from "@models/ta-json-string-tokens-converter";
import { Encrypted } from "@r2-lcp-js/models/metadata-encrypted";
import { LCP } from "@r2-lcp-js/parser/epub/lcp";
import { TaJsonDeserialize } from "@r2-lcp-js/serializable";
import { isHTTP } from "@r2-utils-js/_utils/http/UrlUtils";
import { streamToBufferPromise } from "@r2-utils-js/_utils/stream/BufferUtils";
import { XML } from "@r2-utils-js/_utils/xml-js-mapper";
import { IStreamAndLength, IZip } from "@r2-utils-js/_utils/zip/zip";
import { zipLoadPromise } from "@r2-utils-js/_utils/zip/zipFactory";
import { Transformers } from "@transform/transformer";

import { tryDecodeURI } from "../_utils/decodeURI";
import { zipHasEntry } from "../_utils/zipHasEntry";
import { Container } from "./epub/container";
import { Rootfile } from "./epub/container-rootfile";
import { DisplayOptions } from "./epub/display-options";
import { Encryption } from "./epub/encryption";
import { NCX } from "./epub/ncx";
import { NavPoint } from "./epub/ncx-navpoint";
import { OPF } from "./epub/opf";
import { Author } from "./epub/opf-author";
import { Manifest } from "./epub/opf-manifest";
import { Metafield } from "./epub/opf-metafield";
import { Title } from "./epub/opf-title";
import { SMIL } from "./epub/smil";
import { Par } from "./epub/smil-par";
import { Seq } from "./epub/smil-seq";
import { SeqOrPar } from "./epub/smil-seq-or-par";

const debug = debug_("r2:shared#parser/epub");

const epub3 = "3.0";
const epub301 = "3.0.1";
const epub31 = "3.1";
// const epub2 = "2.0";
// const epub201 = "2.0.1";

export const mediaOverlayURLPath = "media-overlay.json";
export const mediaOverlayURLParam = "resource";

// https://github.com/readium/webpub-manifest/issues/52#issuecomment-601686135
export const BCP47_UNKNOWN_LANG = "und";

function parseSpaceSeparatedString(str: string | undefined | null): string[] {
    return str ? str.trim().split(" ").map((role) => {
        return role.trim();
    }).filter((role) => {
        return role.length > 0;
    }) : [];
}

export const addCoverDimensions = async (publication: Publication, coverLink: Link) => {

    const zipInternal = publication.findFromInternal("zip");
    if (zipInternal) {
        const zip = zipInternal.Value as IZip;

        const coverLinkHrefDecoded = coverLink.HrefDecoded;
        if (!coverLinkHrefDecoded) {
            return;
        }
        const has = await zipHasEntry(zip, coverLinkHrefDecoded, coverLink.Href);
        if (!has) {
            console.log(`NOT IN ZIP (addCoverDimensions): ${coverLink.Href} --- ${coverLinkHrefDecoded}`);
            const zipEntries = await zip.getEntries();
            for (const zipEntry of zipEntries) {
                console.log(zipEntry);
            }
            return;
        }
        let zipStream: IStreamAndLength;
        try {
            zipStream = await zip.entryStreamPromise(coverLinkHrefDecoded);
        } catch (err) {
            debug(coverLinkHrefDecoded);
            debug(coverLink.TypeLink);
            debug(err);
            return;
        }

        let zipData: Buffer;
        try {
            zipData = await streamToBufferPromise(zipStream.stream);

            const imageInfo = imageSize(zipData) as ISize;
            if (imageInfo && imageInfo.width && imageInfo.height) {
                coverLink.Width = imageInfo.width;
                coverLink.Height = imageInfo.height;

                if (coverLink.TypeLink &&
                    coverLink.TypeLink.replace("jpeg", "jpg").replace("+xml", "")
                    !== ("image/" + imageInfo.type)) {
                    debug(`Wrong image type? ${coverLink.TypeLink} -- ${imageInfo.type}`);
                }
            }
        } catch (err) {
            debug(coverLinkHrefDecoded);
            debug(coverLink.TypeLink);
            debug(err);
        }
    }
};

export enum EPUBis {
    LocalExploded = "LocalExploded",
    LocalPacked = "LocalPacked",
    RemoteExploded = "RemoteExploded",
    RemotePacked = "RemotePacked",
}
export function isEPUBlication(urlOrPath: string): EPUBis | undefined {
    let p = urlOrPath;
    const http = isHTTP(urlOrPath);
    if (http) {
        const url = new URL(urlOrPath);
        p = url.pathname;
    } else if (fs.existsSync(path.join(urlOrPath, "META-INF", "container.xml"))) {
        return EPUBis.LocalExploded;
    }
    const fileName = path.basename(p);
    const ext = path.extname(fileName).toLowerCase();

    const epub = /\.epub[3]?$/.test(ext);
    if (epub) {
        return http ? EPUBis.RemotePacked : EPUBis.LocalPacked;
    }

    // filePath.replace(/\//, "/").endsWith("META-INF/container.xml")
    if (/META-INF[\/|\\]container.xml$/.test(p)) {
        return http ? EPUBis.RemoteExploded : EPUBis.LocalExploded;
    }

    return undefined;
}

export async function EpubParsePromise(filePath: string): Promise<Publication> {

    const isAnEPUB = isEPUBlication(filePath);

    // // excludes EPUBis.RemoteExploded
    // const canLoad = isAnEPUB === EPUBis.LocalExploded ||
    //     isAnEPUB === EPUBis.LocalPacked ||
    //     isAnEPUB === EPUBis.RemotePacked;
    // if (!canLoad) {
    //     // TODO? r2-utils-js zip-ext.ts => variant for HTTP without directory listing? (no deterministic zip entries)
    //     const err = "Cannot load exploded remote EPUB (needs filesystem access to list directory contents).";
    //     debug(err);
    //     return Promise.reject(err);
    // }

    let filePathToLoad = filePath;
    if (isAnEPUB === EPUBis.LocalExploded) { // (must ensure is directory/folder)
        filePathToLoad = filePathToLoad.replace(/META-INF[\/|\\]container.xml$/, "");
    } else if (isAnEPUB === EPUBis.RemoteExploded) {
        const url = new URL(filePathToLoad);
        url.pathname = url.pathname.replace(/META-INF[\/|\\]container.xml$/, "");
        // contains trailing slash
        filePathToLoad = url.toString();
    }
    let zip: IZip;
    try {
        zip = await zipLoadPromise(filePathToLoad);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }

    if (!zip.hasEntries()) {
        return Promise.reject("EPUB zip empty");
    }

    const publication = new Publication();
    publication.Context = ["https://readium.org/webpub-manifest/context.jsonld"];
    publication.Metadata = new Metadata();
    publication.Metadata.RDFType = "http://schema.org/Book";
    publication.Metadata.Modified = moment(Date.now()).toDate();

    publication.AddToInternal("filename", path.basename(filePath));

    publication.AddToInternal("type", "epub");
    publication.AddToInternal("zip", zip);

    let lcpl: LCP | undefined;
    const lcplZipPath = "META-INF/license.lcpl";
    let has = await zipHasEntry(zip, lcplZipPath, undefined);
    if (has) {
        let lcplZipStream_: IStreamAndLength;
        try {
            lcplZipStream_ = await zip.entryStreamPromise(lcplZipPath);
        } catch (err) {
            debug(err);
            return Promise.reject(err);
        }
        const lcplZipStream = lcplZipStream_.stream;

        let lcplZipData: Buffer;
        try {
            lcplZipData = await streamToBufferPromise(lcplZipStream);
        } catch (err) {
            debug(err);
            return Promise.reject(err);
        }

        const lcplStr = lcplZipData.toString("utf8");
        const lcplJson = global.JSON.parse(lcplStr);
        // debug(lcplJson);
        lcpl = TaJsonDeserialize<LCP>(lcplJson, LCP);
        lcpl.ZipPath = lcplZipPath;
        lcpl.JsonSource = lcplStr;
        lcpl.init();

        // breakLength: 100  maxArrayLength: undefined
        // console.log(util.inspect(lcpl,
        //     { showHidden: false, depth: 1000, colors: true, customInspect: true }));

        publication.LCP = lcpl;

        // // breakLength: 100  maxArrayLength: undefined
        // console.log(util.inspect(this.LCP,
        //     { showHidden: false, depth: 1000, colors: true, customInspect: true }));

        // https://github.com/readium/readium-lcp-specs/issues/15#issuecomment-358247286
        // application/vnd.readium.lcp.license-1.0+json (LEGACY)
        // application/vnd.readium.lcp.license.v1.0+json (NEW)
        // application/vnd.readium.license.status.v1.0+json (LSD)
        const mime = "application/vnd.readium.lcp.license.v1.0+json";
        publication.AddLink(mime, ["license"], lcpl.ZipPath, undefined);
    }

    let encryption: Encryption | undefined;
    const encZipPath = "META-INF/encryption.xml";
    has = await zipHasEntry(zip, encZipPath, undefined);
    if (has) {
        let encryptionXmlZipStream_: IStreamAndLength;
        try {
            encryptionXmlZipStream_ = await zip.entryStreamPromise(encZipPath);
        } catch (err) {
            debug(err);
            return Promise.reject(err);
        }
        const encryptionXmlZipStream = encryptionXmlZipStream_.stream;

        let encryptionXmlZipData: Buffer;
        try {
            encryptionXmlZipData = await streamToBufferPromise(encryptionXmlZipStream);
        } catch (err) {
            debug(err);
            return Promise.reject(err);
        }

        const encryptionXmlStr = encryptionXmlZipData.toString("utf8");
        const encryptionXmlDoc = new xmldom.DOMParser().parseFromString(encryptionXmlStr);

        encryption = XML.deserialize<Encryption>(encryptionXmlDoc, Encryption);
        encryption.ZipPath = encZipPath;

        // breakLength: 100  maxArrayLength: undefined
        // console.log(util.inspect(encryption,
        //     { showHidden: false, depth: 1000, colors: true, customInspect: true }));
    }

    const containerZipPath = "META-INF/container.xml";

    let containerXmlZipStream_: IStreamAndLength;
    try {
        containerXmlZipStream_ = await zip.entryStreamPromise(containerZipPath);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }
    const containerXmlZipStream = containerXmlZipStream_.stream;

    let containerXmlZipData: Buffer;
    try {
        containerXmlZipData = await streamToBufferPromise(containerXmlZipStream);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }

    const containerXmlStr = containerXmlZipData.toString("utf8");
    const containerXmlDoc = new xmldom.DOMParser().parseFromString(containerXmlStr);

    // debug(containerXmlDoc);
    // debug(containerXmlStr);
    // const containerXmlRootElement = xpath.select1("/", containerXmlDoc);
    // debug(containerXmlRootElement.toString());

    const container = XML.deserialize<Container>(containerXmlDoc, Container);
    container.ZipPath = containerZipPath;
    // breakLength: 100  maxArrayLength: undefined
    // console.log(util.inspect(container,
    //     { showHidden: false, depth: 1000, colors: true, customInspect: true }));

    const rootfile = container.Rootfile[0];

    const rootfilePathDecoded = rootfile.PathDecoded;
    if (!rootfilePathDecoded) {
        return Promise.reject("?!rootfile.PathDecoded");
    }

    // let timeBegin = process.hrtime();
    has = await zipHasEntry(zip, rootfilePathDecoded, rootfile.Path);
    if (!has) {
        const err = `NOT IN ZIP (container OPF rootfile): ${rootfile.Path} --- ${rootfilePathDecoded}`;
        console.log(err);
        const zipEntries = await zip.getEntries();
        for (const zipEntry of zipEntries) {
            console.log(zipEntry);
        }
        return Promise.reject(err);
    }

    let opfZipStream_: IStreamAndLength;
    try {
        opfZipStream_ = await zip.entryStreamPromise(rootfilePathDecoded);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }
    const opfZipStream = opfZipStream_.stream;

    // const timeElapsed1 = process.hrtime(timeBegin);
    // debug(`1) ${timeElapsed1[0]} seconds + ${timeElapsed1[1]} nanoseconds`);
    // timeBegin = process.hrtime();

    let opfZipData: Buffer;
    try {
        opfZipData = await streamToBufferPromise(opfZipStream);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }

    // debug(`${opfZipData.length} bytes`);

    // const timeElapsed2 = process.hrtime(timeBegin);
    // debug(`2) ${timeElapsed2[0]} seconds + ${timeElapsed2[1]} nanoseconds`);
    // timeBegin = process.hrtime();

    const opfStr = opfZipData.toString("utf8");

    // const timeElapsed3 = process.hrtime(timeBegin);
    // debug(`3) ${timeElapsed3[0]} seconds + ${timeElapsed3[1]} nanoseconds`);
    // timeBegin = process.hrtime();

    // TODO: this takes some time with large OPF XML data
    // (typically: many manifest items),
    // but it remains acceptable.
    // e.g. BasicTechnicalMathWithCalculus.epub with 2.5MB OPF!
    const opfDoc = new xmldom.DOMParser().parseFromString(opfStr);

    // const timeElapsed4 = process.hrtime(timeBegin);
    // debug(`4) ${timeElapsed4[0]} seconds + ${timeElapsed4[1]} nanoseconds`);
    // const timeBegin = process.hrtime();

    // tslint:disable-next-line:no-string-literal
    // process.env["OPF_PARSE"] = "true";
    // TODO: this takes a MASSIVE amount of time with large OPF XML data
    // (typically: many manifest items)
    // e.g. BasicTechnicalMathWithCalculus.epub with 2.5MB OPF!
    // culprit: XPath lib ... so we use our own mini XPath parser/matcher
    // (=> performance gain in orders of magnitude!)
    const opf = XML.deserialize<OPF>(opfDoc, OPF);
    // tslint:disable-next-line:no-string-literal
    // process.env["OPF_PARSE"] = "false";

    // const timeElapsed5 = process.hrtime(timeBegin);
    // debug(`5) ${timeElapsed5[0]} seconds + ${timeElapsed5[1]} nanoseconds`);

    opf.ZipPath = rootfilePathDecoded;

    // breakLength: 100  maxArrayLength: undefined
    // console.log(util.inspect(opf,
    //     { showHidden: false, depth: 1000, colors: true, customInspect: true }));

    // const epubVersion = getEpubVersion(rootfile, opf);

    let ncx: NCX | undefined;
    if (opf.Spine.Toc) {
        const ncxManItem = opf.Manifest.find((manifestItem) => {
            return manifestItem.ID === opf.Spine.Toc;
        });
        if (ncxManItem) {
            const dname = path.dirname(opf.ZipPath);
            const ncxManItemHrefDecoded = ncxManItem.HrefDecoded;
            if (!ncxManItemHrefDecoded) {
                return Promise.reject("?!ncxManItem.Href");
            }
            const ncxFilePath = path.join(dname, ncxManItemHrefDecoded).replace(/\\/g, "/");

            has = await zipHasEntry(zip, ncxFilePath, undefined);
            if (!has) {
                const err = `NOT IN ZIP (NCX): ${ncxManItem.Href} --- ${ncxFilePath}`;
                console.log(err);
                const zipEntries = await zip.getEntries();
                for (const zipEntry of zipEntries) {
                    console.log(zipEntry);
                }
                return Promise.reject(err);
            }

            let ncxZipStream_: IStreamAndLength;
            try {
                ncxZipStream_ = await zip.entryStreamPromise(ncxFilePath);
            } catch (err) {
                debug(err);
                return Promise.reject(err);
            }
            const ncxZipStream = ncxZipStream_.stream;

            let ncxZipData: Buffer;
            try {
                ncxZipData = await streamToBufferPromise(ncxZipStream);
            } catch (err) {
                debug(err);
                return Promise.reject(err);
            }

            const ncxStr = ncxZipData.toString("utf8");
            const ncxDoc = new xmldom.DOMParser().parseFromString(ncxStr);
            ncx = XML.deserialize<NCX>(ncxDoc, NCX);
            ncx.ZipPath = ncxFilePath;

            // breakLength: 100  maxArrayLength: undefined
            // console.log(util.inspect(ncx,
            //     { showHidden: false, depth: 1000, colors: true, customInspect: true }));
        }
    }

    if (opf.Metadata) {
        if (opf.Metadata.Language) {
            publication.Metadata.Language = opf.Metadata.Language;
        }
    }

    addTitle(publication, rootfile, opf);

    addIdentifier(publication, rootfile, opf);

    if (opf.Metadata) {
        if (opf.Metadata.Rights && opf.Metadata.Rights.length) {
            publication.Metadata.Rights = opf.Metadata.Rights.join(" ");
        }
        if (opf.Metadata.Description && opf.Metadata.Description.length) {
            publication.Metadata.Description = opf.Metadata.Description[0];
        }
        if (opf.Metadata.Publisher && opf.Metadata.Publisher.length) {
            publication.Metadata.Publisher = [];

            opf.Metadata.Publisher.forEach((pub) => {
                const contrib = new Contributor();
                contrib.Name = pub;
                publication.Metadata.Publisher.push(contrib);
            });
        }
        if (opf.Metadata.Source && opf.Metadata.Source.length) {
            publication.Metadata.Source = opf.Metadata.Source[0];
        }

        if (opf.Metadata.Contributor && opf.Metadata.Contributor.length) {
            opf.Metadata.Contributor.forEach((cont) => {
                addContributor(publication, rootfile, opf, cont, undefined);
            });
        }
        if (opf.Metadata.Creator && opf.Metadata.Creator.length) {
            opf.Metadata.Creator.forEach((cont) => {
                addContributor(publication, rootfile, opf, cont, "aut");
            });
        }

        if (opf.Metadata.Link) {
            opf.Metadata.Link.forEach((metaLink) => {
                if (metaLink.Property === "a11y:certifierCredential") {
                    let val = metaLink.Href;
                    if (!val) {
                        return; // continue
                    }
                    val = val.trim();
                    if (!val) {
                        return; // continue
                    }
                    if (!publication.Metadata.CertifierCredential) {
                        publication.Metadata.CertifierCredential = [];
                    }
                    publication.Metadata.CertifierCredential.push(val);
                } else if (metaLink.Property === "a11y:certifierReport") {
                    let val = metaLink.Href;
                    if (!val) {
                        return; // continue
                    }
                    val = val.trim();
                    if (!val) {
                        return; // continue
                    }
                    if (!publication.Metadata.CertifierReport) {
                        publication.Metadata.CertifierReport = [];
                    }
                    publication.Metadata.CertifierReport.push(val);
                } else if (metaLink.Property === "dcterms:conformsTo") {
                    let val = metaLink.Href;
                    if (!val) {
                        return; // continue
                    }
                    val = val.trim();
                    if (!val) {
                        return; // continue
                    }
                    if (!publication.Metadata.ConformsTo) {
                        publication.Metadata.ConformsTo = [];
                    }
                    publication.Metadata.ConformsTo.push(val);
                }
            });
        }
        if (opf.Metadata.Meta) {
            interface IMetaTagValue {
                metaTag: Metafield;
                val: string;
            }
            const AccessibilitySummarys: IMetaTagValue[] = [];

            opf.Metadata.Meta.forEach((metaTag) => {
                if (metaTag.Name === "schema:accessMode" ||
                    metaTag.Property === "schema:accessMode") {
                    let val = metaTag.Property ? metaTag.Data : metaTag.Content;
                    if (!val) {
                        return; // continue
                    }
                    val = val.trim();
                    if (!val) {
                        return; // continue
                    }
                    if (!publication.Metadata.AccessMode) {
                        publication.Metadata.AccessMode = [];
                    }
                    publication.Metadata.AccessMode.push(val);
                } else if (metaTag.Name === "schema:accessibilityFeature" ||
                    metaTag.Property === "schema:accessibilityFeature") {
                    let val = metaTag.Property ? metaTag.Data : metaTag.Content;
                    if (!val) {
                        return; // continue
                    }
                    val = val.trim();
                    if (!val) {
                        return; // continue
                    }
                    if (!publication.Metadata.AccessibilityFeature) {
                        publication.Metadata.AccessibilityFeature = [];
                    }
                    publication.Metadata.AccessibilityFeature.push(val);
                } else if (metaTag.Name === "schema:accessibilityHazard" ||
                    metaTag.Property === "schema:accessibilityHazard") {
                    let val = metaTag.Property ? metaTag.Data : metaTag.Content;
                    if (!val) {
                        return; // continue
                    }
                    val = val.trim();
                    if (!val) {
                        return; // continue
                    }
                    if (!publication.Metadata.AccessibilityHazard) {
                        publication.Metadata.AccessibilityHazard = [];
                    }
                    publication.Metadata.AccessibilityHazard.push(val);
                } else if (metaTag.Name === "schema:accessibilitySummary" ||
                    metaTag.Property === "schema:accessibilitySummary") {
                    let val = metaTag.Property ? metaTag.Data : metaTag.Content;
                    if (!val) {
                        return; // continue
                    }
                    val = val.trim();
                    if (!val) {
                        return; // continue
                    }
                    AccessibilitySummarys.push({
                        metaTag,
                        val,
                    });
                } else if (metaTag.Name === "schema:accessModeSufficient" ||
                    metaTag.Property === "schema:accessModeSufficient") {
                    let val = metaTag.Property ? metaTag.Data : metaTag.Content;
                    if (!val) {
                        return; // continue
                    }
                    val = val.trim();
                    if (!val) {
                        return; // continue
                    }
                    if (!publication.Metadata.AccessModeSufficient) {
                        publication.Metadata.AccessModeSufficient = [];
                    }
                    publication.Metadata.AccessModeSufficient.push(DelinearizeAccessModeSufficient(val));
                } else if (metaTag.Name === "schema:accessibilityAPI" ||
                    metaTag.Property === "schema:accessibilityAPI") {
                    let val = metaTag.Property ? metaTag.Data : metaTag.Content;
                    if (!val) {
                        return; // continue
                    }
                    val = val.trim();
                    if (!val) {
                        return; // continue
                    }
                    if (!publication.Metadata.AccessibilityAPI) {
                        publication.Metadata.AccessibilityAPI = [];
                    }
                    publication.Metadata.AccessibilityAPI.push(val);
                } else if (metaTag.Name === "schema:accessibilityControl" ||
                    metaTag.Property === "schema:accessibilityControl") {
                    let val = metaTag.Property ? metaTag.Data : metaTag.Content;
                    if (!val) {
                        return; // continue
                    }
                    val = val.trim();
                    if (!val) {
                        return; // continue
                    }
                    if (!publication.Metadata.AccessibilityControl) {
                        publication.Metadata.AccessibilityControl = [];
                    }
                    publication.Metadata.AccessibilityControl.push(val);
                } else if (metaTag.Name === "a11y:certifiedBy" ||
                    metaTag.Property === "a11y:certifiedBy") {
                    let val = metaTag.Property ? metaTag.Data : metaTag.Content;
                    if (!val) {
                        return; // continue
                    }
                    val = val.trim();
                    if (!val) {
                        return; // continue
                    }
                    if (!publication.Metadata.CertifiedBy) {
                        publication.Metadata.CertifiedBy = [];
                    }
                    publication.Metadata.CertifiedBy.push(val);
                } else if (metaTag.Name === "a11y:certifierCredential" || // may be link in EPUB3
                    metaTag.Property === "a11y:certifierCredential") {
                    let val = metaTag.Property ? metaTag.Data : metaTag.Content;
                    if (!val) {
                        return; // continue
                    }
                    val = val.trim();
                    if (!val) {
                        return; // continue
                    }
                    if (!publication.Metadata.CertifierCredential) {
                        publication.Metadata.CertifierCredential = [];
                    }
                    publication.Metadata.CertifierCredential.push(val);
                }
            });
            if (AccessibilitySummarys.length === 1) {
                const tuple = AccessibilitySummarys[0];
                if (tuple.metaTag.Lang) {
                    publication.Metadata.AccessibilitySummary = {} as IStringMap;
                    // tslint:disable-next-line: max-line-length
                    (publication.Metadata.AccessibilitySummary as IStringMap)[tuple.metaTag.Lang.toLowerCase()] = tuple.val;
                } else {
                    publication.Metadata.AccessibilitySummary = tuple.val;
                }
            } else if (AccessibilitySummarys.length) {
                publication.Metadata.AccessibilitySummary = {} as IStringMap;

                AccessibilitySummarys.forEach((tuple) => {
                    // https://github.com/readium/architecture/blob/master/streamer/parser/metadata.md#title
                    const xmlLang: string = tuple.metaTag.Lang || opf.Lang;
                    if (xmlLang) {
                        // tslint:disable-next-line: max-line-length
                        (publication.Metadata.AccessibilitySummary as IStringMap)[xmlLang.toLowerCase()] = tuple.val;
                    } else if (publication.Metadata.Language &&
                        publication.Metadata.Language.length &&
                        // tslint:disable-next-line: max-line-length
                        !(publication.Metadata.AccessibilitySummary as IStringMap)[publication.Metadata.Language[0].toLowerCase()]) {
                        // tslint:disable-next-line: max-line-length
                        (publication.Metadata.AccessibilitySummary as IStringMap)[publication.Metadata.Language[0].toLowerCase()] = tuple.val;
                    } else {
                        // tslint:disable-next-line: no-string-literal, max-line-length
                        (publication.Metadata.AccessibilitySummary as IStringMap)[BCP47_UNKNOWN_LANG] = tuple.val;
                    }
                });
            }

            const metasDuration: Metafield[] = [];
            const metasNarrator: Metafield[] = [];
            const metasActiveClass: Metafield[] = [];
            const metasPlaybackActiveClass: Metafield[] = [];

            opf.Metadata.Meta.forEach((metaTag) => {
                if (metaTag.Property === "media:duration" && !metaTag.Refine) {
                    metasDuration.push(metaTag);
                }
                if (metaTag.Property === "media:narrator") {
                    metasNarrator.push(metaTag);
                }
                if (metaTag.Property === "media:active-class") {
                    metasActiveClass.push(metaTag);
                }
                if (metaTag.Property === "media:playback-active-class") {
                    metasPlaybackActiveClass.push(metaTag);
                }
            });

            if (metasDuration.length) {
                publication.Metadata.Duration = timeStrToSeconds(metasDuration[0].Data);
            }
            if (metasNarrator.length) {
                if (!publication.Metadata.Narrator) {
                    publication.Metadata.Narrator = [];
                }
                metasNarrator.forEach((metaNarrator) => {
                    const cont = new Contributor();
                    cont.Name = metaNarrator.Data;
                    publication.Metadata.Narrator.push(cont);
                });
            }
            if (metasActiveClass.length) {
                if (!publication.Metadata.MediaOverlay) {
                    publication.Metadata.MediaOverlay = new MediaOverlay();
                }
                publication.Metadata.MediaOverlay.ActiveClass = metasActiveClass[0].Data;
            }
            if (metasPlaybackActiveClass.length) {
                if (!publication.Metadata.MediaOverlay) {
                    publication.Metadata.MediaOverlay = new MediaOverlay();
                }
                publication.Metadata.MediaOverlay.PlaybackActiveClass = metasPlaybackActiveClass[0].Data;
            }
        }
    }

    if (opf.Spine && opf.Spine.PageProgression) {
        switch (opf.Spine.PageProgression) {
            case "auto": {
                publication.Metadata.Direction = DirectionEnum.Auto;
                break;
            }
            case "ltr": {
                publication.Metadata.Direction = DirectionEnum.LTR;
                break;
            }
            case "rtl": {
                publication.Metadata.Direction = DirectionEnum.RTL;
                break;
            }
        }
    }

    if (publication.Metadata.Language && publication.Metadata.Language.length &&
        (!publication.Metadata.Direction || publication.Metadata.Direction === DirectionEnum.Auto)) {

        const lang = publication.Metadata.Language[0].toLowerCase();
        if ((lang === "ar" || lang.startsWith("ar-") ||
            lang === "he" || lang.startsWith("he-") ||
            lang === "fa" || lang.startsWith("fa-")) ||
            lang === "zh-Hant" ||
            lang === "zh-TW") {

            publication.Metadata.Direction = DirectionEnum.RTL;
        }
    }

    if (isEpub3OrMore(rootfile, opf)) {
        findContributorInMeta(publication, rootfile, opf);
    }
    await fillSpineAndResource(publication, rootfile, opf);

    await addRendition(publication, rootfile, opf, zip);

    await addCoverRel(publication, rootfile, opf);

    if (encryption) {
        fillEncryptionInfo(publication, rootfile, opf, encryption, lcpl);
    }

    await fillTOCFromNavDoc(publication, rootfile, opf, zip);

    if (!publication.TOC || !publication.TOC.length) {
        if (ncx) {
            fillTOCFromNCX(publication, rootfile, opf, ncx);
            if (!publication.PageList) {
                fillPageListFromNCX(publication, rootfile, opf, ncx);
            }
        }
        fillLandmarksFromGuide(publication, rootfile, opf);
    }

    if (!publication.PageList && publication.Resources) {
        // EPUB extended with Adobe Digital Editions page map
        //  https://wiki.mobileread.com/wiki/Adobe_Digital_Editions#Page-map
        const pageMapLink = publication.Resources.find((item: Link): boolean => {
            return item.TypeLink === "application/oebps-page-map+xml";
        });
        if (pageMapLink) {
            await fillPageListFromAdobePageMap(publication, rootfile, opf, zip, pageMapLink);
        }
    }

    fillCalibreSerieInfo(publication, rootfile, opf);
    fillSubject(publication, rootfile, opf);

    fillPublicationDate(publication, rootfile, opf);

    await fillMediaOverlay(publication, rootfile, opf, zip);

    return publication;
}

// private filePathToTitle(filePath: string): string {
//     const fileName = path.basename(filePath);
//     return slugify(fileName, "_").replace(/[\.]/g, "_");
// }

export async function getAllMediaOverlays(publication: Publication): Promise<MediaOverlayNode[]> {
    const mos: MediaOverlayNode[] = [];

    if (publication.Spine) {
        for (const link of publication.Spine) {
            // publication.Spine.forEach((link) => {
            if (link.MediaOverlays) {
                for (const mo of link.MediaOverlays) {
                    // link.MediaOverlays.forEach((mo) => {
                    try {
                        await fillMediaOverlayParse(publication, mo);
                    } catch (err) {
                        return Promise.reject(err);
                    }
                    mos.push(mo);
                    // });
                }
            }
            // });
        }
    }

    return Promise.resolve(mos);
}

export async function getMediaOverlay(publication: Publication, spineHref: string): Promise<MediaOverlayNode[]> {
    const mos: MediaOverlayNode[] = [];

    if (publication.Spine) {
        for (const link of publication.Spine) {
            // publication.Spine.forEach((link) => {
            if (link.MediaOverlays && link.Href.indexOf(spineHref) >= 0) {
                for (const mo of link.MediaOverlays) {
                    // link.MediaOverlays.forEach((mo) => {
                    try {
                        await fillMediaOverlayParse(publication, mo);
                    } catch (err) {
                        return Promise.reject(err);
                    }
                    mos.push(mo);
                    // });
                }
            }
            // });
        }
    }

    return Promise.resolve(mos);
}

export const fillMediaOverlayParse =
    async (publication: Publication, mo: MediaOverlayNode) => {

    if (mo.initialized || !mo.SmilPathInZip) {
        return;
    }

    let link: Link | undefined;
    if (publication.Resources) {

        const relativePath = mo.SmilPathInZip;

        link = publication.Resources.find((l) => {
            if (l.Href === relativePath) {
                return true;
            }
            return false;
        });
        if (!link) {
            if (publication.Spine) {
                link = publication.Spine.find((l) => {
                    if (l.Href === relativePath) {
                        return true;
                    }
                    return false;
                });
            }
        }
        if (!link) {
            const err = "Asset not declared in publication spine/resources! " + relativePath;
            debug(err);
            return Promise.reject(err);
        }
    }

    const zipInternal = publication.findFromInternal("zip");
    if (!zipInternal) {
        return;
    }
    const zip = zipInternal.Value as IZip;

    const has = await zipHasEntry(zip, mo.SmilPathInZip, undefined);
    if (!has) {
        const err = `NOT IN ZIP (fillMediaOverlayParse): ${mo.SmilPathInZip}`;
        console.log(err);
        const zipEntries = await zip.getEntries();
        for (const zipEntry of zipEntries) {
            console.log(zipEntry);
        }
        return Promise.reject(err);
    }

    let smilZipStream_: IStreamAndLength;
    try {
        smilZipStream_ = await zip.entryStreamPromise(mo.SmilPathInZip);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }

    if (link && link.Properties && link.Properties.Encrypted) {
        let decryptFail = false;
        let transformedStream: IStreamAndLength;
        try {
            transformedStream = await Transformers.tryStream(
                publication, link, undefined,
                smilZipStream_,
                false,
                0,
                0,
                undefined,
            );
        } catch (err) {
            debug(err);
            return Promise.reject(err);
        }
        if (transformedStream) {
            smilZipStream_ = transformedStream;
        } else {
            decryptFail = true;
        }

        if (decryptFail) {
            const err = "Encryption scheme not supported.";
            debug(err);
            return Promise.reject(err);
        }
    }

    const smilZipStream = smilZipStream_.stream;

    let smilZipData: Buffer;
    try {
        smilZipData = await streamToBufferPromise(smilZipStream);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }

    const smilStr = smilZipData.toString("utf8");
    const smilXmlDoc = new xmldom.DOMParser().parseFromString(smilStr);
    const smil = XML.deserialize<SMIL>(smilXmlDoc, SMIL);
    smil.ZipPath = mo.SmilPathInZip;

    mo.initialized = true;
    debug("PARSED SMIL: " + mo.SmilPathInZip);

    // breakLength: 100  maxArrayLength: undefined
    // console.log(util.inspect(smil,
    //     { showHidden: false, depth: 1000, colors: true, customInspect: true }));

    mo.Role = [];
    mo.Role.push("section");

    if (smil.Body) {
        if (smil.Body.EpubType) {
            const roles = parseSpaceSeparatedString(smil.Body.EpubType);
            for (const role of roles) {
                if (!role.length) {
                    return;
                }
                if (mo.Role.indexOf(role) < 0) {
                    mo.Role.push(role);
                }
            }
        }
        if (smil.Body.TextRef) {
            const smilBodyTextRefDecoded = smil.Body.TextRefDecoded;
            if (!smilBodyTextRefDecoded) {
                console.log("!?smilBodyTextRefDecoded");
            } else {
                const zipPath = path.join(path.dirname(smil.ZipPath), smilBodyTextRefDecoded)
                    .replace(/\\/g, "/");
                mo.Text = zipPath;
            }
        }
        if (smil.Body.Children && smil.Body.Children.length) {
            smil.Body.Children.forEach((seqChild) => {
                if (!mo.Children) {
                    mo.Children = [];
                }
                addSeqToMediaOverlay(smil, publication, mo, mo.Children, seqChild);
            });
        }
    }

    return;
};

const fillMediaOverlay =
    async (publication: Publication, rootfile: Rootfile, opf: OPF, zip: IZip) => {

        if (!publication.Resources) {
            return;
        }

        // no forEach(), because of await/async within the iteration body
        // publication.Resources.forEach(async (item) => {
        for (const item of publication.Resources) {
            if (item.TypeLink !== "application/smil+xml") {
                continue;
            }

            const itemHrefDecoded = item.HrefDecoded;
            if (!itemHrefDecoded) {
                console.log("?!item.HrefDecoded");
                continue;
            }
            const has = await zipHasEntry(zip, itemHrefDecoded, item.Href);
            if (!has) {
                console.log(`NOT IN ZIP (fillMediaOverlay): ${item.HrefDecoded} --- ${itemHrefDecoded}`);
                const zipEntries = await zip.getEntries();
                for (const zipEntry of zipEntries) {
                    console.log(zipEntry);
                }
                continue;
            }

            const manItemsHtmlWithSmil: Manifest[] = [];
            opf.Manifest.forEach((manItemHtmlWithSmil) => {
                if (manItemHtmlWithSmil.MediaOverlay) { // HTML
                    const manItemSmil = opf.Manifest.find((mi) => {
                        if (mi.ID === manItemHtmlWithSmil.MediaOverlay) {
                            return true;
                        }
                        return false;
                    });
                    if (manItemSmil && opf.ZipPath) {
                        const manItemSmilHrefDecoded = manItemSmil.HrefDecoded;
                        if (!manItemSmilHrefDecoded) {
                            console.log("!?manItemSmil.Href");
                            return; // foreach
                        }
                        const smilFilePath = path.join(path.dirname(opf.ZipPath), manItemSmilHrefDecoded)
                                .replace(/\\/g, "/");
                        if (smilFilePath === itemHrefDecoded) {
                            manItemsHtmlWithSmil.push(manItemHtmlWithSmil);
                        }
                    }
                }
            });

            const mo = new MediaOverlayNode();
            mo.SmilPathInZip = itemHrefDecoded;
            mo.initialized = false;

            manItemsHtmlWithSmil.forEach((manItemHtmlWithSmil) => {

                if (!opf.ZipPath) {
                    return;
                }
                const manItemHtmlWithSmilHrefDecoded = manItemHtmlWithSmil.HrefDecoded;
                if (!manItemHtmlWithSmilHrefDecoded) {
                    console.log("?!manItemHtmlWithSmil.Href");
                    return; // foreach
                }
                const htmlPathInZip = path.join(path.dirname(opf.ZipPath), manItemHtmlWithSmilHrefDecoded)
                    .replace(/\\/g, "/");

                const link = findLinKByHref(publication, rootfile, opf, htmlPathInZip);
                if (link) {
                    if (!link.MediaOverlays) {
                        link.MediaOverlays = [];
                    }

                    const alreadyExists = link.MediaOverlays.find((moo) => {
                        if (item.Href === moo.SmilPathInZip) {
                            return true;
                        }
                        return false;
                    });
                    if (!alreadyExists) {
                        link.MediaOverlays.push(mo);
                    }

                    if (!link.Properties) {
                        link.Properties = new Properties();
                    }
                    link.Properties.MediaOverlay = mediaOverlayURLPath + "?" +
                        mediaOverlayURLParam + "=" + querystring.escape(link.Href);

                    // https://w3c.github.io/sync-media-pub/incorporating-synchronized-narration.html#with-webpub
                    if (!link.Alternate) {
                        link.Alternate = [];
                    }
                    const moLink = new Link();
                    moLink.Href = link.Properties.MediaOverlay;
                    moLink.TypeLink = "application/vnd.syncnarr+json";
                    moLink.Duration = link.Duration;
                    link.Alternate.push(moLink);
                }
            });

            if (item.Properties && item.Properties.Encrypted) {
                debug("ENCRYPTED SMIL MEDIA OVERLAY: " + item.Href);
                continue;
            }
            // LAZY
            // await fillMediaOverlayParse(publication, mo);
        }

        return;
    };

const addSeqToMediaOverlay = (
    smil: SMIL, publication: Publication,
    rootMO: MediaOverlayNode, mo: MediaOverlayNode[], seqChild: SeqOrPar) => {

    if (!smil.ZipPath) {
        return;
    }

    const moc = new MediaOverlayNode();
    moc.initialized = rootMO.initialized;
    mo.push(moc);

    if (seqChild instanceof Seq) {
        moc.Role = [];
        moc.Role.push("section");

        const seq = seqChild as Seq;

        if (seq.EpubType) {
            const roles = parseSpaceSeparatedString(seq.EpubType);
            for (const role of roles) {
                if (!role.length) {
                    return;
                }
                if (moc.Role.indexOf(role) < 0) {
                    moc.Role.push(role);
                }
            }
        }

        if (seq.TextRef) {
            const seqTextRefDecoded = seq.TextRefDecoded;
            if (!seqTextRefDecoded) {
                console.log("!?seqTextRefDecoded");
            } else {
                const zipPath = path.join(path.dirname(smil.ZipPath), seqTextRefDecoded)
                    .replace(/\\/g, "/");
                moc.Text = zipPath;
            }
        }

        if (seq.Children && seq.Children.length) {
            seq.Children.forEach((child) => {
                if (!moc.Children) {
                    moc.Children = [];
                }
                addSeqToMediaOverlay(smil, publication, rootMO, moc.Children, child);
            });
        }
    } else { // Par
        const par = seqChild as Par;

        if (par.EpubType) {
            const roles = parseSpaceSeparatedString(par.EpubType);
            for (const role of roles) {
                if (!role.length) {
                    return;
                }
                if (!moc.Role) {
                    moc.Role = [];
                }
                if (moc.Role.indexOf(role) < 0) {
                    moc.Role.push(role);
                }
            }
        }

        if (par.Text && par.Text.Src) {
            const parTextSrcDcoded = par.Text.SrcDecoded;
            if (!parTextSrcDcoded) {
                console.log("?!parTextSrcDcoded");
            } else {
                const zipPath = path.join(path.dirname(smil.ZipPath), parTextSrcDcoded)
                    .replace(/\\/g, "/");
                moc.Text = zipPath;
            }
        }
        if (par.Audio && par.Audio.Src) {
            const parAudioSrcDcoded = par.Audio.SrcDecoded;
            if (!parAudioSrcDcoded) {
                console.log("?!parAudioSrcDcoded");
            } else {
                const zipPath = path.join(path.dirname(smil.ZipPath), parAudioSrcDcoded)
                    .replace(/\\/g, "/");
                moc.Audio = zipPath;
                moc.Audio += "#t=";
                moc.Audio += par.Audio.ClipBegin ? timeStrToSeconds(par.Audio.ClipBegin) : "0";
                if (par.Audio.ClipEnd) {
                    moc.Audio += ",";
                    moc.Audio += timeStrToSeconds(par.Audio.ClipEnd);
                }
            }
        }
    }
};

const fillPublicationDate = (publication: Publication, rootfile: Rootfile, opf: OPF) => {

    if (opf.Metadata && opf.Metadata.Date && opf.Metadata.Date.length) {

        if (isEpub3OrMore(rootfile, opf) && opf.Metadata.Date[0] && opf.Metadata.Date[0].Data) {
            const token = opf.Metadata.Date[0].Data;
            try {
                const mom = moment(token);
                if (mom.isValid()) {
                    publication.Metadata.PublicationDate = mom.toDate();
                }
            } catch (err) {
                console.log("INVALID DATE/TIME? " + token);
            }
            return;
        }

        opf.Metadata.Date.forEach((date) => {
            if (date.Data && date.Event && date.Event.indexOf("publication") >= 0) {
                const token = date.Data;
                try {
                    const mom = moment(token);
                    if (mom.isValid()) {
                        publication.Metadata.PublicationDate = mom.toDate();
                    }
                } catch (err) {
                    console.log("INVALID DATE/TIME? " + token);
                }
            }
        });
    }
};

const findContributorInMeta = (publication: Publication, rootfile: Rootfile, opf: OPF) => {

    if (opf.Metadata && opf.Metadata.Meta) {
        opf.Metadata.Meta.forEach((meta) => {
            if (meta.Property === "dcterms:creator" || meta.Property === "dcterms:contributor") {
                const cont = new Author();
                cont.Data = meta.Data;
                cont.ID = meta.ID;
                addContributor(publication, rootfile, opf, cont, undefined);
            }
        });
    }
};

const addContributor = (
    publication: Publication, rootfile: Rootfile, opf: OPF, cont: Author, forcedRole: string | undefined) => {

    const contributor = new Contributor();
    let role: string | undefined;

    // const epubVersion = getEpubVersion(rootfile, opf);

    if (isEpub3OrMore(rootfile, opf)) {

        if (cont.FileAs) {
            contributor.SortAs = cont.FileAs;
        } else {
            const metaFileAs = findMetaByRefineAndProperty(rootfile, opf, cont.ID, "file-as");
            if (metaFileAs && metaFileAs.Property === "file-as") {
                contributor.SortAs = metaFileAs.Data;
            }
        }

        const metaRole = findMetaByRefineAndProperty(rootfile, opf, cont.ID, "role");
        if (metaRole && metaRole.Property === "role") {
            role = metaRole.Data;
        }
        if (!role && forcedRole) {
            role = forcedRole;
        }

        const metaAlt = findAllMetaByRefineAndProperty(rootfile, opf, cont.ID, "alternate-script");
        if (metaAlt && metaAlt.length) {
            contributor.Name = {} as IStringMap;

            metaAlt.forEach((m) => {
                if (m.Lang) {
                    (contributor.Name as IStringMap)[m.Lang] = m.Data;
                }
            });

            // https://github.com/readium/architecture/blob/master/streamer/parser/metadata.md#title
            const xmlLang: string = cont.Lang || opf.Lang;
            if (xmlLang) {
                contributor.Name[xmlLang.toLowerCase()] = cont.Data;
            } else if (publication.Metadata &&
                publication.Metadata.Language &&
                publication.Metadata.Language.length &&
                !contributor.Name[publication.Metadata.Language[0].toLowerCase()]) {
                contributor.Name[publication.Metadata.Language[0].toLowerCase()] = cont.Data;
            } else {
                // tslint:disable-next-line: no-string-literal
                contributor.Name[BCP47_UNKNOWN_LANG] = cont.Data;
            }
        } else {
            contributor.Name = cont.Data;
        }
    } else {
        contributor.Name = cont.Data;
        role = cont.Role;
        if (!role && forcedRole) {
            role = forcedRole;
        }
    }

    if (role) {
        switch (role) {
            case "aut": {
                if (!publication.Metadata.Author) {
                    publication.Metadata.Author = [];
                }
                publication.Metadata.Author.push(contributor);
                break;
            }
            case "trl": {
                if (!publication.Metadata.Translator) {
                    publication.Metadata.Translator = [];
                }
                publication.Metadata.Translator.push(contributor);
                break;
            }
            case "art": {
                if (!publication.Metadata.Artist) {
                    publication.Metadata.Artist = [];
                }
                publication.Metadata.Artist.push(contributor);
                break;
            }
            case "edt": {
                if (!publication.Metadata.Editor) {
                    publication.Metadata.Editor = [];
                }
                publication.Metadata.Editor.push(contributor);
                break;
            }
            case "ill": {
                if (!publication.Metadata.Illustrator) {
                    publication.Metadata.Illustrator = [];
                }
                publication.Metadata.Illustrator.push(contributor);
                break;
            }
            case "ltr": {
                if (!publication.Metadata.Letterer) {
                    publication.Metadata.Letterer = [];
                }
                publication.Metadata.Letterer.push(contributor);
                break;
            }
            case "pen": {
                if (!publication.Metadata.Penciler) {
                    publication.Metadata.Penciler = [];
                }
                publication.Metadata.Penciler.push(contributor);
                break;
            }
            case "clr": {
                if (!publication.Metadata.Colorist) {
                    publication.Metadata.Colorist = [];
                }
                publication.Metadata.Colorist.push(contributor);
                break;
            }
            case "ink": {
                if (!publication.Metadata.Inker) {
                    publication.Metadata.Inker = [];
                }
                publication.Metadata.Inker.push(contributor);
                break;
            }
            case "nrt": {
                if (!publication.Metadata.Narrator) {
                    publication.Metadata.Narrator = [];
                }
                publication.Metadata.Narrator.push(contributor);
                break;
            }
            case "pbl": {
                if (!publication.Metadata.Publisher) {
                    publication.Metadata.Publisher = [];
                }
                publication.Metadata.Publisher.push(contributor);
                break;
            }
            default: {
                contributor.Role = [role];

                if (!publication.Metadata.Contributor) {
                    publication.Metadata.Contributor = [];
                }
                publication.Metadata.Contributor.push(contributor);
            }
        }
    }
};

const addIdentifier = (publication: Publication, _rootfile: Rootfile, opf: OPF) => {
    if (opf.Metadata && opf.Metadata.Identifier) {
        if (opf.UniqueIdentifier && opf.Metadata.Identifier.length > 1) {
            opf.Metadata.Identifier.forEach((iden) => {
                if (iden.ID === opf.UniqueIdentifier) {
                    publication.Metadata.Identifier = iden.Data;
                }
            });
        } else if (opf.Metadata.Identifier.length > 0) {
            publication.Metadata.Identifier = opf.Metadata.Identifier[0].Data;
        }
    }
};

const addTitle = (publication: Publication, rootfile: Rootfile, opf: OPF) => {

    if (isEpub3OrMore(rootfile, opf)) {
        let mainTitle: Title | undefined;
        let subTitle: Title | undefined;
        let subTitleDisplaySeq = 0;

        if (opf.Metadata &&
            opf.Metadata.Title &&
            opf.Metadata.Title.length) {

            if (opf.Metadata.Meta) {
                const tt = opf.Metadata.Title.find((title) => {
                    const refineID = "#" + title.ID;

                    const m = opf.Metadata.Meta.find((meta) => {
                        // meta.Property === "title-type"
                        if (meta.Data === "main" && meta.Refine === refineID) {
                            return true;
                        }
                        return false;
                    });
                    if (m) {
                        return true;
                    }
                    return false;
                });
                if (tt) {
                    mainTitle = tt;
                }

                opf.Metadata.Title.forEach((title) => {
                    const refineID = "#" + title.ID;

                    const m = opf.Metadata.Meta.find((meta) => {
                        // meta.Property === "title-type"
                        if (meta.Data === "subtitle" && meta.Refine === refineID) {
                            return true;
                        }
                        return false;
                    });
                    if (m) {
                        let titleDisplaySeq = 0;
                        const mds = opf.Metadata.Meta.find((meta) => {
                            if (meta.Property === "display-seq" && meta.Refine === refineID) {
                                return true;
                            }
                            return false;
                        });
                        if (mds) {
                            try {
                                titleDisplaySeq = parseInt(mds.Data, 10);
                            } catch (err) {
                                debug(err);
                                debug(mds.Data);
                                titleDisplaySeq = 0;
                            }
                            if (isNaN(titleDisplaySeq)) {
                                debug("NaN");
                                debug(mds.Data);
                                titleDisplaySeq = 0;
                            }
                        } else {
                            titleDisplaySeq = 0;
                        }
                        if (!subTitle || titleDisplaySeq < subTitleDisplaySeq) {
                            subTitle = title;
                            subTitleDisplaySeq = titleDisplaySeq;
                        }
                    }
                });
            }

            if (!mainTitle) {
                mainTitle = opf.Metadata.Title[0];
            }
        }

        if (mainTitle) {
            const metaAlt = findAllMetaByRefineAndProperty(rootfile, opf, mainTitle.ID, "alternate-script");
            if (metaAlt && metaAlt.length) {
                publication.Metadata.Title = {} as IStringMap;

                metaAlt.forEach((m) => {
                    if (m.Lang) {
                        (publication.Metadata.Title as IStringMap)[m.Lang.toLowerCase()] = m.Data;
                    }
                });

                // https://github.com/readium/architecture/blob/master/streamer/parser/metadata.md#title
                const xmlLang: string = mainTitle.Lang || opf.Lang;
                if (xmlLang) {
                    publication.Metadata.Title[xmlLang.toLowerCase()] = mainTitle.Data;
                } else if (publication.Metadata.Language &&
                    publication.Metadata.Language.length &&
                    !publication.Metadata.Title[publication.Metadata.Language[0].toLowerCase()]) {
                    publication.Metadata.Title[publication.Metadata.Language[0].toLowerCase()] = mainTitle.Data;
                } else {
                    // tslint:disable-next-line: no-string-literal
                    publication.Metadata.Title[BCP47_UNKNOWN_LANG] = mainTitle.Data;
                }

            } else {
                publication.Metadata.Title = mainTitle.Data;
            }
        }

        if (subTitle) {
            const metaAlt = findAllMetaByRefineAndProperty(rootfile, opf, subTitle.ID, "alternate-script");
            if (metaAlt && metaAlt.length) {
                publication.Metadata.SubTitle = {} as IStringMap;

                metaAlt.forEach((m) => {
                    if (m.Lang) {
                        (publication.Metadata.SubTitle as IStringMap)[m.Lang.toLowerCase()] = m.Data;
                    }
                });

                // https://github.com/readium/architecture/blob/master/streamer/parser/metadata.md#title
                const xmlLang: string = subTitle.Lang || opf.Lang;
                if (xmlLang) {
                    publication.Metadata.SubTitle[xmlLang.toLowerCase()] = subTitle.Data;
                } else if (publication.Metadata.Language &&
                    publication.Metadata.Language.length &&
                    !publication.Metadata.SubTitle[publication.Metadata.Language[0].toLowerCase()]) {
                    publication.Metadata.SubTitle[publication.Metadata.Language[0].toLowerCase()] = subTitle.Data;
                } else {
                    // tslint:disable-next-line: no-string-literal
                    publication.Metadata.SubTitle[BCP47_UNKNOWN_LANG] = subTitle.Data;
                }

            } else {
                publication.Metadata.SubTitle = subTitle.Data;
            }
        }

    } else {
        if (opf.Metadata &&
            opf.Metadata.Title &&
            opf.Metadata.Title.length) {

            publication.Metadata.Title = opf.Metadata.Title[0].Data;
        }
    }
};

const addRelAndPropertiesToLink =
    async (publication: Publication, link: Link, linkEpub: Manifest, rootfile: Rootfile, opf: OPF) => {

        if (linkEpub.Properties) {
            await addToLinkFromProperties(publication, link, linkEpub.Properties);
        }
        const spineProperties = findPropertiesInSpineForManifest(linkEpub, rootfile, opf);
        if (spineProperties) {
            await addToLinkFromProperties(publication, link, spineProperties);
        }
    };

const addToLinkFromProperties = async (publication: Publication, link: Link, propertiesString: string) => {

    const properties = parseSpaceSeparatedString(propertiesString);
    const propertiesStruct = new Properties();

    // https://idpf.github.io/epub-vocabs/rendition/

    // no forEach(), because of await/async within the iteration body
    // properties.forEach(async (p) => {
    for (const p of properties) {
        switch (p) {
            case "cover-image": {
                link.AddRel("cover");
                await addCoverDimensions(publication, link);
                break;
            }
            case "nav": {
                link.AddRel("contents");
                break;
            }
            case "scripted": {
                if (!propertiesStruct.Contains) {
                    propertiesStruct.Contains = [];
                }
                propertiesStruct.Contains.push("js");
                break;
            }
            case "mathml": {
                if (!propertiesStruct.Contains) {
                    propertiesStruct.Contains = [];
                }
                propertiesStruct.Contains.push("mathml");
                break;
            }
            case "onix-record": {
                if (!propertiesStruct.Contains) {
                    propertiesStruct.Contains = [];
                }
                propertiesStruct.Contains.push("onix");
                break;
            }
            case "svg": {
                if (!propertiesStruct.Contains) {
                    propertiesStruct.Contains = [];
                }
                propertiesStruct.Contains.push("svg");
                break;
            }
            case "xmp-record": {
                if (!propertiesStruct.Contains) {
                    propertiesStruct.Contains = [];
                }
                propertiesStruct.Contains.push("xmp");
                break;
            }
            case "remote-resources": {
                if (!propertiesStruct.Contains) {
                    propertiesStruct.Contains = [];
                }
                propertiesStruct.Contains.push("remote-resources");
                break;
            }
            case "page-spread-left": {
                propertiesStruct.Page = PageEnum.Left;
                break;
            }
            case "page-spread-right": {
                propertiesStruct.Page = PageEnum.Right;
                break;
            }
            case "page-spread-center": {
                propertiesStruct.Page = PageEnum.Center;
                break;
            }
            case "rendition:spread-none": {
                propertiesStruct.Spread = SpreadEnum.None;
                break;
            }
            case "rendition:spread-auto": {
                propertiesStruct.Spread = SpreadEnum.Auto;
                break;
            }
            case "rendition:spread-landscape": {
                propertiesStruct.Spread = SpreadEnum.Landscape;
                break;
            }
            case "rendition:spread-portrait": {
                propertiesStruct.Spread = SpreadEnum.Both; // https://github.com/readium/webpub-manifest/issues/24
                break;
            }
            case "rendition:spread-both": {
                propertiesStruct.Spread = SpreadEnum.Both;
                break;
            }
            case "rendition:layout-reflowable": {
                propertiesStruct.Layout = LayoutEnum.Reflowable;
                break;
            }
            case "rendition:layout-pre-paginated": {
                propertiesStruct.Layout = LayoutEnum.Fixed;
                break;
            }
            case "rendition:orientation-auto": {
                propertiesStruct.Orientation = OrientationEnum.Auto;
                break;
            }
            case "rendition:orientation-landscape": {
                propertiesStruct.Orientation = OrientationEnum.Landscape;
                break;
            }
            case "rendition:orientation-portrait": {
                propertiesStruct.Orientation = OrientationEnum.Portrait;
                break;
            }
            case "rendition:flow-auto": {
                propertiesStruct.Overflow = OverflowEnum.Auto;
                break;
            }
            case "rendition:flow-paginated": {
                propertiesStruct.Overflow = OverflowEnum.Paginated;
                break;
            }
            case "rendition:flow-scrolled-continuous": {
                propertiesStruct.Overflow = OverflowEnum.ScrolledContinuous;
                break;
            }
            case "rendition:flow-scrolled-doc": {
                propertiesStruct.Overflow = OverflowEnum.Scrolled;
                break;
            }
            default: {
                break;
            }
        }

        if (propertiesStruct.Layout ||
            propertiesStruct.Orientation ||
            propertiesStruct.Overflow ||
            propertiesStruct.Page ||
            propertiesStruct.Spread ||
            (propertiesStruct.Contains && propertiesStruct.Contains.length)) {

            link.Properties = propertiesStruct;
        }
    }
};

const addMediaOverlay = (link: Link, linkEpub: Manifest, rootfile: Rootfile, opf: OPF) => {
    if (linkEpub.MediaOverlay) {
        const meta = findMetaByRefineAndProperty(rootfile, opf, linkEpub.MediaOverlay, "media:duration");
        if (meta) {
            link.Duration = timeStrToSeconds(meta.Data);
        }
    }
};

const findInManifestByID =
    async (publication: Publication, rootfile: Rootfile, opf: OPF, ID: string): Promise<Link> => {

        if (opf.Manifest && opf.Manifest.length) {
            const item = opf.Manifest.find((manItem) => {
                if (manItem.ID === ID) {
                    return true;
                }
                return false;
            });
            if (item && opf.ZipPath) {
                const linkItem = new Link();
                linkItem.TypeLink = item.MediaType;

                const itemHrefDecoded = item.HrefDecoded;
                if (!itemHrefDecoded) {
                    return Promise.reject("item.Href?!");
                }
                linkItem.setHrefDecoded(path.join(path.dirname(opf.ZipPath), itemHrefDecoded)
                    .replace(/\\/g, "/"));

                await addRelAndPropertiesToLink(publication, linkItem, item, rootfile, opf);
                addMediaOverlay(linkItem, item, rootfile, opf);
                return linkItem;
            }
        }
        return Promise.reject(`ID ${ID} not found`);
    };

const addRendition = async (publication: Publication, _rootfile: Rootfile, opf: OPF, zip: IZip) => {

    if (opf.Metadata && opf.Metadata.Meta && opf.Metadata.Meta.length) {
        const rendition = new Properties();

        opf.Metadata.Meta.forEach((meta) => {
            switch (meta.Property) {
                case "rendition:layout": {
                    switch (meta.Data) {
                        case "pre-paginated": {
                            rendition.Layout = LayoutEnum.Fixed;
                            break;
                        }
                        case "reflowable": {
                            rendition.Layout = LayoutEnum.Reflowable;
                            break;
                        }
                    }
                    break;
                }
                case "rendition:orientation": {
                    switch (meta.Data) {
                        case "auto": {
                            rendition.Orientation = OrientationEnum.Auto;
                            break;
                        }
                        case "landscape": {
                            rendition.Orientation = OrientationEnum.Landscape;
                            break;
                        }
                        case "portrait": {
                            rendition.Orientation = OrientationEnum.Portrait;
                            break;
                        }
                    }
                    break;
                }
                case "rendition:spread": {
                    switch (meta.Data) {
                        case "auto": {
                            rendition.Spread = SpreadEnum.Auto;
                            break;
                        }
                        case "both": {
                            rendition.Spread = SpreadEnum.Both;
                            break;
                        }
                        case "none": {
                            rendition.Spread = SpreadEnum.None;
                            break;
                        }
                        case "landscape": {
                            rendition.Spread = SpreadEnum.Landscape;
                            break;
                        }
                        case "portrait": { // https://github.com/readium/webpub-manifest/issues/24
                            rendition.Spread = SpreadEnum.Both;
                            break;
                        }
                    }
                    break;
                }
                case "rendition:flow": {
                    switch (meta.Data) {
                        case "auto": {
                            rendition.Overflow = OverflowEnum.Auto;
                            break;
                        }
                        case "paginated": {
                            rendition.Overflow = OverflowEnum.Paginated;
                            break;
                        }
                        case "scrolled": {
                            rendition.Overflow = OverflowEnum.Scrolled;
                            break;
                        }
                        case "scrolled-continuous": {
                            rendition.Overflow = OverflowEnum.ScrolledContinuous;
                            break;
                        }
                    }
                    break;
                }
                default: {
                    break;
                }
            }
        });

        if (!rendition.Layout || !rendition.Orientation) {

            let displayOptionsZipPath = "META-INF/com.apple.ibooks.display-options.xml";
            let has = await zipHasEntry(zip, displayOptionsZipPath, undefined);
            if (has) {
                debug("Info: found iBooks display-options XML");
            } else {
                displayOptionsZipPath = "META-INF/com.kobobooks.display-options.xml";
                has = await zipHasEntry(zip, displayOptionsZipPath, undefined);
                if (has) {
                    debug("Info: found Kobo display-options XML");
                }
            }
            if (!has) {
                debug("Info: not found iBooks or Kobo display-options XML");
            } else {
                let displayOptionsZipStream_: IStreamAndLength | undefined;
                try {
                    displayOptionsZipStream_ = await zip.entryStreamPromise(displayOptionsZipPath);
                } catch (err) {
                    debug(err);
                }
                if (displayOptionsZipStream_) {
                    const displayOptionsZipStream = displayOptionsZipStream_.stream;

                    let displayOptionsZipData: Buffer | undefined;
                    try {
                        displayOptionsZipData = await streamToBufferPromise(displayOptionsZipStream);
                    } catch (err) {
                        debug(err);
                    }
                    if (displayOptionsZipData) {
                        try {
                            const displayOptionsStr = displayOptionsZipData.toString("utf8");
                            const displayOptionsDoc = new xmldom.DOMParser().parseFromString(displayOptionsStr);

                            const displayOptions = XML.deserialize<DisplayOptions>(displayOptionsDoc, DisplayOptions);
                            displayOptions.ZipPath = displayOptionsZipPath;

                            if (displayOptions && displayOptions.Platforms) {
                                const renditionPlatformAll = new Properties();
                                const renditionPlatformIpad = new Properties();
                                const renditionPlatformIphone = new Properties();
                                displayOptions.Platforms.forEach((platform) => {
                                    if (platform.Options) {
                                        platform.Options.forEach((option) => {
                                            if (!rendition.Layout) {
                                                // tslint:disable-next-line:max-line-length
                                                // https://github.com/readium/architecture/blob/master/streamer/parser/metadata.md#epub-2x-9
                                                if (option.Name === "fixed-layout") {
                                                    if (option.Value === "true") {
                                                        rendition.Layout = LayoutEnum.Fixed;
                                                    } else {
                                                        rendition.Layout = LayoutEnum.Reflowable;
                                                    }
                                                }
                                            }
                                            if (!rendition.Orientation) {
                                                // tslint:disable-next-line:max-line-length
                                                // https://github.com/readium/architecture/blob/master/streamer/parser/metadata.md#epub-2x-10
                                                if (option.Name === "orientation-lock") {
                                                    const rend = platform.Name === "*" ? renditionPlatformAll :
                                                        (platform.Name === "ipad" ? renditionPlatformIpad :
                                                        (platform.Name === "iphone" ? renditionPlatformIphone :
                                                        renditionPlatformAll));
                                                    switch (option.Value) {
                                                        case "none": {
                                                            rend.Orientation = OrientationEnum.Auto;
                                                            break;
                                                        }
                                                        case "landscape-only": {
                                                            rend.Orientation = OrientationEnum.Landscape;
                                                            break;
                                                        }
                                                        case "portrait-only": {
                                                            rend.Orientation = OrientationEnum.Portrait;
                                                            break;
                                                        }
                                                        default: {
                                                            rend.Orientation = OrientationEnum.Auto;
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        });
                                    }
                                });
                                if (renditionPlatformAll.Orientation) {
                                    rendition.Orientation = renditionPlatformAll.Orientation;
                                } else if (renditionPlatformIpad.Orientation) {
                                    rendition.Orientation = renditionPlatformIpad.Orientation;
                                } else if (renditionPlatformIphone.Orientation) {
                                    rendition.Orientation = renditionPlatformIphone.Orientation;
                                }
                            }
                        } catch (err) {
                            debug(err);
                        }
                    }
                }
            }
        }
        if (rendition.Layout || rendition.Orientation || rendition.Overflow || rendition.Page || rendition.Spread) {
            publication.Metadata.Rendition = rendition;
        }
    }
};

const fillSpineAndResource = async (publication: Publication, rootfile: Rootfile, opf: OPF) => {

    if (!opf.ZipPath) {
        return;
    }

    if (opf.Spine && opf.Spine.Items && opf.Spine.Items.length) {
        // no forEach(), because of await/async within the iteration body
        // opf.Spine.Items.forEach(async (item) => {
        for (const item of opf.Spine.Items) {

            if (!item.Linear || item.Linear === "yes") {

                let linkItem: Link;
                try {
                    linkItem = await findInManifestByID(publication, rootfile, opf, item.IDref);
                } catch (err) {
                    debug(err);
                    continue;
                }

                if (linkItem && linkItem.Href) {
                    if (!publication.Spine) {
                        publication.Spine = [];
                    }
                    publication.Spine.push(linkItem);
                }
            }
        }
    }

    if (opf.Manifest && opf.Manifest.length) {

        // no forEach(), because of await/async within the iteration body
        // opf.Manifest.forEach(async (item) => {
        for (const item of opf.Manifest) {

            const itemHrefDecoded = item.HrefDecoded;
            if (!itemHrefDecoded) {
                console.log("!? item.Href");
                continue;
            }
            const zipPath = path.join(path.dirname(opf.ZipPath), itemHrefDecoded)
                .replace(/\\/g, "/");
            const linkSpine = findInSpineByHref(publication, zipPath);
            if (!linkSpine || !linkSpine.Href) {

                const linkItem = new Link();
                linkItem.TypeLink = item.MediaType;

                linkItem.setHrefDecoded(zipPath);

                await addRelAndPropertiesToLink(publication, linkItem, item, rootfile, opf);
                addMediaOverlay(linkItem, item, rootfile, opf);

                if (!publication.Resources) {
                    publication.Resources = [];
                }
                publication.Resources.push(linkItem);
            }
        }
    }
};

const fillEncryptionInfo =
    (publication: Publication, _rootfile: Rootfile, _opf: OPF, encryption: Encryption, lcp: LCP | undefined) => {

        encryption.EncryptedData.forEach((encInfo) => {
            const encrypted = new Encrypted();
            encrypted.Algorithm = encInfo.EncryptionMethod.Algorithm;

            if (lcp &&
                encrypted.Algorithm !== "http://www.idpf.org/2008/embedding" &&
                encrypted.Algorithm !== "http://ns.adobe.com/pdf/enc#RC") {
                encrypted.Profile = lcp.Encryption.Profile;
                encrypted.Scheme = "http://readium.org/2014/01/lcp";
            }
            if (encInfo.EncryptionProperties && encInfo.EncryptionProperties.length) {

                encInfo.EncryptionProperties.forEach((prop) => {

                    if (prop.Compression) {
                        if (prop.Compression.OriginalLength) {
                            encrypted.OriginalLength = parseFloat(prop.Compression.OriginalLength);
                        }
                        if (prop.Compression.Method === "8") {
                            encrypted.Compression = "deflate";
                        } else {
                            encrypted.Compression = "none";
                        }
                    }
                });
            }

            if (publication.Resources) {
                publication.Resources.forEach((l, _i, _arr) => {

                    const filePath = l.Href;
                    if (filePath === encInfo.CipherData.CipherReference.URI) {
                        if (!l.Properties) {
                            l.Properties = new Properties();
                        }
                        l.Properties.Encrypted = encrypted;
                    }
                });
            }

            if (publication.Spine) {
                publication.Spine.forEach((l, _i, _arr) => {
                    const filePath = l.Href;
                    if (filePath === encInfo.CipherData.CipherReference.URI) {
                        if (!l.Properties) {
                            l.Properties = new Properties();
                        }
                        l.Properties.Encrypted = encrypted;
                    }
                });
            }
        });
    };

const fillPageListFromNCX = (publication: Publication, _rootfile: Rootfile, _opf: OPF, ncx: NCX) => {
    if (ncx.PageList && ncx.PageList.PageTarget && ncx.PageList.PageTarget.length) {
        ncx.PageList.PageTarget.forEach((pageTarget) => {
            const link = new Link();
            const srcDecoded = pageTarget.Content.SrcDecoded;
            if (!srcDecoded) {
                console.log("!?srcDecoded");
                return; // foreach
            }
            const zipPath = path.join(path.dirname(ncx.ZipPath), srcDecoded)
                .replace(/\\/g, "/");

            link.setHrefDecoded(zipPath);

            link.Title = pageTarget.Text;
            if (!publication.PageList) {
                publication.PageList = [];
            }
            publication.PageList.push(link);
        });
    }
};

const fillPageListFromAdobePageMap = async (
    publication: Publication,
    _rootfile: Rootfile,
    _opf: OPF,
    zip: IZip,
    l: Link,
): Promise<void> => {
    if (!l.HrefDecoded) {
        return;
    }
    const pageMapContent = await createDocStringFromZipPath(l, zip);
    if (!pageMapContent) {
        return;
    }
    const pageMapXmlDoc = new xmldom.DOMParser().parseFromString(pageMapContent);

    const pages = pageMapXmlDoc.getElementsByTagName("page");
    if (pages && pages.length) {
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < pages.length; i += 1) {
            const page = pages.item(i)!;

            const link = new Link();
            const href = page.getAttribute("href");
            const title = page.getAttribute("name");
            if (href === null || title === null) {
                continue;
            }

            if (!publication.PageList) {
                publication.PageList = [];
            }

            const hrefDecoded = tryDecodeURI(href);
            if (!hrefDecoded) {
                continue;
            }
            const zipPath = path.join(path.dirname(l.HrefDecoded), hrefDecoded)
                .replace(/\\/g, "/");

            link.setHrefDecoded(zipPath);

            link.Title = title;
            publication.PageList.push(link);
        }
    }
};

const createDocStringFromZipPath = async (link: Link, zip: IZip): Promise<string | undefined> => {
    const linkHrefDecoded = link.HrefDecoded;
    if (!linkHrefDecoded) {
        console.log("!?link.HrefDecoded");
        return undefined;
    }
    const has = await zipHasEntry(zip, linkHrefDecoded, link.Href);
    if (!has) {
        console.log(`NOT IN ZIP (createDocStringFromZipPath): ${link.Href} --- ${linkHrefDecoded}`);
        const zipEntries = await zip.getEntries();
        for (const zipEntry of zipEntries) {
            console.log(zipEntry);
        }
        return undefined;
    }

    let zipStream_: IStreamAndLength;
    try {
        zipStream_ = await zip.entryStreamPromise(linkHrefDecoded);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }
    const zipStream = zipStream_.stream;

    let zipData: Buffer;
    try {
        zipData = await streamToBufferPromise(zipStream);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }

    return zipData.toString("utf8");
};

const fillTOCFromNCX = (publication: Publication, rootfile: Rootfile, opf: OPF, ncx: NCX) => {
    if (ncx.Points && ncx.Points.length) {
        ncx.Points.forEach((point) => {
            if (!publication.TOC) {
                publication.TOC = [];
            }
            fillTOCFromNavPoint(publication, rootfile, opf, ncx, point, publication.TOC);
        });
    }
};

const fillLandmarksFromGuide = (publication: Publication, _rootfile: Rootfile, opf: OPF) => {
    if (opf.Guide && opf.Guide.length) {
        opf.Guide.forEach((ref) => {
            if (ref.Href && opf.ZipPath) {
                const refHrefDecoded = ref.HrefDecoded;
                if (!refHrefDecoded) {
                    console.log("ref.Href?!");
                    return; // foreach
                }
                const link = new Link();
                const zipPath = path.join(path.dirname(opf.ZipPath), refHrefDecoded)
                    .replace(/\\/g, "/");

                link.setHrefDecoded(zipPath);

                link.Title = ref.Title;
                if (!publication.Landmarks) {
                    publication.Landmarks = [];
                }
                publication.Landmarks.push(link);
            }
        });
    }
};

const fillTOCFromNavPoint =
    (publication: Publication, rootfile: Rootfile, opf: OPF, ncx: NCX, point: NavPoint, node: Link[]) => {

        const srcDecoded = point.Content.SrcDecoded;
        if (!srcDecoded) {
            console.log("?!point.Content.Src");
            return;
        }
        const link = new Link();
        const zipPath = path.join(path.dirname(ncx.ZipPath), srcDecoded)
            .replace(/\\/g, "/");

        link.setHrefDecoded(zipPath);

        link.Title = point.Text;

        if (point.Points && point.Points.length) {
            point.Points.forEach((p) => {
                if (!link.Children) {
                    link.Children = [];
                }
                fillTOCFromNavPoint(publication, rootfile, opf, ncx, p, link.Children);
            });
        }

        node.push(link);
    };

const fillSubject = (publication: Publication, _rootfile: Rootfile, opf: OPF) => {
    if (opf.Metadata && opf.Metadata.Subject && opf.Metadata.Subject.length) {
        opf.Metadata.Subject.forEach((s) => {
            const sub = new Subject();
            if (s.Lang) {
                sub.Name = {} as IStringMap;
                sub.Name[s.Lang] = s.Data;
            } else {
                sub.Name = s.Data;
            }
            sub.Code = s.Term;
            sub.Scheme = s.Authority;
            if (!publication.Metadata.Subject) {
                publication.Metadata.Subject = [];
            }
            publication.Metadata.Subject.push(sub);
        });
    }
};

const fillCalibreSerieInfo = (publication: Publication, _rootfile: Rootfile, opf: OPF) => {
    let serie: string | undefined;
    let seriePosition: number | undefined;

    if (opf.Metadata && opf.Metadata.Meta && opf.Metadata.Meta.length) {
        opf.Metadata.Meta.forEach((m) => {
            if (m.Name === "calibre:series") {
                serie = m.Content;
            }
            if (m.Name === "calibre:series_index") {
                seriePosition = parseFloat(m.Content);
            }
        });
    }

    if (serie) {
        const contributor = new Contributor();
        contributor.Name = serie;
        if (seriePosition) {
            contributor.Position = seriePosition;
        }
        if (!publication.Metadata.BelongsTo) {
            publication.Metadata.BelongsTo = new BelongsTo();
        }
        if (!publication.Metadata.BelongsTo.Series) {
            publication.Metadata.BelongsTo.Series = [];
        }
        publication.Metadata.BelongsTo.Series.push(contributor);
    }
};

const fillTOCFromNavDoc = async (publication: Publication, _rootfile: Rootfile, _opf: OPF, zip: IZip):
    Promise<void> => {

    const navLink = publication.GetNavDoc();
    if (!navLink) {
        return;
    }

    const navLinkHrefDecoded = navLink.HrefDecoded;
    if (!navLinkHrefDecoded) {
        console.log("!?navLink.HrefDecoded");
        return;
    }

    const has = await zipHasEntry(zip, navLinkHrefDecoded, navLink.Href);
    if (!has) {
        console.log(`NOT IN ZIP (fillTOCFromNavDoc): ${navLink.Href} --- ${navLinkHrefDecoded}`);
        const zipEntries = await zip.getEntries();
        for (const zipEntry of zipEntries) {
            console.log(zipEntry);
        }
        return;
    }

    let navDocZipStream_: IStreamAndLength;
    try {
        navDocZipStream_ = await zip.entryStreamPromise(navLinkHrefDecoded);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }
    const navDocZipStream = navDocZipStream_.stream;

    let navDocZipData: Buffer;
    try {
        navDocZipData = await streamToBufferPromise(navDocZipStream);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }

    const navDocStr = navDocZipData.toString("utf8");
    const navXmlDoc = new xmldom.DOMParser().parseFromString(navDocStr);

    const select = xpath.useNamespaces({
        epub: "http://www.idpf.org/2007/ops",
        xhtml: "http://www.w3.org/1999/xhtml",
    });

    const navs = select("/xhtml:html/xhtml:body//xhtml:nav", navXmlDoc) as Element[];
    if (navs && navs.length) {

        navs.forEach((navElement: Element) => {

            const epubType = select("@epub:type", navElement) as Attr[];
            if (epubType && epubType.length) {

                const olElem = select("xhtml:ol", navElement) as Element[];

                const rolesString = epubType[0].value;
                const rolesArray = parseSpaceSeparatedString(rolesString);

                if (rolesArray.length) {
                    for (const role of rolesArray) {
                        switch (role) {
                            case "toc": {
                                publication.TOC = [];
                                fillTOCFromNavDocWithOL(select, olElem, publication.TOC, navLinkHrefDecoded);
                                break;
                            }
                            case "page-list": {
                                publication.PageList = [];
                                fillTOCFromNavDocWithOL(select, olElem, publication.PageList, navLinkHrefDecoded);
                                break;
                            }
                            case "landmarks": {
                                publication.Landmarks = [];
                                fillTOCFromNavDocWithOL(select, olElem, publication.Landmarks, navLinkHrefDecoded);
                                break;
                            }
                            case "lot": {
                                publication.LOT = [];
                                fillTOCFromNavDocWithOL(select, olElem, publication.LOT, navLinkHrefDecoded);
                                break;
                            }
                            case "loa": {
                                publication.LOA = [];
                                fillTOCFromNavDocWithOL(select, olElem, publication.LOA, navLinkHrefDecoded);
                                break;
                            }
                            case "loi": {
                                publication.LOI = [];
                                fillTOCFromNavDocWithOL(select, olElem, publication.LOI, navLinkHrefDecoded);
                                break;
                            }
                            case "lov": {
                                publication.LOV = [];
                                fillTOCFromNavDocWithOL(select, olElem, publication.LOV, navLinkHrefDecoded);
                                break;
                            }
                            default: {
                                break; // "switch", not enclosing "for" loop
                            }
                        }
                    }
                }
            }
        });
    }
};

const fillTOCFromNavDocWithOL = (
    select: xpath.XPathSelect,
    olElems: Element[],
    children: Link[],
    navDocPath: string) => {

    olElems.forEach((olElem: Element) => {

        const liElems = select("xhtml:li", olElem) as Element[];
        if (liElems && liElems.length) {

            liElems.forEach((liElem) => {

                const link = new Link();
                children.push(link);

                const aElems = select("xhtml:a", liElem) as Element[];
                if (aElems && aElems.length > 0) {

                    const epubType = select("@epub:type", aElems[0]) as Attr[];
                    if (epubType && epubType.length) {

                        const rolesString = epubType[0].value;
                        const rolesArray = parseSpaceSeparatedString(rolesString);

                        if (rolesArray.length) {
                            link.AddRels(rolesArray);
                        }
                    }

                    const aHref = select("@href", aElems[0]) as Attr[];
                    if (aHref && aHref.length) {
                        const val = aHref[0].value;
                        let valDecoded = tryDecodeURI(val);
                        if (!valDecoded) {
                            console.log("!?valDecoded");
                            return; // foreach
                        }
                        if (val[0] === "#") {
                            valDecoded = path.basename(navDocPath) + valDecoded;
                        }

                        const zipPath = path.join(path.dirname(navDocPath), valDecoded)
                            .replace(/\\/g, "/");

                        link.setHrefDecoded(zipPath);
                    }

                    let aText = aElems[0].textContent; // select("text()", aElems[0])[0].data;
                    if (aText && aText.length) {
                        aText = aText.trim();
                        aText = aText.replace(/\s\s+/g, " ");
                        link.Title = aText;
                    }
                } else {
                    const liFirstChild = select("xhtml:*[1]", liElem) as Element[];
                    if (liFirstChild && liFirstChild.length && liFirstChild[0].textContent) {
                        link.Title = liFirstChild[0].textContent.trim();
                    }
                }

                const olElemsNext = select("xhtml:ol", liElem) as Element[];
                if (olElemsNext && olElemsNext.length) {
                    if (!link.Children) {
                        link.Children = [];
                    }
                    fillTOCFromNavDocWithOL(select, olElemsNext, link.Children, navDocPath);
                }
            });
        }
    });
};

const addCoverRel = async (publication: Publication, rootfile: Rootfile, opf: OPF) => {

    let coverID: string | undefined;

    if (opf.Metadata && opf.Metadata.Meta && opf.Metadata.Meta.length) {
        opf.Metadata.Meta.find((meta) => {
            if (meta.Name === "cover") {
                coverID = meta.Content;
                return true;
            }
            return false;
        });
    }

    if (coverID) {
        let manifestInfo: Link;
        try {
            manifestInfo = await findInManifestByID(publication, rootfile, opf, coverID);
        } catch (err) {
            debug(err);
            return;
        }
        if (manifestInfo && manifestInfo.Href && publication.Resources && publication.Resources.length) {

            const href = manifestInfo.Href;
            const linky = publication.Resources.find((item, _i, _arr) => {
                if (item.Href === href) {
                    return true;
                }
                return false;
            });
            if (linky) { // publication.Resources[i]
                linky.AddRel("cover");
                await addCoverDimensions(publication, linky);
            }
        }
    }
};

const findPropertiesInSpineForManifest = (linkEpub: Manifest, _rootfile: Rootfile, opf: OPF): string | undefined => {

    if (opf.Spine && opf.Spine.Items && opf.Spine.Items.length) {
        const it = opf.Spine.Items.find((item) => {
            if (item.IDref === linkEpub.ID) {
                return true;
            }
            return false;
        });
        if (it && it.Properties) {
            return it.Properties;
        }
    }

    return undefined;
};

const findInSpineByHref = (publication: Publication, href: string): Link | undefined => {

    if (publication.Spine && publication.Spine.length) {
        const ll = publication.Spine.find((l) => {
            if (l.HrefDecoded === href) {
                return true;
            }
            return false;
        });
        if (ll) {
            return ll;
        }
    }

    return undefined;
};

const findMetaByRefineAndProperty = (
    rootfile: Rootfile, opf: OPF, ID: string, property: string): Metafield | undefined => {

    const ret = findAllMetaByRefineAndProperty(rootfile, opf, ID, property);
    if (ret.length) {
        return ret[0];
    }
    return undefined;
};

const findAllMetaByRefineAndProperty = (_rootfile: Rootfile, opf: OPF, ID: string, property: string): Metafield[] => {
    const metas: Metafield[] = [];

    const refineID = "#" + ID;

    if (opf.Metadata && opf.Metadata.Meta) {
        opf.Metadata.Meta.forEach((metaTag) => {
            if (metaTag.Refine === refineID && metaTag.Property === property) {
                metas.push(metaTag);
            }
        });
    }

    return metas;
};

const getEpubVersion = (rootfile: Rootfile, opf: OPF): string | undefined => {

    if (rootfile.Version) {
        return rootfile.Version;
    } else if (opf.Version) {
        return opf.Version;
    }

    return undefined;
};

const isEpub3OrMore = (rootfile: Rootfile, opf: OPF): boolean => {

    const version = getEpubVersion(rootfile, opf);
    return (version === epub3 || version === epub301 || version === epub31);
};

const findLinKByHref = (publication: Publication, _rootfile: Rootfile, _opf: OPF, href: string): Link | undefined => {
    if (publication.Spine && publication.Spine.length) {
        const ll = publication.Spine.find((l) => {
            if (href === l.HrefDecoded) {
                return true;
            }
            return false;
        });
        if (ll) {
            return ll;
        }
    }

    return undefined;
};
