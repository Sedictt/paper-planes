import type { TimeOfDay } from '../types';

export type InteractivePropId = 'frog' | 'campfire' | 'shrine' | 'waterfall' | 'cottage';
export type InteriorPropId = 'inkstone' | 'drafts' | 'mug' | 'window' | 'door';
export type LorePropId = InteractivePropId | InteriorPropId;

export const LORE_CODEX_STORAGE_KEY = 'paperplanes:lore_codex_unlocked';

export const FROG_AMBIENT_LINES = [
  'ribbit~',
  'nice breeze today!',
  'my duck floatie is ready.',
  'i like my pink bow!',
  'the shrine is so cozy...',
  'did a wish fly by?',
  '*happy frog noises*',
  '10/10 pond vibes.',
  'croak!',
  'catching clouds today~',
  'stay hydrated!',
  'i am legally classified as a buoy.',
  'my duck floatie has better posture than you.',
  'do not ask what happened to the first duck.',
  'i pay zero taxes and still feel overcharged.',
  'someone folded a plane shaped like a brick earlier. it sank.',
  'my pink bow costs more than your mortgage.',
  'if i kick really hard i can spin in place for forty minutes.',
  'i tried to eat a paper plane once. tasted like regret and stationery.',
  'everybody asks "what is the frog doing" and never "is the frog unionized".',
  'i have been sitting in this exact puddle since before your parents met.',
  'bold of you to poke a creature with this much upper-body buoyancy.',
  'splish splash. that was my entire schedule for today.',
  'i lost my keys in 1998 and just decided i live in the pond now.',
  'if another wish hits me in the eye i am filing a complaint with the sky.',
  'jeff. four letters. one syllable. i wear a silk bow and you named me after a guy who owns a lawnmower.',
  "everyone else on this island gets to be 'the shrine' or 'the astral inkstone' and i am jeff.",
  'if you wanted to call me jeff you could have at least given me a middle name or a clipboard.',
  "do not look at me and say 'hey jeff' while i am in a duck floatie. have some respect for the duck.",
  'i survived the garden lifting into the sky and my reward is being named jeff.',
  "you can call me jeff all day. i still won't pay rent.",
  'my lawyer advised me not to comment on the missing lily pad.',
  'i have three brain cells and all of them are currently floating.',
  'please stop poking me, i am in the middle of a very important nap.',
  'the duck and i share one single thought and it is snacks.',
  'if i had hands i would fold a tiny hat. instead i have roundness.',
  'i tried swimming laps once. hit the bridge in two seconds. cardio complete.',
  'yes, the bow is structural. if you untie it i deflate.',
  'i once stared down a pigeon for six hours. we are now legally married.',
  'gravity is optional up here and frankly i am taking full advantage.',
  'do not ask how i got up here. i was promised flies.',
  'if a paper plane lands in my pond, by maritime law it belongs to the duck.',
  'my hobbies include floating, blinking one eye at a time, and judging your aim.',
  'i am not stuck in this floatie. this is a tactical lifestyle choice.',
];

export const FROG_LORE_LINES = [
  "the bow isn't mine. the Keeper tied it behind my head so it wouldn't get ruined.",
  'the Keeper put me in this floatie the night the garden dirt started lifting.',
  'his shadow got shorter every autumn, even at noon.',
  'he used to wash dark blue dust off his hands in this pond.',
  'when he stopped casting a shadow, the water stopped making ripples.',
  'i remember when two people used to sit by this pond, before the cottage went quiet.',
  'he told me not to follow him to the lantern. then he never walked back.',
  'i hated the name at first. now it just sounds like someone is still around to say it.',
  "he used to try out silly names on me just to see if i'd blink. i never did. it made him laugh anyway.",
  "he never settled on a name for me. he was too busy folding paper. so i'll keep yours for a while.",
  'jeff is fine, i guess. better than sitting in this pond with nobody calling me anything at all.',
  'even a frog named jeff can keep a promise until he walks back down the path.',
];

export function isTwilightOrNight(timeOfDay: TimeOfDay): boolean {
  return timeOfDay === 'dusk' || timeOfDay === 'evening' || timeOfDay === 'midnight';
}

