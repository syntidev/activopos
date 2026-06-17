"""
ActivoPOS - Sprint 6 E2E Tests (Capa 3 — servidor limpio)
Flujo 1: Auth | Flujo 2: POS | Flujo 3: Inventario | Flujo 4: Catalogo
"""
import os
import sys
import json
import http.client
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"
SCREENSHOTS = r"C:\laragon\www\activopos\.doc\screenshots\sprint6"

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

results = {
    "auth": {},
    "pos": {},
    "inventario": {},
    "catalogo": {},
    "bugs": []
}


def ss(page, name):
    path = os.path.join(SCREENSHOTS, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    print(f"  [SS] {name}.png")
    return path


def report_bug(flujo, route, expected, actual):
    bug = {"flujo": flujo, "route": route, "expected": expected, "actual": str(actual)[:300]}
    results["bugs"].append(bug)
    print(f"  [BUG] {flujo} | {route} | expected: {expected} | got: {str(actual)[:120]}")


def api_login(email="admin@activopos.com", password="admin123"):
    """Call login API, return (status, cookie_value)."""
    conn = http.client.HTTPConnection("localhost", 3000)
    conn.request("POST", "/api/auth/login",
                 json.dumps({"email": email, "password": password}),
                 {"Content-Type": "application/json"})
    resp = conn.getresponse()
    resp.read()
    ch = resp.getheader("Set-Cookie", "")
    conn.close()
    cv = ch.split("activopos_session=")[1].split(";")[0].strip() if "activopos_session=" in ch else None
    return resp.status, cv


def inject_session(ctx, cookie_val):
    ctx.add_cookies([{
        "name": "activopos_session",
        "value": cookie_val,
        "domain": "localhost",
        "path": "/",
        "httpOnly": True,
        "sameSite": "Lax",
    }])


def api_get(path, cookie):
    conn = http.client.HTTPConnection("localhost", 3000)
    conn.request("GET", path, None, {"Cookie": f"activopos_session={cookie}"})
    resp = conn.getresponse()
    raw = resp.read()
    conn.close()
    try:
        return resp.status, json.loads(raw)
    except Exception:
        return resp.status, {}


# ─────────────────────────────────────────────
# FLUJO 1 - AUTH
# ─────────────────────────────────────────────
def test_auth(browser):
    print("\n=== FLUJO 1: Auth ===")
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()

    # 1. GET / → /landing.html
    page.goto(BASE_URL + "/")
    page.wait_for_load_state("networkidle")
    ss(page, "c3_auth_01_root")
    is_landing = "/landing.html" in page.url or "/login" in page.url
    results["auth"]["redirect_root"] = is_landing
    if not is_landing:
        report_bug("auth", "/", "redirect to /landing.html or /login", f"got {page.url}")
    print(f"  [1] GET / -> {page.url} ({'PASS' if is_landing else 'FAIL'})")

    # 2. /pos sin sesion → /login
    page.goto(BASE_URL + "/pos")
    page.wait_for_load_state("networkidle")
    ss(page, "c3_auth_02_pos_nosession")
    redir_ok = "/login" in page.url
    results["auth"]["redirect_protected"] = redir_ok
    if not redir_ok:
        report_bug("auth", "/pos sin sesion", "redirect to /login", f"got {page.url}")
    print(f"  [2] GET /pos (sin sesion) -> {page.url} ({'PASS' if redir_ok else 'FAIL'})")

    # 3. Login wrong → 401
    status_wrong, _ = api_login("wrong@x.com", "wrongpass")
    got_401 = status_wrong == 401
    results["auth"]["wrong_creds_401"] = got_401
    if not got_401:
        report_bug("auth", "POST /api/auth/login wrong", "HTTP 401", f"HTTP {status_wrong}")
    print(f"  [3] Login wrong -> HTTP {status_wrong} ({'PASS' if got_401 else 'FAIL'})")

    # 4. Login correcto → 200 + cookie
    status_ok, cookie = api_login()
    got_200 = status_ok == 200 and bool(cookie)
    results["auth"]["login_200_cookie"] = got_200
    if not got_200:
        report_bug("auth", "POST /api/auth/login correct", "HTTP 200 + cookie", f"HTTP {status_ok} cookie={cookie}")
    print(f"  [4] Login correcto -> HTTP {status_ok} cookie={'SET' if cookie else 'MISSING'} ({'PASS' if got_200 else 'FAIL'})")

    # 5. /escritorio con sesion
    ctx.close()
    ctx2 = browser.new_context(viewport={"width": 1280, "height": 900})
    page2 = ctx2.new_page()
    if cookie:
        inject_session(ctx2, cookie)
    page2.goto(BASE_URL + "/escritorio")
    page2.wait_for_load_state("networkidle")
    page2.wait_for_timeout(1000)
    ss(page2, "c3_auth_05_escritorio")
    dashboard_ok = "/login" not in page2.url and "/escritorio" in page2.url
    results["auth"]["escritorio_with_session"] = dashboard_ok
    if not dashboard_ok:
        report_bug("auth", "/escritorio con sesion", "show dashboard", f"redirected to {page2.url}")
    print(f"  [5] /escritorio con sesion -> {page2.url} ({'PASS' if dashboard_ok else 'FAIL'})")
    ctx2.close()


# ─────────────────────────────────────────────
# FLUJO 2 - POS
# ─────────────────────────────────────────────
def test_pos(browser):
    print("\n=== FLUJO 2: POS ===")

    status, cookie = api_login()
    if status != 200 or not cookie:
        print("  [SKIP] Login failed")
        return

    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    inject_session(ctx, cookie)
    page = ctx.new_page()

    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(str(e)))

    # 1. /pos carga
    page.goto(BASE_URL + "/pos")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    ss(page, "c3_pos_01_load")
    pos_ok = "/pos" in page.url and "/login" not in page.url
    results["pos"]["pos_loads"] = pos_ok
    print(f"  [1] /pos -> {'PASS' if pos_ok else 'FAIL'} ({page.url})")

    # 2. Sin errores JS criticos
    toast_errors = [e for e in console_errors if "useToast" in e or "Cannot read" in e]
    no_errors = len(toast_errors) == 0
    results["pos"]["no_js_errors"] = no_errors
    if not no_errors:
        report_bug("pos", "/pos JS", "no useToast errors", str(toast_errors[:2]))
    print(f"  [2] Errores JS criticos -> {'NONE (PASS)' if no_errors else 'FAIL: ' + str(toast_errors[:1])}")

    if not pos_ok:
        print("  [SKIP] POS no cargo")
        ctx.close()
        return

    # 3. Modal caja si aparece
    modal_appeared = False
    try:
        if page.locator('text="Abrir Caja"').is_visible():
            modal_appeared = True
            page.locator('input[type="number"]').first.fill("100")
            page.locator('button:has-text("Abrir"), button:has-text("Confirmar")').first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)
            ss(page, "c3_pos_03_caja_opened")
            results["pos"]["caja_apertura"] = True
            print("  [3] Modal caja -> abierta PASS")
    except Exception:
        pass
    if not modal_appeared:
        results["pos"]["caja_apertura"] = "no_modal_already_open"
        print("  [3] Modal caja -> no aparecio (ya abierta)")

    # 4. Busqueda — usar selector exacto de clase
    search_ok = False
    product_count = 0
    try:
        # Use exact class selector found in DOM inspection
        search = page.locator("input.pos_searchInput__VSo4g")
        if search.count() == 0:
            # Fallback: any input in pos
            search = page.locator("input[placeholder*='Buscar' i], input[placeholder*='buscar' i]").first
        search.fill("Camisa")
        page.wait_for_timeout(2000)
        ss(page, "c3_pos_04_search")

        # Check products via API (separate from UI, to distinguish bug source)
        s_api, d_api = api_get("/api/products/search?q=Camisa&limit=20", cookie)
        api_products = d_api.get("products", [])
        results["pos"]["search_api_count"] = len(api_products)

        if len(api_products) == 0:
            report_bug("pos", "GET /api/products/search?q=Camisa", "productos en resultado", "0 productos (BUG-06: search API retorna vacio)")
            print(f"  [4] BUG-06: /api/products/search retorna 0 resultados (productos existen en DB)")
        else:
            # Check if they appear in UI
            product_count = page.locator('[class*="productCard" i], [class*="pos_product" i]').count()
            search_ok = product_count > 0
            if not search_ok:
                report_bug("pos", "/pos search UI", "cards visibles", f"API={len(api_products)} pero UI muestra 0 cards")
            print(f"  [4] Busqueda 'Camisa' -> API={len(api_products)} prod, UI={product_count} cards ({'PASS' if search_ok else 'FAIL'})")

        results["pos"]["busqueda_productos"] = search_ok
    except Exception as e:
        results["pos"]["busqueda_productos"] = False
        report_bug("pos", "/pos search", "search works", str(e))
        print(f"  [4] Busqueda -> FAIL ({str(e)[:80]})")

    # 5. Agregar producto (si hay cards) o reportar BUG-06
    if product_count > 0:
        try:
            card = page.locator('[class*="productCard" i] button, [class*="pos_product" i]').first
            card.click()
            page.wait_for_timeout(1000)
            ss(page, "c3_pos_05_added")
            ticket_items = page.locator('[class*="ticket" i] li, [class*="ticketItem" i]').count()
            add_ok = ticket_items > 0
            results["pos"]["agregar_ticket"] = add_ok
            print(f"  [5] Agregar -> {ticket_items} items en ticket ({'PASS' if add_ok else 'FAIL'})")
        except Exception as e:
            results["pos"]["agregar_ticket"] = False
            print(f"  [5] Agregar -> FAIL ({str(e)[:80]})")
    else:
        results["pos"]["agregar_ticket"] = "blocked_by_bug06"
        print("  [5] Agregar -> BLOCKED (BUG-06: sin productos en busqueda)")

    # 6. Totales USD/Bs en la pagina
    content = page.content()
    has_usd = "$" in content or "USD" in content
    has_bs = "Bs" in content or "bs." in content.lower()
    totals_ok = has_usd and has_bs
    results["pos"]["totales_usd_bs"] = totals_ok
    if not totals_ok:
        report_bug("pos", "/pos totales", "USD y Bs visibles", f"USD={has_usd} Bs={has_bs}")
    print(f"  [6] Totales USD/Bs -> USD={has_usd} Bs={has_bs} ({'PASS' if totals_ok else 'FAIL'})")

    # 7. Procesar Pago (si hay items en ticket)
    ticket_has_items = page.locator('[class*="ticket" i] li, [class*="ticketItem" i]').count() > 0
    if ticket_has_items:
        try:
            pay_btn = page.locator('button:has-text("Procesar Pago"), button:has-text("Cobrar")').first
            if pay_btn.count() > 0 and pay_btn.is_visible():
                pay_btn.click()
                page.wait_for_timeout(1500)
                ss(page, "c3_pos_07_pago_modal")
                # Select efectivo
                for sel in ['button:has-text("Efectivo")', '[data-method="cash"]']:
                    el = page.locator(sel).first
                    if el.count() > 0 and el.is_visible():
                        el.click()
                        page.wait_for_timeout(500)
                        break
                # Confirm
                for sel in ['button:has-text("Confirmar")', 'button:has-text("Procesar")', 'button[type="submit"]']:
                    el = page.locator(sel).first
                    if el.count() > 0 and el.is_visible():
                        el.click()
                        page.wait_for_load_state("networkidle")
                        page.wait_for_timeout(2000)
                        break
                ss(page, "c3_pos_07_resultado")
                post_content = page.content()
                ticket_ok = "ticket" in post_content.lower() or "exitoso" in post_content.lower() or "comprobante" in post_content.lower()
                results["pos"]["cobro_exitoso"] = ticket_ok
                print(f"  [7] Pago -> {'PASS' if ticket_ok else 'POSIBLE FAIL - revisar SS'}")
        except Exception as e:
            results["pos"]["cobro_exitoso"] = False
            print(f"  [7] Pago -> FAIL ({str(e)[:80]})")
    else:
        results["pos"]["cobro_exitoso"] = "blocked_no_ticket_items"
        print("  [7] Pago -> BLOCKED (ticket vacio por BUG-06)")

    ss(page, "c3_pos_final")
    ctx.close()


