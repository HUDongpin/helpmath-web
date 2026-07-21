# Legacy resource disposition map

Last editorial review: 2026-07-21.

This register connects historically useful `helpprogram.net` URLs to the
modern HELP Math narrative and, where one exists, to a more durable agency,
bibliographic, award, or publisher record. It is both a redirect design aid and
a publication-boundary record. Runtime behavior remains authoritative in
`next.config.ts`; `tests/legacy-redirects.test.ts` and browser tests must stay in
sync with that configuration.

## Evidence and rights rules

- A legacy URL is an inventory key, not durable evidence. Once the old domain
  moves, that URL will redirect to the modern site and can no longer prove what
  the historical page or file originally said.
- Before cutover, preserve every legacy source used for a public claim in an
  owner-controlled archive with its original filename, capture date, SHA-256,
  basic metadata, and any known edition/version. A live backlink to
  `helpprogram.net` is not an acceptable long-term substitute.
- A modern canonical page explains the source in context; it does not turn a
  program-authored claim into independent evidence.
- Prefer a government, ERIC, DOI, award-owner, or publisher URL when it supports
  the claim. Link to externally hosted material; do not copy or mirror it
  without a license or other documented permission.
- Public availability on the historical site does not by itself establish
  copyright ownership, transfer, republication permission, accessibility, or
  permission to reuse third-party text and images.
- “Owner archive — rights review” below means the file may be retained as
  project evidence, but a public download is not yet approved. “External
  link-only” means the modern site may point to the source host; it does not
  claim rights to republish that source.

## Legacy page and directory mapping

| Historical path or family | Modern canonical destination | Editorial reason and source disposition |
| --- | --- | --- |
| `/`, `/Home.htm`, `/Index.htm` | `/` | Modern project overview. Preserve dated home-page captures privately if their wording supports a historical claim. |
| `/About.htm`, `/Kf.htm`, `/Mph.htm`, `/Mth.htm`, `/Csh.htm`, `/Bah.htm`, `/Bdh.htm` | `/about` | Program and organizational history. Historical pages remain owner-archive evidence, not permanent public citations. |
| `/ProgramInfo.htm`, `/Content.htm` | `/curriculum#help-math-1-catalog` | The catalog is the closest modern context for dated Grades 3–8 scope, learner supports, and educator tools. Do not imply current HELP Math 2.0 availability. |
| `/AcademicLanguage.htm`, `/Ped.htm`, `/SIOP.htm`, `/Sheltered.htm`, `/Sheltered Instruction.wmv` | `/approach` | Historical instructional-design context. The video is not carried forward as a downloadable asset without rights and accessibility review. |
| `/Standards.htm`, `/As.htm`, root standards-correlation PDFs, `/HELP_Alignment_CO.pdf` | `/curriculum` | Dated alignment context only. Do not represent an old correlation as current standards alignment. |
| `/Evidence.htm`, `/Awards.htm`, `/Testimonials.htm`, `/PR.htm`, `/Rb.htm`, `/onlineprogram.html` | `/research` | Version-labeled historical evidence and recognition context. Testimonials and press material are not substitutes for primary study records. |
| `/Resources.htm`, `/Tst.htm`, `/Pd.htm`, `/Sales.htm` | `/resources` | The historical sales page functioned partly as a resource index; the modern library is more accurate than a closed contact endpoint. |
| `/Trial.htm`, `/Purchasing.htm`, `/PurchaseInfo.htm`, `/Contact.htm`, `/Pricing.htm`, `/Gfs.htm`, `/trial_register.aspx` | `/contact` | Historical commercial or inquiry paths. The modern contact page remains fail-closed until an approved delivery channel is configured. |
| Historical student, teacher, school, district, project-admin, and trial login/register paths | `/login` | Status explanation only; the modern site does not recreate legacy accounts or imply account migration. |
| `/TechSpecs.htm`, `/Ti.htm` | `/support` | Historical technical-support context; old Flash requirements are not current browser requirements. |
| `/Privacy.htm`, `/HELP Math Privacy Policy 3.12.07.pdf`, `/HELP Math Privacy Policy 3.12.07.doc` | `/privacy` | Routes to the modern draft policy. The 2007 policy remains historical evidence and does not govern a future HELP Math 2.0 service. |
| `/Demo.htm`, `/shortdemo/*` | `/demos` | Routes to the public demo-status page, not directly to unapproved legacy or executive-preview files. |
| `/PR/*` | `/research` | Generic fallback after any exact mappings. Preserve source metadata before cutover. |
| `/DealerDocs/*`, `/teacher_guide/*` | `/resources` | Generic fallback after the exact mappings below; it must remain below them in redirect order. |
| `/Beta/*` | `/curriculum` | Historical curriculum context only; no beta service is represented as active. |

