'use strict';

const { app, BrowserWindow, Menu } = require('electron');
const fs = require('fs');
const path = require('path')

function createWindow(projectDir) {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    })

    win.loadFile('index.html')

    win.on('')

    if (projectDir) {
        win.webContents.send('action', 'open', projectDir);
    }
}

app.whenReady().then(() => {
    const argv = process.argv.slice(2);
    const openDir = argv[0];
    if (openDir) {
        const stat = fs.statSync(openDir);
        if (stat.isDirectory()) {
            createWindow(openDir)
        }
    }

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
