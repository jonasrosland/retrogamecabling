# Changelog

All notable changes to RetroGameCabling are documented in this file.

## [1.1.0]

### Added

- **Custom TV** – New display type with customizable inputs. Add or remove inputs and change their types (RF, composite, S-Video, RGB, YPbPr). Editable name.
- **Custom Gaming PC** – New item in Others (consoles) with configurable inputs/outputs (VGA, HDMI). Default: 0 inputs, 1 HDMI output. Editable name. Compact layout when unselected.
- **Extron Crosspoint variants** – Switch now supports multiple models: CrossPoint 42, 84, 88, 124, 128, 168, 1616. Select variant from dropdown when the node is selected.
- **MiSTer FPGA** – New console with variants (Base vs SuperStation One). Supports simultaneous outputs (HDMI + VGA, or all outputs for SuperStation).
- **Classic Mini consoles** – NES Classic Mini, SNES Classic Mini, PlayStation Classic, Genesis Mini (with Mega Drive Mini variant), TurboGrafx-16 Mini (with PC Engine Mini variant).
- **BNC/RCA edge colors** – When connecting from Extron Crosspoint BNC outputs (or RCA) to a display, edge color now reflects the target input type (e.g. orange for YPbPr) instead of BNC pink.
- **Version display** – App version shown in the sidebar and on the Home page. Version centralized in `package.json` and injected via Vite.
- **fitView on load** – Diagram automatically fits to view when loading from recent files.

### Changed

- **Basic CRT** – Renamed from Consumer CRT.
- **Basic Flatscreen** – Renamed from Modern OLED.
- **RetroTINK-2X and OSSC** – Category changed from adapter to upscaler.
- **Examples** – Simple, medium, and SVS examples updated to use Basic CRT (replacing Consumer CRT and Sony PVM 14L5). Advanced example overhauled with valid connections (SNES/N64/PS1/PS2/SNES Classic/NES, Extron Crosspoint, Basic CRT, Basic Flatscreen). Switches and displays repositioned.

### Removed

- **Sony PVM 14L5** – Removed from display list.
- **SCART to YPbPr Converter** – Removed from adapters.

---

## [1.0.0]

### Summary

Version 1.0 provides the core diagramming experience for planning retro gaming console setups.

**Features:**

- Visual drag-and-drop interface for building console setup diagrams
- Support for consoles, switches, displays, adapters, and upscalers
- Signal compatibility checking to ensure valid connections
- Modular Scalable Video Switch (SVS) configuration
- Custom Switch and HDMI Switch with configurable inputs/outputs
- Save and load setups
- Example configurations (simple, medium, advanced, SVS)

**Equipment catalog:**

- **Consoles** – NES, SNES, N64, PlayStation 1/2, Genesis, Saturn, Dreamcast, and many more, including SG-1000 and variants
- **Switches** – Otaku SCART Switch, Extron Crosspoint (4×2 BNC), gcompsw, and others
- **Displays** – Consumer CRT, Modern OLED, Sony PVM 14L5
- **Adapters** – RGBS to YPbPr, SCART to YPbPr, various signal converters
- **Upscalers** – RetroTINK, OSSC

**Tech stack:** React, TypeScript, ReactFlow, Tailwind CSS, Express, Node.js, Vite.
