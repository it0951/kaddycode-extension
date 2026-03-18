import * as vscode from 'vscode';
import { ChatViewProvider } from './panels/ChatPanel';
import { indexCurrentFile, searchCode } from './commands/indexCommand';
import { internalClient } from './api/internalClient';

export function activate(context: vscode.ExtensionContext) {
	console.log('UstraCode 활성화됨');

	// 사이드바 WebView 프로바이더 등록
	const provider = new ChatViewProvider(context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ChatViewProvider.viewType,
			provider
		)
	);

	// 명령어 등록
	context.subscriptions.push(
		vscode.commands.registerCommand('ustracode.chat', async () => {
			// 1. 채팅창 포커스
			await vscode.commands.executeCommand('ustracode.chatView.focus');

			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }

			const selection = editor.selection;
			const selectedText = editor.document.getText(selection);
			if (!selectedText || selectedText.trim() === '') {
				vscode.window.showInformationMessage('코드를 선택한 후 사용하세요.');
				return;
			}

			// 2. 선택 코드를 채팅창으로 전송
			const language = editor.document.languageId;
			const message = `다음 ${language} 코드를 분석해주세요:\n\`\`\`${language}\n${selectedText}\n\`\`\``;
			provider.sendCodeToChat(message);
		}),
		vscode.commands.registerCommand('ustracode.indexCurrentFile', indexCurrentFile),
		vscode.commands.registerCommand('ustracode.searchCode', searchCode),
		vscode.commands.registerCommand('ustracode.openChat', () => {
			vscode.commands.executeCommand('ustracode.chatView.focus');
		}),
		vscode.commands.registerCommand('ustracode.openSettings', () => {
			vscode.commands.executeCommand(
				'workbench.action.openSettings', 'ustracode'
			);
		})
	);

	// ── 파일 저장 시 자동 인덱싱 ──────────────────────────────────────────
	const autoIndexDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
		const config = vscode.workspace.getConfiguration('ustracode');
		const autoIndex = config.get<boolean>('autoIndexOnSave', false);
		const apiKey = config.get<string>('apiKey', '');

		// autoIndexOnSave 가 꺼져 있거나 API Key 미설정 시 스킵
		if (!autoIndex || !apiKey || apiKey.trim() === '') { return; }

		// 너무 큰 파일 스킵 (100KB 초과)
		const text = document.getText();
		if (text.length > 100000) { return; }

		// 지원 언어 필터 (바이너리·설정 파일 제외)
		const supportedLangs = [
			'typescript', 'javascript', 'java', 'python', 'go',
			'rust', 'cpp', 'c', 'csharp', 'kotlin', 'swift',
			'html', 'css', 'scss', 'vue', 'xml', 'yaml', 'json'
		];
		if (!supportedLangs.includes(document.languageId)) { return; }

		try {
			await internalClient.indexCode({
				id:       document.fileName,
				code:     text,
				filePath: document.fileName,
				language: document.languageId,
			});
			console.log(`[UstraCode] 자동 인덱싱 완료: ${document.fileName}`);
		} catch (e) {
			console.warn(`[UstraCode] 자동 인덱싱 실패: ${e}`);
		}
	});

	context.subscriptions.push(autoIndexDisposable);
}

export function deactivate() {}