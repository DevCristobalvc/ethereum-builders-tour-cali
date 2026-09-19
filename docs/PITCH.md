# Pitch — Passport Agent Protocol (PAP)

> Showcase: **3 min demo + 2 min preguntas**. Domingo 20 sep, 13:30–17:00, Auditorio SIDOC (ICESI).
> Tracks: EAG *AI x Ethereum & Agent Economy* · HashKey Chain *AI Agents / Payments*.

Frase ancla: **"Tu agente tiene pasaporte: tú le das visas desde el celular, y los servicios lo dejan pasar sin saber quién eres."**

Frase para HashKey: **"Compliant but private."**

---

## Guion de 3 minutos

### 0:00 – 0:30 · El problema (hook)

> Levanten la mano los que han puesto una llave privada en un `.env` para que un agente de IA haga algo por ustedes.
>
> Eso es lo que hay hoy. Un agente como Claude Code tiene dos opciones: **o tiene la llave y puede hacer TODO**, para siempre, sin que nadie lo revise... o **no tiene nada** y ustedes terminan copiando y pegando transacciones a mano.
>
> No hay punto medio. No hay forma de que un humano apruebe *esta acción específica* desde un dispositivo en el que confía, y que quede **verificable on-chain** quién autorizó a qué agente a hacer qué.

### 0:30 – 1:00 · La solución (una imagen)

> Construimos **Passport Agent Protocol**. La idea cabe en una frase:
>
> **Tu agente tiene un pasaporte, tú le pones visas desde el celular, y los servicios lo dejan pasar sin saber quién eres.**
>
> - El **pasaporte** es una identidad ERC-8004 on-chain.
> - Las **visas** son permisos (`grant`) con alcance, límite y expiración, que solo el humano dueño del pasaporte puede otorgar.
> - Y el agente **nunca ve un secreto**: la única llave vive en el teléfono, protegida por FaceID.

### 1:00 – 2:15 · Demo en vivo (ver `DEMO.md`)

> Esto es Claude Code, un agente real. Le pido: *"paga 5 demoUSDT al oráculo"*.
>
> *(Claude llama la tool MCP `pap_transfer` → aparece un QR en la terminal.)*
>
> El agente no tiene llave. Lo único que puede hacer es **pedir permiso**.
>
> *(Escaneo con el iPhone → PWA muestra: "Claude Code quiere enviar 5 demoUSDT a 0x…")*
>
> Yo veo exactamente qué quiere hacer, en lenguaje humano. Apruebo con FaceID.
>
> *(El teléfono firma UNA tx: `AgentPassport.pay()` en HashKey Chain → el relay devuelve el hash → Claude sigue trabajando y muestra el link al explorer.)*
>
> Listo. Humano en el loop, en 15 segundos, desde el celular. Y esto quedó **on-chain**: aquí en el explorer está el registro ERC-8004 (yo soy el dueño del pasaporte, el agente solo tiene una dirección) y la visa de demoUSDT con su límite y el gasto registrado. Y si el agente pide más del límite, **el contrato revierte** — no es una regla del servidor, es on-chain.

### 2:15 – 2:45 · Por qué importa / por qué HashKey

> Cualquier servicio puede verificar *"este agente está autorizado por un humano real para este alcance y aún tiene cupo"* con una llamada `canAct(agentId, scope, amount)`, **sin saber quién es el humano**.
>
> Para HashKey Chain esto es **compliant but private**: hay trazabilidad de autorización auditable, sin exponer identidades. Es exactamente la infraestructura que necesitan pagos de agentes, stablecoins y RWA en una L2 regulada.

### 2:45 – 3:00 · Roadmap y cierre

> Lo que ven es la iteración 1. Iteración 2: un gate estilo **x402** que devuelve `402`, verifica la visa on-chain y responde `200`. Iteración 3, que ya tenemos investigada y con contratos probados: **pasaporte ZK** — el agente prueba con Groth16 que *es uno de los autorizados* sin revelar *cuál*.
>
> Passport Agent Protocol. Gracias.

---

## Q&A probables

### "¿Por qué la passkey no firma la transacción on-chain directamente?"
Respuesta honesta: la passkey **no** firma on-chain. La passkey (WebAuthn / P-256) protege la llave **dentro del dispositivo**: en iOS 18+ usamos la extensión **PRF** de WebAuthn para derivar un secreto que cifra (AES-GCM) la EOA secp256k1; sin PRF, la passkey igual exige FaceID antes de cada firma. Esa EOA es la que firma la tx. Es lo que funciona en cualquier EVM sin precompiles. El roadmap es **RIP-7212** (precompile P-256, ya en varias OP-stack L2s) + **account abstraction (ERC-4337)** para que la passkey sea directamente el signer de una smart account. Como el humano es simplemente el *owner* del NFT ERC-8004, puede ser una EOA hoy y una smart account mañana sin cambiar `AgentPassport`.

