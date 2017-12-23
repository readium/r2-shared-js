#!/bin/bash
echo "$DEBUG"
PWD=$(pwd)
echo "$PWD"
NODE_DEBUG_INSPECT_PORT=`echo $1 | sed s/debug/inspect/g`
CMD="node $NODE_DEBUG_INSPECT_PORT ./node_modules/ava/profile.js $2"
#--verbose --fail-fast --serial --color
echo "$CMD"
${CMD}
