export function getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>UstraCode</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--vscode-sideBar-background, #1e1e2e);
    color: var(--vscode-foreground, #cdd6f4);
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── 헤더 ── */
  .header {
    padding: 10px 12px 8px;
    border-bottom: 1px solid var(--vscode-panel-border, #313244);
    flex-shrink: 0;
  }

  .logo-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .logo-badge {
    width: 26px; height: 26px;
    background: #1E6FFF;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: 900; font-size: 13px; color: #fff;
    flex-shrink: 0;
  }

  .logo-text {
    font-size: 13px; font-weight: 700;
    color: var(--vscode-foreground);
    letter-spacing: 0.3px;
  }

  /* ── 상태 배지 ── */
  .status-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 7px;
    border-radius: 10px;
    font-size: 10px; font-weight: 600;
    flex-shrink: 0;
  }

  .badge.server-ok  { background: #1a3a1a; color: #4ade80; border: 1px solid #166534; }
  .badge.server-err { background: #3a1a1a; color: #f87171; border: 1px solid #7f1d1d; }
  .badge.tenant-ok  { background: #1a2e4a; color: #60a5fa; border: 1px solid #1d4ed8; }
  .badge.tenant-err { background: #2a2a1a; color: #facc15; border: 1px solid #713f12; }
  .badge.tenant-none{ background: #2a2a2a; color: #9ca3af; border: 1px solid #374151; }

  .dot { width: 6px; height: 6px; border-radius: 50%; }
  .dot.green  { background: #4ade80; }
  .dot.red    { background: #f87171; }
  .dot.blue   { background: #60a5fa; }
  .dot.yellow { background: #facc15; }
  .dot.gray   { background: #9ca3af; }

  /* ── 테넌트 패널 ── */
  .tenant-panel {
    margin-top: 8px;
    background: var(--vscode-input-background, #2a2a3e);
    border: 1px solid var(--vscode-panel-border, #313244);
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 11px;
  }

  .tenant-panel.hidden { display: none; }

  .tenant-row {
    display: flex; align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .tenant-info { color: var(--vscode-descriptionForeground, #9ca3af); flex: 1; min-width: 0; }
  .tenant-info span { color: var(--vscode-foreground); font-weight: 600; }

  .btn-verify {
    padding: 3px 8px;
    background: #1E6FFF;
    color: #fff;
    border: none; border-radius: 4px;
    font-size: 10px; font-weight: 600;
    cursor: pointer; flex-shrink: 0;
    transition: background 0.15s;
  }
  .btn-verify:hover { background: #1a5fd0; }
  .btn-verify:disabled { background: #374151; color: #6b7280; cursor: not-allowed; }

  .btn-settings {
    padding: 3px 8px;
    background: transparent;
    color: var(--vscode-descriptionForeground, #9ca3af);
    border: 1px solid var(--vscode-panel-border, #313244);
    border-radius: 4px;
    font-size: 10px; cursor: pointer;
    transition: all 0.15s;
  }
  .btn-settings:hover {
    background: var(--vscode-list-hoverBackground);
    color: var(--vscode-foreground);
  }

  /* ── 프로바이더 선택 ── */
  .provider-row {
    display: flex; gap: 6px;
    padding: 8px 12px 6px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--vscode-panel-border, #313244);
  }
  
  .provider-row select {
  flex: 1;
  background: var(--vscode-input-background, #2a2a3e);
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border, #313244);
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 11px;
  outline: none;
  min-width: 0;
}

  /* ── 채팅 영역 ── */
  .chat-container {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .chat-container::-webkit-scrollbar { width: 4px; }
  .chat-container::-webkit-scrollbar-track { background: transparent; }
  .chat-container::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }

  .msg { display: flex; flex-direction: column; gap: 3px; }

  .msg-label {
    font-size: 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.5px;
    opacity: 0.6;
  }

  .msg.user .msg-label  { color: #60a5fa; text-align: right; }
  .msg.ai   .msg-label  { color: #a78bfa; }
  .msg.sys  .msg-label  { color: #9ca3af; }
  .msg.err  .msg-label  { color: #f87171; }

  .msg-bubble {
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 12px; line-height: 1.6;
    white-space: pre-wrap; word-break: break-word;
  }

  .msg.user .msg-bubble {
    background: #1e3a5f;
    border: 1px solid #1d4ed8;
    align-self: flex-end;
    max-width: 90%;
  }

  .msg.ai .msg-bubble {
    background: var(--vscode-input-background, #2a2a3e);
    border: 1px solid var(--vscode-panel-border, #313244);
    max-width: 100%;
  }

  .msg.sys .msg-bubble {
    background: transparent;
    border: 1px dashed #374151;
    color: #9ca3af; font-size: 11px;
    padding: 5px 8px;
  }

  .msg.err .msg-bubble {
    background: #3a1a1a;
    border: 1px solid #7f1d1d;
    color: #f87171;
  }

  .rag-badge {
    font-size: 10px; color: #4ade80;
    margin-top: 4px;
  }

  /* ── 로딩 ── */
  .loading { display: none; padding: 6px 12px; }
  .loading.show { display: flex; align-items: center; gap: 6px; }
  .loading span { font-size: 11px; color: #9ca3af; }

  .dots span {
    display: inline-block;
    width: 5px; height: 5px;
    background: #1E6FFF;
    border-radius: 50%;
    margin: 0 1px;
    animation: bounce 1s infinite;
  }
  .dots span:nth-child(2) { animation-delay: 0.15s; }
  .dots span:nth-child(3) { animation-delay: 0.3s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40% { transform: translateY(-4px); opacity: 1; }
  }

  /* ── 입력창 ── */
  .input-area {
    padding: 8px 12px 10px;
    border-top: 1px solid var(--vscode-panel-border, #313244);
    flex-shrink: 0;
  }

  .input-row {
    display: flex; gap: 6px; align-items: flex-end;
  }

  textarea {
    flex: 1;
    background: var(--vscode-input-background, #2a2a3e);
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border, #313244);
    border-radius: 6px;
    padding: 7px 9px;
    font-size: 12px;
    resize: none; outline: none;
    font-family: inherit;
    line-height: 1.5;
    min-height: 36px; max-height: 100px;
    transition: border-color 0.15s;
  }
  textarea:focus { border-color: #1E6FFF; }

  .btn-send {
    width: 32px; height: 32px;
    background: #1E6FFF;
    color: #fff; border: none;
    border-radius: 6px; cursor: pointer;
    font-size: 14px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .btn-send:hover { background: #1a5fd0; }
  .btn-send:disabled { background: #374151; cursor: not-allowed; }

  .input-hint {
    font-size: 10px; color: #4b5563;
    margin-top: 4px; text-align: right;
  }

  .welcome {
    text-align: center; padding: 30px 10px;
    color: var(--vscode-descriptionForeground, #9ca3af);
  }
  .welcome .w-icon { font-size: 28px; margin-bottom: 8px; }
  .welcome p { font-size: 12px; line-height: 1.6; }
</style>
</head>
<body>

<!-- 헤더 -->
<div class="header">
  <div class="logo-row">
    <div class="logo-badge">U</div>
    <span class="logo-text">UstraCode</span>
  </div>
  <div class="status-row">
    <div class="badge server-err" id="serverBadge">
      <div class="dot red" id="serverDot"></div>
      <span id="serverText">서버 연결 중...</span>
    </div>
    <div class="badge tenant-none" id="tenantBadge">
      <div class="dot gray" id="tenantDot"></div>
      <span id="tenantText">API Key 미설정</span>
    </div>
  </div>

  <!-- 테넌트 패널 -->
  <div class="tenant-panel" id="tenantPanel">
    <div class="tenant-row">
      <div class="tenant-info" id="tenantInfo">설정에서 API Key를 입력하세요</div>
      <button class="btn-verify" id="btnVerify" onclick="verifyApiKey()">검증</button>
      <button class="btn-settings" onclick="openSettings()">⚙</button>
    </div>
  </div>
</div>

<!-- 프로바이더 / 모델 선택 -->
<div class="provider-row">
  <select id="providerSelect" onchange="onProviderChange()">
    <option value="ollama">🖥 Ollama</option>
    <option value="openai">🟢 OpenAI</option>
    <option value="claude">🟣 Claude</option>
    <option value="gemini">🔵 Gemini</option>
  </select>
  <select id="modelSelect">
    <option value="qwen2.5-coder:14b">qwen2.5-coder:14b</option>
    <option value="qwen2.5-coder:7b">qwen2.5-coder:7b</option>
    <option value="qwen2.5-coder:1.5b">qwen2.5-coder:1.5b</option>
  </select>
</div>

<!-- 채팅 -->
<div class="chat-container" id="chatContainer">
  <div class="welcome" id="welcome">
    <div class="w-icon">⚡</div>
    <p>UstraCode AI 어시스턴트<br/>코드를 선택하거나 질문을 입력하세요</p>
  </div>
</div>

<!-- 로딩 -->
<div class="loading" id="loading">
  <div class="dots">
    <span></span><span></span><span></span>
  </div>
  <span>응답 생성 중...</span>
</div>

<!-- 입력창 -->
<div class="input-area">
  <div class="input-row">
    <textarea id="msgInput" placeholder="질문을 입력하세요... (Shift+Enter: 줄바꿈)" rows="1"></textarea>
    <button class="btn-send" id="btnSend" onclick="sendMessage()">↑</button>
  </div>
  <div class="input-hint">Enter: 전송 · Shift+Enter: 줄바꿈</div>
</div>

<script>
const vscode = acquireVsCodeApi();
const chatContainer = document.getElementById('chatContainer');
const msgInput      = document.getElementById('msgInput');
const btnSend       = document.getElementById('btnSend');
const btnVerify     = document.getElementById('btnVerify');
const loading       = document.getElementById('loading');
const welcome       = document.getElementById('welcome');

let currentSettings = {
  serverUrl: 'http://localhost:8081',
  apiKey: '',
  defaultProvider: 'ollama',
  defaultModel: 'qwen2.5-coder:14b',
  ragEnabled: true
};

// ── 메시지 수신 ────────────────────────────────────────────────────────────
window.addEventListener('message', e => {
  const msg = e.data;
  switch (msg.command) {

    case 'setServerStatus':
      updateServerBadge(msg.healthy);
      break;

    case 'updateSettings':
      currentSettings = {
        serverUrl:       msg.serverUrl,
        apiKey:          msg.apiKey,
        defaultProvider: msg.defaultProvider,
        defaultModel:    msg.defaultModel,
        ragEnabled:      msg.ragEnabled,
      };
      document.getElementById('providerSelect').value = msg.defaultProvider || 'ollama';
      updateApiKeyBadge(msg.apiKey);
      break;

    case 'setApiKeyStatus':
      updateTenantStatus(msg.valid, msg.tenantName);
      break;

    case 'setVerifying':
      btnVerify.disabled = msg.value;
      btnVerify.textContent = msg.value ? '검증 중...' : '검증';
      break;

    case 'addMessage':
      addMessage(msg.role, msg.content, msg.ragUsed, msg.references, msg.model);
      break;

    case 'setLoading':
      loading.classList.toggle('show', msg.value);
      btnSend.disabled = msg.value;
      if (msg.value) chatContainer.scrollTop = chatContainer.scrollHeight;
      break;

    case 'clearHistory':
      chatContainer.innerHTML = '';
      chatContainer.appendChild(welcome);
      welcome.style.display = 'block';
      break;
  }
});

// ── 상태 업데이트 함수 ────────────────────────────────────────────────────

function updateServerBadge(healthy) {
  const badge = document.getElementById('serverBadge');
  const dot   = document.getElementById('serverDot');
  const text  = document.getElementById('serverText');
  if (healthy) {
    badge.className = 'badge server-ok';
    dot.className   = 'dot green';
    text.textContent = '서버 연결됨';
  } else {
    badge.className = 'badge server-err';
    dot.className   = 'dot red';
    text.textContent = '서버 오프라인';
  }
}

function updateApiKeyBadge(apiKey) {
  const badge = document.getElementById('tenantBadge');
  const dot   = document.getElementById('tenantDot');
  const text  = document.getElementById('tenantText');
  const info  = document.getElementById('tenantInfo');

  if (!apiKey || apiKey.trim() === '') {
    badge.className  = 'badge tenant-none';
    dot.className    = 'dot gray';
    text.textContent = 'API Key 미설정';
    info.textContent = '설정에서 API Key를 입력하세요';
  } else {
    badge.className  = 'badge tenant-err';
    dot.className    = 'dot yellow';
    text.textContent = 'API Key 미검증';
    const masked = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
    info.innerHTML   = 'Key: <span>' + masked + '</span> · 검증 버튼을 눌러주세요';
  }
}

function updateTenantStatus(valid, tenantName) {
  const badge = document.getElementById('tenantBadge');
  const dot   = document.getElementById('tenantDot');
  const text  = document.getElementById('tenantText');
  const info  = document.getElementById('tenantInfo');

  if (valid) {
    badge.className  = 'badge tenant-ok';
    dot.className    = 'dot blue';
    text.textContent = tenantName || '테넌트 인증됨';
    info.innerHTML   = '테넌트: <span>' + (tenantName || '-') + '</span> · 인증 완료 ✓';
  } else {
    badge.className  = 'badge tenant-err';
    dot.className    = 'dot yellow';
    text.textContent = 'API Key 오류';
    info.textContent = '유효하지 않은 API Key입니다. 설정을 확인하세요.';
  }
}

// ── 메시지 추가 ────────────────────────────────────────────────────────────

function addMessage(role, content, ragUsed, references, model) {
  if (welcome) welcome.style.display = 'none';

  const div = document.createElement('div');
  const roleMap = { user: 'user', assistant: 'ai', error: 'err', system: 'sys' };
  const labelMap = { user: 'You', assistant: 'UstraCode AI', error: 'Error', system: 'System' };
  const cls = roleMap[role] || 'sys';

  div.className = 'msg ' + cls;
  const isCached = model && model.includes('[캐시]');
  const modelLabel = model
    ? ' <span style="font-size:10px;opacity:0.5;">· ' + model + '</span>'
    : '';
  div.innerHTML =
    '<div class="msg-label">' + (labelMap[role] || role) + modelLabel + '</div>' +
    '<div class="msg-bubble">' + escapeHtml(content) + '</div>' +
    (isCached
      ? '<div class="rag-badge">⚡ 캐시 응답 (AI 호출 없음)</div>'
      : ragUsed && references && references.length > 0
        ? '<div class="rag-badge">📎 RAG 참조: ' + references.slice(0,2).map(r => r.split('\\\\\\\\').pop() || r.split('/').pop()).join(', ') + '</div>'
        : '');

  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 액션 함수 ─────────────────────────────────────────────────────────────

function sendMessage() {
  const text     = msgInput.value.trim();
  const provider = document.getElementById('providerSelect').value;
  const model    = document.getElementById('modelSelect').value;
  if (!text) { return; }
  vscode.postMessage({ command: 'sendMessage', text, provider, model });
  msgInput.value = '';
  msgInput.style.height = 'auto';
}

function onProviderChange() {
  const provider = document.getElementById('providerSelect').value;
  const modelSelect = document.getElementById('modelSelect');
  const models = {
    ollama: ['qwen2.5-coder:14b', 'qwen2.5-coder:7b', 'qwen2.5-coder:1.5b'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    claude: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
    gemini: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  };
  modelSelect.innerHTML = (models[provider] || []).map(m =>
    '<option value="' + m + '">' + m + '</option>'
  ).join('');
}

function verifyApiKey() {
  vscode.postMessage({ command: 'verifyApiKey' });
}

function openSettings() {
  vscode.postMessage({ command: 'openSettings' });
}

// ── 입력 이벤트 ────────────────────────────────────────────────────────────

msgInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

msgInput.addEventListener('input', () => {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 100) + 'px';
});

// ── 초기화 ─────────────────────────────────────────────────────────────────
vscode.postMessage({ command: 'ready' });
</script>
</body>
</html>`;
}