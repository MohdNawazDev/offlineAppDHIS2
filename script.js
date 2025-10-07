if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then((res) => console.log('Service Worker Registered', res))
    .catch((err) => console.error('Problem while Registering the Service Worker'))
}

const baseUrl = "https://links.hispindia.org/myr_registry";
const username = "admin";
const password = "district";

let programDb;
let orgUnitDb;
let DB_VERSION = 1;

// Avoid race condition
let dbCountReady = 0;
let REQUIRED_DBS = 2;

const programDropDown = document.getElementById("programDropDown");
const orgUnitTreeContainer = document.getElementById("orgUnitTreeContainer");
const loader = document.getElementById('dataLoader');

orgUnitTreeContainer.style.display = "none";


// ---------- Tree Styling ----------
function addTreeStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .collapsed {
      display: none;
    }

    #orgUnitTreeContainer ul {
      list-style-type: none;
      padding-left: 15px;
    }

    .tree-toggler {
      margin-right: 5px;
      display: inline-block;
      cursor: pointer;
      font-size: 12px;
      width: 12px;
      font-weight: bold;
    }

    #orgUnitTreeContainer li {
      margin: 3px 0;
      font-family: Arial, sans-serif;
    }

    #orgUnitTreeContainer li > span {
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}
addTreeStyles();

// ---------- Collapse/Expand Toggle ----------
function attachEventListeners() {
  orgUnitTreeContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains('tree-toggler')) {
      const icon = e.target;
      const childList = icon.closest('li').querySelector('ul');

      if (childList) {
        if (childList.classList.contains('collapsed')) {
          childList.classList.remove('collapsed');
          icon.textContent = '▼';
        } else {
          childList.classList.add('collapsed');
          icon.textContent = '▶';
        }
      }
    }
  });
}

// ---------- IndexedDB Setup ----------
let openProgramDb = indexedDB.open("Program Db", DB_VERSION);
let openOrgUnitDb = indexedDB.open("OrgUnit Db", DB_VERSION);

openProgramDb.onupgradeneeded = (e) => {
  programDb = e.target.result;
  if (!programDb.objectStoreNames.contains("Program Names")) {
    programDb.createObjectStore("Program Names", { keyPath: "id" });
  }
};

openOrgUnitDb.onupgradeneeded = (e) => {
  orgUnitDb = e.target.result;
  if (!orgUnitDb.objectStoreNames.contains("OrgUnit Data")) {
    orgUnitDb.createObjectStore("OrgUnit Data", { keyPath: "id" });
  }
};

openProgramDb.onsuccess = (e) => {
  programDb = e.target.result;
  dbCountReady++;
  if (dbCountReady === REQUIRED_DBS) loadAndCacheData();
};

openOrgUnitDb.onsuccess = (e) => {
  orgUnitDb = e.target.result;
  dbCountReady++;
  if (dbCountReady === REQUIRED_DBS) loadAndCacheData();
};

// ---------- Flatten OrgUnits ----------
function flattenOrgUnits(nodes = [], parentId = null) {
  let flat = [];
  nodes.forEach(node => {
    const normalized = {
      id: node.id,
      displayName: node.displayName || node.name,
      parent: node.parent && node.parent.id ? node.parent.id : parentId,
      level: node.level,
      path: node.path,
      code: node.code
    };
    flat.push(normalized);
    if (node.children && node.children.length > 0) {
      flat = flat.concat(flattenOrgUnits(node.children, node.id));
    }
  });
  return flat;
}

function saveToIndexDb(db, storeName, data) {
  let tx = db.transaction(storeName, "readwrite");
  let store = tx.objectStore(storeName);
  data.forEach(item => store.put(item));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = (err) => reject(err);
  })
}

// ---------- Fetch + Save ----------
async function loadAndCacheData() {
  if (loader) loader.style.display = 'block';

  try {
    // Programs
    const programRes = await fetch(`${baseUrl}/api/programs.json`, {
      headers: {
        Accept: "application/json",
        Authorization: "Basic " + btoa(`${username}:${password}`)
      }
    });
    const programData = await programRes.json();
    saveToIndexDb(programDb, "Program Names", programData.programs);

    // OrgUnits
    const orgUnitUrl = `${baseUrl}/api/organisationUnits.json?paging=false&withinUserHierarchy=true&fields=id,displayName,parent[id],level,path,code,children[id,displayName,parent[id],level,path,code]`;
    const orgUnitRes = await fetch(orgUnitUrl, {
      headers: {
        Accept: "application/json",
        Authorization: "Basic " + btoa(`${username}:${password}`)
      }
    });
    const orgUnitData = await orgUnitRes.json();

    const flattenedOrgUnits = flattenOrgUnits(orgUnitData.organisationUnits);
    await saveToIndexDb(orgUnitDb, "OrgUnit Data", flattenedOrgUnits);

    loadPrograms();
    loadOrgUnits();

  } catch (error) {
    console.error("Network fetch failed. Falling back to cached data.");
    loadPrograms();
    loadOrgUnits();
  } 
}

