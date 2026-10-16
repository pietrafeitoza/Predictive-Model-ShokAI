# Research Notes — Breast Cancer and Regional Disparities: Acre, Amazonas, Pará, Roraima

**Status.** This document collects sourced research findings for Artifact 3's hypothesis-formulation step. It does not formulate or test the final hypotheses; its purpose is to provide evidence the team can use when defining them. It is separate from the Colab notebook (no code here).

**Regions covered:**


| State (UF)    | Capital    | Brazilian macro-region |
| --------------- | ------------ | ------------------------ |
| Acre (AC)     | Rio Branco | North                  |
| Amazonas (AM) | Manaus     | North                  |
| Pará (PA)    | Belém     | North                  |
| Roraima (RR)  | Boa Vista  | North                  |

**Data-domain note.** The ANS CONS/REM dataset records *saúde suplementar* (private supplementary health insurance) activity, regulated by ANS. Much of the literature on indigenous health access referenced below (§2.5) concerns SUS, Brazil's public health system, through its dedicated indigenous subsystem, SASISUS — an organizationally separate system from private supplementary health plans. This distinction should be kept in mind before using that literature to interpret patterns in the ANS data.

---

## 1. Comparative data table


| Indicator                                                                                                                                | Acre (AC)                                      | Amazonas (AM)                       | Pará (PA)                                       | Roraima (RR)                                               | Source                            |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------- |
| Estimated new breast cancer cases (2023)                                                                                                 | 100                                            | 500                                 | 1,020                                            | 70                                                         | [1]                               |
| Crude incidence rate (per 100,000 women)                                                                                                 | 22.21                                          | 22.77                               | 22.83                                            | 22.09                                                      | [1]                               |
| Age-adjusted incidence rate (per 100,000 women)                                                                                          | 26.20                                          | 28.34                               | 23.88                                            | 27.73                                                      | [1]                               |
| Mammography machines in use (Aug. 2023)                                                                                                  | 18                                             | 101                                 | 178                                              | 8                                                          | [5]                               |
| Mammography machines in use, per 100,000 inhabitants (Aug. 2023 machines / 2022 Census population; total population, not women-specific) | ≈2.17                                         | ≈2.56                              | ≈2.19                                           | ≈1.26                                                     | [5, 11, 12], authors' calculation |
| HDI (IDHM, 2024)                                                                                                                         | 0.754 (25th of 27)                             | 0.767 (18th of 27)                  | 0.758 (24th of 27)                               | 0.780 (14th of 27)                                         | [9, 10]                           |
| Physician density (per 1,000 inhabitants)                                                                                                | 1.16 (2018 survey)                             | 1.36 (2022 survey)                  | 1.18 (2022 survey)                               | 1.56 (2018 survey)                                         | [6, 7, 8]                         |
| Self-declared indigenous population, 2022 Census                                                                                         | 3.8% (31,694 people; total population 830,018) | 12.46% (total population 3,941,613) | 1.0% (81,201 people; total population 8,120,131) | 15.34% (total population 636,707; highest share in Brazil) | [11, 12]                          |

**Table notes:**

- The mammography-per-inhabitant rate is a rough contextual indicator, not a clinical adequacy measure: it uses total population as the denominator (a women-specific, age-eligible denominator was not available from the sources consulted), and pairs an August 2023 equipment count with 2022 Census population — a small vintage mismatch.
- The physician-density figures are **not directly comparable to each other**: Acre and Roraima come from the 2018 edition of the CFM/USP medical demography survey, while Amazonas and Pará come from the 2022 edition. Read these four numbers as broadly indicative of persistent under-supply across the region, not as a precise ranking between the four states.
- The HDI figures for individual states (Table 1) were retrieved from a secondary summary [10] of the primary Radar IDHM 2024 report [9]; the report's own statistical annex, which would contain the authoritative per-state table, could not be extracted directly by automated retrieval in this research pass.

**Observation.** The four Amazonian states here are close to each other on raw incidence (22.1–22.8 per 100,000 crude). The larger contrasts within this group appear in the resourcing and demographic indicators (mammography access, physician density, indigenous population share), not in the raw incidence numbers. This suggests the more productive hypothesis angle for this group of states may concern detection and follow-up capacity rather than differences in underlying incidence.

---

## 2. Research findings by theme

### 2.1 Data-quality and underreporting concerns in the North

A national spatial analysis of breast cancer *mortality* records (2000–2023) found that officially reported figures in the North region required the largest statistical corrections in the country — up to +69.9% for 2000–2004 — and identified Amazonas and Pará among the states whose adjusted mortality rates were more than 80% higher than the originally reported ones. Corrections declined over time as vital-statistics quality improved, but a gap exceeding 10% persisted even in 2020–2023 [2].

