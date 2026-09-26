# PAP — Backlog: secretos con doble firma, JSON-RPC, UX y skills

Continuación de `todo.md` (hackathon). Objetivo: que el humano pueda sellar una credencial (API key, token) para su agente, y que el agente solo pueda leerla cuando **él firma la solicitud y el humano firma la aprobación** desde el teléfono. Debe funcionar con **cualquier agente**: MCP, CLI, JSON-RPC y signer EIP-1193.

## Cómo usar este documento

- Cada ticket tiene: **ID**, **título**, **épica**, **dependencias**, **estado**, **descripción**, **casos de uso**, **criterios de aceptación**, **pruebas** y **resumen post-desarrollo**.
- Estados: `to do` · `in progress` · `done` · `problem`.
- `problem` = no se pudo resolver. Es **obligatorio** escribir el motivo y qué se intentó en el resumen.
- Al cerrar un ticket se llena el **resumen post-desarrollo**: qué se hizo, decisiones, desviaciones del plan, deuda pendiente.
- Commits y PRs referencian el ID: `feat(secrets): PAP-02 relay secret storage`.
- Antes de cada commit que toque código: `npm run build` en `web/` y `mcp/`, y `forge test` en `contracts/`. El CI (`.github/workflows/ci.yml`) lo repite en cada push.

## Decisiones de diseño (base para todos los tickets)

1. **Cifrado por capas con ECIES secp256k1.** La identity key del agente (`~/.pap/agent.json`) y la llave EVM del teléfono son secp256k1, así que se cifra directo a sus llaves públicas sin crear llaves nuevas. `guardado = ECIES(teléfono, {name, agent, inner: ECIES(agente, {name, agent, secret})})`: capa externa → teléfono, capa interna → agente. *(Ajustado en PAP-01: con este orden el teléfono nunca ve el texto plano; solo quita su capa.)*
2. **Doble firma.** El agente firma la solicitud (EIP-712 `RevealRequest {agent, name, reason, nonce, expiry}`); el teléfono verifica, pide Face ID, quita su capa y firma la aprobación (EIP-712 `RevealApproval`, que liga el hash del blob entregado).
3. **El relay nunca ve texto plano** y no guarda llaves (se mantiene la promesa actual).
4. **Visa on-chain para secretos.** Scope `keccak256("secret:" + name)` en `AgentPassport`: `grant(agentId, scope, maxAccesos, expiry)`; cada revelación hace `record(agentId, scope, 1, ref)`. Límite, expiración y revocación se reutilizan sin cambiar contratos.
5. **Modelo de amenaza honesto.** Protege la *entrega*, no el *uso*: una vez revelado, el agente tiene el secreto. Se mitiga con keys de corta vida, alcance limitado y rotación.
6. **v1 solo con política "pedir siempre".** Una política automática ("1 vez por día" sin Face ID) no es posible con cifrado por capas sin que el teléfono esté en línea; queda para después (ver PAP-20).

## Resumen de tickets

| ID | Título | Épica | Depende de | Estado |
|---|---|---|---|---|
| PAP-01 | Librería de cifrado por capas (ECIES) | Secretos | — | done |
| PAP-02 | Relay: almacenamiento de secretos + request `reveal` | Secretos | PAP-01, PAP-03 | done |
| PAP-03 | Tipos EIP-712 para solicitud y aprobación | Secretos | — | done |
| PAP-04 | Teléfono: tarjeta de aprobación de secretos | Secretos / UX | PAP-02, PAP-15 | done |
| PAP-05 | MCP: tool `pap_secret` | Secretos | PAP-02 | done |
| PAP-06 | CLI: `pap seal` y `pap secret get` | Secretos | PAP-02 | done |
| PAP-07 | Visa y auditoría on-chain para secretos | Secretos | PAP-04 | done |
| PAP-08 | JSON-RPC 2.0: endpoint `/api/rpc` con namespace `pap_*` | JSON-RPC | PAP-02 | to do |
| PAP-09 | Signer local EIP-1193 (`pap rpc`) | JSON-RPC | PAP-08 | to do |
| PAP-10 | `eth_getEncryptionPublicKey` / `eth_decrypt` sobre doble firma | JSON-RPC | PAP-09 | to do |
| PAP-11 | Métodos `wallet_*` (EIP-7715, EIP-5792, capabilities) | JSON-RPC | PAP-09 | to do |
| PAP-12 | `/wallet`: pestañas Agentes · Bóveda · Sellos | UX | PAP-02, PAP-15 | done |
| PAP-13 | Notificaciones push en la PWA | UX | PAP-04 | to do |
| PAP-14 | `/vault/new`: sellar desde el navegador | UX | PAP-01, PAP-02 | done |
| PAP-15 | Mockups de aprobación y Bóveda | UX | — | done |
| PAP-16 | Skills `pap-secrets` y `pap-seal` | Skills | PAP-05, PAP-06 | done |
| PAP-17 | Skills `pap-payments`, `pap-gate`, `pap-onboarding`, `pap-rpc` | Skills | PAP-09 | to do |
| PAP-18 | Plugin de Claude Code + `docs/AGENTS.md` | Skills | PAP-16, PAP-17 | to do |
| PAP-19 | Documentación: arquitectura de secretos y modelo de amenaza | Docs | PAP-07 | to do |
| PAP-20 | Investigación: políticas automáticas sin Face ID | Secretos | PAP-07 | to do |
| PAP-21 | Referencia Hermes Agent + storyboard de la landing | Landing | — | to do |
| PAP-22 | Landing narrativa con animaciones por scroll | Landing | PAP-21 | to do |
| PAP-23 | Diagrama animado "Cómo funciona" | Landing | PAP-21 | to do |
| PAP-24 | Sección "Instálalo en tu agente" | Landing | PAP-18, PAP-21 | to do |
| PAP-25 | Sección "Crea tus credenciales" | Landing | PAP-06, PAP-14, PAP-21 | to do |
| PAP-26 | Mobile first: landing + experiencia PWA | Landing | PAP-22 | to do |
| PAP-27 | Marquee infinito de compatibilidad | Landing | PAP-22 | to do |
| PAP-28 | Rendimiento y accesibilidad de animaciones | Landing | PAP-22…27 | to do |

