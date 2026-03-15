# RoomFlow  
A Progressive Web App (PWA) for managing classroom and meeting room reservations at NEU. Built with React, TypeScript, Firebase, and Firestore, RoomFlow streamlines room scheduling, professor check-ins, and admin oversight.  

🔗 **Live deployed link:** [room-flow-seven.vercel.app](https://room-flow-seven.vercel.app/)  
📂 **GitHub Repository:** [github.com/anthoncalban/roomFlow](https://github.com/anthoncalban/roomFlow)  

---

## ✨ Features
- Authentication & Onboarding with Firebase Anonymous Sign-in  
- QR check-in / check-out with live session tracking  
- Room directory with dynamic QR generation  
- Real-time dashboard analytics with Firestore listeners  
- Audit trail of all admin actions  
- Professor management (whitelist, block/unblock)  
- PWA installation support on mobile devices  

---

## 🛠 Tech Stack
| Layer       | Technology |
|-------------|------------|
| Frontend    | React, TypeScript, Vite |
| Styling     | CSS (index.css) |
| Auth        | Firebase Auth (Google Sign-In, Anonymous Login) |
| Database    | Cloud Firestore |
| Hosting     | Vercel |
| QR Scanning | qrcode.react, html5-qrcode |
| Charts      | Recharts |

---

## 🔄 Application Flows

### 1. Authentication & Onboarding Flow
- **Initial State:** App checks for Firebase Auth session.  
- **User Input:** Full Name, Institutional Email, Role (Professor, Facility Manager, Administrator).  
- **Secure Connection:** Firebase Anonymous Sign-in creates a temporary session.  
- **Profile Creation:** Firestore `users` collection stores profile details linked to `uid`.  

---

### 2. Room Access Flow (Scanner)
- **Scanning:** User scans a Room QR Code (`roomId`).  
- **Entry Logic:**  
  - If no active session exists → create new log with `entryTime`, `userUid`, `roomId`, and subject.  
- **Exit Logic:**  
  - If active session exists → update log with `exitTime` and calculate duration.  

---

### 3. Room Management & QR Generation Flow
- **Room Directory:** Browse available facilities.  
- **QR Generation:** Each room has a unique ID → QR generated via `qrcode.react`.  
- **Deployment:** Admins print QR codes and post them at room entrances.  

---

### 4. Data Monitoring & Analytics Flow
- **Real-time Updates:** Firestore `onSnapshot` keeps dashboards live.  
- **Dashboard Analytics:**  
  - Usage Hours (sum of `durationMinutes`)  
  - Active Rooms (logs with `exitTime = null`)  
- **Visualizations:** Recharts bar chart (most used rooms), line chart (peak usage hours).  

---

### 5. History & Audit Flow
- **Logging:** Every entry/exit stored permanently in `logs`.  
- **History View:** Chronological table of activities.  
- **Search/Filter:** Filter logs by room or subject.  

---

## 🚀 Getting Started
Install dependencies

bash
npm install
Configure Firebase

Copy .env.example → .env

Fill in Firebase credentials

Run locally

bash
npm run dev
Open http://localhost:5173 in your browser.

Deploy via Vercel or Firebase Hosting.

## PWA Installation
Android (Chrome): Open app → Add to Home Screen → Install

iOS (Safari): Open app → Share → Add to Home Screen → Install

## ⚖️ License
Academic Integrity & Copyright Notice
This project was developed for academic purposes at NEU. Unauthorized copying, adaptation, distribution, or commercial use is strictly prohibited.
