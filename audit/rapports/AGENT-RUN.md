# Agent run

Run at: 2026-06-02T08:44:53.133Z
Status: ok_finished
Run completed: true
Mode: safe_fix
Production writes: true
OnUse creation: true
Total lots: 30
Lots with findings: 3
Planned actions: 3
Next lot: magicien-niveau-1

## Actions

### audit/tools/generate-reference-files.mjs

Status: ok

```text
Références créées : 0
Références enrichies : 28
Références détaillées conservées : 2
Lots sans liste maître : 0
```

### audit/tools/apply-spell-agent-fixes.mjs

Status: ok

```text
Created spells: 65
Renamed spells: 8
Created onUse scripts: 80
```

### audit/decoupage_fichier/decoupe-spells.mjs

Status: ok

```text
Source : fvtt-spells-all.json
Tableau de sorts : items
Sorts détectés : 421
Groupes générés : 30
Sortie : audit/decoupage_fichier
```

### audit/tools/generate-spell-audit-reports.mjs

Status: ok

```text
Rapports générés : 30
Références présentes : 30
Références manquantes : 0
```

## Lots with remaining findings

| Lot | Expected | Export | Missing | Name diffs |
| --- | ---: | ---: | ---: | ---: |
| magicien-niveau-1 | 30 | 30 | 0 | 1 |
| magicien-niveau-2 | 24 | 23 | 0 | 1 |
| illusionniste-niveau-1 | 12 | 11 | 0 | 1 |
