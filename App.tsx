import React, { useState, useEffect, useCallback } from 'react';

// In a real Owlbear Rodeo extension, you would import the OBR object.
// For this example, we'll use a mock object.
declare const OBR: any;

const METADATA_KEY = "com.example.token-notes/metadata";
const BROADCAST_CHANNEL = "com.example.token-notes/update";

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
  
  const canCurrentlyEdit = !isLocked || hasDirectPermissions;

  const updateStateFromItem = useCallback((item: any) => {
    const metadata = item.metadata[METADATA_KEY] as { notes?: string; isLocked?: boolean } || {};
    setNotes(metadata.notes || '');
    setIsLocked(metadata.isLocked || false);
  }, []);

  // Effect to initialize and load data
  useEffect(() => {
    if (typeof OBR === 'undefined' || !OBR.isReady) {
      console.warn("OBR SDK not found or not ready. Running in standalone mode.");
      setStatus('idle');
      setHasDirectPermissions(true);
      return;
    }

    OBR.onReady(() => {
      setIsReady(true);
      
      Promise.all([
        OBR.player.getSelection(),
        OBR.player.getRole(),
        OBR.player.getId(),
      ]).then(([selection, role, playerId]) => {
        if (selection && selection.length === 1) {
          const currentItemId = selection[0];
          setSelectedItemId(currentItemId);
          OBR.scene.items.getItems([currentItemId]).then((items: any[]) => {
            if (items.length === 1) {
              const item = items[0];
              updateStateFromItem(item);
              const isOwner = item.createdUserId === playerId;
              const isGM = role === 'GM';
              setHasDirectPermissions(isGM || isOwner);
            }
            setStatus('idle');
          });
        } else {
          setStatus('idle');
        }
      });
    });
  }, [updateStateFromItem]);

  // Effect for real-time updates
  useEffect(() => {
    if (!isReady || !selectedItemId) return;

    const handleItemChange = (items: any[]) => {
      const changedItem = items.find(item => item.id === selectedItemId);
      if (changedItem) {
        updateStateFromItem(changedItem);
      }
    };

    const unsubscribe = OBR.scene.items.onChange(handleItemChange);
    
    return () => {
      // Assuming onChange returns an unsubscribe function as is best practice.
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [isReady, selectedItemId, updateStateFromItem]);

  // Effect for handling edit requests
  useEffect(() => {
    if (!isReady) return;

    const handleBroadcast = (message: {data: any, connectionId: number}) => {
      const { tokenId, newNotes, requester } = message.data;
      
      OBR.player.getId().then((playerId: string) => {
        if (requester === playerId) return;

        Promise.all([
          OBR.player.getRole(),
          OBR.scene.items.getItems([tokenId])
        ]).then(([role, items]) => {
          if (items.length === 1) {
            const item = items[0];
            const metadata = item.metadata[METADATA_KEY] as { isLocked?: boolean } || {};
            
            // Security check: ignore requests for locked notes
            if (metadata.isLocked) {
              return;
            }

            const isOwner = item.createdUserId === playerId;
            const isGM = role === 'GM';

            if (isGM || isOwner) {
              OBR.scene.items.updateItems([tokenId], (itemsToUpdate: any[]) => {
                if (itemsToUpdate.length === 1) {
                  const itemToUpdate = itemsToUpdate[0];
                  if (!itemToUpdate.metadata[METADATA_KEY]) {
                     itemToUpdate.metadata[METADATA_KEY] = {};
                  }
                  (itemToUpdate.metadata[METADATA_KEY] as any).notes = newNotes;
                }
              });
            }
          }
        });
      });
    };
    
    return OBR.broadcast.onMessage(BROADCAST_CHANNEL, handleBroadcast);

  }, [isReady]);

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
    
    setStatus('saving');

    if (hasDirectPermissions) {
      await OBR.scene.items.updateItems([selectedItemId], (items: any[]) => {
        if (items.length === 1) {
          const item = items[0];
          if (!item.metadata[METADATA_KEY]) {
             item.metadata[METADATA_KEY] = {};
          }
          (item.metadata[METADATA_KEY] as any).notes = notes;
          (item.metadata[METADATA_KEY] as any).isLocked = isLocked;
        }
      });
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
    setTimeout(() => setStatus('idle'), 2000);
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
      <textarea
        className="flex-grow bg-white border border-slate-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-slate-900 placeholder-slate-400 disabled:bg-slate-200 disabled:cursor-not-allowed"
        placeholder="Add a collaborative note for this token..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={!canCurrentlyEdit || status === 'saving'}
        aria-label="Token notes text area"
      />
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
