import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block";

export function ScrollbarGallery() {
  return (
    <section className="gallery-section" aria-label="Native scrollbar wrappers">
      <h2>Native scrollbar wrappers</h2>
      <div className="gallery-stack">
        <MessageScrollerProvider
          autoScroll={false}
          defaultScrollPosition="start"
        >
          <MessageScroller className="h-48 w-72 max-w-full bg-muted">
            <MessageScrollerViewport
              data-testid="native-message-scroll"
              aria-label="Scrollbar fixture chat"
            >
              <MessageScrollerContent>
                <div style={{ height: 900, width: 1400, padding: 16 }}>
                  Chat overflow fixture
                </div>
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        </MessageScrollerProvider>
        <CodeBlock className="w-72 max-w-full">
          <CodeBlockContent data-testid="native-code-scroll" className="h-48">
            {Array.from(
              { length: 40 },
              (_, index) =>
                `const line${index} = '${"long source text ".repeat(12)}';`,
            ).join("\n")}
          </CodeBlockContent>
        </CodeBlock>
      </div>
    </section>
  );
}
