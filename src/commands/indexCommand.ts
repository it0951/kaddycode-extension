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
        <html lang="ko">
        <head>
        <meta charset="UTF-8"/>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #1e1e2e; color: #cdd6f4; }
          h3 { color: #89b4fa; margin-bottom: 4px; }
          .meta { color: #6c7086; font-size: 12px; margin-bottom: 16px; }
          .card { background: #2a2a3e; border: 1px solid #313244; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
          .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
          .score { background: #1E6FFF33; color: #60a5fa; border: 1px solid #1E6FFF55; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; }
          .lang  { background: #a78bfa22; color: #a78bfa; border: 1px solid #a78bfa44; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
          .path  { color: #6c7086; font-size: 11px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          pre { background: #181825; border: 1px solid #313244; border-radius: 6px; padding: 10px; overflow-x: auto; font-size: 12px; line-height: 1.5; color: #cdd6f4; margin: 0; white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto; }
          .empty { text-align: center; padding: 40px; color: #6c7086; }
        </style>
        </head>
        <body>
          <h3>🔍 "${query}"</h3>
          <div class="meta">검색 결과 ${results.length}개</div>
          ${results.map((r, i) => `
            <div class="card">
              <div class="card-header">
                <span class="score">${(r.score * 100).toFixed(1)}% 일치</span>
                <span class="lang">${r.language}</span>
                <span class="path" title="${r.filePath}">${r.filePath.replace(/\\\\/g, '/').split('/').pop()}</span>
              </div>
              <pre>${r.code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
            </div>
          `).join('')}
        </body>
        </html>`;
    } catch (error) {
        vscode.window.showErrorMessage('검색 실패. Internal Server를 확인하세요.');
    }
}