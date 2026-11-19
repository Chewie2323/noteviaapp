import * as React from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';
export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export const DropdownMenuSub = M.Sub;
export function DropdownMenuContent({ className, align = 'end', sideOffset = 6, ...p }: React.ComponentPropsWithoutRef<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={sideOffset} className={cn('z-[120] min-w-[200px] overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lift data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95', className)} {...p} />
    </M.Portal>
  );
}
export function DropdownMenuItem({ className, destructive, ...p }: React.ComponentPropsWithoutRef<typeof M.Item> & { destructive?: boolean }) {
  return <M.Item className={cn('relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:opacity-70', destructive && 'text-red-600 dark:text-red-400', className)} {...p} />;
}
export const DropdownMenuSeparator = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof M.Separator>) => <M.Separator className={cn('-mx-1.5 my-1 h-px bg-border', className)} {...p} />;
export const DropdownMenuLabel = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof M.Label>) => <M.Label className={cn('px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground', className)} {...p} />;
export const DropdownMenuSubTrigger = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof M.SubTrigger>) => <M.SubTrigger className={cn('flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none focus:bg-muted data-[state=open]:bg-muted [&_svg]:size-4 [&_svg]:opacity-70', className)} {...p} />;
export const DropdownMenuSubContent = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof M.SubContent>) => <M.Portal><M.SubContent className={cn('z-[121] min-w-[180px] rounded-xl border border-border bg-popover p-1.5 shadow-lift', className)} {...p} /></M.Portal>;
