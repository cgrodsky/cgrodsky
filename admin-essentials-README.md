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
| `/a:debug` | Prints money, position, chunk, claim owner, PvP/break state, etc. |

## Land claims (everyone can use)
| Command | What it does |
|---|---|
| `/land:claim` | Claims the 16×16 chunk you're standing in. |
| `/land:unclaim` | Removes your claim on the current chunk. |
| `/land:info` | Shows who owns the current chunk. |
| `/land:list` | Lists all the chunks you own. |

**Rules:** anyone can claim, **except** within **300 blocks of spawn**, or on a
chunk **another player already claimed**. Claimed chunks are protected from other
players breaking, placing, and opening blocks (chests, doors, buttons).

## Money (everyone can use)
| Command | What it does |
|---|---|
| `/money:bal` | Shows your balance. |
| `/money:pay <player> <amount>` | Pays another player from your balance. |
| `/money:top` | Leaderboard of the richest players. |

- Everyone starts with **$1000**.
- You earn money by completing in-game **achievements**, paid by rarity:
  common $50, uncommon $150, rare $300, epic $600, legendary $1500.
- Built-in achievements: mine emerald (uncommon), mine diamonds (rare),
  mine ancient debris (epic), enter the Nether (uncommon), enter the End (rare),
  kill the Elder Guardian (rare), kill the Wither (epic),
  kill the Warden (legendary), kill the Ender Dragon (legendary).

## Daily Ender Dragon
Every **24 real hours**, a fresh Ender Dragon is summoned in the End and a
message is announced to everyone.

## Notes
- Commands need a `:` prefix — Bedrock requires custom commands to be namespaced
  (`/a:` admin, `/land:` claims, `/money:` money). A bare `/sudo` isn't allowed in add-ons.
- Real Xbox achievements can't be read by scripts, so the money rewards trigger
  on detectable in-game milestones instead.
- `/a:pvp false` is a script workaround (undoes player-vs-player damage), since
  Bedrock has no native PvP toggle.
- Not on the Minecraft Marketplace — that's an approved-partner-only process.
  Share the `.mcpack` file directly.
