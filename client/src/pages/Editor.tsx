import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  Edge,
  Node,
  MarkerType,
  BackgroundVariant,
  Panel,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Sidebar } from '@/components/Sidebar';
import CustomNode from '@/components/CustomNode';
import CustomEdge from '@/components/CustomEdge';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, ArrowLeft, Share2, Upload, FileText, Grid3X3, Copy, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { saveFile, loadFile, loadFileFromRecent, type DiagramFile } from '@/lib/fileUtils';
import { encodeDiagramShareCode, decodeDiagramShareCode, SHARE_CODE_PREFIX } from '@/lib/shareCode';
import { buildSeedDataFromCatalogItem } from '@/lib/catalogNodeDefaults';
import { normalizeSignalType } from '@/lib/utils';
import { useItems } from '@/hooks/use-items';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Register custom node types with edges access
// Pass all edges - CustomNode will filter them internally for better memoization
const createNodeTypes = (edges: any[], nodesRef: { current: any[] }, areSignalsCompatibleRef: { current: (outputType: string, inputType: string) => boolean }) => ({
  equipment: (props: any) => <CustomNode {...props} connectedEdges={edges} allNodes={nodesRef.current} areSignalsCompatible={areSignalsCompatibleRef.current} />,
});

// Register custom edge types
const edgeTypes = {
  default: CustomEdge,
};

// Initial empty state
const initialNodes: any[] = [];
const initialEdges: any[] = [];

// Helper function to get the next available node ID based on existing nodes
const getNextNodeId = (existingNodes: any[]): string => {
  if (existingNodes.length === 0) {
    return 'dndnode_0';
  }
  
  // Extract all numeric IDs from existing nodes
  const ids = existingNodes
    .map(node => {
      const match = node.id?.match(/^dndnode_(\d+)$/);
      return match ? parseInt(match[1], 10) : -1;
    })
    .filter(id => id >= 0);
  
  // Find the highest ID and increment
  const maxId = ids.length > 0 ? Math.max(...ids) : -1;
  return `dndnode_${maxId + 1}`;
};

