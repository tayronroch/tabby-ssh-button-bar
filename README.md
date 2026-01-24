# Tabby Button Bar

A Tabby Terminal plugin that adds a customizable button bar for quick command execution, inspired by SecureCRT's Button Bar feature.

## Features

### Quick Command Buttons
- **One-Click Commands**: Execute frequently used commands with a single click
- **Custom Labels**: Name your buttons for easy identification
- **Color Coding**: Assign colors to visually organize your commands
- **Icons**: Add FontAwesome icons to buttons
- **Tooltips**: Add descriptions that show on hover

### Command Options
- **Send Enter**: Optionally send Enter key after command (configurable per button)
- **Any Command**: Supports any text that can be typed in terminal

### Organization
- **Button Groups**: Organize commands into collapsible groups
- **Drag & Drop**: Reorder buttons (coming soon)
- **Import/Export**: Share button configurations (coming soon)

### User Interface
- **Toolbar Toggle**: Quick show/hide via toolbar button
- **Context Menu**: Right-click buttons to edit, duplicate, or delete
- **Persistent State**: Remembers visibility and button configuration

## Installation

### Via Tabby Plugin Manager (Coming Soon)
1. Open Tabby Terminal
2. Go to Settings → Plugins
3. Search for `tabby-button-bar`
4. Click Install
5. Restart Tabby

### From Source
1. Clone this repository
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. Link to Tabby plugins folder:
   ```bash
   # macOS
   cd ~/Library/Application\ Support/tabby/plugins
   npm install /path/to/tabby-button-bar

   # Linux
   cd ~/.config/tabby/plugins
   npm install /path/to/tabby-button-bar

   # Windows
   cd %APPDATA%/tabby/plugins
   npm install /path/to/tabby-button-bar
   ```
5. Restart Tabby

## Usage

### Adding Commands
1. Click the **+** button in the button bar header
2. Fill in the command details:
   - **Label**: Display name for the button
   - **Command**: The command to execute
   - **Icon**: FontAwesome icon name (optional)
   - **Color**: Button color (optional)
   - **Tooltip**: Description shown on hover (optional)
   - **Send Enter**: Whether to press Enter after the command
3. Click **Add**

### Executing Commands
- Simply click any button to send the command to the active terminal
- The command is sent to whichever terminal tab is currently focused

### Managing Commands
- **Edit**: Right-click a button → Edit
- **Duplicate**: Right-click a button → Duplicate
- **Delete**: Right-click a button → Delete

### Showing/Hiding
- Click the keyboard icon in the toolbar to toggle visibility
- Or click the **×** button in the button bar header

## Example Commands

Here are some useful commands to get started:

| Label | Command | Description |
|-------|---------|-------------|
| List Files | `ls -la` | List all files with details |
| Disk Usage | `df -h` | Show disk space usage |
| Memory | `free -h` | Show memory usage |
| Top | `htop` | Interactive process viewer |
| Docker PS | `docker ps` | List running containers |
| Git Status | `git status` | Show git repository status |
| Clear | `clear` | Clear terminal screen |

## Requirements

- Tabby Terminal v1.0.197 or later

## Development

### Watch Mode
```bash
npm run watch
```

### Build
```bash
npm run build
```

## License

MIT