This finding concerns *mortality* records specifically, and does not by itself demonstrate that INCA's *incidence* estimates (Table 1) are undercounted by the same mechanism — incidence and mortality are distinct outcomes, compiled through different registration processes. What it does establish is that case-registration and data-quality problems are a documented, structural issue in the North region's health information systems generally. This is a relevant caveat for interpreting any single administrative indicator from these states — incidence, mortality, or ambulatory consultation volume alike — at face value, though it should not be read as direct evidence that the incidence table specifically is biased.

### 2.2 Screening (mammography) access

Nationally, mammography screening rates for the recommended target group (women aged 50–69) are below 30% on average, and reportedly "barely reached 10%" in some Northern states [3]. Mammography equipment is unevenly distributed nationally: one industry report estimated the Southeast holds about 47% of Brazil's machines against roughly 6% for the entire North region [4]. State-level counts from INCA/CNES (Table 1) show this unevenness persists within the North itself: 18 machines in Acre, 101 in Amazonas, 178 in Pará, and 8 in Roraima as of August 2023 [5], with the population-normalized rate lowest in Roraima and roughly similar among the other three states.

It is a plausible interpretation — not a documented finding in the sources reviewed — that distance to the nearest machine plays a larger practical role in Amazonas and Pará, given their considerably larger territory and reliance on river-based transport, than in the smaller Acre and Roraima. This remains a research direction to test, not an established conclusion, and would benefit from a source that measures travel time or distance directly rather than inferring it from territory size.

### 2.3 Health workforce (physician density)

The North region as a whole averaged 1.45 physicians per 1,000 inhabitants in 2022, compared with 3.39 in the Southeast [6]. Within the region, the state-level figures gathered here (Table 1) range from 1.16 (Acre, 2018 survey) to 1.56 (Roraima, 2018 survey), and 1.18–1.36 (Pará and Amazonas, 2022 survey) [6, 7, 8]. Because these four figures come from two different survey years, they should be read as broadly indicative of a persistent workforce shortfall across the region relative to the national average of the period, rather than as a precise ranking among the four states.

### 2.4 Human development (HDI)

On the 2024 Radar IDHM figures, none of the four states reach the "muito alto" (very high) HDI band; all four sit in the "alto" (high) band, ranging from 0.754 (Acre) to 0.780 (Roraima), and all rank in the bottom half of Brazil's 27 federative units (14th to 25th of 27) [9, 10]. The North region as a whole scored 0.767 in 2024, the lowest of Brazil's macro-regions despite recent gains [9, 10].

### 2.5 Indigenous population and health-system access

Roraima (15.34%) and Amazonas (12.46%) have, by a wide margin, the highest self-declared indigenous population shares of any Brazilian states; Pará (1.0%) and Acre (3.8%) are considerably lower [11, 12]. The literature on health-system organization identifies additional, well-documented access barriers for indigenous populations in Brazil generally — geographic isolation and a healthcare pathway (SASISUS) that is organizationally separate from mainstream primary care.

Two caveats limit what this research pass can conclude from that observation. First, we did not identify, within the time available, a source that directly connects indigenous population share to breast cancer screening or treatment outcomes specifically (as distinct from cancer or health access in general); candidate leads worth following up include a 2020 publication on health education for indigenous women on breast and cervical cancer, and a study on cervical cancer screening in an indigenous population of the DSEI Amapá e Norte do Pará health district, though neither could be verified in full during this pass and neither is included as a numbered reference below for that reason. Second, and more fundamentally, SASISUS serves the public system (SUS), while the ANS CONS/REM dataset records private supplementary health-plan activity; the indigenous-population share of a state's general population is not necessarily informative about the population actually captured in the ANS dataset. Any hypothesis built on this angle should treat the indigenous-access literature as background motivation rather than as direct evidence about the ANS beneficiary population, and should budget time to locate a source specific to breast cancer outcomes before the hypothesis is finalized.

### 2.6 Stage at diagnosis and treatment delay

At the national level, more than half of breast cancer cases face treatment delays exceeding 60 days after diagnosis, and the North is among the regions reporting the highest average delays; advanced-stage (III/IV) diagnoses are also consistently more common in the North and Northeast than the national mean, across age groups [3]. These findings are consistent with — though they do not directly test — the idea that lower screening coverage, greater travel distances, and workforce shortages (§2.1–§2.3) contribute to later-stage presentation in the North. Establishing that causal link directly was outside the scope of the sources reviewed here.

---

## 3. Possible directions for the three hypotheses

