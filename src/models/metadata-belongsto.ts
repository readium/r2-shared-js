// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

// https://github.com/edcarroll/ta-json
import { JsonConverter, JsonElementType, JsonObject, JsonProperty } from "ta-json-x";

import { Contributor } from "./metadata-contributor";
import { JsonContributorConverter } from "./metadata-contributor-json-converter";

// tslint:disable-next-line:max-line-length
// https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L140
@JsonObject()
export class BelongsTo {

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L146
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/contributor.schema.json
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/contributor-object.schema.json
    @JsonProperty("series")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Series!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L143
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/contributor.schema.json
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/contributor-object.schema.json
    @JsonProperty("collection")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Collection!: Contributor[];
}
