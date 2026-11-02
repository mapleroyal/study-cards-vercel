import { createElement, useMemo } from "react";
import {
  Streamdown,
  defaultComponents,
  defaultRehypePlugins,
  useIsCodeFenceIncomplete,
} from "streamdown";
import { harden } from "rehype-harden";
import { cn } from "@/lib/utils";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// These semantic elements deliberately have no competing typography utilities.
// Typeset owns their fonts, scale and block rhythm; Streamdown owns parsing.
function semantic(tag) {
  return function MarkdownElement({ node: _node, ...props }) {
    return createElement(tag, props);
  };
}

function MarkdownTable({ node: _node, ...props }) {
  return (
    <div
      className="typeset-scroll"
      tabIndex={0}
      role="region"
      aria-label="Table"
    >
      <table {...props} />
    </div>
  );
}

function MarkdownPre(props) {
  // The default pre marks its child as block code. Preserve that contract so
  // Streamdown distinguishes fenced code from the inlineCode renderer.
  return <figure>{createElement(defaultComponents.pre, props)}</figure>;
}

export function AiCodeBlock({ children, className }) {
  const value = String(children ?? "").replace(/\n$/, "");
  const language = /language-([^\s]+)/.exec(className ?? "")?.[1] ?? "text";
  const incomplete = useIsCodeFenceIncomplete();
  const lines = useHighlightedCode(value, language);
  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>{language}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={value} disabled={incomplete} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent lineNumbers className="max-h-96">
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
}

function LinkDialog({ url, isOpen, onClose, onConfirm }) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open link</DialogTitle>
          <DialogDescription className="break-all">{url}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Open link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const proseComponents = Object.fromEntries(
  [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "strong",
    "em",
    "ul",
    "ol",
    "li",
    "blockquote",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "hr",
    "sup",
    "sub",
  ].map((tag) => [tag, semantic(tag)]),
);
const components = {
  ...proseComponents,
  a: defaultComponents.a,
  inlineCode: semantic("code"),
  pre: MarkdownPre,
  code: AiCodeBlock,
  table: MarkdownTable,
};
const noImageOrigins = [];
const defaultLinkSafety = {
  enabled: true,
  renderModal: (props) => <LinkDialog {...props} />,
};

/**
 * Sanitized, streaming Markdown with the template's typography and code blocks.
 * Remote images are opt-in. Pass exact trusted image origins, never model output.
 */
export function AiResponse({
  children,
  isStreaming = false,
  className,
  imageOrigins = noImageOrigins,
  origin,
  components: overrides,
  linkSafety = defaultLinkSafety,
  ...props
}) {
  const defaultOrigin =
    origin ??
    (/^https?:$/.test(globalThis.location?.protocol ?? "")
      ? globalThis.location.origin
      : "https://app.invalid");
  const rehypePlugins = useMemo(
    () => [
      defaultRehypePlugins.raw,
      defaultRehypePlugins.sanitize,
      [
        harden,
        {
          defaultOrigin,
          allowedImagePrefixes: imageOrigins.map(
            (value) => `${new URL(value).origin}/`,
          ),
          allowDataImages: false,
          allowedLinkPrefixes: ["*"],
          allowedProtocols: ["http", "https", "mailto"],
        },
      ],
    ],
    [defaultOrigin, imageOrigins],
  );
  const renderers = useMemo(
    () => ({ ...components, ...overrides }),
    [overrides],
  );
  return (
    <Streamdown
      {...props}
      data-ai-response=""
      className={cn("typeset typeset-chat min-w-0", className)}
      mode="streaming"
      dir="auto"
      isAnimating={isStreaming}
      parseIncompleteMarkdown={isStreaming}
      components={renderers}
      rehypePlugins={rehypePlugins}
      linkSafety={linkSafety}
    >
      {children}
    </Streamdown>
  );
}
