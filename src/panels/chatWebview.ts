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
<title>KaddyCode</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--vscode-sideBar-background, #1e1e2e);
    color: var(--vscode-foreground, #cccccc);
    height: 100vh; display: flex; flex-direction: column; overflow: hidden; position: relative;
  }
  .header { padding: 10px 12px 8px; border-bottom: 1px solid var(--vscode-panel-border, #444); flex-shrink: 0; }
  .logo-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .logo-badge { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
  .logo-text { font-size: 13px; font-weight: 700; color: var(--vscode-foreground); letter-spacing: 0.3px; flex: 1; }
  .btn-clear, .btn-help {
    padding: 4px 8px;
    background: var(--vscode-button-secondaryBackground, #5a5a5a);
    color: var(--vscode-button-secondaryForeground, #ffffff);
    border: 1px solid var(--vscode-contrastBorder, transparent);
    border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer;
    -webkit-appearance: none; appearance: none;
  }
  .btn-clear:hover, .btn-help:hover {
    background: var(--vscode-button-secondaryHoverBackground, #6a6a6a);
    color: var(--vscode-foreground);
  }
  .status-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 10px; font-size: 10px; font-weight: 600; flex-shrink: 0; }
  .badge.server-ok  { background: #1a3a1a; color: #4ade80; border: 1px solid #166534; }
  .badge.server-err { background: #3a1a1a; color: #f87171; border: 1px solid #7f1d1d; }
  .badge.tenant-ok  { background: #1a2e4a; color: #60a5fa; border: 1px solid #1d4ed8; }
  .badge.tenant-err { background: #2a2a1a; color: #facc15; border: 1px solid #713f12; }
  .badge.tenant-none{ background: var(--vscode-input-background, #3a3a3a); color: var(--vscode-descriptionForeground, #999); border: 1px solid var(--vscode-panel-border, #555); }
  .dot { width: 6px; height: 6px; border-radius: 50%; }
  .dot.green { background: #4ade80; } .dot.red { background: #f87171; }
  .dot.blue  { background: #60a5fa; } .dot.yellow { background: #facc15; }
  .dot.gray  { background: var(--vscode-descriptionForeground, #999); }
  .tenant-panel { margin-top: 8px; background: var(--vscode-input-background); border: 1px solid var(--vscode-panel-border, #444); border-radius: 6px; padding: 8px 10px; font-size: 11px; }
  .tenant-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .tenant-info { color: var(--vscode-descriptionForeground); flex: 1; min-width: 0; }
  .tenant-info span { color: var(--vscode-foreground); font-weight: 600; }
  .btn-verify { padding: 3px 8px; background: #1E6FFF; color: #fff; border: none; border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
  .btn-verify:hover { background: #1a5fd0; } .btn-verify:disabled { background: var(--vscode-disabledForeground, #666); color: #999; cursor: not-allowed; }
  .btn-settings { padding: 3px 8px; background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border, #444); border-radius: 4px; font-size: 10px; cursor: pointer; }
  .provider-row { display: flex; gap: 6px; padding: 8px 12px 6px; flex-shrink: 0; border-bottom: 1px solid var(--vscode-panel-border, #444); }
  .provider-row select { flex: 1; background: var(--vscode-input-background); color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border, #444); border-radius: 4px; padding: 4px 6px; font-size: 11px; outline: none; min-width: 0; }
  .action-row { display: flex; gap: 5px; padding: 5px 12px 6px; flex-shrink: 0; border-bottom: 1px solid var(--vscode-panel-border, #444); }
  .btn-action { flex: 1; padding: 4px 6px; background: var(--vscode-button-secondaryBackground, #5a5a5a); color: var(--vscode-button-secondaryForeground, #fff); border: 1px solid var(--vscode-panel-border, #444); border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer; text-align: center; white-space: nowrap; }
  .btn-action.index { background: #1a3a1a; color: #4ade80; border-color: #166534; }
  .btn-action.index:hover { background: #1E6FFF22; border-color: #1E6FFF; color: #60a5fa; }
  .btn-action:hover { background: #1E6FFF33; border-color: #1E6FFF; color: #60a5fa; }
  .chat-container { flex: 1; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
  .chat-container::-webkit-scrollbar { width: 4px; }
  .chat-container::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background, #555); border-radius: 2px; }
  .msg { display: flex; flex-direction: column; gap: 3px; }
  .msg-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85; }
  .msg.user .msg-label { color: #60a5fa; text-align: right; }
  .msg.ai   .msg-label { color: #c4b5fd; }
  .msg.sys  .msg-label { color: var(--vscode-descriptionForeground, #999); }
  .msg.err  .msg-label { color: #f87171; }
  .msg-bubble { padding: 8px 10px; border-radius: 8px; font-size: 12px; line-height: 1.6; word-break: break-word; }
  .msg.user .msg-bubble { background: var(--vscode-button-background, #1E6FFF); border: 1px solid var(--vscode-button-background, #1E6FFF); color: var(--vscode-button-foreground, #fff); align-self: flex-end; max-width: 90%; white-space: pre-wrap; }
  .msg.ai   .msg-bubble { background: var(--vscode-editor-inactiveSelectionBackground, var(--vscode-input-background)); border: 1px solid var(--vscode-panel-border, #444); color: var(--vscode-foreground); }
  .msg.sys  .msg-bubble { background: var(--vscode-textBlockQuote-background, transparent); border: 1px dashed var(--vscode-panel-border, #555); color: var(--vscode-descriptionForeground, #999); font-size: 11px; padding: 5px 8px; white-space: pre-wrap; }
  .msg.err  .msg-bubble { background: #3a1a1a; border: 1px solid #7f1d1d; color: #f87171; white-space: pre-wrap; }
  .msg-bubble p { margin-bottom: 6px; } .msg-bubble p:last-child { margin-bottom: 0; }
  .msg-bubble strong { color: var(--vscode-foreground); font-weight: 700; }
  .msg-bubble em { color: #a5b4fc; font-style: italic; }
  .msg-bubble h1,.msg-bubble h2,.msg-bubble h3 { color: var(--vscode-foreground); font-weight: 700; margin: 8px 0 4px; border-bottom: 1px solid var(--vscode-panel-border, #444); padding-bottom: 3px; }
  .msg-bubble h1 { font-size: 14px; } .msg-bubble h2 { font-size: 13px; } .msg-bubble h3 { font-size: 12px; }
  .msg-bubble ul,.msg-bubble ol { padding-left: 16px; margin: 4px 0; }
  .msg-bubble li { margin-bottom: 2px; }
  .msg-bubble code { background: #0d1117; color: #79c0ff; padding: 1px 5px; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 11px; }
  .msg-bubble pre { background: #0d1117; border: 1px solid #30363d; border-radius: 0 0 6px 6px; padding: 10px 12px; overflow-x: auto; }
  .msg-bubble pre code { background: transparent; color: #e6edf3; padding: 0; font-size: 11px; line-height: 1.6; }
  .code-header { display: flex; justify-content: space-between; align-items: center; background: #161b22; border: 1px solid #30363d; border-bottom: none; border-radius: 6px 6px 0 0; padding: 4px 10px; font-size: 10px; color: #8b949e; margin-top: 6px; }
  .btn-copy { background: transparent; border: 1px solid #444; color: #aaa; cursor: pointer; font-size: 10px; padding: 1px 7px; border-radius: 3px; font-weight: 600; }
  .btn-copy:hover { background: #30363d; color: #e6edf3; border-color: #666; } .btn-copy.copied { color: #4ade80; border-color: #166534; }
  .msg-bubble blockquote { border-left: 3px solid #1E6FFF; padding-left: 10px; margin: 4px 0; color: var(--vscode-descriptionForeground, #999); font-style: italic; }
  .msg-bubble hr { border: none; border-top: 1px solid var(--vscode-panel-border, #444); margin: 8px 0; }
  .rag-badge { font-size: 10px; color: #4ade80; margin-top: 4px; }
  .cache-badge { font-size: 10px; color: #facc15; margin-top: 4px; }
  .loading { display: none; padding: 6px 12px; }
  .loading.show { display: flex; align-items: center; gap: 6px; }
  .loading span { font-size: 11px; color: var(--vscode-descriptionForeground, #999); }
  .dots span { display: inline-block; width: 5px; height: 5px; background: #1E6FFF; border-radius: 50%; margin: 0 1px; animation: bounce 1s infinite; }
  .dots span:nth-child(2) { animation-delay: 0.15s; } .dots span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-4px);opacity:1} }
  .input-area { padding: 8px 12px 10px; border-top: 1px solid var(--vscode-panel-border, #444); flex-shrink: 0; }
  .input-row { display: flex; gap: 6px; align-items: flex-end; }
  textarea { flex: 1; background: var(--vscode-input-background); color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border, #444); border-radius: 6px; padding: 7px 9px; font-size: 12px; resize: none; outline: none; font-family: inherit; line-height: 1.5; min-height: 36px; max-height: 150px; transition: border-color 0.15s; }
  textarea:focus { border-color: #1E6FFF; }
  .btn-send { width: 32px; height: 32px; background: #1E6FFF; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .btn-send:hover { background: #1a5fd0; } .btn-send:disabled { background: var(--vscode-disabledForeground, #555); cursor: not-allowed; }
  .input-hint { font-size: 10px; color: var(--vscode-descriptionForeground, #999); margin-top: 4px; text-align: right; }
  .welcome { text-align: center; padding: 30px 10px; color: var(--vscode-descriptionForeground, #999); }
  .welcome .w-icon { font-size: 28px; margin-bottom: 8px; }
  .welcome p { font-size: 12px; line-height: 1.6; }
  .help-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.65); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .help-panel { background: var(--vscode-sideBar-background); border: 1px solid #1E6FFF66; border-radius: 12px; width: 100%; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
  .help-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-bottom: 1px solid #1E6FFF22; background: linear-gradient(135deg, #1E6FFF11, transparent); border-radius: 12px 12px 0 0; }
  .help-header-title { font-size: 12px; font-weight: 700; color: #60a5fa; letter-spacing: 0.3px; }
  .help-close { background: transparent; border: 1px solid var(--vscode-panel-border, #444); color: var(--vscode-descriptionForeground, #999); cursor: pointer; font-size: 11px; padding: 3px 8px; border-radius: 4px; }
  .help-close:hover { background: #3a1a1a; border-color: #7f1d1d; color: #f87171; }
  .help-section { padding: 10px 14px; border-bottom: 1px solid var(--vscode-panel-border, #444); }
  .help-section:last-child { border-bottom: none; padding-bottom: 14px; }
  .help-title { font-size: 9px; font-weight: 700; color: #1E6FFF; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
  .help-item { display: grid; grid-template-columns: 88px 1fr; gap: 8px; align-items: start; margin-bottom: 6px; }
  .help-item:last-child { margin-bottom: 0; }
  .help-key { font-size: 10px; font-weight: 600; color: var(--vscode-foreground); background: var(--vscode-input-background); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--vscode-panel-border, #444); text-align: center; line-height: 1.6; }
  .help-desc { font-size: 10px; color: var(--vscode-descriptionForeground, #999); line-height: 1.7; padding-top: 2px; }
  .help-tip { font-size: 10px; color: #fbbf24; background: #1c1500; border: 1px solid #92400e44; border-radius: 5px; padding: 5px 10px; margin-bottom: 5px; line-height: 1.6; }
  .help-tip:last-child { margin-bottom: 0; }
  .diff-preview { margin-top: 8px; border: 1px solid #1E6FFF44; border-radius: 8px; overflow: hidden; font-size: 11px; }
  .diff-header { background: #0d1117; padding: 5px 10px; font-size: 10px; color: #8b949e; font-weight: 600; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; }
  .diff-header-title { color: #60a5fa; }
  .diff-body { font-family: 'Consolas', monospace; font-size: 11px; line-height: 1.6; max-height: 300px; overflow-y: auto; }
  .diff-line { padding: 1px 10px; white-space: pre; }
  .diff-line.removed { background: #3d0000; color: #ff7b72; }
  .diff-line.removed::before { content: '- '; color: #f85149; }
  .diff-line.added { background: #003d00; color: #7ee787; }
  .diff-line.added::before { content: '+ '; color: #56d364; }
  .diff-line.context { background: transparent; color: #8b949e; }
  .diff-line.context::before { content: '  '; }
  .diff-actions { display: flex; align-items: center; gap: 8px; padding: 7px 10px; background: #0d1117; border-top: 1px solid #30363d; }
  .btn-diff-cancel { padding: 4px 12px; background: transparent; color: #aaa; border: 1px solid #555; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600; }
  .btn-diff-cancel:hover { background: #3a1a1a; color: #f87171; border-color: #7f1d1d; }
</style>
</head>
<body>

<div class="header">
  <div class="logo-row">
    <div class="logo-badge">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" stroke="#0354ff" stroke-width="1.5" fill="#0354ff"/>
          <line x1="8" y1="6.5" x2="8" y2="17.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="8" y1="12" x2="16" y2="6.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="8" y1="12" x2="16" y2="17.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="16" cy="6.5" r="1.2" fill="white"/>
        </svg>
    </div>
    <span class="logo-text">KaddyCode</span>
    <button class="btn-help" id="btnHelp">? 버튼설명</button>
    <button class="btn-clear" id="btnClear">🗑 대화창 비우기</button>
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
  <button class="btn-action" id="btnIndexFile">📂 파일 인덱싱</button>
  <button class="btn-action" id="btnExplain">💡 코드 설명</button>
  <button class="btn-action" id="btnReview">● 코드 리뷰</button>
  <button class="btn-action" id="btnBypassCache" title="캐시를 무시하고 AI에게 직접 질문">🔄 캐시 무시</button>
</div>

<!-- 헬프 오버레이 -->
<div class="help-overlay" id="helpOverlay" style="display:none;">
  <div class="help-panel">
    <div class="help-header">
      <span class="help-header-title">📖 KaddyCode 기능 안내</span>
      <button class="help-close" id="helpClose">✕ 닫기</button>
    </div>
    <div class="help-section">
      <div class="help-title">채팅창 버튼</div>
      <div class="help-item"><span class="help-key">📂 파일 인덱싱</span><span class="help-desc">현재 파일을 AI 검색 대상에 등록</span></div>
      <div class="help-item"><span class="help-key">💡 코드 설명</span><span class="help-desc">선택한 코드 설명 요청</span></div>
      <div class="help-item"><span class="help-key">● 코드 리뷰</span><span class="help-desc">코드 품질·개선점 분석 요청</span></div>
      <div class="help-item"><span class="help-key">🔄 캐시 무시</span><span class="help-desc">캐시 건너뛰고 AI 직접 호출</span></div>
      <div class="help-item"><span class="help-key">🗑 대화창 비우기</span><span class="help-desc">채팅창 초기화 (서버 기록 유지)</span></div>
    </div>
    <div class="help-section">
      <div class="help-title">CodeLens 버튼 (에디터 인라인)</div>
      <div class="help-item"><span class="help-key">💬 Explain</span><span class="help-desc">코드 상세 설명</span></div>
      <div class="help-item"><span class="help-key">✏️ Fix</span><span class="help-desc">선택 영역 문제점 찾아 수정</span></div>
      <div class="help-item"><span class="help-key">Q Ask</span><span class="help-desc">코드 관련 질문 입력</span></div>
      <div class="help-item"><span class="help-key">📝 Doc</span><span class="help-desc">선택 영역 주석 자동 생성</span></div>
    </div>
    <div class="help-section">
      <div class="help-title">사용 팁</div>
      <div class="help-tip">💡 Fix · Doc 사용 시 수정할 코드를 드래그 선택 후 클릭하세요</div>
      <div class="help-tip">⌨️ Enter: 전송 &nbsp;·&nbsp; Shift+Enter: 줄바꿈</div>
    </div>
  </div>
</div>

<div class="chat-container" id="chatContainer">
  <div class="welcome" id="welcome">
    <div class="w-icon">⚡</div>
    <p>KaddyCode AI 어시스턴트<br/>코드를 선택하거나 질문을 입력하세요</p>
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
var bypassCache = false;

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
      // 로딩 시작/종료 모두 스크롤 최하단으로
      setTimeout(function() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 50);
      break;
    case 'clearHistory':
      chatContainer.innerHTML = '';
      chatContainer.appendChild(welcome);
      welcome.style.display = 'block';
      break;
    case 'setInputText':
      msgInput.value = msg.text;
      msgInput.style.height = 'auto';
      msgInput.style.height = Math.min(msgInput.scrollHeight, 150) + 'px';
      msgInput.focus();
      // 커서를 맨 끝으로 이동
      msgInput.setSelectionRange(msgInput.value.length, msgInput.value.length);
      msgInput.scrollTop = msgInput.scrollHeight;
      break;
    case 'showDiffPreview':
      showDiffPreview(msg.originalCode, msg.newCode);
      break;
    // ── CodeLens Apply Actions ──────────────────────────────────────────
    case 'requestCodeLensAction':
      var p = document.getElementById('providerSelect').value;
      var m = document.getElementById('modelSelect').value;
      // prompt가 비어있으면 전송 안 함 (ask는 setInputText로 처리됨)
      if (!msg.payload.prompt || msg.payload.prompt.trim() === '') { break; }
      console.log('[KaddyCode] executeCodeLensAction provider=' + p + ' model=' + m);
      vscode.postMessage({
        command:    'executeCodeLensAction',
        prompt:     msg.payload.prompt,
        label:      msg.payload.label,
        language:   msg.payload.language,
        provider:   p,
        model:      m,
        allowApply: msg.payload.allowApply,
      });
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
  var labelMap={user:'You',assistant:'KaddyCode AI',error:'Error',system:'System'};
  var cls=roleMap[role]||'sys';
  div.className='msg '+cls;
  var isCached=model&&(model.indexOf('[캐시]')>=0||model.indexOf('[유사질문 캐시]')>=0);
  var isVector=model&&model.indexOf('[유사질문 캐시]')>=0;
  var modelLabel=model?' <span style="font-size:10px;opacity:0.75;color:var(--vscode-descriptionForeground);">· '+escapeHtml(model)+'</span>':'';
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
    // user 메시지는 버블 상단이 보이도록 스크롤
    if (cls === 'user') {
      div.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

function showDiffPreview(originalCode, newCode) {
  // 기존 diff 제거
  var existing = document.getElementById('diffPreviewBlock');
  if (existing) { existing.remove(); }

  var origLines = originalCode.split('\\n');
  var newLines  = newCode.split('\\n');

  // 라인 단위 diff (removed/added)
  var diffHtml = '';
  var maxLen = Math.max(origLines.length, newLines.length);
  // 단순 라인 비교: 원본에만 있으면 removed, 수정본에만 있으면 added, 동일하면 context
  var i = 0, j = 0;
  while (i < origLines.length || j < newLines.length) {
    var ol = i < origLines.length ? origLines[i] : null;
    var nl = j < newLines.length  ? newLines[j]  : null;
    if (ol !== null && nl !== null && ol === nl) {
      diffHtml += '<div class="diff-line context">' + escapeHtml(ol) + '</div>';
      i++; j++;
    } else {
      if (ol !== null) {
        diffHtml += '<div class="diff-line removed">' + escapeHtml(ol) + '</div>';
        i++;
      }
      if (nl !== null) {
        diffHtml += '<div class="diff-line added">' + escapeHtml(nl) + '</div>';
        j++;
      }
    }
  }

  var block = document.createElement('div');
  block.id = 'diffPreviewBlock';
  block.className = 'msg sys';
  block.innerHTML =
    '<div class="msg-label">System</div>' +
    '<div class="diff-preview">' +
      '<div class="diff-header">' +
        '<span class="diff-header-title">📋 변경 미리보기</span>' +
        '<span style="font-size:9px;color:#6b7280;">적용 전 확인하세요</span>' +
      '</div>' +
      '<div class="diff-body">' + diffHtml + '</div>' +
      '<div class="diff-actions">' +
        '<span style="font-size:10px;color:#9ca3af;">위 코드 블록을 복사 후 직접 붙여넣기 하세요</span>' +
        '<button class="btn-diff-cancel" id="btnDiffCancel">✕ 닫기</button>' +
      '</div>' +
    '</div>';

  chatContainer.appendChild(block);
  block.scrollIntoView({ behavior: 'smooth', block: 'end' });

  document.getElementById('btnDiffCancel').addEventListener('click', function() {
    block.remove();
  });
}

function syncProviderModel() {
  var provider = document.getElementById('providerSelect').value;
  var model    = document.getElementById('modelSelect').value;
  vscode.postMessage({ command: 'syncProviderModel', provider: provider, model: model });
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
  vscode.postMessage({command:'sendMessage',text:'선택한 코드를 상세히 설명해주세요.',provider:provider,model:model,bypassCache:bypassCache});
});
document.getElementById('btnReview').addEventListener('click', function(){
  var provider=document.getElementById('providerSelect').value, model=document.getElementById('modelSelect').value;
  vscode.postMessage({command:'sendMessage',text:'선택한 코드를 리뷰하고 개선 사항을 알려주세요.',provider:provider,model:model,bypassCache:bypassCache});
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
document.getElementById('providerSelect').addEventListener('change', function() {
  onProviderChange();
  syncProviderModel();
});
document.getElementById('modelSelect').addEventListener('change', syncProviderModel);
document.getElementById('btnHelp').addEventListener('click', function() {
  var overlay = document.getElementById('helpOverlay');
  overlay.style.display = overlay.style.display === 'none' ? 'flex' : 'none';
});
document.getElementById('helpClose').addEventListener('click', function() {
  document.getElementById('helpOverlay').style.display = 'none';
});
// 오버레이 배경 클릭 시 닫기
document.getElementById('helpOverlay').addEventListener('click', function(e) {
  if (e.target === this) { this.style.display = 'none'; }
});
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

syncProviderModel();  
vscode.postMessage({command:'ready'});
</script>
</body>
</html>`;
}