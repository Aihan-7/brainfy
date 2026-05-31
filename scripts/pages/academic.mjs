// Academic / subject SEO landing pages for Brainfy.
// Each object follows the schema consumed by scripts/gen-pages.mjs.
// Honesty: Brainfy has NO pre-made or verified exam decks. All copy frames
// the value as turning YOUR notes / past papers / textbook photos into cards,
// importing Anki/Quizlet decks, and browsing community decks.

export default [
  {
    slug: 'gcse-revision-app', cat: 'subject', eyebrow: 'Revision · GCSE',
    crumb: 'GCSE Revision App',
    title: 'Free GCSE Revision App | Brainfy',
    desc: 'A free GCSE revision app: turn your class notes and past papers into flashcards, drill them with spaced repetition, and plan exam season. AQA, Edexcel, OCR.',
    keywords: 'gcse revision app, free gcse revision, gcse flashcards, gcse spaced repetition, aqa edexcel ocr revision app',
    h1: 'A Free GCSE Revision App for Real Exam Season',
    lede: 'GCSE revision is a memory problem stretched across nine or ten subjects. Brainfy helps you <strong>turn your own class notes and past papers into flashcards</strong>, drills them with spaced repetition, and plans your weeks so nothing gets left until the night before.',
    body: `
      <h2>Built around your courses, not generic decks</h2>
      <p>Brainfy does not ship pre-made GCSE decks, and that is on purpose — your teacher's emphasis, your spec, and your weak spots are what matter. Instead you build decks from the material you already have: paste your notes, snap a photo of a textbook page, or upload a revision PDF, and the AI drafts question-and-answer cards you can edit or keep. It plays nicely with revision for AQA, Edexcel, and OCR, though Brainfy is not affiliated with any exam board.</p>
      <h2>Turn a topic into a deck</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Bring your material</h3><p>Paste class notes, upload a revision PDF, or photograph a page of your textbook or exercise book.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Generate cards, then tidy</h3><p>The AI drafts cards straight from your source. Fix wording, split a tricky one, or bin anything off-spec.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Revise what is due</h3><p>Spaced repetition surfaces the cards you are about to forget and parks the ones you know, so a session stays short.</p></div></div>
      </div>
      <h2>Plan the whole exam season</h2>
      <ul>
        <li><strong>Weekly planner.</strong> Block out revision by subject so the heavy ones get the time they need.</li>
        <li><strong>Multi-mode study.</strong> Switch between Learn, Match, Test, and cloze to drill the same deck from different angles.</li>
        <li><strong>Past papers into cards.</strong> Turn mark-scheme points and the questions you keep dropping marks on into cards you actually revise.</li>
        <li><strong>Streaks and a focus timer.</strong> A Pomodoro timer and a gentle streak keep daily revision honest.</li>
      </ul>
      <h2>Bring decks you already have</h2>
      <p>If you have made sets in Quizlet or Anki, import them as CSV, tab-separated text, or Quizlet exports and they slot straight into spaced repetition. You can also browse community decks other students have shared, then edit them to match your spec. Every deck exports back out to CSV, so there is no lock-in.</p>`,
    faq: [
      { q: 'Does Brainfy have ready-made GCSE decks?', a: 'No — Brainfy does not provide pre-made or verified exam decks. You build decks from your own notes, past papers, and textbook photos, import existing Quizlet or Anki sets, or browse community decks shared by other students and edit them to your spec.' },
      { q: 'Does it work for AQA, Edexcel, and OCR?', a: 'Yes. Because you build cards from your own material, decks match whichever board and spec you sit. Brainfy is not affiliated with or endorsed by AQA, Edexcel, or OCR.' },
      { q: 'Is the GCSE revision app free?', a: 'Yes — free during beta, web-based, with no ads and no deck limits.' },
      { q: 'Can I revise from past papers?', a: 'Yes. Paste questions and mark-scheme points, or photograph a paper, and the AI drafts cards. Cloze mode is handy for drilling key definitions and dates.' },
      { q: 'Do I need to install anything?', a: 'No. Brainfy runs in your browser on a phone or laptop, so you can revise on the bus or at your desk without a download.' },
    ],
    related: ['a-level-revision-app', 'notes-to-flashcards', 'spaced-repetition-app', 'study-planner'],
  },
  {
    slug: 'a-level-revision-app', cat: 'subject', eyebrow: 'Revision · A-level',
    crumb: 'A-level Revision App',
    title: 'Free A-level Revision App | Brainfy',
    desc: 'A free A-level revision app: turn class notes and past-paper mark schemes into flashcards, drill with spaced repetition, and plan your weeks. AQA, Edexcel, OCR.',
    keywords: 'a level revision app, free a level revision, a level flashcards, a level spaced repetition, past paper flashcards',
    h1: 'A Free A-level Revision App That Covers the Whole Workflow',
    lede: 'A-levels reward depth and consistency, not last-minute cramming. Brainfy helps you <strong>turn your class notes and past-paper mark schemes into flashcards</strong>, schedules them with spaced repetition, and plans your study weeks so two years of content stays in reach.',
    body: `
      <h2>Mark schemes are gold — turn them into cards</h2>
      <p>At A-level the marks live in the detail: the exact phrase the mark scheme wants, the step you keep skipping, the definition that has to be precise. Brainfy lets you paste those points, upload a revision PDF, or photograph your notes, and the AI drafts cards from your source so you revise the wording that actually scores. Decks suit revision for AQA, Edexcel, and OCR, though Brainfy is not affiliated with any board.</p>
      <h2>From notes to a revision deck</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Feed in the source</h3><p>Paste lecture or class notes, a revision PDF, or a photo of a textbook page or marked answer.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Draft and refine</h3><p>The AI pulls cards from your material. Edit the wording so it matches the mark scheme exactly.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Drill what is due</h3><p>Spaced repetition brings weak cards back sooner and known cards back later, so daily reviews stay short.</p></div></div>
      </div>
      <h2>Plan two years of content</h2>
      <ul>
        <li><strong>Weekly planner.</strong> Spread revision across subjects so the synoptic ones get sustained attention.</li>
        <li><strong>Multi-mode study.</strong> Learn, Match, Test, and cloze drill the same deck from different angles.</li>
        <li><strong>Past papers built in.</strong> Convert recurring exam questions and mark-scheme phrasing into cards you review.</li>
        <li><strong>Focus timer and streaks.</strong> A Pomodoro timer and a gentle streak keep the daily habit going.</li>
      </ul>
      <h2>No lock-in</h2>
      <p>Import Quizlet sets or Anki decks you already have as CSV, tab-separated text, or Quizlet exports, and they drop straight into spaced repetition. Browse community decks and adapt them to your spec, and export any deck back to CSV whenever you want.</p>`,
    faq: [
      { q: 'Does Brainfy include verified A-level decks?', a: 'No — there are no pre-made or verified exam decks. You build decks from your own notes and past-paper mark schemes, import existing Quizlet or Anki sets, or browse and adapt community decks.' },
      { q: 'Is it suitable for AQA, Edexcel, and OCR?', a: 'Yes. You build cards from your own material, so decks match whichever board and spec you sit. Brainfy is not affiliated with or endorsed by any exam board.' },
      { q: 'Is the A-level revision app free?', a: 'Yes — free during beta, web-based, no ads, no deck limits.' },
      { q: 'How does spaced repetition help over two years?', a: 'It schedules each card for the moment you are about to forget it, so Year 1 content stays fresh into Year 2 instead of fading and needing a full re-learn before exams.' },
      { q: 'Can I import notes from a PDF?', a: 'Yes. Upload a revision PDF or paste your notes and the AI drafts cards you can edit. Photos of textbook pages work too via OCR.' },
    ],
    related: ['gcse-revision-app', 'notes-to-flashcards', 'spaced-repetition-app', 'study-planner'],
  },
  {
    slug: 'ap-biology-flashcards', cat: 'subject', eyebrow: 'AP · Biology',
    crumb: 'AP Biology Flashcards',
    title: 'AP Biology Flashcards From Your Notes | Brainfy',
    desc: 'Build AP Biology flashcards unit by unit from your own notes, drill them with spaced repetition, and use Test mode to mirror the exam. Free, web-based.',
    keywords: 'ap biology flashcards, ap bio flashcards, ap biology spaced repetition, ap bio test prep, ap biology study app',
    h1: 'AP Biology Flashcards, Built Unit by Unit From Your Notes',
    lede: 'AP Biology is a lot of interlocking detail across eight units. Brainfy lets you <strong>build flashcards from your own notes and textbook</strong>, organise them unit by unit, drill them with spaced repetition, and use Test mode to rehearse under exam-style pressure.',
    body: `
      <h2>One deck per unit</h2>
      <p>Brainfy does not ship a verified AP Biology deck — you build decks that match your class and your textbook, which is exactly what makes them stick. Keep a deck per unit (chemistry of life, cell structure, energetics, heredity, gene expression, natural selection, ecology, and so on) so reviews map cleanly onto how the course is taught.</p>
      <h2>Build a unit deck</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Bring your source</h3><p>Paste your notes, upload a chapter PDF, or photograph a textbook diagram or page.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Generate and edit</h3><p>The AI drafts cards from your material — definitions, processes, cause-and-effect. Trim or reword to match your class.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Drill with spaced repetition</h3><p>Daily reviews resurface weak cards before you forget them, with new cards capped so a big unit does not bury you.</p></div></div>
      </div>
      <h2>Test mode mirrors the exam</h2>
      <ul>
        <li><strong>Test mode.</strong> Type-the-answer and multiple choice rehearse recall the way the exam demands it.</li>
        <li><strong>Learn and Match.</strong> Drill the same deck from different angles to lock in terminology.</li>
        <li><strong>Cloze cards.</strong> Blank out a key term in a process to practise the exact step you keep missing.</li>
        <li><strong>Spaced repetition.</strong> Keep all eight units alive at once instead of cramming each before its test.</li>
      </ul>
      <h2>Import or share</h2>
      <p>If you already made sets in Quizlet or Anki, import them as CSV, tab-separated text, or Quizlet exports. You can also browse community decks other students have shared and adapt them to your class, and export your decks back to CSV anytime.</p>`,
    faq: [
      { q: 'Does Brainfy have an official AP Biology deck?', a: 'No — there are no pre-made or verified AP decks. You build decks from your own notes and textbook, import existing Quizlet or Anki sets, or browse and adapt community decks.' },
      { q: 'How should I organise my cards?', a: 'Keep one deck per AP Biology unit so reviews follow how the course is taught and you can see which unit is slipping.' },
      { q: 'Does Test mode feel like the real exam?', a: 'Test mode uses type-the-answer and multiple-choice questions drawn from your deck, which rehearses the recall the exam expects. It complements, not replaces, full practice exams.' },
      { q: 'Is it free?', a: 'Yes — free during beta, web-based, with no ads.' },
      { q: 'Can I make cards from a textbook diagram?', a: 'Yes. Photograph the page and OCR pulls the text so the AI can draft cards; you then edit them to match the labels and processes you need.' },
    ],
    related: ['biology-flashcards-app', 'spaced-repetition-app', 'notes-to-flashcards', 'flashcards-for-college-students'],
  },
  {
    slug: 'ap-psychology-flashcards', cat: 'subject', eyebrow: 'AP · Psychology',
    crumb: 'AP Psychology Flashcards',
    title: 'AP Psychology Flashcards From Chapters | Brainfy',
    desc: 'Turn AP Psychology textbook chapters and notes into flashcards, drill terms with Learn and Test, and lock them in with spaced repetition. Free, web-based.',
    keywords: 'ap psychology flashcards, ap psych flashcards, ap psychology terms, ap psych spaced repetition, ap psychology study app',
    h1: 'AP Psychology Flashcards From Your Own Chapters',
    lede: 'AP Psychology lives or dies on vocabulary — hundreds of terms, theorists, and studies. Brainfy lets you <strong>turn your textbook chapters and class notes into flashcards</strong>, drill them with Learn and Test, and keep them with spaced repetition.',
    body: `
      <h2>Cards that match your textbook</h2>
      <p>Brainfy does not ship a verified AP Psychology deck — and that is the point. Different classes use different texts and emphasise different studies, so you build decks from your own chapters and notes. Paste a chapter summary, upload a PDF, or photograph a page, and the AI drafts term-and-definition cards you can edit. Keep a deck per unit — biological bases, sensation and perception, learning, cognition, development, social, and so on.</p>
      <h2>Build a chapter deck</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Add the chapter</h3><p>Paste your notes or a chapter summary, upload the PDF, or snap a photo of the page.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Draft term cards</h3><p>The AI pulls key terms, theorists, and studies from your source. Reword or merge to fit your class.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Lock them in</h3><p>Spaced repetition brings shaky terms back sooner and solid ones back later, so reviews stay short.</p></div></div>
      </div>
      <h2>Learn and Test the way the exam asks</h2>
      <ul>
        <li><strong>Learn mode.</strong> Adaptive multiple choice drills the terms you keep missing.</li>
        <li><strong>Test mode.</strong> Type-the-answer rehearses precise definitions for the free-response style.</li>
        <li><strong>Match.</strong> A timed pairing game makes terminology fast and automatic.</li>
        <li><strong>Spaced repetition.</strong> Keep every unit alive so the cumulative exam does not become one giant cram.</li>
      </ul>
      <h2>Import or browse</h2>
      <p>Bring Quizlet sets or Anki decks you already have via CSV, tab-separated text, or Quizlet exports, and they slot straight into spaced repetition. You can also browse community decks shared by other students and edit them to match your textbook, then export any deck to CSV.</p>`,
    faq: [
      { q: 'Does Brainfy include a verified AP Psychology deck?', a: 'No — there are no pre-made or verified AP decks. You build decks from your own chapters and notes, import existing Quizlet or Anki sets, or browse and adapt community decks.' },
      { q: 'What is the best way to study the terms?', a: 'Build a deck per unit, then alternate Learn for recognition and Test for precise definitions, while spaced repetition decides when each term comes back.' },
      { q: 'Can it pull terms from my textbook chapter?', a: 'Yes. Paste a chapter summary or upload the PDF, or photograph the page, and the AI drafts term-and-definition cards you can edit.' },
      { q: 'Is it free?', a: 'Yes — free during beta, web-based, no ads.' },
      { q: 'How does it help with the cumulative exam?', a: 'Spaced repetition keeps earlier units fresh instead of letting them fade, so by exam time you are revising, not re-learning.' },
    ],
    related: ['psychology-flashcards-app', 'spaced-repetition-app', 'notes-to-flashcards', 'flashcards-for-college-students'],
  },
  {
    slug: 'organic-chemistry-flashcards', cat: 'subject', eyebrow: 'Subject · Organic chemistry',
    crumb: 'Organic Chemistry Flashcards',
    title: 'Organic Chemistry Flashcards | Brainfy',
    desc: 'Drill organic chemistry reagents and mechanisms with cards you build yourself. Snap reaction images into cards via OCR, cloze the conditions, and review with SRS.',
    keywords: 'organic chemistry flashcards, ochem flashcards, reagents flashcards, reaction mechanisms flashcards, organic chemistry spaced repetition',
    h1: 'Organic Chemistry Flashcards for Reagents and Mechanisms',
    lede: 'Organic chemistry is a memory game wearing a logic costume: reagents, conditions, and mechanisms you simply have to know cold. Brainfy lets you <strong>build flashcards from your own notes and reaction sheets</strong>, snap reaction images into cards, and drill them with spaced repetition.',
    body: `
      <h2>Reagents and conditions, drilled to reflex</h2>
      <p>You cannot reason your way to a reagent you never memorised. Brainfy does not ship a verified ochem deck — you build cards from your own course material so the reactions match what your professor expects. Paste your reaction notes, upload a problem-set PDF, or photograph a mechanism sheet, and the AI drafts cards you can refine.</p>
      <h2>Snap a reaction into a card</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Photograph the reaction</h3><p>Snap a mechanism, reagent table, or your handwritten notes. OCR pulls the text so it becomes editable.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Draft cards, then cloze the conditions</h3><p>Turn each transformation into a card, and use cloze to blank out the reagent, solvent, or temperature you must recall.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Drill with spaced repetition</h3><p>Missed reactions come back sooner; mastered ones back later — so the long reagent list stays manageable.</p></div></div>
      </div>
      <h2>Why cloze and SRS fit ochem</h2>
      <ul>
        <li><strong>Cloze for conditions.</strong> Blank out the exact reagent or condition so you practise the single fact you keep dropping.</li>
        <li><strong>Mechanism cards.</strong> Break a multi-step mechanism into one card per step, then chain them.</li>
        <li><strong>Spaced repetition.</strong> Hundreds of reactions stay in rotation without an all-night cram.</li>
        <li><strong>Multi-mode study.</strong> Learn, Match, and Test drill the same deck from different angles.</li>
      </ul>
      <h2>Import or share decks</h2>
      <p>Already have reaction sets in Quizlet or Anki? Import them as CSV, tab-separated text, or Quizlet exports and they drop into spaced repetition. Browse community decks for inspiration, adapt them to your course, and export any deck back to CSV.</p>`,
    faq: [
      { q: 'Does Brainfy have a ready-made organic chemistry deck?', a: 'No — there are no pre-made or verified decks. You build cards from your own reaction notes and sheets, import existing Quizlet or Anki sets, or browse and adapt community decks.' },
      { q: 'Can I turn a photo of a mechanism into cards?', a: 'Yes. Photograph the mechanism or reagent sheet and OCR pulls the text so the AI can draft editable cards; you then tidy the wording to match your course.' },
      { q: 'How do cloze cards help with reactions?', a: 'Cloze blanks out a single piece — the reagent, solvent, or temperature — so you drill the exact condition you keep forgetting rather than the whole reaction at once.' },
      { q: 'Is it free?', a: 'Yes — free during beta, web-based, no ads.' },
      { q: 'How do I keep hundreds of reactions in memory?', a: 'Spaced repetition schedules each card for the moment you are about to forget it, so the whole reagent list stays in rotation without marathon cram sessions.' },
    ],
    related: ['spaced-repetition-app', 'notes-to-flashcards', 'pdf-to-flashcards', 'flashcards-for-college-students'],
  },
  {
    slug: 'sat-vocabulary-flashcards', cat: 'subject', eyebrow: 'SAT · Vocabulary',
    crumb: 'SAT Vocabulary Flashcards',
    title: 'SAT Vocabulary Flashcards | Brainfy',
    desc: 'Build or import SAT vocabulary flashcards, drill them with Learn, Match, and Test, and lock words in with spaced repetition and cloze in context. Free.',
    keywords: 'sat vocabulary flashcards, sat words flashcards, sat vocab app, sat vocabulary spaced repetition, sat word list flashcards',
    h1: 'SAT Vocabulary Flashcards That Actually Stick',
    lede: 'SAT vocabulary is a textbook spaced-repetition problem — the right word at the right interval. Brainfy lets you <strong>build or import a word deck</strong>, drill it with Learn, Match, and Test, and lock words in with spaced repetition and cloze in context.',
    body: `
      <h2>Build your list or bring one</h2>
      <p>Brainfy does not ship a verified SAT word list, so you stay in control of your deck. Paste a word list as <em>word, definition</em> per line, type words as you meet them in practice tests, or import a set you already have. The AI can also draft cards from a vocabulary PDF or a photo of your notes, with example sentences you can keep.</p>
      <h2>Build a vocabulary deck</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Add your words</h3><p>Paste a list, type words from practice tests, or upload a PDF and let the AI draft cards.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Add context with cloze</h3><p>Put each word in a sentence and blank it out, so you practise meaning in context, not in isolation.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Review on schedule</h3><p>Spaced repetition resurfaces shaky words sooner and known words later, so short daily reviews compound.</p></div></div>
      </div>
      <h2>Drill from every angle</h2>
      <ul>
        <li><strong>Learn.</strong> Adaptive multiple choice focuses on the words you keep missing.</li>
        <li><strong>Match.</strong> A timed pairing game makes recognition fast.</li>
        <li><strong>Test.</strong> Type-the-answer checks that you can produce the meaning, not just recognise it.</li>
        <li><strong>Cloze in context.</strong> Fill the blank in a sentence to test real comprehension.</li>
      </ul>
      <h2>Import and export freely</h2>
      <p>Bring word sets from Quizlet or Anki via CSV, tab-separated text, or Quizlet exports, and they slot straight into spaced repetition. Browse community decks for word lists other students have shared, edit them, and export your deck back to CSV anytime.</p>`,
    faq: [
      { q: 'Does Brainfy come with an SAT word list?', a: 'No — there are no pre-made or verified word lists. You build your own deck, paste a list, import a Quizlet or Anki set, or browse and adapt community decks.' },
      { q: 'Why is spaced repetition good for SAT vocab?', a: 'It shows each word right before you would forget it, so a few minutes a day compounds into a large, durable vocabulary instead of a list you forget after one session.' },
      { q: 'What is cloze in context?', a: 'A cloze card puts the word in a sentence and blanks it out, so you practise meaning and usage in context rather than memorising a bare definition.' },
      { q: 'Is it free?', a: 'Yes — free during beta, web-based, no ads.' },
      { q: 'Can I import a list I already made?', a: 'Yes. Paste or upload a CSV or tab-separated list of word and definition, or a Quizlet export, and it imports straight into a deck.' },
    ],
    related: ['spaced-repetition-app', 'ai-flashcards-for-language-learning', 'notes-to-flashcards', 'active-recall'],
  },
  {
    slug: 'flashcards-for-college-students', cat: 'subject', eyebrow: 'Use case · College',
    crumb: 'Flashcards for College Students',
    title: 'Free Flashcards for College Students | Brainfy',
    desc: 'Turn any course PDF or lecture notes into flashcards, drill them with spaced repetition, plan your week, and see honest analytics. Free, web-based, no ads.',
    keywords: 'flashcards for college students, college flashcards app, free study app college, pdf to flashcards college, spaced repetition college',
    h1: 'Free Flashcards for College Students, for Any Course',
    lede: 'College throws every subject at you at once. Brainfy turns <strong>any course PDF or set of lecture notes into flashcards</strong>, drills them with spaced repetition, plans your week, and shows honest analytics — free, web-based, and ad-free.',
    body: `
      <h2>Any course, one workflow</h2>
      <p>Whether it is organic chemistry, intro psych, anatomy, or a language requirement, the loop is the same: capture the material, turn it into questions, and review on a schedule. Brainfy does not ship verified course decks — you build them from your own lectures so they match your professor and your syllabus.</p>
      <h2>From lecture to deck</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Drop in the material</h3><p>Upload a lecture PDF, paste your notes, or photograph a textbook page or slide.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Generate and curate</h3><p>The AI drafts question-and-answer cards from your source. Keep what matters, edit the rest.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Review what is due</h3><p>Spaced repetition shows only the cards due today, with new cards capped so a heavy week stays finishable.</p></div></div>
      </div>
      <h2>More than flashcards</h2>
      <ul>
        <li><strong>Weekly planner.</strong> Block study time across every course so nothing gets neglected.</li>
        <li><strong>Multi-mode study.</strong> Learn, Match, Test, and cloze drill the same deck from different angles.</li>
        <li><strong>Honest analytics.</strong> See real retention and focus trends, so you know which course is slipping.</li>
        <li><strong>Pomodoro timer and streaks.</strong> Turn intentions into finished sessions and keep the habit going.</li>
      </ul>
      <h2>Import, share, export — no lock-in</h2>
      <p>Bring sets you already have from Quizlet or Anki via CSV, tab-separated text, or Quizlet exports. Browse community decks shared by other students, adapt them to your course, and export any deck back to CSV whenever you want.</p>`,
    faq: [
      { q: 'Does Brainfy have decks for my specific courses?', a: 'No — there are no pre-made or verified course decks. You build decks from your own lecture notes and PDFs, import existing Quizlet or Anki sets, or browse and adapt community decks.' },
      { q: 'Can it make cards from a lecture PDF?', a: 'Yes. Upload the PDF or paste your notes and the AI drafts question-and-answer cards you can edit; photos of slides or textbook pages work too via OCR.' },
      { q: 'Is it really free for students?', a: 'Yes — free during beta, web-based, with no ads and no caps on decks or the planner.' },
      { q: 'How does it handle a heavy course load?', a: 'Spaced repetition shows only what is due each day and caps new cards, while the weekly planner spreads study time so every course gets attention.' },
      { q: 'Can I move my decks in and out?', a: 'Yes. Import from CSV, tab-separated text, Anki text, or Quizlet exports, and export any deck back to CSV — no lock-in.' },
    ],
    related: ['pdf-to-flashcards', 'spaced-repetition-app', 'study-planner', 'notes-to-flashcards'],
  },
];
