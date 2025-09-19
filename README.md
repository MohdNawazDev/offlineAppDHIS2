# OfflineAppDHIS2

> A Progressive Web App (PWA) front-end for DHIS2 that works offline — leveraging service workers, manifest files, and local caching to allow limited DHIS2 usage without a constant network connection.

---

## 📖 Table of Contents
- [Project Overview](#project-overview)
- [Features](#features)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Technologies](#technologies)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## 📌 Project Overview

DHIS2 (District Health Information System v2) is widely used for collecting, analyzing and using health data. However, in many regions connectivity is intermittent or unreliable.  
**OfflineAppDHIS2** provides offline support so users can still access cached data and continue limited operations without an internet connection. Once the connection is restored, cached data can be synced back to DHIS2.

---

## ✨ Features

- ✅ Installable PWA (desktop & mobile)  
- ✅ Offline-first using **Service Workers**  
- ✅ Asset & data caching for offline availability  
- ✅ Basic sync mechanism when back online *(planned)*  
- ✅ Lightweight and simple to deploy  

---

## ⚡ Installation & Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/MohdNawazDev/offlineAppDHIS2.git
   cd offlineAppDHIS2
