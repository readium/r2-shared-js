// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { XmlItemType, XmlObject, XmlXPathSelector } from "@r2-utils-js/_utils/xml-js-mapper";
import { DCMetadata } from "./opf-dc-metadata";
import { XMetadata } from "./opf-x-metadata";

@XmlObject({
    dc: "http://purl.org/dc/elements/1.1/",
    opf: "http://openebook.org/namespaces/oeb-package/1.0/",
})
export class Metadata {

    // XPATH ROOT: /opf:package/opf:metadata

    @XmlXPathSelector("dc-metadata")
    @XmlItemType(DCMetadata)
    public DCMetadata!: DCMetadata;

    @XmlXPathSelector("x-metadata")
    @XmlItemType(XMetadata)
    public XMetadata!: XMetadata;

}
