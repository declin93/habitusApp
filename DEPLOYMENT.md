# Habitus - Deployment Guide

## 🚀 Quick Start (Local Development)

```bash
cd habitus-react
npm install
npm run dev
```

Open http://localhost:5173

## 📦 Deploy to GitHub Pages

### Option 1: GitHub Actions (Automatic)

1. Push this repo to GitHub
2. Go to **Settings** → **Pages**
3. Under **Build and deployment**, select **Source: GitHub Actions**
4. The workflow will auto-deploy on every push to `main`

### Option 2: Manual Deploy

```bash
npm install
npm run build
npm run deploy
```

⚠️ **Important**: Update `base` in `vite.config.js` to match your repo name:
```js
base: '/your-repo-name/',
```

## 🔧 Configuration

### Change Base URL
Edit `vite.config.js`:
```js
base: '/habitus/',  // Change this to your repo name
```

### Enable PWA
The PWA is pre-configured with:
- Service worker for offline support
- App manifest with icon
- Auto-updates on new deployments

### Browser Permissions
For notifications to work, users must:
1. Allow notifications when prompted
2. Keep the PWA tab open or installed as an app

## 📱 Install as PWA

### Desktop
- Chrome/Edge: Click the install icon in address bar
- Safari: Not supported

### Mobile
- iOS Safari: Share → Add to Home Screen
- Android Chrome: Menu → Add to Home Screen

## 🎨 Customization

### Change Theme Colors
Edit CSS variables in `src/index.css`:
```css
:root {
  --accent: #6c63ff;  /* Primary color */
  --green: #4caf7d;   /* Success color */
  /* ... */
}
```

### Add More Habit Icons
Edit `ICONS` array in `src/App.jsx`:
```js
const ICONS = ['🧘','🏃', /* add more here */];
```

## 🐛 Troubleshooting

### "Failed to fetch" on GitHub Pages
- Check that `base` in `vite.config.js` matches your repo name
- Rebuild with `npm run build`

### Service Worker not updating
- Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
- Clear site data in DevTools → Application → Storage

### Notifications not working
- Check browser permissions: Settings → Site Settings → Notifications
- Ensure HTTPS (required for notifications)
- Service worker must be active

## 📊 Data & Backups

All data is stored in browser localStorage:
- Automatic save on every change
- Export/import via Data & Backup menu
- No backend required

## 🔐 Privacy

- 100% client-side (no data sent to servers)
- No analytics or tracking
- All data stays in your browser
