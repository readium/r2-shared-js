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
    if (/\.smil$/i.test(ext)) {
        return "application/smil+xml";
    }

    if (/\.css$/i.test(ext)) {
        return "text/css";
    }

    if (/\.mp3$/i.test(ext)) {
        return "audio/mpeg";
    }

    if (/\.wav$/i.test(ext)) {
        return "audio/wav";
    }

    if (/\.jpe?g$/i.test(ext)) {
        return "image/jpeg";
    }

    if (/\.png$/i.test(ext)) {
        return "image/png";
    }

    if (/\.xml$/i.test(ext)) {
        return "application/x-dtbook+xml";
    }

    if (/\.html$/i.test(ext)) {
        return "text/html";
    }

    if (/\.xhtml$/i.test(ext)) {
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
            if (zipEntry.startsWith("__MACOSX/")) {
                continue;
            }
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

    const aElems = Array.from(nccDoc.getElementsByTagName("a"));

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

    const manifestItemsBaseStr = zipEntriez.reduce((pv, cv, ci) => {
        const ext = path.extname(cv);
        return `${pv}${!cv.startsWith("__MACOSX/") && !/ncc\.html$/i.test(cv) && !/\.ent$/i.test(ext) && !/\.dtd$/i.test(ext) && !/\.smil$/i.test(ext) ? `
        <item
            href="${path.relative("file:///" + path.dirname(rootfilePathDecoded), "file:///" + cv).replace(/\\/g, "/")}"
            id="opf-zip-${ci}"
            media-type="${getMediaTypeFromFileExtension(ext)}" />` : ""}`;
    }, "");
    const arrSmils: string[] = [];
    const manifestItemsStr = aElems.reduce((pv, cv, _ci) => {
        const href = cv.getAttribute("href");
        if (!href) {
            return pv;
        }
        if (!/\.smil(#.*)?$/i.test(href)) {
            return pv;
        }

        const smil = href.replace(/(.+\.smil)(#.*)?$/i, "$1");
        if (arrSmils.indexOf(smil) >= 0) {
            return pv;
        }
        arrSmils.push(smil);

        // const txt = cv.textContent ? cv.textContent.trim() : "";

        return `${pv}${`
            <item
                href="${smil}"
                id="opf-ncc-${arrSmils.length - 1}"
                media-type="application/smil+xml" />`}`;
    }, manifestItemsBaseStr);

    const spineItemsStr = arrSmils.reduce((pv, _cv, ci) => {
        return `${pv}${`
            <itemref idref="opf-ncc-${ci}" />`}`;
    }, "");

    let playOrder = 0;
    let pCount = 0;
    const pageListStr = aElems.reduce((pv, cv, _ci) => {
        const href = cv.getAttribute("href");
        if (!href) {
            return pv;
        }
        if (!/\.smil(#.*)?$/i.test(href)) {
            return pv;
        }
        if (!cv.parentNode) {
            return pv;
        }
        playOrder++;

        const clazz = (cv.parentNode as Element).getAttribute("class");
        if (!clazz || !clazz.startsWith("page")) {
            return pv;
        }

        const txt = cv.textContent ? cv.textContent.trim() : "";

        pCount++;
        return `${pv}${`
<pageTarget class="pagenum" id="ncx-p${pCount}" playOrder="${playOrder}" type="normal" value="${pCount}">
<navLabel>
<text>${txt ? txt : pCount}</text>
</navLabel>
<content src="${href}"/>
</pageTarget>
`}`;
    }, "");

    playOrder = 0;
    pCount = 0;
    const navMapStr = aElems.reduce((pv, cv, _ci) => {
        const href = cv.getAttribute("href");
        if (!href) {
            return pv;
        }
        if (!/\.smil(#.*)?$/i.test(href)) {
            return pv;
        }
        if (!cv.parentNode) {
            return pv;
        }
        playOrder++;

        const name = (cv.parentNode as Element).localName;
        if (!name || !name.startsWith("h")) {
            return pv;
        }
        const level = parseInt(name.substr(1), 10);

        const txt = cv.textContent ? cv.textContent.trim() : "";

        pCount++;

        const inner = `<!-- h${level-1}_${pCount-1} -->`;
        if (pv.indexOf(inner) >= 0) {
            return pv.replace(inner, `
<navPoint class="${name}" id="ncx-t${pCount}" playOrder="${playOrder}">
<navLabel>
<text>${txt ? txt : `_${pCount}`}</text>
</navLabel>
<content src="${href}"/>
<!-- ${name}_${pCount} -->
</navPoint>
<!-- h${level-1}_${pCount} -->
`);
        } else {
            return `${pv}${`
<navPoint class="${name}" id="ncx-t${pCount}" playOrder="${playOrder}">
<navLabel>
<text>${txt ? txt : `_${pCount}`}</text>
</navLabel>
<content src="${href}"/>
<!-- ${name}_${pCount} -->
</navPoint>
`}`;
        }
    }, "");

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

${manifestItemsStr}
</manifest>

<spine>
${spineItemsStr}
</spine>

</package>`;

    // debug(opfStr);
    // if (process.env) {
    //     throw new Error("BREAK");
    // }

    const opf = getOpf_(opfStr, rootfilePathDecoded);

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
${navMapStr}
</navMap>

<pageList id="pageList">
${pageListStr}
</pageList>

</ncx>`;

    // debug(ncxStr);
    // if (process.env) {
    //     throw new Error("BREAK");
    // }

    const ncx = getNcx_(ncxStr, rootfilePathDecoded);

    return [opf, ncx];
};

