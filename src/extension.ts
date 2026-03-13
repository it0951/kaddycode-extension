import * as vscode from 'vscode';
import { chatCommand } from './commands/chatCommand';
import { indexCurrentFile, searchCode } from './commands/indexCommand';
import { internalClient } from './api/internalClient';

export function activate(context: vscode.ExtensionContext) {
	console.log('UstraCode 활성화됨');

	// 서버 상태 확인
	internalClient.health().then(isHealthy => {
		if (isHealthy) {
			vscode.window.showInformationMessage('✅ UstraCode: Internal Server 연결됨');
		} else {
			vscode.window.showWarningMessage('⚠️ UstraCode: Internal Server 연결 안됨. 서버를 시작하세요.');
		}
	});

	// 명령어 등록
	const commands = [
		vscode.commands.registerCommand('ustracode.chat', chatCommand),
		vscode.commands.registerCommand('ustracode.indexCurrentFile', indexCurrentFile),
		vscode.commands.registerCommand('ustracode.searchCode', searchCode),
	];

	context.subscriptions.push(...commands);
}

export function deactivate() {}