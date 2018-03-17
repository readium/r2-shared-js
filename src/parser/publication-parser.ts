import * as fs from "fs";
import * as path from "path";

import { Publication } from "@models/publication";
import { CbzParsePromise } from "@parser/cbz";
import { EpubParsePromise } from "@parser/epub";

export async function PublicationParsePromise(filePath: string): Promise<Publication> {

    const fileName = path.basename(filePath);
    const ext = path.extname(fileName).toLowerCase();
    const isEPUB = /\.epub[3]?$/.test(ext) || fs.existsSync(path.join(filePath, "META-INF", "container.xml"));
    return isEPUB ?
        EpubParsePromise(filePath) :
        CbzParsePromise(filePath);
}
