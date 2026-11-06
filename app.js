/* SIA Mock Exam - app.js
   Plain ES5-ish JavaScript on purpose. No optional chaining, no ?? , no
   structuredClone, no modules. The Hours app died on a phone because its very
   first call was an API the browser did not have, so nothing here is newer
   than about 2018. */

(function () {
  'use strict';

  var LENGTH = 40;              // questions per attempt
  var PASS = 70;                // indicative pass mark, percent
  var STORE = 'sia.v1';         // the attempt in progress
  var STATS = 'sia.stats.v1';   // what you have got right and wrong, over time
  var KEEP = 50;                // attempts remembered, newest last
  var MASTERED = 2;             // right this many times running clears a weak spot

  // -------------------------------------------------------------- storage
  // Private mode and blocked site data make these throw, so every call is
  // guarded and the app has to work when they return nothing.
  function readJSON(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeJSON(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function drop(key) {
    try { window.localStorage.removeItem(key); } catch (e) {}
  }

  function save(s) { writeJSON(STORE, s); }
  function clear() { drop(STORE); }

  function load() {
    var s = readJSON(STORE);
    if (!s) { return null; }
    // build 1 stored picks as plain numbers inside one module; carry those over
    // rather than throwing away an attempt someone is halfway through.
    if (s.v === 1 && s.picks && s.picks.length) {
      var refs = [];
      for (var i = 0; i < s.picks.length; i++) { refs.push(s.moduleId + ':' + s.picks[i]); }
      s = { v: 2, mode: 'module', moduleId: s.moduleId, refs: refs,
            answers: s.answers, idx: s.idx, done: s.done };
    }
    if (!s || s.v !== 2 || !s.refs || !s.refs.length) { return null; }
    return s;
  }

  // ---------------------------------------------------------------- stats
  // { v:1, q: { "1:37": {s:seen, w:wrong, c:right in a row} }, a: [ {m,r,t,d} ] }
  function stats() {
    var st = readJSON(STATS);
    if (!st || st.v !== 1 || !st.q) { return { v: 1, q: {}, a: [] }; }
    if (!st.a) { st.a = []; }
    return st;
  }

  function record(s) {
    var st = stats();
    var right = 0;
    for (var i = 0; i < s.refs.length; i++) {
      var ref = s.refs[i];
      var row = st.q[ref] || { s: 0, w: 0, c: 0 };
      row.s++;
      if (s.answers[i] === questionByRef(ref).a) {
        right++;
        row.c = (row.c || 0) + 1;
      } else {
        row.w++;
        row.c = 0;            // one slip and it is back on the list
      }
      st.q[ref] = row;
    }
    st.a.push({ m: s.moduleId, r: right, t: s.refs.length, d: Date.now() });
    if (st.a.length > KEEP) { st.a = st.a.slice(st.a.length - KEEP); }
    writeJSON(STATS, st);
  }

  // Questions you have got wrong and not yet proved you know, worst first.
  // Without the MASTERED check the list would only ever grow: one slip in
  // January would still be a "weak spot" in June.
  function weakRefs() {
    var st = stats();
    var out = [];
    for (var ref in st.q) {
      if (!st.q.hasOwnProperty(ref)) { continue; }
      var row = st.q[ref];
      if (row.w > 0 && (row.c || 0) < MASTERED && questionByRef(ref)) {
        out.push({ ref: ref, s: row.s, w: row.w, c: row.c || 0 });
      }
    }
    out.sort(function (a, b) {
      if (b.w !== a.w) { return b.w - a.w; }          // missed most often
      return (b.w / b.s) - (a.w / a.s);               // then missed most reliably
    });
    return out;
  }

  // ----------------------------------------------------------- questions
  function moduleById(id) {
    var mods = QUESTIONS.modules;
    for (var i = 0; i < mods.length; i++) {
      if (mods[i].id === id) { return mods[i]; }
    }
    return null;
  }

  function questionByRef(ref) {
    var bits = ref.split(':');
    var mod = moduleById(parseInt(bits[0], 10));
    if (!mod) { return null; }
    return mod.questions[parseInt(bits[1], 10) - 1] || null;
  }

  function questionAt(s, i) { return questionByRef(s.refs[i]); }

  function allRefs() {
    var out = [];
    var mods = QUESTIONS.modules;
    for (var i = 0; i < mods.length; i++) {
      for (var j = 0; j < mods[i].questions.length; j++) {
        out.push(mods[i].id + ':' + mods[i].questions[j].n);
      }
    }
    return out;
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------------------------------------------------------------- state
  var state = null;

  function begin(moduleId, mode, refs) {
    var answers = [];
    for (var i = 0; i < refs.length; i++) { answers.push(null); }
    state = { v: 2, mode: mode, moduleId: moduleId, refs: refs,
              answers: answers, idx: 0, done: false };
    save(state);
  }

  function moduleAttempt(moduleId) {
    var mod = moduleById(moduleId);
    var refs = [];
    for (var i = 0; i < mod.questions.length; i++) {
      refs.push(moduleId + ':' + mod.questions[i].n);
    }
    begin(moduleId, 'module', shuffle(refs).slice(0, Math.min(LENGTH, refs.length)));
  }

  // Weak spots first, then anything never seen, then the rest - so a short
  // weak list still gives a full-length paper instead of a five-question one.
  function weakAttempt() {
    var weak = weakRefs();
    var refs = [];
    var used = {};
    var i;
    for (i = 0; i < weak.length && refs.length < LENGTH; i++) {
      refs.push(weak[i].ref);
      used[weak[i].ref] = true;
    }
    if (refs.length < LENGTH) {
      var st = stats();
      var unseen = [];
      var seen = [];
      var every = allRefs();
      for (i = 0; i < every.length; i++) {
        if (used[every[i]]) { continue; }
        if (st.q[every[i]]) { seen.push(every[i]); } else { unseen.push(every[i]); }
      }
      var filler = shuffle(unseen).concat(shuffle(seen));
      for (i = 0; i < filler.length && refs.length < LENGTH; i++) { refs.push(filler[i]); }
    }
    begin(0, 'weak', shuffle(refs));
  }

  function attemptName(s) {
    return s.mode === 'weak' ? 'Weak spots' : moduleById(s.moduleId).name;
  }

  function tally() {
    var right = 0, wrong = 0;
    for (var i = 0; i < state.refs.length; i++) {
      if (state.answers[i] === questionAt(state, i).a) { right++; } else { wrong++; }
    }
    return { right: right, wrong: wrong, total: state.refs.length };
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
    result: el('view-result'),
    weak:   el('view-weak')
  };

  function show(name) {
    for (var k in views) {
      if (views.hasOwnProperty(k)) { views[k].hidden = (k !== name); }
    }
    el('barnote').textContent =
      name === 'exam' ? 'Untimed — take as long as you need' :
      name === 'result' ? 'Attempt finished' :
      name === 'weak' ? 'What to work on' : 'Untimed practice';
    window.scrollTo(0, 0);
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // ----------------------------------------------------------- start view
  function renderStart() {
    var list = el('module-list');
    list.innerHTML = '';
    var mods = QUESTIONS.modules;
    for (var i = 0; i < mods.length; i++) { list.appendChild(moduleButton(mods[i])); }

    renderWeakCard();
    renderProgress();

    var saved = load();
    var box = el('resume');
    if (saved && !saved.done) {
      var answered = 0;
      for (var j = 0; j < saved.answers.length; j++) {
        if (saved.answers[j] !== null) { answered++; }
      }
      box.hidden = false;
      el('resume-note').textContent = attemptName(saved) + ' — ' + answered +
        ' of ' + saved.refs.length + ' answered.';
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
    b.appendChild(span('choice-name', mod.name));
    b.appendChild(span('choice-sub', mod.subtitle));
    b.appendChild(span('choice-meta', 'Start — ' + take +
      ' questions from a bank of ' + mod.questions.length));
    b.onclick = function () { moduleAttempt(mod.id); renderExam(); };
    return b;
  }

  function span(cls, text) {
    var s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  }

  function renderWeakCard() {
    var weak = weakRefs();
    var card = el('weak-card');
    if (!weak.length) { card.hidden = true; return; }
    card.hidden = false;
    var worst = weak[0];
    el('weak-note').textContent =
      plural(weak.length, 'question', 'questions') + ' to work on — the worst has caught you ' +
      'out ' + plural(worst.w, 'time', 'times') + '. Get one right ' + MASTERED +
      ' times running and it drops off this list.';
  }

  function renderProgress() {
    var st = stats();
    var card = el('progress-card');
    if (!st.a.length) { card.hidden = true; return; }
    card.hidden = false;

    var body = el('progress-body');
    body.innerHTML = '';

    var groups = [{ id: 1, name: 'Module 1' }, { id: 2, name: 'Module 2' },
                  { id: 0, name: 'Weak spots' }];
    for (var g = 0; g < groups.length; g++) {
      var rows = [];
      for (var i = 0; i < st.a.length; i++) {
        if (st.a[i].m === groups[g].id) { rows.push(st.a[i]); }
      }
      if (!rows.length) { continue; }
      var best = 0, last = 0;
      for (var j = 0; j < rows.length; j++) {
        var pct = Math.round((rows[j].r / rows[j].t) * 100);
        if (pct > best) { best = pct; }
        last = pct;
      }
      body.appendChild(progressRow(groups[g].name, rows.length, best, last));
    }
  }

  function progressRow(name, count, best, last) {
    var row = document.createElement('div');
    row.className = 'prow';
    row.appendChild(span('prow-name', name));
    var meta = span('prow-meta',
      plural(count, 'attempt', 'attempts') + ' · best ' + best + '% · last ' + last + '%');
    meta.className = 'prow-meta' + (last >= PASS ? ' ok' : '');
    row.appendChild(meta);
    return row;
  }

  // ------------------------------------------------------------ exam view
  function renderExam() {
    var total = state.refs.length;
    var i = state.idx;
    var q = questionAt(state, i);
    var bits = state.refs[i].split(':');

    el('pbar').style.width = Math.round(((i + 1) / total) * 100) + '%';
    el('pcount').textContent = 'Question ' + (i + 1) + ' of ' + total;
    el('qmeta').textContent = (state.mode === 'weak'
      ? 'Weak spots · module ' + bits[0] + ', question ' + bits[1]
      : moduleById(state.moduleId).name + ' · question ' + q.n + ' in the bank');
    el('qtext').textContent = q.q;

    var box = el('qopts');
    box.innerHTML = '';
    for (var k = 0; k < q.opts.length; k++) { box.appendChild(optionButton(q, k, i)); }

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

    b.appendChild(span('letter', 'ABCD'.charAt(k)));
    var text = document.createElement('span');
    text.textContent = q.opts[k];
    b.appendChild(text);

    b.onclick = function () {
      state.answers[qIndex] = k;
      save(state);
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
    if (state.idx > 0) { state.idx--; save(state); renderExam(); }
  }

  function goNext() {
    var total = state.refs.length;
    if (state.idx < total - 1) {
      state.idx++; save(state); renderExam();
      return;
    }
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
    record(state);          // exactly once: a finished attempt is not resumable
    renderResult();
  }

  // ---------------------------------------------------------- result view
  function renderResult() {
    var t = tally();
    var pct = Math.round((t.right / t.total) * 100);
    var passed = pct >= PASS;

    el('scorecard').className = 'card score ' + (passed ? 'pass' : 'fail');
    el('score-head').textContent = attemptName(state) + ' · ' + t.total + ' questions';
    el('score-pct').textContent = pct + '%';
    el('score-right').textContent = t.right;
    el('score-wrong').textContent = t.wrong;
    el('score-note').textContent = passed
      ? 'Above the indicative ' + PASS + '% pass mark. That mark is a guide only, ' +
        'not the awarding body’s.'
      : 'Below the indicative ' + PASS + '% pass mark — you needed ' +
        Math.ceil(t.total * PASS / 100) + ' correct. Read the notes below and go again.';
    el('score-history').textContent = historyLine(pct);

    el('review').innerHTML = '';
    for (var i = 0; i < state.refs.length; i++) {
      el('review').appendChild(reviewItem(state.refs[i], state.answers[i], i + 1));
    }
    el('review-head').textContent = 'Review all ' + t.total;

    show('result');
  }

  function historyLine(pct) {
    var st = stats();
    var mine = [];
    for (var i = 0; i < st.a.length; i++) {
      if (st.a[i].m === state.moduleId) { mine.push(st.a[i]); }
    }
    if (mine.length < 2) { return ''; }
    var best = 0;
    for (var j = 0; j < mine.length; j++) {
      var p = Math.round((mine[j].r / mine[j].t) * 100);
      if (p > best) { best = p; }
    }
    var prev = Math.round((mine[mine.length - 2].r / mine[mine.length - 2].t) * 100);
    var move = pct > prev ? 'up from ' + prev + '%'
             : pct < prev ? 'down from ' + prev + '%'
             : 'the same as last time';
    return plural(mine.length, 'attempt', 'attempts') + ' at this · ' + move +
           ' · best ' + best + '%';
  }

  // --------------------------------------------------------------- review
  // Shared by the result screen and the weak-spot list.
  function reviewItem(ref, given, number) {
    var q = questionByRef(ref);
    var ok = (given === q.a);
    var st = stats().q[ref];

    var d = document.createElement('details');
    d.className = 'rev ' + (ok ? 'right' : 'wrong');

    var s = document.createElement('summary');
    var tag = span('tag', ok ? 'Correct' : 'Wrong');
    s.appendChild(tag);
    s.appendChild(document.createTextNode(' ' + number + '. ' + q.q));
    d.appendChild(s);

    var body = document.createElement('div');
    body.className = 'rev-body';
    body.appendChild(reviewLine('Your answer', given, q,
      'rev-line yours' + (ok ? '' : ' wrong-ans')));
    if (!ok) {
      body.appendChild(reviewLine('Correct answer', q.a, q, 'rev-line correct-ans'));
    }
    if (st && st.s > 1) {
      var hist = document.createElement('p');
      hist.className = 'rev-line hist';
      hist.textContent = 'Seen ' + plural(st.s, 'time', 'times') + ', wrong ' +
        plural(st.w, 'time', 'times') + '.';
      body.appendChild(hist);
    }
    if (q.note) { body.appendChild(noteBlock(q)); }

    d.appendChild(body);
    return d;
  }

  function noteBlock(q) {
    var note = document.createElement('p');
    note.className = 'rev-note';
    var head = document.createElement('b');
    head.textContent = (typeof q.keyed === 'number')
      ? 'Corrected from the handout' : 'Worth knowing';
    note.appendChild(head);
    note.appendChild(document.createTextNode(q.note));
    return note;
  }

  function reviewLine(label, choice, q, cls) {
    var p = document.createElement('p');
    p.className = cls;
    p.appendChild(span('lab', label + ': '));
    p.appendChild(document.createTextNode(
      choice === null || choice === undefined
        ? 'not answered'
        : 'ABCD'.charAt(choice) + '. ' + q.opts[choice]
    ));
    return p;
  }

  // ------------------------------------------------------- weak spot view
  function renderWeak() {
    var weak = weakRefs();
    var box = el('weak-list');
    box.innerHTML = '';

    for (var i = 0; i < weak.length; i++) {
      var ref = weak[i].ref;
      var q = questionByRef(ref);
      var d = document.createElement('details');
      d.className = 'rev wrong';

      var s = document.createElement('summary');
      s.appendChild(span('tag', 'x' + weak[i].w));
      s.appendChild(document.createTextNode(' ' + (i + 1) + '. ' + q.q));
      d.appendChild(s);

      var body = document.createElement('div');
      body.className = 'rev-body';
      body.appendChild(reviewLine('Correct answer', q.a, q, 'rev-line correct-ans'));
      var hist = document.createElement('p');
      hist.className = 'rev-line hist';
      hist.textContent = 'Wrong ' + plural(weak[i].w, 'time', 'times') + ' out of ' +
        plural(weak[i].s, 'attempt', 'attempts') + '.' +
        (weak[i].c ? ' Right ' + plural(weak[i].c, 'time', 'times') + ' since — ' +
          (MASTERED - weak[i].c) + ' more to clear it.' : '');
      body.appendChild(hist);
      if (q.note) { body.appendChild(noteBlock(q)); }

      d.appendChild(body);
      box.appendChild(d);
    }

    el('btn-weak-from-list').hidden = !weak.length;
    show('weak');
  }

  // ----------------------------------------------------------- wiring up
  el('btn-prev').onclick = goPrev;
  el('btn-next').onclick = goNext;

  el('btn-quit').onclick = function () {
    if (window.confirm('Abandon this attempt? Your answers so far are lost.')) {
      clear(); state = null; renderStart();
    }
  };

  el('btn-again').onclick = function () {
    if (state.mode === 'weak') { weakAttempt(); } else { moduleAttempt(state.moduleId); }
    renderExam();
  };

  el('btn-home').onclick = function () { clear(); state = null; renderStart(); };

  el('btn-resume').onclick = function () {
    var saved = load();
    if (!saved) { renderStart(); return; }
    state = saved;
    if (state.idx >= state.refs.length) { state.idx = state.refs.length - 1; }
    renderExam();
  };

  el('btn-discard').onclick = function () { clear(); el('resume').hidden = true; };

  el('btn-weak').onclick = function () { weakAttempt(); renderExam(); };
  el('btn-weak-from-list').onclick = function () { weakAttempt(); renderExam(); };
  el('btn-weak-list').onclick = renderWeak;
  el('btn-weak-back').onclick = renderStart;

  el('btn-clear').onclick = function () {
    if (window.confirm('Clear your history? Every score and weak spot is forgotten. ' +
                       'The questions themselves are not affected.')) {
      drop(STATS);
      renderStart();
    }
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