## Exact document mapping

Exact rules preserve meaning better than a directory-wide fallback. The
encoded source strings below match the legacy routes in `next.config.ts`.

| Historical path | Modern canonical destination | Preferred durable source or interpretation | Rights/disposition |
| --- | --- | --- | --- |
| `/CODiE%20Award%20for%20Best%20Instructional%20Solution.pdf` | `/resources#codie-past-winners` | [CODiE official past-winners archive](https://codieawards.com/past-winners); dated recognition for the historical product | External link-only; legacy PDF remains owner-archive evidence pending rights review. |
| `/Codie%20Release%20DDI.pdf` | `/resources#codie-past-winners` | Same official CODiE archive; the company release is secondary evidence | External link-only; do not mirror the release without approval. |
| `/DealerDocs/HELP%20Math%20Evaluation%20White%20Paper%205-13.pdf` | `/research#help-math-pilot` | Program-authored pilot percentages, clearly separated from WWC findings | Owner archive — rights and accessibility review; no independent replacement for the exact subgroup claims. |
| `/DealerDocs/U%20S%20%20Department%20of%20Education%20Research%20Summary%205-2013.pdf` | `/research#wwc-tran-study` | [WWC study record](https://ies.ed.gov/ncee/wwc/Study/72999) and [single-study review](https://ies.ed.gov/ncee/wwc/Docs/SingleStudyReviews/wwc_help_102312.pdf) | Use official WWC sources. The legacy marketing filename does not prove that the summary was authored or endorsed by the Department of Education. |
| `/DealerDocs/HELP%20Math%20self-efficacy%20in%20secondary%20students%20R.pdf` | `/resources#freeman-2012-doi` | [Publisher DOI record](https://doi.org/10.1016/j.compedu.2011.11.003) | External link-only; do not mirror the publisher article without permission. |
| `/DealerDocs/What%20Works%20Clearinghouse_help_102312.pdf` | `/resources#wwc-single-study-review` | [Official WWC PDF](https://ies.ed.gov/ncee/wwc/Docs/SingleStudyReviews/wwc_help_102312.pdf) | Link to the agency copy instead of republishing the legacy duplicate. |
| `/DealerDocs/SCOPE%20and%20Sequence%202012.pdf` | `/curriculum#help-math-1-catalog` | Dated scope evidence for the historical curriculum; reconcile with the 2007 teacher guide and 2008 program page | Owner archive — rights and accessibility review; record edition conflicts. |
| `/DealerDocs/Sheltered%20Instruction%20and%20scaffolding%20techniques%20in%20HELP%20Math%20final%202012.pdf` | `/approach#support-layers` | Historical description of sheltered instruction and scaffolding | Owner archive — rights and accessibility review; not current efficacy evidence. |
| `/DealerDocs/Sheltered%20Instruction%20and%20SPED%202012.pdf` | `/approach#support-layers` | Historical design context for learners needing added support | Owner archive — rights and accessibility review; avoid current-service claims. |
| `/DealerDocs/INTEGRATION%20OF%20ACADEMIC%20LANGUAGE%20IN%20HELP%20MATH.pdf` | `/approach#support-layers` | Historical academic-language design context | Owner archive — rights and accessibility review. |
| `/DealerDocs/HELP%20Math%20Overview%20of%20Reports%20\(2010\).pdf` | `/curriculum#help-math-1-catalog` | Historical educator-tool description | Owner archive — rights and accessibility review; the modern site has no reporting dashboard. |
| `/DealerDocs/HELP%20Math%20as%20an%20RtI%20Solution%202012.pdf` | `/curriculum#help-math-1-catalog` | Historical positioning, not a current product or regulatory claim | Owner archive — rights and accessibility review. |
| `/DealerDocs/Ed%20Week%20Article.pdf` | `/resources#education-week-2013` | [Education Week publisher article](https://www.edweek.org/policy-politics/schools-face-shortage-of-digital-curricula-for-english-learners/2013/05) | External link-only; third-party reporting, not an effectiveness study. |
| `/DealerDocs/TechnologyInnovations.pdf` | `/resources#technology-innovations-report` | [Lexington Institute publisher PDF](https://lexingtoninstitute.org/wp-content/uploads/2013/11/TechnologyInnovations.pdf) | External link-only; period context, not blanket validation. |
| `/DealerDocs/Sage%20Publications%20article.pdf` | `/resources#ell-curriculum-eric` | [ERIC record EJ796893](https://eric.ed.gov/?id=EJ796893) | Link to the bibliographic record; do not mirror the journal article without permission. |
| `/DealerDocs/HelpMath%20print%208.5%20x%2011%20each.pdf` | `/resources#about-help-math` | Historical brochure/program overview; claims must be checked against primary records | Owner archive — publication pending rights and accessibility review. |
| `/teacher_guide/HELP%20Alignment%20v3.1.2-%20NCTM.pdf` | `/curriculum#help-math-1-catalog` | 2007 teacher-guide/alignment evidence used to reconcile the 44 middle-school lesson names | Owner archive — rights and accessibility review; dated alignment only. |

The remaining root research PDFs currently route to `/research`. They should be
treated as legacy duplicates or secondary summaries until an editor assigns a
more precise evidence entry. In particular, a filename containing “U.S.
Department of Education” is not sufficient source attribution.

## Stable external records used by the modern library

These reader-facing records reduce dependence on the old domain. They still
require periodic link review and do not authorize local republication.

| Modern resource anchor | Preferred external record | Scope limit |
| --- | --- | --- |
| `/resources#wwc-study-record` | [WWC study record](https://ies.ed.gov/ncee/wwc/Study/72999) | One reviewed HELP Math 1.0 study; not a product-wide award or HELP Math 2.0 evidence. |
| `/resources#wwc-single-study-review` | [WWC single-study review](https://ies.ed.gov/ncee/wwc/Docs/SingleStudyReviews/wwc_help_102312.pdf) | Same study and version boundary. |
| `/resources#crawford-2013-eric` | [ERIC EJ1023032](https://eric.ed.gov/?id=EJ1023032) | Separate study with less favorable overall results; retain to avoid selective reporting. |
| `/resources#freeman-2012-doi` | [DOI 10.1016/j.compedu.2011.11.003](https://doi.org/10.1016/j.compedu.2011.11.003) | Peer-reviewed historical context; not HELP Math 2.0 evidence. |
| `/resources#ell-curriculum-eric` | [ERIC EJ796893](https://eric.ed.gov/?id=EJ796893) | Historical curriculum-design context. |
| `/resources#codie-past-winners` | [CODiE past winners](https://codieawards.com/past-winners) | 2009 and 2010 recognition for the historical product. |
| `/resources#edtech-2011-winners` | [EdTech Digest winners](https://www.edtechdigest.com/winners/) | Dated recognition; use the award owner’s wording. |
| `/resources#ready-to-teach-eric` | [ERIC ED530966](https://eric.ed.gov/?id=ED530966) | Federal program history; not proof of a precise HELP Math funding percentage. |
| `/resources#ies-math-learning-companion` | [Related IES grant record](https://ies.ed.gov/use-work/awards/math-learning-companion-individualized-intervention-students-math-learning-disabilities) | Related project, not the HELP Math 1.0 award itself. |
| `/resources#education-week-2013` | [Education Week article](https://www.edweek.org/policy-politics/schools-face-shortage-of-digital-curricula-for-english-learners/2013/05) | Third-party reporting, not effectiveness evidence. |
| `/resources#technology-innovations-report` | [Lexington Institute report](https://lexingtoninstitute.org/wp-content/uploads/2013/11/TechnologyInnovations.pdf) | Third-party period context. |

## Cutover risks specific to resources

1. **Circular evidence:** after domain migration, a citation to a legacy URL may
   resolve back to the modern claim. Preserve private source evidence before
   cutover and cite a stable external record wherever possible.
2. **Fragment drift:** exact redirects depend on IDs such as
   `help-math-1-catalog`, `support-layers`, and `wwc-single-study-review`.
   Browser tests must confirm both the final path and the fragment target after
   any content refactor.
3. **Rights overreach:** a successful old-site download does not grant the new
   site republication rights. Keep owner PDFs private until rights,
   confidentiality, third-party content, and accessibility reviews are signed
   off.
4. **Meaning loss through wildcards:** exact document rules must precede
   `/DealerDocs/*` and `/teacher_guide/*`; otherwise users lose the source’s
   context at a generic library page.
5. **Filename and encoding variance:** cutover probes must exercise encoded
   spaces, parentheses, capitalization, query strings, and both apex and `www`
   origins.
6. **External link rot:** review agency, ERIC, DOI, award-owner, and publisher
   destinations at release and on a recorded schedule. A transient network
   failure should be distinguished from a removed record.
7. **Unsupported carry-forward:** do not redirect raw Flash directly to a
   public player or infer that historical accounts, assessments, reports,
   standards alignment, or instructional features are available in HELP Math
   2.0.
