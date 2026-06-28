{{-- ═══════════════════════════════════════════════════════════════════════════════
     SYNTIfood — Storefront Menú Digital + Pedido WhatsApp
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

    $categories  = $menu ?? [];
    $plan        = $tenant->plan ?? null;
    $planSlug    = (string) ($plan->slug ?? 'food-basico');
    $isPlanAnual = in_array($planSlug, ['food-oportunidad', 'food-crecimiento', 'food-vision', 'food-anual']);

    $payMethods      = ($customization->payment_methods ?? []);
    $globalEnabled   = $payMethods['global'] ?? [];
    $currencyEnabled = $payMethods['currency'] ?? [];
    if ($planSlug === 'food-basico') {
        $globalEnabled   = ['pagoMovil', 'cash'];
        $currencyEnabled = [];
    }
    $allPayMeta = [
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

    $customerFields = $customization->customer_required_fields
        ?? ($tenant->settings['food_settings']['customer_fields'] ?? ['name']);
    $needsName = in_array('name', (array) $customerFields);
@endphp

@push('styles')
<style>
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    .sf-drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);z-index:200;opacity:0;pointer-events:none;transition:opacity .3s ease}
    .sf-drawer-overlay.open{opacity:1;pointer-events:auto}
    .sf-drawer{position:fixed;right:0;top:0;bottom:0;width:min(420px,95vw);z-index:201;transform:translateX(105%);transition:transform .4s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;box-shadow:-20px 0 60px rgba(0,0,0,.12);border-top-left-radius:2rem;border-bottom-left-radius:2rem}
    .sf-drawer.open{transform:translateX(0)}
    @keyframes bump{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}
    .bump{animation:bump .25s ease-out}
    .sf-dot { cursor: pointer; transition: all .3s; }
    /* ── Hero Slider horizontal slide ── */
    .sf-slide{transition:opacity .8s ease-in-out, transform .8s ease-in-out;will-change:transform,opacity}
    .sf-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);z-index:300;display:none;align-items:center;justify-content:center;padding:16px}
    .sf-modal{max-width:420px;width:100%;background:var(--background,#fff);border-radius:24px;box-shadow:0 30px 80px rgba(0,0,0,.25);border:1px solid rgba(0,0,0,.05)}
    .sf-field{position:relative}
    .sf-field input{width:100%;padding:1.35rem 1rem .55rem;border-radius:1rem;border:1.5px solid rgba(0,0,0,.08);background:var(--surface,#f3f4f6);font-weight:700;font-size:.875rem;outline:none;transition:border-color .2s,background .2s,box-shadow .2s;color:inherit}
    .sf-field input:focus{border-color:var(--primary,#570DF8);background:var(--background,#fff);box-shadow:0 0 0 3px color-mix(in oklch,var(--primary,#570DF8) 15%,transparent)}
    .sf-field label{position:absolute;left:1rem;top:50%;transform:translateY(-50%);font-size:.825rem;font-weight:700;color:rgba(0,0,0,.35);pointer-events:none;transition:all .18s cubic-bezier(.4,0,.2,1)}
    .sf-field input:focus+label,.sf-field input:not(:placeholder-shown)+label{top:.6rem;transform:none;font-size:.65rem;letter-spacing:.05em;color:var(--primary,#570DF8)}
    .sf-field-error{border-color:#ef4444!important;background:#fff5f5!important}
    .sf-field-error:focus{box-shadow:0 0 0 3px rgba(239,68,68,.15)!important}
    #sf-detail-view{position:fixed;inset:0;z-index:150;overflow-y:auto;background:var(--background,#fff);-webkit-overflow-scrolling:touch}
    #sf-detail-view{scrollbar-width:thin;scrollbar-color:var(--primary) transparent}
    #sf-detail-view::-webkit-scrollbar{width:4px}
    #sf-detail-view::-webkit-scrollbar-track{background:transparent}
    #sf-detail-view::-webkit-scrollbar-thumb{background:var(--primary);border-radius:99px}
    #sf-also-like-grid{scrollbar-width:thin;scrollbar-color:var(--primary) transparent}
    #sf-also-like-grid::-webkit-scrollbar{height:3px}
    #sf-also-like-grid::-webkit-scrollbar-track{background:transparent}
    #sf-also-like-grid::-webkit-scrollbar-thumb{background:var(--primary);border-radius:99px}
    img { transition: opacity 0.3s ease; }
    img[loading="lazy"] { opacity: 0; }
    img.loaded { opacity: 1; }

    /* ═══════════════════════════════════════════════════════
       Stitch Design System → CSS puro
       Bebas Neue · Glassmorphism · Elevación · Motion
    ═══════════════════════════════════════════════════════ */
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');

    /* Tokens de sombra usando var(--primary) del tema del tenant */
    :root {
        --sf-glow-sm:     0 0 8px  color-mix(in srgb, var(--primary) 30%, transparent);
        --sf-glow-md:     0 0 16px color-mix(in srgb, var(--primary) 40%, transparent), 0 4px 12px rgba(0,0,0,.3);
        --sf-glow-lg:     0 0 32px color-mix(in srgb, var(--primary) 50%, transparent), 0 8px 24px rgba(0,0,0,.4);
        --sf-card-shadow: 0 2px 8px rgba(0,0,0,.25), 0 0 0 1px color-mix(in srgb, var(--foreground) 8%, transparent);
        --sf-card-hover:  0 8px 24px rgba(0,0,0,.35), var(--sf-glow-sm);
        --sf-glass:       color-mix(in srgb, var(--background) 80%, transparent);
        --sf-glass-border:color-mix(in srgb, var(--primary) 25%, transparent);
    }

    /* ── Keyframes ── */
    @keyframes sf-shimmer {
        from { background-position: 200% center; }
        to   { background-position: -200% center; }
    }
    @keyframes sf-price-pulse {
        0%,100% { opacity: 1; }
        50%      { opacity: .75; text-shadow: var(--sf-glow-md); }
    }

    /* ── Hero: gradient overlay bottom-to-top sobre la foto ── */
    #sf-hero-slider { position: relative; }
    #sf-hero-slider::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 55%);
        pointer-events: none;
        z-index: 2;
    }

    /* ── Sticky bar: solo sombra — Tailwind bg-background/95 backdrop-blur-2xl lo maneja ── */
    #sf-sticky-bar {
        box-shadow: 0 4px 16px rgba(0,0,0,.15);
    }

    /* ── Category tabs: stacking + separación del hamburger ── */
    #sf-cat-tabs {
        position: relative;   /* crea stacking context propio, pinta sobre el div.relative del hamburger */
        z-index: 1;
        padding: 4px 8px;
        margin-left: 4px;     /* empuje fijo desde el ícono hamburger */
        min-width: 0;         /* permite que flex-1 encoja sin desbordarse */
    }
    .sf-cat-tab {
        display: inline-flex !important;
        align-items: center !important;
        white-space: nowrap !important;
        border-radius: 999px !important;
        padding: 5px 14px !important;
        border-bottom-width: 0 !important;
        transition: background 200ms ease, color 200ms ease, box-shadow 200ms ease !important;
        flex-shrink: 0;
    }
    .sf-cat-tab.border-primary {
        background: var(--primary) !important;
        color: var(--primary-foreground, #fff) !important;
        border-color: transparent !important;
        box-shadow: var(--sf-glow-sm) !important;
        font-weight: 700 !important;
    }

    /* ── Cards de menú: elevación + spring ── */
    .sf-item-card {
        transition: transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1),
                    box-shadow 180ms ease,
                    border-color 180ms ease !important;
        will-change: transform;
    }
    .sf-item-card:hover {
        transform: translateY(-3px);
        box-shadow: var(--sf-card-hover) !important;
        border-color: color-mix(in srgb, var(--primary) 40%, transparent) !important;
    }
    .sf-item-card:active {
        transform: scale(0.98) !important;
        transition-duration: 80ms !important;
    }

    /* ── Precios: Bebas Neue ── */
    .sf-item-card [data-price-usd],
    .sf-item-card p.text-primary,
    .sf-item-card p.text-sm.font-black.text-primary,
    .sf-item-card p.text-base.font-black.text-primary {
        font-family: 'Bebas Neue', sans-serif !important;
        font-size: 1.375rem !important;
        letter-spacing: .04em;
        line-height: 1;
    }
    /* Precio en vista detalle: display grande */
    #sf-detail-view [data-price-usd] {
        font-family: 'Bebas Neue', sans-serif !important;
        font-size: 2.25rem !important;
        letter-spacing: .04em;
        line-height: 1;
    }

    /* ── Section headers: Bebas Neue ── */
    .sf-cat-section h2,
    #sf-cat-featured h2 {
        font-family: 'Bebas Neue', sans-serif !important;
        font-size: 1.2rem !important;
        letter-spacing: .06em;
        font-weight: 400 !important;
        line-height: 1.1;
    }

    /* ── Badge Popular: shimmer con colores del tema ── */
    .sf-item-card span.bg-amber-100.text-amber-700 {
        background: linear-gradient(90deg,
            var(--primary),
            color-mix(in srgb, var(--primary) 55%, #F5A623 45%),
            var(--primary)) !important;
        background-size: 200% auto !important;
        animation: sf-shimmer 2s linear infinite !important;
        color: #fff !important;
    }

    /* ── Floating bar "Ver pedido": glow shadow ── */
    #sf-floating-bar button {
        box-shadow: 0 8px 32px color-mix(in srgb, var(--primary) 40%, transparent),
                    0 4px 16px rgba(0,0,0,.3) !important;
        transition: transform 100ms ease, opacity 100ms ease !important;
    }
    #sf-floating-bar button:active {
        transform: scale(0.97) !important;
        opacity: .9;
    }

    /* ── Detail bottom bar: glassmorphism ── */
    #sf-detail-bottom-bar {
        backdrop-filter: blur(20px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
        background: color-mix(in srgb, var(--background) 88%, transparent) !important;
        border-top: 1px solid color-mix(in srgb, var(--primary) 20%, transparent) !important;
    }
    #sf-detail-add-btn {
        transition: transform 100ms ease, opacity 100ms ease !important;
    }
    #sf-detail-add-btn:active {
        transform: scale(.97) !important;
        opacity: .9;
    }

    /* ══════════════════════════════════════════════════════
       Modales: drawer carrito · info · datos pedido
    ══════════════════════════════════════════════════════ */

    /* Overlays más opacos + blur reforzado */
    .sf-drawer-overlay,
    .sf-modal-overlay {
        background: rgba(0,0,0,0.7) !important;
        backdrop-filter: blur(4px) !important;
        -webkit-backdrop-filter: blur(4px) !important;
    }

    /* Drawer carrito: glassmorphism */
    .sf-drawer {
        backdrop-filter: blur(24px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
        background: color-mix(in srgb, var(--surface, #1a1a1a) 92%, transparent) !important;
        border-left: 1px solid rgba(255,255,255,0.08) !important;
        box-shadow: -20px 0 60px rgba(0,0,0,0.5), var(--sf-glow-sm) !important;
    }

    /* Modales info + datos pedido: fondo opaco del tema */
    .sf-modal {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        background: var(--background-plain, var(--background, #ffffff)) !important;
        border: 1px solid var(--border) !important;
        box-shadow: 0 30px 80px rgba(0,0,0,0.25) !important;
    }

    /* Total del carrito: Bebas Neue display grande */
    #sf-total {
        font-family: 'Bebas Neue', sans-serif !important;
        font-size: 2.5rem !important;
        letter-spacing: .04em;
        line-height: 1;
    }

    /* Precios dentro del drawer body: Bebas Neue */
    #sf-drawer-body [data-price-usd] {
        font-family: 'Bebas Neue', sans-serif !important;
        letter-spacing: .04em;
        line-height: 1;
    }

    /* Botón primario drawer: glow */
    #sf-drawer-footer button[onclick="sendWhatsApp()"] {
        box-shadow: 0 4px 24px rgba(37,211,102,0.4), 0 8px 16px rgba(0,0,0,0.25) !important;
        transition: transform 100ms ease, opacity 100ms ease !important;
    }
    #sf-drawer-footer button[onclick="sendWhatsApp()"]:active {
        transform: scale(0.97) !important;
        opacity: .9;
    }

    /* Botón primario modal datos pedido: glow */
    #sf-data-modal button[onclick="confirmDataAndSend()"] {
        box-shadow: var(--sf-glow-md) !important;
        transition: transform 100ms ease, opacity 100ms ease !important;
    }
    #sf-data-modal button[onclick="confirmDataAndSend()"]:active {
        transform: scale(0.97) !important;
        opacity: .9;
    }

    /* ═══════════════════════════════════════════════════════
       Facelift integral: dropdown · detail view · forms · info modal
    ═══════════════════════════════════════════════════════ */

    /* ── Dropdown categorías (hamburger) ── */
    #sf-cat-dropdown {
        backdrop-filter: blur(20px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
        background: color-mix(in srgb, var(--surface) 94%, transparent) !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        box-shadow: 0 16px 40px rgba(0,0,0,0.3), var(--sf-glow-sm) !important;
    }
    #sf-cat-dropdown button {
        border-bottom-color: color-mix(in srgb, var(--foreground) 5%, transparent) !important;
        transition: background 150ms ease, color 150ms ease !important;
    }
    #sf-cat-dropdown button:hover {
        background: color-mix(in srgb, var(--primary) 10%, transparent) !important;
        color: var(--foreground) !important;
    }

    /* ── Detail view: columna derecha hardcodeada a #fff ── */
    #sf-detail-view div[style*="background:#fff"] {
        background: var(--surface) !important;
        border: 1px solid color-mix(in srgb, var(--primary) 15%, transparent) !important;
        box-shadow: 0 4px 24px rgba(0,0,0,0.2) !important;
    }

    /* ── Detail view: precios en Bebas Neue ── */
    #sf-detail-price,
    #sf-detail-price-desk {
        font-family: 'Bebas Neue', sans-serif !important;
        font-size: 2.5rem !important;
        letter-spacing: .04em;
        line-height: 1;
    }

    /* ── Detail view: sub-header sticky ── */
    #sf-detail-view > div:first-child {
        backdrop-filter: blur(16px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
        box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    }

    /* ── Textarea notas ── */
    #sf-detail-notes {
        background: color-mix(in srgb, var(--surface) 80%, transparent) !important;
        border-color: color-mix(in srgb, var(--foreground) 8%, transparent) !important;
    }
    #sf-detail-notes:focus {
        border-color: color-mix(in srgb, var(--primary) 40%, transparent) !important;
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 10%, transparent) !important;
        outline: none !important;
    }

    /* ── Drawer: título "Mi Pedido" en Bebas Neue ── */
    #sf-drawer h3 {
        font-family: 'Bebas Neue', sans-serif !important;
        font-size: 2.25rem !important;
        font-weight: 400 !important;
        letter-spacing: .04em;
        line-height: 1;
    }

    /* ── Drawer: total card borde primario ── */
    #sf-drawer-footer > div:first-child {
        background: color-mix(in srgb, var(--surface) 70%, transparent) !important;
        border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    }

    /* ── "También te puede gustar" header ── */
    #sf-also-like-wrap > p {
        font-family: 'Bebas Neue', sans-serif !important;
        font-size: 1.2rem !important;
        font-weight: 400 !important;
        letter-spacing: .06em;
    }

    /* ── Info modal: chips de métodos de pago ── */
    #sf-info-modal span.bg-surface\/60 {
        background: color-mix(in srgb, var(--surface) 60%, transparent) !important;
        border: 1px solid rgba(255,255,255,0.06) !important;
    }

    /* ── Info modal: filas horarios ── */
    #sf-info-modal .bg-surface\/60.border-b {
        background: color-mix(in srgb, var(--surface) 50%, transparent) !important;
    }

    /* ── Info modal: botón Compartir ── */
    #sf-info-modal button[onclick="sfShareModal()"] {
        border-color: color-mix(in srgb, var(--primary) 20%, transparent) !important;
        transition: background 200ms ease, border-color 200ms ease !important;
    }
    #sf-info-modal button[onclick="sfShareModal()"]:hover {
        background: color-mix(in srgb, var(--primary) 8%, transparent) !important;
        border-color: color-mix(in srgb, var(--primary) 40%, transparent) !important;
    }

    /* ── Data modal: radio labels modalidad ── */
    #sf-data-modal label {
        transition: background 150ms ease, border-color 150ms ease !important;
    }
    #sf-data-modal label:hover {
        background: color-mix(in srgb, var(--primary) 6%, transparent) !important;
        border-color: color-mix(in srgb, var(--primary) 30%, transparent) !important;
    }

    /* ── Data modal: inputs ── */
    #sf-data-modal input[type="text"],
    #sf-data-modal input[type="tel"] {
        background: color-mix(in srgb, var(--surface) 80%, transparent) !important;
        border-color: color-mix(in srgb, var(--foreground) 10%, transparent) !important;
        transition: border-color 200ms ease, box-shadow 200ms ease !important;
    }
    #sf-data-modal input:focus {
        border-color: color-mix(in srgb, var(--primary) 50%, transparent) !important;
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 10%, transparent) !important;
        outline: none !important;
    }

    /* filter:drop-shadow removido de #sf-floating-bar: position:fixed + filter crea conflicto
       de compositing con backdrop-filter del overlay. El button ya tiene box-shadow propio. */
