#!/usr/bin/env python3
"""Compile Sherpa CSV + localization into compact game.json for the builder."""
from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path("/Users/zhihu/Downloads/nba2k27_apk_unpack")
CSV_PATH = ROOT / "unity_extract/csv/CareerMode_Progression_Attributes.csv"
PB_TSV = ROOT / "unity_extract/playerbuilder_strings.tsv"
OUT = ROOT / "builder-web/data/game.json"

ATTRS = [
    ("ShotClose", "Shot_Close", "FINISHING"),
    ("DrivingLayup", "Driving_Layup", "FINISHING"),
    ("DrivingDunk", "Driving_Dunk", "FINISHING"),
    ("StandingDunk", "Standing_Dunk", "FINISHING"),
    ("PostControl", "Post_Control", "FINISHING"),
    ("ShotMidrange", "Mid_Range_Shot", "SHOOTING"),
    ("ShotThree", "Three_Point_Shot", "SHOOTING"),
    ("ShotFreeThrow", "Free_Throw", "SHOOTING"),
    ("PassAccuracy", "Pass_Accuracy", "PLAYMAKING"),
    ("BallControl", "Ball_Handle", "PLAYMAKING"),
    ("SpeedWithBall", "Speed_With_Ball", "PLAYMAKING"),
    ("InteriorDefense", "Interior_Defense", "DEFENSE"),
    ("PerimeterDefense", "Perimeter_Defense", "DEFENSE"),
    ("Steal", "Steal", "DEFENSE"),
    ("Block", "Block", "DEFENSE"),
    ("ReboundOffense", "Offensive_Rebound", "REBOUNDING"),
    ("ReboundDefense", "Defensive_Rebound", "REBOUNDING"),
    ("Speed", "Speed", "PHYSICALS"),
    ("Agility", "Agility", "PHYSICALS"),
    ("Strength", "Strength", "PHYSICALS"),
    ("Vertical", "Vertical", "PHYSICALS"),
]
ATTR_IDS = [a[0] for a in ATTRS]
POS = ["POINT_GUARD", "SHOOTING_GUARD", "SMALL_FORWARD", "POWER_FORWARD", "CENTER"]
POS_SHORT = {"POINT_GUARD": "PG", "SHOOTING_GUARD": "SG", "SMALL_FORWARD": "SF",
             "POWER_FORWARD": "PF", "CENTER": "C"}

BADGE_ATTR = {
    "AerialWizard": ["DrivingDunk", "StandingDunk", "Vertical"],
    "AnkleAssassin": ["BallControl"],
    "BailOut": ["PassAccuracy"],
    "BreakStarter": ["PassAccuracy", "ReboundDefense"],
    "BrickWall": ["Strength"],
    "Challenger": ["PerimeterDefense"],
    "Deadeye": ["ShotThree", "ShotMidrange"],
    "Dimer": ["PassAccuracy"],
    "FloatGame": ["DrivingLayup", "ShotClose"],
    "Glove": ["Steal"],
    "HandlesForDays": ["BallControl"],
    "HighFlyingDenier": ["Block", "Vertical"],
    "HookSpecialist": ["PostControl", "ShotClose"],
    "ImmovableEnforcer": ["Strength", "InteriorDefense"],
    "Interceptor": ["Steal"],
    "LayupMixmaster": ["DrivingLayup"],
    "LightningLaunch": ["Speed", "SpeedWithBall"],
    "LimitlessRange": ["ShotThree"],
    "MiniMarksman": ["ShotThree", "ShotMidrange"],
    "OffBallPest": ["PerimeterDefense", "Agility"],
    "PaintPatroller": ["InteriorDefense", "Block"],
    "PaintProdigy": ["ShotClose", "PostControl"],
    "PhysicalFinisher": ["DrivingLayup", "Strength"],
    "PickDodger": ["Agility", "PerimeterDefense"],
    "Pogostick": ["Vertical"],
    "Posterizer": ["DrivingDunk"],
    "PostFadePhenom": ["PostControl", "ShotMidrange"],
    "PostLockdown": ["InteriorDefense", "Strength"],
    "PostPowerhouse": ["PostControl", "Strength"],
    "PostSpinCatalyst": ["PostControl"],
    "RiseUp": ["StandingDunk", "Strength"],
    "SlipperyOffball": ["Speed", "Agility"],
    "StrongHandle": ["BallControl", "Strength"],
    "Unpluckable": ["BallControl"],
    "VersatileVisionary": ["PassAccuracy"],
    "SetShotSpecialist": ["ShotThree", "ShotMidrange"],
    "ShiftyShooter": ["ShotThree", "BallControl"],
    "ReboundChaser": ["ReboundOffense", "ReboundDefense", "Vertical"],
    "BoxoutBeast": ["ReboundDefense", "Strength"],
    "OnBallMenace": ["PerimeterDefense", "Steal"],
    "SetAndFire": ["ShotThree", "ShotMidrange"],
    "StaticMiddy": ["ShotMidrange"],
    "QuickTrigger": ["ShotThree", "ShotMidrange"],
    "Crasher": ["ReboundOffense", "Strength"],
    "BoxoutBoss": ["ReboundDefense", "Strength"],
    "WallUp": ["InteriorDefense", "Block"],
    "SmoothOperator": ["BallControl", "DrivingLayup"],
    "GhostStepper": ["BallControl", "Speed"],
    "Pace": ["Speed", "Agility"],
    "Flash": ["Speed"],
    "ArcCadence": ["ShotThree"],
    "AnkleBraces": ["Strength", "PerimeterDefense"],
    "Breaker": ["BallControl", "SpeedWithBall"],
    "PostUpPoet": ["PostControl"],
    "WorkHorse": ["Stamina"] if False else ["Strength", "Stamina"],
}

