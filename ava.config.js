
console.log(process.env.TYPESCRIPT);
console.log(process.env.DEBUG);
const ts = typeof process.env.TYPESCRIPT !== "undefined";
console.log(`TypeScript: ` + ts);
const conf = {
    "files": [
        `${ts ? "./test/**/test*.ts" : "./dist/es8-es2017/test/**/test*.js"}`,
        `${ts ? "./test/**/helpers*.ts" : "!./dist/es8-es2017/test/**/helpers*.js"}`,
        `${ts ? "!./test/**/@types" : "!./dist/es8-es2017/test/**/@types"}`
    ],
    "helpers": [
        `${ts ? "./test/**/helpers*.ts" : "!./dist/es8-es2017/test/**/helpers*.js"}`,
    ],
    "sources": [
        "./src/**/*"
    ],
    "match": [
        "*"
    ],
    "cache": false,
    "concurrency": 1,
    "failWithoutAssertions": false,
    "babel": false,
    "compileEnhancements": false,
    "verbose": true,
    "fail-fast": true,
    "failFast": true,
    "color": true,
    "serial": true,
    "no-cache": false,
    "noCache": false,
    "extensions": [
        "js",
        "ts"
    ]
};
if (ts) {
    conf.environmentVariables = {
        "TS_NODE_CACHE": "true",
        "TS_NODE_CACHE_DIRECTORY": "./ava-ts/",
        "TS_NODE_PRETTY": "true",
        "TS_NODE_COMPILER_OPTIONS": "{\"typeRoots\" : [\"./node_modules/@types\", \"./test/@types\"]}"
    };
    conf.require = [
        "ts-node/register",
        "tsconfig-paths/register"
    ];
}
export default conf;
