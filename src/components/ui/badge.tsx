import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap', {
  variants: {
    tone: {
      lavender: 'bg-lilac text-[#5B4A8F] dark:bg-lavender/20 dark:text-lavender',
      sage: 'bg-sage/60 text-[#2E5A43] dark:bg-sage/20 dark:text-sage',
      pink: 'bg-dusty/70 text-[#874358] dark:bg-dusty/20 dark:text-dusty',
      blue: 'bg-powder/70 text-[#34558A] dark:bg-powder/20 dark:text-powder',
      peach: 'bg-peach/80 text-[#8A5A33] dark:bg-peach/20 dark:text-peach',
      neutral: 'bg-muted text-muted-foreground',
      danger: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    },
  },
  defaultVariants: { tone: 'lavender' },
});
export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;
export function Badge({ className, tone, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...p} />;
}
