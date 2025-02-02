!(function(e, t) {
    "object" == typeof exports && "undefined" != typeof module
        ? (module.exports = t())
        : "function" == typeof define && define.amd
        ? define(t)
        : ((e = e || self).ContextMenu = t());
})(this, function() {
    "use strict";
    const animate = ({
        timing,
        draw,
        duration,
        endAnimation = () => {}
    } = {}) => {
        const start = performance.now();
        let requestId = requestAnimationFrame(function animate(time) {
            let timeFraction = (time - start) / duration;
            if (timeFraction > 1) timeFraction = 1;
            let progress = timing(timeFraction);
            draw(progress);
            if (timeFraction < 1) {
                requestId = requestAnimationFrame(animate);
            } else {
                endAnimation();
            }
        });
        return () => cancelAnimationFrame(requestId);
    };
    !(function(e, t) {
        void 0 === t && (t = {});
        var n = t.insertAt;
        if (e && "undefined" != typeof document) {
            var i = document.head || document.getElementsByTagName("head")[0],
                o = document.createElement("style");
            (o.type = "text/css"),
                "top" === n && i.firstChild
                    ? i.insertBefore(o, i.firstChild)
                    : i.appendChild(o),
                o.styleSheet
                    ? (o.styleSheet.cssText = e)
                    : o.appendChild(document.createTextNode(e));
        }
    })(`
    .ContextMenu {
        display: none;
        list-style: none;
        margin: 0;
        max-width: 250px;
        min-width: 90px;
        padding: 0;
        position: absolute;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        font-family: MainFont;
        font-size: 14px;
        color: #def0ff;
    }
    
    .ContextMenu--theme-default {
        background-color: #242F3D;
        outline: 0;
    }
    
    .ContextMenu--theme-default .ContextMenu-item {
        padding: 6px 12px;
    }
    
    .ContextMenu--theme-default .ContextMenu-item:focus, .ContextMenu--theme-default .ContextMenu-item:hover {
        background-color: #141F29;
    }
    
    .ContextMenu--theme-default .ContextMenu-item:focus {
        outline: 0;
    }
    
    .ContextMenu--theme-default .ContextMenu-divider {
        background: #def0ff;
    }
    
    .ContextMenu.is-open {
        display: block;
    }
    
    .ContextMenu-item {
        cursor: pointer;
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    
    .ContextMenu-divider {
        height: 1px;
    }
    
    `);
    var i = [],
        o = 0;
    function n(e, t, n) {
        void 0 === n && (n = {});
        var i = document.createEvent("Event");
        Object.keys(n).forEach(function(e) {
            i[e] = n[e];
        }),
            i.initEvent(t, !0, !0),
            e.dispatchEvent(i);
    }
    Element.prototype.matches ||
        (Element.prototype.matches = Element.prototype.msMatchesSelector);
    function e(e, t, n) {
        void 0 === n && (n = { className: "", minimalStyling: !1 }),
            (this.selector = e),
            (this.items = t),
            (this.options = n),
            (this.id = o++),
            (this.target = null),
            this.create(),
            i.push(this);
    }
    return (
        (e.prototype.create = function() {
            var i = this;
            (this.menu = document.createElement("ul")),
                (this.menu.className = "ContextMenu"),
                this.menu.setAttribute("data-contextmenu", this.id),
                this.menu.setAttribute("tabindex", -1),
                this.menu.addEventListener("keyup", function(e) {
                    switch (e.which) {
                        case 38:
                            i.moveFocus(-1);
                            break;
                        case 40:
                            i.moveFocus(1);
                            break;
                        case 27:
                            i.hide();
                    }
                }),
                this.options.minimalStyling ||
                    this.menu.classList.add("ContextMenu--theme-default"),
                this.options.className &&
                    this.options.className.split(" ").forEach(function(e) {
                        return i.menu.classList.add(e);
                    }),
                this.items.forEach(function(e, t) {
                    var n = document.createElement("li");
                    "name" in e
                        ? ((n.className = "ContextMenu-item"),
                          (n.textContent = e.name),
                          n.setAttribute("data-contextmenuitem", t),
                          n.setAttribute("tabindex", 0),
                          n.addEventListener("click", i.select.bind(i, n)),
                          n.addEventListener("keyup", function(e) {
                              13 === e.which && i.select(n);
                          }))
                        : (n.className = "ContextMenu-divider"),
                        i.menu.appendChild(n);
                }),
                document.body.appendChild(this.menu),
                n(this.menu, "created");
        }),
        (e.prototype.show = function(e) {
            this.menu.classList.add("is-open");
            const [menuHeight] = (getComputedStyle(this.menu).height.match(/\d+/g));
            if (e.clientY + +menuHeight >= window.innerHeight) {
                return;
            }
            this.menu.style.transformOrigin = 'top left';
            animate({
                timing: t => t,
                draw: progress => {
                    this.menu.style.opacity = progress;
                    this.menu.style.transform = `scale(${progress}, ${progress})`;
                },
                duration: 250
            });
            (this.menu.style.left = e.pageX + "px"),
                (this.menu.style.top = e.pageY + "px"),
                (this.target = e.target),
                this.menu.focus(),
                e.preventDefault(),
                n(this.menu, "shown");
        }),
        (e.prototype.hide = function() {
            this.menu.style.transformOrigin = 'bottom right';
            animate({
                timing: t => t,
                draw: progress => {
                    const coef = 1 - progress;
                    this.menu.style.opacity = coef;
                    this.menu.style.transform = `scale(${coef}, ${coef})`;
                },
                duration: 250,
                endAnimation: () => {
                    this.menu.classList.remove("is-open"),
                (this.target = null),
                n(this.menu, "hidden");
                }
            });
            
        }),
        (e.prototype.select = function(e) {
            var t = e.getAttribute("data-contextmenuitem");
            this.items[t] && this.items[t].fn(this.target),
                this.hide(),
                n(this.menu, "itemselected");
        }),
        (e.prototype.moveFocus = function(e) {
            void 0 === e && (e = 1);
            var t,
                n = this.menu.querySelector("[data-contextmenuitem]:focus");
            n &&
                (t = (function e(t, n, i) {
                    void 0 === i && (i = 1);
                    var o =
                        0 < i ? t.nextElementSibling : t.previousElementSibling;
                    return !o || o.matches(n) ? o : e(o, n, i);
                })(n, "[data-contextmenuitem]", e)),
                (t =
                    t ||
                    (0 < e
                        ? this.menu.querySelector(
                              "[data-contextmenuitem]:first-child"
                          )
                        : this.menu.querySelector(
                              "[data-contextmenuitem]:last-child"
                          ))) && t.focus();
        }),
        (e.prototype.on = function(e, t) {
            this.menu.addEventListener(e, t);
        }),
        (e.prototype.off = function(e, t) {
            this.menu.removeEventListener(e, t);
        }),
        (e.prototype.destroy = function() {
            this.menu.parentElement.removeChild(this.menu),
                (this.menu = null),
                i.splice(i.indexOf(this), 1);
        }),
        document.addEventListener("contextmenu", function(t) {
            if (t.clientX + 90 >= window.innerWidth) {
                return;
            }
            i.forEach(function(e) {
                t.path.some(el => el.matches && el.matches(e.selector)) && e.show(t);
            });
        }),
        document.addEventListener("click", function(t) {
            i.forEach(function(e) {
                t.target.matches(
                    '[data-contextmenu="' +
                        e.id +
                        '"], [data-contextmenu="' +
                        e.id +
                        '"] *'
                ) || e.hide();
            });
        }),
        e
    );
});
//# sourceMappingURL=context-menu.js.map