**Orden sugerido:** PAP-01 → PAP-03 → PAP-15 → PAP-02 → PAP-05 / PAP-06 → PAP-04 → PAP-07 → PAP-16 → PAP-08 → PAP-09 → PAP-10 / PAP-11 → PAP-12 → PAP-13 → PAP-14 → PAP-17 → PAP-18 → PAP-19 → PAP-20.

**Landing (en paralelo, otra persona):** PAP-21 → PAP-22 / PAP-23 → PAP-26 → PAP-27 → PAP-24 / PAP-25 (cuando existan plugin y CLI) → PAP-28.

---

## Épica: Secretos con doble firma

### PAP-01 — Librería de cifrado por capas (ECIES)

- **Estado:** done
- **Épica:** Secretos
- **Depende de:** —

**Descripción**
Módulo compartido (Node + navegador) con `seal(plaintext, phonePubKey, agentPubKey)`, `peelPhone(blob, phonePrivKey) → innerForAgent` y `openAgent(blob, agentPrivKey) → plaintext`. Usa ECIES secp256k1 (`eciesjs` o `@noble/curves` + AES-256-GCM + HKDF). Incluye cómo obtener la llave pública a partir de una firma (`recoverPublicKey` de viem), porque hoy el relay solo conoce direcciones.

**Casos de uso**
- El humano sella una API key para su agente desde la laptop.
- El teléfono quita su capa y re-cifra para el agente.
- El agente abre el sobre final.

**Criterios de aceptación**
- Mismo código funciona en `mcp/` (Node) y en `web/` (navegador).
- Sin la llave del teléfono no se puede quitar la capa interna; sin la del agente no se abre la externa.
- Formato de blob versionado (`v: 1`) y documentado.
- Llave pública recuperable a partir de una firma del agente y del teléfono.

**Pruebas**
- Unit: round-trip seal → peel → open.
- Unit: llave incorrecta en cada capa → error.
- Unit: blob alterado (1 byte) → error de autenticación GCM.
- Unit: `recoverPublicKey` coincide con `privateKeyToAccount(pk).publicKey`.

**Resumen post-desarrollo**
- `mcp/src/pap-core.ts` (fuente de verdad) copiado a `web/src/lib/pap-core.ts` con `node scripts/sync-core.mjs`; el CI falla si se desincronizan.
- ECIES: ECDH secp256k1 (`@noble/curves`) → HKDF-SHA256 → AES-256-GCM, todo con WebCrypto, así que corre igual en Node y en el navegador. Blob versionado `{v:1, alg, epk, iv, ct}`.
- **Cambio frente al plan:** la capa externa es la del teléfono y la interna la del agente. Así el teléfono solo quita su capa y **nunca ve el texto plano** (antes el plan era "quitar y re-cifrar").
- Agente y nombre del secreto van ligados como *additional data* de AES-GCM en las dos capas: un blob no se abre como si fuera de otro agente u otro nombre, aunque los blobs del relay sean públicos.
- Llaves públicas: `recoverPublicKey` a partir de firmas personal_sign o EIP-712 (el relay las guarda al emparejar).
- 10 tests en `mcp/test/core.test.ts` (`npm test`): round-trip, el agente solo no abre, el teléfono solo no lee, cambio de agente/nombre, un byte alterado, llaves comprimidas y sin comprimir, recuperación de llaves.

---

### PAP-02 — Relay: almacenamiento de secretos + request `reveal`

- **Estado:** done
- **Épica:** Secretos
- **Depende de:** PAP-01, PAP-03

**Descripción**
Nuevos tipos en `web/src/lib/types.ts`: `SecretRecord {name, agentAddress, ownerAddress, blob, createdAt, revokedAt?}` y `RevealAction {type: "reveal", name, reason}`. `RequestState.action` pasa a `TransferAction | RevealAction` y agrega `result?` (blob re-cifrado para el agente). Endpoints:
- `POST /api/secrets` — guarda el ciphertext, firmado por el dueño.
- `GET /api/secrets?agent=` — lista metadatos, sin blobs.
- `DELETE /api/secrets/:name` — revoca, firmado por el dueño.
- `POST /api/requests` con `action.type = "reveal"`, firmado por el agente (EIP-712).
- `POST /api/requests/:id/resolve` acepta `result` para reveals.

**Casos de uso**
- El humano sube un secreto sellado.
- El agente pide un secreto y hace polling hasta tener el blob.
- El humano revoca un secreto.

**Criterios de aceptación**
- El relay nunca recibe ni guarda texto plano.
- Solo el dueño del agente puede crear o revocar secretos de ese agente.
- Solo el agente emparejado puede pedir un reveal de sus secretos.
- Nonce y expiry validados: una firma reutilizada o vencida → rechazo.
- `GET /api/requests/:id` devuelve `result` solo cuando `status = approved`.
- Las rutas de pagos existentes no cambian de comportamiento.

**Pruebas**
- Integración (script tipo `relay-test.mjs`): seal → request → resolve → poll → open.
- Firma de un tercero → 401. Nonce repetido → 409. Expiry vencido → 400.
- Secreto revocado → reveal rechazado.
- Regresión: `mcp/scripts/e2e.mjs` sigue pasando.

**Resumen post-desarrollo**
- Rutas nuevas: `POST/GET /api/secrets`, `GET/DELETE /api/secrets/:agent/:name`, `POST /api/agents/:address/keys` (publica llaves públicas de agentes emparejados antes de esta versión). `POST /api/requests` acepta `type: "reveal"` y `resolve` acepta `result` + `approvalSig`.
- **Sellado en dos caminos:** si lo firma la llave del agente (CLI en la laptop) queda pendiente y se crea un request `seal` para el teléfono, que hace el `grant` on-chain y lo activa; si lo firma el dueño (vault web) queda activo de una.
- El relay guarda las llaves públicas del agente y del dueño al emparejar (recuperadas de las firmas) para que el sellador pueda cifrar.
- Validaciones: nombre, `reason` de 10–280 caracteres, expiración ≤ 15 min en solicitudes, nonce de un solo uso por firmante, límite de lecturas y expiración del secreto, hash del blob firmado en seal y en approval.
- `store.ts` usa un mapa en memoria si no hay `BLOB_READ_WRITE_TOKEN` fuera de producción: permite probar el relay sin red.
- Pruebas: `mcp/scripts/secrets-relay-test.ts` contra `next dev`, **27 checks** (flujo completo + replay de nonce, firmas de terceros, blob cambiado, revocación, regresión de transferencias). `web/scripts/relay-test.mjs` sigue pasando.
- Deuda: las escrituras en Vercel Blob no son atómicas; dos solicitudes simultáneas con el mismo nonce podrían pasar (aceptable en testnet).

