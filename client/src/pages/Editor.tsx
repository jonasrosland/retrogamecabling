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
import { Save, ArrowLeft, Download, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

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
        setNodes(flow.nodes || []);
        setEdges(flow.edges || []);
      }
    }
  }, [existingDiagram, setNodes, setEdges]);

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

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow');
      const itemDataString = event.dataTransfer.getData('application/itemData');
      
      if (!type || !itemDataString) return;

      const itemData = JSON.parse(itemDataString);

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
      <Sidebar />
      
      <div className="flex-1 h-full flex flex-col relative" ref={reactFlowWrapper}>
        {/* Top Bar Overlay */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
          <div className="bg-card/90 backdrop-blur-md border border-border p-2 rounded-lg shadow-lg pointer-events-auto flex items-center gap-3">
             <Link href="/" className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="h-6 w-px bg-border mx-1" />
            <Input
              value={diagramName}
              onChange={(e) => setDiagramName(e.target.value)}
              className="bg-transparent border-none focus-visible:ring-0 text-lg font-bold w-64 h-auto py-1 px-2 font-display uppercase tracking-wide"
            />
          </div>

          <div className="flex gap-2 pointer-events-auto">
            <Button 
              variant="outline" 
              className="bg-card/90 backdrop-blur-md border-border hover:bg-muted"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button 
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Setup
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
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
        >
          <Controls className="bg-card border border-border shadow-xl !m-4" />
          <Background color="hsl(var(--muted)/0.2)" gap={20} size={1} variant={BackgroundVariant.Dots} />
          
          <Panel position="bottom-right" className="bg-card/90 backdrop-blur border border-border p-3 rounded-lg shadow-xl mb-6 mr-6 max-w-xs">
            <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Instructions</h4>
            <ul className="text-[11px] text-foreground space-y-1 list-disc pl-3 opacity-80">
              <li>Drag components from the sidebar</li>
              <li>Connect inputs (left) to outputs (right)</li>
              <li>Double click nodes to edit (coming soon)</li>
              <li>Scroll to zoom, drag to pan</li>
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
