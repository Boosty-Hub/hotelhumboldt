# -*- coding: utf-8 -*-
"""Genera products.json y spaces.json a partir de los volcados de _analysis."""
import re, json, unicodedata, os
from collections import Counter

AN = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(AN)
OUT = os.path.join(ROOT, "humboldt", "prisma", "seed-data")
os.makedirs(OUT, exist_ok=True)


def parse_sheets(path):
    sheets = {}
    cur = None
    with open(path, encoding="utf-8") as f:
        for line in f:
            m = re.match(r'SHEET: (.+)$', line.strip())
            if m and not line.startswith(' '):
                cur = m.group(1).strip()
                sheets[cur] = {}
                continue
            if cur is None:
                continue
            for tok in line.rstrip("\n").split(" | "):
                tok = tok.strip()
                cm = re.match(r'^([A-Z]{1,2})(\d+)=(.*)$', tok)
                if cm:
                    col, row, val = cm.group(1), int(cm.group(2)), cm.group(3)
                    val = re.sub(r'\s*\[=.*$', '', val).strip()
                    sheets[cur].setdefault(row, {})[col] = val
    return sheets


def num(v):
    try:
        return round(float(v), 3)
    except (TypeError, ValueError):
        return None


def clean_name(s):
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'\s*\.\s*$', '', s)  # punto final solitario
    return s


ALIASES = {
    "MINI CHEESSE CAKE": "MINI CHEESE CAKE",
    "MIINI PIE DE MANZANA": "MINI PIE DE MANZANA",
    "MINI PROFITEROL": "MINI PROFITEROLES",
    "MINI PANACOTTA DE MANGO": "MINI PANNA COTTA DE MANGO",
    "MINI CREAM CARAMEL (QUESILLO TRADICIONAL)": "MINI CREAM CARAMEL (QUESILLO)",
}


def norm(s):
    s = clean_name(s).upper()
    s = ''.join(c for c in unicodedata.normalize('NFD', s)
                if unicodedata.category(c) != 'Mn')
    s = s.replace("(POR BOTELLA)", "").strip()
    s = re.sub(r'\s+', ' ', s)
    return ALIASES.get(s, s)


AG = "Alternativa Gastronómica"
products = {}


def add(name, category, type_, unit, listPrice=None, cost=None, supplier=None,
        minPax=None, unitsPerPax=None, priceContext=None, notes=None, key=None):
    name = clean_name(name)
    k = key or norm(name)
    p = products.get(k)
    if p is None:
        products[k] = {
            "name": name, "category": category, "type": type_, "unit": unit,
            "listPrice": listPrice, "cost": cost, "supplier": supplier,
            "minPax": minPax, "unitsPerPax": unitsPerPax,
            "priceContext": priceContext, "notes": notes,
            "_prices": [listPrice] if listPrice is not None else [],
        }
        return products[k]
    if listPrice is not None:
        p["_prices"].append(listPrice)
        if p["listPrice"] is None or listPrice > p["listPrice"]:
            p["listPrice"] = listPrice
    if cost is not None:
        p["cost"] = cost
    if supplier:
        p["supplier"], p["type"] = supplier, "PROVEEDOR"
    if minPax and not p["minPax"]:
        p["minPax"] = minPax
    if unitsPerPax and not p["unitsPerPax"]:
        p["unitsPerPax"] = unitsPerPax
    if p["priceContext"] is None and priceContext:
        p["priceContext"] = priceContext
    if notes:
        p["notes"] = (p["notes"] + " | " + notes) if p["notes"] else notes
    return p


def extract_pax_meta(name):
    minPax = unitsPerPax = None
    m = re.search(r'A PARTIR DE (\d+) PAX', name, re.I)
    if m:
        minPax = int(m.group(1))
    m = re.search(r'\((\d+)\s*(?:UND\s*)?(?:X|POR)\s*(?:PERSONA|PAX)\)', name, re.I)
    if m:
        unitsPerPax = int(m.group(1))
    m = re.search(r'\((\d+)UND POR PAX\)', name, re.I)
    if m:
        unitsPerPax = int(m.group(1))
    return minPax, unitsPerPax