</style>
@endpush

@section('content')

{{-- 1. HERO SLIDER --}}
@php
    $heroImages = array_values(array_filter([
        $customization->hero_main_filename      ?? null,
        $customization->hero_secondary_filename ?? null,
        $customization->hero_tertiary_filename  ?? null,
        $customization->hero_image_4_filename   ?? null,
        $customization->hero_image_5_filename   ?? null,
    ]));
@endphp
@if(count($heroImages) > 0)
<div id="sf-hero-slider" class="relative w-full overflow-visible bg-surface" style="height:clamp(185px, 28vw, 260px)">
    @foreach($heroImages as $hIdx => $hImg)
    <div class="sf-slide absolute inset-0" style="opacity:{{ $hIdx === 0 ? '1' : '0' }};transform:translateX(0)">
        @php $hImgUrl = str_starts_with($hImg, 'http') ? $hImg : asset('storage/tenants/' . $tenant->id . '/' . $hImg); @endphp
        <img src="{{ $hImgUrl }}" alt="{{ $tenant->business_name }}" class="w-full h-full object-cover" loading="{{ $hIdx === 0 ? 'eager' : 'lazy' }}">
    </div>
    @endforeach
    @if(count($heroImages) > 1)
    <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        @foreach($heroImages as $hIdx => $hImg)
        <button class="sf-dot size-2.5 rounded-full transition-all relative after:absolute after:inset-[-8px] after:content-[''] {{ $hIdx === 0 ? 'bg-white scale-110' : 'bg-white/40' }}" data-slide="{{ $hIdx }}"></button>
        @endforeach
    </div>
    @endif
</div>
@endif

{{-- 2. BUSINESS INFO --}}
<div id="sf-business-info" class="mx-auto max-w-7xl px-4 pt-14 pb-4" style="overflow:visible;position:relative">
    <div class="flex items-end gap-4">
        @if(!empty($customization->logo_filename))
            <img id="synti-food-trigger" src="{{ asset('storage/tenants/' . $tenant->id . '/' . $customization->logo_filename) }}"
                 alt="{{ $tenant->business_name }}"
                 style="width:96px;height:96px;border-radius:50%;border:4px solid #fff;
                        box-shadow:0 8px 32px rgba(0,0,0,0.25);object-fit:cover;
                        position:absolute;top:-48px;left:16px;z-index:20;
                        background:#fff;">
        @else
            <div style="width:96px;height:96px;border-radius:50%;border:4px solid #fff;
                        box-shadow:0 8px 32px rgba(0,0,0,0.25);
                        position:absolute;top:-48px;left:16px;z-index:20;
                        background:var(--primary);
                        display:flex;align-items:center;justify-content:center;
                        font-weight:900;color:#fff;font-size:2rem">
                {{ mb_substr($tenant->business_name, 0, 1) }}
            </div>
        @endif
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-xl font-black tracking-tight text-foreground">{{ $tenant->business_name }}</h1>
                @if($isOpen ?? false)
                    <span class="inline-flex items-center gap-1.5 text-xs font-bold text-green-600"><span class="size-1.5 rounded-full bg-green-500"></span>Abierto</span>
                @else
                    <span class="inline-flex items-center gap-1.5 text-xs font-bold text-red-500"><span class="size-1.5 rounded-full bg-red-500"></span>Cerrado</span>
                @endif
            </div>
            @if(!empty($tenant->address))
            <p class="text-sm text-foreground/50 mt-1 flex items-center gap-1">
                <span class="iconify tabler--map-pin size-3.5 shrink-0 text-foreground/30"></span>
                {{ $tenant->address }}@if(!empty($tenant->city)), {{ $tenant->city }}@endif
            </p>
            @endif
        </div>
    </div>
</div>

{{-- 3. STICKY BAR — una sola fila: [identity] [🔍][☰][tabs] [ⓘ][WA][REF/Bs][🛒] --}}
@php
    $activeCats = array_filter($categories, fn($c) => !empty($c['activo']));
    $featuredItems = [];
    foreach ($categories as $fCat) {
        if (empty($fCat['activo'])) continue;
        foreach ($fCat['items'] ?? [] as $fItem) {
            if (empty($fItem['activo'])) continue;
            if (in_array($fItem['badge'] ?? '', ['popular', 'nuevo', 'promo', 'destacado'], true) || !empty($fItem['is_featured'])) {
                $featuredItems[] = $fItem;
            }
        }
    }
@endphp
<div id="sf-sticky-bar" class="sticky top-0 z-[100] bg-background/95 backdrop-blur-2xl" style="border-bottom:1px solid rgba(0,0,0,.06)">

    {{-- FILA 1: identity — oculta hasta scroll --}}
    <div id="sf-identity-row"
         class="overflow-hidden transition-all duration-300 border-b border-foreground/5"
         style="max-height:0;opacity:0;">
        <div class="mx-auto max-w-7xl px-3 flex items-center justify-between h-11">
            {{-- Logo + nombre + status --}}
            <a id="synti-food-trigger-sticky" href="#" class="flex items-center gap-2 shrink-0">
                @if(!empty($customization->logo_filename))
                    <img src="{{ asset('storage/tenants/' . $tenant->id . '/' . $customization->logo_filename) }}"
                         alt="{{ $tenant->business_name }}"
                         class="size-8 rounded-full object-cover shrink-0">
                @else
                    <div class="size-8 bg-primary rounded-full flex items-center justify-center shrink-0">
                        <span class="text-primary-foreground font-black text-sm">{{ mb_substr($tenant->business_name, 0, 1) }}</span>
                    </div>
                @endif
                <span class="text-sm font-bold tracking-tight truncate max-w-[140px]">{{ $tenant->business_name }}</span>
                <span class="text-xs font-bold {{ ($isOpen ?? false) ? 'text-green-500' : 'text-red-500' }} flex items-center gap-1">
                    <span class="size-1.5 rounded-full {{ ($isOpen ?? false) ? 'bg-green-500' : 'bg-red-500' }}"></span>
                    {{ ($isOpen ?? false) ? 'Abierto' : 'Cerrado' }}
                </span>
            </a>
            {{-- Acciones derechas fila 1 --}}
            <div class="flex items-center gap-1 shrink-0">
                @if(str_contains($savedDisplayMode, 'toggle'))
                <div class="flex bg-surface/50 p-0.5 rounded-lg border border-foreground/8">
                    <button class="sf-curr-btn px-2 py-1 text-[11px] font-bold rounded-md transition-all" data-currency="ref" onclick="setCurrency('ref')">{{ $currencySymbol }}</button>
                    <button class="sf-curr-btn px-2 py-1 text-[11px] font-bold rounded-md transition-all" data-currency="bs" onclick="setCurrency('bs')">Bs</button>
                </div>
                @endif
                @if($showCart ?? false)
                <button onclick="openCart()" id="sf-cart-trigger"
                        class="relative p-2 rounded-full bg-primary text-primary-foreground shadow-md hover:opacity-90 transition-opacity cursor-pointer">
                    <span class="iconify tabler--clipboard-list size-5"></span>
                    <span id="sf-cart-count" class="absolute -top-1 -right-1 size-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-background" style="display:none">0</span>
                </button>
                @endif
            </div>
        </div>
    </div>

    {{-- FILA 2: navegación — siempre visible --}}
    <div class="mx-auto max-w-7xl px-3 flex items-center gap-1 h-12">

        {{-- Lupa --}}
        <button id="sf-search-btn" onclick="sfToggleSearch()"
                class="flex-shrink-0 size-10 flex items-center justify-center rounded-lg border border-foreground/10 hover:bg-surface/50 transition-colors text-foreground/50 cursor-pointer">
            <span class="iconify tabler--search size-5"></span>
        </button>

        {{-- Search input overlay --}}
        <div id="sf-search-wrap" class="absolute inset-x-0 top-0 h-full bg-background/98 backdrop-blur-xl flex items-center px-3 gap-2 z-10" style="display:none">
            <input id="sf-search-input" type="search" placeholder="Buscar plato..."
                   class="flex-1 text-sm py-2 px-3 rounded-lg border border-foreground/10 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                   oninput="sfSearchFilter(this.value)" autofocus>
            <button onclick="sfToggleSearch()" class="size-8 flex items-center justify-center rounded-lg text-foreground/40 hover:bg-surface/50 transition-colors cursor-pointer">
                <span class="iconify tabler--x size-4"></span>
            </button>
        </div>

        {{-- Hamburger --}}
        <div class="relative flex-shrink-0">
            <button id="sf-cat-menu-btn" onclick="sfToggleCatMenu()"
                    class="size-10 flex items-center justify-center rounded-lg border border-foreground/10 hover:bg-surface/50 transition-colors text-foreground/50 cursor-pointer">
                <span class="iconify tabler--menu-2 size-5"></span>
            </button>
        </div>

        {{-- Tabs categorías --}}
        @if(count($activeCats) >= 2)
        <div id="sf-cat-tabs" class="flex gap-0 overflow-x-auto no-scrollbar flex-1">
            @if(!empty($featuredItems) && count($featuredItems) > 0)
            <button data-cat-nav="featured" onclick="sfScrollToCategory('featured')"
                    class="sf-cat-tab relative px-3 py-3 text-sm font-semibold whitespace-nowrap transition-colors text-foreground/40 hover:text-foreground border-b-[3px] border-transparent inline-flex items-center gap-1.5">
                <span class="iconify tabler--star-filled size-3.5 text-amber-500"></span> Destacados
            </button>
            @endif
            @foreach($activeCats as $catIdx => $cat)
            <button data-cat-nav="{{ $catIdx }}" onclick="sfScrollToCategory({{ $catIdx }})"
                    class="sf-cat-tab relative px-3 py-3 text-sm font-semibold whitespace-nowrap transition-colors text-foreground/40 hover:text-foreground border-b-[3px] border-transparent">
                {{ $cat['nombre'] }}
            </button>
            @endforeach
        </div>
        @endif

        {{-- Info --}}
        <button onclick="document.getElementById('sf-info-modal').style.display='flex'"
                class="size-10 flex items-center justify-center rounded-lg border border-foreground/10 text-foreground/50 hover:text-foreground hover:bg-surface/60 transition-colors cursor-pointer shrink-0">
            <span class="iconify tabler--info-circle size-[18px]"></span>
        </button>

    </div>
    {{-- Dropdown backdrop --}}
    <div id="sf-cat-backdrop" onclick="sfToggleCatMenu()" style="display:none;position:fixed;inset:0;z-index:199"></div>
