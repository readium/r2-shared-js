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
import * as xmldom from "xmldom";
import * as xpath from "xpath";

import { timeStrToSeconds } from "@models/media-overlay";
import { Metadata } from "@models/metadata";
import { Publication } from "@models/publication";
import { Link } from "@models/publication-link";
import { isHTTP } from "@r2-utils-js/_utils/http/UrlUtils";
import { streamToBufferPromise } from "@r2-utils-js/_utils/stream/BufferUtils";
import { XML } from "@r2-utils-js/_utils/xml-js-mapper";
import { IStreamAndLength, IZip } from "@r2-utils-js/_utils/zip/zip";
import { zipLoadPromise } from "@r2-utils-js/_utils/zip/zipFactory";

import { zipHasEntry } from "../_utils/zipHasEntry";
import {
    addIdentifier, addLanguage, addOtherMetadata, addTitle, fillLandmarksFromGuide,
    fillPublicationDate, fillSpineAndResource, fillSubject, findContributorInMeta, getNcx, getOpf,
    setPublicationDirection,
} from "./epub-daisy-common";
import { Rootfile } from "./epub/container-rootfile";
import { NCX } from "./epub/ncx";
import { NavPoint } from "./epub/ncx-navpoint";
import { OPF } from "./epub/opf";
import { Manifest } from "./epub/opf-manifest";
import { SpineItem } from "./epub/opf-spineitem";
import { SMIL } from "./epub/smil";
import { Par } from "./epub/smil-par";
import { Seq } from "./epub/smil-seq";

interface ParsedFile {
    Name: string;
    Type: string;
    Value: string;
    FilePath: string;
}

const debug = debug_("r2:shared#parser/daisy");

export enum DaisyBookis {
    LocalExploded = "LocalExploded",
    LocalPacked = "LocalPacked",
    RemoteExploded = "RemoteExploded",
    RemotePacked = "RemotePacked",
}

export async function isDaisyPublication(urlOrPath: string): Promise<DaisyBookis | undefined> {
    const http = isHTTP(urlOrPath);
    if (http) {
        return undefined; // remote DAISY not supported
    } else if (fs.existsSync(path.join(urlOrPath, "package.opf"))) {
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
            await zipHasEntry(zip, "package.opf", undefined)) {

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
    const parsedFiles: ParsedFile[] = [];

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

    // note: does not work in RemoteExploded
    const entries = await zip.getEntries();

    // const [valid, message] = isFileValid(entries);
    // if (!valid) {
    //     return Promise.reject(message || "File validation failed.");
    // }

    // generic "text/xml" content type
    // manifest/item@media-type
    const opfZipEntryPath = entries.find((entry) => entry.match(/\.opf$/));
    if (!opfZipEntryPath) {
        return Promise.reject("Opf File doesn't exists");
    }

    const rootfilePathDecoded = opfZipEntryPath; // || "package.opf";
    if (!rootfilePathDecoded) {
        return Promise.reject("?!rootfile.PathDecoded");
    }

    const opf = await getOpf(zip, rootfilePathDecoded, opfZipEntryPath);

    let ncx: NCX | undefined;
    if (opf.Manifest) {
        const ncxManItem = opf.Manifest.find((manifestItem) => {
            return manifestItem.MediaType === "application/x-dtbncx+xml";
        });
        if (ncxManItem) {
            ncx = await getNcx(ncxManItem, opf, zip);
        }
    }

    addLanguage(publication, opf);

    addTitle(publication, undefined, opf);

    addIdentifier(publication, opf);

    addOtherMetadata(publication, undefined, opf);

    setPublicationDirection(publication, opf);

    findContributorInMeta(publication, undefined, opf);

    await fillSpineAndResource(publication, undefined, opf, zip, addLinkData);

    if (!publication.TOC || !publication.TOC.length) {
        if (ncx) {
            await fillTOCFromNCX(publication, parsedFiles, opf, ncx, zip);
            if (!publication.PageList) {
                await fillPageListFromNCX(publication, parsedFiles, opf, ncx, zip);
            }
        }
        fillLandmarksFromGuide(publication, opf);
    }

    fillSubject(publication, opf);

    fillPublicationDate(publication, undefined, opf);

    // "application/x-dtbook+xml" content type
    // manifest/item@media-type
    const dtBookZipEntryPath = entries.find((entry) => entry.match(/\.xml$/));
    if (dtBookZipEntryPath) {
        const dtBookStr = await readFilesAsString(zip, dtBookZipEntryPath);
        const dtBookDoc = new xmldom.DOMParser().parseFromString(dtBookStr, "application/xml");
        await convertXml(parsedFiles, dtBookDoc, zip, opf);
    }

    return publication;
}

const addLinkData = async (
    _publication: Publication, _rootfile: Rootfile | undefined,
    _opf: OPF, _zip: IZip, linkItem: Link, item: Manifest) => {

    if (item.MediaOverlay) {
        try {
            linkItem.Duration = parseInt(item.MediaOverlay, 10);
        } catch (er) {
            console.log(er);
            // ignore
        }
    }
};

// tslint:disable-next-line: max-line-length
const fillPageListFromNCX = async (publication: Publication, parsedFiles: ParsedFile[], opf: OPF, ncx: NCX, zip: IZip) => {
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
            if (opf.ZipPath) {
                smilXmlPath = await getSmilLinkReference(parsedFiles, zip, srcDecoded, opf);
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

const fillTOCFromNCX = async (publication: Publication, parsedFiles: ParsedFile[], opf: OPF, ncx: NCX, zip: IZip) => {
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
            await fillTOCFromNavPoint(parsedFiles, opf, ncx, point, publication.TOC, zip);
        }
    }
};

const fillTOCFromNavPoint =
    async (parsedFiles: ParsedFile[], opf: OPF, ncx: NCX, point: NavPoint, node: Link[], zip: IZip) => {

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
            smilXmlPath = await getSmilLinkReference(parsedFiles, zip, srcDecoded, opf);
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
                await fillTOCFromNavPoint(parsedFiles, opf, ncx, p, link.Children, zip);
            }
        }

        node.push(link);
    };

