import { Link } from "wouter";
import { ArrowLeft, HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQ() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="container mx-auto px-6 py-12 max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <HelpCircle className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold">Frequently Asked Questions</h1>
            <p className="text-muted-foreground mt-1">Tips and tricks for the diagram editor</p>
          </div>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="multi-select" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              How do I select multiple nodes at once?
            </AccordionTrigger>
            <AccordionContent>
              Hold <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Ctrl</kbd> (Windows/Linux) or{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">⌘ Cmd</kbd> (Mac) and click on nodes to add them to your selection. You can then move or delete them together. Click on empty canvas to deselect.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="snap-grid" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              What is the snap-to-grid feature?
            </AccordionTrigger>
            <AccordionContent>
              The grid toggle (grid icon in the toolbar) switches between free-form placement and grid-aligned mode. When enabled, nodes snap to a 20×20 grid as you drag them, and the background shows visible grid lines to help you align components neatly. Great for tidy diagrams.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="connecting" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              How do I connect components?
            </AccordionTrigger>
            <AccordionContent>
              Drag from an <strong>output</strong> (right side of a node) to an <strong>input</strong> (left side). Each input accepts one connection. Compatible signal types (e.g. HDMI, SCART, Component) are color-coded. Click the X on a connection to remove it.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="delete" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              How do I delete nodes or connections?
            </AccordionTrigger>
            <AccordionContent>
              Select a node or connection, then press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Delete</kbd> or{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Backspace</kbd>. You can also click the X button on a node or on a selected connection. Multi-select first to delete several items at once.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="zoom-pan" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              How do I zoom and pan the canvas?
            </AccordionTrigger>
            <AccordionContent>
              Scroll to zoom in and out. Click and drag on empty canvas to pan. The controls in the bottom-left (zoom in, zoom out, fit view) provide quick shortcuts. Fit view is especially useful after loading a diagram.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="save-load" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              How do I save and load my diagrams?
            </AccordionTrigger>
            <AccordionContent>
              <strong>Save:</strong> Click &quot;Save Setup&quot; to save your diagram as a JSON file. <strong>Load:</strong> Click &quot;Load&quot; to open a previously saved file. Recent diagrams appear on the home page for quick access.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="examples" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              Can I try example diagrams?
            </AccordionTrigger>
            <AccordionContent>
              Yes! Use the &quot;Examples&quot; dropdown in the editor to load pre-built setups (Simple, Medium, Advanced, SVS, Silly creator setup). These are great for inspiration or as a starting point.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="output-types" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              How do I change output types on consoles or switches?
            </AccordionTrigger>
            <AccordionContent>
              Many consoles and switches support multiple output types (e.g. RGB SCART, Component, HDMI). Click the settings/cog icon on a node to open its options and select the output type. The connection colors update to match the signal type.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sidebar" className="border border-border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              How do I add components to the diagram?
            </AccordionTrigger>
            <AccordionContent>
              Drag components from the left sidebar onto the canvas. Use the search box to filter by name. Components are grouped by category: consoles (by maker), switches, displays, adapters, upscalers, and custom items.
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <p className="text-sm text-muted-foreground mt-12 text-center">
          Still have questions? Check the{" "}
          <a
            href="https://github.com/jonasrosland/retrogamecabling"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            project documentation
          </a>
          .
        </p>
      </div>
    </div>
  );
}
