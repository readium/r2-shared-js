// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

// https://github.com/edcarroll/ta-json
import {
    JsonConverter, JsonElementType, JsonObject, JsonProperty, OnDeserialized,
} from "ta-json-x";

import { IWithAdditionalJSON, JsonMap } from "@r2-lcp-js/serializable";
import { JsonStringConverter } from "@r2-utils-js/_utils/ta-json-string-converter";

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

export enum DirectionEnum {
    Auto = "auto",
    RTL = "rtl",
    LTR = "ltr",
}

// [\n\s\S]+?^[ ]+@JsonProperty\(("[a-zA-Z]+")\)$
// regexp replace all:
// $1,
// tslint:disable-next-line:max-line-length
// export const MetadataSupportedKeys = ["title", "subtitle", "identifier", "author", "translator", "editor", "artist", "illustrator", "letterer", "penciler", "colorist", "inker", "narrator", "contributor", "publisher", "imprint", "language", "modified", "published", "sortAs", "description", "readingProgression", "direction", "belongsTo", "duration", "numberOfPages", "rights", "rendition", "source", "subject"];

const SUBJECT_JSON_PROP = "subject";
const BELONGS_TO_JSON_PROP = "belongs_to";
const BELONGSTO_JSON_PROP = "belongsTo";
const RENDITION_JSON_PROP = "rendition";
const AUTHOR_JSON_PROP = "author";
const TRANSLATOR_JSON_PROP = "translator";
const EDITOR_JSON_PROP = "editor";
const ARTIST_JSON_PROP = "artist";
const ILLUSTRATOR_JSON_PROP = "illustrator";
const LETTERER_JSON_PROP = "letterer";
const PENCILER_JSON_PROP = "penciler";
const COLORIST_JSON_PROP = "colorist";
const INKER_JSON_PROP = "inker";
const NARRATOR_JSON_PROP = "narrator";
const CONTRIBUTOR_JSON_PROP = "contributor";
const PUBLISHER_JSON_PROP = "publisher";
const IMPRINT_JSON_PROP = "imprint";

// tslint:disable-next-line:max-line-length
// https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json
@JsonObject()
export class Metadata implements IWithAdditionalJSON {

    // https://github.com/readium/architecture/issues/94#issuecomment-613965656
    // https://github.com/JayPanoz/architecture/blob/a11y-metadata-parsing/streamer/parser/a11y-metadata-parsing.md
    // http://kb.daisy.org/publishing/docs/metadata/schema-org.html
    // http://kb.daisy.org/publishing/docs/metadata/evaluation.html
    // https://www.w3.org/wiki/WebSchemas/Accessibility

    // schema:accessMode
    @JsonProperty("accessMode")
    @JsonConverter(JsonStringConverter)
    @JsonElementType(String)
    public AccessMode!: string[];
    // 'auditory',
    // 'tactile',
    // 'textual',
    // 'visual',
    // 'chartOnVisual',
    // 'chemOnVisual',
    // 'colorDependent',
    // 'diagramOnVisual',
    // 'mathOnVisual',
    // 'musicOnVisual',
    // 'textOnVisual',

    // schema:accessibilityFeature
    @JsonProperty("accessibilityFeature")
    @JsonConverter(JsonStringConverter)
    @JsonElementType(String)
    public AccessibilityFeature!: string[];
    // 'alternativeText',
    // 'annotations',
    // 'audioDescription',
    // 'bookmarks',
    // 'braille',
    // 'captions',
    // 'ChemML',
    // 'describedMath',
    // 'displayTransformability',
    // 'displayTransformability/font-size',
    // 'displayTransformability/font-family',
    // 'displayTransformability/line-height',
    // 'displayTransformability/word-spacing',
    // 'displayTransformability/letter-spacing',
    // 'displayTransformability/color',
    // 'displayTransformability/background-color',
    // 'highContrastAudio',
    // 'highContrastAudio/noBackground',
    // 'highContrastAudio/reducedBackground',
    // 'highContrastAudio/switchableBackground',
    // 'highContrastDisplay',
    // 'index',
    // 'largePrint',
    // 'latex',
    // 'longDescription',
    // 'MathML',
    // 'none',
    // 'printPageNumbers',
    // 'readingOrder',
    // 'rubyAnnotations',
    // 'signLanguage',
    // 'structuralNavigation',
    // 'synchronizedAudioText',
    // 'tableOfContents',
    // 'taggedPDF',
    // 'tactileGraphic',
    // 'tactileObject',
    // 'timingControl',
    // 'transcript',
    // 'ttsMarkup',
    // 'unlocked',

