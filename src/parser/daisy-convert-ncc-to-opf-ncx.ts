// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";
import * as mime from "mime-types";
import * as path from "path";
import * as xmldom from "xmldom";

import { timeStrToSeconds } from "@models/media-overlay";
import { streamToBufferPromise } from "@r2-utils-js/_utils/stream/BufferUtils";
import { IStreamAndLength, IZip } from "@r2-utils-js/_utils/zip/zip";

import { zipHasEntry } from "../_utils/zipHasEntry";
import { getNcx_, getOpf_ } from "./epub-daisy-common"; // , loadFileStrFromZipPath
import { NCX } from "./epub/ncx";
import { OPF } from "./epub/opf";

const debug = debug_("r2:shared#parser/daisy-convert-to-epub");

const getMediaTypeFromFileExtension = (ext: string) => {
    if (ext === ".smil") {
        return "application/smil";
    }

    if (ext === ".css") {
        return "text/css";
    }

    if (ext === ".mp3") {
        return "audio/mpeg";
    }

    if (ext === ".wav") {
        return "audio/wav";
    }

    if (ext === ".jpg" || ext === ".jpeg") {
        return "image/jpeg";
    }

    if (ext === ".png") {
        return "image/png";
    }

    if (ext === ".xml") {
        return "application/x-dtbook+xml";
    }

    if (ext === ".html") {
        return "text/html";
    }

    if (ext === ".xhtml") {
        return "application/xhtml+xml";
    }

    return mime.lookup("dummy" + ext);
};

