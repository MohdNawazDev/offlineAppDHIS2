if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js')
    .then((res) => console.log('Service Worker registered', res))
    .catch((err) => console.error(err))
}


const baseUrl = "https://links.hispindia.org/myr_registry";
const username = "admin";
const password = "district";

let programDb;
let orgUnitDb;


let DB_VERSION = 1;



//Opening the db 
let openProgramDb = indexedDB.open("Program Db", DB_VERSION);
let openOrgUnitDb = indexedDB.open("OrgUnit Db", DB_VERSION);


//OnUpgradedNeeded      
openProgramDb.onupgradeneeded = (e) => {
    programDb = e.target.result;

    if(!programDb.objectStoreNames.contains("Program Names")){
        let store =  programDb.createObjectStore("Program Names", {keyPath: "id"});
        store.createIndex("by_names", "name", {unique: false});
    }
}

openOrgUnitDb.onupgradeneeded = (e) => {
    orgUnitDb = e.target.result;

    if(!orgUnitDb.objectStoreNames.contains("OrgUnit Data")){
        let store = orgUnitDb.createObjectStore("OrgUnit Data", {keyPath: "id"});
        store.createIndex("by_names", "name", {unique: false});
        store.createIndex("by_id", "id", {unique: false});
        store.createIndex("by_level", "level", {unique: false});
    }
}


openProgramDb.onsuccess = (e) => {
    programDb = e.target.result;
    console.log("OpenProgram opened Successfully.");
    checkAndLoadData();
}

openOrgUnitDb.onsuccess = (e) => {
    orgUnitDb = e.target.result;
    console.log("OpenOrgUnit opened Successfully");
    checkAndLoadData();
}

openProgramDb.onerror = (err) => console.error("Error", err);
openOrgUnitDb.onerror = (err) => console.error("Error", err)


let dbCountReady = 0;
const DB_Count = 2;

function checkAndLoadData(){
    dbCountReady++;
    
    if(dbCountReady == DB_Count){
        loadAndCacheData();
    }
}


 async function loadAndCacheData() {
    try {
        const programRes = await fetch(`${baseUrl}/api/programs.json`, {
            headers: {
                Accept: "Application/json",
                Authorization: "Basic " +  btoa(`${username}:${password}`)
            }
        });
        const programData = await programRes.json();
        saveProgramToDb(programData.programs);


        const orgUnitRes = await fetch(`${baseUrl}/api/organisationUnits.json?fields=name,id,level`, {
            headers: {
                Accept: "Application/json",
                Authorization: "Basic " +  btoa(`${username}:${password}`)
            }
        });
        const orgUnitData = await orgUnitRes.json();
        saveOrgUnitToDb(orgUnitData.organisationUnits);



    } catch (error) {
        console.log("Network fetch failed. relying on caching data");
        
    }
}
function saveProgramToDb(programs) {
    let tx = programDb.transaction("Program Names", "readwrite");
    let store = tx.objectStore("Program Names");
    programs.forEach(program => store.put(program));
    tx.oncomplete = () => console.log("All Program Data Saved Successfully.");
}

function saveOrgUnitToDb(orgUnits) {
    let tx = orgUnitDb.transaction("OrgUnit Data", "readwrite");
    let store = tx.objectStore("OrgUnit Data");
    orgUnits.forEach(orgUnit => store.put(orgUnit));
    tx.oncomplete = () => console.log("All OrgUnit Data Saved Successfully.");
}