</div>

{{-- Dropdown categorías (fixed, compartido) --}}
<div id="sf-cat-dropdown" class="fixed w-56 bg-background rounded-xl shadow-xl border border-foreground/5 z-[200] overflow-hidden" style="display:none;top:0;left:0">
    @if(!empty($featuredItems) && count($featuredItems) > 0)
    <button onclick="sfScrollToCategory('featured');sfToggleCatMenu()"
            class="w-full text-left px-4 py-3 text-sm font-semibold text-foreground/70 hover:bg-surface hover:text-foreground transition-colors border-b border-foreground/5 flex items-center gap-2">
        <span class="iconify tabler--star-filled size-3.5 text-amber-500 shrink-0"></span> Destacados
    </button>
    @endif
    @foreach($activeCats as $catIdx => $cat)
    <button onclick="sfScrollToCategory({{ $catIdx }});sfToggleCatMenu()"
            class="w-full text-left px-4 py-3 text-sm font-semibold text-foreground/70 hover:bg-surface hover:text-foreground transition-colors border-b border-foreground/5 last:border-0">
        {{ $cat['nombre'] }}
    </button>
    @endforeach
</div>

{{-- MODAL INFORMACIÓN --}}
@php
    $sfSnets      = $customization->social_networks ?? [];
    $sfIg         = $sfSnets['instagram'] ?? null;
    $sfFb         = $sfSnets['facebook']  ?? null;
    $sfTt         = $sfSnets['tiktok']    ?? null;
    $sfSubtitle   = $tenant->business_segment ?? ($tenant->slogan ?? null);
    $sfBHours     = $tenant->business_hours ?? [];
    $sfDaysMap    = ['monday'=>'Lunes','tuesday'=>'Martes','wednesday'=>'Miércoles','thursday'=>'Jueves','friday'=>'Viernes','saturday'=>'Sábado','sunday'=>'Domingo'];
    $sfMapsQuery  = rawurlencode(trim(($tenant->address ?? '') . ', ' . ($tenant->city ?? '') . ', ' . ($tenant->country ?? '')));
@endphp
<div id="sf-info-modal" class="sf-modal-overlay" onclick="if(event.target===this)this.style.display='none'">
    <div class="sf-modal max-h-[88vh] flex flex-col">

        {{-- ── Header ── --}}
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
                    @if($sfSubtitle)
                        <p class="text-xs text-foreground/50 mt-0.5 leading-snug">{{ $sfSubtitle }}</p>
                    @endif
                    @if($isOpen ?? false)
                        <span class="inline-flex items-center gap-1 text-xs font-bold text-green-600 mt-1"><span class="size-1.5 rounded-full bg-green-500"></span>Abierto ahora</span>
                    @else
                        <span class="inline-flex items-center gap-1 text-xs font-bold text-red-500 mt-1"><span class="size-1.5 rounded-full bg-red-500"></span>Cerrado ahora</span>
                    @endif
                </div>
            </div>
            <button onclick="document.getElementById('sf-info-modal').style.display='none'"
                    class="p-1.5 rounded-full hover:bg-surface transition-colors text-foreground/40 shrink-0 mt-0.5 cursor-pointer">
                <span class="iconify tabler--x size-4"></span>
            </button>
        </div>

        {{-- ── Scrollable body ── --}}
        <div class="overflow-y-auto flex-1 p-5 space-y-5">

            @if(!empty($customization->about_text ?? $tenant->description))
            <p class="text-sm text-foreground/60 leading-relaxed">
                {{ $customization->about_text ?? $tenant->description }}
            </p>
            @endif

            {{-- ── Métodos de pago ── --}}
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

            {{-- ── Contáctanos ── --}}
            @if(!empty($waContacts) || $sfIg || $sfFb || $sfTt || !empty($tenant->phone))
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
                    @if($sfIg)
                    <a href="https://instagram.com/{{ ltrim($sfIg, '@') }}" target="_blank" rel="noopener"
                       class="flex flex-col items-center gap-1 group cursor-pointer">
                        <span class="size-11 rounded-full flex items-center justify-center shadow-sm transition-transform duration-150 group-hover:scale-110" style="background:radial-gradient(circle farthest-corner at 35% 90%,#fec564,transparent 50%),radial-gradient(circle farthest-corner at 0 140%,#fec564,transparent 50%),radial-gradient(ellipse farthest-corner at 0 -25%,#5258cf,transparent 50%),radial-gradient(ellipse farthest-corner at 20% -50%,#5258cf,transparent 50%),radial-gradient(ellipse farthest-corner at 100% 0,#893dc2,transparent 50%),radial-gradient(ellipse farthest-corner at 60% -20%,#893dc2,transparent 50%),radial-gradient(ellipse farthest-corner at 100% 100%,#d9317a,transparent),linear-gradient(#6559ca,#bc318f 30%,#e33f5f 50%,#f77638 70%,#fec66d 100%)">
                            <span class="iconify tabler--brand-instagram size-5 text-white"></span>
                        </span>
                        <span class="text-[10px] font-semibold text-foreground/40">Instagram</span>
                    </a>
                    @endif
                    @if($sfFb)
                    <a href="https://facebook.com/{{ ltrim($sfFb, '@') }}" target="_blank" rel="noopener"
                       class="flex flex-col items-center gap-1 group cursor-pointer">
                        <span class="size-11 rounded-full flex items-center justify-center shadow-sm transition-transform duration-150 group-hover:scale-110" style="background:#1877F2">
                            <span class="iconify tabler--brand-facebook size-5 text-white"></span>
                        </span>
                        <span class="text-[10px] font-semibold text-foreground/40">Facebook</span>
                    </a>
                    @endif
                    @if($sfTt)
                    <a href="https://tiktok.com/@{{ ltrim($sfTt, '@') }}" target="_blank" rel="noopener"
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

            {{-- ── Dirección ── --}}
            @if(!empty($tenant->address))
            <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-foreground/30 mb-1">Dirección</p>
                <a href="https://maps.google.com/?q={{ $sfMapsQuery }}" target="_blank" rel="noopener"
                   class="text-sm text-primary font-medium flex items-start gap-1.5 hover:underline cursor-pointer">
                    <span class="iconify tabler--map-pin size-4 shrink-0 mt-0.5"></span>
                    <span>{{ $tenant->address }}@if(!empty($tenant->city)), {{ $tenant->city }}@endif</span>
                </a>
            </div>
            @endif

            {{-- ── Teléfono ── --}}
            @if(!empty($tenant->phone) || !empty($waContacts))
            <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-foreground/30 mb-1">Teléfono</p>
                <div class="space-y-1">
                    @if(!empty($tenant->phone))
                    <a href="tel:{{ preg_replace('/[^0-9+]/', '', $tenant->phone) }}"
                       class="text-sm text-primary font-medium flex items-center gap-1.5 hover:underline cursor-pointer">
                        <span class="iconify tabler--phone size-4 shrink-0"></span>
                        {{ $tenant->phone }}
                    </a>
                    @endif
                    @foreach($waContacts as $waItem)
                    <a href="https://wa.me/{{ $waItem['number'] }}" target="_blank" rel="noopener"
                       class="text-sm text-primary font-medium flex items-center gap-1.5 hover:underline cursor-pointer">
                        <span class="iconify tabler--brand-whatsapp size-4 shrink-0"></span>
                        +{{ $waItem['number'] }} <span class="text-foreground/40 text-xs">· {{ $waItem['label'] }}</span>
                    </a>
                    @endforeach
                </div>
            </div>
            @endif

            {{-- ── Horarios de atención ── --}}
            @if(!empty($sfBHours))
            <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-foreground/30 mb-2">Horarios de atención</p>
                <div class="rounded-xl overflow-hidden border border-foreground/5">
                    @foreach($sfDaysMap as $sfDayKey => $sfDayLabel)
                    @php
                        $sfDay    = $sfBHours[$sfDayKey] ?? null;
                        $sfClosed = is_null($sfDay) || !empty($sfDay['closed']);
                    @endphp
                    <div class="flex items-center justify-between px-3.5 py-2.5 bg-surface/60 border-b border-foreground/5 last:border-0">
                        <span class="text-sm font-semibold text-foreground/70">{{ $sfDayLabel }}</span>
                        @if($sfClosed)
                            <span class="text-xs text-foreground/30 font-medium">Cerrado</span>
                        @else
                            <span class="text-xs font-bold text-primary">{{ $sfDay['open'] ?? '—' }} – {{ $sfDay['close'] ?? '—' }}</span>
                        @endif
                    </div>
                    @endforeach
                </div>
            </div>
            @endif

        </div>{{-- /scrollable body --}}

        {{-- ── Footer: Compartir ── --}}
        <div class="px-5 pb-5 pt-3 shrink-0 border-t border-foreground/5">
            <button onclick="sfShareModal()"
                    class="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-foreground/10 text-sm font-bold text-foreground/60 hover:bg-surface hover:text-foreground transition-colors cursor-pointer">
                <span class="iconify tabler--share-3 size-4"></span>
                Compartir
            </button>
        </div>

    </div>
</div>

{{-- Banner cerrado --}}
@if(!($isOpen ?? true))
<div class="mx-auto max-w-7xl px-4 pt-4">
    <div class="rounded-xl bg-red-50 border border-red-100 px-6 py-4 text-center">
        <p class="text-sm font-bold text-red-600">Restaurante cerrado</p>
        <p class="text-xs text-red-400 mt-0.5">{{ $closedMessage ?? 'No estamos recibiendo pedidos en este momento. ¡Vuelve pronto!' }}</p>
    </div>
</div>
@endif

