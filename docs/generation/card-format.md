> Inherited reference from the server-edition baseline. Tool and subagent names describe that original runtime. This variant implements the same generation contract in `server/generation/openrouter.mjs` and validates saved cards with `shared/study-set-validation.js`.

# Strict study set format

Pass `studySetJson` to `study_set_create` as a JSON string encoding this object. Do not save Markdown fences. All fields shown for the chosen card type are required. No extra fields.

```ts
type StudySet = {
  title: string; // nonempty, at most 200 characters
  category: string; // nonempty slash-separated path, e.g. "Biology/Cells"
  cards: Card[]; // requested number; default 25
};
type Base = {
  id: number; // unique integer within this set, start at 1
  question: string; // nonempty
  explanation: string; // nonempty, teach why using source material
};
type Card =
  | (Base & { type: "true_false"; answer: boolean })
  | (Base & {
      type: "multiple_choice";
      options: Record<string, string>;
      answer: string; // an options KEY, e.g. "B", not its value
    })
  | (Base & {
      type: "multiple_response";
      options: Record<string, string>;
      answer: string[]; // distinct options KEYS, at least one
    })
  | (Base & {
      type: "fill_in_the_blank";
      answer: string[]; // at least one answer string
    })
  | (Base & {
      type: "ordering";
      unordered_items: string[]; // distinct item strings
      answer: string[]; // same exact items, in correct order
    })
  | (Base & {
      type: "matching";
      prompts: string[]; // distinct prompt strings
      choices: string[]; // distinct choice strings
      answer: { prompt: string; choices: string[] }[];
      // one answer entry per prompt; refer to the exact prompt and choice strings
    })
  | (Base & { type: "short_answer"; answer: string });
```

Example:

```json
{
  "title": "Cell respiration",
  "category": "Biology/Cells",
  "cards": [
    {
      "id": 1,
      "type": "multiple_choice",
      "question": "What is the main role of mitochondria?",
      "options": {
        "A": "Store genetic information",
        "B": "Produce ATP",
        "C": "Build cell walls"
      },
      "answer": "B",
      "explanation": "Mitochondria use energy released from nutrients to produce ATP, which powers cellular processes."
    }
  ]
}
```

The save tool validates the ordinary application's schema. Its receipt proves the study set was persisted; a conversation message alone does not save cards.
