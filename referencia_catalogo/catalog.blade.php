{{-- ═══════════════════════════════════════════════════════════════════════════════
     SYNTIcat — Catálogo eCommerce + Carrito WhatsApp (REDISEÑO APP MODERNA)
     Preline 4.1.2 + Tailwind v4
═══════════════════════════════════════════════════════════════════════════════ --}}
@extends('landing.base')

@php
    $savedDisplayMode = $savedDisplayMode ?? $displayMode ?? 'reference_only';
    $currencySymbol   = $currencySettings['symbols']['reference'] ?? 'REF';
    $dollarRate       = $dollarRate ?? 36.50;
    $euroRate         = $euroRate ?? 495.00;
    $hidePrice        = $hidePrice ?? false;

    $wa = $tenant->getActiveWhatsapp() ?? null;
    $waClean = $wa ? preg_replace('/[^0-9]/', '', $wa) : '';

    $waSalesClean   = !empty($tenant->whatsapp_sales)   ? preg_replace('/[^0-9]/', '', $tenant->whatsapp_sales)   : '';
    $waSupportClean = !empty($tenant->whatsapp_support) ? preg_replace('/[^0-9]/', '', $tenant->whatsapp_support) : '';
    $waContacts = [];
    if ($waSalesClean) {
        $waContacts[] = [
            'number' => $waSalesClean,
            'label'  => ($waSupportClean && $waSupportClean !== $waSalesClean) ? 'Ventas' : 'WhatsApp',
        ];
    }
    if ($waSupportClean && $waSupportClean !== $waSalesClean) {
        $waContacts[] = ['number' => $waSupportClean, 'label' => 'Soporte'];
    }

    $payMethods      = ($customization->payment_methods ?? []);
    $globalEnabled   = $payMethods['global'] ?? [];
    $currencyEnabled = $payMethods['currency'] ?? [];
    $planSlug = (string) ($tenant->plan->slug ?? 'cat-basico');
    if ($planSlug === 'cat-basico') {
        $globalEnabled   = ['pagoMovil', 'cash'];
        $currencyEnabled = [];
    }
    $allPayMeta = [
        // Nacionales (11 métodos)
        'pagoMovil'  => ['label' => 'Pago Móvil',    'icon' => 'device-mobile'],
        'cash'       => ['label' => 'Efectivo',       'icon' => 'cash'],
        'puntoventa' => ['label' => 'Punto de Venta', 'icon' => 'credit-card'],
        'biopago'    => ['label' => 'Biopago',        'icon' => 'fingerprint'],
        'cashea'     => ['label' => 'Cashea',         'icon' => 'wallet'],
        'krece'      => ['label' => 'Krece',          'icon' => 'trending-up'],
        'wepa'       => ['label' => 'Wepa',           'icon' => 'shopping-cart'],
        'lysto'      => ['label' => 'Lysto',          'icon' => 'calendar-dollar'],
        'chollo'     => ['label' => 'Chollo',         'icon' => 'discount-2'],
        'wally'      => ['label' => 'Wally',          'icon' => 'send-2'],
        'kontigo'    => ['label' => 'Kontigo',        'icon' => 'file-invoice'],
        // Internacionales (7 métodos)
        'zelle'      => ['label' => 'Zelle',          'icon' => 'bolt'],
        'paypal'     => ['label' => 'PayPal',         'icon' => 'brand-paypal'],
        'zinli'      => ['label' => 'Zinli',          'icon' => 'wallet-2'],
        'airtm'      => ['label' => 'AirTM',          'icon' => 'exchange'],
        'reserve'    => ['label' => 'Reserve (RSV)',  'icon' => 'shield-dollar'],
        'binancepay' => ['label' => 'Binance Pay',    'icon' => 'coins'],
        'usdt'       => ['label' => 'USDT',           'icon' => 'currency-dollar'],
    ];
    $allCurrencyMeta = [
        'usd' => ['label' => 'Dólares USD', 'icon' => 'currency-dollar'],
        'eur' => ['label' => 'Euros',        'icon' => 'currency-euro'],
    ];
    $visibleMethods    = array_filter($allPayMeta,      fn($k) => in_array($k, $globalEnabled),   ARRAY_FILTER_USE_KEY);
    $visibleCurrencies = array_filter($allCurrencyMeta, fn($k) => in_array($k, $currencyEnabled), ARRAY_FILTER_USE_KEY);
    $visiblePay        = array_merge($visibleMethods, $visibleCurrencies);

    $heroFilename = $customization->hero_main_filename ?? $customization->hero_filename ?? null;
    $heroUrl = $heroFilename 
        ? (str_starts_with($heroFilename, 'http') ? $heroFilename : asset('storage/tenants/' . $tenant->id . '/' . $heroFilename))
        : null;

    $showcase = $products->where('featured', true)->take(3)->values();
    if ($showcase->count() < 3) {
        $showcase = $products->take(3)->values();
    }

    $productImg = fn($p) => $p->image_filename
        ? asset('storage/tenants/' . $tenant->id . '/' . $p->image_filename)
        : ($p->image_url ?? null);

    $customerFields = $customization->customer_required_fields
        ?? ($tenant->settings['cat_settings']['customer_fields'] ?? ['name', 'phone', 'location']);
    $needsName     = in_array('name',     (array) $customerFields);
    $needsPhone    = true;
    $needsLocation = in_array('location', (array) $customerFields);
    $showCart      = $tenant->plan && $tenant->plan->slug !== 'cat-basico';

    // Mapa de galería por producto para el modal
    $productGalleryMap = [];
    foreach ($products as $p) {
        $imgs = [];
        if ($p->image_url) {
            $imgs[] = $p->image_url;
        } elseif ($p->image_filename) {
            $imgs[] = str_starts_with($p->image_filename, 'http')
                ? $p->image_filename
                : asset('storage/tenants/' . $tenant->id . '/' . $p->image_filename);
        }
        foreach ($p->galleryImages ?? [] as $gi) {
            $imgs[] = str_starts_with($gi->image_filename, 'http')
                ? $gi->image_filename
                : asset('storage/tenants/' . $tenant->id . '/' . $gi->image_filename);
        }
        $productGalleryMap[$p->id] = $imgs;
    }
@endphp

