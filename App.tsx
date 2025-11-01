import React, { useState, useEffect, useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor';

// In a real Owlbear Rodeo extension, you would import the OBR object.
// For this example, we'll use a mock object.
declare const OBR: any;

const METADATA_KEY = "com.example.token-notes/metadata";
const BROADCAST_CHANNEL = "com.example.token-notes/update";

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
  </svg>
);

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
  </svg>
);

const UnlockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 2a5 5 0 00-5 5v3h10V7a5 5 0 00-5-5zm-2 9a2 2 0 104 0H8z" />
    <path fillRule="evenodd" d="M5 11a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2H5zm2 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
  </svg>
);


const App: React.FC = () => {
  const [notes, setNotes] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'loading'>('loading');
  const [isReady, setIsReady] = useState(false);
  const [hasDirectPermissions, setHasDirectPermissions] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const canCurrentlyEdit = !isLocked || hasDirectPermissions;

  const updateStateFromItem = useCallback((item: any) => {
    const metadata = item.metadata[METADATA_KEY] as { notes?: string; isLocked?: boolean } || {};
    setNotes(metadata.notes || '');
    setIsLocked(metadata.isLocked || false);
    // Auto-enter edit mode for empty notes to guide user
    setIsEditing(!metadata.notes);
  }, []);

  // Effect to initialize and load data
  useEffect(() => {
    if (typeof OBR === 'undefined') {
      console.warn("OBR SDK not found. Running in standalone mode.");
      setStatus('idle');
      setHasDirectPermissions(true);
      return;
    }

    const initializeApp = async () => {
      try {
        await OBR.onReady();
        setIsReady(true);
        
        // Get initial selection
        const selection = await OBR.player.getSelection();
        const role = await OBR.player.getRole();
        const playerId = await OBR.player.getId();
        
        console.log("OBR initialized:", { selection, role, playerId });
        
        if (selection && selection.length > 0) {
          // Handle multiple selections - take the first one
          const currentItemId = selection[0];
          setSelectedItemId(currentItemId);
          await loadItemData(currentItemId, playerId, role);
        }
        
        setStatus('idle');
      } catch (error) {
        console.error("Failed to initialize OBR:", error);
        setStatus('idle');
        setHasDirectPermissions(true);
      }
    };

    initializeApp();
  }, [updateStateFromItem]);

  const loadItemData = useCallback(async (itemId: string, playerId: string, role: string) => {
    try {
      const items = await OBR.scene.items.getItems([itemId]);
      if (items.length === 1) {
        const item = items[0];
        console.log("Loaded item data:", item);
        updateStateFromItem(item);
        const isOwner = item.createdUserId === playerId;
        const isGM = role === 'GM';
        setHasDirectPermissions(isGM || isOwner);
      }
    } catch (error) {
      console.error("Failed to load item data:", error);
    }
  }, [updateStateFromItem]);

  // Effect for selection changes and real-time updates
  useEffect(() => {
    if (!isReady) return;

    // Listen for item changes (includes selection changes)
    const handleItemChange = (items: any[]) => {
      console.log("Scene items changed:", items.length);
      
      // Check if our selected item was modified
      if (selectedItemId) {
        const changedItem = items.find(item => item.id === selectedItemId);
        if (changedItem) {
          console.log("Selected item changed, updating display:", changedItem);
          updateStateFromItem(changedItem);
        }
      }
      
      // Also check for selection changes by monitoring all items
      OBR.player.getSelection().then((selection: string[]) => {
        if (selection && selection.length > 0) {
          const currentItemId = selection[0];
          if (currentItemId !== selectedItemId) {
            console.log("Selection changed to:", currentItemId);
            setSelectedItemId(currentItemId);
            OBR.player.getId().then((playerId: string) => {
              OBR.player.getRole().then((role: string) => {
                loadItemData(currentItemId, playerId, role);
              });
            });
          }
        } else if (selectedItemId && (!selection || selection.length === 0)) {
          // No selection - clear the interface
          console.log("No selection detected");
          setSelectedItemId(null);
          setNotes('');
          setIsLocked(false);
          setHasDirectPermissions(false);
        }
      });
    };

    const unsubscribeItems = OBR.scene.items.onChange(handleItemChange);
    
    // Poll for selection changes every 500ms to ensure we catch selection changes
    const selectionPollInterval = setInterval(() => {
      OBR.player.getSelection().then((selection: string[]) => {
        if (selection && selection.length > 0) {
          const currentItemId = selection[0];
          if (currentItemId !== selectedItemId) {
            console.log("Polled selection change:", currentItemId);
            setSelectedItemId(currentItemId);
            OBR.player.getId().then((playerId: string) => {
              OBR.player.getRole().then((role: string) => {
                loadItemData(currentItemId, playerId, role);
              });
            });
          }
        } else if (selectedItemId && (!selection || selection.length === 0)) {
          console.log("Polled no selection");
          setSelectedItemId(null);
          setNotes('');
          setIsLocked(false);
          setHasDirectPermissions(false);
        }
      });
    }, 500);
    
    return () => {
      if (typeof unsubscribeItems === 'function') {
        unsubscribeItems();
      }
      clearInterval(selectionPollInterval);
    };
  }, [isReady, selectedItemId, updateStateFromItem, loadItemData]);

  // Effect for handling edit requests and player changes
  useEffect(() => {
    if (!isReady) return;

    const handleBroadcast = (message: {data: any, connectionId: number}) => {
      const { tokenId, newNotes, requester } = message.data;
      console.log("Received broadcast message:", { tokenId, newNotes, requester });
      
      OBR.player.getId().then((playerId: string) => {
        if (requester === playerId) return;

        Promise.all([
          OBR.player.getRole(),
          OBR.scene.items.getItems([tokenId])
        ]).then(([role, items]) => {
          if (items.length === 1) {
            const item = items[0];
            const metadata = item.metadata?.[METADATA_KEY] as { isLocked?: boolean } || {};
            
            // Security check: ignore requests for locked notes
            if (metadata.isLocked) {
              console.log("Ignoring edit request - note is locked");
              return;
            }

            const isOwner = item.createdUserId === playerId;
            const isGM = role === 'GM';

            if (isGM || isOwner) {
              console.log("Permission granted, updating item:", { isOwner, isGM });
              OBR.scene.items.updateItems([tokenId], (itemsToUpdate: any[]) => {
                if (itemsToUpdate.length === 1) {
                  const itemToUpdate = itemsToUpdate[0];
                  if (!itemToUpdate.metadata) {
                    itemToUpdate.metadata = {};
                  }
                  if (!itemToUpdate.metadata[METADATA_KEY]) {
                     itemToUpdate.metadata[METADATA_KEY] = {};
                  }
                  (itemToUpdate.metadata[METADATA_KEY] as any).notes = newNotes;
                  console.log("Updated item via broadcast:", itemToUpdate.metadata[METADATA_KEY]);
                }
              });
            } else {
              console.log("Permission denied for broadcast update");
            }
          }
        });
      });
    };
    
    const unsubscribeBroadcast = OBR.broadcast.onMessage(BROADCAST_CHANNEL, handleBroadcast);

    // Listen for player changes
    const handlePlayerChange = (player: any) => {
      console.log("Player changed:", player);
      // Refresh permissions when player changes
      if (selectedItemId) {
        OBR.player.getId().then((playerId: string) => {
          OBR.player.getRole().then((role: string) => {
            loadItemData(selectedItemId, playerId, role);
          });
        });
      }
    };

    const unsubscribePlayer = OBR.player.onChange(handlePlayerChange);
    
    return () => {
      if (typeof unsubscribeBroadcast === 'function') {
        unsubscribeBroadcast();
      }
      if (typeof unsubscribePlayer === 'function') {
        unsubscribePlayer();
      }
    };

  }, [isReady, selectedItemId, loadItemData]);


  const handleLockToggle = async () => {
    if (!hasDirectPermissions || !selectedItemId) return;

    const newLockedState = !isLocked;
    setIsLocked(newLockedState); // Optimistic UI update

    await OBR.scene.items.updateItems([selectedItemId], (items: any[]) => {
        if (items.length === 1) {
            const item = items[0];
            if (!item.metadata[METADATA_KEY]) {
                item.metadata[METADATA_KEY] = {};
            }
            (item.metadata[METADATA_KEY] as any).isLocked = newLockedState;
            // Preserve existing notes when toggling lock
            if ((item.metadata[METADATA_KEY] as any).notes === undefined) {
              (item.metadata[METADATA_KEY] as any).notes = notes;
            }
        }
    });
  }

  const handleSave = async () => {
    if (status === 'saving' || !isReady || !selectedItemId || !canCurrentlyEdit) return;
    
    console.log("Saving notes for item:", selectedItemId, { notes, isLocked });
    setStatus('saving');

    try {
      if (hasDirectPermissions) {
        await OBR.scene.items.updateItems([selectedItemId], (items: any[]) => {
          if (items.length === 1) {
            const item = items[0];
            if (!item.metadata) {
              item.metadata = {};
            }
            if (!item.metadata[METADATA_KEY]) {
              item.metadata[METADATA_KEY] = {};
            }
            (item.metadata[METADATA_KEY] as any).notes = notes;
            (item.metadata[METADATA_KEY] as any).isLocked = isLocked;
            console.log("Updated item metadata:", item.metadata[METADATA_KEY]);
          }
        });
        
        // Verify the save by re-reading the item
        setTimeout(async () => {
          try {
            const items = await OBR.scene.items.getItems([selectedItemId]);
            if (items.length === 1) {
              const savedNotes = items[0].metadata?.[METADATA_KEY]?.notes || '';
              console.log("Verified saved notes:", savedNotes);
            }
          } catch (error) {
            console.error("Failed to verify save:", error);
          }
        }, 100);
      } else {
        const playerId = await OBR.player.getId();
        await OBR.broadcast.sendMessage({
          channel: BROADCAST_CHANNEL,
          data: {
            tokenId: selectedItemId,
            newNotes: notes,
            requester: playerId,
          },
        });
      }

      setStatus('saved');
      setTimeout(() => {
        setStatus('idle');
        setIsEditing(false); // Auto-return to preview mode after saving
      }, 2000);
    } catch (error) {
      console.error("Failed to save notes:", error);
      setStatus('idle');
    }
  };

  if (status === 'loading') {
    return (
        <div className="flex items-center justify-center h-full bg-slate-100 text-slate-800 p-4">
            Loading...
        </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-800 p-4 font-sans antialiased">
      <div className="flex justify-between items-center mb-3">
          <h1 className="text-lg font-bold text-slate-900">Token Notes</h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (isEditing) {
                  // Cancel editing - restore original notes if needed
                  setIsEditing(false);
                } else {
                  // Enter edit mode
                  setIsEditing(true);
                }
              }}
              className="p-1 rounded-full hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title={isEditing ? 'Cancel Edit' : 'Edit'}
              aria-label={isEditing ? 'Cancel Edit' : 'Edit'}
            >
              {isEditing ? <EyeOffIcon /> : <EyeIcon />}
            </button>
            {hasDirectPermissions && (
              <button
                onClick={handleLockToggle}
                className="p-1 rounded-full hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title={isLocked ? 'Unlock Note' : 'Lock Note'}
                aria-label={isLocked ? 'Unlock Note' : 'Lock Note'}
              >
                {isLocked ? <LockIcon /> : <UnlockIcon />}
              </button>
            )}
          </div>
      </div>

      <div className="flex-grow bg-white border border-slate-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 disabled:bg-slate-200 disabled:cursor-not-allowed" data-color-mode="light">
        {!isEditing ? (
          <div className="p-3 h-full overflow-auto text-slate-900">
            <div className="prose prose-sm max-w-none">
              <MDEditor.Markdown source={notes || "*No notes added yet. Click Edit to add content.*"} />
            </div>
          </div>
        ) : (
          <MDEditor
            value={notes}
            onChange={(value) => setNotes(value || '')}
            hideToolbar={!canCurrentlyEdit && status === 'saving'}
            height={450}
            preview="edit"
            textareaProps={{
              placeholder: "Add a collaborative note for this token...",
              disabled: !canCurrentlyEdit || status === 'saving',
              'aria-label': 'Token notes text area'
            }}
            data-color-mode="light"
          />
        )}
      </div>
      <button
        onClick={handleSave}
        disabled={!canCurrentlyEdit || status === 'saving' || !selectedItemId}
        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 focus:ring-blue-500"
      >
        {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved!' : 'Save Notes'}
      </button>
      <p className="text-xs text-slate-500 mt-2 text-center">
        {isLocked ? 'Note is locked. Only the GM or owner can edit.' : 'A collaborative note for the token.'}
      </p>
    </div>
  );
};

export default App;
