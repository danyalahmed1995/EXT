# EXT: The Markdown Workspace

EXT is a dedicated workspace designed to help you access, organize, and manage all the Markdown and text files scattered across your computer. 

It is important to clarify what EXT is not: **EXT does not compete with or try to replace your primary Markdown editor.** There are many excellent text editors available. Instead, EXT acts as a central command center for your notes. If you have Markdown files in a dozen different project folders, EXT provides a single workspace to view, search, and edit them simultaneously without having to move them or import them into a proprietary database.

Your files stay exactly where they are on your hard drive. 

## Core Capabilities

- **Local-First Filesystem Management**: Connect any folder on your computer to your workspace. EXT reads and writes directly to your local files. There are no proprietary formats, no hidden databases, and no cloud syncing requirements.
- **Smart Views**: Automatically aggregates files across all your connected folders. You can view all Markdown files at once, filter by files modified today, or isolate files containing "TODO" items.
- **Global Search**: Instantly search for file names across every connected directory.
- **Tabbed Environment**: Open multiple files at once and navigate between them using a built-in tab system, complete with keyboard shortcuts for fast switching.
- **Split-View Experience**: A clean side-by-side view featuring a standard text editor and a rendered GitHub-Flavored Markdown preview. 
- **Native Performance**: Built using Rust and Tauri to ensure the application remains lightweight, fast, and light on system resources.

## Setup Instructions

### Prerequisites
1. Node.js (v16 or higher)
2. Rust (latest stable version)
3. Tauri OS prerequisites (e.g., build-essential, libwebkit2gtk-4.1-dev on Linux, or MSVC on Windows)

### Development
1. Clone the repository and navigate to the root directory.
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

### Building for Production
To build a standalone executable for your operating system:
```bash
npm run build
```
The resulting application file will be generated in `src-tauri/target/release`.

## License
MIT License.

## Contributing
Please see `CONTRIBUTING.md` for the strict rules regarding code contributions and issue reporting, and `DESIGN.md` for a technical overview of how the application is built.
