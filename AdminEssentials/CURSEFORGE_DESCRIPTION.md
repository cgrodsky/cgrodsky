# Admin Essentials

A server-side admin command suite for Forge 1.20.1. Everything staff need to investigate, moderate, and operate a server, with no client install required.

**Investigation:** `/sudo` runs a command as another player. X-ray alerts notify ops when diamonds, deepslate diamonds, ancient debris, or emeralds are broken — one alert per vein, not per block. `/xray on` drops you into spectator to peer through walls; `/xray off` snaps you back to your prior gamemode and position. `/atp <player> stealth` teleports you in vanished + spectator for silent observation.

**Visibility:** `/vanish` hides you from non-ops; ops still see you with `[V]` before your name. `/morph <entity>` disguises you as any mob to non-ops; ops see you with `[M]`.

**Utility:** `/heal`, `/feed`, `/god`, `/fly`, `/speed`, `/sethome` + `/home`, `/setwarp` + `/warp`, `/back`, `/spawn`. `/spawnw <x1 y1 z1 x2 y2 z2>` locks a region so only ops can break or place blocks.

**Roles:** `/role <player> <role> [duration]` grants timed permissions, e.g. `/role helper Ben 5m`. Built on Forge's PermissionAPI for LuckPerms / FTB Ranks compatibility. MIT licensed.
