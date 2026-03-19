// ── 마크다운 → HTML 변환 (TypeScript 레벨에서 처리) ──────────────────────
// WebView HTML 안에 백틱·정규식을 넣으면 템플릿 리터럴과 충돌하므로
// 변환 로직은 여기서 문자열로 직렬화해 주입한다.

function buildParserScript(): string {
    const lines: string[] = [
        'function escapeHtml(s){',
        '  return String(s)',
        '    .replace(/&/g,"&amp;")',
        '    .replace(/</g,"&lt;")',
        '    .replace(/>/g,"&gt;")',
        '    .replace(/"/g,"&quot;");',
        '}',

        'function parseMarkdown(raw){',
        '  var blocks=[], BT3="```", BT1="`";',
        '  var s=raw;',

        // 코드블록 추출
        '  var cb3=new RegExp(BT3+"(\\\\w*)\\\\n?([\\\\s\\\\S]*?)"+BT3,"g");',
        '  s=s.replace(cb3,function(_,lang,code){',
        '    var id="cb"+Math.random().toString(36).slice(2,7);',
        '    var lbl=lang||"code";',
        '    var esc=escapeHtml(code.trim());',
        '    blocks.push(\'<div class="code-header"><span>\'+lbl+\'</span><button class="btn-copy" data-id="\'+id+\'">복사</button></div><pre id="\'+id+\'"><code>\'+esc+\'</code></pre>\');',
        '    return "\\x00CODE"+(blocks.length-1)+"\\x00";',
        '  });',

        // 인라인 코드
        '  var cb1=new RegExp(BT1+"([^"+BT1+"]+)"+BT1,"g");',
        '  s=s.replace(cb1,"<code>$1</code>");',

        // 헤딩
        '  s=s.replace(/^### (.+)$/gm,"<h3>$1</h3>");',
        '  s=s.replace(/^## (.+)$/gm,"<h2>$1</h2>");',
        '  s=s.replace(/^# (.+)$/gm,"<h1>$1</h1>");',

        // 굵게/이탤릭
        '  s=s.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g,"<strong><em>$1</em></strong>");',
        '  s=s.replace(/\\*\\*(.+?)\\*\\*/g,"<strong>$1</strong>");',
        '  s=s.replace(/\\*(.+?)\\*/g,"<em>$1</em>");',

        // 수평선
        '  s=s.replace(/^---$/gm,"<hr>");',

        // 인용
        '  s=s.replace(/^> (.+)$/gm,"<blockquote>$1</blockquote>");',

        // 순서없는 목록
        '  s=s.replace(/^[*-] (.+)$/gm,"<li>$1</li>");',
        '  s=s.replace(/(<li>[\\s\\S]*?<\\/li>\\n?)+/g,function(m){return"<ul>"+m+"</ul>";});',

        // 순서있는 목록
        '  s=s.replace(/^\\d+\\. (.+)$/gm,"<oli>$1</oli>");',
        '  s=s.replace(/(<oli>[\\s\\S]*?<\\/oli>\\n?)+/g,function(m){',
        '    return"<ol>"+m.replace(/<oli>/g,"<li>").replace(/<\\/oli>/g,"</li>")+"</ol>";',
        '  });',

        // 문단
        '  s=s.replace(/\\n\\n+/g,"</p><p>");',
        '  s=s.replace(/\\n/g,"<br>");',
        '  s="<p>"+s+"</p>";',

        // 블록 요소 주변 p 태그 정리
        '  ["h1","h2","h3","ul","ol","blockquote"].forEach(function(t){',
        '    s=s.replace(new RegExp("<p>(<"+t+">)","g"),"$1");',
        '    s=s.replace(new RegExp("(</"+t+">)</p>","g"),"$1");',
        '  });',
        '  s=s.replace(/<p>(<pre>)/g,"$1");',
        '  s=s.replace(/(<\\/pre>)<\\/p>/g,"$1");',
        '  s=s.replace(/<p>(<div class="code-header">)/g,"$1");',
        '  s=s.replace(/<p>(<hr>)<\\/p>/g,"$1");',
        '  s=s.replace(/<p><\\/p>/g,"");',
        '  s=s.replace(/<p><br>/g,"<p>");',

        // 코드블록 복원
        '  s=s.replace(/\\x00CODE(\\d+)\\x00/g,function(_,i){return blocks[parseInt(i)];});',
        '  return s;',
        '}',
    ];
    return lines.join('\n');
}