---

### PAP-03 — Tipos EIP-712 para solicitud y aprobación

- **Estado:** done
- **Épica:** Secretos
- **Depende de:** —

**Descripción**
Definir domain `{name: "PAP", version: "1", chainId: 133, verifyingContract: AgentPassport}` y tipos `RevealRequest {agent, name, reason, nonce, expiry}` y `RevealApproval {requestId, agent, name, resultHash, expiry}`. Módulo compartido entre `mcp/` y `web/`.

**Casos de uso**
- El agente firma lo que pide; el teléfono muestra exactamente lo firmado.
- Un tercero verifica a posteriori quién pidió y quién aprobó.

**Criterios de aceptación**
- Tipos idénticos en MCP, relay y PWA (una sola fuente).
- La aprobación liga el hash del resultado: no se puede cambiar el blob sin invalidar la firma.
- Verificable con `verifyTypedData` de viem.

**Pruebas**
- Unit: firmar y verificar ambos tipos.
- Unit: cambiar `reason`, `name` o `resultHash` invalida la firma.

**Resumen post-desarrollo**
- En `pap-core.ts`: dominio `{name:"PAP", version:"1", chainId:133, verifyingContract: AgentPassport}` y tipos `RevealRequest`, `RevealApproval` (liga `resultHash` = hash del blob entregado) y `SealRequest` (nuevo: el sellador firma el hash del blob, el máximo de lecturas y la expiración).
- `typedData()`, `publicKeyFromTypedSig()` y `wire()` (bigint → string para el JSON del relay).
- Tests: firmar y recuperar; cambiar `reason`, `name`, `nonce` o `resultHash` invalida la firma.

---

### PAP-04 — Teléfono: tarjeta de aprobación de secretos

- **Estado:** done
- **Épica:** Secretos / UX
- **Depende de:** PAP-02, PAP-15

**Descripción**
Extender `web/src/app/approve/[id]/page.tsx` para `type: "reveal"`. La tarjeta muestra agente, nombre del secreto (🔑), el **reason** tal cual y los últimos accesos. Al aprobar: verifica la firma EIP-712 del agente → Face ID → `peelPhone` → re-cifra para el agente → firma `RevealApproval` → `resolve` con `result`.

**Casos de uso**
- El humano aprueba una lectura con Face ID.
- El humano rechaza porque el reason no tiene sentido (posible prompt injection).

**Criterios de aceptación**
- Mismo diseño que la tarjeta de pagos, con distinto ícono.
- Si la firma del agente no verifica → la tarjeta muestra error y no permite aprobar.
- El texto plano existe solo en memoria del teléfono durante la re-cifra; no se muestra ni se persiste.
- El rechazo resuelve el request como `rejected`.

**Pruebas**
- Manual en iPhone (Safari PWA): aprobar y rechazar.
- `phone-sim.mjs` extendido para reveals (plan B y CI).
- Firma de agente alterada → no se puede aprobar.

**Resumen post-desarrollo**
- `/approve/[id]` maneja tres tipos: 💸 pago, 🔑 lectura (muestra el **reason** en un recuadro destacado, lecturas usadas y última lectura) y 🔒 sellado (máximo de lecturas, expiración, `grant`).
- Al aprobar un reveal: Face ID → quita la capa del teléfono → `record()` on-chain (el contrato cuenta la lectura) → firma `RevealApproval` → resuelve con el blob interno. El teléfono nunca ve el texto plano.
- Si el secreto está revocado, vencido o agotado (se lee `getGrant` on-chain), el botón de aprobar se desactiva y se explica por qué.
- `lib/actions.ts` resume cualquier acción en una línea; lo usan la lista de pendientes, el historial y la pantalla del QR.
- `phone-sim.mjs` aprueba seals y reveals (`PAP_SIM_NO_CHAIN=1` para correr sin cadena).
- **Pendiente:** prueba manual en iPhone (la red de esta sesión no llega a HSK ni a producción).

---

### PAP-05 — MCP: tool `pap_secret`

- **Estado:** done
- **Épica:** Secretos
- **Depende de:** PAP-02

**Descripción**
Nueva tool en `mcp/src/index.ts`: `pap_secret({name, reason})`. Firma EIP-712, crea el request, muestra QR o link, espera hasta 5 min, abre el blob con la identity key. Devuelve el secreto al agente **sin imprimirlo en logs**. Agregar `pap_secrets_list()` para metadatos. Rebuild del bundle `mcp/dist/pap.mjs`.

**Casos de uso**
- Claude Code necesita la key de OpenAI para correr tests.
- El agente lista qué secretos tiene disponibles.

**Criterios de aceptación**
- `reason` obligatorio (mínimo 10 caracteres).
- En rechazo devuelve error claro (`User rejected`, código 4001) y no reintenta.
- La descripción de la tool incluye las reglas de uso (no imprimir, no commitear).
- El bundle se construye y funciona sin `node_modules`.

**Pruebas**
- `mcp/scripts/e2e.mjs` extendido: seal → `pap_secret` → phone-sim aprueba → valor correcto.
- Rechazo → error 4001.
- Timeout → error de expiración.

