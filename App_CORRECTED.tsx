import React, { useState, useEffect } from 'react';

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
      if (typeof OBR === 'undefined') {
        console.log("Running in standalone mode - no OBR API");
        setStatus('idle');
        return;
      }

      try {
        console.log("Initializing OBR extension...");
        
        // Required: OBR.onReady() for proper initialization
        await OBR.onReady();
        console.log("OBR is ready!");
        
        // Set up context menu for adding notes to tokens
        await setupContextMenu();
        
        // Check if we're coming from a context menu action
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const tokenId = urlParams.get('tokenId');
        
        if (action === 'edit-notes' && tokenId) {
          console.log("Opening notes editor for token:", tokenId);
          setSelectedItemId(tokenId);
          await loadTokenNotes(tokenId);
        }
        
        setStatus('idle');
        
      } catch (error) {
        console.error("Failed to initialize:", error);
        setStatus('idle');
      }
    };

    init();
  }, []);

  // Set up context menu for tokens
  const setupContextMenu = async () => {
    try {
      OBR.contextMenu.create({
        id: `${PLUGIN_ID}/context-menu`,
        icons: [
          {
            icon: "/note-icon.svg",
            label: "Add/Edit Notes",
            filter: {
              roles: ["GM", "PLAYER"],
              every: [
                { key: "layer", value: "CHARACTER", coordinator: "||" },
                { key: "layer", value: "TEXT", coordinator: "||" },
                { key: "layer", value: "PROP", coordinator: "||" },
                { key: "layer", value: "ATTACHMENT", coordinator: "||" },
              ],
            },
          },
        ],
        onClick(context) {
          const tokenId = context.items[0].id;
          console.log("Context menu clicked for token:", tokenId);
          
          // Open the extension with this token
          OBR.action.open();
          
          // Navigate to the notes editor for this token
          const extensionUrl = `${window.location.origin}${window.location.pathname}?action=edit-notes&tokenId=${tokenId}`;
          window.history.pushState({}, '', extensionUrl);
          
          // Reload the page to show the notes editor
          window.location.reload();
        },
      });
      
      console.log("Context menu created successfully");
    } catch (error) {
      console.error("Failed to create context menu:", error);
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