import * as React from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;
export function DialogContent({ className, children, size = 'md', ...p }: React.ComponentPropsWithoutRef<typeof D.Content> & { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[100] bg-charcoal/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <D.Content
        className={cn(
          'fixed z-[101] inset-x-0 bottom-0 mx-auto w-full max-h-[92vh] overflow-hidden flex flex-col rounded-t-[28px] border border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-lift',
          'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[calc(100vw-1.5rem)] sm:rounded-2xl sm:pb-0',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-8 sm:data-[state=open]:slide-in-from-bottom-0 data-[state=open]:sm:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          size === 'sm' && 'max-w-sm', size === 'md' && 'max-w-lg', size === 'lg' && 'max-w-2xl', size === 'xl' && 'max-w-5xl', className,
        )}
        {...p}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border sm:hidden" />
        {children}
        <D.Close className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-muted opacity-80 hover:opacity-100" aria-label="Close"><X className="h-4 w-4" /></D.Close>
      </D.Content>
    </D.Portal>
  );
}
export const DialogHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('px-6 pt-5 pb-3 pr-12', className)} {...p} />;
export const DialogBody = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('px-6 pb-5 overflow-y-auto', className)} {...p} />;
export const DialogFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4', className)} {...p} />;
export const DialogTitle = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof D.Title>) => <D.Title className={cn('text-lg font-semibold', className)} {...p} />;
export const DialogDescription = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof D.Description>) => <D.Description className={cn('text-sm text-muted-foreground mt-1', className)} {...p} />;
