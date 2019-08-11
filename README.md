# dart-import

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

To test in your machine, run `npm run build:vsix` to create a new VSIX file, and then use vscode's built in command `Extensions: Install from VSIX...` (from command palette) to load your version.
