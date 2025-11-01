import React, { useState, useEffect } from 'react';

declare global {
  interface Window {
    OBR?: any;
  }
}

declare const OBR: any;

// Unique plugin ID (required for metadata)
const PLUGIN_ID = "com.example.token-notes";

// Simple markdown to HTML converter
const simpleMarkdownToHTML = (text: string): string => {
  return text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/`(.*?)`/gim, '<code>$1</code>')
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\n$/gim, '<br />')
    .replace(/\n/gim, '<br />');
};

const App: React.FC = () => {
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'loading'>('loading');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentToken, setCurrentToken] = useState<any>(null);

  // Load token notes from metadata
  const loadTokenNotes = async (tokenId: string) => {
    try {
      console.log(`Loading notes for token: ${tokenId}`);
      
      // Get the full token data
      const items = await OBR.scene.items.getItems([tokenId]);
      
      if (items.length > 0) {
        const token = items[0];
        setCurrentToken(token);
        
        // Access metadata using the correct key structure
        const metadata = token.metadata?.[`${PLUGIN_ID}/metadata`] || {};
        const tokenNotes = metadata.notes || '';
        
        console.log("Token notes found:", tokenNotes);
        setNotes(tokenNotes);
        setIsEditing(!tokenNotes); // Auto-edit if no notes
      }
    } catch (error) {
      console.error("Failed to load token notes:", error);
    }
  };

  // Initialize the extension
  useEffect(() => {
    const init = async () => {
      console.log("=== EXTENSION INIT START ===");
      console.log("typeof OBR:", typeof OBR);
      console.log("OBR object:", OBR);
      console.log("window.OBR:", window.OBR);
      console.log("location.href:", window.location.href);
      
      if (typeof OBR === 'undefined') {
        console.log("❌ OBR API not detected - running standalone");
        setStatus('idle');
        return;
      }

      try {
        console.log("✅ OBR API detected - initializing extension...");
        console.log("OBR properties:", Object.keys(OBR));
        
        // Check if we have the required methods
        if (!OBR.onReady || !OBR.contextMenu || !OBR.scene || !OBR.player) {
          console.error("❌ OBR API incomplete - missing required methods");
          setStatus('idle');
          return;
        }
        
        console.log("✅ OBR API methods available");
        
        console.log("Calling OBR.onReady...");
        await OBR.onReady();
        console.log("✅ OBR.onReady completed!");
        
        // Set up context menu for adding notes to tokens
        console.log("Setting up context menu...");
        await setupContextMenu();
        
        // Check if we're coming from a context menu action
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const tokenId = urlParams.get('tokenId');
        
        if (action === 'edit-notes' && tokenId) {
          console.log("📝 Opening notes editor for token:", tokenId);
          setSelectedItemId(tokenId);
          await loadTokenNotes(tokenId);
        }
        
        console.log("=== EXTENSION INIT COMPLETE ===");
        setStatus('idle');
        
      } catch (error) {
        console.error("❌ Failed to initialize extension:", error);
        console.error("Error details:", error.message, error.stack);
        setStatus('idle');
      }
    };

    init();
  }, []);

  // Set up context menu for tokens
  const setupContextMenu = async () => {
    try {
      console.log("=== CONTEXT MENU SETUP START ===");
      console.log("Plugin ID:", PLUGIN_ID);
      
      // Get current role for debugging
      const role = await OBR.player.getRole();
      console.log("Current player role:", role);
      
      // Test context menu creation
      console.log("Creating context menu with ID:", `${PLUGIN_ID}/context-menu`);
      
      const contextMenuResult = await OBR.contextMenu.create({
        id: `${PLUGIN_ID}/context-menu-debug`,
        icons: [
          {
            icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMThoMnYyaC0yeiIvPgo8cGF0aCBkPSJNMTIgM2MtNC40MTggMC04IDMuNTgyLTggOHMzLjU4MiA4IDggOEMxMC42NzEgMjEgMTcuMzI3IDEwLjA2IDIyIDZWN2MwLTMuMzEzLTIuNjg3LTYtNi02SDEzYy0zLjMxMyAwLTMuNjg3IDIuNjg3LTMuNjg3IDZTOS42ODcgMTMgMTMgMTNjMy4zMTMgMCA2LTIuNjg3IDYtNnYtMTRjMC0zLjMxMy0yLjY4Ny02LTYtNkgxNGMtMy4zMTMgMC02IDIuNjg3LTYgNnoiLz4KPC9zdmc+",
            label: "DEBUG: Add Notes (No Icon)",
            filter: {
              roles: ["GM", "PLAYER"],
              every: [
                { key: "layer", value: "CHARACTER", coordinator: "||" },
                { key: "layer", value: "TEXT", coordinator: "||" },
                { key: "layer", value: "PROP", coordinator: "||" },
                { key: "layer", value: "ATTACHMENT", coordinator: "||" },
                { key: "layer", value: "MAP", coordinator: "||" },
              ],
            },
          },
        ],
        onClick(context) {
          console.log("=== CONTEXT MENU CLICKED ===");
          console.log("Context items:", context.items);
          console.log("Context item count:", context.items.length);
          
          if (context.items && context.items.length > 0) {
            const tokenId = context.items[0].id;
            console.log("Token ID from context:", tokenId);
            console.log("Token layer:", context.items[0].layer);
            console.log("Token metadata:", context.items[0].metadata);
            
            // Open the extension with this token
            console.log("Opening OBR action...");
            OBR.action.open();
            
            // Navigate to the notes editor for this token
            const extensionUrl = `${window.location.origin}${window.location.pathname}?action=edit-notes&tokenId=${tokenId}`;
            console.log("Extension URL:", extensionUrl);
            window.history.pushState({}, '', extensionUrl);
            
            // Reload the page to show the notes editor
            console.log("Reloading page...");
            window.location.reload();
          } else {
            console.error("No items in context!");
          }
        },
      });
      
      console.log("Context menu create result:", contextMenuResult);
      console.log("=== CONTEXT MENU SETUP COMPLETE ===");
      
    } catch (error) {
      console.error("=== CONTEXT MENU ERROR ===");
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("Full error:", error);
    }
  };

  // Save notes to token metadata
  const saveNotes = async () => {
    if (!currentToken || status === 'saving') return;
    
    console.log("Saving notes:", notes, "for token:", currentToken.id);
    setStatus('saving');
    
    try {
      // Get current player ID first
      const playerId = await OBR.player.getId();
      
      // Update the token's metadata
      await OBR.scene.items.updateItems([currentToken.id], (items: any[]) => {
        for (let item of items) {
          if (!item.metadata) {
            item.metadata = {};
          }
          
          // Store notes using the correct metadata key
          item.metadata[`${PLUGIN_ID}/metadata`] = {
            notes: notes,
            lastUpdate: Date.now(),
            authorId: playerId,
          };
          
          console.log("Notes saved to token metadata:", item.metadata[`${PLUGIN_ID}/metadata`]);
        }
      });
      
      // Show success feedback
      setStatus('saved');
      setTimeout(() => {
        setStatus('idle');
        setIsEditing(false);
      }, 1500);
      
    } catch (error) {
      console.error("Failed to save notes:", error);
      setStatus('idle');
    }
  };

  // Check if we have a valid token to show notes for
  useEffect(() => {
    const checkToken = async () => {
      if (!selectedItemId) return;
      
      try {
        await loadTokenNotes(selectedItemId);
      } catch (error) {
        console.error("Failed to load token:", error);
      }
    };
    
    checkToken();
  }, [selectedItemId]);

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

  if (!selectedItemId) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-100 text-slate-800 p-4">
        <div className="text-center">
          <h2 className="text-lg font-bold mb-4">Token Notes</h2>
          <p className="text-slate-600 mb-4">
            Right-click on a token and select "Add/Edit Notes" to get started.
          </p>
          <p className="text-sm text-slate-500">
            Or select a token with notes to view and edit them.
          </p>
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
            {notes ? (
              <div 
                className="prose prose-sm max-w-none" 
                dangerouslySetInnerHTML={{ __html: simpleMarkdownToHTML(notes) }}
              />
            ) : (
              <p className="text-slate-500 italic">No notes for this token yet. Click Edit to add content.</p>
            )}
          </div>
        ) : (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes for this token...\n\nYou can use:\n# Header\n## Subheader\n### Sub-subheader\n**bold text**\n*italic text*\n`code`\n> quote"
            className="w-full h-full p-3 border-none outline-none resize-none font-mono text-sm"
            style={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace' }}
          />
        )}
      </div>
      
      <button
        onClick={saveNotes}
        disabled={!currentToken || status === 'saving'}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-2 px-4 rounded"
      >
        {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved!' : 'Save Notes'}
      </button>
      
      {currentToken && (
        <p className="text-xs text-slate-500 mt-2 text-center">
          Notes for token: {currentToken.id.slice(0, 8)}...
        </p>
      )}
    </div>
  );
};

export default App;