CV_BADGES = {
    "FloatGame", "Posterizer", "RiseUp", "AerialWizard", "HookSpecialist",
    "PostFadePhenom", "Deadeye", "LimitlessRange", "SlipperyOffball", "BailOut",
    "BreakStarter", "Dimer", "HandlesForDays", "Unpluckable", "PostLockdown",
    "Challenger", "OffBallPest", "PickDodger", "Glove", "Interceptor",
    "Pogostick", "BrickWall", "ImmovableEnforcer", "LayupMixmaster",
    "PaintProdigy", "PhysicalFinisher", "PostPowerhouse", "MiniMarksman",
    "VersatileVisionary", "AnkleAssassin", "LightningLaunch", "StrongHandle",
    "HighFlyingDenier", "PaintPatroller", "GhostStepper", "PostSpinCatalyst",
    "SetAndFire", "ArcCadence", "StaticMiddy", "SmoothOperator", "QuickTrigger",
    "Pace", "WallUp", "Seatbelt", "AnkleBraces", "Crasher", "PossessionCloser",
    "SyncSnatcher", "BoxoutBoss", "Breaker", "Flash", "WorkHorse", "Bruiser",
}

SKIP_BADGES = {
    "AlphaDog", "Enforcer", "BigEgo", "SmallEgo", "Expressive", "LaidBack",
    "Unpredictable", "WorkEthic", "HighFriendliness", "LowFriendliness",
    "Marketability", "NegativelyMotivated", "PositivelyMotivated",
    "BigMarketPlayer", "FairWeatherPlayer", "TaxAvoiderPlayer",
}

TAKEOVER_CV_KEY = {
    "Inside_Touch": "INSIDE_TOUCH",
    "Detonator": "DETONATOR",
    "Airspace": "AIRSPACE",
    "Shot_Artist": "SHOT_ARTIST",
    "Calibrated": "CALIBRATED",
    "Zip_Code": "ZIP_CODE",
    "Cook": "COOK",
    "Hawk": "HAWK",
    "Second_Chance": "SECOND_CHANCE",
    "Dishmaster": "DISHMASTER",
    "Glue": "GLUE",
    "Blur": "BLUR",
    "Paint_Surgeon": "PAINT_SURGEON",
    "Demolition": "DEMOLITION",
    "Muscle": "MUSCLE",
    "Navigator": "NAVIGATOR",
    "Rim_Guardian": "RIM_GUARDIAN",
    "See_The_Future": "SEE_THE_FUTURE",
}

TAKEOVER_IDS = [
    "Poster_Machine", "Dishmaster", "Glue", "Blur", "Paint_Surgeon", "Crasher",
    "Deep_Bomber", "Lethal_Layup", "Rim_Guardian", "Sharpshooter", "Hydration_Hero",
    "Inside_Touch", "Detonator", "Airspace", "Shot_Artist", "Calibrated", "Zip_Code",
    "Cook", "Hawk", "Second_Chance", "Demolition", "Muscle", "Navigator", "See_The_Future",
]


