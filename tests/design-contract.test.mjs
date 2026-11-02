import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();
const productPath = "app/routes/design-contract.jsx";
const violations = async (code, filePath = productPath) => {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((message) =>
    ["no-restricted-imports", "no-restricted-syntax"].includes(message.ruleId),
  );
};

describe("shared UI boundaries", () => {
  it.each([
    'import { cn } from "cn";',
    "export default () => <select />;",
    'import { NativeSelect as Picker } from "@/components/ui/native-select";',
    'import { Dialog } from "@base-ui/react/dialog";',
    'import { Dialog } from "radix-ui";',
    'import * as Dialog from "@radix-ui/react-dialog";',
  ])("rejects product bypasses: %s", async (code) => {
    expect(await violations(code)).not.toHaveLength(0);
  });

  it("allows tuned wrappers in product screens and primitives inside wrappers", async () => {
    expect(
      await violations('import { Dialog } from "@/components/ui/dialog";'),
    ).toHaveLength(0);
    expect(
      await violations(
        'import { Dialog } from "@base-ui/react/dialog";',
        "app/components/ui/dialog.jsx",
      ),
    ).toHaveLength(0);
    expect(
      await violations(
        "export default () => <select />;",
        "tests/ui/contract-fixture.jsx",
      ),
    ).toHaveLength(0);
  });
});

describe("thumb-only scrollbar policy", () => {
  it.each([
    'export default () => <div className="overflow-auto scrollbar-thin" />;',
    'export default () => <div className="data-autoscrolling:scrollbar-thumb-transparent" />;',
    "export default () => <div className={\u0060overflow-auto scrollbar-track-transparent\u0060} />;",
  ])(
    "rejects native scrollbar overrides inside shared wrappers: %s",
    async (code) => {
      expect(
        await violations(code, "app/components/ui/message-scroller.jsx"),
      ).not.toHaveLength(0);
    },
  );

  it("allows intentional hiding and the shared thumb color variable", async () => {
    expect(
      await violations(
        'export default () => <div className="scrollbar-none data-autoscrolling:[--scrollbar-thumb-color:transparent]" />;',
        "app/components/ui/attachment.jsx",
      ),
    ).toHaveLength(0);
  });
});
