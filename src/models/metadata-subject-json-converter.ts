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

import { IStringMap } from "./metadata-multilang";
import { Subject } from "./metadata-subject";

export class JsonSubjectConverter implements IPropertyConverter {
    public serialize(property: Subject): JsonValue {
        // console.log("JsonSubjectConverter.serialize()");

        return TAJSON.serialize(property);
    }

    public deserialize(value: JsonValue): Subject {
        // console.log("JsonSubjectConverter.deserialize()");

        // if (value instanceof Array) {
        //     return value.map((v) => {
        //         return this.deserialize(v);
        //     }) as Collection[];
        // } else

        if (typeof value === "string") {
            const s = new Subject();
            s.Name = value as string;
            return s;
        } else if (typeof value === "object" && !(value as any)["name"]) { // tslint:disable-line:no-string-literal
            const s = new Subject();
            s.Name = {} as IStringMap;
            const keys = Object.keys(value as any);
            keys.forEach((key: string) => {
                // TODO? check key is BCP47 language tag?
                const val = (value as any)[key];
                if (typeof val === "string") {
                    (s.Name as IStringMap)[key] = val;
                }
            });
            return s;
        }
        return TAJSON.deserialize<Subject>(value, Subject);
    }

    public collapseArrayWithSingleItem(): boolean {
        return true;
    }
}
