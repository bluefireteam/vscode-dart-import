'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigResolver } from './configResolver';
import { EditorAccess, fixImports, PackageInfo } from './main';

let configResolver = new ConfigResolver();

const showErrorMessage = (message: string) => {
    if (configResolver.showErrorMessages) {
        vscode.window.showErrorMessage(message);
    }
};

const showInfoMessage = (message: string) => {
    if (configResolver.showInfoMessages) {
        vscode.window.showInformationMessage(message);
    }
};

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
        showErrorMessage(
            `Expected to find a single pubspec.yaml file above ${activeDocumentUri}, ${pubspecUris.length} found.`,
        );
        return null;
    }

    const pubspec: vscode.TextDocument = await vscode.workspace.openTextDocument(pubspecUris[0]);
    const projectRoot = path.dirname(pubspec.fileName);
    const possibleNameLines = pubspec.getText().split('\n').filter((line: string) => line.match(/^name:/));
    if (possibleNameLines.length !== 1) {
        showErrorMessage(
            `Expected to find a single line starting with 'name:' on pubspec.yaml file, ${possibleNameLines.length} found.`,
        );
        return null;
    }
    const nameLine = possibleNameLines[0];
    const packageNameMatch = /^name:\s*(.*)$/mg.exec(nameLine);
    if (!packageNameMatch) {
        showErrorMessage(
            `Expected line 'name:' on pubspec.yaml to match regex, but it didn't (line: ${nameLine}).`,
        );
        return null;
    }
    return {
        projectRoot: projectRoot,
        projectName: packageNameMatch[1].trim(),
    };
};

const runFixImportTask = async (rawEditor: vscode.TextEditor, mode?: string) => {
    const packageInfo = await fetchPackageInfoFor(rawEditor.document.uri);
    if (!packageInfo) {
        showErrorMessage(
            'Failed to initialize extension. Is this a valid Dart/Flutter project?',
        );
        return;
    }

    const editor = new VSCodeEditorAccess(rawEditor);
    try {
        const count = await fixImports(editor, packageInfo, path.sep, mode);
        vscode.commands.executeCommand('editor.action.organizeImports');
        showInfoMessage(
            (count === 0 ? 'No lines changed.' : `${count} imports fixed.`) +
            ' All imports sorted.',
        );
    } catch (ex) {
        if (ex instanceof Error) {
            showErrorMessage(ex.message);
        } else {
            throw ex;
        }
    }
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

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const configChanges = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('dartImport')) {
            configResolver = new ConfigResolver();
        }
    });

    const documentSave = vscode.workspace.onDidSaveTextDocument(
        async (e: vscode.TextDocument) => {
            if (!configResolver.fixOnSave) {
                return;
            }
            const rawEditor = await vscode.window.showTextDocument(e);

            runFixImportTask(rawEditor);
        },
    );

    const changeToRelative = vscode.commands.registerCommand('dart-import.change-to-relative', async () => {
        const rawEditor = vscode.window.activeTextEditor;
        if (!rawEditor) {
            return; // No open text editor
        }

        runFixImportTask(rawEditor);
    });


    const changeAllToRelative = vscode.commands.registerCommand('dart-import.change-all-to-relative', async () => {
        const excludeExt = configResolver.excludeGeneratedFiles;
        const excludeFiles = excludeExt ? `lib/**/*.{${excludeExt}}` : null;
        const filesUris = await vscode.workspace.findFiles('lib/**/**.dart', excludeFiles);

        if (filesUris.length === 0) {
            showInfoMessage('No dart files were found');
            return;
        }
        const packageInfo = await fetchPackageInfoFor(filesUris[0]);

        if (!packageInfo) {
            showErrorMessage(
                'Failed to initialize extension. Is this a valid Dart/Flutter project?',
            );
            return;
        }

        let totalCount = 0;
        for await  (const uri of filesUris) {
            const document = await vscode.workspace.openTextDocument(uri);
            const rawEditor = await vscode.window.showTextDocument(document);
            const editor = new VSCodeEditorAccess(rawEditor);
            try {
                const count = await fixImports(editor, packageInfo, path.sep);
                vscode.commands.executeCommand('editor.action.organizeImports');
                totalCount += count;
            } catch (ex) {
                if (ex instanceof Error) {
                    showErrorMessage(ex.message);
                } else {
                    throw ex;
                }
            }
        }
        showInfoMessage(
            totalCount === 0
                ? 'Done. No lines changed'
                : `All done. ${totalCount} lines changed.`,
        );
    });

    const changeToAbsolute = vscode.commands.registerCommand('dart-import.change-to-absolute', async () => {
        const rawEditor = vscode.window.activeTextEditor;
        if (!rawEditor) {
            return; // No open text editor
        }

        runFixImportTask(rawEditor, 'absolute');
    });


    const changeAllToAbsolute = vscode.commands.registerCommand('dart-import.change-all-to-absolute', async () => {
        const excludeExt = configResolver.excludeGeneratedFiles;
        const excludeFiles = excludeExt ? `lib/**/*.{${excludeExt}}` : null;
        const filesUris = await vscode.workspace.findFiles('lib/**/**.dart', excludeFiles);

        if (filesUris.length === 0) {
            showInfoMessage('No dart files were found');
            return;
        }
        const packageInfo = await fetchPackageInfoFor(filesUris[0]);

        if (!packageInfo) {
            showErrorMessage(
                'Failed to initialize extension. Is this a valid Dart/Flutter project?',
            );
            return;
        }

        let totalCount = 0;
        for await  (const uri of filesUris) {
            const document = await vscode.workspace.openTextDocument(uri);
            const rawEditor = await vscode.window.showTextDocument(document);
            const editor = new VSCodeEditorAccess(rawEditor);
            try {
                const count = await fixImports(editor, packageInfo, path.sep, 'absolute');
                vscode.commands.executeCommand('editor.action.organizeImports');
                totalCount += count;
            } catch (ex) {
                if (ex instanceof Error) {
                    showErrorMessage(ex.message);
                } else {
                    throw ex;
                }
            }
        }
        showInfoMessage(
            totalCount === 0
                ? 'Done. No lines changed'
                : `All done. ${totalCount} lines changed.`,
        );
    });

    context.subscriptions.push(changeToRelative, changeAllToRelative, changeToAbsolute, changeAllToAbsolute, configChanges, documentSave);
}