# ---------- 1. Catalogo hotel (hoja Productos, libro Alimentos Mary) ----------
hot = parse_sheets(os.path.join(AN, "Alimentos Mary - Diana Sánchez.txt"))["Productos"]

HOTEL_RANGES = [
    (3, 4,   "Sandwiches y hamburguesas", "PROPIO", "UND", None),
    (5, 10,  "Buffets", "PROPIO", "PAX", "BUFFET"),
    (11, 33, "Postres", "PROPIO", "UND", "PIEZA"),
    (34, 36, "Postres", "PROPIO", "KG", None),
    (37, 80, "Pasapalos", "PROPIO", "UND", "PIEZA"),
    (81, 89, "Menús 3 tiempos", "PROPIO", "PAX", None),
    (90, 95, "Menús 4 tiempos", "PROPIO", "PAX", "BUFFET"),
    (96, 107, "Estaciones", "PROPIO", "PAX", None),
    (108, 116, "Coffee Breaks", "PROPIO", "PAX", None),
    (117, 135, "Bebidas sin alcohol", "PROPIO", "UND", None),
    (136, 142, "Espacios", "ESPACIO", "EVENTO", None),
    (143, 144, "Mobiliario", "SERVICIO", "UND", None),
    (145, 146, "Personal y servicios", "SERVICIO", "EVENTO", None),
    (147, 149, "Traslados", "SERVICIO", "PAX", None),
    (150, 151, "Descorche", "SERVICIO", "BOTELLA", None),
    (152, 157, "Hospedaje", "HOSPEDAJE", "DIA", None),
    (158, 171, "Otros", "COMODIN", "EVENTO", None),
    (172, 177, "Estaciones", "PROPIO", "PAX", None),
    (178, 178, "Otros", "COMODIN", "EVENTO", None),
    (179, 192, "Pasapalos", "PROPIO", "UND", "PIEZA"),
    (193, 197, "Insumos", "INSUMO", "CAJA", None),
    (198, 198, "Insumos", "INSUMO", "KG", None),
    (199, 199, "Insumos", "INSUMO", "UND", None),
    (200, 202, "Otros", "COMODIN", "PAX", None),
    (203, 205, "Menús navideños", "PROPIO", "PAX", "EMPLATADO"),
    (208, 225, "Panadería", "PROPIO", "UND", "PIEZA"),
    (227, 234, "Pastelería", "PROPIO", "UND", "PIEZA"),
    (236, 240, "Saludables", "PROPIO", "UND", "PIEZA"),
    (242, 245, "Desayunos", "PROPIO", "UND", "PIEZA"),
    (247, 266, "Pasapalos", "PROPIO", "UND", "PIEZA"),
    (268, 289, "Pasapalos", "PROPIO", "UND", "PIEZA"),
    (291, 294, "Bebidas sin alcohol", "PROPIO", "UND", None),
    (296, 296, "Bebidas sin alcohol", "PROPIO", "UND", None),
]

COMODIN_MAP = {
    158: ("Personal y servicios", "EVENTO"), 159: ("Personal y servicios", "EVENTO"),
    160: ("Mobiliario", "EVENTO"), 161: ("Audiovisuales y técnica", "EVENTO"),
    162: ("Audiovisuales y técnica", "EVENTO"), 163: ("Menús 4 tiempos", "PAX"),
    165: ("Bebidas sin alcohol", "UND"), 166: ("Bebidas alcohólicas", "BOTELLA"),
    167: ("Bebidas alcohólicas", "BOTELLA"), 168: ("Buffets", "PAX"),
    169: ("Personal y servicios", "EVENTO"), 170: ("Otros", "EVENTO"),
    171: ("Otros", "UND"), 178: ("Otros", "EVENTO"),
    200: ("Otros", "PAX"), 201: ("Otros", "EVENTO"), 202: ("Otros", "PAX"),
}
SKIP_ROWS = {1, 2, 164}  # encabezado, fila-hack ".", duplicado Restaurante Bonpland

