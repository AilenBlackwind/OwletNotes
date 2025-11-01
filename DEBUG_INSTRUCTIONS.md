# Debug Version - What to Look For

## 🔍 **Debugging Setup Complete**

I've added comprehensive debugging to the extension. Here's what to look for:

## 📋 **Testing Instructions:**

### **Step 1: Load Extension**
1. Load the extension in Owlbear Rodeo
2. **Open browser console** (F12)
3. Look for these log messages:

### **Step 2: Expected Console Logs**

#### **On Extension Load:**
```
=== CONTEXT MENU SETUP START ===
Plugin ID: com.example.token-notes
Current player role: GM  (or PLAYER)
Creating context menu with ID: com.example.token-notes/context-menu-debug
Context menu create result: [object Promise]
=== CONTEXT MENU SETUP COMPLETE ===
```

#### **When Right-clicking a Token:**
Look for the menu item: **"DEBUG: Add Notes (No Icon)"**

#### **If You Click the Menu Item:**
```
=== CONTEXT MENU CLICKED ===
Context items: [array of token objects]
Context item count: 1
Token ID from context: [actual token ID]
Token layer: CHARACTER (or TEXT, PROP, etc.)
Token metadata: [metadata object]
Opening OBR action...
Extension URL: [full URL with tokenId]
Reloading page...
```

## 🚨 **Possible Issues to Check:**

### **Issue 1: Role Mismatch**
**If you see:** `"Current player role: PLAYER"`
**But menu doesn't appear:** Role filters might be too restrictive

### **Issue 2: Context Menu Creation Fails**
**If you see:** `"Context menu create result: undefined"` or error
**Problem:** Icon file issue or filter problem

### **Issue 3: Menu Item Not Shown**
**If no menu item appears:** Token layer doesn't match filters
**Test with different token types:** Character, Text, Prop, Attachment, Map

### **Issue 4: Click Handler Not Working**
**If menu appears but clicking does nothing:** Check if extension opens

## 🛠️ **Quick Fixes to Try:**

### **If Context Menu Creation Fails:**
- Remove icon requirement entirely
- Simplify filters to only check for "layer exists"

### **If Menu Item Doesn't Appear:**
- Try different token types
- Check if you're GM or Player (role matters)
- Test with simple tokens (just basic shapes)

### **If Extension Doesn't Open:**
- Check if `OBR.action.open()` is called
- Look for any JavaScript errors

## 📝 **Please Report Back:**

**After testing, please share:**

1. **All console messages** from extension load
2. **Whether the "DEBUG: Add Notes" menu item appears** when right-clicking tokens
3. **What token types you're testing** (Character, Text, etc.)
4. **Your role** (GM or Player)
5. **Any error messages** in the console

This will help me identify exactly where the problem is occurring!