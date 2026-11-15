const API_URL = "http://127.0.0.1:8000/api";

let catalogoOficial = [];
let asientosDB = [];
let usuarioActivo = JSON.parse(sessionStorage.getItem('active_user_conta')) || null;

window.onload = async function() {
    const fechaInput = document.getElementById('partida-fecha');
    if (fechaInput) fechaInput.valueAsDate = new Date();
    
    if (usuarioActivo) {
        await iniciarSesionApp();
    }
};

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const eyeOpen = btn.querySelector('.eye-open');
    const eyeClosed = btn.querySelector('.eye-closed');

    if (input.type === "password") {
        input.type = "text";
        if (eyeOpen) eyeOpen.classList.add('hidden');
        if (eyeClosed) eyeClosed.classList.remove('hidden');
    } else {
        input.type = "password";
        if (eyeOpen) eyeOpen.classList.remove('hidden');
        if (eyeClosed) eyeClosed.classList.add('hidden');
    }
}

function toggleThemeMenu() {
    document.getElementById('theme-menu').classList.toggle('hidden');
}

function cambiarModoBase(modo) {
    document.documentElement.setAttribute('data-theme', modo);
    if (usuarioActivo) {
        usuarioActivo.tema = modo;
        sessionStorage.setItem('active_user_conta', JSON.stringify(usuarioActivo));
    }
}

function cambiarColorAcento(color) {
    document.documentElement.setAttribute('data-accent', color);
    if (usuarioActivo) {
        usuarioActivo.acento = color;
        sessionStorage.setItem('active_user_conta', JSON.stringify(usuarioActivo));
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

function switchAuthTab(tab) {
    document.getElementById('tab-login-btn').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register-btn').classList.toggle('active', tab === 'register');
    document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.detail || "Invalid credentials.");
            return;
        }

        usuarioActivo = { ...data, tema: 'dark', acento: 'purple' };
        sessionStorage.setItem('active_user_conta', JSON.stringify(usuarioActivo));
        await iniciarSesionApp();
    } catch (error) {
        alert("Connection error with the Python server. Make sure to run 'uvicorn base:app --reload'.");
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const nombre = document.getElementById('reg-nombre').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;
    const rol = document.getElementById('reg-rol').value;

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre, email, password, rol })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.detail || "Could not register user.");
            return;
        }

        usuarioActivo = { ...data, tema: 'dark', acento: 'purple' };
        sessionStorage.setItem('active_user_conta', JSON.stringify(usuarioActivo));
        await iniciarSesionApp();
    } catch (error) {
        alert("Connection error with the Python server.");
    }
}

async function iniciarSesionApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    
    document.getElementById('user-display-name').innerText = usuarioActivo.nombre;
    document.getElementById('user-display-role').innerText = usuarioActivo.rol;

    if (usuarioActivo.tema) cambiarModoBase(usuarioActivo.tema);
    if (usuarioActivo.acento) cambiarColorAcento(usuarioActivo.acento);

    await cargarCatalogoDesdeBD();
    reiniciarFormularioPartida();
    await navigateTo('diario');
}

function logout() {
    usuarioActivo = null;
    sessionStorage.removeItem('active_user_conta');
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
}

async function navigateTo(moduleId) {
    document.querySelectorAll('.module-view').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const targetModule = document.getElementById(moduleId);
    if (targetModule) targetModule.classList.add('active');
    
    const activeNavBtn = document.getElementById(`nav-${moduleId}`);
    if (activeNavBtn) activeNavBtn.classList.add('active');

    if (moduleId === 'diario') await cargarHistorialPartidas();
    if (moduleId === 'mayor') await generarLibroMayor();
    if (moduleId === 'balance') await generarBalance();
    if (moduleId === 'auditoria') await cargarAuditoriaTabla();
}

