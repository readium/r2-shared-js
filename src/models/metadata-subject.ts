// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

// https://github.com/edcarroll/ta-json
import { JsonElementType, JsonObject, JsonProperty, OnDeserialized } from "ta-json-x";

import { JsonArray, JsonMap } from "../json";
import { IStringMap } from "./metadata-multilang";
import { Link } from "./publication-link";
import { IWithAdditionalJSON } from "./serializable";

const LINKS_JSON_PROP = "links";

// TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/13
// tslint:disable-next-line:max-line-length
// https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json
@JsonObject()
export class Subject implements IWithAdditionalJSON {

    @JsonProperty("name")
    public Name!: string | IStringMap;

    @JsonProperty("sortAs")
    public SortAs2!: string;
    @JsonProperty("sort_as")
    public SortAs1: string | undefined;
    get SortAs(): string | undefined {
        return this.SortAs2 ? this.SortAs2 : this.SortAs1;
    }
    set SortAs(sortas: string | undefined) {
        if (sortas) {
            this.SortAs1 = undefined;
            this.SortAs2 = sortas;
        }
    }

    @JsonProperty("scheme")
    public Scheme!: string;

    @JsonProperty("code")
    public Code!: string;

    @JsonProperty(LINKS_JSON_PROP)
    @JsonElementType(Link)
    public Links!: Link[];

    // BEGIN IWithAdditionalJSON
    // tslint:disable: member-ordering
    public AdditionalJSON!: JsonMap; // unused
    public SupportedKeys!: string[]; // unused

    public parseAdditionalJSON(json: JsonMap) {
        // parseAdditionalJSON(this, json);

        if (this.Links) {
            this.Links.forEach((link, i) => {
                link.parseAdditionalJSON((json[LINKS_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
    }
    public generateAdditionalJSON(json: JsonMap) {
        // generateAdditionalJSON(this, json);

        if (this.Links) {
            this.Links.forEach((link, i) => {
                link.generateAdditionalJSON((json[LINKS_JSON_PROP] as JsonArray)[i] as JsonMap);
            });
        }
    }
    // END IWithAdditionalJSON

    @OnDeserialized()
    // tslint:disable-next-line:no-unused-variable
    // @ts-ignore: TS6133 (is declared but its value is never read.)
    protected _OnDeserialized() {
        if (!this.Name) {
            console.log("Subject.Name is not set!");
        }
    }
}
