# Admin Essentials (Minecraft Bedrock Add-On)

Admin commands + a land-claim system for **Minecraft Bedrock** (iPad, phone, Windows, console).

## Install
1. Download **`admin-essentials.mcpack`**.
2. Open the file → **Open in Minecraft** → "Imported successfully".

## Turn it on
1. Create/Edit a world → **Behavior Packs** → activate **Admin Essentials**.
2. Settings → **Cheats: ON**.
3. (If the commands don't show) Settings → turn on the **Beta APIs** experiment.
   Requires Minecraft **1.21.80+**.

## Admin commands (operators)
| Command | What it does |
|---|---|
| `/a:sudo <player> <message>` | That player actually says the message. |
| `/a:fakechat <player> <message>` | Chat looks like that player said it. |
| `/a:announce <message>` | Broadcasts a message to everyone. |
| `/a:heal <player>` | Fully heals and feeds the player. |
| `/a:warn <player> [reason]` | Flashes a red WARNING + sound to the player. |
| `/a:pvp <true\|false>` | Turns player-vs-player damage on or off. |
| `/a:vanish <player> <true\|false>` | Makes a player invisible, or visible again. |
| `/a:breakblock <true\|false>` | Allows or prevents breaking blocks (whole world). |
| `/a:setmoney <player> <amount>` | Sets a player's money balance. |
| `/a:insee <player>` | Opens a menu of that player's inventory — take items, or put your held item in. |
| `/a:bypassclaim` | Toggle: lets you ignore land-claim protection. |
| `/a:claimlimit <amount>` | Sets how many chunks each player may claim (default 10). |
| `/a:debug` | Prints money, position, chunk, claim owner, PvP/break state, etc. |

## Land claims (everyone can use)
| Command | What it does |
|---|---|
| `/land:claim` | Claims the 16×16 chunk you're standing in. |
| `/land:unclaim` | Removes your claim on the current chunk. |
| `/land:info` | Shows who owns the current chunk. |
| `/land:list` | Lists all the chunks you own. |

**Rules:** anyone can claim, **except** within **300 blocks of spawn**, or on a
chunk **another player already claimed**. Each player can claim up to **10 chunks**
(change with `/a:claimlimit`). Claimed chunks are protected from other players
breaking, placing, and opening blocks (chests, doors, buttons).

## Money (everyone can use)
| Command | What it does |
|---|---|
| `/money:bal` | Shows your balance. |
| `/money:pay <player> <amount>` | Pays another player from your balance. |
| `/money:top` | Leaderboard of the richest players. |
| `/money:shop` | Opens the item shop to spend money. |
| `/money:sell` | Sells the item you're holding (half its shop price). |

- Everyone starts with **$1000**.
- **Daily login bonus:** +$250 the first time you join each 24 hours.
- You earn money by completing in-game **achievements** (one-time each), paid by
  rarity: common $50, uncommon $150, rare $300, epic $600, legendary $1500.

### Achievements (the ones a script can actually detect)
- **Mining:** Getting Wood (log), Chestful of Cobblestone (1,728 cobblestone),
  Emerald!, Diamonds!, Hidden in the Depths (ancient debris).
- **Building:** It's a Sign!, Pot Planter, Benchmarking (crafting table),
  Hot Topic (furnace), The Lie (place a cake).
- **Food:** Pork Chop, Rabbit Season, Iron Belly (rotten flesh), Delicious Fish,
  Bake Bread.
- **Exploring:** Into the Fire (Nether), The End? (End).
- **Combat:** Monster Hunter, Archer (creeper w/ arrow), Overkill (9 hearts in one
  hit), Ocean Conqueror (elder guardian), Withered (wither), Feeling Ill (evoker),
  Kill the Beast! (ravager), Sculk Slayer (warden), Dragon Slayer (ender dragon),
  It Spreads (kill near a sculk catalyst), Bullseye (target block).
- **Gear:** Iron Man (full iron armor), Have a Shearful Day (shear a sheep).

## Daily Ender Dragon
Every **24 real hours**, a fresh Ender Dragon is summoned in the End and a
message is announced to everyone.

## Notes
- Commands need a `:` prefix — Bedrock requires custom commands to be namespaced
  (`/a:` admin, `/land:` claims, `/money:` money). A bare `/sudo` isn't allowed in add-ons.
- Real Xbox achievements can't be read by scripts, so the money rewards trigger
  on detectable in-game milestones instead. Achievements with no script event
  (taming/breeding animals, crafting tools, smelting, opening inventory, diving
  timers, structure discovery, naming items, etc.) are not included.
- `/a:insee` is a menu, not a live drag-and-drop inventory window (Bedrock
  add-ons can't open another player's real inventory GUI).
- `/a:pvp false` is a script workaround (undoes player-vs-player damage), since
  Bedrock has no native PvP toggle.
- Not on the Minecraft Marketplace — that's an approved-partner-only process.
  Share the `.mcpack` file directly.