BOTTLE_NAMES = {"AGUA FONTANA (500 ML)", "AGUA FONTANA (750 ML)",
                "AGUA MINERAL (BOTELLA 330 ML)", "AGUA SPARKLIN"}
NOTES_HOTEL = {
    137: "En cotizaciones se ha facturado a 4500/día (Alimentos Mary, Latin Aesthetic).",
    202: "Variante 'Desayuno' en el libro Latin Aesthetic.",
    296: "Genérico del catálogo hotel; A.G. ofrece mocktails específicos a 10 (costo 7).",
    148: "Comodín de traslado terrestre; en cotizaciones se usó referencia de 60 USD por unidad (9-10 personas).",
}

for start, end, cat, typ, unit, ctx in HOTEL_RANGES:
    for row in range(start, end + 1):
        if row in SKIP_ROWS or row not in hot:
            continue
        cells = hot[row]
        name = cells.get("A")
        if not name or name == ".":
            continue
        price = num(cells.get("B"))
        c, u, t, pc = cat, unit, typ, ctx
        if row in COMODIN_MAP:
            c, u = COMODIN_MAP[row]
            t = "COMODIN"
        elif price is None and t == "PROPIO":
            t = "COMODIN"
        if c == "Bebidas sin alcohol":
            cn = clean_name(name).upper()
            if cn in BOTTLE_NAMES:
                u = "BOTELLA"
            elif cn.startswith("ESTACION"):
                u = "PAX"
        if 81 <= row <= 89:
            pc = "BUFFET" if clean_name(name).upper().startswith("BUFFET") else "EMPLATADO"
        if row == 148:
            u = "VEHICULO"
        if row == 149:
            c, t, u = "Personal y servicios", "SERVICIO", "PAX"
        minPax, upp = extract_pax_meta(name)
        notes = NOTES_HOTEL.get(row)
        if row in (34, 35, 36):
            notes = "Precio por torta de 1 kg (rinde 8 pax)."
        if row == 205:
            notes = ("Catálogo Productos lista 17.5 (= monto proveedor A.G. en la cotización); "
                     "vendido a 28/pax en cotización Alimentos Mary.")
            add(name, c, "PROVEEDOR", u, listPrice=28, cost=17.5, supplier=AG,
                minPax=minPax, unitsPerPax=upp, priceContext=pc, notes=notes)
            continue
        add(name, c, t, u, listPrice=price, minPax=minPax, unitsPerPax=upp,
            priceContext=pc, notes=notes)

# extra: Refrigerio (variante del libro Latin Aesthetic, fila 171)
add("Refrigerio", "Coffee Breaks", "PROPIO", "PAX", listPrice=10,
    notes=("Solo en el catálogo del libro Latin Aesthetic (fila 171, sustituye a "
           "'Ticket de Restaurante Humboldt'); usado como refrigerio AM/PM "
           "(1 opción salada y 1 dulce)."))

# espacios vistos solo en cotizaciones
add("discoteca La Boite", "Espacios", "ESPACIO", "DIA", listPrice=1000,
    notes="Catálogo: 1000 'uso DIARIO'; en Sportbitz se cotizó a 2000 con descuento especial (cobrado 1500 / 1637.92).")
add("Antigua Estación", "Espacios", "ESPACIO", "EVENTO", listPrice=1000,
    notes="Sin precio en el catálogo Productos; tarifa 1000 observada en cotización Sportbitz.")
add("Restaurante Humboldt", "Espacios", "ESPACIO", "EVENTO", listPrice=None,
    notes="No está en el catálogo Productos (#N/A); referenciado a 3000 pero otorgado como cortesía en Sportbitz.")

