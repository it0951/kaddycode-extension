import * as vscode from 'vscode';
import { ChatViewProvider } from './panels/ChatPanel';
import { indexCurrentFile, searchCode } from './commands/indexCommand';

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
		vscode.commands.registerCommand('ustracode.chat', () => {
			vscode.commands.executeCommand('ustracode.chatView.focus');
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
}

export function deactivate() {}