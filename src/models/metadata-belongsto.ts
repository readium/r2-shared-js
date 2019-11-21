// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

// https://github.com/edcarroll/ta-json
import { JsonConverter, JsonElementType, JsonObject, JsonProperty } from "ta-json-x";

import { JsonArray, JsonMap } from "../json";
import { Contributor } from "./metadata-contributor";
import { JsonContributorConverter } from "./metadata-contributor-json-converter";
import { IWithAdditionalJSON } from "./serializable";

const SERIES_JSON_PROP = "series";
const COLLECTION_JSON_PROP = "collection";

// tslint:disable-next-line:max-line-length
// https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L140
@JsonObject()
export class BelongsTo implements IWithAdditionalJSON {

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L146
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/contributor.schema.json
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/contributor-object.schema.json
    @JsonProperty(SERIES_JSON_PROP)
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Series!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L143
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/contributor.schema.json
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/contributor-object.schema.json
    @JsonProperty(COLLECTION_JSON_PROP)
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Collection!: Contributor[];

    // BEGIN IWithAdditionalJSON
    public AdditionalJSON!: JsonMap;
    public SupportedKeys!: string[];

    public parseAdditionalJSON(json: JsonMap) {
        // parseAdditionalJSON(this, json);

        if (this.Series) {
            this.Series.forEach((cont, i) => {
                cont.parseAdditionalJSON((json[SERIES_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.Collection) {
            this.Collection.forEach((cont, i) => {
                cont.parseAdditionalJSON((json[COLLECTION_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
    }
    public generateAdditionalJSON(json: JsonMap) {
        // generateAdditionalJSON(this, json);

        if (this.Series) {
            this.Series.forEach((cont, i) => {
                cont.generateAdditionalJSON((json[SERIES_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
        if (this.Collection) {
            this.Collection.forEach((cont, i) => {
                cont.generateAdditionalJSON((json[COLLECTION_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
    }
    // END IWithAdditionalJSON
}
