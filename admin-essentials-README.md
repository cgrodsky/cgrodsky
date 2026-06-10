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
| `/a:debug` | Prints position, chunk, claim owner, PvP/break state, etc. |

## Land claims (everyone can use)
| Command | What it does |
|---|---|
| `/land:claim` | Claims the 16×16 chunk you're standing in. |
| `/land:unclaim` | Removes your claim on the current chunk. |
| `/land:info` | Shows who owns the current chunk. |

**Rules:** anyone can claim, **except** within **300 blocks of spawn**, or on a
chunk **another player already claimed**. Claimed chunks are protected from other
players breaking, placing, and opening blocks (chests, doors, buttons).

## Notes
- Commands need a `:` prefix — Bedrock requires custom commands to be namespaced
  (`/a:` for admin, `/land:` for claims). A bare `/sudo` isn't allowed in add-ons.
- `/a:pvp false` is a script workaround (undoes player-vs-player damage), since
  Bedrock has no native PvP toggle.
- Not on the Minecraft Marketplace — that's an approved-partner-only process.
  Share the `.mcpack` file directly.
