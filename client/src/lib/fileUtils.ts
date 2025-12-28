export interface DiagramFile {
  name: string;
  data: any;
  lastModified?: number;
}

// File System Access API (modern browsers)
export async function saveFile(data: DiagramFile): Promise<void> {
  if ('showSaveFilePicker' in window) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: `${data.name}.json`,
        types: [{
          description: 'JSON files',
          accept: { 'application/json': ['.json'] },
        }],
      });
      
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      
      // Save to recent files
      saveToRecentFiles(data.name, data);
    } catch (err: any) {
      // User cancelled or error
      if (err.name !== 'AbortError') {
        throw err;
      }
    }
  } else {
    // Fallback: download file
    downloadFile(data);
  }
}

export async function loadFile(): Promise<DiagramFile | null> {
  if ('showOpenFilePicker' in window) {
    try {
      const [fileHandle] = await (window as any).showOpenFilePicker({
        types: [{
          description: 'JSON files',
          accept: { 'application/json': ['.json'] },
        }],
      });
      
      const file = await fileHandle.getFile();
      const text = await file.text();
      const data = JSON.parse(text) as DiagramFile;
      
      // Save to recent files
      saveToRecentFiles(data.name, data);
      
      return data;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        throw err;
      }
      return null;
    }
  } else {
    // Fallback: use file input
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const text = await file.text();
          const data = JSON.parse(text) as DiagramFile;
          saveToRecentFiles(data.name, data);
          resolve(data);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  }
}

function downloadFile(data: DiagramFile): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.name}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  // Save to recent files
  saveToRecentFiles(data.name, data);
}

export function loadFileFromRecent(name: string): DiagramFile | null {
  const recent = getRecentFiles();
  return recent.find(f => f.name === name) || null;
}

export function getRecentFiles(): DiagramFile[] {
  try {
    const stored = localStorage.getItem('recentDiagrams');
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveToRecentFiles(name: string, data: DiagramFile): void {
  const recent = getRecentFiles();
  const existingIndex = recent.findIndex(f => f.name === name);
  
  const fileData: DiagramFile = {
    ...data,
    lastModified: Date.now(),
  };
  
  if (existingIndex >= 0) {
    recent[existingIndex] = fileData;
  } else {
    recent.unshift(fileData);
  }
  
  // Keep only last 20 files
  const limited = recent.slice(0, 20);
  localStorage.setItem('recentDiagrams', JSON.stringify(limited));
}

export function removeFromRecentFiles(name: string): void {
  const recent = getRecentFiles();
  const filtered = recent.filter(f => f.name !== name);
  localStorage.setItem('recentDiagrams', JSON.stringify(filtered));
}