function pickFromWeightedPools(
  humorous: string[],
  lore: string[],
  timeOfDay: TimeOfDay,
  prevText?: string | null,
  seenLines?: Set<string>
): string {
  // Humorous lines pop much more often; lore hints stay rare (~10% day, ~20% twilight/night)
  const humorWeight = isTwilightOrNight(timeOfDay) ? 0.8 : 0.9;
  const chosenPool = Math.random() < humorWeight ? humorous : lore;

  let candidates = seenLines
    ? chosenPool.filter((l) => !seenLines.has(l))
    : chosenPool;

  // Once every line in this pool has been said, reset its seen history
  if (candidates.length === 0) {
    if (seenLines) {
      for (const l of chosenPool) seenLines.delete(l);
    }
    candidates = prevText ? chosenPool.filter((l) => l !== prevText) : chosenPool;
    if (candidates.length === 0) candidates = chosenPool;
  } else if (prevText && candidates.length > 1) {
    candidates = candidates.filter((l) => l !== prevText);
  }

  const picked = candidates[Math.floor(Math.random() * candidates.length)] ?? chosenPool[0];
  seenLines?.add(picked);
  return picked;
}

export function pickFrogLine(
  timeOfDay: TimeOfDay,
  prevLine: string | null,
  seenLines?: Set<string>
): string {
  return pickFromWeightedPools(FROG_AMBIENT_LINES, FROG_LORE_LINES, timeOfDay, prevLine, seenLines);
}

export interface PropBubbleContent {
  title: string;
  text: string;
  actionLabel?: string;
  actionKind?: 'enter-cottage' | 'exit-cottage';
}

export interface PropHintPool {
  title: string;
  humorous: string[];
  lore: string[];
  actionLabel?: string;
  actionKind?: 'enter-cottage' | 'exit-cottage';
}

export const OUTDOOR_PROP_HINTS: Record<Exclude<InteractivePropId, 'frog'>, PropHintPool> = {
  campfire: {
    title: 'Campfire Terrace',
    humorous: [
      'Zero marshmallows in stock. Please direct complaints to management.',
      'Someone tried to roast a chestnut here in 2004. It achieved orbit.',
      'This fire has been burning for decades without a single permit.',
      'Great place to stare dramatically while forgetting what you walked over for.',
      'Do not throw your tax forms in here. The wind will mail them back.',
      'A raccoon tried to warm its hands here once, realized we were at 12,000 feet, and left.',
      'Smells like cedar, toasted paper, and mild poor decisions.',
      'If you poke the logs too hard, a frog from two islands over glares at you.',
      'The smoke alarm was disconnected by mutual agreement.',
      'Warm enough for tea, too small for a dramatic villain monologue.',
      'Somebody left half a s\'more on a rock and the ants formed a union over it.',
      'Certified 100% wood-fired. Zero calories.',
    ],
    lore: [
      'Half-charred corners of parchment still sit under the gray ash.',
      'He held a match to a hundred pages here, then folded one instead.',
      'Even in heavy rain, the coals stay warm enough to lift paper.',
      'The first plane he threw from this ring fell straight into the dark.',
      'When his hands grew too cold to hold a pen, he stood beside these stones.',
      'A name was scratched out in the soot before the wind could read it.',
      'The updraft above this terrace never goes out, even when the logs are black.',
      'He burned nothing here that he was brave enough to say out loud.',
    ],
  },
  shrine: {
    title: 'Lantern Shrine',
    humorous: [
      'Great mood lighting. Zero cell reception.',
      'Please stop tossing loose change into the lantern. It jams the updraft.',
      'Built without a level, a blueprint, or a building inspector.',
      'The frog underneath insists he is the head priest. Do not argue with him.',
      'Four lanterns and not one outlet to charge a phone.',
      'If you listen closely, you can hear a moth trying to file a noise complaint.',
      'Rated five stars by passing pigeons, two stars by confused mail carriers.',
      'No, the red bridge does not lead to a gift shop.',
      'Do not tap the glass. The wishes inside are easily startled.',
      'Maintenance has not changed a bulb here since the Bronze Age.',
      'Strictly for dramatic twilight contemplation. No skateboarding.',
      'Somebody left an overdue library notice inside. Even the wind refused to carry it.',
    ],
    lore: [
      'One folded page inside the lantern has no name on the outside.',
      'Stray folded letters drift up from the valley and circle these eaves.',
      'Dark mineral dust clings to the inner glass where his fingers rested.',
      'After dusk, the air around the pillars hums like a plucked string.',
      'He set his pen down on the step here and did not pick it back up.',
      'The beacon was meant to guide planes home, though none of his could land.',
      'If the flame inside ever goes out, everything anchored to this air will drop.',
      'Someone stood on this deck until their shadow thinned to nothing.',
    ],
  },
  waterfall: {
    title: 'Waterfall Stream',
    humorous: [
      'Free infinite water glitch. Do not tell the utility company.',
      'No guardrail, no lifeguard, just a 10,000-foot drop and optimism.',
      'The fish tried to swim upstream once and ended up in a cumulus cloud.',
      'Splash zone extends roughly to the nearest neighboring country.',
      'If you drop your keys here, they become someone else\'s rainstorm.',
      'Local frogs give the water slide four stars for speed, one star for landing.',
      'Turns out "follow the river to the sea" is terrible advice up here.',
      'A tiny salmon has been arguing with the current since Tuesday.',
      'Do not drink directly from the edge unless you enjoy tasting altitude.',
      'Nobody knows where the plumbing goes, and at this point we are afraid to ask.',
      'Great white noise for sleeping, terrible for remembering where you parked.',
      'Every bucket you scoop out just falls back on your head twenty minutes later.',
    ],
    lore: [
      'The same water falls into the clouds and returns as rain an hour later.',
      'Before the ground broke loose, this creek ran past an orchard in the valley.',
      'Blue streaks of dissolved ink still thread through the foam at dawn.',
      'Its roots drank from the stone buried under the garden until the stone cracked.',
      'Nothing leaves this island for good. Even the rain comes back.',
      'Look past the edge and you can almost see the empty scar on the cliff below.',
      'The stream never freezes solid, even when snow covers the pines.',
      'He used to sit by the bank and watch reflections that stopped appearing.',
    ],
  },
  cottage: {
    title: 'Cottage',
    humorous: [
      'Rent is zero dollars. The commute is a parachute.',
      'No HOA, no neighbors, and the roofers refuse to quote the job.',
      'Built at a steep angle so snow slides off directly onto unsuspecting frogs.',
      'Includes one desk, one fireplace, and four thousand unfinished drafts.',
      'The realtor described it as "airy" and "well-ventilated" before quitting.',
      'Zero delivery drivers have successfully found the front porch.',
      'Somehow passes every fire inspection because the inspector cannot reach it.',
      'Front door has been unlocked since 1974. Still nobody visits unannounced.',
      'Warning: steep roof. Do not attempt to retrieve frisbees.',
      'Has better insulation than most city apartments and twice the altitude.',
      'Mail carrier left a slip saying "unable to access porch, sky too high."',
      'Cozy, quiet, and technically counts as an unregistered aircraft.',
    ],
    lore: [
      'The latch was left unhooked, as if he only stepped out for a minute.',
      'A mug on the desk inside has not gone cold yet.',
      'Black ink soaked into the floorboards long before the house left the ground.',
      'Stacks of blank cream paper sit beside the hearth, waiting for a name.',
      'When the wind rises outside, the rafters creak like an old boat.',
      'He spent more winters at that window than he ever spent in town.',
      'Every floorboard near the desk carries a faint, cold blue stain.',
      'Nobody has swept the porch since the night the island stopped rising.',
    ],
    actionLabel: 'Step Inside',
    actionKind: 'enter-cottage',
  },
};

