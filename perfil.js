import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyAReLeJ4fIMhjmTQMy6fgOpkEn9ebspjTU",
    authDomain: "jobify-392f2.firebaseapp.com",
    projectId: "jobify-392f2",
    storageBucket: "jobify-392f2.firebasestorage.app",
    messagingSenderId: "508357161570",
    appId: "1:508357161570:web:3137bb4e917e2e0552173b"
};

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);

const TAGS = [
    "Python", "Java", "SQL", "C#", "C++", "JavaScript", "PHP",
    "Swift", "Kotlin", "Dart", "Go", "Ruby", "HTML", "CSS",
    "TypeScript", "Scala", "R", "MATLAB", "Julia"
];

let selectedTags  = [];
let rolUsuario    = "";
let usuarioActual = null;
let portafolioItems = []; // { id, titulo, descripcion, links[], imagenUrl, imagenFile }

// ─── INICIO ───────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    usuarioActual = user;

    const docSnap  = await getDoc(doc(db, "usuarios", user.uid));
    if (!docSnap.exists()) { window.location.href = "index.html"; return; }

    const userData = docSnap.data();
    rolUsuario     = userData.rol;

    // Título según rol
    document.getElementById('perfilTitulo').innerText =
        userData.perfilCompleto ? "Editar Perfil" : "Configura tu Perfil";

    // Cargar datos existentes
    if (userData.nombre) document.getElementById('displayName').value = userData.nombre;

    // Foto de perfil actual
    if (userData.foto) {
        const preview     = document.getElementById('fotoPreview');
        const placeholder = document.getElementById('fotoPlaceholder');
        preview.src               = userData.foto;
        preview.style.display     = 'block';
        placeholder.style.display = 'none';
    }

    // Mostrar campos según rol
    if (rolUsuario === "Empresa") {
        document.getElementById('companyFields').style.display = "block";
        if (userData.descripcion) document.getElementById('companyBio').value = userData.descripcion;
    } else {
        document.getElementById('devFields').style.display = "block";
        selectedTags = userData.habilidades || [];
        if (userData.pagoSugerido) document.getElementById('payRange').value = userData.pagoSugerido;
        renderTags();
        // Mostrar columna portafolio
        document.getElementById('portafolioSection').style.display = 'block';
        // Cargar portafolio existente
        portafolioItems = userData.portafolio || [];
        if (portafolioItems.length > 0) {
            document.getElementById('portafolioEmpty').style.display = 'none';
        }
        portafolioItems.forEach((item, i) => renderPortafolioItem(item, i));
    }
});

// ─── RENDER TAGS ──────────────────────────────────────────────────────────
function renderTags() {
    const cloud = document.getElementById('skillsCloud');
    cloud.innerHTML = "";
    TAGS.forEach(tag => {
        const span       = document.createElement('span');
        span.innerText   = tag;
        span.className   = 'skill-tag' + (selectedTags.includes(tag) ? ' selected' : '');
        span.onclick = () => {
            if (selectedTags.includes(tag)) {
                selectedTags = selectedTags.filter(t => t !== tag);
                span.classList.remove('selected');
            } else {
                selectedTags.push(tag);
                span.classList.add('selected');
            }
        };
        cloud.appendChild(span);
    });
}

// ─── PREVIEW DE IMAGEN ────────────────────────────────────────────────────
document.getElementById('profileImage').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const preview     = document.getElementById('fotoPreview');
        const placeholder = document.getElementById('fotoPlaceholder');
        preview.src               = ev.target.result;
        preview.style.display     = 'block';
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
});

// ─── CONTADOR DE PALABRAS ─────────────────────────────────────────────────
const bioEl = document.getElementById('companyBio');
if (bioEl) {
    bioEl.addEventListener('input', () => {
        const palabras = bioEl.value.trim() === '' ? 0 : bioEl.value.trim().split(/\s+/).length;
        const counter  = document.getElementById('bioCounter');
        if (counter) {
            counter.innerText = `${palabras} / 1000 palabras`;
            counter.style.color = palabras > 1000 ? '#DC2626' : '#aaa';
        }
    });
}

