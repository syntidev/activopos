"""
ActivoPOS - Sprint 6 E2E Tests
Flujo 1: Auth | Flujo 2: POS completo | Flujo 3: Inventario
"""
import os
import sys
import json
import http.client
import urllib.request
import urllib.error
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"
SCREENSHOTS = r"C:\laragon\www\activopos\.doc\screenshots\sprint6"

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

results = {
    "auth": {},
    "pos": {},
    "inventario": {},
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


def api_login(email, password):
    """Call the login API and return the session cookie value."""
    conn = http.client.HTTPConnection("localhost", 3000)
    payload = json.dumps({"email": email, "password": password})
    conn.request("POST", "/api/auth/login", payload, {"Content-Type": "application/json"})
    resp = conn.getresponse()
    body = json.loads(resp.read())
    cookie_header = resp.getheader("Set-Cookie", "")
    conn.close()

    # Parse cookie value from: "activopos_session=VALUE; Path=...; ..."
    cookie_value = None
    if "activopos_session=" in cookie_header:
        cookie_value = cookie_header.split("activopos_session=")[1].split(";")[0].strip()

    return resp.status, body, cookie_value


def do_login_ctx(context, email, password):
    """Inject session cookie into a browser context via API login."""
    status, body, cookie_val = api_login(email, password)
    if status == 200 and cookie_val:
        context.add_cookies([{
            "name": "activopos_session",
            "value": cookie_val,
            "domain": "localhost",
            "path": "/",
            "httpOnly": True,
            "sameSite": "Lax",
        }])
        return True
    return False


# ─────────────────────────────────────────────
# FLUJO 1 - AUTH
# ─────────────────────────────────────────────
def test_auth(browser):
    print("\n=== FLUJO 1: Auth ===")
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    page = ctx.new_page()

    # 1. GET / must redirect to /login or /landing.html (unauthenticated)
    page.goto(BASE_URL + "/")
    page.wait_for_load_state("networkidle")
    ss(page, "auth_01_root_redirect")
    final = page.url
    is_login_or_landing = "/login" in final or "landing" in final
    results["auth"]["redirect_root"] = is_login_or_landing
    if not is_login_or_landing:
        report_bug("auth", "/", "redirect to /login or /landing", f"got {final}")
    print(f"  [1] GET / -> {final} ({'OK' if is_login_or_landing else 'FAIL'})")

    # 2. GET /pos without session -> redirect to /login
    page.goto(BASE_URL + "/pos")
    page.wait_for_load_state("networkidle")
    ss(page, "auth_02_pos_no_session")
    redir_login = "/login" in page.url
    results["auth"]["redirect_pos_nologin"] = redir_login
    if not redir_login:
        report_bug("auth", "/pos (sin sesion)", "redirect to /login", f"got {page.url}")
    print(f"  [2] GET /pos sin sesion -> {page.url} ({'OK' if redir_login else 'FAIL'})")

    # 3. POST /api/auth/login wrong creds -> 401
    status_wrong, _, _ = api_login("wrong@x.com", "wrongpass")
    got_401 = status_wrong == 401
    results["auth"]["login_wrong_creds_401"] = got_401
    if not got_401:
        report_bug("auth", "POST /api/auth/login (wrong creds)", "HTTP 401", f"HTTP {status_wrong}")
    print(f"  [3] POST /api/auth/login (wrong) -> {status_wrong} ({'OK' if got_401 else 'FAIL'})")

    # 4. POST /api/auth/login correct -> 200 + user/token
    status_ok, body_ok, cookie_val = api_login("admin@activopos.com", "admin123")
    got_200 = status_ok == 200 and ("user" in body_ok or "token" in body_ok)
    results["auth"]["login_correct_200"] = got_200
    if not got_200:
        report_bug("auth", "POST /api/auth/login (correct)", "HTTP 200 + user", f"HTTP {status_ok}, body={body_ok}")
    print(f"  [4] POST /api/auth/login (correct) -> {status_ok} cookie={'SET' if cookie_val else 'MISSING'} ({'OK' if got_200 else 'FAIL'})")

    # 5. GET /escritorio with valid session cookie -> 200
    # Inject cookie into a NEW context to simulate real browser session
    ctx.close()
    ctx2 = browser.new_context(viewport={"width": 1280, "height": 800})
    page2 = ctx2.new_page()
    if cookie_val:
        ctx2.add_cookies([{
            "name": "activopos_session",
            "value": cookie_val,
            "domain": "localhost",
            "path": "/",
            "httpOnly": True,
            "sameSite": "Lax",
        }])
    page2.goto(BASE_URL + "/escritorio")
    page2.wait_for_load_state("networkidle")
    page2.wait_for_timeout(1000)
    ss(page2, "auth_05_escritorio_session")
    dashboard_ok = "/login" not in page2.url
    results["auth"]["escritorio_with_session"] = dashboard_ok
    if not dashboard_ok:
        report_bug("auth", "/escritorio (with session)", "show dashboard", f"redirected to {page2.url}")
    print(f"  [5] GET /escritorio -> {page2.url} ({'OK' if dashboard_ok else 'FAIL'})")
    ctx2.close()


# ─────────────────────────────────────────────
# FLUJO 2 - POS COMPLETO
# ─────────────────────────────────────────────
def test_pos(browser):
    print("\n=== FLUJO 2: POS Completo ===")

    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    page = ctx.new_page()

    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda err: console_errors.append(f"JS ERROR: {str(err)}"))

    # Inject session cookie
    logged_in = do_login_ctx(ctx, "admin@activopos.com", "admin123")
    if not logged_in:
        report_bug("pos", "/api/auth/login", "API login", "failed to get session cookie")
        print("  [LOGIN] API login FAILED")
        ctx.close()
        return

    # 1. Navigate to /pos
    page.goto(BASE_URL + "/pos")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    ss(page, "pos_01_initial_load")
    pos_loaded = "/pos" in page.url and "/login" not in page.url
    results["pos"]["pos_loads"] = pos_loaded
    print(f"  [1] /pos -> {'OK' if pos_loaded else 'FAIL'} ({page.url})")

    # 2. Verify no critical JS errors
    toast_errors = [e for e in console_errors if "useToast" in e or "Cannot read" in e]
    no_critical_errors = len(toast_errors) == 0
    results["pos"]["no_js_errors"] = no_critical_errors
    if not no_critical_errors:
        report_bug("pos", "/pos", "no useToast JS errors", f"errors: {toast_errors[:3]}")
    server_errors = [e for e in console_errors if "500" in e]
    print(f"  [2] Sin errores JS criticos -> {'OK' if no_critical_errors else 'FAIL'} ({len(console_errors)} msgs, {len(server_errors)} 500s)")
    for e in server_errors[:3]:
        print(f"      500: {e[:120]}")

    if not pos_loaded:
        print("  [SKIP] POS no cargo - saltando tests del POS")
        ctx.close()
        return

    # 3. Handle caja apertura modal if visible
    modal_visible = False
    try:
        modal_visible = page.locator('text="Abrir Caja"').is_visible()
    except:
        pass
    if not modal_visible:
        try:
            modal_visible = page.locator('[role="dialog"]').count() > 0
        except:
            pass

    if modal_visible:
        print("  [3] Modal caja detectado - completando apertura")
        try:
            page.locator('input[type="number"]').first.fill("100")
            page.locator('button:has-text("Abrir"), button:has-text("Confirmar")').first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            results["pos"]["caja_apertura"] = True
            ss(page, "pos_03_caja_opened")
            print("  [3] Apertura de caja -> OK")
        except Exception as e:
            results["pos"]["caja_apertura"] = False
            report_bug("pos", "/pos modal caja", "complete apertura", str(e))
    else:
        results["pos"]["caja_apertura"] = "no_modal"
        print("  [3] Modal de caja -> no aparecio (caja ya abierta)")

    # 4. Search for a product
    ss(page, "pos_04_before_search")
    search_ok = False
    try:
        # Try multiple possible search selectors
        search_selectors = [
            'input[placeholder*="Buscar" i]',
            'input[placeholder*="buscar" i]',
            'input[placeholder*="Producto" i]',
            'input[type="search"]',
            'input[name="search"]',
            'input[name="query"]',
        ]
        search_input = None
        for sel in search_selectors:
            el = page.locator(sel).first
            if el.count() > 0:
                try:
                    if el.is_visible():
                        search_input = el
                        break
                except:
                    pass

        if search_input:
            search_input.fill("a")
            page.wait_for_timeout(1500)
            ss(page, "pos_04_search_results")
            # Count any product-like elements
            product_count = page.locator('text=/Bs\\.?\\s*[0-9]/, text=/USD\\s*[0-9]/').count()
            if product_count == 0:
                product_count = page.locator('button img, [class*="product" i] button').count()
            search_ok = product_count > 0
            results["pos"]["busqueda_productos"] = search_ok
            if not search_ok:
                report_bug("pos", "/pos search", "products in results", f"{product_count} items found")
            print(f"  [4] Busqueda -> {product_count} resultados ({'OK' if search_ok else 'POSIBLE FAIL'})")
        else:
            results["pos"]["busqueda_productos"] = False
            report_bug("pos", "/pos", "search input visible", "no search input found")
            print("  [4] Busqueda -> input no encontrado (revisar SS)")
    except Exception as e:
        results["pos"]["busqueda_productos"] = False
        report_bug("pos", "/pos search", "search works", str(e))
        print(f"  [4] Busqueda -> FAIL ({str(e)[:80]})")

    # 5. Add product to ticket (try clicking first visible product)
    clicked = False
    try:
        # Multiple selector strategies
        product_selectors = [
            '[data-product] button',
            '[class*="productCard" i] button',
            '[class*="product-card" i] button',
            '[class*="product" i] button[class*="add" i]',
            'button[class*="product" i]',
        ]
        for sel in product_selectors:
            el = page.locator(sel).first
            if el.count() > 0:
                try:
                    if el.is_visible():
                        el.click()
                        clicked = True
                        break
                except:
                    pass

        if not clicked:
            # Coordinate-based click on left panel grid area
            ss(page, "pos_05_debug_layout")
            # Click in the product grid area (roughly top-left of main content)
            try:
                page.mouse.click(300, 300)
                clicked = True
            except:
                pass

        page.wait_for_timeout(1000)
        ss(page, "pos_05_product_added")

        ticket_items = page.locator('[class*="ticket" i] li, [class*="ticket" i] tr, [class*="item" i][class*="ticket" i]').count()
        add_ok = ticket_items > 0
        results["pos"]["agregar_ticket"] = add_ok
        if not add_ok:
            report_bug("pos", "/pos add product", "item appears in ticket", f"clicked={clicked}, {ticket_items} items")
        print(f"  [5] Agregar producto -> clicked={clicked} items={ticket_items} ({'OK' if add_ok else 'POSIBLE FAIL'})")
    except Exception as e:
        results["pos"]["agregar_ticket"] = False
        report_bug("pos", "/pos add product", "click product", str(e))
        print(f"  [5] Agregar producto -> FAIL ({str(e)[:80]})")

    # 6. Verify USD and Bs totals
    try:
        content = page.content()
        has_usd = "$" in content or "USD" in content
        has_bs = "Bs" in content or "bs." in content.lower()
        totals_ok = has_usd and has_bs
        results["pos"]["totales_usd_bs"] = totals_ok
        if not totals_ok:
            report_bug("pos", "/pos totales", "USD and Bs visible", f"USD={has_usd} Bs={has_bs}")
        print(f"  [6] Totales USD/Bs -> USD={has_usd} Bs={has_bs} ({'OK' if totals_ok else 'FAIL'})")
    except Exception as e:
        results["pos"]["totales_usd_bs"] = False
        print(f"  [6] Totales -> FAIL ({e})")

    # 7. Cobrar flow
    try:
        cobrar_btn = page.locator('button:has-text("Cobrar"), button:has-text("cobrar")').first
        btn_visible = cobrar_btn.count() > 0 and cobrar_btn.is_visible()
        if btn_visible:
            cobrar_btn.click()
            page.wait_for_timeout(1500)
            ss(page, "pos_07_cobrar_modal")

            # Select efectivo payment method
            for sel in ['button:has-text("Efectivo")', '[data-method="cash"]', 'label:has-text("Efectivo")']:
                try:
                    el = page.locator(sel).first
                    if el.count() > 0 and el.is_visible():
                        el.click()
                        page.wait_for_timeout(500)
                        break
                except:
                    pass

            # Confirm payment
            confirmed = False
            for sel in ['button:has-text("Confirmar")', 'button:has-text("Procesar")', 'button:has-text("Pagar")', 'button[type="submit"]']:
                try:
                    el = page.locator(sel).first
                    if el.count() > 0 and el.is_visible():
                        el.click()
                        page.wait_for_load_state("networkidle")
                        page.wait_for_timeout(3000)
                        confirmed = True
                        break
                except:
                    pass

            ss(page, "pos_07_cobro_resultado")
            content_post = page.content()
            ticket_ok = (
                "ticket" in content_post.lower() or
                "comprobante" in content_post.lower() or
                "exitoso" in content_post.lower()
            )
            results["pos"]["cobro_exitoso"] = ticket_ok
            results["pos"]["ticket_generado"] = ticket_ok
            print(f"  [7] Cobro -> confirmed={confirmed} ticket={'OK' if ticket_ok else 'POSIBLE FAIL - revisar SS'}")
        else:
            results["pos"]["cobro_exitoso"] = "cobrar_btn_not_visible"
            report_bug("pos", "/pos cobrar", "Cobrar button visible", "not visible - ticket may be empty")
            print("  [7] Boton Cobrar -> no visible")
    except Exception as e:
        results["pos"]["cobro_exitoso"] = False
        report_bug("pos", "/pos cobrar", "cobrar flow", str(e))
        print(f"  [7] Cobrar -> FAIL ({str(e)[:80]})")

    ss(page, "pos_final_state")
    ctx.close()