products[norm("Restaurante Bonpland")]["notes"] = (
    "Sin tarifa en catálogo; también listado como ítem comodín en la sección de servicios.")
products[norm("ESTACION DE CAFÉ (AMERICANO)")]["notes"] = (
    "Variante '(AMERICANO O LATTE)' usada en cotización Sportbitz.")

# ---------- 2. Catalogo A.G. ----------
ag = parse_sheets(os.path.join(AN, "MENU DE EVENTOS A.G - copia 6-03-26.txt"))


def ag_items(sheet, r1, r2, sug_col, desc_col):
    out = []
    for row in range(r1, r2 + 1):
        cells = ag[sheet].get(row)
        if not cells:
            continue
        name = cells.get("B")
        if not name:
            continue
        out.append((row, clean_name(name), num(cells.get(sug_col)),
                    num(cells.get(desc_col)), cells))
    return out


AG_GENERAL = [
    ("EVENTOS BEBIDAS", 5, 16, "Bebidas sin alcohol", "UND", None, None),
    ("EVENTOS BEBIDAS", 19, 22, "Bebidas sin alcohol", "UND", None, "Jugos & smoothies A.G."),
    ("EVENTOS BEBIDAS", 25, 27, "Bebidas sin alcohol", "UND", None, "Mocktail A.G."),
    ("EVENTOS BEBIDAS", 30, 34, "Bebidas alcohólicas", "UND", None, "Cóctel A.G."),
    ("EVENTOS BEBIDAS", 38, 42, "Bebidas alcohólicas", "UND", None, "Mezclador de cóctel A.G. (sin licor)"),
    ("EVENTOS BEBIDAS", 45, 45, "Bebidas alcohólicas", "UND", None, None),
    ("EVENTOS BEBIDAS", 48, 49, "Descorche", "BOTELLA", None, None),
    ("EVENTOS COMIDA", 8, 25, "Panadería", "UND", "PIEZA", None),
    ("EVENTOS COMIDA", 28, 35, "Pastelería", "UND", "PIEZA", None),
    ("EVENTOS COMIDA", 38, 42, "Saludables", "UND", "PIEZA", None),
    ("EVENTOS COMIDA", 45, 48, "Desayunos", "UND", "PIEZA", None),
    ("EVENTOS COMIDA", 51, 70, "Pasapalos", "UND", "PIEZA", "Pasapalos calientes A.G."),
    ("EVENTOS COMIDA", 73, 94, "Pasapalos", "UND", "PIEZA", "Pasapalos fríos A.G."),
    ("EVENTOS COMIDA", 97, 106, "Sandwiches y hamburguesas", "UND", None, None),
]
BOTTLE_AG = {"AGUA GASIFICADA SPARKLIN", "AGUA MINALBA 330 ML",
             "AGUA MINERAL FONTANA", "MALTA EN BOTELLA"}
BOTTLE_AG_N = {norm(x) for x in BOTTLE_AG}

for sheet, r1, r2, cat, unit, ctx, secnote in AG_GENERAL:
    for row, name, sug, desc, cells in ag_items(sheet, r1, r2, "E", "G"):
        u = "BOTELLA" if norm(name) in BOTTLE_AG_N else unit
        notes = secnote
        upp = None
        if name.upper().startswith("PALMERITAS"):
            upp = 2
            notes = (notes + " | " if notes else "") + "Precio por 2 unidades."
        special = cells.get("H")
        if special and special != "Modificado":
            notes = (notes + " | " if notes else "") + special + " (A.G.)"
        nm = name
        if sheet == "EVENTOS BEBIDAS" and 38 <= row <= 42 and name.upper().startswith("MIMOSA"):
            nm = name + " - MEZCLADOR"  # evita colision exacta con el coctel MIMOSA
        add(nm, cat, "PROVEEDOR", u, listPrice=sug, cost=desc, supplier=AG,
            unitsPerPax=upp, priceContext=ctx, notes=notes)

