import * as debug_ from "debug";
import * as path from "path";
import * as xmldom from "xmldom";

import { timeStrToSeconds } from "@models/media-overlay";
import { streamToBufferPromise } from "@r2-utils-js/_utils/stream/BufferUtils";
import { IStreamAndLength, IZip } from "@r2-utils-js/_utils/zip/zip";

import { zipHasEntry } from "../_utils/zipHasEntry";

import { getNcx_, getOpf_, loadFileStrFromZipPath } from "./epub-daisy-common";
import { NCX } from "./epub/ncx";
import { OPF } from "./epub/opf";

const debug = debug_("r2:shared#parser/daisy-convert-to-epub");

const headerTags = ["h1", "h2", "h3", "h4", "h5", "h6"];

interface SmilTemplate {
    audioEl: any;
    parSrc: string;
}

interface TempTemplate {
    playOrder: any;
    smilData: any;
    tag: string;
    text: string;
}

interface NccTemplate {
    meta: any;
    nccItems: any;
}

interface OpfItemsTemplate {
    manifest: any[];
    spine: any[];
}

export const convertNccToOpfAndNcx = async (
    zip: IZip,
    rootfilePathDecoded: string,
    rootfilePath: string,
): Promise<[OPF, NCX]> => {

    const has = await zipHasEntry(zip, rootfilePathDecoded, rootfilePath);
    if (!has) {
        const err = `NOT IN ZIP (container OPF rootfile): ${rootfilePath} --- ${rootfilePathDecoded}`;
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
        "text/html",
    );

    const bodyData = nccDoc.getElementsByTagName("body")[0];

    const nccObj: NccTemplate = {
        meta: getMetas(nccDoc),
        nccItems: await convertNavData(bodyData, zip),
    };

    const opfItems: OpfItemsTemplate = {
        manifest: [],
        spine: [],
    };

    convertOpfJson(opfItems, await zip.getEntries());

    let multimediaContent = "";
    let multimediaType = "";
    // "audioFullText","textNCX","audioNCX";
    if (timeStrToSeconds(nccObj.meta["ncc:totalTime"]) > 0) {
        multimediaContent = "audio,text,image";
        multimediaType = "audioFullText";
    } else if (
        timeStrToSeconds(nccObj.meta["ncc:totalTime"]) === 0
    ) {
        multimediaContent = "text,image";
        multimediaType = "textNCX";
    }

    const navPointPartial = convertListToTemplate(
        nccObj.nccItems.filter((file: any) => headerTags.includes(file.tag)), // only header tags
    );
    const pageListPartial = covertToPageList(
        nccObj.nccItems.filter((file: any) => !headerTags.includes(file.tag)), // non header tags
    );

    const manifestPartial = convertListToManifest(opfItems.manifest);

    const spinePartial = convertListToSpine(opfItems.spine);

    const opfStr = `<?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE package
            PUBLIC "+//ISBN 0-9673008-1-9//DTD OEB 1.2 Package//EN"
            "http://openebook.org/dtds/oeb-1.2/oebpkg12.dtd">
        <package xmlns="http://openebook.org/namespaces/oeb-package/1.0/" unique-identifier="uid">
                <metadata>
                    <dc-metadata xmlns:dc="http://purl.org/dc/elements/1.1/"
                            xmlns:oebpackage="http://openebook.org/namespaces/oeb-package/1.0/">
                        <dc:Format>ANSI/NISO Z39.86-2005</dc:Format>
                    <dc:Date>${nccObj.meta["dc:date"]}</dc:Date>
                <dc:Language>${nccObj.meta["dc:language"]}</dc:Language>
                <dc:Creator>${nccObj.meta["dc:creator"]}</dc:Creator>
                <dc:Publisher>${nccObj.meta["dc:publisher"]}</dc:Publisher>
                <dc:Title>${nccObj.meta["dc:title"]}</dc:Title>
                <dc:Identifier id="uid">${nccObj.meta["dc:identifier"]}</dc:Identifier>
                </dc-metadata>

                    <x-metadata>
                <meta content="${multimediaType}" name="dtb:multimediaType"/>
                <meta content="${nccObj.meta["ncc:narrator"]}" name="dtb:narrator"/>
                <meta content="${nccObj.meta["ncc:totalTime"]}" name="dtb:totalTime"/>
                <meta content="${multimediaContent}" name="dtb:multimediaContent"/>
                </x-metadata>

                </metadata>
            <manifest>
            <item href="package.opf" id="opf" media-type="text/xml" />
            <item href="navigation.ncx" id="ncx" media-type="application/x-dtbncx+xml" />
            ${manifestPartial}
            </manifest>

                <spine>
                <itemref idref="smil-1"/>
                ${spinePartial}
            </spine>

        </package>`;

    const ncxStr = `<?xml version="1.0" encoding="UTF-8"?>
        <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
        <head>
            <meta name="dtb:uid" content="${nccObj.meta["dc:identifier"]}" />
            <meta name="dtb:generator" content="${nccObj.meta["ncc:generator"]}"/>
            <meta name="dtb:depth" content="${nccObj.meta["ncc:depth"]}"/>
            <meta name="dtb:totalPageCount" content="${nccObj.meta["ncc:pageNormal"]}"/>
            <meta name="dtb:maxPageNumber" content="${nccObj.meta["ncc:maxPageNormal"]}"/>
        </head>
        <docTitle>
            <text>${nccObj.meta["dc:title"]}</text>
        </docTitle>
        <docAuthor>
            <text>${nccObj.meta["dc:creator"]}</text>
        </docAuthor>
        <navMap id="navMap">
            ${navPointPartial}
        </navMap>
        <pageList id="page">
            ${pageListPartial}
        </pageList>
        </ncx>`;

    const opf = getOpf_(opfStr, rootfilePathDecoded);
    const ncx = getNcx_(ncxStr, rootfilePathDecoded);

    return [opf, ncx];
};

