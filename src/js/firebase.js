// src/js/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';
import { getDatabase, ref, push, onValue, off, serverTimestamp, limitToLast, query, orderByKey, remove } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyDoVSYZvO_ew5ySaN7981J8S6rxV1aCwrQ",
  authDomain: "gozartechat.firebaseapp.com",
  databaseURL: "https://gozartechat-default-rtdb.firebaseio.com",
  projectId: "gozartechat",
  storageBucket: "gozartechat.firebasestorage.app",
  messagingSenderId: "845903029009",
  appId: "1:845903029009:web:dc28a9f7435a7a1b9c62b0",
  measurementId: "G-SWY2WZGQJ5"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const database = getDatabase(app);
const messaging = getMessaging(app);

export { 
    app, 
    analytics, 
    auth,
    database,
    messaging,
    signInAnonymously,
    getToken,
    onMessage,
    ref,
    push,
    onValue,
    off,
    serverTimestamp,
    limitToLast,
    query,
    orderByKey,
    remove
};