# Target Investigation: Patient Potential (Potencial de Pacientes)

**Author:** Analysis conducted in support of jessica.alves, on the current state of the `g02` repository (branch `dev`, after the `feat/k-means-clustering` merge).
**Date:** 2026-09-09
**Scope investigated:** every notebook (`notebooks/01`–`09`), all documentation (`documents/documentation.md`, `documents/extras/*.md`), the provenance dictionary (`notebooks/01`, `PROVENANCE_DICTIONARY` cell), the decisions dictionary (`data/processed/north_region_mama_2025_decisions_dictionary.csv`), the TUSS/SBOC crosswalk (`data/reference/tuss_sboc_crosswalk_breast_cancer.csv`), the full schema of the raw merged base (`data/interim/north_region_ambulatorial_full_2025.parquet`, 32 columns, before the breast-cancer filter), and the final treated base (`data/processed/north_region_mama_2025_data_en.parquet`, 310,340 rows x 119 columns). No column name or meaning was assumed without direct verification in the data or the documentation.

---

## 1. CONCEPTUAL TARGET

**What "PATIENT POTENTIAL" means in this project**, according to the TAPI and the documentation (`documents/documentation.md`, Sections 1 and 4.1.3):

> Estimate, from historical ANS data, the number of patients who **may require** certain specialized technologies/services — specifically for **non-vertically-integrated** operators, where the operator -> provider -> patient relationship is not directly observable in the data.

Two things follow directly from this definition and are central to the rest of the investigation:

1. It is a measure of **people**, not events, procedures, or monetary values. "How many patients", not "how many encounters" or "how much was spent".
2. It is **prospective** ("may require"), not purely descriptive of the past — but any defensible prospective estimate has to be grounded in an observable historical measure of real utilization, which is what this investigation looks for.

### Specific analysis: does the data allow observing people, or only events?

This was checked directly against the schema of the raw merged base (`data/interim/north_region_ambulatorial_full_2025.parquet`), which holds the 32 original DET+CONS+REM columns (TISS Ambulatorial/ANS) before any filtering:

```
ID_EVENTO_ATENCAO_SAUDE, UF_PRESTADOR, DT_REALIZACAO, CD_PROCEDIMENTO, CD_TABELA_REFERENCIA,
QT_ITEM_EVENTO_INFORMADO, VL_ITEM_EVENTO_INFORMADO, VL_ITEM_PAGO_FORNECEDOR, UNIDADE_MEDIDA,
IND_PACOTE, IND_TABELA_PROPRIA, ID_PLANO, FAIXA_ETARIA, SEXO, CD_MUNICIPIO_BENEFICIARIO,
PORTE, CD_MODALIDADE, NM_MODALIDADE, CD_MUNICIPIO_PRESTADOR, CD_CARATER_ATENDIMENTO,
TIPO_ATENDIMENTO, REGIME_ATENDIMENTO, CD_MOTIVO_SAIDA, CBO, TIPO_CONSULTA, SAUDE_OCUPACIONAL,
IND_ACIDENTE_DOENCA, LG_VALOR_PREESTABELECIDO, VL_TOTAL_REMUNERACAO, CD_MODELO_REMUNERACAO,
N_LINHAS_REM, MES, UF
```

**1. Does the measure represent unique people or events?** Events. The primary key of the entire dataset is `ID_EVENTO_ATENCAO_SAUDE` — an **event/encounter** identifier, not a person identifier. This is confirmed both by the schema and by the provenance dictionary (`notebooks/01`), which describes this column as *"Unique identifier of the outpatient event"*.

**2. Can the same patient appear multiple times?** Yes, structurally. The project's own clinical treatment lines (`treatment_line`: `staging` -> `neoadjuvant` -> `adjuvant` -> `advanced`, see `data/reference/tuss_sboc_crosswalk_breast_cancer.csv`) describe a breast-cancer journey that spans months, with multiple encounters per phase. Notebook 09 confirms this empirically: a single operator has as many as 12,153 recorded events — no single person generates that alone; it is an aggregation of many patients and many returns of the same patient over time, mixed together with no way to tell them apart.

