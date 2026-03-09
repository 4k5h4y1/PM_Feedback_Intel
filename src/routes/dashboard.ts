import { Hono } from 'hono';
import type { Env } from '../types';

const ui = new Hono<{ Bindings: Env }>();
ui.get('/', (c) => c.html(HTML));

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>PMI Dashboard — Voice of Customer</title>
<style>
:root {
  --bg:#f3f4f6; --surface:#ffffff; --surface2:#f8f9fb; --surface3:#eef0f4;
  --border:#e3e6ed; --border2:#eef0f4;
  --text:#111827; --muted:#6b7280; --dim:#9ca3af;
  --orange:#f6821f; --orange-dim:rgba(246,130,31,0.10);
  --red:#dc2626; --red-bg:rgba(220,38,38,0.07); --red-border:rgba(220,38,38,0.25);
  --yellow:#d97706; --yellow-bg:rgba(217,119,6,0.09);
  --green:#16a34a; --green-bg:rgba(22,163,74,0.09);
  --blue:#2563eb; --blue-bg:rgba(37,99,235,0.09);
  --purple:#7c3aed; --purple-bg:rgba(124,58,237,0.09);
  --teal:#0d9488; --teal-bg:rgba(13,148,136,0.09);
  --r:6px; --r2:8px;
  --shadow:0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04);
  --shadow-md:0 4px 12px rgba(0,0,0,0.10),0 2px 4px rgba(0,0,0,0.05);
  --font:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:14px;line-height:1.5}

/* ─── Layout ─────────────────────────────────────────────────────── */
.app{display:flex;height:100vh}
.sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow)}
.sidebar-logo{padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;min-height:56px}
.logo-mark{width:28px;height:28px;background:var(--orange);border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:10px;color:#fff;flex-shrink:0;letter-spacing:-0.5px}
.logo-name{font-weight:700;font-size:14px;line-height:1.1;color:var(--text)}
.logo-sub{font-size:10px;color:var(--muted);font-weight:400}
.nav{padding:8px 0;flex:1;overflow-y:auto}
.nav-label{padding:8px 16px 3px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--dim)}
.nav-item{display:flex;align-items:center;gap:9px;padding:8px 16px;cursor:pointer;border:none;background:none;color:var(--muted);font-size:13px;font-family:var(--font);width:100%;text-align:left;transition:all 0.12s;border-left:2px solid transparent;position:relative}
.nav-item:hover{background:var(--surface3);color:var(--text)}
.nav-item.active{background:var(--orange-dim);color:var(--orange);border-left-color:var(--orange);font-weight:600}
.nav-icon{font-size:13px;width:17px;text-align:center;flex-shrink:0}
.nav-badge{margin-left:auto;background:var(--red);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px;min-width:18px;text-align:center;line-height:1.6}
.nav-badge.o{background:var(--orange)}
.sidebar-footer{padding:12px 16px;border-top:1px solid var(--border);font-size:11px}
.cf-chip{display:inline-flex;align-items:center;gap:4px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:3px 8px;font-size:10px;color:var(--muted);margin-bottom:6px}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block;position:relative;flex-shrink:0}
.live-dot::after{content:'';position:absolute;inset:-3px;border-radius:50%;border:1px solid var(--green);animation:pulse 1.8s ease-out infinite}
@keyframes pulse{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(2.2)}}

/* ─── Main ───────────────────────────────────────────────────────── */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.topbar{height:52px;background:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 24px;flex-shrink:0;box-shadow:var(--shadow)}
.topbar-left{display:flex;align-items:center;gap:8px}
.page-title{font-size:15px;font-weight:700;color:var(--text)}
.page-desc{font-size:12px;color:var(--muted)}
.topbar-right{display:flex;gap:8px}

/* ─── Buttons ────────────────────────────────────────────────────── */
.btn{padding:7px 14px;border-radius:var(--r);border:1px solid var(--border);background:#fff;color:var(--text);cursor:pointer;font-size:13px;font-family:var(--font);font-weight:500;transition:all 0.12s;text-align:center;box-shadow:var(--shadow)}
.btn:hover{border-color:var(--orange);color:var(--orange);background:var(--orange-dim)}
.btn-sm{padding:5px 11px;font-size:12px}
.btn-primary{background:var(--orange);border-color:var(--orange);color:#fff;font-weight:600}
.btn-primary:hover{background:#e5751a;border-color:#e5751a;color:#fff}

/* ─── Content ────────────────────────────────────────────────────── */
.content{flex:1;overflow-y:auto;padding:20px 24px}
.view{display:none;animation:fadein 0.18s ease}
.view.active{display:block}
@keyframes fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.sec-head{margin-bottom:16px}
.sec-title{font-size:18px;font-weight:700;letter-spacing:-0.2px;margin-bottom:2px;color:var(--text)}
.sec-desc{font-size:12px;color:var(--muted)}
.section-label{font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--dim);margin-bottom:8px}

/* ─── Cards ──────────────────────────────────────────────────────── */
.card{background:#fff;border:1px solid var(--border);border-radius:var(--r2);padding:16px;box-shadow:var(--shadow);transition:box-shadow 0.15s}
.card:hover{box-shadow:var(--shadow-md)}
.card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.card-title{font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--muted)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px}
.grid-35-65{display:grid;grid-template-columns:35fr 65fr;gap:14px;margin-bottom:16px}
.mb16{margin-bottom:16px}
@media(max-width:900px){.grid2,.grid3,.grid-35-65{grid-template-columns:1fr}}

/* ─── Priority alert strip ───────────────────────────────────────── */
.alert-strip{background:rgba(220,38,38,0.04);border:1px solid rgba(220,38,38,0.18);border-radius:var(--r2);padding:12px 16px;margin-bottom:16px;box-shadow:var(--shadow)}
.alert-strip-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.alert-strip-title{font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--red);display:flex;align-items:center;gap:6px}
.alert-item{display:grid;grid-template-columns:32px 1fr auto;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(220,38,38,0.08)}
.alert-item:last-child{border-bottom:none;padding-bottom:0}
.alert-urg{width:32px;height:32px;border-radius:var(--r);background:var(--red-bg);border:1px solid rgba(220,38,38,0.2);color:var(--red);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1}
.alert-body{min-width:0}
.alert-title{font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.alert-meta{font-size:11px;color:var(--muted);margin-top:1px}
.alert-action{font-size:11px;color:var(--orange);cursor:pointer;white-space:nowrap;flex-shrink:0;font-weight:500}
.alert-action:hover{text-decoration:underline}

/* ─── Stat cards ─────────────────────────────────────────────────── */
.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px}
/* overflow:visible so tooltips aren't clipped */
.stat-card{background:#fff;border:1px solid var(--border);border-radius:var(--r2);padding:14px;position:relative;cursor:default;transition:all 0.15s;overflow:visible;z-index:1;box-shadow:var(--shadow)}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--c,var(--border));border-radius:var(--r2) var(--r2) 0 0;pointer-events:none}
.stat-card:hover{box-shadow:var(--shadow-md);border-color:var(--c,var(--border));z-index:20}
.stat-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.stat-lbl{font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--muted)}
.stat-val{font-size:26px;font-weight:800;line-height:1;color:var(--c,var(--text));letter-spacing:-1px}
.stat-sub{font-size:11px;color:var(--dim);margin-top:3px}

/* ─── Urgency hero ───────────────────────────────────────────────── */
.stat-hero{background:linear-gradient(135deg,rgba(220,38,38,0.05),rgba(220,38,38,0.02));border-color:rgba(220,38,38,0.25) !important}
.stat-hero::before{background:var(--red) !important;height:3px}
.stat-hero .stat-val{font-size:36px;color:var(--red)}
.stat-hero .stat-lbl{color:rgba(220,38,38,0.7)}

/* ─── Info tooltip ───────────────────────────────────────────────── */
.info{width:16px;height:16px;border-radius:50%;background:var(--surface3);border:1px solid var(--border);color:var(--muted);font-size:9px;font-weight:700;cursor:default;display:inline-flex;align-items:center;justify-content:center;position:relative;flex-shrink:0;user-select:none}
.info:hover .tip{display:block}
.tip{display:none;position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#1f2937;border:1px solid #374151;border-radius:6px;padding:7px 10px;font-size:11px;color:#d1d5db;z-index:1000;white-space:normal;min-width:180px;max-width:240px;box-shadow:0 4px 16px rgba(0,0,0,0.25);pointer-events:none;font-weight:400;text-transform:none;letter-spacing:0}
.tip::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:#374151}

/* ─── Badges ─────────────────────────────────────────────────────── */
.badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;line-height:1.5}
.b-red{background:var(--red-bg);color:var(--red)}
.b-yellow{background:var(--yellow-bg);color:var(--yellow)}
.b-green{background:var(--green-bg);color:var(--green)}
.b-blue{background:var(--blue-bg);color:var(--blue)}
.b-purple{background:var(--purple-bg);color:var(--purple)}
.b-orange{background:var(--orange-dim);color:var(--orange)}
.b-teal{background:var(--teal-bg);color:var(--teal)}
.b-gray{background:var(--surface3);color:var(--muted)}

/* ─── Urgency pills ──────────────────────────────────────────────── */
.u-pill{padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700}
.u-c{background:var(--red-bg);color:var(--red);border:1px solid var(--red-border)}
.u-h{background:var(--yellow-bg);color:var(--yellow)}
.u-m{background:var(--blue-bg);color:var(--blue)}
.u-l{background:var(--green-bg);color:var(--green)}

/* ─── Bar rows ───────────────────────────────────────────────────── */
.hbar{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.hbar-lbl{font-size:12px;color:var(--text);min-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hbar-track{flex:1;height:7px;background:var(--surface3);border-radius:4px;overflow:hidden}
.hbar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--orange),#faad3f);transition:width 0.7s cubic-bezier(.4,0,.2,1)}
.hbar-n{font-size:12px;color:var(--muted);min-width:24px;text-align:right;font-weight:600}

/* ─── Sentiment donut ────────────────────────────────────────────── */
.donut-wrap{display:flex;align-items:center;gap:16px}
.donut{position:relative;width:80px;height:80px;flex-shrink:0}
.donut svg{transform:rotate(-90deg)}
.donut-lbl{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.donut-pct{font-size:16px;font-weight:800;color:var(--red)}
.donut-sub{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.legend{display:flex;flex-direction:column;gap:6px;flex:1}
.legend-row{display:flex;align-items:center;justify-content:space-between;font-size:12px}
.legend-left{display:flex;align-items:center;gap:6px}
.legend-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.legend-count{font-weight:700;font-size:13px}

/* ─── Trend chart ────────────────────────────────────────────────── */
.trend-chart{padding:4px 0 0}
.trend-bars{display:flex;align-items:flex-end;gap:3px;height:56px}
.tbar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:0;position:relative}
.tbar{width:100%;border-radius:2px 2px 0 0;min-height:2px;cursor:pointer;position:relative}
.tbar:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100%+5px);left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:4px 8px;font-size:10px;color:var(--text);white-space:nowrap;z-index:500;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,0.4)}
.tbar-neg{background:var(--red);opacity:0.75}
.tbar-ok{background:var(--orange);opacity:0.6}
.trend-xlabels{display:flex;gap:3px;margin-top:4px}
.tbar-lbl{flex:1;font-size:8px;color:var(--dim);text-align:center;overflow:hidden;white-space:nowrap}
.trend-legend{display:flex;gap:14px;margin-top:8px}
.trend-leg-item{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted)}
.trend-leg-dot{width:8px;height:8px;border-radius:2px}