{{-- 3. MENU VIEW --}}
<div id="sf-menu-view">
<main class="mx-auto max-w-7xl px-4 py-6 space-y-8 pb-32">

    @if(!empty($featuredItems) && count($featuredItems) > 0)
    <div id="sf-cat-featured">
        <div class="flex items-center gap-2 mb-3">
            <span class="iconify tabler--star-filled size-5 text-amber-500"></span>
            <h2 class="text-base font-black tracking-tight text-foreground">Destacados</h2>
            <span class="text-xs font-bold text-foreground/30">({{ count($featuredItems) }})</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            @foreach($featuredItems as $fItem)
            @php
                $fSiblings = array_values(array_filter($featuredItems, fn($i) => ($i['id'] ?? '') !== ($fItem['id'] ?? '')));
            @endphp
            <div class="flex flex-row items-center gap-3 px-4 py-3 rounded-xl border border-amber-200/70 bg-amber-50/50 cursor-pointer hover:bg-amber-50 hover:border-amber-300/60 hover:shadow-sm transition-all sf-item-card"
                 data-sf-q="{{ strtolower($fItem['nombre'] . ' ' . ($fItem['descripcion'] ?? '')) }}"
                 onclick="sfOpenDetail({{ json_encode($fItem) }}, {{ json_encode($fSiblings) }})">
                @php $fImg = !empty($fItem['image_path']) ? (str_starts_with($fItem['image_path'],'http') ? $fItem['image_path'] : asset('storage/tenants/'.$tenant->id.'/'.$fItem['image_path'])) : ($fItem['imagen_url'] ?? null); @endphp
                @if($fImg)
                    <img src="{{ $fImg }}"
                         alt="{{ $fItem['nombre'] }}"
                         class="size-24 rounded-xl object-cover shrink-0 order-2"
                         loading="lazy"
                         onerror="this.style.display='none'">
                @else
                    <div class="size-24 rounded-xl shrink-0 flex items-center justify-center order-2 bg-foreground/5">
                        <span class="iconify tabler--tools-kitchen-2 size-7 text-foreground/20"></span>
                    </div>
                @endif
                <div class="flex flex-col gap-0.5 flex-1 order-1 min-w-0">
                    @if($fItem['badge'] === 'popular')
                        <span class="self-start inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"><span class="iconify tabler--star-filled size-3"></span> Popular</span>
                    @elseif($fItem['badge'] === 'nuevo')
                        <span class="self-start inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-100 text-green-700"><span class="iconify tabler--sparkles size-3"></span> Nuevo</span>
                    @elseif($fItem['badge'] === 'promo')
                        <span class="self-start inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700"><span class="iconify tabler--tag size-3"></span> Promo</span>
                    @elseif($fItem['badge'] === 'destacado')
                        <span class="self-start inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700"><span class="iconify tabler--bolt size-3"></span> Recomendado</span>
                    @endif
                    <p class="text-base font-black text-foreground leading-tight line-clamp-2">{{ $fItem['nombre'] }}</p>
                    @if(!empty($fItem['descripcion']))
                        <p class="text-sm text-foreground/50 leading-snug line-clamp-2">{{ $fItem['descripcion'] }}</p>
                    @endif
                    @if(!$hidePrice)
                    @php
                        $fPrecioReal = (float)($fItem['precio'] ?? 0);
                        $fPrecioOrig = (float)($fItem['precio_original'] ?? 0);
                        $fHasDiscount = $fPrecioOrig > $fPrecioReal && $fPrecioOrig > 0;
                        $fDiscountPct = $fHasDiscount ? round((1 - $fPrecioReal / $fPrecioOrig) * 100) : 0;
                    @endphp
                    <div class="flex items-center gap-2 mt-auto pt-1 flex-wrap">
                        <p class="text-base font-black text-primary" data-price-usd="{{ $fPrecioReal }}">
                            {{ $currencySymbol }} {{ number_format($fPrecioReal, 2, ',', '.') }}
                        </p>
                        @if($fHasDiscount)
                            <p class="text-xs text-foreground/35 line-through">
                                {{ $currencySymbol }} {{ number_format($fPrecioOrig, 2, ',', '.') }}
                            </p>
                            <span class="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">-{{ $fDiscountPct }}%</span>
                        @endif
                    </div>
                    @endif
                </div>
            </div>
            @endforeach
        </div>
    </div>
    @endif

    @forelse($categories as $catIdx => $cat)
        @if(!empty($cat['activo']))
        @php
            $activeItems = array_values(array_filter($cat['items'] ?? [], fn($i) => !empty($i['activo'])));
            $catColors = ['#f97316','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#6366f1','#ec4899'];
            $catColor  = $catColors[$catIdx % count($catColors)];
        @endphp
        @if(count($activeItems) > 0)
        <div id="sf-cat-{{ $catIdx }}" class="sf-cat-section">
            <div class="flex items-center gap-2 mb-3">
                <span class="size-2.5 rounded-full shrink-0" style="background:{{ $catColor }}"></span>
                <h2 class="text-base font-black tracking-tight text-foreground">{{ $cat['nombre'] }}</h2>
                <span class="text-xs font-bold text-foreground/30">({{ count($activeItems) }})</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                @foreach($activeItems as $item)
                @php
                    $itemId   = $item['id'] ?? '';
                    $siblings = array_values(array_filter($activeItems, fn($i) => ($i['id'] ?? '') !== $itemId));
                    $siblingsJson = json_encode($siblings);
                @endphp
                <div class="flex flex-row items-center gap-3 px-4 py-3 rounded-xl border border-foreground/8 bg-background cursor-pointer hover:bg-surface/60 hover:border-foreground/12 hover:shadow-sm transition-all sf-item-card"
                     data-sf-q="{{ strtolower($item['nombre'] . ' ' . ($item['descripcion'] ?? '')) }}"
                     onclick="sfOpenDetail({{ json_encode($item) }}, {{ $siblingsJson }})">
                    @php $iImg = !empty($item['image_path']) ? (str_starts_with($item['image_path'],'http') ? $item['image_path'] : asset('storage/tenants/'.$tenant->id.'/'.$item['image_path'])) : ($item['imagen_url'] ?? null); @endphp
                    @if($iImg)
                        <img src="{{ $iImg }}"
                             alt="{{ $item['nombre'] }}"
                             class="size-24 rounded-xl object-cover shrink-0 order-2"
                             loading="lazy"
                             onerror="this.style.display='none'">
                    @else
                        <div class="size-24 rounded-xl shrink-0 flex items-center justify-center order-2 bg-foreground/5">
                            <span class="iconify tabler--tools-kitchen-2 size-7 text-foreground/20"></span>
                        </div>
                    @endif
                    <div class="flex flex-col gap-0.5 flex-1 order-1 min-w-0">
                        @if(!empty($item['badge']))
                            @if($item['badge'] === 'popular')
                                <span class="self-start inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"><span class="iconify tabler--star-filled size-3"></span> Popular</span>
                            @elseif($item['badge'] === 'nuevo')
                                <span class="self-start inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-100 text-green-700"><span class="iconify tabler--sparkles size-3"></span> Nuevo</span>
                            @elseif($item['badge'] === 'promo')
                                <span class="self-start inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700"><span class="iconify tabler--tag size-3"></span> Promo</span>
                            @elseif($item['badge'] === 'destacado')
                                <span class="self-start inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700"><span class="iconify tabler--bolt size-3"></span> Recomendado</span>
                            @endif
                        @endif
                        <p class="text-base font-black text-foreground leading-tight line-clamp-2">{{ $item['nombre'] }}</p>
                        @if(!empty($item['descripcion']))
                            <p class="text-sm text-foreground/50 leading-snug line-clamp-2">{{ $item['descripcion'] }}</p>
                        @endif
                        @if(!$hidePrice)
                        @php
                            $precioReal = (float)($item['precio'] ?? 0);
                            $precioOrig = (float)($item['precio_original'] ?? 0);
                            $hasDiscount = $precioOrig > $precioReal && $precioOrig > 0;
                            $discountPct = $hasDiscount ? round((1 - $precioReal / $precioOrig) * 100) : 0;
                        @endphp
                        <div class="flex items-center gap-2 mt-auto pt-1 flex-wrap">
                            <p class="text-sm font-black text-primary" data-price-usd="{{ $precioReal }}">
                                {{ $currencySymbol }} {{ number_format($precioReal, 2, ',', '.') }}
                            </p>
                            @if($hasDiscount)
                                <p class="text-xs text-foreground/35 line-through" data-price-orig="{{ $precioOrig }}">
                                    {{ $currencySymbol }} {{ number_format($precioOrig, 2, ',', '.') }}
                                </p>
                                <span class="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">-{{ $discountPct }}%</span>
                            @endif
                        </div>
                        @endif
                    </div>
                </div>
                @endforeach
            </div>
        </div>
        @endif
        @endif
    @empty
        <div class="text-center py-16">
            <div class="size-16 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
                <span class="iconify tabler--bowl-chopsticks size-8 text-foreground/20"></span>
            </div>
            <p class="font-bold text-foreground/30">Menú en construcción</p>
            <p class="text-xs text-foreground/20 mt-1">Pronto habrá platos disponibles</p>
        </div>
    @endforelse
</main>
</div>

