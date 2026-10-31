import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

// shadcn/ui's Accordion look, built on native <details>/<summary> instead of
// Radix. Radix writes a style attribute onto each panel, and the landing page
// is prerendered under a Content-Security-Policy that refuses inline styles
// (scripts/prerender.mjs). <details> needs no script, keeps keyboard and
// screen-reader behaviour, and opens with the browser's find-in-page.

function Accordion({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="accordion" className={cn(className)} {...props} />;
}
function AccordionItem({ className, ...props }: React.ComponentProps<'details'>) {
  return <details data-slot="accordion-item" className={cn('group border-b border-border last:border-b-0', className)} {...props} />;
}
function AccordionTrigger({ className, children, ...props }: React.ComponentProps<'summary'>) {
  return (
    <summary data-slot="accordion-trigger"
      className={cn('flex items-center justify-between gap-4 py-5 text-start text-base font-medium min-h-11 cursor-pointer list-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring hover:text-primary [&::-webkit-details-marker]:hidden', className)}
      {...props}>
      {children}
      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
    </summary>
  );
}
function AccordionContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="accordion-content" className={cn('pb-5 text-[0.9375rem] leading-relaxed text-muted-foreground max-w-[65ch]', className)} {...props} />;
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
