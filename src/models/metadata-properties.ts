// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

// https://github.com/edcarroll/ta-json
import {
    JsonElementType,
    JsonObject,
    JsonProperty,
} from "ta-json-x";

import { Encrypted } from "@r2-lcp-js/models/metadata-encrypted";

// TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/16
// tslint:disable-next-line:max-line-length
// https://github.com/readium/webpub-manifest/blob/ca6d887caa2d0495200fef4695f41aacb5fed2e9/schema/link.schema.json
// TODO: RENDITION not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/15
// tslint:disable-next-line:max-line-length
// https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json
@JsonObject()
export class Properties {

    @JsonProperty("contains")
    @JsonElementType(String)
    public Contains!: string[];

    @JsonProperty("layout")
    public Layout!: string;

    @JsonProperty("orientation")
    public Orientation!: string;

    @JsonProperty("overflow")
    public Overflow!: string;

    @JsonProperty("page")
    public Page!: string;

    @JsonProperty("spread")
    public Spread!: string;

    @JsonProperty("encrypted")
    public Encrypted!: Encrypted;

    // TODO: MEDIA OVERLAY not in JSON Schema
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/tree/master/schema
    @JsonProperty("media-overlay")
    public MediaOverlay!: string;
}
