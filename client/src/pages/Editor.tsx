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
import { Save, ArrowLeft, Download, Share2, Upload, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { saveFile, loadFile, loadFileFromRecent, type DiagramFile } from '@/lib/fileUtils';
import { useItems } from '@/hooks/use-items';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
    const output = outputType.toLowerCase();
    const input = inputType.toLowerCase();
    
    // Same type is always compatible
    if (output === input) return true;
    
    // Digital signals (HDMI) cannot connect to analog
    const digitalSignals = ['hdmi'];
    const analogSignals = ['scart', 'composite', 'rca', 's-video', 'component', 'rgb', 'rf', 'bnc', 'vga'];
    
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
    
    // Component cannot connect to Composite or S-Video
    if (output === 'component') {
      if (input === 'composite' || input === 'rca' || input === 's-video') return false;
    }
    if (input === 'component') {
      if (output === 'composite' || output === 'rca' || output === 's-video') return false;
    }
    
    // Composite cannot connect to Component
    if ((output === 'composite' || output === 'rca') && input === 'component') return false;
    if (output === 'component' && (input === 'composite' || input === 'rca')) return false;
    
    // Composite cannot connect to S-Video (different signal formats)
    if ((output === 'composite' || output === 'rca') && input === 's-video') return false;
    if (output === 's-video' && (input === 'composite' || input === 'rca')) return false;
    
    // RGB cannot connect to Component (needs converter, unless through upscaler)
    if (output === 'rgb') {
      if (input === 'component') return false;
    }
    if (input === 'rgb') {
      if (output === 'component') return false;
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
  const [isLoading, setIsLoading] = useState(false);
  const [shouldFitView, setShouldFitView] = useState(true);

  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: items } = useItems();

  // Color mapping for different output types
  const getOutputColor = useCallback((outputType: string): string => {
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
      vga: '#8A2BE2',        // Blue Violet
    };
    
    const normalized = outputType.toLowerCase();
    return colorMap[normalized] || 'hsl(var(--primary))'; // Default to primary color
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds: Node[]) => nds.filter((n: Node) => n.id !== nodeId));
    setEdges((eds: Edge[]) => eds.filter((e: Edge) => e.source !== nodeId && e.target !== nodeId));
    toast({
      title: "Component Removed",
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

  const handleUpdateNode = useCallback((nodeId: string, updates: any) => {
    // If console output changed, validate all existing connections first
    if (updates.selectedOutput) {
      const sourceNode = nodes.find(n => n.id === nodeId);
      if (sourceNode?.data?.category === 'console') {
        const newOutputType = updates.selectedOutput;
        
        // Check all existing connections from this console
        const connectedEdges = edges.filter((e: any) => e.source === nodeId);
        
        for (const edge of connectedEdges) {
          const targetNode = nodes.find(n => n.id === edge.target);
          if (!targetNode) continue;
          
          // Get the input type from the target handle
          const targetInputs = targetNode.data.specs?.inputs || [];
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
          
          // Validate compatibility
          if (inputType && !areSignalsCompatible(newOutputType, inputType)) {
            toast({
              title: "Invalid Output Change",
              description: `Cannot change to ${newOutputType.toUpperCase()}: incompatible with ${targetNode.data.label}'s ${inputType.toUpperCase()} input.`,
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
      
      // If console output changed, update connected edges and target nodes
      if (updates.selectedOutput && sourceNode?.data?.category === 'console') {
        const newOutputType = updates.selectedOutput;
        const edgeColor = getOutputColor(newOutputType);
        
        // Find target nodes and update edges
        const targetNodeIds: string[] = [];
        setEdges((eds) => {
          const updatedEdges = eds.map((edge) => {
            // Check if this edge is from our console node
            // For consoles, update ALL edges from this node (consoles only have one output)
            if (edge.source === nodeId) {
              if (!targetNodeIds.includes(edge.target)) {
                targetNodeIds.push(edge.target);
              }
              return {
                ...edge,
                data: { ...edge.data, outputType: newOutputType },
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
      // If edge already has outputType in data, use it
      if (edge.data?.outputType) {
        const color = getOutputColor(edge.data.outputType);
        return {
          ...edge,
          data: { ...edge.data, onDelete: handleDeleteEdge }, // Ensure onDelete is present
          style: { ...edge.style, stroke: color },
          markerEnd: { ...edge.markerEnd, color },
        };
      }
      
      // Otherwise, try to infer from source node
      const sourceNode = nodes.find((n: any) => n.id === edge.source);
      if (sourceNode) {
        let outputType: string | undefined;
        
        if (sourceNode.data?.category === 'console') {
          outputType = sourceNode.data.selectedOutput || sourceNode.data.specs?.outputs?.[0];
        } else if (edge.sourceHandle) {
          const handleIndex = parseInt(edge.sourceHandle.split('-')[1] || '0');
          outputType = sourceNode.data?.specs?.outputs?.[handleIndex];
        }
        
        if (outputType) {
          const color = getOutputColor(outputType);
          return {
            ...edge,
            data: { outputType, onDelete: handleDeleteEdge },
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

  // Load diagram data if provided
  useEffect(() => {
    if (initialDiagramName) {
      const diagram = loadFileFromRecent(initialDiagramName);
      if (diagram) {
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
        }
      }
    }
  }, [initialDiagramName, setNodes, setEdges, handleDeleteNode, handleUpdateNode, processEdgesWithColors]);

  // Handle keyboard delete for nodes and edges
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
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
    
    // Check if nodes are SVS
    const sourceIsSVS = sourceNode.data.specs?.isSVS === true;
    const targetIsSVS = targetNode.data.specs?.isSVS === true;
    
    // Get output and input types from the handles
    // For SVS nodes, use svsOutputs/svsInputs; otherwise use specs.outputs/inputs
    const sourceOutputs = sourceIsSVS 
      ? (sourceNode.data.svsOutputs || [])
      : (sourceNode.data.specs?.outputs || []);
    const targetInputs = targetIsSVS
      ? (targetNode.data.svsInputs || [])
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
    
    // For consoles, use selected output or first available
    let outputType = '';
    if (sourceNode.data.category === 'console') {
      outputType = sourceNode.data.selectedOutput || sourceOutputs[0] || '';
    } else {
      outputType = sourceOutputs[outputIndex] || '';
    }
    
    const inputType = targetInputs[inputIndex] || '';
    
    // Validate signal compatibility
    if (!outputType || !inputType) return false;
    if (!areSignalsCompatible(outputType, inputType)) return false;
    
    return true;
  }, [nodes, areSignalsCompatible]);

  const handleConnectionConfirm = useCallback((connection: Connection, outputType: string, inputType: string, showToast: boolean = true) => {
    // Connections are already cleaned up in onConnect, so just add the new edge
    const edgeColor = getOutputColor(outputType);
    
    // Add neon styling to edges with color based on output type
    const styledEdge = {
      ...connection,
      animated: true,
      data: { outputType, onDelete: handleDeleteEdge }, // Store output type and delete handler in edge data
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
        description: `Connected ${outputType.toUpperCase()} to ${inputType.toUpperCase()}`,
        duration: 2000,
      });
    }
  }, [setEdges, toast, getOutputColor, handleDeleteEdge]);

  const onConnect = useCallback((params: Connection) => {
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);
    
    if (!sourceNode || !targetNode) return;
    
    // Check if nodes are SVS
    const sourceIsSVS = sourceNode.data.specs?.isSVS === true;
    const targetIsSVS = targetNode.data.specs?.isSVS === true;
    
    // Get output and input types from the handles that were actually connected
    // For SVS nodes, use svsOutputs/svsInputs; otherwise use specs.outputs/inputs
    const sourceOutputs = sourceIsSVS
      ? (sourceNode.data.svsOutputs || [])
      : (sourceNode.data.specs?.outputs || []);
    const targetInputs = targetIsSVS
      ? (targetNode.data.svsInputs || [])
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
    
    // For consoles, use selected output or first available
    let outputType = '';
    if (sourceNode.data.category === 'console') {
      outputType = sourceNode.data.selectedOutput || sourceOutputs[0] || '';
    } else {
      outputType = sourceOutputs[outputIndex] || '';
    }
    
    const inputType = targetInputs[inputIndex] || '';
    
    // Only create connection if we have valid types
    if (!outputType || !inputType) return;
    
    // Remove existing connections and add new one in a single state update
    setEdges((eds) => {
      // Remove existing connection on source handle (especially for consoles)
      // For consoles, remove any connection from the console regardless of sourceHandle
      let filtered = eds;
      
      if (sourceNode.data.category === 'console') {
        // Consoles can only have one output, so remove ALL connections from this console
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
      const edgeColor = getOutputColor(outputType);
      const styledEdge = {
        ...params,
        animated: true,
        data: { outputType, onDelete: handleDeleteEdge },
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
          label: itemData.name, 
          category: itemData.category,
          specs: itemData.specs,
          onDelete: handleDeleteNode,
          onUpdate: handleUpdateNode,
        };
        
        // Initialize SVS configuration if it's an SVS
        if (itemData.specs?.isSVS === true) {
          newNodeData.svsNumInputs = 1;
          newNodeData.svsNumOutputs = 1;
          newNodeData.svsInputs = ['component'];
          newNodeData.svsOutputs = ['component'];
        }
        
        const newNode = {
          id: getNextNodeId(nds),
          type: 'equipment',
          position,
          data: newNodeData,
        };
        return nds.concat(newNode);
      });
    toast({
      title: "Added Component",
      description: `Added ${itemData.name} to the canvas.`,
      duration: 1500,
    });
  }, [reactFlowInstance, setNodes, toast, handleDeleteNode]);


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
          label: itemData.name, 
          category: itemData.category,
          specs: itemData.specs,
          onDelete: handleDeleteNode,
          onUpdate: handleUpdateNode,
        };
        
        // Initialize SVS configuration if it's an SVS
        if (itemData.specs?.isSVS === true) {
          newNodeData.svsNumInputs = 1;
          newNodeData.svsNumOutputs = 1;
          newNodeData.svsInputs = ['component'];
          newNodeData.svsOutputs = ['component'];
        }
        
        const newNode = {
          id: getNextNodeId(nds),
          type,
          position,
          data: newNodeData,
        };
        return nds.concat(newNode);
      });
      
      toast({
        title: "Added Component",
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
          
          // Disable fitView if viewport is saved
          if (flow.viewport) {
            setShouldFitView(false);
            if (reactFlowInstance) {
              setTimeout(() => {
                if (reactFlowInstance) {
                  reactFlowInstance.setViewport(flow.viewport);
                }
              }, 100);
            }
          } else {
            setShouldFitView(true);
          }
        }
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
        
        // Disable fitView if viewport is saved in the example
        if (flow.viewport) {
          setShouldFitView(false);
          // Set viewport if available (use setTimeout to ensure ReactFlow is ready)
          if (reactFlowInstance) {
            setTimeout(() => {
              if (reactFlowInstance) {
                reactFlowInstance.setViewport(flow.viewport);
              }
            }, 100);
          }
        } else {
          setShouldFitView(true);
        }
      }
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
      <Sidebar />
      
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
              </DropdownMenuContent>
            </DropdownMenu>
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
            className="bg-background"
            style={{ width: '100%', height: '100%' }}
            edgesUpdatable={true}
            edgesFocusable={true}
          >
          <Controls className="bg-card border border-border shadow-xl !m-4" />
          <Background color="hsl(var(--muted)/0.2)" gap={20} size={1} variant={BackgroundVariant.Dots} />
          
          <Panel position="bottom-right" className="bg-card/90 backdrop-blur border border-border p-2 md:p-3 rounded-lg shadow-xl mb-4 md:mb-6 mr-4 md:mr-6 max-w-xs text-[10px] md:text-[11px]">
            <h4 className="text-[10px] md:text-sm font-bold uppercase text-muted-foreground mb-2">Instructions</h4>
            <ul className="text-[9px] md:text-[15px] text-foreground space-y-0.5 md:space-y-1 list-disc pl-3 opacity-80">
              <li>Drag components from the sidebar</li>
              <li>Connect inputs (left) to outputs (right)</li>
              <li>Scroll to zoom, drag to pan</li>
            </ul>
          </Panel>
        </ReactFlow>
        </div>
      </div>


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