export function getOutdoorPropContent(
  propId: Exclude<InteractivePropId, 'frog'>,
  timeOfDay: TimeOfDay = 'morning',
  prevText?: string | null,
  seenLines?: Set<string>
): PropBubbleContent {
  const pool = OUTDOOR_PROP_HINTS[propId];
  return {
    title: pool.title,
    text: pickFromWeightedPools(pool.humorous, pool.lore, timeOfDay, prevText, seenLines),
    actionLabel: pool.actionLabel,
    actionKind: pool.actionKind,
  };
}

export const DRAFT_LINES = [
  '"If I fold the page small enough, maybe it won\'t feel so heavy when you read it"',
  '"I walked down to the cliff edge twice today. Both times the wind"',
  '"You left your pink ribbon by the pond. I didn\'t dare return it"',
  '"Dear [crossed out]"',
  '"You were standing by the gate with your coat over one arm, and I"',
  '"If this lands in your yard, pretend I was brave enough to knock."',
  '"Page 412. Still haven\'t written the first sentence right."',
  '"Do not read this unless the weather is good."',
];

const INTERIOR_PROP_POOLS: Record<InteriorPropId, PropHintPool> = {
  inkstone: {
    title: 'Cracked Astral Inkstone',
    humorous: [
      'Looks expensive. Definitely not covered by the manufacturer warranty.',
      'One star on Yelp: "levitated my entire house, ruined my commute."',
      'Do not put this in the dishwasher.',
      'Tried using it to sign a birthday card. The card is currently orbiting Jupiter.',
      'Feels like a bowling ball made of frozen thunder and bad habits.',
      'Every pen in the house refuses to work unless you compliment this rock first.',
      'Side effects include floating cottages, sleepless nights, and chronic ink stains.',
      'If you lick it, your voice echoes in three time zones. Do not lick it.',
      'Still has more battery life than a wireless mouse.',
      'Heavy enough to be a doorstop, dramatic enough to ruin a quiet life.',
      'Somebody tried to superglue it back together. The glue floated away.',
      'Not FDA approved for casual journaling.',
    ],
    lore: [
      '"The ink only borrows the wind. When the stone runs dry, only the scribe\'s last breath can keep the current alive."',
      'Meteoric glass split down the middle. A faint blue light still sits in the seam.',
      'The grinding hollow is worn smooth from thousands of unaddressed nights.',
      'Every time he ground fresh ink here, the room felt a little colder.',
      'The Sky-Couriers forged it for one addressed letter at a time, never thousands.',
      'Tiny fractures spread outward from the center like frost on a pane.',
      'His dry pen rests beside the crack, still pointed toward the door.',
      'When the stone finally split, the updraft outside began to falter.',
    ],
  },
  drafts: {
    title: 'Scattered Folded Drafts',
    humorous: [
      '"Grocery list: milk, bread, 400 sheets of origami paper."',
      '"Note to self: stop naming the clouds after people."',
      '"Step 1: fold corner. Step 2: fold other corner. Step 3: accidentally invent aviation."',
      '"Dear Landlord, regarding the altitude of the property..."',
      '"Attempt #89 at folding a swan. Looks like an angry triangle."',
      '"Reminder: frog prefers the yellow duck, do NOT swap for the flamingo."',
      '"Drafting apology to the pigeon I startled on Tuesday."',
      '"If found, please return to the guy who lost an entire cliff."',
      '"To-do: buy stamps. Wait. Never mind."',
      '"Note: campfire is NOT a toaster."',
      '"Tried writing with a ballpoint pen. Completely refused to fly. Unacceptable."',
      '"I swear I put my glasses on this desk five minutes ago."',
    ],
    lore: DRAFT_LINES,
  },
  mug: {
    title: 'Warm Ceramic Mug',
    humorous: [
      'Warning: may contain 40% cedar tea and 60% questionable sleep schedule.',
      'Has been "just cooling down for a minute" since 1986.',
      'There is a ring of dried tea on this desk older than some nations.',
      'Still hotter than any coffee you buy at an airport.',
      'Needs a coaster. Nobody in this house has ever owned a coaster.',
      'The spoon inside is standing straight up on its own. Probably fine.',
      'Half-empty, half-full, 100% neglected.',
      'If you finish it, you immediately gain the urge to stare thoughtfully out a window.',
      'Zero dishwashers within a twelve-mile vertical radius.',
      'Tastes faintly of pine needles and unfinished sentences.',
      'This mug has survived three earthquakes and a literal tectonic separation.',
      'Do not touch it unless you plan on writing until your wrist cramps.',
    ],
    lore: [
      'Still warm. Cedar tea, untouched since the wind picked up.',
      'Thin steam rises toward the rafters, even with no kettle on the stove.',
      'He always poured a cup before sitting down to fold another plane.',
      'A faint smudge of blue ink sits on the rim where his thumb rested.',
      'The cup never cools completely while the breeze keeps moving outside.',
      'He left it half-full the night he walked out to the lantern.',
      'Its warmth is one of the few things in this room that refused to fade.',
      'Even the dust on the table avoids the circle around the cup.',
    ],
  },
  window: {
    title: 'Cottage Window',
    humorous: [
      'Great view. Zero traffic.',
      'If a bird taps on this glass, it is probably lost.',
      'Window washer quit after looking straight down.',
      'Nice place to sigh dramatically while holding a warm mug.',
      'Diamond-shaped purely to make buying curtains impossible.',
      'Outside: endless sky. Inside: a guy who really needed a hobby besides origami.',
      'At least you never have to worry about the neighbor\'s tree blocking the light.',
      'Sometimes a stray paper plane bonks right into the glass and slides down.',
      'Double-paned against rain, snow, and unsolicited advice.',
      'You can see three weather systems from here and still forget an umbrella.',
      'The glass is cleaner than it has any right to be.',
      'Notice: clouds may appear closer than they are.',
    ],
    lore: [
      'Through the glass, unaddressed planes circle slowly above the clouds.',
      'From this desk, he watched seasons pass without ever going downstairs.',
      'A steady draft hums against the diamond pane.',
      'Far below the cloud sea, an empty cliff scar marks where this house used to sit.',
      'On clear nights, he used to look down for a porch light in the valley.',
      'Every plane he launched from the yard eventually drifted past this glass.',
      'Mist gathers on the outside corner whenever the waterfall kicks up.',
      'He tapped on this pane once to wave at the frog, then went back to writing.',
    ],
  },
  door: {
    title: 'Cottage Door',
    humorous: [
      'Mind the step. And the clouds.',
      'Doormat says "Welcome" even though nobody has climbed up here in forty years.',
      'Do not slam it or the whole island wobbles.',
      'A pair of boots sits neatly by the mat, completely unused since the lift-off.',
      'No peephole needed when your nearest neighbor is a seagull.',
      'Lock is mostly decorative at 12,000 feet.',
      'Warning: opening this door may expose you to frogs.',
      'Draft stopper has been fighting for its life since 1991.',
      'Please wipe your feet before tracking cloud moisture onto the rug.',
      'Guaranteed zero door-to-door salespeople.',
      'Creaks just enough to sound haunted, not enough to warrant oil.',
      'Exit to: grass, sky, and one very judgmental amphibian.',
    ],
    lore: [
      'The latch is unhooked. The breeze waits right outside.',
      'Past the threshold, the campfire and shrine sit under the open sky.',
      'He left the door unlocked on his way to the lantern, as if someone might still arrive.',
      'A coat still hangs beside the frame, smelling faintly of rain and cedar.',
      'His footprints stopped on the doormat the night he stopped needing boots.',
      'When the wind changes direction, the latch rattles softly on its own.',
      'The wood threshold is worn down only on the side facing the shrine.',
      'Step outside and the same breeze that keeps the planes up meets your face.',
    ],
    actionLabel: 'Step Outside',
    actionKind: 'exit-cottage',
  },
};

