/* The Sims — a life simulation in the spirit of Maxis' 2000 original.
   Isometric lot with walls-down cutaway, 8 motives (Hunger, Comfort, Hygiene, Bladder,
   Energy, Fun, Social, Room) and the mood plumbob, pie menus, an action queue, free will,
   Create-a-Sim with the 5 personality traits, Buy mode, skills, careers with a carpool,
   bills and the Repo Man, neighbors you can invite over, game speeds, day/night lighting,
   and the classic pixelated censor while showering, bathing or using the toilet.
   All art is drawn procedurally; progress saves in appData.sims. */
(function () {
  "use strict";

  const TW = 64, TH = 32, WALL_H = 92, WALL_LOW = 18;
  const LW0 = 15, LH = 14;                      // lot size in tiles (multi-floor houses use a wider virtual grid)
  const HOUSE0 = { x0: 2, y0: 2, x1: 12, y1: 10 };
  const ROOMS0 = [
    { id: "bed", name: "Bedroom", x0: 2, y0: 2, x1: 6, y1: 6, floor: "carpet" },
    { id: "bath", name: "Bathroom", x0: 7, y0: 2, x1: 9, y1: 6, floor: "tile" },
    { id: "kit", name: "Kitchen", x0: 10, y0: 2, x1: 12, y1: 6, floor: "kitchen" },
    { id: "liv", name: "Living Room", x0: 2, y0: 7, x1: 12, y1: 10, floor: "wood" },
  ];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function hash(a, b) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  // ---------------- motives ----------------
  const NEEDS = ["hunger", "comfort", "hygiene", "bladder", "energy", "fun", "social", "room"];
  const NEED_LABEL = { hunger: "Hunger", comfort: "Comfort", hygiene: "Hygiene", bladder: "Bladder", energy: "Energy", fun: "Fun", social: "Social", room: "Room" };
  const NEED_ICON = { hunger: "🍗", comfort: "🛋️", hygiene: "🛁", bladder: "🚽", energy: "💤", fun: "🎉", social: "💬", room: "🏠" };
  const DECAY = { hunger: 0.07, bladder: 0.16, energy: 0.1, hygiene: 0.055, fun: 0.1, social: 0.07 }; // per game minute (awake)
  const SKILLS = ["cooking", "mechanical", "charisma", "body", "logic", "creativity"];
  const SKILL_LABEL = { cooking: "Cooking", mechanical: "Mechanical", charisma: "Charisma", body: "Body", logic: "Logic", creativity: "Creativity" };
  const TRAITS = ["neat", "outgoing", "active", "playful", "nice"];
  const TRAIT_LABEL = { neat: ["Sloppy", "Neat"], outgoing: ["Shy", "Outgoing"], active: ["Lazy", "Active"], playful: ["Serious", "Playful"], nice: ["Grouchy", "Nice"] };

  // ---------------- careers (6 levels each) ----------------
  const CAREERS = {
    culinary: { name: "Culinary", levels: [["Dishwasher", 110, {}], ["Drive-Thru Clerk", 160, { cooking: 1 }], ["Fast Food Shift Supervisor", 210, { cooking: 2, body: 1 }], ["Host", 280, { cooking: 3, charisma: 2 }], ["Waiter", 350, { cooking: 4, charisma: 3 }], ["Head Chef", 520, { cooking: 6, creativity: 3 }]] },
    business: { name: "Business", levels: [["Mailroom", 120, {}], ["Executive Assistant", 180, { logic: 1 }], ["Field Sales Rep", 250, { charisma: 2 }], ["Junior Executive", 320, { logic: 3, charisma: 3 }], ["Executive", 450, { logic: 4, charisma: 4 }], ["CEO", 900, { logic: 6, charisma: 6 }]] },
    science: { name: "Science", levels: [["Test Subject", 155, {}], ["Lab Assistant", 230, { logic: 2 }], ["Field Researcher", 320, { logic: 3, mechanical: 2 }], ["Science Teacher", 375, { logic: 4, mechanical: 3 }], ["Project Leader", 450, { logic: 5, mechanical: 4 }], ["Mad Scientist", 1000, { logic: 8, mechanical: 6, creativity: 4 }]] },
    athletic: { name: "Athletic", levels: [["Team Mascot", 110, {}], ["Minor Leaguer", 170, { body: 2 }], ["Rookie", 230, { body: 3 }], ["Starter", 300, { body: 4, charisma: 2 }], ["All Star", 385, { body: 6, charisma: 4 }], ["MVP", 540, { body: 8, charisma: 5 }]] },
  };
  const NEIGHBORS = [
    { name: "Bella", gender: "F", skin: "#e8b48a", hair: "#1c1416", shirt: "#c0283a", pants: "#2a2a34" },
    { name: "Mortimer", gender: "M", skin: "#f0c8a0", hair: "#2a2018", shirt: "#3a3f4a", pants: "#1e1f26" },
    { name: "Daisy", gender: "F", skin: "#b07a52", hair: "#3a2414", shirt: "#e7a33a", pants: "#4a6a9a" },
    { name: "Gunther", gender: "M", skin: "#f3d2b4", hair: "#c9a050", shirt: "#3a8a5a", pants: "#4a3a2a" },
    { name: "Ben", gender: "M", skin: "#8a5a3a", hair: "#140e0a", shirt: "#4a6ad0", pants: "#2a2a30" },
    { name: "Nina", gender: "F", skin: "#f6d7bd", hair: "#a03a1a", shirt: "#7a3ab0", pants: "#2a3a5a" },
    { name: "Dirk", gender: "M", skin: "#c58b5f", hair: "#5a3a1c", shirt: "#e14b3b", pants: "#2a2a2e" },
  ];
  const SIMLISH = ["Sul sul!", "Dag dag!", "Nooboo!", "Vadish!", "Firby nooboo!", "Shoo flay!", "Sha sha!", "Gerbits!", "Wibbly!"];

  // ---------------- objects (Buy mode catalog) ----------------
  // w = footprint along x; h = visual height; enter = Sim uses it from inside its cell
  const CAT = {
    fridge: { name: "Llamark Refrigerator", price: 600, cat: "Appliances", w: 1, h: 76, col: "#e8ecf0", room: 0, ints: ["snack", "meal"] },
    stove: { name: "Dialectric Range", price: 400, cat: "Appliances", w: 1, h: 34, col: "#d8dde3", room: 0, ints: ["meal"] },
    counter: { name: "Count Blankenship Counter", price: 140, cat: "Surfaces", w: 1, h: 32, col: "#b98a5a", room: 1, ints: [] },
    table: { name: "Mesa Dining Table", price: 200, cat: "Surfaces", w: 2, h: 28, col: "#8a5a34", room: 2, ints: [] },
    chair: { name: "Werkbunnst Chair", price: 80, cat: "Seating", w: 1, h: 30, col: "#7a4a2a", room: 1, ints: ["sit"], enter: true, seat: true },
    toilet: { name: "Hydrotech Toilet", price: 300, cat: "Plumbing", w: 1, h: 30, col: "#f6f7f9", room: 0, ints: ["toilet"], enter: true },
    shower: { name: "Spartan Shower", price: 650, cat: "Plumbing", w: 1, h: 84, col: "#cfe6f2", room: 0, ints: ["shower"], enter: true },
    btub: { name: "Built-in Bathtub", price: 0, cat: "Plumbing", w: 1, h: 22, col: "#f6f7f9", room: 1, ints: ["bath"], enter: true, fixed: true },
    tub: { name: "Justa Bathtub", price: 800, cat: "Plumbing", w: 2, h: 22, col: "#f6f7f9", room: 1, ints: ["bath"], enter: true },
    sink: { name: "Hydronomic Sink", price: 250, cat: "Plumbing", w: 1, h: 34, col: "#e6eaee", room: 0, ints: ["wash"] },
    bed: { name: "Spartan Special Bed", price: 450, cat: "Seating", w: 2, h: 22, col: "#3a5a9a", room: 2, ints: ["sleep", "nap"], enter: true },
    sofa: { name: "Contempto Loveseat", price: 450, cat: "Seating", w: 2, h: 30, col: "#6a3a8a", room: 2, ints: ["sit", "nap"], enter: true, seat: true },
    armchair: { name: "Country Class Armchair", price: 250, cat: "Seating", w: 1, h: 32, col: "#9a5a2a", room: 1, ints: ["sit"], enter: true, seat: true },
    tv: { name: "Retro CRT Television", price: 500, cat: "Electronics", w: 1, h: 40, col: "#2a2a30", room: 1, ints: ["tv"] },
    computer: { name: "Moneywell Computer", price: 1000, cat: "Electronics", w: 1, h: 46, col: "#c9c3b0", room: 1, ints: ["games", "job", "surf"] },
    stereo: { name: "Zimantz Stereo", price: 300, cat: "Electronics", w: 1, h: 36, col: "#30343c", room: 1, ints: ["dance", "listen"] },
    phone: { name: "Tricorder Phone", price: 50, cat: "Electronics", w: 1, h: 26, col: "#c9a46a", room: 0, ints: ["call", "invite", "adopt"] },
    bookshelf: { name: "Pinegulcher Bookcase", price: 250, cat: "Knowledge", w: 1, h: 78, col: "#7a5230", room: 2, ints: ["studyCooking", "studyMechanical", "read"] },
    chess: { name: "Chess Table", price: 500, cat: "Knowledge", w: 1, h: 30, col: "#5a3a22", room: 2, ints: ["chess"] },
    easel: { name: "Easel", price: 450, cat: "Hobbies", w: 1, h: 64, col: "#a87a4a", room: 2, ints: ["paint"] },
    mirror: { name: "Narcissus Mirror", price: 120, cat: "Decorative", w: 1, h: 70, col: "#9ad0e6", room: 2, ints: ["speech"] },
    gym: { name: "Exerto Bench", price: 400, cat: "Hobbies", w: 1, h: 34, col: "#4a4e58", room: 0, ints: ["workout"] },
    plant: { name: "Potted Palm", price: 75, cat: "Decorative", w: 1, h: 46, col: "#2e8a3a", room: 4, ints: [] },
    lamp: { name: "Floor Lamp", price: 120, cat: "Lighting", w: 1, h: 70, col: "#e8d7a0", room: 3, ints: [], light: true },
    sculpture: { name: "Abstract Sculpture", price: 350, cat: "Decorative", w: 1, h: 54, col: "#c25a3a", room: 6, ints: [] },
    trash: { name: "Trash Can", price: 50, cat: "Misc", w: 1, h: 24, col: "#5a6470", room: 0, ints: [] },
    mailbox: { name: "Mailbox", price: 0, cat: "Misc", w: 1, h: 40, col: "#3a5aa0", room: 0, ints: ["mail"], fixed: true },
    // 3D-model furniture (models credited on the startup screen)
    sofa3: { name: "Green Leather Sofa", price: 1590, cat: "Seating", w: 3, h: 30, col: "#1f5a3a", room: 3, ints: ["sit", "nap"], enter: true, seat: true },
    sectional: { name: "Three-Seat Chaise Sectional", price: 2250, cat: "Seating", w: 3, h: 30, col: "#c9b28a", room: 4, ints: ["sit", "nap"], enter: true, seat: true },
    daybed: { name: "Classic Leather Daybed", price: 1350, cat: "Seating", w: 2, h: 20, col: "#b8233f", room: 3, ints: ["sit", "nap"], enter: true, seat: true },
    papasan: { name: "Papasan Hammock Chair", price: 340, cat: "Seating", w: 1, h: 34, col: "#2a3a8a", room: 2, ints: ["sit"], enter: true, seat: true },
    deckchair: { name: "Striped Seaside Deck Chair", price: 110, cat: "Seating", w: 1, h: 30, col: "#2a4a8a", room: 1, ints: ["sit"], enter: true, seat: true },
    deckchair2: { name: "Teak Beach Deck Chair", price: 195, cat: "Seating", w: 1, h: 30, col: "#8a5a32", room: 2, ints: ["sit"], enter: true, seat: true },
    porchswing: { name: "Cedar A-Frame Porch Swing", price: 650, cat: "Seating", w: 3, h: 70, col: "#b5794a", room: 3, ints: ["sit"], enter: true, seat: true },
    hottub: { name: "Bubbly Hot Tub", price: 3500, cat: "Outdoor", w: 2, h: 20, col: "#3ab0c8", room: 5, ints: ["soak"], enter: true, seat: true },
    sauna: { name: "Cedar Sauna", price: 4200, cat: "Outdoor", w: 2, h: 70, col: "#c08a52", room: 4, ints: ["sauna"], enter: true },
    santamailbox: { name: "Santa Express Mailbox", price: 180, cat: "Decorative", w: 1, h: 60, col: "#c0283a", room: 3, ints: ["letterSanta"] },
    barrel: { name: "Iron-Hooped Oak Barrel", price: 95, cat: "Decorative", w: 1, h: 30, col: "#8b5a2b", room: 2, ints: [] },
    crib: { name: "Baby Bassinet", price: 0, w: 1, h: 30, col: "#f4e6f0", room: 1, ints: ["feedBaby", "playBaby"], fixed: true },
    plate: { name: "Dirty Plate", price: 0, w: 1, h: 6, col: "#f0ede6", room: -15, ints: ["clean"], fixed: true, mess: true },
    puddle: { name: "Puddle", price: 0, w: 1, h: 1, col: "#d8e24a", room: -15, ints: ["clean"], fixed: true, mess: true, walk: true },
  };

  // ---------------- interactions ----------------
  // dur = game minutes (null = until full); gain = per game minute; pose; censor = pixelate the Sim
  const ACTS = {
    snack: { label: "Have Snack", icon: "🍪", dur: 20, gain: { hunger: 1.3 }, pose: "eat" },
    meal: { label: "Cook Meal", icon: "🍳", dur: 70, gain: { hunger: 1.05 }, pose: "cook", skill: "cooking", plate: true },
    sit: { label: "Sit", icon: "🪑", dur: 40, gain: { comfort: 1.6 }, pose: "sit" },
    toilet: { label: "Use Toilet", icon: "🚽", dur: 14, gain: { bladder: 8 }, pose: "sit", censor: true, until: "bladder" },
    shower: { label: "Take Shower", icon: "🚿", dur: 32, gain: { hygiene: 3.4 }, pose: "stand", censor: true, until: "hygiene", steam: true },
    bath: { label: "Take Bath", icon: "🛁", dur: 50, gain: { hygiene: 2.3, comfort: 1.4 }, pose: "bath", censor: true, until: "hygiene" },
    wash: { label: "Wash Hands", icon: "🧼", dur: 6, gain: { hygiene: 2 }, pose: "stand" },
    sleep: { label: "Sleep", icon: "💤", dur: 540, gain: { energy: 0.24, comfort: 0.3 }, pose: "lie", until: "energy", sleeping: true },
    nap: { label: "Nap", icon: "😴", dur: 90, gain: { energy: 0.24, comfort: 0.4 }, pose: "lie", sleeping: true },
    tv: { label: "Watch TV", icon: "📺", dur: 60, gain: { fun: 1.15 }, pose: "stand" },
    games: { label: "Play Games", icon: "🎮", dur: 60, gain: { fun: 1.45 }, pose: "stand" },
    job: { label: "Find a Job", icon: "💼", dur: 15, gain: {}, pose: "stand", job: true },
    surf: { label: "Surf the Web", icon: "🌐", dur: 45, gain: { fun: 0.9, social: 0.25 }, pose: "stand" },
    dance: { label: "Dance", icon: "💃", dur: 40, gain: { fun: 1.6, energy: -0.3, hygiene: -0.15 }, pose: "dance", skill: "body" },
    listen: { label: "Listen to Music", icon: "🎵", dur: 40, gain: { fun: 0.8 }, pose: "stand" },
    call: { label: "Call a Friend", icon: "☎️", dur: 30, gain: { social: 1.5, fun: 0.3 }, pose: "stand", call: true },
    invite: { label: "Invite Over", icon: "🏠", dur: 8, gain: { social: 0.4 }, pose: "stand", invite: true },
    studyCooking: { label: "Study Cooking", icon: "📘", dur: 60, gain: { fun: -0.15 }, pose: "stand", skill: "cooking", study: true },
    studyMechanical: { label: "Study Mechanical", icon: "📗", dur: 60, gain: { fun: -0.15 }, pose: "stand", skill: "mechanical", study: true },
    read: { label: "Read a Book", icon: "📖", dur: 45, gain: { fun: 0.7 }, pose: "stand" },
    chess: { label: "Play Chess", icon: "♟️", dur: 60, gain: { fun: 0.8 }, pose: "sit", skill: "logic" },
    paint: { label: "Paint", icon: "🎨", dur: 90, gain: { fun: 0.6 }, pose: "stand", skill: "creativity", painting: true },
    speech: { label: "Practice Speech", icon: "🗣️", dur: 50, gain: { fun: -0.1 }, pose: "stand", skill: "charisma" },
    workout: { label: "Work Out", icon: "🏋️", dur: 50, gain: { fun: 0.2, energy: -0.4, hygiene: -0.3 }, pose: "stand", skill: "body" },
    soak: { label: "Soak in Hot Tub", icon: "♨️", dur: 45, gain: { comfort: 1.6, fun: 1.0, hygiene: 0.5 }, pose: "bath", steam: true },
    sauna: { label: "Relax in Sauna", icon: "🧖", dur: 40, gain: { comfort: 1.3, hygiene: 0.8, fun: 0.5 }, pose: "sit", steam: true },
    letterSanta: { label: "Write a Letter to Santa", icon: "🎅", dur: 15, gain: { fun: 0.9, social: 0.3 }, pose: "stand" },
    mail: { label: "Get Mail", icon: "✉️", dur: 4, gain: {}, pose: "stand", mail: true },
    clean: { label: "Clean Up", icon: "🧹", dur: 8, gain: { fun: -0.1 }, pose: "stand", clean: true },
    goto: { label: "Go Here", icon: "👣", dur: 0, gain: {}, pose: "stand" },
    // social (target = neighbor)
    talk: { label: "Talk", icon: "💬", dur: 18, gain: { social: 2.2, fun: 0.4 }, pose: "stand", social: 3 },
    joke: { label: "Joke", icon: "😂", dur: 10, gain: { social: 2, fun: 1.2 }, pose: "stand", social: "joke" },
    compliment: { label: "Compliment", icon: "🌟", dur: 8, gain: { social: 2 }, pose: "stand", social: 6 },
    hug: { label: "Hug", icon: "🤗", dur: 8, gain: { social: 3, comfort: 0.5 }, pose: "stand", social: "hug" },
    goodbye: { label: "Say Goodbye", icon: "👋", dur: 4, gain: {}, pose: "stand", social: "bye" },
    flirt: { label: "Flirt", icon: "😘", dur: 10, gain: { social: 2, fun: 0.6 }, pose: "stand", social: "flirt" },
    kiss: { label: "Kiss", icon: "💋", dur: 8, gain: { social: 3, fun: 0.8 }, pose: "stand", social: "kiss" },
    moveIn: { label: "Ask to Move In", icon: "🏡", dur: 10, gain: { social: 2 }, pose: "stand", social: "movein" },
    propose: { label: "Propose", icon: "💍", dur: 12, gain: { social: 3, fun: 1 }, pose: "stand", social: "propose" },
    woohoo: { label: "WooHoo", icon: "💞", dur: 30, gain: { fun: 2, social: 2.5, comfort: 1 }, pose: "lie", social: "woohoo", bedAct: true },
    tryBaby: { label: "Try for Baby", icon: "👶", dur: 30, gain: { fun: 1.6, social: 2.5, comfort: 1 }, pose: "lie", social: "woohoo", bedAct: true, baby: true },
    feedBaby: { label: "Feed Baby", icon: "🍼", dur: 20, gain: { fun: 0.2 }, pose: "stand", babyCare: 45 },
    playBaby: { label: "Play with Baby", icon: "🧸", dur: 20, gain: { fun: 0.9, social: 0.6 }, pose: "stand", babyCare: 30 },
    adopt: { label: "Adopt a Baby", icon: "📞", dur: 10, gain: {}, pose: "stand", adopt: true },
  };

  // ---------------- houses ----------------
  // The Starter Home is built from walls in code. The Family Home is the "House interior" model by
  // Gabriele Romagnoli; its walls/doors were measured into this grid (h/v = walls on tile edges,
  // b = tiles taken by the model's own furniture or walls). hid:1 objects are the model's built-in
  // fridge/oven/sink/tub made usable (the model draws them).
  const HOUSES = {
    starter: { name: "Starter Home", price: 0, beds: 1, baths: 1, desc: "A cozy one-bedroom place with a kitchen, bathroom and living room." },
    family: { name: "Family Home", price: 40000, beds: 2, baths: 1, desc: "A medium house: big open living area, two bedrooms, a study, a real kitchen and a side porch.",
      HOUSE: { x0: 1, y0: 1, x1: 11, y1: 9 },
      ROOMS: [{ id: "liv", name: "House", x0: 1, y0: 1, x1: 11, y1: 9, floor: "wood" }],
      layout: {"h": ["0000000000000000", "0000011111110000", "0000000000000000", "0111100000000000", "0110000000010000", "0000000000010000", "0110100000000000", "0111111011100000", "0000000100010000", "0000010100010000", "0111111110010000", "0111111111110000", "0000000000000000", "0000000000000000", "0000000000000000"], "v": ["0000000000000000", "0000010010001000", "0000010010001000", "0111110010001000", "0111110000011000", "0111110000011000", "0100000010011000", "0100000000000000", "0100011010001000", "0100001010011000", "0111110011111000", "0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000"], "b": ["000000000000000", "000000000000000", "000000000000000", "001010000000000", "011010000000000", "011010000000000", "010010000000000", "000000000000000", "000000010001000", "000000010001000", "011111111111000", "000000000000000", "000000000000000", "000000000000000"]},
      model: { file: "familyhome.glb", scale: 2.6, rot: 1.5708, ox: 0.8, oz: 0.9, floorY: 1.118 },
      path: [12.5, 7.5, 12],
      start: [12, 11],
      objects: () => [
        ["fridge", 11, 8, 1], ["stove", 9, 10, 1], ["sink", 10, 10, 1], ["btub", 7, 9, 1], ["sink", 7, 8, 1],
        ["toilet", 5, 1], ["shower", 7, 1], ["mirror", 6, 1],
        ["bookshelf", 8, 1], ["computer", 11, 1], ["chair", 11, 2], ["chess", 9, 2],
        ["sofa", 5, 6], ["tv", 5, 3], ["phone", 8, 6], ["plant", 11, 3], ["table", 9, 4], ["chair", 9, 5], ["stereo", 7, 3], ["trash", 1, 7], ["lamp", 5, 4],
        ["bed", 1, 9], ["lamp", 3, 9],
        ["mailbox", 13, 11],
      ].map(([t, x, y, hid]) => (hid ? { t, x, y, hid: 1 } : { t, x, y })),
    },
    // Luxury Home: "house interiors" by Gabriele Romagnoli — 3 floors. The virtual grid puts each
    // floor side by side: x 0–14 = main floor + yard, 15–29 = upstairs, 30–44 = basement; stairs are portals.
    luxury: { name: "Luxury Home", price: 80000, beds: 2, baths: 2, desc: "Three floors: open kitchen, dining and living room, garage, two bedrooms upstairs, a basement family room with a sauna, and a hot tub in the yard.",
      HOUSE: { x0: 2, y0: 1, x1: 8, y1: 9 },
      ROOMS: [{ id: "liv", name: "House", x0: 2, y0: 1, x1: 8, y1: 9, floor: "wood" }],
      gridW: 45, FH: 2.8,
      floors: [{ level: 0, vx0: 0, name: "Main", file: "lux-0.glb" }, { level: 1, vx0: 15, name: "Upstairs", file: "lux-1.glb" }, { level: -1, vx0: 30, name: "Basement", file: "lux-b.glb" }],
      portals: [[8, 4, 23, 8], [6, 6, 38, 4]],
      layout: {"h": ["0000000000000001111111111111111111111111111110", "0011111110000001111111111111111111111111111110", "0000000000000001110000111111111100001001111110", "0000000000000001111000111111111100001101111110", "0000000000000001101000011111111100000101111110", "0000000000000001111001101111111100100111111110", "0011110000000001111000011111111100000111111110", "0000000000000001110000111111111100000011111110", "0000000000000001100000111111111100000001111110", "0000000000000001100001011111111100000001111110", "0011111010000001111111111111111110000001111110", "0000000000000001111111111111111111111111111110", "0000000000000001111111111111111111111111111110", "0000000000000001111111111111111111111111111110", "0000000000000001111111111111111111111111111110"], "v": ["0000000000000001111111111111111111111111111110", "0010000001000001110001011111111110000001111110", "0010000001000001110000111111111110011101111110", "0010000001000001111100011111111110010111111110", "0010000001000001110000011111111110000001111110", "0010000001000001110000001111111110000111111110", "0010001001000001111000011111111110000011111110", "0010000001000001110000111111111110000001111110", "0010001001000001110000001111111110000001111110", "0010001001000001110010101111111110000001111110", "0000000000000001111111111111111111000001111110", "0000000000000001111111111111111111111111111110", "0000000000000001111111111111111111111111111110", "0000000000000001111111111111111111111111111110", "0000000000000000000000000000000000000000000000"], "b": ["000000000000000111111111111111111111111111111", "000000000000000111000000111111110000000111111", "000100000000000110000011111111110000100111111", "001000010000000110100001111111110000010111111", "000000000000000110000000111111110000000111111", "001010011000000111100000111111110000011111111", "000000011000000111000001111111110000001111111", "000000011000000110000011111111110000000111111", "000000000000000110000000111111110000000111111", "000000000000000110000000111111110000000111111", "000000000000000111111111111111111000000111111", "000000000000000111111111111111111111111111111", "000000000000000111111111111111111111111111111", "000000000000000111111111111111111111111111111"]},
      off: {"18,1": [0.0, 0.0], "19,1": [0.0, 0.0], "20,1": [0.0, 0.0], "21,1": [0.0, 0.2], "22,1": [0.0, 0.2], "23,1": [0.0, 0.0], "17,2": [0.2, 0.0], "18,2": [0.0, 0.0], "19,2": [0.0, 0.0], "20,2": [0.0, 0.0], "21,2": [0.0, 0.0], "17,3": [0.0, 0.0], "19,3": [0.0, 0.0], "20,3": [0.0, 0.0], "21,3": [0.0, 0.0], "22,3": [0.0, 0.2], "17,4": [0.0, 0.0], "18,4": [0.0, 0.4], "19,4": [0.0, 0.0], "20,4": [0.0, 0.0], "21,4": [0.0, 0.0], "22,4": [0.0, -0.2], "23,4": [0.0, 0.0], "19,5": [0.0, 0.0], "20,5": [0.0, 0.0], "21,5": [0.0, 0.0], "22,5": [0.0, 0.0], "23,5": [0.0, 0.0], "18,6": [0.0, 0.4], "19,6": [0.0, 0.0], "20,6": [0.0, 0.0], "21,6": [0.0, 0.0], "22,6": [-0.2, -0.2], "17,7": [0.0, 0.0], "18,7": [0.0, 0.0], "19,7": [0.0, 0.0], "20,7": [0.0, 0.0], "21,7": [0.0, 0.0], "17,8": [0.0, 0.0], "18,8": [0.0, 0.0], "19,8": [0.0, 0.0], "20,8": [0.0, 0.0], "21,8": [0.0, 0.0], "22,8": [0.0, 0.0], "23,8": [0.0, 0.0], "17,9": [0.0, 0.0], "18,9": [0.0, 0.0], "19,9": [0.0, 0.0], "20,9": [0.4, 0.0], "21,9": [-0.2, 0.2], "22,9": [0.0, 0.0], "23,9": [-0.2, 0.0], "32,1": [0.0, 0.0], "33,1": [0.0, 0.2], "34,1": [0.0, 0.0], "35,1": [0.0, 0.2], "36,1": [0.0, 0.2], "37,1": [0.0, 0.2], "38,1": [0.0, 0.0], "32,2": [0.0, 0.0], "33,2": [0.0, 0.0], "34,2": [0.0, 0.0], "35,2": [0.0, 0.0], "37,2": [0.0, -0.2], "38,2": [0.0, 0.0], "32,3": [0.0, 0.0], "33,3": [0.0, 0.0], "34,3": [0.0, 0.0], "35,3": [0.0, 0.0], "36,3": [-0.2, 0.2], "38,3": [0.4, 0.0], "32,4": [0.0, 0.0], "33,4": [0.0, 0.0], "34,4": [0.0, 0.0], "35,4": [0.0, 0.0], "36,4": [0.0, 0.0], "37,4": [0.0, 0.0], "38,4": [0.0, 0.0], "32,5": [0.0, 0.0], "33,5": [0.0, 0.0], "34,5": [0.0, 0.0], "35,5": [0.0, 0.0], "36,5": [0.0, 0.0], "32,6": [0.0, 0.0], "33,6": [0.0, 0.0], "34,6": [0.0, 0.0], "35,6": [0.0, 0.0], "36,6": [0.0, 0.0], "37,6": [-0.2, 0.0], "32,7": [0.0, 0.0], "33,7": [0.0, 0.0], "34,7": [0.0, 0.0], "35,7": [0.0, 0.0], "36,7": [0.0, 0.0], "37,7": [0.0, 0.0], "38,7": [0.0, 0.0], "32,8": [0.0, 0.0], "33,8": [0.0, 0.0], "34,8": [0.0, 0.0], "35,8": [0.0, 0.0], "36,8": [0.0, 0.0], "37,8": [0.0, 0.0], "38,8": [0.0, 0.0], "32,9": [0.0, 0.0], "33,9": [0.0, 0.0], "34,9": [0.0, 0.0], "35,9": [0.0, 0.0], "36,9": [0.0, 0.0], "37,9": [0.0, 0.0], "38,9": [0.0, 0.0], "33,10": [0.0, -0.4], "34,10": [0.0, -0.4], "35,10": [0.0, -0.4], "36,10": [0.0, -0.4], "37,10": [0.0, -0.4], "38,10": [0.0, -0.4]},
      path: [7.5, 10, 12],
      start: [7, 11],
      objects: () => [
        ["stove", 2, 4, 1], ["fridge", 3, 5, 1], ["sink", 2, 3, 1], ["sofa", 5, 3, 1], ["armchair", 7, 2, 1],
        ["tv", 6, 1], ["phone", 8, 1], ["trash", 2, 1], ["toilet", 6, 9], ["plant", 8, 9], ["lamp", 2, 6],
        ["hottub", 10, 8], ["mailbox", 8, 11],
        ["btub", 17, 1, 1], ["toilet", 19, 1], ["bed", 17, 5, 1], ["armchair", 21, 1, 1], ["sofa", 21, 4, 1], ["shower", 23, 9, 1],
        ["computer", 19, 6], ["chair", 20, 6], ["bed", 17, 9], ["bookshelf", 19, 7], ["mirror", 22, 6],
        ["tv", 34, 2, 1], ["armchair", 35, 2, 1], ["armchair", 35, 3, 1], ["sofa", 36, 4, 1],
        ["sauna", 32, 8], ["gym", 36, 8], ["stereo", 38, 9], ["chess", 33, 6], ["easel", 37, 7],
      ].map(([t, x, y, hid]) => (hid ? { t, x, y, hid: 1 } : { t, x, y })),
    },
  };

  // ---------------- default lot ----------------
  function starterObjects() {
    return [
      ["bed", 2, 2], ["bookshelf", 6, 2], ["lamp", 2, 5], ["mirror", 5, 2],
      ["toilet", 7, 2], ["shower", 9, 2], ["sink", 8, 2],
      ["fridge", 10, 2], ["stove", 11, 2], ["counter", 12, 2], ["table", 11, 4], ["chair", 12, 5],
      ["sofa", 3, 8], ["tv", 3, 10], ["phone", 2, 7], ["plant", 12, 10], ["computer", 9, 7], ["chair", 9, 8], ["stereo", 12, 7], ["trash", 7, 7],
      ["mailbox", 5, 12],
    ].map(([t, x, y]) => ({ t, x, y }));
  }
  function freshSave(cas) {
    return {
      v: 1, money: 6500, day: 1, min: 8 * 60, speed: 1,
      sim: { name: cas.name, family: cas.family, gender: cas.gender || "F", skin: cas.skin, hair: cas.hair, shirt: cas.shirt, pants: cas.pants, traits: cas.traits,
        needs: { hunger: 75, comfort: 70, hygiene: 80, bladder: 70, energy: 85, fun: 60, social: 55, room: 50 },
        skills: { cooking: 0, mechanical: 0, charisma: 0, body: 0, logic: 0, creativity: 0 }, x: 7, y: 11 },
      career: null, objects: starterObjects(), rel: {}, bills: [], billDay: 4, freeWill: true,
      romance: {}, married: null, household: [], pregnant: null, baby: null,
    };
  }

  // =========================================================================
  /* Credits for every outside asset the Sims games use. Shown on the startup screen and in Options → Credits.
     Add a line here whenever a new asset comes in. */
  const CREDITS = [
    { what: "Plumbob model", who: "ordinarycontraptions (Thingiverse)", link: "https://www.thingiverse.com/thing:5275829",
      license: "CC BY-NC-SA", note: "Headband parts removed" },
    { what: "Table lamp", who: "CGTrader", link: "https://www.cgtrader.com/", license: "CGTrader license", note: "Shrunk for iPad" },
    { what: "Cup and saucer", who: "CGTrader", link: "https://www.cgtrader.com/", license: "CGTrader license", note: "Smoothed" },
    { what: "Curtains", who: "CGTrader", link: "https://www.cgtrader.com/", license: "CGTrader license", note: "Shrunk for iPad" },
    { what: "Crystal wine glass", who: "CGTrader", link: "https://www.cgtrader.com/", license: "CGTrader license", note: "Rebuilt from CAD surfaces" },
    { what: "House", who: "CGTrader", link: "https://www.cgtrader.com/", license: "CGTrader license", note: "Recolored" },
    { what: "Teak beach deck chair", who: "CGTrader", link: "https://www.cgtrader.com/", license: "CGTrader license", note: "Converted from Blender" },
    { what: "Striped seaside deck chair", who: "CGTrader", link: "https://www.cgtrader.com/", license: "CGTrader license", note: "Texture cut to 512 px" },
    { what: "A-frame porch swing", who: "masonreloaded (CGTrader)", link: "https://www.cgtrader.com/designers/masonreloaded", license: "CGTrader license", note: "Chains cut from 98k to 8k triangles" },
    { what: "Oak barrel", who: "margetacg (CGTrader)", link: "https://www.cgtrader.com/designers/margetacg", license: "CGTrader license", note: "Hoops and staves colored" },
    { what: "Retro CRT TV with doily", who: "nykonni (CGTrader)", link: "https://www.cgtrader.com/designers/nykonni", license: "CGTrader license", note: "Converted from Alembic" },
    { what: "Metal bookshelf with books and vases", who: "ludasachk25 (CGTrader)", link: "https://www.cgtrader.com/designers/ludasachk25", license: "CGTrader license", note: "Recolored" },
    { what: "Santa's mailbox", who: "katerinabondarenko (CGTrader)", link: "https://www.cgtrader.com/designers/katerinabondarenko", license: "CGTrader license", note: "Converted from Blender 4" },
    { what: "Mailbox", who: "Poly by Google via Poly Pizza", link: "https://poly.pizza/", license: "CC-BY", note: "Scaled to 1.35 m" },
    { what: "Family Home (house interior)", who: "Gabriele Romagnoli via Poly Pizza", link: "https://poly.pizza/", license: "CC-BY", note: "Walls mapped to the game grid" },
    { what: "Chess set", who: "Pia Leung via Poly Pizza", link: "https://poly.pizza/", license: "CC-BY", note: "On every chess table" },
    { what: "Luxury Home (house interiors, 3 floors)", who: "Gabriele Romagnoli via Poly Pizza", link: "https://poly.pizza/", license: "CC-BY", note: "Floors stacked, stairs made walkable" },
    { what: "Sofa collection (36 sofas, loveseats, chaises and armchairs)", who: "CGTrader", link: "https://www.cgtrader.com/", license: "CGTrader license", note: "Shrunk from 575 MB to 4.8 MB" },
  ];
  const creditsHTML = () => `<div class="sm-cred">${CREDITS.map((c) => `<div class="sm-cred-i"><b>${c.what}</b> by ${c.who}<br><span>${c.license}${c.note ? " · " + c.note : ""} · <a href="${c.link}" target="_blank" rel="noopener">source</a></span></div>`).join("")}
    <div class="sm-cred-i"><b>Everything else</b> (the Sims, walls, other furniture, textures and sounds) is made in code for this game.</div></div>`;

  /* Flat 2D plumbob (six-faceted green diamond), used on the loading screen. */
  const PLUMBOB_SVG = `<svg viewBox="0 0 40 60" aria-hidden="true"><g stroke="#0d5a22" stroke-width=".8" stroke-linejoin="round">
    <polygon points="20,0 2,30 14,30" fill="#9bf7a9"/><polygon points="20,0 14,30 26,30" fill="#62ee7d"/><polygon points="20,0 26,30 38,30" fill="#34c957"/>
    <polygon points="2,30 14,30 20,60" fill="#2fbf50"/><polygon points="14,30 26,30 20,60" fill="#22a443"/><polygon points="26,30 38,30 20,60" fill="#15782f"/></g></svg>`;

  function start(body, startOpts) {
    const store = () => { const S = window.State && State.data; if (!S) return {}; if (!S.appData) S.appData = {}; return S.appData; };
    let G = store().sims || null;
    const HKEY = (G && G.house && HOUSES[G.house]) ? G.house : "starter", HDEF = HOUSES[HKEY];
    const HOUSE = HDEF.HOUSE || HOUSE0, ROOMS = HDEF.ROOMS || ROOMS0, LAYOUT = HDEF.layout || null;
    const LW = HDEF.gridW || LW0;
    const PORT = HDEF.portals || [];
    const levelOf = (x) => { const fl = HDEF.floors; if (!fl) return 0; let L = fl[0]; fl.forEach((f) => { if (x >= f.vx0) L = f; }); return L.level; };
    const fixedBlock = (x, y) => !!(LAYOUT && LAYOUT.b[y] && LAYOUT.b[y][x] === "1");
    body.innerHTML = `<div class="sm"><canvas class="sm-cv"></canvas>
      <div class="sm-queue"></div>
      <div class="sm-view3d" hidden><button data-v="rotL" title="Rotate left (Q)">⟲</button><button data-v="rotR" title="Rotate right (E)">⟳</button><button data-v="zin" title="Zoom in">＋</button><button data-v="zout" title="Zoom out">－</button><button data-v="turn" title="Turn the item you're placing (R)" class="sm-turnbtn" hidden>↻ Turn</button><button data-v="walls" title="Walls: cutaway / up / down" class="sm-wallbtn">▥ Cutaway</button><button data-v="up" class="sm-floorbtn" title="Floor up" hidden>▲</button><button data-v="flname" class="sm-floorbtn sm-flname" hidden>Main</button><button data-v="down" class="sm-floorbtn" title="Floor down" hidden>▼</button><button data-v="2d" title="Switch between 3D and the classic 2D view" class="sm-2dbtn">2D</button></div>
      <div class="sm-hint"></div>
      <div class="sm-notes"></div>
      <div class="sm-buyhint" hidden></div>
      <div class="sm-modes"><button class="sm-mode on" data-m="live" title="Live mode"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 8l6 4-6 4z" fill="currentColor"/></svg></button><button class="sm-mode" data-m="buy" title="Buy mode"><svg viewBox="0 0 24 24"><path d="M4 12h16v5H4zM6 9h12v3H6zM5 17v2M19 17v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button><button class="sm-mode" data-m="menu" title="Options"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg></button></div>
      <div class="sm-bar">
        <div class="sm-hud-left">
          <div class="sm-tabs"><button class="on" data-t="needs" title="Needs">❤</button><button data-t="job" title="Career">💼</button><button data-t="skills" title="Skills">★</button><button data-t="rel" title="Relationships">👥</button><button data-t="pers" title="Personality">✦</button></div>
          <div class="sm-face"><div class="sm-ring"><canvas class="sm-portrait" width="72" height="84"></canvas></div><div class="sm-moodchip">Fine</div><div class="sm-mood"><div></div></div><div class="sm-name"></div><div class="sm-money">§0</div></div>
        </div>
        <div class="sm-left"><div class="sm-speeds"><button data-s="0" title="Pause">❚❚</button><button data-s="1" title="Normal">▶</button><button data-s="2" title="Fast">▶▶</button><button data-s="3" title="Ultra">▶▶▶</button></div><div class="sm-clock"><b class="sm-time">8:00 AM</b><span class="sm-day">Day 1</span></div></div>
        <div class="sm-tab-body"></div>
      </div>
      <div class="sm-catalog" hidden></div>
      <div class="sm-pie" hidden></div>
      <div class="sm-dialog" hidden></div>
    </div>`;
    injectStyles();
    const host = body.querySelector(".sm"), cv = host.querySelector(".sm-cv"), g = cv.getContext("2d");
    const $ = (q) => host.querySelector(q);
    let W = 0, H = 0, dpr = 1, zoom = 1, camX = 0, camY = 0, mode = "live", tab = "needs";
    let buyRot = 0; let sim = null, npcs = [], objs = [], acts = [], hover = null, buyItem = null, ghostOk = false, dialogOpen = false, t = 0, flash = [];
    let lastSave = 0, dead = false, raf = 0, last = performance.now(), userCam = false;

    function fit() {
      const r = host.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height; cv.width = Math.max(1, W * dpr); cv.height = Math.max(1, H * dpr); cv.style.height = H + "px";
      if (view3d) view3d.resize(W, H);
      if (!camX && !camY) centerCam();
    }
    function centerCam() { zoom = clamp(Math.min(W / (LW * TW * 0.92), H / ((LW + LH) * TH * 0.5 + 60)), 0.55, 1.25); const c = P(LW / 2, LH / 2, 0, true); camX = W / 2 - c[0]; camY = H / 2 - c[1] + 10; }
    // iso projection: cell coords → screen
    function P(x, y, z, raw) { const sx = (x - y) * TW / 2 * zoom, sy = ((x + y) * TH / 2 - (z || 0)) * zoom; return raw ? [sx, sy] : [sx + camX, sy + camY]; }
    function cellAt(mx, my) { if (view3d) return view3d.cellAt(mx, my); const fx = (mx - camX) / (TW / 2 * zoom), fy = (my - camY) / (TH / 2 * zoom); return { x: Math.floor((fy + fx) / 2), y: Math.floor((fy - fx) / 2) }; }

    // ---------------- 3D view (Three.js; falls back to the 2D drawing) ----------------
    let view3d = null, want3d = true;
    try { const sv = window.State && State.data && State.data.appData && State.data.appData.sims3dView; if (sv === false) want3d = false; } catch (e) {}
    function enable3D() {
      if (view3d || !want3d || !window.THREE || !window.Sims3DView || dead) return;
      try {
        view3d = window.Sims3DView.create({ layout: HDEF.model || HDEF.floors ? { model: HDEF.model, path: HDEF.path, floors: HDEF.floors, FH: HDEF.FH, off: HDEF.off, gridW: LW } : null, LW, LH, HOUSE, ROOMS, hWall, vWall, CAT, onLost: (why) => fail3D(why || "The 3D view ran out of graphics memory") });
        host.insertBefore(view3d.canvas, cv); cv.classList.add("sm-overlay"); $(".sm-view3d").hidden = false; fit();
      } catch (e) { console.warn("3D view unavailable", e); view3d = null; }
    }
    // If 3D can't run on this device, keep playing in 2D instead of breaking the game.
    function fail3D(why) {
      if (!view3d) return; try { view3d.dispose(); } catch (e) {} view3d = null; cv.classList.remove("sm-overlay"); fit(); const rg = $(".sm-ring"); if (rg) rg.classList.remove("live");
      const b = $(".sm-2dbtn"); if (b) b.textContent = "3D"; host.querySelectorAll(".sm-view3d button:not(.sm-2dbtn)").forEach((x) => x.hidden = true);
      notify((why || "3D couldn't start") + " — switched to 2D. Tap 3D to try again.");
    }
    function disable3D() { if (!view3d) return; const rg = $(".sm-ring"); if (rg) rg.classList.remove("live"); view3d.dispose(); view3d = null; cv.classList.remove("sm-overlay"); fit(); }
    function set3D(on) {
      want3d = on; try { State.data.appData.sims3dView = on; State.save(); } catch (e) {}
      if (on) enable3D(); else disable3D();
      $(".sm-2dbtn").textContent = view3d ? "2D" : "3D"; host.querySelectorAll(".sm-view3d button:not(.sm-2dbtn):not(.sm-turnbtn)").forEach((b) => b.hidden = !view3d);
      $(".sm-view3d").hidden = false;
    }
    if (window.THREE) setTimeout(enable3D, 0); else window.addEventListener("three-ready", () => enable3D(), { once: true });

    // ---------------- walls ----------------
    const hWall = [], vWall = [];
    for (let y = 0; y <= LH; y++) { hWall.push(new Array(LW + 1).fill(0)); vWall.push(new Array(LW + 1).fill(0)); }
    if (LAYOUT) { for (let y = 0; y <= LH; y++) for (let x = 0; x <= LW; x++) { hWall[y][x] = +(LAYOUT.h[y] || "")[x] || 0; vWall[y][x] = +(LAYOUT.v[y] || "")[x] || 0; } }
    else for (let x = HOUSE.x0; x <= HOUSE.x1; x++) { hWall[HOUSE.y0][x] = 2; if (x !== 7) hWall[HOUSE.y1 + 1][x] = 1; if (![4, 8, 11].includes(x)) hWall[7][x] = 1; }
    if (!LAYOUT) for (let y = HOUSE.y0; y <= HOUSE.y1; y++) { vWall[y][HOUSE.x0] = 2; vWall[y][HOUSE.x1 + 1] = 1; }
    if (!LAYOUT) for (let y = 2; y <= 6; y++) { vWall[y][7] = 1; vWall[y][10] = 1; }
    function canStep(x, y, nx, ny) {
      if (nx < 0 || ny < 0 || nx >= LW || ny >= LH) return false;
      if (ny === y + 1) return !hWall[ny][x]; if (ny === y - 1) return !hWall[y][x];
      if (nx === x + 1) return !vWall[y][nx]; if (nx === x - 1) return !vWall[y][x];
      return false;
    }
    function roomOf(x, y) { return ROOMS.find((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) || null; }
    const insideHouse = (x, y) => x >= HOUSE.x0 && x <= HOUSE.x1 && y >= HOUSE.y0 && y <= HOUSE.y1;

    // ---------------- objects ----------------
    function cells(o) { const d = CAT[o.t]; const a = []; for (let i = 0; i < d.w; i++) a.push([o.x + i, o.y]); return a; }
    function objAt(x, y) { return objs.find((o) => !CAT[o.t].walk && cells(o).some(([cx, cy]) => cx === x && cy === y)); }
    function blockedCell(x, y, except) { const o = objAt(x, y); if (o) return o !== except; return fixedBlock(x, y); }
    function useSpots(o) {
      const d = CAT[o.t];
      if (d.enter) return [[o.x, o.y]];
      const spots = [];
      cells(o).forEach(([cx, cy]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < LW && ny < LH && canStep(cx, cy, nx, ny) && !blockedCell(nx, ny) && !spots.some(([a, b]) => a === nx && b === ny)) spots.push([nx, ny]);
      }));
      return spots;
    }
    // A* over the lot grid (walls + object footprints)
    function path(sx, sy, tx, ty, through) {
      const startObj = objAt(sx, sy); // a Sim getting up from a bed/sofa may step across its other tiles
      const key = (x, y) => y * LW + x, open = [[sx, sy]], came = {}, gs = { [key(sx, sy)]: 0 };
      const h = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
      const fs = { [key(sx, sy)]: h(sx, sy) };
      for (let guard = 0; open.length && guard < 4000; guard++) {
        open.sort((a, b) => fs[key(a[0], a[1])] - fs[key(b[0], b[1])]);
        const [x, y] = open.shift();
        if (x === tx && y === ty) { const out = [[x, y]]; let k = key(x, y); while (came[k] != null) { const c = came[k]; out.unshift([c % LW, (c / LW) | 0]); k = c; } return out; }
        const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy, 1]);
        PORT.forEach(([ax, ay, bx, by]) => { if (ax === x && ay === y) steps.push([bx, by, 3]); else if (bx === x && by === y) steps.push([ax, ay, 3]); });
        for (const [nx, ny, cost] of steps) {
          if (cost === 1 && !canStep(x, y, nx, ny)) continue;
          if (!(nx === tx && ny === ty) && blockedCell(nx, ny, through) && !(startObj && objAt(nx, ny) === startObj)) continue;
          const ng = gs[key(x, y)] + cost, nk = key(nx, ny);
          if (gs[nk] == null || ng < gs[nk]) { gs[nk] = ng; fs[nk] = ng + h(nx, ny); came[nk] = key(x, y); if (!open.some(([a, b]) => a === nx && b === ny)) open.push([nx, ny]); }
        }
      }
      return null;
    }

    // ---------------- game state ----------------
    function makeSimEntity(d, isPlayer) {
      return { name: d.name, gender: d.gender, role: d.role, scale: d.role === "child" ? 0.72 : 1, skin: d.skin, hair: d.hair, shirt: d.shirt, pants: d.pants, x: d.x != null ? d.x : 7, y: d.y != null ? d.y : 12, fx: d.x != null ? d.x : 7, fy: d.y != null ? d.y : 12, route: null, dir: 1, pose: "stand", say: "", sayT: 0, think: null, player: isPlayer, away: false, anim: 0 };
    }
    function boot() {
      objs = G.objects.map((o) => ({ ...o }));
      sim = makeSimEntity({ ...G.sim, x: G.sim.x, y: G.sim.y }, true);
      if (objAt(sim.x, sim.y) || fixedBlock(sim.x, sim.y)) { const st = HDEF.start || [7, 11]; sim.x = st[0]; sim.y = st[1]; sim.fx = st[0]; sim.fy = st[1]; }
      acts = []; npcs = [];
      if (!G.romance) G.romance = {}; if (!G.household) G.household = []; if (!G.sim.gender) G.sim.gender = "F";
      G.household.forEach((m) => spawnMember(m));
      paintUI(); fit(); centerCam();
    }
    function spawnMember(m) {
      const e = makeSimEntity({ ...m, x: 0, y: 0 }, false); e.npc = true; e.member = true; e.wanderT = 0;
      for (let k = 0; k < 60; k++) { const x = 2 + ((Math.random() * 11) | 0), y = 7 + ((Math.random() * 4) | 0); if (!blockedCell(x, y) && !(x === sim.x && y === sim.y)) { e.x = e.fx = x; e.y = e.fy = y; break; } }
      npcs.push(e); return e;
    }
    const member = (name) => G.household.find((m) => m.name === name);
    const findBed = () => objs.find((o) => o.t === "bed");
    function save() {
      if (!G) return; if (sim) { G.objects = objs.map((o) => { const r = { t: o.t, x: o.x, y: o.y }; if (o.rot) r.rot = o.rot; if (o.hid) r.hid = 1; return r; }); G.sim.x = Math.round(sim.fx); G.sim.y = Math.round(sim.fy); }
      store().sims = G; try { State.save(); } catch (e) {}
    }

    // ---------------- dialogs ----------------
    function dialog(title, html, buttons, onOpen) {
      const d = $(".sm-dialog"); dialogOpen = true; d.className = "sm-dialog";
      d.innerHTML = `<div class="sm-dlg"><div class="sm-dlg-h">${esc(title)}</div><div class="sm-dlg-b">${html}</div><div class="sm-dlg-f"></div></div>`;
      const f = d.querySelector(".sm-dlg-f");
      (buttons || [["OK"]]).forEach(([label, fn]) => { const b = document.createElement("button"); b.textContent = label; b.onclick = () => { const keep = fn && fn(d) === false; if (!keep) { d.hidden = true; dialogOpen = false; } }; f.appendChild(b); });
      d.hidden = false; if (onOpen) onOpen(d);
    }
    const msg = (title, text) => dialog(title, `<p>${esc(text)}</p>`);
    function notify(text) {
      const box = host && host.querySelector(".sm-notes"); if (!box) { flash.push({ text, t: 4 }); return; }
      const c = document.createElement("div"); c.className = "sm-note"; c.innerHTML = `<i>${PLUMBOB_SVG}</i><span>${esc(text)}</span>`; box.prepend(c);
      while (box.children.length > 3) box.lastChild.remove();
      setTimeout(() => { c.classList.add("out"); setTimeout(() => c.remove(), 400); }, 4200);
    }

    // ---------------- Create-a-Sim ----------------
    function createASim() {
      const SK = ["#f6d7bd", "#e8b48a", "#c58b5f", "#8a5a3a", "#5a3a26"], HR = ["#1c1416", "#5a3a1c", "#b07a3a", "#e6c46a", "#a03a1a", "#8a8a90"];
      const SH = ["#3a6ad0", "#c0283a", "#2e8a4a", "#e7a33a", "#7a3ab0", "#f0f0f0", "#2a2a30"], PT = ["#2a3a5a", "#2a2a2e", "#6a4a2a", "#4a6a3a", "#8a8a90"];
      const c = { name: "", family: "", gender: "F", skin: SK[1], hair: HR[1], shirt: SH[0], pants: PT[0], traits: { neat: 5, outgoing: 5, active: 5, playful: 5, nice: 5 } };
      const sw = (arr, key) => `<div class="sm-sw" data-k="${key}">${arr.map((v) => `<button style="background:${v}" data-v="${v}" class="${c[key] === v ? "on" : ""}"></button>`).join("")}</div>`;
      dialog("Create a Sim", `
        <div class="sm-cas"><canvas class="sm-cas-cv" width="120" height="150"></canvas><div class="sm-cas-f">
          <label>First name <input class="sm-in sm-fn" maxlength="16" placeholder="e.g. Alex"></label>
          <label>Family name <input class="sm-in sm-ln" maxlength="16" placeholder="e.g. Newbie"></label>
          <div class="sm-gender">Gender <button data-g="F" class="on">♀ Female</button><button data-g="M">♂ Male</button></div>
          <div>Skin ${sw(SK, "skin")}</div><div>Hair ${sw(HR, "hair")}</div><div>Shirt ${sw(SH, "shirt")}</div><div>Pants ${sw(PT, "pants")}</div>
        </div></div>
        <div class="sm-traits">${TRAITS.map((k) => `<div class="sm-trait"><span>${TRAIT_LABEL[k][0]}</span><input type="range" min="0" max="10" value="5" data-tr="${k}"><span>${TRAIT_LABEL[k][1]}</span><b>5</b></div>`).join("")}<div class="sm-pts">Personality points left: <b>0</b> / 25</div></div>`,
        [["Done", (d) => {
          c.name = d.querySelector(".sm-fn").value.trim() || "Alex"; c.family = d.querySelector(".sm-ln").value.trim() || "Newbie";
          G = freshSave(c); save(); boot();
          setTimeout(() => dialog(`Welcome, ${c.name}!`, `<p>The ${esc(c.family)} household has moved in with <b>§6,500</b>.</p><p>Keep ${esc(c.name)}'s needs up, find a job on the computer, learn skills, and make friends. Click objects to see what your Sim can do.</p>`), 50);
        }]], (d) => {
          let pv = null;
          if (window.THREE && window.Sims3DView && Sims3DView.preview) {
            d.classList.add("sm-casmode");
            const stage = document.createElement("div"); stage.className = "sm-cas-stage"; stage.innerHTML = `<div class="sm-cas-title">Create a Sim</div><div class="sm-cas-arrows"><button data-r="-1">⟲</button><button data-r="1">⟳</button></div>`; d.appendChild(stage);
            try { pv = Sims3DView.preview(stage); } catch (e) { pv = null; }
            stage.querySelectorAll("[data-r]").forEach((b) => b.onclick = () => pv && pv.turn(+b.dataset.r));
            const nameEl = d.querySelector(".sm-fn"), lnEl = d.querySelector(".sm-ln"); const ttl = () => { stage.querySelector(".sm-cas-title").textContent = ((nameEl.value || "") + " " + (lnEl.value || "")).trim() || "Create a Sim"; }; nameEl.addEventListener("input", ttl); lnEl.addEventListener("input", ttl);
            const ro2 = new ResizeObserver(() => pv && pv.resize()); ro2.observe(stage);
          }
          const portrait = () => { if (pv) { pv.set({ gender: c.gender, skin: c.skin, hair: c.hair, shirt: c.shirt, pants: c.pants, name: d.querySelector(".sm-fn").value || "Alex" }); return; } const cc = d.querySelector(".sm-cas-cv").getContext("2d"); cc.clearRect(0, 0, 120, 150); drawSimFigure(cc, 60, 140, 1.9, { gender: c.gender, skin: c.skin, hair: c.hair, shirt: c.shirt, pants: c.pants }, "stand", 0, 1, false); };
          portrait();
          d.querySelectorAll(".sm-gender button").forEach((b) => b.onclick = () => { c.gender = b.dataset.g; d.querySelectorAll(".sm-gender button").forEach((x) => x.classList.toggle("on", x === b)); portrait(); });
          d.querySelectorAll(".sm-sw").forEach((s) => s.querySelectorAll("button").forEach((b) => b.onclick = () => { c[s.dataset.k] = b.dataset.v; s.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); portrait(); }));
          const sliders = [...d.querySelectorAll("[data-tr]")];
          const sync = (changed) => {
            let total = sliders.reduce((a, s) => a + +s.value, 0);
            if (total > 25 && changed) { changed.value = +changed.value - (total - 25); total = 25; }
            sliders.forEach((s) => { c.traits[s.dataset.tr] = +s.value; s.parentElement.querySelector("b").textContent = s.value; });
            d.querySelector(".sm-pts b").textContent = 25 - total;
          };
          sliders.forEach((s) => s.oninput = () => sync(s)); sync();
        });
    }

    // ---------------- time ----------------
    const hour = () => Math.floor(G.min / 60) % 24;
    const fmtTime = (m) => { const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60); return `${(h % 12) || 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
    const SPEED_MULT = [0, 1, 3, 10];

    // ---------------- needs & mood ----------------
    function mood() {
      const n = G.sim.needs; let s = 0, w = 0;
      NEEDS.forEach((k) => { const v = n[k], wt = v < 25 ? 2.2 : 1; s += (v - 50) * wt; w += wt; });
      return clamp(s / w * 2, -100, 100);
    }
    function roomScore(x, y) {
      const r = roomOf(x, y); let s = insideHouse(x, y) ? 40 : 55;
      objs.forEach((o) => { const d = CAT[o.t]; if ((r && roomOf(o.x, o.y) === r) || (!r && !insideHouse(o.x, o.y) && Math.abs(o.x - x) + Math.abs(o.y - y) < 4)) s += d.room * 4; });
      const night = hour() >= 20 || hour() < 6; if (night && r && !objs.some((o) => CAT[o.t].light && roomOf(o.x, o.y) === r)) s -= 15;
      return clamp(s, 0, 100);
    }
    const traitMod = (k) => {
      const T = G.sim.traits, m = { hygiene: 1.25 - T.neat * 0.05, social: 0.75 + T.outgoing * 0.05, fun: 0.75 + T.playful * 0.05, energy: 1 };
      return m[k] || 1;
    };

    // ---------------- actions ----------------
    function queueAct(type, target, actor) {
      actor = actor || sim;
      if (actor === sim && acts.length >= 6) { notify("The action queue is full."); return; }
      acts.push({ type, target, phase: "new", t: 0, auto: false });
      paintQueue();
    }
    function startAct(a) {
      const A = ACTS[a.type];
      if (a.type === "goto") { const p = path(sim.x, sim.y, a.target.x, a.target.y); if (!p) { failAct(a, "Can't get there."); return; } sim.route = p.slice(1); a.phase = "walk"; return; }
      let spots;
      if (A.bedAct) {
        const n = a.target, bed = findBed();
        if (!bed) { failAct(a, "You need a bed for that."); return; }
        if (!npcs.includes(n) || n.leaving) { failAct(a, `${n.name} isn't here.`); return; }
        if ((G.rel[n.name] || 0) < 60) { n.say = "😳"; n.sayT = 2.5; changeRel(n.name, -8); failAct(a, `${n.name} isn't ready for that (needs a relationship of 60+).`); return; }
        const ps = path(sim.x, sim.y, bed.x, bed.y, bed), pn = path(n.x, n.y, bed.x + 1, bed.y, bed);
        if (!ps || !pn) { failAct(a, "Can't get to the bed."); return; }
        n.busy = true; n.route = pn.slice(1); n.bedTarget = bed; a.bed = bed; sim.route = ps.slice(1); a.phase = "walk"; return;
      }
      if (a.target && a.target.npc) {
        const n = a.target; if (!npcs.includes(n) || n.leaving) { failAct(a, n.leaving ? `${n.name} is leaving.` : null); return; }
        n.route = null; n.fx = n.x; n.fy = n.y; n.busy = true;
        spots = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [n.x + dx, n.y + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < LW && y < LH && !blockedCell(x, y) && !(x === n.x && y === n.y));
      } else spots = useSpots(a.target);
      if (A.dur === 0) spots = [[a.target.x, a.target.y]];
      let best = null;
      spots.forEach(([x, y]) => { const p = (x === sim.x && y === sim.y) ? [[x, y]] : path(sim.x, sim.y, x, y, a.target && !a.target.npc ? a.target : null); if (p && (!best || p.length < best.length)) best = p; });
      if (!best) { failAct(a, `${G.sim.name} can't reach the ${a.target.npc ? a.target.name : CAT[a.target.t].name}.`); return; }
      sim.route = best.slice(1); a.phase = "walk";
    }
    function failAct(a, why) { if (a.target && a.target.npc) a.target.busy = false; acts.splice(acts.indexOf(a), 1); if (why) { sim.say = "?"; sim.sayT = 2; notify(why); } paintQueue(); }
    function beginUse(a) {
      const A = ACTS[a.type]; a.phase = "use"; a.t = 0; sim.pose = A.pose;
      if (a.target && !a.target.npc && CAT[a.target.t]) { const tc = cells(a.target); const [cx, cy] = tc.reduce((m, c2) => (Math.hypot(c2[0] - sim.fx, c2[1] - sim.fy) < Math.hypot(m[0] - sim.fx, m[1] - sim.fy) ? c2 : m), tc[0]); sim.dir = (cx - cy) >= (sim.fx - sim.fy) ? 1 : -1; }
      if (a.target && a.target.npc) { a.target.busy = true; a.target.pose = "stand"; sim.dir = (a.target.x - a.target.y) >= (sim.x - sim.y) ? 1 : -1; a.target.dir = -sim.dir; sim.say = SIMLISH[(Math.random() * SIMLISH.length) | 0]; sim.sayT = 2.5; }
      if (A.job) { a.phase = "done"; openJobs(); }
      if (A.invite) inviteOver();
      if (A.mail) getMail();
      if (A.social === "bye") { const n = a.target; n.say = "Dag dag!"; n.sayT = 2; n.leaving = true; }
      if (A.bedAct) { sim.pose = "lie"; a.target.say = "😊"; a.target.sayT = 2; return; }
      if (A.social === "hug" && (G.rel[a.target.name] || 0) < 30) { a.target.say = "😠"; a.target.sayT = 2.5; changeRel(a.target.name, -6); notify(`${a.target.name} rejected the hug — they don't know ${G.sim.name} well enough.`); a.phase = "done"; }
    }
    function finishAct(a) {
      const A = ACTS[a.type];
      if (A.plate) { const spot = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => [sim.x + dx, sim.y + dy]).find(([x, y]) => x >= 0 && y >= 0 && x < LW && y < LH - 2 && !objAt(x, y) && !fixedBlock(x, y) && !objs.some((o) => o.x === x && o.y === y) && (canStep(sim.x, sim.y, x, sim.y) || canStep(sim.x, sim.y, sim.x, y))); if (spot) objs.push({ t: "plate", x: spot[0], y: spot[1] }); }
      if (A.painting) { const v = 20 + Math.round(G.sim.skills.creativity * 16 + Math.random() * 20); G.money += v; notify(`${G.sim.name} sold a painting for §${v}.`); }
      if (A.clean && a.target) { const i = objs.indexOf(a.target); if (i >= 0) objs.splice(i, 1); }
      if (A.babyCare && G.baby) { G.baby.care = clamp(G.baby.care + A.babyCare, 0, 100); G.baby.neglect = 0; }
      if (A.adopt) adoptBaby();
      if (A.call) changeRel(NEIGHBORS[(Math.random() * NEIGHBORS.length) | 0].name, 3);
      if (a.target && a.target.npc) {
        const n = a.target; n.busy = false; if (n.bedTarget) { n.bedTarget = null; n.pose = "stand"; }
        if (typeof A.social === "number") changeRel(n.name, A.social + (G.sim.traits.nice >= 6 ? 1 : 0));
        if (A.social === "joke") { const ok = Math.random() < 0.45 + G.sim.traits.playful * 0.05; changeRel(n.name, ok ? 5 : -4); n.say = ok ? "😆" : "😒"; n.sayT = 2; }
        if (A.social === "hug") { changeRel(n.name, 7); n.say = "🥰"; n.sayT = 2; }
        romanceOutcome(A, n);
      }
      sim.pose = "stand";
      acts.splice(acts.indexOf(a), 1); paintQueue();
    }
    // ---------------- romance, marriage & family ----------------
    function romanceOutcome(A, n) {
      const rv = G.rel[n.name] || 0, kid = n.role === "child";
      const no = (txt, d) => { changeRel(n.name, d); n.say = "😠"; n.sayT = 2.5; notify(txt); };
      if (A.social === "flirt") { if (kid) return; if (rv >= 20) { changeRel(n.name, 5 + (G.sim.traits.outgoing >= 6 ? 1 : 0)); n.say = "😊"; n.sayT = 2; } else no(`${n.name} wasn't interested in flirting.`, -4); }
      else if (A.social === "kiss") { if (rv >= 50) { G.romance[n.name] = true; changeRel(n.name, 8); n.say = "😍"; n.sayT = 2.5; if (!G.romanceToldOf) { G.romanceToldOf = true; notify(`💞 ${G.sim.name} and ${n.name} are now romantically involved!`); } } else no(`${n.name} rejected the kiss — not close enough yet.`, -10); }
      else if (A.social === "movein") {
        if (G.romance[n.name] && rv >= 70) { addToHousehold(n, false); }
        else no(`${n.name} isn't ready to move in (needs romance and a relationship of 70+).`, -6);
      }
      else if (A.social === "propose") {
        if (G.romance[n.name] && rv >= 85) { G.married = n.name; changeRel(n.name, 10); if (!n.member) addToHousehold(n, true); else msg("Just married!", `${G.sim.name} and ${n.name} are now married! 💍`); }
        else no(`${n.name} said no to the proposal (needs romance and a relationship of 85+).`, -12);
      }
      else if (A.social === "woohoo") {
        changeRel(n.name, 10); G.romance[n.name] = true;
        if (A.baby) tryForBaby(n); else notify(`💞 ${G.sim.name} and ${n.name} WooHoo'd.`);
      }
    }
    function addToHousehold(n, married) {
      const src = NEIGHBORS.find((x) => x.name === n.name) || n;
      const m = { name: n.name, gender: src.gender, skin: src.skin, hair: src.hair, shirt: src.shirt, pants: src.pants, role: "partner" };
      G.household.push(m); n.member = true; n.leaving = false; n.role = "partner"; save();
      msg(married ? "Just married!" : "Moving in!", married ? `${G.sim.name} and ${n.name} are now married! 💍 ${n.name} has moved in with the ${G.sim.family} family.` : `${n.name} has moved in with ${G.sim.name}! 🏡`);
    }
    function tryForBaby(n) {
      if (!n.member) { notify(`${n.name} needs to live with ${G.sim.name} first to start a family.`); return; }
      if (G.pregnant || G.baby) { notify("There's already a baby on the way or in the house."); return; }
      const pg = G.sim.gender, ng = n.gender;
      if (pg === ng) { notify(`💞 To have a baby, ${G.sim.name} and ${n.name} can adopt — use the phone.`); return; }
      if (Math.random() < 0.6) {
        G.pregnant = { who: pg === "F" ? "player" : n.name, due: G.min + 3 * 1440, partner: pg === "F" ? n.name : G.sim.name };
        msg("♪ A lullaby plays…", `It's a baby on the way! ${pg === "F" ? G.sim.name : n.name} is pregnant. The baby is due in 3 days.`); save();
      } else notify(`💞 ${G.sim.name} and ${n.name} tried for a baby — no luck this time.`);
    }
    function spawnCrib() {
      const cands = [];
      for (let y = 2; y <= 10; y++) for (let x = 2; x <= 12; x++) if (!objAt(x, y) && !(x === sim.x && y === sim.y) && useSpots({ t: "crib", x, y }).length) cands.push([x, y, roomOf(x, y) && roomOf(x, y).id === "bed" ? 0 : 1]);
      cands.sort((a, b) => a[2] - b[2]);
      if (cands[0]) objs.push({ t: "crib", x: cands[0][0], y: cands[0][1] });
    }
    function babyArrives(parentLook, partnerLook, via) {
      const gender = Math.random() < 0.5 ? "F" : "M";
      const pickCol = (a, b) => (Math.random() < 0.5 ? a : b) || a;
      const look = { skin: pickCol(parentLook.skin, partnerLook && partnerLook.skin), hair: pickCol(parentLook.hair, partnerLook && partnerLook.hair) };
      dialog(via === "adopt" ? "Adoption" : "It's a " + (gender === "F" ? "girl" : "boy") + "!", `<p>${via === "adopt" ? "A social worker has dropped off your new baby " + (gender === "F" ? "girl" : "boy") + "." : "The baby has arrived! Welcome to the family."}</p><label>Name <input class="sm-in sm-baby" maxlength="16" placeholder="Baby name"></label><p class="sm-small">Babies need feeding and play. In 3 days they grow into a child — but neglect them and the social worker will take them away.</p>`,
        [["Welcome!", (d) => {
          const name = d.querySelector(".sm-baby").value.trim() || (gender === "F" ? "Lily" : "Max");
          G.baby = { name, gender, skin: look.skin, hair: look.hair, born: G.min, care: 80, neglect: 0 };
          spawnCrib(); save(); notify(`👶 ${name} is in the bassinet.`);
        }]]);
    }
    function adoptBaby() {
      if (G.pregnant || G.baby) { notify("There's already a baby on the way or in the house."); return; }
      const partner = G.household.find((m) => m.role === "partner");
      babyArrives(G.sim, partner, "adopt");
    }
    function familyTick(gm) {
      if (G.pregnant && G.min >= G.pregnant.due) {
        const mom = G.pregnant.who === "player" ? G.sim : (member(G.pregnant.who) || G.sim);
        const dad = G.pregnant.who === "player" ? (member(G.pregnant.partner) || null) : G.sim;
        G.pregnant = null; babyArrives(mom, dad, "birth");
      }
      const B = G.baby; if (!B) return;
      B.care = clamp(B.care - 0.05 * gm, 0, 100);
      if (B.care <= 0) { B.neglect += gm; if (B.neglect > 720) { const c = objs.find((o) => o.t === "crib"); if (c) objs.splice(objs.indexOf(c), 1); msg("The social worker", `${B.name} was neglected, and the social worker has taken the baby away.`); G.baby = null; save(); return; } }
      if (G.min - B.born >= 3 * 1440 && B.care > 20) {
        const c = objs.find((o) => o.t === "crib"); if (c) objs.splice(objs.indexOf(c), 1);
        const SH = ["#e7a33a", "#3a6ad0", "#2e8a4a", "#c0283a", "#7a3ab0"], kid = { name: B.name, gender: B.gender, skin: B.skin, hair: B.hair, shirt: SH[(Math.random() * SH.length) | 0], pants: "#2a3a5a", role: "child" };
        G.household.push(kid); G.rel[B.name] = 60; G.baby = null; spawnMember(kid); save();
        msg("Growing up!", `${B.name} has grown into a child! 🎈`);
      }
    }

    function changeRel(name, d) { G.rel[name] = clamp((G.rel[name] || 0) + d, -100, 100); if (tab === "rel") paintTab(); }

    // ---------------- career ----------------
    function openJobs() {
      const opts = Object.keys(CAREERS).map((k) => { const lv = CAREERS[k].levels[0]; return `<button class="sm-job" data-k="${k}"><b>${CAREERS[k].name}</b><span>${lv[0]} — §${lv[1]}/day · 9 AM–3 PM</span></button>`; }).join("");
      dialog("Job listings", `<p>Pick a career track. The carpool picks you up at 8 AM on weekdays and weekends alike — be ready!</p><div class="sm-jobs">${opts}</div>`, [["Not now"]], (d) => {
        d.querySelectorAll(".sm-job").forEach((b) => b.onclick = () => {
          G.career = { track: b.dataset.k, level: 0, perf: 0, missed: 0, workedDay: 0 };
          d.hidden = true; dialogOpen = false; save(); paintTab();
          setTimeout(() => msg("You're hired!", `${G.sim.name} is now a ${CAREERS[b.dataset.k].levels[0][0]} in the ${CAREERS[b.dataset.k].name} career. The carpool arrives at 8 AM — work runs 9 AM to 3 PM.`), 30);
        });
      });
    }
    let carpool = null; // { until }
    function careerTick() {
      const C = G.career; if (!C) return;
      const h = hour(), m = G.min % 60;
      if (!sim.away && !carpool && h === 8 && m < 2 && C.workedDay !== G.day) {
        carpool = { until: G.min + 60 }; notify("🚗 The carpool is here!");
        acts.length = 0; sim.route = null; sim.pose = "stand"; // drop everything and go
        const p = path(sim.x, sim.y, 8, 13); if (p) { sim.route = p.slice(1); acts.push({ type: "goto", target: { x: 8, y: 13 }, phase: "walk", t: 0, work: true }); }
        paintQueue();
      }
      if (carpool && !sim.away) {
        if (sim.x === 8 && sim.y === 13) { sim.away = true; carpool = null; C.workedDay = G.day; C.returnAt = G.min + 7 * 60; acts.length = 0; paintQueue(); notify(`${G.sim.name} went to work.`); }
        else if (G.min >= carpool.until) {
          carpool = null; C.missed++; C.perf -= 20; C.workedDay = G.day;
          if (C.missed >= 2) { msg("Fired!", `${G.sim.name} missed work too many times and was fired from the ${CAREERS[C.track].name} career.`); G.career = null; }
          else msg("Missed work", `${G.sim.name} missed the carpool. Miss work again and you'll be fired!`);
          paintTab();
        }
      }
      if (sim.away && G.min >= C.returnAt) {
        sim.away = false; sim.x = 8; sim.y = 13; sim.fx = 8; sim.fy = 13;
        const lv = CAREERS[C.track].levels[C.level], pay = lv[1]; G.money += pay;
        const md = mood(); C.perf = clamp(C.perf + (md > 0 ? 15 : -10), -100, 100); C.missed = 0;
        // work drains motives, like the original
        const n = G.sim.needs; n.hunger = clamp(n.hunger - 30, 0, 100); n.energy = clamp(n.energy - 35, 0, 100); n.hygiene = clamp(n.hygiene - 25, 0, 100); n.fun = clamp(n.fun - 20, 0, 100); n.bladder = clamp(n.bladder - 40, 0, 100); n.social = clamp(n.social + 10, 0, 100);
        let text = `${G.sim.name} earned §${pay} today.`;
        const next = CAREERS[C.track].levels[C.level + 1];
        if (next) {
          const req = next[2], ok = Object.keys(req).every((k) => G.sim.skills[k] >= req[k]);
          if (ok && C.perf >= 20 && md > -10 && Math.random() < 0.5) { C.level++; C.perf = 0; msg("Promotion!", `${G.sim.name} has been promoted to ${next[0]}! New salary: §${next[1]}/day.`); text = ""; }
          else if (!ok) text += ` To be promoted to ${next[0]}, build: ${Object.keys(req).filter((k) => G.sim.skills[k] < req[k]).map((k) => SKILL_LABEL[k] + " " + req[k]).join(", ")}.`;
        }
        if (text) notify(text);
        paintTab(); save();
      }
    }

    // ---------------- bills, mail, Repo Man ----------------
    function billTick() {
      if (G.day >= G.billDay && hour() === 9 && !G.billsToday) {
        G.billsToday = true; const total = objs.reduce((a, o) => a + CAT[o.t].price, 0), amt = Math.round(total * 0.03 / 5) * 5 + 50;
        G.bills.push({ amt, day: G.day }); G.billDay = G.day + 3; notify(`📬 Bills have arrived (§${amt}). Get the mail to pay them.`);
      }
      if (hour() === 10) G.billsToday = false;
      const overdue = G.bills.find((b) => G.day - b.day >= 4);
      if (overdue && !G.repoToday) {
        G.repoToday = true;
        const sellable = objs.filter((o) => !CAT[o.t].fixed).sort((a, b) => CAT[b.t].price - CAT[a.t].price);
        if (sellable[0]) { const o = sellable[0]; objs.splice(objs.indexOf(o), 1); G.bills.splice(G.bills.indexOf(overdue), 1); msg("The Repo Man", `Your bills were overdue! The Repo Man took the ${CAT[o.t].name} (worth §${CAT[o.t].price}) to cover them.`); }
      }
      if (hour() === 0) G.repoToday = false;
    }
    function getMail() {
      if (!G.bills.length) { notify("No mail today."); return; }
      const total = G.bills.reduce((a, b) => a + b.amt, 0);
      dialog("Bills", `<p>You have ${G.bills.length} bill${G.bills.length > 1 ? "s" : ""} totaling <b>§${total}</b>.</p>`, [["Pay bills", () => {
        if (G.money < total) { msg("Not enough Simoleons", "You can't afford to pay the bills right now. Pay them within 4 days or the Repo Man will come."); return; }
        G.money -= total; G.bills = []; notify(`Paid §${total} in bills.`); save();
      }], ["Later"]]);
    }

    // ---------------- neighbors ----------------
    function inviteOver() {
      const avail = NEIGHBORS.filter((n) => !npcs.some((x) => x.name === n.name));
      if (!avail.length) { notify("Everyone's already here!"); return; }
      const n = avail[(Math.random() * avail.length) | 0];
      notify(`${n.name} will be right over.`);
      setTimeout(() => {
        if (dead) return; const e = makeSimEntity({ ...n, x: 0, y: 12 }, false);
        e.npc = true; e.leaveAt = G.min + 240 + Math.random() * 120; e.wanderT = 0; npcs.push(e);
        e.say = "Sul sul!"; e.sayT = 3; notify(`${n.name} has come to visit.`);
        const p = path(0, 12, 7, 11); if (p) e.route = p.slice(1);
      }, 1500);
    }
    function npcTick(n, dt, gm) {
      if (n.busy) return;
      if (n.member) {
        const night = hour() >= 22 || hour() < 6, bed = findBed();
        if (night && n.role === "partner" && bed && !(n.x === bed.x + 1 && n.y === bed.y)) { const p = path(n.x, n.y, bed.x + 1, bed.y, bed); if (p) { n.route = p.slice(1); n.sitAfter = false; n.sleepAfter = true; } return; }
        if (night && n.role === "partner") { n.pose = "lie"; return; }
      } else if (G.min >= n.leaveAt && !n.leaving) { n.leaving = true; n.say = "Dag dag!"; n.sayT = 2; }
      if (n.leaving && !n.route) { if (n.x === 0 && n.y === 12) { npcs.splice(npcs.indexOf(n), 1); return; } const p = path(n.x, n.y, 0, 12); n.route = p ? p.slice(1) : null; if (!p) npcs.splice(npcs.indexOf(n), 1); return; }
      if (!n.route) {
        n.wanderT -= gm;
        if (n.wanderT <= 0) {
          n.wanderT = 30 + Math.random() * 60; n.sleepAfter = false;
          const seats = objs.filter((o) => CAT[o.t].seat && !(o.x === sim.x && o.y === sim.y) && !npcs.some((m) => m !== n && m.x === o.x && m.y === o.y));
          if (seats.length && Math.random() < 0.5) { const s2 = seats[(Math.random() * seats.length) | 0], p = path(n.x, n.y, s2.x, s2.y, s2); if (p) { n.route = p.slice(1); n.sitAfter = true; } }
          else { for (let k = 0; k < 10; k++) { const x = 2 + ((Math.random() * 11) | 0), y = 7 + ((Math.random() * 4) | 0); if (!blockedCell(x, y)) { const p = path(n.x, n.y, x, y); if (p) { n.route = p.slice(1); n.sitAfter = false; } break; } } }
          n.pose = "stand";
        }
      }
    }

    // ---------------- free will ----------------
    let idleT = 0;
    function freeWill(gm) {
      if (!G.freeWill || acts.length || sim.away || sim.route) { idleT = 0; return; }
      idleT += gm; if (idleT < 8) return; idleT = 0;
      const n = G.sim.needs; let best = null, bs = 0;
      objs.forEach((o) => CAT[o.t].ints.forEach((k) => {
        const A = ACTS[k]; if (!A || A.job || A.invite || A.mail || A.call || A.study || A.painting) return;
        if (A.clean && !(G.sim.traits.neat >= 4 || Math.random() < 0.3)) return;
        let s = 0; for (const nk in A.gain) { const need = n[nk]; if (A.gain[nk] > 0) s += A.gain[nk] * (A.dur || 10) * Math.pow((100 - need) / 100, 2) * (need < 30 ? 3 : 1); }
        if (A.clean) s += 6;
        if (k === "sleep" && n.energy > 45) s *= 0.1;
        s *= 0.8 + Math.random() * 0.4;
        const dist = Math.abs(o.x - sim.x) + Math.abs(o.y - sim.y); s /= 1 + dist * 0.04;
        if (s > bs) { bs = s; best = [k, o]; }
      }));
      if (best && bs > 4) { acts.push({ type: best[0], target: best[1], phase: "new", t: 0, auto: true }); paintQueue(); }
    }

    // ---------------- per-tick update ----------------
    function walk(e, dt) {
      if (!e.route || !e.route.length) { e.route = null; return true; }
      const [tx, ty] = e.route[0], sp = 2.4 * dt;
      const dx = tx - e.fx, dy = ty - e.fy, d = Math.hypot(dx, dy);
      if (d > 1.6) { // stairs: climb takes a moment, then the Sim is on the other floor
        e.stairT = (e.stairT || 0) + dt; e.pose = "walk"; e.anim += dt * 9;
        if (e.stairT < 0.9) return false;
        e.stairT = 0; e.fx = tx; e.fy = ty; e.x = tx; e.y = ty; e.route.shift(); if (!e.route.length) { e.route = null; e.pose = "stand"; return true; } return false;
      }
      if (Math.abs(dx - dy) > 0.01) e.dir = (dx - dy) > 0 ? 1 : -1;
      e.pose = "walk"; e.anim += dt * 9;
      if (d <= sp) { e.fx = tx; e.fy = ty; e.x = tx; e.y = ty; e.route.shift(); if (!e.route.length) { e.route = null; e.pose = "stand"; return true; } }
      else { e.fx += dx / d * sp; e.fy += dy / d * sp; }
      return false;
    }
    function update(dt) {
      t += dt;
      flash.forEach((f) => (f.t -= dt)); flash = flash.filter((f) => f.t > 0);
      if (!G || dialogOpen || mode === "buy") return;
      const mult = SPEED_MULT[G.speed], sdt = dt * mult, gm = sdt; // 1 game minute per sim-second
      if (!mult) return;
      const prevDay = Math.floor(G.min / 1440);
      G.min += gm;
      if (Math.floor(G.min / 1440) !== prevDay) { G.day++; save(); }
      // motives
      const N = G.sim.needs, cur = acts[0], A = cur && cur.phase === "use" ? ACTS[cur.type] : null;
      if (!sim.away) {
        for (const k in DECAY) { if (A && A.sleeping && (k === "energy")) continue; N[k] = clamp(N[k] - DECAY[k] * gm * traitMod(k) * (A && A.sleeping ? 0.5 : 1), 0, 100); }
        if (!(A && (A.pose === "sit" || A.pose === "lie" || A.pose === "bath"))) N.comfort = clamp(N.comfort - 0.12 * gm, 0, 100);
        N.room = clamp(N.room + (roomScore(sim.x, sim.y) - N.room) * Math.min(1, gm * 0.05), 0, 100);
        if (A) for (const k in A.gain) N[k] = clamp(N[k] + A.gain[k] * gm * (k === "hunger" && A.skill === "cooking" ? 1 + G.sim.skills.cooking * 0.06 : 1), 0, 100);
        if (A && A.skill) { const lvl = G.sim.skills[A.skill]; if (lvl < 10) G.sim.skills[A.skill] = Math.min(10, lvl + gm / (40 + lvl * 18)); }
        // failures
        if (N.bladder <= 0 && !(A && A.type === "toilet")) { N.bladder = 60; N.hygiene = clamp(N.hygiene - 40, 0, 100); if (!objAt(sim.x, sim.y) && !objs.some((o) => o.t === "puddle" && o.x === sim.x && o.y === sim.y)) objs.push({ t: "puddle", x: sim.x, y: sim.y }); sim.say = "😳"; sim.sayT = 3; notify(`${G.sim.name} couldn't hold it!`); }
        if (N.energy <= 0 && !(A && A.sleeping)) { acts.length = 0; sim.route = null; acts.push({ type: "nap", target: null, phase: "use", t: 0, floor: true }); sim.pose = "lie"; notify(`${G.sim.name} passed out from exhaustion!`); paintQueue(); }
        if (N.hunger <= 0) { G.starveT = (G.starveT || 0) + gm; if (G.starveT > 480) { G.starveT = 0; N.hunger = 40; G.money = Math.max(0, G.money - 500); msg("Rushed to the hospital", `${G.sim.name} collapsed from hunger and was taken to the hospital. The bill was §500. Remember to eat!`); } } else G.starveT = 0;
      }
      // thought bubble for the lowest need
      const low = NEEDS.filter((k) => k !== "room").sort((a, b) => N[a] - N[b])[0];
      sim.think = N[low] < 28 ? NEED_ICON[low] : null;
      careerTick(); billTick(); familyTick(gm);
      // current action
      if (!sim.away) {
        if (cur) {
          if (cur.phase === "new") startAct(cur);
          if (cur.phase === "walk") { if (walk(sim, sdt)) { if (cur.type === "goto") { acts.splice(acts.indexOf(cur), 1); paintQueue(); } else if (cur.target && cur.target.npc && Math.abs(cur.target.x - sim.x) + Math.abs(cur.target.y - sim.y) > 1) { cur.phase = "new"; } else beginUse(cur); } }
          if (cur.phase === "use" && ACTS[cur.type].bedAct && cur.target.route) { /* waiting for the partner to get into bed */ }
          else if (cur.phase === "use") {
            if (ACTS[cur.type].bedAct) cur.target.pose = "lie";
            cur.t += gm;
            const Au = ACTS[cur.type];
            const full = Au.until && N[Au.until] >= 99.5;
            if ((Au.dur && cur.t >= Au.dur) || full) { if (cur.floor) { acts.splice(acts.indexOf(cur), 1); sim.pose = "stand"; paintQueue(); } else finishAct(cur); }
          }
          if (cur.phase === "done") { if (cur.target && cur.target.npc) cur.target.busy = false; acts.splice(acts.indexOf(cur), 1); sim.pose = "stand"; paintQueue(); }
        } else { sim.pose = sim.route ? "walk" : "stand"; if (sim.route) walk(sim, sdt); freeWill(gm); }
      }
      npcs.slice().forEach((n) => { if (n.route) { const arrived = walk(n, sdt); if (arrived && (n.bedTarget || n.sleepAfter)) n.pose = "lie"; else if (arrived && n.sitAfter) n.pose = "sit"; } else npcTick(n, sdt, gm); });
      if (sim.sayT > 0) sim.sayT -= dt; npcs.forEach((n) => { if (n.sayT > 0) n.sayT -= dt; });
      if (t - lastSave > 20) { lastSave = t; save(); }
    }

    // ---------------- drawing ----------------
    function poly(pts, fill, stroke) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); } }
    function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255; r = clamp(Math.round(r * f), 0, 255); gg = clamp(Math.round(gg * f), 0, 255); b = clamp(Math.round(b * f), 0, 255); return `rgb(${r},${gg},${b})`; }
    function box(x, y, w, d, h, col, m, z0) { // iso box over cells x..x+w, y..y+d
      m = m == null ? 0.12 : m; z0 = z0 || 0;
      const x0 = x + m, x1 = x + w - m, y0 = y + m, y1 = y + d - m;
      const t0 = P(x0, y0, z0 + h), t1 = P(x1, y0, z0 + h), t2 = P(x1, y1, z0 + h), t3 = P(x0, y1, z0 + h);
      const b1 = P(x1, y0, z0), b2 = P(x1, y1, z0), b3 = P(x0, y1, z0);
      poly([t1, t2, b2, b1], shade(col, 0.78)); poly([t3, t2, b2, b3], shade(col, 0.9)); poly([t0, t1, t2, t3], col, "rgba(0,0,0,.18)");
      return { top: [t0, t1, t2, t3], bb: [Math.min(t3[0], b3[0]), t0[1], Math.max(t1[0], b1[0]), b2[1]] };
    }
    function floorTile(x, y) {
      const r = roomOf(x, y), c = [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)];
      let col;
      if (y === LH - 1) col = "#3a3d44";
      else if (y === LH - 2) col = (x + y) % 2 ? "#b8b8b0" : "#c4c4bc";
      else if (!r) col = (hash(x, y) > 0.5) ? "#4f9a3a" : "#56a33f";
      else if (r.floor === "wood") col = (x % 2) ? "#b07a44" : "#a8723e";
      else if (r.floor === "carpet") col = "#4a6aa0";
      else if (r.floor === "tile") col = (x + y) % 2 ? "#e8eef2" : "#cfd8de";
      else col = (x + y) % 2 ? "#e9d48a" : "#d9c27a";
      poly(c, col, "rgba(0,0,0,.08)");
      if (y === LH - 1 && x % 3 === 1) { const a = P(x + 0.3, y + 0.5), b2 = P(x + 0.7, y + 0.5); g.strokeStyle = "#e8d84a"; g.lineWidth = 2 * zoom; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b2[0], b2[1]); g.stroke(); }
      
    }
    function wallSeg(x0, y0, x1, y1, h, full) {
      const a = P(x0, y0), b = P(x1, y1), a2 = P(x0, y0, h), b2 = P(x1, y1, h);
      const side = x0 === x1; // west-edge wall (runs along y)
      poly([a, b, b2, a2], full ? (side ? "#d8cbb0" : "#e6dac0") : (side ? "#c9bca0" : "#d8cbb0"), "rgba(0,0,0,.25)");
      if (full) { g.strokeStyle = "rgba(160,120,90,.25)"; g.lineWidth = 1; for (let k = 0.25; k < 1; k += 0.25) { const p1 = P(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k), p2 = P(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, h); g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke(); } }
      poly([a2, b2, [b2[0], b2[1] - 3 * zoom], [a2[0], a2[1] - 3 * zoom]], "#8a7a60");
    }
    function drawObject(o) {
      const d = CAT[o.t], x = o.x, y = o.y, night = hour() >= 19 || hour() < 6;
      let bb;
      switch (o.t) {
        case "bed": { const fr = box(x, y, 2, 1, 14, "#6a4a2a", 0.06); box(x, y, 2, 1, 6, "#f4f2ee", 0.12, 14); box(x + 0.9, y, 1.1, 1, 4, "#3a5a9a", 0.1, 20); box(x, y, 0.55, 1, 6, "#ffffff", 0.2, 20); box(x, y, 0.16, 1, 26, "#5a3a20", 0.04); bb = fr.bb; bb[1] -= 26 * zoom; break; }
        case "sofa": { box(x, y, 2, 1, 14, d.col, 0.06); box(x, y, 2, 0.32, 30, shade(d.col, 0.85), 0.06); box(x, y, 0.22, 1, 22, shade(d.col, 0.9), 0.06); bb = box(x + 1.78, y, 0.22, 1, 22, shade(d.col, 0.9), 0.06).bb; bb[0] -= 60 * zoom; bb[1] -= 10 * zoom; break; }
        case "armchair": case "chair": { box(x, y, 1, 1, o.t === "chair" ? 16 : 14, d.col, 0.18); bb = box(x, y, 1, 0.3, o.t === "chair" ? 34 : 32, shade(d.col, 0.85), 0.18).bb; break; }
        case "table": bb = box(x, y, 2, 1, 26, d.col, 0.08).bb; break;
        case "toilet": { box(x, y, 1, 0.38, 32, d.col, 0.24); bb = box(x, y + 0.22, 1, 0.6, 16, d.col, 0.3).bb; break; }
        case "shower": { const b2 = box(x, y, 1, 1, 4, "#dfe8ee", 0.04); const tl = P(x + 0.06, y + 0.94), tr = P(x + 0.94, y + 0.94), tr2 = P(x + 0.94, y + 0.94, 84), tl2 = P(x + 0.06, y + 0.94, 84), rr = P(x + 0.94, y + 0.06), rr2 = P(x + 0.94, y + 0.06, 84);
          o._glass = () => { poly([tl, tr, tr2, tl2], "rgba(190,225,245,.35)", "rgba(120,160,190,.6)"); poly([tr, rr, rr2, tr2], "rgba(170,210,235,.3)", "rgba(120,160,190,.6)"); };
          bb = [tl[0], rr2[1] - 10 * zoom, rr[0], tr[1]]; void b2; break; }
        case "tub": { const b3 = box(x, y, 2, 1, 22, d.col, 0.06); poly(b3.top.map((p) => [p[0], p[1] + 3 * zoom]), "#7ec4e6"); bb = b3.bb; break; }
        case "sink": { box(x, y, 1, 0.5, 30, "#c9b89a", 0.12); bb = box(x, y, 1, 0.5, 6, "#ffffff", 0.2, 30).bb; break; }
        case "fridge": bb = box(x, y, 1, 0.9, 76, d.col, 0.08).bb; { const a = P(x + 0.92, y + 0.3, 66), b = P(x + 0.92, y + 0.3, 46); g.strokeStyle = "#8a9098"; g.lineWidth = 2 * zoom; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } break;
        case "stove": { const b4 = box(x, y, 1, 0.9, 32, d.col, 0.08); [[0.3, 0.3], [0.65, 0.3], [0.3, 0.65], [0.65, 0.65]].forEach(([a, b]) => { const p = P(x + a, y + b, 32); g.fillStyle = "#30343a"; g.beginPath(); g.ellipse(p[0], p[1], 6 * zoom, 3 * zoom, 0, 0, 7); g.fill(); }); bb = b4.bb; break; }
        case "counter": bb = box(x, y, 1, 0.9, 32, d.col, 0.04).bb; box(x, y, 1, 0.9, 3, "#e0d6c4", 0.02, 32); break;
        case "tv": { box(x, y, 1, 0.6, 18, "#5a3a22", 0.16); const b5 = box(x, y, 1, 0.5, 26, d.col, 0.2, 18); const s = b5.top; const fl = (Math.sin(t * 9) + 1) / 2; const sc = [P(x + 0.26, y + 0.72, 22), P(x + 0.74, y + 0.72, 22), P(x + 0.74, y + 0.72, 40), P(x + 0.26, y + 0.72, 40)]; poly(sc, acts[0] && acts[0].type === "tv" && acts[0].phase === "use" ? `rgb(${120 + fl * 80},${170 + fl * 60},255)` : "#1a2a30"); bb = [b5.bb[0], s[0][1], b5.bb[2], b5.bb[3] + 18 * zoom]; break; }
        case "computer": { box(x, y, 1, 0.8, 24, "#7a5a3a", 0.08); box(x + 0.25, y + 0.15, 0.5, 0.45, 18, d.col, 0, 24); const on = acts[0] && ["games", "surf", "job"].includes(acts[0].type) && acts[0].phase === "use"; poly([P(x + 0.3, y + 0.62, 27), P(x + 0.72, y + 0.62, 27), P(x + 0.72, y + 0.62, 40), P(x + 0.3, y + 0.62, 40)], on ? "#7ad0ff" : "#20303a"); bb = box(x, y, 1, 0.8, 24, "#7a5a3a", 0.08).bb; bb[1] -= 22 * zoom; break; }
        case "stereo": bb = box(x, y, 1, 0.6, 36, d.col, 0.2).bb; { const p = P(x + 0.5, y + 0.82, 22); g.fillStyle = "#555"; g.beginPath(); g.arc(p[0], p[1], 5 * zoom, 0, 7); g.fill(); } break;
        case "phone": { box(x, y, 1, 0.7, 22, "#7a5a3a", 0.25); bb = box(x, y, 1, 0.7, 5, d.col, 0.35, 22).bb; bb[1] -= 4 * zoom; break; }
        case "bookshelf": { bb = box(x, y, 1, 0.5, 78, d.col, 0.06).bb; for (let r2 = 0; r2 < 4; r2++) for (let k = 0; k < 5; k++) { const p = P(x + 0.14 + k * 0.15, y + 0.56, 10 + r2 * 17); g.fillStyle = ["#c0283a", "#2e6ad0", "#e7a33a", "#2e8a4a", "#7a3ab0"][(k + r2) % 5]; g.fillRect(p[0], p[1] - 12 * zoom, 4 * zoom, 12 * zoom); } break; }
        case "chess": { const b6 = box(x, y, 1, 1, 28, d.col, 0.15); [[0, 0], [1, 1], [0, 2], [2, 0], [1, 3], [3, 1], [2, 2], [3, 3]].forEach(([a, b]) => { poly([P(x + 0.2 + a * 0.15, y + 0.2 + b * 0.15, 28), P(x + 0.35 + a * 0.15, y + 0.2 + b * 0.15, 28), P(x + 0.35 + a * 0.15, y + 0.35 + b * 0.15, 28), P(x + 0.2 + a * 0.15, y + 0.35 + b * 0.15, 28)], "#f0e6d0"); }); bb = b6.bb; break; }
        case "easel": { const a = P(x + 0.5, y + 0.5), top = P(x + 0.5, y + 0.5, 62); g.strokeStyle = "#7a5230"; g.lineWidth = 3 * zoom; g.beginPath(); g.moveTo(a[0] - 10 * zoom, a[1]); g.lineTo(top[0], top[1]); g.lineTo(a[0] + 10 * zoom, a[1]); g.stroke(); poly([P(x + 0.2, y + 0.55, 26), P(x + 0.8, y + 0.55, 26), P(x + 0.8, y + 0.55, 56), P(x + 0.2, y + 0.55, 56)], "#fbf7ee", "#7a5230"); g.fillStyle = "#e14b3b"; const c2 = P(x + 0.45, y + 0.55, 44); g.fillRect(c2[0], c2[1], 8 * zoom, 6 * zoom); bb = [a[0] - 20 * zoom, top[1], a[0] + 20 * zoom, a[1]]; break; }
        case "mirror": { const a = P(x + 0.1, y + 0.3), b = P(x + 0.9, y + 0.3); poly([a, b, P(x + 0.9, y + 0.3, 70), P(x + 0.1, y + 0.3, 70)], "#7a5230"); poly([P(x + 0.18, y + 0.32, 6), P(x + 0.82, y + 0.32, 6), P(x + 0.82, y + 0.32, 64), P(x + 0.18, y + 0.32, 64)], "#bfe6f4"); bb = [a[0], P(x + 0.1, y + 0.3, 70)[1], b[0], b[1]]; break; }
        case "gym": { box(x, y, 1, 1, 12, d.col, 0.25); const a = P(x + 0.1, y + 0.5, 26), b = P(x + 0.9, y + 0.5, 26); g.strokeStyle = "#999"; g.lineWidth = 3 * zoom; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.fillStyle = "#222"; [a, b].forEach((p) => { g.beginPath(); g.arc(p[0], p[1], 6 * zoom, 0, 7); g.fill(); }); bb = [a[0] - 6, a[1] - 10, b[0] + 6, P(x + 1, y + 1)[1]]; break; }
        case "plant": { box(x, y, 1, 1, 14, "#a0603a", 0.3); const c2 = P(x + 0.5, y + 0.5, 14); g.fillStyle = "#2e8a3a"; for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + 0.3; g.beginPath(); g.ellipse(c2[0] + Math.cos(a) * 10 * zoom, c2[1] - 18 * zoom + Math.sin(a) * 6 * zoom, 12 * zoom, 5 * zoom, a, 0, 7); g.fill(); } bb = [c2[0] - 22 * zoom, c2[1] - 34 * zoom, c2[0] + 22 * zoom, c2[1] + 14 * zoom]; break; }
        case "lamp": { const a = P(x + 0.5, y + 0.5), top = P(x + 0.5, y + 0.5, 60); g.strokeStyle = "#555"; g.lineWidth = 2 * zoom; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(top[0], top[1]); g.stroke(); g.fillStyle = night ? "#fff2b0" : "#e8d7a0"; g.beginPath(); g.moveTo(top[0] - 9 * zoom, top[1] + 8 * zoom); g.lineTo(top[0] + 9 * zoom, top[1] + 8 * zoom); g.lineTo(top[0] + 6 * zoom, top[1] - 6 * zoom); g.lineTo(top[0] - 6 * zoom, top[1] - 6 * zoom); g.fill(); bb = [top[0] - 10 * zoom, top[1] - 8 * zoom, top[0] + 10 * zoom, a[1]]; break; }
        case "sculpture": { box(x, y, 1, 1, 18, "#ddd", 0.25); const c2 = P(x + 0.5, y + 0.5, 18); g.fillStyle = d.col; g.beginPath(); g.ellipse(c2[0], c2[1] - 18 * zoom, 8 * zoom, 18 * zoom, 0.5, 0, 7); g.fill(); bb = [c2[0] - 14 * zoom, c2[1] - 38 * zoom, c2[0] + 14 * zoom, c2[1] + 14 * zoom]; break; }
        case "trash": bb = box(x, y, 1, 1, 24, d.col, 0.3).bb; break;
        case "mailbox": { const a = P(x + 0.5, y + 0.5), top = P(x + 0.5, y + 0.5, 30); g.strokeStyle = "#5a4a3a"; g.lineWidth = 3 * zoom; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(top[0], top[1]); g.stroke(); box(x + 0.25, y + 0.3, 0.5, 0.4, 12, d.col, 0, 30); if (G.bills.length) { g.fillStyle = "#e33"; g.fillRect(top[0] + 8 * zoom, top[1] - 16 * zoom, 3 * zoom, 12 * zoom); } bb = [a[0] - 14 * zoom, top[1] - 14 * zoom, a[0] + 14 * zoom, a[1]]; break; }
        case "crib": {
          const b7 = box(x, y, 1, 1, 18, "#e8d4e2", 0.14); box(x, y, 1, 1, 6, "#ffffff", 0.2, 18);
          const B = G.baby, c2 = P(x + 0.45, y + 0.5, 26);
          if (B) { g.fillStyle = B.skin; g.beginPath(); g.arc(c2[0], c2[1], 5.5 * zoom, 0, 7); g.fill(); g.fillStyle = B.hair; g.beginPath(); g.arc(c2[0], c2[1] - 2 * zoom, 5.5 * zoom, Math.PI, 0); g.fill();
            if (B.care < 35) bubble(c2[0] + 14 * zoom, c2[1] - 16 * zoom, "😭", true); }
          bb = b7.bb; bb[1] -= 14 * zoom; break; }
        case "plate": { const c2 = P(x + 0.5, y + 0.5); g.fillStyle = "#f0ede6"; g.beginPath(); g.ellipse(c2[0], c2[1], 9 * zoom, 4.5 * zoom, 0, 0, 7); g.fill(); g.fillStyle = "#8a6a2a"; g.beginPath(); g.ellipse(c2[0] + 2 * zoom, c2[1], 4 * zoom, 2 * zoom, 0, 0, 7); g.fill(); g.fillStyle = "rgba(120,140,60,.6)"; for (let k = 0; k < 3; k++) { const yy = c2[1] - 6 * zoom - ((t * 12 + k * 7) % 14) * zoom; g.fillRect(c2[0] - 4 * zoom + k * 4 * zoom, yy, 2 * zoom, 2 * zoom); } bb = [c2[0] - 10 * zoom, c2[1] - 10 * zoom, c2[0] + 10 * zoom, c2[1] + 6 * zoom]; break; }
        case "puddle": { const c2 = P(x + 0.5, y + 0.5); g.fillStyle = "rgba(220,226,80,.75)"; g.beginPath(); g.ellipse(c2[0], c2[1], 16 * zoom, 7 * zoom, 0.2, 0, 7); g.fill(); bb = [c2[0] - 16 * zoom, c2[1] - 8 * zoom, c2[0] + 16 * zoom, c2[1] + 8 * zoom]; break; }
        default: bb = box(x, y, d.w, 1, d.h, d.col).bb;
      }
      o._bb = bb;
    }

    // Sim figure (also used by Create-a-Sim). (x,y) = feet.
    function drawSimFigure(c, x, y, s, look, pose, anim, dir, censor) {
      const step = pose === "walk" ? Math.sin(anim) * 4 : 0, sit = pose === "sit", lie = pose === "lie" || pose === "bath";
      c.save(); c.translate(x, y); c.scale(dir < 0 ? -s : s, s);
      c.fillStyle = "rgba(0,0,0,.22)"; c.beginPath(); c.ellipse(0, 0, 10, 4, 0, 0, 7); c.fill();
      if (lie) { // head on the pillow, body under the blanket / in the water
        c.fillStyle = look.skin; c.beginPath(); c.arc(-14, -12, 6.5, 0, 7); c.fill(); c.fillStyle = look.hair; c.beginPath(); c.arc(-15, -15, 6.5, Math.PI, 0); c.fill(); if (look.gender === "F") c.fillRect(-22, -16, 4, 10);
        if (pose === "lie") { c.fillStyle = "#1a1a1a"; c.fillRect(-16, -12, 2, 1); c.fillRect(-12, -12, 2, 1); }
        c.restore(); return;
      }
      const legH = sit ? 8 : 18, hip = -legH;
      c.fillStyle = look.pants;
      if (sit) { c.fillRect(-7, hip - 2, 6, 8); c.fillRect(1, hip - 2, 6, 8); c.fillRect(-7, hip + 4, 14, 4); }
      else { c.fillRect(-6 + step * 0.4, hip, 5, legH); c.fillRect(1 - step * 0.4, hip, 5, legH); }
      c.fillStyle = "#2a2018"; if (!sit) { c.fillRect(-7 + step * 0.4, -3, 7, 3); c.fillRect(0 - step * 0.4, -3, 7, 3); }
      const torso = hip - 22;
      c.fillStyle = look.shirt; c.fillRect(-8, torso, 16, 23);
      if (look.pregnant) { c.beginPath(); c.ellipse(4, torso + 15, 7.5, 7.5, 0, 0, 7); c.fill(); }
      // arms
      const dance = pose === "dance", armSw = pose === "walk" ? Math.sin(anim) * 5 : dance ? Math.sin(anim * 1.3) * 10 : 0;
      c.fillStyle = look.shirt;
      if (dance) { c.fillRect(-12, torso - 10 + armSw * 0.4, 4, 16); c.fillRect(8, torso - 10 - armSw * 0.4, 4, 16); c.fillStyle = look.skin; c.fillRect(-12, torso - 13 + armSw * 0.4, 4, 4); c.fillRect(8, torso - 13 - armSw * 0.4, 4, 4); }
      else if (pose === "cook" || pose === "eat") { c.fillRect(-12, torso + 2, 4, 10); c.fillRect(8, torso + 2, 4, 10); c.fillStyle = look.skin; c.fillRect(-12, torso + 11, 14, 4); c.fillRect(2, torso + 11, 10, 4); }
      else { c.fillRect(-12, torso + 2 - armSw * 0.2, 4, 17); c.fillRect(8, torso + 2 + armSw * 0.2, 4, 17); c.fillStyle = look.skin; c.fillRect(-12, torso + 18 - armSw * 0.2, 4, 4); c.fillRect(8, torso + 18 + armSw * 0.2, 4, 4); }
      // head
      c.fillStyle = look.skin; c.fillRect(-3, torso - 4, 6, 5); c.beginPath(); c.arc(0, torso - 11, 8, 0, 7); c.fill();
      c.fillStyle = look.hair; c.beginPath(); c.arc(0, torso - 13, 8.4, Math.PI * 1.05, Math.PI * 1.95); c.fill(); c.fillRect(-8, torso - 15, 3, 8);
      if (look.gender === "F") { c.fillRect(-9, torso - 14, 4, 17); c.fillRect(5, torso - 15, 3.5, 6); }
      c.fillStyle = "#1a1a1a"; c.fillRect(1, torso - 12, 2, 2); c.fillRect(5, torso - 12, 2, 2);
      c.fillStyle = "#8a4a3a"; c.fillRect(2, torso - 7, 4, 1.5);
      if (censor) { // the classic pixelated censor — a mosaic of blocks covering the Sim
        const bs = 4, seed = Math.floor(t * 6);
        for (let yy = torso - 4; yy < 0; yy += bs) for (let xx = -12; xx < 12; xx += bs) {
          const v = hash(xx * 7 + seed, yy * 3); const tone = v < 0.55 ? look.skin : v < 0.8 ? shade(look.skin.length === 7 ? look.skin : "#e8b48a", 0.85) : "#f2d6c2";
          c.fillStyle = tone; c.fillRect(xx, yy, bs, bs);
        }
      }
      c.restore();
    }
    function plumbob(x, y) {
      const w = 7 * zoom * Math.abs(Math.cos(t * 1.6)) + 1.5 * zoom, h = 13 * zoom, yy = y + Math.sin(t * 2.4) * 2 * zoom;
      const md = mood(), hue = clamp((md + 100) / 200 * 120, 0, 120);
      const gr = g.createLinearGradient(x - w, yy - h, x + w, yy + h); gr.addColorStop(0, `hsl(${hue},95%,72%)`); gr.addColorStop(1, `hsl(${hue},85%,38%)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, yy - h); g.lineTo(x + w, yy); g.lineTo(x, yy + h); g.lineTo(x - w, yy); g.closePath(); g.fill();
      g.strokeStyle = `hsla(${hue},90%,25%,.6)`; g.lineWidth = 1; g.stroke();
    }
    function bubble(x, y, text, thought) {
      g.font = `600 ${Math.round(13 * zoom)}px system-ui,sans-serif`; const w = Math.max(28 * zoom, g.measureText(text).width + 14 * zoom), h = 24 * zoom;
      g.fillStyle = "rgba(255,255,255,.95)"; g.strokeStyle = "rgba(0,0,0,.25)";
      g.beginPath(); if (g.roundRect) g.roundRect(x - w / 2, y - h, w, h, 10 * zoom); else g.rect(x - w / 2, y - h, w, h); g.fill(); g.stroke();
      if (thought) { [[6, 4], [10, 9]].forEach(([dx, r], k) => { g.beginPath(); g.arc(x - dx * zoom, y + (4 + k * 6) * zoom, (4 - k * 1.5) * zoom, 0, 7); g.fill(); g.stroke(); }); }
      g.fillStyle = "#222"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, x, y - h / 2);
    }
    function drawSimEntity(e) {
      if (e.away) return;
      const cur = e.player ? acts[0] : null, A = cur && cur.phase === "use" ? ACTS[cur.type] : null;
      let fx = e.fx, fy = e.fy, pose = e.pose;
      if (A && cur.target && !cur.target.npc && CAT[cur.target.t] && CAT[cur.target.t].enter) { const o = cur.target; fx = o.x + (CAT[o.t].w === 2 ? 0.55 : 0.5) - 0.5; fy = o.y; }
      const p = P(fx + 0.5, fy + 0.5, pose === "sit" ? 8 : pose === "lie" ? 20 : pose === "bath" ? 12 : 0);
      e.pregnant = !!(G.pregnant && (G.pregnant.who === "player" ? e.player : e.name === G.pregnant.who));
      if (e.player) e.gender = G.sim.gender;
      if (A && A.bedAct && cur.bed && !cur.target.route) { // a pair of hearts over the covers — that's all you see
        const b = P(cur.bed.x + 1, cur.bed.y + 0.5, 40);
        for (let k = 0; k < 5; k++) { const ph = (t * 0.8 + k / 5) % 1; g.globalAlpha = 1 - ph; g.font = `${Math.round((14 + k * 2) * zoom)}px system-ui`; g.textAlign = "center"; g.fillText("❤", b[0] + Math.sin(k * 2.1 + t) * 22 * zoom, b[1] - ph * 70 * zoom); }
        g.globalAlpha = 1;
      }
      drawSimFigure(g, p[0], p[1], zoom * 1.05 * (e.scale || 1), e, pose, e.anim + t * (pose === "dance" ? 8 : 0), e.dir, !!(A && A.censor));
      if (A && A.steam) for (let k = 0; k < 6; k++) { const yy = p[1] - ((t * 30 + k * 13) % 70) * zoom; g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.arc(p[0] + Math.sin(t * 2 + k) * 10 * zoom, yy, 6 * zoom, 0, 7); g.fill(); }
      if (A && A.sleeping) { g.fillStyle = "#fff"; g.font = `800 ${Math.round(14 * zoom)}px system-ui`; g.textAlign = "center"; g.fillText("Z", p[0] + 10 * zoom + Math.sin(t * 2) * 4 * zoom, p[1] - 30 * zoom - (t * 10 % 16) * zoom); }
      e._bb = [p[0] - 14 * zoom, p[1] - 64 * zoom, p[0] + 14 * zoom, p[1] + 4 * zoom];
      const headY = p[1] - (pose === "lie" || pose === "bath" ? 22 : pose === "sit" ? 52 : 62) * zoom;
      if (e.player) plumbob(p[0], headY - 22 * zoom);
      if (e.sayT > 0) bubble(p[0], headY - (e.player ? 38 : 12) * zoom, e.say, false);
      else if (e.player && e.think && !(A && A.sleeping)) bubble(p[0] + 18 * zoom, headY - 30 * zoom, e.think, true);
      if (!e.player) { g.font = `700 ${Math.round(11 * zoom)}px system-ui`; g.textAlign = "center"; g.fillStyle = "rgba(0,0,0,.6)"; g.fillText(e.name, p[0] + 1, p[1] + 14 * zoom + 1); g.fillStyle = "#fff"; g.fillText(e.name, p[0], p[1] + 14 * zoom); }
    }
    // Where a Sim is and how it's posed, shared by the 3D renderer and its overlays.
    function entInfo(e) {
      const cur = e.player ? acts[0] : null, A = cur && cur.phase === "use" ? ACTS[cur.type] : null;
      const info = { e, x: e.fx, y: e.fy, pose: e.pose, hidden: !!e.away, A, cur, player: !!e.player, sleeping: !!(A && A.sleeping) || (!e.player && e.pose === "lie") };
      if (A && cur.target && !cur.target.npc && CAT[cur.target.t]) {
        const o = cur.target, d = CAT[o.t];
        if (d.enter) { info.x = o.x + (d.w - 1) / 2; info.y = o.y; }
        if (d.seat && view3d) info.face = view3d.yawOf ? view3d.yawOf(o) : null;
        if (!d.enter) info.face = Math.atan2(o.x + (d.w - 1) / 2 - e.fx, o.y - e.fy);
        if (o.t === "bed" || (cur.bed && A.bedAct)) { const b = cur.bed || o; info.lie = true; info.x = b.x + 0.85; info.y = b.y + (A.bedAct ? -0.18 : 0); info.lieYaw = Math.PI / 2; info.pose = "lie"; }
        if (o.t === "tub") info.pose = "bath";
      }
      if (cur && cur.phase === "use" && cur.target && cur.target.npc) { info.face = Math.atan2(cur.target.fx - e.fx, cur.target.fy - e.fy); info.talking = true; }
      if (!e.player && e.pose === "lie") { const bed = (e.bedTarget) || objs.find((o) => o.t === "bed" && Math.abs(o.x + 0.5 - e.fx) < 1.6 && Math.abs(o.y - e.fy) < 1.1); if (bed) { info.lie = true; info.x = bed.x + 0.85; info.y = bed.y + 0.2; info.lieYaw = Math.PI / 2; } }
      if (!e.player && e.busy && sim && !e.route) { info.face = Math.atan2(sim.fx - e.fx, sim.fy - e.fy); info.talking = true; }
      return info;
    }
    let floorLock = 0, lastLevel = 0;
    function paintFloor() { if (!view3d || !HDEF.floors) return; const f = HDEF.floors.find((q) => q.level === view3d.viewLevel); const b = host.querySelector(".sm-flname"); if (b && f) b.textContent = f.name; }
    function draw3d() {
      if (HDEF.floors && sim) { // follow the active Sim to their floor (unless you just picked a floor yourself)
        const lv = sim.away ? lastLevel : levelOf(Math.round(sim.fx));
        if (lv !== lastLevel && performance.now() - floorLock > 4000) { view3d.setView(lv); paintFloor(); }
        lastLevel = lv;
        host.querySelectorAll(".sm-floorbtn").forEach((b) => b.hidden = false);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      if (!G) return;
      const hr = G.min / 60 % 24;
      const ents = [sim].concat(npcs).filter(Boolean).map(entInfo);
      let ghost = null;
      if (mode === "buy" && buyItem && hover) { ghostOk = canPlace(buyItem, hover.x, hover.y); ghost = { t: buyItem, x: hover.x, y: hover.y, ok: ghostOk, rot: buyRot }; }
      const ringEl = $(".sm-ring"), hr0 = host.getBoundingClientRect(), rr = ringEl.getBoundingClientRect();
      ringEl.classList.add("live");
      try { view3d.render({ portrait: { x: rr.left - hr0.left + 4, y: rr.top - hr0.top + 4, w: rr.width - 8, h: rr.height - 8 }, dt: 1 / 60, hour: hr, objs, ents, mood: mood(), ghost, hover: null, carpool: !!carpool, tvOn: !!(acts[0] && acts[0].type === "tv" && acts[0].phase === "use") }); } catch (err) { console.warn("3D render failed", err); fail3D("3D had a problem"); return; }
      if (!view3d) return;
      // overlays: speech/thought bubbles, censor mosaic, Zzz, steam, hearts, names
      const zs = Math.max(0.7, Math.min(1.3, 18 / 21));
      ents.forEach((i) => {
        if (i.hidden) return; const e = i.e, A = i.A, sc = e.scale || 1;
        const headH = (i.pose === "lie" || i.pose === "bath" ? 0.9 : i.pose === "sit" ? 1.45 : 1.85) * sc;
        const hp = view3d.project(i.x + 0.5, i.y + 0.5, headH), fp = view3d.project(i.x + 0.5, i.y + 0.5, 0);
        if (!hp[2]) return;
        const pxH = Math.max(20, fp[1] - hp[1]);
        if (A && A.censor) { // pixelated censor mosaic over the Sim (a clothed body under it — never shown)
          const bw = pxH * 0.45, top = hp[1] - pxH * 0.05, bot = fp[1] - (i.pose === "sit" ? pxH * 0.35 : pxH * 0.15), bs = Math.max(4, Math.round(pxH / 9)), seed = Math.floor(t * 6);
          for (let yy = top + pxH * 0.18; yy < bot; yy += bs) for (let xx = hp[0] - bw / 2; xx < hp[0] + bw / 2; xx += bs) { const v = hash(Math.round(xx) * 7 + seed, Math.round(yy) * 3); g.fillStyle = v < 0.55 ? e.skin : v < 0.8 ? "#d9a582" : "#f2d6c2"; g.fillRect(xx, yy, bs, bs); }
        }
        if (A && A.bedAct && i.cur && i.cur.bed) { const b = view3d.project(i.cur.bed.x + 1, i.cur.bed.y + 0.5, 0.9); for (let k = 0; k < 5; k++) { const ph = (t * 0.8 + k / 5) % 1; g.globalAlpha = 1 - ph; g.font = `${Math.round(16 + k * 3)}px system-ui`; g.textAlign = "center"; g.fillStyle = "#e8505b"; g.fillText("❤", b[0] + Math.sin(k * 2.1 + t) * 26, b[1] - ph * 80); } g.globalAlpha = 1; }
        if (A && A.steam) for (let k = 0; k < 6; k++) { const yy = hp[1] + pxH * 0.6 - ((t * 30 + k * 13) % 70); g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.arc(hp[0] + Math.sin(t * 2 + k) * 12, yy, 8, 0, 7); g.fill(); }
        if (A && A.sleeping) { g.fillStyle = "#fff"; g.font = "800 16px system-ui"; g.textAlign = "center"; g.fillText("Z", hp[0] + 14 + Math.sin(t * 2) * 4, hp[1] - 10 - (t * 10 % 16)); }
        const saved = zoom; zoom = zs;
        if (e.sayT > 0) bubble(hp[0], hp[1] - (e.player ? 46 : 14), e.say, false);
        else if (e.player && e.think && !(A && A.sleeping)) bubble(hp[0] + 22, hp[1] - 40, e.think, true);
        zoom = saved;
        if (!e.player) { g.font = "700 12px system-ui"; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillStyle = "rgba(0,0,0,.6)"; g.fillText(e.name, fp[0] + 1, fp[1] + 15); g.fillStyle = "#fff"; g.fillText(e.name, fp[0], fp[1] + 14); }
      });

    }
    function draw() {
      if (view3d) { draw3d(); return; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const hr = (G ? G.min : 480) / 60 % 24, sky = hr < 5 || hr > 21 ? "#0e1a30" : hr < 7 ? "#5a7aa8" : hr > 19 ? "#c07a5a" : "#7fb8e0";
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      if (!G) return;
      // ground beyond the lot
      for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) floorTile(x, y);
      // back (full-height) walls
      for (let x = HOUSE.x0; x <= HOUSE.x1; x++) wallSeg(x, HOUSE.y0, x + 1, HOUSE.y0, WALL_H, true);
      for (let y = HOUSE.y0; y <= HOUSE.y1; y++) wallSeg(HOUSE.x0, y, HOUSE.x0, y + 1, WALL_H, true);
      // depth-sorted scene
      const list = [];
      for (let y = 1; y <= LH; y++) for (let x = 0; x <= LW; x++) {
        if (hWall[y] && hWall[y][x] === 1) list.push({ k: x + y - 0.45, f: () => wallSeg(x, y, x + 1, y, WALL_LOW, false) });
        if (vWall[y] && vWall[y][x] === 1) list.push({ k: x + y - 0.45, f: () => wallSeg(x, y, x, y + 1, WALL_LOW, false) });
      }
      objs.forEach((o) => { const d = CAT[o.t]; list.push({ k: o.x + d.w - 1 + o.y + (d.walk ? -0.9 : 0.42), f: () => drawObject(o) }); });
      [sim].concat(npcs).forEach((e) => { let k = e.fx + e.fy + 0.5; const cur = e.player ? acts[0] : null; if (cur && cur.phase === "use" && cur.target && !cur.target.npc && CAT[cur.target.t] && CAT[cur.target.t].enter) k = cur.target.x + CAT[cur.target.t].w - 1 + cur.target.y + 0.43;
        if (cur && cur.bed && (cur.phase === "use" || cur.phase === "walk") && Math.abs(e.fx - cur.bed.x) < 0.5 && Math.abs(e.fy - cur.bed.y) < 0.5) k = cur.bed.x + 1 + cur.bed.y + 0.43; list.push({ k, f: () => drawSimEntity(e) }); });
      objs.forEach((o) => { if (o.t === "shower") { list.push({ k: o.x + o.y + 0.44, f: () => o._glass && o._glass() }); } });
      list.sort((a, b) => a.k - b.k).forEach((d) => d.f());
      // carpool
      if (carpool) { const p = P(8.5, 13.5); g.fillStyle = "#e6c22a"; g.fillRect(p[0] - 40 * zoom, p[1] - 22 * zoom, 80 * zoom, 22 * zoom); g.fillStyle = "#9ad0e6"; g.fillRect(p[0] - 26 * zoom, p[1] - 34 * zoom, 46 * zoom, 14 * zoom); g.fillStyle = "#222"; [-26, 26].forEach((dx) => { g.beginPath(); g.arc(p[0] + dx * zoom, p[1], 8 * zoom, 0, 7); g.fill(); }); }
      // buy-mode ghost
      if (mode === "buy" && buyItem && hover) {
        const d = CAT[buyItem]; ghostOk = canPlace(buyItem, hover.x, hover.y);
        g.globalAlpha = 0.65; drawObject({ t: buyItem, x: hover.x, y: hover.y }); g.globalAlpha = 1;
        for (let i = 0; i < d.w; i++) poly([P(hover.x + i, hover.y), P(hover.x + i + 1, hover.y), P(hover.x + i + 1, hover.y + 1), P(hover.x + i, hover.y + 1)], ghostOk ? "rgba(60,220,90,.35)" : "rgba(230,60,60,.4)");
      }
      // night lighting with lamp glow
      const dark = hr >= 20 || hr < 5 ? 0.5 : hr >= 18 ? (hr - 18) / 2 * 0.5 : hr < 7 ? (7 - hr) / 2 * 0.5 : 0;
      if (dark > 0.01) {
        g.fillStyle = `rgba(10,20,60,${dark})`; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = "lighter";
        objs.forEach((o) => { if (CAT[o.t].light || o.t === "tv") { const p = P(o.x + 0.5, o.y + 0.5, 40); const rg = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], 150 * zoom); rg.addColorStop(0, `rgba(255,220,140,${dark * 0.55})`); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.fillRect(p[0] - 150 * zoom, p[1] - 150 * zoom, 300 * zoom, 300 * zoom); } });
        g.globalCompositeOperation = "source-over";
      }
      // notifications
    }

    // ---------------- UI panels ----------------
    function paintQueue() {
      const q = $(".sm-queue"); q.innerHTML = "";
      acts.forEach((a, i) => { const b = document.createElement("button"); b.className = "sm-q" + (i === 0 ? " on" : ""); b.title = (ACTS[a.type] ? ACTS[a.type].label : a.type) + " — click to cancel"; b.textContent = ACTS[a.type] ? ACTS[a.type].icon : "•"; b.onclick = () => cancelAct(a); q.appendChild(b); });
    }
    function cancelAct(a) {
      const i = acts.indexOf(a); if (i < 0) return;
      if (a.target && a.target.npc) { a.target.busy = false; if (a.target.bedTarget) { a.target.bedTarget = null; a.target.route = null; a.target.pose = "stand"; } }
      if (i === 0) { sim.route = null; sim.pose = "stand"; if (a.phase === "walk" || a.phase === "use") { sim.x = Math.round(sim.fx); sim.y = Math.round(sim.fy); sim.fx = sim.x; sim.fy = sim.y; } }
      acts.splice(i, 1); paintQueue();
    }
    function paintUI() {
      if (!G) return;
      $(".sm-time").textContent = fmtTime(G.min);
      $(".sm-day").textContent = "Day " + G.day + " · " + ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][(G.day - 1) % 7];
      $(".sm-money").textContent = "§" + Math.floor(G.money).toLocaleString();
      host.querySelectorAll(".sm-speeds button").forEach((b) => b.classList.toggle("on", +b.dataset.s === G.speed));
      $(".sm-name").textContent = G.sim.name + " " + G.sim.family;
      const md = mood(); const chip = $(".sm-moodchip");
      if (chip) { const em = md > 55 ? ["Happy", "#ffd23a"] : md > 15 ? ["Fine", "#e8eef2"] : md > -25 ? ["Uncomfortable", "#f2a35a"] : md > -60 ? ["Sad", "#7ab0e8"] : ["Miserable", "#e05a5a"]; chip.textContent = em[0]; chip.style.background = em[1]; }
      const bh = $(".sm-buyhint"); if (bh) { bh.hidden = mode !== "buy"; bh.textContent = buyItem ? `Placing: ${CAT[buyItem].name} · tap a spot${view3d ? " · R / ↻ to turn" : ""} · Esc to stop` : "Buy Mode — pick an item below, or tap an object to sell or turn it"; }
      const m = $(".sm-mood div"); m.style.width = Math.abs(md) / 2 + "%"; m.style.left = md >= 0 ? "50%" : (50 - Math.abs(md) / 2) + "%"; m.style.background = md >= 0 ? "#4ad04a" : "#e04a3a";
      const pc = $(".sm-portrait").getContext("2d"); pc.clearRect(0, 0, 72, 84); drawSimFigure(pc, 36, 150, 2.2, G.sim, "stand", 0, 1, false);
      if (tab === "needs") paintTab();
    }
    function paintTab() {
      if (!G) return; const b = $(".sm-tab-body"), N = G.sim.needs;
      if (tab === "needs") {
        b.innerHTML = `<div class="sm-card-h">Needs</div><div class="sm-needs">${NEEDS.map((k) => { const v = N[k], col = v > 60 ? "linear-gradient(#8ee86a,#4cb83a)" : v > 30 ? "linear-gradient(#ffe27a,#e8b52a)" : "linear-gradient(#ff8a7a,#d8402a)"; return `<div class="sm-need"><i>${NEED_ICON[k]}</i><span>${NEED_LABEL[k]}</span><div class="sm-nb"><div style="width:${v}%;background:${col}"></div></div></div>`; }).join("")}</div>`;
      } else if (tab === "job") {
        const C = G.career;
        if (!C) { b.innerHTML = `<div class="sm-tabtxt">${esc(G.sim.name)} is unemployed. Use the <b>computer</b> → <i>Find a Job</i>.</div>`; return; }
        const tr = CAREERS[C.track], lv = tr.levels[C.level], next = tr.levels[C.level + 1];
        b.innerHTML = `<div class="sm-tabtxt"><b>${tr.name}: ${lv[0]}</b> — §${lv[1]}/day · carpool 8 AM, work 9 AM–3 PM<br>Performance: <div class="sm-nb" style="display:inline-block;width:120px;vertical-align:middle"><div style="width:${(C.perf + 100) / 2}%;background:${C.perf >= 0 ? "#4ad04a" : "#e04a3a"}"></div></div>
          ${next ? `<br>Next: <b>${next[0]}</b> (§${next[1]}) needs ${Object.keys(next[2]).map((k) => `${SKILL_LABEL[k]} ${Math.floor(G.sim.skills[k])}/${next[2][k]}`).join(", ") || "good performance"}` : "<br>Top of the career!"}
          <br><button class="sm-quit">Quit job</button></div>`;
        b.querySelector(".sm-quit").onclick = () => dialog("Quit job?", `<p>Quit the ${tr.name} career?</p>`, [["Quit", () => { G.career = null; paintTab(); }], ["Cancel"]]);
      } else if (tab === "skills") {
        b.innerHTML = `<div class="sm-needs">${SKILLS.map((k) => { const v = G.sim.skills[k]; return `<div class="sm-need"><span>${SKILL_LABEL[k]}</span><div class="sm-pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.floor(v) ? "on" : i < v ? "half" : ""}"></i>`).join("")}</div></div>`; }).join("")}</div>`;
      } else if (tab === "rel") {
        const names = Object.keys(G.rel);
        b.innerHTML = names.length ? `<div class="sm-needs">${names.map((n) => { const v = G.rel[n]; const m = member(n), badge = G.married === n ? " 💍" : m && m.role === "child" ? " 👶" : m ? " 🏡" : G.romance[n] ? " 💞" : v >= 50 ? " ❤" : ""; return `<div class="sm-need"><span>${esc(n)}${badge}</span><div class="sm-nb"><div style="width:${(v + 100) / 2}%;background:${v >= 0 ? "#4ad04a" : "#e04a3a"}"></div></div></div>`; }).join("")}</div>` : `<div class="sm-tabtxt">No relationships yet. Use the <b>phone</b> to call a friend or invite a neighbor over.</div>`;
        if (G.pregnant) b.insertAdjacentHTML("afterbegin", `<div class="sm-tabtxt">🍼 Baby due in ${Math.max(0, Math.ceil((G.pregnant.due - G.min) / 60))} hours</div>`);
        if (G.baby) b.insertAdjacentHTML("afterbegin", `<div class="sm-tabtxt">👶 ${esc(G.baby.name)} — care <b>${Math.round(G.baby.care)}%</b> · grows up in ${Math.max(0, Math.ceil((G.baby.born + 3 * 1440 - G.min) / 60))} h</div>`);
      } else if (tab === "pers") {
        b.innerHTML = `<div class="sm-needs">${TRAITS.map((k) => { const v = G.sim.traits[k]; return `<div class="sm-need"><span>${TRAIT_LABEL[k][1]}</span><div class="sm-pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? "on" : ""}"></i>`).join("")}</div></div>`; }).join("")}</div>`;
      }
    }
    function openCatalog() {
      const c = $(".sm-catalog"); const cats = [...new Set(Object.values(CAT).filter((d) => d.price > 0).map((d) => d.cat))];
      let cur = cats[0];
      const paint = () => {
        c.innerHTML = `<div class="sm-cats">${cats.map((k) => `<button class="${k === cur ? "on" : ""}" data-c="${esc(k)}">${esc(k)}</button>`).join("")}</div><div class="sm-items">${Object.keys(CAT).filter((k) => CAT[k].cat === cur && CAT[k].price > 0).map((k) => `<button class="sm-item ${buyItem === k ? "on" : ""}" data-i="${k}"><b>${esc(CAT[k].name)}</b><span>§${CAT[k].price}${CAT[k].ints.length ? " · " + CAT[k].ints.map((i) => ACTS[i].icon).join("") : ""}</span></button>`).join("")}</div>`;
        c.querySelectorAll("[data-c]").forEach((b) => b.onclick = () => { cur = b.dataset.c; paint(); });
        c.querySelectorAll("[data-i]").forEach((b) => b.onclick = () => { buyItem = buyItem === b.dataset.i ? null : b.dataset.i; if (buyItem && CAT[buyItem].price > G.money) { notify("You can't afford that."); buyItem = null; } paint(); });
      };
      paint(); c.hidden = false;
    }
    function canPlace(type, x, y) {
      const d = CAT[type];
      for (let i = 0; i < d.w; i++) { const cx = x + i; if (cx < 0 || y < 0 || cx >= LW || y >= LH - 2) return false; if (objAt(cx, y) || fixedBlock(cx, y)) return false; if (Math.round(sim.fx) === cx && Math.round(sim.fy) === y) return false; if (i > 0 && vWall[y][cx]) return false; }
      return true;
    }
    function setMode(m) {
      if (m === "menu") { openMenu(); return; }
      mode = m; host.querySelectorAll(".sm-mode").forEach((b) => b.classList.toggle("on", b.dataset.m === m));
      const tb = host.querySelector(".sm-turnbtn"); if (tb) tb.hidden = !(m === "buy" && view3d);
      if (m === "buy") openCatalog(); else { $(".sm-catalog").hidden = true; buyItem = null; }
    }
    // Move to another house. Furniture you bought comes with you as cash (sold at full price);
    // the new house comes furnished.
    function moveHouse() {
      const cur = G.house || "starter";
      const bought = objs.filter((o) => !o.hid && !CAT[o.t].fixed && !(HOUSES[cur].objects ? HOUSES[cur].objects() : starterObjects()).some((q) => q.t === o.t && q.x === o.x && q.y === o.y));
      const refund = bought.reduce((a, o) => a + CAT[o.t].price, 0);
      const cards = Object.entries(HOUSES).map(([k, h]) => `<button class="sm-job sm-house ${k === cur ? "cur" : ""}" data-h="${k}"><b>${esc(h.name)}${k === cur ? " · you live here" : ""}</b><span>${h.beds} bed · ${h.baths} bath · ${h.price ? "§" + h.price.toLocaleString() : "Free"}</span><span>${esc(h.desc)}</span></button>`).join("");
      dialog("Move House", `<p>Pick a home. Furniture you bought is sold back for <b>§${refund.toLocaleString()}</b> when you move.</p><div class="sm-jobs">${cards}</div>`, [["Cancel"]], (d) => {
        d.querySelectorAll("[data-h]").forEach((b) => b.onclick = () => {
          const k = b.dataset.h, h = HOUSES[k]; if (k === cur) return;
          if (G.money + refund < h.price) { notify(`You need §${(h.price - G.money - refund).toLocaleString()} more for the ${h.name}.`); return; }
          G.money = G.money + refund - h.price; G.house = k;
          G.objects = h.objects ? h.objects() : starterObjects();
          const st = h.start || [7, 11]; G.sim.x = st[0]; G.sim.y = st[1];
          objs = G.objects.map((o) => ({ ...o })); acts = []; sim.x = sim.fx = st[0]; sim.y = sim.fy = st[1]; sim.route = null;
          d.hidden = true; dialogOpen = false; save();
          const bodyEl = host.parentElement; cleanup(); setTimeout(() => { if (window.SIMS) { const r = window.SIMS.start(bodyEl, { skipSplash: true }); setTimeout(() => { const nh = bodyEl.querySelector(".sm"); if (nh && nh.__sims) nh.__sims.toast(`Welcome to your ${h.name}!`); }, 600); } }, 50);
        });
      });
    }
    function cheats() {
      dialog("Cheats", `<p>Type a cheat code:</p><input class="sm-in sm-cheat" placeholder="motherlode" autocomplete="off"><p class="sm-small">motherlode · kaching · rosebud · freerealestate</p>`, [["Enter", (d) => {
        const c = d.querySelector(".sm-cheat").value.trim().toLowerCase();
        if (c === "motherlode") { G.money += 50000; notify("Motherlode! +§50,000"); }
        else if (c === "kaching" || c === "rosebud") { G.money += 1000; notify("Kaching! +§1,000"); }
        else if (c === "freerealestate") { G.freeRealEstate = !G.freeRealEstate; Object.values(HOUSES).forEach((h) => { if (h.basePrice == null) h.basePrice = h.price; h.price = G.freeRealEstate ? 0 : h.basePrice; }); notify(G.freeRealEstate ? "Free real estate is ON — houses cost nothing." : "Free real estate is off."); }
        else { notify("That cheat doesn't exist."); }
        save(); paintUI();
      }], ["Close"]], (d) => setTimeout(() => { const i = d.querySelector(".sm-cheat"); if (i) i.focus(); }, 50));
    }
    function openMenu() {
      dialog("Options", `<label class="sm-row"><input type="checkbox" class="sm-fw" ${G && G.freeWill ? "checked" : ""}> Free will (Sims take care of themselves)</label><p class="sm-small">Your game saves automatically.</p>`,
        [["Move House", () => { setTimeout(moveHouse, 30); }], ["Cheats", () => { setTimeout(cheats, 30); }], ["Credits", () => { setTimeout(() => dialog("Credits", creditsHTML()), 30); }], ["Close", (d) => { G.freeWill = d.querySelector(".sm-fw").checked; save(); }], ["New household", () => { setTimeout(() => dialog("Start over?", "<p>This replaces your current household and house.</p>", [["Start over", () => { setTimeout(createASim, 30); }], ["Cancel"]]), 30); }]]);
    }

    // ---------------- pie menu ----------------
    function pie(mx, my, options) {
      const p = $(".sm-pie"); p.innerHTML = ""; p.hidden = false;
      const r = 66 + Math.max(0, options.length - 6) * 8;
      const head = document.createElement("div"); head.className = "sm-pie-head"; head.style.left = mx + "px"; head.style.top = my + "px"; head.innerHTML = "<canvas width='44' height='44'></canvas>"; p.appendChild(head);
      const hc = head.querySelector("canvas").getContext("2d"); drawSimFigure(hc, 22, 120, 1.9, G.sim, "stand", 0, 1, false);
      options.forEach(([label, fn], i) => {
        const a = -Math.PI / 2 + (i / options.length) * Math.PI * 2, b = document.createElement("button");
        b.className = "sm-pie-opt"; b.textContent = label; b.style.left = mx + Math.cos(a) * r + "px"; b.style.top = my + Math.sin(a) * r * 0.75 + "px";
        b.onclick = (e) => { e.stopPropagation(); p.hidden = true; fn(); }; p.appendChild(b);
      });
      p.onclick = () => { p.hidden = true; };
    }

    // ---------------- input ----------------
    function pick(mx, my) {
      if (view3d) { const h = view3d.pick(mx, my); if (h.ent && h.ent.away) return { cell: view3d.cellAt(mx, my) }; if (h.cell) { const o = objAt(h.cell.x, h.cell.y) || objs.find((q) => CAT[q.t].walk && q.x === h.cell.x && q.y === h.cell.y); if (o) return { obj: o }; } return h; }
      const ents = [sim].concat(npcs).filter((e) => !e.away && e._bb && mx >= e._bb[0] && mx <= e._bb[2] && my >= e._bb[1] && my <= e._bb[3]);
      if (ents.length) return { ent: ents.sort((a, b) => (b.fx + b.fy) - (a.fx + a.fy))[0] };
      const hits = objs.filter((o) => o._bb && mx >= o._bb[0] && mx <= o._bb[2] && my >= o._bb[1] && my <= o._bb[3]).sort((a, b) => (b.x + b.y) - (a.x + a.y));
      if (hits.length) return { obj: hits[0] };
      const c = cellAt(mx, my); const o = objAt(c.x, c.y) || objs.find((q) => CAT[q.t].walk && q.x === c.x && q.y === c.y); if (o) return { obj: o };
      return { cell: c };
    }
    let drag = null;
    const touches = new Map();
    cv.addEventListener("pointerdown", (e) => { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (drag && touches.size >= 2) { drag.moved = true; return; } drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, cx: camX, cy: camY, moved: false, orbit: e.button === 2 || e.altKey || e.ctrlKey }; try { cv.setPointerCapture(e.pointerId); } catch (er) {} });
    cv.addEventListener("pointercancel", (e) => { touches.delete(e.pointerId); if (!touches.size) drag = null; });
    cv.addEventListener("pointermove", (e) => {
      const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      hover = cellAt(mx, my); if (hover.x < 0 || hover.y < 0 || hover.x >= LW || hover.y >= LH) hover = null;
      if (drag && view3d) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size >= 2) { const [a, b] = [...touches.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x); if (drag.pd) { view3d.zoom(drag.pd / d); view3d.orbit(-(ang - drag.pa) * 120, 0); } drag.pd = d; drag.pa = ang; drag.moved = true; return; }
        const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly; drag.lx = e.clientX; drag.ly = e.clientY;
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 6) drag.moved = true;
        if (drag.moved) { if (drag.orbit) view3d.orbit(dx, dy); else view3d.pan(dx, dy); }
        return;
      }
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true; if (drag.moved) { camX = drag.cx + dx; camY = drag.cy + dy; userCam = true; } }
    });
    cv.addEventListener("pointerup", (e) => {
      touches.delete(e.pointerId); if (touches.size) return;
      const was = drag; drag = null; if (!was || was.moved || !G || dialogOpen) return;
      const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      if (mode === "buy") {
        const c = cellAt(mx, my);
        if (buyItem) { if (canPlace(buyItem, c.x, c.y)) { G.money -= CAT[buyItem].price; objs.push(Object.assign({ t: buyItem, x: c.x, y: c.y }, view3d && buyRot ? { rot: CAT[buyItem].w > 1 ? (buyRot % 2 ? 2 : buyRot) : buyRot } : {})); notify(`Bought ${CAT[buyItem].name}.`); if (CAT[buyItem].price > G.money) buyItem = null; openCatalog(); save(); } else notify("It doesn't fit there."); return; }
        const h = pick(mx, my);
        if (h.obj && !CAT[h.obj.t].fixed && !h.obj.hid) { const o = h.obj, v = Math.round(CAT[o.t].price * 0.8); dialog(CAT[o.t].name, `<p>Sell it for §${v}${view3d ? ", or turn it to face another way" : ""}?</p>`, [["Sell", () => { acts = acts.filter((a) => a.target !== o); paintQueue(); objs.splice(objs.indexOf(o), 1); G.money += v; save(); }]].concat(view3d ? [["Rotate ⟳", () => { const step = CAT[o.t].w > 1 ? 2 : 1; o.rot = ((o.rot != null ? o.rot : Math.round(((view3d.yawOf(o) % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 2)) % 4) + step) % 4; save(); }]] : []).concat([["Cancel"]])); }
        return;
      }
      const h = pick(mx, my), opts = [];
      if (h.ent && h.ent.npc) {
        const n = h.ent, rv = G.rel[n.name] || 0, kid = n.role === "child", rom = !!G.romance[n.name];
        ["talk", "joke", "compliment"].forEach((k) => opts.push([ACTS[k].label, () => queueAct(k, n)]));
        opts.push([ACTS.hug.label + (rv < 30 ? " (needs friendship)" : ""), () => queueAct("hug", n)]);
        if (!kid) {
          opts.push([ACTS.flirt.label, () => queueAct("flirt", n)]);
          opts.push([ACTS.kiss.label + (rv < 50 ? " (needs 50+)" : ""), () => queueAct("kiss", n)]);
          if (rom) {
            if (!n.member) opts.push([ACTS.moveIn.label, () => queueAct("moveIn", n)]);
            if (G.married !== n.name) opts.push([ACTS.propose.label, () => queueAct("propose", n)]);
            opts.push([ACTS.woohoo.label, () => queueAct("woohoo", n)]);
            opts.push([ACTS.tryBaby.label + (n.member ? "" : " (move in first)"), () => queueAct("tryBaby", n)]);
          }
        }
        if (!n.member) opts.push([ACTS.goodbye.label, () => queueAct("goodbye", n)]);
      } else if (h.ent && h.ent.player) {
        opts.push(["Check Mood", () => notify(`${G.sim.name} is feeling ${mood() > 40 ? "great" : mood() > 0 ? "OK" : mood() > -40 ? "down" : "miserable"}.`)]);
      } else if (h.obj) {
        CAT[h.obj.t].ints.forEach((k) => { if (k === "mail" && !G.bills.length) return; opts.push([ACTS[k].label, () => queueAct(k, h.obj)]); });
        if (h.obj.t === "mailbox" && !G.bills.length) opts.push(["Get Mail", () => notify("No mail today.")]);
      } else if (h.cell && h.cell.x >= 0 && h.cell.y >= 0 && h.cell.x < LW && h.cell.y < LH && !objAt(h.cell.x, h.cell.y)) {
        opts.push(["Go Here", () => queueAct("goto", { x: h.cell.x, y: h.cell.y })]);
      }
      if (opts.length) pie(mx, my, opts);
    });
    cv.addEventListener("contextmenu", (e) => { e.preventDefault(); buyItem = null; if (mode === "buy") openCatalog(); });
    cv.addEventListener("wheel", (e) => { e.preventDefault(); if (view3d) { view3d.zoom(e.deltaY < 0 ? 0.9 : 1.11); return; } const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, z0 = zoom; zoom = clamp(zoom * (e.deltaY < 0 ? 1.12 : 0.89), 0.45, 1.8); camX = mx - (mx - camX) * zoom / z0; camY = my - (my - camY) * zoom / z0; userCam = true; }, { passive: false });
    host.querySelectorAll(".sm-mode").forEach((b) => b.onclick = () => setMode(b.dataset.m));
    $(".sm-portrait").style.cursor = "pointer"; $(".sm-portrait").title = "Center the camera on your Sim";
    $(".sm-portrait").onclick = () => { if (view3d && sim) view3d.focus(sim.fx + 0.5, sim.fy + 0.5, 9); };
    host.querySelectorAll(".sm-view3d button").forEach((b) => b.onclick = () => {
      const v = b.dataset.v;
      if (v === "2d") { set3D(!view3d); return; }
      if (!view3d) return;
      if (v === "turn") { buyRot = (buyRot + 1) % 4; return; }
      if ((v === "up" || v === "down") && HDEF.floors) { const lv = HDEF.floors.map((f) => f.level).sort((a, b) => a - b); const i = lv.indexOf(view3d.viewLevel) + (v === "up" ? 1 : -1); if (i >= 0 && i < lv.length) { view3d.setView(lv[i]); floorLock = performance.now(); paintFloor(); } return; }
      if (v === "rotL") view3d.rotate(-1); if (v === "rotR") view3d.rotate(1);
      if (v === "zin") view3d.zoom(0.85); if (v === "zout") view3d.zoom(1.18);
      if (v === "walls") { const order = ["cutaway", "up", "down"], nm = { cutaway: "▥ Cutaway", up: "▮ Walls Up", down: "▁ Walls Down" }; const nx = order[(order.indexOf(view3d.wallMode) + 1) % 3]; view3d.setWallMode(nx); b.textContent = nm[nx]; }
    });
    host.querySelectorAll(".sm-speeds button").forEach((b) => b.onclick = () => { if (G) { G.speed = +b.dataset.s; paintUI(); } });
    host.querySelectorAll(".sm-tabs button").forEach((b) => b.onclick = () => { tab = b.dataset.t; host.querySelectorAll(".sm-tabs button").forEach((x) => x.classList.toggle("on", x === b)); paintTab(); });
    function onKey(e) {
      if (!document.body.contains(host) || !host.closest(".win") || dialogOpen) return;
      const a = document.activeElement; if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
      if (!host.contains(a) && a !== document.body) return;
      if (mode === "buy" && (e.key === "r" || e.key === "R")) { buyRot = (buyRot + 1) % 4; }
      if (view3d && (e.key === "q" || e.key === "Q")) view3d.rotate(-1);
      if (view3d && (e.key === "e" || e.key === "E")) view3d.rotate(1);
      if (e.key === "Escape") { buyItem = null; $(".sm-pie").hidden = true; if (mode === "buy") openCatalog(); }
      if (G && ["0", "1", "2", "3"].includes(e.key)) { G.speed = +e.key; paintUI(); }
      if (G && e.key === "p") { G.speed = G.speed ? 0 : 1; paintUI(); }
    }
    document.addEventListener("keydown", onKey);

    // ---------------- loop ----------------
    let uiT = 0;
    function frame(now) {
      if (dead) return;
      if (!document.body.contains(host)) { cleanup(); return; }
      let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1;
      update(dt); draw();
      uiT += dt; if (uiT > 0.25) { uiT = 0; paintUI(); }
      raf = requestAnimationFrame(frame);
    }
    function cleanup() { if (dead) return; dead = true; cancelAnimationFrame(raf); if (view3d) { try { view3d.dispose(); } catch (e) {} view3d = null; } save(); document.removeEventListener("keydown", onKey); if (ro) ro.disconnect(); }
    let ro = null; try { ro = new ResizeObserver(() => { fit(); if (!userCam) centerCam(); }); ro.observe(host); } catch (e) {}
    const win = body.closest(".win"); if (win) win.addEventListener("wm-cleanup", cleanup);
    fit();
    // Startup screen: title, loading tips and the asset credits. Tap or wait to continue.
    function splash(next) {
      const tips = ["Reticulating splines…", "Adding hidden agendas…", "Polishing the plumbob…", "Calibrating personality matrix…"];
      const sp = document.createElement("div"); sp.className = "sm-splash";
      sp.innerHTML = `<div class="sm-sp-in"><div class="sm-sp-bob">${PLUMBOB_SVG}</div><div class="sm-sp-t">The Sims</div><div class="sm-sp-tip">${tips[0]}</div>
        <div class="sm-sp-bar"><div class="sm-sp-fill"></div><div class="sm-sp-dot">${PLUMBOB_SVG}</div></div><div class="sm-sp-h">Credits</div>${creditsHTML()}<button class="sm-sp-go">Play</button></div>`;
      host.appendChild(sp);
      let ti = 0, done = false; const tipT = setInterval(() => { ti = (ti + 1) % tips.length; sp.querySelector(".sm-sp-tip").textContent = tips[ti]; }, 900);
      const go = () => { if (done) return; done = true; clearInterval(tipT); clearTimeout(auto); sp.remove(); if (!dead) next(); };
      const auto = setTimeout(go, 4500);
      sp.querySelector(".sm-sp-go").onclick = go;
      sp.addEventListener("pointerdown", (e) => { if (!e.target.closest("a")) go(); });
    }
    Object.values(HOUSES).forEach((h) => { if (h.basePrice == null) h.basePrice = h.price; h.price = G && G.freeRealEstate ? 0 : h.basePrice; });
    if (startOpts && startOpts.skipSplash && G && G.v === 1) boot(); else splash(() => { if (G && G.v === 1) boot(); else { G = null; createASim(); } });
    raf = requestAnimationFrame((n) => { last = n; frame(n); });
    host.__sims = { levelOf, get LW() { return LW; },  toast: (t) => notify(t), moveHouse, cheats, HOUSE, get house() { return HKEY; }, fixedBlock, path: (a, b, c, d) => path(a, b, c, d), get view3d() { return view3d; }, set3D, get G() { return G; }, get sim() { return sim; }, get acts() { return acts; }, get objs() { return objs; }, get npcs() { return npcs; }, queue: (type, target) => queueAct(type, target), step: (s) => { const sp = G.speed; G.speed = 1; for (let i = 0; i < s * 10; i++) update(0.1); G.speed = sp; }, mood, pick, P: (x, y, z) => P(x, y, z), get dialogOpen() { return dialogOpen; }, familyTick: (m) => familyTick(m), spawnNeighbor: (name) => { const nb = NEIGHBORS.find((x) => x.name === name); const e = makeSimEntity({ ...nb, x: 6, y: 9 }, false); e.npc = true; e.leaveAt = G.min + 9999; e.wanderT = 999; npcs.push(e); return e; } };
    return { dispose: cleanup };
  }

  function injectStyles() {
    if (document.getElementById("sims-style")) return;
    const s = document.createElement("style"); s.id = "sims-style";
    s.textContent = `
      .sm-dialog[hidden], .sm-catalog[hidden], .sm-pie[hidden] { display: none !important; }
      .sm { position: relative; width: 100%; height: 100%; overflow: hidden; background: #7fb8e0; font-family: "Trebuchet MS", system-ui, sans-serif; user-select: none; -webkit-user-select: none; }
      .sm-cv { display: block; width: 100%; touch-action: none; cursor: pointer; }
      .sm-queue { position: absolute; left: 10px; top: 10px; display: flex; gap: 6px; z-index: 2; }
      .sm-3d { position: absolute; left: 0; top: 0; display: block; }
      .sm-cv.sm-overlay { position: absolute; left: 0; top: 0; background: transparent; }
      .sm-view3d { position: absolute; right: 10px; top: 10px; display: flex; gap: 6px; z-index: 2; }
      .sm-view3d[hidden], .sm-view3d button[hidden] { display: none; }
      .sm-view3d button { min-width: 38px; height: 36px; border-radius: 10px; border: 2px solid #1d3d7a; background: rgba(232,240,255,.92); font: 700 15px system-ui; color: #1d3d7a; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,.3); padding: 0 8px; }
      .sm-view3d .sm-wallbtn, .sm-view3d .sm-2dbtn { font-size: 13px; }
      .sm-q { width: 40px; height: 40px; border-radius: 10px; border: 2px solid #1d3d7a; background: #e8f0ff; font-size: 20px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,.3); }
      .sm-q.on { background: #fff7c2; border-color: #c9a01a; transform: scale(1.12); }
      .sm-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 124px; background: linear-gradient(#2f5aa8, #1d3d7a); border-top: 3px solid #8fb4ef; display: flex; gap: 10px; padding: 8px 10px; box-sizing: border-box; color: #fff; }
      .sm-left { display: flex; flex-direction: column; gap: 5px; width: 168px; flex: none; }
      .sm-modes, .sm-speeds { display: flex; gap: 4px; }
      .sm-modes button, .sm-speeds button { flex: 1; border: 2px solid #8fb4ef; background: #3e6cc0; color: #fff; border-radius: 8px; padding: 3px 0; cursor: pointer; font: 700 12px system-ui; }
      .sm-modes button.on, .sm-speeds button.on { background: #ffd23a; color: #1d3d7a; border-color: #fff; }
      .sm-clock { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; } .sm-clock b { font-size: 15px; }
      .sm-money { background: #0e2552; border-radius: 6px; text-align: center; font: 800 15px system-ui; color: #7dff7d; padding: 2px 0; }
      .sm-face { width: 84px; flex: none; display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .sm-portrait { background: radial-gradient(#9ad0ff, #3e6cc0); border-radius: 10px; border: 2px solid #8fb4ef; width: 64px; height: 64px; }
      .sm-mood { width: 72px; height: 7px; background: #0e2552; border-radius: 4px; position: relative; overflow: hidden; } .sm-mood div { position: absolute; top: 0; bottom: 0; }
      .sm-name { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 84px; }
      .sm-tabs { display: flex; flex-direction: column; gap: 2px; flex: none; }
      .sm-tabs button { border: 1px solid #8fb4ef; background: #3e6cc0; color: #fff; border-radius: 6px; padding: 1px 8px; cursor: pointer; font: 700 11px system-ui; text-align: left; }
      .sm-tabs button.on { background: #ffd23a; color: #1d3d7a; }
      .sm-tab-body { flex: 1; min-width: 0; overflow: auto; }
      .sm-needs { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 4px 14px; }
      .sm-need { display: flex; align-items: center; gap: 6px; font-size: 12px; } .sm-need span { width: 74px; flex: none; }
      .sm-nb { flex: 1; height: 10px; background: #0e2552; border-radius: 5px; overflow: hidden; border: 1px solid #5a80c8; } .sm-nb div { height: 100%; }
      .sm-pips { display: flex; gap: 2px; } .sm-pips i { width: 9px; height: 9px; border-radius: 2px; background: #0e2552; border: 1px solid #5a80c8; } .sm-pips i.on { background: #ffd23a; } .sm-pips i.half { background: linear-gradient(90deg,#ffd23a 50%,#0e2552 50%); }
      .sm-tabtxt { font-size: 12.5px; line-height: 1.5; } .sm-tabtxt button, .sm-dlg-f button { border: 2px solid #8fb4ef; background: #3e6cc0; color: #fff; border-radius: 8px; padding: 4px 14px; cursor: pointer; font: 700 13px system-ui; margin-top: 4px; }
      .sm-catalog { position: absolute; left: 0; right: 0; bottom: 124px; background: rgba(20,45,100,.95); padding: 8px; display: flex; flex-direction: column; gap: 6px; border-top: 2px solid #8fb4ef; }
      .sm-cats { display: flex; gap: 4px; flex-wrap: wrap; } .sm-cats button { border: 1px solid #8fb4ef; background: #3e6cc0; color: #fff; border-radius: 6px; padding: 3px 10px; cursor: pointer; font: 700 12px system-ui; } .sm-cats button.on { background: #ffd23a; color: #1d3d7a; }
      .sm-items { display: flex; gap: 6px; overflow-x: auto; } .sm-item { flex: none; width: 150px; text-align: left; border: 2px solid #5a80c8; background: #e8f0ff; border-radius: 8px; padding: 6px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; font: 12px system-ui; color: #102a5a; } .sm-item.on { border-color: #ffd23a; background: #fff7c2; } .sm-item span { color: #2a6a2a; font-weight: 700; }
      .sm-pie { position: absolute; inset: 0; z-index: 20; }
      .sm-pie-head { position: absolute; transform: translate(-50%,-50%); width: 46px; height: 46px; border-radius: 50%; background: radial-gradient(#9ad0ff,#3e6cc0); border: 2px solid #fff; overflow: hidden; }
      .sm-pie-opt { position: absolute; transform: translate(-50%,-50%); white-space: nowrap; background: rgba(255,255,255,.96); border: 2px solid #2f5aa8; color: #1d3d7a; border-radius: 14px; padding: 5px 12px; font: 700 13px system-ui; cursor: pointer; box-shadow: 0 3px 10px rgba(0,0,0,.3); }
      .sm-pie-opt:hover { background: #ffd23a; }
      .sm-dialog { position: absolute; inset: 0; background: rgba(0,0,0,.35); display: grid; place-items: center; z-index: 30; }
      .sm-splash { position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 30%, #4f8be0, #142c66 75%); color: #fff; font-family: system-ui; overflow: auto; }
      .sm-sp-in { width: min(440px, 90%); text-align: center; padding: 16px 0; }
      .sm-sp-bob { width: 34px; height: 51px; margin: 0 auto 4px; filter: drop-shadow(0 0 10px #3be36a); animation: smbob 1.6s ease-in-out infinite; } .sm-sp-bob svg { width: 100%; height: 100%; display: block; }
      @keyframes smbob { 50% { transform: translateY(-8px) rotateY(180deg); } }
      .sm-sp-t { font: 900 40px system-ui; letter-spacing: 1px; text-shadow: 0 3px 0 #0b1d48; } .sm-sp-tip { font-size: 13px; opacity: .85; margin: 6px 0; min-height: 18px; }
      .sm-sp-bar { position: relative; height: 6px; background: rgba(255,255,255,.22); border-radius: 3px; margin: 22px 30px 26px; }
      .sm-sp-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: #3be36a; border-radius: 3px; animation: smload 4.5s linear forwards; }
      .sm-sp-dot { position: absolute; top: 50%; left: 0; width: 20px; height: 30px; transform: translate(-50%, -50%); filter: drop-shadow(0 0 6px #3be36a) drop-shadow(0 2px 2px rgba(0,0,0,.4)); animation: smdot 4.5s linear forwards; }
      .sm-sp-dot svg { width: 100%; height: 100%; display: block; }
      @keyframes smload { to { width: 100%; } } @keyframes smdot { to { left: 100%; } }
      .sm-sp-h { font: 800 14px system-ui; text-transform: uppercase; letter-spacing: 2px; opacity: .8; margin-bottom: 6px; }
      .sm-cred { display: flex; flex-direction: column; gap: 6px; text-align: left; font-size: 12.5px; } .sm-cred-i { background: rgba(255,255,255,.12); border-radius: 8px; padding: 6px 10px; }
      .sm-cred-i span { opacity: .8; font-size: 11.5px; } .sm-cred a { color: #9fe8b0; } .sm-dlg .sm-cred-i { background: rgba(47,90,168,.12); } .sm-dlg .sm-cred a { color: #2f5aa8; }
      .sm-sp-in .sm-cred { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); max-height: 42vh; overflow: auto; padding-right: 4px; }
      .sm-sp-in { width: min(640px, 92%); }
      .sm-sp-go { margin-top: 14px; border: 2px solid #9fe8b0; background: #2ea84e; color: #fff; border-radius: 10px; padding: 6px 28px; font: 800 15px system-ui; cursor: pointer; }
      .sm-dlg { width: min(520px, 92%); max-height: 88%; overflow: auto; background: linear-gradient(#e8f0ff,#c9dbff); border: 3px solid #2f5aa8; border-radius: 16px; box-shadow: 0 16px 50px rgba(0,0,0,.45); color: #102a5a; }
      .sm-dlg-h { background: linear-gradient(#3e6cc0,#1d3d7a); color: #fff; font: 800 16px system-ui; padding: 8px 14px; border-radius: 12px 12px 0 0; }
      .sm-dlg-b { padding: 10px 16px; font-size: 14px; line-height: 1.45; } .sm-dlg-f { display: flex; gap: 8px; justify-content: flex-end; padding: 0 14px 12px; }
      .sm-cas { display: flex; gap: 12px; } .sm-cas-cv { background: radial-gradient(#fff,#9ad0ff); border-radius: 12px; flex: none; }
      .sm-cas-f { display: flex; flex-direction: column; gap: 6px; font-size: 13px; flex: 1; } .sm-in { width: 100%; box-sizing: border-box; border: 2px solid #5a80c8; border-radius: 6px; padding: 4px 6px; font: inherit; }
      .sm-sw { display: inline-flex; gap: 4px; margin-left: 6px; vertical-align: middle; } .sm-sw button { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #fff; cursor: pointer; box-shadow: 0 0 0 1px #5a80c8; } .sm-sw button.on { box-shadow: 0 0 0 3px #ffd23a; }
      .sm-gender { display: flex; gap: 6px; align-items: center; } .sm-gender button { border: 2px solid #5a80c8; background: #fff; border-radius: 8px; padding: 3px 10px; cursor: pointer; font: 700 12px system-ui; color: #102a5a; } .sm-gender button.on { background: #ffd23a; }
      .sm-traits { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
      .sm-trait { display: grid; grid-template-columns: 70px 1fr 70px 20px; align-items: center; gap: 6px; } .sm-trait span:last-of-type { text-align: right; }
      .sm-pts { font-weight: 700; text-align: right; }
      .sm-jobs { display: flex; flex-direction: column; gap: 6px; } .sm-job { text-align: left; border: 2px solid #5a80c8; background: #fff; border-radius: 10px; padding: 8px 10px; cursor: pointer; display: flex; flex-direction: column; color: #102a5a; } .sm-job:hover { background: #fff7c2; } .sm-job span { font-size: 12px; color: #2a6a2a; }
      .sm-house.cur { border-color: #3be36a; } .sm-house span { display: block; font-size: 12px; color: #4a5a74; }
      .sm-row { display: flex; gap: 8px; align-items: center; } .sm-small { font-size: 12px; opacity: .8; }
      @media (max-width: 640px) { .sm-tabs { display: none; } .sm-left { width: 140px; } }
      /* ===== Modern Sims-style HUD (floats over the lot) ===== */
      .sm { font-family: "Nunito", "Segoe UI", system-ui, sans-serif; }
      .sm-bar { background: none; border: 0; height: auto; top: auto; padding: 0; pointer-events: none; display: block; left: 0; right: 0; bottom: 0; }
      .sm-bar > * { pointer-events: auto; }
      .sm-hud-left { position: absolute; left: 10px; bottom: 10px; display: flex; align-items: flex-end; gap: 6px; }
      .sm-tabs { display: flex; flex-direction: column; gap: 5px; margin-bottom: 6px; }
      .sm-tabs button { width: 34px; height: 34px; border-radius: 50%; border: 0; background: rgba(255,255,255,.92); color: #2a5aa0; font: 700 15px system-ui; padding: 0; text-align: center; box-shadow: 0 2px 8px rgba(0,30,80,.3); cursor: pointer; }
      .sm-tabs button.on { background: #3a7be0; color: #fff; }
      .sm-face { width: 112px; gap: 3px; align-items: center; }
      .sm-ring { width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(#d6ecff, #7ab0e8); border: 4px solid #fff; box-shadow: 0 4px 14px rgba(0,30,80,.4), 0 0 0 3px #3be36a; overflow: hidden; display: flex; align-items: flex-end; justify-content: center; }
      .sm-ring.live { background: transparent; } .sm-ring.live .sm-portrait { visibility: hidden; }
      .sm-portrait { background: none; border: 0; border-radius: 0; width: 82px; height: 96px; }
      .sm-moodchip { margin-top: -14px; z-index: 1; padding: 2px 12px; border-radius: 12px; font: 800 12px "Nunito", system-ui; color: #26324a; box-shadow: 0 2px 6px rgba(0,0,0,.3); border: 2px solid #fff; }
      .sm-mood { display: none; }
      .sm-name { color: #fff; font: 800 12px "Nunito", system-ui; text-shadow: 0 1px 3px rgba(0,0,0,.8); max-width: 112px; }
      .sm-money { background: rgba(255,255,255,.92); color: #2a7a3a; border-radius: 12px; padding: 2px 12px; font: 900 14px "Nunito", system-ui; box-shadow: 0 2px 6px rgba(0,0,0,.25); }
      .sm-left { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); width: auto; flex-direction: row; align-items: center; gap: 10px; background: rgba(255,255,255,.94); border-radius: 26px; padding: 5px 8px 5px 6px; box-shadow: 0 4px 14px rgba(0,30,80,.35); }
      .sm-speeds { gap: 3px; }
      .sm-speeds button { flex: none; width: 34px; height: 30px; border-radius: 15px; border: 0; background: transparent; color: #4a6a94; font: 800 11px system-ui; padding: 0; }
      .sm-speeds button.on { background: #3be36a; color: #fff; border: 0; }
      .sm-clock { flex-direction: column; align-items: flex-start; gap: 0; color: #26324a; padding-right: 6px; line-height: 1.1; } .sm-clock b { font: 900 14px "Nunito", system-ui; } .sm-clock span { font-size: 11px; color: #6a7a94; }
      .sm-tab-body { position: absolute; right: 10px; bottom: 10px; width: min(330px, 46vw); max-height: 260px; overflow: auto; background: rgba(255,255,255,.95); color: #26324a; border-radius: 14px; padding: 10px 12px; box-shadow: 0 6px 20px rgba(0,30,80,.35); }
      .sm-card-h { font: 900 13px "Nunito", system-ui; color: #2a5aa0; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .5px; }
      .sm-needs { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 7px 12px; }
      .sm-need { font: 700 11.5px "Nunito", system-ui; color: #3a4a64; display: grid; grid-template-columns: 18px 1fr; grid-template-rows: auto auto; column-gap: 4px; align-items: center; }
      .sm-need i { grid-row: span 2; font-style: normal; font-size: 14px; text-align: center; } .sm-need span { width: auto; }
      .sm-nb { height: 9px; background: #e3e9f2; border: 0; border-radius: 5px; box-shadow: inset 0 1px 2px rgba(0,0,0,.15); }
      .sm-nb div { border-radius: 5px; transition: width .4s; }
      .sm-tabtxt { color: #26324a; } .sm-pips i { background: #e3e9f2; border: 0; } .sm-pips i.on { background: #3be36a; }
      .sm-modes { position: absolute; right: 10px; top: 10px; z-index: 3; display: flex; gap: 6px; }
      .sm-modes button { width: 42px; height: 42px; border-radius: 50%; border: 0; background: rgba(255,255,255,.94); color: #2a5aa0; padding: 9px; box-shadow: 0 3px 10px rgba(0,30,80,.35); cursor: pointer; flex: none; }
      .sm-modes button svg { width: 100%; height: 100%; display: block; }
      .sm-modes button.on { background: #3a7be0; color: #fff; border: 0; }
      .sm-view3d { top: 62px; right: 10px; flex-direction: column; align-items: flex-end; gap: 6px; }
      .sm-view3d button { border: 0; background: rgba(255,255,255,.94); color: #2a5aa0; border-radius: 20px; min-width: 38px; height: 36px; box-shadow: 0 3px 10px rgba(0,30,80,.3); font: 800 15px "Nunito", system-ui; }
      .sm-view3d .sm-wallbtn, .sm-view3d .sm-2dbtn, .sm-view3d .sm-turnbtn { font-size: 12px; padding: 0 12px; }
      .sm-queue { top: 12px; left: 12px; gap: 8px; }
      .sm-q { width: 44px; height: 44px; border-radius: 50%; border: 3px solid #fff; background: rgba(255,255,255,.9); font-size: 20px; box-shadow: 0 3px 10px rgba(0,30,80,.35); }
      .sm-q.on { width: 54px; height: 54px; font-size: 26px; background: #fff; border-color: #3be36a; transform: none; box-shadow: 0 0 0 3px rgba(59,227,106,.35), 0 3px 10px rgba(0,30,80,.35); }
      .sm-notes { position: absolute; left: 12px; top: 76px; z-index: 4; display: flex; flex-direction: column; gap: 6px; width: min(300px, 60%); pointer-events: none; }
      .sm-note { display: flex; gap: 8px; align-items: center; background: rgba(255,255,255,.96); color: #26324a; border-left: 5px solid #3be36a; border-radius: 10px; padding: 7px 10px; font: 700 12.5px "Nunito", system-ui; box-shadow: 0 4px 14px rgba(0,30,80,.3); animation: smnote .35s ease-out; transition: opacity .4s, transform .4s; }
      .sm-note i { width: 14px; height: 21px; flex: none; } .sm-note i svg { width: 100%; height: 100%; } .sm-note.out { opacity: 0; transform: translateX(-20px); }
      @keyframes smnote { from { opacity: 0; transform: translateX(-20px); } }
      .sm-buyhint { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); z-index: 3; background: rgba(255,255,255,.95); color: #2a5aa0; border-radius: 18px; padding: 7px 16px; font: 800 12.5px "Nunito", system-ui; box-shadow: 0 3px 10px rgba(0,30,80,.3); max-width: 60%; text-align: center; }
      .sm-buyhint[hidden] { display: none; }
      .sm-catalog { bottom: 64px; left: 140px; right: 10px; background: rgba(255,255,255,.96); border: 0; border-radius: 16px; padding: 10px; box-shadow: 0 8px 26px rgba(0,30,80,.4); flex-direction: row; gap: 10px; z-index: 4; max-height: 40%; }
      .sm-cats { flex-direction: column; flex-wrap: nowrap; gap: 4px; min-width: 112px; overflow-y: auto; }
      .sm-cats button { border: 0; background: #eef3fa; color: #2a5aa0; border-radius: 10px; padding: 7px 10px; font: 800 12px "Nunito", system-ui; text-align: left; }
      .sm-cats button.on { background: #3a7be0; color: #fff; }
      .sm-items { flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px; overflow-y: auto; align-content: start; }
      .sm-item { width: auto; border: 2px solid transparent; background: #f4f7fb; border-radius: 12px; padding: 8px; color: #26324a; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
      .sm-item b { font: 800 12px "Nunito", system-ui; } .sm-item span { color: #2a7a3a; font: 800 12px "Nunito", system-ui; }
      .sm-item.on { border-color: #3be36a; background: #ecfbef; }
      .sm-pie-head { border: 3px solid #fff; box-shadow: 0 3px 10px rgba(0,0,0,.35); background: radial-gradient(#d6ecff, #7ab0e8); }
      .sm-pie-opt { background: rgba(255,255,255,.97); border: 0; color: #26324a; border-radius: 18px; padding: 8px 14px; font: 800 13px "Nunito", system-ui; box-shadow: 0 3px 12px rgba(0,30,80,.35); }
      .sm-pie-opt:hover { background: #3a7be0; color: #fff; }
      .sm-dialog { background: rgba(10,25,55,.35); }
      .sm-dlg { background: #fff; border: 0; border-radius: 16px; box-shadow: 0 18px 50px rgba(0,20,60,.45); color: #26324a; }
      .sm-dlg-h { background: none; color: #2a5aa0; font: 900 18px "Nunito", system-ui; padding: 16px 18px 4px; }
      .sm-dlg-b { padding: 8px 18px 12px; font-size: 14px; }
      .sm-dlg-f { padding: 0 16px 16px; } .sm-dlg-f button, .sm-tabtxt button { border: 0; background: #3a7be0; color: #fff; border-radius: 18px; padding: 7px 18px; font: 800 13px "Nunito", system-ui; box-shadow: 0 2px 6px rgba(0,40,120,.3); }
      /* ===== Create-a-Sim: full-screen stage with a turning 3D Sim ===== */
      .sm-dialog.sm-casmode { background: radial-gradient(ellipse at 60% 40%, #bfe6ff 0%, #5aa0e0 45%, #2a5aa8 100%); display: block; }
      .sm-casmode .sm-dlg { position: absolute; left: 14px; top: 14px; bottom: 14px; width: min(330px, 46%); max-height: none; background: rgba(255,255,255,.93); }
      .sm-casmode .sm-cas { flex-direction: column; } .sm-casmode .sm-cas-cv { display: none; }
      .sm-casmode .sm-dlg-f { position: sticky; bottom: 0; background: rgba(255,255,255,.95); padding-top: 10px; }
      .sm-casmode .sm-dlg-f button { width: 54px; height: 54px; border-radius: 50%; font-size: 0; background: #3be36a url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M5 12l5 5 9-10' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/></svg>") center/60% no-repeat; }
      .sm-cas-stage { position: absolute; left: calc(min(330px, 46%) + 28px); right: 0; top: 0; bottom: 0; }
      .sm-cas-stage canvas { display: block; }
      .sm-cas-arrows { position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); display: flex; gap: 90px; }
      .sm-cas-arrows button { width: 54px; height: 54px; border-radius: 50%; border: 0; background: rgba(255,255,255,.9); color: #2a5aa0; font: 900 26px system-ui; box-shadow: 0 4px 12px rgba(0,30,80,.35); cursor: pointer; }
      .sm-cas-title { position: absolute; top: 18px; left: 50%; transform: translateX(-50%); color: #fff; font: 900 22px "Nunito", system-ui; text-shadow: 0 2px 6px rgba(0,30,80,.5); white-space: nowrap; }
      .sm-casmode .sm-sw button { width: 26px; height: 26px; }
      @media (max-width: 700px) { .sm-tab-body { width: 52%; } .sm-catalog { left: 10px; } .sm-left { bottom: 140px; } }
    `;
    document.head.appendChild(s);
  }

  window.SIMS = { start, CAT, ACTS, CREDITS };
})();