// ---------- Load + Populate ----------
function loadPrograms() {
  const tx = programDb.transaction("Program Names", "readonly");
  const store = tx.objectStore("Program Names");
  const req = store.getAll();
  req.onsuccess = (e) => {
    loader.style.display = "none";
    const programs = e.target.result;
    programDropDown.innerHTML = `<option value="">Select Program</option>`;
    programs.forEach(p => {
      let option = document.createElement("option");
      option.value = p.id;
      option.textContent = p.displayName || p.name;
      programDropDown.appendChild(option);
    });
  };
}
programDropDown.addEventListener("change", async(e) => {
  const programId = e.target.value; 

  if(!programId){
    orgUnitTreeContainer.style.display = "none";
    return; 
  }

  if(loader) loader.style.display = "block";
  orgUnitTreeContainer.style.display = "none";

  try {
    const programRes = await fetch(`${baseUrl}/api/programs/${programId}.json?fields=organisationUnits[id, displayName, parent[id]]`, {
    headers: {
      Accept: "application/json",
      Authorization: "Basic " + btoa(`${username}:${password}`)
    }
    });
    const programData = await programRes.json();
    const allowedOrgUnits = programData.organisationUnits.map(ou => ou.id);

    //getting all from index db 
    const tx = orgUnitDb.transaction("OrgUnit Data", "readwrite");
    const store = tx.objectStore("OrgUnit Data");
    const req =   store.getAll();

    req.onsuccess = (e) => {
      const allUnits = e.target.result; 

      //filtering orgUnits based on programs 
      const filtered = allUnits.filter(u => allowedOrgUnits.includes(u.id));

      //keeping parent hierarch so it is not broken 
      const parentId = new Set(filtered.map(f => f.parent).filter(Boolean));
      const finalUnits = allUnits.filter(u => allowedOrgUnits.includes(u.id) || parentId.has(u.id));


      //re-render tree 
      orgUnitTreeContainer.innerHTML = "";
      const tree = buildOrgUnitTree(finalUnits);
      renderOrgUnitTreeList(tree, orgUnitTreeContainer, true);
      attachEventListeners();

      if(loader) loader.style.display = "none"; 
      orgUnitTreeContainer.style.display = "block";
    }


  } catch (error) {
     console.error("Error while loading the orgUnits", error);
  }
})

function loadOrgUnits() {
  const tx = orgUnitDb.transaction("OrgUnit Data", "readonly");
  const store = tx.objectStore("OrgUnit Data");
  const req = store.getAll();
  req.onsuccess = (e) => {
    const units = e.target.result;
    orgUnitTreeContainer.innerHTML = '';
//     // const tree = buildOrgUnitTree(units);
//     // renderOrgUnitTreeList(tree, orgUnitTreeContainer, true);
//     // attachEventListeners(); 


  };
}

// ---------- Building Tree ----------
function buildOrgUnitTree(flatUnit) {
  const roots = [];
  const lookups = {};
  flatUnit.forEach(u => lookups[u.id] = { ...u, children: [] });
  flatUnit.forEach(u => {
    if (u.parent && lookups[u.parent]) {
      lookups[u.parent].children.push(lookups[u.id]);
    } else {
      roots.push(lookups[u.id]);
    }
  });
  return roots;
}

// ---------- Render Tree ----------
function renderOrgUnitTreeList(nodes, parentElement, isRoot = false) {
  if (nodes.length === 0) return;

  const ul = document.createElement('ul');

  // Collapse only non-root levels
  if (!isRoot) {
    ul.classList.add('collapsed');
  }

  nodes.forEach(node => {
    const li = document.createElement('li');
    const textContainer = document.createElement("span");
    textContainer.style.cursor = 'pointer';
    textContainer.dataset.id = node.id;

    if (node.children && node.children.length > 0) {
      const icon = document.createElement("span");

      // Root level starts expanded, children start collapsed
      icon.textContent = isRoot ? '▼' : '▶';
      icon.classList.add('tree-toggler'); 
      textContainer.appendChild(icon);
    } else {
      textContainer.innerHTML += '<span class="tree-toggler" style="color: transparent;">▶</span>';
    }

    textContainer.innerHTML += node.displayName;
    li.appendChild(textContainer);

    if (node.children && node.children.length > 0) {
      renderOrgUnitTreeList(node.children, li, false);
    }

    ul.appendChild(li);
  });

  parentElement.appendChild(ul);
}

