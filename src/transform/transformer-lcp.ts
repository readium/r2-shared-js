import { Publication } from "@models/publication";
import { Link } from "@models/publication-link";
import { transformStream as transformStream_ } from "@r2-lcp-js/transform/transformer-lcp";
import { IStreamAndLength } from "@utils/zip/zip";
import * as debug_ from "debug";

import { ITransformer } from "./transformer";

const debug = debug_("r2:transformer:lcp");
// const debugx = debug_("r2:transformer:stream:lcp");

export class TransformerLCP implements ITransformer {

    public supports(publication: Publication, link: Link): boolean {

        if (!publication.LCP) {
            return false;
        }

        if (!publication.LCP.isReady()) {
            debug("LCP not ready!");
            return false;
        }

        const check = link.Properties.Encrypted.Scheme === "http://readium.org/2014/01/lcp"
            && (link.Properties.Encrypted.Profile === "http://readium.org/lcp/basic-profile" ||
                link.Properties.Encrypted.Profile === "http://readium.org/lcp/profile-1.0")
            && link.Properties.Encrypted.Algorithm === "http://www.w3.org/2001/04/xmlenc#aes256-cbc"
            ;
        if (!check) {
            debug("Incorrect resource LCP fields.");
            debug(link.Properties.Encrypted.Scheme);
            debug(link.Properties.Encrypted.Profile);
            debug(link.Properties.Encrypted.Algorithm);
            return false;
        }

        return true;
    }

    public async transformStream(
        publication: Publication,
        link: Link,
        stream: IStreamAndLength,
        isPartialByteRangeRequest: boolean,
        partialByteBegin: number,
        partialByteEnd: number): Promise<IStreamAndLength> {

        return transformStream_(publication.LCP, link.Href, link.Properties.Encrypted,
            stream, isPartialByteRangeRequest, partialByteBegin, partialByteEnd);
    }
}
