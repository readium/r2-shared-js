// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { XmlItemType, XmlObject, XmlXPathSelector } from "@r2-utils-js/_utils/xml-js-mapper";

import { Manifest } from "./opf-manifest";
import { Metadata } from "./opf-metadata";
import { Reference } from "./opf-reference";
import { Spine } from "./opf-spine";

@XmlObject({
    dc: "http://purl.org/dc/elements/1.1/",
    opf: "http://www.idpf.org/2007/opf",
})
export class OPF {

    // XPATH ROOT: /opf:package

    @XmlXPathSelector("opf:metadata")
    public Metadata!: Metadata;

    @XmlXPathSelector("opf:manifest/opf:item")
    @XmlItemType(Manifest)
    public Manifest!: Manifest[];

    @XmlXPathSelector("opf:spine")
    public Spine!: Spine;

    @XmlXPathSelector("opf:guide/opf:reference")
    @XmlItemType(Reference)
    public Guide!: Reference[];

    @XmlXPathSelector("@unique-identifier")
    public UniqueIdentifier!: string;

    @XmlXPathSelector("@dir")
    public Dir!: string;

    @XmlXPathSelector("@version")
    public Version!: string;

    public ZipPath: string | undefined;
}
