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
    oebpackage: "http://openebook.org/namespaces/oeb-package/1.0/",
})
export class DCMetadata {

    @XmlXPathSelector("dc:Title/text()")
    @XmlItemType(Title)
    public Title!: Title[];

    @XmlXPathSelector("dc:Language/text()")
    @XmlItemType(String)
    public Language!: string[];

    @XmlXPathSelector("dc:Identifier")
    @XmlItemType(Identifier)
    public Identifier!: Identifier[];

    @XmlXPathSelector("dc:Creator")
    @XmlItemType(Author)
    public Creator!: Author[];

    @XmlXPathSelector("dc:Subject")
    @XmlItemType(Subject)
    public Subject!: Subject[];

    @XmlXPathSelector("dc:Description/text()")
    @XmlItemType(String)
    public Description!: string[];

    @XmlXPathSelector("dc:Publisher/text()")
    @XmlItemType(String)
    public Publisher!: string[];

    @XmlXPathSelector("dc:Contributor")
    @XmlItemType(Author)
    public Contributor!: Author[];

    @XmlXPathSelector("dc:Date")
    @XmlItemType(MetaDate)
    public Date!: MetaDate[];

    @XmlXPathSelector("dc:Type/text()")
    @XmlItemType(String)
    public Type!: string[];

    @XmlXPathSelector("dc:Format/text()")
    @XmlItemType(String)
    public Format!: string[];

    @XmlXPathSelector("dc:Source/text()")
    @XmlItemType(String)
    public Source!: string[];

    @XmlXPathSelector("dc:Relation/text()")
    @XmlItemType(String)
    public Relation!: string[];

    @XmlXPathSelector("dc:Coverage/text()")
    @XmlItemType(String)
    public Coverage!: string[];

    @XmlXPathSelector("dc:Rights/text()")
    @XmlItemType(String)
    public Rights!: string[];

}
