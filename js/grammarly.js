/* Grammarly — an offline, rule-based writing assistant.
   Type or paste text; a local checker (no network) underlines issues as you type
   (red = correctness, blue = clarity, green = engagement, purple = delivery) and the
   sidebar lists suggestion cards you can Accept or Dismiss. Also shows an overall
   score, a tone detector, word count, reading time and readability.
   The current document persists in State.data.appData.grammarly. */
(function () {
  "use strict";

  // =====================================================================
  //  Rule data
  // =====================================================================

  // Common misspellings / typos -> correction (lowercase keys).
  const TYPOS = {
    teh: "the", hte: "the", tthe: "the", adn: "and", nad: "and", anf: "and", taht: "that", thta: "that",
    thier: "their", recieve: "receive", recieved: "received", recieves: "receives", recieving: "receiving",
    reciept: "receipt", beleive: "believe", belive: "believe", beleived: "believed", definately: "definitely",
    definatly: "definitely", defintely: "definitely", definitly: "definitely", definetly: "definitely",
    seperate: "separate", seperately: "separately", seperated: "separated", occured: "occurred",
    occuring: "occurring", occurence: "occurrence", untill: "until", wich: "which", whcih: "which",
    becuase: "because", becasue: "because", beacuse: "because", becuz: "because", alot: "a lot",
    acheive: "achieve", acheived: "achieved", acheivement: "achievement", accomodate: "accommodate",
    accross: "across", adress: "address", agressive: "aggressive", apparantly: "apparently",
    appearence: "appearance", arguement: "argument", arguements: "arguments", basicly: "basically",
    begining: "beginning", beggining: "beginning", buisness: "business", bussiness: "business",
    calender: "calendar", catagory: "category", cemetary: "cemetery", colleage: "colleague",
    collegue: "colleague", comming: "coming", commitee: "committee", comittee: "committee",
    comitted: "committed", completly: "completely", concious: "conscious", curiousity: "curiosity",
    decieve: "deceive", dissapear: "disappear", dissapoint: "disappoint", dissappointed: "disappointed",
    embarass: "embarrass", embarassed: "embarrassed", enviroment: "environment", enviorment: "environment",
    existance: "existence", experiance: "experience", familar: "familiar", finaly: "finally",
    finnaly: "finally", foriegn: "foreign", freind: "friend", freinds: "friends", goverment: "government",
    gaurd: "guard", happend: "happened", hapen: "happen", hapened: "happened", harrass: "harass",
    heighth: "height", hieght: "height", humourous: "humorous", hygene: "hygiene", ignorence: "ignorance",
    immediatly: "immediately", imediately: "immediately", independant: "independent",
    intresting: "interesting", intrested: "interested", interupt: "interrupt", knowlege: "knowledge",
    libary: "library", lisence: "license", maintainance: "maintenance", managment: "management",
    millenium: "millennium", mischievious: "mischievous", mispell: "misspell", mispelled: "misspelled",
    neccessary: "necessary", necessery: "necessary", nessecary: "necessary", noticable: "noticeable",
    occassion: "occasion", occassionally: "occasionally", ocasionally: "occasionally", persue: "pursue",
    posession: "possession", potatos: "potatoes", prefered: "preferred", presense: "presence",
    probly: "probably", probaly: "probably", proffesional: "professional", promiss: "promise",
    publically: "publicly", realy: "really", recomend: "recommend", reccomend: "recommend",
    reccommend: "recommend", refered: "referred", relevent: "relevant", religous: "religious",
    remeber: "remember", rember: "remember", resistence: "resistance", responsability: "responsibility",
    rythm: "rhythm", scedule: "schedule", shedule: "schedule", sentance: "sentence", similiar: "similar",
    sincerly: "sincerely", speach: "speech", strenght: "strength", lenght: "length", succesful: "successful",
    sucessful: "successful", sucess: "success", supercede: "supersede", suprise: "surprise",
    suprised: "surprised", temperture: "temperature", tommorow: "tomorrow", tomorow: "tomorrow",
    tommorrow: "tomorrow", tounge: "tongue", truely: "truly", truley: "truly", twelth: "twelfth",
    tyrany: "tyranny", vaccum: "vacuum", wierd: "weird", whereever: "wherever", wether: "whether",
    writting: "writing", writen: "written", youself: "yourself", yestarday: "yesterday",
    yesturday: "yesterday", everytime: "every time", infact: "in fact", aswell: "as well",
    incase: "in case", eachother: "each other", alittle: "a little", noone: "no one", atleast: "at least",
    ofcourse: "of course", thankyou: "thank you", irregardless: "regardless", excercise: "exercise",
    exersize: "exercise", beutiful: "beautiful", beatiful: "beautiful", buisy: "busy", carefull: "careful",
    cieling: "ceiling", consistant: "consistent", convienient: "convenient", dilemna: "dilemma",
    equiptment: "equipment", excelent: "excellent", exellent: "excellent", fourty: "forty",
    gaurantee: "guarantee", garantee: "guarantee", grammer: "grammar", greatful: "grateful",
    guidence: "guidance", hopefuly: "hopefully", informaton: "information", langauge: "language",
    liason: "liaison", mountian: "mountain", naturaly: "naturally", nieghbor: "neighbor", neice: "niece",
    ninty: "ninety", oppurtunity: "opportunity", oportunity: "opportunity", origional: "original",
    parliment: "parliament", particulary: "particularly", peice: "piece", perhpas: "perhaps",
    persistant: "persistent", pleasent: "pleasant", poeple: "people", peopel: "people",
    pronounciation: "pronunciation", questionaire: "questionnaire", restaraunt: "restaurant",
    resturant: "restaurant", rediculous: "ridiculous", sieze: "seize", sence: "sense", shoudl: "should",
    shoud: "should", studing: "studying", stoped: "stopped", threshhold: "threshold", tolerence: "tolerance",
    tradgedy: "tragedy", unfortunatly: "unfortunately", usualy: "usually", vegtable: "vegetable",
    visable: "visible", wellcome: "welcome", whith: "with", wiht: "with", woudl: "would",
    comunication: "communication", comunity: "community", diffrent: "different", diffcult: "difficult",
    dificult: "difficult", enought: "enough", mabye: "maybe", maybee: "maybe", oppinion: "opinion",
    opinon: "opinion", sinse: "since", somthing: "something", somehting: "something", thign: "thing",
    thnik: "think", togehter: "together", togather: "together", wnat: "want", waht: "what", wehn: "when",
    whne: "when", yuo: "you", yoru: "your", jsut: "just", knwo: "know", konw: "know", liek: "like",
    mroe: "more", nto: "not", ofthe: "of the", inthe: "in the", tothe: "to the", onthe: "on the",
    andthe: "and the", becomeing: "becoming", beleif: "belief", bizzare: "bizarre", brocolli: "broccoli",
    camoflage: "camouflage", carribean: "Caribbean", changable: "changeable", collectable: "collectible",
    concensus: "consensus", copywrite: "copyright", dacquiri: "daiquiri", desparate: "desperate",
    dumbell: "dumbbell", ecstacy: "ecstasy", facinating: "fascinating", firey: "fiery", flourescent: "fluorescent",
    fulfil: "fulfill", gratefull: "grateful", harrassment: "harassment", hierarchey: "hierarchy",
    innoculate: "inoculate", jewelery: "jewelry", judgement: "judgment", kernal: "kernel",
    lollypop: "lollipop", medeval: "medieval", momento: "memento", miniscule: "minuscule",
    mispelling: "misspelling", neighbour: "neighbor", nucular: "nuclear", paralell: "parallel",
    pasttime: "pastime", pharoah: "pharaoh", playwrite: "playwright", privelege: "privilege",
    priviledge: "privilege", pronunciate: "pronounce", recurrance: "recurrence", rhymme: "rhyme",
    sacreligious: "sacrilegious", shcool: "school", skool: "school", sophmore: "sophomore",
    tatoo: "tattoo", tendancy: "tendency", therefor: "therefore", tiem: "time", vaccuum: "vacuum",
    vehical: "vehicle", wendsday: "Wednesday", wensday: "Wednesday", febuary: "February",
    feburary: "February", untill_: "until",
    // missing apostrophes
    dont: "don't", doesnt: "doesn't", didnt: "didn't", isnt: "isn't", wasnt: "wasn't", arent: "aren't",
    werent: "weren't", cant: "can't", couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't",
    hasnt: "hasn't", havent: "haven't", hadnt: "hadn't", wont: "won't", im: "I'm", ive: "I've",
    youre: "you're", theyre: "they're", thats: "that's", whats: "what's", theres: "there's",
    heres: "here's", shes: "she's", wouldve: "would've", couldve: "could've", shouldve: "should've",
  };
  delete TYPOS.untill_;

  // Wordy phrases -> concise alternative ("" = remove).
  const WORDY = [
    ["in order to", "to"], ["at this point in time", "now"], ["at the present time", "now"],
    ["at this moment in time", "now"], ["due to the fact that", "because"], ["owing to the fact that", "because"],
    ["in light of the fact that", "because"], ["in spite of the fact that", "although"],
    ["despite the fact that", "although"], ["for the purpose of", "to"], ["in the event that", "if"],
    ["in the near future", "soon"], ["a large number of", "many"], ["a great number of", "many"],
    ["the majority of", "most"], ["a majority of", "most"], ["a small number of", "a few"],
    ["has the ability to", "can"], ["have the ability to", "can"], ["is able to", "can"],
    ["are able to", "can"], ["in close proximity to", "near"], ["with regard to", "about"],
    ["with respect to", "about"], ["in regard to", "about"], ["in reference to", "about"],
    ["on a daily basis", "daily"], ["on a regular basis", "regularly"], ["on a weekly basis", "weekly"],
    ["on a monthly basis", "monthly"], ["at all times", "always"], ["each and every", "every"],
    ["first and foremost", "first"], ["basic fundamentals", "fundamentals"], ["end result", "result"],
    ["final outcome", "outcome"], ["past history", "history"], ["free gift", "gift"],
    ["future plans", "plans"], ["advance planning", "planning"], ["completely finished", "finished"],
    ["absolutely essential", "essential"], ["unexpected surprise", "surprise"], ["join together", "join"],
    ["repeat again", "repeat"], ["revert back", "revert"], ["make a decision to", "decide to"],
    ["make a decision", "decide"], ["come to a conclusion", "conclude"], ["give consideration to", "consider"],
    ["take into consideration", "consider"], ["conduct an investigation", "investigate"],
    ["is in need of", "needs"], ["are in need of", "need"], ["until such time as", "until"],
    ["prior to", "before"], ["subsequent to", "after"], ["for all intents and purposes", "essentially"],
    ["as a matter of fact", "in fact"], ["along the lines of", "like"], ["in a timely manner", "promptly"],
    ["at the end of the day", "ultimately"], ["whether or not", "whether"],
    ["the reason why is because", "because"], ["the reason is because", "because"], ["so as to", "to"],
    ["in an effort to", "to"], ["with the exception of", "except"], ["in the amount of", "for"],
    ["by means of", "by"], ["it is clear that", "clearly"], ["there is no doubt that", "undoubtedly"],
    ["in the process of", ""], ["very unique", "unique"], ["really unique", "unique"],
    ["totally unique", "unique"], ["it is important to note that", "notably,"],
    ["in the course of", "during"], ["a sufficient amount of", "enough"], ["in excess of", "more than"],
  ];

  // Intensifier + plain adjective -> vivid word(s).
  const STRONG = {
    "very good": ["excellent", "great"], "very bad": ["terrible", "awful"], "very big": ["huge", "enormous"],
    "very small": ["tiny", "minuscule"], "very happy": ["delighted", "thrilled"], "very sad": ["miserable", "heartbroken"],
    "very tired": ["exhausted", "drained"], "very important": ["crucial", "essential"], "very hungry": ["starving", "ravenous"],
    "very cold": ["freezing", "frigid"], "very hot": ["scorching", "sweltering"], "very old": ["ancient", "aged"],
    "very fast": ["rapid", "swift"], "very pretty": ["beautiful", "gorgeous"], "very scared": ["terrified", "petrified"],
    "very angry": ["furious", "livid"], "very smart": ["brilliant", "clever"], "very interesting": ["fascinating", "intriguing"],
    "very easy": ["effortless", "simple"], "very funny": ["hilarious"], "very clean": ["spotless"],
    "very dirty": ["filthy"], "very tasty": ["delicious"], "very quiet": ["silent", "hushed"], "very loud": ["deafening", "thunderous"],
    "very nice": ["lovely", "delightful"], "very large": ["enormous", "massive"], "very bright": ["dazzling", "brilliant"],
    "very boring": ["tedious", "dull"], "very difficult": ["arduous", "challenging"], "very sure": ["certain"],
    "very quick": ["swift", "rapid"], "very busy": ["swamped", "hectic"], "very rich": ["wealthy", "affluent"],
    "very poor": ["destitute", "impoverished"], "very weak": ["feeble", "frail"], "very strong": ["powerful", "mighty"],
    "very beautiful": ["stunning", "gorgeous"], "very ugly": ["hideous"], "very excited": ["thrilled", "eager"],
    "very surprised": ["astonished", "amazed"], "very worried": ["anxious", "distressed"], "very hard": ["difficult", "grueling"],
    "very serious": ["grave", "solemn"], "very clear": ["obvious", "evident"], "very short": ["brief", "concise"],
    "very long": ["lengthy", "extensive"], "very simple": ["basic", "straightforward"], "very good-looking": ["handsome", "attractive"],
  };
  const INTENSIFIERS = ["really", "extremely", "totally", "incredibly", "truly", "quite", "basically", "literally", "super", "very"];

  // Bland / overused words -> livelier alternatives.
  const BLAND = {
    nice: ["pleasant", "lovely", "kind"], good: ["solid", "strong", "excellent"], bad: ["poor", "harmful", "flawed"],
    stuff: ["things", "items", "material"], things: ["items", "details", "aspects"], interesting: ["intriguing", "compelling"],
    big: ["large", "significant", "major"], amazing: ["remarkable", "impressive"],
    awesome: ["impressive", "excellent"],
  };

  // Vocabulary upgrades (Engagement: Vocabulary, shown with a "Pro" badge). [phrase, alternatives, alternatives-after-a/an]
  const VOCAB = [
    ["really good", ["excellent", "great"], ["excellent", "perfect"]],
    ["a lot of", ["many", "much"]],
  ];
  Object.keys(STRONG).forEach((p) => {
    VOCAB.push([p, STRONG[p]]);
    const r = p.replace(/^very /, "really ");
    if (!VOCAB.some((v) => v[0] === r)) VOCAB.push([r, STRONG[p]]);
  });
  // Weak verb phrases with their inflections.
  const VERB_VOCAB = [
    { re: /\b(look|looks|looking|looked)\s+at\b(?!\s+(?:me|him|her|us|them)\b)/gi, phrase: "look at",
      forms: { look: ["examine", "review"], looks: ["examines", "reviews"], looking: ["examining", "reviewing"], looked: ["examined", "reviewed"] } },
    { re: /\b(think|thinks|thinking|thought)\s+about\b/gi, phrase: "think about",
      forms: { think: ["consider"], thinks: ["considers"], thinking: ["considering"], thought: ["considered"] } },
    { re: /\b(show|shows|showed|shown)(?=\s+that\b)/gi, phrase: "show",
      forms: { show: ["demonstrate", "reveal"], shows: ["demonstrates", "reveals"], showed: ["demonstrated", "revealed"], shown: ["demonstrated", "revealed"] } },
  ];
  // "less" + plural nouns that are NOT countable (or aren't nouns at all).
  const LESS_OK = new Set(("dollars euros pounds cents bucks hours minutes seconds days weeks months years miles kilometers kilometres " +
    "meters metres feet inches yards calories degrees percent news mathematics physics economics politics series species means ethics " +
    "athletics always sometimes perhaps as is was has does this thus its his hers ours yours theirs towards besides unless regardless " +
    "nevertheless afterwards upwards downwards backwards forwards needs counts matters says").split(/\s+/));

  // Hedging language (tone / confidence).
  const HEDGES = ["i think that", "i think", "i believe that", "i believe", "i feel like", "i feel that", "i guess",
    "i suppose", "maybe", "perhaps", "sort of", "kind of", "somewhat", "a little bit", "probably", "possibly",
    "hopefully", "i'm not sure but", "i'm not sure if", "it seems like", "it seems that", "in my opinion",
    "i would say that", "just"];

  // Informal / slang -> more polished alternatives.
  const INFORMAL = {
    gonna: ["going to"], wanna: ["want to"], gotta: ["have to", "got to"], kinda: ["kind of", "somewhat"],
    sorta: ["sort of", "somewhat"], ya: ["you"], u: ["you"], ur: ["your", "you're"], pls: ["please"],
    plz: ["please"], thx: ["thanks"], cuz: ["because"], coz: ["because"], dunno: ["don't know"],
    gimme: ["give me"], lemme: ["let me"], yeah: ["yes"], nope: ["no"], "ain't": ["isn't", "aren't"],
    lol: [""], omg: [""], tbh: ["to be honest"], idk: ["I don't know"], btw: ["by the way"],
  };

  // Contractions (flagged only when the formality goal is Formal / the domain is Academic).
  const CONTRACTIONS = {
    "don't": "do not", "doesn't": "does not", "didn't": "did not", "can't": "cannot", "won't": "will not",
    "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not", "it's": "it is",
    "i'm": "I am", "you're": "you are", "we're": "we are", "they're": "they are", "that's": "that is",
    "there's": "there is", "couldn't": "could not", "shouldn't": "should not", "wouldn't": "would not",
    "haven't": "have not", "hasn't": "has not", "let's": "let us", "i've": "I have", "we've": "we have",
    "i'll": "I will", "we'll": "we will", "you'll": "you will",
  };

  const PASSIVE_IRREG = "known|written|done|made|given|taken|seen|shown|built|sent|found|held|kept|told|thought|bought|brought|caught|taught|left|lost|paid|said|sold|eaten|chosen|broken|spoken|stolen|driven|forgotten|hidden|beaten|bitten|blown|drawn|drunk|flown|frozen|grown|hung|led|meant|met|read|ridden|run|shaken|shot|spent|struck|sung|sworn|thrown|torn|understood|won|worn|woven";
  const PASSIVE_SKIP = new Set(("tired interested excited bored married worried scared supposed used based located concerned pleased " +
    "surprised disappointed satisfied embarrassed confused amazed annoyed frightened exhausted involved related prepared " +
    "finished dressed engaged qualified need seed feed bed red shed speed bleed breed greed proceed exceed succeed indeed " +
    "hundred sacred naked wicked rugged ragged crooked beloved learned aged blessed shocked stressed relaxed thrilled " +
    "determined convinced devoted dedicated unmotivated motivated overwhelmed frustrated delighted bed-ridden talented " +
    "skilled experienced detailed advanced complicated sophisticated limited crowded closed opened tied fried").split(/\s+/));

  const SUBORDINATORS = new Set("if when because although though while since after before unless as once whenever until whether even where wherever".split(" "));

  const CATS = ["correctness", "clarity", "engagement", "delivery"];
  const CAT_LABEL = { correctness: "Correctness", clarity: "Clarity", engagement: "Engagement", delivery: "Delivery" };
  const CAT_RANK = { correctness: 0, clarity: 1, engagement: 2, delivery: 3 };
  const WEIGHT = { correctness: 4, clarity: 2, engagement: 1.4, delivery: 1.4 };

  const SAMPLE = "i think that teh new office policy is very good, but their are alot of problems with it. This announcement is going to have a significant affect on everyone’s outlook. Our team has less projects this quarter. Inspect your word choice carefully and find a really good alternative. In order to recieve a refund, you must fill out a form on a daily basis. Its a hassle and your going to loose time. The budget was approved by the manager. At this point in time nobody has read it , and the deadline is close. We definately need to seperate the the tasks and send an useful update before the meeting, it starts at noon. Honestly i was really surprised that a hour of work was wasted!! This plan is more better then the old one, and we should of seen that sooner.\n\nMaybe we could kind of try a different approach because the current process is taking a large number of hours each week and in my opinion it is basically making everyone feel tired and stressed when they come into work in the morning. Lets talk about it tomorow, i'm gonna bring some ideas";

  // =====================================================================
  //  Helpers
  // =====================================================================
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const phraseSrc = (p) => escRe(p).replace(/'/g, "['’]").replace(/ /g, "\\s+");
  const phraseRe = (p) => new RegExp("\\b" + phraseSrc(p) + "\\b", "gi");
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  function matchCase(orig, rep) {
    if (!rep) return rep;
    if (orig.length > 1 && orig === orig.toUpperCase() && /[A-Z]/.test(orig) && orig !== "I") return rep.toUpperCase();
    if (/^[A-Z]/.test(orig)) return cap(rep);
    return rep;
  }
  const norm = (w) => w.toLowerCase().replace(/’/g, "'");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function tokenize(text) {
    const out = []; const re = /[A-Za-z]+(?:['’][A-Za-z]+)*/g; let m;
    while ((m = re.exec(text))) out.push({ w: m[0], s: m.index, e: m.index + m[0].length });
    return out;
  }
  // True when the word at index i starts a sentence (start of text / line, or after . ! ? + whitespace).
  function isSentenceStart(text, i) {
    let j = i - 1, sawSpace = false;
    while (j >= 0) {
      const c = text[j];
      if (c === "\n") return true;
      if (c === " " || c === "\t") { sawSpace = true; j--; continue; }
      if (/["'“‘(\[]/.test(c)) { j--; continue; }
      if (/[.!?]/.test(c)) {
        if (!sawSpace) return false;
        const before = text.slice(Math.max(0, j - 8), j + 1);
        if (/(?:^|\s)(?:e\.g|i\.e|etc|vs|mr|mrs|ms|dr|st|jr|sr|approx|fig|inc|ltd|no)\.$/i.test(before)) return false;
        return true;
      }
      return false;
    }
    return true;
  }
  // Removal fix for [s, e): eats an adjacent space/comma; re-capitalizes the next word at a sentence start.
  function removal(text, s, e) {
    let fs = s, fe = e;
    if (text[fe] === ",") fe++;
    if (text[fe] === " ") fe++;
    else if (text[fs - 1] === " ") fs--;
    let t = "";
    if (isSentenceStart(text, s)) {
      const m = /^[A-Za-z]+/.exec(text.slice(fe));
      if (m) { const lw = m[0].toLowerCase(); t = cap(Object.prototype.hasOwnProperty.call(TYPOS, lw) ? TYPOS[lw] : m[0]); fe += m[0].length; }
    }
    return { s: fs, e: fe, t };
  }
  function sentenceBounds(text, i) {
    let s = i; while (s > 0 && !/[.!?\n]/.test(text[s - 1])) s--;
    while (s < i && /\s/.test(text[s])) s++;
    let e = i; while (e < text.length && !/[.!?\n]/.test(text[e])) e++;
    while (e < text.length && /[.!?]/.test(text[e])) e++;
    return [s, e];
  }
  function needsAn(word) {
    if (word.length > 1 && word === word.toUpperCase()) return /^[AEFHILMNORSX]/.test(word); // acronyms: an FBI, a NASA
    const w = word.toLowerCase();
    if (/^(hour|honest|honor|honour|heir|herb)/.test(w)) return true;
    if (/^(unic|unif|uniq|unis|unit|univ|unio|unil|unan|use|usu|usa|uten|uti|uto|ura|ure|uri|euro|eul|euph|eu|ewe|one|once|ufo|uk|ukulele)/.test(w)) return false;
    return /^[aeiou]/.test(w);
  }
  function syllables(word) {
    let w = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return 0;
    if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
    const m = w.match(/[aeiouy]{1,2}/g);
    return Math.max(1, m ? m.length : 1);
  }
  function sentences(text) {
    const out = [];
    text.split("\n").forEach((line, li, arr) => {
      const base = arr.slice(0, li).reduce((a, l) => a + l.length + 1, 0);
      const re = /[^.!?]+[.!?]*["')\]]*/g; let m;
      while ((m = re.exec(line))) {
        const raw = m[0]; const lead = raw.length - raw.trimStart().length;
        const t = raw.trim(); if (!/[A-Za-z0-9]/.test(t)) continue;
        out.push({ s: base + m.index + lead, e: base + m.index + lead + t.length, text: t });
      }
    });
    return out;
  }

  // =====================================================================
  //  The checker
  // =====================================================================
  function check(text, goals, dict) {
    goals = goals || {};
    dict = dict instanceof Set ? dict : new Set((dict || []).map((w) => String(w).toLowerCase()));
    const issues = [];
    let order = 0;
    function add(o) {
      o.pri = (o.pri0 != null ? o.pri0 : CAT_RANK[o.cat] * 1000) + (order++);
      o.orig = text.slice(o.start, o.end);
      o.fixes = (o.fixes || []).filter((f) => f && text.slice(f.s, f.e) !== f.t);
      issues.push(o);
    }
    const toks = tokenize(text);

    // --- Correctness: spelling -------------------------------------------------
    toks.forEach((t) => {
      const lw = norm(t.w);
      if (!Object.prototype.hasOwnProperty.call(TYPOS, lw) || dict.has(lw)) return;
      const rep = TYPOS[lw];
      let title = "Correct your spelling", expl = `If you don’t want **${t.w}** to be marked as misspelled in the future, you can add it to your personal dictionary.`;
      if (rep.includes("'") && rep.replace(/'/g, "").toLowerCase() === lw) { title = "Add a missing apostrophe"; expl = `Contractions need an apostrophe: “${rep}”.`; }
      else if (rep.includes(" ") && rep.replace(/ /g, "").toLowerCase() === lw) { title = "Separate the words"; expl = `“${rep}” is written as separate words.`; }
      add({ rule: "spelling", cat: "correctness", label: "SPELLING", dictWord: title === "Correct your spelling" ? t.w : null, start: t.s, end: t.e, title, expl, fixes: [{ s: t.s, e: t.e, t: /^[A-Z]/.test(rep) ? rep : matchCase(t.w, rep) }] });
    });

    // --- Correctness: lowercase "i" -------------------------------------------
    toks.forEach((t) => {
      const lw = norm(t.w);
      if (t.w[0] !== "i" || !/^i(?:'(?:m|ve|ll|d))?$/.test(lw)) return;
      if (text[t.e] === "." && /[a-z]/i.test(text[t.e + 1] || "")) return; // i.e.
      add({ rule: "cap-i", cat: "correctness", label: "CAPITALIZATION", start: t.s, end: t.e, title: "Capitalize the word",
        expl: isSentenceStart(text, t.s) ? `As the first word of the sentence, **${t.w}** should be capitalized.` : `The pronoun **I** is always capitalized.`, fixes: [{ s: t.s, e: t.e, t: "I" + t.w.slice(1) }] });
    });

    // --- Correctness: capitalize the first word of a sentence --------------------
    toks.forEach((t) => {
      if (!/^[a-z]/.test(t.w) || /[A-Z]/.test(t.w.slice(1))) return;
      if (!isSentenceStart(text, t.s)) return;
      if (text[t.e] === "." && /[a-z]/i.test(text[t.e + 1] || "")) return; // e.g.
      if (/^(?:https?|www)$/i.test(t.w) && /^[:.]/.test(text[t.e] || "")) return;
      add({ rule: "cap-start", cat: "correctness", label: "CAPITALIZATION", start: t.s, end: t.e, title: "Capitalize the word",
        expl: `As the first word of the sentence, **${t.w}** should be capitalized.`, fixes: [{ s: t.s, e: t.e, t: cap(t.w) }] });
    });

    // --- Correctness: repeated words -------------------------------------------
    { const re = /\b([A-Za-z]+(?:['’][A-Za-z]+)?)(\s+)\1\b/gi; let m;
      while ((m = re.exec(text))) {
        const lw = m[1].toLowerCase(); if (lw === "had" || lw === "that") continue;
        const s2 = m.index + m[1].length + m[2].length;
        add({ rule: "repeat", cat: "correctness", start: s2, end: m.index + m[0].length, title: "Remove the repetition", label: "GRAMMAR",
          expl: `The word **${m[1]}** is repeated. Remove one of them.`, fixes: [{ s: m.index + m[1].length, e: m.index + m[0].length, t: "" }] });
      } }

    // --- Correctness: a / an ------------------------------------------------------
    for (let i = 0; i < toks.length - 1; i++) {
      const t = toks[i], n = toks[i + 1], lw = t.w.toLowerCase();
      if (lw !== "a" && lw !== "an") continue;
      if (!/^ +$/.test(text.slice(t.e, n.s)) || n.w.length < 2) continue;
      if (t.w === "A" && !isSentenceStart(text, t.s)) continue; // "Plan A", "grade A"
      if (/[A-Za-z0-9\-]/.test(text[t.s - 1] || "")) continue;
      const an = needsAn(n.w);
      if ((lw === "a") === !an) continue;
      const rep = an ? "an" : "a";
      add({ rule: "article", cat: "correctness", start: t.s, end: n.e, title: "Change the article",
        expl: an ? `Use “an” before words that begin with a vowel sound, such as “${n.w}”.` : `Use “a” before words that begin with a consonant sound, such as “${n.w}”.`,
        fixes: [{ s: t.s, e: n.e, t: matchCase(t.w, rep) + " " + n.w }] });
    }

    // --- Correctness: confused words & agreement (pre)(target)(post) ------------------
    const CONF = [
      { re: /(\b)(there)(\s+(?:own|cars?|houses?|homes?|dogs?|cats?|parents|friends?|family|families|teams?|kids|children|mom|dad|mother|father|jobs?|books?|phones?|names?|money|favou?rite|lives|life|teacher|class|rooms?|eyes|hands?|heads?|minds?|ideas?|opinions?|homework|bags?|clothes|shoes|toys|lunch)\b)/gi, to: "their",
        title: "Change the word", expl: "“Their” shows possession (belonging to them). “There” refers to a place." },
      { re: /(\b)(their)(\s+(?:is|are|was|were|will\s+be|has\s+been|have\s+been)\b)/gi, to: "there",
        title: "Change the word", expl: "Use “there” with “is/are” to say something exists. “Their” shows possession." },
      { re: /(\b(?:over|in|out|from|up|down|here\s+and)\s+)(their)(\s*[.!?,])/gi, to: "there",
        title: "Change the word", expl: "“There” refers to a place. “Their” shows possession." },
      { re: /(\b)(they['’]re)(\s+(?:own|cars?|house|home|dog|parents|friends|family|team|kids|children|names?|money|favou?rite|homework|books?)\b)/gi, to: "their",
        title: "Change the word", expl: "“They’re” means “they are.” Use “their” to show possession." },
      { re: /(\b)(there|their)(\s+(?:going|coming|doing|getting|trying|gonna|not\s+(?:going|coming|ready|sure|here))\b)/gi, to: "they're",
        title: "Change the word", expl: "Use “they’re” (they are) before a verb like this." },
      { re: /(\b)(your)(\s+(?:welcome|right(?!\s+(?:hand|arm|leg|foot|side|eye|ear|shoulder|knee|to))|wrong|going|coming|doing(?=\s+\w)|not|so|really|being|getting|making|trying|kidding|joking|sure|ready|the\s+best|a|an)\b)/gi, to: "you're",
        title: "Change the word", expl: "“You’re” is short for “you are.” “Your” shows possession." },
      { re: /(\b)(you['’]re)(\s+(?:own|cars?|house|home|dog|cat|parents|friends?|family|team|kids|children|mom|dad|names?|money|phone|homework|books?|account|password|email|order|computer)\b)/gi, to: "your",
        title: "Change the word", expl: "“You’re” means “you are.” Use “your” to show possession." },
      { re: /(\b)(its)(\s+(?:a|an|the|been|not|going|very|so|really|time|raining|snowing|ok|okay|important|true|hard|easy|over|my|your|our|always|never|about|getting|too|like|fine|late|early)\b)/gi, to: "it's",
        title: "Add an apostrophe", expl: "“It’s” is short for “it is” or “it has.” “Its” shows possession." },
      { re: /(\b)(it['’]s)(\s+(?:own|tail|name|colou?r|size|shape|owner|value|purpose|leaves|wings|fur|head|legs|body|price|population|capital|history)\b)/gi, to: "its",
        title: "Remove the apostrophe", expl: "“Its” (no apostrophe) shows possession. “It’s” means “it is.”" },
      { re: /(\b)(more\s+(?:better|worse|bigger|smaller|easier|harder|faster|slower|cheaper|happier))(\b)/gi, fn: (t) => t.replace(/^more\s+/i, ""),
        title: "Remove “more”", expl: "Don’t combine “more” with a comparative adjective — the -er ending already means “more.”" },
      { re: /(\b(?:more|less|better|worse|rather|other|bigger|smaller|faster|slower|greater|higher|lower|larger|older|younger|easier|harder|stronger|weaker|longer|shorter|taller|cheaper|richer|smarter|earlier|later|fewer)\s+)(then)(\b)/gi, to: "than",
        title: "Change the word", expl: "Use “than” for comparisons. “Then” refers to time." },
      { re: /(\b(?:could|should|would|must|might)\s+)(of)(\b)/gi, to: "have",
        title: "Change the word", expl: "The correct form is “could/should/would have,” not “of.”" },
      { re: /(\b(?:is|are|was|were|be|been|am|way|far|not|it's|that's|i'm|you're|we're|they're|so)\s+)(to)(\s+(?:much|late|early|big|small|bad|hard|easy|difficult|expensive|far|long|fast|slow|loud|hot|cold|tired|busy)\b)/gi, to: "too",
        title: "Change the word", expl: "Use “too” to mean “excessively” or “also.”" },
      { re: /(\b(?:me|you|us|them|him|her|we)\s+)(to)(\s*[.!?])/gi, to: "too",
        title: "Change the word", expl: "Use “too” to mean “also.”" },
      { re: /(\b(?:a|an|the|no|any|this|that|its|their|our|his|her|positive|negative|side|great|big|huge|lasting|significant|major|minor|profound|real|strong|direct|adverse|minimal|dramatic|small|little|net|overall|immediate|long-term|desired|same|domino|ripple|butterfly|calming|cumulative)\s+)(affect)(\b)(?!\s+(?:the|a|an|my|your|our|their|his|her|its|how|whether|everyone|people|us|them|me|you)\b)/gi, to: "effect", label: "SPELLING",
        title: "Correct your spelling", expl: "It appears that **affect** (a verb) is used where a noun is needed. **Effect** means a result or an influence." },
      { re: /(\b(?:will|would|can|could|may|might|not|does|did|do|should|must|to|won['’]t|can['’]t|didn['’]t|doesn['’]t)\s+)(effect)(\b)(?!\s+(?:change|changes|a\s+change|real\s+change|reform|reforms)\b)/gi, to: "affect", label: "SPELLING",
        title: "Correct your spelling", expl: "It appears that **effect** (a noun) is used as a verb. To influence something is to **affect** it." },
      { re: /(\b(?:to|will|would|can|could|might|may|don't|didn't|not|never|gonna)\s+)(loose)(\b)/gi, to: "lose",
        title: "Change the word", expl: "“Lose” means to misplace or fail to win. “Loose” means not tight." },
      { re: /(\b)((?:he|she|it)\s+don['’]t)(\b)/gi, fn: (t) => t.replace(/don['’]t/i, "doesn't"),
        title: "Fix the agreement", expl: "With he, she, or it, use **doesn’t**." },
      { re: /(\b)((?:they|we|you)\s+was)(\b)/gi, fn: (t) => t.replace(/was$/i, "were"),
        title: "Fix the agreement", expl: "With they, we, or you, use **were**." },
      { re: /(\b)((?:he|she)\s+have)(\b)(?!\s+to\b)/gi, fn: (t) => t.replace(/have$/i, "has"),
        title: "Fix the agreement", expl: "With he or she, use **has**." },
      { re: /(\b)(lets)(\s+(?:go|get|start|see|do|make|try|talk|meet|have|be|eat|play|find|take|keep|chat|discuss)\b)/gi, to: "let's",
        title: "Add an apostrophe", expl: "“Let’s” is short for “let us.”" },
    ];
    CONF.forEach((r) => {
      let m; r.re.lastIndex = 0;
      while ((m = r.re.exec(text))) {
        const s = m.index + m[1].length, e = s + m[2].length;
        const rep = r.fn ? r.fn(m[2]) : matchCase(m[2], r.to);
        add({ rule: "confused", cat: "correctness", label: r.label || "GRAMMAR", start: s, end: e, title: r.title, expl: r.expl, fixes: [{ s, e, t: rep }] });
        if (m[0].length === 0) r.re.lastIndex++;
      }
    });

    // --- Correctness: less / fewer ----------------------------------------------------
    { const re = /\b(less)\s+([a-z]+s)\b/gi; let m;
      while ((m = re.exec(text))) {
        const noun = m[2].toLowerCase();
        if (LESS_OK.has(noun) || /(?:ss|us|is|ous|ics|ys|ness)$/.test(noun) || noun.length < 4) continue;
        if (/\b(?:no|much|more\s+or)\s+$/i.test(text.slice(Math.max(0, m.index - 10), m.index))) continue;
        const s = m.index, e = s + m[1].length;
        add({ rule: "lessfewer", cat: "correctness", label: "GRAMMAR", start: s, end: e, title: "Change the quantifier",
          expl: `It appears that the quantifier ***${m[1]}*** does not fit with the countable noun ***${m[2]}***. Consider changing the quantifier or the noun.`,
          fixes: [{ s, e, t: matchCase(m[1], "fewer") }] });
      } }

    // --- Correctness: comma after introductory words -----------------------------
    { const re = /(^|[.!?]\s+|\n\s*)(however|therefore|furthermore|moreover|additionally|unfortunately|fortunately|consequently|nevertheless|meanwhile|honestly|personally|basically|otherwise|instead(?!\s+of)|of course|in addition|for example|for instance|in conclusion|in fact|as a result|on the other hand)(?=\s+[A-Za-z])/gi; let m;
      while ((m = re.exec(text))) {
        const s = m.index + m[1].length, e = s + m[2].length;
        add({ rule: "intro-comma", cat: "correctness", label: "PUNCTUATION", start: s, end: e, title: "Add a comma",
          expl: `Put a comma after an introductory word or phrase like “${m[2]}.”`, fixes: [{ s, e, t: m[2] + "," }] });
      } }

    // --- Correctness: punctuation spacing -----------------------------------------
    { let m; const re = /(\S)( {2,})(?=\S)/g;
      while ((m = re.exec(text))) {
        const s = m.index + 1, e = s + m[2].length;
        add({ rule: "double-space", cat: "correctness", label: "PUNCTUATION", start: s, end: e, title: "Remove the extra space",
          expl: "There are extra spaces between words. Use a single space.", fixes: [{ s, e, t: " " }] });
      } }
    { let m; const re = /([A-Za-z0-9)])([ \t]+)([,.;:!?])(?![.\d])/g;
      while ((m = re.exec(text))) {
        const s = m.index + 1, e = s + m[2].length + 1;
        add({ rule: "space-punct", cat: "correctness", label: "PUNCTUATION", start: s, end: e, title: "Remove the space",
          expl: "Don’t put a space before punctuation.", fixes: [{ s, e, t: m[3] }] });
      } }
    { let m; const re = /([a-z])([,;])(?=[A-Za-z])|([a-z]{2})(\.)(?=[A-Z][a-z])/g;
      while ((m = re.exec(text))) {
        const p = m[2] || m[4]; const s = m.index + (m[1] || m[3]).length;
        add({ rule: "space-after", cat: "correctness", label: "PUNCTUATION", start: s, end: s + 1, title: "Add a space",
          expl: `Add a space after “${p}”.`, fixes: [{ s, e: s + 1, t: p + " " }] });
      } }

    // --- Correctness: comma splices ------------------------------------------------
    { const re = /,(\s+)(i|you|he|she|it|we|they|this)\s+(am|is|are|was|were|will|would|can|could|have|has|had|do|does|did|should|must|might|starts|seems|looks|feels|makes|gets|goes|[a-z]{3,}ed)\b/gi; let m;
      while ((m = re.exec(text))) {
        const c = m.index; const [ss] = sentenceBounds(text, c);
        const prefix = text.slice(ss, c).trim(); const words = prefix.split(/\s+/).filter(Boolean);
        const w0 = words.length ? words[0].toLowerCase().replace(/[^a-z]/g, "") : "";
        if (words.length < 3 || SUBORDINATORS.has(w0) || /^(?:in|on|at|to|for|with|by|from|during|without|despite|after|before|like|unlike|according|due|following|given|having|being)$/.test(w0)) continue;
        if (/\b(?:said|says|asked|so|and|but|or|yes|no|well)$/i.test(prefix)) continue;
        if (m[2].toLowerCase() === "this" && !/^(is|was)$/i.test(m[3])) continue;
        const pe = c + 1 + m[1].length + m[2].length;
        add({ rule: "splice", cat: "correctness", label: "PUNCTUATION", start: c, end: c + 1, title: "Fix the comma splice",
          expl: "Two complete sentences are joined by only a comma (a comma splice). Use a semicolon or a period instead.",
          fixes: [{ s: c, e: c + 1, t: ";" }, { s: c, e: pe, t: ". " + (m[2] === "i" ? "I" : cap(m[2])) }] });
      } }
    { const re = /([A-Za-z]),(\s+)(however)(,?)(\s)/gi; let m;
      while ((m = re.exec(text))) {
        const c = m.index + 1; const [ss] = sentenceBounds(text, c);
        if (text.slice(ss, c).trim().split(/\s+/).length < 4) continue;
        const e = c + 1 + m[2].length + m[3].length + m[4].length;
        add({ rule: "splice", cat: "correctness", label: "PUNCTUATION", start: c, end: e, title: "Fix the comma splice",
          expl: "When “however” joins two complete sentences, put a semicolon before it and a comma after it.",
          fixes: [{ s: c, e, t: "; " + m[3].toLowerCase() + "," }] });
      } }

    // --- Correctness: missing end punctuation ------------------------------------
    { let base = 0;
      text.split("\n").forEach((line) => {
        const trimmed = line.replace(/\s+$/, "");
        if (trimmed && /[A-Za-z0-9)"”]$/.test(trimmed)) {
          const words = trimmed.trim().split(/\s+/);
          const lastSent = sentences(trimmed).pop();
          if (words.length >= 4 && lastSent) {
            const lt = tokenize(trimmed).pop();
            if (lt && lt.e === trimmed.length) {
              const q = /^(who|what|when|where|why|how|is|are|do|does|did|can|could|would|will|should|shall|may|have|has)\b/i.test(lastSent.text);
              const s = base + lt.s, e = base + lt.e;
              add({ rule: "end-punct", cat: "correctness", label: "PUNCTUATION", start: s, end: e, title: q ? "Add a question mark" : "Add a period",
                expl: "This sentence is missing punctuation at the end.", fixes: [{ s, e, t: lt.w + (q ? "?" : ".") }] });
            }
          }
        }
        base += line.length + 1;
      }); }

    // --- Clarity: passive voice --------------------------------------------------
    { const re = new RegExp("\\b(am|is|are|was|were|be|been|being)\\s+(?:(?:not|also|always|often|never|being|usually|already)\\s+)?([a-z]{3,}ed|" + PASSIVE_IRREG + ")\\b(\\s+by\\b)?", "gi"); let m;
      while ((m = re.exec(text))) {
        const part = m[2].toLowerCase(); if (PASSIVE_SKIP.has(part)) continue;
        if (!m[3] && /ed$/.test(part) && /^(be|been|being)$/i.test(m[1]) === false && /\s+(?:to|with|about|in|of)\b/i.test(text.slice(m.index + m[0].length, m.index + m[0].length + 6))) continue;
        const s = m.index, e = s + m[0].length - (m[3] ? m[3].length : 0);
        const fixes = [];
        const [ss, se] = sentenceBounds(text, s);
        const sent = text.slice(ss, se);
        const pm = /^(.+?)\s+(was|were)\s+([a-z]+ed)\s+by\s+([^,;]+?)([.!?]?)$/i.exec(sent);
        if (pm && pm[1].split(/\s+/).length <= 6 && pm[4].split(/\s+/).length <= 5 && !PASSIVE_SKIP.has(pm[3].toLowerCase())) {
          const subj = /^(the|a|an|this|that|these|those|my|our|your|his|her|their|its)\b/i.test(pm[1]) ? pm[1].charAt(0).toLowerCase() + pm[1].slice(1) : pm[1];
          fixes.push({ s: ss, e: se, t: cap(pm[4].trim()) + " " + pm[3].toLowerCase() + " " + subj + (pm[5] || ".") });
        }
        add({ rule: "passive", cat: "clarity", label: "Clarity: Active voice", pro: fixes.length > 0, start: s, end: e, title: "Rewrite for clarity",
          expl: "This phrase is in the passive voice. Active voice is usually clearer and more direct" + (m[3] ? " — make the one doing the action the subject." : "."), fixes });
      } }

    // --- Clarity: wordy phrases ----------------------------------------------------
    WORDY.forEach(([p, rep]) => {
      const re = phraseRe(p); let m;
      while ((m = re.exec(text))) {
        const s = m.index, e = s + m[0].length;
        let fix;
        if (rep) fix = { s, e, t: isSentenceStart(text, s) ? cap(rep) : matchCase(m[0], rep) };
        else fix = removal(text, s, e);
        add({ rule: "wordy", cat: "clarity", label: "Clarity: Conciseness", start: s, end: e, title: rep ? "Make it concise" : "Remove wordiness",
          expl: rep ? `“${m[0]}” is wordy. “${rep}” says the same thing in fewer words.` : `“${m[0]}” adds words without adding meaning.`, fixes: [fix] });
      }
    });

    // --- Engagement: Vocabulary (multi-option, "Pro") -----------------------------------
    // These outrank clarity rules on overlaps so "a really good" isn't reduced to "remove really".
    const VPRI = 500;
    const vocab = (s, e, phrase, fixes, why) => add({ rule: "vocab", cat: "engagement", label: "Engagement: Vocabulary", pro: true, pri0: VPRI,
      start: s, end: e, title: "Improve word choice", expl: why || `The phrase **${phrase}** is often overused. Consider a more precise alternative to make your writing more engaging.`, fixes });
    const articleBefore = (s) => /\b(?:a|the|another|quick|close|closer|good|first|last|long|this|that)\s+$/i.test(text.slice(Math.max(0, s - 10), s));
    VOCAB.forEach(([p, alts, artAlts]) => {
      const withArt = !/^an?\s/i.test(p);
      const re = new RegExp("\\b" + (withArt ? "(?:(a|an)\\s+)?" : "()") + phraseSrc(p) + "\\b", "gi"); let m;
      while ((m = re.exec(text))) {
        const s = m.index, e = s + m[0].length, art = m[1];
        const body = art ? m[0].slice(m[0].length - m[0].replace(/^an?\s+/i, "").length) : m[0];
        const fixes = art
          ? (artAlts || alts).map((w) => ({ s, e, t: matchCase(art, needsAn(w) ? "an" : "a") + " " + w }))
          : alts.map((w) => ({ s, e, t: isSentenceStart(text, s) ? cap(w) : matchCase(body, w) }));
        vocab(s, e, body.toLowerCase(), fixes);
      }
    });
    VERB_VOCAB.forEach((v) => {
      let m; v.re.lastIndex = 0;
      while ((m = v.re.exec(text))) {
        if (articleBefore(m.index)) continue;
        const s = m.index, e = s + m[0].length, alts = v.forms[m[1].toLowerCase()] || [];
        vocab(s, e, v.phrase, alts.map((w) => ({ s, e, t: matchCase(m[1], w) })));
      }
    });
    { const re = /\b(inspect|check|review|examine|read)\s+((?:[A-Za-z’']+\s+){1,4}?)carefully\b/gi; let m;
      while ((m = re.exec(text))) {
        const s = m.index, e = s + m[0].length;
        vocab(s, e, m[1].toLowerCase() + " … carefully", [{ s, e, t: matchCase(m[1], "scrutinize") + " " + m[2].trim() }],
          `**${m[1]} … carefully** can be replaced with a single, more precise verb: **scrutinize**.`);
      } }

    // --- Clarity: intensifiers ------------------------------------------------------
    { const re = new RegExp("\\b(" + INTENSIFIERS.join("|") + ")\\b(?=\\s+[A-Za-z])", "gi"); let m;
      while ((m = re.exec(text))) {
        const s = m.index, e = s + m[0].length, lw = m[0].toLowerCase();
        const next = (/^\s+([A-Za-z']+)/.exec(text.slice(e)) || [])[1] || "";
        if (/^(much|well|few|many|same|first|last|own|end|top|beginning|least|best|start)$/i.test(next)) continue;
        if (/\b(?:the|this|that|his|her|its|their|my|your|our)\s+$/i.test(text.slice(Math.max(0, s - 8), s))) continue;
        if (lw === "quite" && /^(a|an)$/i.test(next)) continue;
        add({ rule: "intensifier", cat: "clarity", label: "Clarity: Conciseness", start: s, end: e, title: "Remove the intensifier",
          expl: `Intensifiers like “${m[0]}” rarely add meaning. Removing it makes your point stronger and clearer.`, fixes: [removal(text, s, e)] });
      } }

    // --- Engagement: bland / overused words ---------------------------------------------
    Object.keys(BLAND).forEach((p) => {
      const re = phraseRe(p); let m;
      while ((m = re.exec(text))) {
        const s = m.index, e = s + m[0].length;
        if (p === "good" && /^\s+(morning|afternoon|evening|night|luck|bye)\b/i.test(text.slice(e))) continue;
        add({ rule: "bland", cat: "engagement", label: "Engagement: Vocabulary", pro: true, start: s, end: e, title: "Replace the overused word",
          expl: `“${m[0]}” is overused and can make your writing sound bland. Try a more specific word.`,
          fixes: BLAND[p].map((w) => ({ s, e, t: matchCase(m[0], w) })) });
      }
    });

    // --- Delivery: hedging ---------------------------------------------------------------
    if (goals.intent !== "story") {
      const sorted = HEDGES.slice().sort((a, b) => b.length - a.length);
      const re = new RegExp("\\b(" + sorted.map(phraseSrc).join("|") + ")\\b", "gi"); let m;
      while ((m = re.exec(text))) {
        const s = m.index, e = s + m[0].length, lw = norm(m[0]).replace(/\s+/g, " ");
        if (lw === "just" && !/^\s+(wanted|checking|following|wondering|thought|think)\b/i.test(text.slice(e))) continue;
        if ((lw === "kind of" || lw === "sort of") && /\b(?:what|this|that|the|a|any|some|which|every|one|same|that|new|different|other)\s+$/i.test(text.slice(Math.max(0, s - 12), s))) continue;
        add({ rule: "hedge", cat: "delivery", label: "Delivery: Confidence", start: s, end: e, title: "Sound more confident",
          expl: `Hedging language like “${m[0]}” can make you sound unsure. Remove it to sound more confident.`, fixes: [removal(text, s, e)] });
      }
    }

    // --- Delivery: informal language ----------------------------------------------------
    if (goals.formality !== "informal" && goals.domain !== "casual") {
      toks.forEach((t) => {
        const lw = norm(t.w);
        if (!Object.prototype.hasOwnProperty.call(INFORMAL, lw)) return;
        if ((lw === "u" || lw === "ya") && t.w !== lw) return;
        const reps = INFORMAL[lw];
        const fixes = reps.map((r) => r ? { s: t.s, e: t.e, t: isSentenceStart(text, t.s) ? cap(r) : matchCase(t.w, r) } : removal(text, t.s, t.e));
        add({ rule: "informal", cat: "delivery", label: "Delivery: Formality", start: t.s, end: t.e, title: "Avoid informal language",
          expl: `“${t.w}” is informal and may come across as unprofessional.`, fixes });
      });
    }
    if (goals.formality === "formal" || goals.domain === "academic") {
      toks.forEach((t) => {
        const lw = norm(t.w);
        if (!Object.prototype.hasOwnProperty.call(CONTRACTIONS, lw)) return;
        add({ rule: "contraction", cat: "delivery", label: "Delivery: Formality", start: t.s, end: t.e, title: "Expand the contraction",
          expl: "Contractions can sound too casual for formal writing.", fixes: [{ s: t.s, e: t.e, t: isSentenceStart(text, t.s) ? cap(CONTRACTIONS[lw]) : CONTRACTIONS[lw] }] });
      });
    }

    // --- Delivery: repeated punctuation -----------------------------------------------
    { const re = /([!?])\1+|\?!+|!\?+/g; let m;
      while ((m = re.exec(text))) {
        const s = m.index, e = s + m[0].length; const one = m[0].includes("?") ? "?" : "!";
        add({ rule: "punct", cat: "delivery", label: "Delivery: Tone", start: s, end: e, title: "Tone down the punctuation",
          expl: "Repeated punctuation marks can come across as shouting or unprofessional.", fixes: [{ s, e, t: one }] });
      } }

    // --- Clarity: long sentences (wide) -------------------------------------------------
    const limit = goals.audience === "expert" ? 40 : goals.audience === "knowledgeable" ? 35 : 30;
    sentences(text).forEach((st) => {
      const n = (st.text.match(/[A-Za-z0-9’']+/g) || []).length;
      if (n > limit) add({ rule: "long", cat: "clarity", wide: true, start: st.s, end: st.e, title: "Rewrite for clarity", label: "Clarity: Sentence length",
        expl: `This sentence is ${n} words long. Long sentences are hard to follow — consider splitting it into two or more.`, fixes: [] });
    });

    // --- Resolve overlaps: keep the highest-priority narrow issue per span -----------
    issues.sort((a, b) => a.pri - b.pri);
    const kept = [];
    issues.forEach((iss) => {
      if (iss.wide) { kept.push(iss); return; }
      if (iss.end <= iss.start) return;
      const clash = kept.some((k) => !k.wide && iss.start < k.end && k.start < iss.end);
      if (!clash) kept.push(iss);
    });
    kept.sort((a, b) => a.start - b.start || a.pri - b.pri);
    kept.forEach((k, i) => { k.id = "i" + i; k.key = k.rule + "|" + k.orig.toLowerCase() + "|" + text.slice(Math.max(0, k.start - 14), k.start).toLowerCase(); });
    return kept;
  }

  // =====================================================================
  //  Stats, score, tone
  // =====================================================================
  function stats(text) {
    const words = text.match(/[A-Za-z0-9]+(?:['’][A-Za-z]+)*/g) || [];
    const sents = sentences(text);
    const syl = words.reduce((a, w) => a + syllables(w), 0);
    const wc = words.length, sc = Math.max(1, sents.length);
    let flesch = wc ? 206.835 - 1.015 * (wc / sc) - 84.6 * (syl / wc) : 0;
    flesch = Math.max(0, Math.min(100, Math.round(flesch)));
    const label = flesch >= 90 ? "Very easy" : flesch >= 80 ? "Easy" : flesch >= 70 ? "Fairly easy" : flesch >= 60 ? "Standard" : flesch >= 50 ? "Fairly difficult" : flesch >= 30 ? "Difficult" : "Very difficult";
    const uniq = new Set(words.map((w) => w.toLowerCase())).size;
    return { words: wc, chars: text.length, sentences: sents.length, syllables: syl, flesch, label,
      avgSentence: wc ? Math.round((wc / sc) * 10) / 10 : 0, unique: uniq,
      readSec: Math.round(wc / 238 * 60), speakSec: Math.round(wc / 130 * 60) };
  }
  function fmtTime(sec) {
    if (sec < 60) return sec + " sec";
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + " min" + (s >= 30 && m < 10 ? " " + s + " sec" : "");
  }
  function score(issues, words) {
    if (!words) return null;
    const w = issues.reduce((a, i) => a + (i.wide ? 1 : WEIGHT[i.cat]), 0);
    return Math.max(0, Math.min(100, Math.round(100 - (w * 110) / (words + 25))));
  }

  const TONES = {
    Confident: "😎", Friendly: "😊", Formal: "🎩", Casual: "😌", Joyful: "😄", Optimistic: "🙌",
    Appreciative: "🙏", Tentative: "🤔", Concerned: "😟", Direct: "🎯", Neutral: "😐",
  };
  function tone(text, issues) {
    const lw = text.toLowerCase(); const words = lw.match(/[a-z']+/g) || [];
    if (words.length < 3) return [];
    const count = (list) => list.reduce((a, p) => a + ((lw.match(new RegExp("\\b" + phraseSrc(p) + "\\b", "g")) || []).length), 0);
    const per = 100 / Math.max(words.length, 30);
    const hedges = issues.filter((i) => i.rule === "hedge").length;
    const contractions = (lw.match(/\b[a-z]+['’](?:t|re|ve|ll|m|d|s)\b/g) || []).length;
    const excl = (text.match(/!/g) || []).length;
    const avgLen = words.reduce((a, w) => a + w.length, 0) / words.length;
    const sents = sentences(text); const avgSent = words.length / Math.max(1, sents.length);
    const imperative = sents.filter((s) => /^(please\s+)?(send|make|call|review|finish|check|submit|complete|do|let's|lets|bring|share|update|join|read|start|stop|remember|note)\b/i.test(s.text)).length;
    const sc = {
      Confident: (count(["will", "definitely", "certainly", "confident", "sure", "absolutely", "clearly", "must", "guarantee", "know", "proven", "committed"]) * 2 - hedges * 2.5) * per + 2.2,
      Friendly: (count(["thanks", "thank you", "please", "glad", "happy", "hope", "love", "welcome", "hi", "hey", "hello", "cheers", "great", "wonderful", "enjoy", "fun"]) * 2 + excl * 0.6) * per,
      Formal: (count(["sincerely", "regards", "therefore", "furthermore", "moreover", "regarding", "pursuant", "hereby", "accordingly", "consequently", "however", "respectfully", "kindly", "dear"]) * 2.5 - contractions * 0.8) * per + (avgLen - 4.6) * 3,
      Casual: (contractions * 0.9 + count(["gonna", "wanna", "lol", "hey", "yeah", "cool", "stuff", "kinda", "awesome", "guys", "ok", "okay", "btw"]) * 2.5) * per,
      Joyful: (count(["amazing", "awesome", "fantastic", "excited", "love", "fun", "yay", "delighted", "wonderful", "thrilled", "celebrate"]) * 2.5 + excl) * per,
      Optimistic: count(["hope", "future", "improve", "better", "opportunity", "looking forward", "can't wait", "possible", "progress", "growth", "together"]) * 2 * per,
      Appreciative: count(["thank", "thanks", "appreciate", "grateful", "gratitude", "thankful"]) * 3.5 * per,
      Tentative: hedges * 2.6 * per,
      Concerned: count(["worried", "concern", "concerned", "afraid", "unfortunately", "sorry", "problem", "problems", "issue", "issues", "risk", "fear", "anxious", "urgent", "wasted", "frustrated", "stressed", "hassle"]) * 2.2 * per,
      Direct: imperative * 2.5 * per + (avgSent < 12 ? 1.5 : 0),
    };
    const list = Object.keys(sc).map((k) => ({ name: k, v: sc[k] })).filter((t) => t.v >= 1.6).sort((a, b) => b.v - a.v).slice(0, 3);
    if (!list.length) return [{ name: "Neutral", emoji: TONES.Neutral, pct: 60 }];
    const max = list[0].v;
    return list.map((t) => ({ name: t.name, emoji: TONES[t.name], pct: Math.round(35 + 65 * (t.v / max)) }));
  }

  // =====================================================================
  //  Harper (open-source grammar engine by Automattic, Apache-2.0) —
  //  vendored WebAssembly in vendor/harper/, lazy-loaded when the app opens.
  //  The local rules above give an instant result while it loads and add
  //  extra checks on top (Harper wins where the two overlap).
  // =====================================================================
  const HARPER_CAT = {
    Spelling: "correctness", Typo: "correctness", Grammar: "correctness", Agreement: "correctness",
    Capitalization: "correctness", Punctuation: "correctness", BoundaryError: "correctness", Usage: "correctness",
    Eggcorn: "correctness", Malapropism: "correctness", Nonstandard: "correctness", Miscellaneous: "correctness",
    Regionalism: "correctness", Readability: "clarity", Redundancy: "clarity", Repetition: "clarity",
    WordChoice: "correctness", Style: "engagement", Enhancement: "engagement", Formatting: "delivery", Tone: "delivery",
  };
  const HARPER_TITLE = {
    Spelling: "Correct your spelling", Typo: "Correct your spelling", Grammar: "Fix the grammar", Agreement: "Fix the agreement",
    Capitalization: "Capitalize the word", Punctuation: "Fix the punctuation", BoundaryError: "Fix the word spacing",
    Usage: "Change the word", Miscellaneous: "Fix the grammar", Nonstandard: "Change the word", Regionalism: "Check the spelling variant", Eggcorn: "Change the word", Malapropism: "Change the word",
    Readability: "Rewrite for clarity", Redundancy: "Remove wordiness", Repetition: "Remove the repetition",
    WordChoice: "Change the word", Style: "Improve the style", Enhancement: "Improve word choice", Formatting: "Fix the formatting",
  };
  const HARPER_LABEL = {
    Spelling: "SPELLING", Typo: "SPELLING", BoundaryError: "SPELLING", Eggcorn: "SPELLING", Malapropism: "SPELLING", Regionalism: "SPELLING",
    Capitalization: "CAPITALIZATION", Punctuation: "PUNCTUATION", WordChoice: "WORD CHOICE", Usage: "WORD CHOICE", Nonstandard: "WORD CHOICE",
    Readability: "Clarity: Readability", Redundancy: "Clarity: Conciseness", Repetition: "Clarity: Repetition",
    Style: "Engagement: Style", Enhancement: "Engagement: Vocabulary", Formatting: "Delivery: Formatting", Tone: "Delivery: Tone",
  };
  // Damerau-Levenshtein distance (small words only) — used to rank spelling suggestions.
  function editDist(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  function rankSpelling(word, reps) {
    const lw = word.toLowerCase(), known = TYPOS[lw];
    const pre = (r) => { let k = 0; const x = r.toLowerCase(); while (k < x.length && x[k] === lw[k]) k++; return k; };
    return reps.map((r, i) => ({ r, i, score: (known && r.toLowerCase() === known.toLowerCase() ? -100 : 0) + editDist(lw, r) * 10 - pre(r) * 2 + Math.abs(r.length - lw.length) + i * 0.5 }))
      .sort((x, y) => x.score - y.score).map((x) => x.r);
  }
  function grammarlyDict() {
    try { const g = State.data.appData.grammarly; return (g && Array.isArray(g.dictionary)) ? g.dictionary : []; } catch (e) { return []; }
  }
  const Harper = { state: "idle", linter: null, promise: null, error: null, ms: 0 };
  // Dynamic import via Function so this classic script still parses on browsers without import().
  const dynImport = (u) => (new Function("u", "return import(u)"))(u);
  function loadHarper() {
    if (Harper.promise) return Harper.promise;
    Harper.state = "loading";
    const t0 = performance.now();
    Harper.promise = (async () => {
      if (typeof WebAssembly !== "object") throw new Error("WebAssembly is not supported");
      const base = new URL("vendor/harper/", document.baseURI).href;
      const H = await dynImport(base + "index.js");
      const { slimBinary } = await dynImport(base + "slimBinary.js");
      const linter = new H.LocalLinter({ binary: slimBinary });
      await linter.setup();
      await linter.lint("Warm up the engine.", { language: "plaintext" });
      const words = grammarlyDict();
      if (words.length && linter.importWords) { try { await linter.importWords(words); } catch (e) { /* older build */ } }
      Harper.kinds = H.SuggestionKind || { Replace: 0, Remove: 1, InsertAfter: 2 };
      Harper.linter = linter; Harper.state = "ready"; Harper.ms = Math.round(performance.now() - t0);
      return linter;
    })().catch((e) => {
      Harper.state = "failed"; Harper.error = e; Harper.linter = null;
      try { console.warn("[Grammarly] Harper engine unavailable, using built-in rules only:", e); } catch (er) { /* ignore */ }
      return null;
    });
    return Harper.promise;
  }
  // Harper spans count Unicode scalar values; JS strings index UTF-16 units.
  function cpMapper(text) {
    if (!/[\uD800-\uDFFF]/.test(text)) return (i) => i;
    const map = []; let u = 0;
    for (const ch of text) { map.push(u); u += ch.length; }
    map.push(u);
    return (i) => map[Math.max(0, Math.min(map.length - 1, i))];
  }
  // Add words to Harper's user dictionary (our own filter below also hides them).
  async function harperAddWords(words) {
    if (Harper.linter && Harper.linter.importWords) { try { await Harper.linter.importWords(words); } catch (e) { /* ignore */ } }
  }
  async function harperCheck(text, dict) {
    const linter = Harper.linter; if (!linter) return null;
    dict = dict instanceof Set ? dict : new Set((dict || grammarlyDict()).map((w) => String(w).toLowerCase()));
    const lints = await linter.lint(text, { language: "plaintext" });
    const toU16 = cpMapper(text), K = Harper.kinds, out = [];
    lints.forEach((l) => {
      try {
        const sp = l.span(); const s = toU16(sp.start), e = toU16(sp.end);
        const kind = l.lint_kind();
        const cat = HARPER_CAT[kind] || "correctness";
        const orig = text.slice(s, e);
        const isSpell = kind === "Spelling" || kind === "Typo";
        if (isSpell && dict.has(orig.toLowerCase())) { try { l.free(); } catch (er) { /* ignore */ } return; }
        const fixes = [];
        let sugs = (l.suggestions() || []).map((sg) => { const o = { k: sg.kind(), rep: sg.get_replacement_text() }; try { sg.free(); } catch (er) { /* ignore */ } return o; });
        if (kind === "Spelling" && /^[A-Za-z']+$/.test(orig) && sugs.length) {
          const order = rankSpelling(orig, sugs.map((x) => x.rep));
          sugs = order.map((r) => sugs.find((x) => x.rep === r));
          const best = editDist(orig, sugs[0].rep);
          sugs = sugs.filter((x, i) => i === 0 || editDist(orig, x.rep) <= best);
        }
        sugs.slice(0, kind === "Spelling" ? 2 : 3).forEach(({ k, rep }) => {
          if (k === K.Remove) {
            let fe = e; if (text[fe] === " " && (s === 0 || /\s/.test(text[s - 1]))) fe++;
            fixes.push({ s, e: fe, t: "" });
          } else if (k === K.InsertAfter) fixes.push({ s, e, t: orig + rep });
          else fixes.push({ s, e, t: rep });
        });
        const pretty = (l.lint_kind_pretty && l.lint_kind_pretty()) || kind;
        let expl = String(l.message() || "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]*)`/g, "**$1**");
        let title = HARPER_TITLE[kind] || pretty;
        if (kind === "Spelling") expl = `If you don’t want **${orig}** to be marked as misspelled in the future, you can add it to your personal dictionary.`;
        if (kind === "Capitalization" && /^[a-z]/.test(orig) && isSentenceStart(text, s)) expl = `As the first word of the sentence, **${orig}** should be capitalized.`;
        if (kind === "Capitalization" && /^i(?:['’](?:m|ve|ll|d))?$/.test(orig) && !isSentenceStart(text, s)) expl = "The pronoun **I** is always capitalized.";
        out.push({ rule: "harper:" + kind, src: "harper", cat, start: s, end: e, orig, wide: kind === "Readability" || (e - s > 90 && !fixes.length), title,
          label: HARPER_LABEL[kind] || (cat === "correctness" ? "GRAMMAR" : CAT_LABEL[cat] + ": " + pretty), pro: kind === "Enhancement" || kind === "Style",
          dictWord: kind === "Spelling" ? orig : null,
          expl, fixes: fixes.filter((f) => text.slice(f.s, f.e) !== f.t),
          key: "h:" + kind + "|" + orig.toLowerCase() + "|" + text.slice(Math.max(0, s - 14), s).toLowerCase() });
      } catch (er) { /* skip malformed lint */ }
      try { l.free(); } catch (er) { /* ignore */ }
    });
    return out.filter((i) => i.end > i.start || i.fixes.length);
  }
  // Harper first; local issues fill in where they don't overlap a Harper span.
  function mergeIssues(harper, local) {
    const out = harper.map((h) => Object.assign({}, h, { end: Math.max(h.end, h.start + 1) }));
    // Same span + same top fix: keep Harper's issue but use the curated local wording/label.
    out.forEach((h) => {
      const twin = local.find((l) => !l.wide && l.start === h.start && l.end === h.end && l.fixes[0] && h.fixes[0] && l.fixes[0].t === h.fixes[0].t);
      if (twin) Object.assign(h, { title: twin.title, label: twin.label, expl: twin.expl, pro: twin.pro || h.pro });
    });
    local.forEach((l) => {
      if (l.wide) { if (!out.some((h) => h.wide && l.start < h.end && h.start < l.end)) out.push(l); return; }
      if (!out.some((h) => !h.wide && l.start < h.end && h.start < l.end)) out.push(l);
    });
    const seen = new Set();
    const res = out.filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)));
    res.sort((a, b) => a.start - b.start || CAT_RANK[a.cat] - CAT_RANK[b.cat]);
    res.forEach((k, i) => { k.id = "i" + i; });
    return res;
  }

  // Expose the engine for other apps / tests.
  window.GrammarlyEngine = { check, stats, score, tone, TYPOS, WORDY, VOCAB, harper: Harper, loadHarper, harperCheck, harperAddWords, mergeIssues, rankSpelling };

  // =====================================================================
  //  UI
  // =====================================================================
  // Fallback mark (assets/grammarly.png — the real logo — takes precedence wherever Icon is used).
  const LOGO = `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><path d="M12.5 1A10.5 10.5 0 0 1 23 11.5v.5A10.5 10.5 0 0 1 12.5 22.5H1V11.5A10.5 10.5 0 0 1 12.5 1z" fill="#027E6F"/><path d="M16.2 7.6A5.6 5.6 0 1 0 17.9 12H13.2" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="square"/></svg>`;
  if (window.Icon && Icon.register) Icon.register("grammarly", LOGO);

  const IC = {
    newdoc: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>`,
    clear: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>`,
    sample: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z"/><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/></svg>`,
    goals: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`,
    check: `<svg viewBox="0 0 48 48" width="56" height="56" fill="none"><circle cx="24" cy="24" r="22" fill="#027E6F" opacity=".14"/><circle cx="24" cy="24" r="15" fill="#027E6F"/><path d="M17 24.5l5 5 9-10" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    pen: `<svg viewBox="0 0 48 48" width="56" height="56" fill="none"><circle cx="24" cy="24" r="22" fill="#027E6F" opacity=".14"/><path d="M15 33l2.5-7.5L30 13a2.8 2.8 0 0 1 4 4L21.5 29.5zM27.5 15.5l4 4" stroke="#027E6F" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };

  const GOAL_OPTS = {
    audience: { label: "Audience", opts: [["general", "General"], ["knowledgeable", "Knowledgeable"], ["expert", "Expert"]] },
    formality: { label: "Formality", opts: [["informal", "Informal"], ["neutral", "Neutral"], ["formal", "Formal"]] },
    domain: { label: "Domain", opts: [["general", "General"], ["academic", "Academic"], ["business", "Business"], ["email", "Email"], ["casual", "Casual"], ["creative", "Creative"]] },
    intent: { label: "Intent", opts: [["inform", "Inform"], ["describe", "Describe"], ["convince", "Convince"], ["story", "Tell a story"]] },
  };

  function store() {
    const S = State.data;
    if (!S.appData) S.appData = {};
    let g = S.appData.grammarly;
    if (!g || typeof g !== "object") g = S.appData.grammarly = {};
    if (typeof g.text !== "string") g.text = "";
    if (typeof g.title !== "string") g.title = "Untitled document";
    if (!Array.isArray(g.dismissed)) g.dismissed = [];
    if (!g.goals) g.goals = { audience: "general", formality: "neutral", domain: "general", intent: "inform" };
    if (!g.filter) g.filter = "all";
    if (!Array.isArray(g.dictionary)) g.dictionary = [];
    if (!Array.isArray(g.ignoredRules)) g.ignoredRules = [];
    return g;
  }

  AppRegistry.grammarly = function (createWindow) {
    const make = (typeof createWindow === "function" ? createWindow : null) || window.WM.createWindow;
    const g = store();
    const W = Math.max(360, Math.min(1024, window.innerWidth - 40));
    const H = Math.max(360, Math.min(700, window.innerHeight - 100));
    const { body, win } = make({ title: "Grammarly", icon: window.Icon ? Icon.mini("grammarly", "Grammarly") : "", width: W, height: H, appId: "grammarly" });
    body.style.overflow = "hidden";
    body.innerHTML = `<div class="gmr-app">
      <header class="gmr-top">
        <div class="gmr-brand" title="Grammarly"><img class="gmr-logo" src="assets/grammarly_mark_128.png" alt="" onerror="this.style.display='none'"><img class="gmr-wordmark" src="assets/grammarly_wordmark.png" alt="grammarly"></div>
        <input class="gmr-title" type="text" spellcheck="false" aria-label="Document title" placeholder="Untitled document">
        <div class="gmr-tools">
          <button class="gmr-tbtn" data-act="new" title="New document">${IC.newdoc}<span>New</span></button>
          <button class="gmr-tbtn" data-act="copy" title="Copy text">${IC.copy}<span>Copy</span></button>
          <button class="gmr-tbtn" data-act="clear" title="Clear text">${IC.clear}<span>Clear</span></button>
          <button class="gmr-tbtn" data-act="goals" title="Set goals">${IC.goals}<span>Goals</span></button>
          <button class="gmr-tbtn gmr-primary" data-act="sample" title="Load a sample paragraph with mistakes">${IC.sample}<span>Try sample</span></button>
        </div>
      </header>
      <div class="gmr-main">
        <section class="gmr-editor">
          <div class="gmr-scroll">
            <div class="gmr-paper">
              <div class="gmr-back gmr-text" aria-hidden="true"></div>
              <textarea class="gmr-ta gmr-text" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Document text" placeholder="Type or paste (Ctrl+V) your text here, or press “Try sample” to see Grammarly in action."></textarea>
            </div>
          </div>
          <footer class="gmr-status"></footer>
        </section>
        <aside class="gmr-side" aria-label="Suggestions">
          <div class="gmr-head">
            <div class="gmr-score" title="Overall score"></div>
            <div class="gmr-head-txt">
              <div class="gmr-head-k">Overall score</div>
              <div class="gmr-head-v"></div>
            </div>
            <button class="gmr-tone" title="Tone detector — click to set goals"></button>
          </div>
          <div class="gmr-filters" role="tablist"></div>
          <div class="gmr-sidescroll">
            <div class="gmr-bulk"></div>
            <div class="gmr-list"></div>
            <div class="gmr-dots" role="tablist" aria-label="Suggestions"></div>
            <div class="gmr-insights"></div>
          </div>
        </aside>
      </div>
      <div class="gmr-modal" hidden></div>
      <div class="gmr-toast" role="status" aria-live="polite"></div>
    </div>`;

    const root = body.querySelector(".gmr-app");
    const ta = root.querySelector(".gmr-ta"), back = root.querySelector(".gmr-back"), scroller = root.querySelector(".gmr-scroll");
    const titleIn = root.querySelector(".gmr-title"), statusEl = root.querySelector(".gmr-status");
    const scoreEl = root.querySelector(".gmr-score"), scoreTxt = root.querySelector(".gmr-head-v"), toneBtn = root.querySelector(".gmr-tone");
    const filtersEl = root.querySelector(".gmr-filters"), listEl = root.querySelector(".gmr-list"), bulkEl = root.querySelector(".gmr-bulk");
    const insightsEl = root.querySelector(".gmr-insights"), modal = root.querySelector(".gmr-modal"), toastEl = root.querySelector(".gmr-toast");
    const sideScroll = root.querySelector(".gmr-sidescroll"), dotsEl = root.querySelector(".gmr-dots");

    let issues = [], lastText = g.text, activeKey = null, timer = 0, saveTimer = 0, undoBuf = null, toastTimer = 0;
    ta.value = g.text; titleIn.value = g.title;

    const visible = () => issues.filter((i) => !g.dismissed.includes(i.key) && !g.ignoredRules.includes(i.rule));
    const shown = () => visible().filter((i) => g.filter === "all" || i.cat === g.filter);

    function save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { g.text = ta.value; g.title = titleIn.value; try { State.save(); } catch (e) { /* storage full */ } }, 400);
    }
    function toast(msg, action) {
      clearTimeout(toastTimer);
      toastEl.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button class="gmr-toast-btn">${esc(action.label)}</button>` : "");
      toastEl.classList.add("show");
      if (action) toastEl.querySelector(".gmr-toast-btn").onclick = () => { action.run(); toastEl.classList.remove("show"); };
      toastTimer = setTimeout(() => toastEl.classList.remove("show"), action ? 6000 : 2200);
    }

    // ---- editor backdrop (underlines) ----
    function renderBack() {
      const text = ta.value, list = shown();
      if (!list.length) { back.innerHTML = esc(text) + " "; return; }
      const pts = new Set([0, text.length]);
      list.forEach((i) => { pts.add(Math.max(0, Math.min(text.length, i.start))); pts.add(Math.max(0, Math.min(text.length, i.end))); });
      const arr = [...pts].sort((a, b) => a - b);
      let html = "";
      for (let k = 0; k < arr.length - 1; k++) {
        const a = arr[k], b = arr[k + 1], seg = text.slice(a, b);
        const cover = list.filter((i) => i.start <= a && i.end >= b);
        if (!cover.length) { html += esc(seg); continue; }
        const narrow = cover.filter((i) => !i.wide);
        const best = (narrow.length ? narrow : cover).sort((x, y) => (x.end - x.start) - (y.end - y.start))[0];
        const on = cover.some((i) => i.key === activeKey);
        html += `<mark class="gmr-u gmr-u-${best.cat}${best.wide ? " gmr-wide" : ""}${on ? " gmr-on" : ""}" data-key="${esc(best.key)}">${esc(seg)}</mark>`;
      }
      back.innerHTML = html + " ";
    }

    // Shift existing underlines after a local edit so they track the text until the re-check.
    function shiftIssues(oldT, newT) {
      const ol = oldT.length, nl = newT.length; let p = 0;
      while (p < ol && p < nl && oldT[p] === newT[p]) p++;
      let s = 0; while (s < ol - p && s < nl - p && oldT[ol - 1 - s] === newT[nl - 1 - s]) s++;
      const oe = ol - s, d = nl - ol;
      issues = issues.filter((i) => i.end <= p || i.start >= oe).map((i) => {
        if (i.start < oe) return i;
        return Object.assign({}, i, { start: i.start + d, end: i.end + d, fixes: i.fixes.map((f) => ({ s: f.s + d, e: f.e + d, t: f.t })) });
      });
    }

    // Local rules run instantly; Harper (when loaded) re-checks asynchronously and its
    // results replace overlapping local ones. Until it answers, Harper's previous
    // underlines (shifted with the edits) stay so nothing flickers.
    let harperBusy = false, harperPending = false;
    function runCheck() {
      clearTimeout(timer);
      const text = ta.value;
      const local = check(text, g.goals, g.dictionary);
      const prevH = issues.filter((i) => i.src === "harper" && text.slice(i.start, i.end) === i.orig);
      issues = prevH.length ? mergeIssues(prevH, local) : local;
      lastText = text;
      runHarper();
      // forget dismissals that no longer match anything (keeps the list small)
      const keys = new Set(issues.map((i) => i.key));
      if (g.dismissed.length > 200) g.dismissed = g.dismissed.filter((k) => keys.has(k));
      renderAll();
      save();
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(runCheck, 350); };
    async function runHarper() {
      if (!Harper.linter) return;
      if (harperBusy) { harperPending = true; return; }
      harperBusy = true;
      const text = ta.value;
      let res = null;
      try { res = await harperCheck(text, g.dictionary); } catch (e) { res = null; }
      harperBusy = false;
      if (!root.isConnected) return;
      if (res && ta.value === text) { issues = mergeIssues(res, check(text, g.goals, g.dictionary)); renderAll(); }
      if (harperPending) { harperPending = false; runHarper(); }
    }
    function engineChip() {
      if (Harper.state === "ready") return `<a class="gmr-engine ok" href="https://github.com/Automattic/harper" target="_blank" rel="noopener" title="Harper is an open-source grammar checker by Automattic (Apache-2.0). It runs locally in your browser via WebAssembly — your text never leaves this device.">Powered by Harper (open source)</a>`;
      if (Harper.state === "failed") return `<span class="gmr-engine off" title="The Harper engine could not load in this browser. Built-in rules are still checking your text.">Built-in rules only</span>`;
      return `<span class="gmr-engine busy"><i class="gmr-spin"></i>Loading Harper engine…</span>`;
    }

    // ---- sidebar ----
    function renderHeader() {
      const st = stats(ta.value), vis = visible();
      const sc = score(vis, st.words);
      const C = 2 * Math.PI * 21, pct = sc == null ? 0 : sc / 100;
      const col = sc == null ? "var(--gmr-dim)" : sc >= 85 ? "var(--gmr-brand)" : sc >= 65 ? "#f2a33a" : "#e5484d";
      scoreEl.innerHTML = `<svg viewBox="0 0 50 50" width="54" height="54"><circle cx="25" cy="25" r="21" fill="none" stroke="var(--gmr-track)" stroke-width="4.5"/>
        <circle cx="25" cy="25" r="21" fill="none" stroke="${col}" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 25 25)"/></svg><b>${sc == null ? "—" : sc}</b>`;
      scoreTxt.textContent = sc == null ? "Start writing" : vis.length === 0 ? "Looking great!" : vis.length + " suggestion" + (vis.length === 1 ? "" : "s");
      const tones = tone(ta.value, vis);
      toneBtn.innerHTML = tones.length
        ? `<span class="gmr-tone-emo">${tones.map((t) => t.emoji).slice(0, 2).join("")}</span><span class="gmr-tone-lbl">${esc(tones[0].name)}</span>`
        : `<span class="gmr-tone-emo">${IC.goals}</span><span class="gmr-tone-lbl">Goals</span>`;
      toneBtn.title = tones.length ? "Sounds " + tones.map((t) => t.name.toLowerCase()).join(", ") + " — click to set goals" : "Set goals";
      // filters
      const counts = { all: vis.length }; CATS.forEach((c) => { counts[c] = vis.filter((i) => i.cat === c).length; });
      filtersEl.innerHTML = [["all", "All"]].concat(CATS.map((c) => [c, CAT_LABEL[c]])).map(([k, lbl]) =>
        `<button role="tab" aria-selected="${g.filter === k}" class="gmr-filter gmr-f-${k}${g.filter === k ? " on" : ""}" data-f="${k}"><span class="gmr-f-n">${counts[k]}</span><span class="gmr-f-l">${lbl}</span></button>`).join("");
      // status bar
      statusEl.innerHTML = st.words
        ? `<span><b>${st.words}</b> word${st.words === 1 ? "" : "s"}</span><span>${st.chars} characters</span><span>${fmtTime(st.readSec)} read</span><span class="gmr-st-read">Readability <b>${st.flesch}</b> · ${st.label}</span>${engineChip()}`
        : `<span>0 words</span><span>Start typing to get suggestions</span>${engineChip()}`;
      // insights
      if (!st.words) { insightsEl.innerHTML = ""; return; }
      const goalNote = (() => {
        const names = tones.map((t) => t.name);
        if (g.goals.formality === "formal" && names.includes("Casual")) return "Your goal is <b>Formal</b>, but this sounds casual.";
        if (g.goals.formality === "informal" && names.includes("Formal")) return "Your goal is <b>Informal</b>, but this sounds formal.";
        if (names.includes("Tentative")) return "Remove hedging words to sound more confident.";
        return "Your tone matches your goals.";
      })();
      insightsEl.innerHTML = `<div class="gmr-ins-card">
          <div class="gmr-ins-h">Tone detector</div>
          ${tones.map((t) => `<div class="gmr-tone-row"><span class="gmr-tone-e">${t.emoji}</span><span class="gmr-tone-n">${esc(t.name)}</span><span class="gmr-bar"><i style="width:${t.pct}%"></i></span></div>`).join("")}
          <div class="gmr-ins-note">${goalNote}</div>
        </div>
        <div class="gmr-ins-card">
          <div class="gmr-ins-h">Document stats</div>
          <div class="gmr-kv"><span>Words</span><b>${st.words}</b></div>
          <div class="gmr-kv"><span>Characters</span><b>${st.chars}</b></div>
          <div class="gmr-kv"><span>Sentences</span><b>${st.sentences}</b></div>
          <div class="gmr-kv"><span>Reading time</span><b>${fmtTime(st.readSec)}</b></div>
          <div class="gmr-kv"><span>Speaking time</span><b>${fmtTime(st.speakSec)}</b></div>
          <div class="gmr-kv"><span>Avg. sentence length</span><b>${st.avgSentence} words</b></div>
          <div class="gmr-kv"><span>Unique words</span><b>${st.unique}</b></div>
        </div>
        <div class="gmr-ins-card">
          <div class="gmr-ins-h">Readability</div>
          <div class="gmr-read"><b>${st.flesch}</b><span>${st.label}<small>Flesch reading-ease score. Higher is easier to read.</small></span></div>
          <span class="gmr-bar gmr-bar-read"><i style="width:${st.flesch}%"></i></span>
        </div>
        <div class="gmr-about">${Harper.state === "ready"
          ? `Checks are powered by <a href="https://github.com/Automattic/harper" target="_blank" rel="noopener">Harper</a>, the open-source grammar checker by Automattic (Apache-2.0), running offline in your browser — plus built-in clarity, engagement and tone rules.`
          : Harper.state === "failed" ? "Harper couldn’t load in this browser, so the built-in offline rules are checking your text."
          : "Loading Harper, the open-source grammar engine… Built-in rules are checking your text meanwhile."}</div>`;
    }

    // ---- suggestion cards ----
    // Explanation markup: ***x*** = bold italic, **x** = bold, “x” = bold.
    function richExpl(t) {
      return esc(t).replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/“([^”]{1,48})”/g, "<strong>$1</strong>");
    }
    const clip = (x, n) => (x.length > n ? x.slice(0, n - 1) + "…" : x);
    function delText(raw, ins) {
      const t = raw.trim();
      if (!t || t === ins.trim()) return `<del class="gmr-ws">${raw.replace(/ /g, "␣") || "␣"}</del>`;
      return `<del>${esc(clip(t, 90))}</del>`;
    }
    // The sentence (±6 words) with the flagged text struck through and the fix inserted after it.
    function previewHTML(iss, plain) {
      const text = ta.value, f = plain ? null : iss.fixes[0];
      const s = f ? f.s : iss.start, e = f ? f.e : iss.end;
      const [ss, se] = sentenceBounds(text, Math.min(s, Math.max(0, text.length - 1)));
      const leftRaw = text.slice(Math.min(ss, s), s), rightRaw = text.slice(e, Math.max(se, e)).replace(/\n[\s\S]*$/, "");
      const lm = /(?:\S+\s+){0,6}\S*$/.exec(leftRaw), rm = /^\S*(?:\s+\S+){0,6}/.exec(rightRaw);
      let left = lm ? lm[0] : "", right = rm ? rm[0] : "";
      if (iss.wide && !iss.fixes.length) { left = ""; right = ""; }
      const pre = left.length < leftRaw.trimStart().length ? "…" : "", post = right.length < rightRaw.trimEnd().length ? "…" : "";
      let mid;
      if (f) {
        const raw = text.slice(f.s, f.e), ins = f.t.trim();
        mid = delText(raw, f.t) + (ins ? ` <ins>${esc(clip(ins, 110))}</ins>` : "");
        if (!raw.trim() && !ins) mid = `<del class="gmr-ws">${raw.replace(/ /g, "␣")}</del>`;
      } else mid = `<mark class="gmr-pv-${iss.cat}">${esc(clip(text.slice(s, e), 160))}</mark>`;
      return `${pre}${esc(left)}${mid}${esc(right)}${post}`;
    }
    function chipsHTML(iss) {
      if (iss.fixes.length < (iss.cat === "engagement" || iss.pro ? 1 : 2)) return "";
      const f0 = iss.fixes[0], raw = ta.value.slice(f0.s, f0.e);
      return `<div class="gmr-fixrow">${delText(raw, f0.t)}<span class="gmr-arr" aria-hidden="true">→</span>${iss.fixes.map((f, fi) =>
        `<button class="gmr-chip" data-fi="${fi}" title="Apply “${esc(f.t.trim() || "remove")}”">${esc(clip(f.t.trim() || "Remove", 60))}</button>`).join("")}</div>`;
    }
    const CAT_ICON = {
      correctness: `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="9.2" fill="var(--gmr-red-soft)"/><circle cx="10" cy="10" r="6.4" fill="none" stroke="var(--gmr-red)" stroke-width="1.5"/><path d="M7.7 12.9 10 7l2.3 5.9M8.5 11h3" fill="none" stroke="var(--gmr-red)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      clarity: `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="9.2" fill="var(--gmr-blue-soft)"/><circle cx="10" cy="10" r="6.4" fill="none" stroke="var(--gmr-blue)" stroke-width="1.5"/><path d="M7.7 12.9 10 7l2.3 5.9M8.5 11h3" fill="none" stroke="var(--gmr-blue)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      engagement: `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><rect x="5.5" y="2.5" width="9" height="15" rx="4.5" fill="#16D9A7"/><rect x="4" y="9" width="12" height="2" rx="1" fill="#fff"/></svg>`,
      delivery: `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="9.2" fill="var(--gmr-purple-soft)"/><circle cx="10" cy="10" r="6.4" fill="none" stroke="var(--gmr-purple)" stroke-width="1.5"/><path d="M7.7 12.9 10 7l2.3 5.9M8.5 11h3" fill="none" stroke="var(--gmr-purple)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    };
    const IC_DICT = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H14v18H6.5A1.5 1.5 0 0 1 5 19.5z"/><path d="M5 18.5A1.5 1.5 0 0 1 6.5 17H14"/><path d="M18.5 3v5M16 5.5h5"/></svg>`;
    const IC_STAR = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/></svg>`;
    const canDict = (i) => !!(i.dictWord && /^[A-Za-z][A-Za-z'’-]*$/.test(i.dictWord));
    const labelOf = (i) => i.label || (i.cat === "correctness" ? "GRAMMAR" : CAT_LABEL[i.cat]);
    let menuKey = null;
    const isCarousel = () => root.classList.contains("gmr-carousel");

    function cardHTML(i, open) {
      const lbl = labelOf(i), upper = lbl === lbl.toUpperCase();
      const chips = open ? chipsHTML(i) : "";
      return `<div class="gmr-card gmr-c-${i.cat}${open ? " open" : ""}${i.key === activeKey ? " act" : ""}" data-key="${esc(i.key)}" tabindex="0" role="button" aria-expanded="${open}">
        <div class="gmr-card-top">
          <span class="gmr-ic">${CAT_ICON[i.cat]}</span>
          <span class="gmr-card-title">${esc(i.title)}</span>
          ${i.pro ? `<span class="gmr-pro" title="Premium-style suggestion (free here)">${IC_STAR}Pro</span>` : ""}
          <button class="gmr-more" data-act="more" aria-label="More options" aria-haspopup="menu" title="More options">⋯</button>
        </div>
        ${open ? `<div class="gmr-card-lbl${upper ? " up" : ""}">${esc(lbl)}</div>` : ""}
        <div class="gmr-pv">${previewHTML(i, !!(chips && (i.cat === "engagement" || i.pro)))}</div>
        ${open ? `${chips}
          <p class="gmr-expl">${richExpl(i.expl)}</p>
          <div class="gmr-card-actions">
            ${i.fixes.length ? `<button class="gmr-accept" data-act="accept">Accept</button>` : ""}
            <button class="gmr-dismiss" data-act="dismiss">Dismiss</button>
            ${canDict(i) ? `<button class="gmr-dictbtn" data-act="adddict" title="Add “${esc(i.dictWord)}” to dictionary" aria-label="Add to dictionary">${IC_DICT}</button>` : ""}
          </div>` : ""}
        ${menuKey === i.key ? `<div class="gmr-menu" role="menu">
            <button role="menuitem" data-act="dismiss">Dismiss</button>
            ${canDict(i) ? `<button role="menuitem" data-act="adddict">Add to dictionary</button>` : ""}
            <button role="menuitem" data-act="ignoreall">Ignore all like this</button>
            ${i.fixes.length ? `<button role="menuitem" data-act="copysug">Copy suggestion</button>` : ""}
          </div>` : ""}
      </div>`;
    }

    function renderList() {
      const list = shown(); const text = ta.value;
      bulkEl.innerHTML = ""; dotsEl.innerHTML = "";
      if (!text.trim()) {
        listEl.innerHTML = `<div class="gmr-empty">${IC.pen}<b>Nothing to check yet</b><p>Start writing or paste your text, and suggestions will appear here.</p><button class="gmr-btn gmr-btn-pri" data-act="sample">Try sample text</button></div>`;
        return;
      }
      if (!list.length) {
        listEl.innerHTML = `<div class="gmr-empty">${IC.check}<b>${g.filter === "all" ? "You’re all set!" : "No " + CAT_LABEL[g.filter].toLowerCase() + " suggestions"}</b><p>${g.filter === "all" ? "No suggestions right now. Keep writing — we’re checking as you type." : "Choose another category to see more suggestions."}</p></div>`;
        return;
      }
      const fixable = list.filter((i) => i.cat === "correctness" && i.fixes.length);
      if (fixable.length > 1 && !isCarousel()) bulkEl.innerHTML = `<button class="gmr-bulk-btn" data-act="acceptall">Accept all ${fixable.length} correctness fixes</button>`;
      if (!activeKey || !list.some((i) => i.key === activeKey)) activeKey = list[0].key;
      const all = isCarousel();
      const keepLeft = listEl.scrollLeft;
      listEl.innerHTML = list.map((i) => cardHTML(i, all || i.key === activeKey)).join("");
      if (all) {
        listEl.scrollLeft = keepLeft;
        dotsEl.innerHTML = list.length > 1 ? list.map((i, k) => `<button class="gmr-dot-b" data-dot="${k}" aria-label="Suggestion ${k + 1} of ${list.length}"></button>`).join("") : "";
        updateDots();
      }
    }
    function updateDots() {
      if (!isCarousel()) return;
      const cards = listEl.children; if (!cards.length) return;
      const w = cards[0].offsetWidth + 12;
      const idx = Math.max(0, Math.min(cards.length - 1, Math.round(listEl.scrollLeft / w)));
      [...dotsEl.children].forEach((d, k) => d.classList.toggle("on", k === idx));
    }

    function renderAll() { renderBack(); renderHeader(); renderList(); }

    function scrollMarkIntoView(key) {
      const m = back.querySelector(`mark[data-key="${CSS.escape(key)}"]`); if (!m) return;
      const top = m.offsetTop, h = m.offsetHeight, vt = scroller.scrollTop, vh = scroller.clientHeight;
      if (top < vt + 20 || top + h > vt + vh - 20) scroller.scrollTo({ top: Math.max(0, top - vh / 3), behavior: "smooth" });
    }
    function scrollCardIntoView(key) {
      const c = listEl.querySelector(`.gmr-card[data-key="${CSS.escape(key)}"]`); if (!c) return;
      if (isCarousel()) { listEl.scrollTo({ left: c.offsetLeft - listEl.offsetLeft - (listEl.clientWidth - c.offsetWidth) / 2, behavior: "smooth" }); return; }
      const top = c.offsetTop - sideScroll.offsetTop, vt = sideScroll.scrollTop, vh = sideScroll.clientHeight;
      if (top < vt || top + c.offsetHeight > vt + vh) sideScroll.scrollTo({ top: Math.max(0, top - 12), behavior: "smooth" });
    }
    function setActive(key, from) {
      activeKey = key;
      renderBack(); renderList();
      if (from !== "text") scrollMarkIntoView(key);
      if (from !== "card") scrollCardIntoView(key);
    }

    // Replace a range in the textarea, keeping native undo where the browser supports it.
    function replaceRange(s, e, t) {
      const before = ta.value, expected = before.slice(0, s) + t + before.slice(e);
      const st = scroller.scrollTop;
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(s, e);
      let ok = false;
      try { ok = t ? document.execCommand("insertText", false, t) : document.execCommand("delete"); } catch (err) { ok = false; }
      if (!ok || ta.value !== expected) { ta.value = expected; ta.setSelectionRange(s + t.length, s + t.length); }
      scroller.scrollTop = st;
      lastText = ta.value;
    }
    function accept(iss, fi) {
      const f = iss.fixes[fi || 0]; if (!f) return;
      replaceRange(f.s, f.e, f.t);
      activeKey = null;
      runCheck();
    }
    function addToDict(iss) {
      const w = iss.dictWord; if (!w) return;
      if (!g.dictionary.some((x) => x.toLowerCase() === w.toLowerCase())) g.dictionary.push(w.toLowerCase());
      harperAddWords([w.toLowerCase(), w]);
      activeKey = null; menuKey = null; runCheck();
      toast(`Added “${w}” to your dictionary`, { label: "Undo", run: () => { g.dictionary = g.dictionary.filter((x) => x !== w.toLowerCase()); runCheck(); } });
    }
    function copyText(t, msg) {
      const done = () => toast(msg);
      const fallback = () => { const x = document.createElement("textarea"); x.value = t; x.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(x); x.select(); try { document.execCommand("copy"); } catch (err) { /* ignore */ } x.remove(); done(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
    }
    function dismiss(iss) {
      if (!g.dismissed.includes(iss.key)) g.dismissed.push(iss.key);
      activeKey = null; renderAll(); save();
    }
    function acceptAll() {
      const list = shown().filter((i) => i.cat === "correctness" && i.fixes.length).map((i) => i.fixes[0]).sort((a, b) => b.s - a.s);
      let text = ta.value, lastStart = Infinity, n = 0;
      list.forEach((f) => { if (f.e <= lastStart) { text = text.slice(0, f.s) + f.t + text.slice(f.e); lastStart = f.s; n++; } });
      replaceRange(0, ta.value.length, text);
      activeKey = null; runCheck();
      toast(`Applied ${n} fix${n === 1 ? "" : "es"}`);
    }

    function setText(text, title) {
      const prev = { text: ta.value, title: titleIn.value, dismissed: g.dismissed.slice() };
      replaceRange(0, ta.value.length, text);
      if (title != null) titleIn.value = title;
      g.dismissed = []; activeKey = null;
      scroller.scrollTop = 0;
      runCheck();
      return prev;
    }
    function restore(prev) { setText(prev.text, prev.title); g.dismissed = prev.dismissed; runCheck(); }

    // ---- goals modal ----
    function openGoals() {
      modal.hidden = false;
      modal.innerHTML = `<div class="gmr-dlg" role="dialog" aria-modal="true" aria-label="Set goals">
        <div class="gmr-dlg-h"><b>Set goals</b><button class="gmr-x" data-act="close" aria-label="Close">×</button></div>
        <p class="gmr-dlg-sub">Get tailored writing suggestions based on your goals and audience.</p>
        ${Object.keys(GOAL_OPTS).map((k) => `<div class="gmr-goal"><div class="gmr-goal-l">${GOAL_OPTS[k].label}</div><div class="gmr-seg">${GOAL_OPTS[k].opts.map(([v, l]) => `<button data-goal="${k}" data-v="${v}" class="${g.goals[k] === v ? "on" : ""}">${l}</button>`).join("")}</div></div>`).join("")}
        <div class="gmr-goal"><div class="gmr-goal-l">Personal dictionary &amp; ignored rules</div>
          <div class="gmr-dlg-sub" style="margin:0 0 6px">${g.dictionary.length ? g.dictionary.map(esc).join(", ") : "No words added yet."}${g.ignoredRules.length ? ` · ${g.ignoredRules.length} rule${g.ignoredRules.length === 1 ? "" : "s"} ignored` : ""}</div>
          ${g.dictionary.length || g.ignoredRules.length ? `<button class="gmr-btn" data-act="cleardict">Clear dictionary &amp; ignored rules</button>` : ""}</div>
        <div class="gmr-dlg-f"><button class="gmr-btn" data-act="reset">Reset to defaults</button><button class="gmr-btn gmr-btn-pri" data-act="close">Done</button></div>
      </div>`;
    }
    modal.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (e.target === modal || (b && b.dataset.act === "close")) { modal.hidden = true; return; }
      if (!b) return;
      if (b.dataset.goal) { g.goals[b.dataset.goal] = b.dataset.v; openGoals(); runCheck(); }
      else if (b.dataset.act === "cleardict") { g.dictionary = []; g.ignoredRules = []; if (Harper.linter && Harper.linter.clearWords) Harper.linter.clearWords().catch(() => {}); openGoals(); runCheck(); }
      else if (b.dataset.act === "reset") { g.goals = { audience: "general", formality: "neutral", domain: "general", intent: "inform" }; openGoals(); runCheck(); }
    });

    // ---- events ----
    ta.addEventListener("input", () => {
      shiftIssues(lastText, ta.value); lastText = ta.value;
      renderBack(); schedule();
    });
    const caretPick = () => {
      if (ta.selectionStart !== ta.selectionEnd) return;
      const p = ta.selectionStart;
      const hit = shown().filter((i) => i.start <= p && p <= i.end).sort((a, b) => (a.wide ? 1 : 0) - (b.wide ? 1 : 0) || (a.end - a.start) - (b.end - b.start))[0];
      if (hit && hit.key !== activeKey) setActive(hit.key, "text");
    };
    ta.addEventListener("click", caretPick);
    ta.addEventListener("keyup", (e) => { if (/^Arrow|Home|End/.test(e.key)) caretPick(); });
    titleIn.addEventListener("input", save);

    root.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      const act = b && b.dataset.act;
      if (b && b.dataset.f) { g.filter = b.dataset.f; activeKey = null; renderAll(); save(); return; }
      if (act === "sample") { const prev = setText(SAMPLE, "Team update (sample)"); toast("Sample text loaded — try accepting a suggestion", { label: "Undo", run: () => restore(prev) }); return; }
      if (act === "new") { const prev = setText("", "Untitled document"); ta.focus(); if (prev.text.trim()) toast("New document created", { label: "Undo", run: () => restore(prev) }); return; }
      if (act === "clear") { const prev = setText("", null); ta.focus(); if (prev.text.trim()) toast("Text cleared", { label: "Undo", run: () => restore(prev) }); return; }
      if (act === "copy") {
        const t = ta.value; if (!t) { toast("Nothing to copy yet"); return; }
        const fallback = () => { ta.focus(); ta.select(); try { document.execCommand("copy"); } catch (err) { /* ignore */ } ta.setSelectionRange(t.length, t.length); toast("Text copied to clipboard"); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast("Text copied to clipboard"), fallback); else fallback();
        return;
      }
      if (act === "goals") { openGoals(); return; }
      if (act === "acceptall") { acceptAll(); return; }
      if (b && b.dataset.dot != null) { const c = listEl.children[+b.dataset.dot]; if (c) setActive(c.dataset.key, "dot"); return; }
      const card = e.target.closest(".gmr-card");
      if (!card) { if (menuKey) { menuKey = null; renderList(); } if (e.target.closest(".gmr-tone")) openGoals(); return; }
      const iss = shown().find((i) => i.key === card.dataset.key); if (!iss) return;
      if (act === "more") { menuKey = menuKey === iss.key ? null : iss.key; renderList(); return; }
      const hadMenu = menuKey; menuKey = null;
      if (b && b.dataset.fi != null) { accept(iss, +b.dataset.fi); return; }
      if (act === "accept") { accept(iss, 0); return; }
      if (act === "dismiss") { dismiss(iss); return; }
      if (act === "adddict") { addToDict(iss); return; }
      if (act === "ignoreall") { if (!g.ignoredRules.includes(iss.rule)) g.ignoredRules.push(iss.rule); activeKey = null; renderAll(); save(); toast("Ignoring all suggestions like this", { label: "Undo", run: () => { g.ignoredRules = g.ignoredRules.filter((r) => r !== iss.rule); renderAll(); save(); } }); return; }
      if (act === "copysug") { copyText(iss.fixes[0].t.trim(), "Suggestion copied"); renderList(); return; }
      if (hadMenu) { renderList(); return; }
      if (card.classList.contains("open") && !isCarousel()) { if (e.target.closest(".gmr-card-top")) { activeKey = "__none__"; renderBack(); renderList(); } return; }
      if (iss.key !== activeKey) setActive(iss.key, "card");
    });
    listEl.addEventListener("keydown", (e) => {
      const card = e.target.closest(".gmr-card");
      if (card && (e.key === "Enter" || e.key === " ") && e.target === card) { e.preventDefault(); setActive(card.dataset.key, "card"); }
    });

    // Carousel mode for narrow windows (e.g. iPad split view): swipeable cards with page dots.
    listEl.addEventListener("scroll", () => { if (isCarousel()) requestAnimationFrame(updateDots); }, { passive: true });
    const applyMode = () => {
      const on = root.clientWidth > 0 && root.clientWidth < 520;
      if (on !== isCarousel()) { root.classList.toggle("gmr-carousel", on); renderList(); if (on && activeKey) scrollCardIntoView(activeKey); }
    };
    if (window.ResizeObserver) new ResizeObserver(applyMode).observe(root);
    applyMode();

    runCheck();
    if (Harper.state !== "ready") loadHarper().then(() => { if (root.isConnected) runCheck(); });
    if (!g.text) setTimeout(() => ta.focus({ preventScroll: true }), 50);
    return { win, body };
  };
})();