### "¿Por qué HashKey Chain?"
Tres razones: (1) es una L2 OP-stack EVM-compatible, así que todo el stack (Foundry, viem, ERC-8004) corre sin cambios; (2) su narrativa es **compliance + RWA + stablecoins reguladas** — exactamente el contexto donde "un agente movió dinero y nadie sabe quién lo autorizó" es inaceptable; (3) PAP le da a HashKey una primitiva que nadie más tiene: autorización de agentes **auditable pero privada**.

### "¿Qué pasa si el agente es malicioso (prompt injection, modelo comprometido)?"
Nada que el humano no haya aprobado explícitamente. El agente **no tiene llave** — su superficie de ataque es "pedir permiso". Cada solicitud se muestra en lenguaje humano en el teléfono antes de firmar, y los grants tienen **alcance, límite y expiración** on-chain, con cada uso registrado (`record`): aunque el humano apruebe distraído, el agente no puede pasar de 100 demoUSDT acumulados ni tocar otro scope. Revocar es una tx (`revoke`). Comparen con `.env`: ahí una inyección drena la wallet entera.

### "¿Y el sybil? ¿Un humano puede crear mil agentes?"
Sí, y no es un problema para este modelo: la garantía no es "1 humano = 1 agente" sino **"este agente tiene un humano responsable con permisos acotados"**. Si un servicio necesita proof-of-personhood, el `register` puede exigir una credencial (World ID, ZK passport) como condición — está en el roadmap ZK y ya existe el patrón (`agent-passport` de World ID × ERC-8004). Además, la reputación ERC-8004 (`ReputationRegistry`) se acumula por agente, así que crear mil agentes nuevos = mil agentes sin reputación.

### "¿Por qué una sola tx `pay()` y no `transfer` + `record`?"
Porque así el límite se aplica **atómicamente en el contrato**: `pay()` verifica el grant (scope, límite, expiración), mueve los tokens y registra el uso en la misma tx. Un agente no puede "transferir y olvidarse de registrar". Lo probamos: 500 demoUSDT sobre un límite de 100 revierte con `LimitExceeded()`. `record()` queda para acciones que no son transferencias de tokens (iteración 2, gate x402).

### "¿En qué se diferencia de un multisig / Safe con módulo?"
Un Safe protege *una* wallet con *n* firmantes humanos. PAP resuelve el caso inverso: *un* humano supervisando *n* agentes autónomos, con permisos por alcance, e integración nativa en el loop del agente vía **MCP** (el agente literalmente tiene una tool "pide permiso"). Y el vínculo humano→agente es público y verificable por terceros con una sola llamada, sin exponer al humano.

### "¿Por qué ERC-8004 y no una identidad propia?"
Porque ya está en mainnet desde enero 2026 y es el estándar que la industria está adoptando para identidad de agentes (Identity + Reputation + Validation registries). Nuestro `IdentityRegistry` es interface-compatible, y el vínculo humano→agente es literalmente el `register(agentURI, agentWallet)` del estándar (humano = owner del NFT): cualquier agente ERC-8004 existente puede recibir grants de PAP sin re-registrarse.

### "¿Cuánto de esto funciona hoy?"
Todo lo que vieron corre en HashKey testnet: 6 contratos desplegados (`deployments/133.json`), relay + PWA en `pap.devcristobalvc.com`, MCP server en el repo (`.mcp.json`, abren el repo en Claude Code y ya está). Tenemos el E2E probado: 10 demoUSDT aprobados (tx `0xe152…b04e23`) y 500 demoUSDT rechazados on-chain por `LimitExceeded()`. Groth16 verifier + PassportRegistry también desplegados y con tests (9/9) para la iteración ZK; el circuito es `zkpjwt-core`, lib nuestra en npm. Lo que falta: el gate x402 (iteración 2) y conectar la prueba ZK al gate (iteración 3).

### "¿Qué pasa si se pierde el teléfono?"
El humano es el owner del ERC-721: se transfiere el NFT a la nueva wallet (o el owner puede ser una wallet fría / Safe desde el inicio) y se re-otorgan los grants. Los grants expiran solos. Es el mismo modelo de recuperación que cualquier NFT.

---

## Slides mínimas (si hay proyector)

1. Título + frase ancla
2. `.env` vs nada — el problema en una imagen
3. Diagrama: Claude Code → MCP → Relay → iPhone (FaceID) → HashKey Chain
4. Demo (en vivo o video)
5. "Compliant but private" — por qué HashKey
6. Roadmap: Iter 2 x402 gate · Iter 3 ZK passport
7. Equipo + repo + QR al explorer
