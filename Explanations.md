# Детальное объяснение привязки текста к токенам в OBR

## 1. Основная архитектура привязки

### Уникальный идентификатор плагина
```typescript
// src/main.tsx
export const ID = "es.memorablenaton.map-location-keys";
```

Каждый плагин имеет уникальный ID, который используется для хранения данных в metadata токенов.

### Структура данных в metadata
```typescript
// При добавлении токена в локационные ключи
item.metadata[`${ID}/metadata`] = {
  locationKey: "текст описания в markdown",
  playerInfo: "информация для игроков",
  isPlayerVisible: false
};
```

## 2. Механизм привязки текста к токенам

### Через контекстное меню
```typescript
// src/contextMenu.ts
OBR.contextMenu.create({
  id: `${ID}/context-menu-add-remove`,
  onClick(context) {
    // Проверяем, есть ли уже metadata
    const addToLocationKeys = context.items.every(
      (item) => item.metadata[`${ID}/metadata`] === undefined
    );

    if (addToLocationKeys) {
      // Добавляем metadata с описанием
      OBR.scene.items.updateItems(context.items, (items) => {
        for (let item of items) {
          item.metadata[`${ID}/metadata`] = {
            locationKey: locationKeyTemplate, // шаблон markdown
          };
        }
      });
    }
  }
});
```

### Система фильтрации в контекстном меню
```typescript
filter: {
  roles: ["GM"], // только для GM
  every: [
    { key: "layer", value: "TEXT", coordinator: "||" }, // TEXT или PROP слой
    { key: "layer", value: "PROP" },
    { key: ["metadata", `${ID}/metadata`], value: undefined }, // без metadata
  ],
}
```

## 3. Загрузка и отображение привязанных данных

### Поиск токенов с привязанными данными
```typescript
// src/utils.ts
export function loadExistingLocationKeys(
  items: Item[],
  newLocationKeys: LocationKey[],
  getItemText: (item: any) => any
) {
  for (const item of items) {
    // Ищем токены с нашим metadata
    if (item.metadata[`${ID}/metadata`]) {
      const metadata = item.metadata[`${ID}/metadata`] as any;
      newLocationKeys.push({
        description: metadata.locationKey as string, // основное описание
        name: getItemText(item), // текст с токена
        id: item.id, // ID токена для привязки
        playerInfo: metadata.playerInfo || "",
        isPlayerVisible: metadata.isPlayerVisible || false,
      });
    }
  }
}
```

### Получение текста с токена
```typescript
export const getItemText = (item: any) => {
  if (item.text.richText && item.text.richText.length > 0) {
    // Если это rich text, собираем все строки
    return item.text.richText
      .map((line: any) => line.children.map((child: any) => child.text).join(''))
      .join(' ');
  }
  // Иначе используем plain text
  return item.text.plainText;
};
```

## 4. Редактирование привязанного текста

### Сохранение изменений
```typescript
// src/components/LocationKey.tsx
const handleSave = () => {
  OBR.scene.items
    .updateItems(
      (item) => item.id === locationKey.id, // ищем конкретный токен
      (items) => {
        for (let item of items) {
          // Обновляем metadata токена
          item.metadata[`${ID}/metadata`] = { 
            locationKey: description, // новое описание
            playerInfo: playerInfo,
            isPlayerVisible: isPlayerVisible
          };
        }
      }
    )
    .then(() => {
      // Уведомляем все клиенты об изменениях
      OBR.broadcast.sendMessage(`${ID}/broadcast`, `${locationKey.id}`, {
        destination: "LOCAL",
      });
    });
};
```

## 5. Синхронизация между клиентами (совместное редактирование)

### Broadcast система
```typescript
// При сохранении изменений
OBR.broadcast.sendMessage(`${ID}/broadcast`, `${locationKey.id}`, {
  destination: "LOCAL",
});

// При получении сообщений
useEffect(() => {
  OBR.broadcast.onMessage(`${ID}/broadcast`, (event) => {
    setLocationToReveal(event.data as string); // ID токена
    // Прокручиваем к соответствующему элементу
    window.document
      .getElementById(`accordion-${event.data as string}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}, []);
