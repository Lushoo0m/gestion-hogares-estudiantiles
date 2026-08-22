// Backend mínimo para correr esta app en el servidor dedicado (Coolify).
// Node puro (solo módulos nativos, cero dependencias de npm), mismo patrón
// que "Calendario de Limpieza": sirve los archivos estáticos de siempre y
// expone una API chica para que el servidor sea la única fuente de verdad
// de los datos, en vez de que cada navegador tenga su copia en localStorage.
//
// Todo protegido con HTTP Basic Auth de dos niveles (admin / invitado). Los
// códigos se generan solos la primera vez que arranca y quedan en DATA_DIR.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PORT = Number(process.env.PORT) || 3000;

const STATE_FILE = path.join(DATA_DIR, 'state.json');
const ACCESS_CODE_FILE = path.join(DATA_DIR, 'access-code.txt');
const GUEST_CODE_FILE = path.join(DATA_DIR, 'guest-code.txt');

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB: de sobra para el estado de esta app
const MAX_INTENTOS_FALLIDOS = 5;
const VENTANA_BLOQUEO_MS = 15 * 60 * 1000; // 15 minutos

// -------------------------------------------------------------------------
// Bootstrap: carpeta de datos, códigos de acceso y semilla inicial
// -------------------------------------------------------------------------

function asegurarDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function generarCodigo() {
  return crypto.randomBytes(9).toString('base64url'); // ~12 caracteres, sin ambigüedad de padding
}

function asegurarCodigo(archivo, etiqueta) {
  if (fs.existsSync(archivo)) {
    return fs.readFileSync(archivo, 'utf8').trim();
  }
  const codigo = generarCodigo();
  fs.writeFileSync(archivo, codigo, 'utf8');
  console.log(`[auth] Código de ${etiqueta} generado (primera vez): ${codigo}`);
  console.log(`[auth] Guardado en: ${archivo}`);
  return codigo;
}

function asegurarEstadoInicial() {
  if (fs.existsSync(STATE_FILE)) return;
  // Todavía no hay estado persistido: se arranca con la semilla histórica
  // real de Colonia que ya vivía hardcodeada en js/data.js, para no perder
  // ese histórico. A partir de acá el archivo manda, nunca más el código
  // fuente (ver PASO 5 del prompt de migración: SEED_STATE se saca del
  // código una vez confirmado que esto ya quedó persistido).
  const { SEED_STATE } = require('./js/data.js');
  const semilla = JSON.parse(JSON.stringify(SEED_STATE));
  escribirEstadoAtomico(semilla);
  console.log(`[estado] Sin state.json previo: se inicializó con la semilla histórica de Colonia en ${STATE_FILE}`);
}