**3. Is there an identifier that allows deduplication?** **No.** This was verified exhaustively:
   - None of the 32 raw columns (list above) is a person/beneficiary identifier. There is no `ID_BENEFICIARIO`, `CD_BENEFICIARIO`, `CPF`, or any equivalent field.
   - A text search for `ID_BENEFICIARIO`, `CD_BENEFICIARIO`, `ID_PACIENTE`, `CD_PACIENTE`, `CPF` across the entire repository (notebooks, documentation, dictionaries) returned no real mention of such an identifier — the 3 false positives found were base64 image-blob substrings inside notebooks, not real text.
   - This is consistent with the known design of the public TISS Ambulatorial/ANS microdata: it is anonymized at the event level, with no persistent beneficiary key, by privacy design (LGPD/ANS). This is not a gap in the project's pipeline — it is a structural characteristic of the data source chosen in the TAPI.
   - `CD_MUNICIPIO_BENEFICIARIO`, `FAIXA_ETARIA`, `SEXO` are **attributes of the event** (the demographic profile of whoever generated that encounter), not a key that lets multiple events be grouped as belonging to the same person. Two events with `FAIXA_ETARIA="50 a 59 anos"`, `SEXO="Feminino"`, the same `CD_MUNICIPIO_BENEFICIARIO` and the same `ID_PLANO` **could be the same patient returning, or two different patients with the same profile** — there is no way to tell.

**4. Can unique patients be obtained by operator x service x region x period?** No, for the same reason as item 3: without a person key, any "per patient" count at that granularity is, in fact, a count of events/procedures with that profile — not of distinct people.

**5. Can `N_PACIENTES` (patient count) be built?** Not directly and defensibly. It would only be possible with a probabilistic deduplication heuristic (e.g., same `ID_PLANO` + `FAIXA_ETARIA` + `SEXO` + `CD_MUNICIPIO_BENEFICIARIO` + time window = "likely the same person"), which is a record-linkage method with an unknown error rate that is neither documented nor validated in this project. Building it now would mean inventing a variable with no methodological grounding — exactly what this task was asked not to do.

**6. Can `POTENCIAL_PACIENTES` be built in an observable and defensible way?** Not as a count of people. It is possible to build a **utilization/demand volume proxy** (events, items, or procedure quantity), which is conceptually adjacent to but not equivalent to "patients". This distinction is discussed in detail in Sections 3 and 4.

### Evidence already present in the project itself

The project's own documentation (`documents/documentation.md`, Section 8.1, variable table) **already** identifies this exact tension and had already taken a position on it:

| Variable (as documented) | Role assigned by the documentation |
|---|---|
| `QT_ITEM_EVENTO_INFORMADO` | "Represents the quantity of procedures performed per event, serving as **the most direct proxy for patient demand**, which constitutes the central prediction target defined in the TAPI." |
| `VL_TOTAL_REMUNERACAO` | "Represents the reimbursement value... serving as **the closest available proxy for revenue**" (not for patients) |

In other words: the team had already acknowledged, in documentation written before this investigation, that **no direct patient count exists** and that `QT_ITEM_EVENTO_INFORMADO` was adopted as the working proxy. This investigation independently confirms that conclusion and extends it with alternatives and a formal granularity analysis — without redefining it without evidence, as requested.

Also relevant is the decisions dictionary (`data/processed/north_region_mama_2025_decisions_dictionary.csv`, row 17): the definitive encoding of `CD_PROCEDIMENTO`, `ID_PLANO`, `CD_MUNICIPIO_*` and `CBO` was **deliberately deferred** because it depends on "the target variable of Card 12, not yet defined" — confirming that the formal target definition is, in fact, a pending and acknowledged blocking step for the team itself.

---

## 2. BEST CANDIDATES