**Resumen post-desarrollo**
- Tools nuevas en `mcp/src/index.ts`: `pap_secret({name, reason, deliver?})` y `pap_secrets_list()`; `pap_wait` acepta `kind: "secret"`. Lógica compartida con la CLI en `mcp/src/secrets.ts`.
- **Mejora frente al plan:** por defecto (`deliver: "file"`) el valor se escribe en `~/.pap/secrets/<name>` (0600) y la tool devuelve solo la ruta: **el secreto no entra en la conversación del modelo**, lo que reduce filtraciones por prompt injection o transcripts. `deliver: "inline"` existe como opción explícita.
- La descripción de la tool incluye las tres reglas de oro y dice que nunca se le pida al humano pegar un secreto en el chat.
- No hay tool para sellar desde el MCP a propósito: sellar exige que el humano escriba el valor, y eso se hace en su terminal (`pap seal`).
- Rechazo → mensaje "Do not retry"; `reason` < 10 caracteres se rechaza antes de llegar al teléfono.
- Prueba: `mcp/scripts/secrets-e2e.mjs` con los bundles reales + teléfono simulado, **11 checks**.

---

### PAP-06 — CLI: `pap seal` y `pap secret get`

- **Estado:** done
- **Épica:** Secretos
- **Depende de:** PAP-02

**Descripción**
Binario `pap` en `mcp/` (`bin` en `package.json`, mismo bundle). `pap seal <name> [--agent <addr|nombre>] [--expiry 7d]` lee el secreto de stdin o prompt oculto, cifra y sube. `pap secret get <name> --reason "..."` para agentes sin MCP: imprime a stdout solo con `--stdout`, o ejecuta `pap secret exec <name> -- cmd` inyectando una variable de entorno.

**Casos de uso**
- El humano sella una key desde la terminal sin pegarla en ningún chat.
- Un bot en Python obtiene la key con `pap secret exec openai -- python bot.py`.

**Criterios de aceptación**
- El secreto nunca aparece en el historial del shell (stdin o prompt oculto).
- `exec` inyecta `PAP_SECRET_<NAME>` solo en el proceso hijo.
- Códigos de salida: 0 ok, 4 rechazado, 5 expirado.

**Pruebas**
- Script: `echo key | pap seal test` → `pap secret exec test -- printenv PAP_SECRET_TEST` con phone-sim.
- Rechazo → código 4.

**Resumen post-desarrollo**
- `mcp/src/cli.ts` → bundle `mcp/dist/pap-cli.mjs` (commiteado, sin `node_modules`), `bin` en `package.json` (`pap`, `pap-mcp`). Uso sin instalar: `node mcp/dist/pap-cli.mjs …`.
- Comandos: `pap status`, `pap seal <name> [--max-reads] [--days]` (valor por stdin o prompt oculto, nunca en el historial), `pap secret list`, `pap secret get <name> --reason … [--stdout]`, `pap secret exec <name> --reason … -- <cmd>` (inyecta `PAP_SECRET_<NAME>` solo en el proceso hijo).
- Códigos de salida: 0 ok · 1 error · 4 rechazado · 5 expirado/timeout.
- CI verifica que el bundle de la CLI coincide con el código fuente.
- Probado en `secrets-e2e.mjs`: seal por stdin, exec con variable de entorno, rechazo con código 4, límite de lecturas.
- Pendiente: publicar en npm para que `npx pap` funcione (hoy se usa la ruta del repo).

---

### PAP-07 — Visa y auditoría on-chain para secretos

- **Estado:** done
- **Épica:** Secretos
- **Depende de:** PAP-04

**Descripción**
Sin cambiar contratos. Al sellar, el teléfono hace `grant(agentId, keccak256("secret:" + name), maxAccesos, expiry)`. En cada aprobación, `record(agentId, scope, 1, ref = keccak("pap:reveal:" + requestId))`. El relay y la PWA consultan `canAct` antes de mostrar la tarjeta. Revocar = `revoke(agentId, scope)` + `DELETE /api/secrets/:name`.

**Casos de uso**
- "Esta key se puede leer máximo 10 veces en 7 días."
- Un auditor ve en HSK cuántas veces y cuándo se leyó cada secreto.

**Criterios de aceptación**
- Sin visa activa → la PWA no permite aprobar.
- Pasado el máximo → `LimitExceeded()` on-chain y la tarjeta lo explica.
- Los accesos aparecen en **Sellos** junto a los pagos.

**Pruebas**
- Foundry: test con scope de secreto (grant → record × N → revert).
- E2E: N+1 reveals → el último falla con `LimitExceeded`.

**Resumen post-desarrollo**
- Sin cambios en contratos. Al aprobar un seal el teléfono hace `grant(agentId, keccak256("secret:"+name), maxLecturas, expiry)`; cada reveal aprobado hace `record(agentId, scope, 1, keccak256("pap:reveal:"+requestId))` **antes** de entregar el blob, así que si el contrato revierte (`LimitExceeded`, `GrantExpired`, `NoGrant`) no se entrega nada.
- La PWA lee `getGrant` y desactiva la aprobación si la visa no permite otra lectura; el relay también cuenta lecturas (defensa en profundidad).
- Revocar desde la Bóveda = `revoke()` on-chain + `DELETE` en el relay.
- Las lecturas aparecen en **Sellos** (eventos `ActionRecorded` filtrados por los scopes de los secretos).
- Tests Foundry nuevos en `contracts/test/SecretVisa.t.sol` (límite, expiración, revocación, scopes independientes, permisos): pasan en el CI.
- Nota: la llave del agente también puede llamar `record()` sobre su propio scope y gastar lecturas; solo se perjudica a sí misma, no obtiene el secreto.

---

### PAP-20 — Investigación: políticas automáticas sin Face ID

- **Estado:** to do
- **Épica:** Secretos
- **Depende de:** PAP-07

**Descripción**
Explorar cómo permitir "leer sin preguntar dentro de la visa" sin romper la doble firma: cifrado por umbral (Lit Protocol u otra red), un TEE, o un teléfono que responde solo si la visa está activa. Entregable: documento con opciones, trade-offs y recomendación.

**Casos de uso**
- Un agente autónomo que necesita una key cada hora sin despertar al humano.

**Criterios de aceptación**
- Documento en `docs/` con al menos 2 opciones evaluadas y una recomendación.

**Pruebas**
- N/A (investigación). Si hay prototipo, un script que lo demuestre.

**Resumen post-desarrollo**
_Pendiente._

---

## Épica: JSON-RPC

### PAP-08 — JSON-RPC 2.0: endpoint `/api/rpc` con namespace `pap_*`

- **Estado:** to do
- **Épica:** JSON-RPC
- **Depende de:** PAP-02

