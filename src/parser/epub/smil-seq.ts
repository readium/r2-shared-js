// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import {
    XmlDiscriminatorValue, XmlItemType, XmlObject, XmlXPathSelector,
} from "@r2-utils-js/_utils/xml-js-mapper";

import { SeqOrPar } from "./smil-seq-or-par";

@XmlObject({
    epub: "http://www.idpf.org/2007/ops",
    smil: "http://www.w3.org/ns/SMIL",
})
@XmlDiscriminatorValue("seq")
export class Seq extends SeqOrPar {

    // XPATH ROOT: /smil:smil/smil:body
    // XPATH ROOT: /smil:smil/smil:body/**/smil:seq

    @XmlXPathSelector("smil:par|smil:seq")
    @XmlItemType(SeqOrPar)
    public Children!: SeqOrPar[];

    // @XmlXPathSelector("smil:seq")
    // @XmlItemType(Seq)
    // public Seq: Seq[];

    // @XmlXPathSelector("smil:par")
    // @XmlItemType(Par)
    // public Par: Par[];

    @XmlXPathSelector("@epub:textref")
    public TextRef!: string;

    // constructor() {
    //     super();
    //     this.localName = "seq";
    // }
}