@push('styles')
<style>
    body { overflow-x: hidden; }
    .no-scrollbar::-webkit-scrollbar{display:none}
    .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}
    .sc-drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);z-index:200;opacity:0;pointer-events:none;transition:opacity .3s ease}
    .sc-drawer-overlay.open{opacity:1;pointer-events:auto}
    .sc-drawer{position:fixed;right:0;top:0;bottom:0;width:min(420px,95vw);z-index:201;transform:translateX(110%);transition:transform .4s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;border-top-left-radius:2rem;border-bottom-left-radius:2rem}
    .sc-drawer.open{transform:translateX(0)}
    @keyframes bump{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}
    .bump{animation:bump .25s ease-out}
    @keyframes sc-cart-wiggle{0%,100%{transform:rotate(0) scale(1)}15%{transform:rotate(-16deg) scale(1.1)}35%{transform:rotate(12deg) scale(1.08)}55%{transform:rotate(-7deg) scale(1.04)}75%{transform:rotate(4deg) scale(1.02)}}
    .sc-cart-wiggle{animation:sc-cart-wiggle .7s ease-in-out}
    /* ── Category tabs ── */
    /* ── Hero Slider Ken Burns ── */
    @keyframes sc-kenburns{0%{transform:scale(1) translateZ(0)}100%{transform:scale(1.07) translateZ(0)}}
    .sc-slide{transition:opacity 1s ease-in-out}
    .sc-slide.active img{animation:sc-kenburns 6s ease-out forwards;will-change:transform}
    .sc-cat-tab.active{color:var(--foreground);border-color:var(--primary)}
    /* ── Card editorial ── */
    .sc-product-card{position:relative;background:var(--background);border-radius:14px;overflow:hidden;border:1px solid rgba(var(--foreground-rgb,0 0 0)/.06);transition:transform .2s,box-shadow .2s;display:flex;flex-direction:column}
    .sc-product-card:hover{transform:translateY(-2px)}
    .sc-card-accent{position:absolute;top:0;left:0;right:0;height:2.5px;background:var(--accent-cat,var(--primary));z-index:2;transform:scaleX(0);transform-origin:left;transition:transform .35s cubic-bezier(.4,0,.2,1)}
    .sc-product-card:hover .sc-card-accent{transform:scaleX(1)}
    .sc-add-btn{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;flex-shrink:0;transition:transform .2s}
    .sc-add-btn:hover{transform:scale(1.1)}
    .sc-badge{display:inline-flex;align-items:center;gap:3px;padding:3px 7px;border-radius:5px;font-size:9px;font-weight:700;letter-spacing:.05em;line-height:1.4}
    @media(hover:none){.sc-card-accent{transform:scaleX(1)}}
    .sc-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);z-index:300;display:none;align-items:center;justify-content:center;padding:16px;}
    .sc-modal{max-width:420px;width:100%;background:var(--background,#fff);border-radius:24px;border:1px solid rgba(0,0,0,.05);}
    .sc-field{position:relative}
    .sc-field input{width:100%;padding:1.35rem 1rem .55rem;border-radius:1rem;border:1.5px solid rgba(0,0,0,.08);background:var(--surface,#f3f4f6);font-weight:700;font-size:.875rem;outline:none;transition:border-color .2s,background .2s,box-shadow .2s;color:inherit}
    .sc-field input:focus{border-color:var(--primary,#570DF8);background:var(--background,#fff);box-shadow:0 0 0 3px color-mix(in oklch,var(--primary,#570DF8) 15%,transparent)}
    .sc-field label{position:absolute;left:1rem;top:50%;transform:translateY(-50%);font-size:.825rem;font-weight:700;color:rgba(0,0,0,.35);pointer-events:none;transition:all .18s cubic-bezier(.4,0,.2,1)}
    .sc-field input:focus+label,.sc-field input:not(:placeholder-shown)+label{top:.6rem;transform:none;font-size:.65rem;letter-spacing:.05em;color:var(--primary,#570DF8)}
    .sc-field-error{border-color:#ef4444!important;background:#fff5f5!important}
    .sc-field-error:focus{box-shadow:0 0 0 3px rgba(239,68,68,.15)!important}
    /* ── Modal producto (bottom sheet) ── */
    .sc-pm-overlay{position:fixed;inset:0;z-index:310;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);display:none;align-items:flex-end;justify-content:center}
    .sc-pm-overlay.open{display:flex}
    .sc-pm-sheet{background:var(--background);width:100%;max-width:460px;border-radius:28px 28px 0 0;max-height:86vh;overflow-y:auto;overflow-x:hidden;position:relative;padding-bottom:env(safe-area-inset-bottom,16px);scrollbar-width:none}
    .sc-pm-sheet::-webkit-scrollbar{width:0;height:0}
    @media(min-width:640px){.sc-pm-sheet{border-radius:28px;margin:24px;max-height:88vh}}
    .sc-pm-img-wrap{position:relative;overflow:hidden;border-radius:20px;margin:10px 10px 0;background:var(--surface)}
    .sc-pm-img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block}
    .sc-pm-close{position:absolute;top:10px;right:10px;z-index:20;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.45);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff}
    @media(max-width:639px){
        .sc-pm-sheet{max-height:92dvh;border-radius:20px 20px 0 0}
        .sc-pm-img-wrap{margin:8px 8px 0}
        .sc-pm-img{aspect-ratio:1/1}
    }

    @media(max-width:480px){
        .sc-mobile-tight{font-size:1.125rem}
    }

    /* ── Desktop / Tablet overrides (mobile untouched) ── */

    /* Tablet 768px */
    @media(min-width:768px){
        /* Hero: crece con la pantalla, imagen posicionada desde la cima */
        #sc-hero-slider{height:420px!important}
        /* H1: la altura se aplica sobre el inner (flex container real) */
        #sc-h1-inner{height:4.5rem!important;padding-left:1.5rem!important;padding-right:1.5rem!important;gap:1.25rem!important}
        /* H2 nav */
        #sc-h2-inner{height:3.25rem!important;padding-left:1.5rem!important;padding-right:1.5rem!important;gap:.75rem!important}
        /* Category tabs */
        .sc-cat-tab{font-size:.75rem!important;padding:.45rem 1.1rem!important}
        /* Section titles */
        .sc-cat-section-title{font-size:1.125rem!important;margin-bottom:.75rem;padding-left:.75rem!important;border-left:4px solid var(--primary)!important;border-radius:0!important}
        /* Logo: circular + shadow suave, sin ring rectangle */
        #sc-h1-logo,#sc-h1-logo-placeholder{
            width:3rem!important;height:3rem!important;
            border-radius:50%!important;
            box-shadow:0 2px 14px rgba(0,0,0,.14)!important;
            outline:none!important;
        }
        #sc-h1-business-name{font-size:1rem!important}
        /* Cart: más holgado */
        #sc-cart-trigger{padding:.6rem!important}
    }

    /* Desktop 1024px */
    @media(min-width:1024px){
        #sc-hero-slider{height:580px!important}
        #sc-h1-inner{height:5.5rem!important;padding-left:2.5rem!important;padding-right:2.5rem!important;gap:1.5rem!important}
        #sc-h2-inner{height:4rem!important;padding-left:2.5rem!important;padding-right:2.5rem!important;gap:1rem!important}
        .sc-cat-tab{font-size:.8125rem!important;padding:.5rem 1.4rem!important;letter-spacing:.01em}
        .sc-cat-section-title{font-size:1.375rem!important;padding-left:.875rem!important}
        #sc-h1-logo,#sc-h1-logo-placeholder{
            width:3.75rem!important;height:3.75rem!important;
            border-radius:50%!important;
            box-shadow:0 4px 20px rgba(0,0,0,.16)!important;
        }
        #sc-h1-logo-icon{width:1.875rem!important;height:1.875rem!important}
        #sc-h1-business-name{font-size:1.25rem!important;letter-spacing:-.02em;font-weight:900!important}
        #sc-cart-trigger{padding:.75rem!important}
    }

    /* XL 1280px */
    @media(min-width:1280px){
        #sc-hero-slider{height:640px!important}
        #sc-h1-inner{padding-left:3rem!important;padding-right:3rem!important}
        #sc-h2-inner{padding-left:3rem!important;padding-right:3rem!important}
    }

    /* Eliminar ring box-shadow del logo en desktop (queda el shadow propio) */
    @media(min-width:768px){
        #sc-h1-logo,#sc-h1-logo-placeholder{
            --tw-ring-shadow:none!important;
            --tw-ring-offset-shadow:none!important;
        }
    }

    /* ═══════════════════════════════════════════════════════
       Stitch Design System → lleva.app / SYNTIcat catalog
       Bebas Neue · Glassmorphism · Elevación · Motion
    ═══════════════════════════════════════════════════════ */
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');

    /* Tokens de sombra usando var(--primary) del tema */
    :root {
        --sc-glow-sm:     0 0 8px  color-mix(in srgb, var(--primary) 30%, transparent);
        --sc-glow-md:     0 0 16px color-mix(in srgb, var(--primary) 40%, transparent), 0 4px 12px rgba(0,0,0,.3);
        --sc-glow-lg:     0 0 32px color-mix(in srgb, var(--primary) 50%, transparent), 0 8px 24px rgba(0,0,0,.4);
        --sc-card-shadow: 0 2px 8px rgba(0,0,0,.2), 0 0 0 1px color-mix(in srgb, var(--foreground) 6%, transparent);
        --sc-card-hover:  0 8px 24px rgba(0,0,0,.3), var(--sc-glow-sm);
        --sc-glass:       color-mix(in srgb, var(--background) 88%, transparent);
        --sc-glass-border:color-mix(in srgb, var(--primary) 22%, transparent);
    }

    @keyframes sc-badge-shimmer {
        from { background-position: 200% center; }
        to   { background-position: -200% center; }
    }

    /* ── Hero: gradient overlay ── */
    #sc-hero-slider { position: relative; }
    #sc-hero-slider::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%);
        pointer-events: none;
        z-index: 3;
    }

    /* ── Sticky bar: sombra primaria ── */
    #sc-sticky-bar {
        box-shadow: 0 4px 16px rgba(0,0,0,.12) !important;
    }

    /* ── H1 identity row (mobile): glassmorphism ── */
    #sc-h1-row {
        backdrop-filter: blur(16px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
        background: var(--sc-glass) !important;
        border-bottom-color: var(--sc-glass-border) !important;
    }

    /* ── H2 nav row: glassmorphism ── */
    #sc-h2-row {
        backdrop-filter: blur(16px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
        background: var(--sc-glass) !important;
        border-bottom-color: var(--sc-glass-border) !important;
    }

    /* ── Tabs container: stacking context + separación hamburger ── */
    #sc-cat-tabs-wrap {
        position: relative;
        z-index: 1;
        padding: 4px 8px;
        margin-left: 2px;
        min-width: 0;
    }

    /* ── Category tabs: pill consistente ── */
    .sc-cat-tab {
        display: inline-flex !important;
        align-items: center !important;
        white-space: nowrap !important;
        border-radius: 999px !important;
        flex-shrink: 0 !important;
        transition: background 200ms ease, color 200ms ease,
                    border-color 200ms ease, box-shadow 200ms ease !important;
    }
    /* Activo: el inline style ya pone background:var(--primary), añadir glow */
    .sc-cat-tab.active {
        box-shadow: var(--sc-glow-sm) !important;
        font-weight: 700 !important;
        border-color: transparent !important;
    }

    /* ── Product cards: spring cubic-bezier ── */
    .sc-product-card {
        transition: transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1),
                    box-shadow 180ms ease,
                    border-color 180ms ease !important;
        will-change: transform;
    }
    .sc-product-card:hover {
        transform: translateY(-4px) !important;
        box-shadow: var(--sc-card-hover) !important;
        border-color: color-mix(in srgb, var(--primary) 30%, transparent) !important;
    }
    .sc-product-card:active {
        transform: scale(0.98) !important;
        transition-duration: 80ms !important;
    }

    /* ── Precios en cards: Bebas Neue ── */
    .sc-product-card [data-price-usd] {
        font-family: 'Bebas Neue', sans-serif !important;
        font-size: 1.25rem !important;
        letter-spacing: .04em;
        line-height: 1;
    }

    /* ── Section titles: Bebas Neue ── */
    .sc-cat-section-title {
        font-family: 'Bebas Neue', sans-serif !important;
        font-size: 1.3rem !important;
        font-weight: 400 !important;
        letter-spacing: .06em;
        line-height: 1.1;
    }

    /* ── Badge Popular: shimmer ── */
    .sc-badge.bg-amber-500 {
        background: linear-gradient(90deg,
            var(--primary),
            color-mix(in srgb, var(--primary) 55%, #F5A623 45%),
            var(--primary)) !important;
        background-size: 200% auto !important;
        animation: sc-badge-shimmer 2s linear infinite !important;
    }

    /* ── Add-to-cart button: spring tap ── */
    .sc-add-btn {
        transition: transform 100ms ease, box-shadow 150ms ease !important;
    }
    .sc-add-btn:hover {
        box-shadow: var(--sc-glow-sm) !important;
        transform: scale(1.08) !important;
    }
    .sc-add-btn:active {
        transform: scale(0.9) !important;
    }

    /* ══════════════════════════════════════════════════════
       Modales y overlays
    ══════════════════════════════════════════════════════ */

    /* Overlays: más opacos + blur */
    .sc-drawer-overlay,
    .sc-modal-overlay {
        background: rgba(0,0,0,0.72) !important;
        backdrop-filter: blur(4px) !important;
        -webkit-backdrop-filter: blur(4px) !important;
    }

    /* ── Drawer carrito: glassmorphism ── */
    .sc-drawer {
        backdrop-filter: blur(24px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
        background: color-mix(in srgb, var(--surface, #1a1a1a) 92%, transparent) !important;
        border-left: 1px solid rgba(255,255,255,0.08) !important;
        box-shadow: -20px 0 60px rgba(0,0,0,0.4), var(--sc-glow-sm) !important;
    }

    /* ── "Mi Pedido" en Bebas Neue ── */
    #sc-drawer h3 {
        font-family: 'Bebas Neue', sans-serif !important;
        font-size: 2.25rem !important;
        font-weight: 400 !important;
        letter-spacing: .04em;
        line-height: 1;
    }

    /* ── Total del carrito ── */
    #sc-total {
        font-family: 'Bebas Neue', sans-serif !important;
        font-size: 2.5rem !important;
        letter-spacing: .04em;
        line-height: 1;
    }

    /* ── Total card: borde primario ── */
    #sc-drawer-footer div:has(> #sc-total) {
        background: color-mix(in srgb, var(--surface) 70%, transparent) !important;
        border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent) !important;
    }

    /* ── Precios en drawer body ── */
    #sc-drawer-body [data-price-usd] {
        font-family: 'Bebas Neue', sans-serif !important;
        letter-spacing: .04em;
        line-height: 1;
    }

    /* ── Botón WA drawer: glow verde ── */
    #sc-drawer-footer button[onclick="sendWhatsApp()"] {
        box-shadow: 0 4px 24px rgba(37,211,102,0.4), 0 8px 16px rgba(0,0,0,0.25) !important;
        transition: transform 100ms ease, opacity 100ms ease !important;
    }
    #sc-drawer-footer button[onclick="sendWhatsApp()"]:active {
        transform: scale(0.97) !important;
        opacity: .9;
    }

    /* ── Modales info / datos / cerrado / confirmado: fondo opaco del tema ── */
    .sc-modal {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        background: var(--background-plain, var(--background, #ffffff)) !important;
        border: 1px solid var(--border) !important;
        box-shadow: 0 30px 80px rgba(0,0,0,0.25) !important;
    }

    /* ── Bottom sheet modal de producto ── */
    .sc-pm-overlay {
        background: rgba(0,0,0,0.72) !important;
        backdrop-filter: blur(4px) !important;
        -webkit-backdrop-filter: blur(4px) !important;
    }
    .sc-pm-sheet {
        background: color-mix(in srgb, var(--background) 97%, transparent) !important;
        border-top: 1px solid rgba(255,255,255,0.07) !important;
        box-shadow: 0 -16px 48px rgba(0,0,0,0.3), var(--sc-glow-sm) !important;
    }

    /* ── Precio en modal de producto: Bebas Neue + color primary ── */
    #sc-pm-price {
        font-family: 'Bebas Neue', sans-serif !important;
        font-size: 2rem !important;
        font-weight: 400 !important;
        letter-spacing: .04em;
        line-height: 1;
        color: var(--primary) !important;
    }

    /* ── CTA WhatsApp modal producto: glow ── */
    #sc-pm-wa-btn {
        box-shadow: var(--sc-glow-md) !important;
        transition: transform 100ms ease, opacity 100ms ease !important;
    }
    #sc-pm-wa-btn:active {
        transform: scale(0.97) !important;
        opacity: .9;
    }

    /* ── Dropdown categorías: glassmorphism ── */
    #sc-cat-dropdown {
        backdrop-filter: blur(20px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
        background: color-mix(in srgb, var(--surface) 94%, transparent) !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        box-shadow: 0 16px 40px rgba(0,0,0,0.3), var(--sc-glow-sm) !important;
    }
    #sc-cat-dropdown button {
        transition: background 150ms ease, color 150ms ease !important;
    }
    #sc-cat-dropdown button:hover {
        background: color-mix(in srgb, var(--primary) 10%, transparent) !important;
    }

    /* ── Data modal: inputs ── */
    #sc-data-modal .sc-field input {
        background: color-mix(in srgb, var(--surface) 80%, transparent) !important;
        border-color: color-mix(in srgb, var(--foreground) 10%, transparent) !important;
    }
    #sc-data-modal .sc-field input:focus {
        border-color: color-mix(in srgb, var(--primary) 50%, transparent) !important;
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 10%, transparent) !important;
        outline: none !important;
    }

    /* ── Botón confirmar data modal: glow ── */
    #sc-data-modal button[onclick="confirmDataAndSend()"] {
        box-shadow: var(--sc-glow-md) !important;
        transition: transform 100ms ease, opacity 100ms ease !important;
    }
    #sc-data-modal button[onclick="confirmDataAndSend()"]:active {
        transform: scale(0.97) !important;
        opacity: .9;
    }
</style>
@endpush

@section('content')

{{-- 1. STICKY BAR UNIFICADA --}}
@php
    $scSnets     = $customization->social_networks ?? [];
    $scIg        = $scSnets['instagram'] ?? null;
    $scFb        = $scSnets['facebook']  ?? null;
    $scTt        = $scSnets['tiktok']    ?? null;
    $scSubtitle  = $tenant->business_segment ?? ($tenant->slogan ?? null);
    $scBHours    = $tenant->business_hours ?? [];
    $scDaysMap   = ['monday'=>'Lunes','tuesday'=>'Martes','wednesday'=>'Miércoles','thursday'=>'Jueves','friday'=>'Viernes','saturday'=>'Sábado','sunday'=>'Domingo'];
    $scMapsQuery = rawurlencode(trim(($tenant->address ?? '') . ', ' . ($tenant->city ?? '') . ', ' . ($tenant->country ?? '')));
    $scCatCategories = $catCategories ?? [];