const convertListToTemplate = (navPoints: any[]) => {
    let template = "";
    const navDataList = [];
    // const h1Tags = navPoints.filter(point => point.tag === 'h1');
    const tempObj: any = {}; // to store last tag map
    for (const navPoint of navPoints) {
        if (navPoint.tag === "h1") {
            const temp = { ...navPoint, children: [] };
            tempObj.h1 = temp;
            navDataList.push(temp);
        }
        if (navPoint.tag === "h2") {
            const temp = { ...navPoint, children: [] };
            tempObj.h2 = temp;
            tempObj.h1.children.push(temp);
        }
        if (navPoint.tag === "h3") {
            const temp = { ...navPoint, children: [] };
            tempObj.h3 = temp;
            tempObj.h2.children.push(temp);
        }
        if (navPoint.tag === "h4") {
            const temp = { ...navPoint, children: [] };
            tempObj.h4 = temp;
            tempObj.h3.children.push(temp);
        }
        if (navPoint.tag === "h5") {
            const temp = { ...navPoint, children: [] };
            tempObj.h5 = temp;
            tempObj.h4.children.push(temp);
        }
        if (navPoint.tag === "h6") {
            const temp = { ...navPoint, children: [] };
            tempObj.h6 = temp;
            tempObj.h5.children.push(temp);
        }
    }
    for (const navPoint of navDataList) {
        template += convertPointToTemplate(navPoint);
    }

    return template;
};

const convertPointToTemplate = (navPoint: any) => {
    let childNavPoint = "";
    if (navPoint.children && navPoint.children.length > 0) {
        for (const point of navPoint.children) {
            childNavPoint += convertPointToTemplate(point);
        }
    }
    const currentTagNum = navPoint.tag.split("")[1];
    return `<navPoint id="navPoint-${
        navPoint.playOrder
    }" playOrder="${
        navPoint.playOrder
    }" class="level-${currentTagNum}">
        <navLabel>
            <text>${navPoint.text}</text>
                ${
                    navPoint.smilData.audioEl
                        ? `<audio id="${navPoint.smilData.audioEl.id}"
                        src="${navPoint.smilData.audioEl.src}"
                        clipBegin="${navPoint.smilData.audioEl.clipBegin}"
                        clipEnd="${navPoint.smilData.audioEl.clipEnd}" />`
                        : ""
                }
        </navLabel>
        <content src="${navPoint.smilData.parSrc}"/>
        ${childNavPoint}
        </navPoint>
        `;
};

const covertToPageList = (pageList: any[]) => {
    let template = "";
    // for (let i = 0; i < pageList.length; i++) {
    for (const page of pageList) {
        template += convertPointToPageTarget(page);
    }

    return template;
};

const convertPointToPageTarget = (pageItem: any) => {
    return `<pageTarget id="pageTarget-${
        pageItem.playOrder
    }" playOrder="${pageItem.playOrder}" type="normal">
        <navLabel>
            <text>${pageItem.text}</text>
            ${
                pageItem.smilData.audioEl
                    ? `<audio id="${pageItem.smilData.audioEl.id}"
                    src="${pageItem.smilData.audioEl.src}"
                    clipBegin="${pageItem.smilData.audioEl.clipBegin}"
                    clipEnd="${pageItem.smilData.audioEl.clipEnd}" />`
                    : ""
            }
        </navLabel>
        <content src="${pageItem.smilData.parSrc}" />
    </pageTarget>
    `;
};

const convertListToManifest = (manifestList: any[]) => {
    let template = "";
    // for (let i = 0; i < manifestList.length; i++) {
    for (const manifest of manifestList) {
        template += `<item href="${manifest.href}"
        id="${manifest.id}"
        media-type="${manifest.mediaType}" />`;
    }

    return template;
};

const convertListToSpine = (spineList: any[]) => {
    let template = "";
    // for (let i = 0; i < spineList.length; i++) {
    for (const spine of spineList) {
        template += `  <itemref idref="${spine.idref}" />`;
    }

    return template;
};
/* ======== CONVERT NCC TO JSON ======= */

