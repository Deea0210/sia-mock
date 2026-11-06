/* SIA Mock Exam - app.js
   Plain ES5-ish JavaScript on purpose. No optional chaining, no ?? , no
   structuredClone, no modules. The Hours app died on a phone because its very
   first call was an API the browser did not have, so nothing here is newer
   than about 2018. */

(function () {
  'use strict';

  var LENGTH = 40;          // questions per attempt
  var PASS = 70;            // indicative pass mark, percent
  var STORE = 'sia.v1';     // localStorage key

  // -------------------------------------------------------------- storage
  // Private mode and blocked site data make these throw, so every call is
  // guarded and the app has to work when they return nothing.
  function save(state) {
    try {
      window.localStorage.setItem(STORE, JSON.stringify(state));
    } catch (e) { /* nothing we can do; the attempt still works in memory */ }
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(STORE);
      if (!raw) { return null; }
      var s = JSON.parse(raw);
      if (!s || s.v !== 1 || !s.picks || !s.picks.length) { return null; }
      return s;
    } catch (e) { return null; }
  }

  function clear() {
    try { window.localStorage.removeItem(STORE); } catch (e) {}
  }

  // ----------------------------------------------------------- questions
  function moduleById(id) {
    var mods = QUESTIONS.modules;
    for (var i = 0; i < mods.length; i++) {
      if (mods[i].id === id) { return mods[i]; }
    }
    return null;
  }

  function questionAt(state, i) {
    var mod = moduleById(state.moduleId);
    return mod.questions[state.picks[i] - 1];
  }

  function shuffled(n) {
    var a = [];
    var i, j, t;
    for (i = 1; i <= n; i++) { a.push(i); }
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------------------------------------------------------------- state
  var state = null;

  function newAttempt(moduleId) {
    var mod = moduleById(moduleId);
    var pool = shuffled(mod.questions.length);
    var take = Math.min(LENGTH, pool.length);
    var picks = pool.slice(0, take);
    var answers = [];
    for (var i = 0; i < take; i++) { answers.push(null); }
    state = {
      v: 1,
      moduleId: moduleId,
      picks: picks,
      answers: answers,
      idx: 0,
      done: false
    };
    save(state);
  }

  function tally() {
    var right = 0, wrong = 0, i, q;
    for (i = 0; i < state.picks.length; i++) {
      q = questionAt(state, i);
      if (state.answers[i] === q.a) { right++; } else { wrong++; }
    }
    return { right: right, wrong: wrong, total: state.picks.length };
  }

  function firstUnanswered() {
    for (var i = 0; i < state.answers.length; i++) {
      if (state.answers[i] === null) { return i; }
    }
    return -1;
  }

  // ------------------------------------------------------------------ dom
  function el(id) { return document.getElementById(id); }

  var views = {
    start:  el('view-start'),
    exam:   el('view-exam'),
    result: el('view-result')
  };

  function show(name) {
    for (var k in views) {
      if (views.hasOwnProperty(k)) { views[k].hidden = (k !== name); }
    }
    el('barnote').textContent =
      name === 'exam' ? 'Untimed — take as long as you need' :
      name === 'result' ? 'Attempt finished' : 'Untimed practice';
    window.scrollTo(0, 0);
  }

  // ----------------------------------------------------------- start view
  function renderStart() {
    var list = el('module-list');
    list.innerHTML = '';

    var mods = QUESTIONS.modules;
    for (var i = 0; i < mods.length; i++) {
      list.appendChild(moduleButton(mods[i]));
    }

    var saved = load();
    var box = el('resume');
    if (saved && !saved.done) {
      var mod = moduleById(saved.moduleId);
      var answered = 0;
      for (var j = 0; j < saved.answers.length; j++) {
        if (saved.answers[j] !== null) { answered++; }
      }
      box.hidden = false;
      el('resume-note').textContent =
        mod.name + ' — ' + answered + ' of ' + saved.picks.length +
        ' answered.';
    } else {
      box.hidden = true;
    }

    show('start');
  }

  function moduleButton(mod) {
    var take = Math.min(LENGTH, mod.questions.length);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';

    var name = document.createElement('span');
    name.className = 'choice-name';
    name.textContent = mod.name;

    var sub = document.createElement('span');
    sub.className = 'choice-sub';
    sub.textContent = mod.subtitle;

    var meta = document.createElement('span');
    meta.className = 'choice-meta';
    meta.textContent = 'Start — ' + take + ' questions from a bank of ' +
      mod.questions.length;

    b.appendChild(name);
    b.appendChild(sub);
    b.appendChild(meta);

    b.onclick = function () {
      newAttempt(mod.id);
      renderExam();
    };
    return b;
  }

  // ------------------------------------------------------------ exam view
  function renderExam() {
    var total = state.picks.length;
    var i = state.idx;
    var q = questionAt(state, i);

    el('pbar').style.width = Math.round(((i + 1) / total) * 100) + '%';
    el('pcount').textContent = 'Question ' + (i + 1) + ' of ' + total;

    el('qmeta').textContent = moduleById(state.moduleId).name +
      ' · question ' + q.n + ' in the bank';
    el('qtext').textContent = q.q;

    var box = el('qopts');
    box.innerHTML = '';
    for (var k = 0; k < q.opts.length; k++) {
      box.appendChild(optionButton(q, k, i));
    }

    el('btn-prev').disabled = (i === 0);
    el('btn-next').textContent = (i === total - 1) ? 'Finish' : 'Next';
    el('unanswered').textContent = '';

    show('exam');
  }

  function optionButton(q, k, qIndex) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt' + (state.answers[qIndex] === k ? ' on' : '');
    // The letter sits in its own span, so spell the choice out for screen readers.
    b.setAttribute('aria-label', 'ABCD'.charAt(k) + '. ' + q.opts[k]);
    b.setAttribute('aria-pressed', state.answers[qIndex] === k ? 'true' : 'false');

    var letter = document.createElement('span');
    letter.className = 'letter';
    letter.textContent = 'ABCD'.charAt(k);

    var text = document.createElement('span');
    text.textContent = q.opts[k];

    b.appendChild(letter);
    b.appendChild(text);

    b.onclick = function () {
      state.answers[qIndex] = k;
      save(state);
      // repaint the selection without rebuilding the whole question
      var all = el('qopts').childNodes;
      for (var n = 0; n < all.length; n++) {
        all[n].className = 'opt' + (n === k ? ' on' : '');
        all[n].setAttribute('aria-pressed', n === k ? 'true' : 'false');
      }
      el('unanswered').textContent = '';
    };
    return b;
  }

  function goPrev() {
    if (state.idx > 0) {
      state.idx--;
      save(state);
      renderExam();
    }
  }

  function goNext() {
    var total = state.picks.length;
    if (state.idx < total - 1) {
      state.idx++;
      save(state);
      renderExam();
      return;
    }
    // last question: only finish once every answer is in
    var gap = firstUnanswered();
    if (gap !== -1) {
      state.idx = gap;
      save(state);
      renderExam();
      el('unanswered').textContent =
        'Question ' + (gap + 1) + ' still needs an answer before you can finish.';
      return;
    }
    state.done = true;
    save(state);
    renderResult();
  }

  // ---------------------------------------------------------- result view
  function renderResult() {
    var t = tally();
    var pct = Math.round((t.right / t.total) * 100);
    var passed = pct >= PASS;

    var card = el('scorecard');
    card.className = 'card score ' + (passed ? 'pass' : 'fail');

    el('score-head').textContent = moduleById(state.moduleId).name +
      ' · ' + t.total + ' questions';
    el('score-pct').textContent = pct + '%';
    el('score-right').textContent = t.right;
    el('score-wrong').textContent = t.wrong;
    el('score-note').textContent = passed
      ? 'Above the indicative ' + PASS + '% pass mark. That mark is a guide only, ' +
        'not the awarding body’s.'
      : 'Below the indicative ' + PASS + '% pass mark — you needed ' +
        Math.ceil(t.total * PASS / 100) + ' correct. Read the notes below and go again.';

    renderReview();
    show('result');
  }

  function renderReview() {
    var box = el('review');
    box.innerHTML = '';
    for (var i = 0; i < state.picks.length; i++) {
      box.appendChild(reviewItem(i));
    }
  }

  function reviewItem(i) {
    var q = questionAt(state, i);
    var given = state.answers[i];
    var ok = (given === q.a);

    var d = document.createElement('details');
    d.className = 'rev ' + (ok ? 'right' : 'wrong');

    var s = document.createElement('summary');
    var tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = ok ? 'Correct' : 'Wrong';
    s.appendChild(tag);
    s.appendChild(document.createTextNode(' ' + (i + 1) + '. ' + q.q));
    d.appendChild(s);

    var body = document.createElement('div');
    body.className = 'rev-body';

    body.appendChild(reviewLine('Your answer', given, q,
      'rev-line yours' + (ok ? '' : ' wrong-ans')));
    if (!ok) {
      body.appendChild(reviewLine('Correct answer', q.a, q, 'rev-line correct-ans'));
    }

    if (q.note) {
      var note = document.createElement('p');
      note.className = 'rev-note';
      var head = document.createElement('b');
      head.textContent = (typeof q.keyed === 'number')
        ? 'Corrected from the handout'
        : 'Worth knowing';
      note.appendChild(head);
      note.appendChild(document.createTextNode(q.note));
      body.appendChild(note);
    }

    d.appendChild(body);
    return d;
  }

  function reviewLine(label, choice, q, cls) {
    var p = document.createElement('p');
    p.className = cls;
    var lab = document.createElement('span');
    lab.className = 'lab';
    lab.textContent = label + ': ';
    p.appendChild(lab);
    p.appendChild(document.createTextNode(
      choice === null || choice === undefined
        ? 'not answered'
        : 'ABCD'.charAt(choice) + '. ' + q.opts[choice]
    ));
    return p;
  }

  // ----------------------------------------------------------- wiring up
  el('btn-prev').onclick = goPrev;
  el('btn-next').onclick = goNext;

  el('btn-quit').onclick = function () {
    if (window.confirm('Abandon this attempt? Your answers so far are lost.')) {
      clear();
      state = null;
      renderStart();
    }
  };

  el('btn-again').onclick = function () {
    newAttempt(state.moduleId);
    renderExam();
  };

  el('btn-home').onclick = function () {
    clear();
    state = null;
    renderStart();
  };

  el('btn-resume').onclick = function () {
    var saved = load();
    if (!saved) { renderStart(); return; }
    state = saved;
    if (state.idx >= state.picks.length) { state.idx = state.picks.length - 1; }
    renderExam();
  };

  el('btn-discard').onclick = function () {
    clear();
    el('resume').hidden = true;
  };

  // ---------------------------------------------------------------- boot
  renderStart();

  // Network-first worker, registered last so a worker problem can never stop
  // the app from running.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      try {
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      } catch (e) { /* offline use is a bonus, not a requirement */ }
    });
  }
})();
