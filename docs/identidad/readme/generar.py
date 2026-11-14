# Genera las imágenes de diseño del README (docs/img/readme/*.png).
# Uso, con la web instalada (usa la fuente local de web/node_modules) y Chrome:
#   python docs/identidad/readme/generar.py
# Deja los HTML fuente en docs/identidad/readme/ y los PNG en docs/img/readme/.
import io, os, subprocess

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(AQUI)))
SALIDA = os.path.join(RAIZ, "docs", "img", "readme")
CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")

BASE = """
@font-face { font-family: "Space Grotesk"; src: url("../../web/node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2") format("woff2"); font-weight: 300 700; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1280px; overflow: hidden; background: transparent; }
body { font-family: "Space Grotesk", "Segoe UI", system-ui, sans-serif; color: #fbf6ee; }
.lienzo { position: relative; width: 1280px; border-radius: 32px; overflow: hidden; border: 1px solid rgba(255,138,76,.18);
  background: radial-gradient(820px 460px at 6% -12%, rgba(255,106,43,.30), transparent 62%), radial-gradient(680px 440px at 102% 112%, rgba(255,176,0,.13), transparent 60%), #14110f; }
.lienzo.suave { background: radial-gradient(900px 380px at 50% -40%, rgba(255,106,43,.16), transparent 65%), #14110f; }
.lienzo::before { content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image: linear-gradient(rgba(255,255,255,.032) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.032) 1px, transparent 1px);
  background-size: 48px 48px; -webkit-mask-image: radial-gradient(900px 600px at 80% 40%, #000 25%, transparent 75%); }
.lienzo > * { position: relative; }
em { font-style: normal; background: linear-gradient(180deg, #ffb000, #ff6a2b 78%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.chip { display: inline-flex; align-items: center; gap: 10px; padding: 9px 18px; border-radius: 999px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.045); font-size: 19px; font-weight: 500; white-space: nowrap; }
.chip i { width: 10px; height: 10px; border-radius: 50%; background: #58d68d; box-shadow: 0 0 0 4px rgba(88,214,141,.22); }
.tarjeta { border-radius: 24px; border: 1px solid rgba(255,138,76,.26); background: linear-gradient(165deg, rgba(255,106,43,.12), rgba(255,255,255,.02) 55%), #1a1512; }
.sombra { box-shadow: 0 30px 80px rgba(0,0,0,.5), 0 1px 0 rgba(255,255,255,.06) inset; }
.ico { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; background: #241a15; border: 1px solid rgba(255,138,76,.32); }
.ico svg { width: 30px; height: 30px; fill: none; stroke: #ff8a4c; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
"""

LOGO = '<svg class="logo" viewBox="0 0 420 120" role="img" aria-label="brasa"><g transform="translate(10,8) scale(1.04)"><path d="M53 4 C53 21 77 30 78 55 C79 75 66 90 50 90 C34 90 21 77 22 59 C23 47 30 40 35 30 C37 38 41 42 46 42 C43 29 46 14 53 4 Z" fill="#FF5A1F"/><path d="M51 42 C55 53 66 58 66 71 C66 81 59 88 50 88 C41 88 34 81 34 72 C34 64 38 60 42 55 C43 60 46 63 48 63 C47 56 48 49 51 42 Z" fill="#FFB000"/><path d="M50 66 C53 71 58 73 58 79 C58 84 54.5 87 50 87 C45.5 87 42 84 42 79.5 C42 76 44 74 46 71.5 C46.5 74 48 75 49 75 C48.5 72 49 69 50 66 Z" fill="#FFE08A"/><g transform="translate(91,17) rotate(45) scale(1.3)"><rect x="-4.5" y="-4.5" width="9" height="9" rx="1.8" fill="#FFB000"/><rect x="-16" y="-3.4" width="4.3" height="6.8" rx="1" fill="#FFB000"/><rect x="-10.8" y="-3.4" width="4.3" height="6.8" rx="1" fill="#FFB000"/><rect x="6.5" y="-3.4" width="4.3" height="6.8" rx="1" fill="#FFB000"/><rect x="11.7" y="-3.4" width="4.3" height="6.8" rx="1" fill="#FFB000"/><rect x="-7" y="-0.8" width="14" height="1.6" fill="#FFB000"/><circle cx="0" cy="6.6" r="1.7" fill="#FFB000"/></g><path d="M84.7 31.7 A16 16 0 0 1 76.3 23.3" fill="none" stroke="#FFB000" stroke-width="2.4" stroke-linecap="round"/><path d="M82.0 38.2 A23 23 0 0 1 69.8 26.0" fill="none" stroke="#FFB000" stroke-width="2.4" stroke-linecap="round" opacity="0.65"/></g><text x="139" y="82" font-family="Space Grotesk,Segoe UI,Arial,sans-serif" font-size="68" font-weight="700" fill="#FBF6EE" letter-spacing="-2">brasa</text></svg>'
SAT = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="6" height="6" rx="1" transform="rotate(45 12 12)"/><path d="M5.5 5.5l3 3M15.5 15.5l3 3M3 8l3-3 3 3-3 3zM15 16l3-3 3 3-3 3zM4 19a5 5 0 0 0 5 1"/></svg>'
CALC = '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/></svg>'
ENV = '<svg viewBox="0 0 24 24"><path d="M4 12h14M13 6l6 6-6 6"/></svg>'
OJO = '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>'
MANO = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.6 12 20 12 20z"/></svg>'
CAND = '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>'
FIRMA = '<svg viewBox="0 0 24 24"><path d="M4 16c2.5-6 4.5-9 6-9s-1 8 1 8 2.500-4 4-4 1 3 5 3M4 20.500h16"/></svg>'
CASA = '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7M6.5 9.500V20h11V9.500M10 20v-5.500h4V20"/></svg>'

