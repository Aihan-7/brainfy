// SEO tool/landing + Q&A pages for Brainfy (brainfy.online).
// Loaded by scripts/gen-pages.mjs. Pure data, no imports.

export default [
  // ===== TOOL / LANDING PAGES =====
  {
    slug: 'free-flashcard-maker', cat: 'tool', eyebrow: 'Free tool · Flashcards',
    crumb: 'Free Flashcard Maker',
    title: 'Free Flashcard Maker — No Ads, No Paywall | Brainfy',
    desc: 'Make flashcards free with Brainfy — by hand, by import, or with AI from your notes. No ads, no paywall, no signup to try. Then study with spaced repetition.',
    keywords: 'free flashcard maker, make flashcards free, online flashcard maker, flashcard app free, create flashcards online',
    h1: 'A Truly Free Flashcard Maker',
    lede: 'Make as many flashcards as you want — <strong>by hand, by import, or with AI from your notes</strong> — and study them with real spaced repetition. No ads, no paywall on the core, and no signup needed to start.',
    body: `
      <h2>Three ways to build a deck</h2>
      <p>Most flashcard tools make you type every card. Brainfy gives you three on-ramps so you spend your time studying, not building:</p>
      <ul>
        <li><strong>By hand</strong> — add cards one at a time with a fast editor when you want full control.</li>
        <li><strong>By import</strong> — paste or upload CSV, tab-separated, Anki "Notes in Plain Text", or a Quizlet export, and it becomes a deck in seconds.</li>
        <li><strong>With AI</strong> — paste notes or drop in a PDF or photo, and the AI drafts question-answer cards for you to keep or edit.</li>
      </ul>
      <h2>How it works</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Open Brainfy and make a deck</h3><p>No signup needed to try. Name a deck and start adding cards by hand, by import, or with AI.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Build the cards your way</h3><p>Type them, paste a term/definition list, or let the AI draft a deck from your notes — then edit anything before you keep it.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Study with spaced repetition</h3><p>Your cards enter an SM-2-style schedule, plus Learn, Test, and Match modes — so the cards you miss come back sooner.</p></div></div>
      </div>
      <h2>What "free" actually means here</h2>
      <p>Free during beta, with <strong>no ads</strong> and <strong>no feature paywall</strong> on the core flashcard maker and study modes. You can also export any deck back to CSV, so your cards are always yours — there is no lock-in.</p>`,
    faq: [
      { q: 'Is the flashcard maker really free?', a: 'Yes — free during beta, with no ads and no paywall on the core maker, study modes, or spaced repetition. You can try it with no signup.' },
      { q: 'Do I have to type every card?', a: 'No. You can type cards by hand, import a CSV / tab-separated / Anki / Quizlet list, or let the AI draft a deck from pasted notes, a PDF, or a photo.' },
      { q: 'Can I edit AI-generated cards?', a: 'Yes — every AI-drafted card is fully editable before it enters your deck, so you keep what is right and fix or delete the rest.' },
      { q: 'Can I export my flashcards?', a: 'Yes — every deck exports to CSV, which re-imports into Anki, Quizlet, or a spreadsheet. No lock-in.' },
      { q: 'Is there a limit on how many cards I can make?', a: 'No deck caps during beta. Build as many cards and decks as you need.' },
    ],
    related: ['ai-flashcards', 'notes-to-flashcards', 'spaced-repetition-app', 'free-quizlet-alternative'],
  },
  {
    slug: 'notes-to-flashcards', cat: 'tool', eyebrow: 'Free tool · Notes to cards',
    crumb: 'Notes to Flashcards',
    title: 'Notes to Flashcards — AI Deck in Seconds | Brainfy',
    desc: 'Paste or upload your notes and Brainfy AI drafts a question-answer flashcard deck in seconds. Keep or edit each card, then study with spaced repetition. Free.',
    keywords: 'notes to flashcards, convert notes to flashcards, turn notes into flashcards, AI notes to cards, study notes flashcard maker',
    h1: 'Turn Your Notes Into Flashcards in Seconds',
    lede: 'Stop retyping your notes into cards. <strong>Paste or upload them and the AI drafts a question-answer deck</strong> for you — you keep or edit each card, and it enters spaced repetition automatically.',
    body: `
      <h2>From a wall of notes to a study-ready deck</h2>
      <p>Lecture notes, a summary doc, a chapter outline — the hardest part of flashcards has always been making them. Brainfy reads your notes and pulls out the testable facts as question-answer pairs, grounded in your own material rather than invented.</p>
      <h2>How it works</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Paste or upload your notes</h3><p>Drop in pasted text or a PDF (text). No signup needed to try.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>AI drafts a Q/A deck</h3><p>In seconds you get question-answer cards extracted from your notes — not made up.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Keep, edit, then review</h3><p>Tweak or delete any card, then study it with spaced repetition plus Learn, Test, and Match modes.</p></div></div>
      </div>
      <h2>Why this beats writing cards by hand</h2>
      <ul>
        <li><strong>Faster start.</strong> You are reviewing today instead of card-building all night.</li>
        <li><strong>Grounded in your source.</strong> The generator extracts from your notes rather than inventing facts.</li>
        <li><strong>Fully editable.</strong> You stay in control — every card is yours to fix before it counts.</li>
        <li><strong>Free during beta.</strong> No ads, no paywall on the core, and you can export to CSV anytime.</li>
      </ul>`,
    faq: [
      { q: 'What can I paste or upload?', a: 'Pasted text and PDFs (text-based) work today. You can also snap a photo of handwritten or printed notes and the AI will read it via OCR.' },
      { q: 'Are the cards accurate?', a: 'The generator is conservative — it extracts from your notes rather than inventing facts — and every card is editable before it enters your deck. Always verify against your source.' },
      { q: 'How long does it take?', a: 'Seconds for a typical set of notes. You then review the draft and keep, edit, or remove cards.' },
      { q: 'Do the cards get scheduled automatically?', a: 'Yes — kept cards enter an SM-2-style spaced-repetition queue, and you can also drill them in Learn, Test, and Match modes.' },
      { q: 'Is it free?', a: 'Yes — free during beta, no ads, no signup needed to try.' },
    ],
    related: ['ai-flashcards', 'pdf-to-flashcards', 'image-to-flashcards', 'free-flashcard-maker'],
  },
  {
    slug: 'ai-quiz-generator', cat: 'tool', eyebrow: 'Free tool · Quiz yourself',
    crumb: 'AI Quiz Generator',
    title: 'AI Quiz Generator — Quiz Yourself Free | Brainfy',
    desc: 'Turn your notes or a PDF into a deck, then auto-quiz yourself with multiple-choice (Learn) and typed (Test) modes with instant feedback. Free during beta.',
    keywords: 'ai quiz generator, quiz generator from notes, multiple choice quiz maker, quiz from pdf, self quiz app',
    h1: 'AI Quiz Generator: Turn Notes Into a Self-Quiz',
    lede: 'Brainfy turns your <strong>notes or a PDF into a deck</strong>, then quizzes you on it with <strong>multiple-choice (Learn) and typed (Test) modes</strong> — with instant feedback so you find your gaps fast.',
    body: `
      <h2>How the quizzing works</h2>
      <p>Brainfy does not invent a standalone exam bank — it builds a deck from your material, then quizzes you on that deck. The multiple-choice options in Learn are drawn from your own cards, so the distractors are realistic, and Test makes you type the answer for true recall.</p>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Add your material</h3><p>Paste notes or upload a PDF (text), and the AI drafts a question-answer deck. No signup needed to try.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Quiz yourself in Learn</h3><p>Multiple-choice questions with distractors pulled from your own deck — instant right/wrong feedback on every one.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Prove it in Test</h3><p>Type-the-answer questions with fair, accent-aware grading, so you confirm you can recall it cold.</p></div></div>
      </div>
      <h2>Why a self-quiz beats re-reading</h2>
      <ul>
        <li><strong>Retrieval is the rehearsal.</strong> Answering from memory is what builds the memory — re-reading mostly builds false familiarity.</li>
        <li><strong>It exposes gaps instantly.</strong> Every miss tells you exactly what to study next.</li>
        <li><strong>It feeds spaced repetition.</strong> Cards you miss come back sooner; cards you know fade back.</li>
        <li><strong>Free during beta.</strong> No ads, no paywall on the study modes.</li>
      </ul>`,
    faq: [
      { q: 'Does it create a full exam bank from scratch?', a: 'No — and we would not claim that. Brainfy turns your notes or PDF into a deck, then quizzes you on that deck in Learn (multiple choice) and Test (typed) modes.' },
      { q: 'Where do the multiple-choice options come from?', a: 'In Learn mode the wrong answers (distractors) are drawn from your own deck, which keeps the choices realistic and relevant to your material.' },
      { q: 'Do I get instant feedback?', a: 'Yes — every question is graded immediately, so you see what you got right and wrong as you go.' },
      { q: 'Can I quiz myself on a PDF?', a: 'Yes — upload a text-based PDF, the AI drafts a deck from it, and you can then quiz yourself in Learn and Test.' },
      { q: 'Is it free?', a: 'Yes — free during beta, no ads, no signup needed to try.' },
    ],
    related: ['ai-flashcards', 'notes-to-flashcards', 'pdf-to-flashcards', 'active-recall'],
  },
  {
    slug: 'image-to-flashcards', cat: 'tool', eyebrow: 'Free tool · Photo to cards',
    crumb: 'Image to Flashcards',
    title: 'Image to Flashcards — Photo to Deck (OCR) | Brainfy',
    desc: 'Snap a photo of your notes, a textbook page, or a whiteboard and Brainfy reads it with OCR and drafts AI flashcards. Great for handwritten notes. Free.',
    keywords: 'image to flashcards, photo to flashcards, picture to flashcards, ocr flashcards, handwritten notes to flashcards',
    h1: 'Turn a Photo of Your Notes Into Flashcards',
    lede: 'Snap a picture of your <strong>handwritten notes, a textbook page, or a whiteboard</strong> and Brainfy reads it with OCR, then drafts AI flashcards from what it finds — review and keep the ones you want.',
    body: `
      <h2>Built for the notes you never typed up</h2>
      <p>Most of your studying lives on paper, slides, and whiteboards — not in a tidy text file. Brainfy uses vision-based OCR to read images, so a photo of your messy lecture notes becomes a clean question-answer deck without retyping a word.</p>
      <h2>How it works</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Snap or upload a photo</h3><p>Handwritten notes, a textbook page, or a whiteboard shot all work. No signup needed to try.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>OCR reads the image</h3><p>Brainfy extracts the text from your photo, including handwriting it can recognise.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>AI drafts the cards</h3><p>It turns the extracted text into question-answer flashcards you can edit, keep, and study with spaced repetition.</p></div></div>
      </div>
      <h2>Tips for the best read</h2>
      <ul>
        <li><strong>Good light, flat angle.</strong> A straight-on, well-lit shot reads far better than a tilted, shadowed one.</li>
        <li><strong>One section at a time.</strong> A focused photo of one page or board gives cleaner cards than a crowded wide shot.</li>
        <li><strong>Check the draft.</strong> OCR on messy handwriting is not perfect — skim the cards and fix anything before you keep them.</li>
      </ul>`,
    faq: [
      { q: 'Does it work with handwriting?', a: 'Yes — the vision OCR can read legible handwriting. Clearer writing and a well-lit, straight-on photo give the best results; always skim the draft cards and fix any misreads.' },
      { q: 'What can I photograph?', a: 'Handwritten notes, printed textbook or slide pages, and whiteboards all work. Try to capture one section per photo for cleaner cards.' },
      { q: 'Is the photo data private?', a: 'Brainfy is privacy-first. Your image is processed to read the text and draft cards; the resulting deck is yours and exports to CSV anytime.' },
      { q: 'Can I edit the cards afterwards?', a: 'Yes — every card is editable before it enters your deck, so you can correct any OCR slips and trim what you do not need.' },
      { q: 'Is it free?', a: 'Yes — free during beta, no ads, no signup needed to try.' },
    ],
    related: ['ai-flashcards', 'notes-to-flashcards', 'pdf-to-flashcards', 'free-flashcard-maker'],
  },
  {
    slug: 'csv-to-flashcards', cat: 'tool', eyebrow: 'Free tool · Import',
    crumb: 'CSV to Flashcards',
    title: 'CSV to Flashcards — Upload a Spreadsheet | Brainfy',
    desc: 'Upload a CSV or spreadsheet of term, definition pairs and Brainfy builds an instant flashcard deck. Auto delimiter detection, and export back to CSV. Free.',
    keywords: 'csv to flashcards, spreadsheet to flashcards, import csv flashcards, tsv to flashcards, excel to flashcards',
    h1: 'Turn a CSV or Spreadsheet Into a Flashcard Deck',
    lede: 'Already have your terms in a spreadsheet? <strong>Upload or paste a CSV of term, definition pairs and Brainfy builds an instant deck</strong> — with automatic delimiter detection — then study it with spaced repetition.',
    body: `
      <h2>Your data, instantly studyable</h2>
      <p>If your study material already lives in Excel, Google Sheets, or a plain CSV, there is no reason to retype it. Brainfy reads a two-column term/definition layout and turns each row into a card — and it auto-detects whether your file is comma, tab, or semicolon separated.</p>
      <h2>How it works</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Export your sheet as CSV</h3><p>From Excel or Google Sheets, save or download a CSV with term in the first column and definition in the second.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Upload or paste it</h3><p>Drop the file into a deck or paste the text — Brainfy auto-detects the delimiter, so commas, tabs, and semicolons all just work.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Study and export back</h3><p>Your rows become a deck for spaced repetition plus Learn, Test, and Match — and you can export back to CSV anytime.</p></div></div>
      </div>
      <h2>Formats that just work</h2>
      <ul>
        <li><strong>CSV</strong> (comma-separated) from Excel, Numbers, or Google Sheets.</li>
        <li><strong>TSV</strong> (tab-separated), including Anki "Notes in Plain Text".</li>
        <li><strong>Pasted lists</strong> with a consistent separator — the delimiter is detected for you.</li>
        <li><strong>Round-trip export</strong> back to CSV, so there is no lock-in.</li>
      </ul>`,
    faq: [
      { q: 'What layout should my CSV use?', a: 'Two columns: term in the first, definition in the second — one card per row. A header row is fine. Comma, tab, or semicolon separators are auto-detected.' },
      { q: 'Can I paste instead of uploading a file?', a: 'Yes — paste the text directly into a deck and Brainfy detects the delimiter. CSV, TSV, Anki text, and Quizlet exports all work.' },
      { q: 'Does it handle Excel or Google Sheets?', a: 'Export your sheet as a CSV (or copy the cells) and import that. Brainfy reads the CSV/TSV, not the native .xlsx file.' },
      { q: 'Can I export my deck back to CSV?', a: 'Yes — every deck exports to CSV, which re-imports into a spreadsheet, Anki, or Quizlet. No lock-in.' },
      { q: 'Is it free?', a: 'Yes — free during beta, no ads, no signup needed to try.' },
    ],
    related: ['free-flashcard-maker', 'free-quizlet-alternative', 'ai-flashcards', 'spaced-repetition-app'],
  },
  {
    slug: 'study-timer', cat: 'tool', eyebrow: 'Free tool · Focus',
    crumb: 'Study Timer',
    title: 'Free Online Study Timer (Pomodoro) | Brainfy',
    desc: 'A free online Pomodoro study timer with ambient sound and session logging that feeds your analytics and study coach. No ads, no signup needed to try.',
    keywords: 'study timer, online study timer, pomodoro study timer, free focus timer, study timer with sound',
    h1: 'A Free Online Study Timer That Remembers Your Sessions',
    lede: 'A clean <strong>Pomodoro study timer</strong> with optional ambient sound — and unlike a kitchen timer, it <strong>logs every session</strong> so your focus history feeds your analytics and study coach.',
    body: `
      <h2>More than a countdown</h2>
      <p>A timer that forgets the moment it rings cannot help you improve. Brainfy logs each focus session, so over time you can see when you actually focus best and which subjects are getting your hours — the same data the built-in coach uses to nudge you.</p>
      <h2>How it works</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Set a focus block</h3><p>Start a Pomodoro-style block (25 minutes by default) on one task. No signup needed to try.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Focus with ambient sound</h3><p>Turn on optional ambient sound to settle in, and let the running timer make distractions feel expensive.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Sessions feed your analytics</h3><p>Each finished block is logged, so your focus trends and study coach get smarter the more you use it.</p></div></div>
      </div>
      <h2>Why pair it with flashcards</h2>
      <ul>
        <li><strong>Focus plus recall.</strong> Spend a block clearing your due flashcards — focused attention and active recall at once.</li>
        <li><strong>Shared signal.</strong> Your focus history and your review data live in the same app, so the coach can see the full picture.</li>
        <li><strong>Honest analytics.</strong> Real focus trends, not vanity stats.</li>
        <li><strong>Free during beta.</strong> No ads, no paywall on the timer.</li>
      </ul>`,
    faq: [
      { q: 'Is the study timer free?', a: 'Yes — the Pomodoro timer, ambient sound, and session logging are free during beta, with no ads and no signup needed to try.' },
      { q: 'Can I change the block length?', a: 'Yes — 25 minutes is the default, but you can tune the focus and break lengths to whatever rhythm suits you.' },
      { q: 'What does session logging do?', a: 'Every finished focus block is recorded, so Brainfy can show your focus trends and the coach can highlight when you focus best and what to prioritise.' },
      { q: 'Does it work with my flashcards?', a: 'Yes — a focus block spent clearing due cards pairs focus with active recall, and both feed the same analytics and coach.' },
      { q: 'Is there ambient sound?', a: 'Yes — optional ambient sound is built in to help you settle into a session.' },
    ],
    related: ['pomodoro-timer', 'study-planner', 'how-to-study-for-exams', 'active-recall'],
  },

  // ===== QUESTION / ANSWER GUIDES =====
  {
    slug: 'are-flashcards-effective', cat: 'guide', eyebrow: 'Guide · Study science',
    crumb: 'Are Flashcards Effective?',
    title: 'Are Flashcards Effective? The Evidence | Brainfy',
    desc: 'Are flashcards effective? Yes — when used for active recall and spaced over time. Here is the honest, evidence-based answer, plus how to use them well.',
    keywords: 'are flashcards effective, do flashcards work, flashcards effective studying, flashcards vs reading, why flashcards work',
    h1: 'Are Flashcards Effective? (An Honest Answer)',
    lede: 'Short answer: <strong>yes — when you use them for active recall and space them out over time.</strong> Flashcards are not magic paper; they are a delivery system for the two most evidence-backed study techniques there are.',
    body: `
      <h2>Why flashcards work</h2>
      <p>A flashcard forces <strong>active recall</strong> — you try to produce the answer before you flip — and decades of cognitive-science research show retrieval practice builds far stronger long-term memory than re-reading or highlighting. The act of remembering is what consolidates the memory.</p>
      <h2>The catch: it depends how you use them</h2>
      <ul>
        <li><strong>Recall, do not just flip.</strong> If you read the front, immediately read the back, and move on, you have skipped the part that works. Commit to an answer first.</li>
        <li><strong>Space them out.</strong> Reviewing a little over many days beats one long session. A scheduler that brings missed cards back sooner is what makes flashcards efficient.</li>
        <li><strong>Use them for the right thing.</strong> Flashcards are superb for facts, vocabulary, and definitions; deep conceptual understanding also needs explanation (see the Feynman technique).</li>
      </ul>
      <h2>What the research points to</h2>
      <p>The two highest-utility techniques in the well-known reviews of study methods are <strong>practice testing</strong> (retrieval) and <strong>distributed practice</strong> (spacing). Flashcards, used properly, are simply the easiest way to do both at once.</p>
      <h2>Try it</h2>
      <p>The fastest way to see it work is to make a small deck and review it daily for a week. With Brainfy you can generate that deck from your notes in seconds, and it handles the spacing for you, so all you do is recall.</p>`,
    faq: [
      { q: 'Are flashcards better than re-reading?', a: 'Substantially, for retention. Re-reading builds familiarity; flashcards force retrieval, which research shows produces much stronger long-term memory.' },
      { q: 'Why are my flashcards not working?', a: 'The most common reason is flipping too fast — read the front, guess, then check. Also space your reviews over days rather than cramming them all at once.' },
      { q: 'What are flashcards best for?', a: 'Facts, definitions, vocabulary, formulas — anything with a clear question and answer. For deep concepts, pair them with explaining the idea in your own words.' },
      { q: 'How many cards should I review a day?', a: 'Only what is due. A spaced-repetition scheduler caps new cards and surfaces the rest, so a daily session stays short and finishable.' },
      { q: 'Can I try it free?', a: 'Yes — generate a deck from your notes in Brainfy and review it daily for a week. It is free during beta, no signup needed to try.' },
    ],
    related: ['active-recall', 'spaced-repetition-app', 'how-to-study-with-flashcards', 'ai-flashcards'],
  },
  {
    slug: 'how-to-study-with-flashcards', cat: 'guide', eyebrow: 'Guide · Method',
    crumb: 'How to Study With Flashcards',
    title: 'How to Study With Flashcards (The Right Way) | Brainfy',
    desc: 'Most people use flashcards wrong by just flipping. Learn the right method: active recall, the Leitner/SRS schedule, and good cards. Then start free.',
    keywords: 'how to study with flashcards, how to use flashcards, flashcard study method, leitner system, study flashcards effectively',
    h1: 'How to Study With Flashcards the Right Way',
    lede: 'Most people use flashcards wrong — they flip too fast and call it studying. The method that actually works is simple: <strong>recall before you flip, space your reviews, and write good cards.</strong>',
    body: `
      <h2>The method, step by step</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Write one idea per card</h3><p>Keep each card to a single question with a single clear answer. Atomic cards are far easier to recall and schedule.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Recall before you flip</h3><p>Always commit to an answer out loud or in your head first. The struggle to retrieve is the part that builds the memory.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Rate yourself honestly</h3><p>Mark whether you actually knew it. Honest ratings are what let a scheduler put hard cards in front of you more often.</p></div></div>
        <div class="step"><div class="step-n">4</div><div><h3>Space the reviews (Leitner / SRS)</h3><p>The Leitner system moves cards you know into slower boxes and missed cards back to fast ones — a spaced-repetition app does this automatically.</p></div></div>
      </div>
      <h2>Do not just flip</h2>
      <p>Reading the front and instantly reading the back feels productive but skips the only step that works. If you cannot recall a card, that is useful information — let it come back sooner rather than peeking and moving on.</p>
      <h2>Write cards that are easy to recall</h2>
      <ul>
        <li><strong>One fact per card.</strong> Split a card that asks two things into two cards.</li>
        <li><strong>Ask a real question.</strong> Phrase the front as something you must answer, not a topic to "review".</li>
        <li><strong>Add a why, not just a what.</strong> A short cue or example on the back makes the card stick.</li>
        <li><strong>Mix in cloze and typed answers.</strong> Fill-in-the-blank and type-the-answer force harder retrieval than recognition alone.</li>
      </ul>
      <h2>Let the tools handle the schedule</h2>
      <p>You should not be sorting cards into boxes by hand. Brainfy runs an SM-2-style schedule for you, offers Learn, Test, Match, and Cloze modes, and can even generate the deck from your notes — so you just show up and recall. It is free during beta.</p>`,
    faq: [
      { q: 'What is the biggest mistake with flashcards?', a: 'Flipping too fast. If you read the front and immediately read the back, you skip the retrieval step that makes flashcards work. Always guess first.' },
      { q: 'What is the Leitner system?', a: 'A spaced-repetition method using boxes: cards you get right move to a slower-review box, cards you miss go back to a fast one. A spaced-repetition app automates this for you.' },
      { q: 'How do I write a good flashcard?', a: 'One idea per card, phrased as a clear question with a single answer. Split multi-part cards, and add a short cue or example to make recall stick.' },
      { q: 'How often should I review?', a: 'Daily, but only the cards that are due. Spaced repetition caps new cards and surfaces the rest, so a session stays short.' },
      { q: 'Can Brainfy schedule the reviews for me?', a: 'Yes — it runs an SM-2-style spaced-repetition schedule automatically and offers Learn, Test, Match, and Cloze modes. Free during beta, no signup needed to try.' },
    ],
    related: ['active-recall', 'spaced-repetition-app', 'are-flashcards-effective', 'ai-flashcards'],
  },
];
