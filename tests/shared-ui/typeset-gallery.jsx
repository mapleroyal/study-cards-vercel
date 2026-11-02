import { useState } from "react";
import { Button } from "@/components/ui/button";

// Exercises the real content stylesheet, including appends during streaming.
export function TypesetGallery() {
  const [appended, setAppended] = useState(false);

  return (
    <section className="gallery-section" aria-label="Typeset typography">
      <h2>Typeset typography</h2>
      <div className="gallery-stack">
        <article
          className="typeset typeset-docs type-measure"
          data-testid="typeset-docs"
        >
          <h3 data-stable="heading">Documents with a shared rhythm</h3>
          <p data-stable="paragraph">
            Body text inherits the same fonts and appearance as the app. Use
            <strong> emphasis</strong>, <em>italics</em>, and{" "}
            <code>inline code</code> without rebuilding a second typography
            system.
          </p>
          <ul>
            <li>Lists preserve their indentation.</li>
            <li>New blocks add space without moving earlier content.</li>
          </ul>
          <blockquote>
            <p>Typography follows the content container.</p>
          </blockquote>
          <div className="typeset-scroll" data-testid="typeset-table-scroll">
            <table>
              <caption>A table that can scroll on a narrow screen</caption>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Current status and latest update</th>
                  <th>Responsible team</th>
                  <th>Next review</th>
                </tr>
              </thead>
              <tbody>
                <tr data-stable="table-row">
                  <th>Design system</th>
                  <td>Updated foundations</td>
                  <td>Product</td>
                  <td>Friday</td>
                </tr>
                {appended && (
                  <tr>
                    <th>Content</th>
                    <td>Streaming</td>
                    <td>Design</td>
                    <td>Monday</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <pre data-testid="typeset-code">
            <code>
              {
                'const content = "A long code line keeps its own horizontal scrolling instead of widening the whole application viewport.";'
              }
            </code>
          </pre>
          <p className="text-label-md" data-testid="typeset-utility-override">
            A semantic utility can override a prose element.
          </p>
          <div
            className="not-typeset text-body-md"
            data-testid="typeset-island"
          >
            <p>Embedded product UI keeps its own spacing.</p>
            <p>Typeset does not style this paragraph.</p>
            <div className="typeset typeset-reading">
              <p>Nested content stays opted out.</p>
            </div>
            <Button variant="outline" data-testid="typeset-embedded-button">
              Embedded action
            </Button>
          </div>
          {appended && (
            <p data-testid="typeset-appended">A newly streamed paragraph.</p>
          )}
        </article>
        <div>
          <Button
            variant="outline"
            onClick={() => setAppended(true)}
            disabled={appended}
          >
            Append content
          </Button>
        </div>
        <div
          className="typeset typeset-chat type-measure"
          data-testid="typeset-chat"
        >
          <p>Chat uses a tighter rhythm with the same theme tokens.</p>
          <p>A second paragraph makes that rhythm visible.</p>
        </div>
        <article
          className="typeset typeset-reading type-measure"
          data-testid="typeset-reading"
        >
          <h3>Room for reading</h3>
          <p>
            Longer articles use a larger base size and more space between lines.
          </p>
        </article>
      </div>
    </section>
  );
}
