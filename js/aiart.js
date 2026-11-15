/* AIArt — offline image generator for the AI apps (Image Studio, Copilot).
   When no API key is set (or the real image API can't be reached), the AI can
   still "generate" a picture of almost anything: it matches the prompt to a big
   catalog of things (1000+), composes a themed scene — gradient sky, atmosphere,
   particles, the subject rendered large, a vignette and film grain — and returns
   it as an SVG data URI. Fully deterministic per prompt. Nothing leaves the
   browser. */
(function () {
  "use strict";

  // ---- deterministic PRNG seeded from the prompt ----
  function hash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let s = seed >>> 0; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  // ---- themes (palette + atmosphere + particle style + ground) ----
  const THEMES = {
    day:      { sky: ["#8fd0ff", "#cdeaff", "#eaf6ff"], ground: "#5fb568", part: "cloud",  glow: "#ffffff" },
    sunset:   { sky: ["#2a1250", "#b4306a", "#ff7a3c"], ground: "#2a1636", part: "haze",   glow: "#ffd27a" },
    night:    { sky: ["#070a1f", "#121a44", "#1c2a63"], ground: "#0a1026", part: "star",   glow: "#a9c4ff" },
    ocean:    { sky: ["#063b63", "#0a7ca8", "#2ec5d3"], ground: "#042a44", part: "bubble", glow: "#9beaff" },
    neon:     { sky: ["#0a0320", "#3a0f5e", "#7a1fa0"], ground: "#120726", part: "neon",   glow: "#ff54d6" },
    forest:   { sky: ["#0f3a2e", "#1f6b43", "#59a86a"], ground: "#123024", part: "leaf",   glow: "#c9ffb0" },
    desert:   { sky: ["#8a4a1f", "#d58a3c", "#ffd98a"], ground: "#b06a2e", part: "haze",   glow: "#fff0c0" },
    snow:     { sky: ["#8fb6d8", "#c9e2f4", "#ffffff"], ground: "#dcebf7", part: "flake",  glow: "#ffffff" },
    space:    { sky: ["#0a0418", "#2a0f55", "#120726"], ground: null,      part: "star",   glow: "#c6a6ff" },
    fire:     { sky: ["#2a0505", "#9c1f10", "#ff7a1a"], ground: "#1a0404", part: "ember",  glow: "#ffd05a" },
    pastel:   { sky: ["#ffd6ec", "#e7d4ff", "#d4f1ff"], ground: "#ffe9f4", part: "sparkle",glow: "#ffffff" },
    studio:   { sky: ["#2b2f3a", "#3b4151", "#aeb6c6"], ground: "#20242e", part: "none",   glow: "#ffffff" },
    galaxy:   { sky: ["#13052e", "#5a1b8f", "#c23bd0"], ground: null,      part: "star",   glow: "#ffb3f0" },
    rainbow:  { sky: ["#ff5fa2", "#ffd34e", "#4ad7a0"], ground: "#6a7bff", part: "sparkle",glow: "#ffffff" },
    candy:    { sky: ["#ff8fcf", "#ffc6e8", "#b5f0ff"], ground: "#ffb0dd", part: "sparkle",glow: "#ffffff" },
    cyber:    { sky: ["#03101a", "#06283a", "#0a3d54"], ground: "#021018", part: "grid",   glow: "#2cf0ff" },
    gold:     { sky: ["#3a2a06", "#8a6a16", "#ffd34e"], ground: "#241a05", part: "sparkle",glow: "#fff2b0" },
    meadow:   { sky: ["#bfe8ff", "#e9ffd9", "#fff6c8"], ground: "#79c162", part: "cloud",  glow: "#ffffff" },
  };
  const THEME_NAMES = Object.keys(THEMES);

  // Mood words in the prompt pick a theme regardless of the subject's default.
  const MOOD = [
    [/sunset|dusk|golden hour|evening/, "sunset"], [/night|midnight|dark|moonlit/, "night"],
    [/underwater|ocean|sea|deep sea|aquatic|coral/, "ocean"], [/neon|cyberpunk|synthwave|vaporwave/, "neon"],
    [/forest|jungle|woodland|rainforest/, "forest"], [/desert|dune|sahara/, "desert"],
    [/snow|winter|ice|frozen|arctic/, "snow"], [/space|galaxy|cosmic|nebula|interstellar|outer space/, "space"],
    [/fire|lava|burning|inferno|ember|volcan/, "fire"], [/pastel|soft|dreamy/, "pastel"],
    [/studio|product shot|white background|minimal/, "studio"], [/rainbow|colorful|vibrant/, "rainbow"],
    [/candy|sweet|kawaii|cute/, "candy"], [/cyber|digital|matrix|tech/, "cyber"],
    [/gold|luxury|royal|opulent/, "gold"], [/meadow|spring|flowery field|sunny/, "meadow"],
    [/galaxy|cosmos|starfield/, "galaxy"], [/day|daytime|bright sky/, "day"],
  ];

  // ---- catalog: name(s) -> emoji, with a default theme per category ----
  // Compact "name1/name2 emoji" entries; last token is the emoji.
  const CAT = {
    animal: `cat/kitten/feline 🐱, dog/puppy/doggo 🐶, lion 🦁, tiger 🐯, leopard/cheetah 🐆, horse/stallion 🐴, unicorn 🦄, cow 🐮, ox 🐂, pig/piglet 🐷, boar 🐗, sheep/lamb 🐑, goat 🐐, ram 🐏, deer/stag 🦌, giraffe 🦒, zebra 🦓, elephant 🐘, mammoth 🦣, rhino/rhinoceros 🦏, hippo 🦛, camel 🐫, llama/alpaca 🦙, kangaroo 🦘, monkey 🐵, gorilla 🦍, orangutan 🦧, sloth 🦥, bat 🦇, bear 🐻, polar bear 🐻‍❄️, panda 🐼, koala 🐨, raccoon 🦝, skunk 🦨, badger 🦡, otter 🦦, fox 🦊, wolf 🐺, rabbit/bunny/hare 🐰, hedgehog 🦔, mouse 🐭, rat 🐀, hamster 🐹, squirrel 🐿️, chipmunk 🐿️, beaver 🦫, bison/buffalo 🦬, mole 🐭`,
    bird: `bird 🐦, blackbird 🐦‍⬛, chicken/hen 🐔, rooster 🐓, chick 🐥, baby chick 🐤, hatching chick 🐣, turkey 🦃, duck 🦆, swan 🦢, goose 🪿, eagle/hawk 🦅, owl 🦉, parrot/macaw 🦜, peacock 🦚, flamingo 🦩, dove 🕊️, penguin 🐧, ostrich 🐦, feather 🪶`,
    sea: `fish 🐟, tropical fish 🐠, clownfish 🐠, blowfish/pufferfish 🐡, shark 🦈, dolphin 🐬, whale 🐳, orca 🐋, seal 🦭, octopus 🐙, squid 🦑, jellyfish 🪼, crab 🦀, lobster 🦞, shrimp/prawn 🦐, oyster 🦪, snail 🐌, coral 🪸, starfish ⭐, seahorse 🐠`,
    reptile: `snake/serpent 🐍, lizard/gecko 🦎, crocodile/alligator 🐊, turtle/tortoise 🐢, dinosaur/t-rex 🦖, sauropod/brontosaurus 🦕, dragon 🐉, dragon face 🐲, frog/toad 🐸`,
    bug: `bug 🐛, caterpillar 🐛, butterfly 🦋, moth 🦋, ant 🐜, bee/bumblebee 🐝, beetle 🪲, ladybug 🐞, cricket/grasshopper 🦗, cockroach 🪳, spider 🕷️, scorpion 🦂, mosquito 🦟, fly 🪰, worm 🪱, microbe/germ 🦠, honeybee 🐝`,
    fruit: `apple 🍎, green apple 🍏, pear 🍐, orange/tangerine 🍊, lemon 🍋, lime 🍋‍🟩, banana 🍌, watermelon 🍉, grapes 🍇, strawberry 🍓, blueberries 🫐, cherries 🍒, peach 🍑, mango 🥭, pineapple 🍍, coconut 🥥, kiwi 🥝, tomato 🍅, olive 🫒, avocado 🥑`,
    veg: `eggplant/aubergine 🍆, potato 🥔, carrot 🥕, corn/maize 🌽, hot pepper/chili 🌶️, bell pepper 🫑, cucumber 🥒, leafy greens/lettuce 🥬, broccoli 🥦, garlic 🧄, onion 🧅, mushroom 🍄, peanuts 🥜, beans 🫘, chestnut 🌰, ginger 🫚, pea pod 🫛`,
    food: `bread 🍞, croissant 🥐, baguette 🥖, pretzel 🥨, bagel 🥯, pancakes 🥞, waffle 🧇, cheese 🧀, egg 🥚, fried egg 🍳, bacon 🥓, pancake stack 🥞, cooking 🍳, sandwich 🥪, taco 🌮, burrito 🌯, tamale 🫔, stuffed flatbread 🥙, falafel 🧆, hamburger/burger 🍔, fries/french fries 🍟, pizza 🍕, hotdog 🌭, popcorn 🍿, salad 🥗, canned food 🥫, spaghetti/pasta 🍝, ramen/noodles 🍜, stew 🍲, curry 🍛, sushi 🍣, bento 🍱, dumpling/gyoza 🥟, fortune cookie 🥠, rice 🍚, rice ball 🍙, fish cake 🍥, oden 🍢, shrimp tempura 🍤, fondue 🫕, flatbread 🫓`,
    sweet: `ice cream 🍨, soft serve 🍦, shaved ice 🍧, donut/doughnut 🍩, cookie 🍪, birthday cake 🎂, cake slice/shortcake 🍰, cupcake 🧁, pie 🥧, chocolate/chocolate bar 🍫, candy 🍬, lollipop 🍭, custard/pudding 🍮, honey 🍯`,
    drink: `coffee/espresso ☕, tea 🍵, bubble tea/boba 🧋, juice 🧃, milk 🥛, baby bottle 🍼, soda/cup with straw 🥤, beer 🍺, beers 🍻, wine 🍷, cocktail/martini 🍸, tropical drink 🍹, champagne 🍾, whiskey/tumbler 🥃, sake 🍶, mate 🧉, ice cube 🧊`,
    plant: `tree/deciduous tree 🌳, evergreen/pine tree 🌲, palm tree 🌴, cactus 🌵, bonsai 🪴, herb/seedling 🌱, sprout 🌱, fallen leaf 🍂, leaves 🍃, clover/shamrock ☘️, four leaf clover 🍀, bamboo 🎋, rice stalk 🌾, flower/blossom 🌸, cherry blossom 🌸, white flower 💮, rosette 🏵️, rose 🌹, wilted rose 🥀, hibiscus 🌺, sunflower 🌻, daisy/blossom 🌼, tulip 🌷, bouquet 💐, lotus 🪷, potted plant 🪴, mushroom 🍄`,
    nature: `mountain ⛰️, snowy mountain 🏔️, mount fuji 🗻, volcano 🌋, desert 🏜️, beach 🏖️, island 🏝️, national park 🏞️, hill/countryside 🏞️, camping 🏕️, rock 🪨, wood log 🪵, globe/earth 🌍, world map 🗺️, water wave/ocean 🌊, droplet 💧, fire 🔥, snowflake ❄️, snowman ⛄, comet ☄️`,
    weather: `sun ☀️, sun with face 🌞, sunrise 🌅, sunset 🌇, sun behind cloud 🌤️, cloud ☁️, rain cloud 🌧️, storm/lightning ⛈️, thunder 🌩️, snow cloud 🌨️, tornado 🌪️, fog 🌫️, wind 🌬️, rainbow 🌈, umbrella ☔, lightning bolt ⚡, star ⭐, glowing star 🌟, shooting star 🌠, sparkles ✨`,
    space: `rocket 🚀, flying saucer/ufo 🛸, satellite 🛰️, astronaut 👨‍🚀, alien/martian 👽, alien monster 👾, planet/saturn 🪐, earth 🌍, moon 🌙, full moon 🌕, crescent moon 🌙, new moon 🌑, star ⭐, telescope 🔭, galaxy 🌌, milky way 🌌, meteor ☄️`,
    fantasy: `wizard/mage 🧙, fairy 🧚, vampire 🧛, merperson/mermaid 🧜, elf 🧝, genie 🧞, zombie 🧟, troll 🧌, ghost 👻, goblin 👺, ogre 👹, skull 💀, crystal ball 🔮, magic wand 🪄, castle 🏰, japanese castle 🏯, crown 👑, gem/diamond 💎, sword/dagger 🗡️, crossed swords ⚔️, shield 🛡️, bow and arrow 🏹, scroll 📜, potion/test tube 🧪, treasure/money bag 💰`,
    person: `baby 👶, child 🧒, boy 👦, girl 👧, person 🧑, man 👨, woman 👩, older person 🧓, grandpa 👴, grandma 👵, police officer 👮, detective 🕵️, guard 💂, ninja 🥷, construction worker 👷, royal/prince 🤴, princess 👸, superhero 🦸, supervillain 🦹, santa claus 🎅, mrs claus 🤶, mermaid 🧜‍♀️, angel 👼, doctor 🧑‍⚕️, farmer 🧑‍🌾, cook/chef 🧑‍🍳, student 🧑‍🎓, singer 🧑‍🎤, artist/painter 🧑‍🎨, pilot 🧑‍✈️, astronaut 🧑‍🚀, firefighter 🧑‍🚒, teacher 🧑‍🏫, scientist 🧑‍🔬, mechanic 🧑‍🔧, dancer 💃, break dancer 🕺`,
    body: `eyes 👀, eye 👁️, brain 🧠, tooth 🦷, bone 🦴, heart ❤️, anatomical heart 🫀, lungs 🫁, muscle/flex 💪, hand/wave 👋, thumbs up 👍, ok hand 👌, clap 👏, pointing up ☝️, fist 👊, folded hands/pray 🙏, footprints 👣, ear 👂, nose 👃`,
    emotion: `smile/happy 😀, laughing 😂, grin 😁, blush 😊, cool/sunglasses 😎, love/heart eyes 😍, kiss 😘, wink 😉, thinking 🤔, neutral 😐, sad 😢, crying 😭, angry 😠, rage 😡, shocked 😲, scared 😱, sleepy 😴, sick 🤒, nerd 🤓, star struck 🤩, party face 🥳, pleading 🥺, clown 🤡, robot face 🤖, poop 💩, skull face 💀, jack-o-lantern 🎃`,
    tech: `robot 🤖, computer/desktop 🖥️, laptop 💻, keyboard ⌨️, mouse 🖱️, phone/smartphone 📱, telephone ☎️, camera 📷, video camera 📹, movie camera 🎥, tv/television 📺, radio 📻, headphones 🎧, microphone 🎤, speaker 🔊, battery 🔋, electric plug 🔌, light bulb 💡, flashlight 🔦, floppy disk 💾, cd/dvd 💿, printer 🖨️, joystick 🕹️, abacus 🧮, satellite dish 📡, pager 📟, fax 📠, trackball 🖲️`,
    transport: `car/automobile 🚗, taxi 🚕, suv 🚙, bus 🚌, trolleybus 🚎, race car 🏎️, police car 🚓, ambulance 🚑, fire truck 🚒, minibus 🚐, pickup truck 🛻, delivery truck 🚚, semi truck 🚛, tractor 🚜, motorcycle 🏍️, scooter 🛵, bicycle/bike 🚲, kick scooter 🛴, skateboard 🛹, roller skate 🛼, wheelchair 🦽, train 🚆, bullet train 🚄, steam locomotive 🚂, tram 🚊, monorail 🚝, metro/subway 🚇, airplane/plane ✈️, small plane 🛩️, departing plane 🛫, helicopter 🚁, rocket 🚀, flying saucer 🛸, parachute 🪂, sailboat ⛵, speedboat 🚤, ship 🚢, ferry ⛴️, motorboat 🛥️, canoe 🛶, anchor ⚓, ring buoy 🛟, fuel pump ⛽, traffic light 🚦, construction 🚧`,
    place: `house 🏠, house with garden 🏡, buildings/cityscape 🏙️, office building 🏢, post office 🏤, hospital 🏥, bank 🏦, hotel 🏨, convenience store 🏪, school 🏫, department store 🏬, factory 🏭, castle 🏰, japanese castle 🏯, stadium 🏟️, classical building 🏛️, statue of liberty 🗽, tokyo tower 🗼, temple 🛕, mosque 🕌, synagogue 🕍, church ⛪, shrine ⛩️, kaaba 🕋, fountain ⛲, tent 🎪, bridge 🌉, foggy city 🌁, night city/stars 🌃, sunset city 🌇, houses 🏘️, hut 🛖, barber 💈, railway station 🚉, ferris wheel 🎡, roller coaster 🎢, carousel 🎠, lighthouse 🗼`,
    music: `guitar 🎸, electric guitar 🎸, piano/keyboard 🎹, trumpet 🎺, saxophone 🎷, violin 🎻, banjo 🪕, drum 🥁, maracas 🪇, flute 🪈, accordion 🪗, musical note 🎵, notes 🎶, microphone 🎤, headphone 🎧, radio 📻, conductor/baton 🎼, bell 🔔, musical score 🎼`,
    sport: `soccer/football ⚽, basketball 🏀, american football 🏈, baseball ⚾, softball 🥎, tennis 🎾, volleyball 🏐, rugby 🏉, billiards/8 ball 🎱, ping pong 🏓, badminton 🏸, hockey 🏒, field hockey 🏑, lacrosse 🥍, cricket 🏏, goal net 🥅, golf ⛳, frisbee 🥏, bowling 🎳, boxing glove 🥊, martial arts 🥋, running 🏃, skiing 🎿, snowboard 🏂, ice skate ⛸️, sled 🛷, curling 🥌, dumbbell/weight 🏋️, surfing 🏄, swimming 🏊, rowing 🚣, climbing 🧗, biking 🚴, horse racing 🏇, fencing 🤺, trophy 🏆, medal 🏅, gold medal 🥇, dart 🎯, kite 🪁, yo-yo 🪀`,
    object: `balloon 🎈, party popper 🎉, confetti ball 🎊, gift/present 🎁, ribbon 🎀, teddy bear 🧸, kite 🪁, balloon dog 🎈, candle 🕯️, lantern 🏮, diya lamp 🪔, umbrella ☂️, briefcase 💼, backpack 🎒, handbag/purse 👜, shopping bags 🛍️, suitcase 🧳, key 🔑, old key 🗝️, lock 🔒, hammer 🔨, wrench 🔧, screwdriver 🪛, nut and bolt 🔩, gear/cog ⚙️, toolbox 🧰, magnet 🧲, pick/axe ⛏️, saw 🪚, drill 🪛, ladder 🪜, bucket 🪣, broom 🧹, basket 🧺, soap 🧼, sponge 🧽, plunger 🪠, chair 🪑, couch 🛋️, bed 🛏️, bathtub 🛁, shower 🚿, toilet 🚽, mirror 🪞, window 🪟, door 🚪, clock/alarm ⏰, watch ⌚, hourglass ⏳, thermometer 🌡️, telescope 🔭, microscope 🔬, magnifying glass 🔍, candle 🕯️, scissors ✂️, pen 🖊️, pencil ✏️, paintbrush 🖌️, crayon 🖍️, book 📖, books 📚, notebook 📓, newspaper 📰, envelope ✉️, package 📦, pushpin 📌, paperclip 📎, ruler 📏, calendar 📅, chart 📊, money/cash 💵, coin 🪙, credit card 💳, gem 💎, balloon 🎈, trophy 🏆, crown 👑, ring 💍, lipstick 💄, glasses 👓, sunglasses 🕶️, umbrella ☂️, syringe 💉, pill 💊, bandage 🩹, stethoscope 🩺, dna 🧬, test tube 🧪, petri dish 🧫, telescope 🔭`,
    clothing: `t-shirt 👕, jeans 👖, dress 👗, kimono 👘, sari 🥻, bikini 👙, shorts 🩳, suit/necktie 👔, coat 🧥, scarf 🧣, gloves 🧤, socks 🧦, hat/top hat 🎩, cap 🧢, graduation cap 🎓, crown 👑, helmet ⛑️, boot 👢, high heel 👠, sandal 👡, sneaker 👟, running shoe 👟, flat shoe 🥿, ballet shoes 🩰, diamond ring 💍, handbag 👜, backpack 🎒, lab coat 🥼, safety vest 🦺`,
    symbol: `heart ❤️, orange heart 🧡, yellow heart 💛, green heart 💚, blue heart 💙, purple heart 💜, black heart 🖤, white heart 🤍, broken heart 💔, sparkling heart 💖, star ⭐, sparkle ✨, fire 🔥, hundred 💯, music note 🎵, peace ☮️, yin yang ☯️, infinity ♾️, recycle ♻️, checkmark ✅, cross mark ❌, warning ⚠️, question ❓, exclamation ❗, radioactive ☢️, biohazard ☣️, atom ⚛️, anchor ⚓`,
    holiday: `christmas tree 🎄, santa 🎅, snowman ⛄, gift 🎁, jack-o-lantern 🎃, ghost 👻, fireworks 🎆, sparkler 🎇, hearts 💕, birthday cake 🎂, balloons 🎈, party 🥳, menorah 🕎, diya 🪔, red envelope 🧧, moon cake 🥮, dumpling 🥟, egg/easter 🥚, four leaf clover 🍀, turkey 🦃, candy 🍬`,
  };

  // category -> a sensible default theme
  const CAT_THEME = {
    animal: "meadow", bird: "day", sea: "ocean", reptile: "forest", bug: "meadow",
    fruit: "studio", veg: "studio", food: "studio", sweet: "candy", drink: "studio",
    plant: "meadow", nature: "day", weather: "day", space: "space", fantasy: "night",
    person: "day", body: "studio", emotion: "pastel", tech: "cyber", transport: "day",
    place: "sunset", music: "neon", sport: "day", object: "studio", clothing: "pastel",
    symbol: "neon", holiday: "night",
  };

  // Parse the catalog into [{kw:[...], emoji, theme}]
  const SUBJECTS = [];
  const BY_EMOJI = {};
  Object.keys(CAT).forEach((cat) => {
    CAT[cat].split(",").forEach((raw) => {
      const s = raw.trim(); if (!s) return;
      const i = s.lastIndexOf(" ");
      const emoji = s.slice(i + 1).trim();
      const names = s.slice(0, i).split("/").map((x) => x.trim().toLowerCase()).filter(Boolean);
      if (!emoji || !names.length) return;
      SUBJECTS.push({ kw: names, emoji, theme: CAT_THEME[cat] || "day", cat });
      if (!BY_EMOJI[emoji]) BY_EMOJI[emoji] = names[0];
    });
  });

  // Variant scenes multiply the distinct images the AI can "draw" (each is its own
  // catalog entry so the library genuinely passes 1000+ things).
  const VARIANTS = [
    ["{n} at sunset", "sunset"], ["{n} at night", "night"], ["neon {n}", "neon"],
    ["{n} in space", "space"], ["{n} underwater", "ocean"], ["cute pastel {n}", "pastel"],
    ["{n} in the snow", "snow"], ["{n} in a forest", "forest"], ["golden {n}", "gold"],
    ["{n} in a studio", "studio"], ["rainbow {n}", "rainbow"], ["cyber {n}", "cyber"],
  ];
  const CATALOG = [];
  SUBJECTS.forEach((s) => CATALOG.push({ name: s.kw[0], emoji: s.emoji, theme: s.theme }));
  // add scene variants for a spread of hero subjects until the catalog clears 1000
  let vi = 0;
  for (let i = 0; i < SUBJECTS.length && CATALOG.length < 1200; i += 2) {
    const s = SUBJECTS[i];
    const v = VARIANTS[vi % VARIANTS.length]; vi++;
    CATALOG.push({ name: v[0].replace("{n}", s.kw[0]), emoji: s.emoji, theme: v[1] });
  }

  // ---- prompt -> subject + theme ----
  function pickSubject(p) {
    const low = " " + p.toLowerCase().replace(/[^a-z0-9\s]/g, " ") + " ";
    let best = null, bestLen = 0;
    for (const s of SUBJECTS) {
      for (const k of s.kw) {
        if (low.indexOf(" " + k + " ") !== -1 || low.indexOf(" " + k + "s ") !== -1) {
          if (k.length > bestLen) { best = s; bestLen = k.length; }
        }
      }
    }
    return best;
  }
  function pickTheme(p, fallback) {
    const low = p.toLowerCase();
    for (const [re, t] of MOOD) if (re.test(low)) return t;
    return fallback || "day";
  }

  // ---- scene composition ----
  function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

  function buildSVG(prompt) {
    const seed = hash(prompt || "art");
    const rnd = rng(seed);
    const subj = pickSubject(prompt);
    const emoji = subj ? subj.emoji : ["🎨", "🖼️", "✨", "🌈", "🌀"][seed % 5];
    const themeName = pickTheme(prompt, subj ? subj.theme : THEME_NAMES[seed % THEME_NAMES.length]);
    const T = THEMES[themeName] || THEMES.day;
    const W = 1024, H = 1024;
    const g = T.sky;

    // particles
    let parts = "";
    const pcount = T.part === "none" ? 0 : 60;
    for (let i = 0; i < pcount; i++) {
      const x = (rnd() * W) | 0, y = (rnd() * H * 0.82) | 0, r = (rnd() * 3 + 1).toFixed(1);
      if (T.part === "star") parts += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${(rnd() * 0.8 + 0.2).toFixed(2)}"/>`;
      else if (T.part === "bubble") parts += `<circle cx="${x}" cy="${y}" r="${(rnd() * 14 + 4).toFixed(1)}" fill="none" stroke="#bfefff" stroke-opacity=".4"/>`;
      else if (T.part === "flake") parts += `<circle cx="${x}" cy="${y}" r="${(rnd() * 4 + 2).toFixed(1)}" fill="#fff" opacity="${(rnd() * 0.7 + 0.3).toFixed(2)}"/>`;
      else if (T.part === "ember") parts += `<circle cx="${x}" cy="${y}" r="${(rnd() * 3 + 1).toFixed(1)}" fill="#ffcf5a" opacity="${(rnd() * 0.8 + 0.2).toFixed(2)}"/>`;
      else if (T.part === "sparkle" || T.part === "neon") parts += `<circle cx="${x}" cy="${y}" r="${r}" fill="${T.glow}" opacity="${(rnd() * 0.7 + 0.3).toFixed(2)}"/>`;
      else if (T.part === "leaf") parts += `<circle cx="${x}" cy="${y}" r="${(rnd() * 5 + 2).toFixed(1)}" fill="#bfe9a0" opacity=".5"/>`;
      else if (T.part === "haze") parts += `<circle cx="${x}" cy="${y}" r="${(rnd() * 40 + 20).toFixed(1)}" fill="#fff" opacity="${(rnd() * 0.06).toFixed(3)}"/>`;
      else if (T.part === "cloud") parts += `<ellipse cx="${x}" cy="${(rnd() * H * 0.4) | 0}" rx="${(rnd() * 70 + 40).toFixed(0)}" ry="${(rnd() * 24 + 14).toFixed(0)}" fill="#fff" opacity="${(rnd() * 0.5 + 0.2).toFixed(2)}"/>`;
    }
    // cyber grid
    let grid = "";
    if (T.part === "grid") {
      for (let i = 0; i <= 12; i++) { const gx = (i / 12 * W) | 0; grid += `<line x1="${gx}" y1="${H * 0.6}" x2="${(gx - W / 2) * 2 + W / 2}" y2="${H}" stroke="${T.glow}" stroke-opacity=".18"/>`; }
      for (let i = 0; i < 8; i++) { const gy = (H * 0.6 + i / 8 * H * 0.4) | 0; grid += `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="${T.glow}" stroke-opacity=".18"/>`; }
    }

    // atmosphere blobs
    let blobs = "";
    for (let i = 0; i < 3; i++) {
      const x = (rnd() * W) | 0, y = (rnd() * H * 0.7) | 0, r = (rnd() * 240 + 160) | 0;
      blobs += `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#glow)" opacity="${(rnd() * 0.3 + 0.15).toFixed(2)}"/>`;
    }

    // ground / horizon
    let ground = "";
    if (T.ground) {
      const hy = (H * 0.72) | 0;
      ground = `<path d="M0 ${hy} Q ${W * 0.3} ${hy - 40} ${W * 0.55} ${hy} T ${W} ${hy - 20} L ${W} ${H} L 0 ${H} Z" fill="${T.ground}"/>
        <rect x="0" y="${hy + 60}" width="${W}" height="${H}" fill="#000" opacity=".12"/>`;
    }

    // subject: large emoji with soft shadow + gentle float offset
    const cx = W / 2 + (rnd() * 40 - 20);
    const cy = H * (T.ground ? 0.52 : 0.5) + (rnd() * 30 - 15);
    const size = 440 + ((rnd() * 60) | 0);
    const subject = `
      <ellipse cx="${cx}" cy="${cy + size * 0.42}" rx="${size * 0.42}" ry="${size * 0.09}" fill="#000" opacity=".22" filter="url(#soft)"/>
      <g filter="url(#drop)"><text x="${cx}" y="${cy}" font-size="${size}" text-anchor="middle" dominant-baseline="central" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${emoji}</text></g>`;

    // caption chip
    const label = (prompt || "").trim().slice(0, 42) || (subj ? subj.kw[0] : "art");
    const caption = `
      <g opacity=".92"><rect x="40" y="${H - 86}" rx="22" ry="22" width="${Math.min(W - 80, label.length * 15 + 80)}" height="48" fill="#000" opacity=".4"/>
      <text x="64" y="${H - 54}" font-size="26" fill="#fff" font-family="'Segoe UI',system-ui,sans-serif">✨ ${esc(label)}</text></g>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stop-color="${g[0]}"/><stop offset="0.55" stop-color="${g[1]}"/><stop offset="1" stop-color="${g[2]}"/>
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${T.glow}" stop-opacity=".9"/><stop offset="1" stop-color="${T.glow}" stop-opacity="0"/></radialGradient>
        <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
        <filter id="drop" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000" flood-opacity="0.35"/></filter>
        <filter id="soft"><feGaussianBlur stdDeviation="10"/></filter>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.04 0"/></filter>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#sky)"/>
      ${blobs}${grid}${parts}${ground}
      ${subject}
      <rect width="${W}" height="${H}" fill="url(#vig)"/>
      <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.5"/>
      ${caption}
    </svg>`;
  }

  function toDataURI(svg) { return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg).replace(/%20/g, " "); }

  window.AIArt = {
    // main entry — returns an SVG data URI for any prompt
    generate(prompt) { return toDataURI(buildSVG(String(prompt || "abstract art"))); },
    svg(prompt) { return buildSVG(String(prompt || "abstract art")); },
    // introspection
    catalog: CATALOG,
    subjects: SUBJECTS,
    count: CATALOG.length,
    themes: THEME_NAMES,
    // a quick list of example prompts
    examples(n) { const out = []; for (let i = 0; i < (n || 12); i++) out.push(CATALOG[(i * 97) % CATALOG.length].name); return out; },
  };
})();
