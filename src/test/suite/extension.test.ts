import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const root = () => vscode.workspace.workspaceFolders![0].uri.fsPath;
const onDisk = (file: string) => fs.readFileSync(path.join(root(), file), 'utf8');
const open = (file: string) => vscode.workspace.openTextDocument(path.join(root(), file));

const append = async (document: vscode.TextDocument, text: string) => {
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, new vscode.Position(document.lineCount, 0), text);
    await vscode.workspace.applyEdit(edit);
};

const waitUntil = async (condition: () => boolean, description: string) => {
    for (let attempt = 0; attempt < 100; attempt++) {
        if (condition()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.fail(`Timed out waiting until ${description}`);
};

suite('monorepo', () => {
    suite('fix imports', () => {
        test('uses the nearest package and only fixes its own imports', async () => {
            const document = await open('packages/app/example/lib/single.dart');
            await vscode.window.showTextDocument(document);
            await vscode.commands.executeCommand('dart-import.fix');
            assert.strictEqual(onDisk('packages/app/example/lib/single.dart'), 'import \'home.dart\';\nimport \'package:app/two.dart\';\n');
            assert.strictEqual(document.isDirty, false);
        });

        test('works in a package below the workspace root', async () => {
            await vscode.window.showTextDocument(await open('packages/app/lib/single/fix.dart'));
            await vscode.commands.executeCommand('dart-import.fix');
            assert.strictEqual(onDisk('packages/app/lib/single/fix.dart'), 'import \'../two.dart\';\n');
        });

        test('ignores files that are not dart', async () => {
            const document = await open('packages/app/pubspec.yaml');
            await vscode.window.showTextDocument(document);
            await append(document, '# edited\n');
            await vscode.commands.executeCommand('dart-import.fix');
            assert.strictEqual(document.isDirty, true);
            await document.save();
        });
    });

    suite('fix on save', () => {
        test('fixes and saves the file', async () => {
            const file = 'packages/app/lib/single/on_save.dart';
            const document = await open(file);
            await vscode.window.showTextDocument(document);
            await append(document, '// edited\n');
            await document.save();
            await waitUntil(() => onDisk(file).startsWith('import \'../two.dart\';') && !document.isDirty, 'the file is fixed and saved');
            assert.strictEqual(onDisk(file), 'import \'../two.dart\';\n// edited\n');
        });

        test('skips generated files', async () => {
            const file = 'packages/app/lib/single/saved.g.dart';
            const document = await open(file);
            await append(document, '// edited\n');
            await document.save();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            assert.strictEqual(onDisk(file), 'import \'package:app/two.dart\';\n// edited\n');
        });

        test('does not switch away from the active editor', async () => {
            const active = await open('packages/app/lib/two.dart');
            await vscode.window.showTextDocument(active);
            const file = 'packages/app/lib/single/background.dart';
            const background = await open(file);
            await append(background, '// edited\n');
            await background.save();
            await waitUntil(() => onDisk(file).startsWith('import \'../two.dart\';'), 'the background file is fixed');
            assert.strictEqual(vscode.window.activeTextEditor!.document.uri.toString(), active.uri.toString());
        });
    });

    suite('fix all imports', () => {
        const notFixed = (file: string) => assert.strictEqual(onDisk(file), 'import \'package:app/two.dart\';\n');

        suiteSetup(async () => {
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
            await vscode.commands.executeCommand('dart-import.fix-all');
        });

        test('fixes every package using its own name', () => {
            assert.strictEqual(onDisk('packages/app/lib/all/fixed.dart'), 'import \'../two.dart\';\nimport \'package:other/other.dart\';\n');
            assert.strictEqual(onDisk('packages/app/example/lib/all.dart'), 'import \'home.dart\';\nimport \'package:app/two.dart\';\n');
            assert.strictEqual(onDisk('packages/other/lib/other.dart'), 'import \'deep/deeper.dart\';\n');
            assert.strictEqual(onDisk('packages/other/lib/deep/deeper.dart'), 'import \'../other.dart\';\n');
        });

        test('skips generated files', () => {
            notFixed('packages/app/lib/all/generated.g.dart');
        });

        test('skips files outside of lib', () => {
            notFixed('packages/app/test/fixed_test.dart');
            notFixed('packages/app/build/lib/built.dart');
            assert.strictEqual(onDisk('docs/lib/snippet.dart'), 'import \'package:workspace_root/snippet.dart\';\n');
        });

        test('skips dot folders', () => {
            notFixed('packages/app/.dart_tool/lib/tool.dart');
            notFixed('packages/app/windows/flutter/ephemeral/.plugin_symlinks/plugin/lib/plugin.dart');
        });

        test('leaves nothing unsaved and opens no editors', () => {
            assert.strictEqual(vscode.workspace.textDocuments.filter((document) => document.isDirty).length, 0);
            assert.strictEqual(vscode.window.visibleTextEditors.length, 0);
        });
    });
});
