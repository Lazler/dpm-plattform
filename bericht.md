# DPM-Release 4.4 – Ladebericht Azure SQL

- **Zielschema:** `dpm_r4_4`
- **Quelle:** `DPM2 Database_v 4_4_20261006.accdb`
- **SHA-256:** `EF3B55F7A28E4213EA1F2E72A17C67A30F8FADBE5EE14B15170763D3767A3381`
- **Geladen:** 2026-10-28 14:16:09 UTC (1751 s)
- **Umfang:** 70 Tabellen, 5.843.285 Zeilen, 178 Fremdschlüssel
- **Status:** **geprüft**

## Prüfergebnisse

| Prüfung | Ergebnis | Details |
|---|---|---|
| Zeilenanzahl | bestanden | alle Tabellen identisch |
| Lange Texte | bestanden | 109 Textspalten geprüft, keine Kürzung |
| Schlüssel | bestanden | 67 PK ohne Duplikate, 178 Beziehungen ohne Waisen, 178 FK aktiv und vertrauenswürdig |

**Längste Textspalten (max. Länge in Zeichen):**

| Tabelle.Spalte | Typ | Access | Azure |
|---|---|---:|---:|
| OperationVersion.Expression | nvarchar(max) | 4.941 | 4.941 |
| Item.Description | nvarchar(max) | 1.913 | 1.913 |
| OperationVersion.Description | nvarchar(max) | 1.000 | 1.000 |
| OperationVersionData.Error | nvarchar(max) | 741 | 741 |
| Category.Description | nvarchar(max) | 518 | 518 |
| Item.Name | nvarchar(max) | 474 | 474 |
| HeaderVersion.Label | nvarchar(max) | 429 | 429 |
| SubCategory.Description | nvarchar(max) | 394 | 394 |
| Context.Signature | nvarchar(max) | 390 | 390 |
| SubCategory.Name | nvarchar(max) | 241 | 241 |

Tabellen ohne Primärschlüssel (schon in Access ohne PK, daher nicht prüfbar): `ModelViolations`, `VarGeneration_Detail`, `VarGeneration_Summary`

## Versionen in Azure SQL

| Schema | Release | Status | Stand |
|---|---|---|---|
| `dpm_r4_2_1` | 4.2.1 | geprüft | 2026-10-22 12:43:32 |
| `dpm_r4_4` | 4.4 | geprüft | 2026-10-28 14:16:09 |

## Versionsvergleich `dpm_r4_2_1` → `dpm_r4_4`

- Zeilen gesamt: 5.728.777 → 5.843.285 (+114.508)
- Neue Tabellen (1): `OperationOutput`
- Entfallene Tabellen (4): `ATTT2Hierarchies`, `PSCurrentItemCategory`, `PSCurrentPropertyCategory`, `VariableCalculation`
- Neue oder entfallene Spalten: 6
- Spalten mit abweichendem Typ oder abweichender NULL-Regel: 153

### Neue und entfallene Spalten

| Tabelle | Spalte | Änderung | Typ |
|---|---|---|---|
| OperandReference | OperationVID | neu | int |
| OperationScope | CreatedReleaseID | neu | int |
| OperationVersion | OutputVariableID | neu | int |
| Organisation | URL | neu | nvarchar(max) |
| TableAssociation | EndReleaseID | neu | int |
| TableAssociation | StartReleaseID | neu | int |

### Typabweichungen (zusammengefasst)

Unterschiede in Typ oder NULL-Regel bei gleichnamigen Spalten. 0 davon betreffen nur die NULL-Regel. Weichen die Typen systematisch ab (z. B. überall `bigint` statt `int`), stammen sie meist aus unterschiedlichen Migrationswegen und nicht aus einer fachlichen Änderung des DPM.

| `dpm_r4_2_1` | `dpm_r4_4` | Spalten |
|---|---|---:|
| nvarchar(255) | nvarchar(max) | 107 |
| smallint | bit | 46 |

### Zeilenanzahl je Tabelle