AG_BUFFET_SECTIONS = [
    (20, 34, "Buffets", "PAX", "BUFFET", "Buffet A.G. - Carne de res"),
    (38, 57, "Buffets", "PAX", "BUFFET", "Buffet A.G. - Aves"),
    (61, 69, "Buffets", "PAX", "BUFFET", "Buffet A.G. - Cerdo"),
    (73, 79, "Buffets", "PAX", "BUFFET", "Buffet A.G. - Pesca"),
    (83, 95, "Buffets", "PAX", "BUFFET", "Buffet A.G. - Acompañantes"),
    (99, 107, "Buffets", "PAX", "BUFFET", "Buffet A.G. - Potajes"),
    (111, 128, "Postres", "UND", "BUFFET", "Mini postres para estación (buffet A.G.)"),
    (132, 132, "Estaciones", "PAX", "BUFFET", "Estación A.G."),
    (133, 133, "Estaciones", "PAX", "BUFFET", "Estación A.G."),
]
buffet_keys = {}
for r1, r2, cat, unit, ctx, secnote in AG_BUFFET_SECTIONS:
    for row, name, sug, desc, cells in ag_items("BUFFET", r1, r2, "G", "I"):
        notes = secnote
        if not sug:
            sug = desc = None
            notes += " | Precio no disponible en el archivo (fórmula dañada)."
        n = norm(name)
        if n in products:  # colisión con catálogo hotel -> fusionar
            add(name, cat, "PROVEEDOR", products[n]["unit"], listPrice=sug,
                cost=desc, supplier=AG, notes=notes)
        else:
            add(name, cat, "PROVEEDOR", unit, listPrice=sug, cost=desc,
                supplier=AG, priceContext=ctx, notes=notes)
        buffet_keys[n] = sug

S34 = "3 Y 4 TIEMPOS (2)"
AG_34_SECTIONS = [
    (15, 29, "Menús 3 y 4 tiempos", "Proteína res - menú emplatado A.G."),
    (33, 52, "Menús 3 y 4 tiempos", "Proteína aves - menú emplatado A.G."),
    (56, 64, "Menús 3 y 4 tiempos", "Proteína cerdo - menú emplatado A.G."),
    (68, 74, "Menús 3 y 4 tiempos", "Proteína pescado - menú emplatado A.G."),
    (78, 90, "Menús 3 y 4 tiempos", "Acompañante - menú emplatado A.G."),
    (94, 107, "Menús 3 y 4 tiempos", "Ensalada/entrada - menú emplatado A.G."),
    (111, 119, "Menús 3 y 4 tiempos", "Potaje - menú emplatado A.G."),
    (136, 148, "Postres", "Postre - menú 3/4 tiempos A.G."),
]
for r1, r2, cat, secnote in AG_34_SECTIONS:
    for row, name, sug, desc, cells in ag_items(S34, r1, r2, "G", "I"):
        n = norm(name)
        if n in buffet_keys and buffet_keys[n] == sug:
            p = products[n]
            extra = "Mismo precio como opción de menú emplatado 3/4 tiempos."
            if not p["notes"] or extra not in p["notes"]:
                p["notes"] = (p["notes"] + " | " + extra) if p["notes"] else extra
            continue
        key = n + "|EMPLATADO" if n in products else n
        add(name, cat, "PROVEEDOR", "PAX", listPrice=sug, cost=desc, supplier=AG,
            priceContext="EMPLATADO", notes=secnote, key=key)

jn = products.get(norm("JUGOS VARIOS (MELON, LECHOZA, PIÑA, PAPELON CON LIMON O PATILLA)"))
if jn:
    jn["notes"] = ((jn["notes"] + " | ") if jn["notes"] else "") + \
        "Estación de jugos A.G.: melón, lechosa, patilla, papelón con limón y piña a 6 (costo 4.2)."
