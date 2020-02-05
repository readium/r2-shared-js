// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { Publication } from "@models/publication";
import { AudioBookParsePromise, isAudioBookPublication } from "@parser/audiobook";
import { CbzParsePromise } from "@parser/cbz";
import { EpubParsePromise, isEPUBlication } from "@parser/epub";

export async function PublicationParsePromise(filePath: string): Promise<Publication> {
    return isEPUBlication(filePath) ? EpubParsePromise(filePath) :
        (await isAudioBookPublication(filePath) ? AudioBookParsePromise(filePath) :
        CbzParsePromise(filePath));
}
