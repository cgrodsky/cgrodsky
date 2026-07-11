/* Static catalog data. Icons are rendered by the Icon system (assets/<id>.png or letter fallback). */
(function () {
  "use strict";

  // ---------- Microsoft Store ----------
  // 50+ apps across categories. `game` apps open the games engine; `builtin` open built-in apps.
  const storeApps = [
    // Games
    { id: "tictactoe", name: "Tic-Tac-Toe", cat: "Games", price: 0, game: "tictactoe", desc: "Classic 3x3 Tic-Tac-Toe versus the computer." },
    { id: "snake", name: "Snake", cat: "Games", price: 0, game: "snake", desc: "Eat, grow, don't bite yourself." },
    { id: "pong", name: "Pong", cat: "Games", price: 0, game: "pong", desc: "The original paddle classic." },
    { id: "memory", name: "Memory Match", cat: "Games", price: 0, game: "memory", desc: "Flip cards and find the pairs." },
    { id: "g2048", name: "2048", cat: "Games", price: 0, game: "g2048", desc: "Slide tiles to reach 2048." },
    { id: "minesweeper", name: "Minesweeper", cat: "Games", price: 0, game: "minesweeper", desc: "Clear the field without hitting a mine." },
    { id: "whack", name: "Whack-a-Mole", cat: "Games", price: 0, game: "whack", desc: "Bonk the moles before they hide." },
    { id: "rps", name: "Rock Paper Scissors", cat: "Games", price: 0, game: "rps", desc: "Best of luck against the CPU." },
    { id: "guess", name: "Guess the Number", cat: "Games", price: 0, game: "guess", desc: "Higher or lower? Find the number." },
    { id: "simon", name: "Simon Says", cat: "Games", price: 0, game: "simon", desc: "Repeat the growing color pattern." },
    { id: "breakout", name: "Breakout", cat: "Games", price: 0, game: "breakout", desc: "Smash every brick with the ball." },
    // Built-in apps
    { id: "calculator", name: "Calculator", cat: "Productivity", price: 0, builtin: "calculator", desc: "A realistic calculator with smooth animations." },
    { id: "mediaplayer", name: "Media Player", cat: "Multimedia", price: 0, builtin: "mediaplayer", desc: "Play video & audio files from your device." },
    { id: "browser", name: "Edge", cat: "Productivity", price: 0, builtin: "browser", desc: "Browse the web." },
    { id: "settings", name: "Settings", cat: "System", price: 0, builtin: "settings", desc: "Personalize your PC." },
    { id: "ms365", name: "Microsoft 365", cat: "Productivity", price: 0, builtin: "ms365", desc: "Word, Excel, PowerPoint & more — buy a bundle." },
    { id: "notepad", name: "Notepad", cat: "Productivity", price: 0, builtin: "notepad", desc: "Quick plain-text notes." },
    { id: "paint", name: "Paint", cat: "Multimedia", price: 0, builtin: "paint", desc: "Draw and doodle." },
    { id: "clock", name: "Clock", cat: "Productivity", price: 0, builtin: "clock", desc: "Stopwatch and the current time." },
    { id: "youtubeApp", name: "YouTube", cat: "Multimedia", price: 0, builtin: "youtube", desc: "Watch, like, subscribe and upload." },
    { id: "copilot", name: "Copilot", cat: "Productivity", price: 0, builtin: "copilot", desc: "Your AI assistant. Ask anything." },
    { id: "imagestudio", name: "Image Studio", cat: "Multimedia", price: 0, builtin: "imagestudio", desc: "Generate images from text with AI." },
    { id: "textgen", name: "AI Text", cat: "Productivity", price: 0, builtin: "textgen", desc: "Continue any text with phi-2." },
    { id: "fileexplorer", name: "File Explorer", cat: "System", price: 0, builtin: "fileexplorer", desc: "Browse and open files from your device." },
    { id: "files", name: "Files", cat: "System", price: 0, builtin: "files", desc: "Your file manager — folders, notes, and pictures saved in this browser." },
    { id: "messenger", name: "Messenger", cat: "Social", price: 0, builtin: "messenger", desc: "Windows Messenger — chat with tech personas who reply like real people." },
    { id: "chrome", name: "Chrome", cat: "Productivity", price: 0, builtin: "chrome", desc: "Google Chrome — browse the web." },
    { id: "vlc", name: "VLC media player", cat: "Multimedia", price: 0, builtin: "vlc", desc: "VLC — play almost any video or audio file from your device." },
    { id: "word", name: "Word", cat: "Productivity", price: 0, builtin: "word", desc: "Microsoft Word — write documents with a full formatting ribbon." },
    { id: "duolingo", name: "Duolingo", cat: "Lifestyle", price: 0, builtin: "duolingo", desc: "Learn a language for free — fun bite-sized lessons." },
    { id: "minecraft", name: "Mincraft", cat: "Games", price: 0, builtin: "minecraft", desc: "A 2D block-building sandbox. Mine, build, explore." },
    { id: "blockfinder", name: "Assets", cat: "System", price: 0, builtin: "blockfinder", desc: "Manage every uploaded asset — textures and sounds — each with a number." },
    { id: "codeeditor", name: "Code Editor", cat: "Developer", price: 0, builtin: "codeeditor", desc: "Edit HTML / CSS / JS with live preview and console." },
    { id: "achievements", name: "Achievements", cat: "System", price: 0, builtin: "achievements", desc: "Track milestones across Windows 12 apps." },
  ];

  // Decorative store listings to fill out the catalog (50+ total).
  const filler = [
    ["Spotfor", "Multimedia"], ["Photos", "Multimedia"], ["Weather", "Lifestyle"], ["Maps", "Lifestyle"],
    ["Mail", "Productivity"], ["Calendar", "Productivity"], ["To Do", "Productivity"], ["Camera", "Multimedia"],
    ["Voice Recorder", "Multimedia"], ["Movies & TV", "Multimedia"], ["News", "Lifestyle"], ["Sticky Notes", "Productivity"],
    ["File Explorer", "System"], ["Terminal", "Developer"], ["VS Codey", "Developer"], ["Phone Link", "System"],
    ["Xboxy", "Games"], ["Solitaire", "Games"], ["Mahjong", "Games"], ["Chess Titan", "Games"],
    ["Pinball", "Games"], ["Sudoku", "Games"], ["Skypey", "Social"], ["Teamz", "Social"],
    ["OneNote", "Productivity"], ["Translator", "Lifestyle"], ["Money", "Finance"],
    ["Health", "Lifestyle"], ["Fitness", "Lifestyle"], ["Drawboard", "Multimedia"], ["Code Writer", "Developer"],
    ["Audible", "Multimedia"], ["Comic Reader", "Lifestyle"], ["Sketch It", "Multimedia"], ["Quick PDF", "Productivity"],
  ];
  // Map decorative listings to real working built-in apps where it makes sense.
  // (File Explorer is now a top-level app above; the filler entry below is hidden.)
  const builtinMap = {
    "To Do": "todo", "Sticky Notes": "stickynotes", "Weather": "weather", "Calendar": "calendar",
    "News": "news", "Terminal": "terminal", "Mail": "mail", "Sudoku": "sudoku",
    "File Explorer": "__skip__", "Maps": "maps", "Photos": "photos", "Camera": "camera",
    "Movies & TV": "mediaplayer", "Audible": "mediaplayer", "Spotfor": "mediaplayer",
    "Drawboard": "paint", "Sketch It": "paint", "OneNote": "notepad", "Code Writer": "notepad",
    "VS Codey": "notepad", "Quick PDF": "notepad", "Comic Reader": "photos", "Voice Recorder": "recorder",
    "Money": "bank", "Translator": "translator",
  };
  filler.forEach((f, i) => {
    const builtin = builtinMap[f[0]];
    if (builtin === "__skip__") return;
    const app = { id: "app_" + i, name: f[0], cat: f[1], price: 0, desc: `${f[0]} — a ${f[1].toLowerCase()} app for Windows 12.` };
    if (builtin) app.builtin = builtin; else app.decorative = true;
    storeApps.push(app);
  });

  // ---------- Amazon ----------
  const amazonNames = [
    ["Wireless Headphones", 79.99], ["Mechanical Keyboard", 119.99], ["Gaming Mouse", 49.99], ["27\" Monitor", 229.99],
    ["USB-C Hub", 34.99], ["Webcam 1080p", 59.99], ["Bluetooth Speaker", 39.99], ["Laptop Stand", 27.99],
    ["Phone Charger", 14.99], ["Smart Watch", 199.99], ["Office Chair", 159.99], ["Desk Lamp", 22.99],
    ["Coffee Maker", 89.99], ["Air Fryer", 99.99], ["Blender", 44.99], ["Cookware Set", 129.99],
    ["Running Shoes", 74.99], ["Backpack", 49.99], ["Sunglasses", 24.99], ["Water Bottle", 19.99],
    ["Yoga Mat", 29.99], ["Dumbbell Set", 64.99], ["E-Reader", 139.99], ["Tablet", 329.99],
    ["Action Camera", 249.99], ["Drone", 399.99], ["Board Game", 34.99], ["LEGO Set", 79.99],
    ["Puzzle 1000pc", 16.99], ["Plush Toy", 12.99], ["Desk Plant", 18.99], ["Wall Clock", 21.99],
    ["Throw Blanket", 32.99], ["Scented Candle", 9.99], ["Bluetooth Earbuds", 89.99], ["Power Bank", 39.99],
    ["HDMI Cable", 11.99], ["Surge Protector", 24.99], ["Notebook 3-pack", 13.99], ["Gel Pens", 8.99],
    ["Standing Desk", 289.99], ["Microphone", 109.99], ["Ring Light", 29.99], ["Graphics Tablet", 69.99],
    ["SSD 1TB", 99.99], ["Wi-Fi Router", 119.99], ["Smart Bulb", 15.99], ["Robot Vacuum", 249.99],
    ["Electric Toothbrush", 49.99], ["Hair Dryer", 39.99],
  ];
  const amazonItems = amazonNames.map((n, i) => ({
    id: "amz_" + i, name: n[0], price: n[1],
    rating: (3.5 + (i % 15) / 10).toFixed(1),
    reviews: 100 + ((i * 137) % 9000),
    desc: `${n[0]} — top rated, ships in 2 days with Prime.`,
  }));

  // ---------- YouTube ----------
  const channelNames = [
    "Skeppy", "MrBeast", "YouTube", "Technoblade", "Preston", "PewDiePie",
    "Markiplier", "Dream", "Ninja", "DanTDM", "Jacksepticeye", "Sidemen",
    "KSI", "Logan Paul", "Mark Rober", "Veritasium", "Kurzgesagt", "Linus Tech Tips",
    "MKBHD", "Vsauce", "Tom Scott", "Dude Perfect", "Ryan Trahan", "Airrack",
    "Michael Reeves", "CodeBullet", "Fireship", "ThePrimeagen", "TheOdd1sOut",
    "Jaiden Animations", "Domics", "Game Theory", "Corridor Crew", "Smarter Every Day",
    "MrBeast Gaming", "BadBoyHalo", "GeorgeNotFound", "Sapnap", "TommyInnit",
    "Wilbur Soot", "Philza", "Tubbo", "Ranboo", "Quackity", "Karl Jacobs",
    "Aphmau", "SSundee", "LazarBeam", "Tommy", "Wisp",
  ];
  const videoTitles = [
    "I Survived 100 Days", "$1 vs $1,000,000 Setup", "How It's REALLY Made",
    "World's Largest Build", "I Tried This for 24 Hours", "You Won't Believe This",
    "Speedrun World Record", "Reacting to Old Videos", "The Truth About...",
    "Building the Ultimate Base", "Last to Leave Wins", "Extreme Challenge",
  ];
  const channels = channelNames.map((name, i) => ({
    id: "ch_" + i,
    name,
    subs: (Math.floor((Math.sin(i + 1) * 0.5 + 0.5) * 90) + 1) + "M",
    color: ["#ff0000", "#1da1f2", "#7289da", "#43b581", "#faa61a", "#9b59b6"][i % 6],
    videos: Array.from({ length: 6 }, (_, v) => ({
      id: `vid_${i}_${v}`,
      title: `${videoTitles[(i + v) % videoTitles.length]}`,
      views: (Math.floor((((i * 7 + v * 13) % 99) + 1))) + "M views",
      length: `${2 + ((i + v) % 18)}:${(10 + ((i * v) % 49)).toString().padStart(2, "0")}`,
    })),
  }));

  // ---------- Discord servers ----------
  const discordServers = [
    { id: "srv_hypixel", name: "Hypixel", color: "#ffce00", desc: "N/A", members: "210,400" },
    { id: "srv_minecraft", name: "Minecraft", color: "#5a8f3c", desc: "Join the official Minecraft server today!", members: "910,200" },
    { id: "srv_invaded", name: "Invaded Lands", color: "#c0392b", desc: "N/A", members: "88,120" },
    { id: "srv_foltyn", name: "Foltyn Family", color: "#9b59b6", desc: "N/A", members: "34,500" },
    { id: "srv_fortnite", name: "Fortnite Official", color: "#2f80ed",
      desc: "OFFICIAL FORTNITE\nThe Official Fortnite Discord Server! Join to follow news & updates, LFG, and chat about all things Fortnite!", members: "1,204,900" },
  ];

  // ---------- Bookmarks (the custom sites) ----------
  const bookmarks = [
    { label: "Bank", url: "bank.local" },
    { label: "Amazon", url: "amazon.local" },
    { label: "Microsoft", url: "microsoft.local" },
    { label: "YouTube", url: "youtube.local" },
    { label: "Discord", url: "discord.local" },
    { label: "Duolingo", url: "duolingo.local" },
    { label: "Netflix", url: "netflix.local" },
  ];

  window.Catalog = { storeApps, amazonItems, channels, discordServers, bookmarks };
})();