@endphp
{{-- ═══════════════════════════════════════════════
     STICKY BAR — 2 headers estilo ecommerce
     H1: identidad + acciones
     H2: navegación + búsqueda expandible + categorías pill
═══════════════════════════════════════════════ --}}
<div id="sc-sticky-bar" class="sticky top-0 z-[100]" style="box-shadow:0 2px 12px rgba(0,0,0,.08);">

    {{-- ══ H1: Identidad — fondo blanco ══ --}}
    <div id="sc-h1-row" class="lg:hidden" style="background:#ffffff;border-bottom:1px solid rgba(0,0,0,.08);">
        <div id="sc-h1-inner" class="mx-auto max-w-[1280px] px-3 flex items-center gap-2 h-12">

            {{-- Logo + Nombre --}}
            <a id="synti-cat-trigger-sticky" href="#" class="flex items-center gap-2 shrink-0 flex-1 min-w-0">
                @if(!empty($customization->logo_filename))
                    <img id="sc-h1-logo"
                         src="{{ asset('storage/tenants/' . $tenant->id . '/' . $customization->logo_filename) }}"
                         alt="{{ $tenant->business_name }}"
                         class="size-8 rounded-lg object-cover shrink-0 ring-2 ring-foreground/10">
                @else
                    <div id="sc-h1-logo-placeholder" class="size-8 rounded-lg flex items-center justify-center shrink-0 ring-2 ring-foreground/10"
                         style="background:color-mix(in oklch, var(--primary) 12%, transparent)">
                        <span id="sc-h1-logo-icon" class="iconify tabler--bag size-4" style="color:var(--primary)"></span>
                    </div>
                @endif
                <span id="sc-h1-business-name" class="text-sm font-black tracking-tight truncate text-foreground">{{ $tenant->business_name }}</span>
            </a>

            {{-- Toggle moneda --}}
            @if(str_contains($savedDisplayMode, 'toggle'))
            <div class="flex p-0.5 rounded-lg shrink-0" style="background:rgba(0,0,0,.06)">
                <button class="sc-curr-btn px-2.5 py-1 text-[11px] font-black rounded-md transition-all cursor-pointer text-foreground"
                        data-currency="ref" onclick="setCurrency('ref')">{{ $currencySymbol }}</button>
                <button class="sc-curr-btn px-2.5 py-1 text-[11px] font-black rounded-md transition-all cursor-pointer text-foreground/40"
                        data-currency="bs" onclick="setCurrency('bs')">Bs</button>
            </div>
            @endif

            {{-- Carrito --}}
            @if($showCart)
            <button onclick="toggleDrawer()" id="sc-cart-trigger"
                    class="relative p-2 rounded-full cursor-pointer shrink-0 transition-transform active:scale-95"
                    style="background:color-mix(in oklch, var(--primary) 12%, transparent)">
                <span class="iconify tabler--shopping-bag size-5" style="color:var(--primary)"></span>
                <span id="sc-cart-count" class="sc-cart-count-badge absolute -top-1 -right-1 size-5 bg-red-400 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2" style="border-color:#ffffff;display:none">0</span>
            </button>
            <button onclick="toggleDrawer()" id="sc-cart-trigger-m"
                    class="relative p-2 rounded-full cursor-pointer shrink-0 transition-transform active:scale-95 sm:hidden"
                    style="background:color-mix(in oklch, var(--primary) 12%, transparent);display:none">
                <span class="iconify tabler--shopping-bag size-5" style="color:var(--primary)"></span>
                <span class="sc-cart-count-badge absolute -top-1 -right-1 size-5 bg-red-400 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2" style="border-color:#ffffff;display:none">0</span>
            </button>
            @endif
        </div>
    </div>

    {{-- ══ H2: Navegación ══ --}}
    <div id="sc-h2-row" style="background:var(--background,#fff);border-bottom:1px solid rgba(0,0,0,.06);position:relative;">
        <div id="sc-h2-inner" class="mx-auto max-w-[1280px] px-2 flex items-center gap-1 h-11">

            {{-- Logo + Nombre — solo desktop (mobile lo muestra H1) --}}
            <a href="{{ url('/') }}" class="hidden lg:flex items-center gap-2 shrink-0 mr-1">
                @if(!empty($customization->logo_filename))
                    <img src="{{ asset('storage/tenants/' . $tenant->id . '/' . $customization->logo_filename) }}"
                         alt="{{ $tenant->business_name }}"
                         class="size-7 rounded-lg object-cover shrink-0 ring-1 ring-foreground/10">
                @else
                    <div class="size-7 rounded-lg flex items-center justify-center shrink-0"
                         style="background:color-mix(in oklch, var(--primary) 12%, transparent)">
                        <span class="iconify tabler--bag size-3.5" style="color:var(--primary)"></span>
                    </div>
                @endif
                <span class="text-sm font-black tracking-tight text-foreground whitespace-nowrap">{{ $tenant->business_name }}</span>
            </a>

            {{-- Lupa: abre input expandible --}}
            <button id="sc-search-btn" onclick="scToggleSearch()"
                    class="flex-shrink-0 size-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer text-foreground/50 hover:text-primary hover:bg-primary/8">
                <span class="iconify tabler--search size-[18px]"></span>
            </button>

            {{-- Hamburger — long press 5s → panel --}}
            <button id="synti-hamburger-trigger" onclick="scToggleCatMenu()"
                    class="flex-shrink-0 size-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer text-foreground/50 hover:text-primary hover:bg-primary/8">
                <span class="iconify tabler--menu-2 size-[18px]"></span>
            </button>
            {{-- alias mobile --}}
            <button id="synti-hamburger-trigger-m" onclick="scToggleCatMenu()"
                    class="flex-shrink-0 size-9 sm:hidden flex items-center justify-center rounded-lg transition-colors cursor-pointer text-foreground/50 hover:text-primary hover:bg-primary/8" style="display:none">
                <span class="iconify tabler--menu-2 size-[18px]"></span>
            </button>

            {{-- Tabs categorías pill --}}
            @if(!empty($scCatCategories))
            <div id="sc-cat-tabs-wrap" class="flex gap-1.5 overflow-x-auto no-scrollbar flex-1 py-1.5">
                <button data-cat-nav="all" data-cat="all" onclick="scScrollToSection('all')"
                        class="sc-cat-tab active shrink-0 px-3.5 py-1.5 text-[11px] font-black rounded-full whitespace-nowrap transition-all cursor-pointer"
                        style="background:var(--primary);color:var(--primary-foreground)">
                    Todos
                </button>
                @php $tabCounter = 0; @endphp
                @foreach($scCatCategories as $cat)
                @php $hasProds = $products->filter(fn($p) => ($p->category_name ?? '') === $cat['name'])->isNotEmpty(); @endphp
                @if($hasProds)
                <button data-cat-nav="{{ $tabCounter }}" data-cat="{{ $cat['name'] }}" onclick="scScrollToSection('{{ $cat['name'] }}')"
                        class="sc-cat-tab shrink-0 px-3.5 py-1.5 text-[11px] font-bold rounded-full whitespace-nowrap transition-all cursor-pointer border border-foreground/10 text-foreground/50 hover:border-primary hover:text-primary">
                    {{ $cat['name'] }}
                </button>
                @php $tabCounter++; @endphp
                @endif
                @endforeach
            </div>
            @else
            <div class="flex-1"></div>
            @endif

            {{-- Info — ícono con fondo sutil para mayor presencia visual --}}
            <button onclick="document.getElementById('sc-info-modal').style.display='flex'"
                    class="flex-shrink-0 size-9 flex items-center justify-center rounded-full transition-colors cursor-pointer hover:bg-primary/8"
                    style="background:color-mix(in oklch, var(--primary) 8%, transparent)">
                <span class="iconify tabler--info-circle size-5" style="color:var(--primary)"></span>
            </button>

            {{-- Toggle moneda — solo desktop --}}
            @if(str_contains($savedDisplayMode, 'toggle'))
            <div class="hidden lg:flex p-0.5 rounded-lg shrink-0 ml-1" style="background:rgba(0,0,0,.06)">
                <button class="sc-curr-btn px-2.5 py-1 text-[11px] font-black rounded-md transition-all cursor-pointer text-foreground"
                        data-currency="ref" onclick="setCurrency('ref')">{{ $currencySymbol }}</button>
                <button class="sc-curr-btn px-2.5 py-1 text-[11px] font-black rounded-md transition-all cursor-pointer text-foreground/40"
                        data-currency="bs" onclick="setCurrency('bs')">Bs</button>
            </div>
            @endif

            {{-- Carrito — solo desktop --}}
            @if($showCart)
            <button onclick="toggleDrawer()" id="sc-cart-trigger-desktop"
                    class="hidden lg:flex relative p-2 rounded-full cursor-pointer shrink-0 transition-transform active:scale-95"
                    style="background:color-mix(in oklch, var(--primary) 12%, transparent)">
                <span class="iconify tabler--shopping-bag size-5" style="color:var(--primary)"></span>
                <span class="sc-cart-count-badge absolute -top-1 -right-1 size-5 bg-red-400 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2" style="border-color:#ffffff;display:none">0</span>
            </button>
            @endif
        </div>

        {{-- Search overlay expandible --}}
        <div id="sc-search-wrap"
             style="display:none;position:absolute;inset:0;z-index:10;background:var(--background,#fff);">
            <div class="flex items-center gap-2 px-3 h-full">
                <span class="iconify tabler--search size-4 text-primary shrink-0"></span>
                <input id="sc-search-input" type="search"
                       placeholder="Buscar en {{ $tenant->business_name }}..."
                       class="sc-search-input flex-1 text-sm py-1.5 bg-transparent border-none outline-none font-medium text-foreground placeholder:text-foreground/30"
                       oninput="searchProducts(this.value)" autofocus>
                <button onclick="scToggleSearch()"
                        class="size-8 flex items-center justify-center rounded-lg text-foreground/40 hover:bg-surface/50 cursor-pointer shrink-0">
                    <span class="iconify tabler--x size-4"></span>
                </button>
            </div>
            <div style="height:2px;background:var(--primary);opacity:.3"></div>
        </div>
    </div>

    {{-- Sub-categorías: fila colapsable bajo las pills principales --}}
    <div id="sc-sub-tabs-row" style="display:none;background:var(--surface,#f9f9f9);border-bottom:1px solid rgba(0,0,0,.05)">
        <div class="mx-auto max-w-[1280px] px-2 flex items-center gap-1.5 h-9 overflow-x-auto no-scrollbar">
            {{-- Pills inyectadas por JS --}}
        </div>
    </div>

</div>

{{-- Dropdown categorías (compartido, fixed) --}}
<div id="sc-cat-dropdown"
     class="fixed w-64 bg-background rounded-xl border border-foreground/5 z-[200] overflow-hidden"
     style="display:none;top:0;left:0">
    <div class="px-4 py-2.5 border-b border-foreground/5">
        <p class="text-xs font-black uppercase tracking-widest text-foreground/40">Categorías</p>
    </div>
    <button onclick="filterCategory('all');scToggleCatMenu()" class="w-full text-left px-4 py-3 text-sm font-semibold text-foreground/70 hover:bg-surface hover:text-foreground transition-colors flex items-center gap-3 cursor-pointer">
        <span class="iconify tabler--layout-grid size-4 text-primary/60"></span>Todos los productos
    </button>
    @foreach($scCatCategories as $cat)
    @php $hasSubs = !empty($cat['subcategories']); @endphp
    <div>
        <button onclick="filterCategory('{{ $cat['name'] }}');{{ !$hasSubs ? 'scToggleCatMenu()' : '' }}"
                class="w-full text-left px-4 py-3 text-sm font-semibold text-foreground/70 hover:bg-surface hover:text-foreground transition-colors flex items-center gap-3 border-t border-foreground/4 cursor-pointer">
            <span class="iconify tabler--chevron-right size-3.5 text-primary/70"></span>
            <span class="flex-1">{{ $cat['name'] }}</span>
            @if($hasSubs)<span class="iconify tabler--chevron-right size-3 text-foreground/30"></span>@endif
        </button>
        @if($hasSubs)
        @foreach($cat['subcategories'] as $sub)
        <button onclick="filterCategory('{{ $cat['name'] }}','{{ $sub['name'] }}');scToggleCatMenu()"
                class="w-full text-left pl-12 pr-4 py-2 text-xs text-foreground/55 hover:bg-surface hover:text-foreground transition-colors flex items-center gap-2 border-t border-foreground/4 cursor-pointer">
            <span class="iconify tabler--minus size-3 text-foreground/30"></span>{{ $sub['name'] }}
        </button>
        @endforeach
        @endif
    </div>
    @endforeach
</div>
<div id="sc-cat-backdrop" onclick="scToggleCatMenu()" style="display:none;position:fixed;inset:0;z-index:199"></div>

