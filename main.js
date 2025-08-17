const { app, BrowserWindow } = require('electron');
const path = require('path');
const childProcess = require('child_process');
const net = require('net');

let serverProcess;

function waitForServer(port, callback) {
  const client = new net.Socket();
  client.connect({ port }, () => {
    client.end();
    callback();
  });
  client.on('error', () => {
    setTimeout(() => waitForServer(port, callback), 500);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadURL(`http://localhost:${process.env.PORT || 5000}/pages/login.html`);
}

app.whenReady().then(() => {
  console.log("🚀 Starting server from:", path.join(__dirname, 'server.js'));

  serverProcess = childProcess.spawn(
    process.execPath,
    ['-r', 'dotenv/config', path.join(__dirname, 'server.js')],
    { cwd: __dirname, stdio: 'inherit' }
  );

  waitForServer(process.env.PORT || 5000, () => {
    console.log("✅ Server is ready!");
    createWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
