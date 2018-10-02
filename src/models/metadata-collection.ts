// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

// https://github.com/edcarroll/ta-json
import {
    JsonObject,
    JsonProperty,
    OnDeserialized,
} from "ta-json-x";

@JsonObject()
export class Collection {

    @JsonProperty("name")
    public Name!: string;

    @JsonProperty("sort_as")
    public SortAs!: string;

    @JsonProperty("identifier")
    public Identifier!: string;

    @JsonProperty("position")
    public Position!: number;

    @OnDeserialized()
    // tslint:disable-next-line:no-unused-variable
    // tslint:disable-next-line
    // @ts-ignore: TS6133 (is declared but its value is never read.)
    private _OnDeserialized() { // tslint:disable-line
        if (!this.Name) {
            console.log("Collection.Name is not set!");
        }
    }
}