| Tabelle | `dpm_r4_2_1` | `dpm_r4_4` | Differenz | % |
|---|---:|---:|---:|---:|
| ATTT2Hierarchies | 17.864 | – | entfallen |  |
| Aux_CellMapping | 426 | 427 | +1 | +0,2 |
| Aux_CellStatus | 256.117 | 269.611 | +13.494 | +5,3 |
| Category | 150 | 155 | +5 | +3,3 |
| Cell | 165.805 | 169.933 | +4.128 | +2,5 |
| ChangeLog | 0 | 0 | +0 |  |
| ChangeLogAttribute | 0 | 0 | +0 |  |
| CompoundItemContext | 83 | 90 | +7 | +8,4 |
| CompoundKey | 234 | 254 | +20 | +8,5 |
| Concept | 814.926 | 837.042 | +22.116 | +2,7 |
| ConceptRelation | 3 | 3 | +0 | +0,0 |
| Context | 244.997 | 249.262 | +4.265 | +1,7 |
| ContextComposition | 1.731.745 | 1.757.180 | +25.435 | +1,5 |
| DataType | 13 | 13 | +0 | +0,0 |
| Document | 0 | 0 | +0 |  |
| DocumentVersion | 0 | 0 | +0 |  |
| DPMAttribute | 457 | 451 | -6 | -1,3 |
| DPMClass | 73 | 72 | -1 | -1,4 |
| Framework | 23 | 22 | -1 | -4,3 |
| Header | 23.575 | 25.289 | +1.714 | +7,3 |
| HeaderVersion | 48.519 | 50.595 | +2.076 | +4,3 |
| Item | 14.551 | 15.863 | +1.312 | +9,0 |
| ItemCategory | 14.665 | 16.096 | +1.431 | +9,8 |
| KeyComposition | 498 | 558 | +60 | +12,0 |
| KeyHeaderMapping | 44 | 44 | +0 | +0,0 |
| Language | 0 | 0 | +0 |  |
| ModelViolations | 0 | 54 | +54 |  |
| Module | 55 | 62 | +7 | +12,7 |
| ModuleParameters | 2.003 | 2.265 | +262 | +13,1 |
| ModuleVersion | 148 | 165 | +17 | +11,5 |
| ModuleVersionComposition | 3.112 | 3.493 | +381 | +12,2 |
| OperandReference | 612.474 | 623.060 | +10.586 | +1,7 |
| OperandReferenceLocation | 579.921 | 588.878 | +8.957 | +1,5 |
| Operation | 11.352 | 12.354 | +1.002 | +8,8 |
| OperationCodePrefix | 0 | 0 | +0 |  |
| OperationNode | 140.691 | 151.240 | +10.549 | +7,5 |
| OperationOutput | – | 0 | neu |  |
| OperationScope | 29.307 | 30.791 | +1.484 | +5,1 |
| OperationScopeComposition | 30.073 | 31.561 | +1.488 | +4,9 |
| OperationVersion | 18.717 | 19.789 | +1.072 | +5,7 |
| OperationVersionData | 18.717 | 19.789 | +1.072 | +5,7 |
| Operator | 38 | 39 | +1 | +2,6 |
| OperatorArgument | 69 | 71 | +2 | +2,9 |
| Organisation | 3 | 3 | +0 | +0,0 |
| Property | 3.156 | 3.318 | +162 | +5,1 |
| PropertyCategory | 3.171 | 3.338 | +167 | +5,3 |
| PSCurrentItemCategory | 14.551 | – | entfallen |  |
| PSCurrentPropertyCategory | 3.156 | – | entfallen |  |
| Reference | 0 | 0 | +0 |  |
| RelatedConcept | 6 | 6 | +0 | +0,0 |
| Release | 6 | 11 | +5 | +83,3 |
| Role | 0 | 0 | +0 |  |
| SubCategory | 1.154 | 1.215 | +61 | +5,3 |
| SubCategoryItem | 21.140 | 26.587 | +5.447 | +25,8 |
| SubCategoryVersion | 1.246 | 1.323 | +77 | +6,2 |
| Subdivision | 0 | 0 | +0 |  |
| SubdivisionType | 0 | 0 | +0 |  |
| SuperCategoryComposition | 102 | 104 | +2 | +2,0 |
| Table | 1.066 | 1.174 | +108 | +10,1 |
| TableAssociation | 42 | 42 | +0 | +0,0 |
| TableGroup | 132 | 148 | +16 | +12,1 |
| TableGroupComposition | 961 | 1.062 | +101 | +10,5 |
| TableVersion | 2.449 | 2.703 | +254 | +10,4 |
| TableVersionCell | 394.404 | 407.898 | +13.494 | +3,4 |
| TableVersionHeader | 59.539 | 64.106 | +4.567 | +7,7 |
| Translation | 0 | 0 | +0 |  |
| User | 0 | 0 | +0 |  |
| UserRole | 0 | 0 | +0 |  |
| VarGeneration_Detail | 86 | 4.720 | +4.634 | +5388,4 |
| VarGeneration_Summary | 5 | 9 | +4 | +80,0 |
| Variable | 146.134 | 149.015 | +2.881 | +2,0 |
| VariableCalculation | 0 | – | entfallen |  |
| VariableGeneration | 357 | 359 | +2 | +0,6 |
| VariableVersion | 294.466 | 299.573 | +5.107 | +1,7 |

## Zeilenanzahl zweier Versionen gegenüberstellen

Wiederverwendbare Abfrage: `scripts/compare_versions.sql` (Parameter `@schema_a`, `@schema_b`), oder `python scripts/compare_versions.py --a <alt> --b <neu> --out vergleich.md`.
