import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SelectionPromptOptions } from "@/components/study/prompts/selection-prompt-options";

const card = {
  options: {
    a: "First option",
    b: "Second option",
  },
};

describe("SelectionPromptOptions", () => {
  it("renders a question-associated radio group for single selection", () => {
    const markup = renderToStaticMarkup(
      <SelectionPromptOptions
        card={card}
        questionId="question-heading"
        isOptionChecked={(optionKey) => optionKey === "b"}
        onOptionPress={() => {}}
      />,
    );

    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain('aria-labelledby="question-heading"');
    expect(markup.match(/role="radio"/g)).toHaveLength(2);
    expect(markup).toContain('aria-checked="true"');
  });

  it("renders question-associated checkboxes for multiple selection", () => {
    const markup = renderToStaticMarkup(
      <SelectionPromptOptions
        card={card}
        questionId="question-heading"
        mode="multiple"
        isOptionChecked={(optionKey) => optionKey === "a"}
        onOptionPress={() => {}}
      />,
    );

    expect(markup).toContain('<fieldset aria-labelledby="question-heading"');
    expect(markup.match(/role="checkbox"/g)).toHaveLength(2);
    expect(markup).toContain('aria-checked="true"');
  });

  it("can omit option keys for naturally named choices", () => {
    const markup = renderToStaticMarkup(
      <SelectionPromptOptions
        card={card}
        questionId="question-heading"
        showOptionKeys={false}
        isOptionChecked={() => false}
        onOptionPress={() => {}}
      />,
    );

    expect(markup).not.toContain("A.");
    expect(markup).not.toContain("B.");
    expect(markup).toContain("First option");
    expect(markup).toContain("Second option");
  });
});