/* ─── Source tiles ───────────────────────────────────────────────── */
.src-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.src-tile{display:flex;align-items:center;gap:8px;padding:8px;background:var(--surface2);border-radius:var(--r);border:1px solid var(--border)}
.src-name{font-size:12px;font-weight:600;color:var(--text);flex:1}
.src-bar-track{height:3px;background:var(--surface3);border-radius:2px;margin-top:2px}
.src-bar-fill{height:100%;background:var(--orange);border-radius:2px}
.src-n{font-size:14px;font-weight:800;color:var(--orange);flex-shrink:0}

/* ─── Competitor cards ───────────────────────────────────────────── */
.comp-card{background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:12px;margin-bottom:8px;cursor:pointer;transition:all 0.15s}
.comp-card:last-child{margin-bottom:0}
.comp-card:hover{border-color:var(--orange)}
.comp-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.comp-name{font-weight:700;font-size:14px;color:var(--text);text-transform:capitalize}
.comp-count{font-size:20px;font-weight:800;color:var(--orange)}
.comp-bar-track{height:3px;background:var(--surface3);border-radius:2px;margin-top:8px;overflow:hidden}
.comp-bar-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--orange),#faad3f)}
.comp-tags{display:flex;flex-wrap:wrap;gap:4px}

/* ─── Insight box ────────────────────────────────────────────────── */
.insight{background:var(--orange-dim);border:1px solid rgba(246,130,31,0.2);border-radius:var(--r);padding:11px 14px;margin-bottom:14px;font-size:13px;color:var(--text);display:flex;gap:10px;align-items:flex-start}
.insight-icon{font-size:16px;flex-shrink:0;margin-top:1px}

/* ─── Security banner ────────────────────────────────────────────── */
.sec-banner{background:rgba(240,68,68,0.06);border:1px solid var(--red-border);border-radius:var(--r2);padding:16px;margin-bottom:16px;display:flex;gap:14px;align-items:flex-start}
.sec-banner-icon{font-size:26px;flex-shrink:0}
.sec-banner h3{font-size:13px;font-weight:700;color:var(--red);margin-bottom:3px}
.sec-banner p{font-size:12px;color:var(--muted)}

/* ─── Feed cards ─────────────────────────────────────────────────── */
.feed-card{background:#fff;border:1px solid var(--border);border-radius:var(--r2);padding:14px;margin-bottom:8px;cursor:pointer;transition:all 0.15s;position:relative;overflow:hidden;box-shadow:var(--shadow)}
.feed-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--uc,var(--dim))}
.feed-card:hover{border-color:var(--uc,var(--orange));box-shadow:var(--shadow-md)}
.feed-top{display:flex;align-items:center;gap:7px;margin-bottom:6px;flex-wrap:wrap}
.feed-title{font-weight:600;font-size:13px;color:var(--text);margin-bottom:4px;line-height:1.35}
.feed-body{font-size:12px;color:var(--muted);line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:6px}
.feed-foot{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.feed-src{font-size:12px;color:var(--muted);display:inline-flex;align-items:center;gap:5px;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:2px 9px}
.feed-dot{color:var(--dim);font-size:10px}
.feed-empty{text-align:center;padding:40px 20px;color:var(--muted)}
.feed-empty-icon{font-size:28px;margin-bottom:8px}

/* ─── Digest ─────────────────────────────────────────────────────── */
.digest-wrap{background:linear-gradient(135deg,var(--surface),rgba(246,130,31,0.04));border:1px solid rgba(246,130,31,0.2);border-radius:var(--r2);padding:20px;margin-bottom:16px}
.digest-text{font-size:13.5px;line-height:1.85;color:var(--text);white-space:pre-wrap}
.digest-text strong{color:var(--orange);font-weight:700}
.digest-gen{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px;padding:20px 0}

/* ─── Scope model ────────────────────────────────────────────────── */
.scope-row{display:flex;gap:10px;padding:10px;background:var(--surface2);border-radius:var(--r);margin-bottom:6px}
.scope-row:last-child{margin-bottom:0}
.scope-code{font-size:10px;font-family:monospace;font-weight:700;white-space:nowrap}
.scope-desc{font-size:11px;color:var(--muted);margin-top:2px}
.pii-tag{background:var(--purple-bg);color:var(--purple);border-radius:4px;padding:2px 6px;font-size:10px;font-weight:600;font-family:monospace}

/* ─── Filter bar ─────────────────────────────────────────────────── */
.filter-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center}
.f-sel{padding:6px 10px;border-radius:var(--r);border:1px solid var(--border);background:#fff;color:var(--text);font-size:12px;font-family:var(--font);cursor:pointer;transition:border-color 0.12s;box-shadow:var(--shadow)}
.f-sel:focus{outline:none;border-color:var(--orange)}
.f-sel option{background:#fff}
.f-count{margin-left:auto;font-size:12px;color:var(--muted)}
.load-more{text-align:center;margin-top:10px}

/* ─── Modals ─────────────────────────────────────────────────────── */
.modal-head{padding:16px 20px 12px;border-bottom:1px solid var(--border)}
.modal-title{font-size:16px;font-weight:700}
.modal-desc{font-size:12px;color:var(--muted);margin-top:2px}
.modal-body{padding:16px 20px;max-height:68vh;overflow-y:auto;width:100%}
.modal-foot{padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px}
.form-row{margin-bottom:12px}
.form-lbl{display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
.form-ctrl{width:100%;padding:8px 11px;border-radius:var(--r);border:1px solid var(--border);background:#fff;color:var(--text);font-size:13px;font-family:var(--font);transition:border-color 0.15s}
.form-ctrl:focus{outline:none;border-color:var(--orange);box-shadow:0 0 0 3px var(--orange-dim)}
textarea.form-ctrl{min-height:90px;resize:vertical}
.form-ctrl option{background:#fff}
.detail-grid{display:grid;grid-template-columns:120px 1fr;gap:0}
.dk{font-size:12px;color:var(--muted);padding:7px 0;border-bottom:1px solid var(--border2)}
.dv{font-size:13px;color:var(--text);padding:7px 0;border-bottom:1px solid var(--border2)}
.raw-box{background:var(--bg);border:1px solid var(--border);border-radius:var(--r);padding:12px;font-size:12px;line-height:1.7;color:var(--muted);max-height:180px;overflow-y:auto;white-space:pre-wrap;font-family:monospace;margin-top:10px}
.ar-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:13px}
.ar-lbl{font-size:12px;color:var(--muted)}
.analysis-box{background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:12px;margin-top:10px}

/* ─── Confidence bar ─────────────────────────────────────────────── */
.conf-wrap{display:flex;align-items:center;gap:8px}
.conf-track{flex:1;height:4px;background:var(--surface3);border-radius:2px}
.conf-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--blue),var(--green))}

/* ─── Spinner ────────────────────────────────────────────────────── */
.spin{display:inline-block;width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--orange);border-radius:50%;animation:rot .7s linear infinite;vertical-align:middle}
@keyframes rot{to{transform:rotate(360deg)}}

/* ─── Modals (light theme) ───────────────────────────────────────── */
dialog{background:#fff;border:1px solid var(--border);border-radius:12px;padding:0;max-width:95vw;color:var(--text);box-shadow:0 20px 60px rgba(0,0,0,.15)}
dialog::backdrop{background:rgba(0,0,0,.40);backdrop-filter:blur(3px)}

/* ─── Scroll ─────────────────────────────────────────────────────── */
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

/* ─── Criticality badge ───────────────────────────────────────────── */
.crit-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;line-height:1.5;min-width:38px;justify-content:center}
.crit-hi{background:rgba(240,68,68,0.15);color:var(--red);border:1px solid rgba(240,68,68,0.3)}
.crit-med{background:var(--yellow-bg);color:var(--yellow)}
.crit-lo{background:var(--surface3);color:var(--muted)}

/* ─── Segment table ───────────────────────────────────────────────── */
.seg-table{width:100%;border-collapse:collapse}
.seg-table th{font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--dim);padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)}
.seg-table td{padding:9px 10px;border-bottom:1px solid var(--border2);font-size:13px;vertical-align:middle}
.seg-row:hover td{background:var(--surface2)}

/* ─── PM Brief ────────────────────────────────────────────────────── */
.pm-brief{background:linear-gradient(135deg,var(--surface),rgba(246,130,31,0.04));border:1px solid rgba(246,130,31,0.2);border-radius:var(--r2);padding:16px;margin-bottom:16px}
.pm-brief-preview{font-size:13px;line-height:1.7;color:var(--muted);margin-bottom:10px}
.pm-brief-expand{font-size:12px;color:var(--orange);cursor:pointer;text-decoration:none}
.pm-brief-expand:hover{text-decoration:underline}

