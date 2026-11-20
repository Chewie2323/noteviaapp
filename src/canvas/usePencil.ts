import { useEffect, useRef } from 'react';
import { onPencilAction, haptic } from '@/lib/native';
import type { ToolState } from './InkCanvas';

/** Apple Pencil double-tap / squeeze flips between the eraser and whatever you were using — the same behaviour as Notability. */
export function usePencilActions(tools: ToolState, setTools: (t: ToolState) => void) {
  const ref = useRef({ tools, setTools }); ref.current = { tools, setTools };
  const prev = useRef<ToolState['tool']>('pen');
  useEffect(() => onPencilAction(() => {
    const { tools: t, setTools: set } = ref.current;
    if (t.tool === 'eraser') set({ ...t, tool: prev.current === 'eraser' ? 'pen' : prev.current });
    else { prev.current = t.tool; set({ ...t, tool: 'eraser' }); }
    haptic('light');
  }), []);
}