const convertXml = async (parsedFiles: ParsedFile[], xmlDom: any, zip: IZip, opf: OPF) => {

    if (process.env) {
        throw new Error("BREAK 1");
    }

    const title = xmlDom.getElementsByTagName("doctitle")[0].textContent;
    const serializer = new xmldom.XMLSerializer();
    transformList(xmlDom);

    const stylesheets: any[] = xpath.select("/processing-instruction('xml-stylesheet')", xmlDom);
    const links: string[] = [];
    let index = 0;
    for (const stylesheet of stylesheets) {
        const href = stylesheet.nodeValue.match(/href=("|')(.*?)("|')/)[0];
        if (href) {
            const src = href.split("=")[1].replace(/"/g, "");
            // const filePath = path.join(urlOrPath, src);
            const newFileName = `style_${index}.css`;
            // const newFilePath = path.join(urlOrPath, newFileName);
            // if (fs.existsSync(filePath) && !fs.existsSync(newFilePath)) {
            // let cssText = fs.readFileSync(filePath, { encoding: "utf8" });
            if (!opf.ZipPath) {
                return "";
            }
            const cssPath = path.join(path.dirname(opf.ZipPath), src)
                .replace(/\\/g, "/");
            let cssText = await readFilesAsString(zip, cssPath);
            cssText = parseCss(cssText);

            const parsedFile: ParsedFile = {
                FilePath: path.join(path.dirname(opf.ZipPath), newFileName)
                    .replace(/\\/g, "/"),
                Name: newFileName,
                Type: "text/css",
                Value: cssText.trim(),
            };
            parsedFiles.push(parsedFile);

            // fs.writeFileSync(newFilePath , cssText.trim());
            // console.log("CSS File Saved!");
            const tempManifest = new Manifest();
            tempManifest.ID = `dtb_css${index + 1}`;
            tempManifest.setHrefDecoded(newFileName);
            tempManifest.MediaType = parsedFile.Type;
            opf.Manifest.push(tempManifest);

            links.push(`<link rel="stylesheet" href="${newFileName}" />`);
            index++;
        }
    }

    opf.Spine.Items = [];
    const data: any[] = [];
    parseFrontmatterXml(xmlDom, serializer, data);
    parseBodymatterXml(xmlDom, serializer, data);
    parseRearmatterXml(xmlDom, serializer, data);

    let i = 0;
    for (const element of data) {
        if (!opf.ZipPath) {
            return "";
        }
        const content = parseDtBookXml(element);

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
        const tempManifest = new Manifest();
        tempManifest.ID = `dtb_page${i + 1}`;
        tempManifest.setHrefDecoded(pageName);
        tempManifest.MediaType = "application/xhtml+xml";
        opf.Manifest.push(tempManifest);

        const tempSpineItem = new SpineItem();
        tempSpineItem.IDref = tempManifest.ID;
        opf.Spine.Items.push(tempSpineItem);

        const parsedFile: ParsedFile = {
            FilePath: path.join(path.dirname(opf.ZipPath), pageName)
                .replace(/\\/g, "/"),
            Name: pageName,
            Type: "application/xhtml+xml",
            Value: xhtmlContent.trim(),
        };
        parsedFiles.push(parsedFile);

        const xhtmlDoc = new xmldom.DOMParser().parseFromString(xhtmlContent, "text/html");
        const smilRefs = xpath.select("//@smilref", xhtmlDoc);
        const refs = smilRefs.map((smilRef: any) => {
            return smilRef.value.split("#")[0]; // get link only
        });
        // const smilRefLinks = [...new Set(refs)]; // remove duplicate
        const multimediaContent = opf.Metadata.XMetadata.Meta.find((metaTag) => {
            return metaTag.Name === "dtb:multimediaContent";
        });
        if (!multimediaContent || !multimediaContent.Content.includes("audio")) {
            i++;
            continue;
        }

        const smilRefLinks = refs.filter((ref: string, ind: number) => {
            return refs.indexOf(ref) === ind;
        }); // remove duplicate

        let duration = 0;
        for (const smilRefLink of smilRefLinks) {
            const smil = await parseSmilFile(zip, smilRefLink, opf);
            if (!smil) {
                return;
            }
            // setMediaInfo(tempManifest, tempSpineItem, file);
            duration += getMediaDuration(smil);
        }

        // hacky way to temporarily store item duration,
        // but much simpler than storing into "media:duration" OPF MetaData with #refines (ala EPUB)
        tempManifest.MediaOverlay = duration.toString();

        i++;
    }
    return;
};

const getMediaDuration = (smilFile: SMIL): number => {
    // const setMediaInfo = (manifest: Manifest, link: SpineItem, smilFile: SMIL ) => {
    // const metasDuration: any[] = [];

    // smilFile.Head.Meta.forEach((metaTag) => {
    //     if (metaTag.Name === "dtb:totalElapsedTime") {
    //         metasDuration.push(timeStrToSeconds(metaTag.Content));
    //     }
    // });

    // console.log("metasDuration", metasDuration);
    if (smilFile?.Body?.Children) {
        const firstChild = smilFile.Body.Children[0];
        if (firstChild) {
            const seqOrPar = firstChild as any;
            if (seqOrPar.Children ||
                !seqOrPar.Text && !seqOrPar.Audio &&
                (seqOrPar as Seq).Duration) {
                return timeStrToSeconds((seqOrPar as Seq).Duration);
            }
        }
    }

    return 0;
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
        .replace(/<docauthor/g, "<p class='docauthor'")
        .replace(/<\/docauthor>/g, "</p>")
        .replace(/<covertitle/g, "<p class='covertitle'")
        .replace(/<\/covertitle>/g, "</p>")
        .replace(/<pagenum/g, "<span class='pagenum'")
        .replace(/<\/pagenum>/g, "</span>")
        .replace(/<sent/g, "<span")
        .replace(/<\/sent>/g, "</span>")
        .replace(/(<\/?)imggroup/g, "$1figure")
        .replace(/<caption/g, "<figcaption")
        .replace(/<\/caption>/g, "</figcaption>");
};

const parseFrontmatterXml = (xmlDom: any, serializer: xmldom.XMLSerializer, data: any[]) => {
    let levelDoms = [];
    const frontmatter = xmlDom.getElementsByTagName("frontmatter")[0];
    if (frontmatter) {
        const docTitle = frontmatter.getElementsByTagName("doctitle")[0];
        const docAuthor = frontmatter.getElementsByTagName("docauthor")[0];
        const coverTitle = frontmatter.getElementsByTagName("covertitle")[0];
        const level1s = Array.from(frontmatter.getElementsByTagName("level1"));
        const levels = Array.from(frontmatter.getElementsByTagName("level"));

        levelDoms = levels.concat(level1s);
        if (levelDoms.length > 0) {
            levelDoms.forEach((element: any, i: number) => {
                const bodyContent = element.parentNode.cloneNode();
                if (i === 0) {
                    if (docTitle) {
                        bodyContent.appendChild(docTitle);
                    }
                    if (docAuthor) {
                        bodyContent.appendChild(docAuthor);
                    }
                    if (coverTitle) {
                        bodyContent.appendChild(coverTitle);
                    }
                }
                bodyContent.appendChild(element);
                const bodyContentStr = serializer.serializeToString(bodyContent);
                data.push(bodyContentStr);
            });
        } else {
            const bodyContent = frontmatter.cloneNode();
            if (docTitle) {
                bodyContent.appendChild(docTitle);
            }
            if (docAuthor) {
                bodyContent.appendChild(docAuthor);
            }
            if (coverTitle) {
                bodyContent.appendChild(coverTitle);
            }
            const bodyContentStr = serializer.serializeToString(bodyContent);
            data.push(bodyContentStr);
        }
    }
};

const parseBodymatterXml = (xmlDom: any, serializer: xmldom.XMLSerializer, data: any[]) => {
    let levelDoms = [];
    const bodymatter = xmlDom.getElementsByTagName("bodymatter")[0];
    if (bodymatter) {
        const level1s = Array.from(bodymatter.getElementsByTagName("level1"));
        const levels = Array.from(bodymatter.getElementsByTagName("level"));

        levelDoms = levels.concat(level1s);
        levelDoms.forEach((element: any) => {
            const bodyContent = element.parentNode.cloneNode();
            bodyContent.appendChild(element);
            const bodyContentStr = serializer.serializeToString(bodyContent);
            data.push(bodyContentStr);
        });
    }
};

const parseRearmatterXml = (xmlDom: any, serializer: xmldom.XMLSerializer, data: any[]) => {
    let levelDoms = [];
    const rearmatter = xmlDom.getElementsByTagName("rearmatter")[0];
    if (rearmatter) {
        const level1s = Array.from(rearmatter.getElementsByTagName("level1"));
        const levels = Array.from(rearmatter.getElementsByTagName("level"));

        levelDoms = levels.concat(level1s);
        levelDoms.forEach((element: any) => {
            const bodyContent = element.parentNode.cloneNode();
            bodyContent.appendChild(element);
            const bodyContentStr = serializer.serializeToString(bodyContent);
            data.push(bodyContentStr);
        });
    }
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

const parseSmilFile = async (zip: IZip, srcDecoded: string, opf: OPF) => {
    if (!opf.ZipPath) {
        return "";
    }
    const smilPath = path.join(path.dirname(opf.ZipPath), srcDecoded)
        .replace(/\\/g, "/");
    const smilStr = await readFilesAsString(zip, smilPath);
    const smilXmlDoc = new xmldom.DOMParser().parseFromString(smilStr);
    return XML.deserialize<SMIL>(smilXmlDoc, SMIL);
};

const getSmilLinkReference = async (parsedFiles: ParsedFile[], zip: IZip, srcDecoded: string, opf: OPF) => {
    const hashLink = srcDecoded.split("#");
    const smilLink = hashLink[0];
    const smilID = hashLink[1];

    // const smilFilePath = path.join(filePath, smilLink).replace(/\\/g, "/");

    // const smilStr = fs.readFileSync(smilFilePath, { encoding: "utf8" });
    const smil = await parseSmilFile(zip, smilLink, opf);
    // console.log("smil" , findAllByKey(smil, "Par"));
    const parsInSmil = findAllByKey(smil, "Par");
    const linkedPar = parsInSmil.find((par: Par) => par.ID === smilID);
    if (!linkedPar) {
        return "";
    }
    if (linkedPar.Text) {
        const hashXmlLink = linkedPar.Text.Src.split("#");
        const xmlID = hashXmlLink[1];
        const xmlLink = findXhtmlWithID(parsedFiles, xmlID);
        return `${xmlLink}#${xmlID}`;
        // return linkedPar.Text.Src;
    }
    return "";
};

const findXhtmlWithID = (parsedFiles: ParsedFile[], ID: string) => {
    for (const parsedFile of parsedFiles) {
        // const parsedFile: ParsedFile = publication.ParsedFiles[i];
        if (parsedFile.Type === "application/xhtml+xml") {
            const xhtmlDoc = new xmldom.DOMParser().parseFromString(parsedFile.Value, "text/html");
            if (xhtmlDoc.getElementById(ID)) {
                return parsedFile.Name;
            }
        }
    }
    return "";
    // publication.ParsedFiles.forEach((parsedFile: ParsedFile, i: number) => {
    //     if (parsedFile.Type === "application/xhtml+xml") {
    //         const xhtmlDoc = new xmldom.DOMParser().parseFromString(parsedFile.Value, "text/html");
    //         if (xhtmlDoc.getElementById(ID)) {
    //             console.log("xhtmlDoc" + i, parsedFile.Name);
    //         }
    //     }
    // });
};

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

// see createDocStringFromZipPath()
const readFilesAsString = async (zip: IZip, filePathDecoded: string) => {
    const has = await zipHasEntry(zip, filePathDecoded, undefined);
    if (!has) {
        const err = `NOT IN ZIP (readFilesAsString): --- ${filePathDecoded}`;
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
//             //     debug(`NOT IN ZIP (parseSmilFile): ${item.HrefDecoded} --- ${itemHrefDecoded}`);
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
