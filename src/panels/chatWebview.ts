export function getWebviewContent(): string {
    // language=JavaScript
    return `<!DOCTYPE html>
    <html lang="ko">
        <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>UstraCode</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: var(--vscode-sideBar-background);
        color: var(--vscode-foreground);
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

        /* 헤더 */
        .header {
        padding: 10px 12px 8px;
        border-bottom: 1px solid var(--vscode-panel-border);
        background: var(--vscode-sideBar-background);
    }

        .header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
    }

        .logo {
        display: flex;
        align-items: center;
        gap: 6px;
    }

        .logo-badge {
        width: 22px;
        height: 22px;
        background: #1E6FFF;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
        color: white;
    }

        .logo-text {
        font-size: 13px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

        .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #6b7280;
        transition: background 0.3s;
    }

        .status-dot.online { background: #10b981; }
        .status-dot.offline { background: #ef4444; }

        /* 프로바이더 선택 */
        .provider-select {
        width: 100%;
        padding: 5px 8px;
        background: var(--vscode-dropdown-background);
        color: var(--vscode-dropdown-foreground);
        border: 1px solid var(--vscode-dropdown-border);
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        outline: none;
    }

        .provider-select:focus {
        border-color: #1E6FFF;
    }

        /* 채팅 영역 */
        .chat-container {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

        .chat-container::-webkit-scrollbar { width: 4px; }
        .chat-container::-webkit-scrollbar-thumb {
        background: var(--vscode-scrollbarSlider-background);
        border-radius: 2px;
    }

        /* 웰컴 메시지 */
        .welcome {
        text-align: center;
        padding: 24px 12px;
        color: var(--vscode-descriptionForeground);
    }

        .welcome-icon {
        font-size: 28px;
        margin-bottom: 8px;
    }

        .welcome-title {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 4px;
        color: var(--vscode-foreground);
    }

        .welcome-desc {
        font-size: 11px;
        line-height: 1.5;
    }

        /* 메시지 버블 */
        .message {
        display: flex;
        flex-direction: column;
        gap: 2px;
        animation: fadeIn 0.2s ease;
    }

        @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
    }

        .message-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 0 2px;
    }

        .message.user .message-label { color: #1E6FFF; text-align: right; }
        .message.assistant .message-label { color: #10b981; }
        .message.system .message-label, .message.error .message-label { color: #f59e0b; }

        .message-bubble {
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 12px;
        line-height: 1.6;
        word-break: break-word;
        white-space: pre-wrap;
    }

        .message.user .message-bubble {
        background: #1E6FFF22;
        border: 1px solid #1E6FFF44;
        border-radius: 8px 2px 8px 8px;
        text-align: right;
    }

        .message.assistant .message-bubble {
        background: var(--vscode-editor-inactiveSelectionBackground);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 2px 8px 8px 8px;
    }

        .message.system .message-bubble, .message.error .message-bubble {
        background: #f59e0b11;
        border: 1px solid #f59e0b33;
        border-radius: 6px;
        font-size: 11px;
    }

        .message.error .message-bubble {
        background: #ef444411;
        border-color: #ef444433;
    }

        /* 코드 블록 */
        .message-bubble code {
        font-family: 'Consolas', 'Monaco', monospace;
        background: var(--vscode-textCodeBlock-background);
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 11px;
    }

        .message-bubble pre {
        background: var(--vscode-textCodeBlock-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        padding: 8px 10px;
        margin: 4px 0;
        overflow-x: auto;
        font-size: 11px;
        font-family: 'Consolas', 'Monaco', monospace;
        line-height: 1.5;
    }

        .message-bubble pre code {
        background: transparent;
        padding: 0;
    }

        /* 로딩 */
        .loading {
        display: none;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
    }

        .loading.active { display: flex; }

        .loading-dots {
        display: flex;
        gap: 3px;
    }

        .loading-dots span {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #1E6FFF;
        animation: bounce 1.2s infinite;
    }

        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bounce {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
        40% { transform: scale(1); opacity: 1; }
    }

        /* 입력 영역 */
        .input-area {
        padding: 8px 12px 12px;
        border-top: 1px solid var(--vscode-panel-border);
        background: var(--vscode-sideBar-background);
    }

        .input-wrapper {
        display: flex;
        gap: 6px;
        align-items: flex-end;
    }

        .input-box {
        flex: 1;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 6px;
        padding: 7px 10px;
        font-size: 12px;
        font-family: inherit;
        resize: none;
        outline: none;
        min-height: 34px;
        max-height: 100px;
        line-height: 1.4;
        transition: border-color 0.2s;
    }

        .input-box:focus { border-color: #1E6FFF; }
        .input-box::placeholder { color: var(--vscode-input-placeholderForeground); }

        .btn-send {
        width: 32px;
        height: 32px;
        background: #1E6FFF;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 0.2s, transform 0.1s;
    }

        .btn-send:hover { background: #1558cc; }
        .btn-send:active { transform: scale(0.95); }
        .btn-send:disabled { background: #6b7280; cursor: not-allowed; }

        .btn-send svg {
        width: 14px;
        height: 14px;
        fill: white;
    }

        /* 하단 액션 버튼 */
        .action-buttons {
        display: flex;
        gap: 6px;
        margin-top: 6px;
    }

        .btn-action {
        flex: 1;
        padding: 5px;
        background: transparent;
        border: 1px solid var(--vscode-button-secondaryBackground, #3a3a3a);
        border-radius: 4px;
        color: var(--vscode-descriptionForeground);
        font-size: 10px;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s;
    }

        .btn-action:hover {
        background: var(--vscode-button-secondaryHoverBackground);
        color: var(--vscode-foreground);
        border-color: #1E6FFF;
    }
    </style>
    </head>
    <body>

    <!-- 헤더 -->
    <div class="header">
        <div class="header-top">
            <div class="logo">
                <div class="logo-badge">U</div>
                <span class="logo-text">UstraCode</span>
            </div>
            <div class="status-dot" id="statusDot" title="서버 상태"></div>
        </div>
        <select class="provider-select" id="providerSelect">
            <option value="ollama">🤖 Ollama (로컬)</option>
            <option value="openai">⚡ OpenAI</option>
            <option value="claude">✨ Claude (Anthropic)</option>
            <option value="gemini">🌟 Gemini (Google)</option>
        </select>
        <select class="provider-select" id="modelSelect" style="margin-top:5px;">
            <option value="qwen2.5-coder:7b">qwen2.5-coder:7b (기본)</option>
            <option value="qwen2.5-coder:14b">qwen2.5-coder:14b</option>
            <option value="llama3.2">llama3.2</option>
            <option value="deepseek-coder">deepseek-coder</option>
        </select>
    </div>

    <!-- 채팅 영역 -->
    <div class="chat-container" id="chatContainer">
        <div class="welcome" id="welcomeMsg">
            <div class="welcome-icon">💬</div>
            <div class="welcome-title">UstraCode AI Assistant</div>
            <div class="welcome-desc">코드를 선택하고 질문하거나<br>파일을 인덱싱하여 RAG 검색을 활용하세요</div>
        </div>
    </div>

    <!-- 로딩 -->
    <div class="loading" id="loadingIndicator">
        <div class="loading-dots">
            <span></span><span></span><span></span>
        </div>
        <span>AI가 응답 중...</span>
    </div>

    <!-- 입력 영역 -->
    <div class="input-area">
        <div class="input-wrapper">
            <textarea
                class="input-box"
                id="inputBox"
                placeholder="질문을 입력하세요... (Shift+Enter: 줄바꿈)"
                rows="1"
            ></textarea>
            <button class="btn-send" id="sendBtn" title="전송 (Enter)">
                <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
            </button>
        </div>
        <div class="action-buttons">
            <button class="btn-action" id="indexBtn">📎 현재 파일 인덱싱</button>
            <button class="btn-action" id="clearBtn">🗑️ 대화 초기화</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const chatContainer = document.getElementById('chatContainer');
        const inputBox = document.getElementById('inputBox');
        const sendBtn = document.getElementById('sendBtn');
        const loadingIndicator = document.getElementById('loadingIndicator');
        const statusDot = document.getElementById('statusDot');
        const providerSelect = document.getElementById('providerSelect');
        const welcomeMsg = document.getElementById('welcomeMsg');

        // 초기화
        vscode.postMessage({ command: 'ready' });

        // 프로바이더별 모델 목록
        const providerModels = {
        ollama: [
    { value: 'qwen2.5-coder:7b', label: 'qwen2.5-coder:7b (기본)' },
    { value: 'qwen2.5-coder:14b', label: 'qwen2.5-coder:14b' },
    { value: 'llama3.2', label: 'llama3.2' },
    { value: 'deepseek-coder', label: 'deepseek-coder' }
        ],
        openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
        ],
        claude: [
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' }
        ],
        gemini: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (기본)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' }
        ],
    };

        const modelSelect = document.getElementById('modelSelect');

        // 프로바이더 변경 시 모델 목록 갱신
        providerSelect.addEventListener('change', () => {
        const models = providerModels[providerSelect.value] || [];
        modelSelect.innerHTML = models
        .map(function(m) { return '<option value="' + m.value + '">' + m.label + '</option>'; })
        .join('');
    });

        // Extension → WebView 메시지 수신
        window.addEventListener('message', (event) => {
        const msg = event.data;
        switch (msg.command) {
        case 'addMessage':
        addMessage(msg.role, msg.content);
        break;
        case 'setLoading':
        setLoading(msg.value);
        break;
        case 'setServerStatus':
        statusDot.className = 'status-dot ' + (msg.healthy ? 'online' : 'offline');
        statusDot.title = msg.healthy ? '서버 연결됨' : '서버 연결 안됨';
        break;
        case 'clearHistory':
        clearChat();
        break;
    }
    });

        // 메시지 추가
        function addMessage(role, content) {
        if (welcomeMsg) welcomeMsg.style.display = 'none';

        const div = document.createElement('div');
        div.className = 'message ' + role;

        const label = document.createElement('div');
        label.className = 'message-label';
        label.textContent = role === 'user' ? 'You' : role === 'assistant' ? 'AI' : 'System';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerHTML = formatContent(content);

        div.appendChild(label);
        div.appendChild(bubble);
        chatContainer.appendChild(div);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

        // 코드 블록 파싱
        function formatContent(text) {
        return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\`\`\`(\\w*)?\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>')
        .replace(/\`([^\`]+)\`/g, '<code>$1</code>');
    }

        // 로딩 상태
        function setLoading(active) {
        loadingIndicator.className = 'loading' + (active ? ' active' : '');
        sendBtn.disabled = active;
    }

        // 채팅 초기화
        function clearChat() {
        chatContainer.innerHTML = '';
        chatContainer.appendChild(welcomeMsg);
        welcomeMsg.style.display = '';
    }

        // 전송
        function sendMessage() {
        const text = inputBox.value.trim();
        if (!text || sendBtn.disabled) return;

        const provider = providerSelect.value;
        const model = modelSelect.value;
        vscode.postMessage({ command: 'sendMessage', text, provider, model });

        inputBox.value = '';
        inputBox.style.height = 'auto';
    }

        // 이벤트
        sendBtn.addEventListener('click', sendMessage);

        inputBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
    });

        inputBox.addEventListener('input', () => {
        inputBox.style.height = 'auto';
        inputBox.style.height = Math.min(inputBox.scrollHeight, 100) + 'px';
    });

        document.getElementById('indexBtn').addEventListener('click', () => {
        vscode.postMessage({ command: 'indexFile' });
    });

        document.getElementById('clearBtn').addEventListener('click', () => {
        vscode.postMessage({ command: 'clearHistory' });
    });
    </script>
    </body>
    </html>`;
}