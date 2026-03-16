import * as vscode from 'vscode';
import { internalClient } from '../api/internalClient';
import { getWebviewContent } from './chatWebview';

export class ChatViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'ustracode.chatView';
    private _view?: vscode.WebviewView;
    private _chatHistory: { role: string; content: string }[] = [];
    private _selectedProvider: string = 'ollama';

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

        // WebView → Extension 메시지 수신
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await this._handleChat(message.text, message.provider);
                    break;
                case 'indexFile':
                    await this._handleIndexFile();
                    break;
                case 'clearHistory':
                    this._chatHistory = [];
                    this._postMessage({ command: 'clearHistory' });
                    break;
                case 'ready':
                    // WebView 로드 완료 시 서버 상태 전송
                    await this._checkServerHealth();
                    break;
            }
        });
    }

    private async _handleChat(text: string, provider: string) {
        if (!text.trim()) return;

        this._selectedProvider = provider || 'ollama';

        // 사용자 메시지 히스토리 추가
        this._chatHistory.push({ role: 'user', content: text });

        // UI에 사용자 메시지 즉시 표시
        this._postMessage({
            command: 'addMessage',
            role: 'user',
            content: text
        });

        // 로딩 표시
        this._postMessage({ command: 'setLoading', value: true });

        try {
            // 현재 열린 파일 컨텍스트 추가
            const editor = vscode.window.activeTextEditor;
            let contextText = text;
            if (editor) {
                const selection = editor.selection;
                const selectedText = editor.document.getText(selection);
                if (selectedText) {
                    contextText = `[선택된 코드]\n\`\`\`\n${selectedText}\n\`\`\`\n\n[질문]\n${text}`;
                }
            }

            const chatResponse = await internalClient.chat({
                userId: 'vscode-user',
                message: contextText,
                provider: this._selectedProvider,
                model: this._selectedProvider === 'ollama' ? 'qwen2.5-coder:14b' : undefined,
                useRag: true,
                ragLimit: 3,
                ragScoreThreshold: 0.5
            });
            const response = chatResponse.message;

            // AI 응답 히스토리 추가
            this._chatHistory.push({ role: 'assistant', content: response });

            // UI에 AI 응답 표시
            this._postMessage({
                command: 'addMessage',
                role: 'assistant',
                content: response
            });

        } catch (error: any) {
            this._postMessage({
                command: 'addMessage',
                role: 'error',
                content: `❌ 오류: ${error.message || '서버 연결 실패'}`
            });
        } finally {
            this._postMessage({ command: 'setLoading', value: false });
        }
    }

    private async _handleIndexFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this._postMessage({
                command: 'addMessage',
                role: 'system',
                content: '⚠️ 열린 파일이 없습니다.'
            });
            return;
        }

        const filePath = editor.document.fileName;
        const fileContent = editor.document.getText();

        this._postMessage({ command: 'setLoading', value: true });

        try {
            await internalClient.indexCode({
                id: filePath,
                code: fileContent,
                filePath: filePath,
                language: filePath.split('.').pop() || 'unknown'
            });
            this._postMessage({
                command: 'addMessage',
                role: 'system',
                content: `✅ 인덱싱 완료: ${filePath.split('\\').pop()}`
            });
        } catch (error: any) {
            this._postMessage({
                command: 'addMessage',
                role: 'error',
                content: `❌ 인덱싱 실패: ${error.message}`
            });
        } finally {
            this._postMessage({ command: 'setLoading', value: false });
        }
    }

    private async _checkServerHealth() {
        const isHealthy = await internalClient.health();
        this._postMessage({
            command: 'setServerStatus',
            healthy: isHealthy
        });
    }

    private _postMessage(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }
}