const getMetas = (nccDoc: any) => {
    const metaObj: any = {};
    const metas = nccDoc.getElementsByTagName("meta");

    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < metas.length; i++) {
        metaObj[metas[i].getAttribute("name")] = metas[i].getAttribute("content");
    }

    return metaObj;
};

const getSrcSmilData = async (anchor: any, zip: IZip) => {
    const hrefAttr = anchor.getAttribute("href");
    const [link, elId] = hrefAttr.split("#");
    const smilStr = await loadFileStrFromZipPath(link, link, zip);
    if (!smilStr) {
        debug("!loadFileStrFromZipPath", smilStr);
        return null;
    }
    const smilDoc = new xmldom.DOMParser().parseFromString(smilStr, "application/xml");
    let smilEl = smilDoc.getElementById(elId);
    const smilObj: SmilTemplate = {
        audioEl: "",
        parSrc: "",
    };
    if (!smilEl) {
        return null;
    }
    if (smilEl.tagName !== "par") {
        smilEl = findParentParTag(smilEl);
        if (!smilEl) {
            return null;
        }
        const parId = smilEl.getAttribute("id");
        smilObj.parSrc = link + "#" + parId;
    } else {
        smilObj.parSrc = anchor.getAttribute("href");
    }

    const seq = smilEl.getElementsByTagName("seq")[0];
    if (seq) {
        const audios = smilEl.getElementsByTagName("audio");
        if (audios && audios.length > 0) {
            // smilObj.audioEl = serializer.serializeToString(audioInsidePar);
            let clipBegin = "";
            let clipEnd = "";
            let id = "";
            let src = "";
            for (let i = 0; i < audios.length; i++) {
                if (i === 0) {
                    clipBegin = audios[i].getAttribute("clip-begin") || "";
                    src = audios[i].getAttribute("src") || "";
                    id = audios[i].getAttribute("id") || "";
                }
                if (i === audios.length - 1) {
                    clipEnd = audios[i].getAttribute("clip-end") || "";
                }
            }

            smilObj.audioEl = {
                clipBegin,
                clipEnd,
                id,
                src,
            };
        }
    }

    return smilObj;
};

const findParentParTag = (tag: any): any => {
    if (tag.tagName === "par") {
        return tag;
    }
    return findParentParTag(tag.parentNode);
};

const getNextTag = (tag: any): any => {
    if (!tag.nextSibling) {
        return null;
    }

    if (tag.nextSibling.tagName) {
        return tag.nextSibling;
    }

    return getNextTag(tag.nextSibling);
};

const convertToJs = async (tag: any, navPoints: any[], playOrder: any, zip: IZip) => {
    playOrder++;
    const anchor = tag.getElementsByTagName("a")[0];
    const smilData = await getSrcSmilData(anchor, zip);
    const tempObj: TempTemplate = {
        playOrder,
        smilData,
        tag: tag.tagName,
        text: anchor.textContent,
    };

    navPoints.push(tempObj);
    const nextTag = getNextTag(tag);

    if (nextTag) {
        await convertToJs(nextTag, navPoints, playOrder, zip);
    }
};

const convertNavData = async (bodyData: any, zip: IZip) => {
    const navPoints: any[] = [];
    const playOrder = 0;

    const firstH1Tag = bodyData.getElementsByTagName("h1")[0];
    await convertToJs(firstH1Tag, navPoints, playOrder, zip);
    navPoints.sort((a, b) => {
        // a less than b
        if (a.playOrder < b.playOrder) {
            return -1;
        }
        // a more than b
        if (a.playOrder > b.playOrder) {
            return 1;
        }
        // a === b
        return 0;
    });

    return navPoints;
};

const convertOpfJson = (opfItems: any, files: string[]) => {
    // const re = /(?:\.([^.]+))?$/;  // find extension
    // let regex = new RegExp('[^.]+$');
    files.forEach((file, i) => {
        // const ext = re.exec(file)[1];
        // const ext = file.match(regex);
        const ext = path.extname(file).toLowerCase();
        if (["ent", "dtd"].includes(ext)) {
            return;
        }
        if (ext === ".smil") {
            opfItems.manifest.push({
                href: file,
                id: "smil-" + i,
                mediaType: getMediaTypeFromFileExtension(ext),
            });

            opfItems.spine.push({
                idref: "smil-" + i,
            });
        } else {
            opfItems.manifest.push({
                href: file,
                id: "opf-" + i,
                mediaType: getMediaTypeFromFileExtension(ext),
            });
        }
    });
};

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

    if (ext === ".jpg" || ext === ".jpeg") {
        return "image/jpeg";
    }

    if (ext === ".png") {
        return "image/png";
    }

    if (ext === ".xml") {
        return "application/x-dtbook+xml";
    }

    if (ext === "html") {
        return "text/html";
    }

    return "";
};
