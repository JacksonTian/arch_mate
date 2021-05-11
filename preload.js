'use strict';

const { ipcRenderer } = require('electron');
const { readdirSync } = require('fs');

window.addEventListener('DOMContentLoaded', () => {
    // const projectDir = argv[0];
    // if (projectDir) {
    //     const stat = fs.statSync(projectDir);
    //     if (stat.isDirectory()) {
    //         document.getElementById("folder").innerHTML = readdirSync(projectDir).join('<br />');
    //     }
    // }
})

//监听与主进程的通信
ipcRenderer.on('action', (event, action, ...args) => {
    switch (action) {
        case "open":
            // remote.process.argv.slice(2);
            const [projectDir] = args;
            // console.log(action);
            if (projectDir) {
                document.getElementById("folder").innerHTML = readdirSync(projectDir).join('<br />');
            }
            break;
        default:
            break;
    }
});