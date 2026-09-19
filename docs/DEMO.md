# Demo en vivo — Passport Agent Protocol

> Duración objetivo: **75 segundos** de demo dentro del pitch de 3 min. Ensayar mínimo 3 veces el domingo antes de las 13:30.

## Qué se ve en pantalla

| Pantalla | Qué muestra |
|---|---|
| Laptop (proyector) | Terminal con Claude Code a fuente grande (>= 18 pt) + pestaña `/show/request/:id` (QR grande, el MCP la abre solo) + pestaña del explorer `testnet-explorer.hskchain.net` |
| iPhone (espejado con QuickTime / cámara del laptop apuntando) | PWA `pap.devcristobalvc.com` |

Si no hay forma de espejar el iPhone: apuntar la cámara del laptop al teléfono y dejar la ventana de la cámara en un cuarto de la pantalla.

---

## Checklist previo (Sun 12:30, antes de subir)

- [ ] Laptop cargado, modo "no molestar", brillo al máximo, fuente de terminal grande, tema claro
- [ ] iPhone cargado, brillo al máximo, modo avión **apagado**, datos móviles activos (no depender del wifi de ICESI)
- [ ] PWA instalada en el iPhone (Safari → Compartir → Añadir a inicio), passkey creada, sesión abierta
- [ ] Dirección del teléfono tiene **HSK para gas** (`/api/fund` da 0.002 HSK al crear la wallet; si se acabó, faucet https://hskchain.net/faucet) y **demoUSDT** (el onboarding llama `faucet()` = 1000)
- [ ] `pap_connect` hecho el sábado: onboarding de 4 txs desde el teléfono (`register` → `faucet` → `approve` → `grant` con límite 100) — nada de esto el domingo. Verificar con `pap_status`
- [ ] Relay desplegado en Vercel y respondiendo (`curl https://pap.devcristobalvc.com/api/health`)
- [ ] MCP `pap` cargado desde `.mcp.json` en la raíz del repo (`claude mcp list` → `pap … Connected`), `~/.pap/agent.json` presente
- [ ] Contacto `oracle` agregado (`pap_contact_add`) para poder decir "paga 5 demoUSDT a oracle"
- [ ] `pap_call_gate` probado una vez contra producción (remate B)
- [ ] Explorer abierto en `AgentPassport` `0xCE112FD67B0E19a2eeD894dDD3a5B445989A6e7B` (pestaña lista, ya cargada)
- [ ] Simulador de teléfono listo en otra terminal (`node web/scripts/phone-sim.mjs`) — plan B si el iPhone falla en vivo
- [ ] Video plan B descargado **localmente** (no depender de YouTube/wifi), abierto en un reproductor en pausa
- [ ] Hotspot del celular listo como respaldo de internet del laptop
- [ ] Una segunda persona del equipo con el repo abierto por si hay que mostrar código en Q&A

---

## Paso a paso (con quién hace qué)

**Narra: Cristóbal · Teclado: Juan · Teléfono: Cristóbal (o William)**

### 1. Contexto (10 s)
Terminal ya abierta con Claude Code en el repo. Decir: *"Esto es Claude Code, un agente real, sin ninguna llave privada configurada."*

Opcional: mostrar `cat .env` → no hay `PRIVATE_KEY`. Es un detalle que los jueces técnicos valoran.

### 2. Petición al agente (10 s)
Juan escribe en Claude Code:

```
Paga 5 demoUSDT a oracle por la consulta de precio.
```
(`oracle` es un contacto de `pap_contact_add`; también vale la dirección 0x)

Claude decide llamar `pap_transfer`. Narrar: *"El agente no puede pagar. Lo único que puede hacer es pedir permiso."*

### 3. QR en terminal (5 s)
Aparece el QR ASCII en la terminal y el MCP abre `/show/request/:id` en el browser (QR grande, usar esa para el proyector). Narrar: *"Esto va a mi teléfono."*

### 4. Aprobación en iPhone (20 s)
Escanear el QR con la cámara → abre la PWA en `/approve/:id`:

> **Claude Code** quiere enviar **5 demoUSDT** a `0x…abcd`
> Visa: `transfer:demoUSDT` · límite 100 · usado 0
> [ Aprobar ] [ Rechazar ]

Narrar: *"Veo exactamente qué quiere hacer, en lenguaje humano, y el límite que yo le puse."*
Tocar **Aprobar** → FaceID → el teléfono firma **una** tx `AgentPassport.pay()` en HashKey → "Enviado ✓ + hash".

### 5. El agente continúa (15 s)
Volver al laptop: Claude recibió `{txHash, explorerUrl}` y sigue: *"Pago enviado, aquí está el link."*
Clic en el link → pestaña del explorer con la tx confirmada (HashKey testnet confirma en ~2 s).

Narrar: *"Humano en el loop, 15 segundos, desde el celular. El agente nunca tocó una llave."*

### 6. Lo que quedó on-chain (15 s)
Cambiar a la pestaña del contrato `AgentPassport` en el explorer → eventos `PermissionGranted` y `Paid` (y en `IdentityRegistry` el `Registered` con owner = teléfono).

**Remate opcional A (10 s):** pedirle a Claude *"ahora paga 500 demoUSDT a oracle"* → aprobar en el teléfono → la tx **revierte** con `LimitExceeded()`. Narrar: *"El límite no es una regla del servidor, es del contrato."* (Ya probado: funciona.)

**Remate opcional B (10 s, iteración 2):** *"llama al oráculo protegido"* → `pap_call_gate` → en la terminal se ve `402` → challenge firmado → `200 ACCESS GRANTED`, **sin tocar el teléfono**. Narrar: *"Y cuando la visa ya existe, el agente pasa fronteras solo: 402, firma, 200. Estilo x402, sin facilitador."*
Narrar: *"Cualquier servicio puede verificar que este agente está autorizado por un humano real, con alcance y límite, sin saber quién es el humano. Compliant but private."*

→ Volver al guion del pitch (roadmap y cierre).

---

## Plan B1 — simulador de teléfono (si el iPhone falla)

`node web/scripts/phone-sim.mjs` en una terminal aparte aprueba las solicitudes como si fuera el teléfono (firma con una wallet de prueba). El flujo Claude → MCP → relay → chain se ve igual; solo se pierde la parte de FaceID. Decir: *"el teléfono no está cooperando con el wifi, les muestro el mismo flujo con el simulador — el contrato es el mismo"*.

## Plan B2 — video (si falla todo)

Grabar el sábado en la noche (el E2E ya funciona).

- **Formato:** grabación de pantalla del laptop (OBS o Win+G) con el iPhone espejado o en cámara. 60–75 s. Sin música, sin voz (se narra en vivo encima).
- **Contenido:** exactamente los pasos 2 → 6 de arriba, sin cortes.
- **Guardar en:** `docs/demo.mp4` (no subir al repo si pesa > 50 MB; dejar en el escritorio del laptop y en el teléfono) + subir a YouTube como *unlisted* para la submission de Devfolio.

**Disparadores para pasar al plan B (no dudar, decidir en 5 segundos):**
- El QR no abre la PWA o la PWA no carga en 10 s
- FaceID falla dos veces
- La tx no aparece en el explorer en 20 s
- El MCP no responde / Claude no llama la tool

Decir: *"Les muestro la grabación de esta mañana mientras la red se pone de acuerdo"* y dar play. Seguir narrando igual.

---

## Fallos conocidos y qué hacer

| Síntoma | Causa probable | Fix rápido |
|---|---|---|
| Claude no llama `pap_transfer` | MCP no conectado / `.mcp.json` no cargado | `claude mcp list`; reiniciar Claude Code desde la raíz del repo; prompt más explícito: "usa la tool pap_transfer" |
| `pap_transfer` dice que no hay agente | `~/.pap/agent.json` ausente | Correr `pap_connect` (ya debería estar hecho el sábado) |
| QR abre pero PWA dice "request not found" | Relay reiniciado (in-memory) o URL distinta | Repetir el paso 2; verificar `PAP_RELAY_URL` en el MCP |
| Teléfono firma pero tx revierte `LimitExceeded` / expirado | Límite acumulado agotado por los ensayos o grant vencido | `revoke` + `grant` de nuevo desde el teléfono (o re-hacer `pap_connect`); verificar `getGrant` en el explorer. Ensayar con montos pequeños (1–5) para no agotar los 100 |
| Teléfono sin gas | `/api/fund` ya dio sus 0.002 HSK y se gastaron | Faucet https://hskchain.net/faucet o mandar HSK desde la wallet deployer |
| "insufficient funds" en el teléfono | Sin HSK para gas | Faucet ya no da más ese día → usar la dirección de respaldo (fondearla el sábado) |
| Tx enviada pero Claude sigue esperando | Poll (hasta 5 min) / relay no recibió `resolve` | Mostrar el hash desde el teléfono en el explorer; explicar que el agente reintenta |
| Wifi de ICESI caído | — | Hotspot del celular al laptop; el teléfono ya va por datos |

---

## Después de la demo

- Anotar preguntas del jurado que no estén en `PITCH.md`
- Subir el video *unlisted* + link del explorer a la submission de Devfolio antes de las 13:30 si aún no está
- Compartir el link del repo en el Telegram del evento
