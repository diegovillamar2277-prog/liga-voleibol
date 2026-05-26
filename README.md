# Liga Voleibol — Fase 1

## Estructura del proyecto
```
liga-app/
├── index.html          ← Entrada de la app
├── styles.css          ← Estilos globales
├── manifest.json       ← PWA manifest
├── sw.js               ← Service Worker (offline)
├── vercel.json         ← Config de Vercel
├── supabase_schema.sql ← Ejecutar en Supabase SQL Editor
├── icons/              ← Íconos de la app (reemplazar con PNG reales)
└── src/
    ├── main.js         ← Router principal
    ├── auth/
    │   ├── auth.js     ← Lógica de sesión y roles
    │   └── auth-ui.js  ← Pantalla de login/registro
    ├── admin/
    │   └── admin.js    ← Panel de administrador
    ├── liga/
    │   ├── liga-dashboard.js  ← Panel del organizador
    │   └── public-view.js     ← Vista pública por código
    └── lib/
        ├── supabase.js ← Cliente Supabase
        ├── db.js       ← Todas las consultas a BD
        └── ui.js       ← Toast, helpers de UI
```

---

## Pasos para subir a Vercel

### 1. Supabase — ejecutar el schema
- Ve a tu proyecto Supabase → SQL Editor
- Copia el contenido de `supabase_schema.sql` y presiona Run

### 2. Crear iconos reales (opcional pero recomendado)
Reemplaza `icons/icon-192.png` e `icons/icon-512.png` con imágenes PNG reales.
Puedes generarlos gratis en https://realfavicongenerator.net

### 3. Subir a Vercel
**Opción A — Arrastrando la carpeta:**
1. Ve a https://vercel.com
2. "Add New Project" → arrastra la carpeta `liga-app`
3. No necesitas configurar nada más (vercel.json ya lo hace)
4. Click en Deploy

**Opción B — GitHub (recomendado para actualizaciones futuras):**
1. Sube la carpeta a un repo en GitHub
2. En Vercel conecta el repo
3. Cada push actualiza la app automáticamente

### 4. Crear tu cuenta de admin
1. Abre la app en Vercel
2. Ve a "Iniciar sesión" → "Registrarse"
3. Regístrate con `diegovillamar2277@gmail.com`
4. Supabase te asignará automáticamente el rol `superadmin`

---

## Flujo de la app

| Usuario | Cómo entra | Qué ve |
|---|---|---|
| Espectador | Link `tuapp.vercel.app/?liga=VOL-2K7` o código manual | Tabla, resultados, fixture |
| Organizador | Login con correo | Sus ligas, equipos, partidos, finanzas, config |
| Admin/Superadmin | Login con correo | Todo lo anterior + panel de usuarios y todas las ligas |

---

## Roles
- **superadmin** → Solo `diegovillamar2277@gmail.com`. Puede promover a otros a admin.
- **admin** → Gestiona usuarios y ligas desde el panel.
- **organizador** → Crea y gestiona sus propias ligas (máximo 2 sin petición).

---

## Notas importantes
- Los íconos `icon-192.png` y `icon-512.png` son necesarios para instalar la PWA.
  Sin ellos la app funciona igual pero no se puede instalar en el celular.
- El código de liga tiene formato `ABC-123` y se puede renovar desde Configuración.
- Los organizadores pueden invitar co-admins por correo desde Configuración → Co-administradores.
