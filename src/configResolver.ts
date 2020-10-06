import * as vscode from 'vscode';

export class ConfigResolver {
    private _showInfoMessages: boolean;
    private _showErrorMessages: boolean;
    private _excludeGeneratedFiles: Array<string>;

    constructor() {
        const config = vscode.workspace.getConfiguration(
            'dartImport',
        ) as vscode.WorkspaceConfiguration;

        this._showInfoMessages = !!config.get('showInfoMessages');
        this._showErrorMessages = !!config.get('showErrorMessages');
        this._excludeGeneratedFiles = config.get('excludeGeneratedFiles') || [];
    }

    public get showErrorMessages() : boolean {
        return this._showErrorMessages;
    }

    public get showInfoMessages() : boolean {
        return this._showInfoMessages;
    }

    public get excludeGeneratedFiles() : Array<string> {
        return this._excludeGeneratedFiles;
    }
}
