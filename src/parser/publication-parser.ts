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

import { DivinaParsePromise, Divinais, isDivinaPublication } from "./divina";

export async function PublicationParsePromise(filePath: string): Promise<Publication> {
    let isAudio: AudioBookis | undefined;
    let isDivina: Divinais | undefined;
    return isEPUBlication(filePath) ? EpubParsePromise(filePath) :
        (isCBZPublication(filePath) ? CbzParsePromise(filePath) :
            // tslint:disable-next-line: no-conditional-assignment
            ((isDivina = await isDivinaPublication(filePath)) ? DivinaParsePromise(filePath, isDivina) :
                // tslint:disable-next-line:max-line-length
                (/\.webpub$/.test(path.extname(path.basename(filePath)).toLowerCase()) ? DivinaParsePromise(filePath, (/^http[s]?:\/\//.test(filePath) ? Divinais.RemotePacked : Divinais.LocalPacked), "webpub") :
                    // tslint:disable-next-line:max-line-length
                    (/\.lcpdf$/.test(path.extname(path.basename(filePath)).toLowerCase()) ? DivinaParsePromise(filePath, (/^http[s]?:\/\//.test(filePath) ? Divinais.RemotePacked : Divinais.LocalPacked), "pdf") :
                        (await isDaisyPublication(filePath) ? DaisyParsePromise(filePath) :
                            // tslint:disable-next-line: no-conditional-assignment max-line-length
                            (isAudio = await isAudioBookPublication(filePath)) ? AudioBookParsePromise(filePath, isAudio) :
                                Promise.reject(`Unrecognized publication type ${filePath}`))))));
}
