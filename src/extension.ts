import * as vscode from 'vscode';
import { ChatViewProvider } from './panels/ChatPanel';
import { indexCurrentFile, searchCode } from './commands/indexCommand';
import { internalClient } from './api/internalClient';
import { UstraCodeLensProvider } from './codelens/UstraCodeLensProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('UstraCode 활성화됨');

	// 사이드바 WebView 프로바이더 등록
	const provider = new ChatViewProvider(context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ChatViewProvider.viewType,
			provider,
			{ webviewOptions: { retainContextWhenHidden: true } }
		)
	);

	// ── CodeLens Provider 등록 ─────────────────────────────────────────────
	const codeLensProvider = new UstraCodeLensProvider();

	const supportedLanguages = [
		'typescript', 'javascript', 'java', 'python', 'go',
		'rust', 'kotlin', 'csharp', 'cpp', 'c',
	];

	for (const lang of supportedLanguages) {
		context.subscriptions.push(
			vscode.languages.registerCodeLensProvider(
				{ language: lang, scheme: 'file' },
				codeLensProvider
			)
		);
	}

	// 설정 변경 시 CodeLens 갱신
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('ustracode')) {
				codeLensProvider.refresh();
			}
		})
	);

	// ── CodeLens 액션 커맨드 ───────────────────────────────────────────────
	/**
	 * CodeLens 클릭 → 현재 커서 위치 기준으로 함수/블록 코드 추출
	 * → 사이드바 패널에 프롬프트 전송
	 */
	const codeLensActions: Record<string, { label: string; buildPrompt: (lang: string, code: string, fullFileContent?: string) => string; inputPreset?: (lang: string, code: string) => string }> = {
		open: {
			label: 'UstraCode',
			buildPrompt: () => '',  // 프롬프트 없음
		},
		noop: {
			label: '',
			buildPrompt: () => '',  // 아무것도 안 함
		},
		explain: {
			label: '💬 코드 설명',
			buildPrompt: (lang, code) =>
				`다음 ${lang} 코드를 상세하게 설명해주세요:\n\`\`\`${lang}\n${code}\n\`\`\``,
		},
		fix: {
			label: '✏️ 코드 수정/리팩토링',
			buildPrompt: (lang, code, fullFileContent?) =>
				`다음은 전체 파일 내용입니다:\n\`\`\`${lang}\n${fullFileContent || code}\n\`\`\`\n\n` +
				`위 파일에서 아래 메서드/함수의 문제점을 찾아 개선해주세요.\n` +
				`반드시 해당 메서드/함수 코드만 반환하고, import문이나 클래스 선언은 포함하지 마세요:\n\`\`\`${lang}\n${code}\n\`\`\``,
		},
		ask: {
			label: 'Q AI에게 질문',
			buildPrompt: (lang, code) => '',   // 직접 전송 안 함 — input에 코드만 세팅
			inputPreset: (lang, code) =>
				`다음 ${lang} 코드에 대해 질문이 있습니다:\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`,
		},
		doc: {
			label: '📝 주석 생성',
			buildPrompt: (lang, code, fullFileContent?) =>
				`다음은 전체 파일 내용입니다:\n\`\`\`${lang}\n${fullFileContent || code}\n\`\`\`\n\n` +
				`위 파일에서 아래 메서드/함수에 적절한 주석(JavaDoc/JSDoc/docstring 등 언어에 맞는 형식)을 추가해주세요.\n` +
				`반드시 해당 메서드/함수 코드만 반환하고, import문이나 클래스 선언은 포함하지 마세요:\n\`\`\`${lang}\n${code}\n\`\`\``,
		},
	};

	for (const [actionKey, actionDef] of Object.entries(codeLensActions)) {
		context.subscriptions.push(
			vscode.commands.registerCommand(
				`ustracode.codeLens.${actionKey}`,
				async (range: vscode.Range) => {
					const editor = vscode.window.activeTextEditor;
					if (!editor) { return; }

					// open: 채팅창 포커스만
					if (actionKey === 'open') {
						await vscode.commands.executeCommand('ustracode.chatView.focus');
						return;
					}
					// noop: 아무것도 안 함
					if (actionKey === 'noop') { return; }

					// 1. CodeLens 클릭 위치 기준으로 코드 블록 추출
					const code = extractCodeBlock(editor.document, range.start.line);
					const language = editor.document.languageId;
					// fix/doc은 전체 파일 컨텍스트 포함
					const fullFileContent = (actionKey === 'fix' || actionKey === 'doc')
						? editor.document.getText()
						: undefined;

					// 2. 사이드바 패널 포커스
					await vscode.commands.executeCommand('ustracode.chatView.focus');

					// 3. WebView가 포커스된 후 provider/model 동기화 요청
					// WebView ready 이후 동기화되도록 약간 대기
					await new Promise(resolve => setTimeout(resolve, 150));

					// 4. Fix/Doc 액션이면 "적용 가능한 응답" 플래그 포함하여 전송
					const isApplicable = actionKey === 'fix' || actionKey === 'doc';
					const prompt = actionDef.buildPrompt(language, code, fullFileContent);

					// ask는 input창에 세팅 후 사용자가 직접 전송
					if (actionKey === 'ask' && actionDef.inputPreset) {
						const preset = actionDef.inputPreset(language, code);
						provider.sendCodeToChat(preset);  // input창에 코드 세팅
						return;
					}

					provider.sendCodeLensAction({
						actionKey,
						label: actionDef.label,
						prompt,
						language,
						originalCode: code,
						allowApply: isApplicable,
						applyRange: isApplicable
							? getCodeBlockRange(editor.document, range.start.line)
							: undefined,
					});
				}
			)
		);
	}

	// ── 기존 커맨드 ────────────────────────────────────────────────────────
	context.subscriptions.push(
		vscode.commands.registerCommand('ustracode.chat', async () => {
			await vscode.commands.executeCommand('ustracode.chatView.focus');

			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }

			const selection = editor.selection;
			const selectedText = editor.document.getText(selection);
			if (!selectedText || selectedText.trim() === '') {
				vscode.window.showInformationMessage('코드를 선택한 후 사용하세요.');
				return;
			}

			const language = editor.document.languageId;
			// 수정 후 — 코드만 input에 세팅, prefix 제거
			const message = `\`\`\`${language}\n${selectedText}\n\`\`\`\n\n`;
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

		if (!autoIndex || !apiKey || apiKey.trim() === '') { return; }

		const text = document.getText();
		if (text.length > 100000) { return; }

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

// ── 코드 블록 추출 헬퍼 ────────────────────────────────────────────────────

/**
 * 지정 라인부터 시작하는 함수/클래스 블록을 추출.
 * 중괄호 depth 추적 방식 (Java/TS/JS/Go/Rust/Kotlin 등에 적용 가능).
 * Python은 들여쓰기 기준으로 추출.
 */
function extractCodeBlock(document: vscode.TextDocument, startLine: number): string {
	const totalLines = document.lineCount;
	const lines: string[] = [];
	const langId = document.languageId;

	if (langId === 'python') {
		// Python: 들여쓰기 기준
		const startIndent = getIndent(document.lineAt(startLine).text);
		lines.push(document.lineAt(startLine).text);
		for (let i = startLine + 1; i < Math.min(startLine + 150, totalLines); i++) {
			const line = document.lineAt(i).text;
			if (line.trim() === '') { lines.push(line); continue; }
			if (getIndent(line) <= startIndent && line.trim() !== '') { break; }
			lines.push(line);
		}
		return lines.join('\n');
	}

	// 중괄호 언어
	let depth = 0;
	let started = false;

	for (let i = startLine; i < Math.min(startLine + 200, totalLines); i++) {
		const line = document.lineAt(i).text;
		lines.push(line);

		for (const ch of line) {
			if (ch === '{') { depth++; started = true; }
			else if (ch === '}') { depth--; }
		}

		if (started && depth <= 0) { break; }
	}

	// 중괄호가 없는 단일 라인 (예: 인터페이스 메서드 선언)
	return lines.join('\n') || document.lineAt(startLine).text;
}

/**
 * 에디터에서 교체할 Range 계산 (extractCodeBlock과 동일 로직, Range 반환).
 */
// ▲▲▲ 전체를 아래로 교체
function getCodeBlockRange(document: vscode.TextDocument, startLine: number): vscode.Range {
	const totalLines = document.lineCount;
	const langId = document.languageId;
	let endLine = startLine;

	if (langId === 'python') {
		const startIndent = getIndent(document.lineAt(startLine).text);
		for (let i = startLine + 1; i < Math.min(startLine + 150, totalLines); i++) {
			const line = document.lineAt(i).text;
			if (line.trim() !== '' && getIndent(line) <= startIndent) { break; }
			endLine = i;
		}
	} else {
		let depth = 0;
		let started = false;
		for (let i = startLine; i < Math.min(startLine + 200, totalLines); i++) {
			const line = document.lineAt(i).text;
			for (const ch of line) {
				if (ch === '{') { depth++; started = true; }
				else if (ch === '}') { depth--; }
			}
			endLine = i;
			// depth가 1→0이 되는 순간 = 첫 번째 블록 닫힘 = 메서드/함수 끝
			if (started && depth <= 0) { break; }
		}
	}

	// 시작 라인이 어노테이션(@Override 등)이면 위로 올라가서 포함
	let actualStart = startLine;
	// 빈 줄은 건너뛰되 어노테이션만 포함, } 만나면 즉시 중단
	for (let i = startLine - 1; i >= Math.max(0, startLine - 5); i--) {
		const trimmed = document.lineAt(i).text.trim();
		if (trimmed.startsWith('@')) {
			actualStart = i;  // 어노테이션만 포함
		} else if (trimmed === '') {
			continue;         // 빈 줄은 건너뜀
		} else {
			break;            // 다른 코드 만나면 즉시 중단
		}
	}

	return new vscode.Range(
		actualStart, 0,
		endLine, document.lineAt(endLine).text.length
	);
}

function getIndent(line: string): number {
	return line.length - line.trimStart().length;
}