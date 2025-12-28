import { memo, useRef, useEffect, useState, useMemo } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow';
import { Gamepad2, Monitor, Route, Tv, X, Cable, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Icon mapping based on category
const CategoryIcon = ({ category, className }: { category: string, className?: string }) => {
  switch (category) {
    case 'console': return <Gamepad2 className={className} />;
    case 'display': return <Tv className={className} />;
    case 'switcher': return <Route className={className} />;
    case 'adapter': return <Cable className={className} />;
    case 'upscaler': return <Maximize2 className={className} />;
    default: return <Monitor className={className} />;
  }
};

// Reusable handle with label component
const HandleWithLabel = ({ 
  type, 
  position, 
  id, 
  label, 
  backgroundColor 
}: { 
  type: 'source' | 'target';
  position: Position;
  id: string;
  label: string;
  backgroundColor: string;
}) => {
  return (
    <div className="relative handle-container">
      <Handle
        type={type}
        position={position}
        id={id}
        className="!border-2"
        style={{ 
          backgroundColor,
        }}
      />
      <span 
        className={`handle-label handle-label-${position === Position.Left ? 'left' : 'right'}`}
        >
        {label}
      </span>
    </div>
  );
};

const CustomNode = ({ data, selected, id, connectedEdges, allNodes, areSignalsCompatible }: NodeProps & { connectedEdges?: any[], allNodes?: any[], areSignalsCompatible?: (outputType: string, inputType: string) => boolean }) => {
  const onDelete = data.onDelete;
  const onUpdate = data.onUpdate;
  const nodeRef = useRef<HTMLDivElement>(null);
  const [nodeHeight, setNodeHeight] = useState(0);
  const updateNodeInternals = useUpdateNodeInternals();
  
  // Check if this is an SVS (Scalable Video Switch)
  const isSVS = data.specs?.isSVS === true;
  const maxInputs = data.specs?.maxInputs || 32;
  const maxOutputs = data.specs?.maxOutputs || 6;
  
  // SVS configuration
  const svsNumInputs = data.svsNumInputs ?? 1;
  const svsNumOutputs = data.svsNumOutputs ?? 1;
  
  // Initialize SVS arrays - ensure they always have the correct length
  let svsInputs: string[] = [];
  let svsOutputs: string[] = [];
  
  if (isSVS) {
    if (data.svsInputs && Array.isArray(data.svsInputs) && data.svsInputs.length === svsNumInputs) {
      svsInputs = data.svsInputs;
    } else {
      // Create array with correct length
      svsInputs = Array(svsNumInputs).fill('component');
    }
    
    if (data.svsOutputs && Array.isArray(data.svsOutputs) && data.svsOutputs.length === svsNumOutputs) {
      svsOutputs = data.svsOutputs;
    } else {
      // Create array with correct length
      svsOutputs = Array(svsNumOutputs).fill('component');
    }
  }
  
  // Use SVS configuration if it's an SVS, otherwise use specs
  // Always ensure arrays have at least one element for SVS
  let inputs = isSVS ? svsInputs : (data.specs?.inputs || []);
  let outputs = isSVS ? svsOutputs : (data.specs?.outputs || []);
  
  // Force arrays to have at least one element for SVS
  if (isSVS) {
    if (inputs.length === 0) {
      inputs = ['component'];
    }
    if (outputs.length === 0) {
      outputs = ['component'];
    }
  }
  
  
  // Initialize SVS configuration on first render if not present
  useEffect(() => {
    if (isSVS && onUpdate) {
      const needsInit = (
        data.svsNumInputs === undefined || 
        !data.svsInputs || 
        !Array.isArray(data.svsInputs) ||
        data.svsInputs.length !== svsNumInputs ||
        data.svsNumOutputs === undefined || 
        !data.svsOutputs || 
        !Array.isArray(data.svsOutputs) ||
        data.svsOutputs.length !== svsNumOutputs
      );
      
      if (needsInit) {
        onUpdate(id, {
          svsNumInputs: svsNumInputs,
          svsNumOutputs: svsNumOutputs,
          svsInputs: Array(svsNumInputs).fill('component'),
          svsOutputs: Array(svsNumOutputs).fill('component')
        });
      }
    }
  }, [isSVS, data.svsNumInputs, data.svsInputs, data.svsNumOutputs, data.svsOutputs, svsNumInputs, svsNumOutputs, onUpdate, id]);
  
  // Filter edges to only those connected to this node (memoized for performance)
  const nodeEdges = useMemo(() => {
    if (!connectedEdges) return [];
    return connectedEdges.filter((e: any) => e.source === id || e.target === id);
  }, [connectedEdges, id]);
  
  // For consoles, use selected output or first available
  const isConsole = data.category === 'console';
  // Use data.selectedOutput directly - don't fallback to outputs[0] to ensure changes are visible
  const selectedOutput = isConsole ? (data.selectedOutput || outputs[0] || null) : null;
  
  // Available SVS module types
  const svsModuleTypes = ['component', 'composite', 's-video', 'scart', 'vga'];
  
  // Update node internals when selectedOutput or SVS config changes
  useEffect(() => {
    if (isConsole && selectedOutput) {
      updateNodeInternals(id);
    }
    if (isSVS) {
      updateNodeInternals(id);
    }
  }, [isConsole, selectedOutput, isSVS, svsInputs, svsOutputs, id, updateNodeInternals]);
  
  // Handle SVS input count change
  const handleSVSInputCountChange = (newCount: number) => {
    const currentInputs = data.svsInputs || Array(svsNumInputs).fill('component');
    let newInputs: string[];
    
    if (newCount > svsNumInputs) {
      // Adding inputs - pad with 'component'
      newInputs = [...currentInputs, ...Array(newCount - svsNumInputs).fill('component')];
    } else {
      // Removing inputs - truncate
      newInputs = currentInputs.slice(0, newCount);
    }
    
    if (onUpdate) {
      onUpdate(id, { 
        svsNumInputs: newCount,
        svsInputs: newInputs
      });
    }
  };
  
  // Handle SVS output count change
  const handleSVSOutputCountChange = (newCount: number) => {
    const currentOutputs = data.svsOutputs || Array(svsNumOutputs).fill('component');
    let newOutputs: string[];
    
    if (newCount > svsNumOutputs) {
      // Adding outputs - pad with 'component'
      newOutputs = [...currentOutputs, ...Array(newCount - svsNumOutputs).fill('component')];
    } else {
      // Removing outputs - truncate
      newOutputs = currentOutputs.slice(0, newCount);
    }
    
    if (onUpdate) {
      onUpdate(id, { 
        svsNumOutputs: newCount,
        svsOutputs: newOutputs
      });
    }
  };
  
  // Handle SVS input type change
  const handleSVSInputTypeChange = (index: number, newType: string) => {
    const newInputs = [...svsInputs];
    newInputs[index] = newType;
    if (onUpdate) {
      onUpdate(id, { svsInputs: newInputs });
    }
  };
  
  // Handle SVS output type change
  const handleSVSOutputTypeChange = (index: number, newType: string) => {
    const newOutputs = [...svsOutputs];
    newOutputs[index] = newType;
    if (onUpdate) {
      onUpdate(id, { svsOutputs: newOutputs });
    }
  };
  
  // For switches, create port labels (SCART1, BNC1, etc.)
  // Count each port type separately (SCART1, COMPOSITE1, etc.)
  const getPortLabel = (portType: string, index: number, allPorts: string[]) => {
    // Count how many ports of this type appear before this index
    const sameTypeCount = allPorts.slice(0, index + 1).filter(p => p === portType).length;
    return `${portType.toUpperCase()}${sameTypeCount}`;
  };

  // Color mapping for different output types (same as in Editor)
  const getOutputColor = (outputType: string): string => {
    const colorMap: Record<string, string> = {
      hdmi: '#FFD700',      // Yellow/Gold
      scart: '#00FF00',     // Green
      rgb: '#FF0000',        // Red
      component: '#FF6B00',  // Orange
      's-video': '#00BFFF',  // Deep Sky Blue
      composite: '#FF69B4',  // Hot Pink
      rf: '#9370DB',         // Medium Purple
      bnc: '#FF1493',        // Deep Pink
      rca: '#FF69B4',        // Hot Pink (same as composite)
    };
    
    const normalized = outputType.toLowerCase();
    return colorMap[normalized] || 'hsl(var(--muted-foreground))'; // Default to muted
  };

  // Get color for a handle based on its connection or port type
  const getHandleColor = (handleId: string, portType: string, isInput: boolean): string => {
    // Check if handle is connected and get edge color
    if (nodeEdges.length > 0) {
      const connectedEdge = nodeEdges.find((e: any) => 
        (isInput && e.target === id && e.targetHandle === handleId) ||
        (!isInput && e.source === id && e.sourceHandle === handleId)
      );
      if (connectedEdge) {
        if (connectedEdge.data?.outputType) {
          return getOutputColor(connectedEdge.data.outputType);
        }
        if (connectedEdge.style?.stroke) {
          return connectedEdge.style.stroke as string;
        }
      }
    }
    
    // For consoles, use selected output color
    if (isConsole && !isInput && selectedOutput) {
      return getOutputColor(selectedOutput);
    }
    
    // Otherwise use port type color
    return getOutputColor(portType);
  };

  useEffect(() => {
    const updateHeight = () => {
      if (nodeRef.current) {
        setNodeHeight(nodeRef.current.offsetHeight);
      }
    };
    
    updateHeight();
    
    // Use ResizeObserver for more accurate height tracking
    const resizeObserver = new ResizeObserver(updateHeight);
    if (nodeRef.current) {
      resizeObserver.observe(nodeRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [data, inputs.length, outputs.length]);

  // Calculate handle positioning
  const handleSpacing = 12; // gap-3 = 12px
  const handleSize = 12; // w-3 h-3 = 12px
  const padding = 12; // p-3 = 12px
  const headerHeight = 32; // Approximate header height
  
  // Calculate minimum height for switchers and displays based on handle count
  const isSwitcherOrDisplay = data.category === 'switcher' || data.category === 'display' || isSVS;
  const maxHandles = isSwitcherOrDisplay ? Math.max(inputs.length, outputs.length) : 0;
  
  let minHeight: number | undefined = undefined;
  if (isSwitcherOrDisplay && maxHandles > 0) {
    // Calculate height needed: header + minimal padding + handles with spacing + minimal bottom padding
    const handlesAreaHeight = maxHandles * handleSize;
    minHeight = headerHeight + handlesAreaHeight ; // Minimal padding (4px top + 4px bottom)
  }

  return (
    <div 
      ref={nodeRef}
      className={cn(
        "min-w-[180px] rounded-lg border-2 bg-card p-3 shadow-md transition-all duration-200 relative",
        selected ? "border-primary shadow-lg shadow-primary/20" : "border-border hover:border-border/80"
      )}
      style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
    >
      {/* Delete Button */}
      {selected && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-2 -right-2 h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete?.(id)}
          data-testid="button-delete-node"
        >
          <X className="w-4 h-4" />
        </Button>
      )}

      {/* Header with Icon and Name */}
      <div className="flex items-center gap-2">
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
          {!isConsole && (
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {data.category === 'switcher' ? 'switch' : data.category}
              </p>
              {isSVS && (
                <div className="flex items-center gap-1 nodrag">
                  <Select
                    value={svsNumInputs.toString()}
                    onValueChange={(value) => handleSVSInputCountChange(parseInt(value, 10))}
                  >
                    <SelectTrigger 
                      className="h-4 px-1.5 text-[10px] font-mono border-primary/30 bg-primary/10 hover:bg-primary/20 w-auto min-w-[40px]"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <SelectValue>{svsNumInputs} IN</SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      onPointerDownOutside={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('.react-flow')) {
                          e.preventDefault();
                        }
                      }}
                    >
                      {Array.from({ length: maxInputs }, (_, i) => i + 1).map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} Input{num !== 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-muted-foreground">/</span>
                  <Select
                    value={svsNumOutputs.toString()}
                    onValueChange={(value) => handleSVSOutputCountChange(parseInt(value, 10))}
                  >
                    <SelectTrigger 
                      className="h-4 px-1.5 text-[10px] font-mono border-primary/30 bg-primary/10 hover:bg-primary/20 w-auto min-w-[40px]"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <SelectValue>{svsNumOutputs} OUT</SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      onPointerDownOutside={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('.react-flow')) {
                          e.preventDefault();
                        }
                      }}
                    >
                      {Array.from({ length: maxOutputs }, (_, i) => i + 1).map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} Output{num !== 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          {isConsole && (
            <div className="mt-1.5 nodrag">
              <Select
                value={selectedOutput || outputs[0] || ''}
                onValueChange={(value: string) => {
                  if (onUpdate) {
                    onUpdate(id, { selectedOutput: value });
                  }
                }}
              >
                <SelectTrigger 
                  className="h-6 px-2 text-[10px] font-mono border-primary/30 bg-primary/10 hover:bg-primary/20 w-full"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <SelectValue>
                    {(selectedOutput || outputs[0] || '').toUpperCase()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  onPointerDownOutside={(e) => {
                    // Prevent closing if clicking on ReactFlow canvas
                    const target = e.target as HTMLElement;
                    if (target.closest('.react-flow')) {
                      e.preventDefault();
                    }
                  }}
                >
                  {outputs.map((output: string) => {
                    // Check if this output would be incompatible with existing connections
                    let isDisabled = false;
                    if (areSignalsCompatible && allNodes && nodeEdges && nodeEdges.length > 0) {
                      try {
                        // Check all existing connections from this console
                        for (const edge of nodeEdges) {
                          if (edge.source !== id) continue; // Only check outgoing edges
                          
                          const targetNode = allNodes.find((n: any) => n.id === edge.target);
                          if (!targetNode) continue;
                          
                          // Check if target is SVS
                          const targetIsSVS = targetNode.data.specs?.isSVS === true;
                          
                          // Get the input type from the target handle
                          // For SVS nodes, use svsInputs; otherwise use specs.inputs
                          const targetInputs = targetIsSVS
                            ? (targetNode.data.svsInputs || [])
                            : (targetNode.data.specs?.inputs || []);
                          let inputType = '';
                          
                          if (edge.targetHandle) {
                            const targetMatch = edge.targetHandle.match(/in-(\d+)/);
                            if (targetMatch) {
                              const inputIndex = parseInt(targetMatch[1], 10);
                              inputType = targetInputs[inputIndex] || '';
                            }
                          } else if (targetInputs.length > 0) {
                            inputType = targetInputs[0];
                          }
                          
                          // If incompatible, disable this option
                          if (inputType && !areSignalsCompatible(output, inputType)) {
                            isDisabled = true;
                            break;
                          }
                        }
                      } catch (error) {
                        // If validation fails, don't disable (fail open)
                        console.error('Error validating output compatibility:', error);
                      }
                    }
                    
                    return (
                      <SelectItem key={output} value={output} disabled={isDisabled}>
                        {output.toUpperCase()}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* SVS Input/Output Configuration (Inside box) */}
      {isSVS && (
        <div className="mt-2 space-y-2">
          {/* Inputs */}
          <div className="space-y-1.5">
            <div className="text-[9px] font-semibold text-muted-foreground uppercase">Inputs</div>
            {inputs.map((input: string, index: number) => {
              const handleId = `in-${index}`;
              const handleColor = getHandleColor(handleId, input, true);
              
              return (
                <div key={`input-${index}`} className="flex items-center gap-2">
                  <Select
                    value={input}
                    onValueChange={(value) => handleSVSInputTypeChange(index, value)}
                  >
                    <SelectTrigger 
                      className="h-6 px-2 text-[10px] font-mono border-border bg-background hover:bg-muted flex-1 nodrag"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <SelectValue>{input.toUpperCase()}</SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      onPointerDownOutside={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('.react-flow')) {
                          e.preventDefault();
                        }
                      }}
                    >
                      {svsModuleTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
          
          {/* Outputs */}
          <div className="space-y-1.5">
            <div className="text-[9px] font-semibold text-muted-foreground uppercase">Outputs</div>
            {outputs.map((output: string, index: number) => {
              const handleId = `out-${index}`;
              const handleColor = getHandleColor(handleId, output, false);
              
              return (
                <div key={`output-${index}`} className="flex items-center gap-2">
                  <Select
                    value={output}
                    onValueChange={(value) => handleSVSOutputTypeChange(index, value)}
                  >
                    <SelectTrigger 
                      className="h-6 px-2 text-[10px] font-mono border-border bg-background hover:bg-muted flex-1 nodrag"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <SelectValue>{output.toUpperCase()}</SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      onPointerDownOutside={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('.react-flow')) {
                          e.preventDefault();
                        }
                      }}
                    >
                      {svsModuleTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SVS Handles (Outside box, aligned with dropdowns) */}
      {isSVS && (
        <>
          {/* Input Handles (Left side) - aligned with dropdowns */}
          {inputs.map((input: string, index: number) => {
            const handleId = `in-${index}`;
            const handleColor = getHandleColor(handleId, input, true);
            // Calculate position based on actual layout:
            // - Header: ~36px (icon + text + padding)
            // - mt-2: 8px
            // - "Inputs" label: ~14px (text-[9px] with line-height)
            // - space-y-1.5: 6px gap between items
            // - h-6 dropdown: 24px height
            // Position at center of each dropdown row
            const headerHeight = 36;
            const topMargin = 8; // mt-2
            const labelHeight = 14; // "Inputs" label
            const itemGap = 6; // space-y-1.5
            const dropdownHeight = 24; // h-6
            const adjustment = 10; // Adjust down slightly
            const topOffset = headerHeight + topMargin + labelHeight + itemGap + (index * (dropdownHeight + itemGap)) + (dropdownHeight / 2) + adjustment;
            
            return (
              <div
                key={`input-handle-${index}`}
                className="absolute -left-14"
                style={{ top: `${topOffset}px`, transform: 'translateY(-50%)' }}
              >
                <HandleWithLabel
                  type="target"
                  position={Position.Left}
                  id={handleId}
                  label={`IN${index + 1}`}
                  backgroundColor={handleColor}
                />
              </div>
            );
          })}
          
          {/* Output Handles (Right side) - aligned with dropdowns */}
          {outputs.map((output: string, index: number) => {
            const handleId = `out-${index}`;
            const handleColor = getHandleColor(handleId, output, false);
            // Calculate position: header + inputs section + outputs section start
            const headerHeight = 36;
            const topMargin = 8; // mt-2
            const labelHeight = 14;
            const itemGap = 6; // space-y-1.5
            const dropdownHeight = 24; // h-6
            const sectionGap = 8; // space-y-2 between sections
            const adjustment = 10; // Adjust down slightly
            // Inputs section: label + items
            const inputsSectionHeight = inputs.length > 0 
              ? labelHeight + itemGap + (inputs.length * (dropdownHeight + itemGap) - itemGap)
              : 0;
            // Outputs section start
            const outputsSectionStart = headerHeight + topMargin + inputsSectionHeight + sectionGap;
            // Position at center of each output dropdown row
            const topOffset = outputsSectionStart + labelHeight + itemGap + (index * (dropdownHeight + itemGap)) + (dropdownHeight / 2) + adjustment;
            
            return (
              <div
                key={`output-handle-${index}`}
                className="absolute -right-14"
                style={{ top: `${topOffset}px`, transform: 'translateY(-50%)' }}
              >
                <HandleWithLabel
                  type="source"
                  position={Position.Right}
                  id={handleId}
                  label={`OUT${index + 1}`}
                  backgroundColor={handleColor}
                />
              </div>
            );
          })}
        </>
      )}

      {/* Inputs (Left side) - Non-SVS */}
      {!isSVS && (
        <div 
          className="absolute -left-14 flex flex-col gap-3 top-1/2 -translate-y-1/2"
        >
          {inputs.map((input: string, index: number) => {
            const handleId = `in-${index}`;
            const label = data.category === 'switcher' ? getPortLabel(input, index, inputs) : input.toUpperCase();
            const handleColor = getHandleColor(handleId, input, true);
            
            return (
              <div key={`input-${index}`} className="relative">
                <HandleWithLabel
                  type="target"
                  position={Position.Left}
                  id={handleId}
                  label={label}
                  backgroundColor={handleColor}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Outputs (Right side) - Non-SVS */}
      {!isSVS && (
        <div 
          className="absolute -right-14 flex flex-col gap-3 top-1/2 -translate-y-1/2"
        >
          {isConsole ? (
            // Consoles: single output handle showing selected output
            selectedOutput && (
              <HandleWithLabel
                type="source"
                position={Position.Right}
                id="out-0"
                label={selectedOutput.toUpperCase()}
                backgroundColor={getHandleColor('out-0', selectedOutput, false)}
              />
            )
          ) : (
            // Switches/Displays: show port numbers
            outputs.map((output: string, index: number) => {
              const handleId = `out-${index}`;
              const label = getPortLabel(output, index, outputs);
              const handleColor = getHandleColor(handleId, output, false);
              
              return (
                <div key={`output-${index}`} className="relative">
                  <HandleWithLabel
                    type="source"
                    position={Position.Right}
                    id={handleId}
                    label={label}
                    backgroundColor={handleColor}
                  />
                </div>
              );
            })
          )}
        </div>
      )}

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

// Remove memo to ensure nodes re-render when edges change
// ReactFlow's nodeTypes memoization handles performance optimization
export default CustomNode;
