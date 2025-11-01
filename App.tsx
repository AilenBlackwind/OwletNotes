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

const BoldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M5 4v3h4.5C11.6 7 13 5.4 13 4c0-1.3-.9-2-2.5-2H5zM5 9v3h4.5c1.6 0 3-.6 3-1.5S11.1 9 9.5 9H5zM5 14v3h6c1.7 0 3-.9 3-2s-1.3-2-3-2H5z" />
  </svg>
);

const ItalicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M8 2h4l-2 16h-4l2-16z" />
  </svg>
);

const UnderlineIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M6 2h8v2h-2v8.382c0 .586-.253 1.127-.68 1.464C10.653 14.308 10.3 14.5 9.9 14.5H9.1c-.4 0-.753-.192-1.42-.654C6.753 13.51 6.5 13.048 6.5 12.382V4h2V2H6zM4 18h12v2H4v-2z" />
  </svg>
);

const ListIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 4.5A1.5 1.5 0 014.5 3h11A1.5 1.5 0 0117 4.5v11A1.5 1.5 0 0115.5 17h-11A1.5 1.5 0 013 15.5v-11zM5 7a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2z" />
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
  const [previewMode, setPreviewMode] = useState(false);
  
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

  const formatText = (before: string, after: string = before) => {
    if (!canCurrentlyEdit) return;
    
    const textarea = document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = notes.substring(start, end);
    
    const newText = notes.substring(0, start) + before + selectedText + after + notes.substring(end);
    setNotes(newText);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const formatBold = () => formatText('**');
  const formatItalic = () => formatText('*');
  const formatUnderline = () => formatText('++');
  const formatList = () => {
    if (!canCurrentlyEdit) return;
    
    const textarea = document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const lineStart = notes.lastIndexOf('\n', start - 1) + 1;
    const line = notes.substring(lineStart, start);
    
    let newText;
    if (line.trim().startsWith('- ')) {
      // Remove list formatting
      newText = notes.substring(0, lineStart) + line.replace(/^[\s-]*/, '') + notes.substring(start);
    } else {
      // Add list formatting
      newText = notes.substring(0, lineStart) + '- ' + line + notes.substring(start);
    }
    setNotes(newText);
  };

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
          <div className="flex gap-2">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="p-1 rounded-full hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title={previewMode ? 'Edit' : 'Preview'}
              aria-label={previewMode ? 'Edit' : 'Preview'}
            >
              {previewMode ? <EyeOffIcon /> : <EyeIcon />}
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

      {!previewMode && canCurrentlyEdit && (
        <div className="flex gap-1 mb-3 p-2 bg-slate-200 rounded-md">
          <button
            onClick={formatBold}
            className="p-1.5 rounded hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Bold (Ctrl+B)"
            aria-label="Bold"
          >
            <BoldIcon />
          </button>
          <button
            onClick={formatItalic}
            className="p-1.5 rounded hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Italic (Ctrl+I)"
            aria-label="Italic"
          >
            <ItalicIcon />
          </button>
          <button
            onClick={formatUnderline}
            className="p-1.5 rounded hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Underline"
            aria-label="Underline"
          >
            <UnderlineIcon />
          </button>
          <button
            onClick={formatList}
            className="p-1.5 rounded hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="List"
            aria-label="List"
          >
            <ListIcon />
          </button>
        </div>
      )}

      <div className="flex-grow bg-white border border-slate-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 disabled:bg-slate-200 disabled:cursor-not-allowed" data-color-mode="light">
        {previewMode ? (
          <div className="p-3 h-full overflow-auto text-slate-900">
            <div className="prose prose-sm max-w-none">
              <MDEditor.Markdown source={notes || "*No notes added yet.*"} />
            </div>
          </div>
        ) : (
          <MDEditor
            value={notes}
            onChange={(value) => setNotes(value || '')}
            hideToolbar={!canCurrentlyEdit || status === 'saving'}
            height={200}
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
