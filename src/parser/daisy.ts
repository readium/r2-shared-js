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
import { ParsedFile } from "@models/parsed-file";
import { Publication } from "@models/publication";
import { Link } from "@models/publication-link";
import { encodeURIComponent_RFC3986, isHTTP } from "@r2-utils-js/_utils/http/UrlUtils";
import { streamToBufferPromise } from "@r2-utils-js/_utils/stream/BufferUtils";
import { XML } from "@r2-utils-js/_utils/xml-js-mapper";
import { IStreamAndLength, IZip } from "@r2-utils-js/_utils/zip/zip";
import { zipLoadPromise } from "@r2-utils-js/_utils/zip/zipFactory";
import { Transformers } from "@transform/transformer";

import { tryDecodeURI } from "../_utils/decodeURI";
import { zipHasEntry } from "../_utils/zipHasEntry";
import { NCX } from "./daisy/ncx";
import { NavPoint } from "./daisy/ncx-navpoint";
import { OPF } from "./daisy/opf";
import { Author } from "./daisy/opf-author";
import { Manifest } from "./daisy/opf-manifest";
import { Metafield } from "./daisy/opf-metafield";
import { SpineItem } from "./daisy/opf-spineitem";
import { Title } from "./daisy/opf-title";
import { SMIL } from "./daisy/smil";
import { Par } from "./daisy/smil-par";
import { Seq } from "./daisy/smil-seq";
import { SeqOrPar } from "./daisy/smil-seq-or-par";