/* ─── Prioritization buckets ─────────────────────────────────────── */
.bucket-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
.bucket-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px}
@media(max-width:900px){.bucket-grid,.bucket-grid-3{grid-template-columns:1fr}}
.bucket-card{background:#fff;border:1px solid var(--border);border-radius:var(--r2);padding:16px;position:relative;overflow:hidden;box-shadow:var(--shadow)}
.bucket-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--bc,var(--border));border-radius:var(--r2) var(--r2) 0 0}
.bucket-title{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--bc,var(--muted));margin-bottom:2px;display:flex;align-items:center;gap:6px}
.bucket-desc{font-size:11px;color:var(--muted);margin-bottom:10px}
.bucket-count{font-size:24px;font-weight:800;color:var(--bc,var(--text));line-height:1;margin-bottom:10px}
.bucket-item{display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--border2);font-size:12px}
.bucket-item:last-child{border-bottom:none;padding-bottom:0}
.bucket-item-body{min-width:0;flex:1}
.bucket-item-title{font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:1px}
.bucket-item-meta{font-size:11px;color:var(--muted)}
.bucket-empty{padding:12px 0;text-align:center;color:var(--dim);font-size:12px}
</style>
</head>
<body>
<div class="app">

<!-- SIDEBAR -->
<aside class="sidebar">
  <div class="sidebar-logo">
    <div class="logo-mark">PM</div>
    <div><div class="logo-name">PMI Dashboard</div><div class="logo-sub">Voice of Customer</div></div>
  </div>
  <nav class="nav">
    <div class="nav-label">Dashboard</div>
    <button class="nav-item active" id="nav-overview" onclick="gotoView('overview')">
      <span class="nav-icon">◈</span> Overview
    </button>
    <button class="nav-item" id="nav-issues" onclick="gotoView('issues')">
      <span class="nav-icon">⊞</span> Prioritization
      <span class="nav-badge o" id="nb-urgency">…</span>
    </button>
    <div class="nav-label" style="margin-top:6px">Intelligence</div>
    <button class="nav-item" id="nav-competitors" onclick="gotoView('competitors')">
      <span class="nav-icon">⚔</span> Competitive Pressure
      <span class="nav-badge o" id="nb-comp">…</span>
    </button>
    <button class="nav-item" id="nav-security" onclick="gotoView('security')">
      <span class="nav-icon">🔒</span> Security Issues
      <span class="nav-badge" id="nb-sec">…</span>
    </button>
    <button class="nav-item" id="nav-ai" onclick="gotoView('ai')">
      <span class="nav-icon">✦</span> Weekly Digest
    </button>
    <div class="nav-label" style="margin-top:6px">Data</div>
    <button class="nav-item" id="nav-feed" onclick="gotoView('feed')">
      <span class="nav-icon">☰</span> All Feedback
    </button>
  </nav>
  <div class="sidebar-footer">
    <div class="cf-chip">⛅ Cloudflare Workers</div>
    <div style="display:flex;align-items:center;gap:6px;margin-top:4px;color:var(--muted)">
      <span class="live-dot"></span>
      <span id="sb-total">—</span> records · live
    </div>
  </div>
</aside>

