import { memo, useRef, useEffect, useState, useMemo } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow';
import { Gamepad2, Monitor, Route, Tv, X, Cable, Maximize2, Settings } from 'lucide-react';
import { cn, normalizeSignalType } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

// Icon mapping based on category
const CategoryIcon = ({ category, className }: { category: string, className?: string }) => {
  switch (category) {
    case 'console': return <Gamepad2 className={className} />;
    case 'display': return <Tv className={className} />;
    case 'switch': return <Route className={className} />;
    case 'adapter': return <Cable className={className} />;
    case 'upscaler': return <Maximize2 className={className} />;
    case 'custom': return <Settings className={className} />;
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
  
  // Check if this is an SVS (Scalable Video Switch), Custom Switch, or HDMI Switch
  const isSVS = data.specs?.isSVS === true;
  const isCustomSwitch = data.specs?.isCustomSwitch === true;
  const isHDMISwitch = data.specs?.isHDMISwitch === true;
  const isScalableSwitch = isSVS || isCustomSwitch || isHDMISwitch;
  const maxInputs = data.specs?.maxInputs || (isSVS ? 32 : 64);
  const maxOutputs = data.specs?.maxOutputs || (isSVS ? 6 : 64);
  
  // SVS/Custom Switch/HDMI Switch configuration
  const svsNumInputs = data.svsNumInputs ?? 1;
  const svsNumOutputs = data.svsNumOutputs ?? 1;
  
  // Determine default signal type based on switch type
  const defaultSignalType = isHDMISwitch ? 'hdmi' : 'ypbpr';
  
  // Initialize SVS/Custom Switch/HDMI Switch arrays - ensure they always have the correct length
  let svsInputs: string[] = [];
  let svsOutputs: string[] = [];
  
  if (isScalableSwitch) {
    if (data.svsInputs && Array.isArray(data.svsInputs) && data.svsInputs.length === svsNumInputs) {
      svsInputs = data.svsInputs;
    } else {
      // Create array with correct length and default signal type
      svsInputs = Array(svsNumInputs).fill(defaultSignalType);
    }
    
    if (data.svsOutputs && Array.isArray(data.svsOutputs) && data.svsOutputs.length === svsNumOutputs) {
      svsOutputs = data.svsOutputs;
    } else {
      // Create array with correct length and default signal type
      svsOutputs = Array(svsNumOutputs).fill(defaultSignalType);
    }
  }
  
  // For consoles and custom items (but not scalable switches), use selected output or first available
  const isConsole = data.category === 'console';
  const isCustom = data.category === 'custom' && !isScalableSwitch; // Exclude scalable switches from custom console behavior
  const isConsoleOrCustom = isConsole || isCustom;
  
  // Use SVS/Custom Switch configuration if it's scalable, otherwise use specs
  // Always ensure arrays have at least one element for scalable switches
  let inputs = isScalableSwitch ? svsInputs : (data.specs?.inputs || []);
  let baseOutputs = isScalableSwitch ? svsOutputs : (data.specs?.outputs || []);
  
  // Force arrays to have at least one element for scalable switches
  if (isScalableSwitch) {
    if (inputs.length === 0) {
      inputs = [defaultSignalType];
    }
    if (baseOutputs.length === 0) {
      baseOutputs = [defaultSignalType];
    }
  }
  
  // For consoles with addons, combine base outputs with selected addon outputs
  const selectedAddons = data.selectedAddons || [];
  const addons = data.specs?.addons || [];
  let outputs = [...baseOutputs];
  
  if (isConsole && addons.length > 0 && selectedAddons.length > 0) {
    // Add outputs from selected addons
    selectedAddons.forEach((addonId: string) => {
      const addon = addons.find((a: any) => a.id === addonId);
      if (addon && addon.outputs) {
        // Add addon outputs, avoiding duplicates
        addon.outputs.forEach((output: string) => {
          if (!outputs.includes(output)) {
            outputs.push(output);
          }
        });
      }
    });
  }
  
  
  // Initialize SVS/Custom Switch configuration on first render if not present
  useEffect(() => {
    if (isScalableSwitch && onUpdate) {
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
          svsInputs: Array(svsNumInputs).fill(defaultSignalType),
          svsOutputs: Array(svsNumOutputs).fill(defaultSignalType)
        });
      }
    }
  }, [isScalableSwitch, data.svsNumInputs, data.svsInputs, data.svsNumOutputs, data.svsOutputs, svsNumInputs, svsNumOutputs, onUpdate, id]);
  
  // Filter edges to only those connected to this node (memoized for performance)
  const nodeEdges = useMemo(() => {
    if (!connectedEdges) return [];
    return connectedEdges.filter((e: any) => e.source === id || e.target === id);
  }, [connectedEdges, id]);
  
  // Use data.selectedOutput directly - don't fallback to outputs[0] to ensure changes are visible
  const selectedOutput = isConsoleOrCustom ? (data.selectedOutput || outputs[0] || null) : null;
  
  // Available SVS module types (limited set)
  const svsModuleTypes = ['ypbpr', 'composite', 's-video', 'scart', 'vga'];
  // Available Custom Switch module types (all types)
  const customSwitchModuleTypes = ['rf', 'composite', 's-video', 'rgb', 'ypbpr', 'hdmi', 'scart', 'bnc', 'rca', 'vga'];
  // Use appropriate module types based on switch type
  const switchModuleTypes = isCustomSwitch ? customSwitchModuleTypes : svsModuleTypes;
  
  // Update node internals when selectedOutput, selectedAddons, or SVS/Custom Switch config changes
  useEffect(() => {
    if (isConsoleOrCustom && selectedOutput) {
      updateNodeInternals(id);
    }
    if (isScalableSwitch) {
      updateNodeInternals(id);
    }
    if (isConsole && selectedAddons.length > 0) {
      updateNodeInternals(id);
    }
  }, [isConsoleOrCustom, selectedOutput, isScalableSwitch, svsInputs, svsOutputs, isConsole, selectedAddons, id, updateNodeInternals]);
  
  // Handle SVS input count change
  const handleSVSInputCountChange = (newCount: number) => {
    const currentInputs = data.svsInputs || Array(svsNumInputs).fill(defaultSignalType);
    let newInputs: string[];
    
    if (newCount > svsNumInputs) {
      // Adding inputs - pad with default signal type (hdmi for HDMI switch, ypbpr for others)
      newInputs = [...currentInputs, ...Array(newCount - svsNumInputs).fill(defaultSignalType)];
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
    const currentOutputs = data.svsOutputs || Array(svsNumOutputs).fill(defaultSignalType);
    let newOutputs: string[];
    
    if (newCount > svsNumOutputs) {
      // Adding outputs - pad with default signal type (hdmi for HDMI switch, ypbpr for others)
      newOutputs = [...currentOutputs, ...Array(newCount - svsNumOutputs).fill(defaultSignalType)];
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
      ypbpr: '#FF6B00',  // Orange
      's-video': '#00BFFF',  // Deep Sky Blue
      composite: '#FF69B4',  // Hot Pink
      rf: '#9370DB',         // Medium Purple
      bnc: '#FF1493',        // Deep Pink
      rca: '#FF69B4',        // Hot Pink (same as composite)
    };
    
    const normalized = normalizeSignalType(outputType).toLowerCase();
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
    if (isConsoleOrCustom && !isInput && selectedOutput) {
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
  const isSwitcherOrDisplay = data.category === 'switch' || data.category === 'display' || isSVS;
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
          {/* Editable name for custom items (including Custom Switch and HDMI Switch) - only show input when selected */}
          {(isCustom || isCustomSwitch || isHDMISwitch) && selected ? (
            <div className="nodrag">
              <Input
                value={data.label || ''}
                onChange={(e) => {
                  if (onUpdate) {
                    onUpdate(id, { label: e.target.value });
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="h-6 px-2 text-xs font-display font-bold border-primary/30 bg-primary/10 hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Enter name..."
              />
            </div>
          ) : isConsole && data.variants && data.variants.length > 0 && selected ? (
            /* Variant selector for consoles with variants - only show dropdown when selected */
            <div className="nodrag">
              <Select
                value={data.variantIndex !== undefined ? data.variantIndex.toString() : '0'}
                onValueChange={(value: string) => {
                  const index = parseInt(value, 10);
                  if (onUpdate && data.variants && data.variants[index]) {
                    onUpdate(id, { 
                      variantIndex: index,
                      label: data.variants[index].name 
                    });
                  }
                }}
              >
                <SelectTrigger 
                  className="h-6 px-2 text-xs font-display font-bold border-primary/30 bg-primary/10 hover:bg-primary/20 w-full"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <SelectValue>
                    {data.variants[data.variantIndex ?? 0]?.name || data.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  onPointerDownOutside={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('.react-flow')) {
                      e.preventDefault();
                    }
                  }}
                >
                  {data.variants.map((variant: any, index: number) => (
                    <SelectItem key={index} value={index.toString()}>
                      <div className="flex flex-col">
                        <span className="font-semibold">{variant.name}</span>
                        <span className="text-xs text-muted-foreground">{variant.region}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <h3 className="font-display text-sm font-bold truncate leading-none text-foreground">
              {data.label}
            </h3>
          )}
          {!isConsoleOrCustom && (
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {data.category === 'switch' ? 'switch' : data.category}
              </p>
              {isScalableSwitch && (
                <div className="flex items-center gap-1 nodrag">
                  {selected ? (
                    <Input
                      type="number"
                      min="1"
                      max={maxInputs}
                      value={svsNumInputs}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (!isNaN(value) && value >= 1 && value <= maxInputs) {
                          handleSVSInputCountChange(value);
                        }
                      }}
                      onBlur={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (isNaN(value) || value < 1) {
                          handleSVSInputCountChange(1);
                        } else if (value > maxInputs) {
                          handleSVSInputCountChange(maxInputs);
                        }
                      }}
                      className="h-4 px-1.5 text-[10px] font-mono border-primary/30 bg-primary/10 hover:bg-primary/20 w-12 text-center"
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="h-4 px-1.5 text-[10px] font-mono w-12 text-center inline-flex items-center justify-center">
                      {svsNumInputs}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">IN /</span>
                  {selected ? (
                    <Input
                      type="number"
                      min="1"
                      max={maxOutputs}
                      value={svsNumOutputs}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (!isNaN(value) && value >= 1 && value <= maxOutputs) {
                          handleSVSOutputCountChange(value);
                        }
                      }}
                      onBlur={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (isNaN(value) || value < 1) {
                          handleSVSOutputCountChange(1);
                        } else if (value > maxOutputs) {
                          handleSVSOutputCountChange(maxOutputs);
                        }
                      }}
                      className="h-4 px-1.5 text-[10px] font-mono border-primary/30 bg-primary/10 hover:bg-primary/20 w-12 text-center"
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="h-4 px-1.5 text-[10px] font-mono w-12 text-center inline-flex items-center justify-center">
                      {svsNumOutputs}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">OUT</span>
                </div>
              )}
            </div>
          )}
          {/* Addon Checkboxes - show selected addons always, show all checkboxes when console is selected */}
          {isConsole && addons.length > 0 && (
            <>
              {selected ? (
                // Show all addons as editable checkboxes when console is selected
                <div className="mt-1.5 nodrag">
                  <div className="text-[9px] text-muted-foreground mb-1">Addons:</div>
                  <div className="flex flex-col gap-1">
                    {addons.map((addon: any) => {
                      const isSelected = selectedAddons.includes(addon.id);
                      return (
                        <label
                          key={addon.id}
                          className="flex items-center gap-1.5 cursor-pointer text-[10px]"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (onUpdate) {
                                const newSelectedAddons = e.target.checked
                                  ? [...selectedAddons, addon.id]
                                  : selectedAddons.filter((id: string) => id !== addon.id);
                                onUpdate(id, { selectedAddons: newSelectedAddons });
                              }
                            }}
                            className="w-3 h-3 rounded border-primary/30 accent-primary"
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                          <span>{addon.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Show only selected addons as read-only when console is not selected
                selectedAddons.length > 0 && (
                  <div className="mt-1.5">
                    <div className="text-[9px] text-muted-foreground mb-1">Addons:</div>
                    <div className="flex flex-col gap-1">
                      {addons
                        .filter((addon: any) => selectedAddons.includes(addon.id))
                        .map((addon: any) => (
                          <div key={addon.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="w-3 h-3 flex items-center justify-center">✓</span>
                            <span>{addon.name}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )
              )}
            </>
          )}
          {isConsoleOrCustom && (
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
                        // Check all existing connections from this console/custom item
                        for (const edge of nodeEdges) {
                          if (edge.source !== id) continue; // Only check outgoing edges
                          
                          const targetNode = allNodes.find((n: any) => n.id === edge.target);
                          if (!targetNode) continue;
                          
                          // Check if target is a scalable switch (SVS, Custom Switch, or HDMI Switch)
                          const targetIsScalableSwitch = targetNode.data.specs?.isSVS === true || 
                                                         targetNode.data.specs?.isCustomSwitch === true || 
                                                         targetNode.data.specs?.isHDMISwitch === true;
                          
                          // Get the input type from the target handle
                          // For scalable switch nodes, use svsInputs; otherwise use specs.inputs
                          const targetInputs = targetIsScalableSwitch
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
                          if (inputType && !areSignalsCompatible(normalizeSignalType(output), normalizeSignalType(inputType))) {
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

      {/* SVS/Custom Switch Input/Output Configuration (Inside box) */}
      {isScalableSwitch && (
        <div className="mt-2 space-y-2">
          {/* Inputs */}
          <div className="space-y-1.5">
            <div className="text-[9px] font-semibold text-muted-foreground uppercase">Inputs</div>
            {inputs.map((input: string, index: number) => {
              const handleId = `in-${index}`;
              const handleColor = getHandleColor(handleId, input, true);
              
              return (
                <div key={`input-${index}`} className="flex items-center gap-2">
                  {isHDMISwitch ? (
                    // HDMI Switch: just show label, no dropdown
                    <div className="h-6 px-2 text-[10px] font-mono border-border bg-background flex-1 flex items-center">
                      {input.toUpperCase()}
                    </div>
                  ) : (
                    // SVS/Custom Switch: show dropdown for type selection
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
                        {switchModuleTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
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
                  {isHDMISwitch ? (
                    // HDMI Switch: just show label, no dropdown
                    <div className="h-6 px-2 text-[10px] font-mono border-border bg-background flex-1 flex items-center">
                      {output.toUpperCase()}
                    </div>
                  ) : (
                    // SVS/Custom Switch: show dropdown for type selection
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
                        {switchModuleTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SVS/Custom Switch Handles (Outside box, aligned with dropdowns) */}
      {isScalableSwitch && (
        <>
          {/* Input Handles (Left side) - aligned with dropdowns */}
          {inputs.map((input: string, index: number) => {
            const handleId = `in-${index}`;
            const normalizedInput = normalizeSignalType(input);
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

      {/* Inputs (Left side) - Non-Scalable Switch */}
      {!isScalableSwitch && (
        <div 
          className="absolute -left-14 flex flex-col gap-3 top-1/2 -translate-y-1/2"
        >
          {inputs.map((input: string, index: number) => {
            const handleId = `in-${index}`;
            const label = data.category === 'switch' ? getPortLabel(input, index, inputs) : input.toUpperCase();
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

      {/* Outputs (Right side) - Non-Scalable Switch */}
      {!isScalableSwitch && (
        <div 
          className="absolute -right-14 flex flex-col gap-3 top-1/2 -translate-y-1/2"
        >
          {isConsoleOrCustom ? (
            // Consoles and custom items: single output handle showing selected output
            selectedOutput && (
              <HandleWithLabel
                type="source"
                position={Position.Right}
                id="out-0"
                label={normalizeSignalType(selectedOutput).toUpperCase()}
                backgroundColor={getHandleColor('out-0', selectedOutput, false)}
              />
            )
          ) : (
            // Switches/Displays: show port numbers
            outputs.map((output: string, index: number) => {
              const handleId = `out-${index}`;
              const normalizedOutput = normalizeSignalType(output);
              const label = getPortLabel(normalizedOutput, index, outputs.map(o => normalizeSignalType(o)));
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
