import {
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { cjk } from "@streamdown/cjk";
import { math } from "@streamdown/math";
import { createMermaidPlugin } from "@streamdown/mermaid";
import DOMPurify from "dompurify";
import { useIsCodeFenceIncomplete } from "streamdown";
import "katex/dist/katex.min.css";
import { AiCodeBlock, AiResponse } from "./response";
import { Button } from "@/components/ui/button";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ui/code-block";

// Keep the renderer policy application-owned. Diagram directives cannot weaken it.
const diagramConfig = {
  startOnLoad: false,
  securityLevel: "strict",
  htmlLabels: false,
  flowchart: { htmlLabels: false },
  fontFamily: "Inter, sans-serif",
  suppressErrorRendering: true,
  maxTextSize: 50000,
  maxEdges: 500,
  secure: [
    "secure",
    "securityLevel",
    "startOnLoad",
    "maxTextSize",
    "maxEdges",
    "suppressErrorRendering",
    "dompurifyConfig",
    "htmlLabels",
    "flowchart",
    "fontFamily",
    "theme",
    "themeVariables",
    "themeCSS",
  ],
};
const mermaid = createMermaidPlugin({ config: diagramConfig });
const plugins = { math, cjk, mermaid };

function subscribeAppearance(callback) {
  const observer = new globalThis.MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
const isDark = () => document.documentElement.classList.contains("dark");
const serverAppearance = () => false;

// Mermaid creates temporary live DOM and Image objects before returning SVG.
// Reject whole resource-capable syntax families before calling its renderer;
// matching just an `img:` key misses YAML quoting/escape forms inside @{}.
function requiresTrustedDiagramRenderer(chart) {
  return /@\s*\{|%%\s*\{|(?:^|\n)\s*---(?:\s|$)|\b(?:classDef|linkStyle|style)\b|\burl\s*\(|<\s*[a-z!/]|!\s*\[|&(?:#(?:x[\da-f]+|\d+);?|[a-z][\da-z]+;)/i.test(
    chart,
  );
}

function MermaidDiagram({ children }) {
  const chart = String(children ?? "").replace(/\n$/, "");
  const incomplete = useIsCodeFenceIncomplete();
  const restricted = requiresTrustedDiagramRenderer(chart);
  const dark = useSyncExternalStore(
    subscribeAppearance,
    isDark,
    serverAppearance,
  );
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [result, setResult] = useState(null);
  const [source, setSource] = useState(false);
  useEffect(() => {
    if (incomplete || restricted) {
      return;
    }
    let current = true;
    const instance = mermaid.getMermaid({
      ...diagramConfig,
      theme: dark ? "dark" : "default",
    });
    // Mermaid's strict mode sanitizes during rendering; independently sanitize
    // the SVG before inserting it and remove foreign HTML, embeds and links.
    void instance
      .render(`ai-diagram-${id}`, chart)
      .then(({ svg }) => {
        const sanitized = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          FORBID_TAGS: ["foreignObject", "image"],
          // Mermaid may place layout transforms on an anchor. Keep its inert
          // structure so removing links does not move/crop the contained node.
          FORBID_ATTR: ["href", "xlink:href"],
        });
        if (current) {
          setResult({ chart, dark, svg: sanitized });
        }
      })
      .catch((cause) => {
        if (current) {
          setResult({
            chart,
            dark,
            error:
              cause instanceof Error
                ? cause.message
                : "Unable to render diagram.",
          });
        }
      });
    return () => {
      current = false;
    };
  }, [chart, dark, id, incomplete, restricted]);
  const ready = !incomplete && result?.chart === chart && result.dark === dark;
  const error = restricted || (ready && result?.error);
  const showSource = source || !ready || error;
  return (
    <CodeBlock data-ai-diagram="" data-diagram-theme={dark ? "dark" : "light"}>
      <CodeBlockHeader>
        <CodeBlockTitle>mermaid</CodeBlockTitle>
        <CodeBlockActions>
          <Button
            variant="ghost"
            size="xs"
            aria-pressed={source}
            onClick={() => setSource((value) => !value)}
            disabled={!ready || Boolean(error)}
          >
            {source ? "Diagram" : "Source"}
          </Button>
          <CodeBlockCopyButton value={chart} disabled={incomplete} />
        </CodeBlockActions>
      </CodeBlockHeader>
      {error && (
        <p
          role="status"
          className="text-body-sm px-5 pt-3 text-muted-foreground"
        >
          {restricted
            ? "This diagram uses embedded content or custom styling. Source shown below."
            : "Diagram unavailable. The source remains below."}
        </p>
      )}
      {showSource ? (
        <CodeBlockContent className="max-h-96">{chart}</CodeBlockContent>
      ) : (
        <div
          className="max-h-96 overflow-auto p-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [&_svg]:mx-auto [&_svg]:max-w-full"
          tabIndex={0}
          role="img"
          aria-label="Mermaid diagram"
          dangerouslySetInnerHTML={{ __html: result.svg }}
        />
      )}
    </CodeBlock>
  );
}

function RichCode(props) {
  return /(?:^|\s)language-mermaid(?:\s|$)/.test(props.className ?? "") ? (
    <MermaidDiagram {...props} />
  ) : (
    <AiCodeBlock {...props} />
  );
}

export default function RichResponseContent({ components, ...props }) {
  const renderers = useMemo(
    () => ({ code: RichCode, ...components }),
    [components],
  );
  return <AiResponse {...props} plugins={plugins} components={renderers} />;
}