<!-- MAIN -->
<div class="main">
  <div class="topbar">
    <div class="topbar-left">
      <span class="page-title" id="pg-title">Overview</span>
      <span class="page-desc" id="pg-desc">· Signal summary</span>
    </div>
    <div class="topbar-right">
      <button class="btn btn-sm" onclick="gotoView('issues')">⊞ Prioritization</button>
      <button class="btn btn-primary btn-sm" onclick="openSubmit()">+ Submit Feedback</button>
    </div>
  </div>
  <div class="content">

    <!-- ═══ OVERVIEW ═══════════════════════════════════════════════ -->
    <div class="view active" id="view-overview">

      <!-- Section 1: Priority Actions -->
      <div class="alert-strip" id="priority-actions" style="display:none">
        <div class="alert-strip-head">
          <div class="alert-strip-title">⚡ Priority Actions — Needs PM Attention</div>
          <button class="btn btn-sm" onclick="gotoView('issues')" style="font-size:11px;padding:3px 10px">View All</button>
        </div>
        <div id="priority-action-items"></div>
      </div>

      <!-- Section 2: Executive Summary (4 cards) -->
      <div class="stats-row" style="grid-template-columns:repeat(4,1fr)">
        <div class="stat-card stat-hero" style="--c:var(--red)">
          <div class="stat-head"><div class="stat-lbl">Action Required</div><div class="info">i<div class="tip">Feedback with AI urgency ≥ 8/10. Production issues, churn risk, security incidents — needs PM attention today.</div></div></div>
          <div class="stat-val" id="s-urg">—</div><div class="stat-sub">urgency ≥ 8 / 10</div>
        </div>
        <div class="stat-card" id="s-sentiment-card">
          <div class="stat-head"><div class="stat-lbl">Customer Sentiment</div><div class="info">i<div class="tip">Composite score 0–100. Formula: clamp(0,100,((positive − negative×1.2 + neutral×0.4)/total)×50+50). Green ≥70 healthy · Amber 40–69 at risk · Red &lt;40 critical.</div></div></div>
          <div class="stat-val" id="s-sentiment-score">—</div><div class="stat-sub" id="s-sentiment-sub">loading…</div>
        </div>
        <div class="stat-card" style="--c:var(--orange)">
          <div class="stat-head"><div class="stat-lbl">Competitive Pressure</div><div class="info">i<div class="tip">Records where a named competitor (AWS, Fastly, Vercel, Netlify, Akamai) is explicitly mentioned.</div></div></div>
          <div class="stat-val" id="s-comp">—</div><div class="stat-sub" id="s-comp-sub">active comparisons</div>
        </div>
        <div class="stat-card" style="--c:var(--text)">
          <div class="stat-head"><div class="stat-lbl">Total Signals</div><div class="info">i<div class="tip">Total analyzed records across all 8 ingestion sources stored in Cloudflare D1.</div></div></div>
          <div class="stat-val" id="s-total">—</div><div class="stat-sub">analyzed records</div>
        </div>
      </div>

      <!-- Section 3: Trends -->
      <div class="section-label" style="margin-top:4px;margin-bottom:8px">Trends</div>
      <div class="grid-35-65">
        <div class="card">
          <div class="card-header"><div class="card-title">Feedback Volume</div><div class="info">i<div class="tip">Daily feedback volume. Red = negative sentiment. Orange = total. Helps identify when issues spike.</div></div></div>
          <div id="ov-trend"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Product Areas Under Pressure</div><div class="info">i<div class="tip">Volume by Cloudflare product area. Identifies which products generate the most signal.</div></div></div>
          <div id="ov-cats"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
        </div>
      </div>

      <!-- Section 4: Segment Impact -->
      <div class="section-label" style="margin-top:4px;margin-bottom:8px">Segment Impact</div>
      <div class="card mb16">
        <div id="ov-segments"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
      </div>

      <!-- Section 5: What's Trending -->
      <div class="section-label" style="margin-top:4px;margin-bottom:8px">What's Trending</div>
      <div class="card mb16">
        <div class="card-header"><div class="card-title">What's Trending</div><div class="info">i<div class="tip">Recurring themes extracted by Workers AI. Top 5 shown — see Prioritization for full view.</div></div></div>
        <div id="ov-themes"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border2)"><span class="alert-action" onclick="gotoView('issues')">See all → Prioritization</span></div>
      </div>

      <!-- Section 6: PM Brief -->
      <div class="section-label" style="margin-top:4px;margin-bottom:8px">PM Brief</div>
      <div class="pm-brief" id="ov-pm-brief">
        <div style="color:var(--muted);font-size:12px">Loading…</div>
      </div>

    </div>

    <!-- ═══ PRIORITIZATION ════════════════════════════════════════ -->
    <div class="view" id="view-issues">
      <div class="sec-head">
        <div class="sec-title">Prioritization</div>
        <div class="sec-desc">Feedback automatically bucketed by business impact, effort, and strategic value. Click any item to view detail.</div>
      </div>
      <div class="insight" id="sig-insight" style="display:none">
        <span class="insight-icon">⚡</span><span id="sig-insight-txt"></span>
      </div>

      <!-- Row 1: Core Gaps + Quick Wins -->
      <div class="bucket-grid">
        <div class="bucket-card" style="--bc:var(--red)">
          <div class="bucket-title">🔥 Core Gaps</div>
          <div class="bucket-desc">High-urgency bugs &amp; complaints from key accounts. Fix now.</div>
          <div class="bucket-count" id="bkt-core-cnt">—</div>
          <div id="bkt-core"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
        </div>
        <div class="bucket-card" style="--bc:var(--yellow)">
          <div class="bucket-title">🎯 Quick Wins</div>
          <div class="bucket-desc">Actionable, medium-urgency items — high return, low friction.</div>
          <div class="bucket-count" id="bkt-qw-cnt">—</div>
          <div id="bkt-qw"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
        </div>
      </div>

      <!-- Row 2: Strategic Bets + Long-Term + Delighters -->
      <div class="bucket-grid-3">
        <div class="bucket-card" style="--bc:var(--blue)">
          <div class="bucket-title">🚀 Strategic Bets</div>
          <div class="bucket-desc">Feature requests tied to enterprise or competitive signal.</div>
          <div class="bucket-count" id="bkt-sb-cnt">—</div>
          <div id="bkt-sb"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
        </div>
        <div class="bucket-card" style="--bc:var(--teal)">
          <div class="bucket-title">🌱 Long-Term</div>
          <div class="bucket-desc">Lower-urgency feature ideas worth tracking for the roadmap.</div>
          <div class="bucket-count" id="bkt-lt-cnt">—</div>
          <div id="bkt-lt"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
        </div>
        <div class="bucket-card" style="--bc:var(--green)">
          <div class="bucket-title">✨ Delighters</div>
          <div class="bucket-desc">Positive signals — praise &amp; ideas that amplify what's working.</div>
          <div class="bucket-count" id="bkt-del-cnt">—</div>
          <div id="bkt-del"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
        </div>
      </div>

      <!-- Trending themes -->
      <div class="card mb16">
        <div class="card-header"><div class="card-title">What's Trending</div><div class="info">i<div class="tip">Recurring themes extracted by Workers AI. Count = records mentioning this. Neg% = share with negative sentiment.</div></div></div>
        <div id="sig-table"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
      </div>
    </div>

    <!-- ═══ COMPETITORS ══════════════════════════════════════════ -->
    <div class="view" id="view-competitors">
      <div class="sec-head">
        <div class="sec-title">Competitive Pressure</div>
        <div class="sec-desc">Every named competitor mention — who's being compared, in what context, and why customers consider switching.</div>
      </div>
      <div class="insight" id="comp-insight" style="display:none">
        <span class="insight-icon">⚔</span><span id="comp-insight-txt"></span>
      </div>
      <div class="grid2">
        <div id="comp-cards"><div class="card"><div style="color:var(--muted);font-size:12px">Loading…</div></div></div>
        <div class="card">
          <div class="card-header"><div class="card-title">Competitor Mentions Feed</div><div class="info">i<div class="tip">All feedback records where a competitor is explicitly named, sorted by urgency.</div></div></div>
          <div id="comp-feed"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
        </div>
      </div>
    </div>

    <!-- ═══ SECURITY ══════════════════════════════════════════════ -->
    <div class="view" id="view-security">
      <div class="sec-head">
        <div class="sec-title">Security Issues</div>
        <div class="sec-desc">Restricted signals, PII-flagged records, and visibility scope enforcement.</div>
      </div>
      <div class="sec-banner">
        <div class="sec-banner-icon">🛡</div>
        <div>
          <h3>Access-Controlled View</h3>
          <p>Records below have restricted visibility. Raw content is server-redacted per <strong>visibility_scope</strong> rules. In production, Cloudflare Access + WARP posture checks gate this view to the security team only.</p>
        </div>
      </div>
      <div class="grid3">
        <div class="card" style="--c:var(--red)">
          <div class="card-header"><div class="card-title">Security Sensitive</div><div class="info">i<div class="tip">Records flagged security_sensitive=true by Workers AI. Raw text server-replaced with a restricted notice.</div></div></div>
          <div class="stat-val" id="sec-cnt" style="color:var(--red);font-size:26px;font-weight:800">—</div>
          <div class="stat-sub">visibility: security_team_only</div>
        </div>
        <div class="card" style="--c:var(--purple)">
          <div class="card-header"><div class="card-title">PII Flagged</div><div class="info">i<div class="tip">Records where pii_detected=true. Summaries auto-sanitized — emails, IPs, tokens replaced with [REDACTED_*].</div></div></div>
          <div class="stat-val" id="pii-cnt" style="color:var(--purple);font-size:26px;font-weight:800">—</div>
          <div class="stat-sub">auto-redacted in summaries</div>
        </div>
        <div class="card" style="--c:var(--yellow)">
          <div class="card-header"><div class="card-title">Restricted Scope</div><div class="info">i<div class="tip">Records with visibility_scope=restricted. Only redacted_summary shown; raw_text requires elevated access.</div></div></div>
          <div class="stat-val" id="res-cnt" style="color:var(--yellow);font-size:26px;font-weight:800">—</div>
          <div class="stat-sub">restricted visibility</div>
        </div>
      </div>
      <div class="grid2">
        <div class="card">
          <div class="card-header"><div class="card-title">Visibility Scope Model</div></div>
          <div>
            <div class="scope-row" style="border-left:3px solid var(--green)"><div><div class="scope-code" style="color:var(--green)">public</div><div class="scope-desc">All users · full content visible</div></div></div>
            <div class="scope-row" style="border-left:3px solid var(--blue)"><div><div class="scope-code" style="color:var(--blue)">internal</div><div class="scope-desc">Cloudflare employees · full content</div></div></div>
            <div class="scope-row" style="border-left:3px solid var(--yellow)"><div><div class="scope-code" style="color:var(--yellow)">restricted</div><div class="scope-desc">Elevated access · redacted_summary only</div></div></div>
            <div class="scope-row" style="border-left:3px solid var(--red)"><div><div class="scope-code" style="color:var(--red)">security_team_only</div><div class="scope-desc">Security team + WARP posture · raw_text replaced server-side</div></div></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">PII Type Breakdown</div><div class="info">i<div class="tip">Types of PII detected. Workers AI identifies emails, IPs, API keys, names, account IDs.</div></div></div>
          <div id="pii-breakdown"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Restricted Records — Redacted View</div><div class="info">i<div class="tip">Security-sensitive records with server-side redaction. Production access requires WARP posture check.</div></div></div>
        <div id="sec-feed"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
      </div>
    </div>

    <!-- ═══ WEEKLY DIGEST ═════════════════════════════════════════ -->
    <div class="view" id="view-ai">
      <div class="sec-head">
        <div class="sec-title">Weekly PM Digest</div>
        <div class="sec-desc">AI-generated summary from Workers AI (Llama 3.1-8B) over all feedback data. Cached in KV for 1 hour.</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px">
        <button class="btn btn-primary btn-sm" onclick="regenDigest()">↻ Regenerate</button>
        <span id="digest-status" style="font-size:12px;color:var(--muted)"></span>
      </div>
      <div class="digest-wrap" id="digest-wrap">
        <div class="digest-gen"><span class="spin"></span> Generating with Workers AI…</div>
      </div>
      <div class="grid3">
        <div class="card"><div class="card-header"><div class="card-title">Model</div></div><div style="font-family:monospace;font-size:12px;color:var(--orange)">@cf/meta/llama-3.1-8b-instruct</div><div style="font-size:11px;color:var(--muted);margin-top:4px">Cloudflare Workers AI</div></div>
        <div class="card"><div class="card-header"><div class="card-title">Cache TTL</div></div><div style="font-size:20px;font-weight:800">1 hour</div><div style="font-size:11px;color:var(--muted);margin-top:4px">KV · dashboard:digest:weekly</div></div>
        <div class="card"><div class="card-header"><div class="card-title">Records Analyzed</div></div><div style="font-size:20px;font-weight:800" id="digest-rec-cnt">—</div><div style="font-size:11px;color:var(--muted);margin-top:4px">from Cloudflare D1</div></div>
      </div>
    </div>

    <!-- ═══ ALL FEEDBACK ══════════════════════════════════════════ -->
    <div class="view" id="view-feed">
      <div class="sec-head">
        <div class="sec-title">All Feedback</div>
        <div class="sec-desc">Full dataset with filter and sort controls. Click any card for detail view.</div>
      </div>
      <div class="filter-bar">
        <select class="f-sel" id="f-src" onchange="applyFilters()">
          <option value="">All Sources</option>
          <option value="github">GitHub</option><option value="discord">Discord</option>
          <option value="support">Support</option><option value="email">Email</option>
          <option value="twitter">Twitter / X</option><option value="nps">NPS</option>
          <option value="zoom">Zoom</option><option value="sales">Sales</option>
        </select>
        <select class="f-sel" id="f-sent" onchange="applyFilters()">
          <option value="">All Sentiment</option>
          <option value="negative">Negative</option><option value="neutral">Neutral</option><option value="positive">Positive</option>
        </select>
        <select class="f-sel" id="f-cat" onchange="applyFilters()">
          <option value="">All Products</option>
          <option value="workers">Workers</option><option value="workers_ai">Workers AI</option>
          <option value="d1">D1</option><option value="kv">KV</option><option value="r2">R2</option>
          <option value="pages">Pages</option><option value="cloudflare_one">Cloudflare One</option>
          <option value="access">Access</option><option value="zero_trust">Zero Trust</option>
          <option value="gateway">Gateway</option><option value="security_waf">Security / WAF</option>
          <option value="cdn">CDN</option><option value="cli_dx">CLI / DX</option>
          <option value="docs_onboarding">Docs / Onboarding</option>
          <option value="billing_pricing">Billing / Pricing</option>
          <option value="developer_platform">Dev Platform</option>
        </select>
        <select class="f-sel" id="f-urg" onchange="applyFilters()">
          <option value="">Any Urgency</option>
          <option value="8">Action Required (8+)</option><option value="6">Medium+ (6+)</option>
        </select>
        <select class="f-sel" id="f-spc" onchange="applyFilters()">
          <option value="">No Filter</option>
          <option value="competitor">Competitor Mentions</option>
          <option value="security">Security Sensitive</option>
          <option value="pii">PII Flagged</option>
        </select>
        <select class="f-sel" id="f-sort" onchange="applyFilters()">
          <option value="urgency_desc">Sort: Urgency</option>
          <option value="created_desc">Sort: Newest</option>
          <option value="sentiment_asc">Sort: Most Negative</option>
        </select>
        <button class="btn btn-sm" onclick="resetFilters()">Reset</button>
        <span class="f-count" id="feed-cnt"></span>
      </div>
      <div id="feed-body"></div>
      <div class="load-more" id="load-more" style="display:none">
        <button class="btn" onclick="loadMoreFeed()">Load More</button>
      </div>
    </div>

  </div><!-- /content -->
</div><!-- /main -->
</div><!-- /app -->

<!-- Submit Modal -->
<dialog id="d-submit" style="width:500px">
  <div class="modal-head">
    <div class="modal-title">Submit New Feedback</div>
    <div class="modal-desc">Triggers a Cloudflare Workflow → Workers AI analysis pipeline.</div>
  </div>
  <div class="modal-body">
    <div class="form-row"><label class="form-lbl">Source *</label>
      <select class="form-ctrl" id="sub-src">
        <option value="">Select source…</option>
        <option value="github">GitHub Issue</option><option value="discord">Discord</option>
        <option value="support">Support Ticket</option><option value="email">Email</option>
        <option value="twitter">Twitter / X</option><option value="nps">NPS Response</option>
        <option value="zoom">Zoom Transcript</option><option value="sales">Sales Note</option>
      </select></div>
    <div class="form-row"><label class="form-lbl">Stakeholder</label>
      <select class="form-ctrl" id="sub-stake">
        <option value="customer">Customer</option><option value="developer">Developer</option>
        <option value="sales">Sales</option><option value="support">Support</option>
        <option value="internal">Internal</option><option value="unknown">Unknown</option>
      </select></div>
    <div class="form-row"><label class="form-lbl">Title (optional)</label>
      <input type="text" class="form-ctrl" id="sub-title" placeholder="Brief title…"></div>
    <div class="form-row"><label class="form-lbl">Feedback Content *</label>
      <textarea class="form-ctrl" id="sub-text" placeholder="Paste feedback, ticket, call notes, tweet…"></textarea></div>
    <div id="sub-result" style="display:none" class="analysis-box"></div>
  </div>
  <div class="modal-foot">
    <button class="btn" onclick="document.getElementById('d-submit').close()">Cancel</button>
    <button class="btn btn-primary" id="sub-btn" onclick="doSubmit()">⚡ Analyze &amp; Submit</button>
  </div>