# ─────────────────────────────────────────────
# FLUJO 3 - INVENTARIO
# ─────────────────────────────────────────────
def test_inventario(browser):
    print("\n=== FLUJO 3: Inventario ===")

    status, cookie = api_login()
    if status != 200 or not cookie:
        print("  [SKIP] Login failed")
        return

    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    inject_session(ctx, cookie)
    page = ctx.new_page()

    # 1. /productos carga
    page.goto(BASE_URL + "/productos")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    ss(page, "c3_inv_01_list")
    prod_ok = "/productos" in page.url and "/login" not in page.url
    results["inventario"]["lista_productos"] = prod_ok
    print(f"  [1] /productos -> {'PASS' if prod_ok else 'FAIL'} ({page.url})")

    if not prod_ok:
        ctx.close()
        return

    # 2. Tabla visible (esperar render completo)
    try:
        page.wait_for_selector("table, tr", timeout=5000)
        row_count = page.locator("tr").count()
        table_ok = row_count > 0
        results["inventario"]["tabla_visible"] = table_ok
        if not table_ok:
            report_bug("inventario", "/productos tabla", "table con rows", f"0 rows")
        print(f"  [2] Tabla -> {row_count} rows ({'PASS' if table_ok else 'FAIL'})")
    except Exception as e:
        results["inventario"]["tabla_visible"] = False
        report_bug("inventario", "/productos tabla", "table visible", str(e))
        print(f"  [2] Tabla -> FAIL ({str(e)[:60]})")

    # 3. Crear producto — modal con IDs: #pm-name, #pm-price
    created = False
    try:
        nuevo_btn = page.locator(
            'button.productos_btnPrimary__pAJ__, '
            'button[class*="btnPrimary" i], '
            'button:has-text("Nuevo")'
        ).first
        if nuevo_btn.count() > 0 and nuevo_btn.is_visible():
            nuevo_btn.click()
            page.wait_for_timeout(1500)
            ss(page, "c3_inv_03_form")

            # Fill name — form uses #pm-name
            name_filled = False
            for sel in ['#pm-name', 'input[id*="name" i]', 'input[placeholder*="Queso" i]', 'input[type="text"]']:
                inp = page.locator(sel).first
                if inp.count() > 0 and inp.is_visible():
                    inp.fill("Prod E2E Capa3")
                    name_filled = True
                    break

            # Fill cost — #pm-price is readonly (calculated). Use #pm-cost.
            for sel in ['#pm-cost', 'input[id*="cost" i]']:
                inp = page.locator(sel).first
                if inp.count() > 0 and inp.is_visible():
                    inp.fill("7.69")
                    break

            # Submit — "Guardar Producto" button
            for sel in ['button.modals_btnPrimary__Ka9Ck', 'button:has-text("Guardar Producto")', 'button:has-text("Guardar")', 'button[type="submit"]']:
                btn = page.locator(sel).first
                if btn.count() > 0 and btn.is_visible():
                    btn.click()
                    page.wait_for_load_state("networkidle")
                    page.wait_for_timeout(2000)
                    break

            ss(page, "c3_inv_03_created")
            # Verify via API (more reliable than page content check)
            _, prod_data = api_get("/api/products?limit=20", cookie)
            all_products = prod_data.get("products", [])
            created = any("Capa3" in (p.get("name") or "") for p in all_products)
            results["inventario"]["crear_producto"] = created
            results["inventario"]["name_filled"] = name_filled
            if not created:
                report_bug("inventario", "/productos crear", "Capa3 product in DB", f"products={[p.get('name') for p in all_products]}")
            print(f"  [3] Crear producto -> {'PASS' if created else 'FAIL'} (name_filled={name_filled})")
        else:
            results["inventario"]["crear_producto"] = "btn_not_visible"
            report_bug("inventario", "/productos", "Nuevo button visible", "button not found")
            print("  [3] Boton Nuevo -> no visible (revisar SS)")
    except Exception as e:
        results["inventario"]["crear_producto"] = False
        report_bug("inventario", "/productos crear", "create flow", str(e))
        print(f"  [3] Crear -> FAIL ({str(e)[:80]})")

    # 4. Verificar en lista
    try:
        page.goto(BASE_URL + "/productos")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        content = page.content()
        found = "Capa3" in content
        results["inventario"]["producto_en_lista"] = found
        if not found:
            report_bug("inventario", "/productos lista", "Capa3 in list", "not found")
        print(f"  [4] Producto en lista -> {'PASS' if found else 'FAIL'}")
    except Exception as e:
        results["inventario"]["producto_en_lista"] = False
        print(f"  [4] Verificar lista -> FAIL ({str(e)[:60]})")

    ss(page, "c3_inv_final")
    ctx.close()


