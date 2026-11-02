'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { PackageInfo, EditorAccess, fixImports, parsePackageName, isInLib, isGeneratedFile } from './main';
import { ConfigResolver } from './configResolver';

// dot folders hold tooling output and symlinks to packages outside of the repo,
// such as `.dart_tool`, `.symlinks` and `.plugin_symlinks`
const FIX_ALL_INCLUDE = '**/lib/**/*.dart';
const FIX_ALL_EXCLUDE = '{**/.*/**,**/node_modules/**}';

const DART_EXTENSION_ID = 'Dart-Code.dart-code';
const ORGANIZE_IMPORTS_POLL_MS = 25;
const ORGANIZE_IMPORTS_TIMEOUT_MS = 5000;
// stop waiting for the rest of a fix all run once sorting seems to be unavailable
const FIX_ALL_MAX_CONSECUTIVE_UNSORTED = 3;

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

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

/**
 * Finds the package each file belongs to, which is defined by the nearest
 * `pubspec.yaml` above it. Results are cached, so create one per run to pick up
 * changes to the pubspec files.
 */
class PackageResolver {
    private pubspecs = new Map<string, Promise<vscode.Uri | null>>();
    private packages = new Map<string, Promise<PackageInfo | null>>();

    async forFile(fileUri: vscode.Uri): Promise<PackageInfo | null> {
        const pubspecUri = await this.findPubspec(this.parentOf(fileUri));
        return pubspecUri && this.cached(this.packages, pubspecUri, () => this.readPackage(pubspecUri));
    }

    private findPubspec(directoryUri: vscode.Uri): Promise<vscode.Uri | null> {
        return this.cached(this.pubspecs, directoryUri, async () => {
            const pubspecUri = directoryUri.with({ path: path.posix.join(directoryUri.path, 'pubspec.yaml') });
            try {
                await vscode.workspace.fs.stat(pubspecUri);
                return pubspecUri;
            } catch {
                const parentUri = this.parentOf(directoryUri);
                return parentUri.path === directoryUri.path ? null : this.findPubspec(parentUri);
            }
        });
    }

    private async readPackage(pubspecUri: vscode.Uri): Promise<PackageInfo | null> {
        const contents = await vscode.workspace.fs.readFile(pubspecUri);
        const projectName = parsePackageName(Buffer.from(contents).toString('utf8'));
        return projectName ? { projectName, projectRoot: this.parentOf(pubspecUri).fsPath } : null;
    }

    private parentOf(uri: vscode.Uri): vscode.Uri {
        return uri.with({ path: path.posix.dirname(uri.path) });
    }

    private cached<T>(cache: Map<string, Promise<T>>, uri: vscode.Uri, compute: () => Promise<T>): Promise<T> {
        const key = uri.toString();
        let value = cache.get(key);
        if (!value) {
            value = compute();
            cache.set(key, value);
        }
        return value;
    }
}

/**
 * Works on a document without needing an open editor. Replaced lines are only
 * applied by `applyEdits`, so each file is a single edit no matter how many
 * imports change.
 */
class DocumentAccess implements EditorAccess {
    private edit = new vscode.WorkspaceEdit();

    constructor(private document: vscode.TextDocument) {}

    getFileName(): string {
        return this.document.fileName;
    }

    getLineAt(idx: number): string {
        return this.document.lineAt(idx).text;
    }

    getLineCount(): number {
        return this.document.lineCount;
    }

    replaceLineAt(idx: number, newLine: string): Thenable<boolean> {
        this.edit.replace(this.document.uri, this.document.lineAt(idx).range, newLine);
        return Promise.resolve(true);
    }

    applyEdits(): Thenable<boolean> {
        return vscode.workspace.applyEdit(this.edit);
    }
}

const isDartExtensionReady = async () => {
    const dartExtension = vscode.extensions.getExtension(DART_EXTENSION_ID);
    if (!dartExtension) {
        return false;
    }
    try {
        await dartExtension.activate();
        return true;
    } catch {
        return false;
    }
};

const findOrganizeImportsAction = async (document: vscode.TextDocument, timeoutMs: number) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
            'vscode.executeCodeActionProvider',
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            vscode.CodeActionKind.SourceOrganizeImports.value,
        );
        if (actions && actions.length > 0) {
            return actions[0];
        }
        if (Date.now() >= deadline) {
            return null;
        }
        await new Promise((resolve) => setTimeout(resolve, ORGANIZE_IMPORTS_POLL_MS));
    }
};

/**
 * Returns whether the imports could be sorted. The Dart extension offers no
 * action until it has caught up with a document that was just opened or edited,
 * so we need to wait for it, which would never end if it isn't there to answer.
 */
const organizeImports = async (document: vscode.TextDocument, timeoutMs: number): Promise<boolean> => {
    if (!await isDartExtensionReady()) {
        return false;
    }
    const action = await findOrganizeImportsAction(document, timeoutMs);
    if (!action) {
        return false;
    }
    if (action.edit) {
        await vscode.workspace.applyEdit(action.edit);
    }
    if (action.command) {
        await vscode.commands.executeCommand(action.command.command, ...(action.command.arguments || []));
    }
    return true;
};

// documents we are saving ourselves, so the save hook doesn't fix them all over again
const selfSavedDocuments = new Set<string>();