export function getWebviewContent(): string {
    const parserScript = buildParserScript();

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
    height: 100vh; display: flex; flex-direction: column; overflow: hidden;
  }
  .header { padding: 10px 12px 8px; border-bottom: 1px solid var(--vscode-panel-border, #313244); flex-shrink: 0; }
  .logo-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .logo-badge {
    width: 26px; height: 26px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    overflow: hidden;   /* ← 추가 */
    }
  .logo-text { font-size: 13px; font-weight: 700; color: var(--vscode-foreground); letter-spacing: 0.3px; flex: 1; }
  .btn-clear { padding: 2px 7px; background: transparent; color: var(--vscode-descriptionForeground, #9ca3af); border: 1px solid var(--vscode-panel-border, #313244); border-radius: 4px; font-size: 10px; cursor: pointer; }
  .btn-clear:hover { background: var(--vscode-list-hoverBackground); color: var(--vscode-foreground); }
  .status-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 10px; font-size: 10px; font-weight: 600; flex-shrink: 0; }
  .badge.server-ok  { background: #1a3a1a; color: #4ade80; border: 1px solid #166534; }
  .badge.server-err { background: #3a1a1a; color: #f87171; border: 1px solid #7f1d1d; }
  .badge.tenant-ok  { background: #1a2e4a; color: #60a5fa; border: 1px solid #1d4ed8; }
  .badge.tenant-err { background: #2a2a1a; color: #facc15; border: 1px solid #713f12; }
  .badge.tenant-none{ background: #2a2a2a; color: #9ca3af; border: 1px solid #374151; }
  .dot { width: 6px; height: 6px; border-radius: 50%; }
  .dot.green { background: #4ade80; } .dot.red { background: #f87171; }
  .dot.blue  { background: #60a5fa; } .dot.yellow { background: #facc15; }
  .dot.gray  { background: #9ca3af; }
  .tenant-panel { margin-top: 8px; background: var(--vscode-input-background, #2a2a3e); border: 1px solid var(--vscode-panel-border, #313244); border-radius: 6px; padding: 8px 10px; font-size: 11px; }
  .tenant-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .tenant-info { color: var(--vscode-descriptionForeground, #9ca3af); flex: 1; min-width: 0; }
  .tenant-info span { color: var(--vscode-foreground); font-weight: 600; }
  .btn-verify { padding: 3px 8px; background: #1E6FFF; color: #fff; border: none; border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
  .btn-verify:hover { background: #1a5fd0; } .btn-verify:disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
  .btn-settings { padding: 3px 8px; background: transparent; color: var(--vscode-descriptionForeground, #9ca3af); border: 1px solid var(--vscode-panel-border, #313244); border-radius: 4px; font-size: 10px; cursor: pointer; }
  .provider-row { display: flex; gap: 6px; padding: 8px 12px 6px; flex-shrink: 0; border-bottom: 1px solid var(--vscode-panel-border, #313244); }
  .provider-row select { flex: 1; background: var(--vscode-input-background, #2a2a3e); color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border, #313244); border-radius: 4px; padding: 4px 6px; font-size: 11px; outline: none; min-width: 0; }
  .action-row { display: flex; gap: 5px; padding: 5px 12px 6px; flex-shrink: 0; border-bottom: 1px solid var(--vscode-panel-border, #313244); }
  .btn-action { flex: 1; padding: 4px 6px; background: var(--vscode-input-background, #2a2a3e); color: var(--vscode-descriptionForeground, #9ca3af); border: 1px solid var(--vscode-panel-border, #313244); border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer; text-align: center; white-space: nowrap; }
  .btn-action:hover { background: #1E6FFF22; border-color: #1E6FFF; color: #60a5fa; }
  .btn-action.primary { background: #1E6FFF22; border-color: #1E6FFF55; color: #60a5fa; }
  .chat-container { flex: 1; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
  .chat-container::-webkit-scrollbar { width: 4px; }
  .chat-container::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }
  .msg { display: flex; flex-direction: column; gap: 3px; }
  .msg-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.6; }
  .msg.user .msg-label { color: #60a5fa; text-align: right; }
  .msg.ai   .msg-label { color: #a78bfa; }
  .msg.sys  .msg-label { color: #9ca3af; }
  .msg.err  .msg-label { color: #f87171; }
  .msg-bubble { padding: 8px 10px; border-radius: 8px; font-size: 12px; line-height: 1.6; word-break: break-word; }
  .msg.user .msg-bubble { background: #1e3a5f; border: 1px solid #1d4ed8; align-self: flex-end; max-width: 90%; white-space: pre-wrap; }
  .msg.ai   .msg-bubble { background: var(--vscode-input-background, #2a2a3e); border: 1px solid var(--vscode-panel-border, #313244); }
  .msg.sys  .msg-bubble { background: transparent; border: 1px dashed #374151; color: #9ca3af; font-size: 11px; padding: 5px 8px; white-space: pre-wrap; }
  .msg.err  .msg-bubble { background: #3a1a1a; border: 1px solid #7f1d1d; color: #f87171; white-space: pre-wrap; }
  .msg-bubble p { margin-bottom: 6px; } .msg-bubble p:last-child { margin-bottom: 0; }
  .msg-bubble strong { color: #e2e8f0; font-weight: 700; }
  .msg-bubble em { color: #a5b4fc; font-style: italic; }
  .msg-bubble h1,.msg-bubble h2,.msg-bubble h3 { color: #e2e8f0; font-weight: 700; margin: 8px 0 4px; border-bottom: 1px solid #313244; padding-bottom: 3px; }
  .msg-bubble h1 { font-size: 14px; } .msg-bubble h2 { font-size: 13px; } .msg-bubble h3 { font-size: 12px; }
  .msg-bubble ul,.msg-bubble ol { padding-left: 16px; margin: 4px 0; }
  .msg-bubble li { margin-bottom: 2px; }
  .msg-bubble code { background: #0d1117; color: #79c0ff; padding: 1px 5px; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 11px; }
  .msg-bubble pre { background: #0d1117; border: 1px solid #30363d; border-radius: 0 0 6px 6px; padding: 10px 12px; overflow-x: auto; }
  .msg-bubble pre code { background: transparent; color: #e6edf3; padding: 0; font-size: 11px; line-height: 1.6; }
  .code-header { display: flex; justify-content: space-between; align-items: center; background: #161b22; border: 1px solid #30363d; border-bottom: none; border-radius: 6px 6px 0 0; padding: 4px 10px; font-size: 10px; color: #8b949e; margin-top: 6px; }
  .btn-copy { background: transparent; border: none; color: #8b949e; cursor: pointer; font-size: 10px; padding: 1px 5px; border-radius: 3px; }
  .btn-copy:hover { background: #30363d; color: #e6edf3; } .btn-copy.copied { color: #4ade80; }
  .msg-bubble blockquote { border-left: 3px solid #1E6FFF; padding-left: 10px; margin: 4px 0; color: #9ca3af; font-style: italic; }
  .msg-bubble hr { border: none; border-top: 1px solid #313244; margin: 8px 0; }
  .rag-badge { font-size: 10px; color: #4ade80; margin-top: 4px; }
  .cache-badge { font-size: 10px; color: #facc15; margin-top: 4px; }
  .loading { display: none; padding: 6px 12px; }
  .loading.show { display: flex; align-items: center; gap: 6px; }
  .loading span { font-size: 11px; color: #9ca3af; }
  .dots span { display: inline-block; width: 5px; height: 5px; background: #1E6FFF; border-radius: 50%; margin: 0 1px; animation: bounce 1s infinite; }
  .dots span:nth-child(2) { animation-delay: 0.15s; } .dots span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-4px);opacity:1} }
  .input-area { padding: 8px 12px 10px; border-top: 1px solid var(--vscode-panel-border, #313244); flex-shrink: 0; }
  .input-row { display: flex; gap: 6px; align-items: flex-end; }
  textarea { flex: 1; background: var(--vscode-input-background, #2a2a3e); color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border, #313244); border-radius: 6px; padding: 7px 9px; font-size: 12px; resize: none; outline: none; font-family: inherit; line-height: 1.5; min-height: 36px; max-height: 100px; transition: border-color 0.15s; }
  textarea:focus { border-color: #1E6FFF; }
  .btn-send { width: 32px; height: 32px; background: #1E6FFF; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .btn-send:hover { background: #1a5fd0; } .btn-send:disabled { background: #374151; cursor: not-allowed; }
  .input-hint { font-size: 10px; color: #4b5563; margin-top: 4px; text-align: right; }
  .welcome { text-align: center; padding: 30px 10px; color: var(--vscode-descriptionForeground, #9ca3af); }
  .welcome .w-icon { font-size: 28px; margin-bottom: 8px; }
  .welcome p { font-size: 12px; line-height: 1.6; }
</style>
</head>
<body>

<div class="header">
  <div class="logo-row">
    <div class="logo-badge">
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 34 34">
    <g transform="translate(-234.051 -243.552)">
      <circle cx="17" cy="17" r="17" transform="translate(234.051 243.552)" fill="#0354ff"/>
      <g transform="translate(242.64 251.376)">
        <path d="M279.06,278.113H276v5.352a3.823,3.823,0,0,1-7.646,0V274.29L265.3,272v11.469a6.847,6.847,0,0,0,1.16,3.823,6.881,6.881,0,0,0,12.6-3.823Z" transform="translate(-265.297 -271.996)" fill="#fff"/>
        <circle cx="1.529" cy="1.529" r="1.529" transform="translate(13.763 15.292)" fill="#fff"/>
      </g>
    </g>
  </svg>
</div>
    <span class="logo-text">UstraCode</span>
    <button class="btn-clear" id="btnClear">🗑 초기화</button>
  </div>
  <div class="status-row">
    <div class="badge server-err" id="serverBadge"><div class="dot red" id="serverDot"></div><span id="serverText">서버 연결 중...</span></div>
    <div class="badge tenant-none" id="tenantBadge"><div class="dot gray" id="tenantDot"></div><span id="tenantText">API Key 미설정</span></div>
  </div>
  <div class="tenant-panel" id="tenantPanel">
    <div class="tenant-row">
      <div class="tenant-info" id="tenantInfo">설정에서 API Key를 입력하세요</div>
      <button class="btn-verify" id="btnVerify">검증</button>
      <button class="btn-settings" id="btnSettings">⚙</button>
    </div>
  </div>
</div>

<div class="provider-row">
  <select id="providerSelect">
    <option value="ollama">🖥 Ollama</option>
    <option value="openai">🟢 OpenAI</option>
    <option value="claude">🟣 Claude</option>
    <option value="gemini">🔵 Gemini</option>
  </select>
  <select id="modelSelect">
    <option value="qwen2.5-coder:7b">qwen2.5-coder:7b</option>
    <option value="qwen2.5-coder:14b">qwen2.5-coder:14b</option>
    <option value="qwen2.5-coder:1.5b">qwen2.5-coder:1.5b</option>
  </select>
</div>

<div class="action-row">
  <button class="btn-action primary" id="btnIndexFile">📂 파일 인덱싱</button>
  <button class="btn-action" id="btnExplain">💡 코드 설명</button>
  <button class="btn-action" id="btnReview">● 코드 리뷰</button>
  <button class="btn-action" id="btnBypassCache" title="캐시를 무시하고 AI에게 직접 질문">🔄 캐시 무시</button>
</div>

<div class="chat-container" id="chatContainer">
  <div class="welcome" id="welcome">
    <div class="w-icon">⚡</div>
    <p>UstraCode AI 어시스턴트<br/>코드를 선택하거나 질문을 입력하세요</p>
  </div>
</div>

<div class="loading" id="loading">
  <div class="dots"><span></span><span></span><span></span></div>
  <span id="loadingText">응답 생성 중...</span>
</div>

<div class="input-area">
  <div class="input-row">
    <textarea id="msgInput" placeholder="질문을 입력하세요... (Shift+Enter: 줄바꿈)" rows="1"></textarea>
    <button class="btn-send" id="btnSend">↑</button>
  </div>
  <div class="input-hint">Enter: 전송 · Shift+Enter: 줄바꿈</div>
</div>

<script>
${parserScript}

var vscode = acquireVsCodeApi();
var chatContainer = document.getElementById('chatContainer');
var msgInput      = document.getElementById('msgInput');
var btnSend       = document.getElementById('btnSend');
var btnVerify     = document.getElementById('btnVerify');
var loading       = document.getElementById('loading');
var loadingText   = document.getElementById('loadingText');
var welcome       = document.getElementById('welcome');

var currentSettings = {
  serverUrl: 'http://localhost:8081',
  apiKey: '',
  defaultProvider: 'ollama',
  defaultModel: 'qwen2.5-coder:7b',
  ragEnabled: true
};
var bypassCache = false;  // ← 추가

window.addEventListener('message', function(e) {
  var msg = e.data;
  switch (msg.command) {
    case 'setServerStatus':   updateServerBadge(msg.healthy); break;
    case 'updateSettings':
      currentSettings = { serverUrl: msg.serverUrl, apiKey: msg.apiKey, defaultProvider: msg.defaultProvider, defaultModel: msg.defaultModel, ragEnabled: msg.ragEnabled };
      document.getElementById('providerSelect').value = msg.defaultProvider || 'ollama';
      updateApiKeyBadge(msg.apiKey);
      break;
    case 'setApiKeyStatus':
    updateTenantStatus(msg.valid, msg.tenantName);
    if (msg.valid && msg.apiKeys && msg.apiKeys.length > 0) {
        updateProviderModels(msg.apiKeys, msg.activeProviders);
    }
    break;
    case 'setVerifying':
      btnVerify.disabled = msg.value;
      btnVerify.textContent = msg.value ? '검증 중...' : '검증';
      break;
    case 'addMessage':        addMessage(msg.role, msg.content, msg.ragUsed, msg.references, msg.model); break;
    case 'setLoading':
      loading.classList.toggle('show', msg.value);
      btnSend.disabled = msg.value;
      if (msg.loadingText) { loadingText.textContent = msg.loadingText; }
      else { loadingText.textContent = '응답 생성 중...'; }
      if (msg.value) { chatContainer.scrollTop = chatContainer.scrollHeight; }
      break;
    case 'clearHistory':
      chatContainer.innerHTML = '';
      chatContainer.appendChild(welcome);
      welcome.style.display = 'block';
      break;
    case 'setInputText':
        msgInput.value = msg.text;
        msgInput.style.height = 'auto';
        msgInput.style.height = Math.min(msgInput.scrollHeight, 100) + 'px';
        msgInput.focus();
        break;
  }
});

function updateServerBadge(healthy) {
  var badge=document.getElementById('serverBadge'), dot=document.getElementById('serverDot'), text=document.getElementById('serverText');
  if (healthy) { badge.className='badge server-ok'; dot.className='dot green'; text.textContent='서버 연결됨'; }
  else         { badge.className='badge server-err'; dot.className='dot red';   text.textContent='서버 오프라인'; }
}

function updateApiKeyBadge(apiKey) {
  var badge=document.getElementById('tenantBadge'), dot=document.getElementById('tenantDot'), text=document.getElementById('tenantText'), info=document.getElementById('tenantInfo');
  if (!apiKey || apiKey.trim()==='') {
    badge.className='badge tenant-none'; dot.className='dot gray'; text.textContent='API Key 미설정'; info.textContent='설정에서 API Key를 입력하세요';
  } else {
    badge.className='badge tenant-err'; dot.className='dot yellow'; text.textContent='API Key 미검증';
    var masked=apiKey.substring(0,8)+'...'+apiKey.substring(apiKey.length-4);
    info.innerHTML='Key: <span>'+masked+'</span> · 검증 버튼을 눌러주세요';
  }
}

function updateTenantStatus(valid, tenantName) {
  var badge=document.getElementById('tenantBadge'), dot=document.getElementById('tenantDot'), text=document.getElementById('tenantText'), info=document.getElementById('tenantInfo');
  if (valid) { badge.className='badge tenant-ok'; dot.className='dot blue'; text.textContent=tenantName||'테넌트 인증됨'; info.innerHTML='테넌트: <span>'+(tenantName||'-')+'</span> · 인증 완료 ✓'; }
  else       { badge.className='badge tenant-err'; dot.className='dot yellow'; text.textContent='API Key 오류'; info.textContent='유효하지 않은 API Key입니다.'; }
}

function updateProviderModels(apiKeys, activeProviders) {
    var providerSelect = document.getElementById('providerSelect');
    var modelSelect = document.getElementById('modelSelect');

    // Provider 드롭다운 갱신
    providerSelect.innerHTML = '';
    var providerIcons = { OLLAMA: '🖥', OPENAI: '🟢', CLAUDE: '🟣', GEMINI: '🔵' };
    (activeProviders || []).forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p.toLowerCase();
        opt.textContent = (providerIcons[p] || '🤖') + ' ' + p;
        providerSelect.appendChild(opt);
    });

    // 첫 번째 Provider 선택 시 모델 갱신
    if (activeProviders && activeProviders.length > 0) {
        var firstProvider = activeProviders[0].toUpperCase();
        providerSelect.value = firstProvider.toLowerCase();
        updateModelsByProvider(firstProvider, apiKeys);
    }

    // Provider 변경 이벤트 재등록
    providerSelect.onchange = function() {
        var selected = providerSelect.value.toUpperCase();
        updateModelsByProvider(selected, apiKeys);
    };
}

function updateModelsByProvider(provider, apiKeys) {
    var modelSelect = document.getElementById('modelSelect');
    modelSelect.innerHTML = '';
    // apiKeys에서 해당 Provider의 모델 찾기
    var matchedKeys = (apiKeys || []).filter(function(k) {
        return k.provider.toUpperCase() === provider && k.active;
    });
    if (matchedKeys.length > 0) {
        matchedKeys.forEach(function(k) {
            if (k.model) {
                var opt = document.createElement('option');
                opt.value = k.model;
                opt.textContent = k.model;
                modelSelect.appendChild(opt);
            }
        });
    }
}

function addMessage(role, content, ragUsed, references, model) {
  if (welcome) { welcome.style.display='none'; }
  var div=document.createElement('div');
  var roleMap={user:'user',assistant:'ai',error:'err',system:'sys'};
  var labelMap={user:'You',assistant:'UstraCode AI',error:'Error',system:'System'};
  var cls=roleMap[role]||'sys';
  div.className='msg '+cls;
  var isCached=model&&(model.indexOf('[캐시]')>=0||model.indexOf('[유사질문 캐시]')>=0);
  var isVector=model&&model.indexOf('[유사질문 캐시]')>=0;
  var modelLabel=model?' <span style="font-size:10px;opacity:0.5;">· '+escapeHtml(model)+'</span>':'';
  var bubbleContent;
  if (role==='assistant') { bubbleContent=parseMarkdown(content); }
  else { bubbleContent='<span style="white-space:pre-wrap;">'+escapeHtml(content)+'</span>'; }
  var footer='';
  if (isCached) {
    footer='<div class="cache-badge">'+(isVector?'⚡ 유사 질문 캐시':'⚡ 캐시')+' (AI 호출 없음)</div>';
  } else if (ragUsed&&references&&references.length>0) {
    var refs=references.slice(0,2).map(function(r){var p=r.replace(/\\\\/g,'/').split('/');return p[p.length-1]||r;}).join(', ');
    footer='<div class="rag-badge">📎 RAG 참조: '+refs+'</div>';
  }
  div.innerHTML='<div class="msg-label">'+(labelMap[role]||role)+modelLabel+'</div><div class="msg-bubble">'+bubbleContent+'</div>'+footer;
  chatContainer.appendChild(div);
  chatContainer.scrollTop=chatContainer.scrollHeight;
}

function sendMessage() {
  var text=msgInput.value.trim();
  var provider=document.getElementById('providerSelect').value;
  var model=document.getElementById('modelSelect').value;
  if (!text) { return; }
  vscode.postMessage({command:'sendMessage',text:text,provider:provider,model:model,bypassCache:bypassCache});
  msgInput.value=''; msgInput.style.height='auto';
}

function onProviderChange() {
  var provider=document.getElementById('providerSelect').value;
  var modelSelect=document.getElementById('modelSelect');
  var models={ollama:['qwen2.5-coder:14b','qwen2.5-coder:7b','qwen2.5-coder:1.5b'],openai:['gpt-4o','gpt-4o-mini','gpt-3.5-turbo'],claude:['claude-sonnet-4-6','claude-haiku-4-5-20251001'],gemini:['gemini-2.5-flash','gemini-1.5-pro','gemini-2.0-flash']};
  modelSelect.innerHTML=(models[provider]||[]).map(function(m){return'<option value="'+m+'">'+m+'</option>';}).join('');
}

// ── 이벤트 바인딩 ──────────────────────────────────────────────────────────
document.getElementById('btnClear').addEventListener('click', function(){ vscode.postMessage({command:'clearHistory'}); });
document.getElementById('btnVerify').addEventListener('click', function(){ vscode.postMessage({command:'verifyApiKey'}); });
document.getElementById('btnSettings').addEventListener('click', function(){ vscode.postMessage({command:'openSettings'}); });
document.getElementById('btnSend').addEventListener('click', sendMessage);
document.getElementById('btnIndexFile').addEventListener('click', function(){ vscode.postMessage({command:'indexFile'}); });
document.getElementById('btnExplain').addEventListener('click', function(){
  var provider=document.getElementById('providerSelect').value, model=document.getElementById('modelSelect').value;
  vscode.postMessage({command:'sendMessage',text:'선택한 코드를 상세히 설명해주세요.',provider:provider,model:model});
});
document.getElementById('btnReview').addEventListener('click', function(){
  var provider=document.getElementById('providerSelect').value, model=document.getElementById('modelSelect').value;
  vscode.postMessage({command:'sendMessage',text:'선택한 코드를 리뷰하고 개선 사항을 알려주세요.',provider:provider,model:model});
});
document.getElementById('btnBypassCache').addEventListener('click', function() {
  bypassCache = !bypassCache;
  var btn = document.getElementById('btnBypassCache');
  if (bypassCache) {
    btn.textContent = '🔄 캐시 무시 ON';
    btn.style.background = '#FF6B3522';
    btn.style.borderColor = '#FF6B35';
    btn.style.color = '#FF6B35';
  } else {
    btn.textContent = '🔄 캐시 무시';
    btn.style.background = '';
    btn.style.borderColor = '';
    btn.style.color = '';
  }
});
document.getElementById('providerSelect').addEventListener('change', onProviderChange);

// 복사 버튼 — 이벤트 위임
document.addEventListener('click', function(e) {
  var btn=e.target.closest('.btn-copy');
  if (!btn) { return; }
  var id=btn.getAttribute('data-id');
  var pre=document.getElementById(id);
  var text=pre?pre.textContent:'';
  navigator.clipboard.writeText(text).then(function(){
    btn.textContent='✓ 복사됨'; btn.classList.add('copied');
    setTimeout(function(){ btn.textContent='복사'; btn.classList.remove('copied'); }, 1500);
  });
});

msgInput.addEventListener('keydown', function(e) {
  if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendMessage(); }
});
msgInput.addEventListener('input', function() {
  msgInput.style.height='auto';
  msgInput.style.height=Math.min(msgInput.scrollHeight,100)+'px';
});

vscode.postMessage({command:'ready'});
</script>
</body>
</html>`;
}