# ─────────────────────────────────────────────
# FLUJO 3 - INVENTARIO
# ─────────────────────────────────────────────
def test_inventario(browser):
    print("\n=== FLUJO 3: Inventario ===")

    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    page = ctx.new_page()

    # Inject session cookie
    logged_in = do_login_ctx(ctx, "admin@activopos.com", "admin123")
    if not logged_in:
        report_bug("inventario", "/api/auth/login", "API login", "failed")
        ctx.close()
        return

    # 1. Navigate to /productos
    page.goto(BASE_URL + "/productos")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    ss(page, "inv_01_productos_list")
    productos_ok = "/productos" in page.url and "/login" not in page.url
    results["inventario"]["lista_productos"] = productos_ok
    print(f"  [1] /productos -> {'OK' if productos_ok else 'FAIL'} ({page.url})")

    if not productos_ok:
        print("  [SKIP] No se accedio a /productos - saltando tests")
        ctx.close()
        return

    # 2. Verify product table is visible
    try:
        content = page.content()
        has_table = (
            "table" in content.lower() or
            page.locator("tr, [role='row']").count() > 0
        )
        results["inventario"]["tabla_visible"] = has_table
        if not has_table:
            report_bug("inventario", "/productos", "product table visible", "no table found")
        print(f"  [2] Tabla productos -> {'OK' if has_table else 'FAIL'}")
    except Exception as e:
        results["inventario"]["tabla_visible"] = False
        print(f"  [2] Tabla -> FAIL ({e})")

    # 3. Create test product
    try:
        nuevo_btn = page.locator(
            'button:has-text("Nuevo"), button:has-text("Agregar"), button:has-text("Crear producto"), '
            'a:has-text("Nuevo"), a:has-text("Agregar")'
        ).first
        btn_visible = nuevo_btn.count() > 0 and nuevo_btn.is_visible()
        if btn_visible:
            nuevo_btn.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)
            ss(page, "inv_03_nuevo_producto_form")

            # Fill product name
            nombre_filled = False
            for sel in ['input[name="name"]', '#name', 'input[placeholder*="nombre" i]', 'input[placeholder*="Nombre"]']:
                try:
                    inp = page.locator(sel).first
                    if inp.count() > 0 and inp.is_visible():
                        inp.fill("Producto Test E2E Sprint6")
                        nombre_filled = True
                        break
                except:
                    pass

            if nombre_filled:
                # Fill price
                for sel in ['input[name="price_usd"]', '#price_usd', 'input[placeholder*="precio" i]', 'input[placeholder*="USD"]']:
                    try:
                        inp = page.locator(sel).first
                        if inp.count() > 0 and inp.is_visible():
                            inp.fill("5.99")
                            break
                    except:
                        pass

                # Submit form
                for sel in ['button[type="submit"]', 'button:has-text("Guardar")', 'button:has-text("Crear")']:
                    try:
                        btn = page.locator(sel).first
                        if btn.count() > 0 and btn.is_visible():
                            btn.click()
                            page.wait_for_load_state("networkidle")
                            page.wait_for_timeout(2000)
                            break
                    except:
                        pass

                ss(page, "inv_03_producto_creado")
                content_post = page.content()
                created = (
                    "Sprint6" in content_post or
                    "exitoso" in content_post.lower() or
                    "guardado" in content_post.lower()
                )
                results["inventario"]["crear_producto"] = created
                if not created:
                    report_bug("inventario", "/productos nuevo", "product created", "no confirmation in page")
                print(f"  [3] Crear producto -> {'OK' if created else 'POSIBLE FAIL - revisar SS'}")
            else:
                results["inventario"]["crear_producto"] = "name_input_not_found"
                report_bug("inventario", "/productos form", "name input visible", "no input found with known selectors")
                print("  [3] Input nombre -> no encontrado (revisar form selectors)")
        else:
            results["inventario"]["crear_producto"] = "nuevo_btn_not_visible"
            report_bug("inventario", "/productos", "Nuevo button", "not visible")
            print("  [3] Boton Nuevo -> no visible")
    except Exception as e:
        results["inventario"]["crear_producto"] = False
        report_bug("inventario", "/productos crear", "create product", str(e))
        print(f"  [3] Crear producto -> FAIL ({str(e)[:80]})")

    # 4. Verify product in list
    try:
        page.goto(BASE_URL + "/productos")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        content = page.content()
        found = "Sprint6" in content
        results["inventario"]["producto_en_lista"] = found
        if not found:
            report_bug("inventario", "/productos list", "new product in list", "Sprint6 not found")
        print(f"  [4] Producto en lista -> {'OK' if found else 'FAIL'}")
    except Exception as e:
        results["inventario"]["producto_en_lista"] = False
        print(f"  [4] Verificar lista -> FAIL ({e})")

    ss(page, "inv_final_state")
    ctx.close()


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def main():
    print("\n" + "="*60)
    print("  ActivoPOS - Sprint 6 E2E Tests")
    print("="*60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        try:
            test_auth(browser)
        except Exception as e:
            print(f"\n[FATAL] Auth: {e}")
            results["bugs"].append({"flujo": "auth", "route": "FATAL", "expected": "flow", "actual": str(e)[:200]})

        try:
            test_pos(browser)
        except Exception as e:
            print(f"\n[FATAL] POS: {e}")
            results["bugs"].append({"flujo": "pos", "route": "FATAL", "expected": "flow", "actual": str(e)[:200]})

        try:
            test_inventario(browser)
        except Exception as e:
            print(f"\n[FATAL] Inventario: {e}")
            results["bugs"].append({"flujo": "inventario", "route": "FATAL", "expected": "flow", "actual": str(e)[:200]})

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
    print("\nResultados en .doc/screenshots/sprint6/_results.json")


if __name__ == "__main__":
    main()
