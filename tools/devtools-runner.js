// Runs an effect in desktop Chrome with the same `ctx` the MangaX app gives it, so a script can be
// tried on the real site before it goes anywhere near a phone.
//
// 1. Open the site in Chrome, open DevTools → Console.
// 2. Paste this whole file and press Enter.
// 3. Optional — set up like the app would (defaults: toggle, no options, novel):
//      mangaxTest.setup({ type: 'toggle', engine: 'manga', options: { speed: 60 }, permissions: ['toast'] })
//    translated: true gives a manga page the buttons it has once translated (area_rescan, bubble_edit, export_chapter);
//    pressing bubble_edit then adds bubble_add, and bubble_merge too with selected: true (a bubble picked).
// 4. Paste the effect's main.js and press Enter. It starts at once.
// 5. Try it, then:
//      mangaxTest.options({ speed: 120 })   the reader changes a setting
//      mangaxTest.stop()                    the reader switches it off — the page should be back to normal
//      mangaxTest.fromCompanion(data)       a message from the companion page (ctx.companion.onMessage);
//      mangaxTest.companion()               on the companion site: runs mangax.companion(fn) here, and
//      mangaxTest.toCompanion(data)         plays the page being read sending it a message
//      mangaxTest.settings()                opens what mangax.settings(fn) draws, as the sheet's settings button does
//                                           (mangaxTest.setup({ theme: { dark: false }, lang: 'en' }) for a light app in English)
//
// Errors are printed the way the app would report them. Toasts and menu / engine commands go to the console;
// mangaxTest.emit(name, data) sends an app event, mangaxTest.emit('menu:change', {...}) updates a menu the effect draws.
// page:overlay is raised by the runner itself, as the app does, for every pinned box that comes up.
// Differences from the app: the page's own globals are visible here (on iOS they are not), and
// options are not clamped to the manifest's limits.
(function () {
    var config = {
        type: 'toggle', engine: 'novel', options: {}, permissions: [], auto: false, translated: false, selected: false,
        theme: {dark: true}, lang: 'th'
    };
    var run = null;
    var settingsBody = null;
    var panel = null;

    var MENU_ICONS = {
        scan: 'document_scanner',
        effects: 'auto_fix_high',
        full_context_scan: 'auto_awesome',
        read_aloud: 'record_voice_over',
        area_rescan: 'crop_free',
        bubble_edit: 'palette',
        bubble_add: 'add_comment',
        bubble_merge: 'call_merge',
        export_chapter: 'save_alt',
        settings: 'settings'
    };

    // The modes a press turns on and off; lit in menu.items while on.
    var TOGGLES = {area_rescan: false, bubble_edit: false, bubble_add: false, bubble_merge: false};

    // What menu.items answers here, in the app's order. The app's list depends on the engine and the page.
    function menuKeys() {
        if (config.engine === 'novel') return ['scan', 'effects', 'read_aloud', 'settings'];
        var keys = ['scan', 'effects', 'full_context_scan'];
        if (config.translated) {
            keys.push('area_rescan');
            keys.push('bubble_edit');
            if (TOGGLES.bubble_edit) keys.push('bubble_add');
            if (TOGGLES.bubble_edit && config.selected) keys.push('bubble_merge');
            keys.push('export_chapter');
        }
        keys.push('settings');
        return keys;
    }

    function menuJson() {
        return {
            engine: config.engine,
            items: menuKeys().map(function (key) {
                return {key: key, label: key, icon: MENU_ICONS[key], active: TOGGLES[key] === true};
            })
        };
    }

    var COMMAND_PERMISSIONS = {
        toast: 'toast',
        'menu.items': 'menu', 'menu.press': 'menu', 'menu.replace': 'menu',
        'engine.get': null,
        'engine.set': 'engine',
        'options.set': null,
        'companion.open': 'companion', 'companion.view': 'companion', 'companion.close': 'companion',
        'companion.state': 'companion', 'companion.send': 'companion'
    };

    // The companion page, pretended: the app would open a second page and run mangax.companion(fn)
    // there. Here the effect's side is simulated — what it sends is logged, and
    // mangaxTest.fromCompanion(data) / mangaxTest.companionState(state) answer it. To try the
    // companion code itself, paste this file and the script into the companion site's console and
    // run mangaxTest.companion(); mangaxTest.toCompanion(data) then plays the page being read.
    var companionState = {open: false};
    var companionRun = null;
    var companionBody = null;

    function tellCompanion(type, data) {
        [run, panel].forEach(function (r) {
            if (!r) return;
            r.companionListeners.slice().forEach(function (entry) {
                if (entry.type === type) entry.fn(data);
            });
        });
    }

    function setCompanion(next) {
        companionState = next;
        log('companion', JSON.stringify(next));
        // Later, as from the app: a state reaches the effect after the call that changed it.
        Promise.resolve().then(function () {
            tellCompanion('state', next);
        });
    }

    function tellOptions(next) {
        [run, panel].forEach(function (r) {
            if (!r) return;
            r.ctx.options = next;
            r.optionListeners.forEach(function (fn) {
                fn(next);
            });
        });
    }

    function log(kind, text) {
        console.log('%c[mangax] ' + kind, 'color:#8b5cf6;font-weight:bold', text);
    }

    function stop(r, why) {
        if (!r || r.stopped) return;
        r.stopped = true;
        for (var i = r.cleanups.length - 1; i >= 0; i--) {
            try {
                r.cleanups[i]();
            } catch (e) {
                log('cleanup error', e);
            }
        }
        r.cleanups = [];
        if (run === r) run = null;
        if (panel === r) panel = null;
        log(r.isPanel ? 'settings closed' : 'stopped', why || '');
    }

    function fail(r, e) {
        if (r.stopped) return;
        log('error — the app would switch the effect off and show:', (e && e.message) || String(e));
        console.error(e);
        stop(r, 'after an error');
    }

    function guard(r, fn) {
        return function () {
            if (r.stopped) return undefined;
            try {
                return fn.apply(this, arguments);
            } catch (e) {
                fail(r, e);
            }
            return undefined;
        };
    }

    function cleanup(r, fn) {
        if (r.stopped) {
            try {
                fn();
            } catch (e) {
            }
            return;
        }
        r.cleanups.push(fn);
    }

    function companionListen(r, type, fn) {
        var entry = {type: type, fn: guard(r, fn)};
        r.companionListeners.push(entry);
        cleanup(r, function () {
            var i = r.companionListeners.indexOf(entry);
            if (i >= 0) r.companionListeners.splice(i, 1);
        });
    }

    function context(r) {
        var ctx = {
            id: 'devtools.test',
            options: config.options,
            engine: config.engine,
            site: location.host,
            auto: !!config.auto,
            on: function (target, type, fn, options) {
                if (!target || typeof target.addEventListener !== 'function') {
                    throw new TypeError('ctx.on(target, type, fn): target must be an element, document or window, got ' + JSON.stringify(target));
                }
                var handler = guard(r, fn);
                target.addEventListener(type, handler, options);
                cleanup(r, function () {
                    target.removeEventListener(type, handler, options);
                });
            },
            observe: function (selector, fn) {
                if (typeof selector !== 'string') throw new TypeError('ctx.observe(selector, fn): selector must be one CSS selector string');
                var seen = new WeakSet();
                var call = guard(r, fn);

                function visit(node) {
                    if (!node || node.nodeType !== 1 || seen.has(node)) return;
                    seen.add(node);
                    call(node);
                }

                function scan(root) {
                    if (!root || root.nodeType !== 1) return;
                    if (root.matches && root.matches(selector)) visit(root);
                    var found = root.querySelectorAll(selector);
                    for (var i = 0; i < found.length; i++) visit(found[i]);
                }

                scan(document.documentElement);
                var observer = new MutationObserver(function (records) {
                    if (r.stopped) return;
                    for (var i = 0; i < records.length; i++) {
                        for (var j = 0; j < records[i].addedNodes.length; j++) scan(records[i].addedNodes[j]);
                    }
                });
                observer.observe(document.documentElement, {childList: true, subtree: true});
                cleanup(r, function () {
                    observer.disconnect();
                });
            },
            addStyle: function (css) {
                var el = document.createElement('style');
                el.setAttribute('data-mangax-effect', ctx.id);
                el.textContent = String(css);
                (document.head || document.documentElement).appendChild(el);
                cleanup(r, function () {
                    if (el.parentNode) el.parentNode.removeChild(el);
                });
                return el;
            },
            onOptions: function (fn) {
                r.optionListeners.push(guard(r, fn));
            },
            onUrlChange: function (fn) {
                var last = location.href;
                var handler = guard(r, fn);
                var timer = setInterval(function () {
                    if (location.href !== last) {
                        last = location.href;
                        handler(last);
                    }
                }, 500);
                cleanup(r, function () {
                    clearInterval(timer);
                });
            },
            onEvent: function (name, fn) {
                if (typeof fn !== 'function') throw new TypeError('ctx.onEvent(name, fn): fn must be a function');
                var entry = {name: String(name), fn: guard(r, fn)};
                r.eventListeners.push(entry);
                if (entry.name === 'page:overlay') watchOverlays(r);
                cleanup(r, function () {
                    var i = r.eventListeners.indexOf(entry);
                    if (i >= 0) r.eventListeners.splice(i, 1);
                });
            },
            call: function (cmd, args) {
                if (!(cmd in COMMAND_PERMISSIONS)) return Promise.reject(new Error('unknown command "' + cmd + '"'));
                var needs = COMMAND_PERMISSIONS[cmd];
                if (needs && config.permissions.indexOf(needs) < 0) {
                    return Promise.reject(new Error('"' + cmd + '" needs the "' + needs + '" permission in effect.json'));
                }
                args = args || {};
                switch (cmd) {
                    case 'toast':
                        log('toast', args.text);
                        return Promise.resolve(null);
                    case 'menu.items':
                        return Promise.resolve(menuJson());
                    case 'menu.press':
                        if (menuKeys().indexOf(args.key) < 0) {
                            return Promise.reject(new Error('the menu has no "' + args.key + '" button right now'));
                        }
                        log('menu.press', args.key);
                        if (args.key in TOGGLES) {
                            TOGGLES[args.key] = !TOGGLES[args.key];
                            // Editing off takes adding with it, as in the app.
                            if (!TOGGLES.bubble_edit) {
                                TOGGLES.bubble_add = false;
                                TOGGLES.bubble_merge = false;
                            }
                            emit('menu:change', menuJson());
                        }
                        return Promise.resolve(null);
                    case 'menu.replace':
                        log('menu.replace', args.on === false ? 'menu button back' : 'menu button hidden while this runs');
                        return Promise.resolve(args.on !== false);
                    case 'companion.open':
                        var view = args.view || companionState.view || 'hidden';
                        setCompanion({open: true, url: args.url || '(effect.json companion.url)', view: view, loading: false, ready: true});
                        return Promise.resolve(companionState);
                    case 'companion.view':
                        if (!companionState.open) return Promise.reject(new Error('the companion page is not open'));
                        if (['hidden', 'mini', 'sheet', 'full'].indexOf(args.view) < 0) return Promise.reject(new Error('view must be hidden, mini, sheet or full'));
                        setCompanion(Object.assign({}, companionState, {view: args.view}));
                        return Promise.resolve(companionState);
                    case 'companion.close':
                        if (companionState.open) setCompanion({open: false, reason: 'effect'});
                        return Promise.resolve(null);
                    case 'companion.state':
                        return Promise.resolve(companionState);
                    case 'companion.send':
                        if (!companionState.open) return Promise.reject(new Error('the companion page is not open'));
                        log('→ companion', JSON.stringify(args.data));
                        return Promise.resolve(true);
                    case 'engine.get':
                        return Promise.resolve(config.engine);
                    case 'options.set':
                        // The app also checks the key and the value against effect.json's options.
                        if (typeof args.key !== 'string') return Promise.reject(new Error('"options.set" needs { key, value }'));
                        var next = {};
                        for (var k in config.options) next[k] = config.options[k];
                        next[args.key] = args.value;
                        config.options = next;
                        log('options.set', args.key + ' = ' + JSON.stringify(args.value));
                        tellOptions(next);
                        return Promise.resolve(args.value);
                    case 'engine.set':
                        if (args.type !== 'manga' && args.type !== 'novel') {
                            return Promise.reject(new Error('"engine.set" needs { type: "manga" | "novel" }'));
                        }
                        if (args.type !== config.engine) {
                            config.engine = args.type;
                            emit('engine:change', {type: args.type});
                            emit('menu:change', menuJson());
                        }
                        return Promise.resolve(args.type);
                }
            },
            toast: function (text) {
                return ctx.call('toast', {text: String(text)});
            },
            setOption: function (key, value) {
                return ctx.call('options.set', {key: String(key), value: value});
            },
            companion: {
                open: function (opts) {
                    opts = opts || {};
                    return ctx.call('companion.open', {url: opts.url || null, view: opts.view || null});
                },
                show: function (view) { return ctx.call('companion.view', {view: String(view)}); },
                close: function () { return ctx.call('companion.close', null); },
                state: function () { return ctx.call('companion.state', null); },
                send: function (data) { return ctx.call('companion.send', {data: data === undefined ? null : data}); },
                onMessage: function (fn) { companionListen(r, 'message', fn); },
                onState: function (fn) { companionListen(r, 'state', fn); }
            },
            stop: function () {
                stop(r, 'by the effect');
            }
        };
        return ctx;
    }

    // page:overlay, raised the way the app raises it: every pinned box that comes up, once.
    function watchOverlays(r) {
        if (r.overlayWatch) return;
        var shown = new Set(), seq = 0, lastTap = 0, timer = 0, lastScan = 0;
        function box(el, style) {
            if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.05) return null;
            var b = el.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
            var left = Math.max(b.left, 0), top = Math.max(b.top, 0);
            var w = Math.min(b.right, vw) - left, h = Math.min(b.bottom, vh) - top;
            if (w <= 0 || h <= 0 || w * h < 400) return null;
            return {left: left, top: top, width: w, height: h, cover: (w * h) / (vw * vh)};
        }
        function scan() {
            timer = 0;
            lastScan = Date.now();
            var showing = new Set(), appeared = [];
            // As the app does: under <html> too, where some ad scripts pin their boxes.
            document.querySelectorAll('body *, html > :not(head):not(body), html > :not(head):not(body) *').forEach(function (el) {
                var style = getComputedStyle(el);
                if (style.position !== 'fixed' && style.position !== 'sticky') return;
                for (var p = el.parentElement; p; p = p.parentElement) if (showing.has(p)) return;
                var b = box(el, style);
                if (!b) return;
                showing.add(el);
                if (shown.has(el)) return;
                var id = el.getAttribute('data-mangax-overlay') || String(++seq);
                el.setAttribute('data-mangax-overlay', id);
                appeared.push({
                    id: id, selector: '[data-mangax-overlay="' + id + '"]', position: style.position,
                    cover: Math.round(b.cover * 100) / 100, left: Math.round(b.left), top: Math.round(b.top),
                    width: Math.round(b.width), height: Math.round(b.height),
                    z: parseInt(style.zIndex, 10) || 0, sinceTap: lastTap ? Date.now() - lastTap : -1
                });
            });
            shown = showing;
            // Straight to this run: an action is not `run`, and its listeners stay until the page goes.
            appeared.forEach(function (data) {
                log('event', 'page:overlay ' + JSON.stringify(data));
                r.eventListeners.slice().forEach(function (entry) {
                    if (entry.name === 'page:overlay' || entry.name === '*') entry.fn(data, 'page:overlay');
                });
            });
        }
        function schedule() {
            if (!timer) timer = setTimeout(scan, Math.max(0, lastScan + 200 - Date.now()));
        }
        function tap() { lastTap = Date.now(); }
        var observer = new MutationObserver(schedule);
        observer.observe(document.documentElement, {
            childList: true, subtree: true, attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-hidden']
        });
        addEventListener('pointerdown', tap, true);
        addEventListener('touchstart', tap, true);
        r.overlayWatch = true;
        schedule();
        cleanup(r, function () {
            observer.disconnect();
            clearTimeout(timer);
            removeEventListener('pointerdown', tap, true);
            removeEventListener('touchstart', tap, true);
        });
    }

    function emit(name, data) {
        if (!run) return log('emit', 'nothing is running');
        log('event', name + ' ' + JSON.stringify(data));
        run.eventListeners.slice().forEach(function (entry) {
            if (entry.name === name || entry.name === '*') entry.fn(data, name);
        });
    }

    // What ctx.panel() gives in the app, close enough to try a settings screen on: a backdrop and a
    // card in a shadow root, coloured by config.theme.
    function makePanel(r, ctx, opts) {
        if (r.box) return r.box;
        var dark = ctx.theme.dark !== false;
        var center = opts.position === 'center';
        var host = document.createElement('div');
        host.setAttribute('data-mangax-ui', ctx.id);
        host.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;display:flex!important;' +
            'justify-content:center!important;align-items:' + (center ? 'center' : 'flex-end') + '!important';
        var vars = {
            '--mx-background': dark ? '#0f0f14' : '#ffffff', '--mx-surface': dark ? '#1b1b22' : '#f4f4f7',
            '--mx-surface2': dark ? '#26262f' : '#e7e7ec', '--mx-primary': '#6c5ce7', '--mx-secondary': '#00cec9',
            '--mx-text': dark ? '#ffffff' : '#111111', '--mx-text-body': dark ? '#d0d0d8' : '#333333',
            '--mx-text-muted': dark ? '#8a8a96' : '#777777'
        };
        for (var name in vars) host.style.setProperty(name, vars[name]);
        var root = host.attachShadow({mode: 'open'});
        var backdrop = document.createElement('div');
        backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,' + (opts.dim === undefined ? 0.45 : opts.dim) + ')';
        var card = document.createElement('div');
        card.style.cssText = 'position:relative;box-sizing:border-box;width:' + (center ? 'calc(100% - 32px)' : '100%') +
            ';max-width:520px;max-height:85vh;overflow:auto;padding:16px;border-radius:' + (center ? '16px' : '16px 16px 0 0') +
            ';background:var(--mx-surface);color:var(--mx-text);font:14px/1.45 system-ui,sans-serif';
        root.appendChild(backdrop);
        root.appendChild(card);
        if (opts.dismissible !== false) backdrop.addEventListener('click', guard(r, function () { ctx.close(); }));
        document.body.appendChild(host);
        cleanup(r, function () {
            host.remove();
        });
        r.box = {
            host: host, root: root, card: card, close: function () { ctx.close(); },
            css: function (text) {
                var sheet = new CSSStyleSheet();
                sheet.replaceSync(String(text));
                root.adoptedStyleSheets = root.adoptedStyleSheets.concat([sheet]);
            }
        };
        return r.box;
    }

    var called = false;
    window.mangax = {
        version: 1,
        companion: function (body) {
            if (typeof body !== 'function') throw new TypeError('mangax.companion(fn): fn must be a function');
            companionBody = body;
            log('companion', 'mangaxTest.companion() runs it on this page, as if this were the companion page');
        },
        settings: function (body) {
            if (typeof body !== 'function') throw new TypeError('mangax.settings(fn): fn must be a function');
            settingsBody = body;
            log('settings', 'mangaxTest.settings() opens it');
        },
        effect: function (body) {
            if (typeof body !== 'function') throw new TypeError('mangax.effect(fn): fn must be a function');
            stop(run, 'restarted');
            var r = {cleanups: [], optionListeners: [], eventListeners: [], companionListeners: [], stopped: false};
            var ctx = context(r);
            try {
                var result = body(ctx);
                var pending = result && typeof result.then === 'function';
                if (config.type === 'toggle') {
                    if (pending) {
                        result.then(function (fn) {
                            if (typeof fn === 'function') cleanup(r, fn);
                        }, function (e) {
                            fail(r, e);
                        });
                    } else if (typeof result === 'function') {
                        cleanup(r, result);
                    }
                } else if (pending) {
                    result.then(null, function (e) {
                        fail(r, e);
                    });
                }
            } catch (e) {
                fail(r, e);
                return;
            }
            if (config.type === 'action') {
                log('ran', 'an action keeps nothing running');
                return;
            }
            if (r.stopped) return;
            run = r;
            r.ctx = ctx;
            called = true;
            log('running', 'mangaxTest.stop() to switch it off');
        }
    };

    window.mangaxTest = {
        setup: function (next) {
            for (var k in next) config[k] = next[k];
            log('setup', JSON.stringify(config));
        },
        options: function (next) {
            config.options = next;
            if (!run) return log('options', 'nothing is running');
            run.ctx.options = next;
            run.optionListeners.forEach(function (fn) {
                fn(next);
            });
        },
        // An app event, e.g. emit('translate:done', { type: 'manga', engine: 'manga', mode: 'realtime' })
        emit: function (name, data) {
            emit(String(name), data || {});
        },
        closeMenu: function (key) {
            emit('menu:close', {key: key || null});
        },
        stop: function () {
            if (!run) return log('stop', called ? 'already stopped' : 'nothing is running');
            stop(run, 'by the reader');
            // As in the app: switching the effect off closes the companion page it opened.
            if (companionState.open) setCompanion({open: false, reason: 'stopped'});
        },
        // The companion page's side: messages as if from the effect on the page being read.
        fromCompanion: function (data) { tellCompanion('message', data); },
        companionState: function (state) { setCompanion(state); },
        companion: function () {
            if (!companionBody) return log('companion', 'the effect never called mangax.companion(fn)');
            stop(companionRun, 'restarted');
            var r = {cleanups: [], optionListeners: [], eventListeners: [], companionListeners: [], stopped: false};
            var ctx = context(r);
            delete ctx.companion;
            ctx.role = 'companion';
            ctx.send = function (data) { log('companion → page', JSON.stringify(data)); };
            ctx.onMessage = function (fn) { companionListen(r, 'message', fn); };
            ctx.show = function (view) {
                log('companion.view', view);
                return Promise.resolve({open: true, view: view});
            };
            ctx.close = function () {
                stop(r, 'companion closed');
                return Promise.resolve(null);
            };
            r.ctx = ctx;
            companionRun = r;
            try {
                var result = companionBody(ctx);
                if (typeof result === 'function') cleanup(r, result);
                log('companion', 'running — mangaxTest.toCompanion(data) sends it a message');
            } catch (e) {
                fail(r, e);
            }
        },
        toCompanion: function (data) {
            if (!companionRun) return log('toCompanion', 'mangaxTest.companion() first');
            companionRun.companionListeners.slice().forEach(function (entry) {
                if (entry.type === 'message') entry.fn(data);
            });
        },
        settings: function () {
            if (!settingsBody) return log('settings', 'the effect never called mangax.settings(fn)');
            stop(panel, 'reopened');
            var r = {cleanups: [], optionListeners: [], eventListeners: [], companionListeners: [], stopped: false, isPanel: true};
            var ctx = context(r);
            ctx.theme = config.theme;
            ctx.lang = config.lang;
            ctx.close = function () { stop(r, 'by the effect'); };
            ctx.stop = ctx.close;
            ctx.panel = function (opts) { return makePanel(r, ctx, opts || {}); };
            r.ctx = ctx;
            panel = r;
            try {
                var result = settingsBody(ctx);
                if (typeof result === 'function') cleanup(r, result);
            } catch (e) {
                fail(r, e);
            }
        }
    };

    log('ready', 'paste the effect\'s main.js now');
})();
