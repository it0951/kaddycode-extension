import * as vscode from 'vscode';
import { internalClient, getUserId } from '../api/internalClient';
import { getWebviewContent } from './chatWebview';

// CodeLens 액션 페이로드 타입
export interface CodeLensActionPayload {
    actionKey: string;       // 'explain' | 'fix' | 'ask' | 'doc'
    label: string;           // UI 표시용 레이블
    prompt: string;          // AI에 전송할 프롬프트
    language: string;        // 프로그래밍 언어
    originalCode: string;    // 원본 코드 (미사용 시 대비)
    allowApply: boolean;     // [소스에 적용] 버튼 표시 여부 (fix/doc만 true)
    applyRange?: vscode.Range; // 에디터 교체 범위
}

export class ChatViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'kaddycode.chatView';
    private _view?: vscode.WebviewView;
    private _chatHistory: { role: string; content: string }[] = [];

    private _currentProvider: string = '';
    private _currentModel: string = '';

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
                        'workbench.action.openSettings', 'kaddycode'
                    );
                    break;
                case 'syncProviderModel':
                    this._currentProvider = message.provider || '';
                    this._currentModel    = message.model    || '';
                    break;
                case 'executeCodeLensAction':
                    this._postMessage({
                        command: 'addMessage',
                        role:    'system',
                        content: `🔍 **${message.label}** (${message.language})`,
                    });
                    this._handleChat(
                        message.prompt,
                        message.provider,
                        message.model,
                        true,
                        {
                            allowApply: message.allowApply,
                            applyRange: this._pendingApplyRange,
                        }
                    );
                    this._pendingApplyRange = undefined;
                    break;
            }
        });

        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('kaddycode')) {
                await this._sendCurrentSettings();
                await this._checkServerHealth();
            }
        });
    }

    private async _handleChat(
        text: string,
        provider?: string,
        model?: string,
        bypassCache?: boolean,
        // CodeLens 전용 옵션
        codeLensOpts?: { allowApply: boolean; applyRange?: vscode.Range }
    ) {
        if (!text.trim()) { return; }

        this._chatHistory.push({ role: 'user', content: text });

        // YOU 버블 표시용 — 전체 프롬프트 대신 핵심만 표시
        let displayText = text;
        if (codeLensOpts?.allowApply) {
            // Fix/Doc: 선택 코드만 표시 (전체 파일 컨텍스트, 프롬프트 지시문 제거)
            const selCodeMatch = text.match(/\[선택된 코드\]\n```[\s\S]*?```/);
            displayText = selCodeMatch ? selCodeMatch[0] : text;
        } else if (!codeLensOpts) {
            // 일반 채팅: [선택된 코드] + [질문] 구조면 질문만 표시
            const questionMatch = text.match(/\[질문\]\n([\s\S]+)$/);
            if (questionMatch) {
                displayText = questionMatch[1].trim();
            }
        }
        this._postMessage({ command: 'addMessage', role: 'user', content: displayText });

        this._postMessage({ command: 'setLoading', value: true });

        try {
            const editor = vscode.window.activeTextEditor;
            let contextText = text;

            // 일반 채팅 시에만 선택 코드 자동 첨부 (CodeLens는 이미 프롬프트에 포함됨)
            if (!codeLensOpts && editor) {
                const selectedText = editor.document.getText(editor.selection);
                if (selectedText) {
                    contextText = `[선택된 코드]\n\`\`\`\n${selectedText}\n\`\`\`\n\n[질문]\n${text}`;
                }
            }

            const settings = internalClient.getSettings();
            const chatResponse = await internalClient.chat({
                userId:            getUserId(),
                message:           contextText,
                provider:          provider || settings.defaultProvider,
                model:             model    || settings.defaultModel,
                useRag:            settings.ragEnabled,
                ragLimit:          3,
                ragScoreThreshold: 0.5,
                bypassCache:       bypassCache || false,
            });

            const assistantMsg = chatResponse.message;
            this._chatHistory.push({ role: 'assistant', content: assistantMsg });

            this._postMessage({
                command:    'addMessage',
                role:       'assistant',
                content:    assistantMsg,
                ragUsed:    chatResponse.ragUsed,
                references: chatResponse.references,
                model:      chatResponse.model,
            });

            // Fix/Doc 응답 → diff 미리보기 (참고용)
            if (codeLensOpts?.allowApply && codeLensOpts.applyRange) {
                const editor = vscode.window.activeTextEditor;
                const originalCode = editor
                    ? editor.document.getText(codeLensOpts.applyRange)
                    : '';
                const extractedCode = extractCodeFromMarkdown(assistantMsg);
                if (extractedCode && originalCode) {
                    this._postMessage({
                        command:      'showDiffPreview',
                        originalCode: originalCode,
                        newCode:      extractedCode,
                    });
                }
            }

        } catch (error: any) {
            // 오류 시 pending apply 초기화 (이전 Fix 요청 잔재 제거)
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
            command:         'setApiKeyStatus',
            valid:           result.valid,
            tenantName:      result.tenantName,
            apiKeys:         result.tenantInfo?.apiKeys || [],
            activeProviders: result.tenantInfo?.activeProviders || [],
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
            userId:          s.userId,
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

    // applyRange 임시 보관 (sendCodeLensAction → executeCodeLensAction 간 전달)
    private _pendingApplyRange?: vscode.Range;

    /** 기존 우클릭 → 채팅창 전송 */
    public sendCodeToChat(message: string) {
        this._postMessage({ command: 'setInputText', text: message });
    }

    /**
     * CodeLens 버튼 클릭 → 사이드바에 AI 응답 표시
     * Fix/Doc인 경우 응답 후 [✅ 소스에 적용] 버튼 표시
     */
    public sendCodeLensAction(payload: CodeLensActionPayload) {

        // WebView에 codeLens 액션 페이로드를 전달하고
        // WebView가 현재 선택된 provider/model을 포함해서 응답하도록 요청
        this._postMessage({
            command:    'requestCodeLensAction',
            payload:    {
                actionKey:    payload.actionKey,
                label:        payload.label,
                prompt:       payload.prompt,
                language:     payload.language,
                originalCode: payload.originalCode,
                allowApply:   payload.allowApply,
            }
        });

        if (payload.allowApply && payload.applyRange) {
            this._pendingApplyRange = payload.applyRange;
        }
    }
}

// ── 헬퍼: AI 응답에서 코드 블록 추출 ─────────────────────────────────────
/**
 * 마크다운 응답에서 마지막 코드 블록을 추출.
 * Fix/Doc 프롬프트에서 "수정된 전체 코드 블록을 마지막에 제공해주세요"라고
 * 명시했으므로 마지막 블록이 적용 대상.
 */
function extractCodeFromMarkdown(markdown: string): string | null {
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(markdown)) !== null) {
        matches.push(match[1]);
    }

    if (matches.length === 0) { return null; }

    const longest = matches.reduce((a, b) => a.length >= b.length ? a : b);
    let code = longest.replace(/\n$/, '');

    // import문 제거 (java/kotlin/ts/js)
    code = code.replace(/^import\s+[\w.*{},'"\s]+;\s*\n/gm, '');
    code = code.replace(/^import\s+[\w.*{},'"\s]+\n/gm, '');

    // package 선언 제거 (java/kotlin)
    code = code.replace(/^package\s+[\w.]+;\s*\n/gm, '');

    // 클래스/인터페이스 래퍼 제거
    // "public class Foo {" 로 시작하고 마지막 "}" 로 끝나는 경우
    const classWrapperRegex = /^(?:public\s+|private\s+|protected\s+)?(?:class|interface|enum)\s+\w+[\s\S]*?\{([\s\S]*)\}\s*$/;
    const classMatch = code.match(classWrapperRegex);
    if (classMatch) {
        // 클래스 바디만 추출 후 들여쓰기 제거
        code = classMatch[1]
            .split('\n')
            .map(line => line.replace(/^    /, '')) // 4스페이스 들여쓰기 제거
            .join('\n')
            .trim();
    }

    return code.trim();
}