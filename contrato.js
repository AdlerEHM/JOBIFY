import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore, doc, getDoc, updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAReLeJ4fIMhjmTQMy6fgOpkEn9ebspjTU",
    authDomain: "jobify-392f2.firebaseapp.com",
    projectId: "jobify-392f2",
    storageBucket: "jobify-392f2.firebasestorage.app",
    messagingSenderId: "508357161570",
    appId: "1:508357161570:web:3137bb4e917e2e0552173b"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const urlParams    = new URLSearchParams(window.location.search);
const postulacionId = urlParams.get('postulacionId');

if (!postulacionId) {
    alert("Contrato no encontrado.");
    window.location.href = "dashboard.html";
}

let postulacionData = null;
let proyectoData    = null;
let empresaData     = null;
let programadorData = null;
let usuarioActual   = null;
let rolActual       = null;

const modalidadesPago = {
    'por-entrega': 'Por cada entrega / hito',
    'periodico':   'Por fecha (15 o 30 días)',
    'unico':       'Pago único al finalizar'
};

function formatFecha(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

function generarFolio(id) {
    return 'JOB-' + id.substring(0, 8).toUpperCase();
}

// ─── INICIO ───
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    usuarioActual = user;

    // Cargar postulación
    const postuSnap = await getDoc(doc(db, "postulaciones", postulacionId));
    if (!postuSnap.exists()) {
        alert("Postulación no encontrada.");
        window.location.href = "dashboard.html";
        return;
    }
    postulacionData = postuSnap.data();

    // Verificar acceso
    if (user.uid !== postulacionData.empresaId && user.uid !== postulacionData.programadorId) {
        alert("No tienes acceso a este contrato.");
        window.location.href = "dashboard.html";
        return;
    }

    // Cargar proyecto
    const proySnap = await getDoc(doc(db, "proyectos", postulacionData.proyectoId));
    proyectoData = proySnap.exists() ? proySnap.data() : {};

    // Cargar datos de empresa y programador
    const [empSnap, progSnap] = await Promise.all([
        getDoc(doc(db, "usuarios", postulacionData.empresaId)),
        getDoc(doc(db, "usuarios", postulacionData.programadorId))
    ]);
    empresaData     = empSnap.exists()  ? empSnap.data()  : {};
    programadorData = progSnap.exists() ? progSnap.data() : {};

    // Rol del usuario actual
    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    rolActual = userSnap.data()?.rol;

    // Badge de rol
    const badge = document.getElementById('roleBadge');
    badge.innerText = rolActual;
    badge.className = 'role-badge ' + (rolActual === 'Programador' ? 'prog' : 'emp');

    // Renderizar documento
    renderizarContrato();

    // Escuchar cambios en tiempo real (para cuando la otra parte firma)
    onSnapshot(doc(db, "postulaciones", postulacionId), (snap) => {
        if (snap.exists()) {
            postulacionData = snap.data();
            actualizarEstadoFirmas();
        }
    });

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('mainContent').style.display  = 'block';
});

// ─── RENDERIZAR CONTRATO ───
function renderizarContrato() {
    // Folio
    document.getElementById('docFolio').innerText = generarFolio(postulacionId);

    // Partes
    document.getElementById('empresaNombre').innerText     = empresaData.nombre     || '-';
    document.getElementById('empresaEmail').innerText      = empresaData.email      || '-';
    document.getElementById('programadorNombre').innerText = programadorData.nombre || '-';
    document.getElementById('programadorEmail').innerText  = programadorData.email  || '-';
    document.getElementById('fechaAceptacion').innerText   = formatFecha(postulacionData.fecha);

    // Proyecto
    document.getElementById('proyTitulo').innerText    = proyectoData.titulo       || '-';
    document.getElementById('proyDesc').innerText      = proyectoData.descripcion  || '-';
    document.getElementById('proyNivel').innerText     = proyectoData.nivel        || '-';
    document.getElementById('proyTags').innerText      = proyectoData.tags?.join(', ') || '-';
    document.getElementById('proyCategoria').innerText = proyectoData.categoria    || '-';
    document.getElementById('proyTipo').innerText      = proyectoData.tipoProyecto?.join(', ') || '-';

    // Términos
    document.getElementById('proyPresupuesto').innerText = `$${proyectoData.presupuesto || '-'} USD`;
    document.getElementById('proyDuracion').innerText    = `${proyectoData.duracionSemanas || '-'} semanas`;
    document.getElementById('proyEntrega').innerText     = proyectoData.modalidadEntrega
        ? proyectoData.modalidadEntrega.charAt(0).toUpperCase() + proyectoData.modalidadEntrega.slice(1)
        : '-';
    document.getElementById('proyPago').innerText = modalidadesPago[proyectoData.modalidadPago] || proyectoData.modalidadPago || '-';

    // Nombres en firmas
    document.getElementById('firmaEmpresaNombre').innerText     = empresaData.nombre     || '-';
    document.getElementById('firmaProgramadorNombre').innerText = programadorData.nombre || '-';

    // Nombres en panel lateral
    document.getElementById('statusEmpresaNombre').innerText = empresaData.nombre     || 'Empresa';
    document.getElementById('statusProgNombre').innerText    = programadorData.nombre || 'Programador';

    // Resumen lateral
    document.getElementById('resumenPresupuesto').innerText = `$${proyectoData.presupuesto || '-'} USD`;
    document.getElementById('resumenDuracion').innerText    = `${proyectoData.duracionSemanas || '-'} semanas`;
    document.getElementById('resumenNivel').innerText       = proyectoData.nivel || '-';
    document.getElementById('resumenPago').innerText        = modalidadesPago[proyectoData.modalidadPago] || '-';

    // Estado inicial de firmas
    actualizarEstadoFirmas();

    // Botón descargar PDF
    document.getElementById('btnDescargarPDF').onclick = generarPDF;
}