{{-- MODAL INFORMACIÓN --}}
<div id="sc-info-modal" class="sc-modal-overlay" onclick="if(event.target===this)this.style.display='none'">
    <div class="sc-modal max-h-[88vh] flex flex-col">
        <div class="flex items-start justify-between gap-3 p-5 pb-4 border-b border-foreground/5 shrink-0">
            <div class="flex items-center gap-3">
                @if(!empty($customization->logo_filename))
                    <img src="{{ asset('storage/tenants/' . $tenant->id . '/' . $customization->logo_filename) }}"
                         alt="{{ $tenant->business_name }}"
                         class="size-14 rounded-full object-cover ring-2 ring-primary/20 shrink-0">
                @else
                    <div class="size-14 bg-primary rounded-full flex items-center justify-center shrink-0">
                        <span class="text-primary-foreground font-black text-2xl">{{ mb_substr($tenant->business_name, 0, 1) }}</span>
                    </div>
                @endif
                <div>
                    <p class="font-black text-base text-foreground leading-tight">{{ $tenant->business_name }}</p>
                    @if($scSubtitle)
                        <p class="text-xs text-foreground/50 mt-0.5 leading-snug">{{ $scSubtitle }}</p>
                    @endif
                    @if($isOpen ?? false)
                        <span class="inline-flex items-center gap-1 text-xs font-bold text-green-600 mt-1"><span class="size-1.5 rounded-full bg-green-500"></span>Abierto</span>
                    @else
                        <span class="inline-flex items-center gap-1 text-xs font-bold text-red-500 mt-1"><span class="size-1.5 rounded-full bg-red-500"></span>Cerrado</span>
                    @endif
                </div>
            </div>
            <button onclick="document.getElementById('sc-info-modal').style.display='none'"
                    class="p-1.5 rounded-full hover:bg-surface transition-colors text-foreground/40 shrink-0 mt-0.5 cursor-pointer">
                <span class="iconify tabler--x size-4"></span>
            </button>
        </div>
        <div class="overflow-y-auto flex-1 p-5 space-y-5">
            @if(!empty($customization->about_text ?? $tenant->description))
            <p class="text-sm text-foreground/60 leading-relaxed">{{ $customization->about_text ?? $tenant->description }}</p>
            @endif
            @if(!empty($visiblePay))
            <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-foreground/30 mb-3">Métodos de pago</p>
                <div class="flex flex-wrap gap-2">
                    @foreach($visiblePay as $pmKey => $pm)
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/60 text-xs font-semibold text-foreground/70">
                        <span class="iconify tabler--{{ $pm['icon'] }} size-4 text-primary/70"></span>
                        {{ $pm['label'] }}
                    </span>
                    @endforeach
                </div>
            </div>
            @endif
            @if(!empty($waContacts) || $scIg || $scFb || $scTt || !empty($tenant->phone))
            <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-foreground/30 mb-3">Contáctanos</p>
                <div class="flex flex-wrap gap-4">
                    @foreach($waContacts as $waItem)
                    <a href="https://wa.me/{{ $waItem['number'] }}" target="_blank" rel="noopener"
                       class="flex flex-col items-center gap-1 group cursor-pointer">
                        <span class="size-11 rounded-full flex items-center justify-center shadow-sm transition-transform duration-150 group-hover:scale-110" style="background:#25D366">
                            <span class="iconify tabler--brand-whatsapp size-5 text-white"></span>
                        </span>
                        <span class="text-[10px] font-semibold text-foreground/40">{{ $waItem['label'] }}</span>
                    </a>
                    @endforeach
                    @if($scIg)
                    <a href="https://instagram.com/{{ ltrim($scIg, '@') }}" target="_blank" rel="noopener"
                       class="flex flex-col items-center gap-1 group cursor-pointer">
                        <span class="size-11 rounded-full flex items-center justify-center shadow-sm transition-transform duration-150 group-hover:scale-110" style="background:radial-gradient(circle farthest-corner at 35% 90%,#fec564,transparent 50%),radial-gradient(circle farthest-corner at 0 140%,#fec564,transparent 50%),radial-gradient(ellipse farthest-corner at 0 -25%,#5258cf,transparent 50%),radial-gradient(ellipse farthest-corner at 20% -50%,#5258cf,transparent 50%),radial-gradient(ellipse farthest-corner at 100% 0,#893dc2,transparent 50%),radial-gradient(ellipse farthest-corner at 60% -20%,#893dc2,transparent 50%),radial-gradient(ellipse farthest-corner at 100% 100%,#d9317a,transparent),linear-gradient(#6559ca,#bc318f 30%,#e33f5f 50%,#f77638 70%,#fec66d 100%)">
                            <span class="iconify tabler--brand-instagram size-5 text-white"></span>
                        </span>
                        <span class="text-[10px] font-semibold text-foreground/40">Instagram</span>
                    </a>
                    @endif
                    @if($scFb)
                    <a href="https://facebook.com/{{ ltrim($scFb, '@') }}" target="_blank" rel="noopener"
                       class="flex flex-col items-center gap-1 group cursor-pointer">
                        <span class="size-11 rounded-full flex items-center justify-center shadow-sm transition-transform duration-150 group-hover:scale-110" style="background:#1877F2">
                            <span class="iconify tabler--brand-facebook size-5 text-white"></span>
                        </span>
                        <span class="text-[10px] font-semibold text-foreground/40">Facebook</span>
                    </a>
                    @endif
                    @if($scTt)
                    <a href="https://tiktok.com/@{{ ltrim($scTt, '@') }}" target="_blank" rel="noopener"
                       class="flex flex-col items-center gap-1 group cursor-pointer">
                        <span class="size-11 rounded-full flex items-center justify-center shadow-sm bg-black transition-transform duration-150 group-hover:scale-110">
                            <span class="iconify tabler--brand-tiktok size-5 text-white"></span>
                        </span>
                        <span class="text-[10px] font-semibold text-foreground/40">TikTok</span>
                    </a>
                    @endif
                    @if(!empty($tenant->phone))
                    <a href="tel:{{ preg_replace('/[^0-9+]/', '', $tenant->phone) }}"
                       class="flex flex-col items-center gap-1 group cursor-pointer">
                        <span class="size-11 rounded-full flex items-center justify-center shadow-sm bg-gray-700 transition-transform duration-150 group-hover:scale-110">
                            <span class="iconify tabler--phone size-5 text-white"></span>
                        </span>
                        <span class="text-[10px] font-semibold text-foreground/40">Llamar</span>
                    </a>
                    @endif
                </div>
            </div>
            @endif
            @if(!empty($tenant->address))
            <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-foreground/30 mb-1">Dirección</p>
                <a href="https://maps.google.com/?q={{ $scMapsQuery }}" target="_blank" rel="noopener"
                   class="text-sm text-primary font-medium flex items-start gap-1.5 hover:underline cursor-pointer">
                    <span class="iconify tabler--map-pin size-4 shrink-0 mt-0.5"></span>
                    <span>{{ $tenant->address }}@if(!empty($tenant->city)), {{ $tenant->city }}@endif</span>
                </a>
            </div>
            @endif
            @if(!empty($scBHours))
            <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-foreground/30 mb-2">Horarios de atención</p>
                <div class="rounded-xl overflow-hidden border border-foreground/5">
                    @foreach($scDaysMap as $dayKey => $dayLabel)
                    @php
                        $dayData   = $scBHours[$dayKey] ?? null;
                        $dayClosed = is_null($dayData) || !empty($dayData['closed']);
                    @endphp
                    <div class="flex items-center justify-between px-3.5 py-2.5 bg-surface/60 border-b border-foreground/5 last:border-0">
                        <span class="text-sm font-semibold text-foreground/70">{{ $dayLabel }}</span>
                        @if($dayClosed)
                            <span class="text-xs text-foreground/30 font-medium">Cerrado</span>
                        @else
                            <span class="text-xs font-bold text-primary">{{ $dayData['open'] ?? '—' }} – {{ $dayData['close'] ?? '—' }}</span>
                        @endif
                    </div>
                    @endforeach
                </div>
            </div>
            @endif
        </div>
        <div class="px-5 pb-5 pt-3 shrink-0 border-t border-foreground/5">
            <button onclick="if(navigator.share){navigator.share({title:'{{ $tenant->business_name }}',url:window.location.href}).catch(function(){})}else{navigator.clipboard.writeText(window.location.href)}"
                    class="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-foreground/10 text-sm font-bold text-foreground/60 hover:bg-surface hover:text-foreground transition-colors cursor-pointer">
                <span class="iconify tabler--share-3 size-4"></span>
                Compartir
            </button>
        </div>
    </div>
</div>

@php
    $scHeroImages = array_values(array_filter([
        $customization->hero_main_filename      ?? null,
        $customization->hero_secondary_filename ?? null,
        $customization->hero_tertiary_filename  ?? null,
    ]));
@endphp
{{-- ══ Hero + Categorías visuales: se ocultan al activar filtro/búsqueda ══ --}}
<div id="sc-hero-showcase">
@if(count($scHeroImages) > 0)
<div id="sc-hero-slider" class="relative w-full bg-surface" style="height:200px;overflow:hidden;transition:height .4s ease">
    @foreach($scHeroImages as $hIdx => $hImg)
    <div class="sc-slide absolute inset-0{{ $hIdx === 0 ? ' active' : '' }}" style="opacity:{{ $hIdx === 0 ? '1' : '0' }}">
        @php $hImgUrl = str_starts_with($hImg, 'http') ? $hImg : asset('storage/tenants/' . $tenant->id . '/' . $hImg); @endphp
        <img src="{{ $hImgUrl }}"
             alt="{{ $tenant->business_name }}"
             class="w-full h-full object-cover object-top"
             loading="{{ $hIdx === 0 ? 'eager' : 'lazy' }}">
    </div>
    @endforeach
    @if(count($scHeroImages) > 1)
    <div class="absolute bottom-2 right-3 flex gap-1 z-10">
        @foreach($scHeroImages as $hIdx => $hImg)
        <button class="sc-dot size-1.5 rounded-full transition-all {{ $hIdx === 0 ? 'bg-white' : 'bg-white/40' }}" data-slide="{{ $hIdx }}"></button>
        @endforeach
    </div>
    @endif
</div>
@endif

@php
    $hasCats = !empty($scCatCategories);
    $scCatTotal = count($scCatCategories);
    $scCatNames = collect($scCatCategories)->pluck('name')->toArray();
    $orphanProds = $hasCats ? $products->filter(fn($p) => empty($p->category_name) || !in_array($p->category_name, $scCatNames))->values() : collect();
@endphp

@if($hasCats)
{{-- ━━ RAMA A: CON CATEGORÍAS ━━ --}}

    @if($scCatTotal <= 4)
    {{-- Cards de categoría grandes (tap = filtro) --}}
    <section class="pb-6 pt-5 md:pb-10 md:pt-8">
        <div class="mx-auto max-w-[1280px] px-3 md:px-6 lg:px-10">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
                @foreach($scCatCategories as $cat)
                @php
                    $catProduct = $products->first(fn($p) => ($p->category_name ?? '') === $cat['name']);
                    $catImg = $catProduct ? $productImg($catProduct) : null;
                    $catProdCount = $products->filter(fn($p) => ($p->category_name ?? '') === $cat['name'])->count();
                @endphp
                <button onclick="filterCategory('{{ $cat['name'] }}')"
                        class="group relative overflow-hidden rounded-2xl aspect-square bg-surface border border-foreground/6 transition-all duration-300 hover:-translate-y-1 cursor-pointer text-left">
                    @if($catImg)
                    <img src="{{ $catImg }}" alt="{{ $cat['name'] }}"
                         class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                    @else
                    <div class="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5"></div>
                    @endif
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>
                    <div class="absolute bottom-0 left-0 right-0 p-3 md:p-4 lg:p-5">
                        <p class="text-white font-bold text-sm md:text-base lg:text-lg leading-tight">{{ $cat['name'] }}</p>
                        <p class="text-white/60 text-xs md:text-sm mt-0.5">{{ $catProdCount }} producto{{ $catProdCount !== 1 ? 's' : '' }}</p>
                    </div>
                </button>
                @endforeach
            </div>
        </div>
    </section>
    @endif
@endif
</div>{{-- /sc-hero-showcase --}}

{{-- Mensaje sin resultados (fuera del showcase para que sea visible al filtrar) --}}
<div id="sc-no-results" class="py-16 text-center mx-auto max-w-[1280px]" style="display:none">
    <span class="iconify tabler--mood-empty size-12 text-foreground/15 mx-auto mb-3"></span>
    <p class="text-foreground/40 font-bold">No se encontraron productos</p>
    <p class="text-xs text-foreground/25 mt-1">Prueba otra búsqueda o categoría</p>
</div>

@if($hasCats)

    {{-- SECCIONES POR CATEGORÍA: título + 4 cards + botón ver más --}}
    <section id="sc-cat-sections" class="pb-16 md:pb-24">
        <div class="mx-auto max-w-[1280px] px-3 md:px-6 lg:px-10 space-y-10 md:space-y-14">
            @php $catCounter = 0; @endphp
            @foreach($scCatCategories as $cat)
            @php
                $catProds = $products->filter(fn($p) => ($p->category_name ?? '') === $cat['name'])->values();
                $catId = 'cat-' . Str::slug($cat['name']);
                $catBatch = 10;
                $catRemaining = max(0, $catProds->count() - $catBatch);
            @endphp
            @if($catProds->isEmpty()) @continue @endif

            <div class="sc-cat-section" id="sc-section-{{ Str::slug($cat['name']) }}" data-cat="{{ $cat['name'] }}">
            @php $catCounter++; @endphp
                {{-- Título sección --}}
                <div class="flex items-center justify-between mb-3">
                    <h2 class="sc-cat-section-title text-lg font-black tracking-tight text-foreground" style="border-left:4px solid var(--primary);padding-left:.75rem">
                        {{ $cat['name'] }}
                        <span class="ml-1.5 text-xs md:text-sm font-semibold text-foreground/40">({{ $catProds->count() }})</span>
                    </h2>
                </div>

                {{-- Grid: primeros 12 visibles, el resto con cardHidden para carga incremental --}}
                <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4" id="{{ $catId }}-grid">
                    @foreach($catProds as $product)
                        @include('landing.sections.sc-product-card', ['product' => $product, 'cardHidden' => $loop->index >= $catBatch])
                    @endforeach
                </div>

                @if($catRemaining > 0)
                <div class="mt-4 flex justify-center" id="{{ $catId }}-more-btn">
                    <button onclick="scShowMore('{{ $catId }}')"
                            class="flex items-center gap-2 px-6 py-3 rounded-2xl border border-foreground/10 bg-surface text-sm font-bold text-foreground/60 hover:text-foreground hover:bg-foreground/5 active:scale-95 transition-all duration-200 shadow-sm cursor-pointer">
                        <span class="iconify tabler--grid-dots size-4"></span>
                        Ver 10 más
                        <span class="bg-primary/10 text-primary text-xs font-black px-2 py-0.5 rounded-full" data-remaining="{{ $catRemaining }}">{{ $catRemaining }} restantes</span>
                    </button>
                </div>
                @endif
            </div>
            @endforeach
        </div>
    </section>

    {{-- SECCIÓN HUÉRFANOS: productos sin categoría o con categoría no registrada --}}
    @if($orphanProds->isNotEmpty())
    <section id="sc-orphan-section" class="pb-16 md:pb-24">
        <div class="mx-auto max-w-[1280px] px-3 md:px-6 lg:px-10">
            <div class="sc-cat-section" data-cat="__orphan">
                <div class="flex items-center justify-between mb-3">
                    <h2 class="sc-cat-section-title text-lg font-black tracking-tight text-foreground" style="border-left:4px solid var(--primary);padding-left:.75rem">
                        Otros
                        <span class="ml-1.5 text-xs md:text-sm font-semibold text-foreground/40">({{ $orphanProds->count() }})</span>
                    </h2>
                </div>
                @php $orphanRemaining = max(0, $orphanProds->count() - 10); @endphp
                <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4" id="cat-otros-grid">
                    @foreach($orphanProds as $product)
                        @include('landing.sections.sc-product-card', ['product' => $product, 'cardHidden' => $loop->index >= 10])
                    @endforeach
                </div>
                @if($orphanRemaining > 0)
                <div class="mt-4 flex justify-center" id="cat-otros-more-btn">
                    <button onclick="scShowMore('cat-otros')"
                            class="flex items-center gap-2 px-6 py-3 rounded-2xl border border-foreground/10 bg-surface text-sm font-bold text-foreground/60 hover:text-foreground hover:bg-foreground/5 active:scale-95 transition-all duration-200 shadow-sm cursor-pointer">
                        <span class="iconify tabler--grid-dots size-4"></span>
                        Ver 10 más
                        <span class="bg-primary/10 text-primary text-xs font-black px-2 py-0.5 rounded-full" data-remaining="{{ $orphanRemaining }}">{{ $orphanRemaining }} restantes</span>
                    </button>
                </div>
                @endif
            </div>
        </div>
    </section>
    @endif

