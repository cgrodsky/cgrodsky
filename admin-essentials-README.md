# Admin Essentials (Minecraft Bedrock Add-On)

Admin command pack for **Minecraft Bedrock** (iPad, phone, Windows, console).

## Install
1. Download **`admin-essentials.mcpack`**.
2. Open the file → **Open in Minecraft** → "Imported successfully".

## Turn it on
1. Create/Edit a world → **Behavior Packs** → activate **Admin Essentials**.
2. Settings → turn **Cheats: ON**.
3. (If the `/admin:` commands don't show) Settings → turn on the **Beta APIs**
   experiment. Requires Minecraft **1.21.80+**.
4. Play the world.

## Commands
Type these in chat:

| Command | What it does |
|---|---|
| `/admin:sudo <player> <message>` | That player actually says the message. |
| `/admin:fakechat <player> <message>` | Chat looks like that player said it. |
| `/admin:announce <message>` | Broadcasts a message to everyone. |
| `/admin:heal <player>` | Fully heals and feeds the player. |
| `/admin:warn <player> [reason]` | Flashes a red WARNING + sound to the player. |
| `/admin:pvp <true\|false>` | Turns player-vs-player damage on or off. |
| `/function help` | Shows the command list in chat. |

> **PvP note:** Bedrock has no built-in PvP command, so `/admin:pvp false`
> works by undoing player-vs-player damage via script. Knockback may still
> show briefly, but health is restored.

`<player>` is a selector: `@a` all, `@r` random, `@p` nearest, `@s` you,
or `@a[name="Bob"]` for one player.

## Note on the Marketplace
This is a personal add-on shared as a `.mcpack`. It is **not** on the official
Minecraft Marketplace — Marketplace content must come from approved Microsoft
Marketplace Partners and pass a content-review process.