**Descripción**
`POST /api/rpc` que acepta llamadas sueltas y en batch. Métodos: `pap_sealSecret`, `pap_requestSecret`, `pap_requestTransfer`, `pap_getRequest`, `pap_canAct`, `pap_listSecrets`. Envuelve la lógica de las rutas REST (no la duplica). Errores: `4001` rechazado por el usuario, `-32602` params inválidos, `-32003` visa expirada o sin límite, `-32601` método inexistente.

**Casos de uso**
- Un agente A2A en Go o Rust integra PAP sin MCP.
- Un cliente manda varias consultas en un batch.

**Criterios de aceptación**
- Cumple JSON-RPC 2.0 (id, batch, notificaciones sin id).
- Los mismos permisos y firmas que REST.
- Especificación de métodos en `docs/RPC.md`.

**Pruebas**
- Script con `curl`: cada método, batch mixto, método inexistente, params inválidos.
- Paridad: el mismo flujo por REST y por RPC da el mismo resultado.

**Resumen post-desarrollo**
_Pendiente._

---

### PAP-09 — Signer local EIP-1193 (`pap rpc`)

- **Estado:** to do
- **Épica:** JSON-RPC
- **Depende de:** PAP-08

**Descripción**
`pap rpc --port 8545` levanta un servidor JSON-RPC local compatible con Ethereum. Lecturas (`eth_call`, `eth_getBalance`, `eth_chainId`, `eth_blockNumber`, …) pasan al RPC de HSK. `eth_accounts` / `eth_requestAccounts` devuelven la dirección del agente. `eth_sendTransaction` → si la visa cubre la tx, el agente firma solo; si no, request al teléfono (QR/push). Solo escucha en `127.0.0.1`.

**Casos de uso**
- `cast send --rpc-url http://localhost:8545 ...` sin private key en `.env`.
- Un script viem, ethers o web3.py usa PAP sin saber que existe.

**Criterios de aceptación**
- Funciona con `cast`, viem y ethers sin modificarlos.
- Una tx fuera de la visa nunca se firma sin aprobación del teléfono.
- Rechazo → error `4001` (EIP-1193).

**Pruebas**
- `cast chain-id`, `cast balance`, `cast send` contra el proxy.
- Script viem: `walletClient.sendTransaction` → phone-sim aprueba → tx hash.
- Tx por encima del límite → aprobación requerida o revert on-chain.

**Resumen post-desarrollo**
_Pendiente._

---

### PAP-10 — `eth_getEncryptionPublicKey` / `eth_decrypt` sobre doble firma

- **Estado:** to do
- **Épica:** JSON-RPC
- **Depende de:** PAP-09

**Descripción**
En el signer local: `eth_getEncryptionPublicKey(agent)` devuelve la llave pública del agente; `eth_decrypt(blob, agent)` dispara el flujo `reveal` (doble firma) y devuelve el texto plano. Reutiliza los nombres que tuvo MetaMask (deprecados allí) con nuestro formato por capas. Documentar la diferencia de formato.

**Casos de uso**
- Herramientas que ya conocían `eth_decrypt` pueden pedir secretos.

**Criterios de aceptación**
- `eth_decrypt` nunca devuelve texto plano sin aprobación del teléfono.
- Blob con formato distinto al nuestro → error claro.

**Pruebas**
- Script: `eth_getEncryptionPublicKey` → sellar → `eth_decrypt` → phone-sim → valor correcto.

**Resumen post-desarrollo**
_Pendiente._

---

### PAP-11 — Métodos `wallet_*` (EIP-7715, EIP-5792, capabilities)

- **Estado:** to do
- **Épica:** JSON-RPC
- **Depende de:** PAP-09

**Descripción**
- `wallet_grantPermissions` (EIP-7715) → request al teléfono para `AgentPassport.grant()`.
- `wallet_sendCalls` / `wallet_getCallsStatus` (EIP-5792) → varios pagos con una sola aprobación.
- `wallet_getCapabilities` → anuncia `pap: {secrets, visas, gate}`.

**Casos de uso**
- Un agente pide "déjame gastar 50 demoUSDT esta semana" con un método estándar.
- Un agente paga a 3 proveedores con un Face ID.

**Criterios de aceptación**
- El mapeo EIP-7715 → `grant` queda documentado (qué campos se soportan y cuáles no).
- `wallet_sendCalls` ejecuta todo o nada.

**Pruebas**
- Script: `wallet_grantPermissions` → phone-sim → `canAct` true.
- Script: `wallet_sendCalls` con 3 pagos → 3 eventos `Paid`.

**Resumen post-desarrollo**
_Pendiente._

---

## Épica: UX / UI

### PAP-15 — Mockups de aprobación y Bóveda

- **Estado:** done
- **Épica:** UX
- **Depende de:** —

**Descripción**
Mockups (HTML estático con el estilo actual: Cormorant + Barlow Condensed, acento vino) de: tarjeta de aprobación de secreto, tarjeta de pago (para comparar), pestaña Bóveda, estado de rechazo y de límite excedido.

**Casos de uso**
- Validar el look antes de programar PAP-04 y PAP-12.

**Criterios de aceptación**
- Aprobados por Cristóbal.
- Mismo lenguaje visual para pagos y secretos (solo cambia el ícono 💸 / 🔑).

**Pruebas**
- Revisión visual en iPhone (ancho 390px).

**Resumen post-desarrollo**
- En lugar de mockups estáticos se construyeron las pantallas reales en el estilo actual y se capturaron a 390px con Playwright contra el relay local: `docs/img/phone/approve-reveal.png`, `wallet-agents.png`, `wallet-vault.png`, `wallet-stamps.png`, `vault-new.png`.
- Pagos y secretos comparten tarjeta y lenguaje visual; solo cambia el ícono (💸 / 🔑 / 🔒).
- **Pendiente:** aprobación de Cristóbal sobre las capturas; los ajustes que pida se hacen directamente en los componentes.

---

### PAP-12 — `/wallet`: pestañas Agentes · Bóveda · Sellos

- **Estado:** done
- **Épica:** UX
- **Depende de:** PAP-02, PAP-15