@else
{{-- ━━ RAMA B: SIN CATEGORÍAS — grid libre con ver más JS ━━ --}}
    <section id="productos" class="pb-16 md:pb-24">
        <div class="mx-auto max-w-[1280px] px-3 md:px-6 lg:px-10">
            <div id="sc-products-grid" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                @foreach($products as $product)
                    @include('landing.sections.sc-product-card', ['product' => $product, 'cardHidden' => $loop->index >= 8])
                @endforeach
            </div>
            @if($products->count() > 8)
            <div id="sc-load-more-wrap" class="mt-6 flex justify-center">
                <button id="sc-load-more-btn" onclick="scLoadMore()"
                        class="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow-md hover:opacity-90 active:scale-95 transition-all duration-200 cursor-pointer">
                    <span class="iconify tabler--plus size-4"></span>
                    Ver más productos
                    <span class="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full">
                        +{{ $products->count() - 8 }}
                    </span>
                </button>
            </div>
            @endif
        </div>
    </section>
@endif



{{-- MODAL DE PRODUCTO --}}
<div id="sc-pm-overlay" class="sc-pm-overlay" onclick="if(event.target===this)closePM()">
    <div class="sc-pm-sheet" id="sc-pm-sheet">

        {{-- Imagen con botón cerrar encima --}}
        <div class="sc-pm-img-wrap">
            <button onclick="closePM()" class="sc-pm-close" aria-label="Cerrar">
                <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            <img id="sc-pm-img" src="" alt="" class="sc-pm-img" onerror="this.style.display='none'">
            {{-- Badge especial si aplica --}}
            <div id="sc-pm-badge-wrap" class="absolute top-3 left-3 z-10"></div>
        </div>

        {{-- Info del producto --}}
        <div class="px-5 pt-4 pb-2">
            <div class="flex items-start justify-between gap-3">
                <h2 id="sc-pm-name" class="text-xl font-black leading-tight flex-1"></h2>
                <div class="text-right shrink-0">
                    <div id="sc-pm-price" class="font-bold text-foreground/80 text-lg"></div>
                    <div id="sc-pm-compare" class="text-sm text-red-400 line-through hidden"></div>
                </div>
            </div>
            <p id="sc-pm-desc" class="text-sm text-foreground/50 mt-2 leading-relaxed hidden"></p>
        </div>

        {{-- Galería del producto (Plan Semestral/Anual) --}}
        <div id="sc-pm-thumbs" class="px-5 pt-1 pb-2 flex gap-2 overflow-x-auto no-scrollbar"></div>

        {{-- Variantes dinámicas (renderizadas por JS) --}}
        <div id="sc-pm-variants" class="px-5 pt-2 pb-0 space-y-3"></div>

        @if($showCart)
        {{-- Agregar al carrito --}}
        <div class="px-5 pb-3 pt-2" id="sc-pm-add-wrap">
            <p id="sc-pm-variant-error" class="text-xs font-semibold text-red-500 mb-2" style="display:none">Selecciona una opción antes de continuar</p>
            <button onclick="pmAddToCart()"
                    class="w-full h-12 rounded-2xl bg-foreground text-background font-black text-sm inline-flex items-center justify-center gap-2 cursor-pointer hover:bg-foreground/85 transition-colors">
                <svg aria-hidden="true" focusable="false" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                Agregar al carrito
            </button>
        </div>
        @endif

        {{-- Botones CTA --}}
        <div class="px-5 pb-5 pt-3 flex gap-3">
            <a id="sc-pm-wa-btn" href="#" target="_blank" rel="noopener noreferrer"
               class="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-black text-sm inline-flex items-center justify-center gap-2 shadow-lg">
                <svg class="size-5 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                Pedir por WhatsApp
            </a>
            <button onclick="sharePM()" title="Compartir"
                    class="hidden sm:flex h-12 w-12 rounded-2xl border border-foreground/12 text-foreground/60 hover:bg-surface transition items-center justify-center shrink-0">
                <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
        </div>

    </div>
</div>

{{-- 5. DRAWER CARRITO --}}
<div class="sc-drawer-overlay" id="sc-overlay" onclick="toggleDrawer()"></div>
<aside class="sc-drawer bg-background" id="sc-drawer">
    {{-- Header --}}
    <div class="px-7 pt-7 pb-5 flex items-center justify-between border-b border-foreground/5">
        <div>
            <h3 class="text-2xl font-black tracking-tighter">Mi Pedido</h3>
            <p class="text-[10px] text-foreground/30 font-black uppercase tracking-[.25em] mt-0.5">Shopping Bag</p>
        </div>
        <button onclick="toggleDrawer()" class="p-2 rounded-full text-sm transition-colors text-foreground/80 hover:bg-surface bg-surface/80">
            <span class="iconify tabler--x size-5"></span>
        </button>
    </div>

    {{-- Empty state --}}
    <div id="sc-empty" class="flex-1 flex flex-col items-center justify-center text-center py-14 px-7">
        <div class="size-20 rounded-3xl bg-surface flex items-center justify-center mb-4">
            <span class="iconify tabler--shopping-bag size-10 text-foreground/20"></span>
        </div>
        <p class="font-bold text-foreground/30">Tu carrito está vacío</p>
        <p class="text-xs text-foreground/20 mt-1">Explora y agrega productos</p>
    </div>

    {{-- Lista de items --}}
    <div class="flex-1 overflow-y-auto px-7 no-scrollbar" id="sc-drawer-body" style="display:none"></div>

    {{-- Footer --}}
    <div class="p-7 space-y-4 border-t border-foreground/5" id="sc-drawer-footer" style="display:none">

        @if(count($visiblePay) > 0)
        <div class="flex items-center gap-2 flex-wrap">
            @foreach($visiblePay as $key => $pm)
                @php
                $pmIcon = match($key) {
                    'pagoMovil'  => 'iconify tabler--device-mobile',
                    'cash'       => 'iconify tabler--cash',
                    'puntoventa' => 'iconify tabler--credit-card',
                    'biopago'    => 'iconify tabler--fingerprint',
                    'cashea'     => 'iconify tabler--wallet',
                    'krece'      => 'iconify tabler--trending-up',
                    'wepa'       => 'iconify tabler--shopping-cart',
                    'lysto'      => 'iconify tabler--calendar-dollar',
                    'chollo'     => 'iconify tabler--discount-2',
                    'wally'      => 'iconify tabler--send-2',
                    'kontigo'    => 'iconify tabler--file-invoice',
                    'zelle'      => 'iconify tabler--bolt',
                    'paypal'     => 'iconify tabler--brand-paypal',
                    'zinli'      => 'iconify tabler--moneybag',
                    'airtm'      => 'iconify tabler--exchange',
                    'reserve'    => 'iconify tabler--shield-dollar',
                    'binancepay' => 'iconify tabler--currency-bitcoin',
                    'usdt'       => 'iconify tabler--coin',
                    'usd'        => 'iconify tabler--currency-dollar',
                    'eur'        => 'iconify tabler--currency-euro',
                    default      => 'iconify tabler--cash',
                };
                @endphp
                <span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-foreground/50 bg-surface rounded-xl px-2.5 py-1.5">
                    <span class="{{ $pmIcon }} size-3.5 shrink-0"></span>
                    {{ $pm['label'] }}
                </span>
            @endforeach
        </div>
        @endif

        <div class="bg-surface/60 p-5 rounded-[1.5rem] border border-foreground/5">
            <div class="flex justify-between items-center text-foreground/40 text-xs font-black uppercase tracking-widest mb-1">
                <span>Subtotal</span>
                <span id="sc-total-label">{{ $currencySymbol }}</span>
            </div>
            <div class="text-4xl font-black tracking-tighter" id="sc-total">0.00</div>
        </div>

        @if($waClean)
        <button onclick="sendWhatsApp()" class="flex items-center justify-center w-full h-14 rounded-[1.5rem] border-none font-black text-base gap-2.5 text-white transition-colors"
                style="background:#25D366;">
            <span class="iconify tabler--brand-whatsapp size-6"></span>
            Finalizar por WhatsApp
        </button>
        @else
        <button class="flex items-center justify-center w-full h-14 rounded-[1.5rem] bg-primary text-primary-foreground hover:bg-primary/90 font-black text-base transition-colors">
            Ir al resumen
        </button>
        @endif
    </div>
</aside>

{{-- MODAL Datos Cliente --}}
@if($needsName || $needsPhone || $needsLocation)
<div id="sc-data-modal" class="sc-modal-overlay">
    <div class="sc-modal p-6 space-y-5">
        <div class="flex items-start gap-3">
            <div class="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <svg aria-hidden="true" focusable="false" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="7" r="4"></circle>
                    <path d="M5.5 21a6.5 6.5 0 0 1 13 0"></path>
                </svg>
            </div>
            <div class="flex-1">
                <p class="text-lg font-black">Antes de enviar</p>
                <p class="text-sm text-foreground/60">Déjanos tus datos para personalizar tu pedido.</p>
            </div>
            <button onclick="closeDataModal()" class="p-2 rounded-full text-sm text-foreground/80 hover:bg-surface transition-colors">
                <svg aria-hidden="true" focusable="false" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6 6 18M6 6l12 12"></path>
                </svg>
            </button>
        </div>

        @if($needsName)
        <div class="sc-field">
            <input type="text" id="sc-customer-name" placeholder=" " autocomplete="given-name" inputmode="text">
            <label for="sc-customer-name">Nombre</label>
        </div>
        @endif
        @if($needsPhone)
        <div class="sc-field">
            <input type="tel" id="sc-customer-phone" placeholder=" " autocomplete="tel" inputmode="numeric" maxlength="13">
            <label for="sc-customer-phone">WhatsApp (58XXXXXXXXXX)</label>
        </div>
        @endif
        @if($needsLocation)
        <div class="sc-field">
            <input type="text" id="sc-customer-location" placeholder=" " autocomplete="off" inputmode="text">
            <label for="sc-customer-location">Referencia / Sector</label>
        </div>
        @endif

        <div class="flex gap-3">
            <button onclick="confirmDataAndSend()" class="py-2 px-4 rounded-xl font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 flex-1 font-black">Enviar por WhatsApp</button>
            <button onclick="closeDataModal()" class="py-2 px-4 rounded-xl font-medium transition-colors text-foreground/80 hover:bg-surface">Cancelar</button>
        </div>
    </div>
</div>
@endif

{{-- MODAL Tienda Cerrada (confirmación) --}}
<div id="sc-closed-modal" class="sc-modal-overlay">
    <div class="sc-modal p-6 space-y-5">
        <div class="flex items-start gap-3">
            <div class="size-10 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <svg aria-hidden="true" focusable="false" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
            </div>
            <div class="flex-1">
                <p class="text-lg font-black text-red-700">Tienda cerrada</p>
                <p class="text-sm text-foreground/60">Igual puedes enviar tu mensaje. Te responderemos cuando abramos.</p>
            </div>
        </div>
        <div class="flex gap-3">
            <button id="sc-closed-send-btn" class="py-3 px-4 rounded-xl font-black transition-colors bg-primary text-primary-foreground hover:bg-primary/90 flex-1 cursor-pointer">Enviar de todas formas</button>
            <button onclick="closeClosedModal()" class="py-3 px-4 rounded-xl font-medium transition-colors text-foreground/80 hover:bg-surface cursor-pointer">Cancelar</button>
        </div>
    </div>
</div>

{{-- MODAL Pedido Confirmado --}}
<div id="sc-confirm-modal" class="sc-modal-overlay">
    <div class="sc-modal p-6 space-y-5">
        <div class="flex items-start gap-3">
            <div class="size-10 rounded-2xl bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                <svg aria-hidden="true" focusable="false" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            <div class="flex-1">
                <p class="text-lg font-black">Pedido enviado</p>
                <p class="text-sm text-foreground/60">Tu pedido fue registrado exitosamente.</p>
            </div>
        </div>
        <div class="text-center py-2">
            <p class="text-sm text-foreground/50 mb-1">Tu número de pedido:</p>
            <p id="sc-confirm-order-id" class="text-3xl font-black tracking-tight text-primary"></p>
            <p class="text-xs text-foreground/40 mt-2">Guárdalo para hacer seguimiento</p>
        </div>
        <div class="flex flex-col gap-3">
            <button id="sc-confirm-wa-btn" class="py-3 px-4 rounded-xl font-black transition-colors bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 cursor-pointer">
                <svg aria-hidden="true" focusable="false" class="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.999 2C6.477 2 2 6.477 2 12c0 1.89.525 3.657 1.438 5.168L2 22l4.985-1.407A9.96 9.96 0 0 0 12 22c5.523 0 10-4.477 10-10S17.522 2 11.999 2zm.001 18a7.96 7.96 0 0 1-4.08-1.124l-.292-.174-3.01.849.854-2.935-.19-.301A7.96 7.96 0 0 1 4 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.588 8-7.999 8z"/></svg>
                Abrir WhatsApp
            </button>
            <button onclick="closeConfirmModal()" class="py-3 px-4 rounded-xl font-medium transition-colors text-foreground/80 hover:bg-surface cursor-pointer">Cerrar</button>
        </div>
    </div>
</div>

{{-- 6. FOOTER STOREFRONT --}}
    @include('landing.sections.footer-storefront')





@endsection