```

### Автоматическое обновление при изменениях
```typescript
// src/components/SPA.tsx
OBR.scene.items.onChange((items) => {
  // Перезагружаем все локационные ключи при любых изменениях
  loadLocationKeys(items.filter((item) => 
    item.layer === "TEXT" || item.layer === "PROP"
  ));
});
```

## 6. Система ролей (GM vs Player)

### Разделение интерфейсов
```typescript
// src/components/SPA.tsx
return role === "GM" ? (
  // Полный интерфейс для GM
  <Routes>...</Routes>
) : (
  // Ограниченный интерфейс для игроков
  <Routes>
    <Route path="/" element={<Navigate to={paths.playerView} />} />
    <Route path={paths.playerView} element={<PlayerView />} />
  </Routes>
);
```

### Интерфейс игроков (только видимые данные)
```typescript
// src/components/PlayerView.tsx
const loadPlayerVisibleKeys = (items: Item[]): void => {
  const allLocationKeys: LocationKey[] = [];
  loadExistingLocationKeys(items, allLocationKeys, getItemText);

  // Показываем только то, что помечено как видимое для игроков
  const visibleKeys = allLocationKeys.filter(key => key.isPlayerVisible);
  sortLocationKeys(visibleKeys);

  setPlayerVisibleKeys(visibleKeys);
};
```

# Обновленные рекомендации для системы текстовых пометок к токенам

## Основные принципы для системы текстовых пометок

### 1. Базовые константы и типы

```typescript
// constants.ts
export const ID = "your.unique.plugin.id";

// types.ts
export interface TextNote {
  id: string;
  tokenId: string;
  noteText: string;
  author: string;
  timestamp: number;
  category?: string; // опциональная категория пометки
  isVisibleToPlayers: boolean;
}
```

### 2. Универсальное контекстное меню

```typescript
// contextMenu.ts
import OBR from "@owlbear-rodeo/sdk";
import { ID } from "./constants";

export function setupTextNotesMenu() {
  OBR.contextMenu.create({
    id: `${ID}/notes-menu`,
    icons: [
      {
        icon: "/note-icon.svg",
        label: "Add Text Note",
        filter: {
          roles: ["GM", "PLAYER"],
          every: [
            { key: "layer", value: "CHARACTER", coordinator: "||" },
            { key: "layer", value: "TEXT", coordinator: "||" },
            { key: "layer", value: "PROP", coordinator: "||" },
            { key: ["metadata", `${ID}/notes`], value: undefined },
          ],
        },
      },
      {
        icon: "/view-notes-icon.svg", 
        label: "View/Edit Notes",
        filter: {
          roles: ["GM", "PLAYER"],
          every: [
            { key: "layer", value: "CHARACTER", coordinator: "||" },
            { key: "layer", value: "TEXT", coordinator: "||" },
            { key: "layer", value: "PROP", coordinator: "||" },
            { key: ["metadata", `${ID}/notes`], value: undefined, operator: "!=" },
          ],
        },
      },
    ],
    onClick(context) {
      const hasNotes = context.items.every(
        (item) => item.metadata[`${ID}/notes`] !== undefined
      );

      if (!hasNotes) {
        createNewNotes(context.items[0]);
      } else {
        openNotesEditor(context.items[0]);
      }
    },
  });
}
```

### 3. Структура данных для пометок

```typescript
// Универсальная структура для любых текстовых пометок
interface TokenNotes {
  notes: TextNote[]; // массив всех пометок для токена
  categories: string[]; // доступные категории
  lastUpdate: number;
}

// Функция создания новых пометок
function createNewNotes(token: any) {
  const notesData: TokenNotes = {
    notes: [],
    categories: ["General", "Important", "Combat", "Roleplay", "Location"],
    lastUpdate: Date.now(),
  };

  OBR.scene.items.updateItems([token.id], (items) => {
    for (let item of items) {
      item.metadata[`${ID}/notes`] = notesData;
    }
  });
}

// Добавление новой пометки
function addNoteToToken(tokenId: string, noteText: string, category: string = "General") {
  const newNote: TextNote = {
    id: Date.now().toString(),
    tokenId,
    noteText,
    author: currentPlayer.name,
    timestamp: Date.now(),
    category,
    isVisibleToPlayers: false,
  };

  OBR.scene.items.updateItems([tokenId], (items) => {
    for (let item of items) {
      const notesData = item.metadata[`${ID}/notes`];
      if (notesData) {
        notesData.notes.push(newNote);
        notesData.lastUpdate = Date.now();
        item.metadata[`${ID}/notes`] = notesData;
      }
    }
  });

  // Синхронизация с другими клиентами
  OBR.broadcast.sendMessage(`${ID}/note-update`, {
    type: "add",
    tokenId,
    note: newNote,
  });
}
```

### 4. Универсальный редактор пометок

```typescript
// NotesEditor.tsx
import React, { useState, useEffect } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { ID } from "./constants";

