import { Publication } from "@models/publication";
import { Link } from "@models/publication-link";
import { LCP } from "@r2-lcp-js/parser/epub/lcp";
import { supports as supports_, transformStream as transformStream_ } from "@r2-lcp-js/transform/transformer-lcp";
import { IStreamAndLength } from "@utils/zip/zip";

import { ITransformer } from "./transformer";

// import * as debug_ from "debug";
// const debug = debug_("r2:transformer:lcp");
// const debugx = debug_("r2:transformer:stream:lcp");

export class TransformerLCP implements ITransformer {

    public supports(publication: Publication, link: Link): boolean {
        return (typeof publication.LCP !== "undefined") &&
            supports_(publication.LCP, link.Href, link.Properties.Encrypted);
    }

    public async transformStream(
        publication: Publication,
        link: Link,
        stream: IStreamAndLength,
        isPartialByteRangeRequest: boolean,
        partialByteBegin: number,
        partialByteEnd: number): Promise<IStreamAndLength> {

        return transformStream_(publication.LCP as LCP, link.Href, link.Properties.Encrypted,
                stream, isPartialByteRangeRequest, partialByteBegin, partialByteEnd);
    }
}