@push('scripts')
<script>
(function(){
    'use strict';
    const CURRENCY_MODE = @json($savedDisplayMode);
    const CURRENCY_SYMBOL = @json($currencySymbol);
    const EXCHANGE_RATE = @json($dollarRate);
    const EURO_RATE = @json($euroRate);
    let currentCurrency = (CURRENCY_MODE === 'bolivares_only') ? 'Bs.' : (CURRENCY_MODE === 'euro_toggle' ? '€' : CURRENCY_SYMBOL);
    var cart = {};

    function formatPrice(usdPrice, isPlain = false) {
        const val = parseFloat(usdPrice) || 0;
        let rate = (currentCurrency === 'Bs.') ? (CURRENCY_MODE === 'euro_toggle' ? EURO_RATE : EXCHANGE_RATE) : 1;
        let formatted = (val * rate).toLocaleString('es-VE', {minimumFractionDigits:2});
        if(isPlain) return currentCurrency + ' ' + formatted;
        return '<span class="text-xs opacity-40 mr-1">' + currentCurrency + '</span>' + formatted;
    }

    window.setCurrency = function(mode) {
        currentCurrency = (mode === 'bs') ? 'Bs.' : (mode === 'eur' ? '€' : CURRENCY_SYMBOL);
        document.querySelectorAll('[data-price-usd]').forEach(el => el.innerHTML = formatPrice(el.getAttribute('data-price-usd')));
        document.querySelectorAll('.sc-curr-btn').forEach(btn => {
            let active = (btn.dataset.currency === 'ref' && currentCurrency === CURRENCY_SYMBOL) || (btn.dataset.currency === 'bs' && currentCurrency === 'Bs.');
            btn.className = `sc-curr-btn px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${active ? 'bg-background shadow-lg text-primary' : 'text-foreground/40'}`;
        });
        renderDrawer();
    };

    var _scPage = 1;
    var _scPerPage = 150;
    var _scActiveCat = 'all';
    var _scActiveSub = '';
    var _scSearchRaw = '';
    var _scSearchTerm = '';
    var _scSearchAnchored = false;
    var _scIndex = [];

    function normalizeSearchText(value) {
        var text = String(value || '').toLowerCase();
        if (typeof text.normalize === 'function') {
            text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        return text
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    window.scToggleSearch = function() {
        var wrap = document.getElementById('sc-search-wrap');
        var btn = document.getElementById('sc-search-btn');
        if (!wrap || !btn) return;

        var isOpen = wrap.style.display === 'flex';
        if (isOpen) {
            wrap.style.display = 'none';
            btn.classList.remove('text-foreground');
            btn.classList.add('text-foreground/50');
            return;
        }

        wrap.style.display = 'flex';
        btn.classList.remove('text-foreground/50');
        btn.classList.add('text-foreground');
        var input = document.getElementById('sc-search-input');
        if (input) setTimeout(function() { input.focus(); }, 10);
    };

    window.scCloseSearch = function() {
        var input = document.getElementById('sc-search-input');
        if (input) input.value = '';
        searchProducts('');
        scToggleSearch();
    };

    function buildSearchIndex() {
        _scIndex = Array.from(document.querySelectorAll('.sc-product-card')).map(function(card) {
            var searchAttr = (card.getAttribute('data-search') || '').toLowerCase();
            return {
                el: card,
                category: card.dataset.category || '',
                subcategory: card.dataset.subcategory || '',
                raw: searchAttr,
                norm: normalizeSearchText(searchAttr),
            };
        });
    }

    function getFilteredCards() {
        if (!_scIndex.length) buildSearchIndex();
        return _scIndex.filter(function(item) {
            var matchCat = _scActiveCat === 'all' || item.category === _scActiveCat;
            var matchSub = !_scActiveSub || item.subcategory === _scActiveSub;
            var matchSearch = !_scSearchTerm
                || item.norm.indexOf(_scSearchTerm) !== -1
                || item.raw.indexOf(_scSearchRaw) !== -1;
            return matchCat && matchSub && matchSearch;
        }).map(function(item) {
            return item.el;
        });
    }

    function renderVisibleCards() {
        var all = Array.from(document.querySelectorAll('.sc-product-card'));
        var filtered = getFilteredCards();
        var limit = _scPage * _scPerPage;
        var visibleCount = 0;
        var hasActiveSearchOrFilter = !!_scSearchTerm || _scActiveCat !== 'all' || !!_scActiveSub;

        var heroShowcase = document.getElementById('sc-hero-showcase');
        if (heroShowcase) {
            heroShowcase.style.display = hasActiveSearchOrFilter ? 'none' : '';
        }

        if (!hasActiveSearchOrFilter) {
            // Restore batch state: cards not yet revealed (sc-card-hidden) stay hidden
            all.forEach(function(card) {
                card.style.display = card.classList.contains('sc-card-hidden') ? 'none' : '';
            });
        } else {
            all.forEach(function(card) {
                card.style.display = 'none';
            });
            filtered.forEach(function(card, i) {
                if (i < limit) {
                    card.style.display = '';
                    visibleCount++;
                    var imgs = card.querySelectorAll('img.sc-lazy[data-src]');
                    imgs.forEach(function(img) {
                        if (!img.src || img.src === window.location.href) {
                            img.src = img.dataset.src;
                        }
                    });
                }
            });
        }

        // Update count
        var countText = filtered.length + ' producto' + (filtered.length !== 1 ? 's' : '');
        var countEl = document.getElementById('sc-products-count');
        if (countEl) countEl.textContent = countText;

        // No results
        var noRes = document.getElementById('sc-no-results');
        if (noRes) noRes.classList.toggle('hidden', filtered.length > 0);

        // Si hay búsqueda/filtro activo, ocultar showcase y scroll al grid
        if (hasActiveSearchOrFilter) {
            var showcase = document.getElementById('sc-hero-showcase');
            if (showcase) showcase.style.display = 'none';
            var gridTarget = document.getElementById('sc-cat-sections') || document.getElementById('productos');
            if (gridTarget && gridTarget.getBoundingClientRect().top > window.innerHeight * 0.5) {
                window.scScrollToCatalog(gridTarget);
            }
        } else {
            var showcase = document.getElementById('sc-hero-showcase');
            if (showcase) showcase.style.display = '';
        }

        // RAMA A: actualizar visibilidad de secciones de categoría
        var catSections = document.querySelectorAll('.sc-cat-section');
        if (catSections.length > 0) {
            if (hasActiveSearchOrFilter) {
                catSections.forEach(function(section) {
                    var anyVisible = false;
                    section.querySelectorAll('.sc-product-card').forEach(function(c) {
                        if (c.style.display !== 'none') anyVisible = true;
                    });
                    section.style.display = anyVisible ? '' : 'none';
                });
                var orphanSec = document.getElementById('sc-orphan-section');
                if (orphanSec) {
                    var orphanHasVisible = false;
                    orphanSec.querySelectorAll('.sc-product-card').forEach(function(c) {
                        if (c.style.display !== 'none') orphanHasVisible = true;
                    });
                    orphanSec.style.display = orphanHasVisible ? '' : 'none';
                }
                var catSectionsEl = document.getElementById('sc-cat-sections');
                if (catSectionsEl) catSectionsEl.style.display = '';
            } else {
                catSections.forEach(function(s) { s.style.display = ''; });
                var orphanSec = document.getElementById('sc-orphan-section');
                if (orphanSec) orphanSec.style.display = '';
            }
        }

        // Load more button
        var lmWrap = document.getElementById('sc-load-more-wrap');
        if (lmWrap) {
            var remaining = filtered.length - limit;
            lmWrap.style.display = remaining > 0 ? '' : 'none';
            var remEl = document.getElementById('sc-remaining-count');
            if (remEl) remEl.textContent = '(' + remaining + ')';
        }
    }

    // Scroll al catálogo descontando el sticky bar
    window.scScrollToCatalog = function(el) {
        var bar = document.getElementById('sc-sticky-bar');
        var offset = bar ? bar.offsetHeight : 95;
        var top = el.getBoundingClientRect().top + window.scrollY - offset - 4;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    };

    // ── Sistema de navegación por scroll (paradigma food) ──────────
    function scSetActiveTab(catName) {
        document.querySelectorAll('.sc-cat-tab').forEach(function(btn) {
            var active = btn.getAttribute('data-cat') === catName;
            btn.classList.toggle('active', active);
            if (active) {
                var bar = btn.closest('[class*="overflow-x-auto"]');
                if (bar) bar.scrollTo({
                    left: btn.offsetLeft - bar.offsetWidth / 2 + btn.offsetWidth / 2,
                    behavior: 'smooth'
                });
            }
        });
    }

    // Datos de subcategor\u00edas disponibles por categor\u00eda padre
    var _scSubData = @json(
        collect($scCatCategories)->mapWithKeys(fn($c) => [
            $c['name'] => collect($c['subcategories'] ?? [])->pluck('name')->filter()->values()->all()
        ])->filter(fn($subs) => count($subs) > 0)->all()
    );

    function updateSubcategoryBar(catName, activeSub) {
        var row = document.getElementById('sc-sub-tabs-row');
        if (!row) return;
        var inner = row.querySelector('div');
        var subs = _scSubData[catName] || [];
        if (!subs.length || catName === 'all') {
            row.style.display = 'none';
            return;
        }
        inner.innerHTML = '';
        // Pill "Todas"
        var allBtn = document.createElement('button');
        allBtn.className = 'sc-sub-tab shrink-0 px-3 py-1 text-[11px] font-bold rounded-full whitespace-nowrap transition-all cursor-pointer border';
        allBtn.textContent = 'Todas';
        allBtn.setAttribute('data-sub', '');
        var allActive = !activeSub;
        allBtn.style.cssText = allActive
            ? 'background:var(--primary);color:var(--primary-foreground);border-color:transparent'
            : 'background:transparent;color:rgba(var(--foreground-rgb,0,0,0),.5);border-color:rgba(0,0,0,.08)';
        allBtn.onclick = function() { filterCategory(catName, ''); };
        inner.appendChild(allBtn);
        subs.forEach(function(sub) {
            var btn = document.createElement('button');
            btn.className = 'sc-sub-tab shrink-0 px-3 py-1 text-[11px] font-bold rounded-full whitespace-nowrap transition-all cursor-pointer border';
            btn.textContent = sub;
            btn.setAttribute('data-sub', sub);
            var isActive = sub === activeSub;
            btn.style.cssText = isActive
                ? 'background:var(--primary);color:var(--primary-foreground);border-color:transparent'
                : 'background:transparent;color:rgba(var(--foreground-rgb,0,0,0),.5);border-color:rgba(0,0,0,.08)';
            btn.onclick = function() { filterCategory(catName, sub); };
            inner.appendChild(btn);
        });
        row.style.display = '';
    }

    window.scScrollToSection = function(catName) {
        // Pills = navegaci\u00f3n pura. Solo reseteamos filtro si estaba activo
        // para que el usuario vea las secciones correctamente en batch mode.
        if (_scActiveSub || _scActiveCat !== 'all') {
            _scActiveSub = '';
            _scActiveCat = 'all';
            _scPage = 1;
            buildSearchIndex();
            renderVisibleCards();
        }
        scSetActiveTab(catName);
        updateSubcategoryBar(catName, '');
        if (catName === 'all') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        var slug = catName.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        var el = document.getElementById('sc-section-' + slug);
        if (!el) return;
        var bar = document.getElementById('sc-sticky-bar');
        var offset = bar ? bar.offsetHeight : 95;
        var top = el.getBoundingClientRect().top + window.scrollY - offset - 8;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    };

    window.filterCategory = function(catName, subName) {
        subName = subName || '';
        _scActiveCat = catName;
        _scActiveSub = subName;
        _scPage = 1;
        buildSearchIndex();
        renderVisibleCards();
        scSetActiveTab(catName);
        updateSubcategoryBar(catName, subName);
        if (catName === 'all') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        var gridTarget = document.getElementById('sc-cat-sections') || document.getElementById('sc-orphan-section') || document.getElementById('productos');
        if (gridTarget) {
            var bar = document.getElementById('sc-sticky-bar');
            var offset = bar ? bar.offsetHeight : 95;
            var top = gridTarget.getBoundingClientRect().top + window.scrollY - offset - 8;
            window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
    };

    // ── Scroll spy ──────────────────────────────────────────────────
    (function() {
        if (!('IntersectionObserver' in window)) return;
        var catSections = Array.from(document.querySelectorAll('.sc-cat-section[id]'));
        if (catSections.length < 2) return;
        var lastActive = null;

        var spy = new IntersectionObserver(function(entries) {
            var best = null;
            entries.forEach(function(e) {
                if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) best = e;
            });
            if (!best) return;
            var catName = best.target.getAttribute('data-cat');
            if (!catName || catName === lastActive) return;
            lastActive = catName;
            scSetActiveTab(catName);
        }, { rootMargin: '-10% 0px -70% 0px', threshold: [0, 0.1, 0.25, 0.5] });

        catSections.forEach(function(s) { spy.observe(s); });

        // Sentinel para detectar regreso al tope → activar "Todos"
        var sentinel = document.getElementById('sc-cat-sections');
        if (sentinel) {
            var topSpy = new IntersectionObserver(function(entries) {
                entries.forEach(function(e) {
                    if (e.isIntersecting && e.boundingClientRect.top > 0) {
                        lastActive = 'all';
                        scSetActiveTab('all');
                    }
                });
            }, { threshold: 0 });
            topSpy.observe(sentinel);
        }
    })();


    window.searchProducts = function(term) {
        _scSearchRaw = String(term || '').toLowerCase().trim();
        _scSearchTerm = normalizeSearchText(term);
        // Reindexar por seguridad ante cambios dinámicos de cards.
        buildSearchIndex();

        // Al iniciar búsqueda, anclar al catálogo una sola vez
        if (_scSearchRaw && !_scSearchAnchored) {
            _scSearchAnchored = true;
        }
        if (!_scSearchRaw) {
            _scSearchAnchored = false;
        }

        // Si se escribe en búsqueda, buscar globalmente para no perder resultados por filtro activo.
        if (_scSearchTerm) {
            _scActiveCat = 'all';
            _scActiveSub = '';
            document.querySelectorAll('.sc-cat-tab').forEach(function(btn) {
                var active = String(btn.dataset.cat) === 'all';
                btn.classList.toggle('active', active);
            });
        }
        _scPage = 1;
        renderVisibleCards();
    };

    window.loadMoreProducts = function() {
        _scPage++;
        renderVisibleCards();
    };

    window.addToCart = function(id, name, price, img, variantLabel) {
        if (!window.__tenantIsOpen) showClosedToast();
        const safeVariantKey = (variantLabel || '')
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_:\-]/g, '');
        const key = safeVariantKey ? `${id}::${safeVariantKey}` : String(id);
        const isNew = !cart[key];
        if (cart[key]) cart[key].qty++;
        else cart[key] = {
            id: String(id),
            name,
            price: parseFloat(price) || 0,
            qty: 1,
            img,
            variant: variantLabel || null,
        };
        updateBadge();
        renderDrawer();

        // Only reflect inline qty controls for non-variant items.
        if (!variantLabel) {
            const qr = document.getElementById('qty-row-' + id);
            if (qr) qr.style.cssText = 'display:flex!important';
            const qv = document.getElementById('qty-val-' + id);
            if (qv) qv.textContent = cart[key].qty;
        }

        if (isNew && Object.keys(cart).length === 1) toggleDrawer();
    };

    window.changeQty = function(id, delta) {
        if (!cart[id]) return;
        cart[id].qty += delta;
        if (cart[id].qty <= 0) {
            delete cart[id];
            const qr = document.getElementById('qty-row-' + id);
            if (qr) qr.style.cssText = 'display:none!important';
        } else {
            const qv = document.getElementById('qty-val-' + id);
            if (qv) qv.textContent = cart[id].qty;
        }
        updateBadge();
        renderDrawer();
    };

    function scWiggleCart() {
        document.querySelectorAll('#sc-cart-trigger, #sc-cart-trigger-m, #sc-cart-trigger-desktop').forEach(function(btn) {
            btn.classList.remove('sc-cart-wiggle'); void btn.offsetWidth; btn.classList.add('sc-cart-wiggle');
        });
    }

    function updateBadge() {
        let total = Object.values(cart).reduce((a, b) => a + b.qty, 0);
        document.querySelectorAll('#sc-cart-count, .sc-cart-count-badge').forEach(function(b) {
            b.style.display = total > 0 ? 'flex' : 'none';
            b.textContent = total;
            b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
        });
        if (total > 0) scWiggleCart();
    }

    // Recordatorio periódico cuando hay items en el carrito
    setInterval(function() {
        var total = Object.values(cart).reduce(function(a, b) { return a + b.qty; }, 0);
        if (total > 0) scWiggleCart();
    }, 30000);

    window.toggleDrawer = function() {
        document.getElementById('sc-overlay').classList.toggle('open');
        document.getElementById('sc-drawer').classList.toggle('open');
        document.body.style.overflow = document.getElementById('sc-drawer').classList.contains('open') ? 'hidden' : '';
    };

    function renderDrawer() {
        const body   = document.getElementById('sc-drawer-body');
        const footer = document.getElementById('sc-drawer-footer');
        const empty  = document.getElementById('sc-empty');

        body.innerHTML = '';
        const keys = Object.keys(cart);

        if (keys.length === 0) {
            empty.style.display = 'flex';
            body.style.display  = 'none';
            footer.style.display = 'none';
            return;
        }

        empty.style.display  = 'none';
        body.style.display   = 'block';
        footer.style.display = 'block';

        let totalUsd = 0;
        keys.forEach(id => {
            const item = cart[id];
            totalUsd += item.price * item.qty;
            const div = document.createElement('div');
            div.className = 'flex items-center gap-4 py-4 border-b border-foreground/5 last:border-0';
            div.innerHTML = `
                <div style="width:56px;height:56px;border-radius:14px;overflow:hidden;background:var(--surface,#e5e7eb);flex-shrink:0">
                    <img style="width:100%;height:100%;object-fit:cover" src="${item.img || ''}">
                </div>
                <div style="flex:1;min-width:0">
                    <p style="font-weight:800;font-size:.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px">${item.name}</p>
                    ${item.variant ? `<p style="font-size:.68rem;opacity:.55;margin-bottom:2px">${item.variant}</p>` : ''}
                    <p style="font-size:.75rem;font-weight:700;opacity:.45">${item.qty} × ${formatPrice(item.price, true)}</p>
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                    <button onclick="changeQty('${id}', -1)" style="width:28px;height:28px;border-radius:50%;border:none;cursor:pointer;background:var(--surface,#f3f4f6);font-weight:900;font-size:.8rem;line-height:1">−</button>
                    <span style="font-size:.8rem;font-weight:900;min-width:14px;text-align:center">${item.qty}</span>
                    <button onclick="changeQty('${id}', 1)" style="width:28px;height:28px;border-radius:50%;border:none;cursor:pointer;background:var(--primary);color:var(--primary-foreground);font-weight:900;font-size:.8rem;line-height:1">+</button>
                </div>
            `;
            body.appendChild(div);
        });
        document.getElementById('sc-total').innerHTML = formatPrice(totalUsd);
        document.getElementById('sc-total-label').textContent = currentCurrency;
    }

    window.openDataModal = function() {
        const modal = document.getElementById('sc-data-modal');
        if (modal) modal.style.display = 'flex';
    };
    window.closeDataModal = function() {
        const modal = document.getElementById('sc-data-modal');
        if (modal) modal.style.display = 'none';
    };

    async function buildAndSend(name, phone, loc) {
        const subdomain = @json($tenant->subdomain);
        const isPlanAnual = @json($tenant->plan->slug ?? '');
        const cartItems = Object.values(cart).map(i => ({
            title: i.name,
            qty: i.qty,
            price: i.price,
            variant: i.variant ?? null
        }));

        if (isPlanAnual === 'cat-vision') {
            try {
                const res = await fetch(`/${subdomain}/checkout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                    },
                    body: JSON.stringify({ name, phone, location: loc, items: cartItems })
                });
                const data = await res.json();
                if (data.success && data.whatsapp_url) {
                    var confirmModal = document.getElementById('sc-confirm-modal');
                    var orderIdEl   = document.getElementById('sc-confirm-order-id');
                    var waBtn       = document.getElementById('sc-confirm-wa-btn');
                    if (orderIdEl) orderIdEl.textContent = data.order_id ?? '';
                    if (waBtn) waBtn.onclick = function() { window.open(data.whatsapp_url, '_blank'); };
                    closeDataModal();
                    if (confirmModal) confirmModal.style.display = 'flex';
                    return;
                }
            } catch(e) {
                console.error('Checkout error:', e);
            }
        }

        // Fallback planes Básico y Semestral — mensaje sin SC-XXXX
        const waNumber = @json($waClean);
        if (!waNumber) return;
        let businessName = @json($tenant->business_name);
        let greeting = name
            ? `¡Hola! Soy *${name}* y vengo de la web de *${businessName}* 🛍️`
            : `¡Hola! Les escribo desde la web de *${businessName}* 🛍️`;
        let totalUsd = Object.values(cart).reduce((a,b) => a + (b.price * b.qty), 0);
        let msg = greeting + '\n\n*Mi pedido:*\n';
        msg += Object.values(cart).map(i => {
            const variantText = i.variant ? ` (${i.variant})` : '';
            return `• ${i.name}${variantText} ×${i.qty} (${formatPrice(i.price * i.qty, true)})`;
        }).join('\n');
        msg += '\n\n*Total: ' + formatPrice(totalUsd, true) + '*';
        if (phone) msg += `\n\n*WhatsApp:* ${phone}`;
        if (loc) msg += `\n\n📍 *Mi referencia:* ${loc}`;
        window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    function openClosedModal(onConfirm) {
        var modal = document.getElementById('sc-closed-modal');
        if (!modal) { onConfirm(); return; }
        modal.style.display = 'flex';
        var btn = document.getElementById('sc-closed-send-btn');
        var handler = function() {
            btn.removeEventListener('click', handler);
            closeClosedModal();
            onConfirm();
        };
        btn.addEventListener('click', handler);
    }
    window.closeClosedModal = function() {
        var modal = document.getElementById('sc-closed-modal');
        if (modal) modal.style.display = 'none';
    };

    window.closeConfirmModal = function() {
        var modal = document.getElementById('sc-confirm-modal');
        if (modal) modal.style.display = 'none';
        cart = {};
        renderDrawer();
        var drawer = document.getElementById('sc-drawer');
        var overlay = document.getElementById('sc-overlay');
        if (drawer) drawer.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
        document.body.style.overflow = '';
    };

    window.sendWhatsApp = function() {
        var _doSend = function() {
            @if(!$needsName && !$needsPhone && !$needsLocation)
                buildAndSend('', '', '');
                return;
            @endif

            const nameEl  = document.getElementById('sc-customer-name');
            const phoneEl = document.getElementById('sc-customer-phone');
            const locEl   = document.getElementById('sc-customer-location');
            const name    = nameEl ? nameEl.value.trim() : '';
            const phone   = phoneEl ? phoneEl.value.trim().replace(/\D/g, '') : '';
            const loc     = locEl  ? locEl.value.trim()  : '';

            if ((nameEl && !name) || (phoneEl && !phone) || (locEl && !loc)) {
                openDataModal();
                return;
            }

            if (phoneEl && !/^58(412|414|416|422|424|426)\d{7}$/.test(phone)) {
                phoneEl.classList.add('sc-field-error');
                phoneEl.focus();
                return;
            }

            if (name) localStorage.setItem('sc_customer_name', name);
            if (phone) localStorage.setItem('sc_customer_phone', phone);
            buildAndSend(name, phone, loc);
        };

        if (!window.__tenantIsOpen) {
            openClosedModal(_doSend);
            return;
        }
        _doSend();
    };

    window.confirmDataAndSend = function() {
        const nameEl  = document.getElementById('sc-customer-name');
        const phoneEl = document.getElementById('sc-customer-phone');
        const locEl   = document.getElementById('sc-customer-location');
        const name    = nameEl ? nameEl.value.trim() : '';
        const phone   = phoneEl ? phoneEl.value.trim().replace(/\D/g, '') : '';
        const loc     = locEl  ? locEl.value.trim()  : '';

        @if($needsName)
        if (nameEl && !name) {
            nameEl.classList.add('sc-field-error');
            nameEl.focus();
            return;
        }
        @endif

        @if($needsPhone)
        if (phoneEl && !/^58(412|414|416|422|424|426)\d{7}$/.test(phone)) {
            phoneEl.classList.add('sc-field-error');
            phoneEl.focus();
            return;
        }
        @endif

        if (name) localStorage.setItem('sc_customer_name', name);
        if (phone) localStorage.setItem('sc_customer_phone', phone);
        closeDataModal();
        buildAndSend(name, phone, loc);
    };

    document.addEventListener('DOMContentLoaded', () => {
        setCurrency('ref');
        renderVisibleCards();

        window.addEventListener('resize', function() {
            var wrap = document.getElementById('sc-search-wrap');
            if (!wrap) return;
            // Close search on resize if open
            if (window.innerWidth >= 768 && wrap.style.display === 'flex') {
                // Keep open on desktop — no action needed
            }
        });

        var searchInput = document.getElementById('sc-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                searchProducts(searchInput.value);
            });
            searchInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchProducts(searchInput.value);
                }
            });
        }

        buildSearchIndex();

        const savedName = localStorage.getItem('sc_customer_name');
        if (savedName) {
            const el = document.getElementById('sc-customer-name');
            if (el) el.value = savedName;
        }

        const savedPhone = localStorage.getItem('sc_customer_phone');
        if (savedPhone) {
            const el = document.getElementById('sc-customer-phone');
            if (el) el.value = savedPhone;
        }

        ['sc-customer-name', 'sc-customer-phone', 'sc-customer-location'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => el.classList.remove('sc-field-error'));
        });
    });
})();
</script>



{{-- Acento por categoría --}}
<script>
    const SC_GALLERY = @json($productGalleryMap);
</script>
<script>
// ── Modal de Producto ──
var _pmCurrent = {};
var _pmSelections = {};

function openPM(id, name, price, img, desc, comparePrice, isFeatured, variants, images) {
    _pmSelections = {};
    _pmCurrent = {
        id: id,
        name: name,
        price: price,
        img: img,
        desc: desc,
        comparePrice: comparePrice,
        variants: variants || [],
        images: (SC_GALLERY[id] && SC_GALLERY[id].length > 1
            ? SC_GALLERY[id]
            : (images && images.length ? images : (img ? [img] : []))),

        currentImageIndex: 0
    };

    function setPMImage(index) {
        var imgs = _pmCurrent.images || [];
        if (!imgs.length) {
            var noImgEl = document.getElementById('sc-pm-img');
            if (noImgEl) {
                noImgEl.src = '';
                noImgEl.style.display = 'none';
            }
            return;
        }
        _pmCurrent.currentImageIndex = index;
        var pmImgEl = document.getElementById('sc-pm-img');
        pmImgEl.src = imgs[index];
        pmImgEl.style.display = 'block';

        var thumbs = document.querySelectorAll('.sc-pm-thumb');
        thumbs.forEach(function(t, i) {
            t.style.opacity = (i === index) ? '1' : '.55';
            t.style.borderColor = (i === index) ? 'var(--primary)' : 'rgba(0,0,0,.08)';
        });
    }

    // Imagen
    var thumbsWrap = document.getElementById('sc-pm-thumbs');
    if (thumbsWrap) {
        thumbsWrap.innerHTML = '';
        thumbsWrap.style.display = 'none';
        if (_pmCurrent.images.length > 1) {
            thumbsWrap.style.display = 'flex';
            _pmCurrent.images.forEach(function(url, i) {
                var thumb = document.createElement('img');
                thumb.src = url;
                thumb.className = 'sc-pm-thumb w-16 h-16 object-cover rounded-lg cursor-pointer border-2';
                thumb.style.opacity = i === 0 ? '1' : '.55';
                thumb.style.borderColor = i === 0 ? 'var(--primary)' : 'rgba(0,0,0,.08)';
                thumb.onclick = function() { setPMImage(i); };
                thumbsWrap.appendChild(thumb);
            });
        }
    }
    setPMImage(0);

    // Nombre
    document.getElementById('sc-pm-name').textContent = name;

    // Precio — usando el formateador del catálogo si existe
    var priceEl = document.getElementById('sc-pm-price');
    if (price && price > 0) {
        priceEl.setAttribute('data-price-usd', price);
        priceEl.innerHTML = (typeof formatPrice === 'function')
            ? formatPrice(price)
            : '<span style="font-size:10px;opacity:.4;margin-right:2px">REF</span>' + Number(price).toFixed(2);
        priceEl.style.display = '';
    } else {
        priceEl.style.display = 'none';
    }

    // Precio tachado
    var compareEl = document.getElementById('sc-pm-compare');
    if (comparePrice && comparePrice > price) {
        compareEl.setAttribute('data-price-usd', comparePrice);
        compareEl.innerHTML = (typeof formatPrice === 'function')
            ? formatPrice(comparePrice)
            : 'REF ' + Number(comparePrice).toFixed(2);
        compareEl.classList.remove('hidden');
    } else {
        compareEl.classList.add('hidden');
    }

    // Descripción
    var descEl = document.getElementById('sc-pm-desc');
    if (desc && desc.trim()) {
        descEl.textContent = desc;
        descEl.classList.remove('hidden');
    } else {
        descEl.classList.add('hidden');
    }

    // Badge especial
    var badgeWrap = document.getElementById('sc-pm-badge-wrap');
    badgeWrap.innerHTML = isFeatured
        ? '<span style="display:inline-flex;align-items:center;gap:4px;background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700;border:1px solid rgba(251,191,36,0.35)"><svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'#f59e0b\'><path d=\'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z\'/></svg> Especial</span>'
        : '';

    // Botón WhatsApp
    var waBtn = document.getElementById('sc-pm-wa-btn');
    var waNumber = '{{ preg_replace("/\D/", "", $tenant->getActiveWhatsapp() ?? "") }}';
    var msg = 'Hola, vi tu catálogo y me interesa: ' + name
            + (price > 0 ? ' — REF ' + Number(price).toFixed(2) : '')
            + '. ¿Está disponible?';
    waBtn.href = waNumber
        ? 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(msg)
        : '#';

    // Variantes
    var variantsEl = document.getElementById('sc-pm-variants');
    var variantError = document.getElementById('sc-pm-variant-error');
    if (variantsEl) {
        variantsEl.innerHTML = '';
        var pmVariants = _pmCurrent.variants || [];
        if (pmVariants.length) {
            pmVariants.forEach(function(v) {
                var groupEl = document.createElement('div');
                var label = document.createElement('p');
                label.className = 'text-xs font-black text-foreground/50 uppercase tracking-widest mb-1.5';
                label.textContent = v.name;
                groupEl.appendChild(label);
                var chipsEl = document.createElement('div');
                chipsEl.className = 'flex flex-wrap gap-2';
                (v.options || []).forEach(function(opt) {
                    var chip = document.createElement('button');
                    chip.textContent = opt;
                    chip.className = 'sc-pm-chip px-3 py-1.5 rounded-full border border-foreground/15 text-sm font-semibold text-foreground/70 hover:border-primary hover:text-primary transition-colors cursor-pointer';
                    chip.dataset.group = v.name;
                    chip.dataset.value = opt;
                    chip.onclick = function() {
                        chipsEl.querySelectorAll('.sc-pm-chip').forEach(function(c) {
                            c.classList.remove('bg-primary', 'text-primary-foreground', 'border-primary');
                            c.classList.add('border-foreground/15', 'text-foreground/70');
                        });
                        chip.classList.add('bg-primary', 'text-primary-foreground', 'border-primary');
                        chip.classList.remove('border-foreground/15', 'text-foreground/70');
                        _pmSelections[v.name] = opt;
                        if (variantError) variantError.style.display = 'none';
                    };
                    chipsEl.appendChild(chip);
                });
                groupEl.appendChild(chipsEl);
                variantsEl.appendChild(groupEl);
            });
        }
    }
    if (variantError) variantError.style.display = 'none';

    // Abrir overlay
    document.getElementById('sc-pm-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function pmAddToCart() {
    var variants = _pmCurrent.variants || [];
    var errorEl = document.getElementById('sc-pm-variant-error');
    if (variants.length > 0) {
        var missing = variants.find(function(v) { return !_pmSelections[v.name]; });
        if (missing) {
            if (errorEl) errorEl.style.display = '';
            return;
        }
    }
    var variantStr = Object.keys(_pmSelections).map(function(k) { return k + ': ' + _pmSelections[k]; }).join(' / ');
    addToCart(_pmCurrent.id, _pmCurrent.name, _pmCurrent.price, _pmCurrent.img, variantStr || null);
    closePM();
}

function closePM() {
    document.getElementById('sc-pm-overlay').classList.remove('open');
    document.body.style.overflow = '';
}

function sharePM() {
    var d = _pmCurrent;
    var url = window.location.href;
    var text = d.name + (d.price > 0 ? ' — REF ' + Number(d.price).toFixed(2) : '') + ' en {{ $tenant->business_name ?? "" }}';
    if (navigator.share) {
        navigator.share({ title: d.name, text: text, url: url }).catch(function(){});
    } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n' + url), '_blank');
    }
}

// Cerrar con Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closePM();
});

// Lazy load observer
(function() {
    if (!('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (!entry.isIntersecting) return;
            var img = entry.target;
            if (img.dataset.src && !img.src.includes(img.dataset.src)) {
                img.src = img.dataset.src;
            }
            observer.unobserve(img);
        });
    }, { rootMargin: '200px' });
    document.querySelectorAll('img.sc-lazy[data-src]').forEach(function(img) {
        observer.observe(img);
    });
})();
</script>

<script>
function heroNav(catId) {
    // 1. Activar filtro de categoría
    var chips = document.querySelectorAll('.sc-cat-tab');
    chips.forEach(function(p) {
        p.classList.remove('active');
    });
    var targetChip = document.querySelector('.sc-cat-tab[data-cat="' + catId + '"]');
    if (targetChip) {
        targetChip.classList.add('active');
    } else {
        var allChip = document.querySelector('.sc-cat-tab[data-cat="all"]');
        if (allChip) { allChip.classList.add('active'); }
    }

    // 2. Filtrar productos
    filterCategory(catId);

    // 3. Scroll suave al catálogo
    setTimeout(function() {
        var target = document.getElementById('productos');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 180);
}
</script>

<script>
(function() {
    // Paleta de acentos — rota por category_id asignando un color distinto a cada categoría
    const PALETTE = ['#E8440A','#2563EB','#059669','#7C3AED','#DB2777','#D97706','#0891B2','#DC2626'];
    const catMap = {};
    let idx = 0;
    document.querySelectorAll('.sc-card-accent[data-cat]').forEach(function(el) {
        const cat = el.getAttribute('data-cat');
        if (!cat) return;
        if (!(cat in catMap)) { catMap[cat] = PALETTE[idx % PALETTE.length]; idx++; }
        el.closest('.sc-product-card').style.setProperty('--accent-cat', catMap[cat]);
    });
})();
</script>

{{-- SyntiTrack --}}
<script>
(function() {
    const TENANT_ID = {{ $tenant->id }};
    const CSRF = document.querySelector('meta[name="csrf-token"]')?.content ?? '';
    function track(eventType) {
        fetch('/api/analytics/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': CSRF },
            body: JSON.stringify({ tenant_id: TENANT_ID, event_type: eventType })
        }).catch(() => {});
    }
    track('pageview');
    document.addEventListener('click', function(e) {
        if (e.target.closest('a[href*="wa.me"]')) track('click_whatsapp');
        if (e.target.closest('a[href^="tel:"]')) track('click_call');
    });
    setInterval(() => track('time_on_page'), 5000);
})();
</script>

{{-- Long press hamburger → abre panel oculto --}}
<script>
(function(){
    function attachLongPress(el) {
        if (!el) return;
        var timer;
        el.addEventListener('touchstart', function() {
            timer = setTimeout(function() {
                if (typeof openSyntiPanel === 'function') openSyntiPanel();
            }, 5000);
        }, { passive: true });
        el.addEventListener('touchend',    function() { clearTimeout(timer); });
        el.addEventListener('touchcancel', function() { clearTimeout(timer); });
    }
    attachLongPress(document.getElementById('synti-hamburger-trigger'));
    attachLongPress(document.getElementById('synti-hamburger-trigger-m'));
})();
</script>
<script>
window.scToggleCatMenu = function() {
    var d = document.getElementById('sc-cat-dropdown');
    var b = document.getElementById('sc-cat-backdrop');
    var open = d.style.display !== 'none';
    if (!open) {
        var mTrigger = document.getElementById('synti-hamburger-trigger-m');
        var dTrigger = document.getElementById('synti-hamburger-trigger');
        var trigger = (mTrigger && mTrigger.offsetParent !== null) ? mTrigger : dTrigger;
        if (trigger) {
            var rect = trigger.getBoundingClientRect();
            d.style.top  = (rect.bottom + 4) + 'px';
            d.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - 264)) + 'px';
        }
    }
    d.style.display = open ? 'none' : 'block';
    b.style.display = open ? 'none' : 'block';
};
</script>
{{-- Long press logo CAT → easter egg --}}
<script>
(function(){
    var el = document.getElementById('synti-cat-trigger');
    if(!el) return;
    var t = null;
    el.addEventListener('touchstart',  function(){ t = setTimeout(function(){ if(typeof openSyntiPanel==='function') openSyntiPanel(); if(navigator.vibrate) navigator.vibrate([60,30,60]); }, 5000); },{passive:true});
    el.addEventListener('touchend',    function(){ clearTimeout(t); },{passive:true});
    el.addEventListener('touchmove',   function(){ clearTimeout(t); },{passive:true});
    el.addEventListener('touchcancel', function(){ clearTimeout(t); },{passive:true});
    el.addEventListener('mousedown',   function(){ t = setTimeout(function(){ if(typeof openSyntiPanel==='function') openSyntiPanel(); }, 5000); });
    el.addEventListener('mouseup',     function(){ clearTimeout(t); });
    el.addEventListener('mouseleave',  function(){ clearTimeout(t); });
})();
</script>
{{-- Slider dots JS --}}
<script>
(function(){
    var slides = document.querySelectorAll('#sc-hero-slider .sc-slide');
    var dots   = document.querySelectorAll('#sc-hero-slider .sc-dot');
    if(slides.length <= 1) return;
    var cur = 0;
    function isModalOpen(){
        var drawer = document.getElementById('sc-drawer');
        var pm = document.getElementById('sc-pm-overlay');
        var drawerOpen = drawer && drawer.classList.contains('open');
        var pmOpen = pm && pm.style.display !== 'none' && pm.style.display !== '';
        return drawerOpen || pmOpen;
    }
    function goTo(n){
        slides[cur].style.opacity = '0';
        slides[cur].classList.remove('active');
        if(dots[cur]) dots[cur].classList.replace('bg-white','bg-white/40');
        cur = n;
        slides[cur].style.opacity = '1';
        slides[cur].classList.add('active');
        var img = slides[cur].querySelector('img');
        if(img){ img.style.animation='none'; img.offsetHeight; img.style.animation=''; }
        if(dots[cur]) dots[cur].classList.replace('bg-white/40','bg-white');
    }
    dots.forEach(function(d,i){ d.addEventListener('click', function(){ goTo(i); }); });
    setInterval(function(){ if(!isModalOpen()) goTo((cur+1) % slides.length); }, 6000);
})();
</script>
{{-- Ver más por categoría + grid libre --}}
<script>
window.scShowMore = function(catId) {
    var grid    = document.getElementById(catId + '-grid');
    var btnWrap = document.getElementById(catId + '-more-btn');
    if (!grid) return;
    var stillHidden = Array.from(grid.querySelectorAll('.sc-card-hidden'));
    if (!stillHidden.length) { if (btnWrap) btnWrap.style.display = 'none'; return; }
    var batch = stillHidden.slice(0, 10);
    batch.forEach(function(card) {
        card.classList.remove('sc-card-hidden');
        card.style.display = '';
        card.querySelectorAll('img.sc-lazy[data-src]').forEach(function(img) {
            if (!img.src || img.src === window.location.href) img.src = img.dataset.src;
        });
    });
    var remaining = stillHidden.length - batch.length;
    if (remaining <= 0) {
        if (btnWrap) btnWrap.style.display = 'none';
    } else {
        var remEl = btnWrap ? btnWrap.querySelector('[data-remaining]') : null;
        if (remEl) remEl.textContent = remaining + ' restantes';
    }
};

var SC_LOADED = 8;
window.scLoadMore = function() {
    var grid = document.getElementById('sc-products-grid');
    var btn  = document.getElementById('sc-load-more-wrap');
    var hidden = grid ? grid.querySelectorAll('.sc-card-hidden') : [];
    var count = 0;
    hidden.forEach(function(card) {
        if (count < 8) {
            card.classList.remove('sc-card-hidden');
            card.style.display = '';
            count++;
        }
    });
    if (grid && grid.querySelectorAll('.sc-card-hidden').length === 0) {
        if (btn) btn.style.display = 'none';
    }
};
</script>

@endpush