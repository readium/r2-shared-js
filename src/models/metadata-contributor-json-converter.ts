// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import {
    IPropertyConverter,
    JSON as TAJSON,
    JsonValue,
} from "ta-json-x";

import { Contributor } from "./metadata-contributor";
import { IStringMap } from "./metadata-multilang";

export class JsonContributorConverter implements IPropertyConverter {
    public serialize(property: Contributor): JsonValue {
        // console.log("JsonContributorConverter.serialize()");

        return TAJSON.serialize(property);
    }

    public deserialize(value: JsonValue): Contributor {
        // console.log("JsonContributorConverter.deserialize()");

        // if (value instanceof Array) {
        //     return value.map((v) => {
        //         return this.deserialize(v);
        //     }) as Collection[];
        // } else

        // tslint:disable-next-line:max-line-length
        // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/contributor.schema.json#L7
        // tslint:disable-next-line:max-line-length
        // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/contributor-object.schema.json#L7
        // tslint:disable-next-line:max-line-length
        // https://github.com/readium/webpub-manifest/blob/0ac78ab5c270a608c39b4b04fc90bd9b1d281896/schema/contributor-object.schema.json#L52
        if (typeof value === "string") {
            const c = new Contributor();
            c.Name = value as string;
            return c;
        } else if (typeof value === "object" && !(value as any)["name"]) { // tslint:disable-line:no-string-literal
            const c = new Contributor();
            c.Name = {} as IStringMap;
            const keys = Object.keys(value as any);
            keys.forEach((key: string) => {
                // TODO? check key is BCP47 language tag?
                const val = (value as any)[key];
                if (typeof val === "string") {
                    (c.Name as IStringMap)[key] = val;
                }
            });
            return c;
        }
        return TAJSON.deserialize<Contributor>(value, Contributor);
    }

    public collapseArrayWithSingleItem(): boolean {
        return true;
    }
}
