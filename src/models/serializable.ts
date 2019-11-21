// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

// https://github.com/edcarroll/ta-json
import { JSON as TAJSON } from "ta-json-x";

import { JsonMap } from "../json";

export interface IWithAdditionalJSON {
    AdditionalJSON: JsonMap;
    SupportedKeys: string[];
    parseAdditionalJSON: (json: JsonMap) => void;
    generateAdditionalJSON: (json: JsonMap) => void;
}
export function parseAdditionalJSON(obj: IWithAdditionalJSON, json: JsonMap) {
    if (!json || typeof json !== "object") {
        return;
    }
    Object.keys(json).forEach((key) => {
        if (json.hasOwnProperty(key)) {
            if (!obj.SupportedKeys || !obj.SupportedKeys.includes(key)) {
                if (!obj.AdditionalJSON) {
                    obj.AdditionalJSON = {};
                }
                // warning: reference copy, not deep clone!
                obj.AdditionalJSON[key] = json[key];
            }
        }
    });
}
export function generateAdditionalJSON(obj: IWithAdditionalJSON, json: JsonMap) {
    if (!json || typeof json !== "object") {
        return;
    }
    if (!obj.AdditionalJSON) {
        return;
    }
    Object.keys(obj.AdditionalJSON).forEach((key) => {
        if (obj.SupportedKeys && obj.SupportedKeys.includes(key)) {
            return;
        }
        if (obj.AdditionalJSON.hasOwnProperty(key)) {
            // warning: reference copy, not deep clone!
            json[key] = obj.AdditionalJSON[key];
        }
    });
}

type TConstructor<T> = new(value?: any) => T;
// type TFunction<T> = ObjectConstructor["constructor"] & TConstructor<T>;

// tslint:disable-next-line: max-line-length
export function TaJsonDeserialize<T extends IWithAdditionalJSON>(json: any, type: TConstructor<T>): T {
    const obj = TAJSON.deserialize<T>(json, type);
    obj.parseAdditionalJSON(json);
    return obj;
}

export function TaJsonSerialize<T extends IWithAdditionalJSON>(obj: T): JsonMap {
    const json = TAJSON.serialize(obj) as JsonMap;
    obj.generateAdditionalJSON(json);
    return json;
}
