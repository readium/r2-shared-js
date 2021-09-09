// https://github.com/avajs/ava/issues/2332#issuecomment-570442898
// https://github.com/avajs/ava/issues/2212
// https://github.com/avajs/ava/pull/2308

// declare const observableSymbol: symbol;
// export default observableSymbol;

// declare global {
//   export interface SymbolConstructor {
//     readonly observable: symbol;
//   }
// }

declare interface SymbolConstructor {
    readonly observable: symbol;
}