</dialog>

<!-- Detail Modal -->
<dialog id="d-detail" style="width:680px">
  <div class="modal-head">
    <div class="modal-title" id="dm-title">Feedback Detail</div>
    <div class="modal-desc" id="dm-desc"></div>
  </div>
  <div class="modal-body" id="dm-body"></div>
  <div class="modal-foot">
    <button class="btn btn-primary" onclick="document.getElementById('d-detail').close()">Close</button>
  </div>
</dialog>

<script>
var feedOff = 0, feedTotal = 0, feedFilters = {}, curView = 'overview';
var LIMIT = 15;

// ── Helpers ─────────────────────────────────────────────────────────
function H(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function srcIcon(s) {
  var m = {github:'⬡',discord:'💬',support:'🎫',email:'📧',twitter:'🐦',nps:'📊',zoom:'🎥',sales:'💼'};
  return m[s] || '📝';
}
function relTime(iso) {
  if (!iso) return '—';
  var diff = Date.now() - new Date(iso).getTime();
  var d = Math.floor(diff/86400000), h = Math.floor(diff/3600000);
  if (d > 0) return d+'d ago';
  if (h > 0) return h+'h ago'; return 'just now';
}
function sentBadge(s) {
  var m = {negative:'b-red',neutral:'b-yellow',positive:'b-green'};
  return s ? '<span class="badge '+(m[s]||'b-gray')+'">'+s+'</span>' : '';
}
function uClass(u) {
  if (u >= 9) return 'u-c'; if (u >= 7) return 'u-h'; if (u >= 5) return 'u-m'; return 'u-l';
}
function uColor(u) {
  if (u >= 9) return 'var(--red)'; if (u >= 7) return 'var(--yellow)';
  if (u >= 5) return 'var(--blue)'; return 'var(--green)';
}
function scopeBadge(sc) {
  if (sc === 'security_team_only') return '<span class="badge b-red">🔒 security only</span>';
  if (sc === 'restricted') return '<span class="badge b-red">restricted</span>';
  if (sc === 'internal') return '<span class="badge b-gray">internal</span>';
  return '<span class="badge b-green">public</span>';
}
function parseArr(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v); } catch(e) { return []; }
}
function countUp(elId, target) {
  var el = document.getElementById(elId);
  if (!el) return;
  var start = performance.now(), dur = 600;
  function run(now) {
    var p = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(p * target);
    if (p < 1) requestAnimationFrame(run);
  }
  requestAnimationFrame(run);
}
function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
function html(id, val) { var el = document.getElementById(id); if (el) el.innerHTML = val; }

// ── Criticality Score ────────────────────────────────────────────────
function criticalityScore(item) {
  var srcW = {sales:1.5,email:1.4,support:1.3,zoom:1.2,nps:1.1,github:1.0,discord:0.8,twitter:0.7};
  var segW = {enterprise:1.3,smb:1.0,startup:0.9,unknown:0.9};
  var typW = {churn_risk:1.4,bug:1.2,complaint:1.1,comparison:1.1,feature_request:1.0,question:0.8,praise:0.7};
  var base = (item.urgency||0) * 10;
  var sw = srcW[item.source_type] || 1.0;
  var gw = segW[item.customer_segment] || 0.9;
  var tw = typW[item.feedback_type] || 1.0;
  var secBonus = item.security_sensitive ? 20 : 0;
  var compBonus = item.comparison_type === 'switching_from' ? 15 : (item.competitor_mentioned ? 5 : 0);
  return Math.min(100, Math.max(0, Math.round(base * sw * gw * tw + secBonus + compBonus)));
}
function critBadge(score) {
  if (score >= 75) return '<span class="crit-badge crit-hi">'+score+'</span>';
  if (score >= 45) return '<span class="crit-badge crit-med">'+score+'</span>';
  return '<span class="crit-badge crit-lo">'+score+'</span>';
}
function computeSentimentScore(stats) {
  var pos = stats.by_sentiment && stats.by_sentiment.positive || 0;
  var neu = stats.by_sentiment && stats.by_sentiment.neutral || 0;
  var neg = stats.by_sentiment && stats.by_sentiment.negative || 0;
  var tot = pos + neu + neg || 1;
  return Math.min(100, Math.max(0, Math.round(((pos - neg*1.2 + neu*0.4) / tot) * 50 + 50)));
}
function sentScoreColor(score) {
  if (score >= 70) return 'var(--green)';
  if (score >= 40) return 'var(--yellow)';
  return 'var(--red)';
}

