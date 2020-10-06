// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { XmlObject, XmlXPathSelector } from "@r2-utils-js/_utils/xml-js-mapper";

import { Body } from "./smil-body";
import { Par } from "./smil-par";

@XmlObject({
    dtbsmil: "http://www.w3.org/2001/SMIL20/",
    smil: "http://www.w3.org/ns/SMIL",
})
export class SMIL {

    // XPATH ROOT: /smil:smil

    @XmlXPathSelector("body")
    public Body!: Body;

    // Bug with Javascript / Typescript @ANNOTATION() !
    // Requires the class hierarchy to explicitely include all object types
    // (see SeqOrPar)
    @XmlXPathSelector("dummy")
    public Par!: Par;

    public ZipPath: string | undefined; // URL already decodeURI()
}