export const convertNccToOpfAndNcx = async (
    zip: IZip,
    rootfilePathDecoded: string,
    rootfilePath: string,
): Promise<[OPF, NCX]> => {

    const has = await zipHasEntry(zip, rootfilePathDecoded, rootfilePath);
    if (!has) {
        const err = `NOT IN ZIP (NCC.html): ${rootfilePath} --- ${rootfilePathDecoded}`;
        debug(err);
        const zipEntries = await zip.getEntries();
        for (const zipEntry of zipEntries) {
            debug(zipEntry);
        }
        return Promise.reject(err);
    }

    let nccZipStream_: IStreamAndLength;
    try {
        nccZipStream_ = await zip.entryStreamPromise(rootfilePathDecoded);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }
    const nccZipStream = nccZipStream_.stream;

    let nccZipData: Buffer;
    try {
        nccZipData = await streamToBufferPromise(nccZipStream);
    } catch (err) {
        debug(err);
        return Promise.reject(err);
    }

    const nccStr = nccZipData.toString("utf8");

    const nccDoc = new xmldom.DOMParser().parseFromString(
        nccStr,
        "application/xml",
        // "text/html",
        // "application/xhtml+xml",
    );

    const metas = Array.from(nccDoc.getElementsByTagName("meta")).
        reduce((prevVal, curVal) => {
            const name = curVal.getAttribute("name");
            const content = curVal.getAttribute("content");
            if (name && content) {
                prevVal[name] = content;
            }
            return prevVal;
        }, {} as {[key: string]: string});

    // TODO: textPartAudio / audioPartText?? audioOnly??
    // https://www.daisy.org/z3986/specifications/Z39-86-2002.html#Type
    // https://www.daisy.org/z3986/specifications/daisy_202.html
    let multimediaContent = "";
    let multimediaType = "";
    if (metas["ncc:multimediaType"] === "audioFullText" ||
        metas["ncc:multimediaType"] === "audioNcc" ||
        metas["ncc:totalTime"] && timeStrToSeconds(metas["ncc:totalTime"]) > 0) {
        if (metas["ncc:multimediaType"] === "audioFullText") {
            multimediaContent = "audio,text,image";
            multimediaType = "audioFullText";
        } else {
            multimediaContent = "audio,image";
            multimediaType = "audioNCX";
        }
    } else if (metas["ncc:multimediaType"] === "textNcc" ||
        metas["ncc:totalTime"] && timeStrToSeconds(metas["ncc:totalTime"]) === 0) {
        multimediaContent = "text,image";
        multimediaType = "textNCX";
    }

    const zipEntriez = await zip.getEntries();

    const opfStr = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE package
PUBLIC "+//ISBN 0-9673008-1-9//DTD OEB 1.2 Package//EN"
"http://openebook.org/dtds/oeb-1.2/oebpkg12.dtd">
<package xmlns="http://openebook.org/namespaces/oeb-package/1.0/" unique-identifier="uid">

<metadata>
<dc-metadata xmlns:dc="http://purl.org/dc/elements/1.1/"
xmlns:oebpackage="http://openebook.org/namespaces/oeb-package/1.0/">
    <dc:Format>ANSI/NISO Z39.86-2005</dc:Format>
    ${metas["dc:date"] ? `<dc:Date>${metas["dc:date"]}</dc:Date>` : ""}
    ${metas["dc:language"] ? `<dc:Language>${metas["dc:language"]}</dc:Language>` : ""}
    ${metas["dc:creator"] ? `<dc:Creator>${metas["dc:creator"]}</dc:Creator>` : ""}
    ${metas["dc:publisher"] ? `<dc:Publisher>${metas["dc:publisher"]}</dc:Publisher>` : ""}
    ${metas["dc:title"] ? `<dc:Title>${metas["dc:title"]}</dc:Title>` : ""}
    ${metas["dc:identifier"] ? `<dc:Identifier id="uid">${metas["dc:identifier"]}</dc:Identifier>` : ""}
</dc-metadata>

<x-metadata>
    ${metas["ncc:narrator"] ? `<meta name="dtb:narrator" content="${metas["ncc:narrator"]}" />` : ""}
    ${metas["ncc:totalTime"] ? `<meta name="dtb:totalTime" content="${metas["ncc:totalTime"]}" />` : ""}

    <meta name="dtb:multimediaType" content="${multimediaType}" />
    <meta name="dtb:multimediaContent" content="${multimediaContent}" />

    <!-- RAW COPY FROM DAISY2: -->
    ${Object.keys(metas).reduce((pv, cv) => {
        return `${pv}
    <meta name="${cv}" content="${metas[cv]}" />`;
    }, "")}
</x-metadata>

</metadata>

<manifest>
<!-- item href="package.opf" id="opf" media-type="text/xml" />
<item href="navigation.ncx" id="ncx" media-type="application/x-dtbncx+xml" / -->

${zipEntriez.reduce((pv, cv, ci) => {
    const ext = path.extname(cv).toLowerCase();
    return `${pv}${cv !== "ncc.html" && ext !== ".ent" && ext !== ".dtd" ? `
    <item href="${cv}" id="opf-${ci}" media-type="${getMediaTypeFromFileExtension(ext)}" />` : ""}`;

}, "")}
</manifest>

<spine>
${zipEntriez.reduce((pv, cv, ci) => {
    const ext = path.extname(cv).toLowerCase();
    return `${pv}${ext === ".smil" ? `
    <itemref idref="opf-${ci}" />` : ""}`;
}, "")}
</spine>

</package>`;

    debug(opfStr);
    // if (process.env) {
    //     throw new Error("BREAK");
    // }

    const opf = getOpf_(opfStr, rootfilePathDecoded);

// const bodyElem = nccDoc.getElementsByTagName("body")[0];
// const firstH1Tag = bodyElem.getElementsByTagName("h1")[0];

// await convertToJs(firstH1Tag, navPoints, playOrder, zip);

// const headerTags = ["h1", "h2", "h3", "h4", "h5", "h6"];

// const navPointPartial = convertListToTemplate(
//     // TODO ANY!!
//    nccObj.nccItems.filter((file: any) => headerTags.includes(file.tag)), // only header tags
// );
// const pageListPartial = covertToPageList(
//     // TODO ANY!!
//    nccObj.nccItems.filter((file: any) => !headerTags.includes(file.tag)), // non header tags
// );

    const ncxStr = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head>
    ${metas["dc:identifier"] ? `<meta name="dtb:uid" content="${metas["dc:identifier"]}" />` : ""}
    ${metas["ncc:generator"] ? `<meta name="dtb:generator" content="${metas["ncc:generator"]}"/>` : ""}
    ${metas["ncc:depth"] ? `<meta name="dtb:depth" content="${metas["ncc:depth"]}"/>` : ""}
    ${metas["ncc:pageNormal"] ? `<meta name="dtb:totalPageCount" content="${metas["ncc:pageNormal"]}"/>` : ""}
    ${metas["ncc:maxPageNormal"] ? `<meta name="dtb:maxPageNumber" content="${metas["ncc:maxPageNormal"]}"/>` : ""}
</head>

<docTitle>
<text>${metas["dc:title"] ? metas["dc:title"] : "_"}</text>
</docTitle>

<docAuthor>
<text>${metas["dc:creator"] ? metas["dc:creator"] : "-"}</text>
</docAuthor>

<navMap id="navMap">

</navMap>

<pageList id="pageList">

</pageList>

</ncx>`;

    const ncx = getNcx_(ncxStr, rootfilePathDecoded);

    return [opf, ncx];
};

