// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

// https://github.com/edcarroll/ta-json
import {
    JsonConverter, JsonElementType, JsonObject, JsonProperty, OnDeserialized,
} from "ta-json-x";

import { LCP } from "@r2-lcp-js/parser/epub/lcp";
import { JsonStringConverter } from "@r2-utils-js/_utils/ta-json-string-converter";
import { IZip } from "@r2-utils-js/_utils/zip/zip";

import { JsonArray, JsonMap } from "../json";
import { IInternal } from "./internal";
import { Metadata } from "./metadata";
import { Link } from "./publication-link";
import { IWithAdditionalJSON } from "./serializable";

// import { JsonStringConverter } from "@r2-utils-js/_utils/ta-json-string-converter";
// import { IPublicationCollection } from "./publication-collection";

const METADATA_JSON_PROP = "metadata";
const LINKS_JSON_PROP = "links";
const READINGORDER_JSON_PROP = "readingOrder";
const SPINE_JSON_PROP = "spine";
const RESOURCES_JSON_PROP = "resources";
const TOC_JSON_PROP = "toc";
const PAGELIST_JSON_PROP = "page-list";
const LANDMARKS_JSON_PROP = "landmarks";
const LOI_JSON_PROP = "loi";
const LOA_JSON_PROP = "loa";
const LOV_JSON_PROP = "lov";
const LOT_JSON_PROP = "lot";

