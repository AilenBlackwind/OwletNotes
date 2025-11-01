import React, { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';

declare const OBR: any;

const METADATA_KEY = "com.example.token-notes/metadata";

const App: React.FC = () => {
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'loading'>('loading');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Simple initialization
  useEffect(() => {
    const init = async () => {
      if (typeof OBR === 'undefined') {
        console.log("Running in standalone mode - no OBR API");
        setStatus('idle');
        return;
      }

      try {
        console.log("Initializing OBR...");
        await OBR.onReady();
        console.log("OBR is ready!");
        
        // Get initial selection
        const selection = await OBR.player.getSelection();
        console.log("Initial selection:", selection);
        
        if (selection && selection.length > 0) {
          const itemId = selection[0];
          setSelectedItemId(itemId);
          await loadTokenNotes(itemId);
        }
        
        setStatus('idle');
        
        // Listen for selection changes
        console.log("Setting up selection listener...");
        
        // Poll for selection changes every second
        const checkSelection = async () => {
          try {
            const currentSelection = await OBR.player.getSelection();
            if (currentSelection && currentSelection.length > 0) {
              const currentItemId = currentSelection[0];
              if (currentItemId !== selectedItemId) {
                console.log("Selection changed to:", currentItemId);
                setSelectedItemId(currentItemId);
                await loadTokenNotes(currentItemId);
              }
            }
          } catch (error) {
            console.error("Error checking selection:", error);
          }
        };
        
        setInterval(checkSelection, 1000);
        
      } catch (error) {
        console.error("Failed to initialize:", error);
        setStatus('idle');
      }
    };

    init();
  }, []);

  const loadTokenNotes = async (itemId: string) => {
    try {
      console.log("Loading notes for item:", itemId);
      const items = await OBR.scene.items.getItems([itemId]);
      
      if (items.length > 0) {
        const item = items[0];
        const metadata = item.metadata?.[METADATA_KEY] || {};
        const tokenNotes = metadata.notes || '';
        
        console.log("Loaded notes:", tokenNotes);
        setNotes(tokenNotes);
        setIsEditing(!tokenNotes); // Auto-edit if no notes
      }
    } catch (error) {
      console.error("Failed to load notes:", error);
    }
  };

  const saveNotes = async () => {
    if (!selectedItemId || status === 'saving') return;
    
    console.log("Saving notes:", notes, "for item:", selectedItemId);
    setStatus('saving');
    
    try {
      await OBR.scene.items.updateItems([selectedItemId], (items: any[]) => {
        if (items.length > 0) {
          const item = items[0];
          if (!item.metadata) item.metadata = {};
          if (!item.metadata[METADATA_KEY]) item.metadata[METADATA_KEY] = {};
          
          item.metadata[METADATA_KEY].notes = notes;
          console.log("Notes saved to metadata:", item.metadata[METADATA_KEY]);
        }
      });
      
      setStatus('saved');
      setTimeout(() => {
        setStatus('idle');
        setIsEditing(false);
      }, 1500);
      
    } catch (error) {
      console.error("Failed to save:", error);
      setStatus('idle');
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full bg-slate-100 text-slate-800 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          Loading Token Notes...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-800 p-4 font-sans">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-bold">Token Notes</h1>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {isEditing ? 'Preview' : 'Edit'}
        </button>
      </div>

      <div className="flex-grow bg-white border border-slate-300 rounded-md overflow-hidden mb-4">
        {!isEditing ? (
          <div className="p-3 h-full overflow-auto">
            <div className="prose prose-sm max-w-none">
              {notes ? (
                <MDEditor.Markdown source={notes} />
              ) : (
                <p className="text-slate-500 italic">No notes for this token yet. Click Edit to add content.</p>
              )}
            </div>
          </div>
        ) : (
          <MDEditor
            value={notes}
            onChange={(value) => setNotes(value || '')}
            height={400}
            preview="edit"
            textareaProps={{
              placeholder: "Add notes for this token...",
            }}
            data-color-mode="light"
          />
        )}
      </div>
      
      <button
        onClick={saveNotes}
        disabled={!selectedItemId || status === 'saving'}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-2 px-4 rounded"
      >
        {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved!' : 'Save Notes'}
      </button>
      
      {selectedItemId && (
        <p className="text-xs text-slate-500 mt-2 text-center">
          Notes for token: {selectedItemId.slice(0, 8)}...
        </p>
      )}
    </div>
  );
};

export default App;