// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { JsonStringConverter } from "@r2-utils-js/_utils/ta-json-string-converter";
// https://github.com/edcarroll/ta-json
import {
    JsonConverter,
    JsonElementType,
    JsonObject,
    JsonProperty,
    OnDeserialized,
} from "ta-json-x";

import { MediaOverlayNode } from "./media-overlay";
import { Properties } from "./metadata-properties";

// tslint:disable-next-line:max-line-length
// https://github.com/readium/webpub-manifest/blob/ca6d887caa2d0495200fef4695f41aacb5fed2e9/schema/link.schema.json
@JsonObject()
export class Link {

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/ca6d887caa2d0495200fef4695f41aacb5fed2e9/schema/link.schema.json#L7
    @JsonProperty("href")
    public Href!: string;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/ca6d887caa2d0495200fef4695f41aacb5fed2e9/schema/link.schema.json#L11
    @JsonProperty("type")
    public TypeLink!: string;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/ca6d887caa2d0495200fef4695f41aacb5fed2e9/schema/link.schema.json#L33
    @JsonProperty("height")
    public Height!: number;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/ca6d887caa2d0495200fef4695f41aacb5fed2e9/schema/link.schema.json#L38
    @JsonProperty("width")
    public Width!: number;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/ca6d887caa2d0495200fef4695f41aacb5fed2e9/schema/link.schema.json#L15
    @JsonProperty("title")
    public Title!: string;

    // TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/16
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/ca6d887caa2d0495200fef4695f41aacb5fed2e9/schema/link.schema.json#L29
    @JsonProperty("properties")
    public Properties!: Properties;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/ca6d887caa2d0495200fef4695f41aacb5fed2e9/schema/link.schema.json#L48
    @JsonProperty("duration")
    public Duration!: number;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/ca6d887caa2d0495200fef4695f41aacb5fed2e9/schema/link.schema.json#L43
    @JsonProperty("bitrate")
    public Bitrate!: number;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/ca6d887caa2d0495200fef4695f41aacb5fed2e9/schema/link.schema.json#L53
    @JsonProperty("templated")
    public Templated!: boolean;

    @JsonProperty("children")
    @JsonElementType(Link)
    public Children!: Link[];

    public MediaOverlays: MediaOverlayNode[] | undefined;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/ca6d887caa2d0495200fef4695f41aacb5fed2e9/schema/link.schema.json#L19
    @JsonProperty("rel")
    @JsonConverter(JsonStringConverter)
    @JsonElementType(String)
    public Rel!: string[];

    public AddRels(rels: string[]) {
        rels.forEach((rel) => {
            this.AddRel(rel);
        });
    }

    public AddRel(rel: string) {
        if (this.HasRel(rel)) {
            return;
        }
        if (!this.Rel) {
            this.Rel = [rel];
        } else {
            this.Rel.push(rel);
        }
    }

    public HasRel(rel: string): boolean {
        return this.Rel && this.Rel.indexOf(rel) >= 0;
    }

    @OnDeserialized()
    // tslint:disable-next-line:no-unused-variable
    // @ts-ignore: TS6133 (is declared but its value is never read.)
    private _OnDeserialized() {

        // tslint:disable-next-line:max-line-length
        // https://github.com/readium/webpub-manifest/blob/ca6d887caa2d0495200fef4695f41aacb5fed2e9/schema/link.schema.json#L59
        if (!this.Href) {
            console.log("Link.Href is not set!");
        }
    }
}
