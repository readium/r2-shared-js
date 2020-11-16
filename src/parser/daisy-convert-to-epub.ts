// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";
import * as fs from "fs";
import * as path from "path";
import * as xmldom from "xmldom";
import * as xpath from "xpath";
import { ZipFile } from "yazl";

import { MediaOverlayNode } from "@models/media-overlay";
import { Metadata } from "@models/metadata";
import { Properties } from "@models/metadata-properties";
import { Publication } from "@models/publication";
import { Link } from "@models/publication-link";
import { TaJsonDeserialize, TaJsonSerialize } from "@r2-lcp-js/serializable";
import { IZip } from "@r2-utils-js/_utils/zip/zip";

import { lazyLoadMediaOverlays } from "./epub";
import { loadFileBufferFromZipPath, loadFileStrFromZipPath } from "./epub-daisy-common";

const debug = debug_("r2:shared#parser/daisy-convert-to-epub");

function ensureDirs(fspath: string) {
    const dirname = path.dirname(fspath);

    if (!fs.existsSync(dirname)) {
        ensureDirs(dirname);
        fs.mkdirSync(dirname);
    }
}

// this function modifies the input parameter "publication"!
export const convertDaisyToReadiumWebPub = async (
    outputDirPath: string, publication: Publication): Promise<string | undefined> => {

    return new Promise(async (resolve, reject) => {

        const zipInternal = publication.findFromInternal("zip");
        if (!zipInternal) {
            debug("No publication zip!?");
            return reject("No publication zip!?");
        }
        const zip = zipInternal.Value as IZip;

        const outputZipPath = path.join(outputDirPath, "daisy-to-epub.webpub");
        ensureDirs(outputZipPath);

        let timeoutId: NodeJS.Timeout | undefined;
        const zipfile = new ZipFile();
        try {
            const writeStream = fs.createWriteStream(outputZipPath);
            zipfile.outputStream.pipe(writeStream)
                .on("close", () => {
                    debug("ZIP close");
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = undefined;
                        resolve(outputZipPath);
                    }
                })
                .on("error", (e: any) => {
                    debug("ZIP error", e);
                    reject(e);
                });

            // <dtbook xmlns="http://www.daisy.org/z3986/2005/dtbook/" ...
            const select = xpath.useNamespaces({
                dtbook: "http://www.daisy.org/z3986/2005/dtbook/",
                // epub: "http://www.idpf.org/2007/ops",
                // xhtml: "http://www.w3.org/1999/xhtml",
            });

            const elementNames = [
                "address",
                "annoref",
                "annotation",
                "author",
                "bdo",
                "bodymatter",
                "book",
                "bridgehead",
                "byline",
                "caption",
                "cite",
                "col",
                "colgroup",
                "covertitle",
                "dateline",
                "dfn",
                "docauthor",
                "doctitle",
                "dtbook",
                "epigraph",
                "frontmatter",
                "hd",
                "imggroup",
                "kbd",
                "level",
                "levelhd",
                "level1",
                "level2",
                "level3",
                "level4",
                "level5",
                "level6",
                "lic",
                "line",
                "linegroup",
                "linenum",
                "link",
                "list",
                "note",
                "noteref",
                "pagenum",
                "poem",
                "prodnote",
                "rearmatter",
                "samp",
                "sent",
                "sub",
                "sup",
                "q",
                "w",
                "notice",
                "sidebar",
                "blockquote",
                "abbr",
                "acronym",
                "title",
            ];

            let combinedMediaOverlays: MediaOverlayNode | undefined;

            const patchMediaOverlaysTextHref = (mo: MediaOverlayNode) => {

                if (mo.Text) {
                    // TODO: .xml file extension replacement is bit weak / brittle
                    // (but for most DAISY books, this is a reasonable expectation)
                    mo.Text = mo.Text.replace(/\.xml/, ".xhtml");
                }
                if (mo.Children) {
                    for (const child of mo.Children) {
                        patchMediaOverlaysTextHref(child);
                    }
                }
            };

            // dtb:multimediaContent ==> audio,text
            if (publication.Spine &&
                publication.Metadata?.AdditionalJSON &&
                publication.Metadata.AdditionalJSON["dtb:multimediaType"] === "audioFullText") {

                combinedMediaOverlays = new MediaOverlayNode();
                combinedMediaOverlays.SmilPathInZip = undefined;
                combinedMediaOverlays.initialized = true;
                combinedMediaOverlays.Role = [];
                combinedMediaOverlays.Role.push("section");
                combinedMediaOverlays.duration = 0;

                for (const linkItem of publication.Spine) {
                    if (linkItem.MediaOverlays) {

                        if (!linkItem.MediaOverlays.initialized) {
                            // mo.initialized true/false is automatically handled
                            await lazyLoadMediaOverlays(publication, linkItem.MediaOverlays);

                            if (linkItem.MediaOverlays.duration) {
                                if (!linkItem.Duration) {
                                    linkItem.Duration = linkItem.MediaOverlays.duration;
                                }
                                if (linkItem.Alternate) {
                                    for (const altLink of linkItem.Alternate) {
                                        if (altLink.TypeLink === "application/vnd.syncnarr+json") {
                                            if (!altLink.Duration) {
                                                altLink.Duration = linkItem.MediaOverlays.duration;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if (linkItem.MediaOverlays.Children) {
                            if (!combinedMediaOverlays.Children) {
                                combinedMediaOverlays.Children = [];
                            }
                            combinedMediaOverlays.Children =
                                combinedMediaOverlays.Children.concat(linkItem.MediaOverlays.Children);

                            if (linkItem.MediaOverlays.duration) {
                                combinedMediaOverlays.duration += linkItem.MediaOverlays.duration;
                            }
                        }
                    }
                }

                patchMediaOverlaysTextHref(combinedMediaOverlays);
            }
            publication.Spine = [];

            const resourcesToKeep: Link[] = [];

            // reference copy! (not by value) so we can publication.Resources.push(...) safely within the loop
            // const resources = [...publication.Resources];
            // ... but we completely replace the array of Links, so this is fine:
            for (const resLink of publication.Resources) {
                // relative to publication root (package.opf / ReadiumWebPubManifest.json)
                if (!resLink.HrefDecoded) {
                    continue;
                }
                if (resLink.TypeLink === "text/css" || resLink.HrefDecoded.endsWith(".css")) {

                    let cssText = await loadFileStrFromZipPath(resLink.Href, resLink.HrefDecoded, zip);
                    if (!cssText) {
                        debug("!loadFileStrFromZipPath", resLink.HrefDecoded);
                        continue;
                    }

                    // replace comments
                    cssText = cssText.replace(/\/\*([\s\S]+?)\*\//gm, (_match, p1, _offset, _string) => {
                        const base64 = Buffer.from(p1).toString("base64");
                        return `/*__${base64}__*/`;
                    });

                    // const regex = new RegExp(`[^#\.](${elementNames.join("|")})`, "g");
                    for (const elementName of elementNames) {
                        // meant to patch CSS selectors, but not property values
                        const regex = new RegExp(
                            `([^#\.a-zA-Z0-9\-_])(${elementName})([^a-zA-Z0-9\-_;])`, "g");
                        // let i = -1;
                        // let match: RegExpExecArray | null;
                        // // tslint:disable-next-line: no-conditional-assignment
                        // while (match = regex.exec(cssText)) {
                        //     i++;
                        //     debug("A -----------");
                        //     debug(i, elementName, `$_$_$${match[0]}$_$_$`,
                        // `===${match[1]}^^^${match[2]}^^^${match[3]}===`);
                        //     debug("B -----------");
                        // }
                        cssText = cssText.replace(regex, `$1.$2_R2$3`);

                        // second pass, as the first doesn't match tokens with trailing / leading separators
                        cssText = cssText.replace(regex, `$1.$2_R2$3`);
                    }

                    // restore comments
                    cssText = cssText.replace(/\/\*__([\s\S]+?)__\*\//g, (_match, p1, _offset, _string) => {
                        const comment = Buffer.from(p1, "base64").toString("utf8");
                        return `/*${comment}*/`;
                    });

                    // const newCssFilePath = resLink.HrefDecoded.replace(/\.css$/, "__.css");
                    // const cssOutputFilePath = path.join(outputDirPathExploded, newCssFilePath);
                    // ensureDirs(cssOutputFilePath);
                    // fs.writeFileSync(cssOutputFilePath, cssText);
                    zipfile.addBuffer(Buffer.from(cssText), resLink.HrefDecoded);

                    // const resLinkJson = TaJsonSerialize(resLink);
                    // // resLinkJson.href = newCssFilePath;
                    // const resLinkClone = TaJsonDeserialize<Link>(resLinkJson, Link);
                    // resLinkClone.setHrefDecoded(newCssFilePath);

                    resourcesToKeep.push(resLink);

                } else if (resLink.TypeLink === "application/x-dtbook+xml" || resLink.HrefDecoded.endsWith(".xml")) {

                    const dtBookStr = await loadFileStrFromZipPath(resLink.Href, resLink.HrefDecoded, zip);
                    if (!dtBookStr) {
                        debug("!loadFileStrFromZipPath", dtBookStr);
                        continue;
                    }
                    const dtBookDoc = new xmldom.DOMParser().parseFromString(dtBookStr, "application/xml");

                    const title = dtBookDoc.getElementsByTagName("doctitle")[0]?.textContent;

                    const listElements = dtBookDoc.getElementsByTagName("list");
                    for (let i = 0; i < listElements.length; i++) {
                        const listElement = listElements.item(i);
                        if (!listElement) {
                            continue;
                        }
                        const type = listElement.getAttribute("type");
                        if (type) {
                            // TODO: strictly-speaking, this is a read-only property!
                            (listElement as any).tagName = type;
                            // listElement.removeAttribute("type");
                        }
                    }

                    //             .replace(/(<\/?)imggroup/g, "$1figure")
                    //             .replace(/<caption/g, "<figcaption")
                    //             .replace(/<\/caption>/g, "</figcaption>");

                    for (const elementName of elementNames) {
                        // getElementsByName(elementName: string): NodeListOf<HTMLElement>
                        // ==> not available in the XMLDOM API
                        // getElementsByTagName(qualifiedName: string): HTMLCollectionOf<Element>
                        // ==> mutates during loop because of tagName reassignment!
                        const els = Array.from(dtBookDoc.getElementsByTagName(elementName)).filter((el) => el);
                        for (const el of els) {
                            el.setAttribute("data-dtbook", elementName);
                            const cls = el.getAttribute("class");
                            el.setAttribute("class", `${cls ? (cls + " ") : ""}${elementName}_R2`);
                            // TODO: strictly-speaking, this is a read-only property!
                            (el as any).tagName =
                                ((elementName === "dtbook") ? "html" :
                                    ((elementName === "book") ? "body" :
                                        ((elementName === "pagenum") ? "span" :
                                            ((elementName === "sent") ? "span" :
                                                ((elementName === "caption") ? "figcaption" :
                                                    ((elementName === "imggroup") ? "figure" :
                                                        "div"))))));
                        }
                    }

                    // <?xml-stylesheet type="text/css" href="dtbookbasic.css"?>
                    const stylesheets =
                        select("/processing-instruction('xml-stylesheet')", dtBookDoc) as ProcessingInstruction[];
                    const cssHrefs: string[] = []; // `<link rel="stylesheet" href="${cssHref}" />`
                    for (const stylesheet of stylesheets) {
                        if (!stylesheet.nodeValue) {
                            continue;
                        }
                        if (!stylesheet.nodeValue.includes("text/css")) {
                            continue;
                        }
                        const match = stylesheet.nodeValue.match(/href=("|')(.*?)("|')/);
                        if (!match) {
                            continue;
                        }
                        const href = match[2].trim();
                        if (href) {
                            cssHrefs.push(href);
                        }
                    }

                    const smilRefs = select("//*[@smilref]", dtBookDoc) as Element[];
                    for (const smilRef of smilRefs) {
                        const ref = smilRef.getAttribute("smilref");
                        if (ref) {
                            smilRef.setAttribute("data-smilref", ref);
                        }
                        smilRef.removeAttribute("smilref");
                    }

                    // does not work (element renamed via the tagName assignment still have the original NameSpaceURI,
                    // which gets serialized)
                    // dtBookDoc.documentElement.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

                    // does not work (read only property):
                    // (dtBookDoc as any).doctype = null;
                    // ...so we use regexp replace below

                    const dtbookNowXHTML = new xmldom.XMLSerializer().serializeToString(dtBookDoc)
                        .replace(/xmlns="http:\/\/www\.daisy\.org\/z3986\/2005\/dtbook\/"/, "xmlns=\"http://www.w3.org/1999/xhtml\"")
                        .replace(/^([\s\S]*)<html/gm,
                            `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE xhtml>
<html`)
                        .replace(/<head([\s\S]*?)>/gm,
                            `
<head$1>
<meta charset="UTF-8" />
<title>${title ? title : " "}</title>
`)
                        .replace(/<\/head[\s\S]*?>/gm,
                            `
${cssHrefs.reduce((pv, cv) => {
                                return pv + "\n" + `<link rel="stylesheet" type="text/css" href="${cv}" />`;
                            }, "")}
</head>
`);
                    const xhtmlFilePath = resLink.HrefDecoded.replace(/\.(.+)$/, ".xhtml");

                    // const xhtmlOutputFilePath = path.join(outputDirPathExploded, xhtmlFilePath);
                    // ensureDirs(xhtmlOutputFilePath);
                    // fs.writeFileSync(xhtmlOutputFilePath, dtbookNowXHTML);
                    // zipfile.addFile(xhtmlOutputFilePath, xhtmlFilePath);
                    zipfile.addBuffer(Buffer.from(dtbookNowXHTML), xhtmlFilePath);

                    const resLinkJson = TaJsonSerialize(resLink);
                    // resLinkJson.href = xhtmlFilePath;
                    const resLinkClone = TaJsonDeserialize<Link>(resLinkJson, Link);
                    resLinkClone.setHrefDecoded(xhtmlFilePath);
                    resLinkClone.TypeLink = "application/xhtml+xml";

                    publication.Spine.push(resLinkClone);

                    if (combinedMediaOverlays && publication.Spine.length === 1) {
                        resLinkClone.MediaOverlays = combinedMediaOverlays;

                        if (combinedMediaOverlays.duration) {
                            resLinkClone.Duration = combinedMediaOverlays.duration;
                        }

                        const moURL = "smil-media-overlays.json";
                        // mediaOverlayURLPath + "?" +
                        //     mediaOverlayURLParam + "=" +
                        //     encodeURIComponent_RFC3986(
                        //         resLinkClone.HrefDecoded ? resLinkClone.HrefDecoded : resLinkClone.Href);

                        // legacy method:
                        if (!resLinkClone.Properties) {
                            resLinkClone.Properties = new Properties();
                        }
                        resLinkClone.Properties.MediaOverlay = moURL;

                        // new method:
                        // https://w3c.github.io/sync-media-pub/incorporating-synchronized-narration.html#with-webpub
                        if (!resLinkClone.Alternate) {
                            resLinkClone.Alternate = [];
                        }
                        const moLink = new Link();
                        moLink.Href = moURL;
                        moLink.TypeLink = "application/vnd.syncnarr+json";
                        moLink.Duration = resLinkClone.Duration;
                        resLinkClone.Alternate.push(moLink);

                        const jsonObjMO = TaJsonSerialize(combinedMediaOverlays);
                        const jsonStrMO = global.JSON.stringify(jsonObjMO, null, "  ");
                        zipfile.addBuffer(Buffer.from(jsonStrMO), moURL);
                    }

                } else if (!resLink.HrefDecoded.endsWith(".opf") &&
                    !resLink.HrefDecoded.endsWith(".res") &&
                    !resLink.HrefDecoded.endsWith(".ncx")) {

                    const buff = await loadFileBufferFromZipPath(resLink.Href, resLink.HrefDecoded, zip);
                    if (buff) {
                        zipfile.addBuffer(buff, resLink.HrefDecoded);
                    }

                    resourcesToKeep.push(resLink);
                }
            }

            publication.Resources = resourcesToKeep;

            if (!publication.Metadata) {
                publication.Metadata = new Metadata();
            }
            // publication.Metadata.Source = "DAISY";
            if (!publication.Metadata.AdditionalJSON) {
                publication.Metadata.AdditionalJSON = {};
            }
            publication.Metadata.AdditionalJSON.ReadiumWebPublicationConvertedFrom = "DAISY";

            const findFirstDescendantText = (parent: Element): Element | undefined => {
                if (parent.childNodes && parent.childNodes.length) {
                    // tslint:disable-next-line: prefer-for-of
                    for (let i = 0; i < parent.childNodes.length; i++) {
                        const child = parent.childNodes[i];
                        if (child.nodeType === 1) { // Node.ELEMENT_NODE
                            const element = child as Element;
                            if (element.localName && element.localName.toLowerCase() === "text") {
                                return element;
                            }
                        }
                    }
                    // tslint:disable-next-line: prefer-for-of
                    for (let i = 0; i < parent.childNodes.length; i++) {
                        const child = parent.childNodes[i];
                        if (child.nodeType === 1) { // Node.ELEMENT_NODE
                            const element = child as Element;
                            const found = findFirstDescendantText(element);
                            if (found) {
                                return found;
                            }
                        }
                    }
                }
                return undefined;
            };

            const smilDocs: Record<string, Document> = {};

            const processLink = async (link: Link) => {
                // relative to publication root (package.opf / ReadiumWebPubManifest.json)
                let href = link.HrefDecoded;
                if (!href) {
                    return;
                }

                let fragment: string | undefined;
                if (href.indexOf("#") >= 0) {
                    const arr = href.split("#");
                    href = arr[0].trim();
                    fragment = arr[1].trim();
                }
                if (!href) {
                    return;
                }

                let smilDoc = smilDocs[href];
                if (!smilDoc) {
                    const smilStr = await loadFileStrFromZipPath(href, href, zip);
                    if (!smilStr) {
                        debug("!loadFileStrFromZipPath", smilStr);
                        return;
                    }
                    smilDoc = new xmldom.DOMParser().parseFromString(smilStr, "application/xml");
                    smilDocs[href] = smilDoc;
                }

                let targetEl = fragment ? smilDoc.getElementById(fragment) as Element : undefined;
                if (!targetEl) {
                    // const textElems = smilDoc.getElementsByTagName("text");
                    // if (textElems && textElems[0]) {
                    //     targetEl = textElems[0];
                    // }
                    targetEl = findFirstDescendantText(smilDoc.documentElement);
                }
                if (!targetEl) {
                    return;
                }
                if (targetEl.nodeName !== "text") {
                    // const textElems = select("//text", targetEl, true) as Element;
                    // if (textElems) {
                    //     targetEl = textElems;
                    // }
                    targetEl = findFirstDescendantText(targetEl);
                }
                if (!targetEl || targetEl.nodeName !== "text") {
                    return;
                }

                const src = targetEl.getAttribute("src");
                if (!src) {
                    return;
                }
                // TODO: path is relative to SMIL (not to publication root),
                // and .xml file extension replacement is bit weak / brittle
                // (but for most DAISY books, this is a reasonable expectation)
                link.Href = src.replace(/\.xml/, ".xhtml");
            };

            const processLinks = async (links: Link[]) => {
                for (const link of links) {
                    await processLink(link);
                    if (link.Children) {
                        await processLinks(link.Children);
                    }
                }
            };

            if (publication.PageList) {
                for (const link of publication.PageList) {
                    await processLink(link);
                }
            }

            if (publication.Landmarks) {
                for (const link of publication.Landmarks) {
                    await processLink(link);
                }
            }

            if (publication.TOC) {
                await processLinks(publication.TOC);
            }

            const jsonObj = TaJsonSerialize(publication);
            const jsonStr = global.JSON.stringify(jsonObj, null, "  ");
            zipfile.addBuffer(Buffer.from(jsonStr), "manifest.json");
        } catch (erreur) {
            debug(erreur);
        } finally {
            timeoutId = setTimeout(() => {
                timeoutId = undefined;
                reject("YAZL zip took too long!? " + outputZipPath);
            }, 10000);
            zipfile.end();
        }
    });
};