orgUnitTreeContainer.addEventListener("click", (e) => {

    if(e.target.dataset && e.target.dataset.id){
      const programId = programDropDown.value;
      const orgUnitId = e.target.dataset.id;

      if(programId && orgUnitId){
        fetchTrackedEntities(programId, orgUnitId);
      }
    }
})

async function fetchTrackedEntities(){

  if(loader) loader.style.display = 'block';

  const programId = "AvmN1naRvHk";
  const orgUnitId = "LichhR5JRuK";

  try {
    const url = `${baseUrl}/api/tracker/trackedEntities.json?program=${programId}&orgUnit=${orgUnitId}&pageSize=20`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: "Basic " + btoa(`${username}:${password}`)
      }
    });

    const data = await res.json();
    console.log("TrackedEntities", data);
    
    displayTrackedEntities(data);

  } catch (err) {
    console.error("Error while fetching the tracked Entities", err);
  }finally{
    if(loader) loader.style.display = "none";
  }
}

window.addEventListener('load', () => {
  
  fetchTrackedEntities();
})

// reading orgUnit data 


async function syncOrgUnitsToServer() {
    if (loader) loader.style.display = 'block';

    try {
        
        const tx = orgUnitDb.transaction("OrgUnit Data", "readonly");
        const store = tx.objectStore("OrgUnit Data");
        
        const units = await new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });

        console.log(`Preparing to sync ${units.length} Organisation Units...`);

        
        const updatedUrl = `${baseUrl}/api/organisationUnits`;

        const updatePayload = {
          
          "name": "Testing OrgUnit",
          "shortName": "My Testing OrgUnit",
          "parent": { "id" : "ImspTQPwCqd"}


        }
        const response = await fetch(updatedUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json', 
                Authorization: "Basic " + btoa(`${username}:${password}`)
            },
            
            body: JSON.stringify(updatePayload) 
        });

        if (response.ok) {
            console.log("Organisation Units successfully synced to DHIS2 via /api/metadata!");
            const syncResult = await response.json();
            console.log("Server response:", syncResult);
        } else {
            console.error(`Failed to sync Organisation Units. Status: ${response.status}`);
            const errorText = await response.text();
            console.error("Server error details:", errorText);
        }

    } catch (error) {
        console.error("Error during IndexedDB read or server sync:", error);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

//tracked enities 

let trackedEntitiesData = [];

//for receving api data and triggering table rendering 
function displayTrackedEntities(data){
  trackedEntitiesData = data.trackedEntities || [];
  renderTable(trackedEntitiesData);
}


//render table 
function renderTable(entities) {
  const container = document.getElementById('trackedEntityContainer');
  container.innerHTML = '';

  if (!entities || entities.length === 0) {
    console.log("No Tracked Entities Data");
    return;
  }

  const table = document.createElement('table');
  table.style.borderCollapse = "collapse";
  table.style.width = "100%";

  // Create header row
  const header = table.insertRow();
  ['Date of Birth', 'First Name', 'Age', 'Unique System Identifier'].forEach((text, index) => {
    const th = document.createElement('th');
    th.innerText = text;
    th.style.border = "1px solid #ccc";
    th.style.padding = "8px";
    th.style.cursor = "pointer";
    th.addEventListener('click', () => sortTableByColumn(index));
    header.appendChild(th);
  });

  // Define attribute UIDs
  const Name_UID = "f9aoiBUWNoh";
  const DOB_UID = "CdGAXOR8ao4";
  const Age_UID = "t5M4LVInZVo";
  const UniqueId_UID = "vIxginDQcrk";

  entities.forEach(entitiesData => {
    if (!entitiesData || !entitiesData.attributes) return;

    
    const attrMap = {};
    entitiesData.attributes.forEach(attr => {
      attrMap[attr.attribute] = attr.value;
    });

    // Now get values directly from map
    const row = table.insertRow();
    [
      attrMap[DOB_UID] || "",
      attrMap[Name_UID] || "",
      attrMap[Age_UID] || "",
      attrMap[UniqueId_UID] || ""
    ].forEach(val => {
      const cell = row.insertCell();
      cell.innerText = val;
      cell.style.border = "1px solid #ccc";
      cell.style.padding = "8px";
    });
  });

  container.appendChild(table);
}


