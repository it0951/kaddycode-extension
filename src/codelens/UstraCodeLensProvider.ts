import * as vscode from 'vscode';

/**
 * 함수/클래스/메서드 선언부 위에 CodeLens 버튼을 표시하는 Provider.
 * 표시 대상: function, class, method, interface, enum, arrow function 변수
 */
export class UstraCodeLensProvider implements vscode.CodeLensProvider {

    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    /** 설정 변경 시 CodeLens 갱신 트리거 */
    refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] {
        const config = vscode.workspace.getConfiguration('ustracode');
        const apiKey = config.get<string>('apiKey', '');

        // API Key 미설정 시 CodeLens 미표시
        if (!apiKey || apiKey.trim() === '') {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!isTargetLine(line, document.languageId)) { continue; }

            const range = new vscode.Range(i, 0, i, line.length);

            // 로고 + 브랜드 텍스트 (클릭 시 채팅창 포커스)
            codeLenses.push(makeCodeLens(range, 'open', 'U| UstraCode'));
            // 구분자
            codeLenses.push(makeCodeLens(range, 'noop', '·'));
            // 4개 버튼
            codeLenses.push(makeCodeLens(range, 'explain', '💬 Explain'));
            codeLenses.push(makeCodeLens(range, 'fix',     '✏️ Fix'));
            codeLenses.push(makeCodeLens(range, 'ask', 'Q Ask'));
            codeLenses.push(makeCodeLens(range, 'doc',     '📝 Doc'));
        }

        return codeLenses;
    }
}

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function makeCodeLens(
    range: vscode.Range,
    action: string,
    label: string
): vscode.CodeLens {
    return new vscode.CodeLens(range, {
        title: label,
        command: `ustracode.codeLens.${action}`,
        arguments: [range],
    });
}

/**
 * 언어별로 CodeLens를 붙일 대상 라인인지 판단.
 * 너무 많이 표시되지 않도록 함수/클래스/메서드 선언부만 타겟.
 */
function isTargetLine(line: string, langId: string): boolean {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) {
        return false;
    }

    const patterns: Record<string, RegExp[]> = {
        // Java / Kotlin / C#
        java:       [/^(public|protected|private|static|final|abstract|default).*\(.*\)\s*(throws\s+\w+)?\s*\{?\s*$/,
            /^(public|protected|private)?\s*(class|interface|enum|record)\s+\w+/],
        kotlin:     [/^(fun\s+\w+|class\s+\w+|object\s+\w+|interface\s+\w+)/,
            /^(override\s+fun|private\s+fun|public\s+fun|suspend\s+fun)/],
        csharp:     [/^(public|private|protected|static|override|async|virtual).*\(.*\)\s*(\{|=>)?\s*$/,
            /^(public|private|protected|internal)?\s*(class|interface|enum|struct)\s+\w+/],
        // TypeScript / JavaScript
        typescript: [/^(export\s+)?(async\s+)?function\s+\w+/,
            /^(export\s+)?(abstract\s+)?(class|interface|enum|type)\s+\w+/,
            /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(.*\)\s*=>/,
            /^\s*(public|private|protected|static|async|override).*\(.*\)\s*[:{]/],
        javascript: [/^(export\s+)?(async\s+)?function\s+\w+/,
            /^(export\s+)?class\s+\w+/,
            /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(.*\)\s*=>/],
        // Python
        python:     [/^(def |async def |class )/],
        // Go
        go:         [/^func\s+(\(\w+\s+\*?\w+\)\s+)?\w+\(/,
            /^type\s+\w+\s+(struct|interface)\s*\{/],
        // Rust
        rust:       [/^(pub\s+)?(async\s+)?fn\s+\w+/,
            /^(pub\s+)?(struct|enum|trait|impl)\s+\w+/],
    };

    const applicable = patterns[langId] ?? patterns['typescript'];
    return applicable.some(re => re.test(trimmed));
}