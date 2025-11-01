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
    const metadata = item.metadata?.[METADATA_KEY] as { notes?: string; isLocked?: boolean } || {};
    setNotes(metadata.notes || '');
    setIsLocked(metadata.isLocked || false);
    setIsEditing(!metadata.notes);
  }, []);

  // Simplified initialization
  useEffect(() => {
    const init = async () => {
      if (typeof OBR === 'undefined') {
        console.warn("OBR SDK not found. Running in standalone mode.");
        setStatus('idle');
        setHasDirectPermissions(true);
        return;
      }

      try {
        await OBR.onReady();
        setIsReady(true);
        setStatus('idle');
        console.log("OBR ready");
      } catch (error) {
        console.error("Failed to initialize OBR:", error);
        setStatus('idle');
      }
    };

    init();
  }, []);

  // Load item data when selection changes
  useEffect(() => {
    const loadData = async () => {
      if (!isReady) return;

      try {
        const selection = await OBR.player.getSelection();
        const playerId = await OBR.player.getId();
        const role = await OBR.player.getRole();
        
        if (selection && selection.length > 0) {
          const itemId = selection[0];
          setSelectedItemId(itemId);
          
          const items = await OBR.scene.items.getItems([itemId]);
          if (items.length === 1) {
            const item = items[0];
            updateStateFromItem(item);
            
            const isOwner = item.createdUserId === playerId;
            const isGM = role === 'GM';
            setHasDirectPermissions(isGM || isOwner);
          }
        } else {
          setSelectedItemId(null);
          setNotes('');
          setIsLocked(false);
          setHasDirectPermissions(false);
        }
      } catch (error) {
        console.error("Failed to load item data:", error);
      }
    };

    loadData();
  }, [isReady, updateStateFromItem]);

  // Listen for changes
  useEffect(() => {
    if (!isReady) return;

    const handleItemChange = (items: any[]) => {
      if (selectedItemId) {
        const changedItem = items.find(item => item.id === selectedItemId);
        if (changedItem) {
          updateStateFromItem(changedItem);
        }
      }
    };

    const unsubscribe = OBR.scene.items.onChange(handleItemChange);
    return unsubscribe;
  }, [isReady, selectedItemId, updateStateFromItem]);

  const handleLockToggle = async () => {
    if (!hasDirectPermissions || !selectedItemId) return;

    const newLockedState = !isLocked;
    setIsLocked(newLockedState);

    try {
      await OBR.scene.items.updateItems([selectedItemId], (items: any[]) => {
        if (items.length === 1) {
          const item = items[0];
          if (!item.metadata) item.metadata = {};
          if (!item.metadata[METADATA_KEY]) item.metadata[METADATA_KEY] = {};
          item.metadata[METADATA_KEY].isLocked = newLockedState;
          if (item.metadata[METADATA_KEY].notes === undefined) {
            item.metadata[METADATA_KEY].notes = notes;
          }
        }
      });
    } catch (error) {
      console.error("Failed to toggle lock:", error);
    }
  };

  const handleSave = async () => {
    if (status === 'saving' || !isReady || !selectedItemId || !canCurrentlyEdit) return;
    
    setStatus('saving');

    try {
      await OBR.scene.items.updateItems([selectedItemId], (items: any[]) => {
        if (items.length === 1) {
          const item = items[0];
          if (!item.metadata) item.metadata = {};
          if (!item.metadata[METADATA_KEY]) item.metadata[METADATA_KEY] = {};
          item.metadata[METADATA_KEY].notes = notes;
          item.metadata[METADATA_KEY].isLocked = isLocked;
        }
      });

      setStatus('saved');
      setTimeout(() => {
        setStatus('idle');
        setIsEditing(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to save:", error);
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
            onClick={() => setIsEditing(!isEditing)}
            className="p-1 rounded-full hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title={isEditing ? 'Cancel Edit' : 'Edit'}
          >
            {isEditing ? <EyeOffIcon /> : <EyeIcon />}
          </button>
          {hasDirectPermissions && (
            <button
              onClick={handleLockToggle}
              className="p-1 rounded-full hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title={isLocked ? 'Unlock Note' : 'Lock Note'}
            >
              {isLocked ? <LockIcon /> : <UnlockIcon />}
            </button>
          )}
        </div>
      </div>

      <div className="flex-grow bg-white border border-slate-300 rounded-md overflow-hidden">
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
            height={450}
            preview="edit"
            textareaProps={{
              placeholder: "Add a collaborative note for this token...",
              disabled: !canCurrentlyEdit || status === 'saving',
            }}
            data-color-mode="light"
          />
        )}
      </div>
      
      <button
        onClick={handleSave}
        disabled={!canCurrentlyEdit || status === 'saving' || !selectedItemId}
        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-2 px-4 rounded-md"
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