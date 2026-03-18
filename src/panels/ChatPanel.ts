import * as vscode from 'vscode';
import { internalClient, getUserId } from '../api/internalClient';
import { getWebviewContent } from './chatWebview';

export class ChatViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'ustracode.chatView';
    private _view?: vscode.WebviewView;
    private _chatHistory: { role: string; content: string }[] = [];

    constructor(private readonly _extensionUri: vscode.Uri) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = getWebviewContent();

        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await this._handleChat(message.text, message.provider, message.model, message.bypassCache);
                    break;
                case 'indexFile':
                    await this._handleIndexFile();
                    break;
                case 'clearHistory':
                    this._chatHistory = [];
                    this._postMessage({ command: 'clearHistory' });
                    break;
                case 'ready':
                    await this._checkServerHealth();
                    await this._sendCurrentSettings();
                    break;
                case 'verifyApiKey':
                    await this._handleVerifyApiKey();
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand(
                        'workbench.action.openSettings', 'ustracode'
                    );
                    break;
            }
        });

        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('ustracode')) {
                await this._sendCurrentSettings();
                await this._checkServerHealth();
            }
        });
    }

    private async _handleChat(text: string, provider?: string, model?: string, bypassCache?: boolean) {
        if (!text.trim()) { return; }

        this._chatHistory.push({ role: 'user', content: text });
        this._postMessage({ command: 'addMessage', role: 'user', content: text });
        this._postMessage({ command: 'setLoading', value: true });

        try {
            const editor = vscode.window.activeTextEditor;
            let contextText = text;
            if (editor) {
                const selectedText = editor.document.getText(editor.selection);
                if (selectedText) {
                    contextText = `[선택된 코드]\n\`\`\`\n${selectedText}\n\`\`\`\n\n[질문]\n${text}`;
                }
            }

            const settings = internalClient.getSettings();
            const chatResponse = await internalClient.chat({
                userId:            getUserId(),   // ← 하드코딩 제거
                message:           contextText,
                provider:          provider || settings.defaultProvider,
                model:             model    || settings.defaultModel,
                useRag:            settings.ragEnabled,
                ragLimit:          3,
                ragScoreThreshold: 0.5,
                bypassCache:       bypassCache || false,
            });

            this._chatHistory.push({ role: 'assistant', content: chatResponse.message });
            this._postMessage({
                command:    'addMessage',
                role:       'assistant',
                content:    chatResponse.message,
                ragUsed:    chatResponse.ragUsed,
                references: chatResponse.references,
                model:      chatResponse.model,
            });

        } catch (error: any) {
            this._postMessage({
                command: 'addMessage',
                role:    'error',
                content: `❌ 오류: ${error.message || '서버 연결 실패'}`,
            });
        } finally {
            this._postMessage({ command: 'setLoading', value: false });
        }
    }

    private async _handleIndexFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this._postMessage({
                command: 'addMessage', role: 'system',
                content: '⚠️ 열린 파일이 없습니다.',
            });
            return;
        }

        const filePath    = editor.document.fileName;
        const fileContent = editor.document.getText();
        this._postMessage({ command: 'setLoading', value: true });

        try {
            await internalClient.indexCode({
                id: filePath, code: fileContent, filePath,
                language: filePath.split('.').pop() || 'unknown',
            });
            this._postMessage({
                command: 'addMessage', role: 'system',
                content: `✅ 인덱싱 완료: ${filePath.split('\\').pop()}`,
            });
        } catch (error: any) {
            this._postMessage({
                command: 'addMessage', role: 'error',
                content: `❌ 인덱싱 실패: ${error.message}`,
            });
        } finally {
            this._postMessage({ command: 'setLoading', value: false });
        }
    }

    private async _handleVerifyApiKey() {
        this._postMessage({ command: 'setVerifying', value: true });
        const result = await internalClient.verifyApiKey();
        this._postMessage({
            command:    'setApiKeyStatus',
            valid:      result.valid,
            tenantName: result.tenantName,
        });
        this._postMessage({ command: 'setVerifying', value: false });
    }

    private async _checkServerHealth() {
        const isHealthy = await internalClient.health();
        this._postMessage({ command: 'setServerStatus', healthy: isHealthy });
    }

    private async _sendCurrentSettings() {
        const s = internalClient.getSettings();
        this._postMessage({
            command:         'updateSettings',
            serverUrl:       s.serverUrl,
            apiKey:          s.apiKey,
            userId:          s.userId,        // ← 추가
            defaultProvider: s.defaultProvider,
            defaultModel:    s.defaultModel,
            ragEnabled:      s.ragEnabled,
        });
    }

    private _postMessage(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }

    public sendCodeToChat(message: string) {
        this._postMessage({ command: 'setInputText', text: message });
    }
}