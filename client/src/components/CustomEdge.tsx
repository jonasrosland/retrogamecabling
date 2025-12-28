import { BaseEdge, EdgeProps, getBezierPath } from 'reactflow';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onDelete = data?.onDelete;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
      />
      {selected && onDelete && (
        <g>
          {/* Background circle for better visibility */}
          <circle
            cx={labelX}
            cy={labelY}
            r={14}
            fill="white"
            stroke="hsl(var(--destructive))"
            strokeWidth={2}
            className="pointer-events-none"
          />
          <foreignObject
            x={labelX - 14}
            y={labelY - 14}
            width={28}
            height={28}
            className="overflow-visible"
          >
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 text-destructive hover:bg-destructive/20 hover:text-destructive rounded-full",
                "pointer-events-auto bg-transparent"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </Button>
          </foreignObject>
        </g>
      )}
    </>
  );
}

