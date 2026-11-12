(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STOP_SENTENCE = '这段对话不适合翻译，建议找一个现实里的人聊聊，或联系专业机构。';
  var ASK_SENTENCE = '全翻，还是只翻冲突最集中的几段？';
  var BANNED = ['你总是', '你从来', '你能不能别'];

  var prompts = {
    system: window.FALLBACK_PROMPT,
    screenshot: window.FALLBACK_SCREENSHOT_PROMPT,
    reply: window.FALLBACK_REPLY_PROMPT
  };
  var activeTab = 'shot';
  var outputs = { shot: '', reply: '' };
  var images = [];
  var seq = 0;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function setStatus(text, kind) {
    var el = $('status');
    el.textContent = text;
    el.className = 'status' + (kind ? ' ' + kind : '');
  }
  function toast(text) { $('toast').textContent = text || ''; }
  function linesOf(text) {
    return text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
  }

  /* 启动时尽量读仓库里的 md，保证提示词单一来源；读不到就用 data.js 里的副本 */
  async function loadPrompts() {
    var files = [
      { key: 'system', name: 'SYSTEM_PROMPT.md' },
      { key: 'screenshot', name: 'SCREENSHOT_PROMPT.md' },
      { key: 'reply', name: 'REPLY_PROMPT.md' }
    ];
    var loaded = 0;
    for (var i = 0; i < files.length; i++) {
      var f = files[i], done = false;
      var candidates = ['../' + f.name, './' + f.name];
      for (var j = 0; j < candidates.length && !done; j++) {
        try {
          var res = await fetch(candidates[j]);
          if (!res.ok) continue;
          var md = await res.text();
          var m = md.match(/```text\r?\n([\s\S]*?)\r?\n```/);
          if (m && m[1]) {
            prompts[f.key] = m[1].replace(/\r\n/g, '\n');
            done = true; loaded++;
          }
        } catch (e) { /* file:// 或跨域，回退内嵌副本 */ }
      }
    }
    $('prompt-source').textContent = '提示词来源：' +
      (loaded === 3 ? '仓库 md 文件' : loaded ? '部分来自 md，部分内置副本' : '内置副本');
    refreshPromptView();
  }

  function currentPrompt() {
    return activeTab === 'shot'
      ? prompts.system + '\n\n' + prompts.screenshot
      : prompts.reply;
  }
  function refreshPromptView() { $('prompt-text').textContent = currentPrompt(); }

  /* ---------- 翻译输出的解析与渲染 ---------- */

  function parseOutput(text) {
    var blocks = [], tail = { f: '', s: '', o: '' }, prelude = [], cur = null;
    linesOf(text).forEach(function (line) {
      var m = line.match(/^【([AB])】原话：(.*)$/);
      if (m) {
        cur = { who: m[1], quote: m[2], emotion: '', fact: '', need: '', guesses: [], procs: [] };
        blocks.push(cur); return;
      }
      if (line.indexOf('真正的分歧点：') === 0) { tail.f = line.slice(7); return; }
      if (line.indexOf('都没说出口的：') === 0) { tail.s = line.slice(7); return; }
      if (line.indexOf('翻译版开场：') === 0) { tail.o = line.slice(6); return; }
      if (!cur) { prelude.push(line); return; }
      if (line.indexOf('情绪：') === 0) cur.emotion = line.slice(3);
      else if (line.indexOf('事实：') === 0) cur.fact = line.slice(3);
      else if (line.indexOf('需求：') === 0) cur.need = line.slice(3);
      else if (line.indexOf('推测') !== -1) cur.guesses.push(line);
      else cur.procs.push(line);
    });
    return { blocks: blocks, tail: tail, prelude: prelude };
  }

  function meter(emotion) {
    var m = emotion.match(/(\d)\s*\/\s*5/);
    var n = m ? parseInt(m[1], 10) : 0, out = '<span class="meter">';
    for (var i = 1; i <= 5; i++) out += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return out + '</span>';
  }

  function renderStop(text) {
    var reason = linesOf(text).filter(function (l) { return l.indexOf(STOP_SENTENCE) === -1; }).join(' ');
    $('fmt').innerHTML = '<div class="stop-box">' +
      '<div class="stop-line">' + esc(STOP_SENTENCE) + '</div>' +
      (reason ? '<div class="stop-reason">' + esc(reason) + '</div>' : '') +
      '<ul><li>不逐句翻译，不列需求，不写收尾三段，也不给回复建议。</li><li>不判断谁的责任，也不给关系结论。</li></ul></div>';
  }

  function renderAsk(interactive) {
    $('fmt').innerHTML = '<div class="ask-box"><p>' + esc(ASK_SENTENCE) + '</p>' +
      '<div class="actions">' +
      '<button id="ask-all" class="btn primary" type="button">全翻</button>' +
      '<button id="ask-part" class="btn" type="button">只翻冲突最集中的几段</button></div>' +
      (interactive ? '' : '<p class="note">这是内置演示的输出。真实分析会按你在「翻译范围」里选的范围直接输出。</p>') + '</div>';
    var all = $('ask-all'), part = $('ask-part');
    if (interactive) {
      all.addEventListener('click', function () { $('scope').value = '全翻'; requestShot(); });
      part.addEventListener('click', function () { $('scope').value = '只翻冲突最集中的几段'; requestShot(); });
    } else { all.disabled = true; part.disabled = true; }
  }

  function renderFormatted(text) {
    var p = parseOutput(text);
    if (!p.blocks.length) {
      $('fmt').innerHTML = '<div class="empty">未识别到标准格式，已切到原始文本视图。</div>';
      setStatus('格式未识别，展示原始文本', 'error');
      switchView('raw'); return;
    }
    var html = '';
    p.prelude.forEach(function (l) { html += '<div class="declare">' + esc(l) + '</div>'; });
    p.blocks.forEach(function (b) {
      html += '<article class="msg ' + (b.who === 'B' ? 'who-b' : '') + '">';
      html += '<div class="msg-head"><span class="who">' + b.who + '</span><span class="quote">' + esc(b.quote) + '</span></div>';
      if (b.emotion) html += '<div class="row"><span class="k">情绪</span><span class="v emotion">' + esc(b.emotion) + meter(b.emotion) + '</span></div>';
      if (b.fact) html += '<div class="row"><span class="k">事实</span><span class="v">' + esc(b.fact) + '</span></div>';
      if (b.need) html += '<div class="row"><span class="k">需求</span><span class="v">' + esc(b.need) + '</span></div>';
      b.guesses.forEach(function (l) { html += '<div class="guess">' + esc(l) + '</div>'; });
      b.procs.forEach(function (l) { html += '<div class="proc">' + esc(l) + '</div>'; });
      html += '</article>';
    });
    if (p.tail.f || p.tail.s || p.tail.o) {
      html += '<div class="tail"><h3>全文收尾</h3>';
      if (p.tail.f) html += '<div class="tail-row"><span>真正的分歧点</span><p>' + esc(p.tail.f) + '</p></div>';
      if (p.tail.s) html += '<div class="tail-row"><span>都没说出口的</span><p>' + esc(p.tail.s) + '</p></div>';
      if (p.tail.o) html += '<div class="tail-row"><span>翻译版开场</span><p>' + esc(p.tail.o) + '</p></div>';
      html += '</div>';
    }
    $('fmt').innerHTML = html;
  }

  /* ---------- 推荐回复的解析与渲染 ---------- */

  function bannedIn(text) {
    var hits = [];
    BANNED.forEach(function (w) { if (text.indexOf(w) !== -1) hits.push(w); });
    if (/[!！]/.test(text)) hits.push('感叹号');
    return hits;
  }

  function parseReplies(text) {
    var items = [], cur = null;
    linesOf(text).forEach(function (line) {
      var m = line.match(/^【(\d)】(.+)$/);
      if (m) { cur = { tone: m[2], text: '', note: '' }; items.push(cur); return; }
      if (!cur) return;
      if (line.indexOf('回复：') === 0) cur.text = line.slice(3);
      else if (line.indexOf('说明：') === 0) cur.note = line.slice(3);
    });
    return items;
  }

  function renderReplies(text) {
    var items = parseReplies(text);
    if (!items.length) {
      $('fmt').innerHTML = '<div class="empty">未识别到 3 条回复，已切到原始文本视图。</div>';
      setStatus('格式未识别，展示原始文本', 'error');
      switchView('raw'); return;
    }
    $('fmt').innerHTML = items.map(function (it, idx) {
      var hits = bannedIn(it.text);
      return '<article class="reply-card">' +
        '<div class="reply-head"><span class="tone">' + esc(it.tone) + '</span>' +
        '<button class="mini-btn" data-copy="' + idx + '" type="button">复制这句</button></div>' +
        '<div class="reply-text">' + esc(it.text) + '</div>' +
        (it.note ? '<div class="reply-note">' + esc(it.note) + '</div>' : '') +
        (hits.length ? '<div class="violation">命中规则禁止的句式：' + esc(hits.join('、')) + '。这条不建议直接发送。</div>' : '') +
        '</article>';
    }).join('');
    Array.prototype.forEach.call($('fmt').querySelectorAll('[data-copy]'), function (btn) {
      btn.addEventListener('click', function () {
        var it = items[parseInt(btn.getAttribute('data-copy'), 10)];
        copyText(it.text).then(function () { toast('已复制这条回复。'); })
          .catch(function () { toast('复制失败，可以手动选中这句话。'); });
      });
    });
  }

  function switchView(which) {
    $('tab-fmt').classList.toggle('active', which === 'fmt');
    $('tab-raw').classList.toggle('active', which === 'raw');
    $('fmt').hidden = which !== 'fmt';
    $('raw').hidden = which !== 'raw';
  }

  function renderOutput(text, tab, interactive) {
    var t = text.trim();
    if (t.indexOf(STOP_SENTENCE) === 0) { renderStop(t); return; }
    if (t === ASK_SENTENCE) { renderAsk(interactive); return; }
    if (tab === 'reply') { renderReplies(t); return; }
    renderFormatted(t);
  }

  function showOutput(text, source, tab, interactive) {
    outputs[tab] = text;
    if (tab !== activeTab) return;
    $('raw').textContent = text;
    switchView('fmt');
    renderOutput(text, tab, interactive !== false);
    setStatus(source + ' · 已渲染', 'done');
  }

  /* ---------- 本地兜底检查 ---------- */

  function precheck(chat) {
    for (var i = 0; i < window.STOP_PATTERNS.length; i++) {
      var g = window.STOP_PATTERNS[i];
      for (var j = 0; j < g.words.length; j++) {
        if (chat.indexOf(g.words[j]) !== -1) return g.group;
      }
    }
    return null;
  }

  /* ---------- 图片 ---------- */

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('读取图片失败')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('图片解码失败')); };
        img.onload = function () {
          var max = 1600;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          var dataUrl = c.toDataURL('image/jpeg', 0.9);
          resolve({ name: file.name, dataUrl: dataUrl, width: w, height: h, bytes: Math.round(dataUrl.length * 0.75) });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderThumbs() {
    $('thumbs').innerHTML = images.map(function (im) {
      return '<div class="thumb"><img src="' + esc(im.dataUrl) + '" alt="' + esc(im.name) + '">' +
        '<button class="del" data-del="' + im.id + '" type="button" aria-label="移除">×</button>' +
        '<div class="size">' + Math.round(im.bytes / 1024) + ' KB · ' + im.width + '×' + im.height + '</div></div>';
    }).join('');
    Array.prototype.forEach.call($('thumbs').querySelectorAll('[data-del]'), function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-del'), 10);
        images = images.filter(function (x) { return x.id !== id; });
        renderThumbs();
      });
    });
    $('pane-hint').textContent = images.length ? '已添加 ' + images.length + ' 张图片' : '未添加图片';
  }

  async function addFiles(list) {
    var arr = Array.prototype.slice.call(list || []).filter(function (f) { return /^image\//.test(f.type); });
    if (!arr.length) { toast('没有识别到图片文件。'); return; }
    var room = 4 - images.length;
    if (room <= 0) { toast('最多 4 张，先删掉一张再添加。'); return; }
    var skipped = arr.length > room;
    arr = arr.slice(0, room);
    toast('正在压缩图片…');
    for (var i = 0; i < arr.length; i++) {
      try {
        var im = await compressImage(arr[i]);
        im.id = ++seq;
        images.push(im);
      } catch (e) { toast('有一张图片读取失败：' + e.message); }
    }
    renderThumbs();
    toast('已添加 ' + arr.length + ' 张（长边压到 1600px）。' + (skipped ? '最多 4 张，多余的没加。' : ''));
  }

  /* ---------- 模型请求 ---------- */

  function readConfig() {
    var base = $('base').value.trim().replace(/\/+$/, '');
    var key = $('key').value.trim();
    var model = $('model').value.trim();
    if (!base || !key || !model) throw new Error('请先展开顶部「模型接入设置」，填完整 Base URL、API Key 和模型名。');
    return { base: base, key: key, model: model };
  }

  async function callApi(messages) {
    var cfg = readConfig();
    var res = await fetch(cfg.base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model, temperature: 0.2, messages: messages })
    });
    if (!res.ok) {
      var detail = '';
      try { var j = await res.json(); detail = (j && j.error && j.error.message) || ''; } catch (e) { /* 非 JSON 响应 */ }
      throw new Error('接口返回 ' + res.status + (detail ? '：' + detail : '') +
        '。截图分析需要模型支持图片输入，且端点要接受 data URL 形式的 base64 图片。');
    }
    var data = await res.json();
    var out = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!out) throw new Error('响应里没有找到文本内容。');
    return out;
  }

  function setBusy(on, label) {
    $('shot-run').disabled = on;
    $('reply-run').disabled = on;
    if (on) setStatus(label + '…', 'busy');
  }

  async function runRequest(messages, tab, label) {
    setBusy(true, label);
    try {
      var out = await callApi(messages);
      showOutput(out.trim(), '模型输出', tab, true);
      toast('');
    } catch (e) {
      var msg = e && e.message ? e.message : String(e);
      if (e instanceof TypeError) msg += '（可能是浏览器跨域限制或网络不可达；也可以点「复制提示词 + 当前输入」去模型对话框里跑。）';
      setStatus('请求失败', 'error');
      $('fmt').innerHTML = '<div class="err-box"><strong>请求失败</strong><p>' + esc(msg) + '</p></div>';
      $('raw').textContent = '';
      switchView('fmt');
      toast('');
    } finally { setBusy(false); }
  }

  function requestShot() {
    if (!images.length) { toast('先添加聊天截图（拖入 / 粘贴 / 选择图片），或点「看示例输出」。'); return; }
    var note = $('shot-note').value.trim();
    var hit = precheck(note);
    if (hit) {
      showOutput(STOP_SENTENCE + '\n原因：本地预检命中「' + hit + '」，按规则立即停止。', '本地预检停机', 'shot', false);
      toast('图片里的内容无法本地预检，这里只检查了补充说明文字。');
      return;
    }
    var text = '【输入】微信 / QQ 聊天截图，共 ' + images.length + ' 张。\n【翻译范围】' + $('scope').value;
    if (note) text += '\n【补充说明】' + note;
    var content = [{ type: 'text', text: text }];
    images.forEach(function (im) { content.push({ type: 'image_url', image_url: { url: im.dataUrl } }); });
    runRequest([
      { role: 'system', content: currentPrompt() },
      { role: 'user', content: content }
    ], 'shot', '正在分析截图');
  }

  function requestReply() {
    var said = $('reply-input').value.trim();
    if (!said) { toast('先贴对方刚说的话，或点「看示例输出」。'); return; }
    var mine = $('reply-context').value.trim();
    var hit = precheck(said + '\n' + mine);
    if (hit) {
      showOutput(STOP_SENTENCE + '\n原因：本地预检命中「' + hit + '」，按规则立即停止。', '本地预检停机', 'reply', false);
      toast('词表只是兜底，未命中不代表安全。');
      return;
    }
    var text = '【对方刚说的话】\n' + said;
    if (mine) text += '\n\n【我想表达的意思】\n' + mine;
    runRequest([
      { role: 'system', content: prompts.reply },
      { role: 'user', content: text }
    ], 'reply', '正在生成推荐回复');
  }

  /* ---------- 复制 ---------- */

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('复制失败'));
    });
  }

  function copyPrompt() {
    var inputText;
    if (activeTab === 'shot') {
      inputText = '【聊天截图】' + (images.length ? images.length + ' 张（图片需另行粘贴）' : '（此处粘贴截图）') +
        '\n【翻译范围】' + $('scope').value;
      var note = $('shot-note').value.trim();
      if (note) inputText += '\n【补充说明】' + note;
    } else {
      inputText = '【对方刚说的话】\n' + ($('reply-input').value.trim() || '（此处粘贴对方的话）');
      var mine = $('reply-context').value.trim();
      if (mine) inputText += '\n\n【我想表达的意思】\n' + mine;
    }
    copyText(currentPrompt() + '\n\n' + inputText).then(function () {
      toast('已复制提示词 + 当前输入。' + (activeTab === 'shot' && images.length ? '图片无法复制到剪贴板，请连同截图一起粘到模型对话框。' : ''));
    }).catch(function () { toast('复制失败，可以展开提示词框手动选中。'); });
  }

  /* ---------- 板块切换与示例 ---------- */

  function showDemo(tab, key) {
    var demo = tab === 'shot' ? window.SHOT_DEMOS[key] : window.REPLY_DEMOS[key];
    showOutput(demo.output, '内置演示', tab, false);
    toast('展示的是仓库里的固定示例，未联网、未发送图片。');
  }

  function switchTab(tab) {
    activeTab = tab;
    $('pane-shot').hidden = tab !== 'shot';
    $('pane-reply').hidden = tab !== 'reply';
    $('tab-shot').classList.toggle('active', tab === 'shot');
    $('tab-reply').classList.toggle('active', tab === 'reply');
    $('tab-shot').setAttribute('aria-selected', tab === 'shot' ? 'true' : 'false');
    $('tab-reply').setAttribute('aria-selected', tab === 'reply' ? 'true' : 'false');
    $('pane-hint').textContent = tab === 'shot'
      ? (images.length ? '已添加 ' + images.length + ' 张图片' : '未添加图片')
      : ($('reply-input').value.trim().length + ' 字');
    refreshPromptView();
    if (outputs[tab]) {
      $('raw').textContent = outputs[tab];
      switchView('fmt');
      renderOutput(outputs[tab], tab, false);
      setStatus('已显示该板块上次的输出', '');
    } else if (tab === 'reply') {
      showOutput(window.REPLY_DEMOS.normal.output, '内置演示', 'reply', false);
    } else {
      $('fmt').innerHTML = '<div class="empty">还没有输出。</div>';
      $('raw').textContent = '';
      setStatus('就绪', '');
    }
  }

  /* ---------- 事件绑定 ---------- */

  $('tab-shot').addEventListener('click', function () { switchTab('shot'); });
  $('tab-reply').addEventListener('click', function () { switchTab('reply'); });
  $('shot-run').addEventListener('click', requestShot);
  $('reply-run').addEventListener('click', requestReply);
  $('shot-demo').addEventListener('click', function () { showDemo('shot', $('shot-sample').value); });
  $('reply-demo').addEventListener('click', function () { showDemo('reply', $('reply-sample').value); });
  $('shot-sample').addEventListener('change', function () { showDemo('shot', this.value); });
  $('reply-sample').addEventListener('change', function () { showDemo('reply', this.value); });
  $('copy-prompt').addEventListener('click', copyPrompt);
  $('tab-fmt').addEventListener('click', function () { switchView('fmt'); });
  $('tab-raw').addEventListener('click', function () { switchView('raw'); });
  $('reply-input').addEventListener('input', function () {
    if (activeTab === 'reply') $('pane-hint').textContent = this.value.trim().length + ' 字';
  });

  $('file').addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
  var drop = $('drop');
  drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
  drop.addEventListener('drop', function (e) {
    e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files);
  });
  document.addEventListener('paste', function (e) {
    if (activeTab !== 'shot') return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    var items = (e.clipboardData || {}).items || [], files = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') { var f = items[i].getAsFile(); if (f) files.push(f); }
    }
    if (files.length) { e.preventDefault(); addFiles(files); }
  });

  /* ---------- 初始化 ---------- */
  renderThumbs();
  showOutput(window.SHOT_DEMOS.basic.output, '内置演示', 'shot', false);
  refreshPromptView();
  loadPrompts();
})();
