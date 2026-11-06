# Builds ../questions.js from the two mock-test papers in ./source, which are the
# markitdown output of the original .docx files.
#
#   python tools/build_questions.py
#
# Every assertion in here is deliberate: a bad key or a missing option should stop
# the build, not ship a quiz that marks people wrong.
import re, json, io, os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "source")
OUT = os.path.join(HERE, os.pardir, "questions.js")

# ---- teacher answer keys, transcribed from the two papers and cross-checked
# ---- against the combined 172-question answer PDF (all 172 agreed).
KEY1 = ("CBADDCCBBBBDBCBAACCBACCACBDDABAABCD"
        "CBCCDBBBDBCBABBABBBBBBBABBBBBCDBBDCBD")
KEY2 = ("BCBAACBCDB" "BABBAABBBB" "BCBCBDBBBB" "ADDCBCADBB"
        "BBBABCABAA" "BBCABAABAB" "CAACCBBBAB" "AABDBBDBAB"
        "DBBDDBDDAA" "ABCBDBCCBC")

# ---- answers that differ from the handout key, with the reason shown on review.
OVERRIDE = {
  (2, 38): ("A", "The handout key says D. A search needs the person's consent — a door "
                 "supervisor has no police power to search. Refusing consent can mean refusing "
                 "entry, but CCTV availability has nothing to do with it."),
  (2, 46): ("B", "The handout key says Class C. GHB was reclassified to Class B on "
                 "12 April 2022, so Class B is correct today."),
}

# ---- notes on questions whose keyed answer stands but whose wording is loose.
NOTE = {
  (1, 28): "The question never establishes an earlier protected complaint, so victimisation "
           "is not clearly made out on the facts given. Learn the keyed answer, but know the "
           "wording is weak.",
  (1, 36): "Emergency exits must stay openable from the inside at all times. 'Secured when "
           "not in use' means guarded against outside entry — never locked against escape.",
  (1, 42): "The option is shortened. The Act's formal title is the Private Security "
           "Industry Act 2001 — learn it with the 'Private'.",
  (1, 44): "Module 1 asks this twice (Q44 and Q54) with different option sets, so the keyed "
           "letter differs between them. Read the options, not the question number.",
  (1, 54): "Module 1 asks this twice (Q44 and Q54) with different option sets, so the keyed "
           "letter differs between them. Read the options, not the question number.",
  (1, 70): "Anyone can have a drink spiked. A lone woman is the keyed answer but not the only "
           "person at risk.",
  (1, 71): "In reality a spiked drink usually looks completely normal. Do not rely on seeing "
           "anything.",
  (2,  5): "A minor scratch would not normally reach the ABH threshold. It is the closest "
           "option offered, so the question itself is flawed.",
  (2, 12): "A simplification. Manslaughter covers several distinct offences, not one rule.",
  (2, 14): "A simplification. Theft also requires dishonesty and appropriation, not just "
           "intent to deprive permanently.",
  (2, 55): "Hearsay is not automatically inadmissible or unreliable in UK courts; there are "
           "statutory exceptions.",
  (2, 67): "A DPS is required for most premises licences authorising alcohol sales — not "
           "literally every premises licence.",
  (2, 70): "The 24 hours refers to one initial police closure power, not every closure route.",
  (2, 77): "16- and 17-year-olds may drink beer, wine or cider with a table meal when with an "
           "adult. It is not permission for them to buy alcohol.",
}

# ---- text corrections: UK spelling and the typos in the source papers.
FIX = [
  ("behaviors", "behaviours"), ("behavior", "behaviour"),
  ("organization", "organisation"), ("victimization", "victimisation"),
  ("Victimization", "Victimisation"), ("unauthorized", "unauthorised"),
  ("immobilization", "immobilisation"), ("Immobilization", "Immobilisation"),
  ("all suspicions' activity", "all suspicious activity"),
  ("A cut suffered a work", "A cut suffered at work"),
  ("Which of these would there be one way to deal with anti-social behaviour?",
   "Which of these would be one way to deal with anti-social behaviour?"),
]

def clean(s):
    s = s.replace("\\_", "_").replace("\\'", "'").strip()
    for a, b in FIX:
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s)

def parse(path):
    qs = {}
    cur = None
    with io.open(path, encoding="utf-8") as fh:
        for line in fh:
            m = re.match(r"^\*\*Q(\d+)\.\*\*\s*(.*)$", line.strip())
            if m:
                cur = int(m.group(1))
                qs[cur] = {"n": cur, "q": clean(m.group(2)), "opts": []}
                continue
            m = re.match(r"^\*\s*([A-D])\.\s*(.*)$", line.strip())
            if m and cur:
                qs[cur]["opts"].append(clean(m.group(2)))
    return qs

def build(path, module, key, total):
    qs = parse(path)
    missing = [i for i in range(1, total + 1) if i not in qs]
    assert not missing, "module %d missing questions %s" % (module, missing)
    assert len(qs) == total, "module %d parsed %d questions, expected %d" % (module, len(qs), total)
    assert len(key) == total, "module %d key has %d letters, expected %d" % (module, len(key), total)
    out = []
    for i in range(1, total + 1):
        item = qs[i]
        n_opts = len(item["opts"])
        assert n_opts in (2, 4), "module %d Q%d has %d options" % (module, i, n_opts)
        letter = key[i - 1]
        idx = "ABCD".index(letter)
        assert idx < n_opts, "module %d Q%d key %s but only %d options" % (module, i, letter, n_opts)
        rec = {"n": i, "q": item["q"], "opts": item["opts"], "a": idx}
        ov = OVERRIDE.get((module, i))
        if ov:
            rec["a"] = "ABCD".index(ov[0])
            rec["keyed"] = idx          # what the handout said, for the review screen
            rec["note"] = ov[1]
        elif (module, i) in NOTE:
            rec["note"] = NOTE[(module, i)]
        out.append(rec)
    return out

m1 = build(os.path.join(SRC, "module1.md"), 1, KEY1, 72)
m2 = build(os.path.join(SRC, "module2.md"), 2, KEY2, 100)

data = {
  "modules": [
    {"id": 1, "name": "Module 1", "subtitle": "Working in the private security industry",
     "questions": m1},
    {"id": 2, "name": "Module 2", "subtitle": "Door supervision: law, searching, licensing",
     "questions": m2},
  ]
}

body = json.dumps(data, ensure_ascii=False, indent=1, sort_keys=False)
with io.open(OUT, "w", encoding="utf-8", newline="\n") as fh:
    fh.write("/* Question bank for the SIA Mock Exam app.\n")
    fh.write("   Generated by tools/build_questions.py; do not hand-edit.\n")
    fh.write("   172 questions: Module 1 = 72, Module 2 = 100. */\n")
    fh.write("var QUESTIONS = ")
    fh.write(body)
    fh.write(";\n")

print("module 1:", len(m1), "questions")
print("module 2:", len(m2), "questions")
print("overrides:", sum(1 for q in m1 + m2 if "keyed" in q))
print("notes:", sum(1 for q in m1 + m2 if "note" in q))
print("two-option (true/false) items:", sum(1 for q in m1 + m2 if len(q["opts"]) == 2))
print("wrote", os.path.normpath(OUT), os.path.getsize(OUT), "bytes")
