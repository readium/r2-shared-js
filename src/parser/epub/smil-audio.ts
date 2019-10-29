// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { XmlObject, XmlXPathSelector } from "@r2-utils-js/_utils/xml-js-mapper";

import { tryDecodeURI } from "../../_utils/decodeURI";

@XmlObject({
    epub: "http://www.idpf.org/2007/ops",
    smil: "http://www.w3.org/ns/SMIL",
})
export class Audio {

    // XPATH ROOT: /smil:smil/smil:body/**/smil:audio

    @XmlXPathSelector("@clipBegin")
    public ClipBegin!: string;

    @XmlXPathSelector("@clipEnd")
    public ClipEnd!: string;

    @XmlXPathSelector("@epub:type")
    public EpubType!: string;

    @XmlXPathSelector("@src")
    public Src1!: string;
    get Src(): string {
        return this.Src1;
    }
    set Src(href: string) {
        this.Src1 = href;
        this._urlDecoded = undefined;
    }
    private _urlDecoded: string | undefined | null;
    get SrcDecoded(): string | undefined {
        if (this._urlDecoded) {
            return this._urlDecoded;
        }
        if (this._urlDecoded === null) {
            return undefined;
        }
        if (!this.Src) {
            this._urlDecoded = null;
            return undefined;
        }
        this._urlDecoded = tryDecodeURI(this.Src);
        return !this._urlDecoded ? undefined : this._urlDecoded;
    }
}