const saveDocument = async (document: vscode.TextDocument) => {
    if (!document.isDirty) {
        return;
    }
    const key = document.uri.toString();
    selfSavedDocuments.add(key);
    try {
        await document.save();
    } finally {
        selfSavedDocuments.delete(key);
    }
};

const fixDocument = async (document: vscode.TextDocument, packageInfo: PackageInfo, organizeTimeoutMs = ORGANIZE_IMPORTS_TIMEOUT_MS) => {
    const access = new DocumentAccess(document);
    const count = await fixImports(access, packageInfo, path.sep);
    await access.applyEdits();
    const sorted = await organizeImports(document, organizeTimeoutMs);
    await saveDocument(document);
    return { count, sorted };
};

const fixSingleFile = async (document: vscode.TextDocument) => {
    const packageInfo = await new PackageResolver().forFile(document.uri);
    if (!packageInfo) {
        showErrorMessage(`Couldn't find a named pubspec.yaml above ${document.fileName}. Is this a valid Dart/Flutter project?`);
        return;
    }
    try {
        const { count, sorted } = await fixDocument(document, packageInfo);
        showInfoMessage(
            `${count === 0 ? 'No lines changed.' : `${count} imports fixed.`} ` +
            (sorted ? 'All imports sorted.' : 'Imports could not be sorted. Is the Dart extension running?'),
        );
    } catch (error) {
        showErrorMessage(errorMessage(error));
    }
};

const fixOnSave = async (document: vscode.TextDocument) => {
    const packageInfo = await new PackageResolver().forFile(document.uri);
    if (!packageInfo) {
        return; // saving a standalone dart file is not a problem
    }
    try {
        const { count } = await fixDocument(document, packageInfo);
        if (count > 0) {
            showInfoMessage(`${count} imports fixed.`);
        }
    } catch (error) {
        showErrorMessage(errorMessage(error));
    }
};

const findFilesToFix = async (token: vscode.CancellationToken) => {
    const resolver = new PackageResolver();
    const uris = await vscode.workspace.findFiles(FIX_ALL_INCLUDE, FIX_ALL_EXCLUDE, undefined, token);
    const files: { uri: vscode.Uri; packageInfo: PackageInfo }[] = [];
    for (const uri of uris) {
        if (token.isCancellationRequested) {
            break;
        }
        if (isGeneratedFile(uri.fsPath, configResolver.excludeGeneratedFiles)) {
            continue;
        }
        const packageInfo = await resolver.forFile(uri);
        // `lib` can also be a folder inside of another one, which is not a package's lib
        if (packageInfo && isInLib(uri.fsPath, packageInfo.projectRoot, path.sep)) {
            files.push({ uri, packageInfo });
        }
    }
    return files;
};

const fixAllFiles = async (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => {
    const files = await findFilesToFix(token);
    if (files.length === 0 && !token.isCancellationRequested) {
        showInfoMessage('No dart files were found');
        return;
    }

    let done = 0;
    let fixed = 0;
    let unsorted = 0;
    let consecutiveUnsorted = 0;
    const failures: string[] = [];
    for (const { uri, packageInfo } of files) {
        if (token.isCancellationRequested) {
            break;
        }
        progress.report({ message: `${done}/${files.length}`, increment: 100 / files.length });
        const organizeTimeoutMs = consecutiveUnsorted < FIX_ALL_MAX_CONSECUTIVE_UNSORTED ? ORGANIZE_IMPORTS_TIMEOUT_MS : 0;
        try {
            const { count, sorted } = await fixDocument(await vscode.workspace.openTextDocument(uri), packageInfo, organizeTimeoutMs);
            fixed += count;
            unsorted += sorted ? 0 : 1;
            consecutiveUnsorted = sorted ? 0 : consecutiveUnsorted + 1;
        } catch (error) {
            failures.push(`${uri.fsPath}: ${errorMessage(error)}`);
        }
        done++;
    }

    if (failures.length > 0) {
        showErrorMessage(`Failed to fix ${failures.length} files. First failure: ${failures[0]}`);
    }
    const stopped = done < files.length ? ` Stopped after ${done} of ${files.length} files.` : '';
    const notSorted = unsorted > 0 ? ` ${unsorted} files could not be sorted. Is the Dart extension running?` : '';
    showInfoMessage(`${fixed === 0 ? 'Done. No lines changed.' : `All done. ${fixed} imports fixed.`}${stopped}${notSorted}`);
};

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const configChanges = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('dartImport')) {
            configResolver = new ConfigResolver();
        }
    });

    const documentSave = vscode.workspace.onDidSaveTextDocument((document) => {
        const shouldFix = configResolver.fixOnSave
            && document.languageId === 'dart'
            && !isGeneratedFile(document.fileName, configResolver.excludeGeneratedFiles)
            && !selfSavedDocuments.has(document.uri.toString());
        if (shouldFix) {
            return fixOnSave(document);
        }
    });

    const cmd = vscode.commands.registerCommand('dart-import.fix', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'dart') {
            await fixSingleFile(editor.document);
        }
    });

    const cmdAll = vscode.commands.registerCommand('dart-import.fix-all', () => {
        const options = { location: vscode.ProgressLocation.Notification, title: 'Fixing imports', cancellable: true };
        return vscode.window.withProgress(options, fixAllFiles);
    });

    context.subscriptions.push(cmd, cmdAll, configChanges, documentSave);
}
