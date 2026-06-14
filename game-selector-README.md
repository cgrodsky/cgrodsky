# Game Selector (Minecraft Bedrock Add-On)

A right-click **Game Selector** item (a renamed compass) that opens a menu of your
games (Bedwars, etc.) and shows each one's **Realm invite link**.

> **Important:** Bedrock add-ons **cannot auto-join a Realm** — no script/command can
> open a Realm or teleport you across to one. This item shows the link so you can join
> from the **Realms tab**. That's as close as Minecraft allows.

## Add your Realm links
Open `scripts/main.js` and edit the `GAMES` list near the top:

```js
const GAMES = [
    { name: "Bedwars",  link: "https://realms.gg/XXXXXXX" },
    { name: "Skywars",  link: "https://realms.gg/YYYYYYY" },
];
```

(The pack ships with placeholder links — replace them with your real ones.)

## Install & use
1. Open `game-selector.mcpack` → **Open in Minecraft**.
2. In your SMP world: **Behavior Packs → activate Game Selector**, **Cheats ON**,
   and turn on **Beta APIs** (needs Minecraft **1.21.80+**).
3. In chat run **`/games:get`** to get the Game Selector compass.
4. **Right-click** it → pick a game → its Realm link is shown. Open the **Realms tab**
   and tap the invite to join.