PIEZAS = {}

PIEZAS["portada"] = (620, """
 .lienzo { height: 620px; }
 .marco { position: absolute; inset: 56px 60px; display: grid; grid-template-columns: 1fr 420px; gap: 52px; align-items: center; }
 .logo { height: 62px; display: block; margin: 0 0 26px -6px; }
 h1 { font-size: 66px; line-height: 1.02; letter-spacing: -.035em; font-weight: 700; }
 .bajada { margin-top: 22px; font-size: 25px; line-height: 1.38; color: #cfc3b8; max-width: 660px; }
 .chips { margin-top: 30px; display: flex; gap: 10px; flex-wrap: wrap; }
 .recibo { padding: 26px 26px 22px; transform: rotate(1.6deg); }
 .recibo header { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 14px; border-bottom: 1px dashed rgba(255,255,255,.16); }
 .recibo header b { font-size: 21px; } .recibo header span { font-size: 16px; color: #9b8e83; }
 .fila { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; font-size: 19px; color: #cfc3b8; border-bottom: 1px solid rgba(255,255,255,.06); }
 .fila b { color: #fbf6ee; font-weight: 600; } .fila b.mas { color: #ff8a4c; font-size: 22px; white-space: nowrap; }
 .ok { margin-top: 16px; padding: 12px 16px; border-radius: 14px; background: rgba(88,214,141,.10); border: 1px solid rgba(88,214,141,.34); color: #58d68d; font-size: 17px; font-weight: 600; white-space: nowrap; }
 .nota { margin-top: 10px; font-size: 14.5px; color: #9b8e83; text-align: center; }
""", f"""<div class="lienzo"><div class="marco">
 <div>
  {LOGO}
  <h1>Tu donación llega.<br><em>Podés comprobarlo.</em></h1>
  <p class="bajada">Con satélites de la NASA, brasa detecta los incendios desde el espacio y calcula cuánto cuesta combatirlos. Tu aporte llega sin intermediarios a bomberos y damnificados.</p>
  <div class="chips"><span class="chip"><i></i>Funciona hoy en Avalanche Fuji</span><span class="chip">Datos de NASA FIRMS</span><span class="chip">Sin función de retiro</span></div>
 </div>
 <div class="tarjeta sombra recibo">
  <header><b>Liberación en vivo #1</b><span>12/11/2026 · 17:21</span></header>
  <div class="fila"><span>Focos vistos por dos satélites</span><b>10</b></div>
  <div class="fila"><span>Firmas de oráculos</span><b>2 de 2</b></div>
  <div class="fila"><span>Cuartel de bomberos A</span><b class="mas">+ 4,04 USDC</b></div>
  <div class="fila"><span>Cuartel de bomberos B</span><b class="mas">+ 4,04 USDC</b></div>
  <div class="fila"><span>Familias damnificadas</span><b class="mas">+ 1,43 USDC</b></div>
  <div class="ok">✓ Huella de datos de NASA: COINCIDE</div>
  <p class="nota">Transacción real en Avalanche · queda registrada para siempre</p>
 </div>
</div></div>""")

