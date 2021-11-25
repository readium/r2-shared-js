import test from "ava";
import * as path from "path";

import { Publication } from "@models/publication";
import { setLcpNativePluginPath } from "@r2-lcp-js/parser/epub/lcp";
import { JsonArray, TaJsonDeserialize, TaJsonSerialize } from "@r2-lcp-js/serializable";

import { initGlobalConverters_GENERIC, initGlobalConverters_SHARED } from "../src/init-globals";
import { checkType_Array, checkType_String, inspect, logJSON } from "./helpers";

initGlobalConverters_SHARED();
initGlobalConverters_GENERIC();

setLcpNativePluginPath(path.join(process.cwd(), "LCP", "lcp.node"));

// ==========================

const contextStr1 = "http://context1";
const contextStr2 = "http://context2";

// ==========================

test("JSON SERIALIZE: Publication.Context => string[]", (t) => {

    const pub = new Publication();
    pub.Context = [];
    pub.Context.push(contextStr1);
    pub.Context.push(contextStr2);
    inspect(pub);

    const json = TaJsonSerialize(pub);
    logJSON(json);

    checkType_Array(t, json["@context"]);
    const arr = json["@context"] as JsonArray;
    t.is(arr.length, 2);

    checkType_String(t, arr[0]);
    t.is(arr[0], contextStr1);

    checkType_String(t, arr[1]);
    t.is(arr[1], contextStr2);
});

// see IPropertyConverter.collapseArrayWithSingleItem()
//
// test("JSON SERIALIZE: Publication.Context => string[1] NO collapse-array", (t) => {

//     const pub = new Publication();
//     pub.Context = [contextStr1];
//     inspect(pub);

//     const json = TaJsonSerialize(pub);
//     // // (normalizes single-item array to the item value itself)
//     // traverseJsonObjects(json,
//     //     (obj, parent, keyInParent) => {
//     //         if (parent && obj instanceof Array && obj.length === 1) {
//     //             parent[keyInParent] = obj[0];
//     //         }
//     //     });
//     logJSON(json);

//     checkType_Array(t, json["@context"]);
//     t.is(json["@context"].length, 1);
//     checkType_String(t, json["@context"][0]);
//     t.is(json["@context"][0], contextStr1);
// });

test("JSON SERIALIZE: Publication.Context => string[1] collapse-array", (t) => {

    const pub = new Publication();
    pub.Context = [contextStr1];
    inspect(pub);

    const json = TaJsonSerialize(pub);
    // // (normalizes single-item array to the item value itself)
    // traverseJsonObjects(json,
    //     (obj, parent, keyInParent) => {
    //         if (parent && obj instanceof Array && obj.length === 1) {
    //             parent[keyInParent] = obj[0];
    //         }
    //     });
    logJSON(json);

    checkType_String(t, json["@context"]);
    t.is(json["@context"], contextStr1);
});

test("JSON DESERIALIZE: Publication.Context => string[]", (t) => {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = {};
    json["@context"] = [contextStr1, contextStr2];
    logJSON(json);

    const pub: Publication = TaJsonDeserialize<Publication>(json, Publication);
    inspect(pub);

    checkType_Array(t, pub.Context);
    t.is(pub.Context.length, 2);

    checkType_String(t, pub.Context[0]);
    t.is(pub.Context[0], contextStr1);

    checkType_String(t, pub.Context[1]);
    t.is(pub.Context[1], contextStr2);
});

test("JSON DESERIALIZE: Publication.Context => string[1]", (t) => {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = {};
    json["@context"] = [contextStr1];
    logJSON(json);

    const pub: Publication = TaJsonDeserialize<Publication>(json, Publication);
    inspect(pub);

    checkType_Array(t, pub.Context);
    t.is(pub.Context.length, 1);

    checkType_String(t, pub.Context[0]);
    t.is(pub.Context[0], contextStr1);
});

test("JSON DESERIALIZE: Publication.Context => string", (t) => {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = {};
    json["@context"] = contextStr1;
    logJSON(json);

    const pub: Publication = TaJsonDeserialize<Publication>(json, Publication);
    inspect(pub);

    checkType_Array(t, pub.Context);
    t.is(pub.Context.length, 1);

    checkType_String(t, pub.Context[0]);
    t.is(pub.Context[0], contextStr1);
});