export function getInteriorPropContent(
  propId: InteriorPropId,
  timeOfDay: TimeOfDay = 'morning',
  prevText?: string | null,
  seenLines?: Set<string>
): PropBubbleContent {
  const pool = INTERIOR_PROP_POOLS[propId];
  return {
    title: pool.title,
    text: pickFromWeightedPools(pool.humorous, pool.lore, timeOfDay, prevText, seenLines),
    actionLabel: pool.actionLabel,
    actionKind: pool.actionKind,
  };
}

export interface LoreSequenceResult {
  nextStep: number;
  matched: boolean;
  unlocked: boolean;
}

/**
 * 4-step chronological Easter egg:
 * 1. Frog Pot & Garden ('frog')
 * 2. Campfire Terrace ('campfire')
 * 3. A-Frame Cottage ('cottage' or 'inkstone' inside)
 * 4. Lantern Shrine ('shrine' during dusk, evening, or midnight)
 */
export function advanceLoreSequence(
  currentStep: number,
  propId: LorePropId,
  timeOfDay: TimeOfDay
): LoreSequenceResult {
  if (currentStep === 0 && propId === 'frog') {
    return { nextStep: 1, matched: true, unlocked: false };
  }
  if (currentStep === 1 && propId === 'campfire') {
    return { nextStep: 2, matched: true, unlocked: false };
  }
  if (currentStep === 2 && (propId === 'cottage' || propId === 'inkstone')) {
    return { nextStep: 3, matched: true, unlocked: false };
  }
  if (currentStep === 3 && propId === 'shrine' && isTwilightOrNight(timeOfDay)) {
    return { nextStep: 4, matched: true, unlocked: true };
  }

  // Clicking out of order silently resets progress (or restarts at 1 if frog was clicked)
  if (propId === 'frog') {
    return { nextStep: 1, matched: false, unlocked: false };
  }
  return { nextStep: 0, matched: false, unlocked: false };
}

