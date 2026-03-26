import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyARoAqRuX2dZSCeBSXba4OaRtT0JPMNV7M",
  authDomain: "plannerres.firebaseapp.com",
  databaseURL: "https://plannerres-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "plannerres",
  storageBucket: "plannerres.firebasestorage.app",
  messagingSenderId: "490155416536",
  appId: "1:490155416536:web:bb7f2625bc51af0c7e30ad"
};

// Инициализируем подключение
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);