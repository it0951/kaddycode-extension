import * as vscode from 'vscode';
import { internalClient } from '../api/internalClient';
import * as crypto from 'crypto';

export async function indexCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('열린 파일이 없습니다.');
        return;
    }

    const document = editor.document;
    const code = document.getText();
    const filePath = document.fileName;
    const language = document.languageId;
    const id = crypto.createHash('md5').update(filePath).digest('hex');

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `${filePath} 인덱싱 중...`,
            cancellable: false,
        },
        async () => {
            try {
                await internalClient.indexCode({ id, code, filePath, language });
                vscode.window.showInformationMessage(`✅ 인덱싱 완료: ${filePath}`);
            } catch (error) {
                vscode.window.showErrorMessage('인덱싱 실패. Internal Server를 확인하세요.');
            }
        }
    );
}

export async function searchCode() {
    const query = await vscode.window.showInputBox({
        prompt: '검색할 코드 내용을 입력하세요',
        placeHolder: '예: 파일 읽기 함수',
    });

    if (!query) {
        return;
    }

    try {
        const results = await internalClient.searchCode({ query, limit: 5 });

        if (results.length === 0) {
            vscode.window.showInformationMessage('검색 결과가 없습니다.');
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'ustracode-search',
            'UstraCode 코드 검색',
            vscode.ViewColumn.Beside,
            {}
        );

        const resultHtml = results.map((r, i) => `
      <div style="border:1px solid #ddd; padding:12px; margin:8px 0; border-radius:6px;">
        <b>#${i + 1}</b> 유사도: ${(r.score * 100).toFixed(1)}% | 
        언어: ${r.language} | 
        파일: ${r.filePath}
        <pre style="background:#f5f5f5; padding:8px; margin-top:8px; overflow:auto;">${r.code}</pre>
      </div>
    `).join('');

        panel.webview.html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: sans-serif; padding: 20px;">
        <h3>🔍 검색어: "${query}"</h3>
        <p>검색 결과 ${results.length}개</p>
        ${resultHtml}
      </body>
      </html>
    `;
    } catch (error) {
        vscode.window.showErrorMessage('검색 실패. Internal Server를 확인하세요.');
    }
}