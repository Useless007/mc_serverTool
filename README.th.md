<div align="center">

# ⛏️ Minecraft Server Manager

<p align="center">
  <strong>⚡ แดชบอร์ด Desktop สมัยใหม่ สวยงาม และทรงพลัง สำหรับจัดการ Minecraft Server</strong>
</p>

[![Electron](https://img.shields.io/badge/Electron-44.0.0-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4.3.3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

---

<p align="center">
  <a href="#-ฟีเจอร์หลัก">ฟีเจอร์</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-เริ่มต้นใช้งาน">เริ่มต้น</a> •
  <a href="#-โครงสร้างโปรเจกต์">โครงสร้าง</a> •
  <a href="#-การ-build-สำหรับ-production">Build</a>
</p>

</div>

<br />

## 🌟 ฟีเจอร์หลัก

- 🎛️ **ควบคุม Server แบบ Realtime** — Start, Stop, Restart พร้อมดู Status และ PID ได้ทันที
- ⚡ **รองรับหลาย Server Core** — รองรับ **Vanilla**, **PaperMC** และ **Spigot** ในตัวเดียว
- 📺 **Console แบบ Interactive** — ดู Log สด และส่งคำสั่งไปยัง Server ได้โดยตรง
- 🔌 **จัดการ Plugin** — ค้นหา, ดาวน์โหลด และติดตั้ง Plugin จาก **SpigotMC (Spiget)** และ **Modrinth** ด้วยคลิกเดียว
- 📁 **File Manager ในตัว** — ดู, แก้ไขไฟล์ config (`server.properties`, `eula.txt`) ได้โดยตรงในแอป
- ☕ **ตรวจสอบและติดตั้ง Java อัตโนมัติ** — ตรวจ Java บนเครื่อง หากไม่มีสามารถดาวน์โหลด OpenJDK (Temurin) ได้เลย
- 🗂️ **จัดการหลาย Server (Multi-Server)** — บันทึกประวัติ Server ทุกตัว สลับใช้งานได้ด้วย Dropdown
- 🌐 **Network Tunnel ในตัว** — เปิด **Ngrok** หรือ **Cloudflare Tunnel** เพื่อให้เพื่อนต่างเครือข่ายเข้าเล่นได้
- 🎨 **UI สไตล์ Dark Cyberpunk** — ออกแบบด้วย Shadcn UI + Tailwind CSS v4 พร้อม animation เนียบ

---

## 🛠️ Tech Stack

| ส่วนประกอบ | เทคโนโลยี |
|------------|-----------|
| Core Framework | [Electron](https://www.electronjs.org/) + [React](https://reactjs.org/) |
| Build Tool | [Vite](https://vitejs.dev/) + vite-plugin-electron |
| ภาษา | [TypeScript](https://www.typescriptlang.org/) |
| UI & Styling | [Tailwind CSS v4](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/), [Lucide Icons](https://lucide.dev/) |
| Packaging | [Electron Builder](https://www.electron.build/) |

---

## 🚀 เริ่มต้นใช้งาน

### สิ่งที่ต้องมีก่อน

- [Node.js](https://nodejs.org/) (แนะนำ v18 ขึ้นไป)
- [Java Development Kit (JDK)](https://www.oracle.com/java/) (Java 17/21 สำหรับ Minecraft เวอร์ชันใหม่)

### ขั้นตอนติดตั้ง

1. **Clone repository**
   ```bash
   git clone https://github.com/your-username/minecraft-server-manager.git
   cd minecraft-server-manager
   ```

2. **ติดตั้ง dependencies**
   ```bash
   npm install
   ```

3. **รันในโหมด Development**
   ```bash
   npm run dev
   ```

---

## 📁 โครงสร้างโปรเจกต์

```
minecraft_management/
├── electron/              # Electron main process & IPC handlers
│   ├── main.ts            # จัดการ IPC, window, tunnel, player management
│   ├── preload.ts         # Context Bridge API
│   ├── server-manager.ts  # จัดการ Server instance & Java
│   ├── ngrok.ts           # Ngrok Tunnel Manager
│   ├── cloudflare-tunnel.ts # Cloudflare Tunnel Manager
│   ├── store.ts           # บันทึก Multi-server profiles
│   ├── plugin-search.ts   # Spiget & Modrinth API
│   └── java-installer.ts  # Auto-install OpenJDK
├── src/                   # React frontend (Vite renderer)
│   ├── components/
│   │   ├── Dashboard.tsx  # หน้าหลัก + กราฟสถานะ
│   │   ├── Console.tsx    # Console แบบ Interactive
│   │   ├── Players.tsx    # จัดการผู้เล่น
│   │   ├── Plugins.tsx    # Plugin Browser & Manager
│   │   ├── FileManager.tsx # File Manager
│   │   ├── NetworkTunnels.tsx # Ngrok & Cloudflare
│   │   ├── Settings.tsx   # ตั้งค่า & Java installer
│   │   └── Sidebar.tsx    # Navigation sidebar
│   ├── App.tsx            # Layout หลักและ Tab routing
│   └── types.ts           # TypeScript interfaces
├── public/
│   └── logo.png           # App logo
├── TODO/
│   └── plan.md            # แผนงานและ TODO checklist
└── package.json
```

---

## 📦 การ Build สำหรับ Production

คอมไพล์และแพ็กเกจแอปเป็น Windows installer (`.exe`):

```bash
npm run build
```

ไฟล์ output จะอยู่ในโฟลเดอร์ `./release/`:

| ไฟล์ | ประเภท |
|------|--------|
| `Minecraft Server Manager Setup 1.0.0.exe` | Installer (แนะนำ) |
| `Minecraft Server Manager 1.0.0.exe` | Portable (ไม่ต้องติดตั้ง) |

---

## 🌐 ระบบ Network Tunnel

เปิดให้เพื่อนต่างเครือข่ายเข้าเล่นได้โดยไม่ต้อง Port Forward:

| บริการ | วิธีใช้ |
|--------|---------|
| **Ngrok** | ใส่ Auth Token → กด Start → ได้ `tcp://x.tcp.ngrok.io:xxxxx` |
| **Cloudflare Tunnel** | ใส่ Tunnel Token → กด Start → ได้ hostname จาก Cloudflare |

---

## 🤝 Contributing

ยินดีรับ Contributions, Issues และ Feature Requests!  
ดูที่ [issues page](https://github.com/your-username/minecraft-server-manager/issues)

---

<div align="center">

สร้างด้วย ❤️ และ ⚡ เพื่อ Admin Minecraft Server ทุกคน

</div>
