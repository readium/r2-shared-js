// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { XmlObject, XmlXPathSelector } from "@utils/xml-js-mapper";

@XmlObject()
export class Rootfile {

    // XPATH ROOT: /epub:container/epub:rootfiles/epub:rootfile

    @XmlXPathSelector("@full-path")
    public Path!: string;

    @XmlXPathSelector("@media-type")
    public Type!: string;

    @XmlXPathSelector("@version")
    public Version!: string;
}
