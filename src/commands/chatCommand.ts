import * as vscode from 'vscode';
import { internalClient } from '../api/internalClient';

export async function chatCommand() {
    const userMessage = await vscode.window.showInputBox({
        prompt: 'UstraCode에게 질문하세요',
        placeHolder: '예: 이 코드를 설명해줘',
    });

    if (!userMessage) {
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'UstraCode 응답 생성 중...',
            cancellable: false,
        },
        async () => {
            try {
                const response = await internalClient.chat({
                    userId: 'developer',
                    message: userMessage,
                    model: 'qwen2.5-coder:14b',
                });

                const panel = vscode.window.createWebviewPanel(
                    'ustracode-chat',
                    'UstraCode Chat',
                    vscode.ViewColumn.Beside,
                    {}
                );

                panel.webview.html = `
          <!DOCTYPE html>
          <html>
          <body style="font-family: sans-serif; padding: 20px;">
            <h3>💬 질문</h3>
            <p>${userMessage}</p>
            <h3>🤖 UstraCode 답변</h3>
            <pre style="white-space: pre-wrap;">${response.message}</pre>
            <small>모델: ${response.model} | ${response.createdAt}</small>
          </body>
          </html>
        `;
            } catch (error) {
                vscode.window.showErrorMessage('Internal Server 연결 실패. 서버가 실행 중인지 확인하세요.');
            }
        }
    );
}