{{-- 4. DETAIL VIEW --}}
<div id="sf-detail-view" style="display:none">
    {{-- Sub-header --}}
    <div class="sticky top-0 z-[99] bg-background/95 backdrop-blur-xl border-b border-foreground/5">
        <div class="mx-auto max-w-7xl px-4 h-12 flex items-center justify-between">
            <button onclick="sfCloseDetail()" class="flex items-center gap-1.5 text-sm font-bold text-foreground/60 hover:text-foreground transition-colors">
                <span class="iconify tabler--arrow-left size-4"></span>
                Volver al menú
            </button>
            @if($isPlanAnual)
            <button onclick="toggleDrawer()" class="relative p-2 rounded-full bg-primary text-primary-foreground shadow-md hover:opacity-90 transition-opacity">
                <span class="iconify tabler--clipboard-list size-5"></span>
                <span id="sf-detail-cart-count" class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-background leading-none" style="display:none">0</span>
            </button>
            @endif
        </div>
    </div>

    {{-- Body: 2 cols en desktop, 1 col en mobile --}}
    <div class="mx-auto max-w-7xl pb-28 md:pb-10 md:px-8 md:py-8">
        <div class="md:grid md:grid-cols-2 md:gap-10 md:items-start">

            {{-- COLUMNA IZQUIERDA: imagen + nombre + descripción + sugerencias --}}
            <div>
                {{-- Imagen --}}
                <div id="sf-detail-img-wrap" class="relative overflow-hidden w-full bg-surface md:rounded-2xl md:overflow-hidden" style="height:300px">
                    <img id="sf-detail-img" src="" alt="" class="w-full h-full object-cover hidden" onerror="this.classList.add('hidden');document.getElementById('sf-detail-placeholder').classList.remove('hidden')">
                    <div id="sf-detail-placeholder" class="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface to-primary/5">
                        <span class="iconify tabler--bowl-chopsticks size-24 text-foreground/10"></span>
                    </div>
                    @if($isPlanAnual)
                    <button onclick="sfDetailAdd()"
                            class="absolute bottom-3 right-3 size-11 rounded-full flex items-center justify-center text-2xl font-black text-white shadow-xl border-none active:scale-95 transition-transform md:hidden"
                            style="background:var(--primary)">+</button>
                    @endif
                </div>

                {{-- Nombre, badge, desc — solo visible en desktop aquí (en mobile va debajo en col única) --}}
                <div class="hidden md:block px-0 pt-5">
                    <div class="flex items-start gap-2 mb-1">
                        <h1 id="sf-detail-name-desk" class="text-2xl font-black tracking-tight text-foreground leading-tight flex-1"></h1>
                        <span id="sf-detail-badge-desk" class="text-[10px] font-black px-2.5 py-1 rounded-full shrink-0 hidden mt-1.5"></span>
                    </div>
                    <p id="sf-detail-desc-desk" class="text-sm text-foreground/50 leading-relaxed hidden"></p>
                </div>

                {{-- Nombre, badge, desc — solo mobile (debajo de imagen) --}}
                <div class="md:hidden px-4 pt-4">
                    <div class="flex items-start gap-2 mb-1">
                        <h1 id="sf-detail-name" class="text-xl font-black tracking-tight text-foreground leading-tight flex-1"></h1>
                        <span id="sf-detail-badge" class="text-[10px] font-black px-2.5 py-1 rounded-full shrink-0 hidden mt-1"></span>
                    </div>
                    <p id="sf-detail-desc" class="text-sm text-foreground/50 leading-relaxed hidden"></p>
                    {{-- Precio mobile --}}
                    <div class="md:hidden mt-3" style="background:color-mix(in srgb,var(--primary) 6%,transparent);border:1px solid color-mix(in srgb,var(--primary) 12%,transparent);border-radius:16px;padding:12px 16px">
                        <p id="sf-detail-price" class="text-4xl font-black text-primary"></p>
                        <p class="text-xs text-foreground/40 mt-0.5">Precio unitario</p>
                    </div>
                </div>
                <div class="md:hidden border-t border-foreground/8 my-4"></div>

                {{-- También te puede gustar --}}
                <div id="sf-also-like-wrap" class="px-4 md:px-0 pt-8 hidden">
                    <p class="text-base font-black text-foreground mb-4">También te puede gustar</p>
                    <div id="sf-also-like-grid" class="flex gap-3 overflow-x-auto pb-2 no-scrollbar" style="scroll-snap-type:x mandatory"></div>
                </div>
            </div>

            {{-- COLUMNA DERECHA: precio, notas, qty+add --}}
            <div class="px-4 md:px-0 pt-4 md:pt-0 md:sticky md:top-20 md:p-6" style="background:#fff;border-radius:20px;border:1px solid rgba(0,0,0,0.07);box-shadow:0 2px 16px rgba(0,0,0,0.07)">

                {{-- Precio (desktop) --}}
                <div class="hidden md:block mb-5 rounded-2xl bg-primary/5 border border-primary/10 px-4 py-3" style="background:color-mix(in srgb,var(--primary) 6%,transparent);border:1px solid color-mix(in srgb,var(--primary) 12%,transparent);border-radius:16px;padding:12px 16px;margin-bottom:20px">
                    <p id="sf-detail-price-desk" class="text-4xl font-black text-primary"></p>
                    <p class="text-xs text-foreground/40 mt-0.5">Precio unitario</p>
                </div>

                {{-- Notas --}}
                <div class="mb-5">
                    <p class="text-sm font-black text-foreground mb-2">Notas especiales <span class="text-foreground/30 font-medium">(opcional)</span></p>
                    <textarea id="sf-detail-notes" rows="3" placeholder="Ej: Sin cebolla, extra salsa, etc."
                              class="w-full text-sm px-4 py-3 rounded-xl border border-foreground/10 bg-surface resize-none outline-none focus:border-primary/40 transition-colors text-foreground placeholder:text-foreground/30 shadow-inner"></textarea>
                </div>

                @if($isPlanAnual)
                {{-- Qty + Add — SOLO visible en desktop (en mobile usa el bottom bar fixed) --}}
                <div class="hidden md:flex items-center gap-4">
                    <div class="flex items-center gap-3 shrink-0">
                        <button onclick="sfDetailQty(-1)" class="size-11 rounded-full border border-foreground/15 bg-surface shadow-sm flex items-center justify-center text-xl font-black leading-none select-none hover:bg-surface transition-colors" style="display:flex;align-items:center;justify-content:center"><span class="iconify tabler--minus size-4"></span></button>
                        <span id="sf-detail-qty-desk" class="text-base font-black min-w-[24px] text-center">1</span>
                        <button onclick="sfDetailQty(1)" class="size-11 rounded-full flex items-center justify-center text-xl font-black text-white shadow-lg leading-none select-none hover:opacity-90 transition-opacity" style="background:var(--primary);display:flex;align-items:center;justify-content:center"><span class="iconify tabler--plus size-4"></span></button>
                    </div>
                    <button onclick="sfDetailAdd()"
                            class="flex-1 h-14 rounded-2xl font-black text-sm text-white border-none shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:opacity-90 active:scale-[0.98] transition-transform"
                            style="background:var(--primary);box-shadow:0 4px 20px rgba(0,0,0,0.18);transform-origin:center;transition:transform 0.15s">
                        Agregar al carrito — <span id="sf-detail-add-price-desk"></span>
                    </button>
                </div>
                @endif
            </div>
        </div>
    </div>
</div>

@if($isPlanAnual)
{{-- BOTTOM BAR: solo mobile --}}
<div id="sf-detail-bottom-bar" class="fixed bottom-0 left-0 right-0 z-[200] bg-background border-t border-foreground/8 shadow-xl px-4 py-3 md:hidden flex items-center gap-3" style="display:none!important">
    <div class="flex items-center gap-3 shrink-0">
        <button onclick="sfDetailQty(-1)" class="size-11 rounded-full border border-foreground/15 bg-surface shadow-sm flex items-center justify-center text-xl font-black leading-none select-none" style="display:flex;align-items:center;justify-content:center"><span class="iconify tabler--minus size-4"></span></button>
        <span id="sf-detail-qty" class="text-base font-black min-w-[20px] text-center">1</span>
        <button onclick="sfDetailQty(1)" class="size-11 rounded-full flex items-center justify-center text-xl font-black text-white shadow-lg leading-none select-none" style="background:var(--primary);display:flex;align-items:center;justify-content:center"><span class="iconify tabler--plus size-4"></span></button>
    </div>
    <button onclick="sfDetailAdd()" id="sf-detail-add-btn"
            class="flex-1 h-14 rounded-2xl font-black text-sm text-white border-none shadow-[0_4px_20px_rgba(0,0,0,0.15)] active:scale-[0.98] transition-transform"
            style="background:var(--primary);box-shadow:0 4px 20px rgba(0,0,0,0.18);transform-origin:center;transition:transform 0.15s">
        Agregar — <span id="sf-detail-add-price"></span>
    </button>
</div>
@endif

{{-- 5. DRAWER PEDIDO --}}
@if($isPlanAnual)
<div class="sf-drawer-overlay" id="sf-overlay" onclick="toggleDrawer()"></div>
<aside class="sf-drawer bg-background" id="sf-drawer">
    {{-- Header --}}
    <div class="px-7 pt-7 pb-5 flex items-center justify-between border-b border-foreground/5">
        <div>
            <h3 class="text-2xl font-black tracking-tighter">Mi Pedido</h3>
            <p class="text-[10px] text-foreground/30 font-black uppercase tracking-[.25em] mt-0.5">Resumen</p>
        </div>
        <button onclick="toggleDrawer()" class="p-2 rounded-full text-sm transition-colors text-foreground/80 hover:bg-surface bg-surface/80">
            <span class="iconify tabler--x size-5"></span>
        </button>
    </div>

    {{-- Empty state --}}
    <div id="sf-empty" class="flex-1 flex flex-col items-center justify-center text-center py-14 px-7">
        <div class="size-20 rounded-3xl bg-surface flex items-center justify-center mb-4">
            <span class="iconify tabler--bowl-chopsticks size-10 text-foreground/20"></span>
        </div>
        <p class="font-bold text-foreground/30">Tu pedido está vacío</p>
        <p class="text-xs text-foreground/20 mt-1">Explora el menú y agrega platos</p>
    </div>

    {{-- Items list --}}
    <div class="flex-1 overflow-y-auto px-7 no-scrollbar" id="sf-drawer-body" style="display:none"></div>

    {{-- Footer --}}
    <div class="p-7 space-y-4 border-t border-foreground/5" id="sf-drawer-footer" style="display:none">
        <div class="bg-surface/60 p-5 rounded-[1.5rem] border border-foreground/5">
            <div class="flex justify-between items-center text-foreground/40 text-xs font-black uppercase tracking-widest mb-1">
                <span>Total</span>
                <span id="sf-total-label">{{ $currencySymbol }}</span>
            </div>
            <div class="text-4xl font-black tracking-tighter" id="sf-total">0.00</div>
        </div>

        @if($waClean)
        <button onclick="sendWhatsApp()" class="flex items-center justify-center w-full h-14 rounded-[1.5rem] border-none font-black text-base gap-2.5 shadow-xl text-white transition-colors"
                style="background:#25D366;">
            <span class="iconify tabler--brand-whatsapp size-6"></span>
            Enviar por WhatsApp
        </button>
        @endif
    </div>
</aside>

{{-- Floating bar --}}
<div id="sf-floating-bar" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[190] w-[calc(100%-2rem)] max-w-md" style="display:none">
    <button onclick="toggleDrawer()"
            class="w-full flex items-center justify-between bg-primary text-primary-foreground px-5 py-4 rounded-2xl font-bold text-sm shadow-2xl shadow-primary/30 hover:opacity-95 transition-opacity">
        <span class="flex items-center gap-2">
            <span class="iconify tabler--clipboard-list size-5"></span>
            Ver pedido (<span id="sf-float-count">0</span> ítems)
        </span>
        <span class="iconify tabler--arrow-right size-5"></span>
    </button>
</div>
@endif

{{-- MODAL Datos Cliente --}}
@if($isPlanAnual)
<div id="sf-data-modal" class="sf-modal-overlay">
    <div class="sf-modal p-5 space-y-3">
        <div class="flex items-start gap-3">
            <div class="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <span class="iconify tabler--user size-5"></span>
            </div>
            <div class="flex-1">
                <p class="text-lg font-black">Antes de enviar</p>
                <p class="text-sm text-foreground/60">Personaliza tu pedido antes de enviarlo.</p>
            </div>
            <button onclick="closeDataModal()" class="p-2 rounded-full text-sm text-foreground/80 hover:bg-surface transition-colors cursor-pointer">
                <span class="iconify tabler--x size-4"></span>
            </button>
        </div>

        @if($needsName)
        <input type="text" id="sf-customer-name" placeholder="Tu nombre" autocomplete="given-name" inputmode="text" class="w-full text-sm px-4 py-3 rounded-2xl bg-surface border border-foreground/10 outline-none focus:border-primary transition-colors">
        @endif
        <input type="tel" id="sf-customer-phone" placeholder="0412 345 6789" autocomplete="tel" inputmode="tel" class="w-full text-sm px-4 py-3 rounded-2xl bg-surface border border-foreground/10 outline-none focus:border-primary transition-colors">
        <p class="text-xs text-slate-400 mt-1 px-1">Número venezolano · con el 0 inicial · Ej: 0412 345 6789</p>
        <p id="sf-phone-error" class="text-xs text-red-500 mt-1 px-1 hidden">Número inválido · Ej: 0412 345 6789</p>

        {{-- Modalidad --}}
        <div class="space-y-2">
            <p class="text-xs font-bold text-foreground/50 uppercase tracking-widest">Modalidad</p>
            <div class="grid grid-cols-3 gap-1.5">
                <label class="flex items-center gap-2 cursor-pointer rounded-xl border border-foreground/10 px-2 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors">
                    <input type="radio" name="sf-modalidad" value="sitio" checked class="accent-[var(--primary)]">
                    <span class="text-xs font-bold text-foreground">🍽 En sitio</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer rounded-xl border border-foreground/10 px-2 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors">
                    <input type="radio" name="sf-modalidad" value="llevar" class="accent-[var(--primary)]">
                    <span class="text-xs font-bold text-foreground">🥡 Para llevar</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer rounded-xl border border-foreground/10 px-2 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors">
                    <input type="radio" name="sf-modalidad" value="delivery" class="accent-[var(--primary)]">
                    <span class="text-xs font-bold text-foreground">🏠 Delivery</span>
                </label>
            </div>
        </div>

        {{-- Dirección delivery (visible solo si delivery) --}}
        <div id="sf-delivery-address-wrap" class="space-y-2" style="display:none">
            <input type="text" id="sf-delivery-address" placeholder="Av. Principal, Casa 5, referencia cercana" autocomplete="street-address" inputmode="text" class="w-full text-sm px-4 py-3 rounded-2xl bg-surface border border-foreground/10 outline-none focus:border-primary transition-colors">
            <button type="button" onclick="getGeolocation()" class="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer py-1">
                <span class="iconify tabler--current-location size-4"></span>
                Usar mi ubicación
            </button>
            <p id="sf-geo-status" class="text-xs" style="display:none"></p>
        </div>

        {{-- Mesa/Ubicación (visible solo si en sitio) --}}
        <div id="sf-table-number-wrap" class="space-y-2" style="display:none">
            <input type="text" id="sf-table-number" placeholder="Mesa o ubicación (ej: Mesa 5, Terraza)" autocomplete="off" inputmode="text" class="w-full text-sm px-4 py-3 rounded-2xl bg-surface border border-foreground/10 outline-none focus:border-primary transition-colors">
        </div>

        <div class="flex gap-3">
            <button onclick="confirmDataAndSend()" class="py-2 px-4 rounded-xl font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 flex-1 font-black cursor-pointer">Enviar por WhatsApp</button>
            <button onclick="closeDataModal()" class="py-2 px-4 rounded-xl font-medium transition-colors text-foreground/80 hover:bg-surface cursor-pointer">Cancelar</button>
        </div>
    </div>