def parse_csv_map(text: str) -> dict[str, str]:
    out = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("//") or line.startswith("DataPath"):
            continue
        if "," not in line:
            continue
        k, v = line.split(",", 1)
        out[k.strip()] = v.strip()
    return out


def num(v: str):
    try:
        if "." in v:
            f = float(v)
            return int(f) if f.is_integer() else f
        return int(v)
    except ValueError:
        return v


def height_key(inches: int) -> str:
    return f"HEIGHT_{max(0, min(30, inches - 64)):02d}"


def load_pb_strings():
    rows = list(csv.DictReader(open(PB_TSV, encoding="utf-8"), delimiter="\t"))
    by_key = {r["key"]: r for r in rows}
    return by_key


def loc(by_key, key, fallback=""):
    r = by_key.get(key) or {}
    return {"en": r.get("en") or fallback, "zh": r.get("zh") or r.get("en") or fallback}


def main():
    raw = CSV_PATH.read_text(encoding="utf-8", errors="replace")
    kv = parse_csv_map(raw)
    pb = load_pb_strings()

    attributes = []
    for aid, loc_key, cat in ATTRS:
        L = loc(pb, loc_key, aid)
        attributes.append({"id": aid, "cat": cat, "en": L["en"], "zh": L["zh"]})

    positions = {}
    for p in POS:
        positions[POS_SHORT[p]] = {
            "id": p,
            "short": POS_SHORT[p],
            "defaultHeight": int(float(kv[f"PlayerRestrictions[NBA].DefaultHeightInInches[{p}]"])),
            "minHeight": int(float(kv[f"PlayerRestrictions[NBA].MinMaxHeightInInches[{p}][0]"])),
            "maxHeight": int(float(kv[f"PlayerRestrictions[NBA].MinMaxHeightInInches[{p}][1]"])),
            "minWeight": int(float(kv[f"PlayerRestrictions[NBA].MinWeight[{p}]"])),
            "maxWeight": int(float(kv[f"PlayerRestrictions[NBA].MaxWeight[{p}]"])),
        }

    height_mult = {}
    for k, v in kv.items():
        m = re.match(r"PlayerRestrictions\[NBA\]\.HeightMultiplier\[(HEIGHT_\d+)\]\[(\w+)\]$", k)
        if not m:
            continue
        hk, attr = m.group(1), m.group(2)
        inches = 64 + int(hk.split("_")[1])
        height_mult.setdefault(str(inches), {})[attr] = float(v)

    weight_table = []
    wingspan_table = []
    rows = defaultdict(dict)
    for k, v in kv.items():
        m = re.match(r"PlayerRestrictions\[NBA\]\.WeightMultiplier\[(\d+)\]\.(.+)$", k)
        if not m:
            continue
        i, rest = int(m.group(1)), m.group(2)
        if rest in ("HeightInInches", "Weight"):
            rows[i][rest] = float(v)
        else:
            mm = re.match(r"Multiplier\[(\w+)\]$", rest)
            if mm:
                rows[i].setdefault("m", {})[mm.group(1)] = float(v)
    for i in sorted(rows):
        r = rows[i]
        if r.get("HeightInInches", 0) == 0:
            continue
        weight_table.append({
            "h": int(r["HeightInInches"]),
            "w": int(r["Weight"]),
            "m": {a: r.get("m", {}).get(a, 1.0) for a in ATTR_IDS},
        })

    rows = defaultdict(dict)
    for k, v in kv.items():
        m = re.match(r"PlayerRestrictions\[NBA\]\.WingspanMultiplier\[(\d+)\]\.(.+)$", k)
        if not m:
            continue
        i, rest = int(m.group(1)), m.group(2)
        if rest in ("HeightInInches", "WingspanInInches"):
            rows[i][rest] = float(v)
        else:
            mm = re.match(r"Multiplier\[(\w+)\]$", rest)
            if mm:
                rows[i].setdefault("m", {})[mm.group(1)] = float(v)
    for i in sorted(rows):
        r = rows[i]
        if r.get("HeightInInches", 0) == 0:
            continue
        wingspan_table.append({
            "h": int(r["HeightInInches"]),
            "s": int(r["WingspanInInches"]),
            "m": {a: r.get("m", {}).get(a, 1.0) for a in ATTR_IDS},
        })

    constraints = defaultdict(lambda: defaultdict(list))
    for k, v in kv.items():
        m = re.match(
            r"AssociatedAttributeConstraints\[(\w+)\]\[(HEIGHT_\d+)\]\[(\d+)\]\.(AssociatedAttribute|MaxDelta)$",
            k,
        )
        if not m:
            continue
        attr, hk, idx, field = m.group(1), m.group(2), int(m.group(3)), m.group(4)
        inches = str(64 + int(hk.split("_")[1]))
        slot = constraints[attr][inches]
        while len(slot) <= idx:
            slot.append({})
        slot[idx][field] = v if field == "AssociatedAttribute" else num(v)
    constraints_out = {}
    for attr, by_h in constraints.items():
        constraints_out[attr] = {}
        for h, lst in by_h.items():
            cleaned = []
            for item in lst:
                a = item.get("AssociatedAttribute")
                d = item.get("MaxDelta")
                if a and d is not None:
                    cleaned.append({"attr": a, "delta": d})
            if cleaned:
                constraints_out[attr][h] = cleaned

    grades = defaultdict(lambda: defaultdict(dict))
    for k, v in kv.items():
        m = re.match(r"AttributeGradeMinValueRequired\[(\w+)\]\[(\w+)\]\[(\w+)\]$", k)
        if not m:
            continue
        pos, attr, grade = m.group(1), m.group(2), m.group(3)
        if pos not in POS_SHORT:
            continue
        grades[POS_SHORT[pos]][attr][grade] = int(float(v))

    importance = defaultdict(dict)
    for k, v in kv.items():
        m = re.match(r"AttributeImportance\[(\w+)\]\[(\w+)\]$", k)
        if not m:
            continue
        pos, attr = m.group(1), m.group(2)
        if pos in POS_SHORT:
            importance[POS_SHORT[pos]][attr] = v

    initial = {}
    for k, v in kv.items():
        m = re.match(r"AttributePreset\[INITIAL\]\.Value\[(\w+)\]$", k)
        if m:
            initial[m.group(1)] = int(float(v))
    for a in ATTR_IDS:
        initial.setdefault(a, 25)

    req_path = OUT.parent / "badge-reqs.json"
    req_pack = json.loads(req_path.read_text())
    badge_reqs = req_pack["badges"]
    badge_heights = req_pack["heights"]
    take_reqs = req_pack["takeovers"]

    badges = []
    badge_fields = defaultdict(dict)
    for key, row in pb.items():
        if not key.startswith("Badge_"):
            continue
        rest = key[6:]
        for suf in ("Name", "ShortDescription", "Description", "Abbreviation"):
            if rest.endswith("_" + suf):
                bid = rest[: -(len(suf) + 1)]
                badge_fields[bid][suf] = row
                break
    for bid in sorted(CV_BADGES):
        if bid in SKIP_BADGES:
            continue
        fields = badge_fields.get(bid, {})
        name = fields.get("Name") or {}
        short = fields.get("ShortDescription") or {}
        desc = fields.get("Description") or {}
        abbr = fields.get("Abbreviation") or {}
        reqs = badge_reqs.get(bid) or {}
        attrs = []
        for lv in reqs.values():
            for item in lv:
                if item["a"] in ATTR_IDS and item["a"] not in attrs:
                    attrs.append(item["a"])
        if not attrs:
            attrs = [a for a in BADGE_ATTR.get(bid, []) if a in ATTR_IDS]
        ht = badge_heights.get(bid) or {"minHeight": 69, "maxHeight": 88}
        badges.append({
            "id": bid,
            "en": name.get("en") or bid,
            "zh": name.get("zh") or name.get("en") or bid,
            "abbr": (abbr.get("en") or "")[:4],
            "short_en": short.get("en") or "",
            "short_zh": short.get("zh") or short.get("en") or "",
            "desc_en": desc.get("en") or "",
            "desc_zh": desc.get("zh") or desc.get("en") or "",
            "attrs": attrs,
            "reqs": reqs,
            "minHeight": ht["minHeight"],
            "maxHeight": ht["maxHeight"],
        })
    badges.sort(key=lambda b: b["zh"])

    takeovers = []
    for tid in TAKEOVER_IDS:
        name = loc(pb, f"Takeovers_Screen_Ability_{tid}", tid.replace("_", " "))
        # takeover names live in takeover table, not playerbuilder tsv
        takeovers.append({"id": tid, "en": name["en"], "zh": name["zh"]})

    # load takeover zh/en from json tables
    mono = ROOT / "unity_extract/mono"
    take_en = json.loads((mono / "Sherpa_PlayerBuilder_Takeovers_Screen_en_-1872782573197440365.json").read_text())
    take_zh = json.loads((mono / "Sherpa_PlayerBuilder_Takeovers_Screen_zh-Hans_-2470364087456887753.json").read_text())
    take_shared = json.loads((mono / "Sherpa_PlayerBuilder_Takeovers_Screen_Shared_Data_-4562495629380318269.json").read_text())
    id2key = {e["m_Id"]: e["m_Key"] for e in take_shared["m_Entries"]}
    enm = {e["m_Id"]: e.get("m_Localized", "") for e in take_en["m_TableData"]}
    zhm = {e["m_Id"]: e.get("m_Localized", "") for e in take_zh["m_TableData"]}
    key_loc = {}
    for i, k in id2key.items():
        key_loc[k] = {"en" : enm.get(i, ""), "zh": zhm.get(i, "")}

    takeovers = []
    for tid in TAKEOVER_IDS:
        nk = f"Takeovers_Screen_Ability_{tid}"
        dk = f"Takeovers_Screen_Ability_{tid}_Description"
        n = key_loc.get(nk, {"en": tid.replace("_", " "), "zh": tid})
        d = key_loc.get(dk, {"en": "", "zh": ""})
        cv_key = TAKEOVER_CV_KEY.get(tid)
        raw_reqs = take_reqs.get(cv_key) if cv_key else None
        reqs = [{"a": x["attribute"], "v": x["minValue"]} for x in (raw_reqs or [])]
        takeovers.append({
            "id": tid,
            "en": n["en"] or tid.replace("_", " "),
            "zh": n["zh"] or n["en"] or tid,
            "desc_en": d["en"],
            "desc_zh": d["zh"] or d["en"],
            "reqs": reqs,
        })

    # BodyTypeAtlas only packs these 11 selectable presets.
    BODY_ATLAS = [
        ("Slim", "Slim", "纤细"),
        ("Slender", "Slender", "修长"),
        ("Toned", "Toned", "匀称"),
        ("Shredded", "Shredded", "精悍"),
        ("Balanced", "Balanced", "均衡"),
        ("Firm", "Firm", "结实"),
        ("Buff", "Buff", "精壮"),
        ("Broad", "Broad", "宽肩"),
        ("Burly", "Burly", "魁梧"),
        ("Large", "Large", "健硕"),
        ("Stocky", "Stocky", "敦实"),
    ]
    body = [{"id": i, "en": e, "zh": z} for i, e, z in BODY_ATLAS]

    weights_by_h = defaultdict(list)
    for row in weight_table:
        weights_by_h[row["h"]].append(row["w"])
    weight_ranges = {str(h): [min(ws), max(ws)] for h, ws in weights_by_h.items()}

    data = {
        "league": "NBA",
        "attributes": attributes,
        "categories": [
            {"id": "FINISHING", "en": "Finishing", "zh": "终结"},
            {"id": "SHOOTING", "en": "Shooting", "zh": "投篮"},
            {"id": "PLAYMAKING", "en": "Playmaking", "zh": "组织"},
            {"id": "DEFENSE", "en": "Defense", "zh": "防守"},
            {"id": "REBOUNDING", "en": "Rebounding", "zh": "篮板"},
            {"id": "PHYSICALS", "en": "Physicals", "zh": "身体"},
        ],
        "positions": positions,
        "heightMult": height_mult,
        "weightTable": weight_table,
        "wingspanTable": wingspan_table,
        "weightRanges": weight_ranges,
        "constraints": json.loads((OUT.parent / "constraints.json").read_text()) if (OUT.parent / "constraints.json").exists() else constraints_out,
        "grades": grades,
        "importance": importance,
        "initial": initial,
        "badges": badges,
        "takeovers": takeovers,
        "bodyShapes": body,
        "pricing": [40000, 150000, 185000],
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    print("attrs", len(attributes), "badges", len(badges), "takeovers", len(takeovers),
          "weight rows", len(weight_table), "wingspan rows", len(wingspan_table))


if __name__ == "__main__":
    main()