const debug = debug_("r2:shared#parser/epub");

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
            debug(`NOT IN ZIP (addCoverDimensions): ${coverLink.Href} --- ${coverLinkHrefDecoded}`);
            const zipEntries = await zip.getEntries();
            for (const zipEntry of zipEntries) {
                debug(zipEntry);
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

export enum Daisyis {
    LocalExploded = "LocalExploded",
    LocalPacked = "LocalPacked",
    RemoteExploded = "RemoteExploded",
    RemotePacked = "RemotePacked",
}

export function isDaisyPublication(urlOrPath: string): Daisyis | undefined {
    const http = isHTTP(urlOrPath);
    if (http) {
        return Daisyis.RemoteExploded;
    // } else if (fs.existsSync(path.join(urlOrPath, "package.opf"))) {
    } else if (getOPFFileName(urlOrPath)) {
        return Daisyis.LocalExploded;
    }
    return undefined;
}

export async function DaisyParsePromise(filePath: string): Promise<Publication> {

    // const isDaisy = isDaisyPublication(filePath);

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

    const files = await getFileNames(filePath);

    const [valid, message] = isFileValid(files);

    if (!valid) {
        return Promise.reject(message || "File validation failed.");
    }

    const opfFileName = findOpfFile(files);

    if (!opfFileName) {
        return Promise.reject("Opf File doesn't exists");
    }

    const rootfilePathDecoded = opfFileName || "package.opf"; // rootfile.PathDecoded;
    if (!rootfilePathDecoded) {
        return Promise.reject("?!rootfile.PathDecoded");
    }

    // let timeBegin = process.hrtime();
    let has = await zipHasEntry(zip, rootfilePathDecoded, undefined);
    // if (!has) {
    //     const err = `NOT IN ZIP (container OPF rootfile): --- ${rootfilePathDecoded}`;
    //     debug(err);
    //     const zipEntries = await zip.getEntries();
    //     for (const zipEntry of zipEntries) {
    //         debug(zipEntry);
    //     }
    //     return Promise.reject(err);
    // }

    // let opfZipStream_: IStreamAndLength;
    // try {
    //     opfZipStream_ = await zip.entryStreamPromise(rootfilePathDecoded);
    // } catch (err) {
    //     debug(err);
    //     return Promise.reject(err);
    // }
    // const opfZipStream = opfZipStream_.stream;

    // let opfZipData: Buffer;
    // try {
    //     opfZipData = await streamToBufferPromise(opfZipStream);
    // } catch (err) {
    //     debug(err);
    //     return Promise.reject(err);
    // }

    // const opfStr = opfZipData.toString("utf8");
    let opfStr = "";
    try {
        opfStr = await readFilesAsString(zip, rootfilePathDecoded);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }

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
    // debug(util.inspect(opf,
    //     { showHidden: false, depth: 1000, colors: true, customInspect: true }));

    // const epubVersion = getEpubVersion(rootfile, opf);

    let ncx: NCX | undefined;
    if (opf.Spine) {
        const ncxManItem = opf.Manifest.find((manifestItem) => {
            return manifestItem.ID === "ncx";
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
                debug(err);
                const zipEntries = await zip.getEntries();
                for (const zipEntry of zipEntries) {
                    debug(zipEntry);
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
            // debug(util.inspect(ncx,
            //     { showHidden: false, depth: 1000, colors: true, customInspect: true }));
        }
    }

    const opfMetadata = opf.Metadata;

    if (!opfMetadata) {
        return Promise.reject("Metadata is not present");
    }

    if (opfMetadata.DCMetadata) {
        if (opf.Metadata.DCMetadata.Language) {
            publication.Metadata.Language = opf.Metadata.DCMetadata.Language;
        }
    }

    addTitle(publication, opf);

    addIdentifier(publication, opf);

    if (opfMetadata) {
        const dcMetadata = opfMetadata.DCMetadata;
        if (dcMetadata.Rights && dcMetadata.Rights.length) {
            publication.Metadata.Rights = dcMetadata.Rights.join(" ");
        }
        if (dcMetadata.Description && dcMetadata.Description.length) {
            publication.Metadata.Description = dcMetadata.Description[0];
        }
        if (dcMetadata.Publisher && dcMetadata.Publisher.length) {
            publication.Metadata.Publisher = [];

            dcMetadata.Publisher.forEach((pub) => {
                const contrib = new Contributor();
                contrib.Name = pub;
                publication.Metadata.Publisher.push(contrib);
            });
        }
        if (dcMetadata.Source && dcMetadata.Source.length) {
            publication.Metadata.Source = dcMetadata.Source[0];
        }

        if (dcMetadata.Contributor && dcMetadata.Contributor.length) {
            // dcMetadata.Contributor.forEach((cont) => {
            addContributor(publication, opf, undefined);
            // });
        }
        if (dcMetadata.Creator && dcMetadata.Creator.length) {
            //  dcMetadata.Creator.forEach((cont) => {
            addContributor(publication, opf, "aut");
            //  });
        }
    }
    const metasDuration: Metafield[] = [];
    const metasNarrator: Metafield[] = [];
    const metasActiveClass: Metafield[] = [];
    const metasPlaybackActiveClass: Metafield[] = [];

    opf.Metadata.XMetadata.Meta.forEach((metaTag) => {
        if (metaTag.Name === "dtb:totalTime") {
            metasDuration.push(metaTag);
        }
        if (metaTag.Name === "dtb:multimediaType") {
            metasNarrator.push(metaTag);
        }
        if (metaTag.Name === "dtb:multimediaContent") {
            metasActiveClass.push(metaTag);
        }
        if (metaTag.Name === "media:playback-active-class") {
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
    // }

    // if (opf.Spine && opf.Spine) {
    //     switch (opf.Spine.PageProgression) {
    //         case "auto": {
    //             publication.Metadata.Direction = DirectionEnum.Auto;
    //             break;
    //         }
    //         case "ltr": {
    //             publication.Metadata.Direction = DirectionEnum.LTR;
    //             break;
    //         }
    //         case "rtl": {
    //             publication.Metadata.Direction = DirectionEnum.RTL;
    //             break;
    //         }
    //     }
    // }

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

    findContributorInMeta(publication, opf);
    await parseDtBook(publication, files, zip, opf);
    await fillSpineAndResource(publication, opf, zip);

    //  await addRendition(publication, opf, zip);

    //  await addCoverRel(publication, opf, zip);

    // if (encryption) {
    //     fillEncryptionInfo(publication, rootfile, opf, encryption, lcpl);
    // }

    await fillTOCFromNavDoc(publication, opf, zip);

    if (!publication.TOC || !publication.TOC.length) {
        if (ncx) {
            await fillTOCFromNCX(publication, opf, ncx, zip);
            if (!publication.PageList) {
                await fillPageListFromNCX(publication, opf, ncx, zip);
            }
        }
        fillLandmarksFromGuide(publication, opf);
    }

    if (!publication.PageList && publication.Resources) {
        // EPUB extended with Adobe Digital Editions page map
        //  https://wiki.mobileread.com/wiki/Adobe_Digital_Editions#Page-map
        const pageMapLink = publication.Resources.find((item: Link): boolean => {
            return item.TypeLink === "application/oebps-page-map+xml";
        });
        if (pageMapLink) {
            await fillPageListFromAdobePageMap(publication, opf, zip, pageMapLink);
        }
    }

    fillCalibreSerieInfo(publication, opf);
    fillSubject(publication, opf);

    fillPublicationDate(publication, opf);

    // await fillMediaOverlay(publication, rootfile, opf, zip);

    return publication;
}

// private filePathToTitle(filePath: string): string {
//     const fileName = path.basename(filePath);
//     return slugify(fileName, "_").replace(/[\.]/g, "_");
// }

export async function getAllMediaOverlays(publication: Publication): Promise<MediaOverlayNode[]> {
    const mos: MediaOverlayNode[] = [];

    const links: Link[] = ([] as Link[]).
        concat(publication.Spine ? publication.Spine : []).
        concat(publication.Resources ? publication.Resources : []);

    for (const link of links) {
        if (link.MediaOverlays) {
            const mo = link.MediaOverlays;
            if (!mo.initialized) {
                try {
                    await lazyLoadMediaOverlays(publication, mo);
                } catch (err) {
                    return Promise.reject(err);
                }
            }
            mos.push(mo);
        }
    }

    return Promise.resolve(mos);
}

export async function getMediaOverlay(publication: Publication, spineHref: string): Promise<MediaOverlayNode> {

    const links: Link[] = ([] as Link[]).
        concat(publication.Spine ? publication.Spine : []).
        concat(publication.Resources ? publication.Resources : []);

    for (const link of links) {
        if (link.MediaOverlays && link.Href.indexOf(spineHref) >= 0) {
            const mo = link.MediaOverlays;
            if (!mo.initialized) {
                try {
                    await lazyLoadMediaOverlays(publication, mo);
                } catch (err) {
                    return Promise.reject(err);
                }
            }
            return Promise.resolve(mo);
        }
    }

    return Promise.reject(`No Media Overlays ${spineHref}`);
}

export const lazyLoadMediaOverlays =
    async (publication: Publication, mo: MediaOverlayNode) => {

        if (mo.initialized || !mo.SmilPathInZip) {
            return;
        }

        let link: Link | undefined;
        if (publication.Resources) {

            link = publication.Resources.find((l) => {
                if (l.Href === mo.SmilPathInZip) {
                    return true;
                }
                return false;
            });
            if (!link) {
                if (publication.Spine) {
                    link = publication.Spine.find((l) => {
                        if (l.Href === mo.SmilPathInZip) {
                            return true;
                        }
                        return false;
                    });
                }
            }
            if (!link) {
                const err = "Asset not declared in publication spine/resources! " + mo.SmilPathInZip;
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
            const err = `NOT IN ZIP (lazyLoadMediaOverlays): ${mo.SmilPathInZip}`;
            debug(err);
            const zipEntries = await zip.getEntries();
            for (const zipEntry of zipEntries) {
                debug(zipEntry);
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
        // debug(util.inspect(smil,
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
                    debug("!?smilBodyTextRefDecoded");
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

// const fillMediaOverlay =
//     async (publication: Publication, rootfile: Rootfile, opf: OPF, zip: IZip) => {

//         if (!publication.Resources) {
//             return;
//         }

//         for (const item of publication.Resources) {
//             if (item.TypeLink !== "application/smil+xml") {
//                 continue;
//             }

//             const itemHrefDecoded = item.HrefDecoded;
//             if (!itemHrefDecoded) {
//                 debug("?!item.HrefDecoded");
//                 continue;
//             }
//             const has = await zipHasEntry(zip, itemHrefDecoded, item.Href);
//             if (!has) {
//                 debug(`NOT IN ZIP (fillMediaOverlay): ${item.HrefDecoded} --- ${itemHrefDecoded}`);
//                 const zipEntries = await zip.getEntries();
//                 for (const zipEntry of zipEntries) {
//                     debug(zipEntry);
//                 }
//                 continue;
//             }

//             const manItemsHtmlWithSmil: Manifest[] = [];
//             opf.Manifest.forEach((manItemHtmlWithSmil) => {
//                 if (manItemHtmlWithSmil.MediaOverlay) { // HTML
//                     const manItemSmil = opf.Manifest.find((mi) => {
//                         if (mi.ID === manItemHtmlWithSmil.MediaOverlay) {
//                             return true;
//                         }
//                         return false;
//                     });
//                     if (manItemSmil && opf.ZipPath) {
//                         const manItemSmilHrefDecoded = manItemSmil.HrefDecoded;
//                         if (!manItemSmilHrefDecoded) {
//                             debug("!?manItemSmil.HrefDecoded");
//                             return; // foreach
//                         }
//                         const smilFilePath = path.join(path.dirname(opf.ZipPath), manItemSmilHrefDecoded)
//                                 .replace(/\\/g, "/");
//                         if (smilFilePath === itemHrefDecoded) {
//                             manItemsHtmlWithSmil.push(manItemHtmlWithSmil);
//                         } else {
//                             debug(`smilFilePath !== itemHrefDecoded ?! ${smilFilePath} ${itemHrefDecoded}`);
//                         }
//                     }
//                 }
//             });

//             const mo = new MediaOverlayNode();
//             mo.SmilPathInZip = itemHrefDecoded;
//             mo.initialized = false;

//             manItemsHtmlWithSmil.forEach((manItemHtmlWithSmil) => {

//                 if (!opf.ZipPath) {
//                     return;
//                 }
//                 const manItemHtmlWithSmilHrefDecoded = manItemHtmlWithSmil.HrefDecoded;
//                 if (!manItemHtmlWithSmilHrefDecoded) {
//                     debug("?!manItemHtmlWithSmil.HrefDecoded");
//                     return; // foreach
//                 }
//                 const htmlPathInZip = path.join(path.dirname(opf.ZipPath), manItemHtmlWithSmilHrefDecoded)
//                     .replace(/\\/g, "/");

//                 const link = findLinKByHref(publication, rootfile, opf, htmlPathInZip);
//                 if (link) {
//                     if (link.MediaOverlays) {
//                         debug(`#### MediaOverlays?! ${htmlPathInZip} => ${link.MediaOverlays.SmilPathInZip}`);
//                         return; // continue for each
//                     }

//                     const moURL = mediaOverlayURLPath + "?" +
//                         mediaOverlayURLParam + "=" + encodeURIComponent_RFC3986(link.Href);

//                     // legacy method:
//                     if (!link.Properties) {
//                         link.Properties = new Properties();
//                     }
//                     link.Properties.MediaOverlay = moURL;

//                     // new method:
//                     // https://w3c.github.io/sync-media-pub/incorporating-synchronized-narration.html#with-webpub
//                     if (!link.Alternate) {
//                         link.Alternate = [];
//                     }
//                     const moLink = new Link();
//                     moLink.Href = moURL;
//                     moLink.TypeLink = "application/vnd.syncnarr+json";
//                     moLink.Duration = link.Duration;
//                     link.Alternate.push(moLink);
//                 }
//             });

//             if (item.Properties && item.Properties.Encrypted) {
//                 debug("ENCRYPTED SMIL MEDIA OVERLAY: " + item.Href);
//                 continue;
//             }
//             // LAZY
//             // await lazyLoadMediaOverlays(publication, mo);
//         }

//         return;
//     };

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
                debug("!?seqTextRefDecoded");
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
                debug("?!parTextSrcDcoded");
            } else {
                const zipPath = path.join(path.dirname(smil.ZipPath), parTextSrcDcoded)
                    .replace(/\\/g, "/");
                moc.Text = zipPath;
            }
        }
        if (par.Audio && par.Audio.Src) {
            const parAudioSrcDcoded = par.Audio.SrcDecoded;
            if (!parAudioSrcDcoded) {
                debug("?!parAudioSrcDcoded");
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

const fillPublicationDate = (publication: Publication, opf: OPF) => {

    if (opf.Metadata && opf.Metadata.DCMetadata.Date && opf.Metadata.DCMetadata.Date.length) {

        if (opf.Metadata.DCMetadata.Date[0] && opf.Metadata.DCMetadata.Date[0].Data) {
            const token = opf.Metadata.DCMetadata.Date[0].Data;
            try {
                const mom = moment(token);
                if (mom.isValid()) {
                    publication.Metadata.PublicationDate = mom.toDate();
                }
            } catch (err) {
                debug("INVALID DATE/TIME? " + token);
            }
            return;
        }

        opf.Metadata.DCMetadata.Date.forEach((date) => {
            if (date.Data && date.Event && date.Event.indexOf("publication") >= 0) {
                const token = date.Data;
                try {
                    const mom = moment(token);
                    if (mom.isValid()) {
                        publication.Metadata.PublicationDate = mom.toDate();
                    }
                } catch (err) {
                    debug("INVALID DATE/TIME? " + token);
                }
            }
        });
    }
};

const findContributorInMeta = (publication: Publication, opf: OPF) => {

    if (opf.Metadata && opf.Metadata.XMetadata) {
        opf.Metadata.XMetadata.Meta.forEach((meta) => {
            if (meta.Property === "dcterms:creator" || meta.Property === "dcterms:contributor") {
                const cont = new Author();
                cont.Data = meta.Data;
                cont.ID = meta.ID;
                addContributor(publication, opf, undefined);
            }
        });
    }
};

const addContributor = (
    publication: Publication, opf: OPF, forcedRole: string | undefined) => {

    const dcMetadata = opf.Metadata.DCMetadata;

    dcMetadata.Contributor.forEach((cont) => {

        const contributor = new Contributor();
        contributor.Name = cont.Data;
        contributor.SortAs = cont.FileAs;
        contributor.Role[0] = cont.Role;

        let role = cont.Role;
        if (!role && forcedRole) {
            role = forcedRole;
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
    });
};

const addIdentifier = (publication: Publication, opf: OPF) => {
    if (opf.Metadata.DCMetadata && opf.Metadata.DCMetadata.Identifier) {
        if (opf.UniqueIdentifier && opf.Metadata.DCMetadata.Identifier.length > 1) {
            opf.Metadata.DCMetadata.Identifier.forEach((iden) => {
                if (iden.ID === opf.UniqueIdentifier) {
                    publication.Metadata.Identifier = iden.Data;
                }
            });
        } else if (opf.Metadata.DCMetadata.Identifier.length > 0) {
            publication.Metadata.Identifier = opf.Metadata.DCMetadata.Identifier[0].Data;
        }
    }
};

const addTitle = (publication: Publication, opf: OPF) => {

    let mainTitle: Title | undefined;

    if (opf.Metadata &&
        opf.Metadata.DCMetadata &&
        opf.Metadata.DCMetadata.Title) {
        mainTitle = opf.Metadata.DCMetadata.Title[0];
    }

    if (mainTitle) {
        publication.Metadata.Title = mainTitle.Data;
    }
};

const addRelAndPropertiesToLink =
    async (publication: Publication, link: Link, linkEpub: Manifest, opf: OPF) => {

        if (linkEpub.Properties) {
            await addToLinkFromProperties(publication, link, linkEpub.Properties);
        }
        const spineProperties = findPropertiesInSpineForManifest(linkEpub, opf);
        if (spineProperties) {
            await addToLinkFromProperties(publication, link, spineProperties);
        }
    };

const addToLinkFromProperties = async (publication: Publication, link: Link, propertiesString: string) => {

    const properties = parseSpaceSeparatedString(propertiesString);
    const propertiesStruct = new Properties();

    // https://idpf.github.io/epub-vocabs/rendition/

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

const addMediaOverlay = async (link: Link, linkEpub: Manifest, opf: OPF, zip: IZip) => {
    if (linkEpub.MediaOverlay) {
        const meta = findMetaByRefineAndProperty(opf, linkEpub.MediaOverlay, "media:duration");
        if (meta) {
            link.Duration = timeStrToSeconds(meta.Data);
        }

        const manItemSmil = opf.Manifest.find((mi) => {
            if (mi.ID === linkEpub.MediaOverlay) {
                return true;
            }
            return false;
        });
        if (manItemSmil && manItemSmil.MediaType === "application/smil+xml") {
            if (opf.ZipPath) {
                const manItemSmilHrefDecoded = manItemSmil.HrefDecoded;
                if (!manItemSmilHrefDecoded) {
                    debug("!?manItemSmil.HrefDecoded");
                    return;
                }
                const smilFilePath = path.join(path.dirname(opf.ZipPath), manItemSmilHrefDecoded)
                    .replace(/\\/g, "/");

                const has = await zipHasEntry(zip, smilFilePath, smilFilePath);
                if (!has) {
                    debug(`NOT IN ZIP (addMediaOverlay): ${smilFilePath}`);
                    const zipEntries = await zip.getEntries();
                    for (const zipEntry of zipEntries) {
                        debug(zipEntry);
                    }
                    return;
                }

                const mo = new MediaOverlayNode();
                mo.SmilPathInZip = smilFilePath;
                mo.initialized = false;
                link.MediaOverlays = mo;

                const moURL = mediaOverlayURLPath + "?" +
                    mediaOverlayURLParam + "=" +
                    encodeURIComponent_RFC3986(link.HrefDecoded ? link.HrefDecoded : link.Href);

                // legacy method:
                if (!link.Properties) {
                    link.Properties = new Properties();
                }
                link.Properties.MediaOverlay = moURL;

                // new method:
                // https://w3c.github.io/sync-media-pub/incorporating-synchronized-narration.html#with-webpub
                if (!link.Alternate) {
                    link.Alternate = [];
                }
                const moLink = new Link();
                moLink.Href = moURL;
                moLink.TypeLink = "application/vnd.syncnarr+json";
                moLink.Duration = link.Duration;
                link.Alternate.push(moLink);

                if (link.Properties && link.Properties.Encrypted) {
                    debug("ENCRYPTED SMIL MEDIA OVERLAY: " + (link.HrefDecoded ? link.HrefDecoded : link.Href));
                }
                // LAZY
                // await lazyLoadMediaOverlays(publication, mo);
            }
        }
    }
};

const findInManifestByID =
    async (publication: Publication, opf: OPF, ID: string, zip: IZip): Promise<Link> => {

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

                await addRelAndPropertiesToLink(publication, linkItem, item, opf);
                await addMediaOverlay(linkItem, item, opf, zip);
                return linkItem;
            }
        }
        return Promise.reject(`ID ${ID} not found`);
    };

const fillSpineAndResource = async (publication: Publication, opf: OPF, zip: IZip) => {

    if (!opf.ZipPath) {
        return;
    }

    if (opf.Spine && opf.Spine.Items && opf.Spine.Items.length) {
        for (const item of opf.Spine.Items) {

            if (!item.Linear || item.Linear === "yes") {

                let linkItem: Link;
                try {
                    linkItem = await findInManifestByID(publication, opf, item.IDref, zip);
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

        for (const item of opf.Manifest) {

            const itemHrefDecoded = item.HrefDecoded;
            if (!itemHrefDecoded) {
                debug("!? item.Href");
                continue;
            }
            const zipPath = path.join(path.dirname(opf.ZipPath), itemHrefDecoded)
                .replace(/\\/g, "/");
            const linkSpine = findInSpineByHref(publication, zipPath);
            if (!linkSpine || !linkSpine.Href) {

                const linkItem = new Link();
                linkItem.TypeLink = item.MediaType;

                linkItem.setHrefDecoded(zipPath);

                await addRelAndPropertiesToLink(publication, linkItem, item, opf);
                await addMediaOverlay(linkItem, item, opf, zip);

                if (!publication.Resources) {
                    publication.Resources = [];
                }
                publication.Resources.push(linkItem);
            }
        }
    }
};

const fillPageListFromNCX = async (publication: Publication, _opf: OPF, ncx: NCX, zip: IZip) => {
    if (ncx.PageList && ncx.PageList.PageTarget && ncx.PageList.PageTarget.length) {
        // ncx.PageList.PageTarget.forEach((pageTarget) => {
        for (const pageTarget of ncx.PageList.PageTarget) {
            const link = new Link();
            const srcDecoded = pageTarget.Content.SrcDecoded;
            if (!srcDecoded) {
                debug("!?srcDecoded");
                return; // foreach
            }
            const zipPath = path.join(path.dirname(ncx.ZipPath), srcDecoded)
                .replace(/\\/g, "/");

            let smilXmlPath = "";
            if (_opf.ZipPath) {
                smilXmlPath = await getSmilLinkReference(zip, srcDecoded);
            } else {
                debug("?!point.Content.Src");
                return;
            }

            link.setHrefDecoded(smilXmlPath || zipPath);

            // link.setHrefDecoded(zipPath);

            link.Title = pageTarget.Text;
            if (!publication.PageList) {
                publication.PageList = [];
            }
            publication.PageList.push(link);
        // });
        }
    }
};

const fillPageListFromAdobePageMap = async (
    publication: Publication,
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
        debug("!?link.HrefDecoded");
        return undefined;
    }
    const has = await zipHasEntry(zip, linkHrefDecoded, link.Href);
    if (!has) {
        debug(`NOT IN ZIP (createDocStringFromZipPath): ${link.Href} --- ${linkHrefDecoded}`);
        const zipEntries = await zip.getEntries();
        for (const zipEntry of zipEntries) {
            debug(zipEntry);
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

const fillTOCFromNCX = async (publication: Publication, opf: OPF, ncx: NCX, zip: IZip) => {
    if (ncx.Points && ncx.Points.length) {
        // ncx.Points.forEach((point) => {
        //     if (!publication.TOC) {
        //         publication.TOC = [];
        //     }
        //     fillTOCFromNavPoint(publication, opf, ncx, point, publication.TOC, zip);
        // });
        for (const point of ncx.Points) {
            if (!publication.TOC) {
                publication.TOC = [];
            }
            await fillTOCFromNavPoint(publication, opf, ncx, point, publication.TOC, zip);
        }
    }
};

const fillLandmarksFromGuide = (publication: Publication, opf: OPF) => {
    if (opf.Guide && opf.Guide.length) {
        opf.Guide.forEach((ref) => {
            if (ref.Href && opf.ZipPath) {
                const refHrefDecoded = ref.HrefDecoded;
                if (!refHrefDecoded) {
                    debug("ref.Href?!");
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
    async (publication: Publication, opf: OPF, ncx: NCX, point: NavPoint, node: Link[], zip: IZip) => {

        const srcDecoded = point.Content.SrcDecoded;
        if (!srcDecoded) {
            debug("?!point.Content.Src");
            return;
        }
        const link = new Link();
        const zipPath = path.join(path.dirname(ncx.ZipPath), srcDecoded)
            .replace(/\\/g, "/");

        let smilXmlPath = "";
        if (opf.ZipPath) {
            smilXmlPath = await getSmilLinkReference(zip, srcDecoded);
        } else {
            debug("?!point.Content.Src");
            return;
        }

        link.setHrefDecoded(smilXmlPath || zipPath);

        link.Title = point.Text;

        if (point.Points && point.Points.length) {
            // point.Points.forEach((p) => {
            //     if (!link.Children) {
            //         link.Children = [];
            //     }
            //     fillTOCFromNavPoint(publication, opf, ncx, p, link.Children, zip);
            // });
            for (const p of point.Points) {
                if (!link.Children) {
                    link.Children = [];
                }
                await fillTOCFromNavPoint(publication, opf, ncx, p, link.Children, zip);
            }
        }

        node.push(link);
    };

const fillSubject = (publication: Publication, opf: OPF) => {
    if (opf.Metadata && opf.Metadata.DCMetadata.Subject && opf.Metadata.DCMetadata.Subject.length) {
        opf.Metadata.DCMetadata.Subject.forEach((s) => {
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

const fillCalibreSerieInfo = (publication: Publication, opf: OPF) => {
    let serie: string | undefined;
    let seriePosition: number | undefined;

    if (opf.Metadata && opf.Metadata.XMetadata.Meta && opf.Metadata.XMetadata.Meta.length) {
        opf.Metadata.XMetadata.Meta.forEach((m) => {
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

const fillTOCFromNavDoc = async (publication: Publication, _opf: OPF, zip: IZip):
    Promise<void> => {

    const navLink = publication.GetNavDoc();
    if (!navLink) {
        return;
    }

    const navLinkHrefDecoded = navLink.HrefDecoded;
    if (!navLinkHrefDecoded) {
        debug("!?navLink.HrefDecoded");
        return;
    }

    const has = await zipHasEntry(zip, navLinkHrefDecoded, navLink.Href);
    if (!has) {
        debug(`NOT IN ZIP (fillTOCFromNavDoc): ${navLink.Href} --- ${navLinkHrefDecoded}`);
        const zipEntries = await zip.getEntries();
        for (const zipEntry of zipEntries) {
            debug(zipEntry);
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
                            debug("!?valDecoded");
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

const findPropertiesInSpineForManifest = (linkEpub: Manifest, opf: OPF): string | undefined => {

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

const findMetaByRefineAndProperty = (opf: OPF, ID: string, property: string): Metafield | undefined => {

    const ret = findAllMetaByRefineAndProperty(opf, ID, property);
    if (ret.length) {
        return ret[0];
    }
    return undefined;
};

const findAllMetaByRefineAndProperty =
    (opf: OPF, ID: string, property: string): Metafield[] => {
        const metas: Metafield[] = [];

        const refineID = "#" + ID;

        if (opf.Metadata && opf.Metadata.XMetadata.Meta) {
            opf.Metadata.XMetadata.Meta.forEach((metaTag) => {
                if (metaTag.Refine === refineID && metaTag.Property === property) {
                    metas.push(metaTag);
                }
            });
        }

        return metas;
    };

const parseDtBook = async (publication: Publication, files: string[], zip: IZip, opf: OPF) => {
    const fileName = findEntryFile(files) || "dtbook.xml";
    // const filePath = path.join(urlOrPath, fileName);
    const dtBookStr =  await readFilesAsString(zip, fileName);
    const dtBookDoc = new xmldom.DOMParser().parseFromString(dtBookStr, "application/xml");
    console.log("XML FILE EXISTS");
    await convertXml(publication, dtBookDoc, zip, opf);
};

const getFileNames = async (directory: string) => {
    return fs.readdirSync(directory);
};

const getOPFFileName = (directory: string) => {
    const files =  fs.readdirSync(directory);
    return findOpfFile(files);
};

const isFileValid = (files: string[]) => {
    // const keys = Object.keys(files);

    if (files.some((file) => file.match(/\.xml$/)) === false) {
        return [false, "No xml file found."];
    }

    if (files.some((file) => file.match(/\/ncc\.html$/))) {
        return [false, "DAISY 2 format is not supported."];
    }

    // if (files.some((file) => file.match(/\.mp3$/)) === false) {
    //   console.log("mp3");
    //   return [false];
    // }
    // if (files.some((file) => file.match(/\.smil$/)) === false) {
    //   console.log("smil");
    //   return [false];
    // }

    return [true];
};

const findOpfFile = (files: string[]) => {
    return files.find((file) => file.match(/\.opf$/));
};

const findEntryFile = (files: string[]) => {
    return files.find((file) => file.match(/\.xml$/));
};

const convertXml = async (publication: Publication, xmlDom: any, zip: IZip, opf: OPF) => {
    const title = xmlDom.getElementsByTagName("doctitle")[0].textContent;
    const serializer = new xmldom.XMLSerializer();
    transformList(xmlDom);

    const stylesheets: any[] = xpath.select("/processing-instruction('xml-stylesheet')", xmlDom);
    const links: string[] = [];
    let index = 0;
    // stylesheets.forEach(async (stylesheet: any, i: number) => {
    for (const stylesheet of stylesheets) {
        const href = stylesheet.nodeValue.match(/href=("|')(.*?)("|')/)[0];
        if (href) {
            const src = href.split("=")[1].replace(/"/g, "");
            // const filePath = path.join(urlOrPath, src);
            const newFileName = `style_${index}.css`;
            // const newFilePath = path.join(urlOrPath, newFileName);
            // if (fs.existsSync(filePath) && !fs.existsSync(newFilePath)) {
            // let cssText = fs.readFileSync(filePath, { encoding: "utf8" });
            let cssText = await readFilesAsString(zip, src);
            cssText = parseCss(cssText);
            const parsedFile = new ParsedFile();
            parsedFile.Name = newFileName;
            parsedFile.Value = cssText.trim();
            parsedFile.Type = "text/css";
            publication.ParsedFiles.push(parsedFile);

            // fs.writeFileSync(newFilePath , cssText.trim());
            // console.log("CSS File Saved!");
            const tempManifest = new Manifest();
            tempManifest.ID = `dtb_css${index + 1}`;
            tempManifest.setHrefDecoded(newFileName);
            tempManifest.MediaType = parsedFile.Type;
            opf.Manifest.push(tempManifest);
            // }
            links.push(`<link rel="stylesheet" href="${newFileName}" />`);
            index++;
        }
    // });
    }

    const levelDoms = xmlDom.getElementsByTagName("level1");
    opf.Spine.Items = [];

    Array.from(levelDoms).forEach((element: any, i: number) => {

        let docTitle = "";

        if (element.parentNode.nodeName === "frontmatter") {
            docTitle = element.parentNode.getElementsByTagName("doctitle")[0];
        }

        const bodyContent = element.parentNode.cloneNode();
        if (docTitle) {
            bodyContent.appendChild(docTitle);
        }
        bodyContent.appendChild(element);
        const bodyContentStr = serializer.serializeToString(bodyContent);
        const content = parseDtBookXml(bodyContentStr);

        const xhtmlContent = `
            <?xml version="1.0" encoding="utf-8"?>
            <!DOCTYPE xhtml>
            <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
            <head>
                <meta charset="UTF-8" />
                <title>${title}</title>
                ${links.join(" ")}
            </head>
            <body>
                <div class="book">
                    ${content}
                </div>
            </body>
            </html>
        `;
        const pageName = `page${i + 1}.xhtml`;
        // try {
        //     fs.writeFileSync(path.join(urlOrPath, pageName) , xhtmlContent.trim());
        //     console.log("Saved!");
        const tempManifest = new Manifest();
        tempManifest.ID = `dtb_page${i + 1}`;
        tempManifest.setHrefDecoded(pageName);
        tempManifest.MediaType = "application/xhtml+xml";
        tempManifest.isTemp = true;
        opf.Manifest.push(tempManifest);

        const tempSpineItem = new SpineItem();
        tempSpineItem.IDref = tempManifest.ID;
        opf.Spine.Items.push(tempSpineItem);

        // } catch (err) {
        //     console.log(err);
        // }

        const parsedFile = new ParsedFile();
        parsedFile.Name = pageName;
        parsedFile.Value = xhtmlContent.trim();
        parsedFile.Type = "application/xhtml+xml";
        publication.ParsedFiles.push(parsedFile);

        // console.log("opf", opf.Manifest.slice(-8));
    });

};

const parseDtBookXml = (xml: any) => {
    return xml
        .replace('xmlns="', 'xmlns:conf="')
        .replace(/<frontmatter/g, '<div class="frontmatter"')
        .replace(/<bodymatter/g, '<div class="bodymatter"')
        .replace(/<rearmatter/g, '<div class="rearmatter">')
        .replace(/<\/frontmatter>/g, "</div>")
        .replace(/<\/bodymatter>/g, "</div>")
        .replace(/<\/rearmatter>/g, "</div>")
        .replace(/<level(\d)>/g, '<div class="level level-$1">')
        .replace(/<\/level\d>/g, "</div>")
        .replace(/<doctitle/g, "<h1 class='doctitle'")
        .replace(/<\/doctitle>/g, "</h1>")
        .replace(/<pagenum/g, "<span class='pagenum'")
        .replace(/<\/pagenum>/g, "</span>")
        .replace(/<sent/g, "<span")
        .replace(/<\/sent>/g, "</span>")
        .replace(/(<\/?)imggroup/g, "$1figure")
        .replace(/<caption/g, "<figcaption")
        .replace(/<\/caption>/g, "</figcaption>");
};

const parseCss = (cssText: any): string => {
    cssText = cssText.replace(/\/\*[^\/\*]+\*\//g, ""); // remove comments
    const cssTags = ["annoref", "annotation", "author", "bdo", "bodymatter", "book", "bridgehead", "byline", "caption", "cite", "col", "covertitle", "dateline", "dfn", "docauthor", "doctitle", "dtbook", "epigraph", "frontmatter", "hd", "imggroup", "kbd", "level", "level1", "level2", "level3", "level4", "level5", "level6", "lic", "line", "linegroup", "link", "list", "meta", "note", "noteref", "pagenum", "poem", "prodnote", "rearmatter", "samp", "sent", "sub", "sup"];
    cssTags.forEach((cssTag) => {
        const regex = new RegExp(`${cssTag}`, "g");
        cssText = cssText
            .replace(regex, `.${cssTag}`);
    });

    return cssText;
};

const transformList = (xmlDom: any) => {
    const elDoms = xmlDom.getElementsByTagName("list");

    for (let i = 0; i < elDoms.length; i++) {
        const elem = elDoms.item(i);
        elem.tagName = elem.getAttribute("type");
    }
};

const getSmilLinkReference = async (zip: IZip, srcDecoded: string) => {
    const hashLink = srcDecoded.split("#");
    const smilLink = hashLink[0];
    const smilID = hashLink[1];

    // const smilFilePath = path.join(filePath, smilLink).replace(/\\/g, "/");

    // const smilStr = fs.readFileSync(smilFilePath, { encoding: "utf8" });
    const smilStr = await readFilesAsString(zip, smilLink);
    const smilXmlDoc = new xmldom.DOMParser().parseFromString(smilStr);
    const smil = XML.deserialize<SMIL>(smilXmlDoc, SMIL);
    // console.log("smil" , findAllByKey(smil, "Par"));
    const parsInSmil =  findAllByKey(smil, "Par");
    const linkedPar = parsInSmil.find((par: Par) => par.ID === smilID);
    if (!linkedPar) {
        return;
    }
    if (linkedPar.Text) {
        return linkedPar.Text.Src;
    }
    return;
};

// const parseSmilFile = (link: Link, filePath: string, i: number = 0) => {
//         if (link && link.TypeLink === "application/smil") {

//             const manItemSmilHrefDecoded = link.HrefDecoded;
//             if (!manItemSmilHrefDecoded) {
//                 debug("!?manItemSmil.HrefDecoded");
//                 return;
//             }

//             // const has = await zipHasEntry(zip, manItemSmilHrefDecoded, link.Href);
//             // if (!has) {
//             //     debug(`NOT IN ZIP (parseSmilFiles): ${manItemSmilHrefDecoded}`);
//             //     const zipEntries = await zip.getEntries();
//             //     for (const zipEntry of zipEntries) {
//             //         debug(zipEntry);
//             //     }
//             //     return;
//             // }

//             const smilFilePath = path.join(filePath, manItemSmilHrefDecoded)
//                 .replace(/\\/g, "/");

//             const smilStr = fs.readFileSync(smilFilePath, { encoding: "utf8" });
//             const smilXmlDoc = new xmldom.DOMParser().parseFromString(smilStr);
//             const smil = XML.deserialize<SMIL>(smilXmlDoc, SMIL);

//             console.log("smil" , i, findAllByKey(smil, "Par"));

//             // const itemHrefDecoded = item.HrefDecoded;
//             // if (!itemHrefDecoded) {
//             //     debug("?!item.HrefDecoded");
//             //     continue;
//             // }
//             // const has = await zipHasEntry(zip, itemHrefDecoded, item.Href);
//             // if (!has) {
//             //     debug(`NOT IN ZIP (fillMediaOverlay): ${item.HrefDecoded} --- ${itemHrefDecoded}`);
//             //     const zipEntries = await zip.getEntries();
//             //     for (const zipEntry of zipEntries) {
//             //         debug(zipEntry);
//             //     }
//             //     continue;
//             // }

//             // const smilFilePath = path.join(filePath, itemHrefDecoded).replace(/\\/g, "/");
//             // console.log(smilFilePath, opf.ZipPath);

//             // const smilStr = fs.readFileSync(smilFilePath, { encoding: "utf8" });
//             // const smilXmlDoc = new xmldom.DOMParser().parseFromString(smilStr);
//             // const smil = XML.deserialize<SMIL>(smilXmlDoc, SMIL);

//             // console.log("smil", smil);

//             // const manItemsHtmlWithSmil: Manifest[] = [];
//             // opf.Manifest.forEach((manItemHtmlWithSmil) => {
//             //     if (manItemHtmlWithSmil.MediaOverlay) { // HTML
//             //         const manItemSmil = opf.Manifest.find((mi) => {
//             //             if (mi.ID === manItemHtmlWithSmil.MediaOverlay) {
//             //                 return true;
//             //             }
//             //             return false;
//             //         });
//             //         console.log("manItemSmil", manItemSmil);
//             //         if (manItemSmil && opf.ZipPath) {
//             //             const manItemSmilHrefDecoded = manItemSmil.HrefDecoded;
//             //             if (!manItemSmilHrefDecoded) {
//             //                 debug("!?manItemSmil.HrefDecoded");
//             //                 return; // foreach
//             //             }
//             //             const smilFilePath = path.join(path.dirname(opf.ZipPath), manItemSmilHrefDecoded)
//             //             .replace(/\\/g, "/");
//             //             if (smilFilePath === itemHrefDecoded) {
//             //                 manItemsHtmlWithSmil.push(manItemHtmlWithSmil);
//             //             } else {
//             //                 debug(`smilFilePath !== itemHrefDecoded ?! ${smilFilePath} ${itemHrefDecoded}`);
//             //             }
//             //         }
//             //     }
//             // });

//             // const mo = new MediaOverlayNode();
//             // mo.SmilPathInZip = itemHrefDecoded;
//             // mo.initialized = false;

//             // manItemsHtmlWithSmil.forEach((manItemHtmlWithSmil) => {

//             //     if (!opf.ZipPath) {
//             //         return;
//             //     }
//             //     const manItemHtmlWithSmilHrefDecoded = manItemHtmlWithSmil.HrefDecoded;
//             //     if (!manItemHtmlWithSmilHrefDecoded) {
//             //         debug("?!manItemHtmlWithSmil.HrefDecoded");
//             //         return; // foreach
//             //     }
//             //     const htmlPathInZip = path.join(path.dirname(opf.ZipPath), manItemHtmlWithSmilHrefDecoded)
//             //         .replace(/\\/g, "/");

//             //     console.log("htmlPathInZip", htmlPathInZip);

//             //     const link = findLinKByHref(publication, rootfile, opf, htmlPathInZip);
//             //     if (link) {
//             //         if (link.MediaOverlays) {
//             //             debug(`#### MediaOverlays?! ${htmlPathInZip} => ${link.MediaOverlays.SmilPathInZip}`);
//             //             return; // continue for each
//             //         }

//             //         const moURL = mediaOverlayURLPath + "?" +
//             //             mediaOverlayURLParam + "=" + encodeURIComponent_RFC3986(link.Href);

//             //         // legacy method:
//             //         if (!link.Properties) {
//             //             link.Properties = new Properties();
//             //         }
//             //         link.Properties.MediaOverlay = moURL;

//             //         // new method:
//             //         // https://w3c.github.io/sync-media-pub/incorporating-synchronized-narration.html#with-webpub
//             //         if (!link.Alternate) {
//             //             link.Alternate = [];
//             //         }
//             //         const moLink = new Link();
//             //         moLink.Href = moURL;
//             //         moLink.TypeLink = "application/vnd.syncnarr+json";
//             //         moLink.Duration = link.Duration;
//             //         link.Alternate.push(moLink);
//             //     }
//             // });

//             // if (item.Properties && item.Properties.Encrypted) {
//             //     debug("ENCRYPTED SMIL MEDIA OVERLAY: " + item.Href);
//             //     continue;
//             // }
//             // LAZY
//             // await lazyLoadMediaOverlays(publication, mo);
//         }

//         return;
// };

const findAllByKey = (obj: any, keyToFind: string): any => {
    return Object.entries(obj)
        .reduce((acc, data: any[]) => {
            const key = data[0];
            const value = data[1];
            return (key === keyToFind)
                ? acc.concat(value)
                : (typeof value === "object")
                ? acc.concat(findAllByKey(value, keyToFind))
                : acc;
        }, []);
};

const readFilesAsString = async (zip: IZip, filePathDecoded: string) => {
    const has = await zipHasEntry(zip, filePathDecoded, undefined);
    if (!has) {
        const err = `NOT IN ZIP (container OPF rootfile): --- ${filePathDecoded}`;
        debug(err);
        const zipEntries = await zip.getEntries();
        for (const zipEntry of zipEntries) {
            debug(zipEntry);
        }
        return Promise.reject(err);
    }

    let fileZipStream_: IStreamAndLength;
    try {
        fileZipStream_ = await zip.entryStreamPromise(filePathDecoded);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }
    const fileZipStream = fileZipStream_.stream;

    let opfZipData: Buffer;
    try {
        opfZipData = await streamToBufferPromise(fileZipStream);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }

    return opfZipData.toString("utf8");

};
