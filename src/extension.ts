'use strict';

import * as vscode from 'vscode';

const fetchPackageName = async (context: vscode.ExtensionContext) => {
    const files: vscode.Uri[] = await vscode.workspace.findFiles('pubspec.yaml');
    if (files.length != 1) {
        vscode.window.showErrorMessage(`Expected to find a single pubspec.yaml file, ${files.length} found.`);
        return null;
    }
    const file : vscode.TextDocument = await vscode.workspace.openTextDocument(files[0]);
    const fileName = file.fileName.replace(/\/pubspec\.yaml$/, '');
    const possibleNameLines = file.getText().split('\n').filter(line => line.match(/^\s*name:/));
    if (possibleNameLines.length != 1) {
        vscode.window.showErrorMessage(`Expected to find a single line starting with 'name:' on pubspec.yaml file, ${possibleNameLines.length} found.`);
        return null;
    }
    const nameLine = possibleNameLines[0];
    const regex = /^\s*name:\s*(.*)$/.exec(nameLine);
    if (!regex) {
        vscode.window.showErrorMessage(`Expected line 'name:' on pubspec.yaml to match regex, but it didn't (line: ${nameLine}).`);
        return null;
    }
    return {
        projectRoot: fileName,
        projectName: regex[1],
    };
};

export const relativize = (filePath : String, importPath : String) => {
    const pathSplit = (path : String) => path.length === 0 ? [] : path.split('/');
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
    const packageInfo = await fetchPackageName(context);

    const cmd = vscode.commands.registerCommand('dart-import.fix', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return; // No open text editor
        }

        if (!packageInfo) {
            vscode.window.showErrorMessage('Failed to initialize extension. Is this a valid Dart/Flutter project?');
            return;
        }

    const currentPath = editor.document.fileName.replace(/\/[^\/]*.dart$/, '');
        const libFolder = packageInfo.projectRoot + '/lib/';
        if (!currentPath.startsWith(libFolder)) {
            vscode.window.showErrorMessage('Current file is not on project root or not on lib folder? File must be on $root/lib.');
            return;
        }
        const relativePath = currentPath.substring(libFolder.length);
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