//  // TODO ANY!!
// const convertListToTemplate = (navPoints: any[]) => {
//     let template = "";
//     const navDataList = [];
//     // const h1Tags = navPoints.filter(point => point.tag === 'h1');
//      // TODO ANY!!
//     const tempObj: any = {}; // to store last tag map
//     for (const navPoint of navPoints) {
//         if (navPoint.tag === "h1") {
//             const temp = { ...navPoint, children: [] };
//             tempObj.h1 = temp;
//             navDataList.push(temp);
//         }
//         if (navPoint.tag === "h2") {
//             const temp = { ...navPoint, children: [] };
//             tempObj.h2 = temp;
//             tempObj.h1.children.push(temp);
//         }
//         if (navPoint.tag === "h3") {
//             const temp = { ...navPoint, children: [] };
//             tempObj.h3 = temp;
//             tempObj.h2.children.push(temp);
//         }
//         if (navPoint.tag === "h4") {
//             const temp = { ...navPoint, children: [] };
//             tempObj.h4 = temp;
//             tempObj.h3.children.push(temp);
//         }
//         if (navPoint.tag === "h5") {
//             const temp = { ...navPoint, children: [] };
//             tempObj.h5 = temp;
//             tempObj.h4.children.push(temp);
//         }
//         if (navPoint.tag === "h6") {
//             const temp = { ...navPoint, children: [] };
//             tempObj.h6 = temp;
//             tempObj.h5.children.push(temp);
//         }
//     }
//     for (const navPoint of navDataList) {
//         template += convertPointToTemplate(navPoint);
//     }

//     return template;
// };

//  // TODO ANY!!
// const convertPointToTemplate = (navPoint: any) => {
//     let childNavPoint = "";
//     if (navPoint.children && navPoint.children.length > 0) {
//         for (const point of navPoint.children) {
//             childNavPoint += convertPointToTemplate(point);
//         }
//     }
//     const currentTagNum = navPoint.tag.split("")[1];
//     return `<navPoint id="navPoint-${
//         navPoint.playOrder
//     }" playOrder="${
//         navPoint.playOrder
//     }" class="level-${currentTagNum}">
//         <navLabel>
//             <text>${navPoint.text}</text>
//                 ${
//                     navPoint.smilData.audioEl
//                         ? `<audio id="${navPoint.smilData.audioEl.id}"
//                         src="${navPoint.smilData.audioEl.src}"
//                         clipBegin="${navPoint.smilData.audioEl.clipBegin}"
//                         clipEnd="${navPoint.smilData.audioEl.clipEnd}" />`
//                         : ""
//                 }
//         </navLabel>
//         <content src="${navPoint.smilData.parSrc}"/>
//         ${childNavPoint}
//         </navPoint>
//         `;
// };

//  // TODO ANY!!
// const covertToPageList = (pageList: any[]) => {
//     let template = "";
//     // for (let i = 0; i < pageList.length; i++) {
//     for (const page of pageList) {
//         template += convertPointToPageTarget(page);
//     }