// ─── GUARDAR PERFIL ───────────────────────────────────────────────────────
document.getElementById('btnSaveProfile').onclick = async () => {
    const user   = usuarioActual;
    if (!user)   return;

    const nombre = document.getElementById('displayName').value.trim();
    const file   = document.getElementById('profileImage').files[0];
    const btn    = document.getElementById('btnSaveProfile');

    // Validaciones
    if (!nombre) return mostrarError("El nombre es obligatorio.");

    if (rolUsuario === "Empresa") {
        const bio     = document.getElementById('companyBio').value.trim();
        const palabras = bio === '' ? 0 : bio.trim().split(/\s+/).length;
        if (palabras > 1000) return mostrarError("La descripción no debe exceder las 1000 palabras.");
    } else {
        if (selectedTags.length === 0) return mostrarError("Selecciona al menos una habilidad.");
    }

    btn.innerText = "Guardando...";
    btn.disabled  = true;

    try {
        let imageUrl = "";

        // Subir imagen si se seleccionó una
        if (file) {
            const status  = document.getElementById('uploadStatus');
            status.innerText = "Subiendo imagen...";
            const storageRef = ref(storage, `perfiles/${user.uid}`);
            await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(storageRef);
            status.innerText = "";
        }

        // Datos base
        const updateData = {
            nombre,
            perfilCompleto: true,
            reputacion:     (await getDoc(doc(db, "usuarios", user.uid))).data()?.reputacion   || 5,
            totalValores:   (await getDoc(doc(db, "usuarios", user.uid))).data()?.totalValores || 0
        };

        if (imageUrl) updateData.foto = imageUrl;

        // Datos según rol
        if (rolUsuario === "Empresa") {
            updateData.descripcion = document.getElementById('companyBio').value.trim();
        } else {
            updateData.habilidades   = selectedTags;
            updateData.pagoSugerido  = document.getElementById('payRange').value || "0";
            // Subir imágenes del portafolio y guardar
            const portafolioGuardado = [];
            for (const item of portafolioItems) {
                let imgUrl = item.imagenUrl || "";
                if (item.imagenFile) {
                    const imgRef = ref(storage, `portafolio/${user.uid}/${Date.now()}_${item.imagenFile.name}`);
                    await uploadBytes(imgRef, item.imagenFile);
                    imgUrl = await getDownloadURL(imgRef);
                }
                portafolioGuardado.push({
                    id:          item.id,
                    titulo:      item.titulo || "",
                    descripcion: item.descripcion || "",
                    links:       item.links || [],
                    imagenUrl:   imgUrl
                });
            }
            updateData.portafolio = portafolioGuardado;
        }

        await updateDoc(doc(db, "usuarios", user.uid), updateData);

        alert("✅ Perfil guardado con éxito.");
        window.location.href = "dashboard.html";

    } catch (error) {
        mostrarError("Error al guardar: " + error.message);
        btn.innerText = "Guardar Perfil";
        btn.disabled  = false;
    }
};


// ─── PORTAFOLIO ───────────────────────────────────────────────────────────
document.getElementById('btnAgregarProyecto').addEventListener('click', () => {
    const item = { id: Date.now(), titulo: '', descripcion: '', links: [], imagenUrl: '', imagenFile: null };
    portafolioItems.push(item);
    renderPortafolioItem(item, portafolioItems.length - 1);
});