</div>
@endif

{{-- 5. FOOTER STOREFRONT --}}
@include('landing.sections.footer-storefront')

@endsection

@push('scripts')
<script>
(function(){
    'use strict';
    const CURRENCY_MODE   = @json($savedDisplayMode);
    const CURRENCY_SYMBOL = @json($currencySymbol);
    const EXCHANGE_RATE   = @json($dollarRate);
    const EURO_RATE       = @json($euroRate);
    let currentCurrency   = (CURRENCY_MODE === 'bolivares_only') ? 'Bs.' : (CURRENCY_MODE === 'euro_toggle' ? '€' : CURRENCY_SYMBOL);
    var cart = {};

    function formatPrice(usdPrice, isPlain) {
        isPlain = isPlain || false;
        const val = parseFloat(usdPrice) || 0;
        let rate = (currentCurrency === 'Bs.') ? (CURRENCY_MODE === 'euro_toggle' ? EURO_RATE : EXCHANGE_RATE) : 1;
        let formatted = (val * rate).toLocaleString('es-VE', {minimumFractionDigits:2});
        if (isPlain) return currentCurrency + ' ' + formatted;
        return '<span class="text-xs opacity-40 mr-1">' + currentCurrency + '</span>' + formatted;
    }

    window.setCurrency = function(mode) {
        currentCurrency = (mode === 'bs') ? 'Bs.' : (mode === 'eur' ? '€' : CURRENCY_SYMBOL);
        document.querySelectorAll('[data-price-usd]').forEach(function(el) { el.innerHTML = formatPrice(el.getAttribute('data-price-usd')); });
        document.querySelectorAll('.sf-curr-btn').forEach(function(btn) {
            var active = (btn.dataset.currency === 'ref' && currentCurrency === CURRENCY_SYMBOL) || (btn.dataset.currency === 'bs' && currentCurrency === 'Bs.');
            btn.className = 'sf-curr-btn px-3 py-1.5 text-xs font-bold rounded-lg transition-all ' + (active ? 'bg-background shadow-lg text-primary' : 'text-foreground/40');
        });
        renderDrawer();
    };

    window.addToCart = function(id, name, price, img) {
        if (!window.__tenantIsOpen) showClosedToast();
        var isNew = !cart[id];
        if (cart[id]) { cart[id].qty++; } else { cart[id] = { name: name, price: parseFloat(price) || 0, qty: 1, options: [], img: img || '' }; }
        updateBadge();
        renderDrawer();
        var addBtn = document.getElementById('sf-add-' + id);
        if (addBtn) addBtn.style.display = 'none';
        var qr = document.getElementById('qty-row-' + id);
        if (qr) qr.style.cssText = 'display:flex!important';
        var qv = document.getElementById('qty-val-' + id);
        if (qv) qv.textContent = cart[id].qty;
        if (isNew && Object.keys(cart).length === 1) toggleDrawer();
    };

    window.addToCartWithOptions = function(id, name, price, selectedOptions) {
        if (!window.__tenantIsOpen) showClosedToast();
        selectedOptions = selectedOptions || [];
        var totalPrice = parseFloat(price) || 0;
        var optionLabels = [];
        selectedOptions.forEach(function(opt) {
            totalPrice += parseFloat(opt.price_add) || 0;
            optionLabels.push(opt.label);
        });
        
        var cartKey = id + '|' + optionLabels.join('|');
        var isNew = !cart[cartKey];
        
        if (cart[cartKey]) {
            cart[cartKey].qty++;
        } else {
            cart[cartKey] = {
                name: name,
                price: parseFloat(price) || 0,
                qty: 1,
                options: selectedOptions,
                totalPrice: totalPrice
            };
        }
        
        updateBadge();
        renderDrawer();
        
        if (isNew && Object.keys(cart).length === 1) toggleDrawer();
    };

    window.changeQty = function(id, delta) {
        if (!cart[id]) return;
        cart[id].qty += delta;
        if (cart[id].qty <= 0) {
            delete cart[id];
            var qr = document.getElementById('qty-row-' + id);
            if (qr) qr.style.cssText = 'display:none!important';
            var addBtn = document.getElementById('sf-add-' + id);
            if (addBtn) addBtn.style.display = '';
        } else {
            var qv = document.getElementById('qty-val-' + id);
            if (qv) qv.textContent = cart[id].qty;
        }
        updateBadge();
        renderDrawer();
    };

    function updateBadge() {
        var total = Object.values(cart).reduce(function(a, b) { return a + b.qty; }, 0);
        var b = document.getElementById('sf-cart-count');
        if (b) {
            b.style.display = total > 0 ? 'flex' : 'none';
            b.textContent = total;
            b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
        }
        var fb = document.getElementById('sf-floating-bar');
        if (fb) fb.style.display = total > 0 ? '' : 'none';
        var fc = document.getElementById('sf-float-count');
        if (fc) fc.textContent = total;
    }

    // ── Scroll-lock: iOS-safe + desktop scrollbar compensation ──────────
    var _slockY = 0;
    function _lockScroll() {
        var sbw = window.innerWidth - document.documentElement.clientWidth; // scrollbar width
        _slockY = window.scrollY;
        if (sbw > 0) document.body.style.paddingRight = sbw + 'px';
        document.body.style.top      = '-' + _slockY + 'px';
        document.body.style.position = 'fixed';
        document.body.style.left     = '0';
        document.body.style.right    = '0';
    }
    function _unlockScroll() {
        var y = _slockY;
        document.body.style.position    = '';
        document.body.style.top         = '';
        document.body.style.left        = '';
        document.body.style.right       = '';
        document.body.style.paddingRight = '';
        window.scrollTo(0, y);
    }

    window.toggleDrawer = function() {
        var overlay = document.getElementById('sf-overlay');
        var drawer  = document.getElementById('sf-drawer');
        if (!overlay || !drawer) return;
        overlay.classList.toggle('open');
        drawer.classList.toggle('open');
        drawer.classList.contains('open') ? _lockScroll() : _unlockScroll();
    };

    function renderDrawer() {
        var body   = document.getElementById('sf-drawer-body');
        var footer = document.getElementById('sf-drawer-footer');
        var empty  = document.getElementById('sf-empty');
        if (!body || !footer || !empty) return;

        body.innerHTML = '';
        var keys = Object.keys(cart);

        if (keys.length === 0) {
            empty.style.display  = 'flex';
            body.style.display   = 'none';
            footer.style.display = 'none';
            return;
        }

        empty.style.display  = 'none';
        body.style.display   = 'block';
        footer.style.display = 'block';

        var totalUsd = 0;
        keys.forEach(function(id) {
            var item = cart[id];
            var itemBasePrice = item.price;
            var itemTotalPrice = itemBasePrice;
            
            if (item.options && item.options.length > 0) {
                item.options.forEach(function(opt) {
                    itemTotalPrice += parseFloat(opt.price_add) || 0;
                });
            }
            
            totalUsd += itemTotalPrice * item.qty;
            var div = document.createElement('div');
            div.className = 'flex items-center gap-3 py-4 border-b border-foreground/5 last:border-0';
            
            var optionsHtml = '';
            if (item.options && item.options.length > 0) {
                optionsHtml = '<p style="font-size:.65rem;color:rgba(0,0,0,.45);margin-top:4px">';
                item.options.forEach(function(opt) {
                    optionsHtml += '• ' + opt.label + '<br>';
                });
                optionsHtml += '</p>';
            }
            
            div.innerHTML = '<div style="width:56px;height:56px;border-radius:14px;overflow:hidden;background:var(--surface,#e5e7eb);flex-shrink:0">'
                + '<img style="width:100%;height:100%;object-fit:cover" src="' + (item.img || '') + '">'
                + '</div>'
                + '<div style="flex:1;min-width:0">'
                + '<p style="font-weight:800;font-size:.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px">' + item.name + '</p>'
                + '<p style="font-size:.75rem;font-weight:700;opacity:.45">' + item.qty + ' × ' + formatPrice(itemTotalPrice, true) + '</p>'
                + optionsHtml
                + '</div>'
                + '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'
                + '<button onclick="changeQty(\'' + id + '\', -1)" style="width:28px;height:28px;border-radius:50%;border:none;cursor:pointer;background:var(--surface,#f3f4f6);font-weight:900;font-size:.8rem;line-height:1">−</button>'
                + '<span style="font-size:.8rem;font-weight:900;min-width:14px;text-align:center">' + item.qty + '</span>'
                + '<button onclick="changeQty(\'' + id + '\', 1)" style="width:28px;height:28px;border-radius:50%;border:none;cursor:pointer;background:var(--primary);color:var(--primary-foreground);font-weight:900;font-size:.8rem;line-height:1">+</button>'
                + '</div>';
            body.appendChild(div);
        });
        document.getElementById('sf-total').innerHTML = formatPrice(totalUsd);
        document.getElementById('sf-total-label').textContent = currentCurrency;
    }

    // ── Detail View ──────────────────────────────────────────────
    var sfDetail = { id: '', name: '', price: 0, qty: 1 };
    // sfFmt now delegates to formatPrice so it respects currency switching
    function sfFmt(price) {
        return formatPrice(price, true);
    }

    window.sfOpenDetail = function(item, siblings) {
        var precioParaCarrito = parseFloat(item.precio || 0);
        sfDetail = { id: item.id || '', name: item.nombre || '', price: precioParaCarrito, qty: 1, img: '' };

        // Foto
        var img = document.getElementById('sf-detail-img');
        var ph  = document.getElementById('sf-detail-placeholder');
        var rawImg = item.image_path || item.imagen_url || '';
        if (rawImg) {
            var imgSrc = rawImg.startsWith('http') ? rawImg : '/storage/tenants/{{ $tenant->id }}/' + rawImg;
            sfDetail.img = imgSrc;
            img.src = imgSrc;
            img.classList.remove('hidden');
            ph.classList.add('hidden');
        } else {
            img.classList.add('hidden');
            ph.classList.remove('hidden');
        }

        // Datos — sincronizar mobile y desktop
        var nombre = item.nombre || '';
        var desc   = item.descripcion || '';
        // Mobile
        document.getElementById('sf-detail-name').textContent = nombre;
        var descMob = document.getElementById('sf-detail-desc');
        if (desc) { descMob.textContent = desc; descMob.classList.remove('hidden'); } else { descMob.classList.add('hidden'); }
        // Desktop
        var namDesk = document.getElementById('sf-detail-name-desk');
        var dscDesk = document.getElementById('sf-detail-desc-desk');
        if (namDesk) namDesk.textContent = nombre;
        if (dscDesk) { if (desc) { dscDesk.textContent = desc; dscDesk.classList.remove('hidden'); } else { dscDesk.classList.add('hidden'); } }

        // Precio con tachado
        var priceEl     = document.getElementById('sf-detail-price');
        var priceElDesk = document.getElementById('sf-detail-price-desk');
        var precioReal = parseFloat(item.precio || 0);
        var precioOrig = parseFloat(item.precio_original || 0);
        var hasDisc = precioOrig > precioReal && precioOrig > 0;
        var discPct  = hasDisc ? Math.round((1 - precioReal / precioOrig) * 100) : 0;
        var priceHtml = hasDisc
            ? '<span class="text-3xl font-black text-primary">' + sfFmt(precioReal) + '</span>'
                + ' <span class="text-base text-foreground/35 line-through ml-1">' + sfFmt(precioOrig) + '</span>'
                + ' <span class="text-xs font-black px-2 py-0.5 rounded-full bg-red-100 text-red-600 ml-1">-' + discPct + '%</span>'
            : '<span class="text-3xl font-black text-primary">' + sfFmt(precioReal) + '</span>';
        if (priceEl)     priceEl.innerHTML     = priceHtml;
        if (priceElDesk) priceElDesk.innerHTML = priceHtml;

        // Reset qty — ambos elementos
        ['sf-detail-qty', 'sf-detail-qty-desk'].forEach(function(id) {
            var el = document.getElementById(id); if (el) el.textContent = '1';
        });
        document.getElementById('sf-detail-notes').value = '';

        // Badge — helper
        function setBadge(el, badge) {
            if (!el) return;
            var badges = {
                popular:   ['<span class="iconify tabler--star-filled size-3"></span> Popular',   'bg-amber-100 text-amber-700'],
                nuevo:     ['<span class="iconify tabler--sparkles size-3"></span> Nuevo',        'bg-green-100 text-green-700'],
                promo:     ['<span class="iconify tabler--tag size-3"></span> Promo',             'bg-orange-100 text-orange-700'],
                destacado: ['<span class="iconify tabler--bolt size-3"></span> Recomendado',      'bg-purple-100 text-purple-700']
            };
            if (badges[badge]) {
                el.innerHTML = badges[badge][0];
                el.className = 'text-[10px] font-black px-2.5 py-1 rounded-full shrink-0 inline-flex items-center gap-1 ' + badges[badge][1];
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
        setBadge(document.getElementById('sf-detail-badge'), item.badge);
        setBadge(document.getElementById('sf-detail-badge-desk'), item.badge);

        // También te puede gustar
        var wrap = document.getElementById('sf-also-like-wrap');
        var grid = document.getElementById('sf-also-like-grid');
        grid.innerHTML = '';
        if (siblings && siblings.length > 0) {
            siblings.forEach(function(s) {
                var card = document.createElement('div');
                card.className = 'rounded-2xl border border-foreground/5 bg-surface/40 overflow-hidden flex-col cursor-pointer hover:shadow-md transition-shadow shrink-0 flex';
                card.style.width = '160px';
                card.style.scrollSnapAlign = 'start';
                card.onclick = function() { sfOpenDetail(s, siblings.filter(function(x){ return x.id !== s.id; })); };
                var rawImg2 = s.image_path || s.imagen_url || '';
                var imgHtml = rawImg2
                    ? '<img src="' + (rawImg2.startsWith('http') ? rawImg2 : '/storage/tenants/{{ $tenant->id }}/' + rawImg2) + '" class="w-full h-32 object-cover" loading="eager" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
                      + '<div class="w-full h-32 items-center justify-center bg-gradient-to-br from-surface to-primary/10" style="display:none"><iconify-icon icon="tabler:bowl-chopsticks" style="font-size:2rem;color:var(--primary);opacity:.4"></iconify-icon></div>'
                    : '<div class="w-full h-32 flex items-center justify-center bg-gradient-to-br from-surface to-primary/10"><iconify-icon icon="tabler:bowl-chopsticks" style="font-size:2rem;color:var(--primary);opacity:.4"></iconify-icon></div>';
                var badgeHtml = s.badge === 'popular'   ? '<span class="self-start inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 mb-0.5"><span class="iconify tabler--star-filled size-3"></span> Popular</span>' :
                                s.badge === 'nuevo'     ? '<span class="self-start inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 mb-0.5"><span class="iconify tabler--sparkles size-3"></span> Nuevo</span>' :
                                s.badge === 'promo'     ? '<span class="self-start inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 mb-0.5"><span class="iconify tabler--tag size-3"></span> Promo</span>' :
                                s.badge === 'destacado' ? '<span class="self-start inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 mb-0.5"><span class="iconify tabler--bolt size-3"></span> Recomendado</span>' : '';
                var sPrecioReal = parseFloat(s.precio || 0);
                var sPrecioOrig = parseFloat(s.precio_original || 0);
                var sHasDisc = sPrecioOrig > sPrecioReal && sPrecioOrig > 0;
                var sDiscPct = sHasDisc ? Math.round((1 - sPrecioReal / sPrecioOrig) * 100) : 0;
                var sPriceHtml = sHasDisc
                    ? '<p class="text-sm font-black text-primary mt-1">' + sfFmt(sPrecioReal) + '</p>'
                      + '<p class="text-xs text-foreground/35 line-through">' + sfFmt(sPrecioOrig) + '</p>'
                      + '<span class="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">-' + sDiscPct + '%</span>'
                    : '<p class="text-sm font-black text-primary mt-1">' + sfFmt(sPrecioReal) + '</p>';
                card.innerHTML = imgHtml + '<div class="p-3 flex flex-col gap-0.5">' + badgeHtml +
                    '<p class="text-sm font-black text-foreground leading-tight line-clamp-2">' + s.nombre + '</p>' +
                    sPriceHtml + '</div>';
                grid.appendChild(card);
            });
            wrap.classList.remove('hidden');
        } else {
            wrap.classList.add('hidden');
        }

        // Mostrar vista detalle
        document.getElementById('sf-detail-view').style.display = 'block';
        document.getElementById('sf-detail-view').scrollTop = 0;
        _lockScroll();

        // Bottom bar: solo mobile (md:hidden lo oculta en desktop vía CSS)
        var bar = document.getElementById('sf-detail-bottom-bar');
        var precioFmt = sfFmt(sfDetail.price);
        if (bar) {
            bar.style.removeProperty('display'); // deja que md:hidden lo controle
            var ap = document.getElementById('sf-detail-add-price');
            if (ap) ap.textContent = precioFmt;
        }
        // Desktop add price
        var apd = document.getElementById('sf-detail-add-price-desk');
        if (apd) apd.textContent = precioFmt;
    };

    window.sfCloseDetail = function() {
        document.getElementById('sf-detail-view').style.display = 'none';
        _unlockScroll();
        var bar = document.getElementById('sf-detail-bottom-bar');
        if (bar) bar.style.display = 'none';
    };

    window.sfDetailQty = function(delta) {
        sfDetail.qty = Math.max(1, sfDetail.qty + delta);
        var total = sfFmt(sfDetail.price * sfDetail.qty);
        // Mobile
        var qMob = document.getElementById('sf-detail-qty');
        if (qMob) qMob.textContent = sfDetail.qty;
        var aMob = document.getElementById('sf-detail-add-price');
        if (aMob) aMob.textContent = total;
        // Desktop
        var qDsk = document.getElementById('sf-detail-qty-desk');
        if (qDsk) qDsk.textContent = sfDetail.qty;
        var aDsk = document.getElementById('sf-detail-add-price-desk');
        if (aDsk) aDsk.textContent = total;
    };

    window.sfDetailAdd = function() {
        if (!sfDetail.id) return;
        for (var i = 0; i < sfDetail.qty; i++) {
            addToCart(sfDetail.id, sfDetail.name, sfDetail.price, sfDetail.img);
        }
        sfCloseDetail();
    };

    window.closeDataModal = function() {
        var modal = document.getElementById('sf-data-modal');
        if (modal) modal.style.display = 'none';
    };

    function openDataModal() {
        var modal = document.getElementById('sf-data-modal');
        if (modal) modal.style.display = 'flex';
    }

    function getModalidad() {
        var checked = document.querySelector('input[name="sf-modalidad"]:checked');
        return checked ? checked.value : 'sitio';
    }

    async function buildAndSend(name, phone, address, tableNum) {
        var subdomain = @json($tenant->subdomain);
        var modalidad = getModalidad();
        var cartItems = Object.values(cart).map(function(i) {
            var item = {
                nombre: i.name,
                qty: i.qty,
                precio: i.price
            };
            if (i.options && i.options.length > 0) {
                item.opciones = i.options;
            }
            return item;
        });

        try {
            var res = await fetch('/' + subdomain + '/food-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({
                    customer_name: name || '',
                    customer_phone: phone || '',
                    modalidad: modalidad,
                    delivery_address: address || '',
                    table_number: tableNum || '',
                    items: cartItems
                })
            });
            var data = await res.json();
            if (data.success && data.whatsapp_url) {
                window.open(data.whatsapp_url, '_blank');
                cart = {};
                updateBadge();
                renderDrawer();
                closeDataModal();
                return;
            }
            if (data.error === 'closed') {
                closeDataModal();
                showClosedToast();
                return;
            }
        } catch(e) {
        }

        // Fallback: direct WhatsApp without SF-XXXX
        var waNumber = @json($waClean);
        if (!waNumber) return;
        var businessName = @json($tenant->business_name);
        var modalidadLabels = { sitio: 'Comer en sitio', llevar: 'Para llevar', delivery: 'Delivery' };
        var greeting = name
            ? '🍽 ¡Hola! Soy *' + name + '* y vengo de la web de *' + businessName + '*'
            : '🍽 ¡Hola! Les escribo desde la web de *' + businessName + '*';
        var totalUsd = Object.values(cart).reduce(function(a, b) { return a + (b.price * b.qty); }, 0);
        var msg = greeting + '\n\n*Mi pedido:*\n';
        msg += Object.values(cart).map(function(i) { return '• ' + i.name + ' ×' + i.qty + ' (' + formatPrice(i.price * i.qty, true) + ')'; }).join('\n');
        msg += '\n\n*Total: ' + formatPrice(totalUsd, true) + '*';
        msg += '\nModalidad: ' + (modalidadLabels[modalidad] || modalidad);
        if (modalidad === 'delivery' && address) {
            msg += '\n📍 Dirección: ' + address;
        }
        if (modalidad === 'sitio') {
            var tableEl = document.getElementById('sf-table-number');
            var tableVal = tableEl ? tableEl.value.trim() : '';
            if (tableVal) {
                msg += '\n📍 Mesa/Ubicación: ' + tableVal;
            }
        }
        window.open('https://wa.me/' + waNumber + '?text=' + encodeURIComponent(msg), '_blank');
        cart = {};
        updateBadge();
        renderDrawer();
        closeDataModal();
    }

    window.sendWhatsApp = function() {
        if (!window.__tenantIsOpen) {
            showClosedToast(function() { openDataModal(); });
            return;
        }
        openDataModal();
    };

    window.confirmDataAndSend = function() {
        var nameEl  = document.getElementById('sf-customer-name');
        var name    = nameEl ? nameEl.value.trim() : '';
        var phoneEl  = document.getElementById('sf-customer-phone');
        var phoneRaw = phoneEl ? phoneEl.value.trim() : '';
        var phone    = phoneRaw.replace(/\s/g, '');
        var phoneErrorEl = document.getElementById('sf-phone-error');
        if (phone && !/^0(4[0-9]{2})\d{7}$/.test(phone)) {
            if (phoneEl) phoneEl.classList.add('sf-field-error');
            if (phoneErrorEl) phoneErrorEl.classList.remove('hidden');
            if (phoneEl) phoneEl.focus();
            return;
        }
        if (phoneEl) phoneEl.classList.remove('sf-field-error');
        if (phoneErrorEl) phoneErrorEl.classList.add('hidden');
        var addrEl  = document.getElementById('sf-delivery-address');
        var address = addrEl ? addrEl.value.trim() : '';
        if (getModalidad() === 'delivery' && !address) {
            if (addrEl) addrEl.classList.add('sf-field-error');
            if (addrEl) addrEl.focus();
            return;
        }
        if (addrEl) addrEl.classList.remove('sf-field-error');
        var tableEl  = document.getElementById('sf-table-number');
        var tableNum = tableEl ? tableEl.value.trim() : '';
        if (getModalidad() === 'sitio' && !tableNum) {
            if (tableEl) tableEl.classList.add('sf-field-error');
            if (tableEl) tableEl.focus();
            return;
        }
        if (tableEl) tableEl.classList.remove('sf-field-error');

        @if($needsName)
        if (nameEl && !name) {
            nameEl.classList.add('sf-field-error');
            nameEl.focus();
            return;
        }
        if (nameEl) nameEl.classList.remove('sf-field-error');
        @endif

        if (name) localStorage.setItem('sf_customer_name', name);
        closeDataModal();
        buildAndSend(name, phone, address, tableNum);
    };

    window.getGeolocation = function() {
        var statusEl = document.getElementById('sf-geo-status');
        var addrEl = document.getElementById('sf-delivery-address');
        statusEl.style.display = '';
        if (!navigator.geolocation || !window.isSecureContext) {
            statusEl.textContent = 'Disponible solo en conexión segura (HTTPS)';
            statusEl.className = 'text-xs text-foreground/40';
            return;
        }
        statusEl.textContent = 'Obteniendo ubicación…';
        statusEl.className = 'text-xs text-foreground/50';
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                var lat = pos.coords.latitude;
                var lon = pos.coords.longitude;
                fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json')
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data && data.display_name) {
                            addrEl.value = data.display_name;
                            statusEl.innerHTML = '<span class="iconify tabler--circle-check size-3.5 inline-block align-middle mr-0.5"></span> Ubicación confirmada';
                            statusEl.className = 'text-xs text-green-600 font-bold';
                        } else {
                            statusEl.textContent = 'No se pudo obtener ubicación, ingresa manualmente';
                            statusEl.className = 'text-xs text-red-500';
                        }
                    })
                    .catch(function() {
                        statusEl.textContent = 'No se pudo obtener ubicación, ingresa manualmente';
                        statusEl.className = 'text-xs text-red-500';
                    });
            },
            function() {
                statusEl.textContent = 'No se pudo obtener ubicación, ingresa manualmente';
                statusEl.className = 'text-xs text-red-500';
            }
        );
    };

    document.addEventListener('DOMContentLoaded', function() {
        setCurrency(currentCurrency === 'Bs.' ? 'bs' : 'ref');

        var savedName = localStorage.getItem('sf_customer_name');
        if (savedName) {
            var el = document.getElementById('sf-customer-name');
            if (el) el.value = savedName;
        }

        var nameEl = document.getElementById('sf-customer-name');
        if (nameEl) nameEl.addEventListener('input', function() { nameEl.classList.remove('sf-field-error'); });

        // Toggle delivery address field
        var addrWrap = document.getElementById('sf-delivery-address-wrap');
        var tableWrap = document.getElementById('sf-table-number-wrap');
        if (addrWrap || tableWrap) {
            document.querySelectorAll('input[name="sf-modalidad"]').forEach(function(radio) {
                radio.addEventListener('change', function() {
                    if (addrWrap) addrWrap.style.display = this.value === 'delivery' ? '' : 'none';
                    if (tableWrap) tableWrap.style.display = this.value === 'sitio' ? '' : 'none';
                });
            });
        }

        // Ajustar scroll-mt dinámicamente según altura real del sticky bar
        function updateScrollMargins() {
            var stickyBar = document.getElementById('sf-sticky-bar');
            if (!stickyBar) return;
            var h = stickyBar.offsetHeight;
            document.querySelectorAll('[id^="sf-cat-"], #sf-cat-featured').forEach(function(el) {
                el.style.scrollMarginTop = (h + 8) + 'px';
            });
        }
        updateScrollMargins();
        window.addEventListener('resize', updateScrollMargins);

        // ── IntersectionObserver: identity sticky ──
        var businessInfo = document.getElementById('sf-business-info');
        if (businessInfo) {
            var identObs = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    var visible = entry.isIntersecting;
                    var row = document.getElementById('sf-identity-row');
                    if(row) {
                        row.style.maxHeight = visible ? '0' : '44px';
                        row.style.opacity  = visible ? '0' : '1';
                    }
                });
            }, { threshold: 0.1 });
            identObs.observe(businessInfo);
        }
    });
})();
</script>


