// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as path from "path";

import { Publication } from "@models/publication";
import { AudioBookParsePromise, AudioBookis, isAudioBookPublication } from "@parser/audiobook";
import { CbzParsePromise, isCBZPublication } from "@parser/cbz";
import { DaisyParsePromise, isDaisyPublication } from "@parser/daisy";
import { EpubParsePromise, isEPUBlication } from "@parser/epub";
import { DivinaParsePromise, isDivinaPublication } from "./divina";

export async function PublicationParsePromise(filePath: string): Promise<Publication> {
    let isAudio: AudioBookis | undefined;
    return isEPUBlication(filePath) ? EpubParsePromise(filePath) :
        (isCBZPublication(filePath) ? CbzParsePromise(filePath) :
            (await isDivinaPublication(filePath) ? DivinaParsePromise(filePath) :
                (/\.webpub$/.test(path.extname(path.basename(filePath)).toLowerCase()) ? DivinaParsePromise(filePath) :
                    (await isDaisyPublication(filePath) ? DaisyParsePromise(filePath) :
                        // tslint:disable-next-line: no-conditional-assignment
                        (isAudio = await isAudioBookPublication(filePath)) ? AudioBookParsePromise(filePath, isAudio) :
                            Promise.reject(`Unrecognized publication type ${filePath}`)))));
}