function escribirEstadoAtomico(estado) {
  // Escritura atómica (temp + rename) para no dejar un state.json a medio
  // escribir si el proceso se corta justo en el medio de un guardado.
  const tmp = `${STATE_FILE}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(estado, null, 2), 'utf8');
  fs.renameSync(tmp, STATE_FILE);
}

// -------------------------------------------------------------------------
// Autenticación: HTTP Basic con dos niveles + bloqueo por IP
// -------------------------------------------------------------------------

const intentosFallidos = new Map(); // ip -> { conteo, bloqueadoHasta }

function ipDeLaRequest(req) {
  return req.socket.remoteAddress || 'desconocida';
}

function estaBloqueada(ip) {
  const registro = intentosFallidos.get(ip);
  return !!(registro && registro.bloqueadoHasta && Date.now() < registro.bloqueadoHasta);
}

function segundosRestantesDeBloqueo(ip) {
  const registro = intentosFallidos.get(ip);
  if (!registro || !registro.bloqueadoHasta) return 0;
  return Math.max(0, Math.ceil((registro.bloqueadoHasta - Date.now()) / 1000));
}

function registrarIntentoFallido(ip) {
  const registro = intentosFallidos.get(ip) || { conteo: 0, bloqueadoHasta: null };
  registro.conteo += 1;
  if (registro.conteo >= MAX_INTENTOS_FALLIDOS) {
    registro.bloqueadoHasta = Date.now() + VENTANA_BLOQUEO_MS;
    registro.conteo = 0;
    console.warn(`[auth] IP ${ip} bloqueada ${VENTANA_BLOQUEO_MS / 60000} minutos por intentos fallidos repetidos.`);
  }
  intentosFallidos.set(ip, registro);
}

function registrarIntentoExitoso(ip) {
  intentosFallidos.delete(ip);
}

// Comparación a tiempo constante que tolera longitudes distintas (evita
// filtrar por timing si el código ingresado tiene otro largo que el real).
function compararSeguro(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length)); // igual costo, resultado descartado
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Devuelve 'admin' | 'invitado' | null. null = credenciales ausentes o
// incorrectas (el caller decide qué código de error corresponde).
function autenticar(req, codigos) {
  const header = req.headers.authorization || '';
  const [esquema, valor] = header.split(' ');
  if (esquema !== 'Basic' || !valor) return null;

  let decodificado;
  try {
    decodificado = Buffer.from(valor, 'base64').toString('utf8');
  } catch (e) {
    return null;
  }
  const idx = decodificado.indexOf(':');
  const clave = idx === -1 ? decodificado : decodificado.slice(idx + 1);
  if (!clave) return null;

  if (compararSeguro(clave, codigos.access)) return 'admin';
  if (compararSeguro(clave, codigos.guest)) return 'invitado';
  return null;
}

function pedirCredenciales(res) {
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Gestion Hogares Estudiantiles"',
    'Content-Type': 'text/plain; charset=utf-8',
  });
  res.end('Autenticación requerida.');
}

// -------------------------------------------------------------------------
// Archivos estáticos (allowlist explícita, nunca sirve todo el directorio)
// -------------------------------------------------------------------------

const ARCHIVOS_RAIZ = new Set(['/', '/index.html', '/manifest.json', '/sw.js']);
const CARPETAS_PERMITIDAS = ['/css/', '/js/', '/icons/'];

const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function resolverArchivoEstatico(pathname) {
  const esRaiz = ARCHIVOS_RAIZ.has(pathname);
  const enCarpetaPermitida = CARPETAS_PERMITIDAS.some((c) => pathname.startsWith(c));
  if (!esRaiz && !enCarpetaPermitida) return null;

  const rel = pathname === '/' ? '/index.html' : pathname;
  const absoluto = path.normalize(path.join(PUBLIC_DIR, rel));
  // Guarda contra path traversal: el resultado tiene que seguir dentro de
  // PUBLIC_DIR pase lo que pase con el pathname pedido.
  if (!absoluto.startsWith(PUBLIC_DIR + path.sep) && absoluto !== path.join(PUBLIC_DIR, 'index.html')) {
    return null;
  }
  if (!fs.existsSync(absoluto) || !fs.statSync(absoluto).isFile()) return null;
  return absoluto;
}

function servirArchivoEstatico(req, res, pathname) {
  const archivo = resolverArchivoEstatico(pathname);
  if (!archivo) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado.');
    return;
  }
  const ext = path.extname(archivo);
  const tipo = TIPOS_MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': tipo });
  fs.createReadStream(archivo).pipe(res);
}

// -------------------------------------------------------------------------
// API: /api/state
// -------------------------------------------------------------------------

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let recibido = 0;
    const partes = [];
    req.on('data', (chunk) => {
      recibido += chunk.length;
      if (recibido > MAX_BODY_BYTES) {
        reject(new Error('CUERPO_DEMASIADO_GRANDE'));
        req.destroy();
        return;
      }
      partes.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}

function manejarGetState(req, res) {
  if (!fs.existsSync(STATE_FILE)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Todavía no hay estado guardado.' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  fs.createReadStream(STATE_FILE).pipe(res);
}

async function manejarPostState(req, res) {
  let cuerpo;
  try {
    cuerpo = await leerCuerpo(req);
  } catch (e) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Cuerpo demasiado grande.' }));
    return;
  }

  let estado;
  try {
    estado = JSON.parse(cuerpo);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'JSON inválido.' }));
    return;
  }

  // Validación mínima: tiene que ser un objeto con la forma esperada, no
  // cualquier JSON. No se valida cada campo (eso ya lo hace el frontend
  // antes de mandar) — solo se evita persistir basura evidente.
  if (!estado || typeof estado !== 'object' || !estado.hogares || !estado.finanzas) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'El estado no tiene la forma esperada (faltan hogares/finanzas).' }));
    return;
  }

  escribirEstadoAtomico(estado);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
}

// -------------------------------------------------------------------------
// Servidor
// -------------------------------------------------------------------------

function crearServidor(codigos) {
  return http.createServer(async (req, res) => {
    const ip = ipDeLaRequest(req);
    const { pathname } = new URL(req.url, 'http://localhost');

    if (estaBloqueada(ip)) {
      res.writeHead(429, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Retry-After': String(segundosRestantesDeBloqueo(ip)),
      });
      res.end('Demasiados intentos fallidos. Probá de nuevo más tarde.');
      return;
    }

    const rol = autenticar(req, codigos);
    if (!rol) {
      registrarIntentoFallido(ip);
      pedirCredenciales(res);
      return;
    }
    registrarIntentoExitoso(ip);

    if (pathname === '/api/state') {
      if (req.method === 'GET') {
        manejarGetState(req, res);
        return;
      }
      if (req.method === 'POST') {
        if (rol !== 'admin') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Acceso de solo lectura: este código no puede guardar cambios.' }));
          return;
        }
        await manejarPostState(req, res);
        return;
      }
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Método no permitido.');
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Método no permitido.');
      return;
    }
    servirArchivoEstatico(req, res, pathname);
  });
}

function main() {
  asegurarDataDir();
  const codigos = {
    access: asegurarCodigo(ACCESS_CODE_FILE, 'ADMIN (acceso total)'),
    guest: asegurarCodigo(GUEST_CODE_FILE, 'INVITADO (solo lectura)'),
  };
  asegurarEstadoInicial();

  const servidor = crearServidor(codigos);
  servidor.listen(PORT, () => {
    console.log(`Gestión Hogares Estudiantiles escuchando en el puerto ${PORT}`);
    console.log(`DATA_DIR: ${DATA_DIR}`);
  });
}

main();
