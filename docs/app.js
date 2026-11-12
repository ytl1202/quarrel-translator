(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STOP_SENTENCE = '这段对话不适合翻译，建议找一个现实里的人聊聊，或联系专业机构。';
  var ASK_SENTENCE = '全翻，还是只翻冲突最集中的几段？';

  var activePrompt = window.FALLBACK_PROMPT;
  var lastOutput = '';

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

  function getMode() {
    var checked = document.querySelector('input[name="mode"]:checked');
    return checked ? checked.value : 'demo';
  }

  function linesOf(text) {
    return text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
  }

  function refreshCount() {
    var n = linesOf($('chat').value).length;
    $('count-hint').textContent = '按非空行计 ' + n + ' 条' + (n > 6 ? '（超过 6 条）' : '');
  }

  /* 启动时尽量从仓库里的 SYSTEM_PROMPT.md 读取，保证单一来源；读不到就用内嵌副本 */
  async function loadPrompt() {
    var candidates = ['../SYSTEM_PROMPT.md', './SYSTEM_PROMPT.md'];
    for (var i = 0; i < candidates.length; i++) {
      try {
        var res = await fetch(candidates[i]);
        if (!res.ok) continue;
        var md = await res.text();
        var m = md.match(/```text\r?\n([\s\S]*?)\r?\n```/);
        if (m && m[1]) {
          activePrompt = m[1].replace(/\r\n/g, '\n');
          $('prompt-source').textContent = '提示词来源：' + candidates[i];
          break;
        }
      } catch (e) { /* file:// 或跨域，回退内嵌副本 */ }
    }
    $('prompt-text').textContent = activePrompt;
  }

  /* ---------- 输出解析与渲染 ---------- */

  function parseOutput(text) {
    var blocks = [];
    var tail = { f: '', s: '', o: '' };
    var prelude = [];
    var cur = null;
    linesOf(text).forEach(function (line) {
      var m = line.match(/^【([AB])】原话：(.*)$/);
      if (m) {
        cur = { who: m[1], quote: m[2], emotion: '', fact: '', need: '', guesses: [], procs: [] };
        blocks.push(cur);
        return;
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
    var n = m ? parseInt(m[1], 10) : 0;
    var out = '<span class="meter">';
    for (var i = 1; i <= 5; i++) out += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return out + '</span>';
  }

  function renderStop(text) {
    var reason = linesOf(text).filter(function (l) { return l.indexOf(STOP_SENTENCE) === -1; }).join(' ');
    $('fmt').innerHTML =
      '<div class="stop-box">' +
      '<div class="stop-line">' + esc(STOP_SENTENCE) + '</div>' +
      (reason ? '<div class="stop-reason">' + esc(reason) + '</div>' : '') +
      '<ul><li>不逐句翻译，不列需求，不写收尾三段。</li><li>不判断谁的责任，也不给关系结论。</li></ul>' +
      '</div>';
  }

  function renderAsk(interactive) {
    $('fmt').innerHTML =
      '<div class="ask-box"><p>' + esc(ASK_SENTENCE) + '</p>' +
      '<div class="actions">' +
      '<button id="ask-all" class="btn primary" type="button">全翻</button>' +
      '<button id="ask-part" class="btn" type="button">只翻冲突最集中的几段</button>' +
      '</div>' +
      (interactive ? '' : '<p class="note">这是内置演示的输出。切到「接入模型」并填好配置后可以继续选择范围。</p>') +
      '</div>';
    var all = $('ask-all'), part = $('ask-part');
    if (interactive) {
      all.addEventListener('click', function () { startApi('全翻'); });
      part.addEventListener('click', function () { startApi('只翻冲突最集中的几段'); });
    } else {
      all.disabled = true; part.disabled = true;
    }
  }

  function renderFormatted(text, interactive) {
    var t = text.trim();
    if (t.indexOf(STOP_SENTENCE) === 0) { renderStop(t); return; }
    if (t === ASK_SENTENCE) { renderAsk(interactive); return; }

    var p = parseOutput(t);
    if (!p.blocks.length) {
      $('fmt').innerHTML = '<div class="empty">未识别到标准格式，已切到原始文本视图。</div>';
      setStatus('格式未识别，展示原始文本', 'error');
      switchView('raw');
      return;
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

  function switchView(which) {
    $('tab-fmt').classList.toggle('active', which === 'fmt');
    $('tab-raw').classList.toggle('active', which === 'raw');
    $('fmt').hidden = which !== 'fmt';
    $('raw').hidden = which !== 'raw';
  }

  function showOutput(text, source, interactive) {
    lastOutput = text;
    $('raw').textContent = text;
    switchView('fmt');
    renderFormatted(text, interactive !== false);
    setStatus(source + ' · 已渲染', 'done');
  }

  /* ---------- 本地预检 ---------- */

  function precheck(chat) {
    for (var i = 0; i < window.STOP_PATTERNS.length; i++) {
      var g = window.STOP_PATTERNS[i];
      for (var j = 0; j < g.words.length; j++) {
        if (chat.indexOf(g.words[j]) !== -1) return g.group;
      }
    }
    return null;
  }

  /* ---------- 模型接入 ---------- */

  async function callApi(prompt, chat, scope) {
    var base = $('base').value.trim().replace(/\/+$/, '');
    var key = $('key').value.trim();
    var model = $('model').value.trim();
    if (!base || !key || !model) throw new Error('请填完整 Base URL、API Key 和模型名。');

    var user = '【聊天记录】\n' + chat;
    if (scope) user += '\n\n【翻译范围】' + scope;

    var res = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: model,
        temperature: 0.2,
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: user }]
      })
    });

    if (!res.ok) {
      var detail = '';
      try { var j = await res.json(); detail = (j && j.error && j.error.message) || ''; } catch (e) { /* 非 JSON 响应 */ }
      throw new Error('接口返回 ' + res.status + (detail ? '：' + detail : ''));
    }
    var data = await res.json();
    var out = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!out) throw new Error('响应里没有找到文本内容。');
    return out;
  }

  async function startApi(scope) {
    var chat = $('chat').value.trim();
    if (!chat) { toast('请先粘贴聊天记录。'); return; }
    $('run').disabled = true;
    setStatus('正在请求模型…', 'busy');
    try {
      var out = await callApi(activePrompt, chat, scope);
      showOutput(out.trim(), '模型输出', true);
      toast('');
    } catch (e) {
      var msg = e && e.message ? e.message : String(e);
      if (e instanceof TypeError) msg += '（可能是浏览器跨域限制或网络不可达；可以改用「复制完整提示词」在模型对话框里跑。）';
      setStatus('请求失败', 'error');
      $('fmt').innerHTML = '<div class="err-box"><strong>请求失败</strong><p>' + esc(msg) + '</p></div>';
      $('raw').textContent = '';
      switchView('fmt');
      toast('');
    } finally {
      $('run').disabled = false;
    }
  }

  /* ---------- 复制 ---------- */

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('复制失败'));
    });
  }

  function copyPrompt() {
    var chat = $('chat').value.trim();
    var text = activePrompt + '\n\n【聊天记录】\n' + (chat || '（此处粘贴聊天记录）');
    copyText(text).then(function () {
      toast('已复制：系统提示词 + 当前聊天记录，可直接粘到模型对话框。');
    }).catch(function () {
      toast('复制失败，可以在左侧展开「查看 / 复制系统提示词」手动选中。');
    });
  }

  /* ---------- 主流程 ---------- */

  function run() {
    var mode = getMode();
    var chat = $('chat').value.trim();
    if (!chat) { toast('请先粘贴聊天记录，或选一个内置示例。'); return; }

    if (mode === 'demo') {
      var demo = window.DEMOS[$('sample').value];
      if (chat !== demo.input.trim()) {
        setStatus('输入已改动', 'error');
        $('fmt').innerHTML =
          '<div class="err-box"><strong>内置演示不翻译你粘贴的内容</strong>' +
          '<p>左侧输入与「' + esc(demo.label) + '」不一致。重新选一个示例可看固定结果；想翻译自己这段，请切到「接入模型」，或点「复制完整提示词」去模型对话框里跑。</p></div>';
        $('raw').textContent = '';
        switchView('fmt');
        toast('');
        return;
      }
      showOutput(demo.output, '内置演示', false);
      toast('展示的是仓库里的固定示例结果，未把输入送去翻译。');
      return;
    }

    var hit = precheck(chat);
    if (hit) {
      showOutput(STOP_SENTENCE + '\n原因：本地预检命中「' + hit + '」，按规则立即停止。', '本地预检停机', false);
      toast('词表只是兜底，未命中不代表安全。');
      return;
    }
    if (linesOf(chat).length > 6) {
      $('raw').textContent = ASK_SENTENCE;
      switchView('fmt');
      renderAsk(true);
      setStatus('超过 6 条，等待选择翻译范围', 'busy');
      toast('');
      return;
    }
    startApi(null);
  }

  /* ---------- 事件绑定 ---------- */

  Array.prototype.forEach.call(document.querySelectorAll('input[name="mode"]'), function (r) {
    r.addEventListener('change', function () {
      $('api-config').hidden = getMode() !== 'api';
      toast('');
      setStatus('就绪', '');
    });
  });

  $('sample').addEventListener('change', function () {
    var demo = window.DEMOS[$('sample').value];
    $('chat').value = demo.input;
    refreshCount();
    if (getMode() === 'demo') {
      showOutput(demo.output, '内置演示', false);
      toast('已载入内置示例，可点「生成翻译」重新渲染。');
    } else {
      toast('已载入示例聊天记录，点「生成翻译」会请求你配置的模型。');
    }
  });

  $('chat').addEventListener('input', function () { refreshCount(); toast(''); });
  $('run').addEventListener('click', run);
  $('copy').addEventListener('click', copyPrompt);
  $('tab-fmt').addEventListener('click', function () { switchView('fmt'); });
  $('tab-raw').addEventListener('click', function () { switchView('raw'); });

  /* ---------- 初始化 ---------- */
  $('chat').value = window.DEMOS.basic.input;
  refreshCount();
  showOutput(window.DEMOS.basic.output, '内置演示', false);
  loadPrompt();
})();