<script>
// Navbar categorías — scroll + Intersection Observer
(function() {
    // ── Navegación categorías — sistema unificado ──────────────
    function sfSetActiveTab(idx) {
        var idxStr = String(idx);
        var tabBar = document.getElementById('sf-cat-tabs');
        if (!tabBar) return;
        tabBar.querySelectorAll('[data-cat-nav]').forEach(function(btn) {
            var active = btn.dataset.catNav === idxStr;
            btn.classList.toggle('text-primary', active);
            btn.classList.toggle('font-bold', active);
            btn.classList.toggle('border-primary', active);
            btn.classList.toggle('text-foreground/40', !active);
            btn.classList.toggle('border-transparent', !active);
            if (active) {
                var btnLeft = btn.offsetLeft;
                var barW = tabBar.offsetWidth;
                tabBar.scrollTo({ left: btnLeft - (barW / 2) + (btn.offsetWidth / 2), behavior: 'smooth' });
            }
        });
    }

    function sfScrollToCategory(idx) {
        var el = document.getElementById('sf-cat-' + idx);
        if (!el) return;
        var stickyBar = document.getElementById('sf-sticky-bar');
        var headerH = stickyBar ? stickyBar.offsetHeight : 60;
        var top = el.getBoundingClientRect().top + window.scrollY - headerH - 8;
        window.scrollTo({ top: top, behavior: 'smooth' });
        sfSetActiveTab(idx);
    }
    window.sfScrollToCategory = sfScrollToCategory;

    // ── Scroll-spy ──────────────────────────────────────────────
    (function() {
        var catSections = [];
        var featEl = document.getElementById('sf-cat-featured');
        if (featEl) catSections.push(featEl);
        document.querySelectorAll('[id^="sf-cat-"]').forEach(function(s) {
            if (/^sf-cat-\d+$/.test(s.id)) catSections.push(s);
        });
        if (!catSections.length) return;
        var lastActive = null;
        var observer = new IntersectionObserver(function(entries) {
            var best = null;
            entries.forEach(function(entry) {
                if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) {
                    best = entry;
                }
            });
            if (!best) return;
            var idx = best.target.id.replace('sf-cat-', '');
            if (idx === lastActive) return;
            lastActive = idx;
            sfSetActiveTab(idx);
        }, { rootMargin: '-15% 0px -75% 0px', threshold: [0, 0.25, 0.5] });
        catSections.forEach(function(sec) { observer.observe(sec); });
    })();

    // ── Hero Slider ─────────────────────────────────────────────
    (function() {
        var slides = document.querySelectorAll('.sf-slide');
        var dots   = document.querySelectorAll('.sf-dot');
        if (slides.length <= 1) return;
        var cur = 0;
        function isModalOpen() {
            var drawer = document.getElementById('sf-drawer');
            var infoModal = document.getElementById('sf-info-modal');
            var dataModal = document.getElementById('sf-data-modal');
            var drawerOpen = drawer && drawer.classList.contains('open');
            var infoOpen = infoModal && infoModal.style.display !== 'none' && infoModal.style.display !== '';
            var dataOpen = dataModal && dataModal.style.display !== 'none' && dataModal.style.display !== '';
            return drawerOpen || infoOpen || dataOpen;
        }
        function goTo(n) {
            var outSlide = slides[cur];
            outSlide.style.opacity = '0';
            outSlide.style.transform = 'translateX(-40px)';
            if (dots[cur]) { dots[cur].style.background = 'rgba(255,255,255,0.4)'; dots[cur].style.width = '8px'; }
            cur = n % slides.length;
            var inSlide = slides[cur];
            inSlide.style.transition = 'none';
            inSlide.style.transform = 'translateX(40px)';
            inSlide.style.opacity = '0';
            inSlide.offsetHeight; /* reflow */
            inSlide.style.transition = '';
            inSlide.style.transform = 'translateX(0)';
            inSlide.style.opacity = '1';
            if (dots[cur]) { dots[cur].style.background = '#fff'; dots[cur].style.width = '16px'; }
        }
        if (dots.length) dots.forEach(function(d) { d.addEventListener('click', function() { goTo(+this.dataset.slide); }); });
        setInterval(function() { if (!isModalOpen()) goTo(cur + 1); }, 7000);
    })();
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
        }).catch(function() {});
    }
    track('pageview');
    document.addEventListener('click', function(e) {
        if (e.target.closest('a[href*="wa.me"]')) track('click_whatsapp');
        if (e.target.closest('a[href^="tel:"]')) track('click_call');
    });
    setInterval(function() { track('time_on_page'); }, 30000);
})();

    // ── Hamburger category menu ──────────────────────────────────
    function sfToggleCatMenu() {
        var dd = document.getElementById('sf-cat-dropdown');
        var bd = document.getElementById('sf-cat-backdrop');
        var open = dd.style.display !== 'none';
        if (!open) {
            var trigger = document.getElementById('sf-cat-menu-btn');
            if (trigger) {
                var rect = trigger.getBoundingClientRect();
                dd.style.top  = (rect.bottom + 4) + 'px';
                dd.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - 228)) + 'px';
            }
        }
        dd.style.display = open ? 'none' : 'block';
        bd.style.display = open ? 'none' : 'block';
    }

    // ── Inline product search ────────────────────────────────────────────────
    function sfToggleSearch() {
        var wrap    = document.getElementById('sf-search-wrap');
        var tabs    = document.getElementById('sf-cat-tabs');
        var hamWrap = document.getElementById('sf-cat-menu-btn') ? document.getElementById('sf-cat-menu-btn').parentElement : null;
        var isOpen  = wrap.style.display !== 'none';
        if (isOpen) {
            wrap.style.display = 'none';
            if (tabs) tabs.style.display = '';
            if (hamWrap) hamWrap.style.display = '';
            sfSearchClear();
        } else {
            wrap.style.display = 'flex';
            if (tabs) tabs.style.display = 'none';
            if (hamWrap) hamWrap.style.display = 'none';
            setTimeout(function() {
                var inp = document.getElementById('sf-search-input');
                if (inp) { inp.value = ''; inp.focus(); }
            }, 50);
        }
    }

    function sfSearchFilter(q) {
        q = (q || '').toLowerCase().trim();
        document.querySelectorAll('.sf-item-card').forEach(function(card) {
            var match = !q || (card.dataset.sfQ || '').indexOf(q) !== -1;
            card.style.display = match ? '' : 'none';
        });
        document.querySelectorAll('.sf-cat-section').forEach(function(sec) {
            if (!q) { sec.style.display = ''; return; }
            var visible = Array.from(sec.querySelectorAll('.sf-item-card')).some(function(c) { return c.style.display !== 'none'; });
            sec.style.display = visible ? '' : 'none';
        });
        var feat = document.getElementById('sf-cat-featured');
        if (feat) {
            var featVis = Array.from(feat.querySelectorAll('.sf-item-card')).some(function(c) { return c.style.display !== 'none'; });
            feat.style.display = (!q || featVis) ? '' : 'none';
        }
    }

    function sfSearchClear() {
        document.querySelectorAll('.sf-item-card').forEach(function(c) { c.style.display = ''; });
        document.querySelectorAll('.sf-cat-section').forEach(function(s) { s.style.display = ''; });
        var feat = document.getElementById('sf-cat-featured');
        if (feat) feat.style.display = '';
    }

    function sfShareModal() {
        var url   = window.location.href;
        var title = document.title;
        var btn = document.querySelector('#sf-info-modal button[onclick="sfShareModal()"]');

        function showShareFeedback(ok, message) {
            if (!btn) {
                if (!ok && message) {
                    alert(message);
                }
                return;
            }
            var orig = btn.getAttribute('data-orig-html') || btn.innerHTML;
            btn.setAttribute('data-orig-html', orig);
            btn.innerHTML = ok
                ? '<span class="iconify tabler--check size-4"></span> Enlace copiado'
                : '<span class="iconify tabler--alert-triangle size-4"></span> No se pudo compartir';
            setTimeout(function() {
                btn.innerHTML = orig;
            }, 2200);
        }

        function fallbackCopy() {
            if (navigator.clipboard && window.isSecureContext) {
                return navigator.clipboard.writeText(url).then(function() {
                    showShareFeedback(true);
                    return true;
                });
            }

            return new Promise(function(resolve) {
                try {
                    var input = document.createElement('input');
                    input.value = url;
                    input.setAttribute('readonly', '');
                    input.style.position = 'fixed';
                    input.style.opacity = '0';
                    document.body.appendChild(input);
                    input.select();
                    input.setSelectionRange(0, 99999);
                    var copied = document.execCommand('copy');
                    document.body.removeChild(input);

                    if (copied) {
                        showShareFeedback(true);
                        resolve(true);
                        return;
                    }
                } catch (e) {}

                // Last resort: manual copy dialog.
                window.prompt('Copia este enlace:', url);
                showShareFeedback(false, 'Copia el enlace manualmente');
                resolve(false);
            });
        }

        if (navigator.share) {
            navigator.share({ title: title, url: url })
                .then(function() { showShareFeedback(true); })
                .catch(function() { fallbackCopy(); });
            return;
        }

        fallbackCopy();
    }
    document.querySelectorAll('img[loading="lazy"]').forEach(function(img) {
        img.onload = function() { img.classList.add('loaded'); };
        if (img.complete) img.classList.add('loaded');
    });
