# dart-import

[![CI Status](https://img.shields.io/github/actions/workflow/status/bluefireteam/vscode-dart-import/CI.yaml?branch=master&style=flat-square)](https://github.com/bluefireteam/vscode-dart-import/actions/workflows/CI.yaml)
[![Latest Release](https://img.shields.io/github/v/release/bluefireteam/vscode-dart-import?style=flat-square)](https://github.com/bluefireteam/vscode-dart-import/releases)
[![VS Code Marketplace](https://vsmarketplacebadges.dev/version-short/luanpotter.dart-import.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=luanpotter.dart-import)

A simple plugin for VSCode to change all Dart/Flutter imports to relative format.

Find it on the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=luanpotter.dart-import).

## Features

Run one of these from the Command Palette, or bind them as desired. Imports from a file's own package become relative, then imports are sorted (this needs the Dart extension) and the file is saved.

- "Fix Imports" (`dart-import.fix`) fixes the current file.
- "Fix All Imports" (`dart-import.fix-all`) fixes every package in the workspace, with a progress notification you can cancel. Large repositories take a while, as each file goes through the Dart analyzer.

Set `dartImport.fixOnSave` to also fix a file whenever you save it.

Monorepos work out of the box: each file uses the nearest `pubspec.yaml` above it. Only files inside a package's `lib` folder have their imports changed. Generated files (see `dartImport.excludeGeneratedFiles`) are skipped by "Fix All Imports" and fix on save.

## Contribute

Any help is appreciated! Comment, suggestions, issues, PR's! Give us a star to help!

## Setup

This is a regular vscode extension setup. You can use the scripts in the `package.json` file to test.

To setup, run `npm i` to download dependencies.

Then, you can run `npm test` to run the tests, make sure they are passing.

To test in your machine, run `npm run package` to create a new VSIX file, and then use vscode's built in command `Extensions: Install from VSIX...` (from command palette) to load your version.

In order to deploy, run `npm run publish`. If your PAT token is expired, go to [this page](https://your_username.visualstudio.com/_usersSettings/tokens) to get a new one.
