# Mini Toothbrush

A 73 × 10 × 8.7 mm mini toothbrush (keychain hole, grip dimples, 21 bristle tufts).
It prints flat on the bed with the tufts pointing up, so it needs no supports.

| File | What it is |
| --- | --- |
| `bambu_projects/Mini Toothbrush - <printer>.3mf` | Bambu Studio project per printer: printer, process and filament already set, plate already sliced |
| `mini_toothbrush.3mf` | Model: handle and bristles as two coloured parts of one object. PrusaSlicer settings are embedded. |
| `profiles/mini_toothbrush_prusaslicer.ini` | PrusaSlicer / SuperSlicer print profile |
| `profiles/bambu/<printer>/` | Bambu Studio presets per printer: a process preset and a PLA filament preset |
| `profiles/mini_toothbrush_orca_bambu_process.json` | Generic OrcaSlicer process preset (non-Bambu printers) |
| `profiles/mini_toothbrush_orca_bambu_filament.json` | Generic OrcaSlicer PLA filament preset |
| `images/` | Preview renders |
| `make_model.py`, `render.py` | Scripts that regenerate the model and images |

## Bambu Lab printers

Each folder in `profiles/bambu/` holds two presets that inherit the printer's
official Bambu Studio preset and change only what the toothbrush needs:

| Folder | Printer | Process based on | Filament based on |
| --- | --- | --- | --- |
| `A1` | A1 | 0.12mm Fine @BBL A1 | Bambu PLA Basic @BBL A1 |
| `A1_mini` | A1 mini | 0.12mm Fine @BBL A1M | Bambu PLA Basic @BBL A1M |
| `P1S` | P1S | 0.12mm Fine @BBL X1C | Bambu PLA Basic @BBL P1S 0.4 nozzle |
| `P2S` | P2S | 0.12mm High Quality @BBL P2S | Bambu PLA Basic @BBL P2S |
| `H2S` | H2S | 0.12mm High Quality @BBL H2S | Bambu PLA Basic @BBL H2S |
| `H2C` | H2C | 0.12mm High Quality @BBL H2C | Bambu PLA Basic @BBL H2C |
| `X1C` | X1 Carbon | 0.12mm Fine @BBL X1C | Bambu PLA Basic @BBL X1C |
| `X2D` | X2D | 0.12mm High Quality @BBL X2D | Bambu PLA Basic @BBL X2D 0.4 nozzle |

All presets are for the stock 0.4 mm nozzle. The A1 and A1 mini use slower
walls (30 mm/s outer) than the enclosed core-XY printers (40 mm/s outer),
because the bed moves the thin tufts back and forth.

The quickest route is the ready-made project in `bambu_projects/`: open the one
for your printer in Bambu Studio and press Print. Each was written and sliced by
Bambu Studio 2.8.2 (about 20 minutes and 2.3 g of PLA). `profiles/bambu/build_projects.py`
rebuilds them with the Bambu Studio command line.

To use the presets with your own project instead:

1. Select your printer (0.4 nozzle).
2. **File → Import → Import Configs…** and pick both `.json` files in your printer's folder.
3. Open `mini_toothbrush.3mf`, choose the "Mini Toothbrush 0.12mm @ …" process
   and the "Mini Toothbrush PLA @ …" filament, then slice.
4. On enclosed printers, open the door or lift the lid for PLA so the tufts cool well.

`profiles/bambu/generate.py` rebuilds the presets from a BambuStudio source
checkout and checks every setting name against Bambu Studio's option table.

## Print settings at a glance

- PLA, 0.4 mm nozzle, 0.12 mm layers (0.2 mm first layer)
- 3 walls, 25 % gyroid infill, 6 top / 4 bottom layers
- Slow outer walls (20 mm/s) and small perimeters (15 mm/s) for the 1.6 mm tufts
- Fan 100 %, minimum layer time 12 s so the tufts cool between layers
- 3 mm outer brim, no supports
- Optional two-tone: add a colour change at Z = 2.76 mm (top of the head) for white or blue bristles

The tufts are solid plastic, so this is a novelty or display piece, not a working toothbrush.

## Regenerating

```sh
pip install numpy manifold3d pillow
python3 make_model.py   # writes the 3MF and mesh_cache.npz
python3 render.py       # writes images/
python3 make_model.py   # re-run to embed the new thumbnail
```
