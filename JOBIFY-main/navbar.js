import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore, doc, getDoc, collection, query,
    where, getDocs, updateDoc, onSnapshot, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAReLeJ4fIMhjmTQMy6fgOpkEn9ebspjTU",
    authDomain: "jobify-392f2.firebaseapp.com",
    projectId: "jobify-392f2",
    storageBucket: "jobify-392f2.firebasestorage.app",
    messagingSenderId: "508357161570",
    appId: "1:508357161570:web:3137bb4e917e2e0552173b"
};

// Reusar app si ya existe
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── INICIALIZAR NAVBAR ───────────────────────────────────────────────────
export function iniciarNavbar() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;

        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (!userSnap.exists()) return;
        const userData = userSnap.data();

        iniciarMiniPerfil(user, userData);
        iniciarNotificaciones(user.uid);
    });
}

// ══════════════════════════════════════════════════════════════════════════
//  MINI PERFIL
// ══════════════════════════════════════════════════════════════════════════
function iniciarMiniPerfil(user, userData) {
    const initial = (userData.nombre || "U").charAt(0).toUpperCase();

    // Foto o inicial en el trigger
    const userPhoto   = document.getElementById('userPhoto');
    const userInitial = document.getElementById('userInitial');
    if (userPhoto && userInitial) {
        if (userData.foto) {
            userPhoto.src          = userData.foto;
            userPhoto.style.display  = "block";
            userInitial.style.display = "none";
        } else {
            userInitial.innerText    = initial;
            userInitial.style.display = "flex";
            userPhoto.style.display  = "none";
        }
    }

    // Datos en el dropdown
    const menuName    = document.getElementById('menuName');
    const menuEmail   = document.getElementById('menuEmail');
    const menuInitial = document.getElementById('menuInitial');
    const menuFoto    = document.getElementById('menuFoto');

    if (menuName)    menuName.innerText  = userData.nombre || "Usuario";
    if (menuEmail)   menuEmail.innerText = user.email;
    if (menuInitial) {
        if (userData.foto) {
            menuInitial.innerHTML  = `<img src="${userData.foto}" alt="Foto"
                style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            menuInitial.innerText = initial;
        }
    }

    // Reputación
    const menuRep = document.getElementById('menuReputacion');
    if (menuRep && userData.reputacion) {
        const estrellas = Math.round(userData.reputacion);
        menuRep.innerHTML = '⭐'.repeat(estrellas) + '☆'.repeat(5 - estrellas) +
            ` <span style="font-size:12px;color:#888;">(${userData.reputacion}/5)</span>`;
    }

    // Toggle dropdown
    const trigger  = document.getElementById('profileTrigger');
    const dropdown = document.getElementById('profileDropdown');
    if (trigger && dropdown) {
        trigger.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
            // Cerrar notificaciones si está abierto
            const notifDropdown = document.getElementById('notifDropdown');
            if (notifDropdown) notifDropdown.classList.remove('active');
        };
    }

    // Cerrar al hacer click fuera
    window.addEventListener('click', (e) => {
        if (dropdown && !trigger?.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // Logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.onclick = () => signOut(auth).then(() => window.location.href = 'index.html');
    }
}

// ══════════════════════════════════════════════════════════════════════════
//  NOTIFICACIONES
// ══════════════════════════════════════════════════════════════════════════
function iniciarNotificaciones(uid) {
    const bell    = document.getElementById('notifBell');
    const badge   = document.getElementById('notifBadge');
    const dropdown = document.getElementById('notifDropdown');
    const lista   = document.getElementById('notifLista');

    if (!bell || !dropdown || !lista) return;

    // Escuchar notificaciones en tiempo real
    const q = query(
        collection(db, "notificaciones"),
        where("para", "==", uid),
        orderBy("fecha", "desc"),
        limit(20)
    );

    onSnapshot(q, (snap) => {
        const notifs   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const noLeidas = notifs.filter(n => !n.leido).length;

        // Badge
        if (badge) {
            badge.innerText       = noLeidas > 9 ? '9+' : noLeidas;
            badge.style.display   = noLeidas > 0 ? 'flex' : 'none';
        }

        // Render lista
        lista.innerHTML = '';
        if (notifs.length === 0) {
            lista.innerHTML = `<div class="notif-empty">🔔 Sin notificaciones</div>`;
            return;
        }

        notifs.forEach(n => {
            const item = document.createElement('div');
            item.className = 'notif-item' + (n.leido ? ' leida' : ' no-leida');
            item.innerHTML = `
                <div class="notif-dot ${n.leido ? '' : 'activo'}"></div>
                <div class="notif-content">
                    <p class="notif-msg">${n.mensaje}</p>
                    <span class="notif-fecha">${formatearFecha(n.fecha)}</span>
                </div>`;
            item.onclick = async () => {
                if (!n.leido) {
                    await updateDoc(doc(db, "notificaciones", n.id), { leido: true });
                }
            };
            lista.appendChild(item);
        });
    });

    // Toggle dropdown
    bell.onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
        // Cerrar perfil si está abierto
        const profileDropdown = document.getElementById('profileDropdown');
        if (profileDropdown) profileDropdown.classList.remove('active');
    };

    // Botón marcar todas como leídas
    const btnMarcarTodas = document.getElementById('btnMarcarTodas');
    if (btnMarcarTodas) {
        btnMarcarTodas.onclick = async (e) => {
            e.stopPropagation();
            const q2  = query(collection(db, "notificaciones"),
                where("para", "==", uid), where("leido", "==", false));
            const snap2 = await getDocs(q2);
            snap2.forEach(d => updateDoc(doc(db, "notificaciones", d.id), { leido: true }));
        };
    }

    // Cerrar al hacer click fuera
    window.addEventListener('click', (e) => {
        if (!bell.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

// ─── HELPER: formatear fecha ──────────────────────────────────────────────
function formatearFecha(isoStr) {
    if (!isoStr) return '';
    const fecha = new Date(isoStr);
    const ahora = new Date();
    const diff  = Math.floor((ahora - fecha) / 1000); // segundos

    if (diff < 60)   return 'Hace un momento';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}