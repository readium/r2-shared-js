// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { XmlItemType, XmlObject, XmlXPathSelector } from "@r2-utils-js/_utils/xml-js-mapper";

import { Author } from "./opf-author";
import { MetaDate } from "./opf-date";
import { Identifier } from "./opf-identifier";
import { Subject } from "./opf-subject";
import { Title } from "./opf-title";

@XmlObject({
    dc: "http://purl.org/dc/elements/1.1/",
    opf: "http://www.idpf.org/2007/opf",
    opf2: "http://openebook.org/namespaces/oeb-package/1.0/",
})
export class DCMetadata {

    // XPATH ROOT: /opf:package/opf:metadata/dc-metadata

    @XmlXPathSelector("dc:Title | dc:title")
    @XmlItemType(Title)
    public Title!: Title[];

    @XmlXPathSelector("dc:Language/text() | dc:language/text()")
    @XmlItemType(String)
    public Language!: string[];

    @XmlXPathSelector("dc:Identifier | dc:identifier")
    @XmlItemType(Identifier)
    public Identifier!: Identifier[];

    @XmlXPathSelector("dc:Creator | dc:creator")
    @XmlItemType(Author)
    public Creator!: Author[];

    @XmlXPathSelector("dc:Subject | dc:subject")
    @XmlItemType(Subject)
    public Subject!: Subject[];

    @XmlXPathSelector("dc:Description/text() | dc:description/text()")
    @XmlItemType(String)
    public Description!: string[];

    @XmlXPathSelector("dc:Publisher/text() | dc:publisher/text()")
    @XmlItemType(String)
    public Publisher!: string[];

    @XmlXPathSelector("dc:Contributor | dc:contributor")
    @XmlItemType(Author)
    public Contributor!: Author[];

    @XmlXPathSelector("dc:Date | dc:date")
    @XmlItemType(MetaDate)
    public Date!: MetaDate[];

    @XmlXPathSelector("dc:Type/text() | dc:type/text()")
    @XmlItemType(String)
    public Type!: string[];

    @XmlXPathSelector("dc:Format/text() | dc:format/text()")
    @XmlItemType(String)
    public Format!: string[];

    @XmlXPathSelector("dc:Source/text() | dc:source/text()")
    @XmlItemType(String)
    public Source!: string[];

    @XmlXPathSelector("dc:Relation/text() | dc:relation/text()")
    @XmlItemType(String)
    public Relation!: string[];

    @XmlXPathSelector("dc:Coverage/text() | dc:coverage/text()")
    @XmlItemType(String)
    public Coverage!: string[];

    @XmlXPathSelector("dc:Rights/text() | dc:rights/text()")
    @XmlItemType(String)
    public Rights!: string[];

}