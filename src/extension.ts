'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { PackageInfo, EditorAccess, fixImports } from './main';

/**
 * Returns the set of `pubspec.yaml` files that sit above `activeFileUri` in its
 * directory ancestry.
 */
const findPubspec = async (activeFileUri: vscode.Uri) => {
    const allPubspecUris = await vscode.workspace.findFiles('**/pubspec.yaml');
    return allPubspecUris.filter((pubspecUri) => {
        const packageRootUri = pubspecUri.with({
            path: path.dirname(pubspecUri.path),
        }) + '/';

        // Containment check
        return activeFileUri.toString().startsWith(packageRootUri.toString());
    });
};

const fetchPackageInfoFor = async (activeDocumentUri: vscode.Uri): Promise<PackageInfo | null> => {
    const pubspecUris = await findPubspec(activeDocumentUri);
    if (pubspecUris.length !== 1) {
        vscode.window.showErrorMessage(`Expected to find a single pubspec.yaml file above ${activeDocumentUri}, ${pubspecUris.length} found.`);
        return null;
    }

    const pubspec: vscode.TextDocument = await vscode.workspace.openTextDocument(pubspecUris[0]);
    const projectRoot = path.dirname(pubspec.fileName);
    const possibleNameLines = pubspec.getText().split('\n').filter((line: String) => line.match(/^\s*name:/));
    if (possibleNameLines.length !== 1) {
        vscode.window.showErrorMessage(`Expected to find a single line starting with 'name:' on pubspec.yaml file, ${possibleNameLines.length} found.`);
        return null;
    }
    const nameLine = possibleNameLines[0];
    const packageNameMatch = /^\s*name:\s*(.*)$/mg.exec(nameLine);
    if (!packageNameMatch) {
        vscode.window.showErrorMessage(`Expected line 'name:' on pubspec.yaml to match regex, but it didn't (line: ${nameLine}).`);
        return null;
    }
    return {
        projectRoot: projectRoot,
        projectName: packageNameMatch[1].trim(),
    };
};

class VSCodeEditorAccess implements EditorAccess {
    editor: vscode.TextEditor;

    constructor(editor: vscode.TextEditor) {
        this.editor = editor;
    }

    getFileName(): string {
        return this.editor.document.fileName;
    }

    getLineAt(idx: number): string {
        return this.editor.document.lineAt(idx).text;
    }

    getLineCount(): number {
        return this.editor.document.lineCount;
    }

    replaceLineAt(idx: number, newLine: string): Thenable<boolean> {
        return this.editor.edit((builder) => {
            const line = this.getLineAt(idx);
            const start = new vscode.Position(idx, 0);
            const end = new vscode.Position(idx, line.length);
            builder.replace(new vscode.Range(start, end), newLine);
        });
    }
}

export async function activate(context: vscode.ExtensionContext) {
    const cmd = vscode.commands.registerCommand('dart-import.fix', async () => {
        const rawEditor = vscode.window.activeTextEditor;
        if (!rawEditor) {
            return; // No open text editor
        }

        const packageInfo = await fetchPackageInfoFor(rawEditor.document.uri);
        if (!packageInfo) {
            vscode.window.showErrorMessage('Failed to initialize extension. Is this a valid Dart/Flutter project?');
            return;
        }

        const editor = new VSCodeEditorAccess(rawEditor);
        try {
            const count = await fixImports(editor, packageInfo, path.sep);
            vscode.commands.executeCommand('editor.action.organizeImports');
            vscode.window.showInformationMessage((count === 0 ? 'No lines changed.' : `${count} imports fixed.`) + ' All imports sorted.');
        } catch (ex) {
            if (ex instanceof Error) {
                vscode.window.showErrorMessage(ex.message);
            } else {
                throw ex;
            }
        }
    });
    context.subscriptions.push(cmd);
}
