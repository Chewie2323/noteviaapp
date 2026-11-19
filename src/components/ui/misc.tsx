import * as React from 'react';
import * as T from '@radix-ui/react-tabs';
import * as Tip from '@radix-ui/react-tooltip';
import * as P from '@radix-ui/react-popover';
import * as S from '@radix-ui/react-switch';
import * as C from '@radix-ui/react-checkbox';
import * as Sep from '@radix-ui/react-separator';
import * as Acc from '@radix-ui/react-accordion';
import * as Sl from '@radix-ui/react-slider';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Tabs = T.Root;
export const TabsList = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof T.List>) => <T.List className={cn('inline-flex h-10 items-center gap-1 rounded-xl bg-muted p-1 text-muted-foreground overflow-x-auto max-w-full no-scrollbar', className)} {...p} />;
export const TabsTrigger = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof T.Trigger>) => <T.Trigger className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:text-foreground', className)} {...p} />;
export const TabsContent = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof T.Content>) => <T.Content className={cn('mt-5 focus-visible:outline-none', className)} {...p} />;

export const TooltipProvider = Tip.Provider;
export function Tooltip({ content, children, side = 'bottom' }: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tip.Root delayDuration={300}>
      <Tip.Trigger asChild>{children}</Tip.Trigger>
      <Tip.Portal><Tip.Content side={side} sideOffset={6} className="z-[130] rounded-lg bg-charcoal px-2.5 py-1.5 text-xs text-white shadow-lift animate-in fade-in-0">{content}</Tip.Content></Tip.Portal>
    </Tip.Root>
  );
}

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverContent = ({ className, align = 'start', sideOffset = 6, ...p }: React.ComponentPropsWithoutRef<typeof P.Content>) => (
  <P.Portal><P.Content align={align} sideOffset={sideOffset} className={cn('z-[120] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lift outline-none animate-in fade-in-0 zoom-in-95', className)} {...p} /></P.Portal>
);

export const Switch = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof S.Root>) => (
  <S.Root className={cn('peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input disabled:opacity-50', className)} {...p}>
    <S.Thumb className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
  </S.Root>
);

export const Checkbox = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof C.Root>) => (
  <C.Root className={cn('peer h-4 w-4 shrink-0 rounded-[5px] border border-lavender-deep/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} {...p}>
    <C.Indicator className="flex items-center justify-center"><Check className="h-3 w-3" strokeWidth={3} /></C.Indicator>
  </C.Root>
);

export const Separator = ({ className, orientation = 'horizontal', ...p }: React.ComponentPropsWithoutRef<typeof Sep.Root>) => (
  <Sep.Root orientation={orientation} className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)} {...p} />
);

export const Accordion = Acc.Root;
export const AccordionItem = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof Acc.Item>) => <Acc.Item className={cn('border-b border-border', className)} {...p} />;
export const AccordionTrigger = ({ className, children, ...p }: React.ComponentPropsWithoutRef<typeof Acc.Trigger>) => (
  <Acc.Header className="flex"><Acc.Trigger className={cn('flex flex-1 items-center justify-between py-4 text-left font-medium transition-all hover:text-lavender-ink [&[data-state=open]>svg]:rotate-180', className)} {...p}>{children}<ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" /></Acc.Trigger></Acc.Header>
);
export const AccordionContent = ({ className, children, ...p }: React.ComponentPropsWithoutRef<typeof Acc.Content>) => (
  <Acc.Content className="overflow-hidden text-sm text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down" {...p}><div className={cn('pb-4', className)}>{children}</div></Acc.Content>
);

export const Slider = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof Sl.Root>) => (
  <Sl.Root className={cn('relative flex w-full touch-none select-none items-center', className)} {...p}>
    <Sl.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"><Sl.Range className="absolute h-full bg-primary" /></Sl.Track>
    <Sl.Thumb className="block h-4 w-4 rounded-full border-2 border-primary bg-white shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
  </Sl.Root>
);
