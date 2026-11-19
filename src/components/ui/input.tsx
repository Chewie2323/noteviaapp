import * as React from 'react';
import { cn } from '@/lib/utils';
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn('flex h-10 w-full rounded-xl border border-input bg-card px-3.5 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm', className)} {...p} />
));
Input.displayName = 'Input';
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn('flex min-h-[80px] w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring', className)} {...p} />
));
Textarea.displayName = 'Textarea';
export function Label({ className, children, hint, ...p }: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return <label className={cn('mb-1.5 block text-xs font-medium text-muted-foreground', className)} {...p}>{children}{hint && <span className="font-normal opacity-70"> · {hint}</span>}</label>;
}
export function NativeSelect({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40', className)} {...p} />;
}
