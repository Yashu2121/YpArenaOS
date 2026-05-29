# YpArenaOS: Business Launch & Deployment Guide

Congratulations on reaching the production stage! To take this software and turn it into a physical, profitable Internet Café or E-Sports Arena, you need specific hardware, network infrastructure, and a clear deployment strategy. 

Here is exactly what you need to purchase and how to deploy your software.

---

## 1. Hardware Purchases (What to Buy)

To start a modern gaming lounge, you need a robust local network. Do not cheap out on networking gear, as latency is the enemy of gamers.

### A. The Master Server (Qty: 1)
This computer does not need an expensive GPU, but it needs a high-core CPU, fast NVMe storage, and lots of RAM. It acts as the brain of your café.
* **CPU:** Intel Core i7 or AMD Ryzen 7 (8+ cores)
* **RAM:** 32GB - 64GB DDR5
* **Storage:** 2TB+ Gen4 NVMe SSD (for database and caching)
* **Networking:** 10Gbps Ethernet Card

### B. The Gaming Terminals (Qty: X)
These are the PCs your customers will use. 
* **Specs:** Minimum RTX 4060, 16GB RAM, 144Hz+ Monitors.
* **Peripherals:** High-quality mechanical keyboards, gaming mice, and noise-canceling headsets.

### C. Network Infrastructure
* **Router:** A high-end enterprise router (e.g., Ubiquiti UniFi Dream Machine Pro or MikroTik) capable of handling heavy bandwidth and QoS (Quality of Service) to prioritize game traffic.
* **Switch:** 24-Port or 48-Port **Unmanaged Gigabit Switch** (or 2.5G/10G if budget allows). Every PC must be hardwired; **do not use Wi-Fi for gaming PCs**.
* **Cabling:** Cat6 Ethernet cables.

---

## 2. Software Deployment (Where to Install)

Now that you have your `YpArenaos_Release` folder, here is where each piece of the puzzle goes:

### The Master Server (Front Desk)
1. **PostgreSQL Database:** Install [PostgreSQL 16](https://www.postgresql.org/download/) on this machine. Run your `schema.sql` file to create the database.
2. **Edge Server (`edge-server.exe`)**: Copy this executable to the Master Server. Run it. It will connect to the PostgreSQL database and open ports for WebSockets and APIs. This must run 24/7.
3. **Admin Dashboard**: Copy the `admin-dashboard` folder here. Run `Start-Admin-Dashboard.bat`. Your front-desk staff can now open a web browser and go to `http://localhost:3000` to manage customers, top-up balances, and sell snacks.

### The Gaming Terminals (PC-01, PC-02, etc.)
1. **Windows Setup:** Install a clean version of Windows 11 on every gaming PC. 
2. **PC Client (`pc-client` folder)**: Copy this folder to every single gaming PC. 
3. **Configure IP:** In the PC Client code, ensure the `API` variable points to the **Local IP Address** of your Master Server (e.g., `http://192.168.1.100:4000`) instead of `localhost`.
4. **Startup execution:** Place a shortcut to `Start-PC-Client.bat` in the Windows Startup folder (`shell:startup`). When the PC boots, it will immediately launch the locked-down Kiosk UI.

### Your Smartphone (Owner)
1. **Mobile Owner App**: Once you install the Flutter SDK and compile the `.apk` file, transfer it to your Android phone and install it. 
2. **Configure IP:** The app needs to connect to the Master Server. If you want to view your café stats while you are at home, you will need to set up **Port Forwarding** on your café router to expose port `4000` securely, or use a VPN/Cloudflare Tunnel.

---

## 3. Advanced Integrations (Future Scaling)

As your company grows, you will likely encounter these industry-standard requirements:

### Diskless Boot (PXE)
Instead of installing games (like 100GB of GTA V or 60GB of Warzone) on every single PC, modern cybercafés use **Diskless Servers** (like CCBoot or iCafeCloud). 
* **How it works:** The Gaming PCs don't even have hard drives! They boot over the network directly from the Master Server. You only update a game once on the Master Server, and all 50 PCs instantly have the update. Our YpArenaOS software runs perfectly inside a diskless environment.

### Commercial Game Licenses
* **Steam PC Café:** You will need to register for the [Steam PC Café program](https://partner.steamgames.com/pccafe). This allows you to legally offer a library of games to customers without them needing to buy the games themselves.
* **Riot Games:** Valorant and League of Legends are free, but Riot offers a "PC Café" program that unlocks all champions/agents for players playing at registered cafes.

---

## Your Launch Checklist

- [ ] Sign a lease for a commercial space.
- [ ] Buy Master Server & Network Switch.
- [ ] Buy Gaming PCs & Desks.
- [ ] Install PostgreSQL & Edge Server on Master Server.
- [ ] Install PC Client Kiosk on all Gaming PCs and set to run on boot.
- [ ] Launch Admin Dashboard at the front desk.
- [ ] Open the doors!