async function cargarCatalogoDesdeBD() {
    try {
        const res = await fetch(`${API_URL}/catalogo`);
        catalogoOficial = await res.json();
        const tbody = document.getElementById('body-catalogo');
        if (tbody) {
            tbody.innerHTML = catalogoOficial.map(c => `<tr><td><strong>${c.codigo}</strong></td><td>${c.nombre}</td><td>${c.tipo}</td></tr>`).join('');
        }
    } catch (e) {
        console.error("Error loading chart of accounts:", e);
    }
}

function reiniciarFormularioPartida() {
    document.getElementById('body-filas-partida').innerHTML = "";
    agregarFilaMovimiento();
    agregarFilaMovimiento();
    calcularTotalesPartida();
    const suggestionEl = document.getElementById('raccoonSuggestion');
    if (suggestionEl) suggestionEl.innerText = "🦝 Raccoon: Type a concept for AI account tips";
}

function agregarFilaMovimiento() {
    const tbody = document.getElementById('body-filas-partida');
    const tr = document.createElement('tr');

    const options = catalogoOficial.map(c => `<option value="${c.codigo}">${c.codigo} - ${c.nombre}</option>`).join('');

    tr.innerHTML = `
        <td>
            <select class="input-cuenta" style="width:100%;">${options}</select>
        </td>
        <td>
            <input type="number" step="0.01" class="input-debe" value="0.00" oninput="calcularTotalesPartida()">
        </td>
        <td>
            <input type="number" step="0.01" class="input-haber" value="0.00" oninput="calcularTotalesPartida()">
        </td>
        <td>
            <button type="button" class="btn-delete-sm" onclick="eliminarFila(this)">✕</button>
        </td>
    `;
    tbody.appendChild(tr);
}

function eliminarFila(btn) {
    btn.closest('tr').remove();
    calcularTotalesPartida();
}

function calcularTotalesPartida() {
    let totDebe = 0;
    let totHaber = 0;

    document.querySelectorAll('.input-debe').forEach(i => totDebe += parseFloat(i.value) || 0);
    document.querySelectorAll('.input-haber').forEach(i => totHaber += parseFloat(i.value) || 0);

    document.getElementById('calc-total-debe').innerText = `$${totDebe.toFixed(2)}`;
    document.getElementById('calc-total-haber').innerText = `$${totHaber.toFixed(2)}`;

    const esCuadrado = Math.abs(totDebe - totHaber) < 0.001 && totDebe > 0;
    document.getElementById('alerta-descuadre').classList.toggle('hidden', esCuadrado || (totDebe === 0 && totHaber === 0));

    return { totDebe, totHaber, esCuadrado };
}

async function triggerRaccoonAI(conceptText) {
    const suggestionSpan = document.getElementById('raccoonSuggestion');
    if (!suggestionSpan) return;
    
    if (conceptText.length < 3) {
        suggestionSpan.innerText = "🦝 Raccoon: Type a concept for AI account tips";
        return;
    }
    
    suggestionSpan.innerText = "🦝 Raccoon is analyzing concept...";
    try {
        const res = await fetch(`${API_URL}/ai/raccoon-assist`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ concept: conceptText })
        });
        const result = await res.json();
        if (result && result.suggestion) {
            suggestionSpan.innerText = `🦝 Suggestion: ${result.suggestion} | Tip: ${result.tip}`;
        }
    } catch (err) {
        suggestionSpan.innerText = "🦝 Raccoon is resting.";
    }
}

