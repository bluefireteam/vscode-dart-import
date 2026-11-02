# Change Log

## [0.4.0] - 2026-11-01
- Support monorepos and Dart workspaces: each file now uses the nearest `pubspec.yaml` above it (thanks, @BIOMAS-Devel)
- "Fix All Imports" now covers every package in the workspace, sorts and saves each file, opens no editors, and shows progress you can cancel
- Fix on save now works without running a command first, only runs on Dart files, skips generated files and no longer changes the active editor
- "Fix Imports" now saves the file after fixing it
- Files outside of `lib`, such as tests, now keep their imports instead of showing an error
- Comments and `library` directives above or between imports no longer stop imports from being fixed (thanks, @iliYF)
- Report when imports could not be sorted
- Updating dependencies

## [0.3.1] - 2020-10-11
- Add config options for now showing messages and running on save
- Standardizing `./` for relative imports

## [0.3.0] - 2020-09-20
- Add the option to fix all imports

## [0.1.6] - 2019-12-24
- Allows for folders with multiple projects (thanks, @shroudedcode)

## [0.1.5] - 2019-10-27
- Refactored code to make 100% of the logic testable and decoupled with vscode code (main.ts file vs extension.ts file)
- Added support for import aliases (as, show, hide)

## [0.1.4] - 2019-10-27
- Allows this to work on both unix and windows systems (thanks, @ElZombieIsra)
- Updating dependencies

## [0.1.3] - 2019-08-11
- Allowed for fixing imports in multi-project workspaces (thanks, @shyndman)
- Updating dependencies

## [0.1.2] - 2019-02-12
- Better error messages.

## [0.1.1] - 2019-02-11
- Fix regex, also update deps.

## [0.1.0] - 2018-07-12
- Fix for files directly in the lib/ folder.

## [0.0.1] - 2018-07-02
- Initial release, "Fix Imports" feature.
