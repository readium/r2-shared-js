// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

// import * as fs from "fs";
import * as path from "path";

import { Publication } from "@models/publication";
import { CbzParsePromise } from "@parser/cbz";
import { EpubParsePromise } from "@parser/epub";

export async function PublicationParsePromise(filePath: string): Promise<Publication> {

    const fileName = path.basename(filePath);
    const ext = path.extname(fileName).toLowerCase();
    return /\.epub[3]?$/.test(ext) ?
        EpubParsePromise(filePath) :
        CbzParsePromise(filePath);
}