export interface CodexDialogueLine {
  speaker: 'you' | 'frog' | 'narration';
  text: string;
}

export interface CutsceneChoice {
  label: string;
  nextId: string;
}

export interface CutsceneNode {
  id: string;
  speaker: 'frog' | 'you' | 'narration';
  text: string;
  frogReact?: boolean;
  nextId?: string;
  choices?: CutsceneChoice[];
  isEnd?: boolean;
}

export const FROG_CUTSCENE_NODES: Record<string, CutsceneNode> = {
  start: {
    id: 'start',
    speaker: 'narration',
    text: 'The lantern above the pond hums softly. Below it, the frog paddles half an inch to the left in its yellow duck floatie and squints up at you.',
    nextId: 'greet',
  },
  greet: {
    id: 'greet',
    speaker: 'frog',
    text: '"Oh. You actually found it."',
    frogReact: true,
    choices: [
      { label: '"Wait... you can talk?!"', nextId: 'can_talk' },
      { label: '"What is that letter inside the shrine?"', nextId: 'about_letter' },
    ],
  },
  can_talk: {
    id: 'can_talk',
    speaker: 'frog',
    text: '"I\'ve been talking the whole time. You people just hear \'ribbit\' and walk away."',
    frogReact: true,
    nextId: 'about_letter',
  },
  about_letter: {
    id: 'about_letter',
    speaker: 'frog',
    text: '"Nobody cleans up around here anymore. Mostly because I have webbed feet, and the Writer who lived in that cottage turned into the wind."',
    frogReact: true,
    choices: [
      { label: '"Turned into the wind?"', nextId: 'weather_explain' },
      { label: '"Tell me from the beginning."', nextId: 'weather_explain' },
    ],
  },
  weather_explain: {
    id: 'weather_explain',
    speaker: 'frog',
    text: '"Long time ago, this place was an ordinary cliffside homestead above a valley. The Writer lived in that cottage alone, writing letters every night about himself, the people below, and one woman he loved more than he knew how to say out loud."',
    nextId: 'campfire_beat',
  },
  campfire_beat: {
    id: 'campfire_beat',
    speaker: 'frog',
    text: '"Too scared to send them, his desk overflowed. One night at the Campfire Terrace, he came close to burning the whole stack. Instead, he folded a single page into a paper plane and threw it off the cliff. It fell like ordinary paper."',
    frogReact: true,
    nextId: 'stone_origin',
  },
  stone_origin: {
    id: 'stone_origin',
    speaker: 'frog',
    text: '"Turns out his homestead sat right over a long-buried outpost of the Sky-Couriers—also called Wind-Scribes. Long before modern roads or postal routes, that order carried urgent messages across mountains and seas. Centuries after they faded into myth, the roots of my garden pond pushed their last surviving Astral Inkstone back to the surface."',
    nextId: 'stone_explain',
  },
  stone_explain: {
    id: 'stone_explain',
    speaker: 'frog',
    text: '"They forged those stones from fallen meteoric glass and condensed sky-ore to bind written ink to upper-atmosphere wind currents. Anything written in Astral Ink follows the writer\'s intent instead of gravity—it won\'t touch the ground until it reaches the person it was meant for, or until the writer genuinely lets go."',
    nextId: 'unaddressed_explain',
  },
  unaddressed_explain: {
    id: 'unaddressed_explain',
    speaker: 'frog',
    text: '"So the Writer rewrote his letters in that ink, and the first plane he threw into the dark stayed aloft. Problem was, he never had the courage to write the woman\'s name or address on any of them. The planes couldn\'t land, so they just entered a holding pattern around the house."',
    nextId: 'uplift_explain',
  },
  uplift_explain: {
    id: 'uplift_explain',
    speaker: 'frog',
    text: '"An Inkstone was only meant for one addressed letter at a time, not thousands. Every time he ground the stone, it drew a bit of his breath, warmth, and physical weight. Ink residue soaked into the floorboards, the garden soil, and the cliffside rock until the whole homestead tore free and lifted above the clouds."',
    nextId: 'pond_magic_beat',
  },
  pond_magic_beat: {
    id: 'pond_magic_beat',
    speaker: 'frog',
    text: '"Some of that magic seeped right into my pond water, too. That\'s why I stopped aging, and why I\'m still here to tell you about it."',
    frogReact: true,
    choices: [
      { label: '"How did the Lantern Shrine get here?"', nextId: 'shrine_explain' },
      { label: '"Ask about the pink bow"', nextId: 'bow_explain' },
      { label: '"Ask about the duck floatie"', nextId: 'floatie_explain' },
      { label: '"What happened when the stone ran dry?"', nextId: 'sacrifice_explain' },
    ],
  },
  shrine_explain: {
    id: 'shrine_explain',
    speaker: 'frog',
    text: '"Once we were above the clouds, the mist was too thick for his planes to find a way down, or for anyone to find him. So the Writer built the Lantern Shrine to focus the Inkstone\'s glow into a steady beacon. That beacon, plus the island\'s updraft, started pulling in unspoken thoughts and letters from people in the world below."',
    frogReact: true,
    choices: [
      { label: '"Ask about the pink bow"', nextId: 'bow_explain' },
      { label: '"Ask about the duck floatie"', nextId: 'floatie_explain' },
      { label: '"What happened when the stone ran dry?"', nextId: 'sacrifice_explain' },
    ],
  },
  bow_explain: {
    id: 'bow_explain',
    speaker: 'frog',
    text: '"The pink bow belonged to the woman he loved. She left it behind long ago. One lonely afternoon, the Writer tied it gently to me so he\'d still have a piece of her color in the garden."',
    frogReact: true,
    choices: [
      { label: '"How did the Lantern Shrine get here?"', nextId: 'shrine_explain' },
      { label: '"And the duck floatie?"', nextId: 'floatie_explain' },
      { label: '"What happened when the stone ran dry?"', nextId: 'sacrifice_explain' },
    ],
  },
  floatie_explain: {
    id: 'floatie_explain',
    speaker: 'frog',
    text: '"When the island rose and my garden stream became an endless waterfall pouring into the clouds, the Writer worried I\'d get swept over the edge and placed me in this duck floatie. Ridiculous, honestly. I\'m an excellent swimmer."',
    frogReact: true,
    choices: [
      { label: '"How did the Lantern Shrine get here?"', nextId: 'shrine_explain' },
      { label: '"What about the pink bow?"', nextId: 'bow_explain' },
      { label: '"What happened when the stone ran dry?"', nextId: 'sacrifice_explain' },
    ],
  },
  sacrifice_explain: {
    id: 'sacrifice_explain',
    speaker: 'narration',
    text: 'A warm gust sweeps across the pond, lifting the edges of the pink ribbon.',
    nextId: 'sacrifice_2',
  },
  sacrifice_2: {
    id: 'sacrifice_2',
    speaker: 'frog',
    text: '"Years passed. From overusing the stone, the Writer was already fading: his shadow thinned, his footsteps barely touched the grass, and his warmth leaked into the breeze. When the Inkstone finally ran dry and cracked open, it revealed the Couriers\' last rule carved into its core: \'The ink only borrows the wind. When the stone runs dry, only the scribe\'s last breath can keep the current alive.\'"',
    nextId: 'sacrifice_3',
  },
  sacrifice_3: {
    id: 'sacrifice_3',
    speaker: 'frog',
    text: '"With the stone empty, the updraft began to fail, and everyone else\'s unsent letters were about to crash. By then, the Writer knew he\'d waited too long and whatever life the woman had below had moved on without him. Still, he couldn\'t let those other letters fall."',
    nextId: 'sacrifice_4',
  },
  sacrifice_4: {
    id: 'sacrifice_4',
    speaker: 'frog',
    text: '"So he walked to the Lantern Shrine, laid down his pen, and placed one final unaddressed letter inside the lantern. He let go of what remained of his body, his voice, and even his memory of her face, dissolving into the living current of the island as the Keeper of the Wind."',
    frogReact: true,
    choices: [
      { label: '"So you\'ve been waiting here ever since."', nextId: 'ending_1' },
      { label: '"Can I read Letter #0?"', nextId: 'ending_letter' },
    ],
  },
  ending_1: {
    id: 'ending_1',
    speaker: 'frog',
    text: '"Somebody has to watch the shrine. Also the rent is zero and the breeze is nice. Now quit staring at me and go catch a plane before I start charging for storytime."',
    frogReact: true,
    isEnd: true,
  },
  ending_letter: {
    id: 'ending_letter',
    speaker: 'frog',
    text: '"Right there inside the lantern. Go on, read it. Just don\'t get tears in my pond, I just got the pH balanced."',
    frogReact: true,
    isEnd: true,
  },
};