// ─── ESTADO DE FIRMAS ───
function actualizarEstadoFirmas() {
    const firmadoEmpresa      = !!postulacionData.contratoFirmadoEmpresa;
    const firmadoProgramador  = !!postulacionData.contratoFirmadoProgramador;
    const ambosFirmaron       = firmadoEmpresa && firmadoProgramador;

    const esEmpresa     = usuarioActual.uid === postulacionData.empresaId;
    const yoFirme       = esEmpresa ? firmadoEmpresa : firmadoProgramador;

    // ── Firmas en el documento ──
    // Empresa
    const firmaEmpBox = document.getElementById('firmaEmpresaBox');
    const firmaEmpEst = document.getElementById('firmaEmpresaEstado');
    const firmaEmpFec = document.getElementById('firmaEmpresaFecha');
    if (firmadoEmpresa) {
        firmaEmpBox.classList.add('firmado');
        firmaEmpEst.innerText = '✅ Firmado digitalmente';
        firmaEmpFec.innerText = formatFecha(postulacionData.fechaFirmaEmpresa);
    }

    // Programador
    const firmaProgBox = document.getElementById('firmaProgramadorBox');
    const firmaProgEst = document.getElementById('firmaProgramadorEstado');
    const firmaProgFec = document.getElementById('firmaProgramadorFecha');
    if (firmadoProgramador) {
        firmaProgBox.classList.add('firmado');
        firmaProgEst.innerText = '✅ Firmado digitalmente';
        firmaProgFec.innerText = formatFecha(postulacionData.fechaFirmaProgramador);
    }

    // ── Estado en panel lateral ──
    const statusEmp  = document.getElementById('statusEmpresa');
    const statusProg = document.getElementById('statusProgramador');

    if (firmadoEmpresa) {
        statusEmp.classList.add('firmado');
        statusEmp.querySelector('.status-icon').innerText  = '✅';
        statusEmp.querySelector('.status-label').innerText = 'Firmado';
    }
    if (firmadoProgramador) {
        statusProg.classList.add('firmado');
        statusProg.querySelector('.status-icon').innerText  = '✅';
        statusProg.querySelector('.status-label').innerText = 'Firmado';
    }

    // ── Mostrar panel correcto ──
    const panelFirmar    = document.getElementById('panelFirmar');
    const panelYaFirmado = document.getElementById('panelYaFirmado');
    const panelCompleto  = document.getElementById('panelCompleto');

    panelFirmar.style.display    = 'none';
    panelYaFirmado.style.display = 'none';
    panelCompleto.style.display  = 'none';

    if (ambosFirmaron) {
        panelCompleto.style.display = 'block';
        document.getElementById('btnIrWorkspace').onclick = () => {
            window.location.href = `workspace.html?postulacionId=${postulacionId}`;
        };
    } else if (yoFirme) {
        panelYaFirmado.style.display = 'block';
    } else {
        panelFirmar.style.display = 'block';
        document.getElementById('btnFirmar').onclick = firmarContrato;
    }
}

