> Inherited reference from the server-edition baseline. Tool and subagent names describe that original runtime. This variant implements the same generation contract in `server/generation/openrouter.mjs` and validates saved cards with `shared/study-set-validation.js`.

---

name: generate-study-set
description: Generate and save one study set from the complete prepared material supplied to the study-generator subagent, or from an explicit source-free topic.

---

The application has supplied the complete selected source, request/settings and card-format reference in this subagent's initial message. Source extraction and scope selection are already complete. Do not fetch source ranges, repeat cleanup, broaden scope, or substitute outside knowledge for supplied material.

Create questions covering the complete relevant selection and requested emphasis. Respect the requested count, permitted card types and category. Default to 25 varied cards when count is absent. Explanations should teach why the answer is correct from the source, with plausible multiple-choice distractors. Avoid unsupported details. For an explicitly source-free topic, use your knowledge and state that basis.

Call `study_set_create` with the complete study-set JSON in the attached card format and the supplied source ID when present. Repair a concrete schema error if reported. The successful receipt contains the saved record and slug. Return a concise description and `/sets/<slug>` link only after that receipt.

Reason about quality while writing. Do not add a cleanup audit, a separate answer-review pass, or an approval step. If the actual model/provider cannot accept the complete input, report that limitation instead of silently dropping material.
