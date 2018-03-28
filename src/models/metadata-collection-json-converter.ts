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
} from "ta-json";

import { Collection } from "./metadata-collection";

export class JsonCollectionConverter implements IPropertyConverter {
    public serialize(property: Collection): JsonValue {
        // console.log("JsonCollectionConverter.serialize()");

        return TAJSON.serialize(property);
    }

    public deserialize(value: JsonValue): Collection {
        // console.log("JsonCollectionConverter.deserialize()");

        // if (value instanceof Array) {
        //     return value.map((v) => {
        //         return this.deserialize(v);
        //     }) as Collection[];
        // } else
        if (typeof value === "string") {
            const c = new Collection();
            c.Name = value as string;
            return c;
        } else {
            return TAJSON.deserialize<Collection>(value, Collection);
        }
    }

    public collapseArrayWithSingleItem(): boolean {
        return true;
    }
}
