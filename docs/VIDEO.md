# Video plan B — storyboard (2:00)

> Para grabar el sábado en la noche con el flujo E2E ya funcionando. Sirve como respaldo en el showcase y como video de la submission en Devfolio (link unlisted de YouTube).

## Setup de grabación

| Fuente | Herramienta | Notas |
|---|---|---|
| Laptop (terminal + browser) | OBS (Windows) o QuickTime "Nueva grabación de pantalla" (Mac) | 1920×1080, 30 fps. Terminal a fuente ≥ 18 pt, tema claro. Cerrar notificaciones. |
| iPhone | Grabación de pantalla nativa (Centro de control → ⏺) | Activar "Micrófono" apagado. Brillo al máximo. Modo no molestar. |
| Voz en off | Grabar aparte con el celular (Notas de voz) o en OBS al final | Grabar la voz **después**, viendo el video mudo, para que los tiempos calcen. |

**Montaje:** CapCut / iMovie / DaVinci. Laptop a pantalla completa; el iPhone entra como *picture-in-picture* a la derecha (≈ 30 % de alto) solo en los shots donde se usa. Sin música o música muy baja. Subtítulos en inglés opcionales (los jueces de EAG/HSK son internacionales) — si hay tiempo, poner el texto de cada shot como subtítulo.

**Antes de grabar:** `pap_connect` ya hecho, visa con límite 100, contacto `oracle` agregado, wallet con gas, explorer abierto en `AgentPassport`. Ensayar una vez sin grabar. Grabar el flujo completo **dos veces** y usar la mejor toma.

---

## Storyboard

| # | Tiempo | Pantalla | Qué se ve | Voz en off (ES) |
|---|---|---|---|---|
| 1 | 0:00–0:08 | Título (fondo blanco, logo, texto) | "Passport Agent Protocol" · "Your agent has a passport. You stamp the visas." · Ethereum Builders Tour Cali · HashKey Chain | *Passport Agent Protocol. Tu agente tiene pasaporte: tú le pones visas desde el celular, y los servicios lo dejan pasar sin saber quién eres.* |
| 2 | 0:08–0:22 | Terminal: `cat .env` → no hay `PRIVATE_KEY` | Claude Code abierto en el repo; se ve `.mcp.json` con el server `pap` | *Hoy un agente de IA tiene dos opciones: una llave privada en un punto-env, con la que puede hacer todo... o nada. No hay punto medio. Este agente no tiene ninguna llave. Solo tiene una herramienta: pedir permiso.* |
| 3 | 0:22–0:32 | Terminal: se escribe el prompt | `Paga 5 demoUSDT a oracle por la consulta de precio.` → Claude llama `pap_transfer` | *Le pido que pague cinco demo-USDT a un oráculo. El agente llama la herramienta MCP `pap_transfer`.* |
| 4 | 0:32–0:40 | Browser: `/show/request/:id` con el QR grande | El MCP abre el QR solo | *Aparece un código QR. Esto va a mi teléfono.* |
| 5 | 0:40–0:58 | iPhone (PiP grande): cámara → PWA `/approve/:id` | Pantalla: "Claude Code wants to send 5 demoUSDT to oracle · visa transfer:demoUSDT · limit 100 · used 10" | *En el teléfono veo exactamente qué quiere hacer, en lenguaje humano: quién, cuánto, a quién, y la visa que yo le di con su límite.* |
| 6 | 0:58–1:06 | iPhone: tap Approve → Face ID → "Sent ✓" + hash | Animación de Face ID | *Apruebo con Face ID. El teléfono firma una sola transacción: `AgentPassport.pay`. La llave nunca sale del dispositivo.* |
| 7 | 1:06–1:16 | Terminal: Claude recibe `{txHash, explorerUrl}` y responde | "Payment sent — https://testnet-explorer.hskchain.net/tx/0x…" | *El agente recibe el hash y sigue trabajando. Humano en el loop, en quince segundos, desde el celular.* |
| 8 | 1:16–1:28 | Browser: explorer → la tx → evento `Paid` → contrato `AgentPassport` → `PermissionGranted` | Zoom al evento | *Y todo quedó on-chain en HashKey: el registro ERC-8004 donde yo soy el dueño del pasaporte, la visa con su límite, y el pago registrado.* |
| 9 | 1:28–1:42 | Terminal: `Ahora paga 500 demoUSDT a oracle` → QR → iPhone: Approve → tx **revierte** `LimitExceeded()` | Mostrar el error en el teléfono y en el explorer | *¿Y si el agente pide más del límite? Apruebo igual... y el contrato revierte. El límite no es una regla del servidor: es del contrato.* |
| 10 | 1:42–1:52 | Slide: "Two modes" con las dos txs | Human-in-the-loop `0xe152…` · Autonomous inside the visa `0x629de0…` | *Misma visa, dos modos: aprobar cada pago desde el teléfono, o dar una visa una vez y dejar que el agente opere solo dentro de ella. En los dos casos, el contrato manda.* |
| 11 | 1:52–2:00 | Slide final: logo + `pap.devcristobalvc.com` + repo + "Compliant but private · HashKey Chain" | Roadmap en una línea: x402 gate → ZK passport | *Cualquier servicio puede verificar que hay un humano real detrás de este agente, sin saber quién es. Compliant but private. Passport Agent Protocol.* |

