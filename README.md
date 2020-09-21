# dart-import

[![CI Status](https://raster.shields.io/github/workflow/status/luanpotter/vscode-dart-import/CI/master)](https://github.com/luanpotter/vscode-dart-import/actions?query=workflow%3ACI)
[![Latest Release](https://raster.shields.io/github/v/release/luanpotter/vscode-dart-import)](https://github.com/luanpotter/vscode-dart-import/releases)

A simple plugin for VSCode to change all Dart/Flutter imports to relative format.

Find it on the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=luanpotter.dart-import).

## Features

Run the command "Fix Imports" from the Command Palette; all imports from your own package will become relative. Also, the "Organize Import" command will be called.

The only command added (so far) is "dart-import.fix"; you can bind it as desired.

## Contribute

Any help is appreciated! Comment, suggestions, issues, PR's! Give us a star to help!

## Setup

This is a regular vscode extension setup. You can use the scripts in the `package.json` file to test.

To setup, run `npm i` to download dependencies.

Then, you can run `npm test` to run the tests, make sure they are passing.

To test in your machine, run `npm run package` to create a new VSIX file, and then use vscode's built in command `Extensions: Install from VSIX...` (from command palette) to load your version.

In order to deploy, run `npm run deploy`. If your PAT token is expired, go to [this page](https://your_username.visualstudio.com/_usersSettings/tokens) to get a new one.