PIEZAS["cifras"] = (210, """
 .lienzo { height: 210px; display: grid; grid-template-columns: repeat(5, 1fr); align-items: center; padding: 0 20px; }
 .c { text-align: center; padding: 0 16px; border-right: 1px solid rgba(255,255,255,.08); }
 .c:last-child { border: 0; }
 .c b { display: block; font-size: 68px; line-height: 1; letter-spacing: -.03em; font-weight: 700; }
 .c span { display: block; margin-top: 12px; font-size: 20px; line-height: 1.25; color: #cfc3b8; }
""", """<div class="lienzo suave">
 <div class="c"><b><em>2</em></b><span>satélites tienen que ver el mismo fuego</span></div>
 <div class="c"><b><em>2</em></b><span>firmas independientes para cada pago</span></div>
 <div class="c"><b><em>0</em></b><span>funciones de retiro en el contrato</span></div>
 <div class="c"><b><em>5 %</em></b><span>de comisión máxima, siempre a la vista</span></div>
 <div class="c"><b><em>100 %</em></b><span>del planeta cubierto por NASA FIRMS</span></div>
</div>""")

def herr(ico, n, titulo, texto, dato):
    return f'<div class="tarjeta h"><div class="arriba"><div class="ico">{ico}</div><span class="n">{n}</span></div><h3>{titulo}</h3><p>{texto}</p><div class="dato">{dato}</div></div>'

PIEZAS["herramientas"] = (500, """
 .lienzo { height: 500px; padding: 36px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
 .h { padding: 26px 24px 22px; display: flex; flex-direction: column; }
 .arriba { display: flex; justify-content: space-between; align-items: center; }
 .n { font-size: 20px; font-weight: 600; color: #9b8e83; letter-spacing: .08em; }
 .h h3 { margin-top: 24px; font-size: 30px; line-height: 1.08; letter-spacing: -.02em; }
 .h p { margin-top: 14px; font-size: 20.5px; line-height: 1.36; color: #cfc3b8; flex: 1; }
 .dato { min-height: 60px; margin-top: 16px; padding-top: 14px; border-top: 1px dashed rgba(255,255,255,.14); font-size: 17.5px; line-height: 1.3; color: #ff8a4c; font-weight: 600; }
""", '<div class="lienzo suave">'
    + herr(SAT, "01", "Detecta el fuego", "Dos satélites de la NASA tienen que ver el fuego en el mismo lugar. Así se filtran las falsas alarmas.", "VIIRS NOAA-20 + NOAA-21")
    + herr(CALC, "02", "Calcula cuánto hace falta", "Estima el costo de combatir cada incendio. Cada número tiene su fuente.", "Rivadavia, 210 ha ≈ 208.500 USDC")
    + herr(ENV, "03", "Envía directo", "El contrato paga a las billeteras verificadas de bomberos y damnificados. Sin intermediarios.", "70 % combate · 10 % logística · 20 % damnificados")
    + herr(OJO, "04", "Todo trazable", "Cada dólar queda en un registro público que nadie puede borrar. Cualquiera lo revisa.", "El fondo no tiene función de retiro")
    + "</div>")

def paso(ico, titulo, texto, prueba):
    return f'<div class="p"><div class="ico">{ico}</div><b>{titulo}</b><span>{texto}</span><small>✓ {prueba}</small></div>'

PIEZAS["recorrido"] = (440, """
 .lienzo { height: 440px; padding: 44px 40px 36px; }
 h2 { font-size: 34px; letter-spacing: -.02em; text-align: center; }
 .sub { margin-top: 8px; text-align: center; font-size: 20px; color: #cfc3b8; }
 .pasos { margin-top: 38px; display: grid; grid-template-columns: repeat(5, 1fr); position: relative; }
 .pasos::before { content: ""; position: absolute; left: 10%; right: 10%; top: 28px; height: 2px; background: linear-gradient(90deg, #ff6a2b, #ffb000); opacity: .55; }
 .p { text-align: center; padding: 0 12px; position: relative; }
 .p .ico { margin: 0 auto; }
 .p b { display: block; margin-top: 18px; font-size: 23px; letter-spacing: -.01em; white-space: nowrap; }
 .p span { display: block; min-height: 70px; margin-top: 8px; font-size: 17.5px; line-height: 1.32; color: #cfc3b8; }
 .p small { display: inline-block; margin-top: 10px; padding: 6px 12px; border-radius: 999px; font-size: 15px; font-weight: 600; color: #58d68d; background: rgba(88,214,141,.09); border: 1px solid rgba(88,214,141,.3); }
""", '<div class="lienzo"><h2>El recorrido de una donación, <em>con comprobante en cada paso</em></h2>'
    '<p class="sub">Nada queda en manos de un intermediario. Todo se puede revisar desde cualquier país.</p><div class="pasos">'
    + paso(MANO, "Donás", "USDC desde la web, con la comisión a la vista", "Tx de la donación")
    + paso(CAND, "El fondo guarda", "Un contrato verificado, sin función de retiro", "Saldo público")
    + paso(SAT, "La NASA confirma", "Dos satélites ven el fuego en el mismo lugar", "Huella de los datos")
    + paso(FIRMA, "Firman dos oráculos", "Cada uno con su clave, en su propia máquina", "2 firmas")
    + paso(CASA, "Llega directo", "A bomberos y damnificados, sin intermediarios", "Tx del pago")
    + "</div></div>")

