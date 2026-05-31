export default [
  {
    slug: 'spaced-repetition', cat: 'guide', eyebrow: 'Guide · Study science',
    crumb: 'Spaced Repetition',
    title: 'Spaced Repetition: How It Works | Brainfy',
    desc: 'Spaced repetition fights the forgetting curve by reviewing facts just before you forget them. Learn the science and how an SM-2 app schedules it for you.',
    keywords: 'spaced repetition, what is spaced repetition, forgetting curve, sm-2 algorithm, spaced repetition learning',
    h1: 'What Is Spaced Repetition?',
    lede: '<strong>Spaced repetition</strong> is a study schedule that shows you each fact just before you would have forgotten it. It is built on one of the oldest findings in memory research — the forgetting curve — and a good app handles all the timing for you.',
    body: `
      <h2>The forgetting curve</h2>
      <p>In the 1880s, Hermann Ebbinghaus measured how quickly we lose newly learned information. The result, now called the forgetting curve, is steep: without review, memory of fresh material drops sharply within hours and days. The fix is not to study harder on day one — it is to revisit the material at spaced intervals, each review flattening the curve a little more.</p>
      <h2>Why spacing beats cramming</h2>
      <ul>
        <li><strong>Each successful recall resets the curve.</strong> Remembering a fact just as it begins to fade strengthens it far more than reviewing something you already know cold.</li>
        <li><strong>The intervals can grow.</strong> Once a fact is solid, you might not need to see it for a week, then a month, then longer — freeing your time for weaker material.</li>
        <li><strong>It is efficient.</strong> You spend effort only where memory is actually decaying, instead of re-reading everything evenly.</li>
      </ul>
      <h2>How an SM-2 app schedules it for you</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>You rate each card</h3><p>After answering, you tap how it went — Again, Hard, Good, or Easy. That single judgement is all the algorithm needs.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>SM-2 picks the next date</h3><p>The SM-2 algorithm grows the interval for cards you know and collapses it for cards you miss, tracking an "ease" value per card so timing adapts to you.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>You review only what is due</h3><p>Each day the app surfaces exactly the cards due — no more, no less — so a session stays short and finishable.</p></div></div>
      </div>
      <p>You should never be calculating intervals by hand. Brainfy runs an SM-2-style scheduler under the hood: you just answer honestly and review what is due. If you want the deeper feature tour, see our <a href="/spaced-repetition-app">spaced repetition app</a> page.</p>`,
    faq: [
      { q: 'How is spaced repetition different from just reviewing?', a: 'Ordinary reviewing treats every fact the same. Spaced repetition reviews each fact on its own schedule, timed to the moment you are about to forget it, so effort goes where it counts.' },
      { q: 'What is the SM-2 algorithm?', a: 'SM-2 is a well-known scheduling formula that uses your rating of each card to decide the next review date, stretching intervals for easy cards and shrinking them for hard ones. Brainfy uses an SM-2-style scheduler.' },
      { q: 'How often do I need to study?', a: 'Daily is ideal because the schedule assumes you clear due cards each day. Even 10 to 20 minutes keeps the queue from piling up.' },
      { q: 'Does spaced repetition work for any subject?', a: 'Yes — anything you can phrase as a question and answer benefits, from vocabulary and definitions to formulas and concepts.' },
      { q: 'What if I miss a few days?', a: 'You will have a larger due pile, but nothing is lost. A good scheduler caps new cards and lets you chip through the backlog without penalty.' },
    ],
    related: ['spaced-repetition-app', 'active-recall', 'leitner-system', 'ai-flashcards'],
  },
  {
    slug: 'how-to-make-flashcards', cat: 'guide', eyebrow: 'Guide · Study science',
    crumb: 'How to Make Flashcards',
    title: 'How to Make Good Flashcards | Brainfy',
    desc: 'The rules for effective flashcards: one fact per card, clear cues, good vs bad examples. Or auto-generate atomic cards from your notes and PDFs.',
    keywords: 'how to make flashcards, good flashcards, atomic flashcards, flashcard rules, making flashcards from notes',
    h1: 'How to Make Flashcards That Actually Work',
    lede: 'A flashcard is only as good as the question on it. The difference between cards that stick and cards that waste your time comes down to a few simple rules — and you can now skip the busywork by generating them from your notes.',
    body: `
      <h2>Rule one: one fact per card</h2>
      <p>The single most important rule is to keep each card <strong>atomic</strong> — one question, one answer. When a card asks for three things at once, you can half-know it and still rate it correct, so the scheduler never learns what you actually struggle with. Split a fat card into several small ones and each fact gets its own honest test.</p>
      <h2>Rule two: make the cue do the work</h2>
      <ul>
        <li><strong>Ask, do not state.</strong> The front should pose a real question, not just a topic heading.</li>
        <li><strong>Be specific.</strong> Vague prompts produce vague recall. Give just enough context that there is exactly one right answer.</li>
        <li><strong>Test understanding, not wording.</strong> Where you can, ask "why" and "how", not only "what" — recall should not depend on memorising a sentence.</li>
      </ul>
      <h2>Good versus bad examples</h2>
      <ul>
        <li><strong>Bad:</strong> Front "The heart" — Back "It has four chambers, pumps blood, and the left ventricle is the strongest." Too much in one card.</li>
        <li><strong>Good:</strong> Front "How many chambers does the human heart have?" — Back "Four." One fact, one clean test.</li>
        <li><strong>Good:</strong> Front "Which heart chamber pumps blood to the whole body?" — Back "The left ventricle." Specific cue, single answer.</li>
      </ul>
      <h2>Or auto-generate them</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Drop in your source</h3><p>Paste notes, upload a lecture PDF, or snap a photo of a textbook page.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>AI drafts atomic cards</h3><p>Brainfy pulls one-fact question-answer pairs from your material rather than inventing facts, so the cards stay grounded in your source.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>You edit and keep</h3><p>Skim the draft, fix anything off, and the deck is ready for spaced review.</p></div></div>
      </div>
      <p>Hand-writing cards is great practice, but when you have a hundred pages to cover, Brainfy's <a href="/ai-flashcards">AI flashcards</a> get you to the recall part faster.</p>`,
    faq: [
      { q: 'How many facts should one card have?', a: 'Exactly one. If you can answer a card while still being fuzzy on part of it, split it into separate cards so each fact is tested on its own.' },
      { q: 'Should I put images on cards?', a: 'Yes, where they help — diagrams, maps, and structures recall better as pictures. Just keep one idea per card.' },
      { q: 'Is it bad to make cards directly from a textbook?', a: 'Copying whole sentences leads to memorising wording, not meaning. Rephrase each point as a question with a short, specific answer.' },
      { q: 'Can I really trust AI to write my cards?', a: 'Use it as a fast first draft. Brainfy grounds cards in the source you give it, but you should still skim and correct before studying.' },
      { q: 'How many cards should a topic have?', a: 'As many small ones as it takes — atomic cards are the goal, not few cards. A dozen tight cards beat three overloaded ones.' },
    ],
    related: ['ai-flashcards', 'active-recall', 'are-flashcards-effective', 'spaced-repetition'],
  },
  {
    slug: 'how-to-memorize-fast', cat: 'guide', eyebrow: 'Guide · Study science',
    crumb: 'How to Memorize Fast',
    title: 'How to Memorize Fast: Ranked Techniques | Brainfy',
    desc: 'The fastest way to memorize is not cramming. Techniques ranked by real evidence, why cramming fails, and how active recall plus spacing wins.',
    keywords: 'how to memorize fast, memorize quickly, fastest way to memorize, memorization techniques, stop cramming',
    h1: 'How to Memorize Fast (What Actually Works)',
    lede: 'Everyone wants a shortcut to memorising. The honest answer: a few techniques are dramatically more efficient than the rest, and the one most students reach for — cramming — is near the bottom. Here is the ranking that the evidence supports.',
    body: `
      <h2>The techniques, ranked</h2>
      <ul>
        <li><strong>Best — active recall plus spacing.</strong> Testing yourself, then spacing those tests over time, produces the strongest memory per minute spent. Nothing else comes close for durable recall.</li>
        <li><strong>Strong — self-explanation and the Feynman method.</strong> Forcing yourself to explain an idea in plain words exposes gaps and deepens encoding.</li>
        <li><strong>Useful add-ons — mnemonics and chunking.</strong> Acronyms, memory palaces, and grouping items help for lists and arbitrary facts, but they support recall rather than replace it.</li>
        <li><strong>Weak — re-reading and highlighting.</strong> They feel productive and build familiarity, but familiarity is not recall. This is where most wasted hours go.</li>
        <li><strong>Worst for keeping it — cramming.</strong> Useful only for a test tomorrow you will never need again.</li>
      </ul>
      <h2>Why cramming feels fast but is not</h2>
      <p>Cramming works in the moment because the material is fresh in working memory — so you mistake recognition for learning. But without spaced review the forgetting curve takes over within days, and cumulative exams punish you for it. Massed practice buys a short, expensive bump; spaced practice buys lasting recall for less total effort.</p>
      <h2>The fast path, in order</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Turn material into questions</h3><p>Convert each fact into a flashcard. Questions force retrieval; reading does not.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Recall before you check</h3><p>Always attempt the answer from memory first. The effortful retrieval is what cements it.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Space the reviews</h3><p>Let a scheduler bring missed facts back sooner and mastered ones back later, so you stop wasting time on what you already know.</p></div></div>
      </div>
      <p>This is exactly the loop Brainfy automates: generate <a href="/ai-flashcards">AI flashcards</a> from your notes, drill them with <a href="/active-recall">active recall</a>, and let spaced repetition handle the timing — the genuinely fast way to memorise.</p>`,
    faq: [
      { q: 'What is the single fastest way to memorize?', a: 'Test yourself instead of re-reading, and space those tests over days. Active recall plus spaced repetition gives the most retention per minute.' },
      { q: 'Do memory palaces and mnemonics work?', a: 'They genuinely help for arbitrary lists and sequences, but they are a supplement. The core engine is still retrieval practice.' },
      { q: 'Is cramming ever the right call?', a: 'Only for a one-off test you will not be examined on again. For anything cumulative, spacing wins easily.' },
      { q: 'How fast will I see results?', a: 'Recall improves within the first few spaced sessions. Durable memory builds over a week or two of short daily reviews.' },
      { q: 'Why does re-reading feel like it works?', a: 'Re-reading builds familiarity — text looks recognisable — which your brain mistakes for knowing it. Recall reveals the difference instantly.' },
    ],
    related: ['active-recall', 'spaced-repetition', 'testing-effect', 'feynman-technique'],
  },
  {
    slug: 'leitner-system', cat: 'guide', eyebrow: 'Guide · Study science',
    crumb: 'Leitner System',
    title: 'The Leitner System Explained | Brainfy',
    desc: 'The Leitner system is a 5-box flashcard method for spaced repetition. Learn how the boxes work, the schedule, and how to let SM-2 automate it.',
    keywords: 'leitner system, leitner box, 5 box flashcard method, leitner spaced repetition, flashcard boxes',
    h1: 'The Leitner System: Spaced Repetition by Hand',
    lede: 'The <strong>Leitner system</strong> is the classic paper-and-box version of spaced repetition. It is a clever, low-tech way to space your reviews — and understanding it makes it obvious why most people now let software run the boxes for them.',
    body: `
      <h2>The five boxes</h2>
      <p>Invented by Sebastian Leitner in the 1970s, the system uses a row of boxes — commonly five. Every flashcard lives in one box, and the box decides how often you review that card. Box 1 holds the cards you see most often; each higher box is reviewed less frequently. A card climbs or falls based on whether you get it right.</p>
      <h2>How a card moves</h2>
      <ul>
        <li><strong>Get it right:</strong> the card moves up one box, so you will see it less often.</li>
        <li><strong>Get it wrong:</strong> the card drops all the way back to Box 1, where it gets frequent attention until it sticks again.</li>
        <li><strong>The schedule:</strong> a typical pattern is Box 1 daily, Box 2 every few days, Box 3 weekly, Box 4 every couple of weeks, Box 5 monthly. Known cards drift to the back; weak cards stay up front.</li>
      </ul>
      <h2>Try it on paper</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Set up five boxes</h3><p>Label five containers Box 1 to Box 5 and start every new card in Box 1.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Review the due boxes</h3><p>Each day review Box 1; on the right days review the slower boxes per your schedule.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Promote or demote</h3><p>Correct cards move up a box; missed cards go back to Box 1. Repeat daily.</p></div></div>
      </div>
      <h2>Let SM-2 automate the boxes</h2>
      <p>The Leitner system is really a coarse approximation of spaced repetition: fixed boxes, fixed intervals. Modern algorithms like SM-2 do the same thing more precisely — they set a custom interval for every card based on how hard you found it, instead of lumping cards into five buckets. Brainfy runs an SM-2-style scheduler so you get Leitner's logic without sorting physical cards. If you want the full picture, read our <a href="/spaced-repetition">spaced repetition</a> guide.</p>`,
    faq: [
      { q: 'How many boxes does the Leitner system use?', a: 'Classically five, though you can use three or seven. More boxes mean more gradations of review frequency.' },
      { q: 'What happens when I get a card wrong?', a: 'It drops back to Box 1 and returns to frequent review until you get it right again, then it starts climbing once more.' },
      { q: 'Is the Leitner system the same as spaced repetition?', a: 'It is an early, manual form of it. Algorithms like SM-2 do the same job with smoother, per-card intervals instead of fixed boxes.' },
      { q: 'Why use an app instead of real boxes?', a: 'Boxes work but are fiddly to maintain and easy to forget. An app schedules each card automatically and shows you only what is due.' },
      { q: 'Can I still study cards by hand if I prefer?', a: 'Absolutely — the Leitner method is a fine low-tech option. Many learners start on paper and move to an app once the deck grows.' },
    ],
    related: ['spaced-repetition', 'spaced-repetition-app', 'how-to-make-flashcards', 'ai-flashcards'],
  },
  {
    slug: 'testing-effect', cat: 'guide', eyebrow: 'Guide · Study science',
    crumb: 'Testing Effect',
    title: 'The Testing Effect: Quizzing Beats Re-reading | Brainfy',
    desc: 'The testing effect shows that quizzing yourself builds memory better than re-reading. Learn why retrieval practice works and how to use multi-mode quizzes.',
    keywords: 'testing effect, retrieval practice, quizzing yourself, testing effect study, why testing improves memory',
    h1: 'The Testing Effect: Why Quizzing Beats Re-reading',
    lede: 'One of the most reliable findings in learning science is the <strong>testing effect</strong>: being quizzed on material helps you remember it far better than studying it again. The act of retrieval is itself a powerful form of learning.',
    body: `
      <h2>What the testing effect is</h2>
      <p>The testing effect, also called retrieval practice, is the finding that trying to recall something strengthens your memory of it more than simply reviewing it. In classic experiments, students who were quizzed on material remembered far more weeks later than students who spent the same time re-reading — even though re-reading felt easier and more confident in the moment.</p>
      <h2>Why retrieval works</h2>
      <ul>
        <li><strong>Recall reconsolidates the memory.</strong> Every time you pull a fact out, you reinforce the pathway back to it. Reading does not exercise that pathway at all.</li>
        <li><strong>It exposes gaps honestly.</strong> A failed retrieval tells you instantly what you do not know — feedback re-reading never gives.</li>
        <li><strong>Even failed attempts help.</strong> Struggling to retrieve, then seeing the answer, encodes it better than never having tried.</li>
        <li><strong>It builds exam-shaped skill.</strong> A test asks you to produce answers, so practising producing answers is the most transferable rehearsal.</li>
      </ul>
      <h2>Put it to work</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Quiz, do not review</h3><p>Replace passive re-reading with self-testing. Cover the answer and produce it from memory.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Vary the question format</h3><p>Recall the same idea as a free-answer, a match, a fill-in-the-blank. Different angles deepen the memory.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Check and re-test the misses</h3><p>See the answer immediately, then loop the ones you missed back in sooner.</p></div></div>
      </div>
      <p>Brainfy's multi-mode study turns one deck into the testing effect from several angles — Learn, Match, Test, and Cloze (fill-in-the-blank) all force retrieval rather than recognition. It is the difference between a deck you recognise and a deck you can actually produce on exam day.</p>`,
    faq: [
      { q: 'Is the testing effect the same as active recall?', a: 'They describe the same idea from two angles. Active recall is the technique; the testing effect is the research finding that the technique works.' },
      { q: 'Do I need feedback for testing to help?', a: 'Quizzing helps even without feedback, but seeing the correct answer right after makes it considerably stronger — especially for items you missed.' },
      { q: 'Does it work for understanding, not just facts?', a: 'Yes. Recalling explanations and applying concepts to new problems benefits too, not just memorising definitions.' },
      { q: 'Why does re-reading feel more effective?', a: 'Re-reading is easy and familiar, which feels like mastery. Testing is effortful and reveals gaps — uncomfortable, but that is exactly why it works.' },
      { q: 'How do I quiz myself without a partner?', a: 'Flashcards and quiz modes do it solo. Brainfy offers Learn, Match, Test, and Cloze modes so you can self-test from several directions.' },
    ],
    related: ['active-recall', 'spaced-repetition', 'how-to-memorize-fast', 'are-flashcards-effective'],
  },
  {
    slug: 'how-to-stop-procrastinating-studying', cat: 'guide', eyebrow: 'Guide · Study science',
    crumb: 'Stop Procrastinating',
    title: 'How to Stop Procrastinating Studying | Brainfy',
    desc: 'Procrastination is emotion regulation, not laziness. Use the 2-minute rule and timeboxing with a Pomodoro timer to start when starting feels impossible.',
    keywords: 'how to stop procrastinating studying, study procrastination, stop procrastinating, 2 minute rule, timeboxing study',
    h1: 'How to Stop Procrastinating on Studying',
    lede: 'Procrastination is not a character flaw or simple laziness. Research increasingly frames it as <strong>emotion regulation</strong> — we put off tasks that make us feel anxious, bored, or overwhelmed. Once you see it that way, the fixes become obvious.',
    body: `
      <h2>It is about feelings, not time management</h2>
      <p>We tend to procrastinate on tasks that carry an uncomfortable feeling — fear of doing it badly, boredom, or not knowing where to start. Delaying gives instant relief, which trains the brain to delay again. So the goal is not to "try harder" but to <strong>lower the emotional cost of starting</strong>. Almost every effective tactic is a way to do that.</p>
      <h2>The two-minute rule</h2>
      <ul>
        <li><strong>Shrink the task until starting is trivial.</strong> Not "study chapter 7" but "open the notes and read one card." The hard part is starting, not continuing.</li>
        <li><strong>Make a tiny, specific first action.</strong> Concrete beats vague: "review five due flashcards" gives the brain nothing to dread.</li>
        <li><strong>Let momentum take over.</strong> Once you are two minutes in, the dread is usually gone and you keep going.</li>
      </ul>
      <h2>Timebox it with a timer</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Set a short, finite block</h3><p>Tell yourself "just 25 minutes." A bounded commitment is far easier to say yes to than open-ended study.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Start the timer and begin</h3><p>The clock turns a vague obligation into a concrete, ending task. You only owe it those minutes.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Take the break you earned</h3><p>Stop when it rings. Knowing a break is coming makes starting the next block easy.</p></div></div>
      </div>
      <p>Brainfy's <a href="/pomodoro-timer">Pomodoro timer</a> sits right next to your decks, so the first two minutes can be "clear today's due cards." Because the session is short and the cards are already made, there is almost nothing to dread — which is the whole point.</p>`,
    faq: [
      { q: 'Why do I procrastinate even on things I care about?', a: 'Because the task triggers an uncomfortable feeling — anxiety, boredom, or overwhelm — and delaying it brings relief. It is emotional, not a question of willpower.' },
      { q: 'What is the two-minute rule?', a: 'Shrink the task to something you could finish in two minutes, like reading one card. Starting is the hard part; once you begin, momentum usually carries you.' },
      { q: 'How does a timer help me start?', a: 'A timeboxed block turns open-ended study into a short, finite task. Committing to 25 minutes feels far safer than committing to "study," so you actually begin.' },
      { q: 'What if I still cannot start?', a: 'Make the first step even smaller and remove friction — open the app, look at one due card. Lower the bar until saying no feels silly.' },
      { q: 'Does beating myself up help?', a: 'No. Self-criticism increases the negative feeling that drives procrastination. Self-compassion and a tiny next step work better.' },
    ],
    related: ['pomodoro-timer', 'how-to-focus-while-studying', 'study-planner', 'how-to-study-with-adhd'],
  },
  {
    slug: 'how-to-study-with-adhd', cat: 'guide', eyebrow: 'Guide · Study science',
    crumb: 'Studying with ADHD',
    title: 'How to Study with ADHD: Practical Strategies | Brainfy',
    desc: 'Study strategies that work with an ADHD brain: short intervals, movement, multisensory recall, and external structure. Pair a Pomodoro timer with flashcards.',
    keywords: 'how to study with adhd, studying with adhd, adhd study tips, adhd focus, adhd study techniques',
    h1: 'How to Study with ADHD',
    lede: 'Standard study advice — sit still for hours, just focus — works against an ADHD brain. The better approach plays to how attention and motivation actually work: <strong>short intervals, movement, multisensory recall, and structure that lives outside your head</strong>.',
    body: `
      <h2>Work in short, finite intervals</h2>
      <p>An ADHD brain struggles to sustain effort on long, open-ended tasks but does well with short sprints that have a clear finish line. A 15 to 25 minute block with a visible timer turns "study indefinitely" into "do this until it rings" — a far easier ask. Frequent breaks are not a weakness here; they are how you keep the engine running.</p>
      <h2>Add movement and multiple senses</h2>
      <ul>
        <li><strong>Move while you learn.</strong> Pace, use a standing setup, or fidget. Light movement can help regulate attention rather than break it.</li>
        <li><strong>Recall out loud.</strong> Saying answers aloud and typing them adds channels beyond silent reading, which fades fast.</li>
        <li><strong>Make it active, not passive.</strong> Quizzing yourself with flashcards keeps the brain producing rather than drifting — re-reading is the easiest thing to zone out of.</li>
      </ul>
      <h2>Build structure outside your head</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Let the app decide what is due</h3><p>Working memory and prioritising are taxing. A scheduler that hands you exactly today's cards removes the "where do I start" paralysis.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Run a timer for every block</h3><p>An external clock supplies the time sense that ADHD makes unreliable, and a bounded block lowers the cost of starting.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Use streaks for momentum</h3><p>A visible streak gives the immediate, tangible reward an ADHD brain responds to — and a streak freeze means one off day does not undo your progress.</p></div></div>
      </div>
      <p>Brainfy fits this well by design: a <a href="/pomodoro-timer">Pomodoro timer</a> for short blocks, <a href="/ai-flashcards">AI flashcards</a> that you study by active recall instead of re-reading, a scheduler that decides what is due, and streaks for momentum — externalising the structure that is hardest to hold internally.</p>`,
    faq: [
      { q: 'How long should an ADHD study session be?', a: 'Short and finite. Many find 15 to 25 minute blocks with real breaks far more sustainable than long open-ended sessions.' },
      { q: 'Why do flashcards suit ADHD?', a: 'They keep you actively producing answers in short bursts rather than passively reading, which is easy to drift away from.' },
      { q: 'Is it okay to move while studying?', a: 'Yes — pacing, standing, or fidgeting can actually help regulate attention. Forcing total stillness often backfires.' },
      { q: 'How do I deal with forgetting what to study?', a: 'Externalise it. Let the app schedule and surface exactly what is due each day so you do not have to hold the plan in your head.' },
      { q: 'What if I break my streak?', a: 'A single off day is normal. A streak freeze protects your progress so one miss does not erase the momentum you have built.' },
    ],
    related: ['pomodoro-timer', 'how-to-focus-while-studying', 'how-to-stop-procrastinating-studying', 'active-recall'],
  },
  {
    slug: 'how-to-focus-while-studying', cat: 'guide', eyebrow: 'Guide · Study science',
    crumb: 'How to Focus',
    title: 'How to Focus While Studying | Brainfy',
    desc: 'Focus is a setup problem, not a willpower problem. Fix your environment, single-task, and use timeboxed focus blocks with a Pomodoro timer.',
    keywords: 'how to focus while studying, study focus, improve concentration studying, focus techniques, single tasking study',
    h1: 'How to Focus While Studying',
    lede: 'Most focus problems are not willpower problems — they are <strong>setup problems</strong>. Fix your environment, do one thing at a time, and bound your sessions, and concentration stops feeling like a fight you have to win every few minutes.',
    body: `
      <h2>Fix the environment first</h2>
      <p>Your attention follows the path of least resistance. If your phone is in reach, you will check it; the cost of resisting a notification all session is more draining than the check itself. Before you start, remove the cues: phone in another room or on do-not-disturb, distracting tabs closed, a single clear surface. You are not relying on willpower — you are removing the things that test it.</p>
      <h2>Single-task on purpose</h2>
      <ul>
        <li><strong>Multitasking is task-switching.</strong> Every switch carries a hidden re-focus cost, so doing two things at once means doing both worse and slower.</li>
        <li><strong>One subject, one mode.</strong> Decide the single thing this block is for — for example, clearing due flashcards — and let everything else wait.</li>
        <li><strong>Capture, do not chase.</strong> When a stray thought or to-do pops up, jot it down and return to the task instead of acting on it.</li>
      </ul>
      <h2>Bound your focus with blocks</h2>
      <div class="steps">
        <div class="step"><div class="step-n">1</div><div><h3>Pick one task for the block</h3><p>Define what done looks like before the timer starts, so you are not deciding mid-session.</p></div></div>
        <div class="step"><div class="step-n">2</div><div><h3>Run a 25-minute focus block</h3><p>A finite block is easier to sustain than open-ended study, and the ticking clock cues your brain that this is focus time.</p></div></div>
        <div class="step"><div class="step-n">3</div><div><h3>Break, then repeat</h3><p>Step away for a few minutes when it rings. Protecting the break protects the next block of focus.</p></div></div>
      </div>
      <p>The Pomodoro method packages all of this. Brainfy's <a href="/pomodoro-timer">Pomodoro timer</a> lives beside your decks, so a focus block can be one concrete thing — clear today's due cards — with the timer enforcing the boundary. For the full method, see our <a href="/pomodoro-technique">Pomodoro technique</a> guide.</p>`,
    faq: [
      { q: 'Why can I not focus even when I want to?', a: 'Usually the environment, not your will, is the problem. Reachable phones, open tabs, and open-ended sessions constantly tax attention. Remove the cues and focus gets much easier.' },
      { q: 'Does the phone really need to leave the room?', a: 'Yes if you can. Resisting a nearby phone all session is itself draining; out of sight removes the temptation entirely.' },
      { q: 'Is background music good or bad for focus?', a: 'It varies by person and task. Lyrics tend to compete with verbal material; instrumental or silence is safer for reading and recall.' },
      { q: 'How long can I realistically focus?', a: 'Most people sustain genuine focus for 20 to 40 minutes before needing a break. Timeboxed blocks work with that rhythm rather than against it.' },
      { q: 'What do I do when my mind wanders?', a: 'Note the stray thought on paper and gently return to the one task. Capturing it stops the loop without chasing the distraction.' },
    ],
    related: ['pomodoro-timer', 'pomodoro-technique', 'how-to-stop-procrastinating-studying', 'how-to-study-with-adhd'],
  },
];
