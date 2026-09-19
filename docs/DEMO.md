# Demo en vivo — Passport Agent Protocol

> Duración objetivo: **75 segundos** de demo dentro del pitch de 3 min. Ensayar mínimo 3 veces el domingo antes de las 13:30.

## Qué se ve en pantalla

| Pantalla | Qué muestra |
|---|---|
| Laptop (proyector) | Terminal con Claude Code a fuente grande (>= 18 pt) + pestaña del explorer de HashKey testnet |
| iPhone (espejado con QuickTime / cámara del laptop apuntando) | PWA `pap.devcristobalvc.com` |

Si no hay forma de espejar el iPhone: apuntar la cámara del laptop al teléfono y dejar la ventana de la cámara en un cuarto de la pantalla.

---

## Checklist previo (Sun 12:30, antes de subir)

- [ ] Laptop cargado, modo "no molestar", brillo al máximo, fuente de terminal grande, tema claro
- [ ] iPhone cargado, brillo al máximo, modo avión **apagado**, datos móviles activos (no depender del wifi de ICESI)
- [ ] PWA instalada en el iPhone (Safari → Compartir → Añadir a inicio), passkey creada, sesión abierta
- [ ] Dirección del teléfono tiene **HSK para gas** (faucet el sábado, 0.01 HSK/día) y **demoUSDT** (`faucet()`)
- [ ] `pap_connect` hecho el sábado: agente registrado en `IdentityRegistry` desde el teléfono (teléfono = owner) y `grant(transfer:demoUSDT, límite 100)` — nada de esto el domingo
- [ ] Relay desplegado en Vercel y respondiendo (`curl https://pap.devcristobalvc.com/api/health`)
- [ ] MCP `pap` cargado desde `.mcp.json` en la raíz del repo (`claude mcp list` → `pap … Connected`), `PAP_RELAY_URL` apuntando a producción, `~/.pap/agent.json` presente
- [ ] Explorer abierto en la dirección del contrato `AgentPassport` (pestaña lista, ya cargada)
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
Paga 5 demoUSDT al oráculo 0x<ORACLE_ADDR> por la consulta de precio.
```

Claude decide llamar `pap_transfer`. Narrar: *"El agente no puede pagar. Lo único que puede hacer es pedir permiso."*

### 3. QR en terminal (5 s)
Aparece el QR ASCII + link `/show/:id` (abrirlo en el laptop si el QR de la terminal se ve mal en el proyector). Narrar: *"Esto va a mi teléfono."*

### 4. Aprobación en iPhone (20 s)
Escanear el QR con la cámara → abre la PWA en `/approve/:id`:

> **Claude Code** quiere enviar **5 demoUSDT** a `0x…abcd`
> Visa: `transfer:demoUSDT` · límite 100 · usado 0
> [ Aprobar ] [ Rechazar ]

Narrar: *"Veo exactamente qué quiere hacer, en lenguaje humano, y el límite que yo le puse."*
Tocar **Aprobar** → FaceID → el teléfono firma y envía la tx a HashKey → "Enviado ✓ + hash".

### 5. El agente continúa (15 s)
Volver al laptop: Claude recibió `{txHash, explorerUrl}` y sigue: *"Pago enviado, aquí está el link."*
Clic en el link → pestaña del explorer con la tx confirmada (HashKey testnet confirma en ~2 s).

Narrar: *"Humano en el loop, 15 segundos, desde el celular. El agente nunca tocó una llave."*

### 6. Lo que quedó on-chain (15 s)
Cambiar a la pestaña del contrato `AgentPassport` en el explorer → eventos `PermissionGranted` y `ActionRecorded` (y en `IdentityRegistry` el `Registered` con owner = teléfono).
Narrar: *"Cualquier servicio puede verificar que este agente está autorizado por un humano real, con alcance y límite, sin saber quién es el humano. Compliant but private."*

→ Volver al guion del pitch (roadmap y cierre).

---

## Plan B — video (si algo falla)

Grabar el sábado en la noche, cuando el flujo funcione end-to-end por primera vez.

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
| Teléfono firma pero tx revierte | `canAct` false (límite agotado / grant expirado) | `revoke` + `grant` de nuevo desde el teléfono; verificar `getGrant` en el explorer |
| "insufficient funds" en el teléfono | Sin HSK para gas | Faucet ya no da más ese día → usar la dirección de respaldo (fondearla el sábado) |
| Tx enviada pero Claude sigue esperando | Poll (hasta 5 min) / relay no recibió `resolve` | Mostrar el hash desde el teléfono en el explorer; explicar que el agente reintenta |
| Wifi de ICESI caído | — | Hotspot del celular al laptop; el teléfono ya va por datos |

---

## Después de la demo

- Anotar preguntas del jurado que no estén en `PITCH.md`
- Subir el video *unlisted* + link del explorer a la submission de Devfolio antes de las 13:30 si aún no está
- Compartir el link del repo en el Telegram del evento
