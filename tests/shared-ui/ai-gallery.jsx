import { useEffect, useRef, useState } from "react";
import { AiChat } from "@/components/ai/chat";
import { AiResponse } from "@/components/ai/response";
import { AiRichResponse } from "@/components/ai/rich-response";
import { AiTool } from "@/components/ai/conversation";
import { createDemoTransport } from "./demo-transport";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire";

const transport = createDemoTransport();
const errorTransport = createDemoTransport({ fail: true, delay: 1 });

function Clarification() {
  const [answer, setAnswer] = useState("");
  return (
    <section
      className="gallery-section"
      aria-label="Agent clarification"
      data-components="questionnaire"
    >
      <h2>Agent clarification</h2>
      <Questionnaire
        onSubmit={(event) => {
          event.preventDefault();
          const data = new globalThis.FormData(event.currentTarget);
          setAnswer(JSON.stringify(Object.fromEntries(data)));
        }}
      >
        <QuestionnaireProgress />
        <QuestionnaireItem name="direction" required>
          <QuestionnaireTitle>Which interface?</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="web">Web app</QuestionnaireChoice>
            <QuestionnaireChoice value="desktop">
              Desktop app
            </QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError>Choose an interface.</QuestionnaireError>
        </QuestionnaireItem>
        <QuestionnaireItem name="details">
          <QuestionnaireTitle>Anything else?</QuestionnaireTitle>
          <QuestionnaireInput
            placeholder="Optional details"
            aria-label="Optional details"
          />
        </QuestionnaireItem>
        <QuestionnaireActions>
          <QuestionnairePrevious />
          <QuestionnaireSkip />
          <QuestionnaireNext />
          <QuestionnaireSubmit>Save answers</QuestionnaireSubmit>
        </QuestionnaireActions>
      </Questionnaire>
      <output data-testid="questionnaire-answer">{answer}</output>
    </section>
  );
}

function ToolStates() {
  const [part, setPart] = useState({
    type: "tool-saveDraft",
    toolCallId: "approve-save",
    state: "approval-requested",
    input: { name: "Draft" },
    approval: { id: "approve-save" },
  });
  return (
    <section
      className="gallery-section"
      aria-label="Agent states"
      data-components="marker"
    >
      <h2>Agent states</h2>
      <div className="gallery-stack">
        <Marker variant="separator">
          <MarkerContent>Checkpoint</MarkerContent>
        </Marker>
        <AiTool
          part={part}
          onApproval={async ({ approved }) =>
            setPart((current) => ({
              ...current,
              state: approved ? "output-available" : "output-denied",
              output: approved ? { saved: true } : undefined,
            }))
          }
        />
        <AiTool
          part={{
            type: "tool-check",
            toolCallId: "failed-check",
            state: "output-error",
            input: { path: "draft.md" },
            errorText: "File unavailable",
          }}
        />
      </div>
    </section>
  );
}

const paragraph =
  "A stable transcript row keeps the reader's place as more content arrives. ".repeat(
    3,
  );
