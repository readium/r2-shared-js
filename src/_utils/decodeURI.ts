// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

export function tryDecodeURI(url: string | undefined): string | null {
    if (!url) {
        return null;
    }
    try {
        return decodeURI(url);
    } catch (err) { // can occur with "%" literal char inside non-escaped URL
        console.log(url);
        console.log(err);
    }
    return url;
}
