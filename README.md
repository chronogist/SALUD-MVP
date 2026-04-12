# Salud - Privacy-Preserving Medical Records on Aleo

A decentralized health records management system built on the Aleo blockchain. Patients store, manage, and share encrypted medical records with full privacy and control. Doctors access shared records by scanning QR codes — no medical data ever leaves the chain unencrypted.

![Aleo](https://img.shields.io/badge/Aleo-Blockchain-blue)
![React](https://img.shields.io/badge/React-18-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)
![Vite](https://img.shields.io/badge/Vite-7-646CFF)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E)

**Live Demo:** Deployed on Vercel

---

## Features

### Patient Portal
- **Create Medical Records** — Encrypt and store records on the Aleo blockchain (lab results, prescriptions, diagnoses, imaging, etc.)
- **Share with Doctors** — Generate time-limited access grants with QR codes for specific doctors
- **Data Sharing Dashboard** — View all registered doctors, manage active shares, revoke access, and share new records inline
- **Record Management** — Browse, search, and view all your medical records with detailed modal views
- **Wallet Integration** — Connect via Leo Wallet or Shield Wallet using the Aleo Wallet Adapter

### Doctor Portal
- **QR Scanner** — Scan patient QR codes to access shared medical records
- **Record Decryption** — Aleo decrypts the shared record using the doctor's wallet — only authorized doctors can read the data
- **Registration** — Doctors register their name and specialty on first connect (stored in Supabase)
- **My Medical Records** — Side-by-side view of the QR scanner and the doctor's own records with clickable detail views
- **Unauthorized Handling** — Clear visual distinction between authorized access (success) and pending/unauthorized scans

### Privacy & Security
- **End-to-End Encryption** — Medical data is encrypted before leaving the browser
- **Zero-Knowledge** — No server or intermediary can read medical records
- **Time-Limited Access** — Access grants expire automatically (configurable duration)
- **Revocable Sharing** — Patients can revoke doctor access at any time
- **On-Chain Storage** — Records stored as private Aleo records (8 field elements x 30 bytes)

---

## Architecture

```
                    Aleo Blockchain
                    (Leo Smart Contract)
                         |
                  encrypt / decrypt
                         |
    ┌────────────────────┼────────────────────┐
    |                    |                    |
Patient Portal     Doctor Portal        Supabase
(React SPA)        (React SPA)       (Doctor Directory)
    |                    |                    |
    └────────── Aleo Wallet Adapter ──────────┘
                  (Leo / Shield Wallet)
```

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite 7, Framer Motion |
| **State** | Zustand (persisted to localStorage) |
| **Blockchain** | Aleo (Leo smart contract: `salud_records.aleo`) |
| **Wallet** | `@provablehq/aleo-wallet-adaptor` (Leo Wallet, Shield Wallet) |
| **Doctor Directory** | Supabase (PostgreSQL) — shared across devices |
| **QR Scanning** | `html5-qrcode` + `qrcode.react` |
| **Styling** | Tailwind CSS + custom CSS (design system with prefixed classes) |
| **Deployment** | Vercel (SPA with rewrites) |

---

## Smart Contract

The Leo program `salud_records.aleo` defines:

- **`MedicalRecord`** — Private record owned by the patient (8 encrypted data fields, type, hash, timestamps)
- **`SharedMedicalRecord`** — Private record owned by the doctor (copy of patient data with access token and expiry)
- **`create_record`** — Encrypt and store a new medical record on-chain
- **`share_record`** — Create a time-limited shared copy for a specific doctor address
- **`revoke_access`** — Revoke a previously granted access token

Access duration is bounded between ~240 blocks (~20 min) and ~40,320 blocks (~7 days).

---

## Project Structure

```
Salud/
├── Main APP/                    # React frontend (Vite)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx      # Role selection (Patient / Doctor)
│   │   │   ├── HomePage.tsx         # Patient overview dashboard
│   │   │   ├── RecordsPage.tsx      # Medical records management
│   │   │   ├── SharedAccessPage.tsx # Data sharing with doctors
│   │   │   └── DoctorPage.tsx       # Doctor portal (scanner + records)
│   │   ├── components/
│   │   │   ├── layout/             # SiteLayout, Sidebar, Header, WalletConnectModal
│   │   │   ├── records/            # CreateRecordModal, ShareRecordModal, RecordDetailModal
│   │   │   └── ui/                 # Reusable UI primitives (Radix-based)
│   │   ├── lib/
│   │   │   ├── aleo-utils.ts       # Field encoding/decoding, record parsing
│   │   │   ├── supabase.ts         # Supabase client (doctor directory)
│   │   │   └── utils.ts            # Formatting, clipboard, helpers
│   │   ├── store/index.ts          # Zustand stores (user, records, access grants)
│   │   ├── types/records.ts        # TypeScript types, record type definitions
│   │   └── contexts/WalletProvider.tsx
│   ├── package.json
│   └── vite.config.ts
├── Salud Health Contract/       # Leo smart contract
│   ├── src/main.leo             # Contract source
│   ├── build/                   # Compiled program
│   └── deploy.mjs              # Deployment script
├── vercel.json                  # Vercel build config + SPA rewrites
└── README.md
```

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- **npm**
- An Aleo wallet (Leo Wallet or Shield Wallet browser extension)

### 1. Clone and Install

```bash
git clone <repository-url>
cd Salud/Main\ APP
npm install
```

### 2. Environment Variables

Create `Main APP/.env`:

```env
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### 3. Supabase Setup

Create a `doctors` table in your Supabase project:

```sql
CREATE TABLE doctors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  specialty TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors are publicly readable"
  ON doctors FOR SELECT USING (true);

CREATE POLICY "Anyone can register as a doctor"
  ON doctors FOR INSERT WITH CHECK (true);
```

### 4. Run the Dev Server

```bash
npm run dev
```

Open `http://localhost:5173`

### 5. Build for Production

```bash
npm run build
```

Output goes to `Main APP/dist/`. Vercel deploys automatically from the repo root using `vercel.json`.

---

## How It Works

### Patient Flow
1. Connect wallet on the landing page (select "Patient")
2. Create medical records — data is encrypted and stored on the Aleo blockchain
3. Share a record with a doctor — select doctor from directory, choose a record, set expiry
4. A QR code is generated containing the transaction reference (no medical data in the QR)
5. Manage shares on the Data Sharing page — view active/revoked/expired grants, revoke access

### Doctor Flow
1. Connect wallet on the landing page (select "Doctor")
2. Register name and specialty (first time only — stored in Supabase)
3. Scan a patient's QR code with the built-in camera scanner
4. If the patient shared the record with this doctor's address, the Aleo network decrypts it
5. View the full medical record — title, description, type, expiry, and verification metadata
6. If not authorized, a clear pending state explains what to do next

---

## Deployment

The app is deployed on **Vercel**. The `vercel.json` in the repo root handles:

- Build command: `cd 'Main APP' && npm install && npm run build`
- Output directory: `Main APP/dist`
- SPA routing: all paths rewrite to `/index.html`

---

## Tech Stack

| Package | Purpose |
|---------|---------|
| `react` + `react-dom` | UI framework |
| `react-router-dom` | Client-side routing |
| `zustand` | State management (persisted to localStorage) |
| `framer-motion` | Animations and page transitions |
| `@provablehq/sdk` | Aleo SDK for encryption/decryption |
| `@provablehq/aleo-wallet-adaptor-*` | Wallet connection (Leo, Shield) |
| `@supabase/supabase-js` | Doctor directory (cross-device) |
| `html5-qrcode` | QR code scanning |
| `qrcode.react` | QR code generation |
| `lucide-react` | Icons |
| `tailwindcss` | Utility-first CSS |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[MIT License](LICENSE)

## Acknowledgments

- Built on [Aleo](https://aleo.org/) — Privacy-first blockchain
- Uses [Leo](https://leo-lang.org/) programming language
- Powered by [@provablehq/sdk](https://github.com/ProvableHQ)
