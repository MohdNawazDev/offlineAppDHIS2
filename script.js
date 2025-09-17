if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js')
    .then((res) => console.log('Service Worker registered', res))
    .catch((err) => console.error(err))
}


const baseUrl = "https://links.hispindia.org/myr_registry";
const username = "admin";
const password = "district";

let db;

// 1. Delete old DB first
let deleteRequest = indexedDB.deleteDatabase("Program Db");

deleteRequest.onsuccess = () => {
  console.log("Program Db deleted successfully.");

  // 2. Now open a fresh DB (new version will trigger onupgradeneeded)
  let openDB = indexedDB.open("Program Db", 1);

  openDB.onsuccess = (e) => {
    db = e.target.result;
    console.log("Db created successfully");
    // Call the function to either fetch or read from cache
    loadAndCachePrograms();
  };

  openDB.onupgradeneeded = (e) => {
    console.log("On UpgradeNeeded Executed...");
    db = e.target.result;
    if (!db.objectStoreNames.contains("Program Names")) {
      let store = db.createObjectStore("Program Names", { keyPath: "id" });
      store.createIndex("by_name", "displayName", { unique: false });
    }
  };

  openDB.onerror = (e) => {
    console.log("On Error Executed", e);
  };
};

deleteRequest.onerror = (e) => {
  console.error("Error deleting Program Db", e);
};

deleteRequest.onblocked = () => {
  console.warn("Delete blocked. Please close other tabs using this DB.");
};


async function loadAndCachePrograms() {
  try {
    const res = await fetch(`${baseUrl}/api/programs.json`, {
      headers: {
        Accept: "application/json",
        Authorization: "Basic " + btoa(`${username}:${password}`)
      }
    });

    if (res.ok) {
      const data = await res.json();
      console.log("Programs from network:", data);
      saveProgramToDb(data.programs);
    } else {
      console.error("Network request failed with status:", res.status, res.statusText);
      // The fetch failed, so we'll read from IndexedDB
      readProgramsFromDb();
    }
  } catch (err) {
    // This catches network-level errors (e.g., no internet connection)
    console.error("Fetch error:", err);
    readProgramsFromDb();
  }
}

function saveProgramToDb(programs) {
  let tx = db.transaction("Program Names", "readwrite");
  let store = tx.objectStore("Program Names");

  programs.forEach((program) => {
    let request = store.put(program);
    request.onsuccess = () => {
      console.log("Saved Program Successfully:", program.displayName);
    };
    request.onerror = (err) => {
      console.error("Error while loading the Program", err);
    };
  });

  tx.oncomplete = () => {
    console.log("All programs saved to Index Db");
  };
}


function readProgramsFromDb() {
  let tx = db.transaction("Program Names", "readonly");
  let store = tx.objectStore("Program Names");
  let request = store.getAll();

  request.onsuccess = (e) => {
    let programs = e.target.result;
    console.log("Programs from IndexedDB:", programs);
    if (programs.length === 0) {
      console.log("No programs found in IndexedDB.");
    }
  };

  request.onerror = (err) => {
    console.error("Error reading programs from IndexedDB", err);
  };
}






