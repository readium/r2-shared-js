// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { JsonStringConverter } from "@r2-utils-js/_utils/ta-json-string-converter";
// https://github.com/edcarroll/ta-json
import {
    JsonConverter,
    JsonElementType,
    JsonObject,
    JsonProperty,
    OnDeserialized,
} from "ta-json-x";

import { BelongsTo } from "./metadata-belongsto";
import { Contributor } from "./metadata-contributor";
import { JsonContributorConverter } from "./metadata-contributor-json-converter";
import { MediaOverlay } from "./metadata-media-overlay";
import { IStringMap } from "./metadata-multilang";
import { Properties } from "./metadata-properties";
import { Subject } from "./metadata-subject";
import { JsonSubjectConverter } from "./metadata-subject-json-converter";

// export interface IMeta {
//     property: string;
//     value: string;
//     children: IMeta[];
// }

// tslint:disable-next-line:max-line-length
// https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json
@JsonObject()
export class Metadata {
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L11
    // tslint:disable-next-line:max-line-length
    // https://github.com/opds-community/drafts/blob/4d82fb9a64f35a174a5f205c23ba623ec010d5ec/schema/feed-metadata.schema.json#L11
    @JsonProperty("@type")
    public RDFType!: string;

    // TODO: array? https://github.com/opds-community/drafts/issues/24
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L15
    // tslint:disable-next-line:max-line-length
    // https://github.com/opds-community/drafts/blob/4d82fb9a64f35a174a5f205c23ba623ec010d5ec/schema/feed-metadata.schema.json#L15
    @JsonProperty("title")
    // @JsonType(String)
    // not needed because primitive string union with
    // simple object type (string keys, string values)
    public Title!: string | IStringMap; // | string[] | IStringMap[]

    // TODO: array? https://github.com/opds-community/drafts/issues/24
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L33
    // tslint:disable-next-line:max-line-length
    // https://github.com/opds-community/drafts/blob/4d82fb9a64f35a174a5f205c23ba623ec010d5ec/schema/feed-metadata.schema.json#L22
    @JsonProperty("subtitle")
    public SubTitle!: string | IStringMap;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L7
    // tslint:disable-next-line:max-line-length
    // https://github.com/opds-community/drafts/blob/4d82fb9a64f35a174a5f205c23ba623ec010d5ec/schema/feed-metadata.schema.json#L7
    @JsonProperty("identifier")
    public Identifier!: string;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L81
    @JsonProperty("author")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Author!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L84
    @JsonProperty("translator")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Translator!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L87
    @JsonProperty("editor")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Editor!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L90
    @JsonProperty("artist")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Artist!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L93
    @JsonProperty("illustrator")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Illustrator!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L96
    @JsonProperty("letterer")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Letterer!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L99
    @JsonProperty("penciler")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Penciler!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L102
    @JsonProperty("colorist")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Colorist!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L105
    @JsonProperty("inker")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Inker!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L108
    @JsonProperty("narrator")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Narrator!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L111
    @JsonProperty("contributor")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Contributor!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L114
    @JsonProperty("publisher")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Publisher!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L117
    @JsonProperty("imprint")
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Imprint!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L66
    @JsonProperty("language")
    @JsonElementType(String)
    @JsonConverter(JsonStringConverter)
    public Language!: string[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L51
    // tslint:disable-next-line:max-line-length
    // https://github.com/opds-community/drafts/blob/4d82fb9a64f35a174a5f205c23ba623ec010d5ec/schema/feed-metadata.schema.json#L29
    @JsonProperty("modified")
    public Modified!: Date;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L55
    @JsonProperty("published")
    public PublicationDate!: Date;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L78
    @JsonProperty("sortAs")
    public SortAs2!: string;
    @JsonProperty("sort_as")
    public SortAs1: string | undefined;
    get SortAs(): string | undefined {
        return this.SortAs2 ? this.SortAs2 : this.SortAs1;
    }
    set SortAs(sortas: string | undefined) {
        if (sortas) {
            this.SortAs1 = undefined;
            this.SortAs2 = sortas;
        }
    }

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L129
    // tslint:disable-next-line:max-line-length
    // https://github.com/opds-community/drafts/blob/4d82fb9a64f35a174a5f205c23ba623ec010d5ec/schema/feed-metadata.schema.json#L33
    @JsonProperty("description")
    public Description!: string;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L120
    @JsonProperty("readingProgression")
    public Direction2!: string; // TODO: enum "rtl", "ltr", "auto"
    @JsonProperty("direction")
    public Direction1: string | undefined;
    get Direction(): string | undefined {
        return this.Direction2 ? this.Direction2 : this.Direction1;
    }
    set Direction(direction: string | undefined) {
        if (direction) {
            this.Direction1 = undefined;
            this.Direction2 = direction;
        }
    }

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L140
    @JsonProperty("belongsTo")
    public BelongsTo2!: BelongsTo;
    @JsonProperty("belongs_to")
    public BelongsTo1: BelongsTo | undefined;
    get BelongsTo(): BelongsTo | undefined {
        return this.BelongsTo2 ? this.BelongsTo2 : this.BelongsTo1;
    }
    set BelongsTo(belongsto: BelongsTo | undefined) {
        if (belongsto) {
            this.BelongsTo1 = undefined;
            this.BelongsTo2 = belongsto;
        }
    }

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L132
    @JsonProperty("duration")
    public Duration!: number;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L136
    @JsonProperty("numberOfPages")
    public NumberOfPages!: number;

    // public OtherMetadata: IMeta[];

    // TODO: not in JSON Schema
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/tree/master/schema
    @JsonProperty("media-overlay")
    public MediaOverlay!: MediaOverlay;

    // TODO: not in JSON Schema??
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json
    @JsonProperty("rights")
    public Rights!: string;

    // TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/15
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json
    @JsonProperty("rendition")
    public Rendition!: Properties;

    // TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/14
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json
    @JsonProperty("source")
    public Source!: string;

    // TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/13
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json
    @JsonProperty("subject")
    @JsonConverter(JsonSubjectConverter)
    @JsonElementType(Subject)
    public Subject!: Subject[];

    // TODO: not in JSON Schema??
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json
    // @JsonProperty("epub-type")
    // @JsonElementType(String)
    // public EpubType!: string[];

    @OnDeserialized()
    // tslint:disable-next-line:no-unused-variable
    // @ts-ignore: TS6133 (is declared but its value is never read.)
    protected _OnDeserialized() {
        // tslint:disable-next-line:max-line-length
        // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L153
        // tslint:disable-next-line:max-line-length
        // https://github.com/opds-community/drafts/blob/4d82fb9a64f35a174a5f205c23ba623ec010d5ec/schema/feed-metadata.schema.json#L50
        if (!this.Title) {
            console.log("Metadata.Title is not set!");
        }
        // if (!this.Identifier) {
        //     console.log("Metadata.Identifier is not set!");
        // }
    }
}
