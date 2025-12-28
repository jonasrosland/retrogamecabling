# RetroGameCabling

RetroGameCabling is a visual diagramming tool designed for planning and visualizing retro gaming console setups. Create interactive diagrams to map out your console connections, switches, displays, adapters, and upscalers.

## About

This is a hobby project created for the retro gaming community. It was built using Cursor, an AI-powered code editor that assisted in the development process.

## Features

- Visual drag-and-drop interface for building console setup diagrams
- Support for consoles, switches, displays, adapters, and upscalers
- Signal compatibility checking to ensure valid connections
- Modular Scalable Video Switch (SVS) configuration
- Save and load your setups
- Example configurations to get started

## Tech Stack

- **Frontend**: React, TypeScript, ReactFlow, Tailwind CSS
- **Backend**: Express, Node.js
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js >= 24.0.0
- Docker (optional, for containerized setup)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```

### Production Build

Build for production:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

### Docker

Build and run with Docker Compose:
```bash
docker-compose up --build
```

The application will be available at `http://localhost:5000`

## Usage

1. Drag components from the sidebar onto the canvas
2. Connect inputs (left side) to outputs (right side) by dragging between handles
3. Configure console outputs using the dropdown menus
4. For Scalable Video Switches (SVS), configure the number of inputs/outputs and their types
5. Save your setup for later use
6. Load example configurations to see different setup patterns

## Project Structure

- `client/` - React frontend application
- `server/` - Express backend API
- `shared/` - Shared data and schemas (items, examples)
- `script/` - Build scripts

## License

MIT

## Acknowledgments

Built with Cursor. Made for the retro gaming community.