| ranking | dataset | column | type | granularity | classification | adherence to target | justification | limitations |
|---|---|---|---|---|---|---|---|---|
| 1 | `north_region_mama_2025_data_en.parquet` | `QT_ITEM_EVENTO_INFORMADO` (and `_CAPPED_LOG_NORM` version) | float64 | per item/event | **C — TARGET PROXY** | High (already adopted by the project's documentation as the official demand proxy) | Measures procedure volume per event; already documented in the project as "the most direct proxy for patient demand" | Not a count of people — it measures the intensity/quantity of items within an event, not how many distinct patients generated those events. Can be null when `IND_PACOTE=1` (bundled item, no individual quantity reported) |
| 2 | `north_region_mama_2025_data_en.parquet` (via `ID_EVENTO_ATENCAO_SAUDE`) | count of distinct events (`nunique(ID_EVENTO_ATENCAO_SAUDE)`) | int (derived) | per operator/service/period (aggregated) | **C — TARGET PROXY** | Medium-high — already used as `total_eventos` in the activity matrix (notebook 09) | Counts "how many encounters", not "how many items within an encounter" — conceptually closer to "number of care episodes" than `QT_ITEM_EVENTO_INFORMADO` | The same patient can generate multiple events across the clinical journey (staging -> neoadjuvant -> adjuvant), inflating the count relative to real people |
| 3 | `north_region_mama_2025_data_en.parquet` (via `ID_EVENTO_ATENCAO_SAUDE`) | item-row count (`total_itens` in notebook 09, = size of the DET group) | int (derived) | per operator/service/period | **C — TARGET PROXY** | Medium — 0.999 correlation with `total_eventos` already identified and removed for collinearity in notebook 09 | Counts billed item rows, redundant with candidate #2 | Same limitation as #1/#2, plus documented collinearity already handled (removed from the clustering features) |
| 4 | `north_region_mama_2025_data_en.parquet` | `VL_TOTAL_REMUNERACAO` / `VL_ITEM_EVENTO_INFORMADO` (+ capped/log versions) | float64 | per event/item | **E — NOT USABLE** (for patients) | None for "patients" | The project's own documentation labels these columns as a **revenue** proxy, not a patient-demand proxy | Financial, not populational — an expensive patient and a cheap patient weigh the same for the business, but differently here |
| 5 | `north_region_mama_2025_data_en.parquet` | `PORTE` / `PORTE_ORDINAL` / `IND_SIZE_NO_BENEFICIARIES` | ordinal categorical / int | per operator (whole-plan level, all conditions) | **E — NOT USABLE** (as target); **D — FEATURE** (as context) | Low | This is the operator's size tier by **total active beneficiaries of the whole plan**, binned (SMALL/MEDIUM/LARGE/NO BENEFICIARIES) — not a count, not breast-cancer-specific, not broken down by service/region | Bucketed (3 tiers + "no beneficiaries"), not numeric; mixes the operator's entire beneficiary base, not just those relevant to this project |
| 6 | `data/processed/active_operators.parquet` / `activity_matrix` (notebooks 09/10) | `municipios_beneficiarios`, `municipios_prestadores`, `procedimentos_distintos`, `meses_ativos` | int | per operator (aggregated) | **D — FEATURE** | None direct — these are reach/diversity measures of the operator, not patient volume | Useful as predictors (is the operator geographically broad? does it cover many procedure types?), but do not represent a quantity of people | Already validated and persisted (PR #70), ready for use as features, not as target |
| 7 | `north_region_mama_2025_data_en.parquet` | `FAIXA_ETARIA`, `SEXO_Feminino/Masculino`, `CD_MUNICIPIO_BENEFICIARIO` | categorical / one-hot | per event | **D — FEATURE** | None direct — these are the problem's segmentation axes (age, sex, region), cited in the TAPI, not the quantity measure itself | These are the *axes* along which patient potential should be reported (e.g., "potential by age group and region"), not Y itself | — |
| 8 | `north_region_mama_2025_data_en.parquet` | `N_LINHAS_REM` | float64 | per event | **E — NOT USABLE** | None | Counts aggregated reimbursement lines (tied to the payment model), unrelated to patients | — |

---

## 3. RECOMMENDED TARGET

Based on the evidence gathered — and **without inventing** a new variable — the most defensible candidate is the one the project's own documentation had already been using as a working proxy, now formalized with an explicit aggregation definition:

```
TARGET_FINAL = SUM(QT_ITEM_EVENTO_INFORMADO)
                grouped by (ID_PLANO, treatment_line_primary, UF_PRESTADOR, MES)
```

**How it should be built, step by step:**

1. Start from the treated base `data/processed/north_region_mama_2025_data_en.parquet` (post notebook 04 — already filtered to breast cancer, already with `treatment_line` decomposed into `IND_LINE_*`).
2. Define `treatment_line_primary` from the `IND_LINE_STAGING/NEOADJUVANT/ADJUVANT/ADVANCED` indicators (an event can have more than one `IND_LINE_*=1`; in that case, a clinical priority rule needs to be defined and documented — this was **not** done in this investigation and is an open follow-up).
3. Group by `ID_PLANO` (operator) x `treatment_line_primary` (specialized-service proxy) x `UF_PRESTADOR` (region) x `MES` (period).
4. Sum `QT_ITEM_EVENTO_INFORMADO` within each group (use the `_CAPPED` version to reduce the effect of extreme outliers, keeping the untreated version available for auditing, following the pattern already used in the project).
5. **Name the resulting variable as a volume/demand measure, not as "patients"** — e.g., `demand_volume_proxy` or `potencial_pacientes_proxy` — making it textually explicit, in all subsequent documentation, that it is a utilization proxy and not a count of people.

**Why this candidate and not another:**
- It is the only one with a documented precedent already validated by the project's own team (Section 1).
- It is already available in the treated base, with no need to reprocess from scratch.
- It is consistent with the granularity recommended in Section 5.

---

## 4. IF NO DIRECT TARGET EXISTS

**There is no directly observable variable of patient potential in the data analyzed.**

No dataset in the project (raw, interim, or processed) contains a beneficiary/patient identifier that allows deduplication. Every available count is, structurally, a count of events or billed items — not of people. This is not a failure of the pipeline built so far; it is a characteristic of the public data source (TISS Ambulatorial/ANS) defined in the TAPI itself.

The most defensible way to build the target, while making explicit that it is a **derived variable (a volume/demand proxy, not a patient count)**, is the formula presented in Section 3: the sum of `QT_ITEM_EVENTO_INFORMADO` aggregated by operator x treatment line x UF x month. This choice:

- Does not assume 1 event = 1 patient.
- Does not assume 1 procedure = 1 patient.
- Does not invent a synthetic variable with no grounding in the data — it reuses a column that already exists and that the project itself already recognized as a demand proxy.
- Preserves traceability: any estimate produced from it must be communicated to the business team as "estimated utilization volume", not as "number of patients", until a data source with beneficiary identification (e.g., the ANS `DADOS_DE_PLANOS` beneficiary-count base, mentioned in the project's documentation as an additional public source, but **not yet ingested into this pipeline**) is evaluated and incorporated.

---

## 5. RECOMMENDED GRANULARITY

Five candidate granularities were compared empirically over the treated base (310,340 rows), counting how many groups each produces and what fraction of those groups has minimal statistical support (more than 1 row):

| Granularity | # of groups | Median rows/group | Groups with a single row |
|---|---|---|---|
| operator x month | 18,437 | 3.0 | 29.8% |
| operator x UF x month | 26,221 | 2.0 | 34.7% |
| operator x treatment line x month | 30,180 | 2.0 | 37.9% |
| operator x treatment line x UF x month | 40,780 | 2.0 | 43.8% |
| operator x beneficiary municipality x month | 55,549 | 1.0 | 50.0% |
| operator x procedure x UF x month | 56,480 | 1.0 | 53.5% |
| operator x procedure x municipality x month | 92,472 | 1.0 | 66.5% |

**Recommendation: operator x treatment line (`treatment_line_primary`) x UF (`UF_PRESTADOR`) x month.**

Justification:
- It is the finest granularity at which the median support per group is still 2 (it does not collapse to 1), and "treatment line" is the most faithful available interpretation of "specialized service" in the data (clinically more robust than the raw procedure code, which has 156 distinct values and is therefore already treated as a high-cardinality categorical left unencoded, per the decisions dictionary).
- Adding municipality (beneficiary or provider) instead of UF causes almost half the groups to collapse into a single observation — exactly the "statistical noise from excessive granularity" risk already identified and documented as Risk R03 in `documents/documentation.md`, whose mitigation plan (aggregate to a higher hierarchical level) this analysis empirically confirms is necessary.
- It stays aligned with the minimum spatial granularity already adopted in the project (`UF_PRESTADOR` is cited in the column dictionary as "the minimum spatial granularity required by the scope").

If, after initial modeling, this granularity still produces too much noise, Risk R03's "Mitigation Plan" already documents the fallback: fall back to operator x month (no service/region breakdown), which is the granularity with the highest support rate (only 29.8% single-row groups).

---

## 6. METHODOLOGICAL RISKS

- **Patient duplication**: without a beneficiary identifier, the same patient can contribute multiple events across a treatment journey (staging -> neoadjuvant -> adjuvant -> advanced), inflating any event/item count as if they were distinct people. This cannot be corrected with the current data — it is a structural limitation, not a pipeline bug.
- **Event count != patient count**: confirmed directly — `ID_EVENTO_ATENCAO_SAUDE` is an event key, not a person key (Section 1).
- **Beneficiaries vs. patients**: `PORTE` measures the total active beneficiaries of the whole plan (all health conditions, not just breast cancer), so it cannot be used as a proxy for that operator's breast-cancer patient count.
- **Aggregation**: granularities finer than operator x treatment line x UF x month collapse statistically (50-66% of groups with a single observation), making the target unstable at those breakdowns (Section 5, Risk R03 already documented in the project).
- **Temporality**: `MES` is the real temporal granularity available in the source (TISS Ambulatorial has no day-level field); any target requiring daily/weekly granularity is not supportable by the data.
- **Data leakage**: `QT_ITEM_EVENTO_INFORMADO` and the financial columns (`VL_*`) come from the same event — care is needed when building features from other columns of the same event/row that mechanically covary with the aggregated target (e.g., do not use `VL_TOTAL_REMUNERACAO` from the same event as a feature for a target derived from that same event without correctly separating the temporal/training aggregation).
- **Geographic inconsistency**: both `CD_MUNICIPIO_BENEFICIARIO` (where the patient lives) and `CD_MUNICIPIO_PRESTADOR`/`UF_PRESTADOR` (where the service was provided) exist — these are geographically different "demand" predictors (residence vs. place of care) and cannot be treated as interchangeable in the target definition.
- **Absence of individual identification**: this is the root of every risk above — exhaustively confirmed in this investigation (Section 1), not an assumption.

---

## 7. EXECUTIVE CONCLUSION

No dataset in the project contains a column or identifier that allows unique patients to be counted — the TISS/ANS source is anonymized at the event level, with no beneficiary key. The supervised model's Y must therefore be a **demand-volume proxy**, not a literal count of people: the sum of `QT_ITEM_EVENTO_INFORMADO` aggregated by operator x treatment line x UF x month. This choice reuses the variable the project's own documentation had already identified as the "most direct proxy for patient demand", avoids assuming unsupported equivalences (event, procedure, or beneficiary != patient), and uses the finest granularity that still preserves minimal statistical support per group, empirically validated in this analysis. All business communication about the result must make explicit that it is a utilization proxy, not a real population count.
