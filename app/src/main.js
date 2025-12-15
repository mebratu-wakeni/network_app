import './style.css'
import { defineCustomElements as defineIonicons } from 'ionicons/loader';

// Ionicons resourcesUrl configuration
// Solution: Copy ionicons/dist/* to public/ionicons/ so it's accessible in both dev and production
// In development: Vite serves public folder at root (/ionicons/)
// In production: Electron serves public folder, so /ionicons/ works
// This avoids the node_modules path issue in production builds
// Note: After installing/updating ionicons, run: cp -r node_modules/ionicons/dist/* public/ionicons/
const IONICONS_RESOURCES_URL = '/ionicons/';

// Register ionicons web components
defineIonicons(window, { 
  resourcesUrl: IONICONS_RESOURCES_URL
}).then(() => {
  // console.log('ion-icon defined:', window.customElements?.get('ion-icon'));
}).catch(err => {
  console.error('ionicons registration failed:', err);
});

import { App } from './App.js'

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app')
  app.appendChild(App())
}
)
// // Use contextBridge
// window.ipcRenderer.on('main-process-message', (_event, message) => {
//   console.log(message)
// })
