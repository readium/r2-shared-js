// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";

import { IZip } from "@r2-utils-js/_utils/zip/zip";

const debug = debug_("r2:shared#utils/zipHasEntry");

export async function zipHasEntry(zip: IZip, zipPath: string, zipPathOther: string | undefined): Promise<boolean> {
    let has = zip.hasEntry(zipPath);
    if ((zip as any).hasEntryAsync) { // hacky!!! (HTTP fetch)
        try {
            has = await (zip as any).hasEntryAsync(zipPath);
        } catch (err) {
            console.log(err);
        }
    }
    if (!has && zipPathOther && zipPathOther !== zipPath) {
        debug(`zipHasEntry: ${zipPath} => ${zipPathOther}`);

        has = zip.hasEntry(zipPathOther);
        if ((zip as any).hasEntryAsync) { // hacky!!! (HTTP fetch)
            try {
                has = await (zip as any).hasEntryAsync(zipPathOther);
            } catch (err) {
                console.log(err);
            }
        }
    }
    return has;
}