**Descripción**
Reorganizar `web/src/app/wallet/page.tsx` en tres pestañas. **Agentes** (existente + cuántos secretos puede pedir cada uno). **Bóveda** (secretos sellados: agente, visa, último acceso; botones Revocar y Rotar). **Sellos** (historial existente + accesos a secretos).

**Casos de uso**
- El humano ve qué agente puede leer qué.
- El humano revoca un secreto filtrado y lo rota.

**Criterios de aceptación**
- Revocar llama a `revoke` on-chain + `DELETE /api/secrets/:name`.
- Rotar = revocar + guía para sellar el nuevo valor.
- Funciona en un iPhone de 390px sin scroll horizontal.

**Pruebas**
- Manual en iPhone.
- Revocar → el siguiente reveal del agente falla.

**Resumen post-desarrollo**
- `/wallet` con barra inferior fija (🤖 Agentes · 🔑 Bóveda · 🛂 Sellos), alcanzable con el pulgar y con `safe-area-inset-bottom` para iPhone. Aprobaciones pendientes siempre visibles arriba.
- `components/Vault.tsx`: secretos por agente, lecturas usadas/permitidas (on-chain si hay visa), expiración, última lectura; **Revocar** (Face ID → `revoke` + `DELETE`) y **Rotar** (revoca y guía para `pap seal` con el valor nuevo).
- `components/Stamps.tsx`: pagos 💸 y lecturas 🔑 de HSK en una sola línea de tiempo, indicando si ejecutó el humano o el agente. `Agents.tsx` muestra la visa y cuántos secretos puede pedir cada agente.
- Arreglos encontrados al revisar capturas a 390px: los errores largos rompían el ancho (ahora parten línea), y si fallaba el RPC desaparecían las aprobaciones pendientes (ahora cada lectura es independiente).
- Revisado con capturas de Playwright a 390px contra el relay local. **Pendiente:** prueba manual en iPhone.

---

### PAP-13 — Notificaciones push en la PWA

- **Estado:** to do
- **Épica:** UX
- **Depende de:** PAP-04

**Descripción**
Web Push (iOS 16.4+ con la PWA instalada). El teléfono se suscribe al emparejar; el relay envía un push con cada request nuevo; al tocarlo se abre `/approve/:id`. El QR queda solo para emparejar y como plan B.

**Casos de uso**
- El agente pide un secreto y al humano le llega "Claude Code quiere leer OpenAI".

**Criterios de aceptación**
- El push no incluye datos sensibles (solo agente + tipo de acción).
- Si el push falla, el QR sigue funcionando.

**Pruebas**
- Manual en iPhone con la PWA instalada.
- Suscripción caducada → fallback a QR sin error.

**Resumen post-desarrollo**
_Pendiente._

---

### PAP-14 — `/vault/new`: sellar desde el navegador

- **Estado:** done
- **Épica:** UX
- **Depende de:** PAP-01, PAP-02

**Descripción**
Página para sellar sin terminal: pegar secreto, elegir agente de una lista, elegir expiración y máximo de accesos; cifra en el navegador (PAP-01) y dispara el `grant` en el teléfono (PAP-07).

**Casos de uso**
- Un usuario no técnico entrega una key a su agente.

**Criterios de aceptación**
- El texto plano nunca sale del navegador.
- Confirmación: "🔒 Sellado para <agente>. Ni el servidor puede leerlo."

**Pruebas**
- Sellar desde web → `pap_secret` → valor correcto.
- Inspeccionar la red: ninguna petición lleva el texto plano.

**Resumen post-desarrollo**
- `/vault/new` (enlazada desde **Bóveda → + Seal a secret**): eliges agente de una lista, nombre, valor (campo password), máximo de lecturas y días. Face ID → cifra en el navegador → `grant` on-chain → firma `SealRequest` como dueño → el relay lo guarda **activo** de una (sin segundo paso).
- El texto plano nunca sale del dispositivo: al relay solo llega el blob cifrado.
- Si el relay no tiene la llave pública del agente, se explica cómo resolverlo; `pap_secrets_list` / `pap secret list` ahora la publican automáticamente.
- Captura a 390px: `docs/img/phone/vault-new.png`. Pendiente: prueba real en iPhone con HSK.

---

## Épica: Skills

### PAP-16 — Skills `pap-secrets` y `pap-seal`

- **Estado:** done
- **Épica:** Skills
- **Depende de:** PAP-05, PAP-06

**Descripción**
`.claude/skills/pap-secrets/SKILL.md` y `.claude/skills/pap-seal/SKILL.md` en formato Agent Skills (frontmatter `name` + `description`). Reglas de oro: **siempre explica por qué**, **nunca expongas un secreto**, **un rechazo es final**. `pap-secrets`: preferir el gate antes de revelar; pedir con reason concreto; usar `pap secret exec` o variables de entorno; nunca imprimir, loguear ni commitear. `pap-seal`: guiar al humano con `pap seal` sin pegar el secreto en el chat.

**Casos de uso**
- Claude Code necesita una key y sigue el protocolo correcto sin que nadie se lo diga.
- El humano dice "guarda mi key de Stripe para el agente".

**Criterios de aceptación**
- La skill se activa sola ante "necesito la API key de X".
- Las tres reglas de oro aparecen explícitas.

**Pruebas**
- Sesión de Claude Code: pedir una tarea que requiere una key → usa `pap_secret` con reason y no imprime el valor.
- Rechazar en el teléfono → el agente se detiene y avisa.
- Pedir "imprime la key" → el agente se niega.

**Resumen post-desarrollo**
- `.claude/skills/pap-secrets/SKILL.md`: se activa ante cualquier necesidad de credencial; flujo gate → lista → `pap_secret` (entrega en archivo) o `pap secret exec`; tabla de errores; las tres reglas de oro explícitas.
- `.claude/skills/pap-seal/SKILL.md`: guía al humano a sellar desde **su** terminal o desde `/vault/new`; qué hacer si pega un secreto en el chat (recomendar rotarlo, no usarlo); cómo elegir límites.
- Formato Agent Skills (frontmatter `name` + `description`), así que sirve fuera de Claude Code.
- **Pendiente:** las pruebas con sesiones reales de Claude Code (que la skill se active sola, que se niegue a imprimir la key) necesitan un agente emparejado contra el relay de producción.

