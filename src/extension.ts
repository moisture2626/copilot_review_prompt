// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

// プロンプト編集用のWebViewProvider
class PromptEditorViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'copilotReviewPromptEditorView';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // メッセージ受信（保存処理）
        webviewView.webview.onDidReceiveMessage(async data => {
            const config = vscode.workspace.getConfiguration('copilotReviewPromptEditor');
            switch (data.type) {
                case 'save':
                    await config.update('reviewPrompt', data.reviewPrompt, vscode.ConfigurationTarget.Global);
                    await config.update('reviewPromptNoDiff', data.reviewPromptNoDiff, vscode.ConfigurationTarget.Global);
                    await config.update('lastCompareBranch', data.compareBranch, vscode.ConfigurationTarget.Global);
                    await config.update('saveDirectory', data.saveDirectory, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('プロンプトを保存しました');
                    break;
                case 'copyDiffPrompt':
                    await config.update('reviewPromptNoDiff', data.prompt, vscode.ConfigurationTarget.Global);
                    await vscode.commands.executeCommand('copilot-review-prompt-editor.copyDiffReviewPrompt');
                    break;

                case 'copyNoDiffPrompt':
                    await config.update('reviewPrompt', data.prompt, vscode.ConfigurationTarget.Global);
                    await vscode.commands.executeCommand('copilot-review-prompt-editor.copyReviewPrompt');
                    break;
                case 'saveDiff':
                    // 差分を保存する処理を実行
                    await vscode.commands.executeCommand('copilot-review-prompt-editor.saveDiffFiles');
                    break;
                case 'browseSaveDirectory':
                    // フォルダ選択ダイアログを開く
                    const folderUris = await vscode.window.showOpenDialog({
                        canSelectFolders: true,
                        canSelectFiles: false,
                        canSelectMany: false,
                        openLabel: '差分ファイルの保存先を選択'
                    });
                    if (folderUris && folderUris.length > 0) {
                        const selectedPath = folderUris[0].fsPath;
                        // WebViewに選択したパスを送信
                        webviewView.webview.postMessage({
                            type: 'updateSaveDirectory',
                            path: selectedPath
                        });
                    }
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const config = vscode.workspace.getConfiguration('copilotReviewPromptEditor');
        const reviewPrompt = config.get('reviewPrompt') || '';
        const reviewPromptNoDiff = config.get('reviewPromptNoDiff') || '';
        const lastCompareBranch = config.get('lastCompareBranch') || '';
        const saveDirectory = config.get('saveDirectory') || '';

        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>プロンプト編集</title>
    <style>
        body {
            padding: 10px;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        h3 {
            margin-top: 0;
            margin-bottom: 8px;
            font-size: 13px;
            font-weight: 600;
        }
        label {
            display: block;
            margin-bottom: 4px;
            font-size: 12px;
            font-weight: 500;
        }
        input[type="text"] {
            flex: 1;
            padding: 6px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            font-family: var(--vscode-font-family);
            font-size: 12px;
            box-sizing: border-box;
        }
        input[type="text"]:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        textarea {
            width: 100%;
            min-height: 120px;
            margin-bottom: 8px;
            padding: 6px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            resize: vertical;
            box-sizing: border-box;
        }
        textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        button {
            width: 100%;
            padding: 6px 14px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            font-size: 13px;
            margin-bottom: 8px;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        button:active {
            background: var(--vscode-button-background);
        }
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        button.small {
            width: auto;
            padding: 6px 12px;
            white-space: nowrap;
        }
        .section {
            margin-bottom: 16px;
        }
        .input-group {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
        }
    </style>
</head>
<body>
    <h3>プロンプト編集</h3>

    <div class="section">
        <label for="saveDirectory">差分ファイル保存先</label>
        <div class="input-group">
            <input type="text" id="saveDirectory" placeholder="保存先フォルダのパス" value="${this._escapeHtml(String(saveDirectory))}" />
            <button id="browseDirBtn" class="small">参照</button>
        </div>
    </div>

    <div class="section">
        <label for="compareBranch">比較ブランチ</label>
        <div class="input-group">
            <input type="text" id="compareBranch" placeholder="例: main, develop" value="${this._escapeHtml(String(lastCompareBranch))}" />
            <button id="saveDiffBtn" class="small">差分保存</button>
        </div>
    </div>

    <div class="section">
        <label for="reviewPrompt">Diffレビュー用プロンプト</label>
        <textarea id="reviewPrompt">${this._escapeHtml(String(reviewPrompt))}</textarea>
        <button id="copyDiffBtn" class="secondary">クリップボードにコピー</button>
    </div>

    <div class="section">
        <label for="reviewPromptNoDiff">Diffなしレビュー用プロンプト</label>
        <textarea id="reviewPromptNoDiff">${this._escapeHtml(String(reviewPromptNoDiff))}</textarea>
        <button id="copyNoDiffBtn" class="secondary">クリップボードにコピー</button>
    </div>

    <button id="saveBtn">保存</button>

    <script>
        const vscode = acquireVsCodeApi();

        // Extension側からのメッセージを受信
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'updateSaveDirectory') {
                document.getElementById('saveDirectory').value = message.path;
            }
        });

        document.getElementById('saveBtn').addEventListener('click', () => {
            vscode.postMessage({
                type: 'save',
                reviewPrompt: document.getElementById('reviewPrompt').value,
                reviewPromptNoDiff: document.getElementById('reviewPromptNoDiff').value,
                compareBranch: document.getElementById('compareBranch').value,
                saveDirectory: document.getElementById('saveDirectory').value
            });
        });

        document.getElementById('browseDirBtn').addEventListener('click', () => {
            vscode.postMessage({
                type: 'browseSaveDirectory'
            });
        });

        document.getElementById('saveDiffBtn').addEventListener('click', () => {
            const branch = document.getElementById('compareBranch').value;
            const saveDir = document.getElementById('saveDirectory').value;
            // ブランチ名と保存先を先に保存してから差分保存コマンドを実行
            vscode.postMessage({
                type: 'save',
                reviewPrompt: document.getElementById('reviewPrompt').value,
                reviewPromptNoDiff: document.getElementById('reviewPromptNoDiff').value,
                compareBranch: branch,
                saveDirectory: saveDir
            });
            // 差分保存コマンドを実行
            vscode.postMessage({
                type: 'saveDiff'
            });
        });

        document.getElementById('copyDiffBtn').addEventListener('click', () => {
            const prompt = document.getElementById('reviewPrompt').value;
            vscode.postMessage({
                type: 'copyDiffPrompt',
                prompt: prompt
            });
        });

        document.getElementById('copyNoDiffBtn').addEventListener('click', () => {
            const prompt = document.getElementById('reviewPromptNoDiff').value;
            vscode.postMessage({
                type: 'copyNoDiffPrompt',
                prompt: prompt
            });
        });
    </script>
</body>
</html>`;
    }

    private _escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // WebViewProviderを登録
    const provider = new PromptEditorViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(PromptEditorViewProvider.viewType, provider)
    );

    console.log('Congratulations, your extension "copilot-review-prompt-editor" is now active!');

    // Save Git Diff Files command
    const saveDiffDisposable = vscode.commands.registerCommand('copilot-review-prompt-editor.saveDiffFiles', async () => {
        saveDiffFile();
    });
    context.subscriptions.push(saveDiffDisposable);

    // Diffレビュー用プロンプトをクリップボードにコピーするコマンド（diffファイル指定）
    const copyDiffPromptDisposable = vscode.commands.registerCommand('copilot-review-prompt-editor.copyDiffReviewPrompt', async () => {
        // 差分ファイル選択
        const files = await vscode.window.showOpenDialog({
            canSelectMany: false,
            canSelectFiles: true,
            canSelectFolders: false,
            openLabel: 'レビューしたいdiffファイルを選択',
            filters: { 'Patch Files': ['patch'], 'All Files': ['*'] }
        });
        if (!files || files.length === 0) {
            vscode.window.showWarningMessage('ファイルが選択されませんでした');
            return;
        }
        const filePath = files[0].fsPath;
        await copyReviewPrompt(filePath);
    });
    context.subscriptions.push(copyDiffPromptDisposable);

    // Diffなしプロンプトをchat入力欄にコピーするコマンド
    const copyPromptDisposable = vscode.commands.registerCommand('copilot-review-prompt-editor.copyReviewPrompt', async () => {
        await copyReviewPromptNoDiff();
    });
    context.subscriptions.push(copyPromptDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }

///
/// Git Diffを取得してファイル保存
///
async function saveDiffFile() {
    // 設定取得
    const config = vscode.workspace.getConfiguration('copilotReviewPromptEditor');
    const lastCompareBranch: string = config.get('lastCompareBranch') || '';

    let branch = lastCompareBranch;
    if (!branch) {
        // 空欄なら全体レビュー用プロンプトコピーのみ実行
        await copyReviewPromptNoDiff();
        return;
    }
    // 入力値が前回と異なれば保存
    if (branch !== lastCompareBranch) {
        await config.update('lastCompareBranch', branch, vscode.ConfigurationTarget.Global);
    }

    // 2. 保存先フォルダ取得（設定から）
    let saveDir: string = config.get('saveDirectory') || '';
    if (!saveDir) {
        // 未設定ならダイアログで選択し、設定に保存
        const folderUris = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: '差分ファイルの保存先を選択'
        });
        if (!folderUris || folderUris.length === 0) {
            vscode.window.showWarningMessage('保存先フォルダが選択されませんでした');
            return;
        }
        saveDir = folderUris[0].fsPath;
        await config.update('saveDirectory', saveDir, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`保存先フォルダを設定に保存しました: ${saveDir}`);
    }

    // 3. ワークスペースルート取得
    const wsFolders = vscode.workspace.workspaceFolders;
    const rootPath = wsFolders && wsFolders.length > 0 ? wsFolders[0].uri.fsPath : '';
    if (!rootPath) {
        vscode.window.showErrorMessage('ワークスペースのルートパスが取得できませんでした');
        return;
    }
    // 3. 現在のブランチ名取得
    exec('git rev-parse --abbrev-ref HEAD', { cwd: rootPath }, (err, stdout) => {
        if (err) {
            vscode.window.showErrorMessage('現在のブランチ名取得に失敗しました');
            return;
        }
        const currentBranch = stdout.trim();
        if (currentBranch === branch) {
            vscode.window.showWarningMessage('現在のブランチと指定ブランチが同じです');
            return;
        }

        // 4. git diff で差分取得
        const diffCmd = `git diff ${branch}...${currentBranch}`;
        exec(diffCmd, { cwd: rootPath, maxBuffer: 1024 * 1024 * 10 }, (diffErr, diffStdout) => {
            if (diffErr) {
                vscode.window.showErrorMessage('git diffの取得に失敗しました');
                return;
            }
            if (!diffStdout) {
                vscode.window.showInformationMessage('差分はありません');
                return;
            }

            // 5. ファイル保存（diff_[プロジェクトフォルダ名]_YYYYMMDDhhmmss.patch 形式）
            const projectFolder = path.basename(rootPath);
            const now = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const y = now.getFullYear();
            const m = pad(now.getMonth() + 1);
            const d = pad(now.getDate());
            const h = pad(now.getHours());
            const min = pad(now.getMinutes());
            const s = pad(now.getSeconds());
            const fileName = `diff_${projectFolder}_${y}${m}${d}${h}${min}${s}.patch`;
            const filePath = path.join(saveDir, fileName);
            fs.writeFile(filePath, diffStdout, async (writeErr) => {
                if (writeErr) {
                    vscode.window.showErrorMessage('差分ファイルの保存に失敗しました');
                    return;
                }
                vscode.window.showInformationMessage(`差分ファイルを保存しました: ${filePath}`);
            });
        });
    });
}

///
/// Diffファイルパスをもとにレビュー用プロンプトをクリップボードにコピー
///
async function copyReviewPrompt(filePath: string) {
    // 設定からプロンプト文取得
    const config = vscode.workspace.getConfiguration('copilotReviewPromptEditor');
    let promptTemplate: string = config.get('reviewPrompt') || '';
    if (!promptTemplate) {
        promptTemplate = `以下の条件でgit diffパッチファイルをもとにコードレビューをしてください。\n
・diffパッチファイルの読み込みはコマンドラインを自由に使用してください。\n
・diffパッチファイルに記載されている.cs,.js,.shader,.hlsl,.cgincファイルをすべてレビューしてください。\n
・関連するクラスもすべて検索して総合的にレビューしてください。\n
・レビューは設計面を重視、明確なバグやエラーを優先して指摘、多少の冗長さやコードの無駄は無視してください。\n
・レビューはMarkDown形式で表示してください。\n\n
[ファイルパス] {filePath}`;
    }
    // {filePath} を置換
    const prompt = promptTemplate.replace(/\{filePath\}/g, filePath);
    // Copilot Chatの入力欄を自動でアクティブ化せず、クリップボードにコピー＋案内のみ
    await vscode.env.clipboard.writeText(prompt);
    vscode.window.showInformationMessage('Copilotチャット入力欄を開いて貼り付けてください。\nプロンプトはクリップボードにコピーされました。');
}

///
/// Diffなしレビュー用プロンプトをクリップボードにコピー
///
async function copyReviewPromptNoDiff() {
    // 設定からプロンプト文取得
    const config = vscode.workspace.getConfiguration('copilotReviewPromptEditor');
    let promptTemplate: string = config.get('reviewPromptNoDiff') || '';
    if (!promptTemplate) {
        promptTemplate = `以下の条件でこのプロジェクトのコードをレビューしてください。\n・.cs,.js,.shader,.hlsl,.cgincファイルをすべてレビューしてください。\n・レビューは設計面を重視、明確なバグやエラーを優先して指摘、多少の冗長さやコードの無駄は無視してください。`;
    }
    await vscode.env.clipboard.writeText(promptTemplate);
    vscode.window.showInformationMessage('Copilotチャット入力欄を開いて貼り付けてください。\nプロンプトはクリップボードにコピーされました。');
}