function ScrollFixture() {
  const [rows, setRows] = useState(
    Array.from({ length: 12 }, (_, index) => ({
      id: `row-${index}`,
      text: `${index + 1}. ${paragraph}`,
    })),
  );
  const [streaming, setStreaming] = useState(false);
  const history = useRef(0);
  useEffect(() => {
    if (!streaming) {
      return;
    }
    let count = 0;
    const timer = setInterval(() => {
      setRows((current) =>
        current.map((row, index) =>
          index === current.length - 1
            ? { ...row, text: `${row.text} ${paragraph}` }
            : row,
        ),
      );
      if (++count === 20) {
        setStreaming(false);
      }
    }, 80);
    return () => clearInterval(timer);
  }, [streaming]);
  return (
    <section className="gallery-section" aria-label="Transcript scrolling">
      <h2>Transcript scrolling</h2>
      <div className="gallery-row mb-4">
        <Button
          variant="outline"
          onClick={() => {
            const id = `history-${++history.current}`;
            setRows((current) => [
              { id, text: `Earlier. ${paragraph}` },
              ...current,
            ]);
          }}
        >
          Load earlier
        </Button>
        <Button
          variant="outline"
          disabled={streaming}
          onClick={() => setStreaming(true)}
        >
          Stream more
        </Button>
      </div>
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="h-72">
          <MessageScrollerViewport data-testid="history-viewport">
            <MessageScrollerContent>
              {rows.map((row) => (
                <MessageScrollerItem key={row.id} messageId={row.id}>
                  <p data-row={row.id}>{row.text}</p>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </section>
  );
}

function ResponseFixture() {
  const [appended, setAppended] = useState(false);
  const first =
    "## Reading rhythm\n\nThe first paragraph stays in place.\n\nA second paragraph has the same reading rhythm.";
  return (
    <section
      className="gallery-section"
      aria-label="Rich response verification"
    >
      <h2>Rich response verification</h2>
      <Button variant="outline" onClick={() => setAppended(true)}>
        Append response block
      </Button>
      <div data-testid="stable-response" className="mt-4">
        <AiResponse>
          {first +
            (appended
              ? "\n\n### Appended heading\n\nA new block arrives."
              : "")}
        </AiResponse>
      </div>
      <div data-testid="hostile-response">
        <AiResponse>
          {
            '<script>window.aiUnsafe = true</script>\n\n[unsafe](javascript:alert(1))\n\n![private](https://blocked-image.invalid/tracker.png)\n\n<img src="https://blocked-image.invalid/raw.png" onerror="window.aiUnsafe = true" />'
          }
        </AiResponse>
      </div>
    </section>
  );
}

const enhancedMarkdown = [
  "## Rich content",
  "CJK: **重要。**次の文。 Price: $10.",
  "Inline math: $$E = mc^2$$.",
  "$$\n\\frac{1}{2} + \\frac{1}{2} = 1\n$$",
  "```js\nconst mode = 'system';\n```",
  '```mermaid\ngraph LR\n A[Prompt] --> B[Response]\n click A "javascript:alert(1)"\n```',
].join("\n\n");
const unsafeMath =
  "$$\\href{javascript:alert(1)}{unsafe}$$\n\n$$\\includegraphics{https://blocked-image.invalid/math.png}$$";
const diagramStart = "```mermaid\ngraph LR\n A[First] --> B[Final]";

const restrictedDiagrams = [
  'flowchart LR\nA@{ img: "https://blocked-image.invalid/image.png", label: "Image", h: 60 }',
  'flowchart LR\nA@{ "i\\x6dg": "https://blocked-image.invalid/escaped.png", h: 60 }',
  '%%{init: {"securityLevel":"loose","htmlLabels":true}}%%\nflowchart LR\n A["<img src=https://blocked-image.invalid/html.png>"]',
  'flowchart LR\nA["`![image](https://blocked-image.invalid/markdown.png)`"]',
  "flowchart LR\nA-->B\nclassDef resource fill:url(https://blocked-image.invalid/style.png)\nclass A resource",
  "---\nconfig:\n  securityLevel: loose\n---\nflowchart LR\n A-->B",
];

function EnhancedResponseFixture() {
  const [enabled, setEnabled] = useState(false);
  const [complete, setComplete] = useState(false);
  return (
    <section className="gallery-section" aria-label="Enhanced responses">
      <h2>Enhanced responses</h2>
      <div className="gallery-row mb-4">
        <Button
          variant="outline"
          onClick={() => setEnabled(true)}
          disabled={enabled}
        >
          Load enhanced content
        </Button>
        <Button
          variant="outline"
          onClick={() => setComplete(true)}
          disabled={!enabled || complete}
        >
          Complete diagram
        </Button>
      </div>
      {enabled && (
        <>
          <div data-testid="enhanced-response">
            <AiRichResponse>{enhancedMarkdown}</AiRichResponse>
          </div>
          <div data-testid="unsafe-math">
            <AiRichResponse>{unsafeMath}</AiRichResponse>
          </div>
          <div data-testid="restricted-diagrams">
            {restrictedDiagrams.map((chart, index) => (
              <AiRichResponse key={index}>
                {`\`\`\`mermaid\n${chart}\n\`\`\``}
              </AiRichResponse>
            ))}
          </div>
          <div data-testid="streaming-diagram">
            <AiRichResponse isStreaming={!complete}>
              {diagramStart + (complete ? "\n```" : "")}
            </AiRichResponse>
          </div>
          <div data-testid="invalid-diagram">
            <AiRichResponse>
              {"```mermaid\nthis is invalid diagram syntax\n```"}
            </AiRichResponse>
          </div>
        </>
      )}
    </section>
  );
}

export function AiGallery() {
  return (
    <>
      <section
        className="gallery-section"
        aria-label="AI conversation"
        data-components="message-scroller message bubble attachment trace code-block"
      >
        <h2>AI conversation</h2>
        <p className="text-body-sm mb-3 text-muted-foreground">
          Local scripted stream
        </p>
        <AiChat
          id="gallery-demo"
          transport={transport}
          composerProps={{ label: "Demo message" }}
        />
      </section>
      <ToolStates />
      <Clarification />
      <ScrollFixture />
      <ResponseFixture />
      <EnhancedResponseFixture />
      <section className="gallery-section" aria-label="AI error verification">
        <h2>AI error verification</h2>
        <AiChat
          id="gallery-error"
          transport={errorTransport}
          className="h-64"
          composerProps={{ label: "Error demo message" }}
        />
      </section>
    </>
  );
}