export const CODEX_LETTER_ZERO = {
  number: 'Letter #0',
  title: 'Unaddressed (Found Inside the Lantern Shrine)',
  epigraph:
    '"He couldn\'t deliver his own love in time, so he became the wind that carries everyone else\'s."',
  body: [
    'I never wrote your name on the envelope. I kept telling myself I was waiting for a quieter evening, or a day when my hands would not shake.',
    'The stone under the garden split open tonight. Inside the hollow, the Sky-Couriers left one last rule: the ink only borrows the wind, and when the stone runs dry, only the scribe\'s last breath can keep the current alive.',
    'Too many strangers have trusted their unsent words to this sky. I cannot let those planes fall.',
    'So I am leaving the door unlatched, a warm mug on the desk, and my last page inside the lantern. If a sudden updraft ever carries a folded note past your window, that is me.',
  ],
  dialogue: [
    {
      speaker: 'narration',
      text: 'The lantern above the pond hums softly. Below it, the frog paddles half an inch to the left in its yellow duck floatie and squints up at you.',
    },
    {
      speaker: 'frog',
      text: '"Oh. You actually found it."',
    },
    {
      speaker: 'you',
      text: '"There\'s an unaddressed letter inside the shrine. And a cracked blue stone on the desk in the cottage."',
    },
    {
      speaker: 'frog',
      text: '"Yeah, well. Nobody cleans up around here anymore. Mostly because I have webbed feet and the Writer who lived in that cottage turned into the wind."',
    },
    {
      speaker: 'you',
      text: '"Turned into the wind?"',
    },
    {
      speaker: 'narration',
      text: 'The frog sighs, kicking one webbed foot. A tiny ripple bumps against the wooden shrine deck.',
    },
    {
      speaker: 'frog',
      text: '"Long time ago, this place was just a cliffside homestead above a valley. The Writer lived in that cottage alone, writing letters every night to a woman he loved more than he knew how to say out loud."',
    },
    {
      speaker: 'you',
      text: '"Because of the stone?"',
    },
    {
      speaker: 'frog',
      text: '"Too scared to send them at first. He almost burned the whole stack out by the campfire one night, then folded one page into a plane instead. Later, my pond roots pushed up that ugly blue rock."',
    },
    {
      speaker: 'you',
      text: '"The Astral Inkstone."',
    },
    {
      speaker: 'frog',
      text: '"Fancy name for a rock that ruins your posture. Old Sky-Couriers forged it from meteor glass to carry one urgent letter at a time. You grind it, write an address, and the wind takes it straight there."',
    },
    {
      speaker: 'you',
      text: '"Who was he writing to?"',
    },
    {
      speaker: 'frog',
      text: '"That woman he loved. He rewrote his letters in the stone\'s ink, except he never had the courage to write her name on the envelopes. So the planes couldn\'t land. They just kept circling the house while the ink soaked into the soil, taking a little of his warmth each time until the whole cliff tore loose and floated up here."',
    },
    {
      speaker: 'you',
      text: '"And he built the Lantern Shrine up here?"',
    },
    {
      speaker: 'frog',
      text: '"Yeah. Once we were above the clouds, the mist was too thick for his planes to find a way down, or for anyone to find him. He built the shrine to focus the Inkstone\'s glow into a steady beacon, which started pulling in unspoken letters from the valley below."',
    },
    {
      speaker: 'you',
      text: '"Is that why you\'re wearing a pink bow? And a duck floatie?"',
    },
    {
      speaker: 'narration',
      text: 'The frog goes quiet for a second, one stubby arm resting on the duck\'s plastic head.',
    },
    {
      speaker: 'frog',
      text: '"The floatie was the Writer\'s idea. Once the island rose and my stream turned into a waterfall pouring into the clouds, he worried I\'d get swept over the edge. Ridiculous, honestly. I\'m an excellent swimmer."',
    },
    {
      speaker: 'you',
      text: '"And the bow?"',
    },
    {
      speaker: 'frog',
      text: '"It belonged to the woman he loved. She left it behind long ago. One lonely afternoon he tied it gently behind my head so he\'d still have a piece of her color in the garden."',
    },
    {
      speaker: 'you',
      text: '"Did she ever know?"',
    },
    {
      speaker: 'frog',
      text: '"Don\'t think so. Years passed, and he used the inkstone so much he was already fading. Thin shadow, barely leaving footprints in the grass."',
    },
    {
      speaker: 'you',
      text: '"So when the stone ran dry..."',
    },
    {
      speaker: 'frog',
      text: '"It cracked open and the Lantern Shrine\'s updraft started failing. Every unspoken letter pulled up from the valley below was about to drop out of the sky."',
    },
    {
      speaker: 'narration',
      text: 'A warm gust sweeps across the pond, lifting the edges of the pink ribbon.',
    },
    {
      speaker: 'frog',
      text: '"By then, the Writer knew he\'d waited too long and her life below had moved on. So he walked out to the lantern at twilight, placed his last unaddressed letter inside, and let go of what was left of himself to become the Keeper of the Wind."',
    },
    {
      speaker: 'you',
      text: '"And you\'ve been waiting by the pond ever since."',
    },
    {
      speaker: 'frog',
      text: '"Somebody has to watch the shrine. Also the rent is zero and the breeze is nice. Now quit staring at me and go catch a plane before I start charging for storytime."',
    },
  ] as CodexDialogueLine[],
};