    // schema:accessibilityHazard
    @JsonProperty("accessibilityHazard")
    @JsonConverter(JsonStringConverter)
    @JsonElementType(String)
    public AccessibilityHazard!: string[];
    // 'flashing',
    // 'noFlashingHazard',
    // 'motionSimulation',
    // 'noMotionSimulationHazard',
    // 'sound',
    // 'noSoundHazard',
    // 'unknown',
    // 'none',

    // schema:accessibilitySummary
    @JsonProperty("accessibilitySummary")
    @JsonConverter(JsonStringConverter)
    @JsonElementType(String)
    public AccessibilitySummary!: string[];

    // schema:accessModeSufficient
    // NOTE: the only field that accepts comma-separated values from the enumeration,
    // but this model preserves the original string, no attempt to break down the tokens.
    @JsonProperty("accessModeSufficient")
    @JsonConverter(JsonStringConverter)
    @JsonElementType(String)
    public AccessModeSufficient!: string[];
    // 'auditory',
    // 'tactile',
    // 'textual',
    // 'visual',
    // 'chartOnVisual',
    // 'chemOnVisual',
    // 'colorDependent',
    // 'diagramOnVisual',
    // 'mathOnVisual',
    // 'musicOnVisual',
    // 'textOnVisual',

    // schema:accessibilityAPI
    @JsonProperty("accessibilityAPI")
    @JsonConverter(JsonStringConverter)
    @JsonElementType(String)
    public AccessibilityAPI!: string[];
    // ARIA etc.

    // schema:accessibilityControl
    @JsonProperty("accessibilityControl")
    @JsonConverter(JsonStringConverter)
    @JsonElementType(String)
    public AccessibilityControl!: string[];
    // 'fullKeyboardControl',
    // 'fullMouseControl',
    // 'fullSwitchControl',
    // 'fullTouchControl',
    // 'fullVideoControl',
    // 'fullAudioControl',
    // 'fullVoiceControl',

    // a11y:certifiedBy
    @JsonProperty("certifiedBy")
    @JsonConverter(JsonStringConverter)
    @JsonElementType(String)
    public CertifiedBy!: string[];

    // a11y:certifierCredential
    @JsonProperty("certifierCredential")
    @JsonConverter(JsonStringConverter)
    @JsonElementType(String)
    public CertifierCredential!: string[]; // may be link in EPUB3

    // a11y:certifierReport
    @JsonProperty("certifierReport")
    @JsonConverter(JsonStringConverter)
    @JsonElementType(String)
    public CertifierReport!: string[]; // link in EPUB3

    // dcterms:conformsTo
    @JsonProperty("conformsTo")
    @JsonConverter(JsonStringConverter)
    @JsonElementType(String)
    public ConformsTo!: string[]; // link in EPUB3
    // http://www.idpf.org/epub/a11y/accessibility-20170105.html#wcag-a
    // http://www.idpf.org/epub/a11y/accessibility-20170105.html#wcag-aa
    // http://www.idpf.org/epub/a11y/accessibility-20170105.html#wcag-aaa

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
    @JsonProperty(AUTHOR_JSON_PROP)
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Author!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L84
    @JsonProperty(TRANSLATOR_JSON_PROP)
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Translator!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L87
    @JsonProperty(EDITOR_JSON_PROP)
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Editor!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L90
    @JsonProperty(ARTIST_JSON_PROP)
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Artist!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L93
    @JsonProperty(ILLUSTRATOR_JSON_PROP)
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Illustrator!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L96
    @JsonProperty(LETTERER_JSON_PROP)
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Letterer!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L99
    @JsonProperty(PENCILER_JSON_PROP)
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Penciler!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L102
    @JsonProperty(COLORIST_JSON_PROP)
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Colorist!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L105
    @JsonProperty(INKER_JSON_PROP)
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Inker!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L108
    @JsonProperty(NARRATOR_JSON_PROP)
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Narrator!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L111
    @JsonProperty(CONTRIBUTOR_JSON_PROP)
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Contributor!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L114
    @JsonProperty(PUBLISHER_JSON_PROP)
    @JsonElementType(Contributor)
    @JsonConverter(JsonContributorConverter)
    public Publisher!: Contributor[];

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L117
    @JsonProperty(IMPRINT_JSON_PROP)
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
    public Direction2!: string;
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
    // see DirectionEnum

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json#L140
    @JsonProperty(BELONGSTO_JSON_PROP)
    public BelongsTo2!: BelongsTo;
    @JsonProperty(BELONGS_TO_JSON_PROP)
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

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/917c83e798e3eda42b3e9d0dc92f0fef31b16211/schema/extensions/epub/metadata.schema.json#L7
    @JsonProperty(RENDITION_JSON_PROP)
    public Rendition!: Properties;

    // TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/14
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json
    @JsonProperty("source")
    public Source!: string;

    // TODO: not in JSON Schema?? https://github.com/readium/webpub-manifest/issues/13
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json
    @JsonProperty(SUBJECT_JSON_PROP)
    @JsonConverter(JsonSubjectConverter)
    @JsonElementType(Subject)
    public Subject!: Subject[];

    // see parseAdditionalJSON()
    // e.g. https://libraryregistry.librarysimplified.org/libraries
    // @JsonProperty("updated")
    // public Updated!: Date;
    // @JsonProperty("id")
    // public Id!: string;

    // TODO: not in JSON Schema??
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/webpub-manifest/blob/0976680e25852b8a4c4802a052ba750ab3e89284/schema/metadata.schema.json
    // @JsonProperty("epub-type")
    // @JsonElementType(String)
    // public EpubType!: string[];

    // BEGIN IWithAdditionalJSON
    public AdditionalJSON!: JsonMap;
    // public get SupportedKeys() {
    //     return MetadataSupportedKeys;
    // }

    // public parseAdditionalJSON(json: JsonMap) {
    //     parseAdditionalJSON(this, json);

    //     if (this.BelongsTo1) {
    //         this.BelongsTo1.parseAdditionalJSON(json[BELONGS_TO_JSON_PROP] as JsonMap); // belongs_to
    //     }
    //     if (this.BelongsTo2) {
    //         this.BelongsTo2.parseAdditionalJSON(json[BELONGSTO_JSON_PROP] as JsonMap); // belongsTo
    //     }
    //     if (this.Rendition) {
    //         this.Rendition.parseAdditionalJSON(json[RENDITION_JSON_PROP] as JsonMap);
    //     }
    //     if (this.Subject) {
    //         this.Subject.forEach((subject, i) => {
    //             subject.parseAdditionalJSON((json[SUBJECT_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Author) {
    //         this.Author.forEach((cont, i) => {
    //             cont.parseAdditionalJSON((json[AUTHOR_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Translator) {
    //         this.Translator.forEach((cont, i) => {
    //             cont.parseAdditionalJSON((json[TRANSLATOR_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Editor) {
    //         this.Editor.forEach((cont, i) => {
    //             cont.parseAdditionalJSON((json[EDITOR_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Artist) {
    //         this.Artist.forEach((cont, i) => {
    //             cont.parseAdditionalJSON((json[ARTIST_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Illustrator) {
    //         this.Illustrator.forEach((cont, i) => {
    //             cont.parseAdditionalJSON((json[ILLUSTRATOR_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Letterer) {
    //         this.Letterer.forEach((cont, i) => {
    //             cont.parseAdditionalJSON((json[LETTERER_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Penciler) {
    //         this.Penciler.forEach((cont, i) => {
    //             cont.parseAdditionalJSON((json[PENCILER_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Colorist) {
    //         this.Colorist.forEach((cont, i) => {
    //             cont.parseAdditionalJSON((json[COLORIST_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Inker) {
    //         this.Inker.forEach((cont, i) => {
    //             cont.parseAdditionalJSON((json[INKER_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Narrator) {
    //         this.Narrator.forEach((cont, i) => {
    //             cont.parseAdditionalJSON((json[NARRATOR_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Contributor) {
    //         this.Contributor.forEach((cont, i) => {
    //             cont.parseAdditionalJSON((json[CONTRIBUTOR_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Publisher) {
    //         this.Publisher.forEach((cont, i) => {
    //             cont.parseAdditionalJSON((json[PUBLISHER_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Imprint) {
    //         this.Imprint.forEach((cont, i) => {
    //             cont.parseAdditionalJSON((json[IMPRINT_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    // }
    // public generateAdditionalJSON(json: JsonMap) {
    //     generateAdditionalJSON(this, json);