(function(){
    var el = document.getElementById('synti-food-trigger');
    if(!el) return;
    var t = null;
    el.addEventListener('touchstart', function(){
        t = setTimeout(function(){
            if(typeof openSyntiPanel==='function') openSyntiPanel();
            if(navigator.vibrate) navigator.vibrate(60);
        }, 5000);
    }, {passive:true});
    el.addEventListener('touchend',   function(){ clearTimeout(t); }, {passive:true});
    el.addEventListener('touchmove',  function(){ clearTimeout(t); }, {passive:true});
    el.addEventListener('touchcancel',function(){ clearTimeout(t); }, {passive:true});
})();
(function(){
    var el = document.getElementById('sf-cat-menu-btn');
    if(!el) return;
    var t = null;
    el.addEventListener('touchstart', function(){
        t = setTimeout(function(){
            if(typeof openSyntiPanel==='function') openSyntiPanel();
            if(navigator.vibrate) navigator.vibrate(60);
        }, 5000);
    }, {passive:true});
    el.addEventListener('touchend',   function(){ clearTimeout(t); }, {passive:true});
    el.addEventListener('touchmove',  function(){ clearTimeout(t); }, {passive:true});
    el.addEventListener('touchcancel',function(){ clearTimeout(t); }, {passive:true});
})();
</script>
@endpush