// ─── FIRMAR CONTRATO ───
async function firmarContrato() {
    const btn = document.getElementById('btnFirmar');
    btn.innerText  = 'Firmando...';
    btn.disabled   = true;

    const esEmpresa = usuarioActual.uid === postulacionData.empresaId;
    const ahora     = new Date().toISOString();

    try {
        if (esEmpresa) {
            await updateDoc(doc(db, "postulaciones", postulacionId), {
                contratoFirmadoEmpresa: true,
                fechaFirmaEmpresa: ahora
            });
        } else {
            await updateDoc(doc(db, "postulaciones", postulacionId), {
                contratoFirmadoProgramador: true,
                fechaFirmaProgramador: ahora,
                fechaInicio: ahora  // Registrar inicio del proyecto
            });
        }
        // onSnapshot detectará el cambio y actualizará la UI automáticamente
    } catch (error) {
        alert("Error al firmar: " + error.message);
        btn.innerText = '✍️ Aceptar y Firmar';
        btn.disabled  = false;
    }
}

// ─── GENERAR PDF ───
function generarPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const margenIzq = 20;
    const margenDer = 190;
    const ancho     = margenDer - margenIzq;
    let y           = 20;

    function linea() { y += 6; }
    function salto() { y += 10; }

    function titulo(texto) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(30, 30, 30);
        pdf.text(texto, margenIzq, y);
        y += 8;
    }

    function seccion(texto) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(79, 70, 229);
        pdf.text(texto.toUpperCase(), margenIzq, y);
        pdf.setDrawColor(79, 70, 229);
        pdf.line(margenIzq, y + 1, margenDer, y + 1);
        y += 8;
    }

    function campo(etiqueta, valor) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(120, 120, 120);
        pdf.text(etiqueta.toUpperCase(), margenIzq, y);
        y += 4;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(30, 30, 30);
        const lineas = pdf.splitTextToSize(valor, ancho);
        pdf.text(lineas, margenIzq, y);
        y += lineas.length * 5 + 4;
    }

    function campoDoble(etq1, val1, etq2, val2) {
        const mitad = margenIzq + ancho / 2;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(120, 120, 120);
        pdf.text(etq1.toUpperCase(), margenIzq, y);
        pdf.text(etq2.toUpperCase(), mitad, y);
        y += 4;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(30, 30, 30);
        pdf.text(val1 || '-', margenIzq, y);
        pdf.text(val2 || '-', mitad, y);
        y += 8;
    }

    function lista(items) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(50, 50, 50);
        items.forEach(item => {
            const lineas = pdf.splitTextToSize(`• ${item}`, ancho - 4);
            pdf.text(lineas, margenIzq + 2, y);
            y += lineas.length * 5 + 2;
        });
        y += 2;
    }

    function parrafo(texto) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(50, 50, 50);
        const lineas = pdf.splitTextToSize(texto, ancho);
        pdf.text(lineas, margenIzq, y);
        y += lineas.length * 5 + 4;
    }

    function nuevaPagina() {
        pdf.addPage();
        y = 20;
    }

    function verificarSalto(espacio = 30) {
        if (y + espacio > 270) nuevaPagina();
    }

    // ── ENCABEZADO ──
    pdf.setFillColor(30, 41, 59);
    pdf.rect(0, 0, 210, 28, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(255, 255, 255);
    pdf.text('JOBIFY', 20, 12);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Contrato de Servicios de Desarrollo', 20, 20);
    pdf.setFontSize(9);
    pdf.text(`Folio: ${generarFolio(postulacionId)}`, 150, 20);
    y = 38;

    // ── SECCIÓN 1 ──
    seccion('1. Identificación de las Partes');
    campoDoble('Empresa contratante', empresaData.nombre, 'Programador contratado', programadorData.nombre);
    campoDoble('Correo empresa', empresaData.email, 'Correo programador', programadorData.email);
    campo('Fecha de aceptación', formatFecha(postulacionData.fecha));
    salto();

    // ── SECCIÓN 2 ──
    verificarSalto(40);
    seccion('2. Descripción del Proyecto');
    campo('Título', proyectoData.titulo || '-');
    campo('Descripción', proyectoData.descripcion || '-');
    campoDoble('Nivel requerido', proyectoData.nivel, 'Categoría', proyectoData.categoria);
    campo('Tecnologías', proyectoData.tags?.join(', ') || '-');
    campo('Tipo de proyecto', proyectoData.tipoProyecto?.join(', ') || '-');
    salto();

    // ── SECCIÓN 3 ──
    verificarSalto(30);
    seccion('3. Términos Económicos y de Entrega');
    campoDoble('Presupuesto acordado', `$${proyectoData.presupuesto} USD`, 'Duración estimada', `${proyectoData.duracionSemanas} semanas`);
    campoDoble('Modalidad de revisión', proyectoData.modalidadEntrega, 'Modalidad de pago', modalidadesPago[proyectoData.modalidadPago] || '-');
    salto();

    // ── SECCIÓN 4 ──
    verificarSalto(50);
    seccion('4. Obligaciones del Programador');
    lista([
        'Respetar el cronograma y fechas de entrega establecidas.',
        'Mantener comunicación fluida con la empresa a través de la plataforma.',
        'Garantizar la funcionalidad básica del sistema entregado.',
        'Responder a cambios menores razonables solicitados por la empresa.',
        'Responder al chat dentro de las 48 horas posteriores al inicio del proyecto.'
    ]);
    salto();

    // ── SECCIÓN 5 ──
    verificarSalto(40);
    seccion('5. Obligaciones de la Empresa');
    lista([
        'Realizar los pagos en los tiempos y modalidades acordadas.',
        'Proporcionar retroalimentación clara y oportuna sobre las entregas.',
        'Respetar los tiempos de desarrollo establecidos en el cronograma.',
        'Calificar al programador dentro de los 7 días posteriores a la entrega final.'
    ]);
    salto();

    // ── SECCIÓN 6 ──
    verificarSalto(30);
    seccion('6. Confidencialidad');
    parrafo('Ambas partes se comprometen a no compartir información, código o documentación del proyecto sin autorización expresa de la otra parte.');
    salto();

    // ── SECCIÓN 7 ──
    verificarSalto(50);
    seccion('7. Sanciones por Incumplimiento');
    lista([
        'La empresa será penalizada con un 7% sobre el valor del proyecto si no paga o no califica en los tiempos acordados.',
        'El programador podrá ser inhabilitado temporalmente (1 mes) tras acumular incumplimientos injustificados.',
        'Se establece una tolerancia de dos incumplimientos justificables antes de aplicar sanciones.',
        'La comisión de Jobify es de 3.95% + $4 MXN por transacción.'
    ]);
    salto();

    // ── FIRMAS ──
    verificarSalto(60);
    seccion('8. Firmas Digitales');
    y += 6;

    const mitad = margenIzq + ancho / 2;

    // Caja empresa
    pdf.setDrawColor(200, 200, 200);
    pdf.setFillColor(postulacionData.contratoFirmadoEmpresa ? 240 : 250, postulacionData.contratoFirmadoEmpresa ? 253 : 250, postulacionData.contratoFirmadoEmpresa ? 244 : 250);
    pdf.roundedRect(margenIzq, y, ancho / 2 - 5, 35, 3, 3, 'FD');

    // Caja programador
    pdf.setFillColor(postulacionData.contratoFirmadoProgramador ? 240 : 250, postulacionData.contratoFirmadoProgramador ? 253 : 250, postulacionData.contratoFirmadoProgramador ? 244 : 250);
    pdf.roundedRect(mitad + 5, y, ancho / 2 - 5, 35, 3, 3, 'FD');

    const yFirma = y + 10;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(30, 30, 30);
    pdf.text(empresaData.nombre || 'Empresa', margenIzq + 5, yFirma);
    pdf.text(programadorData.nombre || 'Programador', mitad + 10, yFirma);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Empresa contratante', margenIzq + 5, yFirma + 6);
    pdf.text('Programador contratado', mitad + 10, yFirma + 6);

    pdf.setFontSize(9);
    if (postulacionData.contratoFirmadoEmpresa) {
        pdf.setTextColor(16, 185, 129);
        pdf.text('✓ Firmado digitalmente', margenIzq + 5, yFirma + 14);
        pdf.setTextColor(150, 150, 150);
        pdf.text(formatFecha(postulacionData.fechaFirmaEmpresa), margenIzq + 5, yFirma + 20);
    } else {
        pdf.setTextColor(200, 150, 0);
        pdf.text('Pendiente de firma', margenIzq + 5, yFirma + 14);
    }

    if (postulacionData.contratoFirmadoProgramador) {
        pdf.setTextColor(16, 185, 129);
        pdf.text('✓ Firmado digitalmente', mitad + 10, yFirma + 14);
        pdf.setTextColor(150, 150, 150);
        pdf.text(formatFecha(postulacionData.fechaFirmaProgramador), mitad + 10, yFirma + 20);
    } else {
        pdf.setTextColor(200, 150, 0);
        pdf.text('Pendiente de firma', mitad + 10, yFirma + 14);
    }

    // ── PIE DE PÁGINA ──
    const totalPaginas = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPaginas; i++) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(180, 180, 180);
        pdf.text(`Jobify — Plataforma de conexión entre empresas y programadores`, margenIzq, 290);
        pdf.text(`Página ${i} de ${totalPaginas}`, 170, 290);
    }

    pdf.save(`Contrato_Jobify_${generarFolio(postulacionId)}.pdf`);
}