# ─────────────────────────────────────────────
# FLUJO 4 - CATALOGO
# ─────────────────────────────────────────────
def test_catalogo(browser):
    print("\n=== FLUJO 4: Catalogo ===")

    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()

    failed = []
    page.on("response", lambda r: failed.append(f"{r.status} {r.url}") if r.status >= 400 else None)

    page.goto(BASE_URL + "/catalogo/demo")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    ss(page, "c3_catalogo_01")

    url_ok = "/catalogo/demo" in page.url and "/login" not in page.url
    results["catalogo"]["url_ok"] = url_ok
    if not url_ok:
        report_bug("catalogo", "/catalogo/demo", "public access no auth", f"redirected to {page.url}")
    print(f"  [1] /catalogo/demo URL -> {'PASS' if url_ok else 'FAIL'} ({page.url})")

    # Check it renders without 500
    content = page.content()
    is_500 = "500" in content and "Cannot find module" in content
    loads_ok = not is_500 and url_ok
    results["catalogo"]["no_500"] = loads_ok
    if not loads_ok:
        report_bug("catalogo", "/catalogo/demo", "no 500 error", "server error in page")
    print(f"  [2] Sin error 500 -> {'PASS' if loads_ok else 'FAIL'}")

    # Check it shows business/products (not blank)
    has_content = len(content) > 3000 and ("Activo" in content or "demo" in content.lower() or "producto" in content.lower() or "catalogo" in content.lower())
    results["catalogo"]["has_content"] = has_content
    if not has_content:
        report_bug("catalogo", "/catalogo/demo", "business content visible", "minimal or no content")
    print(f"  [3] Contenido visible -> {'PASS' if has_content else 'FAIL'} (len={len(content)})")

    # No auth redirect
    no_auth_redirect = "/login" not in page.url
    results["catalogo"]["no_auth_required"] = no_auth_redirect
    print(f"  [4] Sin redirect a login -> {'PASS' if no_auth_redirect else 'FAIL'}")

    ss(page, "c3_catalogo_final")
    ctx.close()


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def main():
    print("\n" + "="*60)
    print("  ActivoPOS - Sprint 6 E2E Tests (Capa 3)")
    print("="*60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for name, fn in [("auth", test_auth), ("pos", test_pos), ("inventario", test_inventario), ("catalogo", test_catalogo)]:
            try:
                fn(browser)
            except Exception as e:
                print(f"\n[FATAL] {name}: {e}")
                results["bugs"].append({"flujo": name, "route": "FATAL", "expected": "flow", "actual": str(e)[:200]})

        browser.close()

    print("\n" + "="*60)
    print("  RESUMEN")
    print("="*60)
    print(json.dumps(results, indent=2, ensure_ascii=False))

    with open(
        r"C:\laragon\www\activopos\.doc\screenshots\sprint6\_results.json",
        "w", encoding="utf-8"
    ) as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print("\nResultados en _results.json")


if __name__ == "__main__":
    main()