// tslint:disable-next-line:max-line-length
// https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json
@JsonObject()
export class Publication implements IWithAdditionalJSON {

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L6
    @JsonProperty("@context")
    @JsonElementType(String)
    @JsonConverter(JsonStringConverter)
    public Context!: string[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L13
    @JsonProperty(METADATA_JSON_PROP)
    public Metadata!: Metadata;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L16
    @JsonProperty(LINKS_JSON_PROP)
    @JsonElementType(Link)
    public Links!: Link[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L44
    @JsonProperty(READINGORDER_JSON_PROP)
    @JsonElementType(Link)
    public Spine2!: Link[];
    @JsonProperty(SPINE_JSON_PROP)
    @JsonElementType(Link)
    public Spine1!: Link[] | undefined;
    get Spine(): Link[] | undefined {
        return this.Spine2 ? this.Spine2 : this.Spine1;
    }
    set Spine(spine: Link[] | undefined) {
        if (spine) {
            this.Spine1 = undefined;
            this.Spine2 = spine;
        }
    }

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L51
    @JsonProperty(RESOURCES_JSON_PROP)
    @JsonElementType(Link)
    public Resources!: Link[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/917c83e798e3eda42b3e9d0dc92f0fef31b16211/schema/publication.schema.json#L58
    @JsonProperty(TOC_JSON_PROP)
    @JsonElementType(Link)
    public TOC!: Link[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/917c83e798e3eda42b3e9d0dc92f0fef31b16211/schema/extensions/epub/subcollections.schema.json#L7
    @JsonProperty(PAGELIST_JSON_PROP)
    @JsonElementType(Link)
    public PageList!: Link[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/917c83e798e3eda42b3e9d0dc92f0fef31b16211/schema/extensions/epub/subcollections.schema.json#L13
    @JsonProperty(LANDMARKS_JSON_PROP)
    @JsonElementType(Link)
    public Landmarks!: Link[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/917c83e798e3eda42b3e9d0dc92f0fef31b16211/schema/extensions/epub/subcollections.schema.json#L25
    @JsonProperty(LOI_JSON_PROP)
    @JsonElementType(Link)
    public LOI!: Link[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/917c83e798e3eda42b3e9d0dc92f0fef31b16211/schema/extensions/epub/subcollections.schema.json#L19
    @JsonProperty(LOA_JSON_PROP)
    @JsonElementType(Link)
    public LOA!: Link[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/917c83e798e3eda42b3e9d0dc92f0fef31b16211/schema/extensions/epub/subcollections.schema.json#L37
    @JsonProperty(LOV_JSON_PROP)
    @JsonElementType(Link)
    public LOV!: Link[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/917c83e798e3eda42b3e9d0dc92f0fef31b16211/schema/extensions/epub/subcollections.schema.json#L31
    @JsonProperty(LOT_JSON_PROP)
    @JsonElementType(Link)
    public LOT!: Link[];

    // // OPDS2
    // @JsonProperty("images")
    // @JsonElementType(Link)
    // public Images!: Link[];

    public LCP: LCP | undefined;

    // BEGIN IWithAdditionalJSON
    public AdditionalJSON!: JsonMap; // unused
    public SupportedKeys!: string[]; // unused

    public parseAdditionalJSON(json: JsonMap) {
        // parseAdditionalJSON(this, json);

        if (this.Metadata) {
            this.Metadata.parseAdditionalJSON(json[METADATA_JSON_PROP] as JsonMap);
        }
        if (this.Links) {
            this.Links.forEach((link, i) => {
                link.parseAdditionalJSON((json[LINKS_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.Resources) {
            this.Resources.forEach((link, i) => {
                link.parseAdditionalJSON((json[RESOURCES_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.TOC) {
            this.TOC.forEach((link, i) => {
                link.parseAdditionalJSON((json[TOC_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.PageList) {
            this.PageList.forEach((link, i) => {
                link.parseAdditionalJSON((json[PAGELIST_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.Landmarks) {
            this.Landmarks.forEach((link, i) => {
                link.parseAdditionalJSON((json[LANDMARKS_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.LOI) {
            this.LOI.forEach((link, i) => {
                link.parseAdditionalJSON((json[LOI_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.LOA) {
            this.LOA.forEach((link, i) => {
                link.parseAdditionalJSON((json[LOA_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.LOV) {
            this.LOV.forEach((link, i) => {
                link.parseAdditionalJSON((json[LOV_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.LOT) {
            this.LOT.forEach((link, i) => {
                link.parseAdditionalJSON((json[LOT_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.Spine1) {
            this.Spine1.forEach((link, i) => {
                link.parseAdditionalJSON((json[SPINE_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.Spine2) {
            this.Spine2.forEach((link, i) => {
                link.parseAdditionalJSON((json[READINGORDER_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
    }
    public generateAdditionalJSON(json: JsonMap) {
        // generateAdditionalJSON(this, json);

        if (this.Metadata) {
            this.Metadata.generateAdditionalJSON(json[METADATA_JSON_PROP] as JsonMap);
        }
        if (this.Links) {
            this.Links.forEach((link, i) => {
                link.generateAdditionalJSON((json[LINKS_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.Resources) {
            this.Resources.forEach((link, i) => {
                link.generateAdditionalJSON((json[RESOURCES_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.TOC) {
            this.TOC.forEach((link, i) => {
                link.generateAdditionalJSON((json[TOC_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.PageList) {
            this.PageList.forEach((link, i) => {
                link.generateAdditionalJSON((json[PAGELIST_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.Landmarks) {
            this.Landmarks.forEach((link, i) => {
                link.generateAdditionalJSON((json[LANDMARKS_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.LOI) {
            this.LOI.forEach((link, i) => {
                link.generateAdditionalJSON((json[LOI_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.LOA) {
            this.LOA.forEach((link, i) => {
                link.generateAdditionalJSON((json[LOA_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.LOV) {
            this.LOV.forEach((link, i) => {
                link.generateAdditionalJSON((json[LOV_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.LOT) {
            this.LOT.forEach((link, i) => {
                link.generateAdditionalJSON((json[LOT_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.Spine1) {
            this.Spine1.forEach((link, i) => {
                link.generateAdditionalJSON((json[SPINE_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.Spine2) {
            this.Spine2.forEach((link, i) => {
                link.generateAdditionalJSON((json[READINGORDER_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
    }
    // END IWithAdditionalJSON

    public freeDestroy() {
        console.log("freeDestroy: Publication");
        if (this.Internal) {
            const zipInternal = this.findFromInternal("zip");
            if (zipInternal) {
                const zip = zipInternal.Value as IZip;
                zip.freeDestroy();
            }
        }
    }

    public findFromInternal(key: string): IInternal | undefined {
        if (this.Internal) {
            const found = this.Internal.find((internal) => {
                return internal.Name === key;
            });
            if (found) {
                return found;
            }
        }
        return undefined;
    }

    public AddToInternal(key: string, value: any) {
        const existing = this.findFromInternal(key);
        if (existing) {
            existing.Value = value;
        } else {
            if (!this.Internal) {
                this.Internal = [];
            }

            const internal: IInternal = { Name: key, Value: value };
            this.Internal.push(internal);
        }
    }

    // public findLinKByHref(href: string): Link | undefined {
    //     if (this.Spine) {
    //         const ll = this.Spine.find((link) => {
    //             if (link.Href && href.indexOf(link.Href) >= 0) {
    //                 return true;
    //             }
    //             return false;
    //         });
    //         if (ll) {
    //             return ll;
    //         }
    //     }
    //     return undefined;
    // }

    public GetCover(): Link | undefined {
        return this.searchLinkByRel("cover");
    }

    public GetNavDoc(): Link | undefined {
        return this.searchLinkByRel("contents");
    }

    public searchLinkByRel(rel: string): Link | undefined {
        if (this.Resources) {
            const ll = this.Resources.find((link) => {
                return link.HasRel(rel);
            });
            if (ll) {
                return ll;
            }
        }

        if (this.Spine) {
            const ll = this.Spine.find((link) => {
                return link.HasRel(rel);
            });
            if (ll) {
                return ll;
            }
        }

        if (this.Links) {
            const ll = this.Links.find((link) => {
                return link.HasRel(rel);
            });
            if (ll) {
                return ll;
            }
        }

        return undefined;
    }

    // Note: currently only used internally for META-INF/license.lcpl?
    public AddLink(typeLink: string, rel: string[], url: string, templated: boolean | undefined) {
        const link = new Link();
        link.AddRels(rel);

        link.setHrefDecoded(url);

        link.TypeLink = typeLink;

        if (typeof templated !== "undefined") {
            link.Templated = templated;
        }

        if (!this.Links) {
            this.Links = [];
        }
        this.Links.push(link);
    }

    @OnDeserialized()
    // tslint:disable-next-line:no-unused-variable
    // @ts-ignore: TS6133 (is declared but its value is never read.)
    protected _OnDeserialized() {
        // tslint:disable-next-line:max-line-length
        // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L60
        if (!this.Metadata) {
            console.log("Publication.Metadata is not set!");
        }
        // tslint:disable-next-line:max-line-length
        // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L62
        if (!this.Spine) {
            console.log("Publication.Spine/ReadingOrder is not set!");
        }
        // TODO: many EPUB publications do not have Links
        // tslint:disable-next-line:max-line-length
        // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L61
        // if (!this.Links) {
        //     console.log("Publication.Links is not set!");
        // }
    }

    // tslint:disable-next-line: member-ordering
    private Internal: IInternal[] | undefined;
}
