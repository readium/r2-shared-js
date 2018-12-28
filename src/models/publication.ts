// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

// import { JsonStringConverter } from "@r2-utils-js/_utils/ta-json-string-converter";

import { LCP } from "@r2-lcp-js/parser/epub/lcp";
import { JsonStringConverter } from "@r2-utils-js/_utils/ta-json-string-converter";
import { IZip } from "@r2-utils-js/_utils/zip/zip";
// https://github.com/edcarroll/ta-json
import {
    JsonConverter,
    JsonElementType,
    JsonObject,
    JsonProperty,
    OnDeserialized,
} from "ta-json-x";

import { IInternal } from "./internal";
import { Metadata } from "./metadata";
import { Link } from "./publication-link";

// import { IPublicationCollection } from "./publication-collection";

// tslint:disable-next-line:max-line-length
// https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json
@JsonObject()
export class Publication {

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L6
    @JsonProperty("@context")
    @JsonElementType(String)
    @JsonConverter(JsonStringConverter)
    public Context!: string[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L13
    @JsonProperty("metadata")
    public Metadata!: Metadata;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L16
    @JsonProperty("links")
    @JsonElementType(Link)
    public Links!: Link[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L44
    @JsonProperty("readingOrder")
    @JsonElementType(Link)
    public Spine2!: Link[];
    @JsonProperty("spine")
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
    @JsonProperty("resources")
    @JsonElementType(Link)
    public Resources!: Link[];

    // TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/17
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json
    @JsonProperty("toc")
    @JsonElementType(Link)
    public TOC!: Link[];

    // TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/17
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json
    @JsonProperty("page-list")
    @JsonElementType(Link)
    public PageList!: Link[];

    // TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/17
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json
    @JsonProperty("landmarks")
    @JsonElementType(Link)
    public Landmarks!: Link[];

    // TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/17
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json
    @JsonProperty("loi")
    @JsonElementType(Link)
    public LOI!: Link[];

    // TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/17
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json
    @JsonProperty("loa")
    @JsonElementType(Link)
    public LOA!: Link[];

    // TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/17
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json
    @JsonProperty("lov")
    @JsonElementType(Link)
    public LOV!: Link[];

    // TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/17
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json
    @JsonProperty("lot")
    @JsonElementType(Link)
    public LOT!: Link[];

    // // OPDS2
    // @JsonProperty("images")
    // @JsonElementType(Link)
    // public Images!: Link[];

    // TODO subcollection?
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L65
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/subcollection.schema.json
    // public OtherLinks: Link[];
    // public OtherCollections: IPublicationCollection[];

    public LCP: LCP | undefined;

    private Internal: IInternal[] | undefined;

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

    public AddLink(typeLink: string, rel: string[], url: string, templated: boolean | undefined) {
        const link = new Link();
        link.AddRels(rel);
        link.Href = url;
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
        // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L61
        if (!this.Links) {
            console.log("Publication.Links is not set!");
        }
        // tslint:disable-next-line:max-line-length
        // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/publication.schema.json#L62
        if (!this.Spine) {
            console.log("Publication.Spine/ReadingOrder is not set!");
        }
    }
}