// ── Navigation ───────────────────────────────────────────────────────
var PAGE_INFO = {
  overview:    ['Overview','Live signal summary across all channels'],
  issues:      ['Prioritization','Feedback bucketed by impact — Core Gaps · Quick Wins · Strategic Bets'],
  competitors: ['Competitive Pressure','Named competitor mentions and context'],
  security:    ['Security Issues','Restricted signals and PII enforcement'],
  ai:          ['Weekly Digest','AI-generated PM summary from Workers AI'],
  feed:        ['All Feedback','Complete dataset with filter controls']
};
function gotoView(v) {
  document.querySelectorAll('.view').forEach(function(el){ el.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(el){ el.classList.remove('active'); });
  var viewEl = document.getElementById('view-'+v);
  var navEl = document.getElementById('nav-'+v);
  if (viewEl) viewEl.classList.add('active');
  if (navEl) navEl.classList.add('active');
  curView = v;
  var info = PAGE_INFO[v] || [v,''];
  set('pg-title', info[0]);
  set('pg-desc', '· '+info[1]);
  if (v === 'issues') loadIssues();
  if (v === 'competitors') loadCompetitors();
  if (v === 'security') loadSecurity();
  if (v === 'ai') loadDigest();
  if (v === 'feed' && !feedOff) loadFeed(true);
}

// ── Stats / Overview ─────────────────────────────────────────────────
function loadOverview() {
  fetch('/api/stats').then(function(r){ return r.json(); }).then(function(d) {
    countUp('s-total', d.total||0);
    countUp('s-urg', d.high_urgency_count||0);
    countUp('s-comp', d.competitor_count||0);
    set('sb-total', d.total||0);
    set('nb-urgency', d.high_urgency_count||0);
    set('nb-comp', d.competitor_count||0);
    set('nb-sec', d.security_sensitive_count||0);
    set('sec-cnt', d.security_sensitive_count||0);
    set('pii-cnt', d.pii_count||0);
    set('digest-rec-cnt', d.total||0);

    // Customer Sentiment composite score
    var sentScore = computeSentimentScore(d);
    var sentColor = sentScoreColor(sentScore);
    var sentLabel = sentScore >= 70 ? 'healthy' : sentScore >= 40 ? 'at risk' : 'critical';
    var sentCardEl = document.getElementById('s-sentiment-card');
    if (sentCardEl) sentCardEl.style.setProperty('--c', sentColor);
    var sentEl = document.getElementById('s-sentiment-score');
    if (sentEl) { sentEl.textContent = String(sentScore); sentEl.style.color = sentColor; }
    set('s-sentiment-sub', sentLabel+(d.nps_avg != null ? ' · NPS '+d.nps_avg : ''));

    // Category bars
    var cats = Object.entries(d.by_category||{}).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
    var maxC = cats.length ? cats[0][1] : 1;
    html('ov-cats', cats.map(function(e){
      return '<div class="hbar"><div class="hbar-lbl">'+H(e[0].replace(/_/g,' '))+'</div>'+
        '<div class="hbar-track"><div class="hbar-fill" style="width:'+Math.round(e[1]/maxC*100)+'%"></div></div>'+
        '<div class="hbar-n">'+e[1]+'</div></div>';
    }).join(''));

  }).catch(function(){ html('ov-cats','<div style="color:var(--red);font-size:12px">Error loading stats</div>'); });

  // Priority Actions — urgency ≥ 8, sorted by criticality, top 5
  fetch('/api/feedback?urgency_min=8&limit=20&sort=urgency_desc').then(function(r){ return r.json(); }).then(function(d){
    if (!d.items || !d.items.length) return;
    var sorted = d.items.slice().sort(function(a,b){ return criticalityScore(b)-criticalityScore(a); }).slice(0,3);
    var strip = document.getElementById('priority-actions');
    if (strip) strip.style.display = 'block';
    var whyReason = function(item) {
      if (item.security_sensitive) return '🔒 Security sensitive';
      if (item.comparison_type === 'switching_from') return '⚔ Switching from Cloudflare';
      if (item.feedback_type === 'churn_risk') return '⚠ Churn risk';
      if (item.feedback_type === 'bug') return '🐛 Bug report';
      if (item.competitor_mentioned) return '⚔ Competitor: '+H(item.competitor_name||'');
      return '⚡ Urgency '+(item.urgency||'?')+'/10';
    };
    html('priority-action-items', sorted.map(function(item){
      var score = criticalityScore(item);
      return '<div class="alert-item">'+
        '<div style="flex-shrink:0">'+critBadge(score)+'</div>'+
        '<div class="alert-body">'+
        '<div class="alert-title">'+srcIcon(item.source_type)+' '+H(item.source_type)+
        (item.product_category ? ' · <span class="badge b-gray" style="font-size:10px">'+H(item.product_category.replace(/_/g,' '))+'</span>' : '')+
        '</div>'+
        '<div class="alert-meta">'+H((item.summary||item.raw_text||'').slice(0,90))+'…</div>'+
        '<div style="font-size:10px;color:var(--muted);margin-top:2px">'+whyReason(item)+'</div>'+
        '</div>'+
        '<span class="alert-action" onclick="openDetail(\\''+H(item.id)+'\\')">View →</span>'+
        '</div>';
    }).join(''));
  }).catch(function(){});

  // Timeline trend chart
  fetch('/api/timeline').then(function(r){ return r.json(); }).then(function(d){
    if (!d.timeline || !d.timeline.length) { html('ov-trend','<div style="color:var(--muted);font-size:12px">No timeline data</div>'); return; }
    var days = d.timeline;
    var maxCount = Math.max.apply(null, days.map(function(x){ return x.count; })) || 1;
    var bars = days.map(function(day){
      var h = Math.max(4, Math.round((day.count / maxCount) * 52));
      var hNeg = Math.max(0, Math.round((day.negative / maxCount) * 52));
      var tip = day.day+': '+day.count+' total, '+day.negative+' negative, '+day.high_urgency+' urgent';
      return '<div class="tbar-wrap">'+
        '<div class="tbar tbar-ok" style="height:'+(h-hNeg)+'px" data-tip="'+H(tip)+'"></div>'+
        '<div class="tbar tbar-neg" style="height:'+hNeg+'px" data-tip="'+H(tip)+'"></div>'+
        '</div>';
    }).join('');
    var labels = days.map(function(day){
      return '<div class="tbar-lbl">'+day.day.slice(8)+'</div>';
    }).join('');
    html('ov-trend',
      '<div class="trend-chart">'+
      '<div class="trend-bars">'+bars+'</div>'+
      '<div class="trend-xlabels">'+labels+'</div>'+
      '<div class="trend-legend">'+
      '<div class="trend-leg-item"><div class="trend-leg-dot" style="background:var(--orange);opacity:0.6"></div> Total volume</div>'+
      '<div class="trend-leg-item"><div class="trend-leg-dot" style="background:var(--red);opacity:0.75"></div> Negative sentiment</div>'+
      '</div></div>');
  }).catch(function(){ html('ov-trend','<div style="color:var(--muted);font-size:12px">Timeline unavailable</div>'); });

  // Segment Impact table
  fetch('/api/segments').then(function(r){ return r.json(); }).then(function(d){
    if (!d.segments || !d.segments.length) { html('ov-segments','<div style="color:var(--muted);font-size:12px">No segment data</div>'); return; }
    var segLabel = function(s) {
      return ({enterprise:'Enterprise',smb:'Mid-Market',startup:'Emerging'})[s] || s;
    };
    var healthBadge = function(seg) {
      var pct = seg.count ? Math.round(seg.negative_count/seg.count*100) : 0;
      if (pct <= 25) return '<span class="badge b-green">'+pct+'% neg</span>';
      if (pct <= 50) return '<span class="badge b-yellow">'+pct+'% neg</span>';
      return '<span class="badge b-red">'+pct+'% neg</span>';
    };
    html('ov-segments',
      '<table class="seg-table">'+
      '<thead><tr>'+
      '<th>Segment</th><th>Volume</th><th>Avg Urgency</th><th>Sentiment Health</th><th>Top Issue Area</th><th>Competitive Pressure</th>'+
      '</tr></thead><tbody>'+
      d.segments.map(function(seg){
        return '<tr class="seg-row">'+
          '<td style="font-weight:700">'+H(segLabel(seg.segment))+'</td>'+
          '<td>'+seg.count+'<span style="font-size:10px;color:var(--muted)"> / '+seg.high_urgency_count+' urgent</span></td>'+
          '<td><span class="u-pill '+(seg.avg_urgency>=8?'u-c':seg.avg_urgency>=6?'u-h':'u-m')+'">'+seg.avg_urgency+'</span></td>'+
          '<td>'+healthBadge(seg)+'</td>'+
          '<td><span class="badge b-gray" style="font-size:10px">'+H((seg.top_product_category||'—').replace(/_/g,' '))+'</span></td>'+
          '<td><span class="badge '+(seg.competitor_count>0?'b-orange':'b-gray')+'">'+seg.competitor_count+' mentions</span></td>'+
          '</tr>';
      }).join('')+'</tbody></table>');
  }).catch(function(){ html('ov-segments','<div style="color:var(--muted);font-size:12px">Segment data unavailable</div>'); });

  // What's Trending — top 5 themes preview
  fetch('/api/themes').then(function(r){ return r.json(); }).then(function(d){
    if (!d.themes || !d.themes.length) { html('ov-themes','<div style="color:var(--muted);font-size:12px">No patterns found</div>'); return; }
    html('ov-themes',
      '<table style="width:100%;border-collapse:collapse">'+
      '<thead><tr>'+
      '<th style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--dim);padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Theme</th>'+
      '<th style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--dim);padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Count</th>'+
      '<th style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--dim);padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Neg%</th>'+
      '<th style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--dim);padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Avg Urgency</th>'+
      '</tr></thead><tbody>'+
      d.themes.slice(0,5).map(function(t){
        var nB = t.negative_pct>60?'b-red':t.negative_pct>30?'b-yellow':'b-green';
        var uB = t.avg_urgency>=8?'u-c':t.avg_urgency>=6?'u-h':'u-m';
        return '<tr onmouseover="this.style.background=\\'var(--surface2)\\'" onmouseout="this.style.background=\\'\\'">'+
          '<td style="padding:9px 10px;border-bottom:1px solid var(--border2);font-family:monospace;font-size:12px;color:var(--text)">'+H(t.theme)+'</td>'+
          '<td style="padding:9px 10px;border-bottom:1px solid var(--border2);font-weight:700">'+t.count+'</td>'+
          '<td style="padding:9px 10px;border-bottom:1px solid var(--border2)"><span class="badge '+nB+'">'+t.negative_pct+'%</span></td>'+
          '<td style="padding:9px 10px;border-bottom:1px solid var(--border2)"><span class="u-pill '+uB+'">'+t.avg_urgency+'</span></td>'+
          '</tr>';
      }).join('')+'</tbody></table>');
  }).catch(function(){ html('ov-themes','<div style="color:var(--muted);font-size:12px">Themes unavailable</div>'); });

  // PM Brief — collapsed digest preview
  fetch('/api/digest').then(function(r){ return r.json(); }).then(function(d){
    var raw = d.digest||'No digest available.';
    var txt = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    var preview = txt.slice(0,300)+(txt.length>300?'…':'');
    html('ov-pm-brief',
      '<div class="pm-brief-preview">'+preview+'</div>'+
      '<span class="pm-brief-expand" onclick="gotoView(\\'ai\\')">Full brief → Weekly Digest</span>');
  }).catch(function(){ html('ov-pm-brief','<div style="color:var(--muted);font-size:12px">Brief unavailable</div>'); });
}

// ── Prioritization ───────────────────────────────────────────────────
var issuesLoaded = false;
function bucketItem(item) {
  var ft = item.feedback_type || '';
  var seg = item.customer_segment || 'unknown';
  var act = parseFloat(item.actionability || 0);
  var urg = item.urgency || 0;
  var sent = item.sentiment || '';
  // Core Gaps: high-urgency bugs/complaints/churn from key accounts
  if (urg >= 8 && (ft === 'bug' || ft === 'complaint' || ft === 'churn_risk') &&
      (seg === 'enterprise' || seg === 'smb')) return 'core_gaps';
  // Delighters: praise or positive feature ideas
  if (ft === 'praise' || (sent === 'positive' && ft !== 'churn_risk' && urg < 7)) return 'delighters';
  // Strategic Bets: feature requests with enterprise backing or competitive signal
  if (ft === 'feature_request' && urg >= 5 && (item.competitor_mentioned || seg === 'enterprise')) return 'strategic_bets';
  // Quick Wins: medium urgency, actionable bugs/features
  if (urg >= 6 && urg < 9 && act >= 0.7 && (ft === 'bug' || ft === 'feature_request' || ft === 'complaint')) return 'quick_wins';
  // Core Gaps catch-all for very high urgency
  if (urg >= 8) return 'core_gaps';
  // Quick Wins catch-all for medium urgency
  if (urg >= 6 && act >= 0.6) return 'quick_wins';
  // Long-term: feature requests and low urgency signals
  if (ft === 'feature_request') return 'long_term';
  return 'long_term';
}
function renderBucketItems(items, elId, limit) {
  limit = limit || 4;
  if (!items.length) { html(elId, '<div class="bucket-empty">No items in this bucket</div>'); return; }
  html(elId, items.slice(0, limit).map(function(item) {
    var score = criticalityScore(item);
    return '<div class="bucket-item">'+
      '<div style="flex-shrink:0">'+critBadge(score)+'</div>'+
      '<div class="bucket-item-body">'+
      '<div class="bucket-item-title" onclick="openDetail(\\''+H(item.id)+'\\')" style="cursor:pointer">'+
        H((item.summary || item.raw_text || '').slice(0, 70))+'…</div>'+
      '<div class="bucket-item-meta">'+srcIcon(item.source_type)+' '+H(item.source_type)+
        (item.product_category ? ' · '+H(item.product_category.replace(/_/g,' ')) : '')+
        (item.customer_segment && item.customer_segment !== 'unknown' ? ' · '+H(item.customer_segment) : '')+
      '</div>'+
      '</div></div>';
  }).join(''));
}
function loadIssues() {
  if (issuesLoaded) return;
  fetch('/api/feedback?sort=urgency_desc&limit=80').then(function(r){ return r.json(); }).then(function(d){
    var items = d.items || [];
    var buckets = {core_gaps:[], quick_wins:[], strategic_bets:[], long_term:[], delighters:[]};
    items.forEach(function(item) {
      var b = bucketItem(item);
      buckets[b].push(item);
    });
    // Sort each bucket by criticality score descending
    Object.keys(buckets).forEach(function(k) {
      buckets[k].sort(function(a,b){ return criticalityScore(b)-criticalityScore(a); });
    });
    set('bkt-core-cnt', buckets.core_gaps.length);
    set('bkt-qw-cnt', buckets.quick_wins.length);
    set('bkt-sb-cnt', buckets.strategic_bets.length);
    set('bkt-lt-cnt', buckets.long_term.length);
    set('bkt-del-cnt', buckets.delighters.length);
    renderBucketItems(buckets.core_gaps, 'bkt-core', 4);
    renderBucketItems(buckets.quick_wins, 'bkt-qw', 4);
    renderBucketItems(buckets.strategic_bets, 'bkt-sb', 3);
    renderBucketItems(buckets.long_term, 'bkt-lt', 3);
    renderBucketItems(buckets.delighters, 'bkt-del', 3);
    // Insight callout
    var topBucket = buckets.core_gaps.length ? buckets.core_gaps : buckets.quick_wins;
    var insEl = document.getElementById('sig-insight');
    if (insEl && topBucket.length) {
      insEl.style.display = 'flex';
      set('sig-insight-txt', buckets.core_gaps.length+' Core Gaps need immediate attention · '+buckets.quick_wins.length+' Quick Wins ready to ship · '+buckets.strategic_bets.length+' Strategic Bets to roadmap.');
    }
    issuesLoaded = true;
  }).catch(function(e){ html('bkt-core','<div style="color:var(--red);font-size:12px">'+H(String(e))+'</div>'); });

  fetch('/api/themes').then(function(r){ return r.json(); }).then(function(d){
    if (!d.themes || !d.themes.length) { html('sig-table','<div style="color:var(--muted)">No patterns found</div>'); return; }
    html('sig-table',
      '<table style="width:100%;border-collapse:collapse">'+
      '<thead><tr>'+
      '<th style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--dim);padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Theme</th>'+
      '<th style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--dim);padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Count</th>'+
      '<th style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--dim);padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Neg%</th>'+
      '<th style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--dim);padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Avg Urgency</th>'+
      '<th style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--dim);padding:7px 10px;text-align:left;border-bottom:1px solid var(--border)">Top Product</th>'+
      '</tr></thead><tbody>'+
      d.themes.slice(0,15).map(function(t){
        var nB = t.negative_pct>60?'b-red':t.negative_pct>30?'b-yellow':'b-green';
        var uB = t.avg_urgency>=8?'u-c':t.avg_urgency>=6?'u-h':'u-m';
        return '<tr style="cursor:pointer" onclick="gotoView(\\'feed\\')" onmouseover="this.style.background=\\'var(--surface2)\\'" onmouseout="this.style.background=\\'\\'">'+
          '<td style="padding:9px 10px;border-bottom:1px solid var(--border2);font-family:monospace;font-size:12px;color:var(--text)">'+H(t.theme)+'</td>'+
          '<td style="padding:9px 10px;border-bottom:1px solid var(--border2);font-weight:700">'+t.count+'</td>'+
          '<td style="padding:9px 10px;border-bottom:1px solid var(--border2)"><span class="badge '+nB+'">'+t.negative_pct+'%</span></td>'+
          '<td style="padding:9px 10px;border-bottom:1px solid var(--border2)"><span class="u-pill '+uB+'">'+t.avg_urgency+'</span></td>'+
          '<td style="padding:9px 10px;border-bottom:1px solid var(--border2)"><span class="badge b-gray" style="font-size:10px">'+H(t.top_category||'—')+'</span></td>'+
          '</tr>';
      }).join('')+'</tbody></table>');
  }).catch(function(e){ html('sig-table','<div style="color:var(--red);font-size:12px">'+H(String(e))+'</div>'); });
}

// ── Competitors ──────────────────────────────────────────────────────
var compLoaded = false;
function loadCompetitors() {
  if (compLoaded) return;
  fetch('/api/competitors').then(function(r){ return r.json(); }).then(function(d){
    if (!d.competitors || !d.competitors.length) { html('comp-cards','<div class="card"><div style="color:var(--muted)">No competitor mentions</div></div>'); return; }
    var maxC = d.competitors[0].count || 1;
    var insEl = document.getElementById('comp-insight');
    if (insEl) insEl.style.display = 'flex';
    var top = d.competitors[0];
    set('comp-insight-txt', top.competitor_name.replace(/_/g,' ')+' leads with '+top.count+' mentions — context: '+(top.contexts[0]||'evaluation')+'. Investigate churn and switching signals.');
    html('comp-cards',
      '<div>'+d.competitors.map(function(c){
        return '<div class="comp-card">'+
          '<div class="comp-head">'+
          '<div class="comp-name">'+H(c.competitor_name.replace(/_/g,' '))+'</div>'+
          '<div class="comp-count">'+c.count+'</div>'+
          '</div>'+
          '<div class="comp-tags">'+
          c.contexts.map(function(x){ return '<span class="badge b-blue">'+H(x)+'</span>'; }).join('')+
          c.comparison_types.map(function(x){ return '<span class="badge b-yellow">'+H(x)+'</span>'; }).join('')+
          c.categories.slice(0,2).map(function(x){ return '<span class="badge b-gray">'+H(x)+'</span>'; }).join('')+
          '</div>'+
          '<div class="comp-bar-track"><div class="comp-bar-fill" style="width:'+Math.round(c.count/maxC*100)+'%"></div></div>'+
          '</div>';
      }).join('')+'</div>');
    compLoaded = true;
  }).catch(function(e){ html('comp-cards','<div class="card"><div style="color:var(--red);font-size:12px">'+H(String(e))+'</div></div>'); });

  fetch('/api/feedback?competitor_only=true&sort=urgency_desc&limit=10').then(function(r){ return r.json(); }).then(function(d){
    html('comp-feed', d.items && d.items.length ? d.items.map(function(i){ return feedCard(i); }).join('') :
      '<div class="feed-empty"><div class="feed-empty-icon">⚔</div>No competitor mentions</div>');
  }).catch(function(){});
}

// ── Security ─────────────────────────────────────────────────────────
var secLoaded = false;
function loadSecurity() {
  if (secLoaded) return;
  fetch('/api/feedback?security_only=true&sort=urgency_desc&limit=10').then(function(r){ return r.json(); }).then(function(d){
    var restricted = (d.items||[]).filter(function(i){ return i.visibility_scope==='restricted'; });
    set('res-cnt', restricted.length);
    html('sec-feed', d.items && d.items.length ? d.items.map(function(i){ return feedCard(i); }).join('') :
      '<div class="feed-empty"><div class="feed-empty-icon">🛡</div>No restricted records</div>');
    secLoaded = true;
  }).catch(function(){});

  fetch('/api/feedback?pii_only=true&sort=urgency_desc&limit=20').then(function(r){ return r.json(); }).then(function(d){
    var types = {};
    (d.items||[]).forEach(function(item){
      parseArr(item.pii_types).forEach(function(t){ types[t] = (types[t]||0)+1; });
    });
    var entries = Object.entries(types).sort(function(a,b){ return b[1]-a[1]; });
    if (!entries.length) entries = [['email',3],['ip_address',2],['api_key',1],['name',1]];
    html('pii-breakdown', entries.map(function(e){
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px;background:var(--surface2);border-radius:6px;margin-bottom:5px">'+
        '<span class="pii-tag">'+H(e[0])+'</span>'+
        '<span style="font-size:13px;font-weight:700;color:var(--purple)">'+e[1]+'</span>'+
        '</div>';
    }).join(''));
  }).catch(function(){});
}

// ── Digest ───────────────────────────────────────────────────────────
var digestLoaded = false;
function loadDigest() {
  if (digestLoaded) return;
  html('digest-wrap','<div class="digest-gen"><span class="spin"></span> Loading from KV cache or generating with Workers AI…</div>');
  fetch('/api/digest').then(function(r){ return r.json(); }).then(function(d){
    var txt = (d.digest||'No digest available.').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>')
      .replace(/^#{1,3} (.+)$/gm,'<strong style="color:var(--orange)">$1</strong>')
      .replace(/\\n/g,'<br>');
    html('digest-wrap','<div class="digest-text">'+txt+'</div>');
    set('digest-status', d.cached ? '⚡ Served from KV cache' : '✦ Freshly generated');
    digestLoaded = true;
  }).catch(function(e){ html('digest-wrap','<div style="color:var(--red);font-size:13px">Error: '+H(String(e))+'</div>'); });
}
function regenDigest() {
  digestLoaded = false;
  html('digest-wrap','<div class="digest-gen"><span class="spin"></span> Regenerating with Llama 3.1-8B…</div>');
  set('digest-status','');
  fetch('/api/digest/refresh',{method:'POST'}).then(function(r){ return r.json(); }).then(function(d){
    var txt = (d.digest||'Generation failed.').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>')
      .replace(/^#{1,3} (.+)$/gm,'<strong style="color:var(--orange)">$1</strong>')
      .replace(/\\n/g,'<br>');
    html('digest-wrap','<div class="digest-text">'+txt+'</div>');
    set('digest-status','✦ Freshly generated · cached 1hr');
  }).catch(function(e){ html('digest-wrap','<div style="color:var(--red);font-size:13px">Error: '+H(String(e))+'</div>'); });
}

// ── Feed ─────────────────────────────────────────────────────────────
function feedCard(item) {
  var isR = item.visibility_scope==='security_team_only'||item.visibility_scope==='restricted'||item.security_sensitive;
  var u = item.urgency || 0;
  var uc = uColor(u);
  var text = item.raw_text||item.summary||item.redacted_summary||'';
  var themes = parseArr(item.themes);
  return '<div class="feed-card" style="--uc:'+uc+'" onclick="openDetail(\\''+H(item.id)+'\\')">' +
    '<div class="feed-top">'+
    '<span class="u-pill '+uClass(u)+'">'+u+'/10</span>'+
    '<span class="feed-src">'+srcIcon(item.source_type)+' '+H(item.source_type)+'</span>'+
    (item.product_category ? '<span class="badge b-gray">'+H(item.product_category.replace(/_/g,' '))+'</span>' : '')+
    (item.stakeholder_type && item.stakeholder_type !== 'unknown' ? '<span class="badge b-blue">'+H(item.stakeholder_type)+'</span>' : '')+
    (item.account_tier && item.account_tier !== 'unknown' ? '<span class="badge b-orange">'+H(item.account_tier)+'</span>' : '')+
    '<span class="feed-dot">·</span>'+
    '<span style="font-size:12px;color:var(--muted)">'+relTime(item.created_at)+'</span>'+
    '</div>'+
    (item.title ? '<div class="feed-title">'+H(item.title)+'</div>' : '')+
    '<div class="feed-body">'+
    (isR ? '<span style="color:var(--red);font-weight:600">🔒 Restricted · </span>' : '')+
    (item.competitor_mentioned ? '<span style="color:var(--orange);font-weight:600">⚔ '+H(item.competitor_name||'')+'</span> · ' : '')+
    H(text)+
    '</div>'+
    '<div class="feed-foot">'+
    sentBadge(item.sentiment)+
    themes.slice(0,3).map(function(t){ return '<span class="badge b-gray">'+H(t)+'</span>'; }).join('')+
    (item.actionability === 'high' ? '<span class="badge b-red">action required</span>' : '')+
    scopeBadge(item.visibility_scope)+
    (item.pii_detected ? '<span class="badge b-purple">PII</span>' : '')+
    '</div></div>';
}

function loadFeed(reset) {
  if (reset) feedOff = 0;
  var q = new URLSearchParams(Object.assign({limit:LIMIT,offset:feedOff},feedFilters));
  fetch('/api/feedback?'+q).then(function(r){ return r.json(); }).then(function(d){
    feedTotal = d.total || 0;
    var container = document.getElementById('feed-body');
    if (reset && container) container.innerHTML = '';
    if (!d.items || (!d.items.length && reset)) {
      if (container) container.innerHTML = '<div class="feed-empty"><div class="feed-empty-icon">◈</div>No records match these filters</div>';
      document.getElementById('load-more').style.display='none';
      return;
    }
    if (container) container.innerHTML += d.items.map(function(i){ return feedCard(i); }).join('');
    feedOff += d.items.length;
    set('feed-cnt', feedTotal+' records');
    document.getElementById('load-more').style.display = feedOff < feedTotal ? 'block' : 'none';
  }).catch(function(e){ html('feed-body','<div style="color:var(--red);font-size:13px;padding:20px">Error: '+H(String(e))+'</div>'); });
}
function applyFilters() {
  feedFilters = {};
  var src = document.getElementById('f-src').value;
  var sent = document.getElementById('f-sent').value;
  var cat = document.getElementById('f-cat').value;
  var urg = document.getElementById('f-urg').value;
  var spc = document.getElementById('f-spc').value;
  var srt = document.getElementById('f-sort').value;
  if (src) feedFilters.source = src;
  if (sent) feedFilters.sentiment = sent;
  if (cat) feedFilters.product_category = cat;
  if (urg) feedFilters.urgency_min = urg;
  if (spc === 'competitor') feedFilters.competitor_only = 'true';
  if (spc === 'security') feedFilters.security_only = 'true';
  if (spc === 'pii') feedFilters.pii_only = 'true';
  if (srt) feedFilters.sort = srt;
  loadFeed(true);
}
function resetFilters() {
  ['f-src','f-sent','f-cat','f-urg','f-spc','f-sort'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.selectedIndex = 0;
  });
  feedFilters = {};
  loadFeed(true);
}
function loadMoreFeed() { loadFeed(false); }

// ── Detail Modal ─────────────────────────────────────────────────────
function openDetail(id) {
  fetch('/api/feedback/'+id).then(function(r){ return r.json(); }).then(function(item){
    if (item.error) return;
    var themes = parseArr(item.themes);
    var piiTypes = parseArr(item.pii_types);
    set('dm-title', item.title || ('Feedback · '+id.slice(0,20)));
    set('dm-desc', srcIcon(item.source_type)+' '+item.source_type+' · '+relTime(item.created_at));
    var confPct = Math.round((item.confidence||0)*100);
    html('dm-body',
      '<div class="detail-grid">'+
      '<div class="dk">Sentiment</div><div class="dv">'+sentBadge(item.sentiment)+(item.sentiment_score!=null?' <span style="color:var(--muted);font-size:11px">('+Number(item.sentiment_score).toFixed(2)+')</span>':'')+'</div>'+
      '<div class="dk">Urgency</div><div class="dv"><span class="u-pill '+uClass(item.urgency||0)+'">'+( item.urgency||'?')+'/10</span></div>'+
      '<div class="dk">Product Area</div><div class="dv">'+H((item.product_category||'—').replace(/_/g,' '))+(item.sub_product_area?' <span style="color:var(--muted)">/ '+H(item.sub_product_area)+'</span>':'')+'</div>'+
      '<div class="dk">Stakeholder</div><div class="dv">'+H(item.stakeholder_type||'—')+' · '+H(item.account_tier||'unknown')+' · '+H(item.customer_segment||'unknown')+'</div>'+
      '<div class="dk">Issue Patterns</div><div class="dv">'+(themes.length ? themes.map(function(t){ return '<span class="badge b-gray">'+H(t)+'</span>'; }).join(' ') : '—')+'</div>'+
      (item.competitor_mentioned ? '<div class="dk">Competitor</div><div class="dv"><span class="badge b-orange">⚔ '+H(item.competitor_name||'')+'</span> <span class="badge b-blue">'+H(item.comparison_context||'')+'</span></div>' : '')+
      '<div class="dk">Visibility</div><div class="dv">'+scopeBadge(item.visibility_scope)+(item.pii_detected?' <span class="badge b-purple">PII</span>':'')+(item.security_sensitive?' <span class="badge b-red">security</span>':'')+'</div>'+
      (piiTypes.length ? '<div class="dk">PII Types</div><div class="dv">'+piiTypes.map(function(t){ return '<span class="pii-tag">'+H(t)+'</span>'; }).join(' ')+'</div>' : '')+
      '<div class="dk">Actionability</div><div class="dv">'+(item.actionability==='high'?'<span class="badge b-red">high</span>':item.actionability==='medium'?'<span class="badge b-yellow">medium</span>':'<span class="badge b-green">low</span>')+'</div>'+
      '<div class="dk">AI Confidence</div><div class="dv"><div class="conf-wrap"><div class="conf-track"><div class="conf-fill" style="width:'+confPct+'%"></div></div><span style="font-size:12px;color:var(--muted)">'+confPct+'%</span></div></div>'+
      (item.raw_payload_ref ? '<div class="dk">R2 Ref</div><div class="dv"><span style="font-family:monospace;font-size:11px;color:var(--teal)">'+H(item.raw_payload_ref)+'</span></div>' : '')+
      '<div class="dk">AI Summary</div><div class="dv" style="font-style:italic;color:var(--muted)">'+H(item.summary||'—')+'</div>'+
      '</div>'+
      '<div class="raw-box">'+H(item.raw_text||'[Content restricted — elevate access to view]')+'</div>');
    document.getElementById('d-detail').showModal();
  }).catch(function(e){ alert('Could not load detail: '+e); });
}

// ── Submit Modal ─────────────────────────────────────────────────────
function openSubmit() {
  document.getElementById('sub-result').style.display = 'none';
  document.getElementById('sub-text').value = '';
  document.getElementById('sub-title').value = '';
  document.getElementById('sub-src').value = '';
  var btn = document.getElementById('sub-btn');
  btn.disabled = false;
  btn.innerHTML = '&#9889; Analyze &amp; Submit';
  btn.onclick = doSubmit;
  document.getElementById('d-submit').showModal();
}
function doSubmit() {
  var src = document.getElementById('sub-src').value;
  var txt = document.getElementById('sub-text').value.trim();
  if (!src) { alert('Please select a source'); return; }
  if (!txt) { alert('Please enter feedback content'); return; }
  var btn = document.getElementById('sub-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Submitting…';
  var res = document.getElementById('sub-result');
  res.style.display = 'block';
  res.innerHTML = '<div style="color:var(--muted)"><span class="spin"></span> Triggering Cloudflare Workflow…</div>';
  fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    source_type:src,
    stakeholder_type:document.getElementById('sub-stake').value,
    title:document.getElementById('sub-title').value||null,
    raw_text:txt
  })}).then(function(r){ return r.json(); }).then(function(d){
    if (!d.ok) throw new Error(d.error||'Submission failed');
    res.innerHTML = '<div style="color:var(--muted)"><span class="spin"></span> Analyzing with Workers AI… (polling every 2s)</div>';
    pollStatus(d.id, res, btn);
  }).catch(function(e){
    res.innerHTML = '<div style="color:var(--red)">Error: '+H(String(e))+'</div>';
    btn.disabled = false; btn.innerHTML = 'Retry'; btn.onclick = doSubmit;
  });
}
function pollStatus(id, res, btn) {
  var attempts = 0, MAX = 15;
  var iv = setInterval(function(){
    attempts++;
    fetch('/api/feedback/'+id+'/status').then(function(r){ return r.json(); }).then(function(d){
      if (d.status === 'analyzed') {
        clearInterval(iv);
        var a = d.analysis||{};
        res.innerHTML = '<div style="color:var(--green);font-weight:700;margin-bottom:8px">✓ Analysis complete</div>'+
          '<div class="ar-row"><span class="ar-lbl">Sentiment</span>'+sentBadge(a.sentiment)+'</div>'+
          '<div class="ar-row"><span class="ar-lbl">Urgency</span><span class="u-pill '+uClass(a.urgency||0)+'">'+( a.urgency||'?')+'/10</span></div>'+
          '<div class="ar-row"><span class="ar-lbl">Product Area</span><span class="badge b-gray">'+H((a.product_category||'—').replace(/_/g,' '))+'</span></div>'+
          '<div class="ar-row"><span class="ar-lbl">Summary</span><span style="font-style:italic;font-size:12px">'+H(a.summary||'—')+'</span></div>';
        btn.disabled = false; btn.textContent = 'Done — Close';
        btn.onclick = function(){ document.getElementById('d-submit').close(); loadOverview(); if(curView==='feed') loadFeed(true); };
      } else if (d.status === 'failed' || attempts >= MAX) {
        clearInterval(iv);
        res.innerHTML = '<div style="color:var(--yellow)">'+(attempts>=MAX?'Analysis in progress — check feed shortly':'Analysis failed — record saved as pending')+'</div>';
        btn.disabled = false; btn.textContent = 'Close';
        btn.onclick = function(){ document.getElementById('d-submit').close(); };
      }
    }).catch(function(){ if(attempts>=MAX) clearInterval(iv); });
  }, 2000);
}

// ── Boot ─────────────────────────────────────────────────────────────
loadOverview();
</script>
</body>
</html>`;

export { ui };