    //     if (this.Rendition) {
    //         this.Rendition.generateAdditionalJSON(json[RENDITION_JSON_PROP] as JsonMap);
    //     }
    //     if (this.Subject) {
    //         this.Subject.forEach((subject, i) => {
    //             subject.generateAdditionalJSON((json[SUBJECT_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Author) {
    //         this.Author.forEach((cont, i) => {
    //             cont.generateAdditionalJSON((json[AUTHOR_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Translator) {
    //         this.Translator.forEach((cont, i) => {
    //             cont.generateAdditionalJSON((json[TRANSLATOR_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Editor) {
    //         this.Editor.forEach((cont, i) => {
    //             cont.generateAdditionalJSON((json[EDITOR_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Artist) {
    //         this.Artist.forEach((cont, i) => {
    //             cont.generateAdditionalJSON((json[ARTIST_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Illustrator) {
    //         this.Illustrator.forEach((cont, i) => {
    //             cont.generateAdditionalJSON((json[ILLUSTRATOR_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Letterer) {
    //         this.Letterer.forEach((cont, i) => {
    //             cont.generateAdditionalJSON((json[LETTERER_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Penciler) {
    //         this.Penciler.forEach((cont, i) => {
    //             cont.generateAdditionalJSON((json[PENCILER_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Colorist) {
    //         this.Colorist.forEach((cont, i) => {
    //             cont.generateAdditionalJSON((json[COLORIST_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Inker) {
    //         this.Inker.forEach((cont, i) => {
    //             cont.generateAdditionalJSON((json[INKER_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Narrator) {
    //         this.Narrator.forEach((cont, i) => {
    //             cont.generateAdditionalJSON((json[NARRATOR_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Contributor) {
    //         this.Contributor.forEach((cont, i) => {
    //             cont.generateAdditionalJSON((json[CONTRIBUTOR_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Publisher) {
    //         this.Publisher.forEach((cont, i) => {
    //             cont.generateAdditionalJSON((json[PUBLISHER_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    //     if (this.Imprint) {
    //         this.Imprint.forEach((cont, i) => {
    //             cont.generateAdditionalJSON((json[IMPRINT_JSON_PROP] as JsonArray)[i] as JsonMap);
    //         });
    //     }
    // }
    // END IWithAdditionalJSON

    // tslint:disable-next-line: max-line-length
    // node -e 'const parse = (AccessModeSufficient) => console.log(JSON.stringify(AccessModeSufficient.map((ams) => ams.split(",").map((token) => token.trim()).filter((token) => token.length).reduce((pv, cv) => pv.includes(cv) ? pv : pv.concat(cv), [])).filter((arr) => arr.length))); parse([]); parse([""]); parse(["visual,textual"]); parse(["  visual   , textual  "]); parse(["  visual   , textual , visual "]); parse(["  visual   , textual , visual ", "auditory, auditory"]); parse(["", "  visual   , textual ,, visual ", "auditory, auditory,,"]);'
    // ====>
    // []
    // []
    // [["visual","textual"]]
    // [["visual","textual"]]
    // [["visual","textual"]]
    // [["visual","textual"],["auditory"]]
    // [["visual","textual"],["auditory"]]
    public ParseAccessModeSufficient(): (string[])[] {
        if (this.AccessModeSufficient) {
            return this.AccessModeSufficient.map((ams) =>
                ams.split(",").
                map((token) => token.trim()).
                filter((token) => token.length).
                reduce((pv, cv) => pv.includes(cv) ? pv : pv.concat(cv), [] as string[]).
                filter((arr) => arr.length),
            );
        }
        return [];
    }

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