These directions are drawn from the findings above to give the team concrete material to react to; they are not final hypotheses. For each, the supporting evidence, the underlying indicator, and its likely availability in the ANS CONS/REM dataset are listed separately, so the colleague responsible for hypothesis cards and feature selection can assess feasibility quickly.

**Direction A — Detection and registration capacity.**

- *Evidence:* §2.1 (mortality-record corrections) and §2.2 (screening rates and mammography counts) both point to uneven detection/registration capacity across the North, though §2.1's evidence is about mortality, not incidence, records.
- *Indicator:* mammography machines in use per state (and, ideally, per eligible-population denominator).
- *Dataset availability:* not directly available in ANS CONS/REM (no diagnostic or screening-outcome field); would need to be joined from an external source such as CNES/INCA at the municipality or state level, or approximated from ambulatory consultation volume/type as a proxy for care-seeking activity.

**Direction B — Workforce and access gradient.**

- *Evidence:* §2.3 (physician density) combined with §2.6 (treatment delay and late-stage diagnosis at the national level).
- *Indicator:* physician density per state (interpreted cautiously — see the vintage-mismatch note in Table 1).
- *Dataset availability:* not directly available in ANS CONS/REM; the dataset's `CD_CARATER_ATENDIMENTO` (elective vs. urgent) and consultation-timing fields could serve as an indirect proxy for delayed presentation if the group decides to pursue this direction with the Tocantins data specifically.

**Direction C — Indigenous population and health-system organization.**

- *Evidence:* §2.5 — background motivation only; no source specific to breast cancer outcomes in indigenous populations was verified during this pass.
- *Indicator:* self-declared indigenous population share per state (2022 Census).
- *Dataset availability:* very likely not represented, or severely underrepresented, in ANS CONS/REM, since the indigenous population is predominantly served by SUS/SASISUS rather than private supplementary health plans (see the data-domain note above). This direction is the least ready of the three for the ANS dataset specifically and would benefit from further source-finding before being written up as a hypothesis.

---

## 4. Methodological limitations

- **Mixed reference years.** Sources cited here span 2018 to 2026 depending on indicator; where two states are compared on an indicator sourced from different years (notably physician density, §2.3, and the mammography/Census population pairing in Table 1), the comparison should be read as approximate.
- **Distinct outcomes, not interchangeable.** Incidence, mortality, screening coverage, stage at diagnosis, and treatment delay are five different epidemiological outcomes, each compiled through its own data-collection process. A pattern documented for one (e.g., mortality-record corrections, §2.1) should not be assumed to hold for another (e.g., incidence, Table 1) without a source that tests that specific link.
- **State-level association is not individual-level causation.** All comparisons in this document are at the state level. A state-level association between, say, physician density and treatment delay does not establish that any individual patient's delay was caused by local physician supply; ecological findings of this kind should not be over-interpreted as individual-level mechanisms without a study designed to test that link.
- **General-population indicators vs. ANS beneficiaries.** Most indicators gathered here (HDI, physician density, indigenous population share, mammography counts) describe each state's general population or public health infrastructure. The ANS CONS/REM dataset covers only private supplementary health-plan beneficiaries in Tocantins, a subset of the general population that may not be representative of it — particularly for indicators tied to public-system access, such as SASISUS (§2.5).

---

## 5. References