//     return template;
// };

//  // TODO ANY!!
// const convertPointToPageTarget = (pageItem: any) => {
//     return `<pageTarget id="pageTarget-${
//         pageItem.playOrder
//     }" playOrder="${pageItem.playOrder}" type="normal">
//         <navLabel>
//             <text>${pageItem.text}</text>
//             ${
//                 pageItem.smilData.audioEl
//                     ? `<audio id="${pageItem.smilData.audioEl.id}"
//                     src="${pageItem.smilData.audioEl.src}"
//                     clipBegin="${pageItem.smilData.audioEl.clipBegin}"
//                     clipEnd="${pageItem.smilData.audioEl.clipEnd}" />`
//                     : ""
//             }
//         </navLabel>
//         <content src="${pageItem.smilData.parSrc}" />
//     </pageTarget>
//     `;
// };

//  // TODO ANY!!
// const getSrcSmilData = async (anchor: any, zip: IZip) => {
//     const hrefAttr = anchor.getAttribute("href");
//     const [link, elId] = hrefAttr.split("#");
//     const smilStr = await loadFileStrFromZipPath(link, link, zip);
//     if (!smilStr) {
//         debug("!loadFileStrFromZipPath", smilStr);
//         return null;
//     }
//     const smilDoc = new xmldom.DOMParser().parseFromString(smilStr, "application/xml");
//     let smilEl = smilDoc.getElementById(elId);
//     const smilObj: SmilTemplate = {
//         audioEl: "",
//         parSrc: "",
//     };
//     if (!smilEl) {
//         return null;
//     }
//     if (smilEl.tagName !== "par") {
//         smilEl = findParentParTag(smilEl);
//         if (!smilEl) {
//             return null;
//         }
//         const parId = smilEl.getAttribute("id");
//         smilObj.parSrc = link + "#" + parId;
//     } else {
//         smilObj.parSrc = anchor.getAttribute("href");
//     }

//     const seq = smilEl.getElementsByTagName("seq")[0];
//     if (seq) {
//         const audios = smilEl.getElementsByTagName("audio");
//         if (audios && audios.length > 0) {
//             // smilObj.audioEl = serializer.serializeToString(audioInsidePar);
//             let clipBegin = "";
//             let clipEnd = "";
//             let id = "";
//             let src = "";
//             for (let i = 0; i < audios.length; i++) {
//                 if (i === 0) {
//                     clipBegin = audios[i].getAttribute("clip-begin") || "";
//                     src = audios[i].getAttribute("src") || "";
//                     id = audios[i].getAttribute("id") || "";
//                 }
//                 if (i === audios.length - 1) {
//                     clipEnd = audios[i].getAttribute("clip-end") || "";
//                 }
//             }

//             smilObj.audioEl = {
//                 clipBegin,
//                 clipEnd,
//                 id,
//                 src,
//             };
//         }
//     }

//     return smilObj;
// };

//  // TODO ANY!!
// const findParentParTag = (tag: any): any => {
//     if (tag.tagName === "par") {
//         return tag;
//     }
//     return findParentParTag(tag.parentNode);
// };

//  // TODO ANY!!
// const getNextTag = (tag: any): any => {
//     if (!tag.nextSibling) {
//         return null;
//     }

//     if (tag.nextSibling.tagName) {
//         return tag.nextSibling;
//     }

//     return getNextTag(tag.nextSibling);
// };

//  // TODO ANY!!
// const convertToJs = async (tag: any, navPoints: any[], playOrder: any, zip: IZip) => {
//     playOrder++;
//     const anchor = tag.getElementsByTagName("a")[0];
//     const smilData = await getSrcSmilData(anchor, zip);
//     const tempObj: TempTemplate = {
//         playOrder,
//         smilData,
//         tag: tag.tagName,
//         text: anchor.textContent,
//     };

//     navPoints.push(tempObj);
//     const nextTag = getNextTag(tag);

//     if (nextTag) {
//         await convertToJs(nextTag, navPoints, playOrder, zip);
//     }
// };