function renderPortafolioItem(item, index) {
    const container = document.getElementById('portafolioItems');
    // Ocultar empty state
    const empty = document.getElementById('portafolioEmpty');
    if (empty) empty.style.display = 'none';

    const div = document.createElement('div');
    div.className = 'portafolio-item';
    div.id        = `portafolio-item-${item.id}`;

    div.innerHTML = `
        <!-- Imagen arriba -->
        <img id="prev-${item.id}" class="portafolio-img-preview"
            ${item.imagenUrl ? `src="${item.imagenUrl}" style="display:block;"` : ''}>
        <div class="portafolio-img-placeholder" id="placeholder-${item.id}"
            ${item.imagenUrl ? 'style="display:none;"' : ''}>
            <span>📷</span>
            Clic para subir imagen
        </div>
        <input type="file" id="file-${item.id}" accept="image/*" style="display:none;">

        <!-- Cuerpo -->
        <div class="portafolio-card-body">
            <div class="portafolio-item-header">
                <span class="portafolio-item-numero">Proyecto ${index + 1}</span>
                <button class="btn-eliminar-portafolio" data-id="${item.id}" title="Eliminar">✕</button>
            </div>

            <div class="portafolio-field">
                <label>Nombre del proyecto</label>
                <input type="text" id="titulo-${item.id}"
                    placeholder="Ej: Tienda online con carrito de compras"
                    value="${item.titulo || ''}">
            </div>

            <div class="portafolio-field">
                <label>Descripción</label>
                <textarea id="desc-${item.id}"
                    placeholder="¿Qué hiciste? ¿Qué tecnologías usaste?">${item.descripcion || ''}</textarea>
            </div>

            <div class="portafolio-field">
                <label>Enlaces</label>
                <div class="link-chips" id="chips-${item.id}"></div>
                <div class="link-input-row">
                    <input type="url" id="link-input-${item.id}"
                        placeholder="https://github.com/usuario/proyecto">
                    <button class="btn-agregar-link" data-id="${item.id}">+ Link</button>
                </div>
            </div>
        </div>`;

    container.appendChild(div);

    // Render links existentes
    renderLinks(item);

    // Click en placeholder → abrir input file
    div.querySelector(`#placeholder-${item.id}`).onclick = () => div.querySelector(`#file-${item.id}`).click();
    div.querySelector(`#prev-${item.id}`).onclick        = () => div.querySelector(`#file-${item.id}`).click();

    // Seleccionar imagen
    div.querySelector(`#file-${item.id}`).addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        portafolioItems[index].imagenFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const prev = div.querySelector(`#prev-${item.id}`);
            prev.src          = ev.target.result;
            prev.style.display = 'block';
            div.querySelector(`#placeholder-${item.id}`).style.display = 'none';
        };
        reader.readAsDataURL(file);
    });

    // Título
    div.querySelector(`#titulo-${item.id}`).addEventListener('input', (e) => {
        portafolioItems[index].titulo = e.target.value;
    });

    // Descripción
    div.querySelector(`#desc-${item.id}`).addEventListener('input', (e) => {
        portafolioItems[index].descripcion = e.target.value;
    });

    // Agregar link
    div.querySelector(`.btn-agregar-link`).addEventListener('click', () => {
        const input = div.querySelector(`#link-input-${item.id}`);
        const url   = input.value.trim();
        if (!url) return;
        if (!url.startsWith('http')) return alert('El link debe comenzar con http:// o https://');
        portafolioItems[index].links = portafolioItems[index].links || [];
        portafolioItems[index].links.push(url);
        input.value = '';
        renderLinks(portafolioItems[index]);
    });

    // Eliminar item
    div.querySelector('.btn-eliminar-portafolio').addEventListener('click', () => {
        portafolioItems = portafolioItems.filter(p => p.id !== item.id);
        div.remove();
        // Renumerar
        document.querySelectorAll('.portafolio-item-numero').forEach((el, i) => {
            el.innerText = `Proyecto ${i + 1}`;
        });
        // Mostrar empty si no quedan items
        if (portafolioItems.length === 0) {
            const empty = document.getElementById('portafolioEmpty');
            if (empty) empty.style.display = 'block';
        }
    });
}

function renderLinks(item) {
    const chips = document.getElementById(`chips-${item.id}`);
    if (!chips) return;
    chips.innerHTML = '';
    (item.links || []).forEach((url, i) => {
        const chip = document.createElement('a');
        chip.href      = url;
        chip.target    = '_blank';
        chip.className = 'link-chip';
        const domain = (() => { try { return new URL(url).hostname.replace('www.',''); } catch { return url; } })();
        chip.innerHTML = `🔗 ${domain} <span class="link-chip-remove" data-index="${i}">✕</span>`;
        chip.querySelector('.link-chip-remove').addEventListener('click', (e) => {
            e.preventDefault();
            item.links.splice(i, 1);
            renderLinks(item);
        });
        chips.appendChild(chip);
    });
}


// ─── MOSTRAR ERROR ────────────────────────────────────────────────────────
function mostrarError(msg) {
    const el = document.getElementById('errorMsg');
    el.innerText = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 4000);
}