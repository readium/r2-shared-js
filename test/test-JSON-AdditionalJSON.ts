import test from "ava";
import * as path from "path";

import { Metadata } from "@models/metadata";
import { Publication } from "@models/publication";
import { setLcpNativePluginPath } from "@r2-lcp-js/parser/epub/lcp";
import { JsonArray, JsonMap, TaJsonDeserialize, TaJsonSerialize } from "@r2-lcp-js/serializable";

import { initGlobalConverters_GENERIC, initGlobalConverters_SHARED } from "../src/init-globals";
import {
    checkType_Array, checkType_Number, checkType_Object, checkType_String, inspect, logJSON,
} from "./helpers";

initGlobalConverters_SHARED();
initGlobalConverters_GENERIC();

setLcpNativePluginPath(path.join(process.cwd(), "LCP", "lcp.node"));

// ==========================

const titleStr1 = "str1";
const titleStr2 = "str2";
const titleStr3 = "str3";
const n = 999;

// ==========================

test("JSON SERIALIZE: Metadata.AdditionalJSON", (t) => {

    const md = new Metadata();
    md.Title = titleStr1;
    md.AdditionalJSON = {
        title2: titleStr2,
        tizz: {
            sub1: true,
            sub2: null,
            sub3: {
                inner1: n,
                inner2: [titleStr3, 888, false],
            },
        },
    };
    const pub = new Publication();
    pub.Metadata = md;
    inspect(pub);

    const jsonPub = TaJsonSerialize(pub);
    logJSON(jsonPub);
    const json = jsonPub.metadata as JsonMap;

    checkType_String(t, json.title);
    t.is(json.title, titleStr1);

    if (!json.tizz) {
        t.fail();
        return;
    }
    checkType_Object(t, json.tizz);

    t.is((json.tizz as JsonMap).sub1, true);

    if ((json.tizz as JsonMap).sub2 || (json.tizz as JsonMap).sub2 !== null) {
        t.fail();
        return;
    }

    if (!(json.tizz as JsonMap).sub3) {
        t.fail();
        return;
    }

    checkType_Number(t, ((json.tizz as JsonMap).sub3 as JsonMap).inner1);
    t.is(((json.tizz as JsonMap).sub3 as JsonMap).inner1, n);

    if (!((json.tizz as JsonMap).sub3 as JsonMap).inner2) {
        t.fail();
        return;
    }
    checkType_Array(t, ((json.tizz as JsonMap).sub3 as JsonMap).inner2);
    t.is((((json.tizz as JsonMap).sub3 as JsonMap).inner2 as JsonArray)[0], titleStr3);

    if (!((json.tizz as JsonMap).sub3 as JsonMap).inner1) {
        t.fail();
        return;
    }
});

test("JSON DESERIALIZE: Metadata.AdditionalJSON", (t) => {

    const json: JsonMap = {
        title: titleStr1,
        title2: titleStr2,
        tizz: {
            sub1: true,
            sub2: null,
            sub3: {
                inner1: 999,
                inner2: [titleStr3, 888, false],
            },
        },
    };
    const jsonPub: JsonMap = {
        metadata: json,
    };
    logJSON(jsonPub);

    const pub: Publication = TaJsonDeserialize<Publication>(jsonPub, Publication);
    const md = pub.Metadata;
    // const md: Metadata = TaJsonDeserialize<Metadata>(json, Metadata);
    inspect(md);

    checkType_String(t, md.Title);
    t.is(md.Title, titleStr1);

    if (!md.AdditionalJSON) {
        t.fail();
        return;
    }
    checkType_String(t, md.AdditionalJSON.title2);
    t.is(md.AdditionalJSON.title2, titleStr2);

    if (!md.AdditionalJSON.tizz) {
        t.fail();
        return;
    }
    checkType_Object(t, md.AdditionalJSON.tizz);

    t.is((md.AdditionalJSON.tizz as JsonMap).sub1, true);

    if ((md.AdditionalJSON.tizz as JsonMap).sub2 ||
        (md.AdditionalJSON.tizz as JsonMap).sub2 !== null) {
        t.fail();
        return;
    }

    if (!(md.AdditionalJSON.tizz as JsonMap).sub3) {
        t.fail();
        return;
    }

    checkType_Number(t, ((md.AdditionalJSON.tizz as JsonMap).sub3 as JsonMap).inner1);
    t.is(((md.AdditionalJSON.tizz as JsonMap).sub3 as JsonMap).inner1, n);

    if (!((md.AdditionalJSON.tizz as JsonMap).sub3 as JsonMap).inner2) {
        t.fail();
        return;
    }
    checkType_Array(t, ((md.AdditionalJSON.tizz as JsonMap).sub3 as JsonMap).inner2);
    t.is((((md.AdditionalJSON.tizz as JsonMap).sub3 as JsonMap).inner2 as JsonArray)[0], titleStr3);

    if (!((md.AdditionalJSON.tizz as JsonMap).sub3 as JsonMap).inner1) {
        t.fail();
        return;
    }
});
