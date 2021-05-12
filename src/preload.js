'use strict';

const { ipcRenderer } = require('electron');
const { readdirSync } = require('fs');

window.addEventListener('DOMContentLoaded', () => {
    // Renderer process
    ipcRenderer.invoke('get_project_dir').then((result) => {
        // ...
        document.getElementById('title').innerText = result;
        renderList(result);
    });
});

function renderList(projectDir) {
    const list = readdirSync(projectDir).filter((item) => {
        console.log(item);
        return item.endsWith('.graffle');
    });
    document.getElementById("folder").innerHTML = list.join('<br />');
}

// 监听与主进程的通信
ipcRenderer.on('action', (event, action, ...args) => {
    switch (action) {
        case "open":
            const [projectDir] = args;
            if (projectDir) {
                renderList(projectDir);
            }
            break;
        default:
            break;
    }
});
