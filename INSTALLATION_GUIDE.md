# Void Press Zine Builder - Installation Guide

This guide provides step-by-step instructions for setting up the Void Press Zine Publishing Platform on a new computer.

## Prerequisites

Before installing the application, ensure you have the following software installed:

### Required Software

1. **Node.js** (version 16 or higher)
   - Download from: https://nodejs.org/
   - Includes npm (Node Package Manager)

2. **Git** (for cloning the repository)
   - Download from: https://git-scm.com/

### Optional but Recommended

3. **Visual Studio Code** (recommended IDE)
   - Download from: https://code.visualstudio.com/
   - Install extensions: ES7+ React/Redux/React-Native snippets, Prettier, ESLint

## Installation Steps

### Step 1: Clone the Repository

Open your terminal/command prompt and run:

```bash
git clone https://github.com/ConflictingTheories/zine-editor.git
cd zine-editor
```

### Step 2: Install Dependencies

Install all required Node.js packages:

```bash
npm install
```

This will install the following key dependencies:
- **React** (^18.2.0) - Frontend framework
- **Express** (^5.2.1) - Backend web framework
- **SQLite3** (^5.1.7) - Database
- **Konva** (^10.2.0) - 2D canvas library for graphics
- **Mushu Flow** (^1.1.0) - GLSL shader integration
- **JWT** (^9.0.3) - Authentication tokens
- **bcryptjs** (^3.0.3) - Password hashing
- **CORS** (^2.8.6) - Cross-origin resource sharing

### Step 3: Database Setup

The application uses SQLite, which requires no additional setup. The database file (`database.sqlite`) will be created automatically when the server starts.

### Step 4: Start the Application

You can run the application in two ways:

#### Option A: Development Mode (Recommended for development)

Start the frontend development server:

```bash
npm run dev
```

In a separate terminal, start the backend server:

```bash
npm run server
```

#### Option B: Production Build

Build the frontend for production:

```bash
npm run build
npm run preview
```

And run the server:

```bash
npm run server
```

### Step 5: Access the Application

Open your web browser and navigate to:
- **Frontend**: http://localhost:5173 (development) or http://localhost:4173 (preview)
- **Backend API**: http://localhost:3000

## Project Structure

After installation, your project should have this structure:

```
zine-editor/
├── src/
│   ├── components/     # React components
│   ├── context/        # React context providers
│   ├── data/          # Static data files
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utility libraries
│   ├── rendering/     # Canvas rendering logic
│   ├── utils/         # Utility functions
│   └── styles.css     # Global styles
├── server/
│   └── server.cjs     # Express.js backend server
├── public/            # Static assets
├── package.json       # Node.js dependencies
├── vite.config.js     # Vite configuration
└── index.html         # Main HTML file
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   - Change the port in `server/server.cjs` (default: 3000)
   - Or in `vite.config.js` for the frontend (default: 5173)

2. **Permission errors with SQLite**
   - Ensure write permissions in the project directory
   - On Windows, run terminal as Administrator if needed

3. **npm install fails**
   - Clear npm cache: `npm cache clean --force`
   - Delete node_modules: `rm -rf node_modules`
   - Reinstall: `npm install`

4. **Build errors**
   - Ensure Node.js version is 16+
   - Check that all dependencies are installed: `npm list`

### Database Issues

If you need to reset the database:
1. Stop the server
2. Delete `server/database.sqlite`
3. Restart the server (it will recreate the database)

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run server` - Start backend server only

### Key Features Available After Setup

- **Zine Creation**: Create interactive narrative zines
- **Visual Editor**: Drag-and-drop interface for elements
- **Shader Effects**: GLSL shader integration for dynamic visuals
- **Export Options**: HTML and PDF export
- **User Authentication**: Login/register system
- **Publishing**: Share zines publicly
- **Themes**: Multiple visual themes (Classic, Fantasy, Cyberpunk, etc.)

## Support

If you encounter issues:
1. Check the [GitHub Issues](https://github.com/ConflictingTheories/zine-editor/issues)
2. Ensure all prerequisites are met
3. Try the troubleshooting steps above
4. Create a new issue with your error logs and system information

## System Requirements

- **OS**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB free space
- **Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

The application is now ready to use! Start creating your interactive zines.
