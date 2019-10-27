'use strict';

import * as vscode from 'vscode';
import * as path from 'path';

const fetchPackageInfoFor = async (activeDocumentUri: vscode.Uri) => {
    const pubspecUris = await findPubspec(activeDocumentUri);
    if (pubspecUris.length != 1) {
        vscode.window.showErrorMessage(`Expected to find a single pubspec.yaml file above ${activeDocumentUri}, ${pubspecUris.length} found.`);
        return null;
    }

    const pubspec : vscode.TextDocument = await vscode.workspace.openTextDocument(pubspecUris[0]);
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

/**
 * Returns the set of `pubspec.yaml` files that sit above `activeFileUri` in its
 * directory ancestry.
 */
const findPubspec = async (activeFileUri: vscode.Uri) => {
    const allPubspecUris = await vscode.workspace.findFiles('pubspec.yaml');
    return allPubspecUris.filter((pubspecUri) => {
        const packageRootUri = pubspecUri.with({
            path: path.dirname(pubspecUri.path),
        });

        // Containment check
        return activeFileUri.toString().startsWith(packageRootUri.toString());
    });
}

export const relativize = (filePath : String, importPath : String) => {
    const pathSplit = (_path : String) => {
        if (_path.length === 0) return [];
        const slash = _path.split('/');

        // Handles OS specific paths (Windows related)
        const osSeparator = _path.split(path.sep);
        if (slash.length > osSeparator.length) return slash;
        else return osSeparator;
    }
    const fileBits = pathSplit(filePath);
    const importBits = pathSplit(importPath);
    let dotdotAmount = 0, startIdx;
    for (startIdx = 0; startIdx < fileBits.length; startIdx++) {
        if (fileBits[startIdx] === importBits[startIdx]) {
           continue;
        }
        dotdotAmount = fileBits.length - startIdx;
        break;
    }
    const relativeBits = new Array(dotdotAmount).fill('..').concat(importBits.slice(startIdx));
    return relativeBits.join('/');
};

export async function activate(context: vscode.ExtensionContext) {
    const cmd = vscode.commands.registerCommand('dart-import.fix', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return; // No open text editor
        }

        const packageInfo = await fetchPackageInfoFor(editor.document.uri);
        if (!packageInfo) {
            vscode.window.showErrorMessage('Failed to initialize extension. Is this a valid Dart/Flutter project?');
            return;
        }

        const currentPath = editor.document.fileName.replace(/(\/|\\)[^\/\\]*.dart$/, '');
        const libFolder = path.join(packageInfo.projectRoot, 'lib');
        if (!currentPath.startsWith(libFolder)) {
            const l1 = 'Current file is not on project root or not on lib folder? File must be on $root/lib.';
            const l2 = `Your current file path is: '${currentPath}' and the lib folder according to the pubspec.yaml file is '${libFolder}'.`;
            vscode.window.showErrorMessage(`${l1}\n${l2}`);
            return;
        }
        const relativePath = currentPath.substring(libFolder.length + 1);
        let count = 0;
        for (let currentLine = 0;; currentLine++) {
            const line : vscode.TextLine = editor.document.lineAt(currentLine);
            if (line.text.trim().length === 0) {
                continue;
            }
            const content = line.text.trim();
            if (!content.startsWith('import ')) {
                break;
            }
            const regex = new RegExp(`^\\s*import\\s*(['"])package:${packageInfo.projectName}/([^'"]*)['"]\\s*;\\s*$`);
            const exec = regex.exec(content);
            if (exec) {
                const quote = exec[1];
                const importPath = exec[2];
                const relativeImport = relativize(relativePath, importPath);
                const content = `import ${quote}${relativeImport}${quote};`;
                await editor.edit((builder) => {
                    const start = new vscode.Position(currentLine, 0);
                    const end = new vscode.Position(currentLine, line.text.length);
                    builder.replace(new vscode.Range(start, end), content);
                });
                count++;
            }
        }

        vscode.commands.executeCommand('editor.action.organizeImports');
        vscode.window.showInformationMessage((count === 0 ? 'No lines changed.' : `${count} imports fixed.`) + ' All imports sorted.');
    });
    context.subscriptions.push(cmd);
}
