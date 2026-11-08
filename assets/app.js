/* 四级听力真题 · 近三年汇总 —— 前端逻辑 */
(function () {
  'use strict';

  var DATA = window.CET4_DATA;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  if (!DATA || !Array.isArray(DATA.exams) || !DATA.exams.length) {
    document.body.innerHTML =
      '<div style="max-width:560px;margin:80px auto;padding:24px;font:15px/1.7 sans-serif;color:#333">' +
      '<h2 style="margin:0 0 10px">数据没有加载出来</h2>' +
      '<p>请确认 <code>data.js</code> 和网页在同一个目录下，并且是通过本地服务器或直接双击打开 index.html。</p></div>';
    return;
  }

  /* ===================== 工具 ===================== */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    sec = Math.floor(sec);
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  function fmtDur(sec) {
    if (!sec || !isFinite(sec) || sec <= 0) return '时长未知';
    var m = Math.round(sec / 60);
    return m + ' 分钟';
  }

  /* ===================== 本地存储 ===================== */
  var K_ANS = 'cet4.answers.v1';
  var K_SPEED = 'cet4.speed.v1';

  function loadAnswers() {
    try {
      var raw = localStorage.getItem(K_ANS);
      var obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' ? obj : {};
    } catch (e) { return {}; }
  }

  function saveAnswers() {
    try { localStorage.setItem(K_ANS, JSON.stringify(store.answers)); } catch (e) { /* 忽略配额错误 */ }
  }

  var store = {
    answers: loadAnswers(),
    reveal: {},          // setId -> true 表示已显示答案（仅本次会话）
    speed: (function () {
      var v = parseFloat(localStorage.getItem(K_SPEED));
      return [0.75, 1, 1.25, 1.5, 2].indexOf(v) >= 0 ? v : 1;
    })(),
    openCard: null
  };

  function getAnswer(setId, qno) {
    var m = store.answers[setId];
    return m ? m[qno] : undefined;
  }

  function setAnswer(setId, qno, letter) {
    var m = store.answers[setId] || (store.answers[setId] = {});
    if (letter) m[qno] = letter; else delete m[qno];
    if (!Object.keys(m).length) delete store.answers[setId];
    saveAnswers();
  }

  /* ===================== 数据索引 ===================== */
  var allSets = [];
  DATA.exams.forEach(function (exam) {
    exam.sets.forEach(function (set) {
      set._exam = exam;
      set._total = set.sections.reduce(function (n, s) { return n + s.questions.length; }, 0);
      set._answered = 0;
      allSets.push(set);
    });
  });

  function findSet(setId) {
    for (var i = 0; i < allSets.length; i++) if (allSets[i].id === setId) return allSets[i];
    return null;
  }

  /* ===================== 顶栏 / 概览 ===================== */
  var totalQuestions = allSets.reduce(function (n, s) { return n + s._total; }, 0);
  var years = DATA.exams.map(function (e) { return e.year; });
  var yearMin = Math.min.apply(null, years), yearMax = Math.max.apply(null, years);

  $('#brandSub').textContent = yearMin + '–' + yearMax + ' 年 · ' + allSets.length + ' 套真题 · 点开即可听题做题';
  $('#introStats').innerHTML =
    '<span class="stat-pill"><b>' + allSets.length + '</b> 套真题</span>' +
    '<span class="stat-pill"><b>' + totalQuestions + '</b> 道听力题</span>' +
    '<span class="stat-pill"><b>' + DATA.exams.length + '</b> 场考试</span>';
  $('#sourceLine').textContent = '数据整理自 ' + (DATA.source || '公开真题页面') + '；音频版权归原发布方所有。';

  /* ===================== 年份筛选 ===================== */
  var filterBar = $('#yearFilters');
  var filterValue = 'all';

  function renderFilters() {
    var html = '<button class="chip is-active" data-filter="all">全部<small>' + allSets.length + '</small></button>';
    DATA.exams.forEach(function (exam) {
      html += '<button class="chip" data-filter="' + esc(exam.id) + '">' + esc(exam.title) +
        '<small>' + exam.sets.length + '套</small></button>';
    });
    filterBar.innerHTML = html;
  }

  filterBar.addEventListener('click', function (ev) {
    var btn = ev.target.closest('.chip');
    if (!btn) return;
    filterValue = btn.getAttribute('data-filter');
    $$('.chip', filterBar).forEach(function (c) { c.classList.toggle('is-active', c === btn); });
    applyFilter();
  });

  function applyFilter() {
    var shown = 0;
    $$('.exam-group').forEach(function (g) {
      var ok = filterValue === 'all' || g.getAttribute('data-exam') === filterValue;
      g.hidden = !ok;
      if (ok) shown++;
    });
    $('#emptyHint').hidden = shown > 0;
  }

  /* ===================== 听力练习视图 ===================== */
  var examList = $('#examList');

  function setCardHTML(exam, set) {
    return '' +
      '<article class="set-card" data-set="' + esc(set.id) + '">' +
        '<div class="set-head">' +
          '<button class="set-toggle" type="button" aria-expanded="false" aria-controls="body-' + esc(set.id) + '">' +
            '<span class="set-index">' + esc(String(set.setNo)) + '</span>' +
            '<span class="set-main">' +
              '<span class="set-title">' + esc(exam.title) + ' · ' + esc(set.name) + '</span>' +
              '<span class="set-meta">' +
                '<span>' + set._total + ' 题</span>' +
                '<span class="dot">' + set.sections.length + ' 个部分</span>' +
                '<span class="dot">' + set.passages.length + ' 篇材料</span>' +
                '<span class="dot">' + esc(fmtDur(set.duration)) + '</span>' +
              '</span>' +
            '</span>' +
            '<span class="chev">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
            '</span>' +
          '</button>' +
          '<div class="set-tools">' +
            '<button class="play-btn" type="button" data-act="play">' +
              '<svg class="pb-ic" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.87l10-6.5a1 1 0 0 0 0-1.74l-10-6.5A1 1 0 0 0 8 5.5z"/></svg>' +
              '<span class="pb-label">播放</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function renderPractice() {
    var html = '';
    DATA.exams.forEach(function (exam) {
      html += '<section class="exam-group" data-exam="' + esc(exam.id) + '">' +
        '<div class="exam-head"><h3>' + esc(exam.title) + '</h3>' +
          '<span class="exam-count">' + exam.sets.length + ' 套</span>' +
          (exam === DATA.exams[0] ? '<span class="exam-new">最新</span>' : '') +
        '</div>' +
        '<div class="set-grid">';
      exam.sets.forEach(function (set) { html += setCardHTML(exam, set); });
      html += '</div></section>';
    });
    examList.innerHTML = html;
  }

  function passageLabel(p) {
    return 'Sec ' + p.section + ' · 第' + p.index + '篇 · ' + p.qFrom + '–' + p.qTo + ' 题';
  }

  function bodyHTML(set) {
    var chips = set.passages.map(function (p, i) {
      return '<button class="p-chip" type="button" data-p="' + i + '" title="从这篇开头播放">' +
        esc(passageLabel(p)) + '</button>';
    }).join('');

    var sections = set.sections.map(function (sec) {
      var qs = sec.questions.map(function (q) {
        var opts = ['A', 'B', 'C', 'D'].map(function (L) {
          return '<button class="opt" type="button" data-letter="' + L + '" aria-pressed="false">' +
            '<span class="letter">' + L + '</span>' +
            '<span class="t">' + esc(q.options[L] || '') + '</span>' +
            '<span class="tick" hidden></span>' +
            '</button>';
        }).join('');
        return '<div class="q" data-q="' + q.no + '">' +
          '<div class="q-top">' +
            '<button class="q-no" type="button" title="从本题所在篇开头播放">' + q.no + '</button>' +
            '<p class="q-stem">' + esc(q.stem) + '</p>' +
          '</div>' +
          '<div class="opts">' + opts + '</div>' +
        '</div>';
      }).join('');

      return '<div class="section-block">' +
        '<div class="section-head"><h4>' + esc(sec.title) + '</h4>' +
          '<span class="qs">' + esc(sec.subtitle) + '</span><span class="line"></span></div>' +
        '<div class="q-list">' + qs + '</div>' +
      '</div>';
    }).join('');

    return '' +
      '<div class="set-body" id="body-' + esc(set.id) + '">' +
        '<div class="passage-bar">' + chips + '</div>' +
        '<div class="body-tools">' +
          '<button class="tool-btn" type="button" data-act="reveal">显示答案</button>' +
          '<button class="tool-btn" type="button" data-act="reset">清除本套作答</button>' +
          '<span class="body-stats"></span>' +
        '</div>' +
        sections +
      '</div>';
  }

  /* 单题着色：作答 / 对错 / 标注答案 */
  function paintQuestion(card, set, qEl) {
    var no = parseInt(qEl.getAttribute('data-q'), 10);
    var picked = getAnswer(set.id, no);
    var revealed = !!store.reveal[set.id];
    var q = null;
    for (var i = 0; i < set.sections.length && !q; i++) {
      for (var j = 0; j < set.sections[i].questions.length; j++) {
        if (set.sections[i].questions[j].no === no) { q = set.sections[i].questions[j]; break; }
      }
    }
    if (!q) return;

    var correct = picked && picked === q.answer;
    qEl.classList.toggle('is-done', !!picked);
    qEl.classList.toggle('is-correct', !!correct);
    qEl.classList.toggle('is-wrong', !!picked && !correct);

    $$('.opt', qEl).forEach(function (btn) {
      var L = btn.getAttribute('data-letter');
      var tick = $('.tick', btn);
      btn.classList.toggle('is-picked', picked === L);
      btn.setAttribute('aria-pressed', picked === L ? 'true' : 'false');

      var isCorrectOpt = revealed && L === q.answer;
      var isWrongPick = revealed && picked === L && L !== q.answer;
      btn.classList.toggle('is-correct', isCorrectOpt);
      btn.classList.toggle('is-wrong', isWrongPick);

      if (tick) {
        tick.hidden = !revealed;
        tick.textContent = isCorrectOpt ? '正确答案' : (isWrongPick ? '你的选择' : '');
      }
    });
  }

  function paintStats(card, set) {
    var box = card.querySelector('.body-stats');
    if (!box) return;
    var map = store.answers[set.id] || {};
    var answered = Object.keys(map).length;
    var stat = '<b>' + answered + '</b> / ' + set._total + ' 已答';
    if (store.reveal[set.id]) {
      var correct = 0;
      set.sections.forEach(function (sec) {
        sec.questions.forEach(function (q) { if (map[q.no] === q.answer) correct++; });
      });
      stat += ' · 正确 <span class="ok"><b>' + correct + '</b></span> · 错误 <span class="bad">' +
        (answered - correct) + '</span>';
    }
    box.innerHTML = stat;

    var revealBtn = card.querySelector('[data-act="reveal"]');
    if (revealBtn) {
      var on = !!store.reveal[set.id];
      revealBtn.classList.toggle('is-on', on);
      revealBtn.textContent = on ? '隐藏答案' : '显示答案';
    }
  }

  function paintSet(card, set) {
    $$('.q', card).forEach(function (qEl) { paintQuestion(card, set, qEl); });
    paintStats(card, set);
  }

  function toggleCard(card) {
    var setId = card.getAttribute('data-set');
    var isOpen = card.classList.contains('is-open');

    // 同时只展开一套，页面更清爽
    $$('.set-card.is-open').forEach(function (other) {
      if (other !== card) {
        other.classList.remove('is-open');
        var t = other.querySelector('.set-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      }
    });

    if (isOpen) {
      card.classList.remove('is-open');
      card.querySelector('.set-toggle').setAttribute('aria-expanded', 'false');
      store.openCard = null;
      return;
    }

    var set = findSet(setId);
    if (!card.querySelector('.set-body')) card.insertAdjacentHTML('beforeend', bodyHTML(set));
    card.classList.add('is-open');
    card.querySelector('.set-toggle').setAttribute('aria-expanded', 'true');
    store.openCard = setId;
    paintSet(card, set);
  }

  // 点击整套卡片头部 / 播放 / 选项 / 篇目跳转 / 工具按钮
  examList.addEventListener('click', function (ev) {
    var card = ev.target.closest('.set-card');
    if (!card) return;
    var set = findSet(card.getAttribute('data-set'));

    var playBtn = ev.target.closest('.play-btn');
    if (playBtn) {
      if (!card.classList.contains('is-open')) toggleCard(card);
      playSet(set);
      return;
    }

    var toggle = ev.target.closest('.set-toggle');
    if (toggle) { toggleCard(card); return; }

    var opt = ev.target.closest('.opt');
    if (opt) {
      var q = opt.closest('.q');
      var no = parseInt(q.getAttribute('data-q'), 10);
      var letter = opt.getAttribute('data-letter');
      if (getAnswer(set.id, no) === letter) setAnswer(set.id, no, null); // 再点一次取消
      else setAnswer(set.id, no, letter);
      paintQuestion(card, set, q);
      paintStats(card, set);
      refreshAnswerView(set.id);
      return;
    }

    var chip = ev.target.closest('.p-chip');
    if (chip) {
      var p = set.passages[parseInt(chip.getAttribute('data-p'), 10)];
      if (p) { jumpToSetPassage(set, p.start); }
      return;
    }

    var qno = ev.target.closest('.q-no');
    if (qno) {
      var num = parseInt(qno.closest('.q').getAttribute('data-q'), 10);
      var psg = set.passages.filter(function (p) { return num >= p.qFrom && num <= p.qTo; })[0];
      if (psg) { jumpToSetPassage(set, psg.start); }
      return;
    }

    var tool = ev.target.closest('.tool-btn');
    if (tool) {
      var act = tool.getAttribute('data-act');
      if (act === 'reveal') {
        store.reveal[set.id] = !store.reveal[set.id];
        paintSet(card, set);
      } else if (act === 'reset') {
        delete store.answers[set.id];
        saveAnswers();
        paintSet(card, set);
        refreshAnswerView(set.id);
      }
      return;
    }
  });

  /* 鼠标悬停时高亮当前篇目 */
  function markPassage(setId, t) {
    var card = $('.set-card[data-set="' + setId + '"]');
    if (!card) return;
    var set = findSet(setId);
    var idx = -1;
    set.passages.forEach(function (p, i) {
      if (t >= p.start - 0.3 && t <= p.end + 0.3) idx = i;
    });
    $$('.p-chip', card).forEach(function (chip, i) { chip.classList.toggle('is-current', i === idx); });
  }

  /* ===================== 答案速查视图 ===================== */
  var answerList = $('#answerList');

  function answersBodyHTML(set) {
    var cells = '';
    var map = store.answers[set.id] || {};
    set.sections.forEach(function (sec) {
      sec.questions.forEach(function (q) {
        var picked = map[q.no];
        var cls = '';
        if (picked) cls = picked === q.answer ? ' ok' : ' bad';
        cells += '<div class="ans-cell' + cls + '">' +
          '<span class="n">' + q.no + '</span>' +
          '<span class="a">' + esc(q.answer) + '</span>' +
          '<span class="mine">' + (picked ? '你选 ' + esc(picked) : '') + '</span>' +
        '</div>';
      });
    });
    return '<div class="answer-body" id="ansbody-' + esc(set.id) + '">' +
      '<div class="ans-grid">' + cells + '</div>' +
      '<div class="answer-foot"></div>' +
    '</div>';
  }

  function paintAnswerFoot(item, set) {
    var foot = item.querySelector('.answer-foot');
    if (!foot) return;
    var map = store.answers[set.id] || {};
    var answered = Object.keys(map).length;
    var correct = 0;
    set.sections.forEach(function (sec) {
      sec.questions.forEach(function (q) { if (map[q.no] === q.answer) correct++; });
    });
    var meta = item.querySelector('.answer-meta');
    if (!answered) {
      foot.innerHTML = '<span>还没有作答记录，先去做几题吧。</span>';
      if (meta) meta.textContent = '25 题';
      return;
    }
    var rate = Math.round(correct / answered * 100);
    foot.innerHTML = '<span>已答 <b>' + answered + '</b> 题</span>' +
      '<span>答对 <b style="color:#12a150">' + correct + '</b> 题</span>' +
      '<span>正确率 <b>' + rate + '%</b></span>';
    if (meta) meta.textContent = '25 题 · 已答 ' + answered;
  }

  function renderAnswers() {
    var html = '';
    DATA.exams.forEach(function (exam) {
      exam.sets.forEach(function (set) {
        html += '<article class="answer-item" data-set="' + esc(set.id) + '">' +
          '<button class="answer-head" type="button" aria-expanded="false">' +
            '<span class="answer-title">' + esc(set.name) + '</span>' +
            '<span class="answer-year">' + esc(exam.title) + '</span>' +
            '<span class="answer-meta">25 题</span>' +
            '<span class="chev">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
            '</span>' +
          '</button>' +
        '</article>';
      });
    });
    answerList.innerHTML = html;
  }

  answerList.addEventListener('click', function (ev) {
    var head = ev.target.closest('.answer-head');
    if (!head) return;
    var item = head.closest('.answer-item');
    var setId = item.getAttribute('data-set');
    var set = findSet(setId);
    var open = item.classList.contains('is-open');

    if (!item.querySelector('.answer-body')) item.insertAdjacentHTML('beforeend', answersBodyHTML(set));

    if (open) {
      item.classList.remove('is-open');
      head.setAttribute('aria-expanded', 'false');
      return;
    }
    item.classList.add('is-open');
    head.setAttribute('aria-expanded', 'true');
    paintAnswerFoot(item, set);
  });

  // 练习页改了作答，答案页同步
  function refreshAnswerView(setId) {
    var item = answerList.querySelector('.answer-item[data-set="' + setId + '"]');
    if (!item || !item.querySelector('.answer-body')) return;
    var set = findSet(setId);
    item.querySelector('.answer-body').outerHTML = answersBodyHTML(set);
    paintAnswerFoot(item, set);
  }

  $('#clearAllAnswers').addEventListener('click', function () {
    if (!Object.keys(store.answers).length) { toast('还没有任何作答记录'); return; }
    if (!window.confirm('确定清除全部作答记录吗？此操作不可撤销。')) return;
    store.answers = {};
    saveAnswers();
    // 重绘展开中的卡片与答案页
    $$('.set-card.is-open').forEach(function (card) {
      var set = findSet(card.getAttribute('data-set'));
      paintSet(card, set);
    });
    $$('.answer-item').forEach(function (item) {
      var set = findSet(item.getAttribute('data-set'));
      if (item.querySelector('.answer-body')) {
        item.querySelector('.answer-body').outerHTML = answersBodyHTML(set);
        paintAnswerFoot(item, set);
      }
    });
    toast('已清除全部作答记录');
  });

  /* ===================== 视图切换 ===================== */
  var tabPractice = $('#tabPractice'), tabAnswers = $('#tabAnswers');
  var viewPractice = $('#viewPractice'), viewAnswers = $('#viewAnswers');

  function switchView(which) {
    var practice = which !== 'answers';
    viewPractice.hidden = !practice;
    viewAnswers.hidden = practice;
    tabPractice.classList.toggle('is-active', practice);
    tabAnswers.classList.toggle('is-active', !practice);
    tabPractice.setAttribute('aria-selected', practice ? 'true' : 'false');
    tabAnswers.setAttribute('aria-selected', practice ? 'false' : 'true');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  tabPractice.addEventListener('click', function () { switchView('practice'); });
  tabAnswers.addEventListener('click', function () { switchView('answers'); });

  /* ===================== 播放器 ===================== */
  var playerEl = $('#player');
  var audio = $('#audio');
  var pPlay = $('#pPlay');
  var pTitle = $('#pTitle');
  var pSub = $('#pSub');
  var pCur = $('#pCur');
  var pDur = $('#pDur');
  var pFill = $('#pFill');
  var pKnob = $('#pKnob');
  var pBar = $('#pBar');
  var pSpeed = $('#pSpeed');
  var toastEl = $('#toast');
  var toastTimer = null;

  var current = { setId: null, set: null, exam: null, seeking: false };
  var pendingSeek = null;

  var ICON_PLAY = '<svg class="ic-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.87l10-6.5a1 1 0 0 0 0-1.74l-10-6.5A1 1 0 0 0 8 5.5z"/></svg>' +
    '<svg class="ic-pause" viewBox="0 0 24 24" fill="currentColor" hidden><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>';
  var ICON_PAUSE = '<svg class="ic-play" viewBox="0 0 24 24" fill="currentColor" hidden><path d="M8 5.5v13a1 1 0 0 0 1.5.87l10-6.5a1 1 0 0 0 0-1.74l-10-6.5A1 1 0 0 0 8 5.5z"/></svg>' +
    '<svg class="ic-pause" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>';

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-show'); }, 2600);
  }

  function ensurePlayer() {
    if (playerEl.hidden) {
      playerEl.hidden = false;
      document.body.classList.add('player-open');
    }
  }

  audio.volume = 1;
  audio.playbackRate = store.speed;
  pSpeed.value = String(store.speed);

  function setPlayIcon() {
    var playing = !audio.paused && current.setId;
    pPlay.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    pPlay.setAttribute('aria-label', playing ? '暂停' : '播放');
    $$('.play-btn').forEach(function (btn) {
      var card = btn.closest('.set-card');
      var on = card && card.getAttribute('data-set') === current.setId && !!current.setId;
      btn.classList.toggle('is-playing', on && !audio.paused);
      var ic = btn.querySelector('.pb-ic');
      if (ic) {
        ic.innerHTML = on && !audio.paused
          ? '<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/>'
          : '<path d="M8 5.5v13a1 1 0 0 0 1.5.87l10-6.5a1 1 0 0 0 0-1.74l-10-6.5A1 1 0 0 0 8 5.5z"/>';
      }
      var label = btn.querySelector('.pb-label');
      if (label) label.textContent = on && !audio.paused ? '暂停' : (on ? '继续' : '播放');
    });
  }

  function setLoading(on) {
    pPlay.classList.toggle('is-loading', on);
  }

  function displayTitle(set) {
    pTitle.textContent = set._exam.title + ' · ' + set.name;
    pSub.textContent = set._total + ' 题 · ' + set.passages.length + ' 篇材料';
  }

  function loadSet(set, autoplay) {
    var isSame = current.setId === set.id;
    current.setId = set.id;
    current.set = set;
    current.exam = set._exam;
    ensurePlayer();
    displayTitle(set);

    if (!isSame) {
      audio.src = set.audio;
      audio.load();
      pFill.style.width = '0%';
      pKnob.style.left = '0%';
      pCur.textContent = '0:00';
      pDur.textContent = fmtTime(set.duration);
      pBar.setAttribute('aria-valuenow', '0');
      if (set.duration) pSub.textContent += ' · ' + fmtDur(set.duration);
    }

    if (autoplay) {
      setLoading(true);
      var p = audio.play();
      if (p && p.catch) p.catch(function () { setLoading(false); toast('播放失败，请再点一次播放按钮'); });
    }
    setPlayIcon();
  }

  function playSet(set) {
    if (current.setId === set.id) {
      if (audio.paused) {
        if (!audio.src) { loadSet(set, true); return; }
        ensurePlayer();
        setLoading(true);
        var pr = audio.play();
        if (pr && pr.catch) pr.catch(function () { setLoading(false); toast('播放失败，请再点一次播放按钮'); });
      } else {
        audio.pause();
      }
      return;
    }
    loadSet(set, true);
  }

  function seekTo(sec) {
    if (!current.setId) return;
    if (!audio.src) { toast('先点某一套的「播放」加载音频'); return; }
    ensurePlayer();
    var target = Math.max(0, Math.min(sec, (audio.duration || current.set.duration || sec) - 0.3));
    try { audio.currentTime = target; } catch (e) { /* 元数据未就绪时忽略 */ }
    if (audio.paused) {
      var pr = audio.play();
      if (pr && pr.catch) pr.catch(function () {});
    }
  }

  /* 跳到某一套的某个时间点：如果当前播放的是另一套，先换源再跳 */
  function jumpToSetPassage(set, start) {
    ensurePlayer();
    if (current.setId !== set.id) {
      loadSet(set, false);
      pendingSeek = start;
      return;
    }
    seekTo(start);
    markPassage(set.id, start);
  }

  pPlay.addEventListener('click', function () {
    if (!current.setId) { toast('先在下面选一套听力'); return; }
    if (audio.paused) {
      setLoading(true);
      var pr = audio.play();
      if (pr && pr.catch) pr.catch(function () { setLoading(false); toast('播放失败，请再点一次播放按钮'); });
    } else {
      audio.pause();
    }
  });

  $('#pBack').addEventListener('click', function () { skip(-15); });
  $('#pForward').addEventListener('click', function () { skip(15); });

  function skip(delta) {
    if (!current.setId) return;
    if (!audio.src) { toast('先点某一套的「播放」加载音频'); return; }
    ensurePlayer();
    var d = audio.duration || current.set.duration || 0;
    var t = Math.max(0, Math.min((audio.currentTime || 0) + delta, Math.max(0, d - 0.3)));
    audio.currentTime = t;
  }

  $('#pClose').addEventListener('click', function () {
    audio.pause();
    playerEl.hidden = true;
    document.body.classList.remove('player-open');
    setPlayIcon();
  });

  pSpeed.addEventListener('change', function () {
    var v = parseFloat(pSpeed.value) || 1;
    store.speed = v;
    audio.playbackRate = v;
    try { localStorage.setItem(K_SPEED, String(v)); } catch (e) {}
  });

  /* --- 进度条：点击 / 拖动 --- */
  function ratioFromEvent(ev) {
    var rect = pBar.getBoundingClientRect();
    var x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  }

  function previewRatio(r) {
    pFill.style.width = (r * 100) + '%';
    pKnob.style.left = (r * 100) + '%';
    var d = audio.duration || current.set && current.set.duration || 0;
    pCur.textContent = fmtTime(r * d);
  }

  function commitRatio(r) {
    var d = audio.duration || (current.set && current.set.duration) || 0;
    if (!current.setId || !d) return;
    try { audio.currentTime = r * d; } catch (e) {}
  }

  pBar.addEventListener('pointerdown', function (ev) {
    if (!current.setId) return;
    current.seeking = true;
    pBar.classList.add('is-dragging');
    pBar.setPointerCapture(ev.pointerId);
    previewRatio(ratioFromEvent(ev));
  });

  pBar.addEventListener('pointermove', function (ev) {
    if (!current.seeking) return;
    previewRatio(ratioFromEvent(ev));
  });

  pBar.addEventListener('pointerup', function (ev) {
    if (!current.seeking) return;
    current.seeking = false;
    pBar.classList.remove('is-dragging');
    var r = ratioFromEvent(ev);
    previewRatio(r);
    commitRatio(r);
  });

  pBar.addEventListener('pointercancel', function () {
    current.seeking = false;
    pBar.classList.remove('is-dragging');
  });

  pBar.addEventListener('keydown', function (ev) {
    if (!current.setId) return;
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); skip(-5); }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); skip(5); }
  });

  /* --- 音频事件 --- */
  audio.addEventListener('loadedmetadata', function () {
    setLoading(false);
    audio.playbackRate = store.speed;
    if (isFinite(audio.duration) && audio.duration > 0) {
      pDur.textContent = fmtTime(audio.duration);
      if (current.set) {
        pSub.textContent = current.set._total + ' 题 · ' + current.set.passages.length + ' 篇材料 · ' + fmtDur(audio.duration);
      }
    }
    if (pendingSeek != null) {
      var t = pendingSeek;
      pendingSeek = null;
      try { audio.currentTime = t; } catch (e) {}
      if (current.setId) markPassage(current.setId, t);
      var pr = audio.play();
      if (pr && pr.catch) pr.catch(function () { toast('点一下播放按钮开始播放'); });
    }
  });

  audio.addEventListener('timeupdate', function () {
    if (current.seeking) return;
    var d = audio.duration || 0;
    var r = d ? audio.currentTime / d : 0;
    pFill.style.width = (r * 100) + '%';
    pKnob.style.left = (r * 100) + '%';
    pCur.textContent = fmtTime(audio.currentTime);
    pBar.setAttribute('aria-valuenow', String(Math.round(r * 100)));
    if (pBar.getAttribute('aria-valuetext') !== fmtTime(audio.currentTime)) {
      pBar.setAttribute('aria-valuetext', fmtTime(audio.currentTime));
    }
    if (current.setId && current.set) markPassage(current.setId, audio.currentTime);
  });

  audio.addEventListener('play', function () { setLoading(false); setPlayIcon(); });
  audio.addEventListener('pause', setPlayIcon);
  audio.addEventListener('ended', setPlayIcon);
  audio.addEventListener('waiting', function () { setLoading(true); });
  audio.addEventListener('playing', function () { setLoading(false); });
  audio.addEventListener('ratechange', function () { pPlay.blur(); });

  audio.addEventListener('error', function () {
    setLoading(false);
    if (!audio.src) return;
    toast('音频加载失败：可能是网络问题，或这一套的音频文件缺失。');
  });

  /* --- 键盘快捷键 --- */
  document.addEventListener('keydown', function (ev) {
    if (playerEl.hidden) return;
    var tag = (ev.target && ev.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (ev.code === 'Space') {
      ev.preventDefault();
      pPlay.click();
    } else if (ev.key === 'ArrowLeft') {
      ev.preventDefault(); skip(-5);
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault(); skip(5);
    }
  });

  /* ===================== 启动 ===================== */
  renderFilters();
  renderPractice();
  renderAnswers();
  applyFilter();
})();
