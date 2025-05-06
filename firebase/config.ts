import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyClAdxsTyp9iZkrRmWMrEDxBAT3Q_NduKk",
  authDomain: "caretaker-562d5.firebaseapp.com",
  projectId: "caretaker-562d5",
  storageBucket: "caretaker-562d5.firebasestorage.app",
  messagingSenderId: "514566300700",
  appId: "1:514566300700:web:306fcb5594d46262e0ebd9",
  measurementId: "G-PMKMKS0RPS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const database = getDatabase(app);
export const storage = getStorage(app);

export default app;