def etapa(n, titulo, texto, hoy=False):
    return f'<div class="e{" hoy" if hoy else ""}"><i>{n}</i><b>{titulo}</b><span>{texto}</span></div>'

PIEZAS["mundo"] = (290, """
 .lienzo { height: 290px; padding: 48px 36px 0; }
 .et { display: grid; grid-template-columns: repeat(6, 1fr); position: relative; }
 .et::before { content: ""; position: absolute; left: 8%; right: 8%; top: 17px; height: 2px; background: linear-gradient(90deg, #ff6a2b, rgba(255,176,0,.25)); }
 .e { text-align: center; padding: 0 8px; position: relative; }
 .e i { display: block; width: 36px; height: 36px; margin: 0 auto; border-radius: 50%; background: #241a15; border: 2px solid rgba(255,138,76,.55); font-style: normal; font-weight: 700; font-size: 17px; line-height: 32px; color: #ff8a4c; }
 .e.hoy i { background: linear-gradient(180deg, #ffb000, #ff6a2b); color: #14110f; border-color: transparent; box-shadow: 0 0 0 7px rgba(255,106,43,.18); line-height: 36px; }
 .e b { display: block; margin-top: 20px; font-size: 24px; letter-spacing: -.01em; }
 .e span { display: block; margin-top: 8px; font-size: 17.5px; line-height: 1.3; color: #cfc3b8; }
 .e.hoy b { color: #ff8a4c; }
""", '<div class="lienzo suave"><div class="et">'
    + etapa(0, "Hoy", "Salta, en Avalanche Fuji", True)
    + etapa(1, "Piloto", "Salta en red principal, con la federación de bomberos")
    + etapa(2, "Región", "NOA y NEA: Jujuy, Tucumán, Chaco, Corrientes")
    + etapa(3, "Argentina", "Todo el país, con el Servicio Nacional de Manejo del Fuego")
    + etapa(4, "Latinoamérica", "Chile, Bolivia, Paraguay, Brasil, Colombia")
    + etapa(5, "Mundo", "Cualquier incendio que vean los satélites")
    + "</div></div>")

PIEZAS["cierre"] = (250, """
 .lienzo { height: 250px; display: grid; place-items: center; text-align: center; }
 .logo { height: 54px; display: block; margin: 0 auto 14px; }
 h2 { font-size: 44px; letter-spacing: -.03em; }
 p { margin-top: 12px; font-size: 21px; color: #cfc3b8; }
""", f"""<div class="lienzo"><div>{LOGO}
 <h2>Ayuda a tiempo, <em>recursos a la vista.</em></h2>
 <p>brasafund.vercel.app · Hecho en Chaco para el mundo · El piloto es Salta</p></div></div>""")

os.makedirs(SALIDA, exist_ok=True)
io.open(os.path.join(AQUI, "base.css"), "w", encoding="utf-8", newline="\n").write(BASE.strip() + "\n")
for nombre, (alto, css, cuerpo) in PIEZAS.items():
    html = f'<!doctype html>\n<html lang="es-AR"><head><meta charset="utf-8"><title>brasa · {nombre}</title><link rel="stylesheet" href="base.css"><style>{css}</style></head>\n<body>{cuerpo}</body></html>\n'
    fuente = os.path.join(AQUI, nombre + ".html")
    io.open(fuente, "w", encoding="utf-8", newline="\n").write(html)
    png = os.path.join(SALIDA, nombre + ".png")
    subprocess.run([CHROME, "--headless=new", "--hide-scrollbars", "--default-background-color=00000000",
                    "--force-device-scale-factor=2", f"--window-size=1280,{alto}", f"--screenshot={png}",
                    "file:///" + fuente.replace("\\", "/")], check=True, capture_output=True, timeout=120)
    print("ok", nombre, os.path.getsize(png) // 1024, "KB")
