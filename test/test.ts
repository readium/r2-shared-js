import test from "ava";
import * as debug_ from "debug";
import * as filehound from "filehound";
import * as jsonDiff from "json-diff";
import * as path from "path";

import { timeStrToSeconds } from "@models/media-overlay";
import { Publication } from "@models/publication";
import { PublicationParsePromise } from "@parser/publication-parser";
import { TaJsonDeserialize, TaJsonSerialize } from "@r2-lcp-js/serializable";

import { initGlobalConverters_GENERIC, initGlobalConverters_SHARED } from "../src/init-globals";

initGlobalConverters_SHARED();
initGlobalConverters_GENERIC();

const debug = debug_("r2:shared#test");

// ==========================

async function fn() {
    return Promise.resolve("foo");
}
test("dummy async test", async (t) => {
    debug("test ASYNC");
    t.is(await fn(), "foo");
});

// ==========================

test("SMIL clock values", (t) => {
    t.plan(16);

    t.is(timeStrToSeconds("12.345"), 12.345);
    t.is(timeStrToSeconds("2345ms"), 2.345);
    t.is(timeStrToSeconds("345ms"), 0.345);
    t.is(timeStrToSeconds("7.75h"), 27900);
    t.is(timeStrToSeconds("76.2s"), 76.2);
    t.is(timeStrToSeconds("00:56.78"), 56.78);
    t.is(timeStrToSeconds("09:58"), 598);
    t.is(timeStrToSeconds("09.5:58"), 628);
    t.is(timeStrToSeconds("0:00:04"), 4);
    t.is(timeStrToSeconds("0:05:01.2"), 301.2);
    t.is(timeStrToSeconds("124:59:36"), 449976);
    t.is(timeStrToSeconds("5:34:31.396"), 20071.396);
    t.is(timeStrToSeconds("5:34.5:31.396"), 20101.396);

    t.is(timeStrToSeconds("7.5z"), 7.5);
    t.is(timeStrToSeconds("4:5:34:31.396"), 0);
    t.is(timeStrToSeconds(""), 0);
});

// ==========================

async function delay(okay: boolean): Promise<boolean> {
    return new Promise((resolve, _reject) => {
        setTimeout(() => {
            resolve(okay);
        }, 1000);
    });
}

test("EPUB parsing (de)serialize roundtrip", async (t) => {

    const dirPath = path.join(process.cwd(), "misc/epubs/");

    const filePaths: string[] = await filehound.create()
        .discard("node_modules")
        .depth(5)
        .paths(dirPath)
        .ext([".epub", ".epub3"])
        .find();

    for (const filePath of filePaths) {
        debug("------------------------");
        debug(filePath);
        // debug("------------------------");

        let pub: Publication;
        try {
            pub = await PublicationParsePromise(filePath);
        } catch (err) {
            console.log(err);
            continue;
        }
        const publicationJson1 = TaJsonSerialize(pub);
        const publication = TaJsonDeserialize<Publication>(publicationJson1, Publication);
        const publicationJson2 = TaJsonSerialize(publication);

        const str1 = JSON.stringify(publicationJson1, null, 2);
        const str2 = JSON.stringify(publicationJson2, null, 2);

        if (str1 !== str2) {
            process.stdout.write("###########################\n");
            process.stdout.write("###########################\n");
            process.stdout.write("#### JSON DIFF\n");
            process.stdout.write(jsonDiff.diffString(publicationJson1, publicationJson2) + "\n");
            process.stdout.write("###########################\n");
            process.stdout.write("###########################\n");

            t.true(await delay(false));
            return;
        }
    }

    t.true(await delay(true));
});