function EditorContent({ diagramName: initialDiagramName }: { diagramName?: string }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // Check if two signal types are compatible
  const areSignalsCompatible = useCallback((outputType: string, inputType: string): boolean => {
    const output = normalizeSignalType(outputType).toLowerCase();
    const input = normalizeSignalType(inputType).toLowerCase();
    
    // Same type is always compatible
    if (output === input) return true;
    
    // Digital signals (HDMI) cannot connect to analog
    const digitalSignals = ['hdmi'];
    const analogSignals = ['scart', 'composite', 'rca', 's-video', 'ypbpr', 'rgb', 'rf', 'bnc', 'vga'];
    
    if (digitalSignals.includes(output) && analogSignals.includes(input)) return false;
    if (analogSignals.includes(output) && digitalSignals.includes(input)) return false;
    
    // RF (modulated signal) can only connect to RF
    if (output === 'rf') {
      return input === 'rf';
    }
    if (input === 'rf') {
      // RF input can only accept RF signal (modulated)
      return output === 'rf';
    }
    
    // YPbPR cannot connect to Composite or S-Video
    if (output === 'ypbpr') {
      if (input === 'composite' || input === 'rca' || input === 's-video') return false;
    }
    if (input === 'ypbpr') {
      if (output === 'composite' || output === 'rca' || output === 's-video') return false;
    }
    
    // Composite cannot connect to YPbPR
    if ((output === 'composite' || output === 'rca') && input === 'ypbpr') return false;
    if (output === 'ypbpr' && (input === 'composite' || input === 'rca')) return false;
    
    // Composite cannot connect to S-Video (different signal formats)
    if ((output === 'composite' || output === 'rca') && input === 's-video') return false;
    if (output === 's-video' && (input === 'composite' || input === 'rca')) return false;
    
    // RGB cannot connect to YPbPR (needs converter, unless through upscaler)
    if (output === 'rgb') {
      if (input === 'ypbpr') return false;
    }
    if (input === 'rgb') {
      if (output === 'ypbpr') return false;
    }
    
    // All other analog-to-analog connections are potentially valid (may need converters)
    return true;
  }, []);
  
  // Use refs to store latest nodes and areSignalsCompatible to avoid recreating nodeTypes
  const nodesRef = useRef(nodes);
  const areSignalsCompatibleRef = useRef(areSignalsCompatible);
  
  // Update refs when values change
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  
  useEffect(() => {
    areSignalsCompatibleRef.current = areSignalsCompatible;
  }, [areSignalsCompatible]);
  
  // Memoize nodeTypes to prevent ReactFlow from recreating nodes on every render
  // Only depend on edges, use refs for nodes and areSignalsCompatible
  const nodeTypes = useMemo(() => {
    return createNodeTypes(edges, nodesRef, areSignalsCompatibleRef);
  }, [edges]);
  
  // Intercept onNodesChange to prevent deselection when clicking on Select dropdowns
  const handleNodesChange = useCallback((changes: any[]) => {
    // Check if any change is trying to deselect nodes
    const hasDeselection = changes.some((change: any) => 
      change.type === 'select' && change.selected === false
    );
    
    // Only intercept if there are deselection changes AND a Select is actually open
    if (hasDeselection) {
      // Check if there's an open Select dropdown - must have data-state="open"
      const selectContent = document.querySelector('[data-radix-select-content][data-state="open"]');
      
      if (selectContent) {
        // A Select is open, prevent deselection to avoid closing the dropdown
        // Filter out only the deselection changes, keep all other changes (position, dimensions, etc.)
        const filteredChanges = changes.filter((change: any) => 
          !(change.type === 'select' && change.selected === false)
        );
        // Always apply changes, even if empty (ReactFlow expects this)
        onNodesChange(filteredChanges);
        return;
      }
    }
    
    // Otherwise, proceed with all normal node changes (including dragging, positioning, etc.)
    onNodesChange(changes);
  }, [onNodesChange]);
  
  // Handle edge updates to preserve colors and output types when edges are dragged
  const handleEdgesChange = useCallback((changes: any[]) => {
    // Use the default handler first
    onEdgesChange(changes);
    
    // Then preserve edge data (output type, color) for any edge updates
    changes.forEach((change: any) => {
      if (change.type === 'change' && change.item) {
        const existingEdge = edges.find((e: any) => e.id === change.item.id);
        if (existingEdge && (change.item.target !== existingEdge.target || change.item.targetHandle !== existingEdge.targetHandle)) {
          // Edge target changed - preserve output type and color, but update target
          setEdges((eds: any[]) =>
            eds.map((e: any) => {
              if (e.id === change.item.id) {
                return {
                  ...change.item,
                  data: existingEdge.data, // Preserve output type
                  style: existingEdge.style, // Preserve color
                  markerEnd: existingEdge.markerEnd, // Preserve arrow color
                };
              }
              return e;
            })
          );
        }
      }
    });
  }, [edges, onEdgesChange, setEdges]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [diagramName, setDiagramName] = useState(initialDiagramName || 'Untitled Setup');
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareExportText, setShareExportText] = useState('');
  const [shareExportBusy, setShareExportBusy] = useState(false);
  const [shareImportText, setShareImportText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shouldFitView, setShouldFitView] = useState(true);
  const needsFitViewAfterLoadRef = useRef(false);

  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: items } = useItems();

  // Color mapping for different output types
  const getOutputColor = useCallback((outputType: string): string => {
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
      vga: '#8A2BE2',        // Blue Violet
    };
    
    const normalized = outputType.toLowerCase();
    return colorMap[normalized] || 'hsl(var(--primary))'; // Default to primary color
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds: Node[]) => nds.filter((n: Node) => n.id !== nodeId));
    setEdges((eds: Edge[]) => eds.filter((e: Edge) => e.source !== nodeId && e.target !== nodeId));
    toast({
      title: "YPbPR Removed",
      description: "Node and connected edges deleted.",
      duration: 1500,
    });
  }, [setNodes, setEdges, toast]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setEdges((eds: Edge[]) => eds.filter((e: Edge) => e.id !== edgeId));
    toast({
      title: "Connection Removed",
      description: "Connection deleted.",
      duration: 1500,
    });
  }, [setEdges, toast]);

  // Deselect all nodes and edges when user focuses on search input
  const handleDeselectAll = useCallback(() => {
    setNodes((nds: Node[]) => nds.map((n: Node) => ({ ...n, selected: false })));
    setEdges((eds: Edge[]) => eds.map((e: Edge) => ({ ...e, selected: false })));
  }, [setNodes, setEdges]);

  const handleUpdateNode = useCallback((nodeId: string, updates: any) => {
    // If console or custom game machine (non-scalable) output changed, validate all existing connections first
    if (updates.selectedOutput) {
      const sourceNode = nodes.find(n => n.id === nodeId);
      const sourceIsScalableSwitch = sourceNode?.data?.specs?.isSVS === true || 
                                     sourceNode?.data?.specs?.isCustomSwitch === true || 
                                     sourceNode?.data?.specs?.isHDMISwitch === true;
      
      // Only validate for consoles and custom game machines (not scalable switches)
      if ((sourceNode?.data?.category === 'console' || sourceNode?.data?.category === 'custom') && !sourceIsScalableSwitch) {
        const newOutputType = updates.selectedOutput;
        
        // Check all existing connections from this console/custom item
        const connectedEdges = edges.filter((e: any) => e.source === nodeId);
        
        for (const edge of connectedEdges) {
          const targetNode = nodes.find(n => n.id === edge.target);
          if (!targetNode) continue;
          
          // Check if target is a scalable switch, custom display, or switch with variants
          const targetIsScalableSwitch = targetNode.data.specs?.isSVS === true || 
                                        targetNode.data.specs?.isCustomSwitch === true || 
                                        targetNode.data.specs?.isHDMISwitch === true;
          const targetIsCustomDisplay = targetNode.data.category === 'display' && targetNode.data.specs?.customizableInputs === true;
          const targetHasSwitchVariants = targetNode.data.category === 'switch' && targetNode.data.specs?.switchVariants?.length > 0;
          
          // Get the input type from the target handle
          const targetInputs = targetIsScalableSwitch
            ? (targetNode.data.svsInputs || [])
            : targetIsCustomDisplay
              ? (targetNode.data.customInputs || targetNode.data.specs?.inputs || [])
              : targetHasSwitchVariants
                ? (targetNode.data.specs?.switchVariants?.[targetNode.data.switchVariantIndex ?? 0]?.inputs || targetNode.data.specs?.inputs || [])
                : (targetNode.data.specs?.inputs || []);
          let inputType = '';
          
          if (edge.targetHandle) {
            const targetMatch = edge.targetHandle.match(/in-(\d+)/);
            if (targetMatch) {
              const inputIndex = parseInt(targetMatch[1], 10);
              inputType = targetInputs[inputIndex] || '';
            }
          } else if (targetInputs.length > 0) {
            // Fallback to first input if no handle specified
            inputType = targetInputs[0];
          }
          
          // Validate compatibility (normalize to strip "(modded)" for comparison)
          if (inputType && !areSignalsCompatible(normalizeSignalType(newOutputType), normalizeSignalType(inputType))) {
            toast({
              title: "Invalid Output Change",
              description: `Cannot change to ${normalizeSignalType(newOutputType).toUpperCase()}: incompatible with ${targetNode.data.label}'s ${normalizeSignalType(inputType).toUpperCase()} input.`,
              variant: "destructive",
              duration: 3000,
            });
            return; // Prevent the update
          }
        }
      }
    }
    
    // Update the node
    setNodes((nds) => {
      const sourceNode = nds.find(n => n.id === nodeId);
      const updatedNodes = nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...updates,
              _updated: Date.now(),
            },
          };
        }
        return node;
      });
      
      // If console or custom game machine (non-scalable) output changed, update connected edges and target nodes
      const sourceIsScalableSwitch = sourceNode?.data?.specs?.isSVS === true || 
                                     sourceNode?.data?.specs?.isCustomSwitch === true || 
                                     sourceNode?.data?.specs?.isHDMISwitch === true;
      if (updates.selectedOutput && (sourceNode?.data?.category === 'console' || sourceNode?.data?.category === 'custom') && !sourceIsScalableSwitch) {
        const newOutputType = updates.selectedOutput;
        const normalizedOutputType = normalizeSignalType(newOutputType);
        const edgeColor = getOutputColor(normalizedOutputType);
        
        // Find target nodes and update edges
        const targetNodeIds: string[] = [];
        setEdges((eds) => {
          const updatedEdges = eds.map((edge) => {
            // Check if this edge is from our console/custom node
            // For consoles and custom items, update ALL edges from this node (they only have one output)
            if (edge.source === nodeId) {
              if (!targetNodeIds.includes(edge.target)) {
                targetNodeIds.push(edge.target);
              }
              return {
                ...edge,
                data: { ...edge.data, outputType: normalizedOutputType },
                style: { ...edge.style, stroke: edgeColor },
                markerEnd: { ...edge.markerEnd, color: edgeColor },
              };
            }
            return edge;
          });
          
          // Update target nodes immediately to force re-render
          // This ensures they pick up the new edge colors
          if (targetNodeIds.length > 0) {
            // Use a microtask to ensure this runs after edges are set
            Promise.resolve().then(() => {
              setNodes((nds2) => {
                return nds2.map((node) => {
                  if (targetNodeIds.includes(node.id)) {
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        _edgeUpdated: Date.now(),
                      },
                    };
                  }
                  return node;
                });
              });
            });
          }
          
          return updatedEdges;
        });
      }
      
      return updatedNodes;
    });
  }, [setNodes, setEdges, getOutputColor, nodes, edges, areSignalsCompatible, toast]);

  // Process edges to restore colors based on output type
  const processEdgesWithColors = useCallback((edges: any[], nodes: any[]): any[] => {
    return edges.map((edge: any) => {
      // If edge already has outputType in data, use it (but prefer target input for BNC/RCA)
      if (edge.data?.outputType) {
        let displayType = normalizeSignalType(edge.data.outputType);
        if (['bnc', 'rca'].includes(displayType.toLowerCase())) {
          const targetNode = nodes.find((n: any) => n.id === edge.target);
          if (targetNode && edge.targetHandle) {
            const targetIsScalableSwitch = targetNode.data?.specs?.isSVS === true || targetNode.data?.specs?.isCustomSwitch === true || targetNode.data?.specs?.isHDMISwitch === true;
            const targetIsCustomDisplay = targetNode.data?.category === 'display' && targetNode.data?.specs?.customizableInputs === true;
            const targetHasSwitchVariants = targetNode.data?.category === 'switch' && targetNode.data?.specs?.switchVariants?.length > 0;
            const targetInputs = targetIsScalableSwitch ? (targetNode.data?.svsInputs || []) : targetIsCustomDisplay ? (targetNode.data?.customInputs || targetNode.data?.specs?.inputs || []) : targetHasSwitchVariants ? (targetNode.data?.specs?.switchVariants?.[targetNode.data?.switchVariantIndex ?? 0]?.inputs || targetNode.data?.specs?.inputs || []) : (targetNode.data?.specs?.inputs || []);
            const inputMatch = edge.targetHandle.match(/in-(\d+)/);
            const inputIndex = inputMatch ? parseInt(inputMatch[1], 10) : 0;
            const inputType = targetInputs[inputIndex];
            if (inputType) displayType = normalizeSignalType(inputType);
          }
        }
        const color = getOutputColor(displayType);
        return {
          ...edge,
          data: { ...edge.data, outputType: displayType, onDelete: handleDeleteEdge },
          style: { ...edge.style, stroke: color },
          markerEnd: { ...edge.markerEnd, color },
        };
      }
      
      // Otherwise, try to infer from source node
      const sourceNode = nodes.find((n: any) => n.id === edge.source);
      const targetNode = nodes.find((n: any) => n.id === edge.target);
      if (sourceNode) {
        let outputType: string | undefined;
        const sourceIsScalableSwitch = sourceNode.data?.specs?.isSVS === true || sourceNode.data?.specs?.isCustomSwitch === true || sourceNode.data?.specs?.isHDMISwitch === true;
        const sourceHasSwitchVariants = sourceNode.data?.category === 'switch' && sourceNode.data?.specs?.switchVariants?.length > 0;
        
        if (sourceNode.data?.category === 'console') {
          // For consoles, get combined outputs (base + addon outputs)
          let combinedOutputs = [...(sourceNode.data.specs?.outputs || [])];
          if (sourceNode.data.specs?.addons) {
            const selectedAddons = sourceNode.data.selectedAddons || [];
            selectedAddons.forEach((addonId: string) => {
              const addon = sourceNode.data.specs.addons.find((a: any) => a.id === addonId);
              if (addon && addon.outputs) {
                addon.outputs.forEach((output: string) => {
                  if (!combinedOutputs.includes(output)) {
                    combinedOutputs.push(output);
                  }
                });
              }
            });
          }
          outputType = sourceNode.data.selectedOutput || combinedOutputs[0];
        } else if (sourceIsScalableSwitch && edge.sourceHandle) {
          const handleIndex = parseInt(edge.sourceHandle.split('-')[1] || '0');
          outputType = sourceNode.data?.svsOutputs?.[handleIndex];
        } else if (sourceHasSwitchVariants && edge.sourceHandle) {
          const variantIndex = sourceNode.data?.switchVariantIndex ?? 0;
          const variant = sourceNode.data?.specs?.switchVariants?.[variantIndex];
          const handleIndex = parseInt(edge.sourceHandle.split('-')[1] || '0');
          outputType = variant?.outputs?.[handleIndex];
        } else if (edge.sourceHandle) {
          const handleIndex = parseInt(edge.sourceHandle.split('-')[1] || '0');
          outputType = sourceNode.data?.specs?.outputs?.[handleIndex];
        }
        
        if (outputType) {
          const normalizedOutputType = normalizeSignalType(outputType);
          let displayType = normalizedOutputType;
          // For BNC/RCA connector types, use target input for color (actual signal type)
          if (['bnc', 'rca'].includes(normalizedOutputType.toLowerCase()) && targetNode) {
            const targetIsScalableSwitch = targetNode.data?.specs?.isSVS === true || targetNode.data?.specs?.isCustomSwitch === true || targetNode.data?.specs?.isHDMISwitch === true;
            const targetIsCustomDisplay = targetNode.data?.category === 'display' && targetNode.data?.specs?.customizableInputs === true;
            const targetHasSwitchVariants = targetNode.data?.category === 'switch' && targetNode.data?.specs?.switchVariants?.length > 0;
            const targetInputs = targetIsScalableSwitch ? (targetNode.data?.svsInputs || []) : targetIsCustomDisplay ? (targetNode.data?.customInputs || targetNode.data?.specs?.inputs || []) : targetHasSwitchVariants ? (targetNode.data?.specs?.switchVariants?.[targetNode.data?.switchVariantIndex ?? 0]?.inputs || targetNode.data?.specs?.inputs || []) : (targetNode.data?.specs?.inputs || []);
            const inputMatch = edge.targetHandle?.match(/in-(\d+)/);
            const inputIndex = inputMatch ? parseInt(inputMatch[1], 10) : 0;
            const inputType = targetInputs[inputIndex];
            if (inputType) displayType = normalizeSignalType(inputType);
          }
          const color = getOutputColor(displayType);
          return {
            ...edge,
            data: { outputType: displayType, onDelete: handleDeleteEdge },
            style: { ...edge.style, stroke: color },
            markerEnd: { ...edge.markerEnd, color },
          };
        }
      }
      
      return {
        ...edge,
        data: { ...edge.data, onDelete: handleDeleteEdge }, // Ensure onDelete is present even if no outputType
      };
    });
  }, [getOutputColor, handleDeleteEdge]);

  const applyDiagram = useCallback(
    (diagram: DiagramFile) => {
      setDiagramName(diagram.name);
      const flow = diagram.data;
      if (flow) {
        const nodesWithDelete = (flow.nodes || []).map((node: any) => ({
          ...node,
          data: { ...node.data, onDelete: handleDeleteNode, onUpdate: handleUpdateNode },
        }));
        setNodes(nodesWithDelete);
        const processedEdges = processEdgesWithColors(flow.edges || [], nodesWithDelete);
        setEdges(processedEdges);
        needsFitViewAfterLoadRef.current = true;
      }
    },
    [setNodes, setEdges, handleDeleteNode, handleUpdateNode, processEdgesWithColors],
  );

  // Call fitView after load when instance is ready - use method with explicit nodes and delay for DOM to update
  useEffect(() => {
    if (!reactFlowInstance || !needsFitViewAfterLoadRef.current || nodes.length === 0) return;
    needsFitViewAfterLoadRef.current = false;
    const timer = setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 200, nodes });
    }, 150);
    return () => clearTimeout(timer);
  }, [reactFlowInstance, nodes]);

  // Load diagram data if provided (from recent files when navigating to /editor/:name)
  useEffect(() => {
    if (initialDiagramName) {
      const diagram = loadFileFromRecent(initialDiagramName);
      if (diagram) {
        applyDiagram(diagram);
      }
    }
  }, [initialDiagramName, applyDiagram]);

  const shareFromHashDoneRef = useRef(false);
  useEffect(() => {
    if (shareFromHashDoneRef.current) return;
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw.startsWith(SHARE_CODE_PREFIX)) return;
    if (items == null) return;
    shareFromHashDoneRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const diagram = await decodeDiagramShareCode(raw, items);
        if (cancelled) return;
        applyDiagram(diagram);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        toast({
          title: 'Loaded from link',
          description: `Opened ${diagram.name}`,
        });
      } catch {
        shareFromHashDoneRef.current = false;
        toast({
          title: 'Invalid share link',
          description: 'The URL fragment could not be decoded as a setup.',
          variant: 'destructive',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyDiagram, toast, items]);

  // Handle keyboard delete for nodes and edges
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't handle delete/backspace if user is typing in an input field
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable
        );
        
        if (isInputFocused) {
          return; // Let the input handle the keypress
        }
        
        // Don't handle delete/backspace if focus is within the sidebar
        // Check if the active element is within an <aside> element (the sidebar)
        const sidebarElement = activeElement?.closest('aside');
        if (sidebarElement) {
          return; // User is interacting with sidebar, don't delete workspace items
        }
        
        // Check if any edges are selected
        const selectedEdges = edges.filter((e: any) => e.selected);
        if (selectedEdges.length > 0) {
          setEdges((eds) => eds.filter((e) => !selectedEdges.includes(e)));
          toast({
            title: "Connection Removed",
            description: "Selected connection(s) deleted.",
            duration: 1500,
          });
          return;
        }
        
        // Check if any nodes are selected
        if (nodes.some(n => n.selected)) {
          const selectedNode = nodes.find(n => n.selected);
          if (selectedNode) {
            handleDeleteNode(selectedNode.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, handleDeleteNode, setEdges, toast]);

  // Check if connection is valid (only one connection per handle)
  // This is called during drag, so we don't remove connections here
  const isValidConnection = useCallback((connection: Connection) => {
    // Get source and target nodes
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    
    if (!sourceNode || !targetNode) return false;
    
    // Check if nodes are scalable switches (SVS, Custom Switch, or HDMI Switch) or custom display
    const sourceIsScalableSwitch = sourceNode.data.specs?.isSVS === true || 
                                   sourceNode.data.specs?.isCustomSwitch === true || 
                                   sourceNode.data.specs?.isHDMISwitch === true;
    const targetIsScalableSwitch = targetNode.data.specs?.isSVS === true || 
                                   targetNode.data.specs?.isCustomSwitch === true || 
                                   targetNode.data.specs?.isHDMISwitch === true;
    const targetIsCustomDisplay = targetNode.data.category === 'display' && targetNode.data.specs?.customizableInputs === true;
    
    // Get output and input types from the handles
    // For scalable switch nodes, use svsOutputs/svsInputs; for Custom TV, use customInputs; for switch variants (Extron), use variant; otherwise use specs
    // For consoles with addons, combine base outputs with selected addon outputs
    const sourceHasSwitchVariants = sourceNode.data.category === 'switch' && sourceNode.data.specs?.switchVariants?.length > 0;
    const targetHasSwitchVariants = targetNode.data.category === 'switch' && targetNode.data.specs?.switchVariants?.length > 0;
    const sourceHasSimultaneousOutputs = sourceNode.data.specs?.simultaneousOutputs === true;
    
    let sourceOutputs: string[] = [];
    if (sourceIsScalableSwitch) {
      sourceOutputs = sourceNode.data.svsOutputs || [];
    } else if (sourceHasSwitchVariants) {
      const variantIndex = sourceNode.data.switchVariantIndex ?? 0;
      const variant = sourceNode.data.specs?.switchVariants?.[variantIndex];
      sourceOutputs = variant?.outputs || [];
    } else {
      // For consoles with variant-specific outputs (e.g. MiSTer vs SuperStation)
      const variantOutputs = sourceNode.data.specs?.variantOutputs;
      const hasVariantOutputs = variantOutputs && Array.isArray(variantOutputs) && sourceNode.data.variants?.length > 0;
      const baseOutputs = hasVariantOutputs
        ? (variantOutputs[sourceNode.data.variantIndex ?? 0] || sourceNode.data.specs?.outputs || [])
        : (sourceNode.data.specs?.outputs || []);
      sourceOutputs = [...baseOutputs];
      
      // Add addon outputs if console has selected addons
      if (sourceNode.data.category === 'console' && sourceNode.data.specs?.addons) {
        const selectedAddons = sourceNode.data.selectedAddons || [];
        selectedAddons.forEach((addonId: string) => {
          const addon = sourceNode.data.specs?.addons?.find((a: any) => a.id === addonId);
          if (addon && addon.outputs) {
            addon.outputs.forEach((output: string) => {
              if (!sourceOutputs.includes(output)) {
                sourceOutputs.push(output);
              }
            });
          }
        });
      }
    }
    
    const targetInputs = targetIsScalableSwitch
      ? (targetNode.data.svsInputs || [])
      : targetIsCustomDisplay
        ? (targetNode.data.customInputs || targetNode.data.specs?.inputs || [])
        : targetHasSwitchVariants
          ? (() => {
              const variantIndex = targetNode.data.switchVariantIndex ?? 0;
              const variant = targetNode.data.specs?.switchVariants?.[variantIndex];
              return variant?.inputs || targetNode.data.specs?.inputs || [];
            })()
          : (targetNode.data.specs?.inputs || []);
    
    // Extract indices from handle IDs
    let outputIndex = 0;
    let inputIndex = 0;
    
    if (connection.sourceHandle) {
      const sourceMatch = connection.sourceHandle.match(/out-(\d+)/);
      if (sourceMatch) {
        outputIndex = parseInt(sourceMatch[1], 10);
      }
    }
    
    if (connection.targetHandle) {
      const targetMatch = connection.targetHandle.match(/in-(\d+)/);
      if (targetMatch) {
        inputIndex = parseInt(targetMatch[1], 10);
      }
    }
    
    // For consoles and custom game machines (non-scalable custom items), use selected output or first available
    // For scalable switches and simultaneous-output consoles (MiSTer), use indexed outputs
    let outputType = '';
    if (sourceIsScalableSwitch || sourceHasSimultaneousOutputs) {
      outputType = sourceOutputs[outputIndex] || '';
    } else if (sourceNode.data.category === 'console' || sourceNode.data.category === 'custom') {
      // Use selectedOutput if it exists and is in the available outputs, otherwise use first available
      const selectedOutput = sourceNode.data.selectedOutput;
      if (selectedOutput && sourceOutputs.includes(selectedOutput)) {
        outputType = selectedOutput;
      } else {
        outputType = sourceOutputs[0] || '';
      }
    } else {
      outputType = sourceOutputs[outputIndex] || '';
    }
    
    const inputType = targetInputs[inputIndex] || '';
    
    // Validate signal compatibility (normalize to strip "(modded)" for comparison)
    if (!outputType || !inputType) return false;
    if (!areSignalsCompatible(outputType, inputType)) return false;
    
    return true;
  }, [nodes, areSignalsCompatible]);

  const handleConnectionConfirm = useCallback((connection: Connection, outputType: string, inputType: string, showToast: boolean = true) => {
    // Connections are already cleaned up in onConnect, so just add the new edge
    // Normalize output type to strip "(modded)" for consistency
    const normalizedOutputType = normalizeSignalType(outputType);
    const edgeColor = getOutputColor(normalizedOutputType);
    
    // Add neon styling to edges with color based on output type
    const styledEdge = {
      ...connection,
      animated: true,
      data: { outputType: normalizedOutputType, onDelete: handleDeleteEdge }, // Store normalized output type and delete handler in edge data
      style: { stroke: edgeColor, strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColor,
      },
    };
    
    setEdges((eds) => addEdge(styledEdge, eds));
    
    if (showToast) {
      toast({
        title: "Connected",
        description: `Connected ${normalizedOutputType.toUpperCase()} to ${normalizeSignalType(inputType).toUpperCase()}`,
        duration: 2000,
      });
    }
  }, [setEdges, toast, getOutputColor, handleDeleteEdge]);

  const onConnect = useCallback((params: Connection) => {
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);
    
    if (!sourceNode || !targetNode) return;
    
    // Check if nodes are scalable switches (SVS, Custom Switch, or HDMI Switch) or custom display
    const sourceIsScalableSwitch = sourceNode.data.specs?.isSVS === true || 
                                   sourceNode.data.specs?.isCustomSwitch === true || 
                                   sourceNode.data.specs?.isHDMISwitch === true;
    const targetIsScalableSwitch = targetNode.data.specs?.isSVS === true || 
                                   targetNode.data.specs?.isCustomSwitch === true || 
                                   targetNode.data.specs?.isHDMISwitch === true;
    const targetIsCustomDisplay = targetNode.data.category === 'display' && targetNode.data.specs?.customizableInputs === true;
    const sourceHasSwitchVariants = sourceNode.data.category === 'switch' && sourceNode.data.specs?.switchVariants?.length > 0;
    const targetHasSwitchVariants = targetNode.data.category === 'switch' && targetNode.data.specs?.switchVariants?.length > 0;
    const sourceHasSimultaneousOutputs = sourceNode.data.specs?.simultaneousOutputs === true;
    
    // Get output and input types from the handles that were actually connected
    let sourceOutputs: string[] = [];
    if (sourceIsScalableSwitch) {
      sourceOutputs = sourceNode.data.svsOutputs || [];
    } else if (sourceHasSwitchVariants) {
      const variantIndex = sourceNode.data.switchVariantIndex ?? 0;
      const variant = sourceNode.data.specs?.switchVariants?.[variantIndex];
      sourceOutputs = variant?.outputs || [];
    } else {
      // For consoles with variant-specific outputs (e.g. MiSTer vs SuperStation)
      const variantOutputs = sourceNode.data.specs?.variantOutputs;
      const hasVariantOutputs = variantOutputs && Array.isArray(variantOutputs) && sourceNode.data.variants?.length > 0;
      const baseOutputs = hasVariantOutputs
        ? (variantOutputs[sourceNode.data.variantIndex ?? 0] || sourceNode.data.specs?.outputs || [])
        : (sourceNode.data.specs?.outputs || []);
      sourceOutputs = [...baseOutputs];
      
      // Add addon outputs if console has selected addons
      if (sourceNode.data.category === 'console' && sourceNode.data.specs?.addons) {
        const selectedAddons = sourceNode.data.selectedAddons || [];
        selectedAddons.forEach((addonId: string) => {
          const addon = sourceNode.data.specs?.addons?.find((a: any) => a.id === addonId);
          if (addon && addon.outputs) {
            addon.outputs.forEach((output: string) => {
              if (!sourceOutputs.includes(output)) {
                sourceOutputs.push(output);
              }
            });
          }
        });
      }
    }
    
    const targetInputs = targetIsScalableSwitch
      ? (targetNode.data.svsInputs || [])
      : targetIsCustomDisplay
        ? (targetNode.data.customInputs || targetNode.data.specs?.inputs || [])
        : targetHasSwitchVariants
          ? (targetNode.data.specs?.switchVariants?.[targetNode.data.switchVariantIndex ?? 0]?.inputs || targetNode.data.specs?.inputs || [])
          : (targetNode.data.specs?.inputs || []);
    
    // Extract indices from handle IDs
    let outputIndex = 0;
    let inputIndex = 0;
    
    if (params.sourceHandle) {
      const sourceMatch = params.sourceHandle.match(/out-(\d+)/);
      if (sourceMatch) {
        outputIndex = parseInt(sourceMatch[1], 10);
      }
    }
    
    if (params.targetHandle) {
      const targetMatch = params.targetHandle.match(/in-(\d+)/);
      if (targetMatch) {
        inputIndex = parseInt(targetMatch[1], 10);
      }
    }
    
    // For consoles and custom game machines (non-scalable custom items), use selected output or first available
    // For scalable switches and simultaneous-output consoles (MiSTer), use indexed outputs
    let outputType = '';
    if (sourceIsScalableSwitch || sourceHasSimultaneousOutputs) {
      outputType = sourceOutputs[outputIndex] || '';
    } else if (sourceNode.data.category === 'console' || sourceNode.data.category === 'custom') {
      // Use selectedOutput if it exists and is in the available outputs, otherwise use first available
      const selectedOutput = sourceNode.data.selectedOutput;
      if (selectedOutput && sourceOutputs.includes(selectedOutput)) {
        outputType = selectedOutput;
      } else {
        outputType = sourceOutputs[0] || '';
      }
    } else {
      outputType = sourceOutputs[outputIndex] || '';
    }
    
    const inputType = targetInputs[inputIndex] || '';
    
    // Only create connection if we have valid types
    // Store normalized type in edge data for consistency
    if (!outputType || !inputType) return;
    const normalizedOutputType = normalizeSignalType(outputType);
    const normalizedInputType = normalizeSignalType(inputType);
    // For connector-only types (BNC, RCA), use target input type for color - it represents the actual signal (e.g. YPbPR)
    const displayType = ['bnc', 'rca'].includes(normalizedOutputType.toLowerCase()) ? normalizedInputType : normalizedOutputType;
    
    // Remove existing connections and add new one in a single state update
    setEdges((eds) => {
      // Remove existing connection on source handle (especially for consoles and custom items)
      // For consoles and custom game machines (non-scalable), remove any connection from the node regardless of sourceHandle
      // For scalable switches, only remove connection from the specific source handle
      let filtered = eds;
      
      if (sourceIsScalableSwitch || sourceHasSimultaneousOutputs) {
        // For scalable switches and simultaneous-output consoles, only remove connection from the specific source handle
        filtered = filtered.filter(
          (e) => !(e.source === params.source && e.sourceHandle === params.sourceHandle)
        );
      } else if (sourceNode.data.category === 'console' || sourceNode.data.category === 'custom') {
        // Consoles and custom game machines can only have one output, so remove ALL connections from this node
        filtered = filtered.filter((e) => e.source !== params.source);
      } else {
        // For other nodes, only remove connection from the specific source handle
        filtered = filtered.filter(
          (e) => !(e.source === params.source && e.sourceHandle === params.sourceHandle)
        );
      }
      
      // Remove existing connection on target handle
      filtered = filtered.filter(
        (e) => !(e.target === params.target && e.targetHandle === params.targetHandle)
      );
      
      // Now add the new edge
      // Use displayType for edge color (target input when source is BNC/RCA connector)
      const edgeColor = getOutputColor(displayType);
      const styledEdge = {
        ...params,
        animated: true,
        data: { outputType: displayType, onDelete: handleDeleteEdge },
        style: { stroke: edgeColor, strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
        },
      };
      
      return addEdge(styledEdge, filtered);
    });
  }, [nodes, getOutputColor, handleDeleteEdge]);


  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const addNodeAtPosition = useCallback((itemData: any, x: number, y: number) => {
    if (!reactFlowInstance) return;
    const position = reactFlowInstance.screenToFlowPosition({ x, y });
      setNodes((nds) => {
        const newNodeData: any = {
          ...buildSeedDataFromCatalogItem(itemData),
          onDelete: handleDeleteNode,
          onUpdate: handleUpdateNode,
        };
        const newNode = {
          id: getNextNodeId(nds),
          type: 'equipment',
          position,
          data: newNodeData,
        };
        return nds.concat(newNode);
      });
    toast({
      title: "Added YPbPR",
      description: `Added ${itemData.name} to the canvas.`,
      duration: 1500,
    });
  }, [reactFlowInstance, setNodes, toast, handleDeleteNode, handleUpdateNode]);


  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      let type = event.dataTransfer.getData('application/reactflow');
      let itemDataString = event.dataTransfer.getData('application/itemData');
      let itemData;

      if (itemDataString) {
        itemData = JSON.parse(itemDataString);
      }

      if (!type || !itemData) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setNodes((nds) => {
        const newNodeData: any = {
          ...buildSeedDataFromCatalogItem(itemData),
          onDelete: handleDeleteNode,
          onUpdate: handleUpdateNode,
        };
        const newNode = {
          id: getNextNodeId(nds),
          type,
          position,
          data: newNodeData,
        };
        return nds.concat(newNode);
      });
      
      toast({
        title: "Added YPbPR",
        description: `Added ${itemData.name} to the canvas.`,
        duration: 1500,
      });
    },
    [reactFlowInstance, setNodes, toast, handleDeleteNode, handleUpdateNode]
  );

  const handleSave = async () => {
    if (!reactFlowInstance) return;
    
    const flow = reactFlowInstance.toObject();
    const diagramData: DiagramFile = {
      name: diagramName,
      data: flow,
    };

    try {
      await saveFile(diagramData);
      toast({ title: "Saved!", description: "Diagram saved successfully." });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to save diagram.", 
        variant: "destructive" 
      });
    }
  };

  const handleLoad = async () => {
    try {
      setIsLoading(true);
      const diagram = await loadFile();
      if (diagram) {
        applyDiagram(diagram);
        toast({ title: "Loaded!", description: `Opened ${diagram.name}` });
        setLocation('/editor');
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to load diagram.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadExample = async (exampleName: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/examples/${exampleName}`);
      if (!res.ok) throw new Error("Failed to load example");
      const diagram: DiagramFile = await res.json();
      
      applyDiagram(diagram);
      toast({ title: "Example Loaded!", description: `Opened ${diagram.name}` });
      setLocation('/editor');
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to load example.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!shareDialogOpen || !reactFlowInstance) return;
    setShareExportBusy(true);
    setShareExportText('');
    let cancelled = false;
    void (async () => {
      try {
        const flow = reactFlowInstance.toObject();
        const diagramData: DiagramFile = { name: diagramName, data: flow };
        const code = await encodeDiagramShareCode(diagramData, items ?? []);
        if (!cancelled) setShareExportText(code);
      } catch (e: unknown) {
        if (!cancelled) {
          setShareExportText('');
          toast({
            variant: 'destructive',
            title: 'Could not create share code',
            description: e instanceof Error ? e.message : 'Unknown error',
          });
        }
      } finally {
        if (!cancelled) setShareExportBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareDialogOpen, reactFlowInstance, diagramName, toast, items]);

  const shareExportUrl = useMemo(() => {
    if (!shareExportText || shareExportBusy || typeof window === 'undefined') return '';
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    const path = base ? `${base}/editor` : '/editor';
    return `${window.location.origin}${path}#${shareExportText}`;
  }, [shareExportText, shareExportBusy]);

  const handleImportFromShareCode = async () => {
    try {
      const diagram = await decodeDiagramShareCode(shareImportText, items ?? []);
      applyDiagram(diagram);
      setShareDialogOpen(false);
      setShareImportText('');
      setLocation('/editor');
      toast({ title: 'Setup loaded', description: diagram.name });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Invalid setup code',
        description: e instanceof Error ? e.message : 'Decode failed',
      });
    }
  };

  const handleCopyShareCode = async () => {
    if (!shareExportText) return;
    try {
      await navigator.clipboard.writeText(shareExportText);
      toast({ title: 'Copied', description: 'Setup code is on the clipboard.' });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Select the code and copy manually, or check site permissions.',
      });
    }
  };

  const handleCopyShareUrl = async () => {
    if (!shareExportUrl) return;
    try {
      await navigator.clipboard.writeText(shareExportUrl);
      toast({ title: 'Copied', description: 'Share link is on the clipboard.' });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Select the link and copy manually, or check site permissions.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-mono animate-pulse">LOADING_SCHEMATIC...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      <Sidebar onDeselectAll={handleDeselectAll} />
      
      <div className="flex-1 h-full flex flex-col relative" ref={reactFlowWrapper} style={{ minHeight: 0 }}>
        {/* Top Bar Overlay */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none px-2 md:px-0">
          <div className="bg-card/90 backdrop-blur-md border border-border p-2 rounded-lg shadow-lg pointer-events-auto flex items-center gap-2 md:gap-3 flex-1 md:flex-none">
            <Link href="/" className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="h-6 w-px bg-border mx-1" />
            <Input
              value={diagramName}
              onChange={(e) => setDiagramName(e.target.value)}
              className="bg-transparent border-none focus-visible:ring-0 text-sm md:text-lg font-bold w-32 md:w-64 h-auto py-1 px-2 font-display uppercase tracking-wide"
            />
          </div>

          <div className="flex gap-1 md:gap-2 pointer-events-auto">
            <Button
              variant={snapToGridEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSnapToGridEnabled((v) => !v)}
              className={snapToGridEnabled ? 'bg-primary text-primary-foreground' : 'bg-card/90 backdrop-blur-md border-border hover:bg-muted'}
              title={snapToGridEnabled ? 'Disable snap to grid' : 'Enable snap to grid'}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  disabled={isLoading}
                  variant="outline" 
                  size="sm"
                  className="bg-card/90 backdrop-blur-md border-border hover:bg-muted"
                >
                  <FileText className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Examples</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Load Example</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleLoadExample('simple')}>
                  <div className="flex flex-col">
                    <span className="font-semibold">Simple Setup</span>
                    <span className="text-xs text-muted-foreground">Basic console to display</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleLoadExample('medium')}>
                  <div className="flex flex-col">
                    <span className="font-semibold">Medium Setup</span>
                    <span className="text-xs text-muted-foreground">Multi-console switcher</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleLoadExample('advanced')}>
                  <div className="flex flex-col">
                    <span className="font-semibold">Advanced Setup</span>
                    <span className="text-xs text-muted-foreground">Complex routing system</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleLoadExample('svs')}>
                  <div className="flex flex-col">
                    <span className="font-semibold">SVS Setup</span>
                    <span className="text-xs text-muted-foreground">Scalable Video Switch with multiple consoles</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleLoadExample('silly-creator-setup')}>
                  <div className="flex flex-col">
                    <span className="font-semibold">Silly creator setup</span>
                    <span className="text-xs text-muted-foreground">retrogamecabling's creator's setup, multi-path setup with analog and HDMI routing</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              onClick={() => setShareDialogOpen(true)}
              disabled={isLoading || !reactFlowInstance}
              variant="outline"
              size="sm"
              className="bg-card/90 backdrop-blur-md border-border hover:bg-muted"
              title="Copy or paste a compact setup code"
            >
              <Share2 className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Share</span>
            </Button>
            <Button 
              onClick={handleLoad}
              disabled={isLoading}
              variant="outline" 
              size="sm"
              className="bg-card/90 backdrop-blur-md border-border hover:bg-muted"
            >
              <Upload className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Load</span>
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isLoading}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
            >
              <Save className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Save Setup</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 w-full h-full" style={{ minHeight: 0 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            isValidConnection={isValidConnection}
            fitView={shouldFitView}
            minZoom={0.1}
            maxZoom={2}
            className="bg-background"
            style={{ width: '100%', height: '100%' }}
            edgesUpdatable={true}
            edgesFocusable={true}
            snapToGrid={snapToGridEnabled}
            snapGrid={[20, 20]}
            nodeDragThreshold={25}
          >
          <Controls className="bg-card border border-border shadow-xl !m-4" />
          <Background
            color="hsl(var(--muted)/0.2)"
            gap={20}
            size={1}
            variant={snapToGridEnabled ? BackgroundVariant.Lines : BackgroundVariant.Dots}
          />
          
          <Panel position="bottom-right" className="bg-card/90 backdrop-blur border border-border p-2 md:p-3 rounded-lg shadow-xl mb-4 md:mb-6 mr-4 md:mr-6 max-w-xs text-[10px] md:text-[11px]">
            <h4 className="text-[10px] md:text-sm font-bold uppercase text-muted-foreground mb-2">Instructions</h4>
            <ul className="text-[9px] md:text-[15px] text-foreground space-y-0.5 md:space-y-1 list-disc pl-3 opacity-80">
              <li>Drag components from the sidebar</li>
              <li>Connect inputs (left) to outputs (right)</li>
              <li>Scroll to zoom, drag to pan</li>
              {snapToGridEnabled && <li>Grid snap: nodes align to grid when dragging</li>}
            </ul>
          </Panel>
        </ReactFlow>
        </div>
      </div>

      <Dialog
        open={shareDialogOpen}
        onOpenChange={(open) => {
          setShareDialogOpen(open);
          if (!open) setShareImportText('');
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto ring-1 ring-border/40">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wide">Share setup</DialogTitle>
            <DialogDescription>
              Paste the code or use the link (opens the editor with the setup in the URL hash).
              Very long links may be truncated in some chat apps—use the raw code if that happens.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Your code</p>
              <textarea
                readOnly
                value={shareExportBusy ? 'Generating…' : shareExportText}
                rows={5}
                className="w-full resize-y rounded-md border border-border bg-muted/25 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-sm font-medium">Share link</p>
              <textarea
                readOnly
                value={shareExportBusy ? 'Generating…' : shareExportUrl}
                rows={3}
                className="w-full resize-y rounded-md border border-border bg-muted/25 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyShareCode}
                  disabled={shareExportBusy || !shareExportText}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy code
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyShareUrl}
                  disabled={shareExportBusy || !shareExportUrl}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Copy link
                </Button>
              </div>
            </div>
            <div className="h-px bg-border" />
            <div className="space-y-2">
              <p className="text-sm font-medium">Import from code</p>
              <textarea
                value={shareImportText}
                onChange={(e) => setShareImportText(e.target.value)}
                placeholder={`Paste a setup code (starts with ${SHARE_CODE_PREFIX}…)`}
                rows={5}
                className="w-full resize-y rounded-md border border-border bg-muted/25 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShareDialogOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={handleImportFromShareCode} disabled={!shareImportText.trim()}>
              Load from code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Editor() {
  const [, params] = useRoute('/editor/:name');
  
  return (
    <ReactFlowProvider>
      <EditorContent diagramName={params?.name ? decodeURIComponent(params.name) : undefined} />
    </ReactFlowProvider>
  );
}