Total: **2:00**.

---

## Texto de voz en off completo (para leer de corrido)

> Passport Agent Protocol. Tu agente tiene pasaporte: tú le pones visas desde el celular, y los servicios lo dejan pasar sin saber quién eres.
>
> Hoy un agente de IA tiene dos opciones: una llave privada en un punto-env, con la que puede hacer todo... o nada. No hay punto medio. Este agente no tiene ninguna llave. Solo tiene una herramienta: pedir permiso.
>
> Le pido que pague cinco demo-USDT a un oráculo. El agente llama la herramienta MCP `pap_transfer`. Aparece un código QR. Esto va a mi teléfono.
>
> En el teléfono veo exactamente qué quiere hacer, en lenguaje humano: quién, cuánto, a quién, y la visa que yo le di con su límite. Apruebo con Face ID. El teléfono firma una sola transacción: `AgentPassport.pay`. La llave nunca sale del dispositivo.
>
> El agente recibe el hash y sigue trabajando. Humano en el loop, en quince segundos, desde el celular.
>
> Y todo quedó on-chain en HashKey: el registro ERC-8004 donde yo soy el dueño del pasaporte, la visa con su límite, y el pago registrado.
>
> ¿Y si el agente pide más del límite? Apruebo igual... y el contrato revierte. El límite no es una regla del servidor: es del contrato.
>
> Misma visa, dos modos: aprobar cada pago desde el teléfono, o dar una visa una vez y dejar que el agente opere solo dentro de ella. En los dos casos, el contrato manda.
>
> Cualquier servicio puede verificar que hay un humano real detrás de este agente, sin saber quién es. Compliant but private. Passport Agent Protocol.

(≈ 190 palabras · ~1:50 a ritmo normal; deja aire en los shots 4 y 6.)

---

## Slides que hay que hacer (3)

1. **Título** (shot 1): fondo blanco, logo, "Passport Agent Protocol", frase, "Ethereum Builders Tour: Cali · EAG × HashKey Chain".
2. **Two modes** (shot 10): dos columnas con las dos txs y sus links.
3. **Cierre** (shot 11): logo, `pap.devcristobalvc.com`, `github.com/DevCristobalvc/ethereum-builders-tour-cali`, "Compliant but private", roadmap en una línea.

Hacerlas en Figma/Keynote/Google Slides con los mismos tokens de la web: fondo `#fafafa`, texto `#18182c`, acento `#0099ff`, Inter.

---

## Entrega

- Exportar 1080p, H.264, ≤ 100 MB.
- Guardar local en `docs/demo.mp4` (**no** commitear si pesa > 50 MB) + copia en el teléfono.
- Subir a YouTube como **unlisted**, título "Passport Agent Protocol — Ethereum Builders Tour Cali 2026", y pegar el link en `docs/SUBMISSION.md` y en Devfolio.
- Si no hay tiempo de montar: subir la toma cruda del laptop con la voz en off encima; el iPhone en cámara es suficiente.