// RACCOON SIDEBAR CHAT FUNCTIONS
async function sendRaccoonChat() {
    const input = document.getElementById('raccoonChatInput');
    const chatBox = document.getElementById('raccoonChatBox');
    if (!input || !input.value.trim()) return;

    const userText = input.value.trim();
    chatBox.innerHTML += `<div class="raccoon-msg user"><b>You:</b> ${userText}</div>`;
    input.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const res = await fetch(`${API_URL}/ai/raccoon-assist`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ concept: userText })
        });
        const data = await res.json();
        if (res.ok) {
            chatBox.innerHTML += `<div class="raccoon-msg bot"><b>🦝 Raccoon:</b> ${data.suggestion}. <em>Tip:</em> ${data.tip}</div>`;
        } else {
            chatBox.innerHTML += `<div class="raccoon-msg bot"><b>🦝 Raccoon:</b> I'm resting right now!</div>`;
        }
    } catch (e) {
        chatBox.innerHTML += `<div class="raccoon-msg bot"><b>🦝 Raccoon:</b> Connection error.</div>`;
    }
    chatBox.scrollTop = chatBox.scrollHeight;
}

function handleRaccoonKeyPress(e) {
    if (e.key === 'Enter') {
        sendRaccoonChat();
    }
}

async function guardarPartida(e) {
    e.preventDefault();
    const fecha = document.getElementById('partida-fecha').value;
    const concepto = document.getElementById('partida-concepto').value;
    const { esCuadrado } = calcularTotalesPartida();

    if (!esCuadrado) {
        alert("Cannot register entry: Total Debit must equal Total Credit.");
        return;
    }

    const movimientos = [];
    document.querySelectorAll('#body-filas-partida tr').forEach(tr => {
        const codigo = tr.querySelector('.input-cuenta').value;
        const debe = parseFloat(tr.querySelector('.input-debe').value) || 0;
        const haber = parseFloat(tr.querySelector('.input-haber').value) || 0;

        if (debe > 0 || haber > 0) {
            const cuentaObj = catalogoOficial.find(c => c.codigo === codigo);
            movimientos.push({ codigo, nombre: cuentaObj.nombre, debe, haber });
        }
    });

    try {
        const res = await fetch(`${API_URL}/partidas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fecha,
                concepto,
                registrado_por: usuarioActivo.nombre,
                rol_usuario: usuarioActivo.rol,
                movimientos
            })
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Error saving the entry.");
            return;
        }

        alert(`Accounting entry ${data.numAsiento} saved to the database!`);
        document.getElementById('form-partida').reset();
        document.getElementById('partida-fecha').valueAsDate = new Date();
        reiniciarFormularioPartida();
        await cargarHistorialPartidas();
    } catch (error) {
        alert("Connection error with the Python database.");
    }
}

async function cargarHistorialPartidas() {
    const contenedor = document.getElementById('historial-partidas-contenedor');
    if (!contenedor) return;

    try {
        const res = await fetch(`${API_URL}/partidas`);
        asientosDB = await res.json();

        if (asientosDB.length === 0) {
            contenedor.innerHTML = "<p style='font-size:0.85rem;'>No accounting entries registered in the database.</p>";
            return;
        }

        contenedor.innerHTML = asientosDB.map(p => `
            <div style="background:var(--bg-panel); padding:12px; margin-bottom:12px; border-radius:6px; border:1px solid var(--border-color);">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <strong>${p.numAsiento} — ${p.fecha}</strong>
                    <span style="font-size:0.8rem; color:var(--text-muted);">Registered by: ${p.registradoPor}</span>
                </div>
                <p style="font-size:0.85rem; margin-bottom:8px;">${p.concepto}</p>
                <table class="table-custom">
                    <thead><tr><th>Account</th><th>Debit ($)</th><th>Credit ($)</th></tr></thead>
                    <tbody>
                        ${p.movimientos.map(m => `<tr><td>${m.codigo} - ${m.nombre}</td><td>$${m.debe.toFixed(2)}</td><td>$${m.haber.toFixed(2)}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `).join('');
    } catch (e) {
        contenedor.innerHTML = "<p>Error loading entries from the server.</p>";
    }
}

async function generarLibroMayor() {
    const contenedor = document.getElementById('contenedor-mayor');
    if (!contenedor) return;

    const res = await fetch(`${API_URL}/partidas`);
    asientosDB = await res.json();

    if (asientosDB.length === 0) {
        contenedor.innerHTML = "<p>No movements available for ledger posting.</p>";
        return;
    }

    let mapa = {};
    asientosDB.slice().reverse().forEach(p => {
        p.movimientos.forEach(m => {
            if (!mapa[m.codigo]) mapa[m.codigo] = { nombre: m.nombre, movs: [] };
            mapa[m.codigo].movs.push({ fecha: p.fecha, concepto: p.concepto, debe: m.debe, haber: m.haber });
        });
    });

    let html = "";
    for (let cod in mapa) {
        let c = mapa[cod];
        let totDebe = c.movs.reduce((a, b) => a + b.debe, 0);
        let totHaber = c.movs.reduce((a, b) => a + b.haber, 0);

        html += `
            <div style="margin-bottom:20px;">
                <h4 style="color:var(--accent-primary); margin-bottom:8px;">${cod} - ${c.nombre}</h4>
                <table class="table-custom">
                    <thead><tr><th>Date</th><th>Concept</th><th>Debit ($)</th><th>Credit ($)</th></tr></thead>
                    <tbody>
                        ${c.movs.map(m => `<tr><td>${m.fecha}</td><td>${m.concepto}</td><td>$${m.debe.toFixed(2)}</td><td>$${m.haber.toFixed(2)}</td></tr>`).join('')}
                        <tr style="font-weight:bold; background:var(--bg-panel);">
                            <td colspan="2">Totals</td><td>$${totDebe.toFixed(2)}</td><td>$${totHaber.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }
    contenedor.innerHTML = html;
}

async function generarBalance() {
    const tbody = document.getElementById('body-balance');
    if (!tbody) return;

    const res = await fetch(`${API_URL}/partidas`);
    asientosDB = await res.json();

    if (asientosDB.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6'>No data available.</td></tr>";
        return;
    }

    let mapa = {};
    asientosDB.forEach(p => {
        p.movimientos.forEach(m => {
            if (!mapa[m.codigo]) mapa[m.codigo] = { nombre: m.nombre, debe: 0, haber: 0 };
            mapa[m.codigo].debe += m.debe;
            mapa[m.codigo].haber += m.haber;
        });
    });

    let html = "";
    let sumD = 0, sumH = 0, sumSD = 0, sumSA = 0;

    for (let cod in mapa) {
        let c = mapa[cod];
        let saldoDeudor = c.debe > c.haber ? c.debe - c.haber : 0;
        let saldoAcreedor = c.haber > c.debe ? c.haber - c.debe : 0;

        sumD += c.debe; sumH += c.haber;
        sumSD += saldoDeudor; sumSA += saldoAcreedor;

        html += `<tr><td><strong>${cod}</strong></td><td>${c.nombre}</td><td>$${c.debe.toFixed(2)}</td><td>$${c.haber.toFixed(2)}</td><td>$${saldoDeudor.toFixed(2)}</td><td>$${saldoAcreedor.toFixed(2)}</td></tr>`;
    }

    tbody.innerHTML = html;
    document.getElementById('bal-total-debe').innerText = `$${sumD.toFixed(2)}`;
    document.getElementById('bal-total-haber').innerText = `$${sumH.toFixed(2)}`;
    document.getElementById('bal-total-sdeudor').innerText = `$${sumSD.toFixed(2)}`;
    document.getElementById('bal-total-sacreedor').innerText = `$${sumSA.toFixed(2)}`;
}

async function cargarAuditoriaTabla() {
    const tbody = document.getElementById('body-auditoria');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_URL}/auditoria`);
        const logs = await res.json();
        tbody.innerHTML = logs.map(l => `<tr><td>${l.fechaHora}</td><td>${l.usuario}</td><td>${l.rol}</td><td><strong>${l.accion}</strong></td><td>${l.detalle}</td></tr>`).join('');
    } catch (e) {
        tbody.innerHTML = "<tr><td colspan='5'>Error loading audit log.</td></tr>";
    }
}