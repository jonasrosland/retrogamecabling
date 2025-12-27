import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Gamepad2, Monitor, Route, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';

// Icon mapping based on category
const CategoryIcon = ({ category, className }: { category: string, className?: string }) => {
  switch (category) {
    case 'console': return <Gamepad2 className={className} />;
    case 'display': return <Tv className={className} />;
    case 'switcher': return <Route className={className} />;
    default: return <Monitor className={className} />;
  }
};

const CustomNode = ({ data, selected }: NodeProps) => {
  const inputs = data.specs?.inputs || [];
  const outputs = data.specs?.outputs || [];

  return (
    <div className={cn(
      "min-w-[180px] rounded-lg border-2 bg-card p-3 shadow-md transition-all duration-200",
      selected ? "border-primary shadow-lg shadow-primary/20" : "border-border hover:border-border/80"
    )}>
      {/* Header with Icon and Name */}
      <div className="flex items-center gap-2 border-b border-border pb-2 mb-2">
        <div className={cn(
          "p-1.5 rounded-md",
          data.category === 'console' ? "bg-primary/10 text-primary" :
          data.category === 'display' ? "bg-accent/10 text-accent" :
          "bg-secondary/10 text-secondary"
        )}>
          <CategoryIcon category={data.category} className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-sm font-bold truncate leading-none text-foreground">
            {data.label}
          </h3>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
            {data.category}
          </p>
        </div>
        
        {/* Power LED Indicator */}
        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
      </div>

      {/* Inputs (Left side) */}
      <div className="absolute -left-3 top-12 flex flex-col gap-3">
        {inputs.map((input: string, index: number) => (
          <div key={`input-${index}`} className="relative group">
             <Handle
              type="target"
              position={Position.Left}
              id={`in-${index}`}
              className="!w-3 !h-3 !bg-muted-foreground hover:!bg-primary transition-colors border-2 !border-background"
            />
            {/* Tooltip on hover */}
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] bg-popover text-popover-foreground px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-border pointer-events-none z-50 shadow-sm">
              In: {input}
            </span>
          </div>
        ))}
      </div>

      {/* Outputs (Right side) */}
      <div className="absolute -right-3 top-12 flex flex-col gap-3">
        {outputs.map((output: string, index: number) => (
          <div key={`output-${index}`} className="relative group">
            <Handle
              type="source"
              position={Position.Right}
              id={`out-${index}`}
              className="!w-3 !h-3 !bg-muted-foreground hover:!bg-accent transition-colors border-2 !border-background"
            />
            {/* Tooltip on hover */}
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] bg-popover text-popover-foreground px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-border pointer-events-none z-50 shadow-sm">
              Out: {output}
            </span>
          </div>
        ))}
      </div>

      {/* Body Content - Specs/Signals */}
      {data.specs?.signals && (
        <div className="text-[10px] text-muted-foreground bg-muted/30 rounded p-1.5 mt-2 font-mono">
          <span className="block opacity-70 mb-0.5">SIGNALS:</span>
          <div className="flex flex-wrap gap-1">
            {data.specs.signals.map((sig: string) => (
              <span key={sig} className="px-1 py-0.5 bg-background border border-border rounded text-xs">
                {sig}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(CustomNode);
