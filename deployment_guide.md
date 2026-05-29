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

---

## 4. SaaS Enterprise Cloud Deployment (AWS EC2 & Vercel)

To run YP Arena OS as a B2B SaaS business, you must host your marketing portal, user signups, and licensing engine in the cloud.

### A. Deploying the Central SaaS API Server to AWS EC2
1. **Launch EC2 Instance:** Set up an **Ubuntu 22.04 LTS** instance (t3.micro or t3.small is sufficient to start).
2. **Configure Security Group:** Allow inbound ports:
   - `22` (SSH)
   - `80` (HTTP)
   - `443` (HTTPS)
3. **Associate Elastic IP:** Bind a static IP to the instance so it doesn't change on reboot.
4. **Deploy Node Server:** SSH into the instance, clone your repository, navigate to `apps/saas-central-server`, and install dependencies:
   ```bash
   npm install
   ```
5. **Keep Process Active:** Install `pm2` globally to manage the Node server:
   ```bash
   sudo npm install -pm2 -g
   pm2 start server.js --name yp-saas-server
   pm2 save
   pm2 startup
   ```
6. **Nginx Reverse Proxy & SSL Setup:**
   - Install Nginx: `sudo apt install nginx`
   - Configure Nginx to forward port 80/443 traffic to `http://localhost:5000`.
   - Install certbot for free SSL:
     ```bash
     sudo apt install certbot python3-certbot-nginx
     sudo certbot --nginx -d api.yparenaos.com
     ```
   - Now, your Edge Servers can securely validate license keys via `https://api.yparenaos.com/api/licenses/validate`.

### B. Deploying the Landing Page to Vercel
1. **Connect GitHub:** Sign up on Vercel and connect your GitHub repository.
2. **Project Configuration:**
   - Select the `YpArenaOS` repository.
   - Set the framework preset to **Vite** (or Next.js if you choose).
   - Set the Root Directory to `apps/landing-page`.
3. **Configure Environment Variables:** Add `VITE_SAAS_API_URL` under project settings and set it to your AWS EC2 subdomain: `https://api.yparenaos.com`.
4. **Deploy:** Click **Deploy**. Vercel will build the React site, provision an SSL certificate, and serve it on a global CDN.
5. **Custom Domain:** Add your root domain `yparenaos.com` in Vercel settings and point your DNS CNAME/A records to Vercel.

### C. Hosting Large Installers on Amazon S3
1. **Create Bucket:** Create an Amazon S3 Bucket named `yparenaos-dist` with block-all-public-access disabled.
2. **Upload Executables:** Compile your NSIS installer (`YP-Arena-OS-Unified-Installer.exe`) and upload it to the bucket root.
3. **Set Permissions:** Enable public read access for the uploaded file so owners can download it.
4. **Link in UI:** Use the S3 link (e.g. `https://yparenaos-dist.s3.amazonaws.com/YP-Arena-OS-Unified-Installer.exe`) as the target for the download buttons on your Vercel landing page.

---

## Your Launch Checklists

### B2B SaaS Company Launch Checklist (You)
- [x] Register domain name (e.g. `yparenaos.com`).
- [ ] Deploy Central SaaS Server on AWS EC2 (`api.yparenaos.com`).
- [ ] Connect SSL certificate using Let's Encrypt Certbot on Nginx.
- [ ] Deploy Marketing Landing Page on Vercel connected to the EC2 API URL.
- [ ] Upload compiled NSIS installers to Amazon S3.
- [ ] Configure Stripe payments on SaaS Server for automatic subscription billing.

### Individual Café Onboarding Checklist (Your Customer)
- [ ] Customer subscribes on `yparenaos.com` and receives a License Key.
- [ ] Customer downloads the Unified Installer.
- [ ] Customer runs the installer on their local Master Server, enters their License Key, and registers their client PCs.
- [ ] The local Edge Server connects to your AWS EC2 Central Server to activate and runs in active mode.

