<div align="center">

# ⛏️ Minecraft Server Manager

<p align="center">
  <strong>⚡ Modern, Sleek, and Powerful Desktop Dashboard for Managing Minecraft Servers</strong>
</p>

[![Electron](https://img.shields.io/badge/Electron-44.0.0-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4.3.3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

---

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-project-structure">Structure</a> •
  <a href="#-building-for-production">Build</a>
</p>

<p align="center">
  🌏 <a href="README.th.md"><strong>อ่านเป็นภาษาไทย</strong></a>
</p>

</div>

<br />

## 🌟 Features

- 🎛️ **Real-time Server Control**: Start, stop, and restart your server with real-time status & PID monitoring.
- ⚡ **Multi-Core Server Support**: Native support for **Vanilla**, **PaperMC**, and **Spigot** core jars.
- 📺 **Interactive Live Console**: Stream server logs in real-time and send RCON/command inputs on the fly.
- 🔌 **Plugin & Mod Manager**: Easily manage, install, enable/disable plugins and mods right from the GUI.
- 📁 **Integrated File Manager**: Browse, edit, and modify server configuration files (`server.properties`, `eula.txt`) directly in the app.
- ☕ **Automated Java Runtime Detector**: Auto-detect system Java paths and environment configs.
- 🎨 **Sleek Cyberpunk & Dark Mode UI**: Built with Shadcn UI & Tailwind CSS v4 for maximum aesthetic satisfaction.

---

## 🛠️ Tech Stack

- **Core Framework**: [Electron](https://www.electronjs.org/) + [React](https://reactjs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/) + `vite-plugin-electron`
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **UI & Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/), [Lucide Icons](https://lucide.dev/)
- **Packaging**: [Electron Builder](https://www.electron.build/)

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Java Development Kit (JDK)](https://www.oracle.com/java/) (Java 17/21 for modern Minecraft versions)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/minecraft-server-manager.git
   cd minecraft-server-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in Development Mode**
   ```bash
   npm run dev
   ```

---

## 📁 Project Structure

```text
minecraft_management/
├── electron/              # Electron main process & IPC handlers
│   ├── main.ts
│   └── preload.ts
├── src/                   # React frontend (Vite renderer process)
│   ├── components/        # Dashboard, Console, File Manager, Plugins, Settings
│   ├── styles/            # Design tokens & CSS theme settings
│   ├── App.tsx            # Main application layout & tab routing
│   └── main.tsx
├── package.json           # Application manifest & scripts
└── vite.config.ts         # Vite bundler configuration
```

---

## 📦 Building for Production

To compile and package the app into a standalone Windows installer (`.exe`):

```bash
npm run build
```

The output executable will be available in the `./release` directory.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check the [issues page](https://github.com/your-username/minecraft-server-manager/issues).

---

<div align="center">

Made with ❤️ & ⚡ for Minecraft Server Admins everywhere.

</div>
