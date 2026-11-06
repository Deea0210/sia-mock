# SIA Mock Exam

An untimed SIA licence practice app. Pick a module, answer 40 questions drawn at
random, get your score and a full review at the end. Installable on iPhone and
Android, works offline once loaded.

Live at **https://deea0210.github.io/sia-mock/**

## What it does

- **Two modules.** Module 1 (working in the private security industry, 72 questions
  in the bank) and Module 2 (door supervision law, searching, licensing, 100 in the
  bank).
- **40 questions per attempt**, drawn at random in a fresh order every time, so the
  order never becomes the thing you remember.
- **No time limit.** Your place and your answers are saved as you go, so closing the
  app or locking the phone loses nothing.
- **Scored at the end**, never during — correct, wrong, and a percentage against an
  indicative 70% pass mark.
- **Full review** of all 40 with your answer against the right one, and a note on any
  question whose wording is loose or whose handout answer was wrong.
- **Do it again** reshuffles a new 40 from the same module.
- **Weak spots.** Every answer is recorded per question, so the app knows what keeps
  catching you out and can build an attempt from exactly those.

## What it tracks (build 2)

Two separate things live in the browser's `localStorage`:

- `sia.v1` — the attempt **in progress**, so closing the app loses nothing. Cleared
  when you finish or abandon.
- `sia.stats.v1` — your **history**: per question `{s: seen, w: wrong, c: right in a
  row}`, plus the last 50 attempt scores.

A question joins the weak list the first time you get it wrong, and **drops off once
you get it right twice running** (`MASTERED` in `app.js`). Without that rule the list
would only ever grow — one slip in January would still be a "weak spot" in June.

"Practise these" builds a 40-question attempt from the weak list, worst first, then
pads with questions you have never seen, then the rest — so a short weak list still
gives you a full paper rather than a five-question one.

The start screen shows a progress row per module (attempts, best, last), and the
result screen says whether you are up or down on last time. "Clear my history" on the
weak-spot list wipes `sia.stats.v1` only.

**This data is per browser and per device.** It is not on any server, it does not
follow you to another phone, and clearing the site's data in browser settings deletes
it. There is no export — if that matters later, add one before suggesting anyone clear
anything.

## The question bank

`questions.js` is **generated — do not hand-edit it.** It is built from the two mock
papers by `tools/build_questions.py`, which parses the questions and applies the
answer keys, then asserts that every question has 2 or 4 options and a key that
points at one of them. All 172 keys were cross-checked against the combined
answer PDF and agreed.

Two answers in the handout are wrong, so the app marks the correct one and says so
on the review screen:

| | Handout | App | Why |
|---|---|---|---|
| Module 2 Q38 | D | **A** | A search needs consent; a door supervisor has no police power to search. CCTV availability is irrelevant. |
| Module 2 Q46 | C | **B** | GHB was reclassified from Class C to Class B on 12 April 2022. |

Fourteen more questions keep their keyed answer but carry a note, where the wording
simplifies the law (theft, manslaughter, hearsay) or has not kept up with it.

The source papers also had US spellings and a few typos in a UK exam; those are
corrected in the generated bank.

## Running it locally

```
python -m http.server 8124 --bind 127.0.0.1
```

Then open http://127.0.0.1:8124/. Wired up as the `sia-mock` entry in
`.claude/launch.json`.

Service workers do not register inside some embedded preview panes. That does not
break anything — `app.js` registers the worker last, inside a `try`, so the app runs
either way. Check installability on a real phone or a normal browser tab.

## Shipping a change

The worker is **network-first** on purpose: a cache-first worker once pinned a broken
build onto a phone that could not be recovered. Offline use is worth less than being
able to push a fix. Even so, every release must bump the cache or phones keep
serving the old files:

1. Edit `index.html` / `app.css` / `app.js`.
2. Bump `CACHE` in `sw.js`.
3. Bump the `?v=` on the css/js links in **`index.html` and the `SHELL` list in
   `sw.js`** — both, or they disagree.
4. Bump the number in the `.version` line in `index.html`.
5. Commit and `git push origin main`. Pages rebuilds in a minute or two.

If a push dies with "terminal prompts disabled", set `$env:GIT_TERMINAL_PROMPT = "1"`
first.

## Keep the JavaScript old

Nothing here is newer than about 2018 — no optional chaining, no `??`, no
`structuredClone`, no `<dialog>`, no flex `gap`, no `clamp()`. A previous app on this
phone rendered but ignored every tap because its first call was an API the browser
did not have, and the script died before a single listener was attached. `index.html`
carries an inline `window.onerror` that paints the failure in a red box on screen,
because on a phone there is no console and a silent failure looks like a working app.

**If someone says it doesn't work, ask for that red text first.**

## Icons

`tools/make-icons.ps1` generates them with PowerShell and System.Drawing, because
this machine had no image library to hand. Re-run it if the artwork changes:

```
powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
```

## Not official

Practice material only. These are not official SIA papers, and the 70% pass mark is a
guide, not the awarding body's.
