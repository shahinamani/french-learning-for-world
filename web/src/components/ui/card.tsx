import * as React from 'react';
import { cn } from '../../lib/cn';

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card"
    className={cn('flex flex-col gap-5 rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-[0_1px_2px_rgb(28_25_23/0.04),0_8px_24px_-12px_rgb(28_25_23/0.10)]', className)} {...props} />;
}
function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('flex flex-col gap-1.5', className)} {...props} />;
}
function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 data-slot="card-title" className={cn('text-lg font-semibold leading-snug m-0', className)} {...props} />;
}
function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="card-description" className={cn('text-[0.9375rem] leading-relaxed text-muted-foreground m-0', className)} {...props} />;
}
function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn(className)} {...props} />;
}
function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('flex items-center gap-3 mt-auto', className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