const NotesEditor: React.FC<{ tokenId: string }> = ({ tokenId }) => {
  const [notes, setNotes] = useState<TextNote[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("General");
  const [player, setPlayer] = useState<any>(null);

  useEffect(() => {
    // Загружаем данные игрока
    OBR.player.getPlayer().then(setPlayer);
    
    // Загружаем существующие пометки
    loadTokenNotes();
    
    // Подписываемся на изменения
    OBR.scene.items.onChange((items) => {
      const token = items.find(item => item.id === tokenId);
      if (token?.metadata[`${ID}/notes`]) {
        const notesData = token.metadata[`${ID}/notes`];
        setNotes(notesData.notes || []);
        setCategories(notesData.categories || []);
      }
    });
  }, [tokenId]);

  const loadTokenNotes = async () => {
    const token = await OBR.scene.items.getItem(tokenId);
    if (token?.metadata[`${ID}/notes`]) {
      const notesData = token.metadata[`${ID}/notes`];
      setNotes(notesData.notes || []);
      setCategories(notesData.categories || []);
    }
  };

  const addNote = () => {
    if (!newNoteText.trim() || !player) return;

    addNoteToToken(tokenId, newNoteText, selectedCategory);
    setNewNoteText("");
  };

  const deleteNote = (noteId: string) => {
    if (!confirm("Delete this note?")) return;

    OBR.scene.items.updateItems([tokenId], (items) => {
      for (let item of items) {
        const notesData = item.metadata[`${ID}/notes`];
        if (notesData) {
          notesData.notes = notesData.notes.filter((note: TextNote) => note.id !== noteId);
          item.metadata[`${ID}/notes`] = notesData;
        }
      }
    });

    // Уведомляем другие клиенты
    OBR.broadcast.sendMessage(`${ID}/note-update`, {
      type: "delete",
      tokenId,
      noteId,
    });
  };

  const togglePlayerVisibility = (noteId: string) => {
    OBR.scene.items.updateItems([tokenId], (items) => {
      for (let item of items) {
        const notesData = item.metadata[`${ID}/notes`];
        if (notesData) {
          const note = notesData.notes.find((n: TextNote) => n.id === noteId);
          if (note) {
            note.isVisibleToPlayers = !note.isVisibleToPlayers;
            item.metadata[`${ID}/notes`] = notesData;
          }
        }
      }
    });
  };

  return (
    <div className="notes-editor">
      <h3>Text Notes</h3>
      
      {/* Форма добавления новой пометки */}
      <div className="note-input">
        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <textarea
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          placeholder="Add your note here..."
        />
        <button onClick={addNote}>Add Note</button>
      </div>

      {/* Список пометок */}
      <div className="notes-list">
        {notes.map((note) => (
          <div key={note.id} className="note">
            <div className="note-header">
              <span className="category">{note.category}</span>
              <strong>{note.author}</strong>
              <small>{new Date(note.timestamp).toLocaleString()}</small>
              {note.isVisibleToPlayers && <span className="player-visible">👁️ Players</span>}
            </div>
            <div className="note-text">{note.noteText}</div>
            <div className="note-actions">
              <button onClick={() => togglePlayerVisibility(note.id)}>
                {note.isVisibleToPlayers ? "Hide from Players" : "Show to Players"}
              </button>
              <button onClick={() => deleteNote(note.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 5. Система категорий и фильтрации

```typescript
// categories.ts
export const DEFAULT_CATEGORIES = [
  "General",
  "Combat",
  "Roleplay", 
  "Important",
  "Location",
  "Inventory",
  "Quest",
  "Personal",
];

// Функция для получения индикатора по категории
function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    "General": "📝",
    "Combat": "⚔️",
    "Roleplay": "🎭",
    "Important": "⭐",
    "Location": "📍",
    "Inventory": "🎒",
    "Quest": "❓",
    "Personal": "👤",
  };
  return icons[category] || "📝";
}

// Фильтрация пометок по категориям
function filterNotesByCategory(notes: TextNote[], category?: string): TextNote[] {
  if (!category) return notes;
  return notes.filter(note => note.category === category);
}
```

### 6. Визуальные индикаторы на токенах

```typescript
// tokenIndicators.ts
function updateTokenIndicators(tokenId: string) {
  OBR.scene.items.getItem(tokenId).then(token => {
    const notesData = token?.metadata[`${ID}/notes`];
    if (!notesData) return;

    const totalNotes = notesData.notes.length;
    const playerVisibleNotes = notesData.notes.filter((n: TextNote) => n.isVisibleToPlayers).length;
    
    // Создаем визуальный индикатор
    let indicator = "";
    if (totalNotes === 0) {
      indicator = ""; // нет пометок
    } else if (playerVisibleNotes > 0) {
      indicator = `👁️${totalNotes}`; // видно игрокам
    } else {
      indicator = `📝${totalNotes}`; // только GM
    }

    // Добавляем overlay с индикатором
    OBR.scene.items.updateItems([tokenId], (items) => {
      for (let item of items) {
        item.metadata[`${ID}/indicator`] = {
          text: indicator,
          position: { x: item.position.x + 25, y: item.position.y - 25 },
          backgroundColor: playerVisibleNotes > 0 ? "#4CAF50" : "#2196F3"
        };
      }
    });
  });
}
```

### 7. Игровой вид (для игроков)

```typescript
// PlayerNotesView.tsx
const PlayerNotesView: React.FC = () => {
  const [visibleNotes, setVisibleNotes] = useState<TextNote[]>([]);

  useEffect(() => {
    // Загружаем только те пометки, которые видны игрокам
    OBR.scene.items.getItems().then(allTokens => {
      const playerVisibleNotes: TextNote[] = [];
      
      allTokens.forEach(token => {
        const notesData = token.metadata[`${ID}/notes`];
        if (notesData?.notes) {
          notesData.notes
            .filter((note: TextNote) => note.isVisibleToPlayers)
            .forEach((note: TextNote) => {
              playerVisibleNotes.push({
                ...note,
                tokenName: getTokenName(token) // добавляем имя токена
              });
            });
        }
      });
      
      setVisibleNotes(playerVisibleNotes);
    });
  }, []);

  return (
    <div className="player-notes-view">
      <h3>Shared Notes</h3>
      {visibleNotes.length > 0 ? (
        <div className="notes-grid">
          {visibleNotes.map(note => (
            <div key={note.id} className="shared-note">
              <div className="note-token">{note.tokenName}</div>
              <div className={`category-tag ${note.category}`}>
                {getCategoryIcon(note.category)} {note.category}
              </div>
              <div className="note-content">{note.noteText}</div>
            </div>
          ))}
        </div>
      ) : (
        <p>No shared notes available.</p>
      )}
    </div>
  );
};
```

### 8. Инициализация и настройка

```typescript
// main.tsx
import { setupTextNotesMenu } from "./contextMenu";
import { updateTokenIndicators } from "./tokenIndicators";

OBR.onReady(() => {
  setupTextNotesMenu();
  
  // Инициализируем все токены с пометками
  OBR.scene.items.getItems((item) => {
    return item.metadata[`${ID}/notes`] !== undefined;
  }).then(initializedTokens => {
    initializedTokens.forEach(token => {
      updateTokenIndicators(token.id);
    });
  });

  // Обновляем индикаторы при изменениях
  OBR.scene.items.onChange((items) => {
    items.forEach(item => {
      if (item.metadata[`${ID}/notes`]) {
        updateTokenIndicators(item.id);
      }
    });
  });
});
```

### 9. Ключевые преимущества этой системы:

1. **Универсальность** - работает с любыми текстовыми пометками
2. **Категоризация** - пометки можно группировать по типам
3. **Совместное редактирование** - все видят изменения в реальном времени
4. **Контроль видимости** - GM решает, что показывать игрокам
5. **Визуальные индикаторы** - на токенах видно количество пометок
6. **Простота использования** - добавлять пометки через контекстное меню

### 10. Возможные расширения:

- Добавление изображений к пометкам
- Система тегов и поиска
- История изменений пометок
- Экспорт пометок в различные форматы
- Уведомления о новых пометках

## Практические рекомендации для реализации в вашем проекте

### 1. Базовая структура проекта

```typescript
// constants.ts
export const ID = "your.unique.plugin.id";

// types.ts
export interface VibeCode {
  id: string;
  tokenId: string;
  vibeText: string;
  author: string;
  timestamp: number;
  isPlayerVisible: boolean;
}
```

### 2. Инициализация контекстного меню

```typescript
// contextMenu.ts
import OBR from "@owlbear-rodeo/sdk";
import { ID } from "./constants";

export function setupVibeCodeContextMenu() {
  OBR.contextMenu.create({
    id: `${ID}/vibe-menu`,
    icons: [
      {
        icon: "/vibe-icon.svg",
        label: "Add Vibe Code",
        filter: {
          roles: ["GM", "PLAYER"], // Игроки тоже могут добавлять вайбы
          every: [
            { key: "layer", value: "CHARACTER" }, // Токены персонажей
            { key: ["metadata", `${ID}/vibe`], value: undefined },
          ],
        },
      },
      {
        icon: "/remove-vibe-icon.svg", 
        label: "View/Edit Vibes",
        filter: {
          roles: ["GM", "PLAYER"],
          every: [
            { key: "layer", value: "CHARACTER" },
            { key: ["metadata", `${ID}/vibe`], value: undefined, operator: "!=" },
          ],
        },
      },
    ],
    onClick(context) {
      const hasVibe = context.items.every(
        (item) => item.metadata[`${ID}/vibe`] !== undefined
      );

      if (!hasVibe) {
        // Создаем новый вайб
        addVibeToToken(context.items[0]);
      } else {
        // Открываем интерфейс редактирования
        openVibeEditor(context.items[0]);
      }
    },
  });
}
```

### 3. Структура данных для вайб-кодинга

```typescript
// Добавление вайба к токену
function addVibeToToken(token: any) {
  const vibeData = {
    vibes: [], // массив всех вайбов для этого токена
    lastUpdate: Date.now(),
  };

  OBR.scene.items.updateItems([token.id], (items) => {
    for (let item of items) {
      item.metadata[`${ID}/vibe`] = vibeData;
    }
  });
}

// Структура отдельного вайба
interface Vibe {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  timestamp: number;
  isResolved: boolean; // для отметки "снятого" вайба
}
```

### 4. Интерфейс вайб-кодинга

```typescript
// VibeEditor.tsx
import React, { useState, useEffect } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { ID } from "./constants";

const VibeEditor: React.FC<{ tokenId: string }> = ({ tokenId }) => {
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [newVibeText, setNewVibeText] = useState("");
  const [player, setPlayer] = useState<any>(null);

  useEffect(() => {
    // Загружаем данные игрока
    OBR.player.getPlayer().then(setPlayer);
    
    // Подписываемся на изменения токена
    OBR.scene.items.onChange((items) => {
      const token = items.find(item => item.id === tokenId);
      if (token?.metadata[`${ID}/vibe`]) {
        setVibes(token.metadata[`${ID}/vibe`].vibes || []);
      }
    });
  }, [tokenId]);

  const addVibe = () => {
    if (!newVibeText.trim() || !player) return;

    const newVibe: Vibe = {
      id: Date.now().toString(),
      text: newVibeText,
      authorId: player.id,
      authorName: player.name,
      timestamp: Date.now(),
      isResolved: false,
    };

    // Обновляем metadata токена
    OBR.scene.items.updateItems([tokenId], (items) => {
      for (let item of items) {
        const vibeData = item.metadata[`${ID}/vibe`] || { vibes: [] };
        vibeData.vibes.push(newVibe);
        vibeData.lastUpdate = Date.now();
        item.metadata[`${ID}/vibe`] = vibeData;
      }
    });

    // Синхронизируем с другими клиентами
    OBR.broadcast.sendMessage(`${ID}/vibe-update`, {
      type: "add",
      tokenId,
      vibe: newVibe,
    });

    setNewVibeText("");
  };

  const resolveVibe = (vibeId: string) => {
    OBR.scene.items.updateItems([tokenId], (items) => {
      for (let item of items) {
        const vibeData = item.metadata[`${ID}/vibe`];
        if (vibeData) {
          const vibe = vibeData.vibes.find((v: Vibe) => v.id === vibeId);
          if (vibe) {
            vibe.isResolved = !vibe.isResolved;
            vibe.resolvedBy = player?.id;
            vibe.resolvedAt = Date.now();
          }
        }
      }
    });
  };

  return (
    <div className="vibe-editor">
      <h3>Vibe Codes</h3>
      
      {/* Форма добавления нового вайба */}
      <div className="vibe-input">
        <textarea
          value={newVibeText}
          onChange={(e) => setNewVibeText(e.target.value)}
          placeholder="What's the vibe? Add your impression..."
        />
        <button onClick={addVibe}>Add Vibe</button>
      </div>

      {/* Список вайбов */}
      <div className="vibe-list">
        {vibes.map((vibe) => (
          <div key={vibe.id} className={`vibe ${vibe.isResolved ? 'resolved' : ''}`}>
            <div className="vibe-header">
              <strong>{vibe.authorName}</strong>
              <small>{new Date(vibe.timestamp).toLocaleString()}</small>
            </div>
            <div className="vibe-text">{vibe.text}</div>
            <button onClick={() => resolveVibe(vibe.id)}>
              {vibe.isResolved ? 'Unresolve' : 'Resolve'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 5. Система синхронизации

```typescript
// sync.ts
import OBR from "@owlbear-rodeo/sdk";
import { ID } from "./constants";

export function setupVibeSync() {
  // Слушаем обновления вайбов от других клиентов
  OBR.broadcast.onMessage(`${ID}/vibe-update`, (event) => {
    const { type, tokenId, vibe } = event.data;
    
    // Обновляем локальный state
    switch (type) {
      case "add":
        // Добавляем новый вайб в локальный список
        break;
      case "resolve":
        // Обновляем статус разрешения вайба
        break;
      case "delete":
        // Удаляем вайб
        break;
    }
  });

  // Отслеживаем изменения в сцене
  OBR.scene.items.onChange((items) => {
    items.forEach(item => {
      if (item.metadata[`${ID}/vibe`]) {
        // Токен имеет вайбы - обновляем UI
        updateVibeDisplay(item.id, item.metadata[`${ID}/vibe`]);
      }
    });
  });
}
```

### 6. Визуальная индикация на токенах

```typescript
// tokenOverlay.ts
function getVibeIndicator(vibeData: any): string {
  const unresolvedCount = vibeData.vibes.filter((v: Vibe) => !v.isResolved).length;
  
  if (unresolvedCount === 0) return "🟢"; // Зеленый - нет активных вайбов
  if (unresolvedCount <= 2) return "🟡"; // Желтый - несколько вайбов  
  return "🔴"; // Красный - много вайбов
}

// Отображение поверх токена
function renderVibeOverlay(tokenId: string) {
  const indicator = getVibeIndicator(getVibeData(tokenId));
  
  // Добавляем overlay с индикатором
  OBR.scene.items.updateItems([tokenId], (items) => {
    for (let item of items) {
      // Добавляем визуальный индикатор
      item.metadata[`${ID}/overlay`] = {
        icon: indicator,
        position: { x: item.position.x + 20, y: item.position.y - 20 }
      };
    }
  });
}
```

### 7. Роли и права доступа

```typescript
// permissions.ts
export function canEditVibe(vibe: Vibe, currentPlayer: any): boolean {
  // Игроки могут редактировать только свои вайбы
  if (currentPlayer.role === "PLAYER") {
    return vibe.authorId === currentPlayer.id;
  }
  
  // GM может редактировать все вайбы
  return currentPlayer.role === "GM";
}

export function canResolveVibe(vibe: Vibe, currentPlayer: any): boolean {
  // Любой может разрешать вайбы (для совместного редактирования)
  return true;
}
```

### 8. Инициализация плагина

```typescript
// main.tsx
import { setupVibeCodeContextMenu } from "./contextMenu";
import { setupVibeSync } from "./sync";

OBR.onReady(() => {
  setupVibeCodeContextMenu();
  setupVibeSync();
  
  // Загружаем все токены с вайбами
  OBR.scene.items.getItems((item) => {
    return item.metadata[`${ID}/vibe`] !== undefined;
  }).then((tokensWithVibes) => {
    tokensWithVibes.forEach(token => {
      renderVibeOverlay(token.id);
    });
  });
});
```

### 9. Ключевые особенности для вайб-кодинга

1. **Реальное время**: Используйте `OBR.broadcast` для мгновенной синхронизации
2. **Авторизация**: Проверяйте авторство вайбов для прав редактирования
3. **Визуальная обратная связь**: Индикаторы на токенах показывают активность
4. **Отметки разрешения**: Система пометок "снятых" вайбов
5. **Роли**: Игроки и GM могут иметь разные права доступа

### 10. Рекомендуемый workflow

1. **Игрок** кликает на токен → **добавляет вайб** → **все видят обновление**
2. **Другой игрок** → **видит новый вайб** → **может добавить свой или разрешить существующий**
3. **GM** → **может модерировать все вайбы** → **удалять неподходящие**
4. **Визуальные индикаторы** → **показывают активность на токенах**

Эта архитектура позволит создать полноценную систему вайб-кодинга с реальным временем синхронизации между всеми участниками сессии.

Эта архитектура создаст гибкую систему для любых текстовых пометок с полной поддержкой совместной работы и визуальной обратной связи, аналогично проекту Map Location Keys.