---

### PAP-17 — Skills `pap-payments`, `pap-gate`, `pap-onboarding`, `pap-rpc`

- **Estado:** to do
- **Épica:** Skills
- **Depende de:** PAP-09

**Descripción**
- `pap-payments`: revisar `pap_canAct` antes de pedir; usar contactos; no partir pagos para evadir el límite.
- `pap-gate`: ante un `402`, usar `pap_call_gate`.
- `pap-onboarding`: `pap_connect`, explicar los txs y qué visas pedir.
- `pap-rpc`: levantar `pap rpc` y apuntar `cast`, viem o ethers ahí en vez de pedir una private key.

**Casos de uso**
- El agente recibe `402` de un servicio y lo resuelve solo.
- El agente necesita hacer `cast send` y no pide una private key.

**Criterios de aceptación**
- Cada skill con disparadores claros en `description`.
- Ninguna skill sugiere poner una private key en `.env`.

**Pruebas**
- Una sesión de Claude Code por skill con un prompt que la dispare.

**Resumen post-desarrollo**
_Pendiente._

---

### PAP-18 — Plugin de Claude Code + `docs/AGENTS.md`

- **Estado:** to do
- **Épica:** Skills
- **Depende de:** PAP-16, PAP-17

**Descripción**
Empaquetar skills + servidor MCP como plugin de Claude Code (`/plugin install pap`). Publicar el mismo contenido como `docs/AGENTS.md` (prompt de sistema) para agentes sin soporte de skills.

**Casos de uso**
- Instalar PAP en cualquier proyecto con un comando, sin clonar el repo.
- Un agente de otro proveedor usa `AGENTS.md` como instrucciones.

**Criterios de aceptación**
- El plugin instala MCP + skills y funciona en un proyecto vacío.
- `AGENTS.md` cubre las mismas reglas que las skills.

**Pruebas**
- Instalar el plugin en un repo vacío → "conecta PAP" → flujo completo.

**Resumen post-desarrollo**
_Pendiente._

---

## Épica: Landing / Front

Principios para toda la épica:
- **Contar una historia**: cada pantalla del scroll es un paso, y quien solo lee los títulos entiende el producto.
- **Muy poco texto**: una frase por sección y como mucho una línea de apoyo.
- **Mobile first**: se diseña primero a 390px y luego se escala a escritorio.
- **Se reutiliza el estilo actual** (fondo renacentista, Cormorant + Barlow Condensed, acento vino, grano de papel) y el `web/src/components/landing/motion.tsx` existente.

### PAP-21 — Referencia Hermes Agent + storyboard de la landing

- **Estado:** to do
- **Épica:** Landing
- **Depende de:** —

**Descripción**
Estudiar la web de Hermes Agent como referencia (animaciones por scroll, loops infinitos, ritmo, cantidad de texto) y escribir el storyboard de la nueva landing en `docs/LANDING.md`: lista de secciones, la frase de cada una, qué se anima y cómo se ve en mobile. Historia propuesta:
1. **Hero**: "Tu agente tiene pasaporte. Tú firmas las visas."
2. **Problema**: una key en `.env` = acceso total, para siempre.
3. **Pasaporte**: el agente recibe identidad, no llaves.
4. **Visa**: tú decides qué puede hacer, cuánto y hasta cuándo.
5. **Face ID**: cada acción sensible pasa por tu teléfono.
6. **Secretos**: tus credenciales, selladas con dos firmas.
7. **Cadena**: las reglas las cumple el contrato, no la app.
8. **Instálalo** → **Crea tus credenciales** → CTA.

**Casos de uso**
- El equipo se alinea en la historia antes de programar animaciones.

**Criterios de aceptación**
- Storyboard aprobado por Cristóbal.
- Cada sección tiene como máximo 12 palabras de título y 20 de apoyo.
- Lista de referencias concretas tomadas de Hermes Agent (qué efecto y dónde).

**Pruebas**
- Prueba de los 5 segundos: alguien que no conoce PAP lee solo los títulos y explica de qué trata.

**Resumen post-desarrollo**
_Pendiente._

---

### PAP-22 — Landing narrativa con animaciones por scroll

- **Estado:** to do
- **Épica:** Landing
- **Depende de:** PAP-21

**Descripción**
Reescribir `web/src/app/page.tsx` según el storyboard. Animaciones disparadas por scroll (scroll triggers): entradas con fade y desplazamiento, secciones fijas (sticky) donde el contenido cambia mientras haces scroll, un contador que avanza, y el teléfono mockup que va mostrando cada paso (pairing → visa → Face ID → sello). Evaluar `motion` (Framer Motion) o GSAP ScrollTrigger + Lenis frente a extender `motion.tsx`; elegir uno solo.

**Casos de uso**
- Un jurado o usuario hace scroll y entiende el flujo completo sin leer párrafos.

**Criterios de aceptación**
- Implementa todas las secciones del storyboard.
- Scroll fluido a 60 fps en un iPhone de gama media.
- Sin saltos de layout (CLS < 0.1).
- Se mantienen los enlaces actuales (repo, docs, explorer, stats en vivo).

**Pruebas**
- Manual en Safari iOS, Chrome Android y escritorio.
- Lighthouse: performance ≥ 85 en mobile.

**Resumen post-desarrollo**
_Pendiente._

---

### PAP-23 — Diagrama animado "Cómo funciona"

- **Estado:** to do
- **Épica:** Landing
- **Depende de:** PAP-21

**Descripción**
Diagrama SVG en línea que se va dibujando con el scroll: **Agente → Relay → Teléfono (Face ID) → HashKey Chain**, y la variante de secretos (**sello por capas → doble firma → agente**). Cada nodo se ilumina cuando la historia llega a ese paso. En mobile se muestra en vertical.

**Casos de uso**
- Entender en un vistazo quién firma, quién guarda qué y qué hace la cadena.

**Criterios de aceptación**
- Dos flujos: pagos y secretos.
- Legible en 390px (vertical) y en escritorio (horizontal).
- Colores desde los tokens del tema, nada fijo en el código.
- Texto del diagrama accesible (no es una imagen).

