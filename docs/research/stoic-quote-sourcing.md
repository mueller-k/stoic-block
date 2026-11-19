# Bundled Stoic quote sourcing

Research date: 2026-11-19. Decision context: [Establish a trustworthy bundled Stoic quote collection](https://github.com/mueller-k/stoic-block/issues/3), within [Map the public release of Stoic Block](https://github.com/mueller-k/stoic-block/issues/1).

## Finding

A small English collection can use historical translations rather than modern quotation sites. Recommend George Long’s *Meditations* and Elizabeth Carter’s *Enchiridion* as the initial source families. This is a proposed sourcing policy and candidate list, not an approved production corpus. Exact historical wording, edition evidence, and intended distribution territories must be recorded before a candidate ships. No extension implementation or publication is part of this research.

## Rights evidence and boundaries

Ancient authorship does not establish rights in English wording. The [US Copyright Office’s derivative-works guidance](https://www.copyright.gov/circs/circ14.pdf) identifies translations and editorial revisions as potentially protected new authorship; protection in new material does not renew the underlying public-domain work. Do not extract wording from a current translator and replace their credit with the ancient author’s name. Attribution alone is not permission, and shortness is not the proposed legal basis.

The [Copyright Office’s duration guidance](https://www.copyright.gov/circs/circ15a.pdf) states that works published in the United States before January 1, 1931 are public domain. This is the 2026 cutoff, not a universal rule for every foreign edition or unpublished manuscript. For foreign historical translations, preserve publication evidence and a source-specific status assessment rather than applying the US-publication rule mechanically.

The [UK Intellectual Property Office](https://www.gov.uk/copyright/how-long-copyright-lasts) gives a usual literary term of life plus 70 years and a separate 25-year term for published layouts. [EU Directive 2006/116/EC, Article 1](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32006L0116) establishes a general life-plus-70 literary term. These support the suitability of very old translations; they are not a country-by-country clearance. Territory-specific exceptions, related rights, and moral rights remain outside this limited research. Do not advertise “public domain worldwide.”

### Source families

| Source | Evidence | Assessment |
| --- | --- | --- |
| Marcus Aurelius, George Long translation, 1862 | [Eton’s physical-copy catalogue](https://catalog.etoncollege.com/B31045) records Long, Bell and Daldy, London, 1862. [National Trust’s collection record](https://www.nationaltrustcollections.org.uk/object/3249235) identifies Long as 1800–1879. | Strong historical candidate. Under ordinary life-plus-70 calculation, the translation’s term ended after 1949. This calculation is an inference, not worldwide clearance. |
| Epictetus, Elizabeth Carter translation, 1758 | [Eton’s physical-copy catalogue](https://catalog.etoncollege.com/B9570) records *All the works of Epictetus*, London, 1758, including the *Enchiridion*, and Carter’s dates, 1717–1806. | Strong historical candidate. Ordinary life-plus-70 calculation ends after 1876. A modern transcription may silently change her wording; verify against the historical edition. |

[Standard Ebooks’ own colophon](https://github.com/standardebooks/marcus-aurelius_meditations_george-long/blob/master/src/epub/text/colophon.xhtml) identifies Long’s 1862 translation, an Internet Classics Archive transcription, and a [Google Books scan](https://books.google.com/books?id=i9iUswYUMmUC). Its [reuse statement](https://github.com/standardebooks/marcus-aurelius_meditations_george-long/blob/master/src/epub/text/uncopyright.xhtml) assesses the source as US public domain and dedicates contributors’ work under CC0, while explicitly making no foreign-source-copyright representation. This makes its text a practical candidate source, with a provenance trail. CC0 on editorial contributions does not clear underlying rights in other territories. Verify individual passages against the linked scan before bundling; the scan could not be opened through the research browser.

Project Gutenberg is another discovery source, but do not equate an ebook identifier with a particular translator. [The widely linked Meditations ebook](https://www.gutenberg.org/cache/epub/2680/pg2680-images.html) is not reliable evidence that a quotation is Long’s merely because its introduction mentions him. Use explicit translator metadata and passage comparison.

[Project Gutenberg’s license, especially 1.C and 1.E](https://www.gutenberg.org/policy/license), distinguishes public-domain text from its name and trademark conditions, and disclaims non-US status. If that source is used, choose and document a compliant redistribution route: retain required notices/license when associating the distributed work with its name, or follow the conditions for distributing underlying public-domain text without that association. Do not copy its headers, logos, or ebook packaging into the quote page by accident. Prefer the Standard Ebooks provenance route for Long to simplify this dependency. These research links are provenance references, not instructions to fetch content at runtime.

## Candidate passages

The following eight passages offer focus, action, learning, judgment, and practice across two authors. Summaries below are editorial descriptions, not proposed quotation text. Four short samples were checked against the linked transcription; none has yet passed historical-scan collation. Passage numbers for Long should also be confirmed against the selected numbered edition because the MIT pages separate paragraphs without displaying section numbers.

| Candidate | Source locator | Theme and editorial suitability |
| --- | --- | --- |
| Purposeful action | Marcus Aurelius, *Meditations* 4.2, Long; [Book IV transcription](https://classics.mit.edu/Antoninus/meditations.4.four.html) | Focus. Sample: “Let no act be done without a purpose, nor otherwise than according to the perfect principles of art.” |
| Begin useful work | Marcus Aurelius, *Meditations* 5.1, Long; [Book V transcription](https://classics.mit.edu/Antoninus/meditations.5.five.html) | Action. Sample excerpt: “I am rising to the work of a human being.” Avoid the transcription’s opening typo and do not silently repair it; collate the edition. |
| Look carefully | Marcus Aurelius, *Meditations* 6.3, Long; [Book VI transcription](https://classics.mit.edu/Antoninus/meditations.6.six.html) | Learning. Sample: “Look within. Let neither the peculiar quality of anything nor its value escape thee.” |
| Attend to this task | Marcus Aurelius, *Meditations* 8.22, Long; [Book VIII transcription](https://classics.mit.edu/Antoninus/meditations.8.eight.html) | Focus. Sample: “Attend to the matter which is before thee, whether it is an opinion or an act or a word.” |
| Distinguish agency | Epictetus, *Enchiridion* 1, Carter; [transcription](https://classics.mit.edu/Epictetus/epicench.html) | Agency. Select a complete short sentence from the historical edition; avoid reducing the passage to a promise of total control. |
| Examine judgments | Epictetus, *Enchiridion* 5, Carter; [transcription](https://classics.mit.edu/Epictetus/epicench.html) | Reflection. Read the whole passage before excerpting; avoid presenting it as blame for a reader’s suffering. |
| Prepare for practice | Epictetus, *Enchiridion* 29, Carter; [transcription](https://classics.mit.edu/Epictetus/epicench.html) | Growth. Consider an undertaking’s demands before committing; choose a short self-contained excerpt rather than the extended athlete example. |
| Practice philosophy | Epictetus, *Enchiridion* 46, Carter; [transcription](https://classics.mit.edu/Epictetus/epicench.html) | Learning through conduct. Favor practice over displaying knowledge; verify the historical wording before crediting Carter. |

The Carter transcription identifies her as translator, but its modern-sounding wording is not sufficient proof of verbatim 1758 text. Treat its four entries as passage-discovery candidates only. If collation reveals modernization, replace with genuine historical text or name and clear the actual adapter; do not inherit the translator label uncritically. Seneca can broaden a later collection, but no Seneca translation was cleared in this investigation and a third author is not necessary to achieve thematic variety.

## Proposed sourcing policy

1. Admit only excerpts from a specifically identified historical translation with documented usable rights in release territories, or a separately documented permissive license covering the intended redistribution. Exclude unsourced quote cards and modern translations without permission. Do not rely on fair use as the routine corpus policy.
2. Keep a manifest for every admitted item: stable ID, exact display text, ancient author, work, book/section, translator, translation date, actual source edition and publication details, transcription URL and pinned revision, scan URL and page, retrieval date, rights rationale and territory scope, theme, excerpt boundaries, editorial changes, and reviewer/signoff.
3. Compare each excerpt to the historical scan, including surrounding context. Record discrepancies and decide which edition governs. Normalize whitespace only by default; record any punctuation normalization. Mark omissions and avoid stitching distant clauses together. Reject excerpts that change the passage’s meaning in isolation.
4. Render author, work/locator, and translator with each quote. A compact attribution can read: Marcus Aurelius · Meditations 8.22 · translated by George Long. Keep full provenance and rights notices bundled locally and accessible without external requests.
5. Keep exact excerpts distinct from paraphrases. A rewritten sentence should be labeled “Paraphrase of …”, credited to its adapter, and linked in the manifest to the underlying passage. Rewriting a protected modern translation does not establish freedom to redistribute it. Recommend exact historical excerpts for the first release, subject to maintainer acceptance of archaic language.
6. Curate for focus, growth, and learning rather than fame. Recommend eight initial entries, balanced between authors after verification, with distinct ideas and readable lengths. Review tone and context; exclude coercive, needlessly grim, or misleading excerpts. This is editorial guidance, not a new user-facing topic feature.
7. Bundle all admitted text, attribution, and required notices. Source URLs are research metadata; do not request them when a blocked visit occurs. No quotes API or remote font is needed.

## Handoff and acceptance checks

[Settle the implementation-ready release specification](https://github.com/mueller-k/stoic-block/issues/5) should settle the release territories, historical-language versus explicitly labeled paraphrase policy, desired collection size, attribution/credits presentation, and the editorial approval requirement. Those are maintainer decisions, not silently resolved by this research.

Before release, require a complete manifest and historical-text check for every selected item, a rights assessment covering every selected territory, correct translator attribution, no unresolved adaptations, and a bundled-notices review. These are implementation/release acceptance tasks, not extra research decisions. The present research establishes usable candidate source families and a reviewable policy; it does not claim that these eight passages are already cleared for worldwide shipment.
