import "reflect-metadata";

import * as util from "util";

import * as debug_ from "debug";
import { JsonProperty } from "ta-json";
import { getDefinition } from "ta-json/classes/object-definition";

const debug = debug_("r2:JsonPropertyEx");

function inspect(obj: any) {
    // breakLength: 100  maxArrayLength: undefined
    console.log(util.inspect(obj,
        { showHidden: false, depth: 1000, colors: true, customInspect: true }));
}

export function JsonPropertyEx(propertyName?: string): (target: any, key: string) => void {

    debug("JsonPropertyEx");

    console.log("propertyName");
    console.log(propertyName);

    return (target: any, key: string): void => {

        console.log("target");
        inspect(target);

        console.log("key");
        console.log(key);

        console.log("Reflect.getMetadata('design:type', target, key)");
        const objectType = Reflect.getMetadata("design:type", target, key);
        inspect(objectType);
        console.log(objectType.name);

        console.log("target.constructor");
        inspect(target.constructor);

        console.log("getDefinition(target.constructor)");
        const objDef = getDefinition(target.constructor);
        inspect(objDef);

        console.log("objDef.getProperty(key)");
        const property = objDef.getProperty(key);
        inspect(property);

        return JsonProperty(propertyName)(target, key);
    };
}
