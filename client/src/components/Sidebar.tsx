import React, { useMemo } from 'react';
import { useItems } from '@/hooks/use-items';
import { Gamepad2, Tv, Route, Search, GripVertical } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function Sidebar({ onClose, onSelectItem }: { onClose?: () => void; onSelectItem?: (item: any) => void } = {}) {
  const { data: items, isLoading } = useItems();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const onDragStart = (event: React.DragEvent, nodeType: string, itemData: any) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/itemData', JSON.stringify(itemData));
    event.dataTransfer.effectAllowed = 'move';
  };

  const onTouchStart = (event: React.TouchEvent, nodeType: string, itemData: any) => {
    // Store touch data globally for drop handling
    (window as any).touchDragData = {
      type: nodeType,
      itemData: itemData,
    };
  };

  const filteredItems = useMemo(() => {
    if (!items) return { consoles: [], switchers: [], displays: [] };
    
    const filtered = items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return {
      consoles: filtered.filter(i => i.category === 'console'),
      switchers: filtered.filter(i => i.category === 'switcher'),
      displays: filtered.filter(i => i.category === 'display'),
    };
  }, [items, searchTerm]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-card border-r border-border">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="h-4 w-4 bg-primary rounded-full animate-bounce" />
          <span className="text-xs text-muted-foreground font-mono">LOADING_ASSETS...</span>
        </div>
      </div>
    );
  }

  const DraggableItem = ({ item }: { item: any }) => {
    const isSelected = selectedId === item.id;
    return (
      <div
        className={`group flex items-center gap-3 p-3 rounded-lg border transition-all mb-2 cursor-grab active:cursor-grabbing ${
          isSelected 
            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' 
            : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'
        }`}
        onDragStart={(event) => {
          onDragStart(event, 'equipment', item);
          onClose?.();
        }}
        onTouchStart={(event) => {
          onTouchStart(event, 'equipment', item);
        }}
        onClick={() => {
          setSelectedId(isSelected ? null : item.id);
          onSelectItem?.(isSelected ? null : item);
        }}
        draggable
      >
        <GripVertical className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        <div>
          <div className="font-semibold text-sm">{item.name}</div>
          <div className="text-[10px] text-muted-foreground font-mono flex gap-1">
            {item.specs.inputs && <span>IN:{item.specs.inputs.length}</span>}
            {item.specs.outputs && <span>OUT:{item.specs.outputs.length}</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className="w-full h-full flex flex-col bg-card border-r border-border shadow-2xl z-10">
      <div className="p-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-primary-foreground font-display font-bold text-lg shadow-lg shadow-primary/20">
            R
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-none">RetroGraph</h1>
            <span className="text-[10px] text-muted-foreground font-mono">SYSTEM_BUILDER_V1.0</span>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search equipment..."
            className="pl-9 bg-background/50 border-border focus:border-primary font-mono text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        <Accordion type="multiple" defaultValue={['consoles', 'switchers', 'displays']} className="w-full py-4 space-y-4">
          
          <AccordionItem value="consoles" className="border-none">
            <AccordionTrigger className="hover:no-underline py-2 bg-muted/30 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
              <div className="flex items-center gap-2 text-sm font-display text-primary uppercase tracking-wide">
                <Gamepad2 className="w-4 h-4" />
                Consoles
                <span className="ml-auto text-xs text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border border-border group-hover:border-primary/30">
                  {filteredItems.consoles.length}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-3 pb-0 px-1">
              {filteredItems.consoles.map(item => (
                <DraggableItem key={item.id} item={item} />
              ))}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="switchers" className="border-none">
            <AccordionTrigger className="hover:no-underline py-2 bg-muted/30 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
              <div className="flex items-center gap-2 text-sm font-display text-secondary uppercase tracking-wide">
                <Route className="w-4 h-4" />
                Switchers
                <span className="ml-auto text-xs text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border border-border group-hover:border-secondary/30">
                  {filteredItems.switchers.length}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-3 pb-0 px-1">
              {filteredItems.switchers.map(item => (
                <DraggableItem key={item.id} item={item} />
              ))}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="displays" className="border-none">
            <AccordionTrigger className="hover:no-underline py-2 bg-muted/30 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
              <div className="flex items-center gap-2 text-sm font-display text-accent uppercase tracking-wide">
                <Tv className="w-4 h-4" />
                Displays
                <span className="ml-auto text-xs text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border border-border group-hover:border-accent/30">
                  {filteredItems.displays.length}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-3 pb-0 px-1">
              {filteredItems.displays.map(item => (
                <DraggableItem key={item.id} item={item} />
              ))}
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </ScrollArea>
      
      <div className="p-4 border-t border-border bg-card/50 text-xs text-center text-muted-foreground font-mono">
        DRAG ITEMS TO CANVAS
      </div>
    </aside>
  );
}
