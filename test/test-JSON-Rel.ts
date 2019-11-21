import test from "ava";
import * as path from "path";

import { Link } from "@models/publication-link";
import { setLcpNativePluginPath } from "@r2-lcp-js/parser/epub/lcp";
import { JsonArray, TaJsonDeserialize, TaJsonSerialize } from "@r2-lcp-js/serializable";

import { initGlobalConverters_GENERIC, initGlobalConverters_SHARED } from "../src/init-globals";
import { checkType_Array, checkType_String, inspect, logJSON } from "./helpers";

initGlobalConverters_SHARED();
initGlobalConverters_GENERIC();

setLcpNativePluginPath(path.join(process.cwd(), "LCP", "lcp.node"));

// ==========================

const relStr1 = "rel1";
const relStr2 = "rel2";

// ==========================

test("JSON SERIALIZE: Publication Link.Rel => string[]", (t) => {

    const link = new Link();
    link.AddRel(relStr1);
    link.AddRel(relStr2);
    inspect(link);

    const json = TaJsonSerialize(link);
    logJSON(json);

    checkType_Array(t, json.rel);
    const arr = json.rel as JsonArray;
    t.is(arr.length, 2);

    checkType_String(t, arr[0]);
    t.is(arr[0], relStr1);

    checkType_String(t, arr[1]);
    t.is(arr[1], relStr2);
});

test("JSON SERIALIZE: Publication Link.Rel => string", (t) => {

    const link = new Link();
    link.AddRel(relStr1);
    inspect(link);

    const json = TaJsonSerialize(link);
    logJSON(json);

    checkType_String(t, json.rel);
    t.is(json.rel, relStr1);
});

test("JSON DESERIALIZE: Publication Link.Rel => string[]", (t) => {

    const json: any = {};
    json.rel = [relStr1, relStr2];
    logJSON(json);

    const link: Link = TaJsonDeserialize<Link>(json, Link);
    inspect(link);

    checkType_Array(t, link.Rel);
    t.is(link.Rel.length, 2);

    checkType_String(t, link.Rel[0]);
    t.is(link.Rel[0], relStr1);

    checkType_String(t, link.Rel[1]);
    t.is(link.Rel[1], relStr2);
});

test("JSON DESERIALIZE: Publication Link.Rel => string[1]", (t) => {

    const json: any = {};
    json.rel = [relStr1];
    logJSON(json);

    const link: Link = TaJsonDeserialize<Link>(json, Link);
    inspect(link);

    checkType_Array(t, link.Rel);
    t.is(link.Rel.length, 1);

    checkType_String(t, link.Rel[0]);
    t.is(link.Rel[0], relStr1);
});

test("JSON DESERIALIZE: Publication Link.Rel => string", (t) => {

    const json: any = {};
    json.rel = relStr1;
    logJSON(json);

    const link: Link = TaJsonDeserialize<Link>(json, Link);
    inspect(link);

    checkType_Array(t, link.Rel);
    t.is(link.Rel.length, 1);

    checkType_String(t, link.Rel[0]);
    t.is(link.Rel[0], relStr1);
});

// ==========================
