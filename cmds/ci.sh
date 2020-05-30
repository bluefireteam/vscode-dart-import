#!/bin/bash -e

npm run lint
./cmds/build.sh
npm run test
