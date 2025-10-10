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
  apiKey: "AIzaSyDuaWMh0eIJ2tdtLxYj43ij9MGSh_Yo22M",
  authDomain: "test-6977e.firebaseapp.com",
  databaseURL: "https://test-6977e-default-rtdb.firebaseio.com/",
  projectId: "test-6977e",
  storageBucket: "test-6977e.firebasestorage.app",
  messagingSenderId: "544329273038",
  appId: "1:544329273038:web:c7a31e12bec7c80741ca9f",
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
