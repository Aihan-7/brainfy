// Seed official "Brainfy" starter decks into the production publicDecks collection.
//
// Why: /decks was empty (no community decks yet), so the page, the deck SSR
// pages, and /decks-sitemap.xml had no content. These hand-authored, accurate
// starter decks populate the library, create indexable /decks/<slug> pages, and
// give the in-app share loop something to spread.
//
// Schema matches publishDeck() in src/main.ts + parseDeckDoc() in
// functions/decks/_render.js. Deterministic slug doc IDs make this idempotent
// (re-running overwrites cleanly, never duplicates).
//
// Run:  npm i firebase-admin --no-save   &&   node scripts/seed-decks.mjs
// (firebase-admin is intentionally NOT a saved dependency — it's only needed for
//  this one-off admin task, never by the deployed app. Requires serviceAccountKey.json.)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const OWNER_UID = 'brainfy-official';
const OWNER_NAME = 'Brainfy';

// q = front (prompt), a = back (answer)
const c = (q, a) => ({ q, a });

const DECKS = [
  {
    id: 'starter-sat-vocabulary',
    name: 'SAT Vocabulary Essentials',
    color: '#7c3aed',
    desc: '20 high-frequency SAT vocabulary words with clear definitions — study them with spaced repetition.',
    cards: [
      c('Aberration', 'A deviation from what is normal or expected'),
      c('Benevolent', 'Kind, generous, and well-meaning'),
      c('Cacophony', 'A harsh, discordant mixture of sounds'),
      c('Capricious', 'Given to sudden, unpredictable changes in mood or behavior'),
      c('Deference', "Humble respect for and submission to another's wishes or opinion"),
      c('Ephemeral', 'Lasting for a very short time'),
      c('Garrulous', 'Excessively talkative, especially about trivial matters'),
      c('Hackneyed', 'Overused and therefore lacking originality; clichéd'),
      c('Iconoclast', 'A person who attacks cherished beliefs or institutions'),
      c('Loquacious', 'Very talkative'),
      c('Mitigate', 'To make less severe, serious, or painful'),
      c('Nefarious', 'Wicked or criminal'),
      c('Obsequious', 'Excessively eager to please or obey'),
      c('Pragmatic', 'Dealing with things sensibly and practically'),
      c('Quixotic', 'Extremely idealistic and unrealistic'),
      c('Reticent', 'Reluctant to share thoughts or feelings; reserved'),
      c('Spurious', 'False or fake; not genuine'),
      c('Taciturn', 'Reserved or uncommunicative in speech'),
      c('Ubiquitous', 'Present, appearing, or found everywhere'),
      c('Verbose', 'Using more words than needed; wordy'),
    ],
  },
  {
    id: 'starter-spanish-beginners',
    name: 'Spanish for Beginners',
    color: '#ef4444',
    desc: 'Common Spanish words and phrases for beginners — English on the front, Spanish on the back.',
    cards: [
      c('Hello', 'Hola'),
      c('Goodbye', 'Adiós'),
      c('Please', 'Por favor'),
      c('Thank you', 'Gracias'),
      c('Yes / No', 'Sí / No'),
      c('Good morning', 'Buenos días'),
      c('Good night', 'Buenas noches'),
      c('How are you?', '¿Cómo estás?'),
      c('My name is…', 'Me llamo…'),
      c('Excuse me / Sorry', 'Perdón / Lo siento'),
      c('Water', 'Agua'),
      c('Food', 'Comida'),
      c('Friend', 'Amigo / Amiga'),
      c('Where is…?', '¿Dónde está…?'),
      c('How much is it?', '¿Cuánto cuesta?'),
      c("I don't understand", 'No entiendo'),
      c('Do you speak English?', '¿Hablas inglés?'),
      c('One, two, three', 'Uno, dos, tres'),
      c('Today / Tomorrow', 'Hoy / Mañana'),
      c('See you later', 'Hasta luego'),
    ],
  },
  {
    id: 'starter-french-beginners',
    name: 'French for Beginners',
    color: '#3b82f6',
    desc: 'Essential French words and phrases for beginners — English on the front, French on the back.',
    cards: [
      c('Hello', 'Bonjour'),
      c('Goodbye', 'Au revoir'),
      c('Please', "S'il vous plaît"),
      c('Thank you', 'Merci'),
      c('Yes / No', 'Oui / Non'),
      c('Good evening', 'Bonsoir'),
      c('How are you?', 'Comment ça va ?'),
      c('My name is…', "Je m'appelle…"),
      c('Excuse me', 'Excusez-moi'),
      c('Sorry', 'Désolé'),
      c('Water', 'Eau'),
      c('Food', 'Nourriture'),
      c('Friend', 'Ami / Amie'),
      c('Where is…?', 'Où est… ?'),
      c('How much is it?', 'Combien ça coûte ?'),
      c("I don't understand", 'Je ne comprends pas'),
      c('Do you speak English?', 'Parlez-vous anglais ?'),
      c('One, two, three', 'Un, deux, trois'),
      c('Today / Tomorrow', "Aujourd'hui / Demain"),
      c('See you soon', 'À bientôt'),
    ],
  },
  {
    id: 'starter-cell-biology',
    name: 'Cell Biology Basics',
    color: '#22c55e',
    desc: 'Core cell biology — organelles and key processes. Great for biology and AP Bio review.',
    cards: [
      c('Nucleus', "Stores the cell's DNA and controls gene expression"),
      c('Mitochondrion', 'Produces ATP through cellular respiration (the "powerhouse")'),
      c('Ribosome', 'Site of protein synthesis'),
      c('Rough endoplasmic reticulum', 'Synthesizes and folds proteins (studded with ribosomes)'),
      c('Smooth endoplasmic reticulum', 'Synthesizes lipids and detoxifies chemicals'),
      c('Golgi apparatus', 'Modifies, packages, and ships proteins and lipids'),
      c('Lysosome', 'Contains enzymes that break down waste and cellular debris'),
      c('Chloroplast', 'Conducts photosynthesis in plant cells'),
      c('Cell membrane', 'Selectively controls what enters and leaves the cell'),
      c('Cell wall', 'Rigid outer layer in plants, fungi, and bacteria for support'),
      c('Cytoplasm', 'Gel-like fluid where organelles are suspended'),
      c('Vacuole', 'Stores water, nutrients, and waste (large in plant cells)'),
      c('Cytoskeleton', 'Network of fibers that gives the cell shape and support'),
      c('Prokaryote vs. eukaryote', 'Prokaryotes lack a membrane-bound nucleus; eukaryotes have one'),
      c('ATP', "The cell's main energy-carrying molecule"),
      c('Photosynthesis', 'Converts light energy, CO₂, and water into glucose and oxygen'),
    ],
  },
  {
    id: 'starter-anatomy-systems',
    name: 'Human Anatomy: Body Systems',
    color: '#f59e0b',
    desc: 'The major human body systems and what they do — foundational anatomy & physiology.',
    cards: [
      c('Skeletal system', 'Provides structure, protects organs, and produces blood cells'),
      c('Muscular system', 'Enables movement and generates body heat'),
      c('Cardiovascular system', 'Pumps blood to transport oxygen, nutrients, and wastes'),
      c('Respiratory system', 'Exchanges oxygen and carbon dioxide (lungs)'),
      c('Digestive system', 'Breaks down food and absorbs nutrients'),
      c('Nervous system', 'Processes information and coordinates body responses'),
      c('Endocrine system', 'Releases hormones that regulate body functions'),
      c('Immune / lymphatic system', 'Defends the body against pathogens'),
      c('Urinary system', 'Filters blood and removes waste as urine'),
      c('Integumentary system', 'Skin, hair, and nails; protects and regulates temperature'),
      c('Reproductive system', 'Produces offspring'),
      c('Largest organ of the body', 'The skin'),
      c('Number of bones in an adult human', '206'),
      c('Function of red blood cells', 'Carry oxygen using hemoglobin'),
      c('Function of white blood cells', 'Fight infection as part of the immune system'),
      c('How many chambers does the heart have?', 'Four — two atria and two ventricles'),
    ],
  },
  {
    id: 'starter-psychology-101',
    name: 'Psychology 101',
    color: '#a855f7',
    desc: 'Key psychology terms and thinkers — perfect for intro psych and AP Psychology.',
    cards: [
      c('Classical conditioning', 'Learning by associating two stimuli (Pavlov)'),
      c('Operant conditioning', 'Learning through rewards and punishments (Skinner)'),
      c('Classical vs. operant conditioning', 'Classical = involuntary associations; operant = voluntary behavior shaped by consequences'),
      c('Cognitive dissonance', 'Mental discomfort from holding conflicting beliefs'),
      c('Confirmation bias', 'Favoring information that confirms existing beliefs'),
      c("Maslow's hierarchy of needs", 'A pyramid from basic physiological needs up to self-actualization'),
      c('Sigmund Freud', 'Founder of psychoanalysis; proposed the id, ego, and superego'),
      c('B.F. Skinner', 'Pioneered operant conditioning and behaviorism'),
      c('Jean Piaget', 'Developed the theory of cognitive development in children'),
      c('Neuroplasticity', "The brain's ability to reorganize and form new connections"),
      c('Neuron', 'A nerve cell that transmits electrical and chemical signals'),
      c('Neurotransmitter', 'A chemical messenger between neurons (e.g., dopamine, serotonin)'),
      c('Nature vs. nurture', 'The debate over genetics vs. environment in shaping behavior'),
      c('Reinforcement vs. punishment', 'Reinforcement increases a behavior; punishment decreases it'),
      c('Placebo effect', 'Improvement from an inactive treatment due to expectation'),
      c('Amygdala', 'Brain region for processing emotions, especially fear'),
      c('Hippocampus', 'Brain region critical for forming new long-term memories'),
      c('Short-term vs. long-term memory', 'Short-term holds information briefly; long-term stores it durably'),
    ],
  },
  {
    id: 'starter-us-history',
    name: 'U.S. History Milestones',
    color: '#dc2626',
    desc: 'Major events in United States history with their dates and significance.',
    cards: [
      c('Boston Tea Party', '1773'),
      c('Declaration of Independence signed', '1776'),
      c('U.S. Constitution ratified', '1788 (government began in 1789)'),
      c('Louisiana Purchase', '1803'),
      c('American Civil War', '1861–1865'),
      c('Emancipation Proclamation', '1863'),
      c('13th Amendment (abolished slavery)', '1865'),
      c('19th Amendment (women’s suffrage)', '1920'),
      c('Great Depression begins (stock market crash)', '1929'),
      c('U.S. enters World War II (Pearl Harbor)', '1941'),
      c('"I Have a Dream" speech (MLK Jr.)', '1963'),
      c('Civil Rights Act', '1964'),
      c('First Moon landing', '1969'),
      c('Berlin Wall falls', '1989'),
      c('Primary author of the Declaration of Independence', 'Thomas Jefferson'),
      c('First U.S. President', 'George Washington'),
      c('The Bill of Rights', 'The first 10 amendments to the Constitution'),
      c('Number of original colonies', '13'),
    ],
  },
  {
    id: 'starter-organic-functional-groups',
    name: 'Organic Chemistry: Functional Groups',
    color: '#14b8a6',
    desc: 'Recognize the key functional groups in organic chemistry by structure and name.',
    cards: [
      c('Hydroxyl group (–OH)', 'Alcohol'),
      c('Carbonyl within a carbon chain (C=O)', 'Ketone'),
      c('Carbonyl at the end of a chain (–CHO)', 'Aldehyde'),
      c('Carboxyl group (–COOH)', 'Carboxylic acid'),
      c('Amino group (–NH₂)', 'Amine'),
      c('–COO– linkage', 'Ester'),
      c('R–O–R linkage', 'Ether'),
      c('–CONH₂ group', 'Amide'),
      c('R–X (X = F, Cl, Br, I)', 'Alkyl halide (haloalkane)'),
      c('Benzene-based ring (C₆H₅–)', 'Aromatic / phenyl group'),
      c('Alkane', 'Hydrocarbon with only single C–C bonds (saturated)'),
      c('Alkene', 'Contains a carbon–carbon double bond (C=C)'),
      c('Alkyne', 'Contains a carbon–carbon triple bond (C≡C)'),
      c('Saturated vs. unsaturated', 'Saturated = only single bonds; unsaturated = has double or triple bonds'),
      c('Isomers', 'Molecules with the same molecular formula but different structures'),
    ],
  },
  {
    id: 'starter-world-capitals',
    name: 'World Capitals',
    color: '#0ea5e9',
    desc: 'Capital cities of countries around the world — a classic geography deck.',
    cards: [
      c('France', 'Paris'),
      c('Japan', 'Tokyo'),
      c('Australia', 'Canberra (not Sydney)'),
      c('Canada', 'Ottawa'),
      c('Brazil', 'Brasília'),
      c('Egypt', 'Cairo'),
      c('Russia', 'Moscow'),
      c('South Korea', 'Seoul'),
      c('Germany', 'Berlin'),
      c('Italy', 'Rome'),
      c('Spain', 'Madrid'),
      c('India', 'New Delhi'),
      c('China', 'Beijing'),
      c('Mexico', 'Mexico City'),
      c('Argentina', 'Buenos Aires'),
      c('South Africa', 'Pretoria (administrative capital)'),
      c('Turkey', 'Ankara (not Istanbul)'),
      c('Greece', 'Athens'),
      c('Norway', 'Oslo'),
      c('Kenya', 'Nairobi'),
    ],
  },
  {
    id: 'starter-pharmacology-suffixes',
    name: 'Pharmacology: Drug Class Suffixes',
    color: '#e11d48',
    desc: 'Common drug-name suffixes and the classes they signal — high-yield for nursing & NCLEX.',
    cards: [
      c('-pril (e.g., lisinopril)', 'ACE inhibitor (lowers blood pressure)'),
      c('-sartan (e.g., losartan)', 'Angiotensin II receptor blocker (ARB)'),
      c('-olol (e.g., metoprolol)', 'Beta blocker'),
      c('-dipine (e.g., amlodipine)', 'Calcium channel blocker (dihydropyridine)'),
      c('-statin (e.g., atorvastatin)', 'HMG-CoA reductase inhibitor (lowers cholesterol)'),
      c('-prazole (e.g., omeprazole)', 'Proton pump inhibitor (PPI)'),
      c('-tidine (e.g., famotidine)', 'H₂ receptor antagonist'),
      c('-cillin (e.g., amoxicillin)', 'Penicillin-class antibiotic'),
      c('-floxacin (e.g., ciprofloxacin)', 'Fluoroquinolone antibiotic'),
      c('-azepam / -azolam (e.g., diazepam)', 'Benzodiazepine'),
      c('-vir (e.g., acyclovir)', 'Antiviral'),
      c('-afil (e.g., sildenafil)', 'PDE5 inhibitor'),
      c('-triptan (e.g., sumatriptan)', 'Migraine treatment (5-HT receptor agonist)'),
      c('-mab (e.g., adalimumab)', 'Monoclonal antibody'),
      c('-ase (e.g., alteplase)', 'Enzyme (often a thrombolytic / "clot buster")'),
    ],
  },
];

async function main() {
  const now = new Date().toISOString();
  const batch = db.batch();
  for (const d of DECKS) {
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(d.id)) throw new Error(`Bad doc id: ${d.id}`);
    if (d.cards.length < 4) throw new Error(`Deck too thin: ${d.id}`);
    const ref = db.collection('publicDecks').doc(d.id);
    batch.set(ref, {
      ownerUid: OWNER_UID,
      ownerName: OWNER_NAME,
      official: true,
      name: d.name.slice(0, 120),
      desc: d.desc.slice(0, 300),
      color: /^#[0-9a-fA-F]{6}$/.test(d.color) ? d.color : '#7c3aed',
      cards: d.cards.map(x => ({ q: String(x.q).slice(0, 2000), a: String(x.a).slice(0, 2000) })),
      cardCount: d.cards.length,
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  const total = DECKS.reduce((n, d) => n + d.cards.length, 0);
  console.log(`✓ Seeded ${DECKS.length} decks (${total} cards) to publicDecks:`);
  for (const d of DECKS) console.log(`  /decks/${d.id}  —  ${d.name} (${d.cards.length})`);
  process.exit(0);
}

main().catch(err => { console.error('Seed failed:', err); process.exit(1); });