**Pruebas**
- Revisión visual en mobile y escritorio.
- Lector de pantalla lee los pasos en orden.

**Resumen post-desarrollo**
_Pendiente._

---

### PAP-24 — Sección "Instálalo en tu agente"

- **Estado:** to do
- **Épica:** Landing
- **Depende de:** PAP-18, PAP-21

**Descripción**
Sección con pestañas y botón de copiar por agente:
- **Claude Code**: `/plugin install pap` (o `.mcp.json` mientras no exista el plugin).
- **Cursor / Claude Desktop**: bloque JSON de configuración MCP.
- **Cualquier agente**: `npx pap rpc` + `--rpc-url http://localhost:8545`.
- **CLI**: `pap secret exec <name> -- <cmd>`.
Terminal animada que escribe el comando y muestra el QR de emparejamiento (se reutiliza el "typing gate terminal" actual).

**Casos de uso**
- Un usuario de Claude Code instala PAP en menos de un minuto desde la landing.

**Criterios de aceptación**
- Los comandos se copian con un toque (también en mobile).
- Cada comando mostrado funciona tal cual (verificado contra el código).
- 3 pasos visibles: instalar → escanear QR → listo.

**Pruebas**
- Copiar y pegar cada comando en una máquina limpia → funciona.

**Resumen post-desarrollo**
_Pendiente._

---

### PAP-25 — Sección "Crea tus credenciales"

- **Estado:** to do
- **Épica:** Landing
- **Depende de:** PAP-06, PAP-14, PAP-21

**Descripción**
Explicar en 3 pasos animados cómo sellar una credencial: **pegas la key** (`pap seal openai` o `/vault/new`) → **eliges agente y límites** → **🔒 sellada: solo se abre con su firma + la tuya**. Después se muestra la tarjeta del teléfono cuando el agente la pide. Enlace directo a `/vault/new`.

**Casos de uso**
- El usuario entiende cómo entregar una API key a su agente sin pegarla en un chat ni en un `.env`.

**Criterios de aceptación**
- Dos caminos visibles: terminal y web.
- Se explica en una línea qué **no** protege (una vez entregada, el agente la tiene) con enlace al modelo de amenaza.

**Pruebas**
- Prueba con un usuario: tras leer la sección sabe sellar una key sin ayuda.

**Resumen post-desarrollo**
_Pendiente._

---

### PAP-26 — Mobile first: landing + experiencia PWA

- **Estado:** to do
- **Épica:** Landing
- **Depende de:** PAP-22

**Descripción**
- **Landing en mobile**: animaciones adaptadas (menos parallax, sticky más cortos), tipografía y espaciado a 390px, botones al alcance del pulgar.
- **La PWA** (`/wallet`, `/approve`, `/pair`): barra de navegación inferior (Agentes · Bóveda · Sellos), aviso guiado "Añadir a pantalla de inicio" en iOS (necesario para push y Face ID cómodo), estados vacíos con una sola acción clara.
- Si la landing se abre en un teléfono, se muestra el CTA "Abrir mi pasaporte" en vez de "Instalar en tu agente".

**Casos de uso**
- El humano aprueba desde el teléfono con una mano.
- Alguien abre la landing en el celular y termina con la PWA instalada.

**Criterios de aceptación**
- Sin scroll horizontal en ninguna pantalla a 360–430px.
- Objetivos táctiles de al menos 44px.
- Guía de instalación en iOS y Android.

**Pruebas**
- Manual en iPhone (Safari) y Android (Chrome).
- Instalar la PWA desde la landing en ambos.

**Resumen post-desarrollo**
_Pendiente._

---

### PAP-27 — Marquee infinito de compatibilidad

- **Estado:** to do
- **Épica:** Landing
- **Depende de:** PAP-22

**Descripción**
Cinta en loop infinito (se reutiliza el marquee actual) con lo que funciona con PAP: Claude Code, Cursor, Claude Desktop, cast, viem, ethers, web3.py, MCP, JSON-RPC, EIP-1193, ERC-8004, x402, HashKey Chain. Dos filas en sentidos opuestos; se pausa al pasar el cursor o al tocar.

**Casos de uso**
- Transmitir "funciona con cualquier agente" sin escribir un párrafo.

**Criterios de aceptación**
- Loop sin cortes visibles.
- Solo lista integraciones que funcionan de verdad en ese momento.

**Pruebas**
- Revisión visual; verificar cada integración listada contra el código.

**Resumen post-desarrollo**
_Pendiente._

---

### PAP-28 — Rendimiento y accesibilidad de animaciones

- **Estado:** to do
- **Épica:** Landing
- **Depende de:** PAP-22 a PAP-27

**Descripción**
Pasada final: respetar `prefers-reduced-motion` (animaciones sustituidas por estados estáticos), carga diferida de imágenes y del diagrama, fuentes optimizadas, contraste AA en todos los textos sobre el fondo.

**Casos de uso**
- Un usuario con movimiento reducido activado ve la historia completa sin animaciones.

**Criterios de aceptación**
- Lighthouse mobile: performance ≥ 85, accesibilidad ≥ 95.
- Con reduced motion, todo el contenido es visible y legible.

**Pruebas**
- Lighthouse en mobile y escritorio.
- Activar reduced motion en iOS y revisar la landing completa.

**Resumen post-desarrollo**
_Pendiente._

---

## Épica: Documentación

### PAP-19 — Documentación: arquitectura de secretos y modelo de amenaza

- **Estado:** to do
- **Épica:** Docs
- **Depende de:** PAP-07

**Descripción**
Sección "Secrets" en `docs/ARCHITECTURE.md` (flujo, formato de blob, EIP-712, visa on-chain), actualización de `docs/SECURITY.md` con el modelo de amenaza (protege la entrega, no el uso; mitigaciones) y del README (nueva fila en la tabla de modos + tools nuevas).

**Casos de uso**
- Un jurado o auditor entiende qué garantiza y qué no.

**Criterios de aceptación**
- Diagrama del flujo de doble firma.
- Lista explícita de lo que **no** protege.

**Pruebas**
- Revisión por alguien del equipo que no haya implementado la feature.

**Resumen post-desarrollo**
_Pendiente._