jn = products.get(norm("JUGOS (NARANJA, PARCHITA O FRESA)"))
if jn:
    jn["notes"] = ((jn["notes"] + " | ") if jn["notes"] else "") + \
        "Estación de jugos A.G.: naranja, parchita y fresa a 8 (costo 5.6)."

# ---------- 3. notas de precio alterno + salida ----------
out_products = []
for k, p in products.items():
    prices = sorted({x for x in p["_prices"] if x is not None})
    if len(prices) > 1:
        alts = [x for x in prices if x != p["listPrice"]]
        if alts:
            alt_txt = "precio alterno detectado: " + ", ".join(f"{a:g}" for a in alts)
            p["notes"] = (p["notes"] + " | " + alt_txt) if p["notes"] else alt_txt
    del p["_prices"]
    out_products.append(p)

out_products.sort(key=lambda p: (p["category"], p["name"], p["priceContext"] or ""))

seen = set()
dups = []
for p in out_products:
    kk = (norm(p["name"]), p["priceContext"])
    if kk in seen:
        dups.append(kk)
    seen.add(kk)
if dups:
    print("DUPLICATES:", dups)

with open(os.path.join(OUT, "products.json"), "w", encoding="utf-8") as f:
    json.dump(out_products, f, ensure_ascii=False, indent=2)

# ---------- 4. spaces.json ----------
spaces = [
    {"name": "BAR MIRADOR (PH)", "dailyRate": 3000, "capacity": None,
     "notes": "Tarifa de catálogo 3000; en JAC Motors se cotizó a 1500 con descuento especial (cobrado 1000)."},
    {"name": "ESTAR GENERAL", "dailyRate": 3000, "capacity": None,
     "notes": "Tarifa de catálogo 3000; facturado a 4500/día en cotizaciones Alimentos Mary y Latin Aesthetic."},
    {"name": "Bar GAVIOTA", "dailyRate": 1500, "capacity": None,
     "notes": "Cotizado a 1000 con 'precio especial' (cobrado 500) en la cena Sportbitz."},
    {"name": "SALÓN REDONDO", "dailyRate": 500, "capacity": None,
     "notes": "Usado también como camerino de talento / producción (Alimentos Mary)."},
    {"name": "TERRAZA NORTE Y SUR", "dailyRate": 1000, "capacity": None, "notes": None},
    {"name": "discoteca La Boite", "dailyRate": 1000, "capacity": None,
     "notes": "Catálogo: 1000 'uso DIARIO'; en Sportbitz cotizada a 2000 con descuento especial (cobrado 1500 / 1637.92)."},
    {"name": "Antigua Estación", "dailyRate": 1000, "capacity": None,
     "notes": "Sin precio en el catálogo Productos; tarifa 1000 observada en cotización Sportbitz."},
    {"name": "Restaurante Bonpland", "dailyRate": None, "capacity": None,
     "notes": "Listado en el catálogo sin tarifa."},
    {"name": "Restaurante Humboldt", "dailyRate": None, "capacity": None,
     "notes": "No está en el catálogo (#N/A en VLOOKUP); referenciado a 3000 pero otorgado como cortesía en Sportbitz."},
    {"name": "Piscina", "dailyRate": None, "capacity": None,
     "notes": "Listado en el catálogo sin tarifa."},
]
with open(os.path.join(OUT, "spaces.json"), "w", encoding="utf-8") as f:
    json.dump(spaces, f, ensure_ascii=False, indent=2)

c = Counter(p["category"] for p in out_products)
print("TOTAL PRODUCTS:", len(out_products))
for cat, n in sorted(c.items()):
    print(f"  {cat}: {n}")
print("SPACES:", len(spaces))
print("con costo proveedor:", sum(1 for p in out_products if p["cost"] is not None),
      "| comodines:", sum(1 for p in out_products if p["type"] == "COMODIN"),
      "| proveedor:", sum(1 for p in out_products if p["type"] == "PROVEEDOR"))
