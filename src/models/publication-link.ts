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

@JsonObject()
export class Link {

    @JsonProperty("href")
    public Href!: string;

    @JsonProperty("type")
    public TypeLink!: string;

    @JsonProperty("height")
    public Height!: number;

    @JsonProperty("width")
    public Width!: number;

    @JsonProperty("title")
    public Title!: string;

    @JsonProperty("properties")
    public Properties!: Properties;

    @JsonProperty("duration")
    public Duration!: number;

    @JsonProperty("bitrate")
    public Bitrate!: number;

    @JsonProperty("templated")
    public Templated!: boolean;

    @JsonProperty("children")
    @JsonElementType(Link)
    public Children!: Link[];

    public MediaOverlays: MediaOverlayNode[] | undefined;

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
        if (!this.Href) {
            console.log("Link.Href is not set!");
        }
    }
}
