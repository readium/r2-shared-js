import * as path from "path";

import { BelongsTo } from "@models/metadata-belongsto";
import { Contributor } from "@models/metadata-contributor";
import { IStringMap } from "@models/metadata-multilang";
import { setLcpNativePluginPath } from "@r2-lcp-js/parser/epub/lcp";
import { ExecutionContext } from "ava";
import test from "ava";
import { JSON as TAJSON } from "ta-json-x";

import {
    initGlobalConverters_GENERIC,
    initGlobalConverters_SHARED,
} from "../src/init-globals";
import {
    checkType,
    checkType_Array,
    checkType_Number,
    checkType_Object,
    checkType_String,
    inspect,
    logJSON,
} from "./helpers";

initGlobalConverters_SHARED();
initGlobalConverters_GENERIC();

setLcpNativePluginPath(path.join(process.cwd(), "LCP", "lcp.node"));

// ==========================

const colName1 = "theName1";
const colID1 = "theID1";
const colPOS1 = 1;
const col1 = new Contributor();
col1.Name = colName1;
col1.Identifier = colID1;
col1.Position = colPOS1;
const colROLE1 = ["theRole1-A", "theRole1-B"];
col1.Role = colROLE1;

const colName2Lang = "en";
const colName2Val = "theName2";
const colName2 = {} as IStringMap;
colName2[colName2Lang] = colName2Val;
const colID2 = "theID2";
const col2 = new Contributor();
col2.Name = colName2;
col2.Identifier = colID2;
const colROLE2 = "theRole2";
col2.Role = [colROLE2];

const checkCol1 = (t: ExecutionContext, obj: any) => {

    checkType_Object(t, obj);

    checkType_String(t, obj.name);
    t.is(obj.name, colName1);

    checkType_String(t, obj.identifier);
    t.is(obj.identifier, colID1);

    checkType_Number(t, obj.position);
    t.is(obj.position, colPOS1);

    checkType_Array(t, obj.role);
    t.is(obj.role.length, colROLE1.length);
    t.is(obj.role[0], colROLE1[0]);
    t.is(obj.role[1], colROLE1[1]);
};

const checkCol2 = (t: ExecutionContext, obj: any) => {

    checkType_Object(t, obj);

    checkType_Object(t, obj.name);
    checkType_String(t, obj.name[colName2Lang]);
    t.is(obj.name[colName2Lang], colName2Val);

    checkType_String(t, obj.identifier);
    t.is(obj.identifier, colID2);

    checkType_String(t, obj.role);
    t.is(obj.role, colROLE2);
};

const checkCol1Name = (t: ExecutionContext, obj: string | IStringMap) => {

    checkType_String(t, obj);
    t.is(obj, colName1);
};

const checkCol1_ = (t: ExecutionContext, obj: Contributor) => {

    checkType(t, obj, Contributor);

    checkCol1Name(t, obj.Name);

    checkType_String(t, obj.Identifier);
    t.is(obj.Identifier, colID1);

    checkType_Number(t, obj.Position);
    t.is(obj.Position, colPOS1);

    checkType_Array(t, obj.Role);
    t.is(obj.Role.length, 2);
    t.is(obj.Role[0], colROLE1[0]);
    t.is(obj.Role[1], colROLE1[1]);
};

const checkCol2Name = (t: ExecutionContext, obj: string | IStringMap) => {

    checkType_Object(t, obj);
    t.is((obj as IStringMap)[colName2Lang], colName2Val);
};

const checkCol2_ = (t: ExecutionContext, obj: Contributor) => {

    checkType(t, obj, Contributor);

    checkCol2Name(t, obj.Name);

    checkType_String(t, obj.Identifier);
    t.is(obj.Identifier, colID2);

    checkType_Array(t, obj.Role);
    t.is(obj.Role.length, 1);
    t.is(obj.Role[0], colROLE2);
};

// ==========================

test("JSON SERIALIZE: BelongsTo.Series => Contributor[]", (t) => {

    const b = new BelongsTo();
    b.Series = [];
    b.Series.push(col1);
    b.Series.push(col2);
    inspect(b);

    const json = TAJSON.serialize(b);
    logJSON(json);

    checkType_Array(t, json.series);
    t.is(json.series.length, 2);

    checkCol1(t, json.series[0]);
    checkCol2(t, json.series[1]);
});

