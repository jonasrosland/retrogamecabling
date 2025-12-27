import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  Edge,
  MarkerType,
  BackgroundVariant,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Sidebar } from '@/components/Sidebar';
import CustomNode from '@/components/CustomNode';
import { useCreateDiagram, useUpdateDiagram, useDiagram } from '@/hooks/use-diagrams';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, ArrowLeft, Download, Share2, Menu } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

// Register custom node types
const nodeTypes = {
  equipment: CustomNode,
};

// Initial empty state
const initialNodes: any[] = [];
const initialEdges: any[] = [];

let id = 0;
const getId = () => `dndnode_${id++}`;

function EditorContent({ diagramId }: { diagramId?: string }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [diagramName, setDiagramName] = useState('Untitled Setup');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const isMobile = useIsMobile();

  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const createMutation = useCreateDiagram();
  const updateMutation = useUpdateDiagram();
  const { data: existingDiagram, isLoading: isLoadingDiagram } = useDiagram(diagramId ? parseInt(diagramId) : null);

  // Load diagram data if editing
  useEffect(() => {
    if (existingDiagram) {
      setDiagramName(existingDiagram.name);
      // @ts-ignore - DB stores JSON, ReactFlow expects typed objects
      const flow = existingDiagram.data;
      if (flow) {
        const nodesWithDelete = (flow.nodes || []).map((node: any) => ({
          ...node,
          data: { ...node.data, onDelete: handleDeleteNode },
        }));
        setNodes(nodesWithDelete);
        setEdges(flow.edges || []);
      }
    }
  }, [existingDiagram, setNodes, setEdges, handleDeleteNode]);

  // Handle keyboard delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && nodes.some(n => n.selected)) {
        const selectedNode = nodes.find(n => n.selected);
        if (selectedNode) {
          handleDeleteNode(selectedNode.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, handleDeleteNode]);

  const onConnect = useCallback((params: Connection) => {
    // Add neon styling to edges
    const styledEdge = {
      ...params,
      animated: true,
      style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'hsl(var(--primary))',
      },
    };
    setEdges((eds) => addEdge(styledEdge, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    toast({
      title: "Component Removed",
      description: "Node and connected edges deleted.",
      duration: 1500,
    });
  }, [setNodes, setEdges, toast]);

  const addNodeAtPosition = useCallback((itemData: any, x: number, y: number) => {
    if (!reactFlowInstance) return;
    const position = reactFlowInstance.screenToFlowPosition({ x, y });
    const newNode = {
      id: getId(),
      type: 'equipment',
      position,
      data: { 
        label: itemData.name, 
        category: itemData.category,
        specs: itemData.specs,
        onDelete: handleDeleteNode,
      },
    };
    setNodes((nds) => nds.concat(newNode));
    toast({
      title: "Added Component",
      description: `Added ${itemData.name} to the canvas.`,
      duration: 1500,
    });
  }, [reactFlowInstance, setNodes, toast, handleDeleteNode]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (isMobile && selectedItem) {
      addNodeAtPosition(selectedItem, e.clientX, e.clientY);
      setSelectedItem(null);
    }
  }, [selectedItem, isMobile, addNodeAtPosition]);

  const onTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      // Check if touch drag data exists (from sidebar)
      if (!(window as any).touchDragData) return;

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const touch = event.changedTouches[0];
      const itemData = (window as any).touchDragData.itemData;
      const type = (window as any).touchDragData.type;

      // Clear the touch data
      (window as any).touchDragData = null;

      const position = reactFlowInstance.screenToFlowPosition({
        x: touch.clientX,
        y: touch.clientY,
      });

      const newNode = {
        id: getId(),
        type,
        position,
        data: { 
          label: itemData.name, 
          category: itemData.category,
          specs: itemData.specs,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      
      toast({
        title: "Added Component",
        description: `Added ${itemData.name} to the canvas.`,
        duration: 1500,
      });
    },
    [reactFlowInstance, setNodes, toast]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      let type = event.dataTransfer.getData('application/reactflow');
      let itemDataString = event.dataTransfer.getData('application/itemData');
      let itemData;

      // Fallback to touch data if drag data is empty (for mobile touch support)
      if (!type && (window as any).touchDragData) {
        type = (window as any).touchDragData.type;
        itemData = (window as any).touchDragData.itemData;
        // Clear the touch data
        (window as any).touchDragData = null;
      } else if (itemDataString) {
        itemData = JSON.parse(itemDataString);
      }

      if (!type || !itemData) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type,
        position,
        data: { 
          label: itemData.name, 
          category: itemData.category,
          specs: itemData.specs,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      
      toast({
        title: "Added Component",
        description: `Added ${itemData.name} to the canvas.`,
        duration: 1500,
      });
    },
    [reactFlowInstance, setNodes, toast]
  );

  const handleSave = async () => {
    if (!reactFlowInstance) return;
    
    const flow = reactFlowInstance.toObject();
    const diagramData = {
      name: diagramName,
      data: flow,
    };

    try {
      if (diagramId) {
        await updateMutation.mutateAsync({ 
          id: parseInt(diagramId),
          ...diagramData 
        });
        toast({ title: "Saved!", description: "Diagram updated successfully." });
      } else {
        const newDiagram = await createMutation.mutateAsync(diagramData);
        toast({ title: "Created!", description: "New diagram saved successfully." });
        setLocation(`/editor/${newDiagram.id}`);
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to save diagram.", 
        variant: "destructive" 
      });
    }
  };

  if (diagramId && isLoadingDiagram) {
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
      {!isMobile && <Sidebar onSelectItem={isMobile ? setSelectedItem : undefined} />}
      
      <div className="flex-1 h-full flex flex-col relative" ref={reactFlowWrapper} onClick={handleCanvasClick}>
        {/* Top Bar Overlay */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none px-2 md:px-0">
          <div className="bg-card/90 backdrop-blur-md border border-border p-2 rounded-lg shadow-lg pointer-events-auto flex items-center gap-2 md:gap-3 flex-1 md:flex-none">
            {isMobile && (
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0">
                  <Sidebar onClose={() => setSidebarOpen(false)} onSelectItem={setSelectedItem} />
                </SheetContent>
              </Sheet>
            )}
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
              variant="outline" 
              size="sm"
              className="bg-card/90 backdrop-blur-md border-border hover:bg-muted hidden sm:flex"
            >
              <Share2 className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Share</span>
            </Button>
            <Button 
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin md:mr-2" />
              ) : (
                <Save className="w-4 h-4 md:mr-2" />
              )}
              <span className="hidden md:inline">Save Setup</span>
            </Button>
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onTouchEnd={onTouchEnd}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
        >
          <Controls className="bg-card border border-border shadow-xl !m-4" />
          <Background color="hsl(var(--muted)/0.2)" gap={20} size={1} variant={BackgroundVariant.Dots} />
          
          <Panel position="bottom-right" className="bg-card/90 backdrop-blur border border-border p-2 md:p-3 rounded-lg shadow-xl mb-4 md:mb-6 mr-4 md:mr-6 max-w-xs text-[10px] md:text-[11px]">
            <h4 className="text-[10px] md:text-xs font-bold uppercase text-muted-foreground mb-2">Instructions</h4>
            <ul className="text-[9px] md:text-[11px] text-foreground space-y-0.5 md:space-y-1 list-disc pl-3 opacity-80">
              {isMobile ? (
                <>
                  <li>Tap menu icon to open components</li>
                  <li>Tap an item to select it</li>
                  <li>Tap canvas to place it</li>
                  <li>Drag connections between nodes</li>
                </>
              ) : (
                <>
                  <li>Drag components from the sidebar</li>
                  <li>Connect inputs (left) to outputs (right)</li>
                  <li>Double click nodes to edit (coming soon)</li>
                  <li>Scroll to zoom, drag to pan</li>
                </>
              )}
            </ul>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

export default function Editor() {
  const [, params] = useRoute('/editor/:id');
  
  return (
    <ReactFlowProvider>
      <EditorContent diagramId={params?.id} />
    </ReactFlowProvider>
  );
}
