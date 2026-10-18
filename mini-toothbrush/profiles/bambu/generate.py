"""Generate Bambu Studio user presets for the mini toothbrush, one set per printer.

Each preset inherits the printer's official system preset and overrides only
what the toothbrush needs. Pass the path to a BambuStudio source checkout; every setting is checked
against its option table and list-valued settings get the right number of
entries per printer:

    python3 generate.py /path/to/BambuStudio
"""
import json
import re
import sys
from pathlib import Path

OUT = Path(__file__).parent

# folder name -> (printer preset, system process preset, system filament preset, bed-slinger?)
PRINTERS = {
    "A1":      ("Bambu Lab A1 0.4 nozzle",         "0.12mm Fine @BBL A1",          "Bambu PLA Basic @BBL A1",               True),
    "A1_mini": ("Bambu Lab A1 mini 0.4 nozzle",    "0.12mm Fine @BBL A1M",         "Bambu PLA Basic @BBL A1M",              True),
    "P1S":     ("Bambu Lab P1S 0.4 nozzle",        "0.12mm Fine @BBL X1C",         "Bambu PLA Basic @BBL P1S 0.4 nozzle",   False),
    "P2S":     ("Bambu Lab P2S 0.4 nozzle",        "0.12mm High Quality @BBL P2S", "Bambu PLA Basic @BBL P2S",              False),
    "H2S":     ("Bambu Lab H2S 0.4 nozzle",        "0.12mm High Quality @BBL H2S", "Bambu PLA Basic @BBL H2S",              False),
    "H2C":     ("Bambu Lab H2C 0.4 nozzle",        "0.12mm High Quality @BBL H2C", "Bambu PLA Basic @BBL H2C",              False),
    "X1C":     ("Bambu Lab X1 Carbon 0.4 nozzle",  "0.12mm Fine @BBL X1C",         "Bambu PLA Basic @BBL X1C",              False),
    "X2D":     ("Bambu Lab X2D 0.4 nozzle",        "0.12mm High Quality @BBL X2D", "Bambu PLA Basic @BBL X2D 0.4 nozzle",   False),
}


def process_overrides(bed_slinger):
    # Bed slingers (A1 series) move the part in Y, so the thin tufts get gentler walls.
    outer, inner = ("30", "60") if bed_slinger else ("40", "80")
    return {
        "layer_height": "0.12",
        "initial_layer_print_height": "0.2",
        "wall_loops": "3",
        "top_shell_layers": "6",
        "bottom_shell_layers": "4",
        "sparse_infill_density": "25%",
        "sparse_infill_pattern": "gyroid",
        "top_surface_pattern": "monotonic",
        "bottom_surface_pattern": "monotonic",
        "detect_thin_wall": "1",
        "seam_position": "back",
        "reduce_crossing_wall": "1",
        "outer_wall_speed": outer,
        "inner_wall_speed": inner,
        "small_perimeter_speed": "40%",
        "small_perimeter_threshold": "2",
        "top_surface_speed": "60",
        "gap_infill_speed": "40",
        "initial_layer_speed": "30",
        "enable_support": "0",
        "brim_type": "outer_only",
        "brim_width": "3",
    }


FILAMENT_OVERRIDES = {
    "nozzle_temperature": "210",
    "nozzle_temperature_initial_layer": "215",
    "fan_min_speed": "100",
    "fan_max_speed": "100",
    "close_fan_the_first_x_layers": "1",
    "slow_down_layer_time": "12",
    "slow_down_min_speed": "10",
    "filament_retraction_length": "0.8",
    "filament_z_hop": "0.2",
}


def load_index(root):
    idx = {}
    for kind in ("process", "filament", "machine"):
        for p in (root / kind).rglob("*.json"):
            try:
                d = json.loads(p.read_text())
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            if "name" in d:
                idx[(kind, d["name"])] = d
    return idx


def resolve(idx, kind, name):
    d = idx[(kind, name)]
    parent = resolve(idx, kind, d["inherits"]) if d.get("inherits") else {}
    return {**parent, **d}


def option_types(repo):
    src = (repo / "src/libslic3r/PrintConfig.cpp").read_text()
    types = dict(re.findall(r'this->add\("(\w+)",\s*(co\w+)\)', src))
    # Filament presets override retraction as "filament_<option>" (see
    # PrintConfigDef::init_filament_option_keys).
    for k in ("retraction_length", "z_hop"):
        types["filament_" + k] = types[k]
    return types


def shape_like(base, value, key, types):
    if key not in types:
        raise KeyError(f"{key!r} is not a Bambu Studio setting")
    if key in base:
        is_list = isinstance(base[key], list)
        n = len(base[key]) if is_list else 0
    else:
        # Not set anywhere in the preset chain: use the option's own type.
        is_list = types[key].endswith("s") and types[key] != "coString"
        variants = base.get("print_extruder_variant") or base.get("filament_extruder_variant") or [""]
        n = len(variants)
    return [value] * n if is_list else value


def main(repo):
    repo = Path(repo)
    idx = load_index(repo / "resources/profiles/BBL")
    types = option_types(repo)
    version = json.loads((repo / "resources/profiles/BBL.json").read_text())["version"]
    for folder, (printer, process, filament, slinger) in PRINTERS.items():
        pbase = resolve(idx, "process", process)
        fbase = resolve(idx, "filament", filament)
        short = folder.replace("_", " ")
        pname = f"Mini Toothbrush 0.12mm @ {short}"
        fname = f"Mini Toothbrush PLA @ {short}"
        proc = {"type": "process", "name": pname, "inherits": process, "from": "User",
                "print_settings_id": pname, "version": version,
                "compatible_printers": [printer]}
        proc.update({k: shape_like(pbase, v, k, types)
                     for k, v in process_overrides(slinger).items()})
        fil = {"type": "filament", "name": fname, "inherits": filament, "from": "User",
               "filament_settings_id": [fname], "version": version,
               "compatible_printers": [printer]}
        fil.update({k: shape_like(fbase, v, k, types) for k, v in FILAMENT_OVERRIDES.items()})
        d = OUT / folder
        d.mkdir(exist_ok=True)
        (d / f"{pname}.json").write_text(json.dumps(proc, indent=4) + "\n")
        (d / f"{fname}.json").write_text(json.dumps(fil, indent=4) + "\n")
        print(f"{folder:8s} process <- {process} | filament <- {filament}")


if __name__ == "__main__":
    main(sys.argv[1])