test("JSON SERIALIZE: BelongsTo.Series => Contributor[1] collapse-array", (t) => {

    const b = new BelongsTo();
    b.Series = [col1];
    inspect(b);

    const json = TAJSON.serialize(b);
    // // (normalizes single-item array to the item value itself)
    // traverseJsonObjects(json,
    //     (obj, parent, keyInParent) => {
    //         if (parent && obj instanceof Array && obj.length === 1) {
    //             parent[keyInParent] = obj[0];
    //         }
    //     });
    logJSON(json);

    checkCol1(t, json.series);
});

test("JSON DESERIALIZE: BelongsTo.Series => Contributor[]", (t) => {

    const json: any = {};
    json.series = [
        { name: colName1, identifier: colID1, position: colPOS1, role: colROLE1 },
        { name: colName2, identifier: colID2, role: colROLE2 },
    ];
    logJSON(json);

    const b: BelongsTo = TAJSON.deserialize<BelongsTo>(json, BelongsTo);
    inspect(b);

    checkType_Array(t, b.Series);
    t.is(b.Series.length, 2);

    checkCol1_(t, b.Series[0]);
    checkCol2_(t, b.Series[1]);
});

test("JSON DESERIALIZE: BelongsTo.Series => Contributor[1]", (t) => {

    const json: any = {};
    json.series = [
        { name: colName1, identifier: colID1, position: colPOS1, role: colROLE1 },
    ];
    logJSON(json);

    const b: BelongsTo = TAJSON.deserialize<BelongsTo>(json, BelongsTo);
    inspect(b);

    checkType_Array(t, b.Series);
    t.is(b.Series.length, 1);

    checkCol1_(t, b.Series[0]);
});

test("JSON DESERIALIZE: BelongsTo.Series => Contributor", (t) => {

    const json: any = {};
    json.series = { name: colName1, identifier: colID1, position: colPOS1, role: colROLE1 };
    logJSON(json);

    const b: BelongsTo = TAJSON.deserialize<BelongsTo>(json, BelongsTo);
    inspect(b);

    checkType_Array(t, b.Series);
    t.is(b.Series.length, 1);

    checkCol1_(t, b.Series[0]);
});

test("JSON DESERIALIZE: BelongsTo.Series => Contributor NAME []", (t) => {

    const json: any = {};
    json.series = [colName1, colName2];
    logJSON(json);

    const b: BelongsTo = TAJSON.deserialize<BelongsTo>(json, BelongsTo);
    inspect(b);

    checkType_Array(t, b.Series);
    t.is(b.Series.length, 2);

    checkType(t, b.Series[0], Contributor);
    checkCol1Name(t, b.Series[0].Name);

    checkType(t, b.Series[1], Contributor);
    checkCol2Name(t, b.Series[1].Name);
});

test("JSON DESERIALIZE: BelongsTo.Series => Contributor NAME [1] A", (t) => {

    const json: any = {};
    json.series = [colName1];
    logJSON(json);

    const b: BelongsTo = TAJSON.deserialize<BelongsTo>(json, BelongsTo);
    inspect(b);

    checkType_Array(t, b.Series);
    t.is(b.Series.length, 1);

    checkType(t, b.Series[0], Contributor);
    checkCol1Name(t, b.Series[0].Name);
});

test("JSON DESERIALIZE: BelongsTo.Series => Contributor NAME [1] B", (t) => {

    const json: any = {};
    json.series = [colName2];
    logJSON(json);

    const b: BelongsTo = TAJSON.deserialize<BelongsTo>(json, BelongsTo);
    inspect(b);

    checkType_Array(t, b.Series);
    t.is(b.Series.length, 1);

    checkType(t, b.Series[0], Contributor);
    checkCol2Name(t, b.Series[0].Name);
});

test("JSON DESERIALIZE: BelongsTo.Series => Contributor NAME A", (t) => {

    const json: any = {};
    json.series = colName1;
    logJSON(json);

    const b: BelongsTo = TAJSON.deserialize<BelongsTo>(json, BelongsTo);
    inspect(b);

    checkType_Array(t, b.Series);
    t.is(b.Series.length, 1);

    checkType(t, b.Series[0], Contributor);
    checkCol1Name(t, b.Series[0].Name);
});

test("JSON DESERIALIZE: BelongsTo.Series => Contributor NAME B", (t) => {

    const json: any = {};
    json.series = colName2;
    logJSON(json);

    const b: BelongsTo = TAJSON.deserialize<BelongsTo>(json, BelongsTo);
    inspect(b);

    checkType_Array(t, b.Series);
    t.is(b.Series.length, 1);

    checkType(t, b.Series[0], Contributor);
    checkCol2Name(t, b.Series[0].Name);
});
