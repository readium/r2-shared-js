// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { XmlObject, XmlXPathSelector } from "@r2-utils-js/_utils/xml-js-mapper";

@XmlObject({
    dc: "http://purl.org/dc/elements/1.1/",
    opf: "http://www.idpf.org/2007/opf",
})
export class Reference {

    // XPATH ROOT: /opf:package/opf:guide/opf:reference

    @XmlXPathSelector("@href")
    public Href!: string;

    @XmlXPathSelector("@title")
    public Title!: string;

    @XmlXPathSelector("@type")
    public Type!: string;
}
