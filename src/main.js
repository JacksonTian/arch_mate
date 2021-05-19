'use strict';

const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const openDir = argv[0];
let projectDir;
if (openDir) {
    const stat = fs.statSync(openDir);
    if (stat.isDirectory()) {
        projectDir = openDir;
    }
}

function createWindow() {
    const win = new BrowserWindow({
        // show: false,
        width: 2500 / 2,
        height: 1440 / 2,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    })

    win.loadFile(path.join(__dirname, 'index.html'));
    // win.maximize();
    // win.show();
}

app.whenReady().then(() => {
    createWindow()

    // const menu = Menu.buildFromTemplate([
    //     {
    //         label: 'File',
    //         submenu: []
    //     },
    //     {
    //         label: 'Edit',
    //         submenu: [
    //             {
    //                 role: 'undo'
    //             },
    //             {
    //                 role: 'redo'
    //             },
    //             {
    //                 type: 'separator'
    //             },
    //             {
    //                 role: 'cut'
    //             },
    //             {
    //                 role: 'copy'
    //             },
    //             {
    //                 role: 'paste'
    //             },
    //             {
    //                 role: 'pasteandmatchstyle'
    //             },
    //             {
    //                 role: 'delete'
    //             },
    //             {
    //                 role: 'selectall'
    //             }
    //         ]
    //     },
    //     {
    //         label: 'View',
    //         submenu: [
    //             {
    //                 role: 'reload'
    //             },
    //             {
    //                 role: 'forcereload'
    //             },
    //             {
    //                 role: 'toggledevtools'
    //             },
    //             {
    //                 type: 'separator'
    //             },
    //             {
    //                 role: 'resetzoom'
    //             },
    //             {
    //                 role: 'zoomin'
    //             },
    //             {
    //                 role: 'zoomout'
    //             },
    //             {
    //                 type: 'separator'
    //             },
    //             {
    //                 role: 'togglefullscreen'
    //             }
    //         ]
    //     },
    //     {
    //         role: 'help',
    //         submenu: [
    //             {
    //                 label: 'Home Page',
    //                 click() { require('electron').shell.openExternal('http://www.jianshu.com/u/a7454e40399d'); }
    //             }
    //         ]
    //     }
    // ]);
    // Menu.setApplicationMenu(menu);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })

    // app.dock.setMenu(Menu.buildFromTemplate([
    //     {
    //         label: 'New Window',
    //         click() { console.log('New Window') }
    //     }, {
    //         label: 'New Window with Settings',
    //         submenu: [
    //             { label: 'Basic' },
    //             { label: 'Pro' }
    //         ]
    //     },
    //     { label: 'New Command...' }
    // ]));
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

ipcMain.handle('get_project_dir', async (event) => {
    const [projectDir] = process.argv.slice(2);
    return projectDir;
});