import { Link, useLocation } from "wouter";
import { Plus, Trash2, Calendar, FileText, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getRecentFiles, removeFromRecentFiles, type DiagramFile } from "@/lib/fileUtils";
import { useState, useEffect } from "react";

export default function Home() {
  const [diagrams, setDiagrams] = useState<DiagramFile[]>([]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    setDiagrams(getRecentFiles());
  }, []);

  const handleDelete = (name: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    removeFromRecentFiles(name);
    setDiagrams(getRecentFiles());
    toast({ title: "Deleted", description: "Diagram removed from recent files" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border bg-card/30">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px]" />
        <div className="absolute top-0 right-0 p-32 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 p-24 bg-secondary/5 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="container mx-auto px-6 py-24 relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-display font-bold mb-6 leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">Design Your</span> <br/>
              <span className="text-primary drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]">Ultimate Setup</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-10 leading-relaxed max-w-xl">
              Fun and interactive wiring diagrams for retro gaming enthusiasts. 
              Plan your RGB SCART, S-Video, Composite, S-Video, VGA, and HDMI routing with precision.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button 
                size="lg" 
                onClick={() => setLocation('/editor')}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-lg px-8 py-6 h-auto shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all"
              >
                <Plus className="mr-2 h-5 w-5" />
                New Diagram
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="border-border bg-background/50 hover:bg-muted text-lg px-8 py-6 h-auto"
              >
                Documentation
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Diagrams Grid */}
      <div className="container mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Cpu className="w-6 h-6 text-secondary" />
            Your Schematics
          </h2>
        </div>

        {diagrams.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl bg-card/20">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold mb-2">No diagrams yet</h3>
            <p className="text-muted-foreground mb-6">Create your first retro gaming setup diagram to get started.</p>
            <Button onClick={() => setLocation('/editor')}>Create Diagram</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {diagrams.map((diagram) => (
              <div key={diagram.name} className="group relative bg-card hover:bg-card/80 border border-border hover:border-primary/50 rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors" />
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center border border-white/5">
                    <Cpu className="w-5 h-5 text-primary" />
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-2 -mr-2"
                    onClick={(e) => handleDelete(diagram.name, e)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <Link href={`/editor/${encodeURIComponent(diagram.name)}`} className="block">
                  <h3 className="font-display font-bold text-xl mb-2 text-foreground group-hover:text-primary transition-colors truncate">
                    {diagram.name}
                  </h3>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      <span>{diagram.lastModified ? format(new Date(diagram.lastModified), 'MMM d, yyyy') : 'Recently'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span>Saved</span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
