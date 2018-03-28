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
} from "ta-json";

import { Encrypted } from "@r2-lcp-js/models/metadata-encrypted";

@JsonObject()
export class Properties {

    @JsonProperty("contains")
    @JsonElementType(String)
    public Contains!: string[];

    @JsonProperty("layout")
    public Layout!: string;

    @JsonProperty("media-overlay")
    public MediaOverlay!: string;

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
}