- [1] INSTITUTO NACIONAL DE CÂNCER (INCA). **Estimativa 2023: incidência de câncer no Brasil**. Rio de Janeiro: INCA, 2022. Disponível em: https://www.inca.gov.br/publicacoes/livros/estimativa-2023-incidencia-de-cancer-no-brasil. Acesso em: 26 ago. 2026.
- [2] CAMARGO, Juliana Dantas de Araújo Santos et al. Regional disparities in breast cancer mortality in Brazil: a spatial analysis using uncorrected and adjusted data, 2000–2023. **Scientific Reports**, v. 16, artigo 6770, 2026. DOI: 10.1038/s41598-026-37844-w. Disponível em: https://doi.org/10.1038/s41598-026-37844-w. Acesso em: 26 ago. 2026.
- [3] FREITAS-JUNIOR, R.; ROCHA, A. F. B. M.; SOARES, L. R.; FERREIRA, G. L. R. Disparities in breast cancer screening, stage at diagnosis, and treatment in Brazil: a warning of the need to change public policies. **BMC Public Health**, v. 26, artigo 1257, 2026. DOI: 10.1186/s12889-026-26805-7. Disponível em: https://doi.org/10.1186/s12889-026-26805-7. Acesso em: 26 ago. 2026.
- [4] ASSOCIAÇÃO BRASILEIRA DE MEDICINA DIAGNÓSTICA (ABRAMED). **Painel Abramed 2019: o DNA do diagnóstico**. São Paulo: Abramed, 2020. Disponível em: https://abramed.org.br/748/sudeste-concentra-quase-metade-dos-mamografos-do-brasil-2/. Acesso em: 26 ago. 2026.
- [5] INSTITUTO NACIONAL DE CÂNCER (INCA). **Número de mamógrafos no Brasil e no SUS**. Rio de Janeiro: INCA, 2023. Disponível em: https://www.gov.br/inca/pt-br/assuntos/gestor-e-profissional-de-saude/controle-do-cancer-de-mama/dados-e-numeros/numero-de-mamografos-no-brasil-e-no-sus. Acesso em: 26 ago. 2026.
- [6] FACULDADE DE MEDICINA DA UNIVERSIDADE DE SÃO PAULO (FMUSP); ASSOCIAÇÃO MÉDICA BRASILEIRA (AMB). **Demografia médica no Brasil 2023**. São Paulo: FMUSP/AMB, 2023. Disponível em: https://www.fm.usp.br/fmusp/conteudo/estudo_demografico_FMUSP_AMB.pdf. Acesso em: 26 ago. 2026.
- [7] CONSELHO FEDERAL DE MEDICINA (CFM). **Acre tem 1,16 médicos por mil habitantes**. Brasília, DF: CFM, 2018. Disponível em: https://portal.cfm.org.br/noticias/acre-tem-116-medicos-por-mil-habitantes/. Acesso em: 26 ago. 2026.
- [8] CONSELHO FEDERAL DE MEDICINA (CFM). **Roraima tem 1,56 médicos por mil habitantes, ou seja, 29% a menos do que a média nacional**. Brasília, DF: CFM, 2018. Disponível em: https://portal.cfm.org.br/noticias/roraima-tem-156-medicos-por-mil-habitantes-ou-seja-29-a-menos-do-que-a-media-nacional/. Acesso em: 26 ago. 2026.
- [9] PROGRAMA DAS NAÇÕES UNIDAS PARA O DESENVOLVIMENTO (PNUD); FUNDAÇÃO JOÃO PINHEIRO (FJP); INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA (IBGE). **Radar IDHM: evolução do IDHM e de seus componentes no período de 2012 a 2024**. Brasília, DF: PNUD, 2026. Disponível em: https://static.poder360.com.br/2026/05/radar_idhm_pnud-2.pdf. Acesso em: 26 ago. 2026.
- [10] LEOCÁDIO, Ana Cláudia. O que o novo estudo do Índice de Desenvolvimento Humano revela sobre o Norte. **Revista Cenarium**, Manaus, 26 maio 2026. Disponível em: https://revistacenarium.com.br/o-que-o-novo-estudo-do-indice-de-desenvolvimento-humano-revela-sobre-o-norte/. Acesso em: 26 ago. 2026.
- [11] BNC AMAZONAS. Roraima e Amazonas são os estados mais indígenas do Brasil. **BNC Amazonas**, Manaus, 22 abr. 2026. Disponível em: https://bncamazonas.com.br/poder/indigenas-6/. Acesso em: 26 ago. 2026.
- [12] GOVERNO DO ACRE. População indígena do Acre cresce mais de 80% em 12 anos e criação da Sepi reforça políticas públicas afirmativas. **Agência de Notícias do Acre**, Rio Branco, dez. 2023. Disponível em: https://agencia.ac.gov.br/populacao-indigena-do-acre-cresce-mais-de-80-em-12-anos-e-criacao-da-sepi-reforca-politicas-publicas-afirmativas/. Acesso em: 26 ago. 2026.
- [13] COSTA, I. K. da L. et al. Desafios no rastreamento e diagnóstico precoce do câncer do colo do útero em territórios indígenas: achados de uma revisão integrativa da literatura.  **Brazilian Journal of Implantology and Health Sciences** , v. 8, n. 6, p. 1042–1060, 2026. DOI: 10.36557/2674-8169.2026v8n6p1042-1060. Disponível em: https://doi.org/10.36557/2674-8169.2026v8n6p1042-1060. Acesso em: 26 ago. 2026.
- [14] DA SILVA SOUZA, A. T. et al. Educação em saúde para mulheres indígenas sobre cânceres de mama e de colo uterino.  **Revista Brasileira em Promoção da Saúde** , v. 33, p. 1–8, 2020. DOI: 10.5020/18061230.2020.10740. Disponível em: https://doi.org/10.5020/18061230.2020.10740. Acesso em: 26 ago. 2026.
