import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref as dbRef,
  onValue as dbOnValue,
  get as dbGet,
  set as dbSet,
} from "firebase/database";
import { getStorage } from "firebase/storage";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCH4vpSVmGkjcgC4KiS_7JkD-uuFQFOqyw",
  authDomain: "freebox-primev1.firebaseapp.com",
  databaseURL: "https://freebox-primev1-default-rtdb.firebaseio.com",
  projectId: "freebox-primev1",
  storageBucket: "freebox-primev1.firebasestorage.app",
  messagingSenderId: "227315554911",
  appId: "1:227315554911:web:bae79fadb6100170ae19ea",
  measurementId: "G-3JZGRY5KGH"
};

// Initialize Firebase (ensure it's only initialized once)
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database & Storage
const database = getDatabase(app);
const storage = getStorage(app);

// Export everything you need
export {
  app,
  database,
  storage,
  dbRef as ref,
  dbOnValue as onValue,
  dbGet as get,
  dbSet as set,
};

export default app;
